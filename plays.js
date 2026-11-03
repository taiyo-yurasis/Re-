function addMatchPts(team,points){G.pts[team]=(G.pts[team]||0)+points}
/* plays.js — 打った後の処理(アウト/ヒット/四球・走者の進塁・送球) */
// 中継に入る野手(守備位置)。送球先と捕球した野手(外野手)で決まる。0は中継なし。
// 本塁への送球: ライト→セカンド、レフト→ショート、センター→打球の左右でセカンド/ショート。
// 三塁への送球はライトからのみセカンド。それ以外(二塁・一塁への送球、内野手の捕球)は中継なし。
function relayMan(fi, to, targetBase){
 if(targetBase === 4){
  if(fi === 8) return 3;
  if(fi === 6) return 4;
  if(fi === 7) return to.x < HP.x ? 4 : 3;
  return 0;
 }
 if(targetBase === 3 && fi === 8) return 3;
 return 0;
}

function throwPlan(to, targetBase, fi){
 const tp = targetBase === 4 ? {x: HP.x, y: HP.y} : {x: BS[targetBase].x, y: BS[targetBase].y};
 const L = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
 const rm = relayMan(fi, to, targetBase), relay = rm !== 0 && Math.random() < .5;
 // 送球速度とカバー走は CONFIG.speed に統一 (送球は距離比例、カバーは走者と同等の足の速さ)
 const cov = targetBase === 2 ? 4 : targetBase === 3 ? 5 : 1, mv = [], sp = CONFIG.speed.throwPx, runSp = CONFIG.speed.runPx;
 let R = null;
 if(relay){R = {x: tp.x + (to.x - tp.x) * .4, y: tp.y + (to.y - tp.y) * .4}; mv.push({i: rm, x: R.x, y: R.y, T: Math.max(500, Math.hypot(FD[rm][0] - R.x, FD[rm][1] - R.y) / runSp)})}
 if(cov !== 1) mv.push({i: cov, x: tp.x, y: tp.y, T: Math.max(500, Math.hypot(FD[cov][0] - tp.x, FD[cov][1] - tp.y) / runSp)});
 // 本塁への送球では、中継に入らない方の二遊間が二塁をカバーする
 if(targetBase === 4 && rm !== 0){const c2 = rm === 3 ? 4 : 3; mv.push({i: c2, x: BS[2].x, y: BS[2].y, T: Math.max(500, Math.hypot(FD[c2][0] - BS[2].x, FD[c2][1] - BS[2].y) / runSp)})}
 const steps = R ? [{from: to, to: R, dur: Math.max(200, L(to, R) / sp)}, {from: R, to: tp, dur: Math.max(180, L(R, tp) / sp), dly: CONFIG.speed.relayWaitMs}] : [{from: to, to: tp, dur: Math.max(220, L(to, tp) / sp)}];
 return {steps, mv};
}

// 打球結果と打つ前の走者配置から送球先を決める。4は本塁、0は送球なし。
// 二塁打で二塁/三塁が候補になる2ケースだけ、50:50で選ぶ。
function chooseHitThrowBase(kind){
 if(kind==='HR')return 0;
 const key=[1,2,3].map(b=>G.bases[b]?1:0).join('');
 const plans={
  '000':{'1B':2,'2B':[2,3],'3B':3},
  '100':{'1B':3,'2B':4,'3B':4},
  '110':{'1B':4,'2B':4,'3B':4},
  '010':{'1B':4,'2B':4,'3B':3},
  '001':{'1B':2,'2B':[2,3],'3B':3},
  '101':{'1B':3,'2B':4,'3B':4},
  '011':{'1B':4,'2B':4,'3B':3},
  '111':{'1B':4,'2B':4,'3B':4}
 };
 const target=plans[key]?.[kind];
 if(Array.isArray(target))return Math.random()<0.5?target[0]:target[1];
 return target??0;
}

function pickFielder(to,kind){
 // 深いフライは外野手の担当。内野手が外野まで走っていかないよう、落下点が本塁から
 // 170px以上のフライは外野手だけを候補にする (浅いフライは今まで通り全員候補)
 const deep=kind!=='ground'&&Math.hypot(to.x-HP.x,to.y-HP.y)>=170;
 const candidates=kind==='ground'?[2,3,4,5]:deep?[6,7,8]:[6,7,8,2,3,4,5];
 if(kind==='ground'&&Math.hypot(to.x-240,to.y-310)<50)candidates.push(0);
 return nrst(to,candidates);
}
/* ===== 打球データ表示 (C案) =====
   飛行中はフィールド左下に中継風カード (#bcard)、結果確定後は詳細メッセージ行に、
   物理モデルが計算済みの info (打球速度・角度・推定飛距離) をそのまま出す。
   新しい判定・計算は追加しない。対象はインプレー打球のみで、info に数字が無い
   打球 (ファウル・空振り・見逃し・旧table方式など) には何も出ない。
   バレルの閾値は BATTED_EXP の3つの値に集約する。 */
