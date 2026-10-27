const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function practiceContext() {
  const element = () => ({
    style: {}, textContent: '', innerHTML: '', className: '', value: '',
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, replaceChildren() {}, getContext: () => ({})
  });
  const elements = new Map();
  const captured = { flights: [], readyCalls: 0 };
  const context = {
    document: {
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement: () => element(),
      querySelector: () => element()
    },
    setTimeout, clearTimeout,
    performance: { now: () => 0 },
    banner() {}, setMsg() {}, updateHud() {},
    ready: () => { captured.readyCalls++; },
    flight: (to, kind, cb, out, o) => { captured.flights.push({ to, kind, out, o }); },
    // plays.js is not loaded in this context; mirror its landing-distance formula
    flyDistPx: (info) => (info && Number.isFinite(info.dist))
      ? Math.min(312, Math.max(60, Math.round(info.dist * 3.1)))
      : 200
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'pitching.js', 'batting.js', 'practice.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext("G.top=true;G.batterSides=['right','right'];G.prac=pracStats();G.cur={x:110,y:110};G.pitch={type:'s',x:110,y:110,sg:1,dur:930};", context);
  return { context, captured };
}

const info = { angle: 10, dist: 90, speed: 150, launch: 30, tier: 'normal', tier0: 'normal', dir: 'center', course: 'mid' };

test('practice fly ball flies on the field with the match landing spot', async () => {
  const { context, captured } = practiceContext();
  context.__info = info;
  vm.runInContext("pracResult('fly', 0, __info);", context);
  assert.equal(captured.flights.length, 1);
  const f = captured.flights[0];
  assert.equal(f.kind, 'fly');
  assert.equal(f.out, 1);
  // flyDistPx: 90m * 3.1 = 279px at 10 degrees from home (240,375)
  const d = 279, a = 10 * Math.PI / 180;
  assert.ok(Math.abs(f.to.x - (240 + d * Math.sin(a))) < 0.6, `landing x ${f.to.x}`);
  assert.ok(Math.abs(f.to.y - (375 - d * Math.cos(a))) < 0.6, `landing y ${f.to.y}`);
  // the next pitch waits for the flight: the usual 500ms timer must not fire
  await sleep(700);
  assert.equal(captured.readyCalls, 0);
});

test('practice home run uses the hr flight beyond the fence', () => {
  const { context, captured } = practiceContext();
  context.__info = info;
  vm.runInContext("pracResult('HR', 0, __info);", context);
  assert.equal(captured.flights.length, 1);
  const f = captured.flights[0];
  assert.equal(f.kind, 'hr');
  const dist = Math.hypot(f.to.x - 240, f.to.y - 375);
  assert.ok(dist >= 345 && dist <= 380, `HR distance ${dist} should clear the 320px fence`);
});

test('practice take does not fly and keeps the quick next pitch', async () => {
  const { context, captured } = practiceContext();
  vm.runInContext("pracResult('look', null, null);", context);
  assert.equal(captured.flights.length, 0);
  await sleep(700);
  assert.equal(captured.readyCalls, 1);
});
