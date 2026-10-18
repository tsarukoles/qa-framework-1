// Isolated checks for the Task 11 note modes of scripts/vault-sync.mjs and for the pre-commit
// wrapper scripts/hooks/vault-precommit.mjs. Every case runs the real script by absolute path with
// an explicit --root that points at a disposable fixture under the system temp folder, while the
// working directory stays the real project: that proves the root injection, not the cwd, decides
// where notes are written. The TypeScript parser comes from the project's node_modules (resolved
// from the script's own location), so the fixture needs no npm ci.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(fileURLToPath(import.meta.url), '..', '..');
const SYNC = join(PROJECT, 'scripts', 'vault-sync.mjs');
const PRECOMMIT = join(PROJECT, 'scripts', 'hooks', 'vault-precommit.mjs');
const START = '<!-- vault:generated:start -->';
const END = '<!-- vault:generated:end -->';
const SPEC = 'tests/blog/home.smoke.spec.ts';
const NOTE = 'vault/tests/blog/home.smoke.md';

const SPEC_TEXT = [
  "import { expect, test } from '@playwright/test';",
  "import { runIfEnv } from '../../env/runIfEnv';",
  "import { BlogListPage } from '../../pages/BlogListPage';",
  '',
  "test.describe('blog home on development', () => {",
  "  runIfEnv(test, ['dev']);",
  '',
  "  test('shows the development banner', async ({ page }) => {",
  '    const blog = new BlogListPage(page);',
  '    await blog.open();',
  '    await expect(blog.envBanner).toBeVisible();',
  '  });',
  '',
  "  test('shows at least one article card', async ({ page }) => {",
  '    const blog = new BlogListPage(page);',
  '    await blog.open();',
  '    await expect(blog.articleItems).not.toHaveCount(0);',
  '  });',
  '});',
  '',
].join('\n');

function run(script, root, args, input = '') {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.VAULT_SYNC_ROOT;
  return spawnSync(process.execPath, [script, ...args, '--root', root], {
    cwd: PROJECT,
    input,
    encoding: 'utf8',
    env,
  });
}
const sync = (root, args, input) => run(SYNC, root, args, input);
const git = (root, ...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const read = (root, rel) => readFileSync(join(root, rel), 'utf8');
const write = (root, rel, text) => {
  mkdirSync(resolve(join(root, rel), '..'), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const sha = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'vault-sync-'));
  write(root, SPEC, SPEC_TEXT);
  return root;
}

