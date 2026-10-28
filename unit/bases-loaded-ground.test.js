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
    __randQueue: [], __banners: []
  };
  context.Math.random = () => (context.__randQueue.length ? context.__randQueue.shift() : 0.5);
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'runners.js', 'plays.js', 'pitching.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext(`
    banner = (t) => { __banners.push(t) };
    updateHud = () => {};
    fin = () => {};
    effMs = (p, ms) => ms;
    setMsg = () => {};
  `, context);
  context.flight = (to, kind, cb) => {
    context.__flightCb = cb;
    vm.runInContext('G.fl = { fi: 5, to: { x: 150, y: 290 }, dur: 600, t0: 0 }', context);
  };
  return context;
}

// patternRoll: 3回目の抽選 (満塁ゴロのパターン分岐)。outs<2 では <.2=併殺 / <.6=本塁アウト / それ以外=生還
function loadedScenario(patternRoll, outs) {
  const context = playsContext();
  vm.runInContext(`G.outs = ${outs}; G.bases = [0, 1, 1, 1]; G.top = true; G.inn = 1; G.runs = [[0], [0]]; G.pts = [0, 0]; G.cnt = { b: 0, s: 0 }; G.pitch = { type: 's' };`, context);
  context.__randQueue = [0.5, 0.5, patternRoll];
  context.resultGround(0, { angle: 0 });
  return context;
}

test('loaded grounder pattern 1: force out at home, bases stay loaded, no run', () => {
  const context = loadedScenario(0.4, 0);
  // 打者も一塁に残るので満塁のまま
  assert.deepEqual(Array.from(vm.runInContext('G.bases', context)), [0, 1, 1, 1]);
  context.__flightCb();
  assert.equal(vm.runInContext('G.outs', context), 1);
  assert.equal(vm.runInContext('G.runs[0][0]', context), 0);
  // 送球は一塁ではなく本塁へ
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('G.th.to', context))), { x: 240, y: 375 });
  assert.ok(context.__banners.includes('本塁アウト!'));
});

test('loaded grounder pattern 2: run scores and the batter is out at first', () => {
  const context = loadedScenario(0.8, 0);
  // 三塁走者は生還、一・二塁走者は進塁、打者はアウトで一塁は空く
  assert.deepEqual(Array.from(vm.runInContext('G.bases', context)), [0, 0, 1, 1]);
  context.__flightCb();
  assert.equal(vm.runInContext('G.outs', context), 1);
  assert.equal(vm.runInContext('G.runs[0][0]', context), 1);
  // 送球は通常通り一塁へ
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('G.th.to', context))), { x: 311, y: 304 });
});

test('loaded grounder with 2 outs: no double play pattern, home out ends it', () => {
  const context = loadedScenario(0.3, 2); // 2アウト時は併殺パターンなし (0.3 は本塁アウト側)
  context.__flightCb();
  assert.equal(vm.runInContext('G.outs', context), 3);
  assert.equal(vm.runInContext('G.runs[0][0]', context), 0);
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('G.th.to', context))), { x: 240, y: 375 });
});

test('pickFielder: deep flies belong to outfielders only', () => {
  const context = playsContext();
  const pick = vm.runInContext('pickFielder', context);
  assert.equal(pick({ x: 240, y: 125 }, 'fly'), 7); // センター定位置そのもの
  assert.ok([6, 7, 8].includes(pick({ x: 140, y: 200 }, 'fly')), 'deep left-field fly must go to an outfielder');
  assert.ok([6, 7, 8].includes(pick({ x: 240, y: 60 }, 'hr')), 'home-run balls are outfield territory');
});

test('pickFielder: shallow flies can still go to an infielder', () => {
  const context = playsContext();
  const pick = vm.runInContext('pickFielder', context);
  assert.equal(pick({ x: 230, y: 270 }, 'fly'), 4); // 二塁ベース手前はショートが最寄り
});

test('pickFielder: grounders stay with infielders and the pitcher', () => {
  const context = playsContext();
  const pick = vm.runInContext('pickFielder', context);
  assert.equal(pick({ x: 240, y: 280 }, 'ground'), 0); // 投手の近くは投手
  assert.equal(pick({ x: 150, y: 310 }, 'ground'), 5); // 三塁手の近く
});