const BATTED_EXP={enabled:true,barrelSpeed:160,barrelLaunchMin:18,barrelLaunchMax:36};
const BATTED_PLAY_KINDS=['1B','2B','3B','HR','fly','gr'];
let battedPending=null; // result() が置き、次の flight() が消費する (飛行中カード用)
function battedDataOf(info,noDist){
 if(!info||!Number.isFinite(info.speed)||!Number.isFinite(info.launch))return null;
 const speed=Math.round(info.speed),launch=Math.round(info.launch);
 const dist=!noDist&&Number.isFinite(info.dist)?Math.round(info.dist):null;
 const barrel=speed>=BATTED_EXP.barrelSpeed&&launch>=BATTED_EXP.barrelLaunchMin&&launch<=BATTED_EXP.barrelLaunchMax;
 return{speed,launch,dist,barrel};
}
function battedLine(d){return `打球 ${d.speed}km/h / 角度 ${d.launch}°`+(d.dist!=null?` / 推定飛距離 ${d.dist}m`:'')}
function showBattedCard(d){
 const el=typeof $==='function'?$('bcard'):null;if(!el)return;
 el.innerHTML=`<div class="bc-spd">打球 ${d.speed}<small>km/h</small>${d.barrel?'<span class="bc-barrel">バレル</span>':''}</div><div class="bc-sub">角度 ${d.launch}°${d.dist!=null?` / 推定飛距離 ${d.dist}m`:''}</div>`;
 el.classList.add('on');
}
function hideBattedCard(){const el=typeof $==='function'?$('bcard'):null;if(el)el.classList.remove('on')}
// トグル (フィールド左上)。OFF の間は自機のカード・結果行とも出ない
(function(){
 const btn=typeof $==='function'?$('exp-batted'):null;
 if(!btn||typeof btn.addEventListener!=='function')return;
 const paint=()=>{btn.textContent=BATTED_EXP.enabled?'打球データ ON':'打球データ OFF';btn.classList.toggle('on',BATTED_EXP.enabled);if(btn.setAttribute)btn.setAttribute('aria-pressed',String(BATTED_EXP.enabled))};
 btn.addEventListener('click',()=>{BATTED_EXP.enabled=!BATTED_EXP.enabled;if(!BATTED_EXP.enabled)hideBattedCard();paint()});
 paint();
})();

function flight(to,kind,cb,out,o){
 const d=Math.hypot(to.x-HP.x,to.y-HP.y),dur=kind==='ground'?300+d*3.2:500+d*2.6,opts=o||{};
 G.fl={id:++pid,out:!!out,t0:performance.now(),dur,to,kind,fi:opts.fi??pickFielder(to,kind),h:kind==='hr'?130:30+d*.35,...opts};
 const bd=battedPending;battedPending=null;
 if(bd){G.fl.bd=bd;if(BATTED_EXP.enabled)showBattedCard(bd)}
 sync();later(dur+250,()=>{if(bd)hideBattedCard();if(cb)cb()})
}
function next(ms){updateHud();later(ms,ready)}
function fin(ms){if(G.th&&G.th.steps)ms=Math.max(ms,G.th.steps.reduce((a,q)=>a+(q.dly||0)+q.dur,0)-(performance.now()-G.th.t0)+400);if(G.mv)ms=Math.max(ms,G.mv.dur-(performance.now()-G.mv.t0)+350);G.cnt={b:0,s:0};if(!G.walkoff&&G.outs<3)selectNextBatterSide();updateHud();
 if(G.walkoff)return later(Math.max(1500,ms),over);
 if(G.outs>=3)return later(ms+300,endHalf);
 later(ms,ready)}
function score(r){if(!r)return;G.runs[G.top?0:1][G.inn-1]+=r;
 if(!G.top&&G.inn>=G.N&&tot(1)>tot(0))G.walkoff=true;updateHud()}
function rpos(a,b,p){const Q=[HP,BS[1],BS[2],BS[3],HP],L=[];let T=0;for(let i=a;i<b;i++){const l=Math.hypot(Q[i+1].x-Q[i].x,Q[i+1].y-Q[i].y);L.push(l);T+=l}
 let d=T*p;for(let i=a;i<b;i++){const l=L[i-a];if(d<=l||i===b-1){const t=l?Math.min(1,d/l):1;return[Q[i].x+(Q[i+1].x-Q[i].x)*t,Q[i].y+(Q[i+1].y-Q[i].y)*t]}d-=l}}
