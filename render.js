/* render.js — 描画(スタジアム・フィールド・ストライクゾーン)とメインループ */
/* ---- stadium background (drawn once) ---- */
const bg=document.createElement('canvas');bg.width=480;bg.height=400;
const bgx=bg.getContext('2d');
let bgDots=null; // 観客席の点々は最初に決め、描き直しても同じ見た目に保つ
function paintBg(){const g=bgx;
 g.fillStyle='#0a1020';g.fillRect(0,0,480,400);
 if(!bgDots){bgDots=[];for(let i=0;i<1100;i++){const x=Math.random()*480,y=Math.random()*400;if(Math.hypot(x-240,y-375)>FENCE_PX+10)bgDots.push([x,y,`hsl(${ri(0,360)},55%,${ri(30,60)}%)`])}}
 for(const dot of bgDots){g.fillStyle=dot[2];g.fillRect(dot[0],dot[1],3,3)}
 g.fillStyle='#17653d';g.beginPath();g.arc(240,375,FENCE_PX,0,2*P);g.fill();
 const wd=r=>{g.beginPath();g.moveTo(240,375);g.arc(240,375,r,-.75*P,-.25*P);g.closePath()};
 wd(FENCE_PX);g.fillStyle='#8a5a3a';g.fill();
 for(let r=FENCE_PX-22,i=0;r>0;r-=24,i++){wd(r);g.fillStyle=i%2?'#2e9a4c':'#38b25a';g.fill()}
 g.save();wd(FENCE_PX-22);g.clip();g.fillStyle='#c88b52';g.beginPath();g.arc(240,300,108,0,2*P);g.fill();g.restore();
 g.fillStyle='#38b25a';g.beginPath();[[240,354],[290,304],[240,256],[190,304]].forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.fill();
 g.fillStyle='#c88b52';g.beginPath();g.arc(240,370,35,0,2*P);g.fill();
 g.fillStyle='#d9a066';g.beginPath();g.arc(240,292,13,0,2*P);g.fill();
 // ファウルライン: 実物の実務どおり、バッターボックスの区間はチョークを引かず途切れさせ、
 // ボックスを過ぎた所から再開する (概念上のライン自体は本塁頂点から真っ直ぐ延びる)。
 g.strokeStyle='#fff';g.lineWidth=2.5;[-1,1].forEach(s=>{g.beginPath();g.moveTo(240+s*37,338);g.lineTo(240+s*FENCE_PX*.7071,375-FENCE_PX*.7071);g.stroke()});
 g.strokeStyle='#ffd23f';g.lineWidth=4;g.beginPath();g.arc(240,375,FENCE_PX,-.75*P,-.25*P);g.stroke();
 g.fillStyle='#fff';BS.slice(1).forEach(b=>g.fillRect(b.x-6,b.y-6,12,12));
 // 本塁は長方形ではなく五角形 (公認野球規則: 投手側の前面17インチ=43.2cm、ファウルラインに沿う2辺が
 // 8.5インチ、その先の2辺が12インチで90°の頂点を作る)。頂点 (捕手側の尖り) を HP (240,375) に置き、
 // 塁 (12px≒38cm) との比率で幅・奥行きとも約13.6px にする。縁は黒いベベルとして一回り大きく下に敷く。
 const platePts=[[240,375],[233.2,368.2],[233.2,361.4],[246.8,361.4],[246.8,368.2]];
 const platePath=(pts)=>{g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.closePath()};
 platePath([[240,376.6],[232.2,368.2],[232.2,360.2],[247.8,360.2],[247.8,368.2]]);g.fillStyle='#22242a';g.fill();
 platePath(platePts);g.fillStyle='#fff';g.fill();
 // バッターボックス (左右): 選手身長 H=57px (塁12px=38.1cm の実寸スケール換算) を単位とする実物比率。
 // 長さ1.011H (実物6フィート) ×幅0.674H (同4フィート)、本塁の平行辺から0.084H (同6インチ) 離し、
 // 長手方向の中心は本塁の肩ライン (前面から8.5インチ後方 = y368.2) に一致させる。
 // 実物の実務どおり内側ライン (本塁寄りの長辺) は引かない (外側・前・後の3辺だけ)。
 // 打者ドット (219/261, 370) はボックス内に収まる。
 g.strokeStyle='#fff';g.lineWidth=2.5;
 const bbW=.674*57,bbL=1.011*57,bbGap=.084*57,bbCy=368.2;
 for(const s of [-1,1]){
  const innerX=240+s*(6.8+bbGap),outerX=innerX+s*bbW,y0=bbCy-bbL/2,y1=bbCy+bbL/2;
  g.beginPath();
  g.moveTo(outerX,y0);g.lineTo(outerX,y1);
  g.moveTo(innerX,y0);g.lineTo(outerX,y0);
  g.moveTo(innerX,y1);g.lineTo(outerX,y1);
  g.stroke();
 }
 // キャッチャーボックス: 幅0.604H×長さ1.348H、後端は本塁頂点の1.348H後方。
 // 2D盤面では本塁後方が盤外にはみ出すため、側線だけを盤の端まで引く (前面は実務でも閉じない)。
 g.beginPath();
 g.moveTo(240-.302*57,375);g.lineTo(240-.302*57,400);
 g.moveTo(240+.302*57,375);g.lineTo(240+.302*57,400);
 g.stroke();
 [[30,26],[450,26]].forEach(([x,y])=>{const r=g.createRadialGradient(x,y,0,x,y,70);r.addColorStop(0,'rgba(255,245,200,.9)');r.addColorStop(1,'rgba(255,245,200,0)');g.fillStyle=r;g.fillRect(x-70,y-70,140,140)});
}
// 背面タブのキャンバスは iOS Safari に破棄されることがあり、一度だけ描く bg は
// 空白のまま二度と直らない。不透明なはずの隅のピクセルで生存を確認し、消えていたら描き直す
function ensureBg(){try{if(bgx.getImageData(10,10,1,1).data[3]===0)paintBg()}catch(e){}}
paintBg();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)ensureBg()});

