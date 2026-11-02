const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const playsSource = fs.readFileSync(path.join(root, 'plays.js'), 'utf8');

// 最小の DOM スタブ。classList は Set で記録し、リスナーも捕捉する
function fakeElement() {
  const classes = new Set();
  return {
    textContent: '', innerHTML: '', style: {},
    listeners: {},
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      toggle: (c, force) => { if (force === undefined ? !classes.has(c) : force) classes.add(c); else classes.delete(c); },
      contains: (c) => classes.has(c)
    },
    setAttribute() {},
    addEventListener(type, fn) { this.listeners[type] = fn; }
  };
}

function playsContext() {
  const elements = new Map();
  const context = {
    G: { prac: false, pitch: { type: 'st' }, fl: null },
    pid: 0,
    HP: { x: 240, y: 375 },
    performance: { now: () => 1000 },
    sync: () => {},
    TY_NAMES: { st: 'ストレート' },
    effMs: () => 0,
    CONFIG: { labelNearMs: 120, labelPerfectMs: 50, tierLabels: {} },
    __later: [], __msgs: [],
    $: (id) => { if (!elements.has(id)) elements.set(id, fakeElement()); return elements.get(id); }
  };
  context.later = (ms, fn) => context.__later.push([ms, fn]);
  context.setMsg = (t) => context.__msgs.push(t);
  vm.createContext(context);
  vm.runInContext(playsSource, context, { filename: 'plays.js' });
  context.__elements = elements;
  // result() の振り分け先は dispatch テストと同様に差し替える
  for (const name of ['resultBall', 'resultStrike', 'resultFoul', 'resultGround', 'resultFly', 'hit']) {
    context[name] = () => name;
  }
  context.pickFielder = () => 7;
  return context;
}

test('battedDataOf rounds values and judges barrels by the BATTED_EXP thresholds', () => {
  const context = playsContext();
  const of = context.battedDataOf;
  assert.deepEqual(JSON.parse(JSON.stringify(of({ speed: 168.4, launch: 28.2, dist: 119.6 }))), { speed: 168, launch: 28, dist: 120, barrel: true });
  // バレルの境界: 速度160ちょうど・角度18/36ちょうどはバレル、1つでも外すと非バレル
  assert.equal(of({ speed: 160, launch: 18, dist: 100 }).barrel, true);
  assert.equal(of({ speed: 160, launch: 36, dist: 100 }).barrel, true);
  assert.equal(of({ speed: 159, launch: 24, dist: 100 }).barrel, false);
  assert.equal(of({ speed: 170, launch: 17, dist: 100 }).barrel, false);
  assert.equal(of({ speed: 170, launch: 37, dist: 100 }).barrel, false);
});

test('battedDataOf returns null when the physics numbers are missing (fouls, takes, table mode)', () => {
  const context = playsContext();
  assert.equal(context.battedDataOf(null), null);
  assert.equal(context.battedDataOf({ angle: 55 }), null);
  assert.equal(context.battedDataOf({ speed: 150 }), null);
  assert.equal(context.battedDataOf({ speed: NaN, launch: 20, dist: 90 }), null);
});

test('battedDataOf drops the distance for grounders even if one is present', () => {
  const context = playsContext();
  assert.deepEqual(JSON.parse(JSON.stringify(context.battedDataOf({ speed: 131.6, launch: -4.2, dist: 42 }, true))), { speed: 132, launch: -4, dist: null, barrel: false });
  assert.equal(context.battedDataOf({ speed: 150, launch: 10, dist: null }).dist, null);
});

test('battedLine formats the shared line, omitting the distance when absent', () => {
  const context = playsContext();
  assert.equal(context.battedLine({ speed: 152, launch: 24, dist: 98 }), '打球 152km/h / 角度 24° / 推定飛距離 98m');
  assert.equal(context.battedLine({ speed: 132, launch: -4, dist: null }), '打球 132km/h / 角度 -4°');
});