function mvAdd(m){const t=performance.now();if(!G.mv||t-G.mv.t0>G.mv.dur)G.mv={id:++pid,t0:t,dur:0,moves:[],stay:[1,2,3].filter(b=>G.bases[b])};G.mv.moves.push(m);G.mv.dur=Math.max(G.mv.dur,m.T||(m.b-m.a)*CONFIG.speed.runnerMsPerBase)}

function adv(n,bat){
 const targets={};
 for(let b=1;b<=3;b++)if(G.bases[b])targets[b]=b+n;
 const result=settle(targets,bat?n:null);
 applyRunnerResult(result);
 return result.runs;
}

// 打者が一塁セーフになるプレー用の進塁(エラー/内野安打)。走者は押し出される分だけ進む。T=全員の走塁時間(ms)。得点数を返す(加点は呼び出し側)
function forceAdv(T){
 const targets={};
 if(G.bases[1])targets[1]=2;
 if(G.bases[2])targets[2]=G.bases[1]?3:2;
 if(G.bases[3])targets[3]=G.bases[1]&&G.bases[2]?4:3;
 const result=settle(targets,1,{T});
 applyRunnerResult(result,T);
 return result.runs;
}

// 打球がアウトにならず打者が一塁に残る: isHit=true→内野安打(安打+1)、false→エラー(安打にならない)
// ゴロは野手がもたつく(送球が遅れる)ので、走者が先に一塁へ着く
function safeAtFirst(kind,to,ms,isHit,info){
 const ground=kind==='gr',d=Math.hypot(to.x-HP.x,to.y-HP.y),F=ground?300+d*3.2:500+d*2.6;
 // 走者の足は CONFIG.speed.runnerMsPerBase に揃える (打球の飛行より速く塁に着くことはない範囲で)
 const T=Math.max(CONFIG.speed.runnerMsPerBase,F+(ground?250:0)),r=forceAdv(T);
 flight(to,ground?'ground':'fly',()=>{
  if(isHit){G.hits[G.top?0:1]++;addMatchPts(G.top?0:1,300+300*r);banner('内野安打!');showDetailMsg('ih',ms,info)}
  else{banner('エラー!');showDetailMsg('err',ms,info)}
  score(r);
  if(r)banner(`+${r}点!`);
  if(G.fl){
   const pl=throwPlan(G.fl.to,1,G.fl.fi);
   G.th={id:++pid,t0:performance.now(),steps:pl.steps};
   if(pl.mv.length)G.rl={id:++pid,t0:performance.now(),moves:pl.mv};
  }
  fin(800)},1);
}

// 元からいた走者を確率で進塁させる(打者は1B/2Bのときだけ bat=true で加える)。kind: '1B' | '2B'
function advRand(kind,bat){
 const C=CONFIG,targets={};
 for(let b=1;b<=3;b++){
  if(!G.bases[b])continue;
  if(kind==='1B')targets[b]=b===3?4:b===2?(Math.random()<C.run1BSecondHome?4:3):(Math.random()<C.run1BFirstThird?3:2);
  else targets[b]=b>=2?4:(Math.random()<C.run2BFirstHome?4:3);
 }
 const result=settle(targets,bat?(kind==='2B'?2:1):null);
 applyRunnerResult(result);
 return result.runs;
}

function walk(){
 const r=forceAdv(CONFIG.speed.runnerMsPerBase);
 addMatchPts(G.top?0:1,50+300*r);score(r);if(r)banner(`+${r}点!`)
}

