#!/usr/bin/env node
/**
 * scripts/hooks/session-preflight.mjs — SessionStart: five short lines of context (Week 2, Task 07).
 *
 * Claude Code adds a SessionStart hook's stdout to the conversation, so a new session starts with:
 *   Date: <local YYYY-MM-DD>
 *   Branch: <current branch, or no-branch>
 *   Uncommitted: <count> file(s)        (git status --porcelain --untracked-files=all, files in new folders included)
 *   Latest journal: <newest YYYY-MM-DD.md under vault/12-progress-report, or none yet>
 *   Map: vault/_map.md
 *
 * Project root: CLAUDE_PROJECT_DIR (set by Claude Code for hooks), else the working directory.
 * Always exits 0. Node built-ins only.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const ROOT = resolve(process.env.CLAUDE_PROJECT_DIR || process.cwd());
const JOURNAL_DIR = 'vault/12-progress-report';

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

function uncommittedCount() {
  const out = git(['status', '--porcelain', '--untracked-files=all'], '');
  return out === '' ? 0 : out.split(/\r?\n/).filter((line) => line.length > 0).length;
}

/** Newest YYYY-MM-DD.md anywhere under vault/12-progress-report, as a forward-slash relative path. */
function latestJournal() {
  const dir = join(ROOT, JOURNAL_DIR);
  if (!existsSync(dir)) return 'none yet';
  const found = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      const childAbs = join(abs, name);
      const childRel = `${rel}/${name}`;
      if (statSync(childAbs).isDirectory()) walk(childAbs, childRel);
      else if (/^\d{4}-\d{2}-\d{2}\.md$/.test(name)) found.push(childRel);
    }
  };
  walk(dir, JOURNAL_DIR);
  found.sort((a, b) => basename(b).localeCompare(basename(a)) || a.localeCompare(b));
  return found[0] ?? 'none yet';
}

try {
  const branch = git(
    ['symbolic-ref', '--short', 'HEAD'],
    git(['rev-parse', '--abbrev-ref', 'HEAD'], 'no-branch'),
  );
  const lines = [
    `Date: ${localDate()}`,
    `Branch: ${branch}`,
    `Uncommitted: ${uncommittedCount()} file(s)`,
    `Latest journal: ${latestJournal()}`,
    'Map: vault/_map.md',
  ];
  process.stdout.write(lines.join('\n') + '\n');
} catch {
  // A summary that cannot be built must never stop the session.
}
process.exit(0);
