/* net.js — オンライン対戦(Supabase Realtime) */
let RM=null,gb=0,hostN=3,SB=null,roomCode=null,helloTimer=null,helloTimeout=null,waitingRoom=false,roomEpoch=0;
const ROOM_JOIN_TIMEOUT_MS=10000,HOST_HANDSHAKE_TIMEOUT_MS=15000;
function sbRoom(){if(!SB&&window.supabase&&!SUPA_URL.includes('YOUR-')&&!SUPA_KEY.includes('YOUR-'))SB=supabase.createClient(SUPA_URL,SUPA_KEY,{realtime:{params:{eventsPerSecond:15}}});return SB?{join:joinRoom}:null}
function closeRoom(){
 roomEpoch++;
 if(helloTimer){clearInterval(helloTimer);helloTimer=null}
 if(helloTimeout){clearTimeout(helloTimeout);helloTimeout=null}
 const old=RM;RM=null;roomCode=null;waitingRoom=false;
 if(old&&old.close)old.close();
}
function joinRoom(name){return new Promise((res,rej)=>{
 let settled=false;
 const ch=SB.channel(name,{config:{broadcast:{self:false},presence:{key:Math.random().toString(36).slice(2)}}}),hs={},leaveHandlers=[];
 const cleanup=()=>{try{SB.removeChannel(ch)}catch(e){console.warn('Realtime channel cleanup failed',e)}};
 const finish=(err,value)=>{
  if(settled){if(value&&value.close)value.close();return}
  settled=true;clearTimeout(joinTimer);
  if(err){cleanup();rej(err)}else res(value)
 };
 const joinTimer=setTimeout(()=>finish(new Error('JOIN_TIMEOUT')),ROOM_JOIN_TIMEOUT_MS);
 ['snap','throw','swing','hello'].forEach(ev=>ch.on('broadcast',{event:ev},m=>hs[ev]&&hs[ev]({isMe:false,data:m.payload})));
 ch.on('presence',{event:'leave'},()=>{if(Object.keys(ch.presenceState()).length<=1)leaveHandlers.forEach(fn=>fn())});
 ch.subscribe(async st=>{
  if(settled)return;
  if(st==='SUBSCRIBED'){
   try{
    await ch.track({online:true});
    if(settled){try{ch.untrack()}catch(e){};return}
    finish(null,{emit:(t,d)=>ch.send({type:'broadcast',event:t,payload:d}),on:(t,fn)=>{hs[t]=fn},onLeave:fn=>leaveHandlers.push(fn),close:()=>{try{ch.untrack()}finally{SB.removeChannel(ch)}}});
   }catch(e){finish(e)}
  }else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT')finish(new Error(st))
 });
})}
const send=(t,d)=>{if(RM)RM.emit(t,d).catch(()=>{})};
const canBat=()=>G.net?(G.top?0:1)===G.me:batHuman(),canPit=()=>G.net?(G.top?1:0)===G.me:pitHuman();
function snap(){
 const n=performance.now(),p=G.pitch,f=G.fl;
 return {gid:G.gid,seq:++G.seq,hostTeam:G.me,inn:G.inn,top:G.top,outs:G.outs,cnt:G.cnt,bases:G.bases,runs:G.runs,hits:G.hits,pts:G.pts,N:G.N,ph:G.phase,bid:G.bid|0,bt:G.bt,wo:G.walkoff,m:$('msg').textContent,sw:n-G.swingT<400?n-G.swingT:null,pitcherHands:G.pitcherHands,batterSides:G.batterSides,p:p&&{id:p.id,type:p.type,x:p.x,y:p.y,dur:p.dur,sg:p.sg,age:n-p.t0,fr:G.phase==='pitch'?null:p.t},f:f&&{id:f.id,out:f.out,fi:f.fi,ri:f.ri,wall:f.wall,to:f.to,kind:f.kind,dur:f.dur,h:f.h,diving:f.diving,age:n-f.t0},mv:G.mv&&{id:G.mv.id,age:n-G.mv.t0,dur:G.mv.dur,moves:G.mv.moves,stay:G.mv.stay},th:G.th&&{id:G.th.id,age:n-G.th.t0,dur:G.th.dur,from:G.th.from,to:G.th.to,steps:G.th.steps},rl:G.rl&&{id:G.rl.id,age:n-G.rl.t0,moves:G.rl.moves}}
}
let lastSync=0;const sync=()=>{const n=performance.now();if(G.net==='host'&&G.gid&&n-lastSync>110){lastSync=n;send('snap',snap())}};
setInterval(sync,200);
function validSnap(s){
 const intRange=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
 const numRange=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
 const point=p=>!!p&&typeof p==='object'&&numRange(p.x,0,480)&&numRange(p.y,0,400);
 const age=v=>numRange(v,0,3600000);
 const validMotion=m=>!!m&&typeof m==='object'&&
  (m.id==null||Number.isFinite(m.id))&&age(m.age)&&(m.dur==null||numRange(m.dur,0.001,3600000));
 if(!s||typeof s!=='object'||!Number.isFinite(s.gid)||!intRange(s.seq,0,Number.MAX_SAFE_INTEGER)||
  !intRange(s.hostTeam,0,1)||!intRange(s.inn,1,20)||typeof s.top!=='boolean'||
  !intRange(s.N,1,20)||!intRange(s.outs,0,3)||!s.cnt||
  !intRange(s.cnt.b,0,3)||!intRange(s.cnt.s,0,2))return false;
 if(!Array.isArray(s.bases)||s.bases.length!==4||s.bases.some(v=>v!==0&&v!==1))return false;
 if(!Array.isArray(s.runs)||s.runs.length!==2||s.runs.some(a=>!Array.isArray(a)||a.length>20||a.some(v=>v!=null&&!intRange(v,0,999))))return false;
 if(!Array.isArray(s.hits)||s.hits.length!==2||s.hits.some(v=>!intRange(v,0,999)))return false;
 if(s.pts!=null&&(!Array.isArray(s.pts)||s.pts.length!==2||s.pts.some(v=>!intRange(v,0,Number.MAX_SAFE_INTEGER))))return false;
 if(!['idle','ready','aim','sent','pitch','busy','over'].includes(s.ph))return false;
 if(s.bid!=null&&!intRange(s.bid,0,Number.MAX_SAFE_INTEGER))return false;
 if(s.bt!=null&&(!Array.isArray(s.bt)||s.bt.length<1||typeof s.bt[0]!=='string'||(s.bt[1]!=null&&typeof s.bt[1]!=='string')))return false;
 if(s.m!=null&&typeof s.m!=='string')return false;
 if(s.sw!=null&&!numRange(s.sw,0,400))return false;
 if(s.pitcherHands!=null&&(!Array.isArray(s.pitcherHands)||s.pitcherHands.length!==2||s.pitcherHands.some(v=>v!==1&&v!==-1&&v!==0)))return false;
 if(s.batterSides!=null&&(!Array.isArray(s.batterSides)||s.batterSides.length!==2||s.batterSides.some(v=>!['right','left'].includes(v))))return false;
 if(s.p!=null&&(!s.p||typeof s.p!=='object'||!intRange(s.p.id,0,Number.MAX_SAFE_INTEGER)||
  typeof s.p.type!=='string'||!Object.hasOwn(TY,s.p.type)||!numRange(s.p.dur,0.001,3600000)||
  !numRange(s.p.x,0,220)||!numRange(s.p.y,0,220)||!age(s.p.age)||
  (s.p.sg!=null&&s.p.sg!==1&&s.p.sg!==-1)||(s.p.fr!=null&&!numRange(s.p.fr,0,1.3))))return false;
 if(s.f!=null&&(!s.f||typeof s.f!=='object'||!intRange(s.f.id,0,Number.MAX_SAFE_INTEGER)||
  !point(s.f.to)||!numRange(s.f.dur,0.001,3600000)||!age(s.f.age)||
  (s.f.kind!=null&&typeof s.f.kind!=='string')||(s.f.out!=null&&typeof s.f.out!=='boolean')||
  (s.f.wall!=null&&typeof s.f.wall!=='boolean')||(s.f.diving!=null&&typeof s.f.diving!=='boolean')||
  (s.f.fi!=null&&!intRange(s.f.fi,0,FD.length-1))||(s.f.ri!=null&&!intRange(s.f.ri,0,FD.length-1))||
  (s.f.h!=null&&!Number.isFinite(s.f.h))))return false;
 if(s.mv!=null&&(!validMotion(s.mv)||!Array.isArray(s.mv.moves)||!Array.isArray(s.mv.stay)||
  s.mv.stay.some(v=>!intRange(v,0,3))||s.mv.moves.some(m=>!m||typeof m!=='object'||
   !intRange(m.a,0,3)||!intRange(m.b,0,4)||(m.T!=null&&!numRange(m.T,0.001,3600000))||
   (m.i!=null&&!intRange(m.i,0,FD.length-1))||(m.x!=null&&!numRange(m.x,0,480))||(m.y!=null&&!numRange(m.y,0,400)))))return false;
 if(s.th!=null&&(!validMotion(s.th)||!point(s.th.from)||!point(s.th.to)||
  (s.th.steps!=null&&(!Array.isArray(s.th.steps)||s.th.steps.length>20||s.th.steps.some(q=>!q||!point(q.from)||!point(q.to)||!numRange(q.dur,0.001,3600000)||(q.dly!=null&&!numRange(q.dly,0,3600000)))))))return false;
 if(s.rl!=null&&(!s.rl||typeof s.rl!=='object'||!intRange(s.rl.id,0,Number.MAX_SAFE_INTEGER)||!age(s.rl.age)||
  !Array.isArray(s.rl.moves)||s.rl.moves.length>4||s.rl.moves.some(m=>!m||!intRange(m.i,0,FD.length-1)||
   !numRange(m.T,0.001,3600000)||!numRange(m.x,0,480)||!numRange(m.y,0,400))))return false;
 return true
}
function applySnap(s){
 if(G.net!=='guest'||!validSnap(s))return;
 if(s.gid!==G.gid){G.gid=s.gid;G.seq=0;gb=0;G.over=false;waitingRoom=false;if(helloTimer){clearInterval(helloTimer);helloTimer=null}if(helloTimeout){clearTimeout(helloTimeout);helloTimeout=null}$('cancel-room').style.display='none';document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=false);$('ov').style.display='none';if(Number.isInteger(s.hostTeam))G.me=1-s.hostTeam}
 if(s.seq<=G.seq)return;G.seq=s.seq;const n=performance.now();
 Object.assign(G,{N:Number(s.N),inn:Number(s.inn),top:s.top,outs:Number(s.outs),cnt:{b:Number(s.cnt.b),s:Number(s.cnt.s)},bases:s.bases.map(Number),runs:s.runs.map(a=>a.map(v=>v==null?null:Number(v))),hits:s.hits.map(Number),pts:Array.isArray(s.pts)?s.pts.map(Number):[0,0],walkoff:!!s.wo,pitcherHands:s.pitcherHands,batterSides:s.batterSides});
 if(G.phase!=='sent'||s.ph!=='aim'||n-G.sentAt>1500)G.phase=s.ph;
 if(s.ph==='over'&&!G.over)over();
 if(s.p){if(!G.pitch||G.pitch.id!==s.p.id)G.pitch={...s.p,t0:n-s.p.age,t:0};if(s.p.fr!=null)G.pitch.t=s.p.fr}else G.pitch=null;
 if(s.f){if(!G.fl||G.fl.id!==s.f.id)G.fl={...s.f,t0:n-s.f.age}}else G.fl=null;
 if(s.mv){if(!G.mv||G.mv.id!==s.mv.id)G.mv={...s.mv,t0:n-s.mv.age}}else G.mv=null;
 if(s.th){if(!G.th||G.th.id!==s.th.id)G.th={...s.th,t0:n-s.th.age}}else G.th=null;
 if(s.rl){if(!G.rl||G.rl.id!==s.rl.id)G.rl={...s.rl,t0:n-s.rl.age}}else G.rl=null;
 if(s.bid!==gb){gb=s.bid;if(Array.isArray(s.bt)&&typeof s.bt[0]==='string')banner(s.bt[0].slice(0,100),typeof s.bt[1]==='string'?s.bt[1].slice(0,20):'')}
 if(s.sw!=null&&Number.isFinite(s.sw))G.swingT=n-cl(s.sw,0,400);
 $('msg').textContent=typeof s.m==='string'?s.m.slice(0,500):'';updateHud()
}
function remoteSwing(m){
 if(G.phase!=='pitch'||canBat()||!m||!Number.isFinite(m.t)||!Number.isFinite(m.x)||!Number.isFinite(m.y))return;
 const p=G.pitch;if(!p||!Number.isFinite(p.dur)||p.dur<=0)return;
 p.t=cl(m.t,0,1.3);G.phase='busy';G.swingT=performance.now();
 const ms=(p.t-1)*p.dur,r=batResult(p,ms,cl(m.x,0,220),cl(m.y,0,220));result(r.k,ms,r)
}
function netStart(rm){
 RM=rm;
 rm.on('snap',m=>{if(!m.isMe)applySnap(m.data)});
 rm.on('throw',m=>{const d=m.data;if(!m.isMe&&G.net==='host'&&G.phase==='aim'&&!canPit()&&d&&
  typeof d.type==='string'&&Object.hasOwn(TY,d.type)&&Number.isFinite(d.x)&&d.x>=0&&d.x<=220&&Number.isFinite(d.y)&&d.y>=0&&d.y<=220){
  throwP(d.type,d.x,d.y,true);
 }});
 rm.on('swing',m=>{if(!m.isMe&&G.net==='host'&&!canBat())remoteSwing(m.data)});
 rm.on('hello',m=>{const d=m.data;if(!m.isMe&&G.net==='hosting'&&d&&d.room===roomCode){
  $('ov').style.display='none';waitingRoom=false;$('cancel-room').style.display='none';document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=false);const team=Math.random()<.5?0:1;
  const gph=d.ph===-1?-1:1,gbs=['right','left','random'].includes(d.bs)?d.bs:'right',cfgs=[null,null];
  cfgs[team]={ph:cfgPitcher,bs:cfgBatter};cfgs[1-team]={ph:gph,bs:gbs};
  newGame(hostN,true,team,cfgs);G.net='host';G.me=team;G.seq=0;G.gid=Math.random();startHalf();
 }});
 rm.onLeave(()=>{if(G.net==='host'||G.net==='guest'){closeRoom();G.net=null;$('ov').style.display='flex';$('ovt').textContent='対戦相手が切断しました';$('ovs').textContent='部屋を閉じました。もう一度対戦するには新しい部屋を作ってね。';document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=false)}});
}
async function hostRoom(N){
 if(waitingRoom)return;closeRoom();
 $('ov').style.display='flex';const room=sbRoom();
 if(!room){$('ovs').textContent='Supabaseの設定が未入力か、読み込めなかった…(index.htmlの設定を確認)';return}
 const code=Math.random().toString(36).substring(2,8).toUpperCase();let rm;const epoch=roomEpoch;waitingRoom=true;document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=true);$('cancel-room').style.display='inline-block';
 try{rm=await room.join('yk'+code)}catch(e){if(epoch!==roomEpoch)return;waitingRoom=false;$('cancel-room').style.display='none';document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=false);$('ovs').textContent=e.message==='JOIN_TIMEOUT'?'部屋への接続がタイムアウトしました。もう一度試してね':'部屋を作れなかった。もう一度試してね';return}
 if(epoch!==roomEpoch){rm.close();return}hostN=N;roomCode=code;waitingRoom=true;G.net='hosting';netStart(rm);$('ovt').textContent='合言葉 '+code;$('ovs').textContent='相手にこの6桁を伝えて。入ってくるのを待ってるよ…';
 document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=true);$('cancel-room').style.display='inline-block'
}
$('jn').onclick=async()=>{
 if(waitingRoom)return;
 const c=$('code').value.trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(c)){$('ovs').textContent='合言葉を6桁で入れてね';return}
 closeRoom();const room=sbRoom();if(!room){$('ovs').textContent='Supabaseの設定が未入力か、読み込めなかった…(index.htmlの設定を確認)';return}
 waitingRoom=true;const epoch=roomEpoch;document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=true);$('cancel-room').style.display='inline-block';
 let rm;try{rm=await room.join('yk'+c)}catch(e){if(epoch!==roomEpoch)return;waitingRoom=false;$('cancel-room').style.display='none';document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=false);$('ovs').textContent=e.message==='JOIN_TIMEOUT'?'部屋への接続がタイムアウトしました。もう一度試してね':'部屋に入れなかった…(招待や権限を確認してね)';return}
 if(epoch!==roomEpoch){rm.close();return}roomCode=c;newGame(3,true);G.net='guest';G.me=1;G.seq=0;G.gid=null;netStart(rm);waitingRoom=true;$('ovs').textContent='ホストを待ってる…';
 helloTimer=setInterval(()=>{if(G.gid||G.net!=='guest'){clearInterval(helloTimer);helloTimer=null}else send('hello',{room:c,ph:cfgPitcher,bs:cfgBatter})},1000);
 helloTimeout=setTimeout(()=>{
  if(G.net!=='guest'||G.gid)return;
  closeRoom();G.net=null;G.me=undefined;
  $('cancel-room').style.display='none';document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=false);
  $('ovt').textContent='ホストから応答がありません';$('ovs').textContent='ホストがまだ接続していないか、通信に失敗した可能性があります。合言葉を確認して再試行してください。';
 },HOST_HANDSHAKE_TIMEOUT_MS);
 send('hello',{room:c,ph:cfgPitcher,bs:cfgBatter});
 document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=true);$('cancel-room').style.display='inline-block'
};
$('cancel-room').onclick=()=>{closeRoom();G.net=null;G.me=undefined;hostN=1;$('code').value='';$('cancel-room').style.display='none';document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=false);$('ovt').textContent='⚾ 野球盤 STADIUM';$('ovs').innerHTML='打撃: 画面をドラッグしてカーソルを合わせ、<b>指を離した瞬間</b>にスイング!<br>投球: 球種を選び、カーソルで狙って「投げる!」。';$('ov').style.display='flex'};