function showDetailMsg(k, ms, info) {
 const p = G.pitch;
 const typeName = p && TY_NAMES[p.type] ? TY_NAMES[p.type] : '球種不明';
 const actions = {
  ball: 'ボール',
  walk: 'フォアボール',
  look: '見逃しストライク',
  miss: '空振り',
  fine: 'ファインプレーでアウト！',
  foul: 'ファウル',
  gr: 'ゴロアウト',
  err: '野手のエラー！',
  ih: '内野安打！',
  fly: 'フライアウト',
  '1B': 'ヒット！',
  '2B': 'ツーベース！',
  '3B': 'スリーベース！',
  HR: 'ホームラン！！'
 };
 const parts = [typeName, actions[k] || k];
 if (ms != null && Number.isFinite(ms)) {
  // 表示も判定と同じ実効ズレ(コース別の理想タイミングを差し引いた値)で評価する
  const ems = effMs(p, ms), absMs = Math.abs(ems);
  const timing = absMs >= CONFIG.labelNearMs
   ? (ems < 0 ? '早すぎ' : '遅すぎ')
   : absMs >= CONFIG.labelPerfectMs
    ? (ems < 0 ? '少し早い' : '少し遅い')
    : '完璧';
  parts.push(`タイミング：${timing}`);
  if (k === 'miss') parts.push('ミート：空振り');
  else if (info && info.tier && CONFIG.tierLabels[info.tier]) parts.push(`ミート：${CONFIG.tierLabels[info.tier]}`);
 }
 if (info && info.dir) {
  const direction = {pull:'引っ張り',center:'センター',oppo:'流し'}[info.dir];
  if (direction) parts.push(`方向：${direction}`);
 }
 // 打球データ表示 (C案・結果行): 数字があるインプレー打球だけ、次球まで残る行に足す
 if (BATTED_EXP.enabled) {
  const bd = battedDataOf(info, k === 'gr');
  if (bd) { parts.push(battedLine(bd)); if (bd.barrel) parts.push('バレル'); }
 }
 setMsg(parts.join(' ｜ '));
}

function resultBall(ms,info){
 const c=G.cnt;
 c.b++;if(c.b>=4){banner('フォアボール');walk();showDetailMsg('walk', null);return fin(1100)}showDetailMsg('ball', null);return next(800)
}

function resultStrike(k,ms,info){
 const c=G.cnt;
 c.s++;const m=k==='miss';
  if(c.s>=3){banner(m?'空振り三振!':'見逃し三振!');G.outs++;addMatchPts(G.top?1:0,40);showDetailMsg(k, ms);return fin(1200)}
  showDetailMsg(k, ms);return next(800)
}

function resultFoul(ms,info){
 const c=G.cnt;
 if(c.s<2)c.s++;const hasA=info&&info.angle!=null,ad=hasA?cl(Math.abs(info.angle),46,78):rnd(46,78),a=(hasA?(info.angle<0?-1:1):(Math.random()<.5?-1:1))*ad*P/180,d=rnd(90,200),to={x:240+d*Math.sin(a),y:375-d*Math.cos(a)},cp=ad<66?(66-ad)/20*.6:0;
  banner('ファウル');if(Math.random()<cp){banner('ファウルフライ!');flight(to,'fly',()=>{G.outs++;banner('ファウルフライアウト');showDetailMsg('foul', ms, info);fin(1000)},1);return}
  showDetailMsg('foul', ms, info);flight(to,'fly',()=>next(200));return
}

