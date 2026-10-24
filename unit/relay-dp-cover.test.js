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
  for (const file of ['config.js', 'core.js', 'runners.js', 'plays.js']) {
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

const moveOf = (plan, i) => plan.mv.find((m) => m.i === i);

test('throwPlan: RF to home relays through 2B and SS covers second (50:50)', () => {
  const context = playsContext();
  context.__randQueue = [0.4];
  const relayed = context.throwPlan({ x: 360, y: 170 }, 4, 8);
  assert.equal(relayed.steps.length, 2);
  assert.ok(moveOf(relayed, 3)); // 2B relays
  assert.deepEqual([moveOf(relayed, 4).x, moveOf(relayed, 4).y], [240, 234]); // SS covers 2nd

  context.__randQueue = [0.6];
  const direct = context.throwPlan({ x: 360, y: 170 }, 4, 8);
  assert.equal(direct.steps.length, 1); // direct back-home throw
  assert.equal(moveOf(direct, 3), undefined);
  assert.ok(moveOf(direct, 4)); // 2nd is still covered
});

test('throwPlan: relay man follows the hit direction for home throws', () => {
  const context = playsContext();
  context.__randQueue = [0.4];
  const fromLeft = context.throwPlan({ x: 120, y: 170 }, 4, 6);
  assert.ok(moveOf(fromLeft, 4)); // SS relays from LF
  assert.ok(moveOf(fromLeft, 3)); // 2B covers 2nd

  context.__randQueue = [0.4];
  const centerLeft = context.throwPlan({ x: 200, y: 125 }, 4, 7);
  assert.ok(moveOf(centerLeft, 4)); // left of center: SS

  context.__randQueue = [0.4];
  const centerRight = context.throwPlan({ x: 300, y: 125 }, 4, 7);
  assert.ok(moveOf(centerRight, 3)); // right of center: 2B
});

test('throwPlan: only RF to third can relay; throws to second/first never relay', () => {
  const context = playsContext();
  context.__randQueue = [0.4];
  const rfToThird = context.throwPlan({ x: 360, y: 170 }, 3, 8);
  assert.equal(rfToThird.steps.length, 2);
  assert.ok(moveOf(rfToThird, 3)); // 2B relays
  assert.ok(moveOf(rfToThird, 5)); // 3B covers third

  context.__randQueue = [0.4];
  const lfToThird = context.throwPlan({ x: 120, y: 170 }, 3, 6);
  assert.equal(lfToThird.steps.length, 1);

  context.__randQueue = [0.4];
  const toSecond = context.throwPlan({ x: 360, y: 170 }, 2, 8);
  assert.equal(toSecond.steps.length, 1);
  assert.ok(moveOf(toSecond, 4)); // SS still covers 2nd

  const toFirst = context.throwPlan({ x: 360, y: 170 }, 1, 8);
  assert.equal(toFirst.steps.length, 1);
  assert.equal(toFirst.mv.length, 0);

  context.__randQueue = [0.4];
  const infieldToHome = context.throwPlan({ x: 285, y: 245 }, 4, 3);
  assert.equal(infieldToHome.steps.length, 1);
  assert.equal(infieldToHome.mv.length, 0);
});

function dpContext(fi, to) {
  const context = playsContext();
  context.__flightCb = null;
  context.flight = (dest, kind, cb) => {
    context.__flightCb = cb;
    vm.runInContext(`G.fl = { fi: ${fi}, to: { x: ${to.x}, y: ${to.y} }, dur: 600, t0: 0 }`, context);
  };
  vm.runInContext("G.outs = 0; G.bases = [0, 1, 0, 0]; G.top = true; G.runs = [[0], [0]]; G.pts = [0, 0]; G.cnt = { b: 0, s: 0 }; G.pitch = { type: 's' };", context);
  context.__randQueue = [0.5, 0.5, 0.2]; // grounder distance, no error/infield hit, double play wins the roll
  context.resultGround(0, { angle: 0 });
  return context;
}

test('double play: 3B grounder sends SS to cover second (plan A)', () => {
  const context = dpContext(5, { x: 150, y: 290 });
  const rl = vm.runInContext('G.rl', context);
  assert.ok(rl);
  assert.deepEqual(Array.from(rl.moves, (m) => [m.i, m.x, m.y]), [[4, 240, 234]]);
  assert.equal(vm.runInContext('!!G.fl.dpSelf', context), false);
  context.__flightCb();
  const th = vm.runInContext('G.th', context);
  assert.equal(th.steps[0].carry, undefined);
  assert.equal(th.steps[0].dur, 250);
});

test('double play: SS fields near second and takes it himself (plan B)', () => {
  const context = dpContext(4, { x: 280, y: 270 });
  assert.equal(vm.runInContext('!!G.fl.dpSelf', context), true);
  assert.ok(!vm.runInContext('G.rl', context)); // nobody else needs to cover
  context.__flightCb();
  const th = vm.runInContext('G.th', context);
  assert.equal(th.steps[0].carry, true);
  assert.ok(th.steps[0].dur > 250); // running takes longer than a toss
  assert.deepEqual([th.steps[1].from.x, th.steps[1].from.y], [240, 234]);
});

test('double play: 1B grounder stacks pitcher cover at first and 2B cover at second', () => {
  const context = dpContext(2, { x: 320, y: 290 });
  const rl = vm.runInContext('G.rl', context);
  assert.ok(rl);
  const byFielder = new Map(rl.moves.map((m) => [m.i, m]));
  assert.deepEqual([byFielder.get(0).x, byFielder.get(0).y], [311, 304]); // pitcher to first
  assert.deepEqual([byFielder.get(3).x, byFielder.get(3).y], [240, 234]); // 2B to second
});

test('double play: 2B fields it far from second, so SS covers (plan A)', () => {
  const context = dpContext(3, { x: 330, y: 260 });
  const rl = vm.runInContext('G.rl', context);
  assert.ok(rl);
  assert.deepEqual(Array.from(rl.moves, (m) => m.i), [4]);
  assert.equal(vm.runInContext('!!G.fl.dpSelf', context), false);
});
