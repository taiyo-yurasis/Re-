function addMatchPts(team,points){G.pts[team]=(G.pts[team]||0)+points}
/* plays.js — 打った後の処理(アウト/ヒット/四球・走者の進塁・送球) */
function throwPlan(to, targetBase){
 const tp = targetBase === 4 ? {x: HP.x, y: HP.y} : {x: BS[targetBase].x, y: BS[targetBase].y};
 const L = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), dd = L(to, tp), relay = dd >= 130 && Math.random() < cl((dd - 130) / 140, .25, .85);
 const cov = targetBase === 2 ? 4 : targetBase === 3 ? 5 : 1, rm = targetBase === 4 ? 2 : 3, mv = [], sp = .55;
 let R = null;
 if(relay){R = {x: tp.x + (to.x - tp.x) * .4, y: tp.y + (to.y - tp.y) * .4}; mv.push({i: rm, x: R.x, y: R.y, T: Math.max(500, Math.hypot(FD[rm][0] - R.x, FD[rm][1] - R.y) / .1)})}
 if(cov !== 1) mv.push({i: cov, x: tp.x, y: tp.y, T: Math.max(500, Math.hypot(FD[cov][0] - tp.x, FD[cov][1] - tp.y) / .1)});
 const steps = R ? [{from: to, to: R, dur: Math.max(220, L(to, R) / sp)}, {from: R, to: tp, dur: Math.max(200, L(R, tp) / sp), dly: 150}] : [{from: to, to: tp, dur: Math.max(250, L(to, tp) / sp)}];
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
 const candidates=kind==='ground'?[2,3,4,5]:[6,7,8,2,3,4,5];
 if(kind==='ground'&&Math.hypot(to.x-240,to.y-310)<50)candidates.push(0);
 return nrst(to,candidates);
}
function flight(to,kind,cb,out,o){
 const d=Math.hypot(to.x-HP.x,to.y-HP.y),dur=kind==='ground'?300+d*3.2:500+d*2.6,opts=o||{};
 G.fl={id:++pid,out:!!out,t0:performance.now(),dur,to,kind,fi:opts.fi??pickFielder(to,kind),h:kind==='hr'?130:30+d*.35,...opts};
 sync();later(dur+250,cb)
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
function mvAdd(m){const t=performance.now();if(!G.mv||t-G.mv.t0>G.mv.dur)G.mv={id:++pid,t0:t,dur:0,moves:[],stay:[1,2,3].filter(b=>G.bases[b])};G.mv.moves.push(m);G.mv.dur=Math.max(G.mv.dur,m.T||(m.b-m.a)*580)}

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
 const T=F+(ground?630:500),r=forceAdv(T);
 flight(to,ground?'ground':'fly',()=>{
  if(isHit){G.hits[G.top?0:1]++;addMatchPts(G.top?0:1,300+300*r);banner('内野安打!');showDetailMsg('ih',ms,info)}
  else{banner('エラー!');showDetailMsg('err',ms,info)}
  score(r);
  if(r)banner(`+${r}点!`);
  if(G.fl){
   const pl=throwPlan(G.fl.to,1);
   G.th={id:++pid,t0:performance.now(),steps:pl.steps};
   if(pl.mv.length)G.rl={id:++pid,t0:performance.now(),moves:pl.mv};
  }
  fin(800)},1);
}

// 元からいた走者を確率で進塁させる(打者は1B/2Bのときだけ bat=true で加える)。kind: '1B' | '2B' | 'gr'
function advRand(kind,bat){
 const C=CONFIG,targets={};
 for(let b=1;b<=3;b++){
  if(!G.bases[b])continue;
  if(kind==='1B')targets[b]=b===3?4:b===2?(Math.random()<C.run1BSecondHome?4:3):(Math.random()<C.run1BFirstThird?3:2);
  else if(kind==='2B')targets[b]=b>=2?4:(Math.random()<C.run2BFirstHome?4:3);
  else targets[b]=b===3?(Math.random()<C.runGrThirdHome?4:3):b===2?(Math.random()<C.runGrSecondThird?3:2):2;
 }
 const result=settle(targets,bat?(kind==='2B'?2:1):null);
 applyRunnerResult(result);
 return result.runs;
}

function walk(){
 const r=forceAdv(580);
 addMatchPts(G.top?0:1,50+300*r);score(r);if(r)banner(`+${r}点!`)
}

