import assert from 'node:assert/strict';
import { envGuard } from '../env/envGuard';
import { runIfEnv } from '../env/runIfEnv';
import { getTarget } from '../env/target';

const selected = getTarget().name;
const skipCalls: Array<{ condition: boolean; reason: string }> = [];
runIfEnv({ skip: (condition, reason) => skipCalls.push({ condition, reason }) }, ['dev']);
assert.equal(skipCalls.length, 1);
assert.equal(skipCalls[0].condition, selected !== 'dev');
assert.match(skipCalls[0].reason, /dev/);
assert.match(skipCalls[0].reason, new RegExp(selected));

let actionCalls = 0;
if (selected === 'prod') {
  assert.throws(() => {
    envGuard('change dummy data');
    actionCalls++;
  }, /production/);
  assert.equal(actionCalls, 0);
} else {
  envGuard('change dummy data');
  actionCalls++;
  assert.equal(actionCalls, 1);
}

process.env.APP_ENV = selected === 'dev' ? 'prod' : 'dev';
assert.throws(() => getTarget(), /target changed during this process/);

console.log(JSON.stringify({ selected, skip: skipCalls[0].condition, actionCalls, pinned: true }));
