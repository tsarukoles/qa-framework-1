#!/usr/bin/env node
/**
 * scripts/hooks/secret-scan.mjs — pre-commit scan of Git's STAGED content (Week 2, Task 08).
 *
 * It inspects what Git has selected for the next commit (`git show :<path>`), not the files in the
 * editor: a token staged earlier is found even when the working copy is clean again.
 *
 *   - Rejects protected file names: .env, .env.*, *.pem, *.key, *.p12, id_rsa, id_ed25519.
 *     A placeholder-only .env.example passes the name check but its content is still scanned.
 *   - Rejects token-shaped content (the Task 06 patterns): Slack bot token, Atlassian API token,
 *     AWS access key id, private-key header. Values are never printed, only file and line.
 *   - Scans every staged file, including new files and the guard/scanner sources and their tests.
 *
 * File names come from `git diff --cached --name-only -z` (NUL-delimited), so spaces are safe.
 * Exit 1 on any finding (the commit stops), 0 when the staged content is clean. Node built-ins only.
 */
import { spawnSync } from 'node:child_process';

// Detector prefixes are assembled from pieces so this file never contains a token-shaped string.
const SLACK_BOT = ['xox', 'b-'].join('');
const ATLASSIAN = ['ATA', 'TT'].join('');
const AWS_KEY = ['AK', 'IA'].join('');
const PEM_HEADER = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
const DETECTORS = [
  { name: 'Slack bot token', test: (line) => line.includes(SLACK_BOT) },
  { name: 'Atlassian API token', test: (line) => line.includes(ATLASSIAN) },
  { name: 'AWS access key id', test: (line) => new RegExp(`${AWS_KEY}[0-9A-Z]{4,}`).test(line) },
  { name: 'private-key header', test: (line) => line.includes(PEM_HEADER) },
];

const PROTECTED_EXACT = new Set(['.env', 'id_rsa', 'id_ed25519']);
const PROTECTED_SUFFIX = ['.pem', '.key', '.p12'];

function git(args, encoding = 'utf8') {
  const result = spawnSync('git', args, { encoding, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout;
}

function isProtectedName(base) {
  if (base === '.env.example') return false;
  return (
    PROTECTED_EXACT.has(base) ||
    base.startsWith('.env.') ||
    PROTECTED_SUFFIX.some((s) => base.endsWith(s))
  );
}

function main() {
  const list = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']);
  const files = list.split('\0').filter((p) => p.length > 0);
  const findings = [];
  for (const file of files) {
    const base = file.split('/').pop() ?? file;
    if (isProtectedName(base)) {
      findings.push(`${file}: protected file name (${base}) must not be committed`);
      continue;
    }
    const content = git(['show', `:${file}`]);
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const detector of DETECTORS) {
        if (detector.test(line))
          findings.push(`${file}:${index + 1}: looks like a ${detector.name}`);
      }
    });
  }
  if (findings.length === 0) {
    console.log(`secret-scan: ${files.length} staged file(s) clean`);
    return 0;
  }
  console.error('secret-scan: BLOCKED — the staged content contains:');
  for (const finding of findings) console.error(`  - ${finding}`);
  console.error(
    'Unstage or fix the file, keep real secrets in the ignored .env, then commit again.',
  );
  return 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(`secret-scan: could not inspect the staged content (${err.message})`);
  process.exit(1);
}
