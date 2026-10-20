/* game.js — 試合の進行(新規ゲーム・イニング・判定待ち・終了) */
let cfgPitcher = 1;
let cfgBatter = 'right';
let cfgCpuFirst = true;
function openingTop(){return true}
const pickBatterSide=s=>s==='random'?(Math.random()<0.5?'right':'left'):s;
function selectNextBatterSide(team=G.top?0:1){G.batterSides[team]=pickBatterSide(G.batterModes[team])}

function newGame(N,pvp,opening=true,humanTeam=null,teamCfg=null){
 const human = pvp ? (humanTeam===0||humanTeam===1?humanTeam:0) : (cfgCpuFirst?0:1);
 // チームごとの設定(オンライン時は teamCfg で [チーム0, チーム1] の投げ手/打席を渡す。無ければ自分の設定を両チームに使う)
 const cfgs = teamCfg || [{ph:cfgPitcher,bs:cfgBatter},{ph:cfgPitcher,bs:cfgBatter}];

 G={
  id:G.id+1,
  N,
  pvp:!!pvp,
  inn:1,
  top:true,
  humanTeam:human,
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
  pitcherHands: [cfgs[0].ph, cfgs[1].ph],
  batterModes: [cfgs[0].bs, cfgs[1].bs],
  batterSides: [pickBatterSide(cfgs[0].bs), pickBatterSide(cfgs[1].bs)]
 }
}

function startHalf(){selectNextBatterSide();G.outs=0;G.bases=[0,0,0,0];G.cnt={b:0,s:0};G.runs[G.top?0:1][G.inn-1]=0;G.fl=null;G.th=null;G.mv=null;G.rl=null;G.pitch=null;G.phase='idle';
 banner(`${G.inn}回${G.top?'表':'裏'}`);updateHud();later(1300,ready)}
function ready(){if(G.over)return;G.fl=null;G.th=null;G.mv=null;G.rl=null;G.pitch=null;G.phase='ready';G.cur={x:110,y:110};updateHud();
 if(!G.net&&!pitHuman()){setMsg('カーソルをボールに合わせて、離した瞬間にスイング!');
  later(rnd(700,1300),()=>{
   const keys=Object.keys(TY);const t=keys[ri(0,keys.length-1)];let x,y;
   if(Math.random()<.62){x=rnd(52,168);y=rnd(52,168)}else{x=rnd(20,200);y=rnd(20,200)}
   throwP(t,x,y)})}
 else{G.phase='aim';resetPitchOffset();setMsg(G.pvp?(G.top?'P2':'P1')+'投手: 球種を選んで狙って「投げる!」 / '+(G.top?'P1':'P2')+'は構えて!':'球種を選んで、カーソルで狙って、投げる!')}}

function update(now){if(G.phase!=='pitch')return;const p=G.pitch;if(!p)return;if(!Number.isFinite(p.dur)||p.dur<=0){G.phase='busy';result('ball',null);return}p.t=(now-p.t0)/p.dur;
 if(G.net==='guest')return;if(G.net||batHuman()){const limit=1+CONFIG.timingWindowMs/p.dur+(G.net&&!canBat()?500/p.dur:0);if(p.t>limit){G.phase='busy';take()}}
 else if(p.t>=.98){G.phase='busy';cpuBat()}}
function take(){result(dist(G.pitch)<=1?'look':'ball')}

function endHalf(){
 const a=tot(0), b=tot(1);
 const ed = G.top ? (G.inn >= G.N && b > a) : G.inn >= G.N;

 banner(ed?'ゲームセット':'チェンジ');
 later(ed?1800:1300,()=>{
  if(ed)return over();
  if(G.top)G.top=false;
  else{G.inn++;G.top=true;}
  startHalf();
 });
}

function over(){G.over=true;G.phase='over';const a=tot(0),b=tot(1);
 $('ovt').textContent=G.pvp?(a>b?'🎉 ビジターの勝ち!':a<b?'🎉 ホームの勝ち!':'🤝 引き分け'):(a===b?'🤝 引き分け':(((a>b)===(G.humanTeam===0))?'🎉 勝利!':(G.humanTeam===0&&G.walkoff?'😢 サヨナラ負け…':'😢 敗北…')));
 $('ovs').textContent=G.pvp?`ビジター ${a} - ${b} ホーム`:`あなた ${tot(G.humanTeam)} - ${tot(1-G.humanTeam)} CPU`;$('ov').style.display='flex';
}
