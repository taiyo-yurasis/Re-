/* pitching.js — 投球(狙い・軌道・投げる) */
function pitchTarget(){const team=G.top?1:0;return{type:G.sel,x:cl(G.cur.x,0,220),y:cl(G.cur.y,0,220),sg:G.pitcherHands?G.pitcherHands[team]:1}}
function applyPitchAimError(type,x,y){const j=TY[type].j,a=rnd(0,2*P),r=j*Math.sqrt(Math.random());return{x:cl(x+r*Math.cos(a),0,220),y:cl(y+r*Math.sin(a),0,220)}}
function applyCpuPitchError(x,y,level=2){const d=CPU_DIFFICULTY[cl(Number(level)||2,1,4)]||CPU_DIFFICULTY[2],a=rnd(0,2*P),r=d.pitchAimError*Math.sqrt(Math.random());return{x:cl(x+r*Math.cos(a),0,220),y:cl(y+r*Math.sin(a),0,220)}}
function breakAt(type,hand,u,py){
 const br=u*u*u,late=Math.pow(Math.max(0,(u-.7)/.3),2),shape=CONFIG.pitchShape||{};
 switch(type){
  case 'c': {
   const cut=shape.c&&shape.c.lowCut;
   const lowk=cut&&Number.isFinite(py)&&cut.endY!==cut.startY
    ?1-cut.strength*cl((py-cut.startY)/(cut.endY-cut.startY),0,1):1;
   return {x:-hand*23*br,y:lowk*(52*late-13*Math.sin(P*u))};
  }
  case 'f': return {x:0,y:52*late};
  case 'sh': {
   const sh=shape.sh||{},start=Number.isFinite(sh.breakStart)?sh.breakStart:0.7;
   const shLate=Math.pow(Math.max(0,(u-start)/(1-start)),2);
   return {x:-hand*(Number.isFinite(sh.xBreak)?sh.xBreak:30)*shLate,y:0};
  }
  case 'cu': return {x:hand*6*br,y:11*br};
  default:return {x:0,y:0};
 }
}
function bp(p,t){
 const u=cl(t,0,1),hand=p.sg||1,S={x:110-hand*12,y:40};
 // スライダー: 中盤で少し食い込んでから終盤に曲がり、着地は狙い位置に揃える(-42*u で補正)
 if(p.type==='sl'){
  return [S.x+(p.x-S.x)*u+hand*(42*Math.pow(u,6)-18*Math.sin(P*u)-42*u),S.y+(p.y-S.y)*u];
 }
 const end=breakAt(p.type,hand,1,p.y),now=breakAt(p.type,hand,u,p.y);
 return [S.x+(p.x-S.x)*u+now.x-end.x*u,S.y+(p.y-S.y)*u+now.y-end.y*u];
}

// 投球の到達時間をランダムにブレさせるのはCPU投手だけ。人間の投球はオンラインでも固定
// (ホスト側で相手の投球を処理するときも、相手は人間なのでブレさせない)。
const pitCpu=()=>!G.net&&!G.pvp&&(G.top?1:0)!==G.humanTeam;

function throwP(t,x,y,applyAimError=false){
 t=typeof t==='string'&&Object.hasOwn(TY,t)?t:'s';
 const pos=v=>{const n=Number(v);return Number.isFinite(n)?cl(n,0,220):110};x=pos(x);y=pos(y);
 if(applyAimError){const actual=applyPitchAimError(t,x,y);x=actual.x;y=actual.y}
 const defTeam = G.top ? 1 : 0;
 const sgDir = G.pitcherHands ? G.pitcherHands[defTeam] : 1;

 G.pitch={
  id:++pid,
  type:t,
  x,
  y,
  t0:performance.now(),
  dur:TY[t].d*(pitCpu()?rnd(.9,1.1):1),
  sg: sgDir,
  t:0
 };
 G.phase='pitch';
 if(G.pvp&&!G.net){G.cur={x:110,y:110};lastT=null;mdown=false}
 setMsg(G.pvp?'打者!カーソルをボールに合わせて、離した瞬間にスイング!':'投げた!');
 sync();
}

function pitchNow(){if(G.phase!=='aim'||!canPit())return;const target=pitchTarget();
 if(G.net==='guest'){G.phase='sent';G.sentAt=performance.now();send('throw',{type:G.sel,x:target.x,y:target.y});return}
 throwP(G.sel,target.x,target.y,true)}