function showDetailMsg(k, ms, info) {
 const p = G.pitch;
 const typeName = p && TY_NAMES[p.type] ? TY_NAMES[p.type] : '球種不明';
 const actions = {
  ball: 'ボール',
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
  const absMs = Math.abs(ms);
  const timing = absMs >= CONFIG.labelNearMs
   ? (ms < 0 ? '早すぎ' : '遅すぎ')
   : absMs >= CONFIG.labelPerfectMs
    ? (ms < 0 ? '少し早い' : '少し遅い')
    : '完璧';
  parts.push(`タイミング：${timing}`);
  if (k === 'miss') parts.push('ミート：空振り');
  else if (info && info.tier && CONFIG.tierLabels[info.tier]) parts.push(`ミート：${CONFIG.tierLabels[info.tier]}`);
 }
 if (info && info.dir) {
  const direction = {pull:'引っ張り',center:'センター',oppo:'流し'}[info.dir];
  if (direction) parts.push(`方向：${direction}`);
 }
 setMsg(parts.join(' ｜ '));
}

function result(k,ms,info){if(G.prac)return pracResult(k,ms,info);const c=G.cnt;
 if(k==='ball'){c.b++;if(c.b>=4){banner('フォアボール');walk();return fin(1100)}showDetailMsg('ball', null);return next(800)}
 if(k==='look'||k==='miss'){c.s++;const m=k==='miss';
  if(c.s>=3){banner(m?'空振り三振!':'見逃し三振!');G.outs++;addMatchPts(G.top?1:0,40);showDetailMsg(k, ms);return fin(1200)}
  showDetailMsg(k, ms);return next(800)}
 if(k==='foul'){if(c.s<2)c.s++;const hasA=info&&info.angle!=null,ad=hasA?cl(Math.abs(info.angle),46,78):rnd(46,78),a=(hasA?(info.angle<0?-1:1):(Math.random()<.5?-1:1))*ad*P/180,d=rnd(90,200),to={x:240+d*Math.sin(a),y:375-d*Math.cos(a)},cp=ad<66?(66-ad)/20*.6:0;
  banner('ファウル');if(Math.random()<cp){banner('ファウルフライ!');flight(to,'fly',()=>{G.outs++;banner('ファウルフライアウト');showDetailMsg('foul', ms, info);fin(1000)},1);return}
  showDetailMsg('foul', ms, info);flight(to,'fly',()=>next(200));return}
 if(k==='gr'){const a=(info&&Number.isFinite(info.angle)?cl(info.angle,-44,44):rnd(-35,35))*P/180,d=rnd(70,130);banner('ゴロ!');
  const roll=Math.random(),gto={x:240+d*Math.sin(a),y:375-d*Math.cos(a)};
  if(roll<CONFIG.errorRate)return safeAtFirst('gr',gto,ms,false,info);
  if(roll<CONFIG.errorRate+CONFIG.infieldHitRate)return safeAtFirst('gr',gto,ms,true,info);
  const dp=G.bases[1]&&G.outs<2&&Math.random()<.35,end=G.outs+1+(dp?1:0)>=3;let r=0;
  const dpAdvancesSecond=!!(dp&&!end&&G.bases[2]&&!G.bases[3]);
  if(dp)G.bases[1]=0;if(!end)r=advRand('gr',false);else if(G.outs===2)adv(1,false);
  if(dpAdvancesSecond){r=0;G.bases=[0,0,0,1];G.mv={id:++pid,t0:performance.now(),dur:580,moves:[{a:2,b:3}],stay:[]}}
  flight({x:240+d*Math.sin(a),y:375-d*Math.cos(a)},'ground',()=>{
   G.outs++;let m='ゴロアウト';if(dp){G.outs++;addMatchPts(G.top?1:0,70);m='ダブルプレー!'}
   score(r);
   banner(m);
   if(r)banner(`+${r}点!`);
   if(G.fl) {
    if(dp) {
     G.th = {
      id: ++pid,
      t0: performance.now(),
      steps: [
       {from: G.fl.to, to: BS[2], dur: 250},
       {from: BS[2], to: BS[1], dur: 250}
      ],
      currentStep: 0
     };
    } else {
     G.th = {id:++pid, t0:performance.now(), dur:380, from:G.fl.to, to:BS[1]};
    }
   }
   showDetailMsg('gr', ms, info);fin(800)},1);
  const o=G.fl.dur+250+380;mvAdd({a:0,b:1,T:o+100,o});if(dp)mvAdd({a:1,b:2,T:o+100,o});return}
 if(k==='fly'){const a=(info&&Number.isFinite(info.angle)?cl(info.angle,-44,44):rnd(-38,38))*P/180,d=rnd(160,270);banner('フライ!');
  if(Math.random()<CONFIG.errorRate)return safeAtFirst('fly',{x:240+d*Math.sin(a),y:375-d*Math.cos(a)},ms,false,info);
  
  const isFinePlay = Math.random() < CONFIG.finePlayFly;
  
  const thirdOutAtContact=G.outs===2;
  if(thirdOutAtContact)adv(1,false);
  flight({x:240+d*Math.sin(a),y:375-d*Math.cos(a)},'fly',()=>{
   G.outs++;
   let m = isFinePlay ? 'ファインプレー!!' : 'フライアウト';
   let scoredRuns=0;
   if(G.outs>=3){/* 走者は打球時点で進塁を開始済み。第3アウト後の追加進塁・得点は行わない。 */}
   else if(!isFinePlay){const C=CONFIG;let sf=false;
    if(G.bases[3]&&Math.random()<(d>=C.sacFlyDepthDeep?C.sacFlyDeepRate:d>=C.sacFlyDepthMid?C.sacFlyMidRate:C.sacFlyShallowRate)){G.bases[3]=0;mvAdd({a:3,b:4});G.mv.stay=G.mv.stay.filter(x=>x!==3);addMatchPts(G.top?0:1,450);scoredRuns=1;sf=true;m='犠牲フライ!'}
    if(G.bases[2]&&!G.bases[3]&&d>=C.tagUpDepth&&Math.random()<C.tagUpSecondRate){G.bases[2]=0;mvAdd({a:2,b:3});G.bases[3]=1;G.mv.stay=G.mv.stay.filter(x=>x!==2);if(!sf)m='タッチアップ!'}}
   banner(m, isFinePlay ? 'hr' : '');
   if(scoredRuns){score(scoredRuns);banner(`+${scoredRuns}点!`);}
   showDetailMsg('fly', ms, info);
   fin(1000);
  }, 1, isFinePlay ? {diving:true} : null);
  return;}
 hit(k,ms,info)}

