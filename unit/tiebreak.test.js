const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sources = ['config.js', 'core.js', 'pitching.js', 'game.js'];

function element() {
  return {
    style: {}, textContent: '', className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, replaceChildren() {}, getContext: () => ({})
  };
}

function createContext() {
  const context = {
    document: { getElementById: () => element(), createElement: () => element() },
    setTimeout, clearTimeout,
    banners: []
  };
  vm.createContext(context);
  for (const file of sources) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  // HUD / pitching side effects are outside the scope of these tests
  vm.runInContext(`
    banner = (t) => { __banners.push(t); };
    updateHud = () => {};
    setMsg = () => {};
    throwP = () => {};
    applyCpuPitchError = (x, y) => ({ x, y });
    pracPitch = () => ({ t: 's', x: 110, y: 110 });
  `, context);
  context.__banners = context.banners;
  return context;
}

const G = (context) => vm.runInContext('G', context);
const waitFor = async (fn, timeout = 4000) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 50));
  }
};

function setup(context, tb) {
  vm.runInContext(`cfgTiebreak = ${JSON.stringify(tb)}; newGame(3, false);`, context);
  // Bottom of the 3rd, tied 1-1
  vm.runInContext('G.inn = 3; G.top = false; G.runs = [[1,0,0],[0,0,1]];', context);
}

test('tiebreak off: a tied regulation game ends and is decided on points', () => {
  const context = createContext();
  setup(context, 'off');
  context.endHalf();
  assert.equal(context.banners.at(-1), 'ゲームセット');
});

test('tiebreak one: one extra inning starts with a runner on second, then the game ends', async () => {
  const context = createContext();
  setup(context, 'one');
  context.endHalf();
  assert.equal(context.banners.at(-1), 'チェンジ');
  await waitFor(() => G(context).inn === 4 && G(context).top === true);
  // MLB-style tiebreak: no outs, runner on second to open the inning
  assert.deepEqual(Array.from(G(context).bases), [0, 0, 1, 0]);
  assert.match(context.banners.at(-1), /^タイブレーク!/);
  // Still tied after the one extra inning -> game over (points decide)
  vm.runInContext('G.top = false; G.runs = [[1,0,0,0],[0,0,1,0]];', context);
  context.endHalf();
  assert.equal(context.banners.at(-1), 'ゲームセット');
});

test('tiebreak full: extra innings repeat until the game is decided', async () => {
  const context = createContext();
  setup(context, 'full');
  context.endHalf();
  await waitFor(() => G(context).inn === 4 && G(context).top === true);
  assert.deepEqual(Array.from(G(context).bases), [0, 0, 1, 0]);
  vm.runInContext('G.top = false; G.runs = [[1,0,0,0],[0,0,1,0]];', context);
  context.endHalf();
  assert.equal(context.banners.at(-1), 'チェンジ');
  await waitFor(() => G(context).inn === 5 && G(context).top === true);
  assert.deepEqual(Array.from(G(context).bases), [0, 0, 1, 0]);
});

test('tiebreak does not change a decided game or the top-half early end', () => {
  const context = createContext();
  setup(context, 'full');
  // Bottom of the 3rd, visitor leads -> game over
  vm.runInContext('G.runs = [[2,0,0],[0,0,1]];', context);
  context.endHalf();
  assert.equal(context.banners.at(-1), 'ゲームセット');

  const context2 = createContext();
  setup(context2, 'one');
  // Top of the 3rd ends with the home team already leading -> no bottom half
  vm.runInContext('G.top = true; G.runs = [[0,0,0],[1,0,0]];', context2);
  context2.endHalf();
  assert.equal(context2.banners.at(-1), 'ゲームセット');
});
