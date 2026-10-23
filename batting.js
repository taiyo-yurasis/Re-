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

// 従来方式(CPUローカル/オンライン共通)。hitTable による結果抽選
// p:投球 ms:ジャストとのズレ(負=早い) curX,curY:カーソル位置
// 距離・高さは投球の着地点(ボールが届く位置)とカーソルで決める。ボールが途中のどこにいるかは関係ない(早い・遅いはタイミング点だけに効く)
function batResultTable(p,ms,curX,curY){
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


/*
 * 物理モデル:
 * 1) コースに応じた理想タイミングとミート度
 * 2) 打球方向・打球角度・打球速度
 * 3) 推定飛距離から打球結果を判定
 */
function batResultPhysics(p,ms,curX,curY){
 const C=CONFIG,J=C.judge||{},F=C.phys||{};
 const [lx]=bp(p,1),judge=judgeRef(p,ms,curX,curY),dd=judge.dd,d=dist(p);
 // 空振り条件は従来方式を維持する。
 if(!isFinite(ms)||!isFinite(dd)||Math.abs(ms)>C.timingWindowMs||dd>C.cursorSize)return {k:'miss'};
 if(d>=2&&Math.random()<C.farZoneMissRate)return {k:'miss'};

 const sgn=(G.batterSides?G.batterSides[G.top?0:1]:'right')==='left'?-1:1;
 const off=(lx-110)*sgn;
 const courseN=cl(off/66,-1,1);
 const err=ms-C.courseIdealMs*courseN;
 const tq=clamp01(1-Math.abs(err)/C.timingWindowMs);
 const dx=curX-judge.rx,dy=curY-judge.ry;
 const dq=clamp01(1-Math.hypot(dx,dy*C.meetVertWeight)/C.cursorSize);
 const noise=rnd(-1,1)*C.meetNoiseX*Math.min(1,Math.abs(dx)/C.cursorSize);
 const baseMeet=clamp01(Math.pow(tq,C.meetTimingPow)*Math.pow(dq,C.meetDistPow)+noise);

 // 球種固有の補正はミート段階で一度だけ適用する。
 const bonusOn=!!(J.bonus&&J.bonus[p.type]);
 const correctionScale=Number.isFinite(C.physicsCorrectionScale)?C.physicsCorrectionScale:1;
 const correctedMeet=bonusOn
  ?Math.min(1,baseMeet*(1+judge.bonusRate*correctionScale))
    *(1-judge.latePenalty*correctionScale*judge.lateRate)
  :baseMeet;
 const meet=clamp01(correctedMeet);
 const tier=tierOf(meet);

 // 打球方向。角度は画面右が正。courseShift は物理モデルでは適用しない。
 const angle=sgn*(courseN*C.dirCourseDeg+err*C.dirTimingGain)
  +rnd(-1,1)*C.dirNoiseDeg*(1-meet);
 const pl=-sgn*angle;
 const dir=pl>C.centerDeg?'pull':pl<-C.centerDeg?'oppo':'center';
 const course=off<-C.courseThird?'in':off>C.courseThird?'out':'mid';
 if(Math.abs(angle)>C.foulAngleDeg)return {k:'foul',meet,tier,tier0:tier,angle,dir,course};

 // ボールより下側を振るほど打球角度が上がる。
 const lift=(curY-judge.ry)/C.cursorSize;
 const dz=Math.sign(lift)*Math.max(0,Math.abs(lift)-F.dead);
 const launch=F.baseAng+F.angK*dz+rnd(-1,1)*(1-meet)*F.nAng;
 const speed=Math.max(30,
  (F.spdMin+F.spdRange*meet)*(1-F.spdLoss*Math.pow(Math.abs(lift),1.5))
  +rnd(-1,1)*(1-meet)*F.nSpd);

 let k,distMeters=0;
 if(launch<F.groundAng){
  const hitChance=F.gHitMax*clamp01((speed-F.gHitFrom)/(F.gHitTo-F.gHitFrom));
  k=Math.random()<hitChance?'1B':'gr';
 }else{
  const angleForDistance=Math.min(launch,89);
  const velocity=speed/3.6;
  distMeters=velocity*velocity*Math.sin(2*angleForDistance*Math.PI/180)/9.8*F.distK;
  if(distMeters<F.inField)k='fly';
  else if(distMeters>=F.hrMin)k='HR';
  else if(distMeters>=F.hitMax){
   const tripleAt=F.hitMax+(F.hrMin-F.hitMax)*F.tripleRatio;
   k=launch<F.linerAng&&distMeters>=tripleAt?'3B':'2B';
  }else k=launch<F.linerAng?'1B':'fly';
 }
 return {k,meet,tier,tier0:tier,angle,dir,course,launch,speed,dist:distMeters};
}

// CPU・オンライン・練習モード共通の入口。旧方式も設定で利用できる。
function batResult(p,ms,curX,curY){
 return CONFIG.batMode==='table'
  ?batResultTable(p,ms,curX,curY)
  :batResultPhysics(p,ms,curX,curY);
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

function cpuNormalError(sd){const u=Math.max(1e-9,Math.random()),v=Math.random();return sd*Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}

// CPUもプレイヤーと同じ batResult() を使い、難易度は操作誤差と見極めで調整する。
function cpuBat(){
 const p=G.pitch;if(!p)return;
 const level=cl(Number(cfgCpuDifficulty)||2,1,4),D=CPU_DIFFICULTY[level]||CPU_DIFFICULTY[2],d=dist(p),rep=p.type===G.last;G.last=p.type;
 let sw=d===0?D.swingZone:d===1?D.swingEdge:D.swingOutside;
 if(G.cnt.s===2)sw+=.15;
 if(Math.random()>=cl(sw,0,.98))return take();
 const typeFactor=p.type==='c'||p.type==='cu'?1.12:p.type==='f'?1.08:1;
 const ms=cpuNormalError(D.timingError*typeFactor*(rep?.88:1));
 const [x,y]=bp(p,1),curX=cl(x+cpuNormalError(D.positionError),0,220),curY=cl(y+cpuNormalError(D.positionError),0,220);
 G.swingT=performance.now();
 const r=batResult(p,ms,curX,curY);
 result(r.k,ms,r);
}