test('result stashes batted data for the next flight only on in-play kinds', () => {
  const context = playsContext();
  const pending = () => JSON.parse(JSON.stringify(vm.runInContext('battedPending', context)));
  context.result('HR', 10, { speed: 168.4, launch: 28.2, dist: 119.6, dir: 'center' });
  assert.deepEqual(pending(), { speed: 168, launch: 28, dist: 120, barrel: true });
  context.result('gr', 10, { speed: 131.6, launch: -4.2, dist: null });
  assert.deepEqual(pending(), { speed: 132, launch: -4, dist: null, barrel: false });
  context.result('foul', 10, { angle: 55 });
  assert.equal(pending(), null);
  context.result('ball');
  assert.equal(pending(), null);
});

test('flight consumes the pending data, shows the card, and attaches bd for snapshots', () => {
  const context = playsContext();
  context.result('HR', 10, { speed: 168.4, launch: 28.2, dist: 119.6, dir: 'center' });
  let cbCalled = false;
  context.flight({ x: 240, y: 100 }, 'fly', () => { cbCalled = true; });
  assert.deepEqual(JSON.parse(JSON.stringify(context.G.fl.bd)), { speed: 168, launch: 28, dist: 120, barrel: true });
  assert.equal(vm.runInContext('battedPending', context), null);
  const card = context.__elements.get('bcard');
  assert.equal(card.classList.contains('on'), true);
  assert.match(card.innerHTML, /打球 168/);
  assert.match(card.innerHTML, /バレル/);
  // 飛行終了 (dur+250) でカードが消え、コールバックも呼ばれる
  context.__later.at(-1)[1]();
  assert.equal(card.classList.contains('on'), false);
  assert.equal(cbCalled, true);
});

test('with the toggle off, flight keeps bd for snapshots but never shows the card', () => {
  const context = playsContext();
  vm.runInContext('BATTED_EXP.enabled = false', context);
  context.result('HR', 10, { speed: 168.4, launch: 28.2, dist: 119.6, dir: 'center' });
  context.flight({ x: 240, y: 100 }, 'fly', () => {});
  assert.deepEqual(JSON.parse(JSON.stringify(context.G.fl.bd)), { speed: 168, launch: 28, dist: 120, barrel: true });
  const card = context.__elements.get('bcard');
  assert.ok(!card || !card.classList.contains('on'), 'card must stay hidden while the toggle is off');
});

test('the toggle button flips BATTED_EXP.enabled and repaints its label', () => {
  const context = playsContext();
  const btn = context.__elements.get('exp-batted');
  assert.equal(btn.textContent, '打球データ ON');
  btn.listeners.click();
  assert.equal(vm.runInContext('BATTED_EXP.enabled', context), false);
  assert.equal(btn.textContent, '打球データ OFF');
  btn.listeners.click();
  assert.equal(vm.runInContext('BATTED_EXP.enabled', context), true);
});

test('showDetailMsg appends the batted line (and バレル) only when enabled and numbers exist', () => {
  const context = playsContext();
  context.showDetailMsg('HR', null, { speed: 170, launch: 30, dist: 125, dir: 'center' });
  assert.match(context.__msgs.at(-1), /打球 170km\/h \/ 角度 30° \/ 推定飛距離 125m/);
  assert.match(context.__msgs.at(-1), /バレル/);
  context.showDetailMsg('gr', null, { speed: 120, launch: -6, dist: 88 });
  assert.match(context.__msgs.at(-1), /打球 120km\/h \/ 角度 -6°/);
  assert.doesNotMatch(context.__msgs.at(-1), /推定飛距離/);
  context.showDetailMsg('foul', null, { angle: 50 });
  assert.doesNotMatch(context.__msgs.at(-1), /打球/);
  vm.runInContext('BATTED_EXP.enabled = false', context);
  context.showDetailMsg('HR', null, { speed: 170, launch: 30, dist: 125, dir: 'center' });
  assert.doesNotMatch(context.__msgs.at(-1), /打球/);
});

// --- オンライン: スナップショットの f.bd ---

function makeDocument() {
  const elements = new Map();
  const element = () => {
    const classes = new Set();
    return {
      style: {}, textContent: '', innerHTML: '', className: '', value: '', disabled: false,
      classList: {
        add: (c) => classes.add(c), remove: (c) => classes.delete(c),
        toggle: (c, f) => { if (f === undefined ? !classes.has(c) : f) classes.add(c); else classes.delete(c); },
        contains: (c) => classes.has(c)
      },
      appendChild() {}, replaceChildren() {}, getContext: () => ({})
    };
  };
  return {
    getElementById: (id) => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement: () => element(),
    querySelectorAll: () => [],
    __elements: elements
  };
}

