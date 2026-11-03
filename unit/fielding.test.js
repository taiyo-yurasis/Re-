const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function createFieldingContext() {
  const context = {
    console,
    document: { getElementById: () => ({ getContext: () => ({}) }) }
  };
  vm.createContext(context);
  for (const file of ['config.js', 'core.js', 'fielding.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}
const ctx = createFieldingContext();
const resolve = (info) => vm.runInContext('resolveBattedBall', ctx)(info);

test('遅いゴロは遊撃手が処理してアウトになる', () => {
  const r = resolve({ speed: 105, launch: -3, angle: -14 });
  assert.equal(r.k, 'gr');
  assert.equal(r.forceSafe, undefined);
  assert.equal(r.fi, 4); // 遊撃手
});

test('一・二塁間を抜けた速いゴロはライトへの単打 (二塁打にはならない)', () => {
  const r = resolve({ speed: 175, launch: -3, angle: 27 });
  assert.equal(r.k, '1B');
  assert.equal(r.fi, 8); // ライトが回収
});

test('真ん中の速いゴロはセンターへ抜ける単打になりうる', () => {
  const r = resolve({ speed: 190, launch: -3, angle: 4 });
  assert.equal(r.k, '1B');
  assert.equal(r.fi, 7);
});

test('ライト前の浅いフライは二塁手ではなくライトが捕る', () => {
  const r = resolve({ speed: 135, launch: 24, angle: 30, dist: 62 });
  assert.equal(r.k, 'fly');
  assert.equal(r.fi, 8);
});

test('センター深いフライはセンターが捕る', () => {
  const r = resolve({ speed: 160, launch: 30, angle: 0, dist: 95 });
  assert.equal(r.k, 'fly');
  assert.equal(r.fi, 7);
});

test('十分な飛距離と高度があればホームラン', () => {
  const r = resolve({ speed: 185, launch: 30, angle: 0, dist: 125 });
  assert.equal(r.k, 'HR');
});

test('フェンス際でも高度が足りない打球は直撃の二塁打になる', () => {
  const r = resolve({ speed: 150, launch: 22, angle: 15, dist: 111 });
  assert.equal(r.k, '2B');
  assert.equal(r.wall, true);
});

test('一塁手・三塁手の定位置はフェア地域 (ファウルラインの内側) にある', () => {
  const FD = vm.runInContext('FD', ctx);
  const HP = vm.runInContext('HP', ctx);
  // ライン方向ベクトルと、野手・センター方向の外積の符号が一致すればフェア側
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  const cf = { x: FD[7][0] - HP.x, y: FD[7][1] - HP.y };
  for (const [fi, base] of [[2, { x: 311, y: 304 }], [5, { x: 169, y: 304 }]]) {
    const line = { x: base.x - HP.x, y: base.y - HP.y };
    const f = { x: FD[fi][0] - HP.x, y: FD[fi][1] - HP.y };
    assert.equal(Math.sign(cross(line.x, line.y, f.x, f.y)), Math.sign(cross(line.x, line.y, cf.x, cf.y)),
      `fielder ${fi} must be on the fair side`);
  }
});

test('情報が欠けた打球は判定せず null を返す (従来経路に任せる)', () => {
  assert.equal(resolve(null), null);
  assert.equal(resolve({ speed: 150 }), null);
});
