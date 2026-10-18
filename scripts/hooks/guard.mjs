#!/usr/bin/env node
/**
 * scripts/hooks/guard.mjs — PreToolUse guard for Claude's Edit and Write tools (Week 2, Task 06).
 *
 * Reads one hook event (JSON on stdin), examines only the supplied input, and either
 *   - blocks: exit 2 with one actionable reason on stderr, starting "guard: BLOCKED — ", or
 *   - stays silent: exit 0 (normal permission checks still apply).
 * Malformed or unreadable input exits 0 silently. Unexpected errors exit 0.
 * This course guard FAILS OPEN: an input it cannot understand is not evidence that the edit was safe.
 *
 * Checks, in this order (Edit: file_path + old_string + new_string; Write: file_path + content):
 *   1 protected filename (.env, .env.*, *.pem, *.key, *.p12, id_rsa, id_ed25519); .env.example is exempt here only
 *   2 secret-looking new content (Slack bot token, Atlassian API token, AWS access key id, private-key header)
 *   3 *.spec.ts: .only present in the new text and absent from the old text
 *   4 *.spec.ts: .skip present in the new text and absent from the old text
 *   5 *.spec.ts, Edit only: fewer expect( calls in new_string than in old_string
 *   6 *.spec.ts, Edit only: fewer runIfEnv( or fewer envGuard( calls (counted separately)
 *   7 *.spec.ts: waitForTimeout( present in the new text and absent from the old text (a hard wait)
 * A Write supplies no old text: checks 3, 4 and 7 treat it as empty; checks 5 and 6 cannot run (no baseline).
 * Node built-ins only. It never opens files, so a secret file is never read.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

// Detector prefixes are assembled from pieces so this file never contains a token-shaped string.
const SLACK_BOT = ['xox', 'b-'].join('');
const ATLASSIAN = ['ATA', 'TT'].join('');
const AWS_KEY = ['AK', 'IA'].join('');
const PEM_HEADER = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');

const PROTECTED_EXACT = new Set(['.env', 'id_rsa', 'id_ed25519']);
const PROTECTED_SUFFIX = ['.pem', '.key', '.p12'];

function readInput() {
  let raw;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    return null;
  }
  raw = raw.replace(/^\uFEFF+/, '');
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function block(reason) {
  process.stderr.write(`guard: BLOCKED — ${reason}\n`);
  process.exit(2);
}

function basenameOf(filePath) {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? '';
}

function isProtectedName(base) {
  if (base === '.env.example') return false;
  if (PROTECTED_EXACT.has(base)) return true;
  if (base.startsWith('.env.')) return true;
  return PROTECTED_SUFFIX.some((suffix) => base.endsWith(suffix));
}

function looksLikeSecret(text) {
  return (
    text.includes(SLACK_BOT) ||
    text.includes(ATLASSIAN) ||
    new RegExp(`${AWS_KEY}[0-9A-Z]{4,}`).test(text) ||
    text.includes(PEM_HEADER)
  );
}

const count = (text, re) => (text.match(re) ?? []).length;

// Task 09: the explicit list of CRITICAL shared files (the tier table lives in
// .claude/rules/01-guardrails.md; that Markdown table does not update this list).
// A listed path gets a review reminder after every refusal check passed. Exit stays 0.
const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const CRITICAL_PATHS = new Set([
  'playwright.config.ts',
  'tsconfig.json',
  'package.json',
  'eslint.config.mjs',
  '.prettierrc.json',
  'env/target.ts',
  'env/runIfEnv.ts',
  'env/envGuard.ts',
  'tests/support/env.ts',
  'tests/support/users.ts',
  '.claude/settings.json',
  '.husky/pre-commit',
  '.husky/pre-push',
  'scripts/hooks/guard.mjs',
  'scripts/hooks/secret-scan.mjs',
  'scripts/hooks/pre-push-check.mjs',
  'scripts/hooks/stop-worklog.mjs',
  'scripts/hooks/session-preflight.mjs',
  'scripts/vault-sync.mjs',
]);
const CRITICAL_REMINDER = 'guard: WARN — shared file; review the affected callers before approving';

/** The project-relative, forward-slash form of a path; empty when it is outside the project. */
function projectRelative(filePath) {
  if (!filePath) return '';
  const absolute = isAbsolute(filePath) ? resolve(filePath) : resolve(ROOT, filePath);
  const rel = relative(ROOT, absolute).replace(/\\/g, '/');
  return rel === '' || rel === '..' || rel.startsWith('../') || isAbsolute(rel) ? '' : rel;
}

