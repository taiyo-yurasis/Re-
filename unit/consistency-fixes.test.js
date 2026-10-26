const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadContext(files, extra = {}) {
  const context = {
    document: { getElementById: () => ({ getContext: () => ({}) }) },
    performance: { now: () => 1000 },
    sync: () => {},
    setMsg: () => {},
    ...extra
  };
  vm.createContext(context);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

/* ---- ③ pitch duration: only CPU pitchers get randomized duration ---- */

function pitchDur(context, setup) {
  vm.runInContext(setup, context);
  vm.runInContext("Math.random = () => 0; throwP('s', 110, 110);", context);
  return vm.runInContext('G.pitch.dur', context);
}

test('CPU pitcher keeps the randomized pitch duration', () => {
  const context = loadContext(['config.js', 'core.js', 'pitching.js']);
  const base = vm.runInContext("TY['s'].d", context);
  // top=true -> team 1 pitches; humanTeam=0 -> CPU pitcher. rnd(.9,1.1) with random=0 -> x0.9
  const dur = pitchDur(context, 'G.net=null; G.pvp=false; G.humanTeam=0; G.top=true;');
  assert.equal(dur, base * 0.9);
});

test('human pitcher duration is exact in a CPU game and in local PvP', () => {
  const cpuGame = loadContext(['config.js', 'core.js', 'pitching.js']);
  const base = vm.runInContext("TY['s'].d", cpuGame);
  assert.equal(pitchDur(cpuGame, 'G.net=null; G.pvp=false; G.humanTeam=0; G.top=false;'), base);
  const pvp = loadContext(['config.js', 'core.js', 'pitching.js']);
  assert.equal(pitchDur(pvp, 'G.net=null; G.pvp=true; G.humanTeam=0; G.top=true;'), base);
});

test('online pitches are exact for both host and guest pitchers', () => {
  const guestPitching = loadContext(['config.js', 'core.js', 'pitching.js']);
  const base = vm.runInContext("TY['s'].d", guestPitching);
  // host (me=0) processes the guest's (team 1) pitch: previously randomized, now exact
  assert.equal(pitchDur(guestPitching, "G.net='host'; G.me=0; G.top=true;"), base);
  const hostPitching = loadContext(['config.js', 'core.js', 'pitching.js']);
  assert.equal(pitchDur(hostPitching, "G.net='host'; G.me=0; G.top=false;"), base);
});

/* ---- ④ effective timing offset (course ideal) shared by judge and displays ---- */

function battingContext() {
  const context = loadContext(['config.js', 'core.js', 'pitching.js', 'batting.js']);
  vm.runInContext("G.batterSides=['right','right']; G.top=true; Math.random=()=>0.5;", context);
  return context;
}

test('effMs subtracts the course ideal in physics mode only', () => {
  const context = battingContext();
  const eff = (x, ms) => {
    context.__p = { type: 's', x, y: 110, sg: 1, dur: 930 };
    context.__ms = ms;
    return vm.runInContext('effMs(__p, __ms)', context);
  };
  assert.equal(eff(176, 40), 0);   // outside: +40ms late is ideal
  assert.equal(eff(176, 0), -40);
  assert.equal(eff(44, -40), 0);   // inside: -40ms early is ideal
  assert.equal(eff(110, 10), 10);  // middle: no adjustment
  vm.runInContext("CONFIG.batMode='table';", context);
  assert.equal(eff(176, 25), 25);  // table mode judges raw ms, so displays keep raw ms
});

/* ---- ⑤ CPU batter centers its timing error on the course ideal ---- */

function cpuSwingMs(pitchX) {
  const captured = {};
  const context = loadContext(['config.js', 'core.js', 'pitching.js', 'batting.js'], {
    result: (k, ms, r) => { captured.ms = ms; },
    take: () => { captured.took = true; }
  });
  vm.runInContext("G.batterSides=['right','right']; G.top=true; G.cnt={b:0,s:0}; G.last=null; cfgCpuDifficulty=4; Math.random=()=>0.5;", context);
  context.__p = { type: 's', x: pitchX, y: 110, sg: 1, dur: 930, t: 1 };
  vm.runInContext('G.pitch=__p; cpuBat();', context);
  return captured.ms;
}

test('CPU batter timing error is centered on the course ideal', () => {
  const middle = cpuSwingMs(110);
  const outside = cpuSwingMs(176);
  assert.ok(Number.isFinite(middle) && Number.isFinite(outside));
  assert.equal(outside - middle, 40); // courseIdealMs at courseN=1
});

/* ---- ⑥ ground balls report no estimated distance ---- */

test('physics grounder has dist=null while a fly ball keeps a numeric distance', () => {
  const context = battingContext();
  const swing = (cy) => {
    context.__p = { type: 's', x: 110, y: 110, sg: 1, dur: 930 };
    context.__cy = cy;
    return vm.runInContext('batResultPhysics(__p, 0, 110, __cy)', context);
  };
  const grounder = swing(95); // cursor well above the ball -> ground ball
  assert.equal(grounder.k, 'gr');
  assert.equal(grounder.dist, null);
  const fly = swing(125); // cursor below the ball -> fly ball with a distance
  assert.ok(Number.isFinite(fly.dist) && fly.dist > 0);
});
