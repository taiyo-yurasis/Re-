const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function learnContext() {
  const element = () => ({
    style: {}, textContent: '', innerHTML: '', className: '', value: '',
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {}, replaceChildren() {}, getContext: () => ({})
  });
  const elements = new Map();
  const context = {
    document: {
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, element());
        return elements.get(id);
      },
      createElement: () => element()
    },
    setTimeout, clearTimeout,
    performance: { now: () => 0 },
    result() {}, take() {}
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'pitching.js', 'batting.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('learnFromPitch records the human batter tendencies while the CPU pitches', () => {
  const context = learnContext();
  // top=false + humanTeam=1: team 0 (CPU) pitches to the human (team 1)
  vm.runInContext("G.net=null;G.pvp=false;G.prac=null;G.top=false;G.humanTeam=1;G.batterSides=['right','right'];", context);
  const learn = vm.runInContext('learnFromPitch', context);
  context.__p = { type: 'c', x: 180, y: 110, sg: 1, dur: 1500 }; // dist 2: clearly outside
  vm.runInContext('G.pitch=__p;', context);
  learn('miss');
  learn('miss');
  context.__p = { type: 's', x: 160, y: 110, sg: 1, dur: 930 }; // dist 1: edge of the zone
  vm.runInContext('G.pitch=__p;', context);
  learn('look');
  const bat = vm.runInContext('G.learn.bat', context);
  assert.equal(bat.n, 3);
  assert.equal(bat.byType.c.swing, 2);
  assert.equal(bat.byType.c.whiff, 2);
  assert.equal(bat.chase.thrown, 2);
  assert.equal(bat.chase.swung, 2);
  assert.equal(bat.freeze.thrown, 1);
  assert.equal(bat.freeze.took, 1);
  assert.equal(bat.byType.s.took, 1);
});

test('learnFromPitch records the human pitcher tendencies while the CPU bats', () => {
  const context = learnContext();
  // top=false + humanTeam=0: the human (team 0) pitches to the CPU (team 1)
  vm.runInContext("G.net=null;G.pvp=false;G.prac=null;G.top=false;G.humanTeam=0;G.batterSides=['right','right'];", context);
  const learn = vm.runInContext('learnFromPitch', context);
  context.__p = { type: 's', x: 176, y: 110, sg: 1, dur: 930 }; // outside course for a righty
  vm.runInContext('G.pitch=__p;', context);
  learn('fly');
  context.__p = { type: 'c', x: 50, y: 110, sg: 1, dur: 1500 }; // inside course
  vm.runInContext('G.pitch=__p;', context);
  learn('1B');
  const pit = vm.runInContext('G.learn.pit', context);
  assert.equal(pit.n, 2);
  assert.equal(pit.byType.s, 1);
  assert.equal(pit.byType.c, 1);
  assert.equal(pit.byArea.out, 1);
  assert.equal(pit.byArea.in, 1);
});

test('cpuPlanPitch leans into the pitch the batter whiffs on (Lv4, after enough samples)', () => {
  const context = learnContext();
  vm.runInContext('G.cnt={b:0,s:0};G.prevPitch=null;', context);
  const plan = vm.runInContext('cpuPlanPitch', context);
  const setLearn = (n, byType) => {
    context.__l = { bat: { n, byType, chase: { thrown: 0, swung: 0 }, freeze: { thrown: 0, took: 0 } }, pit: { n: 0, byType: {}, byArea: {} } };
    vm.runInContext('G.learn=__l;', context);
  };
  const share = (lv, type, N = 6000) => {
    let c = 0;
    for (let i = 0; i < N; i++) if (plan(lv).type === type) c++;
    return c / N;
  };
  setLearn(0, {});
  const base = share(4, 'c');
  assert.ok(base > 0.06 && base < 0.12, `baseline curve share ${base.toFixed(2)} should match the table (~9%)`);
  setLearn(5, { c: { n: 5, swing: 5, whiff: 5, tb: 0, took: 0 } });
  const early = share(4, 'c');
  assert.ok(early < 0.13, `learning should not kick in before 10 pitches, got ${early.toFixed(2)}`);
  setLearn(30, { c: { n: 20, swing: 20, whiff: 16, tb: 0, took: 0 } });
  const lv4 = share(4, 'c');
  const lv2 = share(2, 'c');
  assert.ok(lv4 > 0.11, `Lv4 should lean into the whiffed curve, got ${lv4.toFixed(2)}`);
  assert.ok(lv2 < 0.11, `Lv2 has no learning, got ${lv2.toFixed(2)}`);
});

test('cpuBatRead tightens on the pitcher favorite pitch and loosens on rare ones', () => {
  const context = learnContext();
  vm.runInContext("cfgCpuDifficulty=4;G.top=true;G.batterSides=['right','right'];", context);
  context.__l = {
    bat: { n: 0, byType: {}, chase: { thrown: 0, swung: 0 }, freeze: { thrown: 0, took: 0 } },
    pit: { n: 40, byType: { s: 20, c: 5, sl: 5, f: 5, sh: 5 }, byArea: { in: 13, mid: 14, out: 13 } }
  };
  vm.runInContext('G.learn=__l;', context);
  const read = vm.runInContext('cpuBatRead', context);
  const fav = read({ type: 's', x: 110, y: 110, sg: 1, dur: 930 });
  assert.ok(fav.timing >= 0.6 && fav.timing <= 0.66, `favorite pitch timing factor ${fav.timing} should be tightened`);
  assert.ok(fav.chase < 0.85, `favorite pitch chase factor ${fav.chase} should lay off balls`);
  const rare = read({ type: 'ss', x: 110, y: 110, sg: 1, dur: 3000 });
  assert.ok(rare.timing > 1.05, `rare pitch timing factor ${rare.timing} should be loosened`);
  vm.runInContext('cfgCpuDifficulty=2;', context);
  const off = read({ type: 's', x: 110, y: 110, sg: 1, dur: 930 });
  assert.deepEqual({ ...off }, { timing: 1, pos: 1, chase: 1 });
});
