const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const playsSource = fs.readFileSync(path.join(root, 'plays.js'), 'utf8');
const runnersSource = fs.readFileSync(path.join(root, 'runners.js'), 'utf8');

function createPlaysContext() {
  const context = {
    G: { prac: false },
    pracResult: () => 'practice',
    hit: () => 'hit'
  };
  vm.createContext(context);
  vm.runInContext(playsSource, context);
  context.hit = () => 'hit';
  for (const name of ['resultBall', 'resultStrike', 'resultFoul', 'resultGround', 'resultFly']) {
    context[name] = () => name;
  }
  return context;
}

test('result dispatches each pitch outcome to its dedicated handler', () => {
  const context = createPlaysContext();
  const cases = [
    ['ball', 'resultBall'],
    ['look', 'resultStrike'],
    ['miss', 'resultStrike'],
    ['foul', 'resultFoul'],
    ['gr', 'resultGround'],
    ['fly', 'resultFly']
  ];
  for (const [outcome, handler] of cases) {
    assert.equal(context.result(outcome), handler, `outcome: ${outcome}`);
  }
  assert.equal(context.result('1B'), 'hit');
});

test('batting practice still bypasses match result handlers', () => {
  const context = createPlaysContext();
  context.G.prac = true;
  assert.equal(context.result('ball'), 'practice');
});

test('settle keeps runners in distinct bases and counts a runner crossing home', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(runnersSource, context);
  const result = context.settle({ 1: 2, 2: 3, 3: 4 });
  assert.deepEqual(Array.from(result.bases), [0, 0, 1, 1]);
  assert.equal(result.runs, 1);
  assert.deepEqual(Array.from(result.moves, ({ a, b }) => [a, b]), [[3, 4], [2, 3], [1, 2]]);
});

test('settle resolves collisions without placing two runners on one base', () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(runnersSource, context);
  const result = context.settle({ 1: 2, 2: 3, 3: 3 });
  assert.deepEqual(Array.from(result.bases), [0, 1, 1, 1]);
  assert.equal(result.runs, 0);
});
