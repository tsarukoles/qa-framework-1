import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

for (const APP_ENV of ['dev', 'prod']) {
  test(`helpers use the pinned ${APP_ENV} target in a fresh process`, () => {
    const env: NodeJS.ProcessEnv = { ...process.env, APP_ENV };
    delete env.BASE_URL;
    delete env.LOCAL_SANDBOX_DIR;
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'safety/process-probe.ts'], {
      cwd: process.cwd(),
      env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    const outcome = JSON.parse(result.stdout.trim()) as {
      selected: string;
      skip: boolean;
      actionCalls: number;
      pinned: boolean;
    };
    assert.equal(outcome.selected, APP_ENV);
    assert.equal(outcome.skip, APP_ENV === 'prod');
    assert.equal(outcome.actionCalls, APP_ENV === 'prod' ? 0 : 1);
    assert.equal(outcome.pinned, true);
  });
}
