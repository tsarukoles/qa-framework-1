import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTarget } from '../env/target';

const dev = 'https://dev.ai-orchestration-courses.com';
const prod = 'https://ai-orchestration-courses.com';

test('a missing APP_ENV selects dev; exact dev and prod work', () => {
  assert.deepEqual(resolveTarget({}), { name: 'dev', baseURL: dev });
  assert.deepEqual(resolveTarget({ APP_ENV: 'dev' }), { name: 'dev', baseURL: dev });
  assert.deepEqual(resolveTarget({ APP_ENV: 'prod' }), { name: 'prod', baseURL: prod });
});

test('only exact environment names are accepted', () => {
  for (const APP_ENV of ['', 'DEV', ' dev', 'dev ', 'staging']) {
    assert.throws(() => resolveTarget({ APP_ENV }), /APP_ENV must be exactly dev or prod/);
  }
});

test('BASE_URL may be absent or exactly match the selected course address', () => {
  assert.equal(resolveTarget({ APP_ENV: 'dev', BASE_URL: dev }).baseURL, dev);
  assert.equal(resolveTarget({ APP_ENV: 'prod', BASE_URL: prod }).baseURL, prod);
  for (const BASE_URL of ['', ' ', prod, `${dev}/`, `${dev}/login`, 'https://other.example']) {
    assert.throws(
      () => resolveTarget({ APP_ENV: 'dev', BASE_URL }),
      (error: Error) => {
        assert.equal(error.message, 'BASE_URL must exactly match the selected course address.');
        return true;
      },
    );
  }
});

test('LOCAL_SANDBOX_DIR is rejected even when empty', () => {
  assert.throws(() => resolveTarget({ LOCAL_SANDBOX_DIR: '' }), /not supported/);
  assert.throws(() => resolveTarget({ LOCAL_SANDBOX_DIR: 'somewhere' }), /not supported/);
});
