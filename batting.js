/* batting.js — 打撃判定。数値は config.js の CONFIG で調整 */

// 重みテーブル {結果:重み} から結果を1つ引く
const rollW=o=>{let t=0;for(const k in o)t+=o[k];let r=Math.random()*t,last='fly';for(const k in o){last=k;if((r-=o[k])<0)return k}return last};

const clamp01=v=>Math.max(0,Math.min(1,v));

// ミート度(0〜1): タイミングとカーソルのズレから。1=ジャストでボールのど真ん中
function meetOf(ms,dd){
 const tq=clamp01(1-Math.abs(ms)/CONFIG.timingWindowMs),dq=clamp01(1-dd/CONFIG.cursorSize);
 return Math.pow(tq,CONFIG.meetTimingPow)*Math.pow(dq,CONFIG.meetDistPow);
}
const tierOf=m=>m>=CONFIG.meetSolid?'solid':m>=CONFIG.meetNormal?'normal':'weak';

// スイング判定(CPUローカル/オンライン共通)。戻り値 {k:結果, meet, tier, angle}
// p:投球 ms:ジャストとのズレ(負=早い) bx,by:その瞬間のボール位置 curX,curY:カーソル位置
function batResult(p,ms,bx,by,curX,curY){
 const C=CONFIG,dd=Math.hypot(bx-curX,by-curY),d=dist(p);
 if(!isFinite(ms)||!isFinite(dd)||Math.abs(ms)>C.timingWindowMs||dd>C.cursorSize||(d>=2&&Math.random()<C.farZoneMissRate))return {k:'miss'};
 const meet=meetOf(ms,dd),tier=tierOf(meet);
 const lift=(curY-by)/C.cursorSize,traj=lift>C.liftBand?'up':lift<-C.liftBand?'down':'flat';
 // 方向: 早い=引っ張り(右打者は画面左、左打者は右)。コースのズレも加え、ミート度が低いほどブレる
 const sgn=(G.batterSides?G.batterSides[G.top?0:1]:'right')==='left'?-1:1;
 const angle=sgn*(ms*C.dirTimingGain+(bx-curX)/C.cursorSize*C.dirCourseGain)+rnd(-1,1)*C.dirNoiseDeg*(1-meet);
 if(Math.abs(angle)>C.foulAngleDeg)return {k:'foul',meet,tier,angle};
 return {k:rollW(C.hitTable[tier][traj]),meet,tier,angle};
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
 const ms=now-p.t0-p.dur,[bx,by]=bp(p,p.t);
 const r=batResult(p,ms,bx,by,G.cur.x,G.cur.y);
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