function snapContext(withPlays) {
  const document = makeDocument();
  const channel = { on() { return this; }, subscribe(cb) { return this; }, async track() {}, async untrack() {}, send: () => Promise.resolve('ok'), presenceState: () => ({}) };
  const fakeSupabase = { createClient: () => ({ channel: () => channel, removeChannel() {} }) };
  const context = {
    document, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    performance: { now: () => 0 },
    window: { supabase: fakeSupabase }, supabase: fakeSupabase
  };
  vm.createContext(context);
  const files = withPlays ? ['config.js', 'core.js', 'plays.js', 'net.js'] : ['config.js', 'core.js', 'net.js'];
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext('banner = () => {}; updateHud = () => {}; over = () => {};', context);
  context.__document = document;
  return context;
}

function snapFixture(f) {
  return {
    gid: 12345, seq: 1, hostTeam: 0, inn: 2, top: false, outs: 1,
    cnt: { b: 1, s: 2 }, bases: [0, 1, 0, 1], runs: [[1, 0], [2]], hits: [3, 4],
    pts: [10, 20], N: 3, ph: 'busy', bid: 0, bt: null, wo: false, m: 'テスト',
    sw: null, pitcherHands: [1, -1], batterSides: ['right', 'left'],
    p: null, f, mv: null, th: null, rl: null, cur: null
  };
}

test('snap carries bd and validSnap accepts it, rejects malformed bd', () => {
  const context = snapContext(false);
  vm.runInContext(`
    G.net = 'host'; G.gid = 12345; G.me = 0; G.phase = 'busy'; G.swingT = -1e9;
    G.seq = 0; G.inn = 2; G.top = false; G.outs = 1; G.cnt = { b: 1, s: 2 };
    G.bases = [0, 1, 0, 1]; G.runs = [[1, 0], [2]]; G.hits = [3, 4]; G.pts = [10, 20]; G.N = 3;
    G.bid = 0; G.walkoff = false; G.pitcherHands = [1, -1]; G.batterSides = ['right', 'left'];
    G.pitch = null; G.mv = null; G.th = null; G.rl = null;
    G.fl = { id: 7, out: true, fi: 7, ri: undefined, wall: undefined, isHit: true, to: { x: 240, y: 120 }, kind: 'fly', dur: 1300, h: 100, diving: undefined, sliding: undefined, finePlay: undefined, groundPlay: undefined, bd: { speed: 168, launch: 28, dist: 120, barrel: true }, t0: 0 };
  `, context);
  const snap = vm.runInContext('snap()', context);
  assert.deepEqual(JSON.parse(JSON.stringify(snap.f.bd)), { speed: 168, launch: 28, dist: 120, barrel: true });
  assert.equal(context.validSnap(snap), true);
  const bad = JSON.parse(JSON.stringify(snap));
  bad.f.bd = { speed: 'fast', launch: 28, dist: 120, barrel: true };
  assert.equal(context.validSnap(bad), false);
  const noDist = JSON.parse(JSON.stringify(snap));
  noDist.f.bd = { speed: 132, launch: -4, dist: null, barrel: false };
  assert.equal(context.validSnap(noDist), true);
});

test('applySnap shows the batted card on a spectator client from f.bd', () => {
  const context = snapContext(true);
  vm.runInContext("G.net = 'spec'; G.gid = null; G.seq = 0; G.me = undefined;", context);
  const f = { id: 7, out: true, fi: 7, to: { x: 240, y: 120 }, kind: 'fly', dur: 1300, h: 100, bd: { speed: 168, launch: 28, dist: 120, barrel: true }, age: 100 };
  context.applySnap(snapFixture(f));
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('G.fl.bd', context))), { speed: 168, launch: 28, dist: 120, barrel: true });
  const card = context.__document.__elements.get('bcard');
  assert.equal(card.classList.contains('on'), true);
  assert.match(card.innerHTML, /打球 168/);
  // 次のスナップショットで打球が消えたらカードも消える
  const next = snapFixture(null);
  next.seq = 2;
  context.applySnap(next);
  assert.equal(card.classList.contains('on'), false);
});