function resultGround(ms,info,play){
 const a=(info&&Number.isFinite(info.angle)?cl(info.angle,-44,44):rnd(-35,35))*P/180,d=rnd(70,130);banner('ゴロ!');
  const gto=play&&play.to?play.to:{x:240+d*Math.sin(a),y:375-d*Math.cos(a)};
  const roll=Math.random();
  if(roll<CONFIG.errorRate)return safeAtFirst('gr',gto,ms,false,info);
  // 到達判定 (fielding.js) で結果が決まった打球は、内野安打の抽選を重ねない
  // (内野安打は一塁送球との競争で既に判定されている)。エラーは従来どおり。
  if(!(play&&play.resolved)&&roll<CONFIG.errorRate+CONFIG.infieldHitRate)return safeAtFirst('gr',gto,ms,true,info);
  if(play&&play.forceSafe)return safeAtFirst('gr',gto,ms,true,info);
  const before=G.bases.slice();
  const loaded=!!(before[1]&&before[2]&&before[3]);
  // 満塁時のゴロ (アウトになる場合) は3パターンに分岐する:
  // 1=本塁アウト (全員進塁、満塁のまま) / 2=生還+一塁アウト / 3=本塁→一塁の併殺
  let homePlay=0;
  if(loaded){
   const r2=Math.random();
   if(G.outs<2&&r2<.2)homePlay=3;
   else if(r2<(G.outs<2?.6:.5))homePlay=1;
   else homePlay=2;
  }
  const dp=!loaded&&!!before[1]&&G.outs<2&&Math.random()<.35;
  const endsInning=G.outs+1+(dp?1:0)>=3;
  const targets={};
  if(homePlay===1||homePlay===3){
   targets[1]=2;targets[2]=3; // 三塁走者は本塁でアウト (目標なし=アウト扱い)
  }else if(homePlay===2){
   targets[1]=2;targets[2]=3;targets[3]=G.outs===2?3:4;
  }else for(let b=1;b<=3;b++){
   if(!before[b])continue;
   if(dp&&b===1)continue;
   if(G.outs===2){targets[b]=b===3?3:b+1;continue}
   if(endsInning){targets[b]=b;continue}
   // ダブルプレーが成立したら、二塁・三塁の走者は必ず次の塁に進む
   if(dp){targets[b]=b+1;continue}
   if(b===3)targets[b]=Math.random()<CONFIG.runGrThirdHome?4:3;
   else if(b===2)targets[b]=Math.random()<CONFIG.runGrSecondThird?3:2;
   else targets[b]=2;
  }
  const runnerResult=settle(targets);
  applyRunnerResult(runnerResult);
  if(homePlay===1)G.bases[1]=1; // 本塁アウトのパターンでは打者走者が一塁に残る
  const r=runnerResult.runs;
  // 見た目のみ: 内野ゴロのアウトの約20%で、内野手(投手除く一・二・三・遊)が
  // ダイビング/スライディング捕球してから一塁へ送球する。併殺と本塁併殺には付けない。
  // 捕球・送球・アウト判定・走者の動きは従来どおりで、演出は捕球までの移動時間の範囲内だけ。
  // (ここまでのゲーム上の抽選はすべて終わっているので、この乱数は判定に影響しない)
  // 投手の正面などで本来は投手が処理する打球でも、投手自身はダイブさせず、
  // 最も近い内野手が捕球する見た目に寄せる (fi は野手の移動アニメーション専用で、
  // 捕球時刻は dur の92%に丸められるため送球・判定のタイミングは変わらない)。
  const groundRolled=!dp&&homePlay!==3&&Math.random()<CONFIG.groundDiveRate;
  const groundPlay=groundRolled?(Math.random()<.5?'dive':'slide'):null;
  const groundFiRaw=play&&Number.isInteger(play.fi)?play.fi:pickFielder(gto,'ground');
  const groundFi=groundPlay&&!(groundFiRaw>=2&&groundFiRaw<=5)?nrst(gto,[2,3,4,5]):groundFiRaw;
  flight(gto,'ground',()=>{
   let m='ゴロアウト';
   if(homePlay===1){G.outs++;m='本塁アウト!'}
   else if(homePlay===3){G.outs+=2;addMatchPts(G.top?1:0,70);m='ダブルプレー!'}
   else{G.outs++;if(dp){G.outs++;addMatchPts(G.top?1:0,70);m='ダブルプレー!'}}
   score(r);
   banner(m);
   if(r)banner(`+${r}点!`);
   if(G.fl){
    // 送球時間は距離比例 (CONFIG.speed.throwPx)。旧仕様は距離によらず380/250ms固定で、
    // 近い送球と遠い送球が同じ速さに見えていた
    const thDur=(a,b)=>Math.max(200,Math.hypot(a.x-b.x,a.y-b.y)/CONFIG.speed.throwPx);
    if(homePlay===1){
     G.th={id:++pid,t0:performance.now(),dur:thDur(G.fl.to,HP),from:G.fl.to,to:HP};
    }else if(homePlay===3){
     G.th={id:++pid,t0:performance.now(),steps:[{from:G.fl.to,to:HP,dur:thDur(G.fl.to,HP)},{from:HP,to:BS[1],dur:thDur(HP,BS[1])}],currentStep:0};
    }else if(dp){
     // 案B(捕球した二遊間が二塁の近くで捕球)では、1段目は送球ではなくボールを持って二塁へ走る
     const self=G.fl.dpSelf,carryDur=self?Math.max(250,Math.hypot(G.fl.to.x-BS[2].x,G.fl.to.y-BS[2].y)/CONFIG.speed.runPx):250;
     G.th={id:++pid,t0:performance.now(),steps:[{from:G.fl.to,to:BS[2],dur:carryDur,...(self?{carry:true}:{})},{from:BS[2],to:BS[1],dur:thDur(BS[2],BS[1])}],currentStep:0};
    }else G.th={id:++pid,t0:performance.now(),dur:thDur(G.fl.to,BS[1]),from:G.fl.to,to:BS[1]};
   }
   showDetailMsg('gr',ms,info);fin(800)
  },1,(groundPlay||(play&&Number.isInteger(play.fi)))?{fi:groundFi,...(groundPlay?{groundPlay,diving:groundPlay==='dive',sliding:groundPlay==='slide'}:{})}:null);
  // ベースカバーの移動。送球が始まる前に動き出せるよう、打球の発生と同時に rl へ登録する。
  if(G.fl){
   const rlMoves=[];
   // 一塁手(守備位置2)がゴロを処理した場合、投手(守備位置0)が一塁をカバーする
   // (本塁アウトのパターンは一塁への送球がないのでカバー不要)
   if(G.fl.fi===2&&homePlay!==1){
    const from={x:FD[0][0],y:FD[0][1]},to=BS[1];
    rlMoves.push({i:0,x:to.x,y:to.y,T:Math.max(250,Math.hypot(from.x-to.x,from.y-to.y)/CONFIG.speed.runPx)});
   }
   if(dp){
    const fi=G.fl.fi;
    if((fi===3||fi===4)&&Math.hypot(G.fl.to.x-BS[2].x,G.fl.to.y-BS[2].y)<=65){
     // 案B: セカンド/ショートが二塁の近くで捕球したら、自分で二塁を踏んでから一塁へ送球する
     G.fl.dpSelf=true;
    }else{
     // 案A: 相方の二遊間(投手の捕球時は二塁に近い方)が二塁をカバーする
     const cov=fi===3?4:fi===4?3:fi===5?4:fi===2?3:nrst(BS[2],[3,4]);
     rlMoves.push({i:cov,x:BS[2].x,y:BS[2].y,T:Math.max(250,Math.hypot(FD[cov][0]-BS[2].x,FD[cov][1]-BS[2].y)/CONFIG.speed.runPx)});
    }
   }
   if(rlMoves.length)G.rl={id:++pid,t0:performance.now(),moves:rlMoves};
  }
  // 打者走者の表示タイミングは「打球飛行+捕球後の間+一塁送球 (距離比例)」に合わせる
  const o=G.fl.dur+250+Math.max(200,Math.hypot(gto.x-BS[1].x,gto.y-BS[1].y)/CONFIG.speed.throwPx);mvAdd({a:0,b:1,T:o+100,o});if(dp)mvAdd({a:1,b:2,T:o+100,o});if(homePlay===1||homePlay===3)mvAdd({a:3,b:4,T:o+100,o});return
}

