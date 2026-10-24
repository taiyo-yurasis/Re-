const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const sources = ['config.js', 'core.js', 'pitching.js', 'batting.js'];

function createContext(){
  const context = {
    document: {
      getElementById: () => ({ getContext: () => ({}) })
    }
  };
  vm.createContext(context);
  for(const file of sources){
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename:file });
  }
  vm.runInContext("G.batterSides=['right','right']; G.top=true; Math.random=()=>0.5;", context);
  return context;
}

function swing(context, {type='s', x=110, y=110, ms=0, cx=x, cy=y}={}){
  const dur = vm.runInContext('TY[' + JSON.stringify(type) + '].d', context);
  context.testPitch = {type, x, y, sg:1, dur};
  return vm.runInContext('batResult(testPitch, testMs, testX, testY)', Object.assign(context, {
    testMs: ms, testX: cx, testY: cy
  }));
}

test('physics direction uses inside/outside timing and mirrors the expected pull/oppo result', () => {
  const context = createContext();
  const inside = swing(context, {x:44, y:110, ms:-25, cx:44, cy:110});
  assert.equal(inside.dir, 'pull');
  assert.ok(inside.angle < 0);
  const outside = swing(context, {x:176, y:110, ms:25, cx:176, cy:110});
  assert.equal(outside.dir, 'oppo');
  assert.ok(outside.angle > 0);
});

test('swinging below the ball raises launch angle: under > center > above', () => {
  const context = createContext();
  const under = swing(context, {x:110, y:110, ms:0, cx:110, cy:114});
  const center = swing(context, {x:110, y:110, ms:0, cx:110, cy:110});
  const above = swing(context, {x:110, y:110, ms:0, cx:110, cy:106});
  assert.ok(under.launch > center.launch);
  assert.ok(center.launch > above.launch);
});

test('physics outcomes follow the configured distance thresholds', () => {
  const context = createContext();
  // Swinging under the ball lifts it into home-run range at the calibrated scale
  const homeRun = swing(context, {x:110, y:110, ms:0, cy:116});
  assert.equal(homeRun.k, 'HR');
  assert.ok(homeRun.dist >= vm.runInContext('CONFIG.phys.hrMin', context));

  // A dead-center liner carries to the outfield but stays inside hitMax
  const single = swing(context, {x:110, y:110, ms:0});
  assert.equal(single.k, '1B');
  assert.ok(single.dist >= vm.runInContext('CONFIG.phys.inField', context) && single.dist < vm.runInContext('CONFIG.phys.hitMax', context));

  vm.runInContext('CONFIG.phys.spdRange=30', context);
  const shortFly = swing(context, {x:110, y:110, ms:0});
  assert.equal(shortFly.k, 'fly');
  assert.ok(shortFly.dist < vm.runInContext('CONFIG.phys.inField', context));
});

test('angle drag keeps a steep popup from carrying like a fly ball', () => {
  const context = createContext();
  const popup = swing(context, {x:110, y:110, ms:0, cy:126});
  assert.ok(popup.launch >= 50);
  assert.equal(popup.k, 'fly');
  assert.ok(popup.dist < vm.runInContext('CONFIG.phys.inField', context));
});

test('deep flies in the extra-base zone can be caught at the warning track', () => {
  const caught = createContext();
  const deepFly = swing(caught, {x:110, y:110, ms:70, cy:115});
  assert.ok(deepFly.launch >= 25);
  assert.ok(deepFly.dist >= 80 && deepFly.dist < 110);
  assert.equal(deepFly.k, 'fly'); // Math.random()=0.5 < wtOut (0.65)

  const dropped = createContext();
  vm.runInContext('Math.random=()=>0.9;', dropped);
  const double = swing(dropped, {x:110, y:110, ms:100, cy:115});
  assert.ok(double.dist >= 80 && double.dist < 110);
  assert.equal(double.k, '2B');
});

test('table mode remains available and does not return physics-only speed fields', () => {
  const context = createContext();
  vm.runInContext("CONFIG.batMode='table'", context);
  const result = swing(context, {x:110, y:110, ms:0});
  assert.ok(['HR','3B','2B','1B','fly','gr','foul','miss'].includes(result.k));
  assert.equal(result.speed, undefined);
  assert.equal(result.launch, undefined);
});

test('out-of-window timing and a far cursor remain misses', () => {
  const context = createContext();
  const late = swing(context, {x:110, y:110, ms:221});
  assert.equal(late.k, 'miss');
  const far = swing(context, {x:110, y:110, ms:0, cx:130, cy:110});
  assert.equal(far.k, 'miss');
});
