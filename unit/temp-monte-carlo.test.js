const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('run reproducible Monte Carlo against the actual batting implementation', () => {
  const run = spawnSync(process.execPath, ['tuner.js'], {
    encoding: 'utf8',
    timeout: 120000,
    env: { ...process.env, SIM_PITCHES: '30000', SIM_SEED: '20261023' }
  });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  assert.equal(run.status, 0, 'Monte Carlo runner failed');
});
