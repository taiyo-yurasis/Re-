/* config.js — 調整したい数値・設定はここ */
const SUPA_URL='https://mbgdtwyhtiymmdoxuxwb.supabase.co',SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZ2R0d3lodGl5bW1kb3h1eHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMjQyODAsImV4cCI6MjEwNzcwMDI4MH0.W0rPvhxlRIvM4GzUzdU9gU2IPD6A9Wz_teWX4TMkRZY';

/* ---- 球種(d: 到達までのms / j: 狙いのブレ幅px) ---- */
const TY={
 s:{d:930,j:8},
 sl:{d:1300,j:10},
 c:{d:1500,j:12},
 f:{d:1250,j:16},
 sh:{d:1200,j:10},
 cu:{d:1500,j:8},
 ct:{d:1020,j:9},
 ss:{d:3000,j:14}
};

const TY_NAMES = {
 s: 'ストレート',
 sl: 'スライダー',
 c: 'カーブ',
 f: 'フォーク',
 sh: 'ツーシーム',
 cu: 'チェンジアップ',
 ct: 'カットボール',
 ss: '超スローボール'
};

/* ---- CPU難易度(1=初心者〜4=最強) ---- */
const CPU_DIFFICULTY = {
 1: { pitchAimError:24, timingError:145, positionError:22, swingZone:.62, swingEdge:.52, swingOutside:.30, edgeRate:0, learnRate:0 },
 2: { pitchAimError:16, timingError:110, positionError:16, swingZone:.80, swingEdge:.70, swingOutside:.20, edgeRate:.25, learnRate:0 },
 3: { pitchAimError:10, timingError:75, positionError:10, swingZone:.88, swingEdge:.80, swingOutside:.12, edgeRate:.5, learnRate:.5 },
 4: { pitchAimError:6, timingError:48, positionError:6, swingZone:.93, swingEdge:.86, swingOutside:.08, edgeRate:.7, learnRate:1 }
};

