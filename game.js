/* game.js — 試合の進行(新規ゲーム・イニング・判定待ち・終了) */
let cfgPitcher = 1;
let cfgBatter = 'right';
let cfgCpuFirst = true;
function openingTop(mode,randomTop=Math.random()<.5){return mode===0?cfgCpuFirst:mode===2?randomTop:true}

function newGame(N,pvp,opening= true){
 const pHand = cfgPitcher;
 const bSide1 = cfgBatter === 'random' ? (Math.random() < 0.5 ? 'right' : 'left') : cfgBatter;
 const bSide2 = cfgBatter === 'random' ? (Math.random() < 0.5 ? 'right' : 'left') : cfgBatter;

 G={
  id:G.id+1,
  N,
  pvp:!!pvp,
  inn:1,
  top:opening,
  outs:0,
  cnt:{b:0,s:0},
  bases:[0,0,0,0],
  runs:[[],[]],
  hits:[0,0],
  phase:'idle',
  pitch:null,
  sel:'s',
  fl:null,
  over:false,
  last:null,
  swingT:-1e9,
  walkoff:false,
  cur:{x:110,y:110},
  pitcherHands: [pHand, pHand],
  batterSides: [bSide1, bSide2]
 }
}

function startHalf(){G.outs=0;G.bases=[0,0,0,0];G.cnt={b:0,s:0};G.runs[G.top?0:1][G.inn-1]=0;G.fl=null;G.th=null;G.mv=null;G.rl=null;G.pitch=null;G.phase='idle';
 banner(`${G.inn}回${G.top?'表':'裏'}`);updateHud();later(1300,ready)}
function ready(){if(G.over)return;G.fl=null;G.th=null;G.mv=null;G.rl=null;G.pitch=null;G.phase='ready';G.cur={x:110,y:110};updateHud();
 if(!pitHuman()){setMsg('カーソルをボールに合わせて、離した瞬間にスイング!');
  later(rnd(700,1300),()=>{
   const keys=Object.keys(TY);const t=keys[ri(0,keys.length-1)];let x,y;
   if(Math.random()<.62){x=rnd(52,168);y=rnd(52,168)}else{x=rnd(20,200);y=rnd(20,200)}
   throwP(t,x,y)})}
 else{G.phase='aim';resetPitchOffset();setMsg(G.pvp?(G.top?'P2':'P1')+'投手: 球種を選んで狙って「投げる!」 / '+(G.top?'P1':'P2')+'は構えて!':'球種を選んで、カーソルで狙って、投げる!')}}

function update(now){if(G.phase!=='pitch')return;const p=G.pitch;if(!p)return;p.t=(now-p.t0)/p.dur;
 if(G.net==='guest')return;if(batHuman()){if(p.t>(G.net?1.2+500/p.dur:1.2)){G.phase='busy';take()}}
 else if(p.t>=.98){G.phase='busy';cpuBat()}}
function take(){result(dist(G.pitch)<=1?'look':'ball')}

function endHalf(){
 const a=tot(0), b=tot(1);
 const isOverByInning = G.inn >= G.N && a !== b;
 const ed = G.top ? (G.inn >= G.N && b > a) : (isOverByInning || (G.inn >= G.N && a === b && !G.top));

 banner(ed?'ゲームセット':'チェンジ');
 later(ed?1800:1300,()=>{
  if(ed)return over();
  if(G.top)G.top=false;
  else{G.inn++;G.top=true;}
  startHalf();
 });
}

function over(){G.over=true;G.phase='over';const a=tot(0),b=tot(1);
 $('ovt').textContent=G.pvp?(a>b?'🎉 P1の勝ち!':a<b?'🎉 P2の勝ち!':'🤝 引き分け'):a>b?'🎉 勝利!':a<b?(G.walkoff?'😢 サヨナラ負け…':'😢 敗北…'):'🤝 引き分け';
 $('ovs').textContent=G.pvp?`P1 ${a} - ${b} P2`:`あなた ${a} - ${b} CPU`;$('ov').style.display='flex';
}