// フライの飛距離(px)。物理モデルは飛距離(m)を返すので、描画と犠飛判定の尺度(px)に換算する。
// 飛距離の情報がない場合(table方式など)は従来どおりランダム。
function flyDistPx(info){
 // 上限はフェンス際(R-8=312px)。HR未満の特大フライでもボールがフェンスを越えて見えないようにする
 if(info&&Number.isFinite(info.dist))return cl(Math.round(info.dist*CONFIG.flyPxPerM),60,312);
 return rnd(160,270);
}

function resultFly(ms,info,play){
 const a=(info&&Number.isFinite(info.angle)?cl(info.angle,-44,44):rnd(-38,38))*P/180,d=flyDistPx(info);banner('フライ!');
  const fto=play&&play.to?play.to:{x:240+d*Math.sin(a),y:375-d*Math.cos(a)};
  if(Math.random()<CONFIG.errorRate)return safeAtFirst('fly',fto,ms,false,info);
  // 到達判定で決まった打球は、ファインプレーかどうかも捕球の際どさ (到達比率) で決める
  const isFinePlay=play&&play.resolved?!!play.finePlay:Math.random()<CONFIG.finePlayFly;
  if(G.outs===2){
   const targets={};
   for(let b=1;b<=3;b++)if(G.bases[b])targets[b]=b===3?3:b+1;
   applyRunnerResult(settle(targets));
  }
  flight(fto,'fly',()=>{
   G.outs++;
   let m=isFinePlay?'ファインプレー!!':'フライアウト';
   let scoredRuns=0;
   if(G.outs<3&&!isFinePlay){
    const C=CONFIG,hasThird=!!G.bases[3],hasSecond=!!G.bases[2];
    const sacFly=hasThird&&Math.random()<(d>=C.sacFlyDepthDeep?C.sacFlyDeepRate:d>=C.sacFlyDepthMid?C.sacFlyMidRate:C.sacFlyShallowRate);
    const tagUpSecond=hasSecond&&(!hasThird||sacFly)&&d>=C.tagUpDepth&&Math.random()<C.tagUpSecondRate;
    const targets={};
    for(let b=1;b<=3;b++)if(G.bases[b])targets[b]=b===3?(sacFly?4:3):b===2?(tagUpSecond?3:2):1;
    const runnerResult=settle(targets);
    applyRunnerResult(runnerResult);
    if(sacFly){addMatchPts(G.top?0:1,450);scoredRuns=runnerResult.runs;m='犠牲フライ!'}
    else if(tagUpSecond)m='タッチアップ!';
    // 見た目だけの送球(タッチアップ成立時): 判定・進塁・得点は上で確定済みで、ここでは触らない。
    // 犠飛は本塁へ、二塁走者のタッチアップは三塁へ。ボールは1個なので両方成立したら本塁を優先。
    // 捕球後200ms置いてから放物線で飛ばし、捕手/三塁手の位置に収める。2D(drawTh)と3D(fieldBallState)が
    // 同じ G.th.steps を描くので両表示で見える。dly+dur+fin側の余裕400ms が fin(1000) の枠に収まる
    // 速度(深い打球ほど送球距離が長い分だけ速く)にし、次打席への移行タイミングは従来どおりにする。
    const throwTo=sacFly?HP:tagUpSecond?BS[3]:null;
    if(throwTo){
     const from={x:fto.x,y:fto.y},distTo=Math.hypot(throwTo.x-from.x,throwTo.y-from.y);
     G.th={id:++pid,t0:performance.now(),steps:[{from,to:{x:throwTo.x,y:throwTo.y},dur:cl(Math.round(distTo/CONFIG.speed.throwPx),240,900),dly:200}]};
    }
   }
   banner(m,isFinePlay?'fine':'');
   if(scoredRuns){score(scoredRuns);banner(`+${scoredRuns}点!`);}
   showDetailMsg('fly',ms,info);
   fin(isFinePlay?CONFIG.finePlayLingerMs:1000);
  },1,isFinePlay?{diving:true,finePlay:true,...(play&&Number.isInteger(play.fi)?{fi:play.fi}:{})}:(play&&Number.isInteger(play.fi)?{fi:play.fi}:null));
  return;
}
/* 投球ボールの凍結と消去 (表示専用・判定には触らない)。
   空振り (Taiyo 指示 2026-11-03): 空ぶった瞬間に、球をその位置で止め、
   少し経ったら消す。「少し」は 350ms とする。ただし捕手視点ゾーン板 ON 時の
   3D 球だけは例外で、凍結せず着弾・空振りの瞬間に即時消去する
   (fieldBallState の fpRay 分岐。板の円盤からはみ出すのを防ぐため)。
   板/パネルの球と板 OFF 時の 3D 球はこの凍結+350ms の規則どおり。
   (スイングのフォロースルー 230〜370ms が終わる頃で、ストライクコール後の
   次球準備 800ms より前に消える長さ)。凍結位置は、その時点で各描画が
   使っていた p.t (人間スイング=スイング時刻、CPU 打者=判定時刻の値) を
   そのまま使うので、板・パネル・3D が同じ位置で止まる。
   見逃し/到達後: 到達した球は到達点に留まり、到達 +280ms で消える。
   消去の判定は位相 (phase) に依存させない: 旧方式は busy のときだけ
   +280ms で消していたため、到達からコール確定までの pitch 位相の窓や
   コール後の滞留など、位相が想定と違う経路では消えずに残る余地があった。
   pitchBallGone は pitch オブジェクトが生きている全位相で同じ規則を返す。 */
