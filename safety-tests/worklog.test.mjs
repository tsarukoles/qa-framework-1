// Isolated checks for scripts/hooks/stop-worklog.mjs and scripts/hooks/session-preflight.mjs
// (Week 2, Task 07). Every case runs the real script inside a temporary Git repository with a
// local test author. The repository is selected by the working directory; CLAUDE_PROJECT_DIR is
// removed from the environment so the real project is never touched.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const HOOKS = resolve(fileURLToPath(import.meta.url), '..', '..', 'scripts', 'hooks');
const STOP = join(HOOKS, 'stop-worklog.mjs');
const PREFLIGHT = join(HOOKS, 'session-preflight.mjs');
const NORMAL = JSON.stringify({ stop_hook_active: false });

function run(script, root, input = '', args = [], extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.CLAUDE_PROJECT_DIR;
  return spawnSync(process.execPath, [script, ...args], { cwd: root, input, encoding: 'utf8', env });
}
function git(root, args, extraEnv = {}) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...extraEnv } });
}
function localDate(now = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}
function makeRepo(name) {
  const root = mkdtempSync(join(tmpdir(), 'worklog-'));
  git(root, ['init', '-q', '-b', 'main']);
  git(root, ['config', 'user.name', name]);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'commit.gpgsign', 'false']);
  return root;
}
function journal(root, slug) {
  return join(root, 'vault', '12-progress-report', slug, `${localDate()}.md`);
}
function expectBlocked(result, pathPart) {
  assert.equal(result.status, 2, `expected 2: ${result.stderr}`);
  assert.ok(result.stderr.startsWith('stop-worklog: BLOCKED — '), result.stderr);
  assert.ok(result.stderr.includes(pathPart), `reason names the path: ${result.stderr}`);
  assert.ok(result.stderr.includes('/worklog'), 'reason names the /worklog command');
}
function expectQuiet(result) {
  assert.equal(result.status, 0, `expected 0: ${result.stderr}`);
  assert.equal(result.stderr, '');
}

describe('stop-worklog: path and slug', () => {
  const repos = [];
  after(() => repos.forEach((r) => rmSync(r, { recursive: true, force: true })));

  test('--path prints vault/12-progress-report/<slug>/<local date>.md and reads no stdin', () => {
    const root = makeRepo('Anna Kowal');
    repos.push(root);
    const result = run(STOP, root, undefined, ['--path']);
    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), `vault/12-progress-report/anna-kowal/${localDate()}.md`);
  });

  test('the slug lowercases, replaces runs of other characters with "-", trims edges, falls back to student', () => {
    for (const [name, slug] of [
      ['  Zoë Müller!! ', 'zo-m-ller'],
      ['QA_Student 2', 'qa-student-2'],
      ['---', 'student'],
      ['', 'student'],
    ]) {
      const root = makeRepo(name);
      repos.push(root);
      const result = run(STOP, root, undefined, ['--path']);
      assert.equal(result.stdout.trim(), `vault/12-progress-report/${slug}/${localDate()}.md`, name);
    }
  });
});

