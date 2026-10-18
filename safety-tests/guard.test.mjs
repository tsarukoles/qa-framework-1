// Isolated checks for scripts/hooks/guard.mjs (Week 2, Task 06).
// Each case passes a simulated hook event through spawnSync's input option. Nothing is applied to
// a file, nothing touches the browser or the network. Token samples are made up and assembled
// from pieces so that no test file contains a token-shaped string.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const GUARD = resolve(fileURLToPath(import.meta.url), '..', '..', 'scripts', 'hooks', 'guard.mjs');
const SPEC = 'tests/blog/categories.smoke.spec.ts';

function run(input) {
  const result = spawnSync(process.execPath, [GUARD], { input, encoding: 'utf8' });
  return { code: result.status, out: result.stdout, err: result.stderr };
}
const edit = (file_path, old_string, new_string) =>
  run(JSON.stringify({ tool_name: 'Edit', tool_input: { file_path, old_string, new_string } }));
const write = (file_path, content) =>
  run(JSON.stringify({ tool_name: 'Write', tool_input: { file_path, content } }));

function blocked(result, reasonPart) {
  assert.equal(result.code, 2, `expected exit 2, got ${result.code}: ${result.err}`);
  assert.ok(
    result.err.startsWith('guard: BLOCKED — '),
    `reason must start with the marker: ${result.err}`,
  );
  if (reasonPart)
    assert.ok(
      result.err.includes(reasonPart),
      `reason should mention ${reasonPart}: ${result.err}`,
    );
}
function allowed(result) {
  assert.equal(result.code, 0, `expected exit 0, got ${result.code}: ${result.err}`);
  assert.equal(result.err, '', 'an allowed proposal prints no refusal');
}

// Made-up samples, assembled from pieces (never real credentials).
const slackSample = ['xox', 'b-'].join('') + '0000000-fake';
const atlassianSample = ['ATA', 'TT'].join('') + '3xFakeFakeFake';
const awsSample = ['AK', 'IA'].join('') + 'FAKEFAKEFAKE';
const pemSample = ['-----BEGIN ', 'PRIVATE KEY-----'].join('') + '\nfake\n';

describe('guard: the six initial checks, one blocked and one allowed example each', () => {
  test('1 blocked: a Write to .env', () => blocked(write('.env', 'JIRA_API_TOKEN=abc'), '.env'));
  test('1 allowed: placeholder content for .env.example', () =>
    allowed(write('.env.example', 'JIRA_API_TOKEN=your-token\n')));

  test('2 blocked: secret-looking new content in a simulated edit', () =>
    blocked(
      edit('tests/support/users.ts', 'const a = 1;', `const token = '${slackSample}';`),
      'token-shaped',
    ));
  test('2 allowed: an ordinary comment containing the word token', () =>
    allowed(
      edit(
        'tests/support/users.ts',
        'const a = 1;',
        '// the token is read from the ignored .env file\nconst a = 1;',
      ),
    ));

  test('3 blocked: adding test.only(', () =>
    blocked(edit(SPEC, "test('a', async () => {", "test.only('a', async () => {"), '.only'));
  test('3 allowed: an ordinary edit without adding .only', () =>
    allowed(edit(SPEC, "test('a', async", "test('a renamed', async")));

  test('4 blocked: adding test.skip(', () =>
    blocked(edit(SPEC, "test('a', async () => {", "test.skip('a', async () => {"), '.skip'));
  test('4 allowed: using the existing environment helper', () =>
    allowed(edit(SPEC, "  runIfEnv(test, ['dev']);", "  runIfEnv(test, ['dev']); // dev only")));

  test('5 blocked: removing an expect( assertion', () =>
    blocked(
      edit(
        SPEC,
        '    await expect(categories.list).toBeVisible();\n    await expect(categories.items.first()).toBeVisible();',
        '    await expect(categories.list).toBeVisible();',
      ),
      'assertion',
    ));
  test('5 allowed: updating a value inside the assertion', () =>
    allowed(
      edit(
        SPEC,
        "await expect(blog.envBanner).toContainText('DEVELOPMENT');",
        "await expect(blog.envBanner).toContainText('DEV');",
      ),
    ));

  test('6 blocked: removing runIfEnv(', () =>
    blocked(edit(SPEC, "  runIfEnv(test, ['dev']);\n\n  test(", '  test('), 'runIfEnv('));
  test('6 blocked: removing envGuard(', () =>
    blocked(
      edit(SPEC, "  envGuard('post a comment');\n  await post();", '  await post();'),
      'envGuard(',
    ));
  test('6 allowed: updating the environment list while preserving the helper', () =>
    allowed(edit(SPEC, "runIfEnv(test, ['dev']);", "runIfEnv(test, ['dev', 'prod']);")));
});

