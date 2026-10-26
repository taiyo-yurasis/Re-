/* pitching.js — 投球(狙い・軌道・投げる) */
function pitchTarget(){const team=G.top?1:0;return{type:G.sel,x:cl(G.cur.x,0,220),y:cl(G.cur.y,0,220),sg:G.pitcherHands?G.pitcherHands[team]:1}}
function applyPitchAimError(type,x,y){const j=TY[type].j,a=rnd(0,2*P),r=j*Math.sqrt(Math.random());return{x:cl(x+r*Math.cos(a),0,220),y:cl(y+r*Math.sin(a),0,220)}}
function applyCpuPitchError(x,y,level=2){const d=CPU_DIFFICULTY[cl(Number(level)||2,1,4)]||CPU_DIFFICULTY[2],a=rnd(0,2*P),r=d.pitchAimError*Math.sqrt(Math.random());return{x:cl(x+r*Math.cos(a),0,220),y:cl(y+r*Math.sin(a),0,220)}}
// カウント別の球種割合。Statcast 2025シーズン全試合の実測値 (行は [ボール-ストライク]、列は [s, sh, sl, c, cu, f, ct, ss])
// カットボールは実データのカッター(FC)、超スローボールはイーファス(EP)の実測割合 (EPは全体の0.13%で全カウント0)
const CPU_SEQ={
 '0-0':[33,19,21,9,7,2,9,0],'0-1':[30,14,23,8,14,4,7,0],'0-2':[32,7,28,12,12,5,4,0],
 '1-0':[31,19,20,6,11,3,10,0],'1-1':[28,15,23,8,14,4,8,0],'1-2':[31,9,27,11,13,5,4,0],
 '2-0':[38,22,16,4,7,2,11,0],'2-1':[32,18,21,6,11,3,9,0],'2-2':[30,12,24,10,13,5,6,0],
 '3-0':[67,23,4,0,1,0,5,0],'3-1':[42,23,14,3,6,1,11,0],'3-2':[38,17,21,6,8,2,8,0]
};
const CPU_SEQ_TYPES=['s','sh','sl','c','cu','f','ct','ss'];
const CPU_SEQ_ALL=[32,16,22,9,10,3,8,0]; // シーズン全体の割合
function pickSeqType(weights){let r=Math.random()*100;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return CPU_SEQ_TYPES[i]}return 's'}
// CPU投手の1球の計画 (球種と、ブレを乗せる前の狙い) を返す
function cpuPlanPitch(level=2){
 const lv=cl(Number(level)||2,1,4),cnt=G.cnt||{b:0,s:0};
 let type;
 // 前の球を空振りしていたら、同じ球種をもう一度投げがち (実測で約53%)
 const repRate=lv>=4?.53:lv>=3?.35:0,atBatStart=cnt.b===0&&cnt.s===0;
 if(!atBatStart&&G.prevPitch&&G.prevPitch.res==='miss'&&Math.random()<repRate)type=G.prevPitch.type;
 else if(lv<=1)type=CPU_SEQ_TYPES[ri(0,CPU_SEQ_TYPES.length-1)];
 else{
  const row=CPU_SEQ[cnt.b+'-'+cnt.s]||CPU_SEQ_ALL;
  type=pickSeqType(lv===2?row.map((w,i)=>(w+CPU_SEQ_ALL[i])/2):row);
 }
 // 追い込んだら意図的にゾーンの外へ外して空振りを誘う。3ボールでは外さない
 const chaseBase=cnt.b>=3?.05:cnt.s===2?.35:cnt.s===1?.15:.02;
 if(Math.random()<chaseBase*(lv>=4?1:lv>=3?.5:0)){
  const m=rnd(78,95)*(Math.random()<.5?-1:1),o=rnd(-80,80);
  return Math.random()<.5?{type,x:110+m,y:110+o}:{type,x:110+o,y:110+m};
 }
 const tgt=cpuAimTarget(lv);
 return{type,x:tgt.x,y:tgt.y};
}
// CPU投手の狙い。強いCPUほど、ゾーンの際(中心から60〜76px、枠線の内外をまたぐ帯)を狙う
function cpuAimTarget(level=2){
 const d=CPU_DIFFICULTY[cl(Number(level)||2,1,4)]||CPU_DIFFICULTY[2];
 if(Math.random()<(d.edgeRate||0)){
  const m=rnd(60,76)*(Math.random()<.5?-1:1),s=rnd(-76,76);
  return Math.random()<.5?{x:110+m,y:110+s}:{x:110+s,y:110+m};
 }
 if(Math.random()<.62)return{x:rnd(52,168),y:rnd(52,168)};
 return{x:rnd(20,200),y:rnd(20,200)};
}
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
  case 'ct': return {x:hand*26*Math.pow(cl((u-.72)/.28,0,1),2),y:0};
  case 'ss': return {x:hand*8*Math.sin(P*u),y:-95*Math.sin(P*u)+34*late};
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
