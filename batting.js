/* batting.js — 打撃判定。数値は config.js の CONFIG で調整 */

// 重みテーブル {結果:重み} から結果を1つ引く
const rollW=o=>{let t=0;for(const k in o)t+=o[k];let r=Math.random()*t,last='fly';for(const k in o){last=k;if((r-=o[k])<0)return k}return last};

const clamp01=v=>Math.max(0,Math.min(1,v));
const pitchSetting=(value,type)=>typeof value==='number'?value:(value&&Number.isFinite(value[type])?value[type]:0);

// ミート度(0〜1): タイミングとカーソルのズレから。1=ジャストでボールのど真ん中
function meetOf(ms,dd){
 const tq=clamp01(1-Math.abs(ms)/CONFIG.timingWindowMs),dq=clamp01(1-dd/CONFIG.cursorSize);
 return Math.pow(tq,CONFIG.meetTimingPow)*Math.pow(dq,CONFIG.meetDistPow);
}

// 共通の判定基準。方式Aは距離・高さの基準点を選び、方式Bは球種別のボーナス/遅れ率を返す。
function judgeRef(p,ms,curX,curY){
 const [lx,ly]=bp(p,1),[bx,by]=bp(p,1+ms/p.dur),J=CONFIG.judge||{};
 const nearer=!!(J.nearer&&J.nearer[p.type]);
 const usedBall=nearer&&Math.hypot(bx-curX,by-curY)<Math.hypot(lx-curX,ly-curY);
 const rx=usedBall?bx:lx,ry=usedBall?by:ly;
 const dd=Math.hypot(rx-curX,ry-curY),ballDist=Math.hypot(bx-lx,by-ly);
 const bonusOn=!!(J.bonus&&J.bonus[p.type]);
 const bq=bonusOn&&J.bonusRadius>0?clamp01(1-ballDist/J.bonusRadius):0;
 const bonusRate=bonusOn?Math.max(0,pitchSetting(J.bonusMax,p.type))*bq:0;
 const lateRate=bonusOn&&ms>0?clamp01(ms/CONFIG.timingWindowMs):0;
 const latePenalty=bonusOn?Math.max(0,pitchSetting(J.latePenalty,p.type)):0;
 return {rx,ry,usedBall,dd,ballDist,bonusRate,lateRate,latePenalty};
}
const tierOf=m=>m>=CONFIG.meetSolid?'solid':m>=CONFIG.meetNormal?'normal':'weak';

// スイング判定(CPUローカル/オンライン共通)。戻り値 {k:結果, meet, tier, angle}
// p:投球 ms:ジャストとのズレ(負=早い) curX,curY:カーソル位置
// 距離・高さは投球の着地点(ボールが届く位置)とカーソルで決める。ボールが途中のどこにいるかは関係ない(早い・遅いはタイミング点だけに効く)
function batResult(p,ms,curX,curY){
 const C=CONFIG,[lx]=bp(p,1),judge=judgeRef(p,ms,curX,curY),dd=judge.dd,d=dist(p);
 if(!isFinite(ms)||!isFinite(dd)||Math.abs(ms)>C.timingWindowMs||dd>C.cursorSize)return {k:'miss'};
 if(d>=2&&Math.random()<C.farZoneMissRate)return {k:'miss'};
 const baseMeet=meetOf(ms,dd),J=C.judge||{};
 const meet=J.bonus&&J.bonus[p.type]?Math.min(1,baseMeet*(1+judge.bonusRate))*(1-judge.latePenalty*judge.lateRate):baseMeet;
 const tier=tierOf(meet);
 const lift=(curY-judge.ry)/C.cursorSize,traj=lift>C.liftBand?'up':lift<-C.liftBand?'down':'flat';
 // 方向: タイミングだけで決まる(早い=引っ張り。右打者は画面左、左打者は右)。ミート度が低いほどブレる
 const sgn=(G.batterSides?G.batterSides[G.top?0:1]:'right')==='left'?-1:1;
 const angle=sgn*ms*C.dirTimingGain+rnd(-1,1)*C.dirNoiseDeg*(1-meet);
 if(Math.abs(angle)>C.foulAngleDeg)return {k:'foul',meet,tier,angle};
 // 方向(引っ張り/センター/流し)× 投球のコース(内角/真ん中/外角)でミート段階を補正
 const pl=-sgn*angle,dir=pl>C.centerDeg?'pull':pl<-C.centerDeg?'oppo':'center';
 const off=(lx-110)*sgn,course=off<-C.courseThird?'in':off>C.courseThird?'out':'mid';
 const shift=(dir==='pull'&&course==='in')||(dir==='oppo'&&course==='out')?C.courseShift:(dir==='pull'&&course==='out')||(dir==='oppo'&&course==='in')?-C.courseShift:0;
 const TIERS=['weak','normal','solid'],tier2=TIERS[Math.max(0,Math.min(2,TIERS.indexOf(tier)+shift))];
 return {k:rollW(C.hitTable[tier2][traj]),meet,tier:tier2,tier0:tier,angle,dir,course};
}

function swing(){
 if(G.phase!=='pitch'||!canBat())return;
 if(G.net==='guest'){
  const p=G.pitch;if(!p||p.swung)return;p.swung=1;G.swingT=performance.now();
  send('swing',{t:(performance.now()-p.t0)/p.dur,x:G.cur.x,y:G.cur.y});
  return;
 }
 const now=performance.now(),p=G.pitch;
 p.t=(now-p.t0)/p.dur;G.phase='busy';G.swingT=now;
 const ms=now-p.t0-p.dur;
 const r=batResult(p,ms,G.cur.x,G.cur.y);
 result(r.k,ms,r);
}

function cpuBat(){const p=G.pitch,d=dist(p),z=d<=1,rep=p.type===G.last;G.last=p.type;
 let sw=z?(d?.7:.8):(p.type==='f'||p.type==='sh'?.4:.2);if(G.cnt.s==2)sw+=.15;
 if(Math.random()>sw)return take();
 G.swingT=performance.now();
 const c=.72-(p.type==='c'||p.type==='cu'?.1:p.type==='f'?.14:0)-(d==1?.08:0)-(d>=2?.35:0)+(rep?.12:0);
 if(Math.random()>c)return result('miss', null);
 result(Math.random()<CONFIG.cpuFoulRate?'foul':rollW(CONFIG.cpuHitTable), null);
}