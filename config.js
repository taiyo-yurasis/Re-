/* config.js — 調整したい数値・設定はここ */
const SUPA_URL='https://mbgdtwyhtiymmdoxuxwb.supabase.co',SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1iZ2R0d3lodGl5bW1kb3h1eHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMjQyODAsImV4cCI6MjEwNzcwMDI4MH0.W0rPvhxlRIvM4GzUzdU9gU2IPD6A9Wz_teWX4TMkRZY';

/* ---- 球種(d: 到達までのms / j: 狙いのブレ幅px) ---- */
const TY={
 s:{d:930,j:8},
 sl:{d:1150,j:10},
 c:{d:1500,j:12},
 f:{d:1250,j:16},
 sh:{d:1200,j:10},
 cu:{d:1500,j:8}
};

const TY_NAMES = {
 s: 'ストレート',
 sl: 'スライダー',
 c: 'カーブ',
 f: 'フォーク',
 sh: 'ツーシーム',
 cu: 'チェンジアップ'
};

/* ---- 固定ゲーム設定(バランス調整はここ) ---- */
const CONFIG = {
 cursorSize: 16,        // ミート判定: カーソルとボールの許容距離(px)
 finePlayFly: 0.22,     // フライがファインプレーになる確率
 finePlayHit: 0.1,      // 1B/2Bの当たりがファインプレーで取られる確率
 errorRate: 0.1,        // アウトになるはずのゴロ/フライが野手のエラーになる確率(打者は一塁セーフ・安打にはならない)
 infieldHitRate: 0.05,  // アウトになるはずのゴロが内野安打(セーフ)になる確率

 /* ---- 空振りの境界 ---- */
 timingWindowMs: 220,   // ジャストから±この範囲を超えると空振り
 farZoneMissRate: 0.6,  // ゾーンから大きく外れた球(dist>=2)を振ったときの空振り率
 labelPerfectMs: 70,    // メッセージ表示のみ: この範囲内なら「タイミング：完璧」
 labelNearMs: 140,      // メッセージ表示のみ: これ以上なら「早すぎ/遅すぎ」

 /* ---- ミート度(0〜1) ----
    = (タイミング点)^meetTimingPow × (距離点)^meetDistPow
    タイミング点: ジャストで1、timingWindowMsで0
    距離点      : ボールに重なって1、cursorSizeで0 */
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
 dirTimingGain: 0.35,    // タイミング1msのズレあたりの角度(早い=引っ張り。左打者は反転)
 dirCourseGain: 12,     // コースのズレ(cursorSize分)あたりの角度。符号を変えると逆向き
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

 /* ---- CPUの打撃 ---- */
 cpuFoulRate: 0.12,     // CPUが当てたうちファウルになる割合
 cpuHitTable: {HR:25,'2B':25,'1B':25,gr:15,fly:10}   // CPUが打ったときの当たり(重み)
};
