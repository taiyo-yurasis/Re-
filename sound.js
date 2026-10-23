/* sound.js — 効果音(Web Audio合成。音声ファイルなし)
   最小セット: スイング(風切り) / ミット(捕球) / バット(ミート段階で変化)
   AudioContext はブラウザの自動再生制限のため、最初のユーザー操作で開始・再開する。 */
const Snd=(()=>{
 const KEY='yakyu-stadium-sound-enabled';
 let enabled=true;
 try{enabled=localStorage.getItem(KEY)!=='0'}catch(_){}
 let ctx=null,noiseBuf=null;

 function ac(){
  if(!enabled)return null;
  const AC=typeof AudioContext!=='undefined'?AudioContext:(typeof webkitAudioContext!=='undefined'?webkitAudioContext:null);
  if(!AC)return null;
  if(!ctx)ctx=new AC();
  if(ctx.state==='suspended')ctx.resume();
  return ctx;
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
  g.connect(c.destination);return g;
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
  o.frequency.exponentialRampToValueAtTime(Math.max(30,f1),t+dur);
  o.connect(gainAt(c,peak,dur));
  o.start(t);o.stop(t+dur+.02);
 }

 /* 空振り・スイングの風切り */
 function swing(){
  const c=ac();if(!c)return;
  burst(c,{type:'bandpass',f0:500,f1:1700,q:1.2,peak:.16,dur:.16});
 }
 /* 捕球のミット音(見逃し/ボール/空振りの着弾) */
 function mitt(){
  const c=ac();if(!c)return;
  burst(c,{type:'lowpass',f0:900,peak:.5,dur:.07});
  thump(c,{f0:170,f1:70,peak:.35,dur:.09});
 }
 /* バットの音。tier: solid=芯 / normal=普通 / weak=かすり で強さと鋭さが変わる */
 const HIT={solid:{peak:.9,cut:2800,f:210},normal:{peak:.6,cut:2000,f:170},weak:{peak:.35,cut:1100,f:130}};
 function hit(tier){
  const c=ac();if(!c)return;
  const p=HIT[tier]||HIT.normal;
  burst(c,{type:'highpass',f0:700,peak:p.peak,dur:.05});
  burst(c,{type:'bandpass',f0:p.cut,q:.8,peak:p.peak*.7,dur:.06});
  thump(c,{f0:p.f,f1:60,peak:p.peak*.6,dur:.09,type:'triangle'});
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
 return {swing,mitt,hit,isEnabled:()=>enabled,setEnabled};
})();