describe('stop-worklog: decisions in a temporary repository', () => {
  let root;
  const slug = 'test-author';
  before(() => {
    root = makeRepo('Test Author');
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test('a clean empty repository (no changes, no commit) -> 0', () => expectQuiet(run(STOP, root, NORMAL)));

  test('malformed input -> 0', () => {
    for (const input of ['not json', '', 'null', '[]']) expectQuiet(run(STOP, root, input));
  });

  test('a non-qualifying change only (.txt) and no commit today -> 0', () => {
    writeFileSync(join(root, 'notes.txt'), 'scratch\n');
    expectQuiet(run(STOP, root, NORMAL));
  });

  test('activity with no entry: a qualifying untracked file in a new nested folder -> 2 naming the exact path', () => {
    mkdirSync(join(root, 'tests', 'new', 'deep'), { recursive: true });
    writeFileSync(join(root, 'tests', 'new', 'deep', 'thing.spec.ts'), '// new\n');
    expectBlocked(run(STOP, root, NORMAL), `vault/12-progress-report/${slug}/${localDate()}.md`);
  });

  test('retry: stop_hook_active true with the same activity -> 0', () =>
    expectQuiet(run(STOP, root, JSON.stringify({ stop_hook_active: true }))));

  test('a leading byte-order mark does not hide the decision', () =>
    expectBlocked(run(STOP, root, '﻿' + NORMAL), slug));

  test('a valid "## HH:MM" heading in today\'s journal (local date) -> 0', () => {
    const file = journal(root, slug);
    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, '# Journal\n\n## 10:15\n\n- **Did:** something real\n');
    expectQuiet(run(STOP, root, NORMAL));
  });

  test('a journal without that heading shape is not an entry -> 2', () => {
    writeFileSync(journal(root, slug), '# Journal\n\n### 10:15 not a heading of the right level\n');
    expectBlocked(run(STOP, root, NORMAL), slug);
    rmSync(journal(root, slug));
  });

  test('a commit made today with a clean tree and no entry -> 2; a commit on another day -> 0', () => {
    git(root, ['add', '.']);
    const old = '2020-01-02T10:00:00+00:00';
    git(root, ['commit', '-q', '-m', 'old work'], { GIT_AUTHOR_DATE: old, GIT_COMMITTER_DATE: old });
    expectQuiet(run(STOP, root, NORMAL));
    writeFileSync(join(root, 'notes.txt'), 'scratch two\n');
    git(root, ['add', '.']);
    git(root, ['commit', '-q', '-m', 'work today']);
    expectBlocked(run(STOP, root, NORMAL), slug);
  });
});

describe('session-preflight: the five-line startup summary', () => {
  let root;
  before(() => {
    root = makeRepo('Test Author');
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test('prints exactly five lines with safe fallbacks in a repository without a commit', () => {
    mkdirSync(join(root, 'new', 'folder'), { recursive: true });
    writeFileSync(join(root, 'new', 'folder', 'a.ts'), '');
    writeFileSync(join(root, 'new', 'folder', 'b.ts'), '');
    const result = run(PREFLIGHT, root);
    assert.equal(result.status, 0, result.stderr);
    const lines = result.stdout.trimEnd().split('\n');
    assert.equal(lines.length, 5, result.stdout);
    assert.equal(lines[0], `Date: ${localDate()}`);
    assert.equal(lines[1], 'Branch: main');
    assert.equal(lines[2], 'Uncommitted: 2 file(s)');
    assert.equal(lines[3], 'Latest journal: none yet');
    assert.equal(lines[4], 'Map: vault/_map.md');
  });

  test('names the newest YYYY-MM-DD.md under vault/12-progress-report across student folders', () => {
    for (const [slug, day] of [
      ['one', '2026-01-05'],
      ['two', '2026-03-09'],
      ['one', '2026-02-20'],
    ]) {
      mkdirSync(join(root, 'vault', '12-progress-report', slug), { recursive: true });
      writeFileSync(join(root, 'vault', '12-progress-report', slug, `${day}.md`), '## 09:00\n');
    }
    writeFileSync(join(root, 'vault', '12-progress-report', 'two', 'notes.md'), 'not a day file\n');
    const lines = run(PREFLIGHT, root).stdout.trimEnd().split('\n');
    assert.equal(lines[3], 'Latest journal: vault/12-progress-report/two/2026-03-09.md');
    assert.equal(lines[1], 'Branch: main');
  });

  test('outside any repository the branch falls back to no-branch and the count to 0', () => {
    const bare = mkdtempSync(join(tmpdir(), 'preflight-nogit-'));
    try {
      const lines = run(PREFLIGHT, bare).stdout.trimEnd().split('\n');
      assert.equal(lines.length, 5);
      assert.equal(lines[1], 'Branch: no-branch');
      assert.equal(lines[2], 'Uncommitted: 0 file(s)');
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
