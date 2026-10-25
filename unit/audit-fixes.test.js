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
    createElement: () => element(),
    _elements: elements
  };
}

function load(context, files) {
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
}

function gameContext() {
  const document = makeDocument();
  const context = { document, setTimeout, clearTimeout, banners: [] };
  vm.createContext(context);
  load(context, ['config.js', 'core.js', 'pitching.js', 'game.js']);
  vm.runInContext(`
    banner = (t) => { __banners.push(t); };
    updateHud = () => {};
    setMsg = () => {};
    throwP = () => {};
    applyCpuPitchError = (x, y) => ({ x, y });
    pracPitch = () => ({ t: 's', x: 110, y: 110 });
  `, context);
  context.__banners = context.banners;
  context.__document = document;
  return context;
}

test('over: tied score with equal match points goes to the visitor (spec)', () => {
  const context = gameContext();
  vm.runInContext("newGame(3, false); G.runs = [[1,0,0],[0,0,1]]; G.pts = [500, 500];", context);
  context.over();
  // Spec: points tie is awarded to team 0; humanTeam is 0 here, so this is a win
  assert.equal(context.__document._elements.get('ovt').textContent, '🎉 勝利!');
});

test('over: tied score is still decided by match points when they differ', () => {
  const context = gameContext();
  vm.runInContext("newGame(3, false); G.runs = [[1,0,0],[0,0,1]]; G.pts = [900, 500];", context);
  context.over();
  // humanTeam is 0 (visitor, cfgCpuFirst default) and team 0 leads on points
  assert.equal(context.__document._elements.get('ovt').textContent, '🎉 勝利!');
});

function playsContext() {
  const document = makeDocument();
  const context = {
    document, setTimeout, clearTimeout,
    performance: { now: () => 0 },
    Math: Object.create(Math)
  };
  context.Math.random = () => 0.5;
  vm.createContext(context);
  load(context, ['config.js', 'core.js', 'runners.js', 'plays.js']);
  vm.runInContext(`
    banner = () => {};
    updateHud = () => {};
    fin = () => {};
    score = () => {};
    effMs = (p, ms) => ms;
    setMsg = () => {};
  `, context);
  return context;
}

test('resultFly with 2 outs advances runners before the catch (spec)', () => {
  const context = playsContext();
  let flightCallback = null;
  context.flight = (to, kind, cb) => { flightCallback = cb; };
  vm.runInContext('G.outs = 2; G.bases = [0, 1, 0, 1]; G.top = true; G.runs = [[0], [0]];', context);
  context.resultFly(0, { dist: 50, angle: 0 });
  // Spec: with 2 outs the runners take off on contact, so they move up a base right away
  assert.deepEqual(Array.from(vm.runInContext('G.bases', context)), [0, 0, 1, 1]);
  assert.equal(typeof flightCallback, 'function');
});

test('resultGround with 2 outs advances runners on contact (spec)', () => {
  const context = playsContext();
  context.flight = (to, kind, cb) => {
    vm.runInContext('G.fl = { dur: 600, fi: 5, to: { x: 240, y: 300 } }', context);
    cb();
  };
  vm.runInContext('G.outs = 2; G.bases = [0, 1, 1, 0]; G.top = true; G.runs = [[0], [0]];', context);
  context.resultGround(0, { angle: 0 });
  assert.deepEqual(Array.from(vm.runInContext('G.bases', context)), [0, 0, 1, 1]);
});

test('snap carries isHit and validSnap accepts long extra-inning games', () => {
  const document = makeDocument();
  const context = { document, setTimeout, clearTimeout, setInterval: () => 0, performance: { now: () => 1000 } };
  vm.createContext(context);
  load(context, ['config.js', 'core.js', 'net.js']);
  vm.runInContext(`
    G.net = 'host'; G.gid = 1; G.me = 0; G.seq = 0;
    G.phase = 'idle'; G.swingT = 0; G.N = 3; G.pts = [0, 0];
    G.top = true; G.outs = 0; G.cnt = { b: 0, s: 0 }; G.bases = [0, 0, 0, 0]; G.hits = [0, 0];
    G.inn = 25; G.runs = [Array(25).fill(0), Array(25).fill(0)];
    G.fl = { id: 1, out: true, fi: 7, ri: 7, wall: false, isHit: true, to: { x: 100, y: 100 }, kind: 'hit', dur: 900, h: 60, diving: false, t0: 900 };
  `, context);
  const snap = vm.runInContext('snap()', context);
  assert.equal(snap.f.isHit, true);
  assert.equal(vm.runInContext('validSnap', context)(snap), true);
  snap.f.isHit = 'yes';
  assert.equal(vm.runInContext('validSnap', context)(snap), false);
});

test('validSnap rejects oversized move lists and out-of-range flight height', () => {
  const document = makeDocument();
  const context = { document, setTimeout, clearTimeout, setInterval: () => 0, performance: { now: () => 1000 } };
  vm.createContext(context);
  load(context, ['config.js', 'core.js', 'net.js']);
  vm.runInContext(`
    G.net = 'host'; G.gid = 1; G.me = 0; G.seq = 0;
    G.phase = 'idle'; G.swingT = 0; G.N = 3; G.pts = [0, 0];
    G.top = true; G.outs = 0; G.cnt = { b: 0, s: 0 }; G.bases = [0, 0, 0, 0]; G.hits = [0, 0];
    G.inn = 3; G.runs = [[0, 0, 0], [0, 0, 0]];
    G.fl = { id: 1, out: true, fi: 7, ri: 7, wall: false, isHit: true, to: { x: 100, y: 100 }, kind: 'hit', dur: 900, h: 130, diving: false, t0: 900 };
  `, context);
  const validSnap = vm.runInContext('validSnap', context);
  const base = vm.runInContext('snap()', context);
  assert.equal(validSnap(base), true);
  const move = () => ({ a: 0, b: 1 });
  const manyMoves = { ...base, mv: { id: 1, age: 0, moves: Array.from({ length: 21 }, move), stay: [] } };
  assert.equal(validSnap(manyMoves), false);
  const fewMoves = { ...base, mv: { id: 1, age: 0, moves: Array.from({ length: 6 }, move), stay: [] } };
  assert.equal(validSnap(fewMoves), true);
  assert.equal(validSnap({ ...base, f: { ...base.f, h: 10000 } }), false);
  assert.equal(validSnap({ ...base, f: { ...base.f, h: 300 } }), true);
});

test('resultBall on ball four updates the detail message to a walk', () => {
  const context = playsContext();
  context.__msgs = [];
  vm.runInContext('setMsg = (t) => { __msgs.push(t); };', context);
  vm.runInContext("G.cnt = { b: 3, s: 0 }; G.bases = [0, 0, 0, 0]; G.top = true; G.runs = [[0], [0]]; G.pts = [0, 0]; G.pitch = { type: 's' };", context);
  context.resultBall(null);
  assert.ok(context.__msgs.some((t) => t.includes('フォアボール')));
});
