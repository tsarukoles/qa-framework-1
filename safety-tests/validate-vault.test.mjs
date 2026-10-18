// Isolated checks for scripts/validate-vault.mjs (Week 2, Task 11). Each case builds a small vault in a
// disposable root under the system temp folder and runs the real script with --root pointing there.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const PROJECT = resolve(fileURLToPath(import.meta.url), '..', '..');
const SCRIPT = join(PROJECT, 'scripts', 'validate-vault.mjs');

function validate(root) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.VAULT_SYNC_ROOT;
  return spawnSync(process.execPath, [SCRIPT, '--root', root], {
    cwd: PROJECT,
    encoding: 'utf8',
    env,
  });
}
const put = (root, rel, text) => {
  mkdirSync(resolve(join(root, rel), '..'), { recursive: true });
  writeFileSync(join(root, rel), text);
};

describe('validate-vault', () => {
  let root;
  before(() => {
    root = mkdtempSync(join(tmpdir(), 'validate-vault-'));
    put(root, 'tests/blog/home.smoke.spec.ts', '// spec\n');
    put(
      root,
      'vault/_map.md',
      [
        '# Map',
        '',
        '- [home note](tests/blog/home.smoke.md)',
        '- [guide](03-framework/guide)',
        '- [the spec](../tests/blog/home.smoke.spec.ts#L1)',
        '- [[sources/jira/key-map|imported key map]]',
        '- [site](https://example.com) and [mail](mailto:nobody@example.invalid) and [here](#tree)',
        '- ![image](missing-image.png)',
        '',
        '```md',
        '[inside a fence](does-not-exist.md)',
        '```',
        '',
        'Inline `[inside code](also-missing.md)` is ignored.',
        '',
      ].join('\n'),
    );
    put(
      root,
      'vault/tests/blog/home.smoke.md',
      '# tests/blog/home.smoke.spec.ts\n\n[[03-framework/guide#section]]\n',
    );
    put(root, 'vault/03-framework/guide.md', '# Guide\n\nSee [[tests/blog/home.smoke]].\n');
    put(root, 'vault/sources/jira/key-map.md', '| Course key | Your key |\n|---|---|\n');
    put(root, 'vault/_raw/.gitkeep', '');
    put(root, 'vault/_changelog/2026-01-01.md', '- entry\n');
    put(root, 'vault/12-progress-report/student/2026-01-01.md', '## 10:00\n- Did: x\n');
  });
  after(() => rmSync(root, { recursive: true, force: true }));

  test('a vault with valid links, exempt files and code examples passes with no error and no warning', () => {
    const result = validate(root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /0 error\(s\), 0 warning\(s\)/);
  });

  test('a broken local link fails; repairing it passes again', () => {
    put(
      root,
      'vault/03-framework/guide.md',
      '# Guide\n\nSee [[tests/blog/home.smoke]] and [gone](../tests/blog/nope.md).\n',
    );
    const broken = validate(root);
    assert.equal(broken.status, 1);
    assert.match(
      broken.stderr,
      /ERROR 03-framework\/guide\.md: broken markdown -> \.\.\/tests\/blog\/nope\.md/,
    );
    put(
      root,
      'vault/03-framework/guide.md',
      '# Guide\n\nSee [[tests/blog/home.smoke]] and [back](../tests/blog/home.smoke.md).\n',
    );
    assert.equal(validate(root).status, 0);
  });

  test('a broken wikilink fails too', () => {
    put(root, 'vault/tests/blog/home.smoke.md', '# note\n\n[[03-framework/missing-guide]]\n');
    const result = validate(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /broken wikilink -> 03-framework\/missing-guide/);
    put(root, 'vault/tests/blog/home.smoke.md', '# note\n\n[[03-framework/guide#section]]\n');
    assert.equal(validate(root).status, 0);
  });

  test('an unlinked maintained note is a warning only, and imports or logs never warn', () => {
    put(root, 'vault/03-framework/orphan.md', '# Orphan guide\n');
    const result = validate(root);
    assert.equal(result.status, 0);
    assert.match(
      result.stderr,
      /WARN 03-framework\/orphan\.md: no other vault file links to this maintained note/,
    );
    assert.ok(!/sources\/jira\/key-map/.test(result.stderr), 'imports are exempt');
    assert.ok(!/_changelog|12-progress-report/.test(result.stderr), 'logs and journals are exempt');
    rmSync(join(root, 'vault', '03-framework', 'orphan.md'));
  });

  test('step 5 rule: a guide without an H1 outside code blocks warns; adding the heading repairs it', () => {
    put(
      root,
      'vault/03-framework/no-heading.md',
      '```md\n# only inside a code block\n```\n\n[[tests/blog/home.smoke]]\n',
    );
    put(
      root,
      'vault/_map.md',
      '# Map\n\n- [a](03-framework/no-heading.md)\n- [b](03-framework/guide.md)\n- [c](tests/blog/home.smoke.md)\n- [[sources/jira/key-map]]\n',
    );
    const result = validate(root);
    assert.equal(result.status, 0, 'a warning alone never fails');
    assert.match(
      result.stderr,
      /WARN 03-framework\/no-heading\.md: guide has no H1 heading outside code blocks/,
    );
    put(root, 'vault/03-framework/no-heading.md', '# Now a guide\n\n[[tests/blog/home.smoke]]\n');
    const repaired = validate(root);
    assert.equal(repaired.status, 0);
    assert.ok(!/no H1 heading/.test(repaired.stderr));
  });
});