/* ---- drawing ---- */
function dot(x,y,r,f,s){cx.beginPath();cx.arc(x,y,r,0,7);cx.fillStyle=f;cx.fill();if(s){cx.strokeStyle=s;cx.lineWidth=2;cx.stroke()}}
/* RPMは実球種の平均値を参考にし、画面上では8%に縮尺して回転を見やすくする */
const SPIN={s:{rpm:2241,axis:'screen'},sl:{rpm:-2333,axis:'screen'},c:{rpm:2445,axis:'screen'},f:{rpm:-800,axis:'vertical'},sh:{rpm:2164,axis:'horizontal'},cu:{rpm:1746,axis:'screen'},ct:{rpm:2250,axis:'screen'},ss:{rpm:500,axis:'screen'}};
function spinState(p,t){const s=SPIN[p.type]||SPIN.s,d=(TY[p.type]||TY.s).d,rate=p.type==='sh'?-Math.sign(p.sg||1)*Math.abs(s.rpm):s.rpm,turns=rate*d/60000*.08;return{angle:2*P*turns*cl(t,0,1),axis:s.axis}}
function baseball(c,x,y,r,spin){
 const {angle,axis}=spin;c.save();c.translate(x,y);
 const shade=c.createRadialGradient(-r*.3,-r*.38,r*.08,0,0,r*1.15);shade.addColorStop(0,'#fff');shade.addColorStop(.72,'#fffdf6');shade.addColorStop(1,'#dedbd2');
 c.beginPath();c.arc(0,0,r,0,2*P);c.fillStyle=shade;c.fill();
 c.strokeStyle='#c9c6be';c.lineWidth=Math.max(.55,r*.045);c.stroke();c.clip();
 const drawSeams=()=>{c.strokeStyle='#c83e42';c.lineWidth=Math.max(.75,r*.065);c.lineCap='round';c.lineJoin='round';
  for(const sign of [-1,1]){c.beginPath();c.moveTo(sign*r*.55,-r*.83);c.bezierCurveTo(sign*r*.91,-r*.52,sign*r*.91,r*.52,sign*r*.55,r*.83);c.stroke()}
  if(r>=8){c.lineWidth=Math.max(.65,r*.045);for(let i=0;i<7;i++){
   const t=(i+.5)/7,yy=(t-.5)*r*1.52,sn=Math.sin(Math.PI*t),cs=Math.cos(Math.PI*t),xx=r*(.55+.22*sn),dx=r*.22*Math.PI*cs,dy=r*1.52,norm=Math.hypot(dx,dy),ln=r*.14;
   for(const sign of [-1,1]){const tx=sign*xx,ty=yy,ndx=dy/norm,ndy=-sign*dx/norm;c.beginPath();c.moveTo(tx-ndx*ln/2,ty-ndy*ln/2);c.lineTo(tx+ndx*ln/2,ty+ndy*ln/2);c.stroke()}
  }}
 };
 c.rotate(angle+(axis==='vertical'?P/2:0));drawSeams();
 c.restore()
}
const FSPD=CONFIG.speed.runPx;
function fpos(i,now){const b=FD[i],f=G.fl;
 if(G.rl){const m=G.rl.moves.find(q=>q.i===i);if(m){const e=Math.min(1,Math.max(0,(now-G.rl.t0)/m.T)),k=1-(1-e)*(1-e);return[b[0]+(m.x-b[0])*k,b[1]+(m.y-b[1])*k]}}
 if(!f||f.fi===undefined)return b;
 if(i===f.ri){const q=Math.hypot(f.to.x-b[0],f.to.y-b[1])||1,e=Math.min(1,(now-f.t0)/450);return[b[0]+(f.to.x-b[0])/q*16*e,b[1]+(f.to.y-b[1])/q*16*e]}
 if(i!==f.fi)return b;
 // ダブルプレーの案B: 捕球した二遊間がボールを持って二塁へ走る(送球ステップの carry と同期)
 const th=G.th;
 if(th&&th.steps&&th.steps[0]&&th.steps[0].carry&&now>=th.t0){const p=cl((now-th.t0)/th.steps[0].dur,0,1);return[f.to.x+(BS[2].x-f.to.x)*p,f.to.y+(BS[2].y-f.to.y)*p]}

 const targetTo = f.isHit && i >= 6 ? outfieldTarget(f.to) : f.to;

 // 移動先の上限はフェンス (FENCE_PX) の僅か内側まで。落下点まで野手が届く見た目にする
 // (旧 R-14=306px クリップでは、柵際の落下点まで行っていないのに捕球扱いに見えた)
 const dx=targetTo.x-HP.x,dy=targetTo.y-HP.y,k=Math.min(1,(FENCE_PX-3)/Math.hypot(dx,dy)),tx=HP.x+dx*k,ty=HP.y+dy*k,d=Math.hypot(tx-b[0],ty-b[1]);
 let T=d/FSPD;if(f.out)T=Math.min(T,f.dur*.92);
 const p=T>0?Math.min(1,(now-f.t0)/T):1,e=1-(1-p)*(1-p);
 // ダイブ/スライドのランジは固定の斜め方向ではなく、着地点 (移動方向) へ体を投げ出す。
 // 方向がズレるとボールと無関係な向きへ跳んで見えるため、移動の単位ベクトルに沿わせる。
 const dive=(f.diving&&p>.6)?Math.sin((p-.6)*2.5*P)*10:0;
 const slide=(f.sliding&&p>.6)?Math.sin((p-.6)/.4*P)*6:0;
 return[b[0]+(tx-b[0])*e+(dive+slide)*(d>0?(tx-b[0])/d:0),b[1]+(ty-b[1])*e+(dive+slide)*(d>0?(ty-b[1])/d:0)]}

