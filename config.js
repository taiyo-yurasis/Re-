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
 sh: 'シュート',
 cu: 'チェンジアップ'
};

/* ---- 固定ゲーム設定(バランス調整はここ) ---- */
const CONFIG = {
 cursorSize: 16,        // ミート判定: カーソルとボールの許容距離(px)
 finePlayFly: 0.22,     // フライがファインプレーになる確率
 finePlayHit: 0.1,      // 1B/2Bの当たりがファインプレーで取られる確率

 /* ---- 打撃 ---- */
 timingWindowMs: 220,   // ジャストから±この範囲を超えると空振り
 farZoneMissRate: 0.6,  // ゾーンから大きく外れた球(dist>=2)を振ったときの空振り率
 labelPerfectMs: 70,    // メッセージ表示のみ: この範囲内なら「タイミング：完璧」
 labelNearMs: 140,      // メッセージ表示のみ: これ以上なら「早すぎ/遅すぎ」

 // 当たりの種類テーブル。[累積確率のしきい値, 結果] を上から判定
 // good = タイミングとコースが噛み合った当たり / bad = 噛み合わなかった当たり
 // Upper = ボールがカーソルより上 / Lower = 下
 hitTable: {
  goodUpper: [[.30,'HR'],[.55,'2B'],[.80,'fly'],[1,'3B']],
  goodLower: [[.45,'1B'],[.70,'2B'],[.90,'gr'],[1,'3B']],
  badUpper:  [[.60,'fly'],[1,'1B']],
  badLower:  [[.70,'gr'],[1,'1B']]
 },
 // CPUが打ったときの当たり種類
 cpuHitTable: [[.25,'HR'],[.50,'2B'],[.75,'1B'],[.90,'gr'],[1,'fly']]
};