/* ---- 固定ゲーム設定(バランス調整はここ) ---- */
const CONFIG = {
 render3d: true,           // 3Dフィールド描画を初期状態で有効にする(設定UIから切替可能)
 batMode: 'physics',       // 'physics' = 打球物理モデル / 'table' = 従来の hitTable
 physicsCorrectionScale: 0.25, // 物理モデルでの球種ボーナス・遅れ補正の倍率
 courseIdealMs: 40,         // 内角は早め、外角は遅めを理想とするタイミング補正(ms)
 dirCourseDeg: 28,          // コースによる打球方向の角度(deg)
 meetVertWeight: 0.4,       // ミート距離における上下ズレの重み
 meetNoiseX: 0.08,          // 横ズレに応じたミート度のランダム幅
 /* 打球の数字は MLB の実測に較正済み(Ver.1.2.0): 平均打球速度 約142km/h、
    HR下限=フェンス 110m、HR/FB 約11% を目安に調整。
    spdLossLiftScale: 速度低下の計算でも上下ズレを圧縮する倍率(上下ズレは角度担当という設計のため)
    dragV(基準速度 dragVRef 超過分)・dragBase/dragK: 空気抵抗の代用。速い打球ほど・高い打球ほど伸びない
    wtOut: 深いフライ(長打ゾーン・角度25°以上)がフェンス手前で捕球される確率 */
 phys: {
  baseAng: 13, angK: 58, dead: 0.05, nAng: 8,
  spdMin: 105, spdRange: 95, spdLoss: 0.6, spdLossLiftScale: 0.55, nSpd: 6,
  distK: 0.9, dragV: 0.028, dragVRef: 33, dragBase: 38, dragK: 0.06,
  groundAng: 10, linerAng: 25,
  gHitFrom: 90, gHitTo: 175, gHitMax: 0.4,
  inField: 56, hitMax: 80, hrMin: 110,
  wtOut: 0.65,
  tripleRatio: 0.7
 },
 cursorSize: 16,        // ミート判定: カーソルとボールの許容距離(px)
 finePlayFly: 0.22,     // フライがファインプレーになる確率
 finePlayHit: 0.05,     // 1B/2Bの当たりがファインプレーで取られる確率
 errorRate: 0.05,       // アウトになるはずのゴロ/フライが野手のエラーになる確率(打者は一塁セーフ・安打にはならない)
 infieldHitRate: 0.05,  // アウトになるはずのゴロが内野安打(セーフ)になる確率

 /* ---- 元からいた走者の進塁(確率)。前の走者から順に決め、塞がれたら手前で止まる ---- */
 run1BSecondHome: 0.4,  // 単打: 二塁走者が一気に生還する確率(残りは三塁止まり。三塁走者は必ず生還)
 run1BFirstThird: 0.25, // 単打: 一塁走者が三塁まで行く確率(残りは二塁止まり)
 run2BFirstHome: 0.4,   // 二塁打: 一塁走者が生還する確率(残りは三塁止まり。二・三塁走者は必ず生還)
 runGrThirdHome: 0.6,   // ゴロアウト: 三塁走者が生還する確率(残りは三塁に残る)
 runGrSecondThird: 0.65,// ゴロアウト: 二塁走者が三塁へ進む確率(三塁走者が残ると進めない)
 sacFlyDepthMid: 128,   // フライの飛距離がこれ以上で「中間」、sacFlyDepthDeep以上で「深い」
 sacFlyDepthDeep: 145,
 sacFlyShallowRate: 0.05, // 犠牲フライ(三塁走者生還)になる確率: 浅い/中間/深い
 sacFlyMidRate: 0.3,
 sacFlyDeepRate: 0.7,
 tagUpDepth: 162,       // これ以上深いフライで、二塁走者がタッチアップして三塁へ進める(三塁が空いているとき)
 tagUpSecondRate: 0.25,
 flyPxPerM: 3.1,        // 物理モデルの飛距離(m)をフライ処理の距離(px)に換算する係数(HR下限110mが描画345px相当)

 /* ---- 空振りの境界 ---- */
 timingWindowMs: 220,   // ジャストから±この範囲を超えると空振り
 judge: {
  nearer: { s:false, sl:false, c:true, f:false, sh:false, cu:false, ct:false, ss:false }, // 方式A: 着地点とスイング時のボール位置の近い方を基準にする
  bonus: { s:false, sl:false, c:true, f:false, sh:true, cu:false, ct:false, ss:false }, // 方式B: ジャスト付近のミート度ボーナス
  bonusRadius: 16,
  bonusMax: { s:0, sl:0, c:0.85, f:0, sh:0.75, cu:0, ct:0, ss:0 },
  latePenalty: { s:0, sl:0, c:0.50, f:0, sh:0.50, cu:0, ct:0, ss:0 }
 },
 pitchShape: {
  c: { lowCut: { strength:0.7, startY:110, endY:176 } },
  sh: { xBreak:41, breakStart:0.6 }
 },
 farZoneMissRate: 0.6,  // ゾーンから大きく外れた球(dist>=2)を振ったときの空振り率
 labelPerfectMs: 70,    // メッセージ表示のみ: この範囲内なら「タイミング：完璧」
 labelNearMs: 140,      // メッセージ表示のみ: これ以上なら「早すぎ/遅すぎ」

 /* ---- ミート度(0〜1) ----
    = (タイミング点)^meetTimingPow × (距離点)^meetDistPow
    タイミング点: ジャストで1、timingWindowMsで0
      (物理モデルではジャスト = コース別の理想タイミング。実効ズレで測る)
    距離点      : ボールに重なって1、cursorSizeで0
      (物理モデルでは上下ズレを meetVertWeight 倍して測る) */
 meetTimingPow: 1,
 meetDistPow: 1,
 meetSolid: 0.55,       // ミート度がこれ以上 → 芯
 meetNormal: 0.25,      // これ以上 → 普通 / 未満 → かすり
 tierLabels: {solid:'芯', normal:'普通', weak:'かすり'},   // メッセージ表示用

 /* ---- 打球の高さ ----
    縦ズレ = (カーソルY - ボールY) / cursorSize
    ボールより下を振る(+)ほど上がる / 上を振る(-)ほど転がる */
 liftBand: 0.3,         // この範囲内ならライナー(上下の偏りなし)

 /* ---- 打球方向(度。+は画面右) ---- */
 dirTimingGain: 0.35,    // タイミング1msのズレあたりの角度(早い=引っ張り。左打者は反転)。物理モデルではコースによる角度 dirCourseDeg も加わる
 centerDeg: 15,         // 打球方向がこの角度(±)以内ならセンター方向。これより早い側が引っ張り、遅い側が流し(約±43ms)
 courseThird: 22,       // 投球の着地x(ゾーン中心110からの距離)がこの範囲内なら「真ん中」。外は内角/外角(ゾーン幅132pxの3等分)
 courseShift: 1,        // 引っ張り×内角・流し×外角(噛み合い)でミート段階をこの数だけ上げる。引っ張り×外角・流し×内角は逆に下げる
 dirNoiseDeg: 18,       // ミート度0のときのランダム幅(ミート度が高いほど小さくなる)
 foulAngleDeg: 45,      // 方向がこれを超えたらファウル(白線は45°)

 /* ---- 当たりの種類(重み。合計は何でもOK) ----
    hitTable[ミート段階][高さ] = {結果: 重み}   結果: HR / 3B / 2B / 1B / fly(フライ・ライナーアウト) / gr(ゴロアウト) */
 hitTable: {
  solid: {
   up:   {HR:30,'3B':4,'2B':14,'1B':6,fly:38,gr:8},
   flat: {HR:11,'3B':6,'2B':24,'1B':31,fly:16,gr:12},
   down: {HR:2,'3B':3,'2B':10,'1B':38,fly:7,gr:40}
  },
  normal: {
   up:   {HR:10,'3B':3,'2B':12,'1B':9,fly:56,gr:10},
   flat: {HR:4,'3B':4,'2B':17,'1B':35,fly:22,gr:18},
   down: {'3B':2,'2B':8,'1B':31,fly:8,gr:51}
  },
  weak: {
   up:   {HR:1,'3B':1,'2B':4,'1B':8,fly:78,gr:8},
   flat: {'3B':1,'2B':5,'1B':22,fly:38,gr:34},
   down: {'3B':1,'2B':3,'1B':18,fly:8,gr:70}
  }
 },

};