function drawField(now){
 cx.drawImage(bg,0,0);
 // 球審 (本塁審): 黒いシャツ+チャコールグレーのズボン、マスク着用。立ち位置は捕手の真後ろ
 // (本塁の中心線上、横ずれなし。実物のスロットは Taiyo 指示により採用しない)。
 // 捕手より先に描くことで、捕手のドットに少し隠れる「後ろにいる」奥行きも出す。
 // 姿勢 (深くしゃがまず、立って上体を倒す) は3D側で表現する。
 // 右腰のボールバッグは球審だけの装備 (実物どおり右側に1つ)。
 {
  const ux=240,uy=395;
  cx.fillStyle='#26262c';cx.fillRect(ux+4.5,uy+1,5,6.5);
  cx.strokeStyle='rgba(255,255,255,.4)';cx.lineWidth=1;cx.strokeRect(ux+4.5,uy+1,5,6.5);
  dot(ux,uy,6.5,'#17181d','#3b4048');
  cx.fillStyle='#2c313a';cx.fillRect(ux-2.5,uy-6.8,5,3.2); // マスク (投手側の顔前面)
  cx.fillStyle='#2c313a';cx.fillRect(ux-1,uy-3.4,2,2.2);   // スロートガード
 }
 const bt=G.top?0:1;
 FD.forEach((_,i)=>{const[x,y]=fpos(i,now);dot(x,y,6,TC[1-bt],'#fff')});
 const mv=G.mv&&now-G.mv.t0<G.mv.dur?G.mv:null,bm=!!mv&&mv.moves.some(m=>m.a===0);
 const rd=(x,y)=>{cx.save();cx.shadowColor=TC[bt];cx.shadowBlur=14;dot(x,y,8,TC[bt],'#fff');cx.restore()};
 if(mv){mv.stay.forEach(b=>rd(BS[b].x,BS[b].y));mv.moves.forEach(m=>{const el=now-mv.t0;if(m.o&&el>=m.o)return;const q=rpos(m.a,m.b,Math.min(1,el/(m.T||CONFIG.speed.runnerMsPerBase*(m.b-m.a))));rd(q[0],q[1])})}
 else for(let b=1;b<4;b++)if(G.bases&&G.bases[b])rd(BS[b].x,BS[b].y);
 
 const batterSide = G.batterSides ? G.batterSides[G.top ? 0 : 1] : 'right';
 const isRightBatter = (batterSide === 'right');
 const bx = isRightBatter ? 219 : 261;
 const by = 370;
 const sk = (now-G.swingT)/230;
 const a = sk>=0&&sk<1.6 ? -2.2+2.8*Math.min(sk,1) : -1.1;
 const batAngle = isRightBatter ? a : Math.PI - a;

 if(!bm) dot(bx, by, 7, TC[bt], '#fff');
 if(!bm) {
  cx.strokeStyle='#e0b878';
  cx.lineWidth=4;
  cx.beginPath();
  cx.moveTo(bx, by);
  cx.lineTo(bx + 26 * Math.cos(batAngle), by + 26 * Math.sin(batAngle));
  cx.stroke();
 }

 if(G.phase==='pitch'&&G.pitch){const t=cl(G.pitch.t||0,0,1),[px]=bp(G.pitch,t);baseball(cx,240+(px-110)*.45,292+80*t,4.5,spinState(G.pitch,t))}
 if(G.fl&&!G.th){const f=G.fl,p=cl((now-f.t0)/f.dur,0,1),bk=f.wall?cl((now-f.t0-f.dur)/300,0,1)*16:0,ux=f.to.x-HP.x,uy=f.to.y-HP.y,ul=Math.hypot(ux,uy)||1,x=HP.x+ux*p-ux/ul*bk,y=HP.y+uy*p-uy/ul*bk;
  const h=f.kind==='ground'?Math.abs(Math.sin(p*P*5))*8*(1-p):flightHeightPx(f,p);
  cx.fillStyle='rgba(0,0,0,.35)';cx.beginPath();cx.ellipse(x,y,5,2.5,0,0,7);cx.fill();
  dot(x,y-h,4+h/25,'#fff','#c33')}
 
 if(G.th)drawTh(now);
 drawCatchFx(now);
}
// 捕球の瞬間の閃光と土煙 (2D)。3D側のエフェクトと同じ発生条件・タイミングで、表示を切り替えても見えるようにする。
// 粒の配置は黄金角で決定的に散らす (フレームごとに乱数を使うとちらつくため)。
function drawCatchFx(now){
 const f=G.fl;if(!f||!(f.finePlay||f.groundPlay))return;
 const e=now-(f.t0+f.dur),dur=f.finePlay?750:550;
 if(e<0||e>dur)return;
 const k=e/dur,x=f.to.x,y=f.to.y;
 if(f.finePlay&&e<250){
  // 閃光は小さく・薄く・短く (3D側と同方針): 半径は最大15px、250msで消える。
  const fk=e/250,r=6+fk*9;
  const gr=cx.createRadialGradient(x,y,0,x,y,r);
  gr.addColorStop(0,`rgba(255,244,170,${.55*(1-fk)})`);gr.addColorStop(1,'rgba(255,244,170,0)');
  cx.fillStyle=gr;cx.beginPath();cx.arc(x,y,r,0,7);cx.fill();
 }
 const n=f.finePlay?14:9,spread=f.finePlay?20:13;
 for(let i=0;i<n;i++){
  const ang=i*2.399,dist=(4+((i*7)%5)*3)*k+spread*k*((i%3)/2),px=x+Math.cos(ang)*dist,py=y+Math.sin(ang)*dist*.55-k*5,pr=(2.5+k*4)*(1-k*.4);
  cx.fillStyle=`rgba(176,137,84,${.5*(1-k)})`;cx.beginPath();cx.ellipse(px,py,pr,pr*.6,0,0,7);cx.fill();
 }
}

