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
