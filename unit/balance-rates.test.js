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
    __randQueue: [], __banners: [], __flightCb: null
  };
  context.Math.random = () => (context.__randQueue.length ? context.__randQueue.shift() : 0.5);
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'runners.js', 'plays.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext(`
    banner = (t) => { __banners.push(t); };
    updateHud = () => {};
    fin = () => {};
    effMs = (p, ms) => ms;
    setMsg = () => {};
    flight = (to, kind, cb) => { __flightCb = cb; G.fl = { fi: 5, to: { x: 150, y: 290 }, dur: 600, t0: 0 }; };
  `, context);
  vm.runInContext(`G.outs = 0; G.bases = [0, 0, 0, 0]; G.top = true; G.inn = 1; G.runs = [[0], [0]]; G.pts = [0, 0]; G.hits = [0, 0]; G.cnt = { b: 0, s: 0 }; G.pitch = { type: 's' };`, context);
  return context;
}

test('rates: error and fine-play-hit are both 5%', () => {
  const context = playsContext();
  const config = vm.runInContext('CONFIG', context);
  assert.equal(config.errorRate, 0.05);
  assert.equal(config.finePlayHit, 0.05);
  assert.equal(config.infieldHitRate, 0.05); // unchanged
});

test('grounder roll of 4% is an error, 7% is an infield hit, at the 5% boundary', () => {
  // roll 0.04 < errorRate 0.05 -> error
  let context = playsContext();
  context.__randQueue = [0.5, 0.04]; // fielding depth draw, then the outcome roll
  context.resultGround(0, { angle: 0 });
  context.__flightCb();
  assert.ok(context.__banners.includes('エラー!'), `expected error banner, got ${context.__banners}`);

  // roll 0.07: past the error band, inside error+infieldHit (0.10) -> infield hit
  context = playsContext();
  context.__randQueue = [0.5, 0.07];
  context.resultGround(0, { angle: 0 });
  context.__flightCb();
  assert.ok(context.__banners.includes('内野安打!'), `expected infield-hit banner, got ${context.__banners}`);
});

test('single is robbed by a fine play at a 4% roll but not at 7%', () => {
  // hit('1B') draws with a fixed angle: ground coin, distance, then the fine-play roll
  let context = playsContext();
  context.__randQueue = [0.5, 0.5, 0.04];
  vm.runInContext(`hit('1B', 0, { angle: 0 })`, context);
  assert.ok(context.__banners.includes('ファインプレー！！'), `expected fine-play banner, got ${context.__banners}`);
  assert.equal(vm.runInContext('G.outs', context), 1);

  context = playsContext();
  context.__randQueue = [0.5, 0.5, 0.07];
  vm.runInContext(`hit('1B', 0, { angle: 0 })`, context);
  assert.ok(!context.__banners.includes('ファインプレー！！'));
  assert.equal(vm.runInContext('G.outs', context), 0);
});
