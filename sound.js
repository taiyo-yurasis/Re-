/* sound.js — 効果音(Web Audio合成。音声ファイルなし)
   最小セット: 投球(リリース) / スイング(風切り) / ミット(捕球) / バット(ミート段階で変化)
   重さは低音レイヤー(サブ)とマスターのコンプレッサーで作る。
   AudioContext はブラウザの自動再生制限のため、最初のユーザー操作で開始・再開する。 */
const Snd=(()=>{
 const KEY='yakyu-stadium-sound-enabled';
 let enabled=true;
 try{enabled=localStorage.getItem(KEY)!=='0'}catch(_){}
 let ctx=null,noiseBuf=null,master=null;

 function ac(){
  if(!enabled)return null;
  const AC=typeof AudioContext!=='undefined'?AudioContext:(typeof webkitAudioContext!=='undefined'?webkitAudioContext:null);
  if(!AC)return null;
  if(!ctx)ctx=new AC();
  if(ctx.state==='suspended')ctx.resume();
  return ctx;
 }
 function out(c){
  if(master)return master;
  const g=c.createGain();g.gain.value=.95;
  if(typeof c.createDynamicsCompressor==='function'){
   const comp=c.createDynamicsCompressor();
   comp.threshold.value=-16;comp.ratio.value=8;comp.attack.value=.002;comp.release.value=.18;
   g.connect(comp);comp.connect(c.destination);
  }else g.connect(c.destination);
  master=g;return g;
 }
 function noise(c){
  if(noiseBuf&&noiseBuf.sampleRate===c.sampleRate)return noiseBuf;
  const b=c.createBuffer(1,c.sampleRate,c.sampleRate),d=b.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
  noiseBuf=b;return b;
 }
 function gainAt(c,peak,dur){
  const g=c.createGain(),t=c.currentTime;
  g.gain.setValueAtTime(peak,t);
  g.gain.exponentialRampToValueAtTime(.001,t+dur);
  g.connect(out(c));return g;
 }
 function burst(c,{type,f0,f1,q=1,peak,dur}){
  const s=c.createBufferSource();s.buffer=noise(c);
  const f=c.createBiquadFilter();f.type=type;f.Q.value=q;
  const t=c.currentTime;
  f.frequency.setValueAtTime(f0,t);
  if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);
  s.connect(f);f.connect(gainAt(c,peak,dur));
  s.start(t);s.stop(t+dur+.02);
 }
 function thump(c,{f0,f1,peak,dur,type='sine'}){
  const o=c.createOscillator();o.type=type;
  const t=c.currentTime;
  o.frequency.setValueAtTime(f0,t);
  o.frequency.exponentialRampToValueAtTime(Math.max(28,f1),t+dur);
  o.connect(gainAt(c,peak,dur));
  o.start(t);o.stop(t+dur+.02);
 }

 /* 投げた瞬間: 手から離れる「シュッ」という鋭い抜け音＋低い抜け感 */
 function throw_(){
  const c=ac();if(!c)return;
  burst(c,{type:'bandpass',f0:800,f1:2600,q:1.1,peak:.32,dur:.1});
  burst(c,{type:'bandpass',f0:280,f1:620,q:1,peak:.2,dur:.12});
 }
 /* 空振り・スイングの風切り。高域の抜けに低域のうなりを重ねて重くする */
 function swing(){
  const c=ac();if(!c)return;
  burst(c,{type:'bandpass',f0:500,f1:1700,q:1.2,peak:.2,dur:.18});
  burst(c,{type:'bandpass',f0:220,f1:560,q:1,peak:.24,dur:.18});
 }
 /* 捕球のミット音(見逃し/ボール/空振りの着弾)。皮の張り＋低い衝撃 */
 function mitt(){
  const c=ac();if(!c)return;
  burst(c,{type:'lowpass',f0:800,peak:.75,dur:.09});
  burst(c,{type:'bandpass',f0:360,q:.9,peak:.4,dur:.06});
  thump(c,{f0:140,f1:52,peak:.6,dur:.13});
 }
 /* バットの音。tier: solid=芯 / normal=普通 / weak=かすり。
    鋭いクラック＋胴鳴りの低音＋サブで重さを作る */
 const HIT={solid:{peak:1,cut:2400,f:240,sub:115},normal:{peak:.8,cut:1800,f:200,sub:95},weak:{peak:.5,cut:1000,f:150,sub:80}};
 function hit(tier){
  const c=ac();if(!c)return;
  const p=HIT[tier]||HIT.normal;
  burst(c,{type:'highpass',f0:700,peak:p.peak,dur:.05});
  burst(c,{type:'bandpass',f0:p.cut,q:.8,peak:p.peak*.7,dur:.06});
  burst(c,{type:'lowpass',f0:520,peak:p.peak*.65,dur:.08});
  thump(c,{f0:p.f,f1:58,peak:p.peak*.7,dur:.12,type:'triangle'});
  thump(c,{f0:p.sub,f1:42,peak:p.peak*.55,dur:.17});
 }

 function setEnabled(v){
  enabled=!!v;
  try{localStorage.setItem(KEY,enabled?'1':'0')}catch(_){}
  if(!enabled&&ctx)ctx.suspend();
  syncToggle();
 }
 function syncToggle(){
  if(typeof document==='undefined')return;
  const b=document.getElementById('snd-toggle');
  if(b)b.textContent=enabled?'音: ON':'音: OFF';
 }
 if(typeof document!=='undefined'){
  const prime=()=>{ac()};
  document.addEventListener('pointerdown',prime,{passive:true});
  document.addEventListener('keydown',prime);
  const b=document.getElementById('snd-toggle');
  if(b)b.addEventListener('click',()=>{setEnabled(!enabled);if(enabled)mitt()});
  syncToggle();
 }
 return {throw:throw_,swing,mitt,hit,isEnabled:()=>enabled,setEnabled};
})();
