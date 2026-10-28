const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function makeDocument() {
  const elements = new Map();
  const element = () => ({
    style: {}, textContent: '', innerHTML: '', className: '', value: '',
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, replaceChildren() {}, getContext: () => ({})
  });
  return {
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: () => element()
  };
}

function playsContext() {
  const context = {
    document: makeDocument(), setTimeout, clearTimeout,
    performance: { now: () => 0 },
    Math: Object.create(Math),
    __randQueue: []
  };
  context.Math.random = () => (context.__randQueue.length ? context.__randQueue.shift() : 0.5);
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'runners.js', 'plays.js', 'pitching.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext(`
    banner = () => {};
    updateHud = () => {};
    fin = () => {};
    effMs = (p, ms) => ms;
    setMsg = () => {};
  `, context);
  return context;
}

function dpScenario(bases, outs) {
  const context = playsContext();
  context.__flightCb = null;
  context.flight = (to, kind, cb) => {
    context.__flightCb = cb;
    vm.runInContext('G.fl = { fi: 5, to: { x: 150, y: 290 }, dur: 600, t0: 0 }', context);
  };
  vm.runInContext(`G.outs = ${outs}; G.bases = [${bases.join(',')}]; G.top = true; G.inn = 1; G.runs = [[0], [0]]; G.pts = [0, 0]; G.cnt = { b: 0, s: 0 }; G.pitch = { type: 's' };`, context);
  context.__randQueue = [0.5, 0.5, 0.2]; // grounder distance, no error/infield hit, double play wins the roll
  context.resultGround(0, { angle: 0 });
  return context;
}

test('double play: runner on third always scores when the inning continues', () => {
  const context = dpScenario([0, 1, 0, 1], 0);
  // The runner from third is sent home by settle(); the bases are empty afterwards
  assert.deepEqual(Array.from(vm.runInContext('G.bases', context)), [0, 0, 0, 0]);
  context.__flightCb(); // score() runs in the flight callback
  assert.equal(vm.runInContext('G.runs[0][0]', context), 1);
});

test('double play: runner on second always reaches third', () => {
  const context = dpScenario([0, 1, 1, 0], 0);
  assert.deepEqual(Array.from(vm.runInContext('G.bases', context)), [0, 0, 0, 1]);
});

test('bases loaded grounder: home-to-first double play keeps the run off the board', () => {
  // 満塁ゴロは通常の併殺抽選ではなく専用の3パターン分岐になる (このキューは併殺パターン)
  const context = playsContext();
  context.__flightCb = null;
  context.flight = (to, kind, cb) => {
    context.__flightCb = cb;
    vm.runInContext('G.fl = { fi: 5, to: { x: 150, y: 290 }, dur: 600, t0: 0 }', context);
  };
  vm.runInContext('G.outs = 0; G.bases = [0, 1, 1, 1]; G.top = true; G.inn = 1; G.runs = [[0], [0]]; G.pts = [0, 0]; G.cnt = { b: 0, s: 0 }; G.pitch = { type: "s" };', context);
  context.__randQueue = [0.5, 0.5, 0.1]; // distance, no error/infield hit, home-to-first DP pattern
  context.resultGround(0, { angle: 0 });
  // 三塁走者は本塁アウト、一・二塁走者は進塁、打者は一塁アウトで一塁は空く
  assert.deepEqual(Array.from(vm.runInContext('G.bases', context)), [0, 0, 1, 1]);
  context.__flightCb();
  assert.equal(vm.runInContext('G.outs', context), 2);
  assert.equal(vm.runInContext('G.runs[0][0]', context), 0);
});

test('double play that ends the inning does not advance runners', () => {
  const context = dpScenario([0, 1, 0, 1], 1);
  // 1 out + double play = 3 outs: the runner on third stays put and no run counts
  assert.equal(vm.runInContext('G.bases[3]', context), 1);
  context.__flightCb();
  assert.equal(vm.runInContext('G.runs[0][0]', context), 0);
});

test('cpuAimTarget: strong CPU pitchers live on the edge of the zone', () => {
  const context = playsContext();
  context.__randQueue = []; // fall back to real randomness (0.5 default would skew bands; use Math.random)
  context.Math.random = Math.random;
  const cpuAimTarget = vm.runInContext('cpuAimTarget', context);
  const bandShare = (level) => {
    let inBand = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const { x, y } = cpuAimTarget(level);
      const m = Math.max(Math.abs(x - 110), Math.abs(y - 110));
      if (m >= 60 && m <= 76) inBand++;
    }
    return inBand / N;
  };
  // Lv4 aims at the edge band 70% of the time (plus incidental hits from wide targets)
  assert.ok(bandShare(4) > 0.6, 'Lv4 edge share should exceed 60%');
  // Lv1 never aims at the edge on purpose; only wide targets land there incidentally
  assert.ok(bandShare(1) < 0.2, 'Lv1 edge share should stay under 20%');
  // Monotonic in difficulty
  assert.ok(bandShare(3) > bandShare(2));
});
