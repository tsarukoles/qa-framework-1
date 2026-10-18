// Isolated checks for scripts/vault-sync.mjs (Week 2, Task 05).
// Every case runs the real script by absolute path inside a temporary Git repository under the
// system temp folder. The temp repository is selected by the working directory only; the two
// root overrides are removed from the environment so the real project is never touched.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = resolve(fileURLToPath(import.meta.url), '..', '..', 'scripts', 'vault-sync.mjs');
const SPEC = 'tests/blog/home.smoke.spec.ts';

function run(root, mode, input, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.VAULT_SYNC_ROOT;
  return spawnSync(process.execPath, [SCRIPT, mode], { cwd: root, input, encoding: 'utf8', env });
}

function git(root, ...args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' });
}

function localDate(now = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

function changelogPath(root) {
  return join(root, 'vault', '_changelog', `${localDate()}.md`);
}

function changelog(root) {
  const file = changelogPath(root);
  return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

function entries(text) {
  return (text ?? '').split('\n').filter((line) => line.startsWith('- **when:**')).length;
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'vault-log-'));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test Author');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'commit.gpgsign', 'false');
  mkdirSync(join(root, 'tests', 'blog'), { recursive: true });
  writeFileSync(join(root, 'tests', 'blog', 'home.smoke.spec.ts'), '// spec\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'Task 04: review the tests');
  git(root, 'switch', '-q', '-c', 'week-2');
  return root;
}

describe('vault-sync --from-hook in a temporary repository', () => {
  let root;
  before(() => {
    root = makeRepo();
  });
  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('a PostToolUse event with a relative path appends exactly one entry to the local-date log', () => {
    assert.equal(changelog(root), null);
    const result = run(root, '--from-hook', JSON.stringify({ tool_input: { file_path: SPEC } }));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    const text = changelog(root);
    assert.equal(entries(text), 1);
    assert.match(text, /^- \*\*when:\*\* \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z · \*\*who:\*\* Test Author@/m);
    assert.ok(text.includes(`@${hostname()} · **branch:** week-2\n`));
    assert.ok(text.includes(`  **what:** ${SPEC} · **why (last commit):** Task 04: review the tests · **commit:** `));
    assert.ok(existsSync(changelogPath(root)), 'the file name is the local date');
  });

  test('the commit field is the temporary repository\'s actual short HEAD, whatever its length', () => {
    const head = git(root, 'rev-parse', '--short', 'HEAD').stdout.trim();
    assert.ok(head.length >= 4, 'the temporary repository has a commit');
    const text = changelog(root);
    const last = text.trimEnd().split('\n').at(-1);
    assert.ok(last.endsWith(` · **commit:** ${head}`), `${last} should end with the short HEAD ${head}`);
  });

  test('a FileChanged event with a top-level absolute path records the same project-relative path', () => {
    const before = entries(changelog(root));
    const result = run(root, '--from-hook', JSON.stringify({ file_path: join(root, 'tests', 'blog', 'home.smoke.spec.ts') }));
    assert.equal(result.status, 0);
    const text = changelog(root);
    assert.equal(entries(text), before + 1);
    const head = git(root, 'rev-parse', '--short', 'HEAD').stdout.trim();
    assert.ok(text.endsWith(`  **what:** ${SPEC} · **why (last commit):** Task 04: review the tests · **commit:** ${head}\n`));
    assert.ok(!text.includes('\\'), 'paths are stored with forward slashes');
  });

  test('entries are appended; earlier entries are preserved byte for byte', () => {
    const before = changelog(root);
    const result = run(root, '--from-hook', JSON.stringify({ tool_input: { file_path: 'pages/BlogListPage.ts' } }));
    assert.equal(result.status, 0);
    const after = changelog(root);
    assert.ok(after.startsWith(before));
    assert.equal(entries(after), entries(before) + 1);
    assert.ok(after.includes('**what:** pages/BlogListPage.ts ·'));
  });

  test('the vault folder and every path inside it add nothing', () => {
    const before = changelog(root);
    for (const p of ['vault', 'vault/_map.md', join(root, 'vault', '_changelog', 'x.md'), 'vault/03-framework/hook-lifecycle-map.md']) {
      const result = run(root, '--from-hook', JSON.stringify({ tool_input: { file_path: p } }));
      assert.equal(result.status, 0, p);
    }
    assert.equal(changelog(root), before);
  });

  test('a path outside the project adds nothing', () => {
    const before = changelog(root);
    const outside = join(tmpdir(), 'vault-log-outside.txt');
    const result = run(root, '--from-hook', JSON.stringify({ tool_input: { file_path: outside } }));
    assert.equal(result.status, 0);
    const up = run(root, '--from-hook', JSON.stringify({ tool_input: { file_path: '../elsewhere.ts' } }));
    assert.equal(up.status, 0);
    assert.equal(changelog(root), before);
  });

  test('malformed, empty and field-less input exit 0 and add nothing', () => {
    const before = changelog(root);
    for (const input of ['not json', '', '{}', '[]', 'null', JSON.stringify({ tool_input: { file_path: '' } }), JSON.stringify({ tool_input: { file_path: 42 } })]) {
      const result = run(root, '--from-hook', input);
      assert.equal(result.status, 0, JSON.stringify(input));
      assert.equal(result.stderr, '', JSON.stringify(input));
    }
    assert.equal(changelog(root), before);
  });

  test('leading byte-order marks (one or two) are stripped before parsing', () => {
    const before = entries(changelog(root));
    const one = run(root, '--from-hook', '﻿' + JSON.stringify({ tool_input: { file_path: SPEC } }));
    const two = run(root, '--from-hook', '﻿﻿' + JSON.stringify({ tool_input: { file_path: SPEC } }));
    assert.equal(one.status, 0);
    assert.equal(two.status, 0);
    assert.equal(entries(changelog(root)), before + 2);
  });

  test('--session-start appends a START line with a UTC time to sessions.log', () => {
    const log = join(root, 'vault', '_changelog', 'sessions.log');
    const first = run(root, '--session-start', '');
    assert.equal(first.status, 0);
    const second = run(root, '--session-start', '');
    assert.equal(second.status, 0);
    const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    assert.equal(lines.length, 2);
    for (const line of lines) assert.match(line, /^- session START \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  test('an unknown mode prints usage and exits 2 without writing', () => {
    const before = changelog(root);
    const result = run(root, '--nope', '');
    assert.equal(result.status, 2);
    assert.match(result.stderr, /usage/);
    assert.equal(changelog(root), before);
  });
});

describe('vault-sync --from-hook outside any Git repository', () => {
  let root;
  before(() => {
    root = mkdtempSync(join(tmpdir(), 'vault-log-nogit-'));
  });
  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('missing Git information becomes "unknown" and the entry is still written', () => {
    // Outside a repository Git would still answer `git config user.name` from the global config,
    // so point Git at an empty global config: now it can provide no value at all.
    const emptyConfig = join(root, 'empty-gitconfig');
    writeFileSync(emptyConfig, '');
    const noGit = { GIT_CONFIG_GLOBAL: emptyConfig, GIT_CONFIG_NOSYSTEM: '1' };
    const result = run(root, '--from-hook', JSON.stringify({ tool_input: { file_path: SPEC } }), noGit);
    assert.equal(result.status, 0, result.stderr);
    const text = changelog(root);
    assert.equal(entries(text), 1);
    assert.ok(text.includes(`**who:** unknown@${hostname()} · **branch:** unknown\n`));
    assert.ok(text.includes('**why (last commit):** unknown · **commit:** unknown\n'));
  });
});

describe('vault-sync --from-hook in a repository without any commit', () => {
  let root;
  before(() => {
    root = mkdtempSync(join(tmpdir(), 'vault-log-nocommit-'));
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'config', 'user.name', 'Fresh Author');
    git(root, 'config', 'user.email', 'fresh@example.invalid');
  });
  after(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('without a commit the last-commit subject and the commit ID both become "unknown"', () => {
    const result = run(root, '--from-hook', JSON.stringify({ tool_input: { file_path: SPEC } }));
    assert.equal(result.status, 0, result.stderr);
    const text = changelog(root);
    assert.equal(entries(text), 1);
    assert.ok(text.includes(`**who:** Fresh Author@${hostname()} · **branch:** main\n`));
    assert.ok(text.includes('**why (last commit):** unknown · **commit:** unknown\n'));
  });
});
