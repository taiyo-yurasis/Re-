/* render.js — 描画(スタジアム・フィールド・ストライクゾーン)とメインループ */
/* ---- stadium background (drawn once) ---- */
const bg=document.createElement('canvas');bg.width=480;bg.height=400;
(()=>{const g=bg.getContext('2d');
 g.fillStyle='#0a1020';g.fillRect(0,0,480,400);
 for(let i=0;i<1100;i++){const x=Math.random()*480,y=Math.random()*400;if(Math.hypot(x-240,y-375)>R+10){g.fillStyle=`hsl(${ri(0,360)},55%,${ri(30,60)}%)`;g.fillRect(x,y,3,3)}}
 g.fillStyle='#17653d';g.beginPath();g.arc(240,375,R+6,0,2*P);g.fill();
 const wd=r=>{g.beginPath();g.moveTo(240,375);g.arc(240,375,r,-.75*P,-.25*P);g.closePath()};
 wd(R+6);g.fillStyle='#8a5a3a';g.fill();
 for(let r=R-16,i=0;r>0;r-=24,i++){wd(r);g.fillStyle=i%2?'#2e9a4c':'#38b25a';g.fill()}
 g.save();wd(R-16);g.clip();g.fillStyle='#c88b52';g.beginPath();g.arc(240,300,108,0,2*P);g.fill();g.restore();
 g.fillStyle='#38b25a';g.beginPath();[[240,354],[290,304],[240,256],[190,304]].forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));g.fill();
 g.fillStyle='#c88b52';g.beginPath();g.arc(240,372,26,0,2*P);g.fill();
 g.fillStyle='#d9a066';g.beginPath();g.arc(240,292,13,0,2*P);g.fill();
 g.strokeStyle='#fff';g.lineWidth=2;[-1,1].forEach(s=>{g.beginPath();g.moveTo(240,375);g.lineTo(240+s*(R+6)*.7071,375-(R+6)*.7071);g.stroke()});
 g.strokeStyle='#ffd23f';g.lineWidth=4;g.beginPath();g.arc(240,375,R+6,-.75*P,-.25*P);g.stroke();
 g.fillStyle='#fff';BS.slice(1).forEach(b=>g.fillRect(b.x-6,b.y-6,12,12));g.fillRect(235,370,10,8);
 [[30,26],[450,26]].forEach(([x,y])=>{const r=g.createRadialGradient(x,y,0,x,y,70);r.addColorStop(0,'rgba(255,245,200,.9)');r.addColorStop(1,'rgba(255,245,200,0)');g.fillStyle=r;g.fillRect(x-70,y-70,140,140)});
})();

/* ---- drawing ---- */
function dot(x,y,r,f,s){cx.beginPath();cx.arc(x,y,r,0,7);cx.fillStyle=f;cx.fill();if(s){cx.strokeStyle=s;cx.lineWidth=2;cx.stroke()}}
/* RPMは実球種の平均値を参考にし、画面上では8%に縮尺して回転を見やすくする */
const SPIN={s:{rpm:2241,axis:'screen'},sl:{rpm:-2333,axis:'screen'},c:{rpm:2445,axis:'screen'},f:{rpm:-800,axis:'vertical'},sh:{rpm:2164,axis:'horizontal'},cu:{rpm:1746,axis:'screen'}};
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
const FSPD=.07;
function fpos(i,now){const b=FD[i],f=G.fl;
 if(G.rl){const m=G.rl.moves.find(q=>q.i===i);if(m){const e=Math.min(1,Math.max(0,(now-G.rl.t0)/m.T)),k=1-(1-e)*(1-e);return[b[0]+(m.x-b[0])*k,b[1]+(m.y-b[1])*k]}}
 if(!f||f.fi===undefined)return b;
 if(i===f.ri){const q=Math.hypot(f.to.x-b[0],f.to.y-b[1])||1,e=Math.min(1,(now-f.t0)/450);return[b[0]+(f.to.x-b[0])/q*16*e,b[1]+(f.to.y-b[1])/q*16*e]}
 if(i!==f.fi)return b;
 // ダブルプレーの案B: 捕球した二遊間がボールを持って二塁へ走る(送球ステップの carry と同期)
 const th=G.th;
 if(th&&th.steps&&th.steps[0]&&th.steps[0].carry&&now>=th.t0){const p=cl((now-th.t0)/th.steps[0].dur,0,1);return[f.to.x+(BS[2].x-f.to.x)*p,f.to.y+(BS[2].y-f.to.y)*p]}

 const targetTo = f.isHit && i >= 6 ? outfieldTarget(f.to) : f.to;

 const dx=targetTo.x-HP.x,dy=targetTo.y-HP.y,k=Math.min(1,(R-14)/Math.hypot(dx,dy)),tx=HP.x+dx*k,ty=HP.y+dy*k,d=Math.hypot(tx-b[0],ty-b[1]);
 let T=d/FSPD;if(f.out)T=Math.min(T,f.dur*.92);
 const p=T>0?Math.min(1,(now-f.t0)/T):1,e=1-(1-p)*(1-p);
 const dive=(f.diving&&p>.6)?Math.sin((p-.6)*2.5*P)*10:0;
 return[b[0]+(tx-b[0])*e+dive,b[1]+(ty-b[1])*e-dive]}