describe('vault-sync note modes in a disposable fixture root', () => {
  let root;
  before(() => {
    root = makeFixture();
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test('the explicit root decides where notes go; the real project is untouched', () => {
    const realNote = join(PROJECT, NOTE);
    const realBefore = existsSync(realNote) ? readFileSync(realNote, 'utf8') : null;
    const check = sync(root, ['--check']);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /MISSING vault\/tests\/blog\/home\.smoke\.md/);
    const result = sync(root, ['--write']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /created vault\/tests\/blog\/home\.smoke\.md/);
    assert.ok(existsSync(join(root, NOTE)), 'the note landed in the fixture');
    const realAfter = existsSync(realNote) ? readFileSync(realNote, 'utf8') : null;
    assert.equal(realAfter, realBefore, 'the real project note is unchanged');
    assert.equal(sync(root, ['--check']).status, 0);
  });

  test('the generated block records source, hash, parser status, literal titles and Page Object imports', () => {
    const note = read(root, NOTE);
    const block = note.slice(note.indexOf(START), note.indexOf(END) + END.length);
    assert.ok(block.includes(`- source: ${SPEC}\n`));
    assert.ok(block.includes(`- sha256: ${sha(SPEC_TEXT)}\n`));
    assert.ok(block.includes('- parser: ok\n'));
    assert.ok(
      block.includes(
        '  - describe: blog home on development\n    - test: shows the development banner\n    - test: shows at least one article card\n',
      ),
    );
    assert.ok(block.includes('- page objects: BlogListPage from ../../pages/BlogListPage\n'));
    assert.ok(note.startsWith(`# ${SPEC}\n`));
    assert.ok(note.includes('## What this spec checks'));
  });

  test('a harmless source comment makes the note stale; a refresh repairs it; a second refresh changes nothing', () => {
    write(root, SPEC, SPEC_TEXT + '// harmless fixture comment\n');
    const stale = sync(root, ['--check']);
    assert.equal(stale.status, 1);
    assert.match(stale.stderr, /STALE vault\/tests\/blog\/home\.smoke\.md/);
    const refresh = sync(root, ['--write']);
    assert.equal(refresh.status, 0, refresh.stderr);
    assert.match(refresh.stdout, /updated vault\/tests\/blog\/home\.smoke\.md/);
    assert.equal(sync(root, ['--check']).status, 0);
    const once = read(root, NOTE);
    const again = sync(root, ['--write']);
    assert.match(again.stdout, /unchanged vault\/tests\/blog\/home\.smoke\.md/);
    assert.equal(read(root, NOTE), once, 'byte-identical after the second refresh');
  });

  test('human text outside the markers survives a refresh exactly', () => {
    const note = read(root, NOTE);
    const human = note
      .replace(
        '_(not written yet)_',
        'It opens the blog home and reads the banner.  \nTwo trailing spaces kept.',
      )
      .replace(
        '## Limits\n\n_(not written yet)_',
        '## Limits\n\n- none\n\n## Extra section\n\nStays.',
      );
    write(root, NOTE, human);
    write(root, SPEC, SPEC_TEXT + '// second harmless comment\n');
    assert.equal(sync(root, ['--write']).status, 0);
    const after = read(root, NOTE);
    const outside = (text) =>
      text.slice(0, text.indexOf(START)) + text.slice(text.indexOf(END) + END.length);
    assert.equal(outside(after), outside(human));
    assert.notEqual(
      after.slice(after.indexOf(START), after.indexOf(END)),
      human.slice(human.indexOf(START), human.indexOf(END)),
    );
  });

  test('a note with CRLF line endings keeps them in the refreshed block', () => {
    const crlf = read(root, NOTE).replace(/\r?\n/g, '\r\n');
    write(root, NOTE, crlf);
    write(root, SPEC, SPEC_TEXT + '// crlf round\n');
    assert.equal(sync(root, ['--write']).status, 0);
    const after = read(root, NOTE);
    assert.ok(!/[^\r]\n/.test(after), 'no bare LF remains');
    assert.equal(sync(root, ['--check']).status, 0);
    write(root, NOTE, after.replace(/\r\n/g, '\n'));
    assert.equal(sync(root, ['--check']).status, 0, 'LF or CRLF, the hash is the same');
  });

  test('damaged or repeated markers fail honestly and the note is left as it is', () => {
    const good = read(root, NOTE);
    write(root, NOTE, good + '\n' + START + '\n');
    write(root, SPEC, SPEC_TEXT + '// after damage\n');
    const result = sync(root, ['--write', '--files', SPEC]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /damaged markers/);
    assert.equal(read(root, NOTE), good + '\n' + START + '\n', 'nothing was rewritten');
    const check = sync(root, ['--check']);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /INVALID/);
    write(root, NOTE, good);
    assert.equal(sync(root, ['--write']).status, 0);
  });

  test('unsupported syntax is reported and no note is created or claimed', () => {
    const cases = [
      [
        'tests/blog/only.spec.ts',
        SPEC_TEXT.replace(
          "test('shows the development banner'",
          "test.only('shows the development banner'",
        ),
        /unsupported wrapper at line \d+: test\.only\(/,
      ],
      [
        'tests/blog/dynamic.spec.ts',
        SPEC_TEXT.replace("test('shows at least one article card'", 'test(`shows ${1} card`'),
        /dynamic title at line \d+/,
      ],
      [
        'tests/blog/broken.spec.ts',
        "test('unbalanced', async () => {\n",
        /parse error at line \d+/,
      ],
    ];
    for (const [rel, text, pattern] of cases) {
      write(root, rel, text);
      const result = sync(root, ['--write', '--files', rel]);
      assert.equal(result.status, 1, rel);
      assert.match(result.stderr, pattern);
      assert.ok(
        !existsSync(
          join(root, 'vault', 'tests', 'blog', rel.split('/').pop().replace('.spec.ts', '.md')),
        ),
        `${rel}: no note`,
      );
      const check = sync(root, ['--check', '--files', rel]);
      assert.equal(check.status, 1);
      assert.match(check.stderr, /MISSING/);
      rmSync(join(root, rel));
    }
  });

  test('a spec path with spaces works', () => {
    const rel = 'tests/blog/with space/odd.spec.ts';
    write(root, rel, SPEC_TEXT);
    assert.equal(sync(root, ['--write', '--files', rel]).status, 0);
    assert.ok(existsSync(join(root, 'vault', 'tests', 'blog', 'with space', 'odd.md')));
    assert.equal(sync(root, ['--check', '--files', rel]).status, 0);
    rmSync(join(root, 'tests', 'blog', 'with space'), { recursive: true });
    rmSync(join(root, 'vault', 'tests', 'blog', 'with space'), { recursive: true });
  });

  test('a deleted source with a managed note needs reviewed cleanup; absent plus absent is a valid deletion', () => {
    const rel = 'tests/blog/gone.spec.ts';
    write(root, rel, SPEC_TEXT);
    assert.equal(sync(root, ['--write', '--files', rel]).status, 0);
    rmSync(join(root, rel));
    const result = sync(root, ['--write', '--files', rel]);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /DELETED SOURCE tests\/blog\/gone\.spec\.ts: its managed note vault\/tests\/blog\/gone\.md still exists/,
    );
    assert.ok(existsSync(join(root, 'vault', 'tests', 'blog', 'gone.md')), 'nothing was erased');
    const check = sync(root, ['--check']);
    assert.equal(check.status, 1);
    assert.match(check.stderr, /NO SOURCE vault\/tests\/blog\/gone\.md/);
    rmSync(join(root, 'vault', 'tests', 'blog', 'gone.md'));
    const ok = sync(root, ['--write', '--files', rel]);
    assert.equal(ok.status, 0, ok.stderr);
    assert.match(ok.stdout, /ok, deleted tests\/blog\/gone\.spec\.ts has no managed note/);
    assert.equal(sync(root, ['--check']).status, 0);
  });

  test('unknown, conflicting and misplaced flags and unsafe paths are rejected', () => {
    assert.equal(sync(root, ['--nope']).status, 2);
    assert.equal(sync(root, ['--write', '--check']).status, 2);
    assert.equal(sync(root, ['--write', '--stage']).status, 2);
    assert.equal(sync(root, ['--check', '--files']).status, 2);
    assert.equal(sync(root, ['--session-start', '--files', SPEC]).status, 2);
    for (const bad of [
      '../outside.spec.ts',
      'pages/BasePage.ts',
      'tests/blog/not-a-spec.ts',
      join(tmpdir(), 'x.spec.ts'),
    ]) {
      const result = sync(root, ['--write', '--files', bad]);
      assert.equal(result.status, 1, bad);
      assert.match(result.stderr, /unsafe or outside tests\//);
    }
  });

  test('--from-hook refreshes a changed supported spec without staging and stays fail-open for an unsupported one', () => {
    write(root, SPEC, SPEC_TEXT + '// changed by a hook event\n');
    const hook = sync(root, ['--from-hook'], JSON.stringify({ tool_input: { file_path: SPEC } }));
    assert.equal(hook.status, 0, hook.stderr);
    assert.equal(sync(root, ['--check']).status, 0, 'the note was refreshed by the hook');
    const log = read(
      root,
      `vault/_changelog/${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}.md`,
    );
    assert.ok(log.includes(`**what:** ${SPEC} ·`));
    write(root, 'tests/blog/bad.spec.ts', "test.only('x', () => {});");
    const bad = sync(
      root,
      ['--from-hook'],
      JSON.stringify({ tool_input: { file_path: 'tests/blog/bad.spec.ts' } }),
    );
    assert.equal(bad.status, 0, 'fail-open');
    assert.match(bad.stderr, /not refreshed/);
    assert.ok(!existsSync(join(root, 'vault', 'tests', 'blog', 'bad.md')));
    rmSync(join(root, 'tests', 'blog', 'bad.spec.ts'));
  });

  test('session modes never generate or stage notes', () => {
    const rel = 'tests/blog/quiet.spec.ts';
    write(root, rel, SPEC_TEXT);
    assert.equal(sync(root, ['--session-start']).status, 0);
    assert.equal(sync(root, ['--session-end']).status, 0);
    assert.ok(!existsSync(join(root, 'vault', 'tests', 'blog', 'quiet.md')));
    rmSync(join(root, rel));
  });
});

describe('vault-sync --stage and the pre-commit wrapper in a disposable Git repository', () => {
  let root;
  before(() => {
    root = makeFixture();
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'config', 'user.name', 'Fixture Author');
    git(root, 'config', 'user.email', 'fixture@example.invalid');
    git(root, 'config', 'commit.gpgsign', 'false');
    assert.equal(sync(root, ['--write']).status, 0);
    write(root, 'other.txt', 'unrelated\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'fixture start');
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test('a partially staged spec is refused before any write', () => {
    write(root, SPEC, SPEC_TEXT + '// staged part\n');
    git(root, 'add', SPEC);
    write(root, SPEC, SPEC_TEXT + '// staged part\n// unstaged part\n');
    const noteBefore = read(root, NOTE);
    const result = sync(root, ['--write', '--files', SPEC, '--stage']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /partially staged/);
    assert.equal(read(root, NOTE), noteBefore);
    const wrapper = run(PRECOMMIT, root, ['--safety']);
    assert.equal(wrapper.status, 1);
    assert.match(wrapper.stderr, /partially staged/);
    git(root, 'add', SPEC);
  });

  test('a related note with unstaged edits is refused before any write', () => {
    write(root, NOTE, read(root, NOTE).replace('_(not written yet)_', 'human edit not yet staged'));
    const result = sync(root, ['--write', '--files', SPEC, '--stage']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /has unstaged edits/);
    assert.equal(run(PRECOMMIT, root, ['--safety']).status, 1);
    git(root, 'add', NOTE);
  });

  test('an existing untracked note needs review', () => {
    const rel = 'tests/blog/fresh.spec.ts';
    write(root, rel, SPEC_TEXT);
    git(root, 'add', rel);
    write(
      root,
      'vault/tests/blog/fresh.md',
      `# ${rel}\n\n${START}\n- source: ${rel}\n${END}\n\nhand-written\n`,
    );
    const result = sync(root, ['--write', '--files', rel, '--stage']);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /exists but is untracked/);
    rmSync(join(root, 'vault', 'tests', 'blog', 'fresh.md'));
    git(root, 'reset', '-q', rel);
    rmSync(join(root, rel));
  });

  test('a normal staged spec gets its note refreshed and staged; unrelated staged and unstaged work stays as it was', () => {
    write(root, 'other.txt', 'unrelated staged change\n');
    git(root, 'add', 'other.txt');
    write(root, 'scratch.txt', 'unstaged scratch\n');
    const result = sync(root, ['--write', '--files', SPEC, '--stage']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /staged 1 note\(s\)/);
    const staged = git(root, 'diff', '--cached', '--name-only').stdout.split('\n');
    assert.ok(staged.includes(NOTE), 'the note is staged');
    assert.ok(staged.includes('other.txt'), 'unrelated staged work still staged');
    assert.ok(!staged.includes('scratch.txt'), 'unrelated unstaged work not staged');
    assert.equal(read(root, 'scratch.txt'), 'unstaged scratch\n');
    assert.equal(
      git(root, 'diff', '--name-only').stdout.trim(),
      '',
      'no unstaged change remains for the spec or note',
    );
    const refresh = run(PRECOMMIT, root, ['--refresh']);
    assert.equal(refresh.status, 0, refresh.stderr);
    git(root, 'commit', '-q', '-m', 'normal commit');
  });

  test('a staged deletion needs reviewed cleanup of the old note; absent plus absent passes', () => {
    git(root, 'rm', '-q', SPEC);
    const refusal = run(PRECOMMIT, root, ['--refresh']);
    assert.equal(refusal.status, 1);
    assert.match(refusal.stderr, /DELETED SOURCE/);
    git(root, 'rm', '-q', NOTE);
    const ok = run(PRECOMMIT, root, ['--refresh']);
    assert.equal(ok.status, 0, ok.stderr);
    git(root, 'commit', '-q', '-m', 'reviewed deletion');
    assert.equal(sync(root, ['--check']).status, 0);
  });
});
