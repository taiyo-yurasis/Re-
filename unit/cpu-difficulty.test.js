const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const context = {
  G: { pitch: { type: 's', dur: 930 }, cnt: { s: 0 }, last: null, top: true, batterSides: ['right', 'right'] },
  cfgCpuDifficulty: 4,
  cl: (v, a, b) => Math.max(a, Math.min(b, v)),
  dist: () => 0,
  bp: () => [110, 110],
  performance: { now: () => 1234 },
  result: (...args) => { context.lastResult = args; },
  take: () => { context.took = true; }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'config.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'batting.js'), 'utf8'), context);

test('CPU difficulty has four progressively tighter control profiles', () => {
  const levels = vm.runInContext('CPU_DIFFICULTY', context);
  assert.deepEqual(Object.keys(levels), ['1', '2', '3', '4']);
  assert.ok(levels[1].pitchAimError > levels[2].pitchAimError);
  assert.ok(levels[2].pitchAimError > levels[3].pitchAimError);
  assert.ok(levels[3].pitchAimError > levels[4].pitchAimError);
  assert.ok(levels[1].timingError > levels[2].timingError);
  assert.ok(levels[2].timingError > levels[3].timingError);
  assert.ok(levels[3].timingError > levels[4].timingError);
});

test('CPU batting delegates the final outcome to the shared batResult function', () => {
  vm.runInContext('Math.random = () => 0.1; batResult = (p, ms, x, y) => ({ k: "1B", ms, x, y });', context);
  vm.runInContext('cpuBat()', context);
  assert.equal(context.lastResult[0], '1B');
  assert.ok(Number.isFinite(context.lastResult[1]));
  assert.equal(context.lastResult[2].x, 110);
  assert.equal(context.lastResult[2].y, 110);
  assert.equal(context.took, undefined);
});