describe('guard: the quick sample and the edge cases', () => {
  test('quick sample: protected-file write -> 2, removed assertion -> 2, ordinary edit -> 0', () => {
    assert.equal(write('secrets.pem', 'x').code, 2);
    assert.equal(edit(SPEC, 'expect(a).toBe(1);', '').code, 2);
    assert.equal(
      edit('pages/BasePage.ts', 'readonly page: Page;', 'readonly page: Page; // shared').code,
      0,
    );
  });

  test('protected names: .env.local, id_rsa, id_ed25519, *.key, *.p12, and a Windows path to .env', () => {
    for (const name of [
      '.env.local',
      'id_rsa',
      'id_ed25519',
      'server.key',
      'bundle.p12',
      'C:\\work\\project\\.env',
      'config/.env.production',
    ]) {
      blocked(write(name, 'x'), '');
    }
  });

  test('other secret shapes: Atlassian token, AWS key id, private-key header', () => {
    blocked(edit('scripts/x.mjs', '', atlassianSample));
    blocked(edit('scripts/x.mjs', '', `const id = '${awsSample}';`));
    blocked(write('notes.md', pemSample));
  });

  test('malformed input -> 0 silently (the documented fail-open limit)', () => {
    for (const input of ['not json', '', '{}', '[]', 'null', '{"tool_input":"string"}']) {
      allowed(run(input));
    }
  });

  test('leading byte-order marks (one or two) are stripped: a blocked payload still returns 2', () => {
    const payload = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: '.env', content: 'x' },
    });
    blocked(run('\uFEFF' + payload));
    blocked(run('\uFEFF\uFEFF' + payload));
  });

  test('helpers are counted separately: swapping one helper for the other is still a removal', () =>
    blocked(edit(SPEC, "runIfEnv(test, ['dev']);", "envGuard('x');"), 'runIfEnv('));

  test('whole-file Write gaps: .only in a Write is caught, but fewer assertions or helpers are not (no baseline)', () => {
    blocked(write(SPEC, "test.only('a', () => {});"), '.only');
    allowed(write(SPEC, "import { test } from '@playwright/test';\ntest('a', async () => {});\n"));
  });

  test('a separate assertion deletion is blocked; the same move inside one edit is allowed', () => {
    blocked(edit(SPEC, '    await expect(categories.list).toBeVisible();\n', ''), 'assertion');
    allowed(
      edit(
        SPEC,
        '    await expect(categories.list).toBeVisible();\n    await categories.open();\n',
        '    await categories.open();\n    await expect(categories.list).toBeVisible();\n',
      ),
    );
  });

  test('.only that was already present and stays is not an addition', () =>
    allowed(edit(SPEC, "test.only('a', async () => {", "test.only('a renamed', async () => {")));

  test('the spec-only rules do not apply to other files', () =>
    allowed(edit('env/runIfEnv.ts', 'test.skip(', 'test.skip( // kept')));

  test('the harmless Task 06 live-check comment is a blocked proposal (isolated proof only)', () =>
    blocked(
      edit(
        SPEC,
        "test.describe('categories on development', () => {",
        "// Task 06 guard check: test.only(\ntest.describe('categories on development', () => {",
      ),
      '.only',
    ));
});

describe('guard: the hard-wait rule (check 7, added in step 5)', () => {
  test('7 blocked: an Edit that adds waitForTimeout(', () =>
    blocked(
      edit(
        SPEC,
        '    await blog.open();',
        '    await blog.open();\n    await page.waitForTimeout(3000);',
      ),
      'waitForTimeout(',
    ));
  test('7 allowed: a condition-based wait instead', () =>
    allowed(
      edit(
        SPEC,
        '    await blog.open();',
        '    await blog.open();\n    await expect(blog.articleItems.first()).toBeVisible();',
      ),
    ));
  test('7 blocked: a Write whose whole content contains waitForTimeout(', () =>
    blocked(
      write(SPEC, "test('a', async ({ page }) => {\n  await page.waitForTimeout(500);\n});\n"),
      'waitForTimeout(',
    ));
  test('7 allowed: a hard wait that already existed in the old text and stays', () =>
    allowed(
      edit(
        SPEC,
        'await page.waitForTimeout(500);',
        'await page.waitForTimeout(500); // existing, not added here',
      ),
    ));
  test('7 does not apply outside specs', () =>
    allowed(edit('pages/BasePage.ts', '', 'await this.page.waitForTimeout(1);')));
});
