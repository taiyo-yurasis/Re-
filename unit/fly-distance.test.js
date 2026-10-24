const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sources = ['config.js', 'core.js', 'plays.js'];

function createContext(random = () => 0.5) {
  const context = {
    document: {
      getElementById: () => ({ getContext: () => ({}) })
    }
  };
  vm.createContext(context);
  for (const file of sources) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  context.__random = random;
  vm.runInContext('Math.random = __random;', context);
  return context;
}

test('flyDistPx converts physics distance (m) to the fly-handling scale (px)', () => {
  const context = createContext();
  // 3.1px/m: the mid/deep sac-fly thresholds (128/145px) sit between inField (56m) and hitMax (80m)
  assert.equal(context.flyDistPx({ dist: 38 }), 118);
  assert.equal(context.flyDistPx({ dist: 50 }), 155);
  assert.equal(context.flyDistPx({ dist: 56 }), 174);
});

test('flyDistPx clamps converted distances to the drawable range', () => {
  const context = createContext();
  assert.equal(context.flyDistPx({ dist: 10 }), 60);
  assert.equal(context.flyDistPx({ dist: 120 }), 335);
});

test('flyDistPx stays monotonic so deeper batted balls fly farther on screen', () => {
  const context = createContext();
  const distances = [15, 25, 35, 45, 55].map((dist) => context.flyDistPx({ dist }));
  for (let i = 1; i < distances.length; i++) {
    assert.ok(distances[i] > distances[i - 1], `${distances[i - 1]} < ${distances[i]}`);
  }
});

test('flyDistPx falls back to the legacy random range when distance is unavailable', () => {
  const low = createContext(() => 0);
  assert.equal(low.flyDistPx(null), 160);
  assert.equal(low.flyDistPx({}), 160);
  assert.equal(low.flyDistPx({ dist: NaN }), 160);
  const high = createContext(() => 0.999999);
  assert.ok(high.flyDistPx(undefined) <= 270);
});