const PITCH_FREEZE_HIDE_MS=350;
function freezePitchBall(){
 const p=G.pitch;if(!p||p.frozenT!=null)return;
 p.frozenT=cl(Number.isFinite(p.t)?p.t:0,0,1);
 p.hideAt=performance.now()+PITCH_FREEZE_HIDE_MS;
}
function pitchBallGone(p,now){
 if(!p)return true;
 if(p.frozenT!=null)return now>=p.hideAt;
 return Number.isFinite(p.t0)&&Number.isFinite(p.dur)&&now>p.t0+p.dur+280;
}
function result(k,ms,info){
 if(k==='miss')freezePitchBall();
 if(G.prac)return pracResult(k,ms,info);
 // 打球データ表示: インプレー打球なら飛行中カード用データを控える (flight() が消費する)。
 // 表示可否は BATTED_EXP.enabled を表示側 (カード・結果行・ゲスト受信側) で見るので、
 // ここでは数字の有無だけで控え、オンラインのスナップショットにも載せられるようにする。
 battedPending=BATTED_PLAY_KINDS.includes(k)?battedDataOf(info,k==='gr'):null;
 if(!battedPending)hideBattedCard(); // 前の打球のカードが残っていたら消す (通常進行では飛行終了時に消えている)
 if(G.pitch)G.prevPitch={type:G.pitch.type,res:k}; // CPU配球(空振りした球の連投など)が参照する
 if(typeof learnFromPitch==='function')learnFromPitch(k); // CPUの学習(相手の傾向を読む)が参照する
 if(k==='ball')return resultBall(ms,info);
 if(k==='look'||k==='miss')return resultStrike(k,ms,info);
 if(k==='foul')return resultFoul(ms,info);
 // 守備到達判定 (Ver.1.8.0): 物理モデルのインプレー打球は、抽選で決まった結果ではなく
 // 野手の到達シミュレーション (fielding.js) で結果を決め直す。判定できない打球
 // (テーブル方式・角度や速度が無い場合) は従来の経路に落とす。
 if(typeof CONFIG!=='undefined'&&CONFIG.batMode==='physics'&&typeof resolveBattedBall==='function'&&['gr','fly','1B','2B','3B','HR'].includes(k)){
  const play=resolveBattedBall(info);
  if(play){
   if(play.k==='gr')return resultGround(ms,info,play);
   if(play.k==='fly')return resultFly(ms,info,play);
   return hit(play.k,ms,info,play);
  }
 }
 if(k==='gr')return resultGround(ms,info);
 if(k==='fly')return resultFly(ms,info);
 return hit(k,ms,info);
}