function drawTh(now){const t=G.th;
 if(t.steps){let el=now-t.t0,st=0,pos=null;
  for(const q of t.steps){const a=st+(q.dly||0),b=a+q.dur;
   if(el<a){pos=[q.from.x,q.from.y];break}
   if(el<b){const p=(el-a)/q.dur;pos=[q.from.x+(q.to.x-q.from.x)*p,q.from.y+(q.to.y-q.from.y)*p-(q.carry?0:Math.sin(p*P)*14)];break}
   st=b;pos=[q.to.x,q.to.y]}
  if(pos)dot(pos[0],pos[1],4,'#fff','#c33')}
 else{const p=(now-t.t0)/t.dur;if(p>=0&&p<1){const x=t.from.x+(t.to.x-t.from.x)*p,y=t.from.y+(t.to.y-t.from.y)*p-Math.sin(p*P)*14;dot(x,y,4,'#fff','#c33')}}}

// 観戦者用: カーソルサンプル列を 150ms 遅れで線形補間し、少ない更新頻度でも滑らかに見せる
function specCursorAt(team,now){
 const arr=curSamples[team];if(!arr||!arr.length)return null;
 const target=now-150;
 if(target<=arr[0].t)return arr[0];
 for(let i=1;i<arr.length;i++){
  if(arr[i].t>=target){const a=arr[i-1],b=arr[i],k=(target-a.t)/Math.max(1,b.t-a.t);return{x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,type:b.type}}
 }
 return arr[arr.length-1];
}
function drawSpecCursors(c){
 const now=performance.now(),batTeam=G.top?0:1,pitTeam=1-batTeam;
 if(G.phase==='aim'){
  const pc=specCursorAt(pitTeam,now);
  if(pc){
   const preview={type:pc.type||'s',x:pc.x,y:pc.y,sg:G.pitcherHands?G.pitcherHands[pitTeam]:1},[ex,ey]=bp(preview,1);
   c.save();c.beginPath();for(let i=0;i<=24;i++){const[x,y]=bp(preview,i/24);if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}c.setLineDash([4,4]);c.strokeStyle='rgba(255,176,66,.8)';c.lineWidth=2;c.stroke();c.setLineDash([]);
   c.beginPath();c.arc(ex,ey,4,0,7);c.fillStyle='rgba(255,176,66,.9)';c.fill();c.restore();
   const j=(TY[preview.type]||TY.s).j;
   c.strokeStyle='#ffb042';c.lineWidth=2;c.beginPath();c.arc(ex,ey,j,0,7);c.stroke();
   c.fillStyle='#ffb042';c.font='10px sans-serif';c.fillText('投',ex+j+2,ey+3);
  }
 }
 if(G.phase==='aim'||G.phase==='pitch'||G.phase==='busy'){
  const bc=specCursorAt(batTeam,now);
  if(bc){
   const rr=CONFIG.cursorSize;
   c.strokeStyle='#5ef0ff';c.lineWidth=2;c.beginPath();c.arc(bc.x,bc.y,rr,0,7);c.stroke();
   c.beginPath();c.moveTo(bc.x-rr-6,bc.y);c.lineTo(bc.x+rr+6,bc.y);c.moveTo(bc.x,bc.y-rr-6);c.lineTo(bc.x,bc.y+rr+6);c.stroke();
   c.fillStyle='#5ef0ff';c.font='10px sans-serif';c.fillText('打',bc.x+rr+2,bc.y+3);
  }
 }
}
function drawZone(){const u=44,c=zx;
 c.fillStyle='#0f1a33';c.fillRect(0,0,zc.width,zc.height);
 c.strokeStyle='#1f2f58';c.lineWidth=1;
 for(let i=1;i<5;i++){c.beginPath();c.moveTo(i*u,0);c.lineTo(i*u,220);c.moveTo(0,i*u);c.lineTo(220,i*u);c.stroke()}

 c.strokeStyle='#ffd23f';c.lineWidth=3;c.strokeRect(u,u,3*u,3*u);
 const p=G.pitch;
 // 空振り時は p.t がスイング時点で凍るので球はその位置に止まる。凍結から
 // PITCH_FREEZE_HIDE_MS 経ったら、3D/板の球と同時にパネルの球も消す。
 if(p&&(G.phase==='pitch'||G.phase==='busy')&&!(p.frozenT!=null&&performance.now()>=p.hideAt)){const t=cl(p.t,0,1.2),[x,y]=bp(p,t),r=3+16*Math.min(t,1.1);
  c.strokeStyle='rgba(255,210,63,.6)';c.lineWidth=2;c.beginPath();c.arc(x,y,19,0,7);c.stroke();
  baseball(c,x,y,r,spinState(p,t))}
 
 if(G.net==='spec'){drawSpecCursors(c);return}
 const aimM=G.phase==='aim'&&canPit(),rr=aimM?TY[G.sel].j:CONFIG.cursorSize;let q=G.cur;
 if(aimM){const preview=pitchTarget(),[ex,ey]=bp(preview,1);q={x:ex,y:ey};c.save();c.beginPath();for(let i=0;i<=24;i++){const[x,y]=bp(preview,i/24);if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}c.setLineDash([4,4]);c.strokeStyle='rgba(94,240,255,.75)';c.lineWidth=2;c.stroke();c.setLineDash([]);c.beginPath();c.arc(ex,ey,4,0,7);c.fillStyle='rgba(94,240,255,.85)';c.fill();c.restore()}
 if(!aimM&&!(canBat()&&G.phase!=='idle'&&G.phase!=='over'&&G.phase!=='sent'))return;
 c.strokeStyle='#5ef0ff';c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,rr,0,7);c.stroke();
 c.beginPath();c.moveTo(q.x-rr-6,q.y);c.lineTo(q.x+rr+6,q.y);c.moveTo(q.x,q.y-rr-6);c.lineTo(q.x,q.y+rr+6);c.stroke()
}
let lastLoopErrorAt=0;
function reportLoopError(error,stage){
 const now=performance.now();
 if(now-lastLoopErrorAt>3000){console.error('野球盤 STADIUM: '+stage+'でエラーが発生しました',error);lastLoopErrorAt=now}
}
let loopFrame=0;
function loop(){
 requestAnimationFrame(loop);
 if(++loopFrame%60===0)ensureBg();
 const now=performance.now();
 try{update(now)}catch(error){reportLoopError(error,'ゲーム更新')}
 try{if(typeof render3dIsActive==='function'&&render3dIsActive())render3dUpdate(now);else{cx.clearRect(0,0,cv.width,cv.height);drawField(now)}drawZone()}catch(error){reportLoopError(error,'描画')}
 try{ctl()}catch(error){reportLoopError(error,'操作UI更新')}
}
