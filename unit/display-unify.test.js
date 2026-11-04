const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const element = () => ({
  style: {}, textContent: '', innerHTML: '', className: '', value: '',
  classList: { add() {}, remove() {}, toggle() {} },
  appendChild() {}, replaceChildren() {}, getContext: () => ({})
});

function baseContext(extraFiles, stubs = {}) {
  const elements = new Map();
  const context = {
    console,
    document: {
      getElementById: (id) => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
      createElement: () => element(),
      querySelector: () => element(),
      addEventListener() {}
    },
    setTimeout, clearTimeout,
    performance: { now: () => 0 },
    ...stubs
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', ...extraFiles]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('フェンスの物差しは1つ: FENCE_PX = HR下限110m × flyPxPerM', () => {
  const ctx = baseContext(['fielding.js']);
  const FENCE_PX = vm.runInContext('FENCE_PX', ctx);
  const CONFIG = vm.runInContext('CONFIG', ctx);
  assert.equal(FENCE_PX, 341);
  assert.equal(FENCE_PX, CONFIG.phys.hrMin * CONFIG.flyPxPerM);
  // 3D の fenceRadius も全方向で同じ値 (流線型の廃止)
  const r3d = fs.readFileSync(path.join(root, 'render3d.js'), 'utf8');
  assert.match(r3d, /function fenceRadius\(a\)\{return FENCE_PX\}/);
  // 2D 背景の柵弧も FENCE_PX
  const r2d = fs.readFileSync(path.join(root, 'render.js'), 'utf8');
  assert.match(r2d, /arc\(240,375,FENCE_PX,-\.75\*P,-\.25\*P\)/);
});

test('到達判定は表示プロファイル (hangMs/dispMs/apexM/fenceH) を返す', () => {
  const ctx = baseContext(['fielding.js']);
  const resolve = vm.runInContext('resolveBattedBall', ctx);
  const CONFIG = vm.runInContext('CONFIG', ctx);
  const HP = vm.runInContext('HP', ctx);
  const FENCE_PX = vm.runInContext('FENCE_PX', ctx);
  const HEIGHT_PX_PER_M = vm.runInContext('HEIGHT_PX_PER_M', ctx);

  // 壁直撃: 表示の終端高度がフェンス面高度 (判定値) と一致し、フェンス高さ未満
  const wall = resolve({ speed: 150, launch: 22, angle: 15, dist: 111 });
  assert.equal(wall.wall, true);
  assert.ok(wall.fenceH < CONFIG.fielding.fenceHeightM, `fenceH ${wall.fenceH}`);
  const landPx = Math.hypot(wall.to.x - HP.x, wall.to.y - HP.y);
  assert.ok(Math.abs(landPx - (FENCE_PX - 4)) < 0.6, `wall landing ${landPx}`);
  assert.ok(wall.dispMs < wall.hangMs, 'wall display ends at the fence, before full hang');
  const dispHeightM = wall.apexM * 4 * wall.hRatio * (1 - wall.hRatio);
  assert.ok(Math.abs(dispHeightM - wall.fenceH) < 0.05, `display height at fence ${dispHeightM} vs judged ${wall.fenceH}`);

  // HR: フェンス面高度がフェンス高さ以上で、表示時間はフェンス到達まで
  const hr = resolve({ speed: 185, launch: 30, angle: 0, dist: 125 });
  assert.equal(hr.k, 'HR');
  assert.ok(hr.fenceH >= CONFIG.fielding.fenceHeightM);
  assert.ok(hr.dispMs > 0 && hr.dispMs < hr.hangMs);

  // 通常のフライ捕球: 表示時間 = 判定の滞空そのもの
  const caught = resolve({ speed: 160, launch: 30, angle: 0, dist: 95 });
  assert.equal(caught.k, 'fly');
  assert.equal(caught.dispMs, caught.hangMs);
  assert.equal(caught.hRatio, 1);
  assert.ok(caught.apexM > 0);

  // ゴロ: 表示時間はボールの到達時刻 (ballTimeAt) 由来で有限・正
  const ground = resolve({ speed: 105, launch: -3, angle: -14 });
  assert.equal(ground.k, 'gr');
  assert.ok(Number.isFinite(ground.dispMs) && ground.dispMs > 0);
  assert.ok(HEIGHT_PX_PER_M > 0);
});

test('flight() は play の表示プロファイル (dur/h/hRatio) をそのまま受ける', () => {
  const ctx = baseContext(['fielding.js', 'plays.js'], {
    sync() {}, banner() {}, setMsg() {}, updateHud() {}
  });
  const resolve = vm.runInContext('resolveBattedBall', ctx);
  const play = resolve({ speed: 150, launch: 22, angle: 15, dist: 111 });
  const disp = vm.runInContext('dispFromPlay', ctx)(play);
  assert.equal(disp.dur, Math.round(play.dispMs));
  assert.equal(disp.h, Math.round(play.apexM * 7));
  assert.equal(disp.hRatio, play.hRatio);
  vm.runInContext('G.fl=null', ctx);
  ctx.__to = play.to; ctx.__disp = disp;
  vm.runInContext('flight(__to,"fly",()=>{},0,__disp)', ctx);
  const fl = vm.runInContext('G.fl', ctx);
  assert.equal(fl.dur, disp.dur);
  assert.equal(fl.h, disp.h);
  assert.equal(fl.hRatio, disp.hRatio);
});

