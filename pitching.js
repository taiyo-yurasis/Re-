/* pitching.js — 投球(狙い・軌道・投げる) */
function resetPitchOffset(){const j=TY[G.sel].j,a=rnd(0,2*P),r=j*Math.sqrt(Math.random());G.aimOffset={x:r*Math.cos(a),y:r*Math.sin(a)}}
function pitchTarget(){const o=G.aimOffset||{x:0,y:0},team=G.top?1:0;return{type:G.sel,x:cl(G.cur.x+o.x,0,220),y:cl(G.cur.y+o.y,0,220),sg:G.pitcherHands?G.pitcherHands[team]:1}}
function breakAt(type,hand,u){
 const br=u*u*u,late=Math.pow(Math.max(0,(u-.7)/.3),2);
 switch(type){
  case 'sl': return {x:-hand*30*Math.pow(Math.max(0,(u-.35)/.65),2),y:0};
  case 'c': return {x:-hand*23*br,y:52*late-13*Math.sin(P*u)};
  case 'f': return {x:0,y:52*late};
  case 'sh': return {x:-hand*30*late,y:0};
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
 const end=breakAt(p.type,hand,1),now=breakAt(p.type,hand,u);
 return [S.x+(p.x-S.x)*u+now.x-end.x*u,S.y+(p.y-S.y)*u+now.y-end.y*u];
}

function throwP(t,x,y){
 t=typeof t==='string'&&Object.hasOwn(TY,t)?t:'s';
 const pos=v=>{const n=Number(v);return Number.isFinite(n)?cl(n,0,220):110};x=pos(x);y=pos(y);
 const defTeam = G.top ? 1 : 0;
 const sgDir = G.pitcherHands ? G.pitcherHands[defTeam] : 1;

 G.pitch={
  id:++pid,
  type:t,
  x,
  y,
  t0:performance.now(),
  dur:TY[t].d*(pitHuman()?1:rnd(.9,1.1)),
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
 throwP(G.sel,target.x,target.y)}
