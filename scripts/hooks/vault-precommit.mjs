#!/usr/bin/env node
/**
 * scripts/hooks/vault-precommit.mjs — the spec-note steps of the pre-commit hook (Week 2, Task 11).
 *
 *   --safety    before any write: refuse a partially staged spec, a related note with unstaged edits,
 *               or an existing untracked note. Exit 1 with the list, else 0.
 *   --refresh   after format and lint: refresh and stage the notes of the staged specs (added, modified,
 *               copied, renamed: old and new path; deleted: old path), then check them. Exit 1 on a problem.
 *
 * Staged paths come from `git diff --cached --name-status -z -M` (NUL-delimited, renames detected) and are
 * passed to scripts/vault-sync.mjs as separate arguments. Nothing here ever runs `git add .`.
 * Project root: --root <dir>, else VAULT_SYNC_ROOT, else CLAUDE_PROJECT_DIR, else the working directory.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SYNC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'vault-sync.mjs');
const argv = process.argv.slice(2);
const mode = argv[0];
const rootIndex = argv.indexOf('--root');
const ROOT = resolve(
  (rootIndex >= 0 && argv[rootIndex + 1]) ||
    process.env.VAULT_SYNC_ROOT ||
    process.env.CLAUDE_PROJECT_DIR ||
    process.cwd(),
);

if (mode !== '--safety' && mode !== '--refresh') {
  console.error(
    'usage: node scripts/hooks/vault-precommit.mjs --safety | --refresh [--root <dir>]',
  );
  process.exit(2);
}

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  return { status: result.status, out: result.stdout ?? '' };
}

const isSpec = (p) => p.startsWith('tests/') && p.endsWith('.spec.ts');
const notePathFor = (p) => `vault/tests/${p.slice('tests/'.length).replace(/\.spec\.ts$/, '.md')}`;

/** Staged specs: present (A, M, C, new side of R) and gone (D, old side of R). */
function stagedSpecs() {
  const listing = git(['diff', '--cached', '--name-status', '-z', '-M']);
  if (listing.status !== 0) throw new Error('git diff --cached failed');
  const fields = listing.out.split('\0');
  const present = [];
  const gone = [];
  for (let i = 0; i < fields.length;) {
    const status = fields[i];
    if (!status) break;
    const kind = status[0];
    if (kind === 'R' || kind === 'C') {
      const oldPath = fields[i + 1];
      const newPath = fields[i + 2];
      i += 3;
      if (kind === 'R' && isSpec(oldPath)) gone.push(oldPath);
      if (isSpec(newPath)) present.push(newPath);
    } else {
      const path = fields[i + 1];
      i += 2;
      if (!isSpec(path)) continue;
      if (kind === 'D') gone.push(path);
      else present.push(path);
    }
  }
  return { present, gone };
}

function safetyProblems(present) {
  const problems = [];
  for (const spec of present) {
    const note = notePathFor(spec);
    const staged = git(['diff', '--cached', '--name-only', '--', spec]).out.trim() !== '';
    const unstaged = git(['diff', '--name-only', '--', spec]).out.trim() !== '';
    if (staged && unstaged)
      problems.push(`${spec} is partially staged: stage or revert the rest of it first`);
    if (existsSync(resolve(ROOT, note))) {
      const tracked = git(['ls-files', '--error-unmatch', '--', note]).status === 0;
      const stagedNote = git(['diff', '--cached', '--name-only', '--', note]).out.trim() !== '';
      if (!tracked && !stagedNote) {
        problems.push(
          `${note} exists but is untracked: review it and stage it (or remove it) first`,
        );
      } else if (git(['diff', '--name-only', '--', note]).out.trim() !== '') {
        problems.push(`${note} has unstaged edits: stage or revert them before the refresh`);
      }
    }
  }
  return problems;
}

function runSync(args) {
  const result = spawnSync(process.execPath, [SYNC, ...args, '--root', ROOT], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  return result.status ?? 1;
}

try {
  const { present, gone } = stagedSpecs();
  if (mode === '--safety') {
    const problems = safetyProblems(present);
    if (problems.length) {
      console.error('vault-precommit: staging-safety check refused the commit before any write:');
      for (const p of problems) console.error(`  - ${p}`);
      process.exit(1);
    }
    process.exit(0);
  }
  const all = [...present, ...gone];
  if (all.length === 0) process.exit(0);
  const wrote = runSync(['--write', '--files', ...all, '--stage']);
  if (wrote !== 0) process.exit(wrote);
  process.exit(present.length ? runSync(['--check', '--files', ...present]) : 0);
} catch (err) {
  console.error(`vault-precommit: ${err?.message ?? err}`);
  process.exit(1);
}