test('ファインプレー率は約10〜15% (finePlayRatio の実測)', () => {
  // tuner と同じ入力生成で、解決済み飛球アウトに占める finePlay の割合を測る
  function mulberry32(seed) { return function () { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function normal(rng, sd) { const u = Math.max(1e-12, rng()), v = rng(); return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  let rng = mulberry32(20261023);
  const ctx = baseContext(['pitching.js', 'batting.js', 'fielding.js'], { __random: () => rng() });
  vm.runInContext('Math.random=()=>__random(); G.batterSides=["right","right"]; G.top=true; CONFIG.batMode="physics";', ctx);
  const TY = vm.runInContext('TY', ctx);
  const resolve = vm.runInContext('resolveBattedBall', ctx);
  const types = ['s', 'sl', 'c', 'f', 'sh', 'cu', 'ct', 'ss'];
  const inputRng = mulberry32(20261023 ^ 0x5f3759df);
  const N = 12000;
  const pitches = Array.from({ length: N }, (_, i) => {
    const type = types[i % types.length];
    return { type, x: 44 + inputRng() * 132, y: 44 + inputRng() * 132, ms: normal(inputRng, 60), ex: normal(inputRng, 9), ey: normal(inputRng, 9) };
  });
  rng = mulberry32(20261023 ^ 0x13579bdf);
  let flyOut = 0, fine = 0;
  for (const inp of pitches) {
    const p = { type: inp.type, x: inp.x, y: inp.y, sg: 1, dur: TY[inp.type].d };
    const cx = Math.max(0, Math.min(220, inp.x + inp.ex)), cy = Math.max(0, Math.min(220, inp.y + inp.ey));
    const r = ctx.batResult(p, inp.ms, cx, cy);
    if (!['gr', 'fly', '1B', '2B', '3B', 'HR'].includes(r.k)) continue;
    const play = resolve(r);
    if (play && play.k === 'fly') { flyOut++; if (play.finePlay) fine++; }
  }
  const rate = fine / flyOut;
  assert.ok(flyOut > 1000, `flyOut sample ${flyOut}`);
  assert.ok(rate >= 0.08 && rate <= 0.17, `fine play rate ${(rate * 100).toFixed(1)}% must be near 10-15%`);
});

test('練習モードも到達判定を通し、結果種別・着地点・表示を引き継ぐ', () => {
  const captured = { flights: [] };
  const ctx = baseContext(['pitching.js', 'batting.js', 'fielding.js', 'plays.js', 'practice.js'], {
    banner() {}, setMsg() {}, updateHud() {}, ready() {}
  });
  // plays.js の flight 宣言を、捕捉用スタブで差し替える (result-dispatch.test と同じ手法)
  ctx.flight = (to, kind, cb, out, o) => { captured.flights.push({ to, kind, out, o }); };
  vm.runInContext("G.top=true;G.batterSides=['right','right'];G.prac=pracStats();G.cur={x:110,y:110};G.pitch={type:'s',x:110,y:110,sg:1,dur:930};", ctx);
  const resolve = vm.runInContext('resolveBattedBall', ctx);

  // 物理モデルが '1B' と言っても、到達判定で捕球される浅いフライはフライアウトに集計される
  const flyInfo = { speed: 135, launch: 24, angle: 30, dist: 62, tier: 'normal', tier0: 'normal', dir: 'pull', course: 'in' };
  const flyPlay = resolve(flyInfo);
  assert.equal(flyPlay.k, 'fly');
  ctx.__info = flyInfo;
  vm.runInContext("pracResult('1B', 0, __info);", ctx);
  const S = vm.runInContext('G.prac', ctx);
  assert.equal(S.res.fly, 1);
  assert.equal(S.res['1B'], 0);
  assert.equal(captured.flights.length, 1);
  const f1 = captured.flights[0];
  assert.equal(f1.kind, 'fly');
  assert.equal(f1.out, 1);
  assert.ok(Math.abs(f1.to.x - flyPlay.to.x) < 0.01 && Math.abs(f1.to.y - flyPlay.to.y) < 0.01);
  assert.equal(f1.o.dur, Math.round(flyPlay.dispMs));
  assert.equal(f1.o.fi, flyPlay.fi);

  // 抜けたゴロは単打に集計され、着地点と表示時間を引き継ぐ
  captured.flights.length = 0;
  const grInfo = { speed: 190, launch: -3, angle: 4, tier: 'normal', tier0: 'normal', dir: 'center', course: 'mid' };
  const grPlay = resolve(grInfo);
  assert.equal(grPlay.k, '1B');
  assert.equal(grPlay.ground, true);
  ctx.__info = grInfo;
  vm.runInContext("pracResult('gr', 0, __info);", ctx);
  const S2 = vm.runInContext('G.prac', ctx);
  assert.equal(S2.res['1B'], 1);
  assert.equal(S2.res.gr, 0);
  const f2 = captured.flights[0];
  assert.equal(f2.kind, 'ground');
  assert.equal(f2.out, 0);
  assert.ok(Math.abs(f2.to.x - grPlay.to.x) < 0.01 && Math.abs(f2.to.y - grPlay.to.y) < 0.01);
  assert.equal(f2.o.dur, Math.round(grPlay.dispMs));
});

test('resultFly の犠飛判定はファインプレーと切り離されている', () => {
  const plays = fs.readFileSync(path.join(root, 'plays.js'), 'utf8');
  assert.ok(!plays.includes('G.outs<3&&!isFinePlay'), 'sac fly must not be gated by isFinePlay');
  assert.match(plays, /if\(G\.outs<3\)\{/);
});
