const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

test('compare actual batting Monte Carlo across correction scales', () => {
  for (const scale of ['0', '0.25', '0.5']) {
    const run = spawnSync(process.execPath, ['tuner.js'], {
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, SIM_PITCHES: '30000', SIM_SEED: '20261023', PHYSICS_SCALE: scale }
    });
    process.stdout.write(run.stdout || '');
    process.stderr.write(run.stderr || '');
    assert.equal(run.status, 0, 'Monte Carlo failed at scale ' + scale);
  }
});
