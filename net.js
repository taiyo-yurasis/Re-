/* net.js — オンライン対戦(Supabase Realtime) */
/* ---- online (room) ---- */
let RM=null,gb=0,hostN=3,SB=null;
function sbRoom(){if(!SB&&window.supabase&&!SUPA_URL.includes('YOUR-')&&!SUPA_KEY.includes('YOUR-'))SB=supabase.createClient(SUPA_URL,SUPA_KEY,{realtime:{params:{eventsPerSecond:15}}});return SB?{join:joinRoom}:null}
function joinRoom(name){return new Promise((res,rej)=>{const ch=SB.channel(name,{config:{broadcast:{self:false}}}),hs={};
 ['snap','throw','swing','hello'].forEach(ev=>ch.on('broadcast',{event:ev},m=>hs[ev]&&hs[ev]({isMe:false,data:m.payload})));
 ch.subscribe(st=>{if(st==='SUBSCRIBED')res({emit:(t,d)=>ch.send({type:'broadcast',event:t,payload:d}),on:(t,f)=>{hs[t]=f}});else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT')rej(new Error(st))})})}
const send=(t,d)=>{RM&&RM.emit(t,d).catch(()=>{})};
const canBat=()=>G.net?(G.top?0:1)===G.me:batHuman(),canPit=()=>G.net?(G.top?1:0)===G.me:pitHuman();
function snap(){const n=performance.now(),p=G.pitch,f=G.fl;return{gid:G.gid,seq:++G.seq,inn:G.inn,top:G.top,outs:G.outs,cnt:G.cnt,bases:G.bases,runs:G.runs,hits:G.hits,N:G.N,ph:G.phase,bid:G.bid|0,bt:G.bt,wo:G.walkoff,m:$('msg').textContent,sw:n-G.swingT<400?n-G.swingT:null,
 pitcherHands:G.pitcherHands, batterSides:G.batterSides,
 p:p&&{id:p.id,type:p.type,x:p.x,y:p.y,dur:p.dur,sg:p.sg,age:n-p.t0,fr:G.phase==='pitch'?null:p.t},f:f&&{id:f.id,out:f.out,fi:f.fi,ri:f.ri,wall:f.wall,to:f.to,kind:f.kind,dur:f.dur,h:f.h,diving:f.diving,age:n-f.t0},mv:G.mv&&{id:G.mv.id,age:n-G.mv.t0,dur:G.mv.dur,moves:G.mv.moves,stay:G.mv.stay},th:G.th&&{id:G.th.id,age:n-G.th.t0,dur:G.th.dur,from:G.th.from,to:G.th.to,steps:G.th.steps},rl:G.rl&&{id:G.rl.id,age:n-G.rl.t0,moves:G.rl.moves}}}
let lastSync=0;const sync=()=>{const n=performance.now();if(G.net==='host'&&G.gid&&n-lastSync>110){lastSync=n;send('snap',snap())}};
setInterval(sync,200);
function applySnap(s){if(G.net!=='guest')return;
 if(s.gid!==G.gid){G.gid=s.gid;G.seq=0;gb=0;G.over=false;$('ov').style.display='none'}
 if(s.seq<=G.seq)return;G.seq=s.seq;const n=performance.now();
 Object.assign(G,{N:s.N,inn:s.inn,top:s.top,outs:s.outs,cnt:s.cnt,bases:s.bases,runs:s.runs,hits:s.hits,walkoff:s.wo,pitcherHands:s.pitcherHands,batterSides:s.batterSides});
 if(G.phase!=='sent'||s.ph!=='aim'||n-G.sentAt>1500)G.phase=s.ph;
 if(s.ph==='over'&&!G.over)over();
 if(s.p){if(!G.pitch||G.pitch.id!==s.p.id){G.pitch={...s.p,t0:n-s.p.age,t:0};G.cur={x:110,y:110}}if(s.p.fr!=null)G.pitch.t=s.p.fr}else G.pitch=null;
 if(s.f){if(!G.fl||G.fl.id!==s.f.id)G.fl={...s.f,t0:n-s.f.age}}else G.fl=null;
 if(s.mv){if(!G.mv||G.mv.id!==s.mv.id)G.mv={...s.mv,t0:n-s.mv.age}}else G.mv=null;
 if(s.th){if(!G.th||G.th.id!==s.th.id)G.th={...s.th,t0:n-s.th.age}}else G.th=null;
 if(s.rl){if(!G.rl||G.rl.id!==s.rl.id)G.rl={...s.rl,t0:n-s.rl.age}}else G.rl=null;
 if(s.bid!==gb){gb=s.bid;if(s.bt)banner(s.bt[0],s.bt[1])}
 if(s.sw!=null)G.swingT=n-s.sw;
 $('msg').textContent=s.m;updateHud()}
function remoteSwing(m){if(G.phase!=='pitch'||!m||typeof m.t!=='number')return;const p=G.pitch;p.t=m.t;G.phase='busy';G.swingT=performance.now();
 const ms=(m.t-1)*p.dur,[bx,by]=bp(p,p.t);
 const r=batResult(p,ms,bx,by,m.x,m.y);result(r.k,ms,r)}

function netStart(rm){RM=rm;
 rm.on('snap',m=>{if(!m.isMe)applySnap(m.data)});
 rm.on('throw',m=>{const d=m.data;if(!m.isMe&&G.net==='host'&&G.phase==='aim'&&!canPit()&&d)throwP(d.type in TY?d.type:'s',cl(+d.x||110,0,220),cl(+d.y||110,0,220))});
 rm.on('swing',m=>{if(!m.isMe&&G.net==='host')remoteSwing(m.data)});
 rm.on('hello',m=>{if(!m.isMe&&G.net==='hosting'){$('ov').style.display='none';newGame(hostN,true,openingTop(2));G.net='host';G.me=0;G.seq=0;G.gid=Math.random();startHalf()}})}

async function hostRoom(N){$('ov').style.display='flex';
 const room=sbRoom();
 if(!room){$('ovs').textContent='Supabaseの設定が未入力か、読み込めなかった…(index.htmlの設定を確認)';return}
 const code=Math.random().toString(36).substring(2, 8).toUpperCase();let rm;
 try{rm=await room.join('yk'+code)}catch(e){$('ovs').textContent='部屋を作れなかった。もう一度試してね';return}
 hostN=N;G.net='hosting';netStart(rm);$('ovt').textContent='合言葉 '+code;$('ovs').textContent='相手にこの6桁を伝えて。入ってくるのを待ってるよ…'}

$('jn').onclick=async()=>{const c=$('code').value.trim().toUpperCase();
 if(!c){$('ovs').textContent='合言葉を入れてね';return}
 const room=sbRoom();
 if(!room){$('ovs').textContent='Supabaseの設定が未入力か、読み込めなかった…(index.htmlの設定を確認)';return}
 let rm;try{rm=await room.join('yk'+c)}catch(e){$('ovs').textContent='部屋に入れなかった…(招待や権限を確認してね)';return}
 newGame(3,true);G.net='guest';G.me=1;G.seq=0;G.gid=null;netStart(rm);$('ovs').textContent='ホストを待ってる…';
 const iv=setInterval(()=>{if(G.gid||G.net!=='guest')clearInterval(iv);else send('hello',1)},1000);send('hello',1)};