function drawField(now){
 cx.drawImage(bg,0,0);
 const bt=G.top?0:1;
 FD.forEach((_,i)=>{const[x,y]=fpos(i,now);dot(x,y,6,TC[1-bt],'#fff')});
 const mv=G.mv&&now-G.mv.t0<G.mv.dur?G.mv:null,bm=!!mv&&mv.moves.some(m=>m.a===0);
 const rd=(x,y)=>{cx.save();cx.shadowColor=TC[bt];cx.shadowBlur=14;dot(x,y,8,TC[bt],'#fff');cx.restore()};
 if(mv){mv.stay.forEach(b=>rd(BS[b].x,BS[b].y));mv.moves.forEach(m=>{const el=now-mv.t0;if(m.o&&el>=m.o)return;const q=rpos(m.a,m.b,Math.min(1,el/(m.T||550*(m.b-m.a))));rd(q[0],q[1])})}
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
  const h=f.kind==='ground'?Math.abs(Math.sin(p*P*5))*8*(1-p):f.h*4*p*(1-p);
  cx.fillStyle='rgba(0,0,0,.35)';cx.beginPath();cx.ellipse(x,y,5,2.5,0,0,7);cx.fill();
  dot(x,y-h,4+h/25,'#fff','#c33')}
 
 if(G.th)drawTh(now);
}

function drawTh(now){const t=G.th;
 if(t.steps){let el=now-t.t0,st=0,pos=null;
  for(const q of t.steps){const a=st+(q.dly||0),b=a+q.dur;
   if(el<a){pos=[q.from.x,q.from.y];break}
   if(el<b){const p=(el-a)/q.dur;pos=[q.from.x+(q.to.x-q.from.x)*p,q.from.y+(q.to.y-q.from.y)*p-(q.carry?0:Math.sin(p*P)*14)];break}
   st=b;pos=[q.to.x,q.to.y]}
  if(pos)dot(pos[0],pos[1],4,'#fff','#c33')}
 else{const p=(now-t.t0)/t.dur;if(p>=0&&p<1){const x=t.from.x+(t.to.x-t.from.x)*p,y=t.from.y+(t.to.y-t.from.y)*p-Math.sin(p*P)*14;dot(x,y,4,'#fff','#c33')}}}

function drawZone(){const u=44,c=zx;
 c.fillStyle='#0f1a33';c.fillRect(0,0,220,220);
 c.strokeStyle='#1f2f58';c.lineWidth=1;
 for(let i=1;i<5;i++){c.beginPath();c.moveTo(i*u,0);c.lineTo(i*u,220);c.moveTo(0,i*u);c.lineTo(220,i*u);c.stroke()}
 
 c.strokeStyle='#ffd23f';c.lineWidth=3;c.strokeRect(u,u,3*u,3*u);
 const p=G.pitch;
 if(p&&(G.phase==='pitch'||G.phase==='busy')){const t=cl(p.t,0,1.2),[x,y]=bp(p,t),r=3+16*Math.min(t,1.1);
  c.strokeStyle='rgba(255,210,63,.6)';c.lineWidth=2;c.beginPath();c.arc(x,y,19,0,7);c.stroke();
  baseball(c,x,y,r,spinState(p,t))}
 
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
function loop(){
 requestAnimationFrame(loop);
 const now=performance.now();
 try{update(now)}catch(error){reportLoopError(error,'ゲーム更新')}
 try{cx.clearRect(0,0,cv.width,cv.height);drawField(now);drawZone()}catch(error){reportLoopError(error,'描画')}
 try{ctl()}catch(error){reportLoopError(error,'操作UI更新')}
}