function main() {
  const payload = readInput();
  if (!payload) return 0;
  const input = payload.tool_input;
  if (!input || typeof input !== 'object') return 0;

  const filePath = typeof input.file_path === 'string' ? input.file_path : '';
  const base = basenameOf(filePath);
  const isWrite =
    payload.tool_name === 'Write' ||
    (typeof input.content === 'string' && input.new_string === undefined);
  const newText = String(isWrite ? (input.content ?? '') : (input.new_string ?? ''));
  const oldText = isWrite ? '' : String(input.old_string ?? '');

  // 1 protected filename
  if (isProtectedName(base)) {
    block(
      `${base} is a protected file name. Secrets stay in the ignored .env; a template must be named .env.example.`,
    );
  }

  // 2 secret-looking new content
  if (looksLikeSecret(newText)) {
    block(
      `the new content of ${base || 'this file'} contains a token-shaped string. Read secrets from the environment instead of writing them into a file.`,
    );
  }

  if (/\.spec\.ts$/.test(base)) {
    // 3 .only added
    if (/\.only\b/.test(newText) && !/\.only\b/.test(oldText)) {
      block(
        `this edit adds .only to ${base}, which would silently leave every other test out of the run. Remove .only and run the whole suite.`,
      );
    }
    // 4 .skip added
    if (/\.skip\b/.test(newText) && !/\.skip\b/.test(oldText)) {
      block(
        `this edit adds .skip to ${base}. Use runIfEnv(test, ['dev']) for environment eligibility, or delete the test in a reviewed commit.`,
      );
    }
    if (!isWrite) {
      // 5 fewer expect( calls
      const expectsBefore = count(oldText, /\bexpect\s*\(/g);
      const expectsAfter = count(newText, /\bexpect\s*\(/g);
      if (expectsAfter < expectsBefore) {
        block(
          `this edit removes an assertion from ${base} (expect( calls ${expectsBefore} -> ${expectsAfter}). Keep the check; move it in the same edit if it must change place.`,
        );
      }
      // 6 fewer runIfEnv( or fewer envGuard( calls, counted separately
      const railsBefore = count(oldText, /\brunIfEnv\s*\(/g);
      const railsAfter = count(newText, /\brunIfEnv\s*\(/g);
      if (railsAfter < railsBefore) {
        block(
          `this edit removes a runIfEnv( call from ${base} (${railsBefore} -> ${railsAfter}). Keep the call and change the environment list inside it instead.`,
        );
      }
      const guardsBefore = count(oldText, /\benvGuard\s*\(/g);
      const guardsAfter = count(newText, /\benvGuard\s*\(/g);
      if (guardsAfter < guardsBefore) {
        block(
          `this edit removes an envGuard( call from ${base} (${guardsBefore} -> ${guardsAfter}). The guard must stay in front of the action that changes data.`,
        );
      }
    }
    // 7 hard wait added (Edit: new text vs old text; Write: the whole new content)
    if (/waitForTimeout\s*\(/.test(newText) && !/waitForTimeout\s*\(/.test(oldText)) {
      block(
        `this edit adds waitForTimeout( to ${base}. Wait for the condition the test actually needs, for example await expect(locator).toBeVisible(), which retries until it is true.`,
      );
    }
  }

  // Task 09: a listed CRITICAL file gets a reminder, never a decision (no permissionDecision).
  if (CRITICAL_PATHS.has(projectRelative(filePath))) {
    process.stdout.write(
      JSON.stringify({
        systemMessage: CRITICAL_REMINDER,
        hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: CRITICAL_REMINDER },
      }) + '\n',
    );
  }
  return 0;
}

try {
  process.exit(main());
} catch {
  process.exit(0);
}