function nrst(to,ids){let m=1e9,r=ids[0];ids.forEach(j=>{const q=Math.hypot(FD[j][0]-to.x,FD[j][1]-to.y);if(q<m){m=q;r=j}});return r}

function hit(k, ms, info, play) {
 const n = {'1B':1, '2B':2, '3B':3, HR:4}[k];
 const a = (info&&info.angle!=null ? cl(info.angle,-44,44) : cl(cl(ms*.3,-38,38)+rnd(-9,9),-42,42))*P/180;

 const edge = (k==='2B'||k==='3B')&&Math.abs(a)>=36*P/180;
 // 到達判定の打球は、壁直撃かどうか・ゴロかどうか・回収位置を判定結果から引き継ぐ
 const wall = play&&play.resolved ? !!play.wall : (k==='2B'||k==='3B')&&!edge;
 const ground = play&&play.resolved ? !!play.ground : edge||(k==='1B'&&Math.random()<.5);

 const d = wall&&!(play&&play.to) ? R-8 : (k==='1B' ? rnd(190,230) : k==='2B' ? rnd(235,290) : k==='3B' ? rnd(295,312) : rnd(345,380));
 const to = play&&play.to ? play.to : {x: 240 + d * Math.sin(a), y: 375 - d * Math.cos(a)};

 // 到達判定で決まった安打は、ファインプレー抽選で覆らない (好捕は判定側で決まる)
 const isFinePlayHit = !(play&&play.resolved) && (k === '1B' || k === '2B') && Math.random() < CONFIG.finePlayHit;

 if (isFinePlayHit) {
  G.outs++;
  banner('ファインプレー！！', 'fine');
  showDetailMsg('fine', ms, info);
  flight(to, 'fly', () => {
   banner('ヒット性の当たりをもぎ取った！', 'fine');
   fin(CONFIG.finePlayLingerMs);
  }, 1, {diving: true, finePlay: true});
  return;
 }

 let r = 0;
 const targetBaseForThrow = chooseHitThrowBase(k);
 
 r = n<=2 ? advRand(k, true) : adv(n, true);
 const batTeam=G.top?0:1;
 const hitPts=k==='1B'?300:k==='2B'?600:k==='3B'?1000:[1200,1500,2000,2500][Math.min(4,Math.max(1,r))-1];
 addMatchPts(batTeam,hitPts+300*r);
 const o = play&&Number.isInteger(play.fi) ? {fi: play.fi, ...(play.ground?{ri: nrst(to, [0, 2, 3, 4, 5])}:k==='1B'?{h: 22}:{}) , ...(wall?{wall:true}:{})} : edge ? {fi: nrst(to, [6, 8]), ri: nrst(to, [2, 5])} : k === '1B' ? {fi: nrst(to, [6, 7, 8]), ...(ground ? {ri: nrst(to, [0, 2, 3, 4, 5])} : {h: 22})} : (k === '2B' || k === '3B') ? {fi: nrst(to, [6, 7, 8]), wall} : null;
 G.hits[G.top ? 0 : 1]++;
 banner({'1B':'ヒット!','2B':'ツーベース!','3B':'スリーベース!',HR:'ホームラン!!'}[k], k==='HR'?'hr':'');
 showDetailMsg(k, ms, info);
 
 const actualTo = outfieldTarget(to);

 const pl = targetBaseForThrow === 0 ? null : throwPlan(actualTo, targetBaseForThrow, o ? o.fi : undefined);
 
 flight(to, k==='HR'?'hr':ground?'ground':'fly', () => {
  score(r);
  if(r) banner(`+${r}点!`, k==='HR'?'hr':'');
  if(pl) G.th = {id: ++pid, t0: performance.now(), steps: pl.steps};
  fin(1200);
 }, 0, {...o, isHit: true});

 if (pl && pl.mv.length) G.rl = {id: ++pid, t0: performance.now(), moves: pl.mv};
}