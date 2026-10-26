const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function pitchContext() {
  const element = () => ({
    style: {}, textContent: '', innerHTML: '', className: '', value: '',
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, replaceChildren() {}, getContext: () => ({})
  });
  const elements = new Map();
  const context = {
    document: {
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement: () => element()
    },
    setTimeout, clearTimeout,
    performance: { now: () => 0 }
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'pitching.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('new pitch types carry the prototype parameters verbatim', () => {
  const context = pitchContext();
  const TY = vm.runInContext('TY', context);
  const NAMES = vm.runInContext('TY_NAMES', context);
  const judge = vm.runInContext('CONFIG.judge', context);
  assert.deepEqual({ ...TY.ct }, { d: 1020, j: 9 });
  assert.deepEqual({ ...TY.ss }, { d: 3000, j: 14 });
  assert.equal(NAMES.ct, 'カットボール');
  assert.equal(NAMES.ss, '超スローボール');
  assert.equal(judge.nearer.ct, false);
  assert.equal(judge.nearer.ss, false);
  assert.equal(judge.bonus.ct, false);
  assert.equal(judge.bonus.ss, false);
  assert.equal(judge.bonusMax.ct, 0);
  assert.equal(judge.bonusMax.ss, 0);
  assert.equal(judge.latePenalty.ct, 0);
  assert.equal(judge.latePenalty.ss, 0);
  // SPIN lives in render.js (canvas code); check its source values
  const renderSrc = fs.readFileSync(path.join(root, 'render.js'), 'utf8');
  assert.match(renderSrc, /ct:\{rpm:2250,axis:'screen'\}/);
  assert.match(renderSrc, /ss:\{rpm:500,axis:'screen'\}/);
});

test('breakAt: cutter cuts late, super slow ball arcs and drops', () => {
  const context = pitchContext();
  const breakAt = vm.runInContext('breakAt', context);
  // cutter: no break before u=0.72, full 26px at the end, glove-side by hand
  assert.equal(breakAt('ct', 1, 0.5, 110).x, 0);
  assert.equal(breakAt('ct', 1, 1, 110).x, 26);
  assert.equal(breakAt('ct', -1, 1, 110).x, -26);
  assert.equal(breakAt('ct', 1, 1, 110).y, 0);
  // super slow: sin arc peaks mid-flight, late drop adds +34 at the end
  const mid = breakAt('ss', 1, 0.5, 110);
  assert.equal(mid.x, 8);
  assert.equal(mid.y, -95);
  const end = breakAt('ss', 1, 1, 110);
  assert.ok(Math.abs(end.x) < 1e-9);
  assert.equal(end.y, 34);
  // both pitches still land exactly on target through bp()'s end correction
  const bp = vm.runInContext('bp', context);
  for (const type of ['ct', 'ss']) {
    const [x, y] = bp({ type, x: 150, y: 130, sg: 1 }, 1);
    assert.ok(Math.abs(x - 150) < 1e-9 && Math.abs(y - 130) < 1e-9, `${type} should land on target`);
  }
});

test('course ideal timing is 40ms and CPU sequencing knows the cutter', () => {
  const context = pitchContext();
  assert.equal(vm.runInContext('CONFIG.courseIdealMs', context), 40);
  const plan = vm.runInContext('cpuPlanPitch', context);
  vm.runInContext('G.cnt = { b: 0, s: 0 }; G.prevPitch = null;', context);
  const counts = {};
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const p = plan(4);
    counts[p.type] = (counts[p.type] || 0) + 1;
  }
  const ctShare = (counts.ct || 0) / N;
  assert.ok(ctShare > 0.05 && ctShare < 0.13, `Lv4 0-0 cutter share ${ctShare.toFixed(2)} should match the FC data (~9%)`);
  const ssShare = (counts.ss || 0) / N;
  assert.ok(ssShare > 0.003 && ssShare < 0.02, `Lv4 0-0 eephus share ${ssShare.toFixed(3)} should be the game-added ~1%`);
  // Lv1 is uniform across all eight types now
  const lv1 = {};
  for (let i = 0; i < N; i++) {
    const p = plan(1);
    lv1[p.type] = (lv1[p.type] || 0) + 1;
  }
  for (const t of ['s', 'sh', 'sl', 'c', 'cu', 'f', 'ct', 'ss']) {
    const share = (lv1[t] || 0) / N;
    assert.ok(share > 0.08 && share < 0.17, `Lv1 ${t} share ${share.toFixed(2)} should be near 1/8`);
  }
});
