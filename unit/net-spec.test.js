const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function makeDocument() {
  const elements = new Map();
  const element = () => ({
    style: {}, textContent: '', innerHTML: '', className: '', value: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, replaceChildren() {}, getContext: () => ({})
  });
  return {
    getElementById: (id) => {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: () => element(),
    querySelectorAll: () => []
  };
}

function fakeChannel() {
  const ch = {
    handlers: {}, presenceHandlers: [], _state: {}, tracked: null, _subCb: null,
    on(type, filter, fn) {
      if (type === 'broadcast') ch.handlers[filter.event] = fn;
      else if (type === 'presence') ch.presenceHandlers.push({ event: filter.event, fn });
      return ch;
    },
    subscribe(cb) { ch._subCb = cb; return ch; },
    async track(obj) { ch.tracked = obj; },
    async untrack() {},
    send() { return Promise.resolve('ok'); },
    presenceState() { return ch._state; },
    firePresence(event) { ch.presenceHandlers.filter(h => h.event === event).forEach(h => h.fn()); }
  };
  return ch;
}

function netContext() {
  const channel = fakeChannel();
  const fakeSupabase = { createClient: () => ({ channel: () => channel, removeChannel() {} }) };
  const context = {
    document: makeDocument(), setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    performance: { now: () => 0 },
    window: { supabase: fakeSupabase }, supabase: fakeSupabase,
    __channel: channel
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'net.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext(`
    banner = () => {};
    updateHud = () => {};
    over = () => {};
  `, context);
  return context;
}

function validSnap() {
  return {
    gid: 12345, seq: 1, hostTeam: 0, inn: 2, top: false, outs: 1,
    cnt: { b: 1, s: 2 }, bases: [0, 1, 0, 1], runs: [[1, 0], [2]], hits: [3, 4],
    pts: [10, 20], N: 3, ph: 'ready', bid: 0, bt: null, wo: false, m: 'テスト',
    sw: null, pitcherHands: [1, -1], batterSides: ['right', 'left'],
    p: null, f: null, mv: null, th: null, rl: null
  };
}

test('playersGone: only a missing player counts, spectators do not matter', () => {
  const context = netContext();
  const gone = vm.runInContext('playersGone', context);
  assert.equal(gone(['host', 'guest'], true), false);
  assert.equal(gone(['host', 'guest', 'spec'], true), false);
  assert.equal(gone(['host', 'spec'], true), true);  // guest left, spectator still there
  assert.equal(gone(['guest', 'spec'], true), true); // host left
  assert.equal(gone(['host'], false), false);        // players never gathered yet
  assert.equal(gone([], false), false);
});

test('applySnap: spectator receives the game state without becoming a player', () => {
  const context = netContext();
  vm.runInContext("G.net = 'spec'; G.gid = null; G.seq = 0; G.me = undefined;", context);
  context.applySnap(validSnap());
  assert.equal(vm.runInContext('G.inn', context), 2);
  assert.equal(vm.runInContext('G.outs', context), 1);
  assert.deepEqual(Array.from(vm.runInContext('G.bases', context)), [0, 1, 0, 1]);
  assert.equal(vm.runInContext('G.me === undefined', context), true);
  assert.equal(vm.runInContext('waitingRoom', context), false);
});

test('applySnap: guest still gets assigned the opposite team', () => {
  const context = netContext();
  vm.runInContext("G.net = 'guest'; G.gid = null; G.seq = 0; G.me = 1;", context);
  context.applySnap(validSnap()); // hostTeam 0 -> guest is team 1
  assert.equal(vm.runInContext('G.me', context), 1);
  assert.equal(vm.runInContext('G.inn', context), 2);
});

test('applySnap: ignored on the host client', () => {
  const context = netContext();
  vm.runInContext("G.net = 'host'; G.gid = null; G.seq = 0; G.inn = 1;", context);
  context.applySnap(validSnap());
  assert.equal(vm.runInContext('G.inn', context), 1);
});

function updateContext() {
  const context = {
    document: makeDocument(),
    setTimeout: () => { context.__timerCount++; return 1; },
    clearTimeout: () => {}, setInterval: () => 0, clearInterval: () => {},
    performance: { now: () => 0 },
    __timerCount: 0, __resultCalls: []
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'pitching.js', 'game.js', 'net.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext(`
    banner = () => {};
    updateHud = () => {};
    setMsg = () => {};
    result = (k) => { __resultCalls.push(k) };
  `, context);
  return context;
}

function stalePitchScenario(net, extra) {
  const context = updateContext();
  vm.runInContext(`
    G.net = ${net}; G.phase = 'pitch'; G.top = true; G.cnt = { b: 2, s: 1 };
    G.pitch = { id: 1, type: 's', x: 110, y: 110, dur: 900, t0: 0, sg: 1 };
    ${extra}
  `, context);
  context.update(5000); // 到達時刻を大きく過ぎた古い投球
  return context;
}

test('update: spectator never resolves a pitch locally (snapshots are authoritative)', () => {
  const context = stalePitchScenario("'spec'", 'G.pvp = true; G.me = undefined;');
  assert.equal(vm.runInContext('G.phase', context), 'pitch');
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('G.cnt', context))), { b: 2, s: 1 });
  assert.equal(context.__resultCalls.length, 0);
  assert.equal(context.__timerCount, 0);
  // ボール描画用の進行度は return より前に更新される
  assert.ok(vm.runInContext('G.pitch.t', context) > 5);
});

test('update: guest never resolves a pitch locally either', () => {
  const context = stalePitchScenario("'guest'", 'G.pvp = true; G.me = 1;');
  assert.equal(vm.runInContext('G.phase', context), 'pitch');
  assert.deepEqual(JSON.parse(JSON.stringify(vm.runInContext('G.cnt', context))), { b: 2, s: 1 });
  assert.equal(context.__resultCalls.length, 0);
  assert.equal(context.__timerCount, 0);
});

test('update: local CPU game still takes a timed-out pitch', () => {
  const context = stalePitchScenario('null', 'G.pvp = false; G.humanTeam = 0;');
  assert.equal(vm.runInContext('G.phase', context), 'busy');
  assert.deepEqual(context.__resultCalls, ['look']); // 真ん中の見逃しとして take() が走る
});

test('snap: carries the host cursor and a fresh relayed guest cursor for spectators', () => {
  const context = netContext();
  vm.runInContext(`
    G.net = 'host'; G.me = 0; G.gid = 1; G.inn = 1; G.top = true; G.outs = 0;
    G.cnt = { b: 0, s: 0 }; G.bases = [0, 0, 0, 0]; G.runs = [[0], [0]]; G.hits = [0, 0];
    G.pts = [0, 0]; G.N = 3; G.phase = 'aim'; G.bid = 0; G.bt = null; G.walkoff = false;
    G.swingT = 0; G.pitcherHands = [1, 1]; G.batterSides = ['right', 'right'];
    G.pitch = null; G.fl = null; G.mv = null; G.th = null; G.rl = null;
    G.cur = { x: 50, y: 60 }; G.sel = 'sl';
  `, context);
  const plain = (v) => JSON.parse(JSON.stringify(v));
  assert.deepEqual(plain(context.snap().cur), { '0': { x: 50, y: 60, type: 'sl' } });
  vm.runInContext("guestCur = { x: 10, y: 20, type: 's', at: 0 };", context); // performance.now() は 0 固定
  assert.deepEqual(plain(context.snap().cur), { '0': { x: 50, y: 60, type: 'sl' }, '1': { x: 10, y: 20, type: 's' } });
  vm.runInContext("guestCur = { x: 10, y: 20, type: 's', at: -2000 };", context); // 古いゲストカーソルは載せない
  assert.deepEqual(plain(context.snap().cur), { '0': { x: 50, y: 60, type: 'sl' } });
});

test('validSnap: cursor payload is shape-checked', () => {
  const context = netContext();
  const ok = { ...validSnap(), cur: { '0': { x: 10, y: 20, type: 's' }, '1': { x: 0, y: 220, type: null } } };
  assert.equal(context.validSnap(ok), true);
  assert.equal(context.validSnap({ ...validSnap(), cur: { '0': { x: 999, y: 20, type: 's' } } }), false);
  assert.equal(context.validSnap({ ...validSnap(), cur: { '1': { x: 10, y: 20, type: 'xx' } } }), false);
  assert.equal(context.validSnap({ ...validSnap(), cur: { '2': { x: 10, y: 20, type: 's' } } }), false);
});

test('applySnap: spectator accumulates cursor samples without duplicates', () => {
  const context = netContext();
  vm.runInContext("G.net = 'spec'; G.gid = null; G.seq = 0; G.me = undefined;", context);
  context.applySnap({ ...validSnap(), cur: { '0': { x: 10, y: 10, type: 's' } } });
  assert.equal(vm.runInContext('curSamples[0].length', context), 1);
  context.applySnap({ ...validSnap(), seq: 2, cur: { '0': { x: 30, y: 10, type: 's' } } });
  assert.equal(vm.runInContext('curSamples[0].length', context), 2);
  context.applySnap({ ...validSnap(), seq: 3, cur: { '0': { x: 30, y: 10, type: 's' } } });
  assert.equal(vm.runInContext('curSamples[0].length', context), 2);
});

test('curTick: guest sends its cursor only when it moves', () => {
  const context = netContext();
  context.__sent = [];
  vm.runInContext(`
    RM = { emit: (t, d) => { __sent.push([t, d]); return Promise.resolve() } };
    G.net = 'guest'; G.phase = 'aim'; G.cur = { x: 100, y: 100 }; G.sel = 's';
  `, context);
  context.curTick();
  assert.equal(context.__sent.length, 1);
  assert.equal(context.__sent[0][0], 'cur');
  context.curTick(); // 動いていなければ送らない
  assert.equal(context.__sent.length, 1);
  vm.runInContext('G.cur = { x: 150, y: 100 };', context);
  context.curTick();
  assert.equal(context.__sent.length, 2);
  vm.runInContext("G.phase = 'ready';", context);
  context.curTick(); // 対象フェーズ外では送らない
  assert.equal(context.__sent.length, 2);
});

test('joinRoom: presence roles drive spectator count and player-leave detection', async () => {
  const context = netContext();
  const ch = context.__channel;
  vm.runInContext("myRole = 'spec';", context);
  const joinPromise = vm.runInContext("sbRoom().join('ykTEST99')", context);
  await ch._subCb('SUBSCRIBED');
  const rm = await joinPromise;
  assert.equal(ch.tracked.role, 'spec'); // presence に役割を載せる

  let leaveCalls = 0, lastRoles = null;
  rm.onLeave(() => leaveCalls++);
  rm.onPresence((roles) => { lastRoles = roles; });

  ch._state = { a: [{ role: 'host' }], b: [{ role: 'guest' }], c: [{ role: 'spec' }] };
  ch.firePresence('sync');
  assert.deepEqual(Array.from(lastRoles).sort(), ['guest', 'host', 'spec']);

  // 観戦者が抜けても対戦者の切断にはならない
  delete ch._state.c;
  ch.firePresence('leave');
  assert.equal(leaveCalls, 0);

  // ゲストが抜けたら (観戦者が残っていても) 切断として通知される
  delete ch._state.b;
  ch.firePresence('leave');
  assert.equal(leaveCalls, 1);
});
