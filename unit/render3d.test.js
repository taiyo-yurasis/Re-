const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'render3d.js'), 'utf8');
const BS = [0, { x: 311, y: 304 }, { x: 240, y: 234 }, { x: 169, y: 304 }];
const Q = [{ x: 240, y: 375 }, BS[1], BS[2], BS[3], { x: 240, y: 375 }];
const rpos = (a, b, p) => [Q[a].x + (Q[b].x - Q[a].x) * p, Q[a].y + (Q[b].y - Q[a].y) * p];
const store = {};
const context = vm.createContext({
  HP: { x: 240, y: 375 }, cl: (v, a, b) => Math.max(a, Math.min(b, v)), bp: () => [110, 110],
  BS, rpos, CONFIG: { render3d: false }, URLSearchParams,
  location: { search: '' },
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } }
});
vm.runInContext(source, context, { filename: 'render3d.js' });

test('toWorld anchors home and maps outfield toward negative Z', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(context.toWorld(240, 375))), { x: 0, y: 0, z: 0 });
  const scaled = context.toWorld(280, 375, 12);
  assert.equal(scaled.x, 1);
  assert.ok(Math.abs(scaled.y - 0.3) < 1e-12);
  assert.equal(scaled.z, 0);
  assert.ok(context.toWorld(240, 100).z < 0);
});

test('camera cycle includes all four stable modes', () => {
  assert.equal(context.cameraModeNext('catcher'), 'wide');
  assert.equal(context.cameraModeNext('wide'), 'overhead');
  assert.equal(context.cameraModeNext('overhead'), 'auto');
  assert.equal(context.cameraModeNext('auto'), 'catcher');
  assert.equal(context.cameraModeNext('unknown'), 'catcher');
});

test('fielder facing is derived from two world positions', () => {
  assert.equal(context.fieldPlayerFacing({ x: 0, z: 0 }, { x: 1, z: 0 }), Math.PI / 2);
  assert.equal(context.fieldPlayerFacing({ x: 0, z: 0 }, { x: 0, z: -1 }), Math.PI);
});

test('fieldBallState follows the game flight arc and ground bounce', () => {
  const f = { t0: 100, dur: 1000, to: { x: 240, y: 175 }, kind: 'fly', h: 50 };
  const mid = context.fieldBallState({ fl: f }, 600);
  assert.equal(mid.x, 240);
  assert.equal(mid.y, 275);
  assert.equal(mid.h, 50);
  const ground = context.fieldBallState({ fl: { ...f, kind: 'ground' } }, 350);
  assert.ok(ground.h > 0);
});

const plain = v => JSON.parse(JSON.stringify(v));

test('fieldRunnerStates shows runners on base when no advance is running', () => {
  const states = context.fieldRunnerStates({ bases: [0, 1, 0, 1], mv: null }, 1000);
  assert.deepEqual(plain(states), [
    { x: 311, y: 304, run: false },
    { x: 169, y: 304, run: false }
  ]);
  assert.deepEqual(plain(context.fieldRunnerStates({ bases: [0, 0, 0, 0], mv: null }, 1000)), []);
});

test('fieldRunnerStates follows stay and moves while an advance is running', () => {
  const game = { bases: [0, 0, 0, 0], mv: { t0: 0, dur: 2000, stay: [2], moves: [{ a: 0, b: 1, T: 1000 }] } };
  const states = plain(context.fieldRunnerStates(game, 500));
  assert.equal(states.length, 2);
  assert.deepEqual(states[0], { x: 240, y: 234, run: false });
  assert.deepEqual(states[1], { x: 240 + (311 - 240) * .5, y: 375 + (304 - 375) * .5, run: true });
});

test('fieldRunnerStates drops a moving runner at its out timing and falls back after mv ends', () => {
  const game = { bases: [0, 1, 0, 0], mv: { t0: 0, dur: 2000, stay: [], moves: [{ a: 1, b: 2, T: 1000, o: 400 }] } };
  assert.deepEqual(plain(context.fieldRunnerStates(game, 500)), []);
  assert.deepEqual(plain(context.fieldRunnerStates(game, 2500)), [{ x: 311, y: 304, run: false }]);
});

test('3D is test-only unless CONFIG.render3d ships it', () => {
  assert.equal(context.render3dAllowed(), false);
  context.localStorage.setItem('yakyu-stadium-3d', 'test');
  assert.equal(context.render3dAllowed(), true);
});

test('fieldBallState prioritizes throws and follows the pitch clock', () => {
  const thrown = context.fieldBallState({ th: { t0: 0, dur: 1000, from: { x: 0, y: 0 }, to: { x: 100, y: 0 } }, fl: null }, 500);
  assert.equal(thrown.x, 50);
  const pitch = context.fieldBallState({ phase: 'pitch', pitch: { t: .5 } }, 500);
  assert.equal(pitch.x, 240);
  assert.equal(pitch.y, 331);
});