function nrst(to,ids){let m=1e9,r=ids[0];ids.forEach(j=>{const q=Math.hypot(FD[j][0]-to.x,FD[j][1]-to.y);if(q<m){m=q;r=j}});return r}

function hit(k, ms, info) {
 const n = {'1B':1, '2B':2, '3B':3, HR:4}[k];
 const a = (info&&info.angle!=null ? cl(info.angle,-44,44) : cl(cl(ms*.3,-38,38)+rnd(-9,9),-42,42))*P/180;
 
 const edge = (k==='2B'||k==='3B')&&Math.abs(a)>=36*P/180;
 const wall = (k==='2B'||k==='3B')&&!edge;
 const ground = edge||(k==='1B'&&Math.random()<.5);
 
 const d = wall ? R-8 : (k==='1B' ? rnd(190,230) : k==='2B' ? rnd(235,290) : k==='3B' ? rnd(295,312) : rnd(345,380));
 const to = {x: 240 + d * Math.sin(a), y: 375 - d * Math.cos(a)};
 
 const isFinePlayHit = (k === '1B' || k === '2B') && Math.random() < CONFIG.finePlayHit;

 if (isFinePlayHit) {
  G.outs++;
  banner('ファインプレー！！', 'hr');
  showDetailMsg('fine', ms, info);
  flight(to, 'fly', () => {
   banner('ヒット性の当たりをもぎ取った！');
   fin(1200);
  }, 1, {diving: true});
  return;
 }

 let r = 0;
 const targetBaseForThrow = chooseHitThrowBase(k);
 
 r = n<=2 ? advRand(k, true) : adv(n, true);
 const batTeam=G.top?0:1;
 const hitPts=k==='1B'?300:k==='2B'?600:k==='3B'?1000:[1200,1500,2000,2500][Math.min(4,Math.max(1,r))-1];
 addMatchPts(batTeam,hitPts+300*r);
 const o = edge ? {fi: nrst(to, [6, 8]), ri: nrst(to, [2, 5])} : k === '1B' ? {fi: nrst(to, [6, 7, 8]), ...(ground ? {ri: nrst(to, [0, 2, 3, 4, 5])} : {h: 22})} : (k === '2B' || k === '3B') ? {fi: nrst(to, [6, 7, 8]), wall} : null;
 G.hits[G.top ? 0 : 1]++;
 banner({'1B':'ヒット!','2B':'ツーベース!','3B':'スリーベース!',HR:'ホームラン!!'}[k], k==='HR'?'hr':'');
 showDetailMsg(k, ms, info);
 
 const actualTo = outfieldTarget(to);

 const pl = targetBaseForThrow === 0 ? null : throwPlan(actualTo, targetBaseForThrow);
 
 flight(to, k==='HR'?'hr':ground?'ground':'fly', () => {
  score(r);
  if(r) banner(`+${r}点!`, k==='HR'?'hr':'');
  if(pl) G.th = {id: ++pid, t0: performance.now(), steps: pl.steps};
  fin(1200);
 }, 0, {...o, isHit: true});

 if (pl && pl.mv.length) G.rl = {id: ++pid, t0: performance.now(), moves: pl.mv};
}