#!/usr/bin/env node
/**
 * scripts/hooks/stop-worklog.mjs — Stop hook: the daily-journal reminder (Week 2, Task 07).
 *
 *   node scripts/hooks/stop-worklog.mjs --path   print today's journal path and exit 0 (reads no stdin)
 *   node scripts/hooks/stop-worklog.mjs          read the Stop event (JSON on stdin) and decide, in this order:
 *     stop_hook_active is true                      -> exit 0 (already inside a retry; never loop)
 *     unreadable input                              -> exit 0
 *     no qualifying uncommitted file and no commit today -> exit 0 (nothing to record)
 *     today's journal has a line beginning "## HH:MM" -> exit 0
 *     otherwise                                     -> stderr "stop-worklog: BLOCKED — ..." naming the exact
 *                                                      path and /worklog; exit 2 (Claude continues and writes it)
 *
 * Journal path: vault/12-progress-report/<slug>/<local YYYY-MM-DD>.md. The slug is git user.name trimmed
 * and lowercased, every run of characters outside a-z and 0-9 replaced by "-", edge hyphens removed,
 * "student" when nothing is left. Qualifying changed files: .ts, .mjs, .json, .md, .sh (git status
 * --porcelain --untracked-files=all). "A commit today" compares the last commit's local calendar date
 * with today's. Unexpected failures exit 0. Node built-ins only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const QUALIFYING = /\.(ts|mjs|json|md|sh)$/i;

function git(args, fallback) {
  try {
    const result = spawnSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const out = result.status === 0 ? (result.stdout || '').trim() : '';
    return out || fallback;
  } catch {
    return fallback;
  }
}

function localDate(now = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

export function studentSlug(name) {
  const slug = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'student';
}

function journalPath() {
  return `vault/12-progress-report/${studentSlug(git(['config', 'user.name'], ''))}/${localDate()}.md`;
}

function qualifyingChanges() {
  const out = git(['status', '--porcelain', '--untracked-files=all'], '');
  if (out === '') return 0;
  return out
    .split(/\r?\n/)
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3))
    .map((p) => (p.includes(' -> ') ? p.split(' -> ').pop() : p))
    .filter((p) => QUALIFYING.test(p.trim().replace(/^"|"$/g, ''))).length;
}

function committedToday() {
  const iso = git(['log', '-1', '--format=%cI'], '');
  if (!iso) return false;
  const when = new Date(iso);
  return !Number.isNaN(when.getTime()) && localDate(when) === localDate();
}

function hasEntry(path) {
  const abs = resolve(ROOT, path);
  return existsSync(abs) && /^## \d{2}:\d{2}/m.test(readFileSync(abs, 'utf8'));
}

if (process.argv[2] === '--path') {
  process.stdout.write(journalPath() + '\n');
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8').replace(/^\uFEFF+/, ''));
} catch {
  process.exit(0);
}
if (!payload || typeof payload !== 'object' || payload.stop_hook_active === true) process.exit(0);

try {
  if (qualifyingChanges() === 0 && !committedToday()) process.exit(0);
  const journal = journalPath();
  if (hasEntry(journal)) process.exit(0);
  process.stderr.write(
    `stop-worklog: BLOCKED — work happened today but ${journal} has no "## HH:MM" entry.\n` +
      `Run /worklog (it appends a "## HH:MM" heading with Did / Worked / didn't / Next to ${journal}), then finish again.\n`,
  );
  process.exit(2);
} catch {
  process.exit(0);
}
