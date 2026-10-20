/* batting.js — 打撃判定。数値は config.js の CONFIG で調整 */

// 累積確率テーブルから結果を1つ引く
const roll=t=>{const r=Math.random();for(const [p,k] of t)if(r<p)return k;return t[t.length-1][1]};

function goodQ(side,isLeft,isFast){const g=(isLeft&&isFast)||(!isLeft&&!isFast);return side==='right'?g:!g}

// スイング判定: 空振りか、当たりの種類を返す(CPUローカル/オンライン共通)
// p:投球 ms:ジャストとのズレ(負=早い) bx,by:その瞬間のボール位置 curX,curY:カーソル位置
function batResult(p,ms,bx,by,curX,curY){
 const dd=Math.hypot(bx-curX,by-curY),d=dist(p);
 if(Math.abs(ms)>CONFIG.timingWindowMs||dd>CONFIG.cursorSize||(d>=2&&Math.random()<CONFIG.farZoneMissRate))return 'miss';
 const isUpper=by<curY,isLeft=bx<curX,isFast=ms<0;
 const side=G.batterSides?G.batterSides[G.top?0:1]:'right';
 const good=goodQ(side,isLeft,isFast);
 return roll(CONFIG.hitTable[(good?'good':'bad')+(isUpper?'Upper':'Lower')]);
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
 result(batResult(p,ms,bx,by,G.cur.x,G.cur.y),ms);
}

function cpuBat(){const p=G.pitch,d=dist(p),z=d<=1,rep=p.type===G.last;G.last=p.type;
 let sw=z?(d?.7:.8):(p.type==='f'||p.type==='sh'?.4:.2);if(G.cnt.s==2)sw+=.15;
 if(Math.random()>sw)return take();
 G.swingT=performance.now();
 const c=.72-(p.type==='c'||p.type==='cu'?.1:p.type==='f'?.14:0)-(d==1?.08:0)-(d>=2?.35:0)+(rep?.12:0);
 if(Math.random()>c)return result('miss', 0);
 result(roll(CONFIG.cpuHitTable), 0);
}
