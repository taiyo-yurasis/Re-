/* net.js — オンライン対戦(Supabase Realtime) */
let RM=null,gb=0,hostN=3,SB=null,roomCode=null,helloTimer=null,waitingRoom=false;
function sbRoom(){if(!SB&&window.supabase&&!SUPA_URL.includes('YOUR-')&&!SUPA_KEY.includes('YOUR-'))SB=supabase.createClient(SUPA_URL,SUPA_KEY,{realtime:{params:{eventsPerSecond:15}}});return SB?{join:joinRoom}:null}
function closeRoom(){
 if(helloTimer){clearInterval(helloTimer);helloTimer=null}
 const old=RM;RM=null;roomCode=null;waitingRoom=false;
 if(old&&old.close)old.close();
}
function joinRoom(name){return new Promise((res,rej)=>{
 const ch=SB.channel(name,{config:{broadcast:{self:false},presence:{key:Math.random().toString(36).slice(2)}}}),hs={},leaveHandlers=[];
 ['snap','throw','swing','hello'].forEach(ev=>ch.on('broadcast',{event:ev},m=>hs[ev]&&hs[ev]({isMe:false,data:m.payload})));
 ch.on('presence',{event:'leave'},()=>{if(Object.keys(ch.presenceState()).length<=1)leaveHandlers.forEach(fn=>fn())});
 ch.subscribe(async st=>{
  if(st==='SUBSCRIBED'){try{await ch.track({online:true});res({emit:(t,d)=>ch.send({type:'broadcast',event:t,payload:d}),on:(t,fn)=>{hs[t]=fn},onLeave:fn=>leaveHandlers.push(fn),close:()=>{ch.untrack();SB.removeChannel(ch)}})}catch(e){rej(e)}}
  else if(st==='CHANNEL_ERROR'||st==='TIMED_OUT')rej(new Error(st))
 })
})}
const send=(t,d)=>{if(RM)RM.emit(t,d).catch(()=>{})};
const canBat=()=>G.net?(G.top?0:1)===G.me:batHuman(),canPit=()=>G.net?(G.top?1:0)===G.me:pitHuman();
function snap(){
 const n=performance.now(),p=G.pitch,f=G.fl;
 return {gid:G.gid,seq:++G.seq,hostTeam:G.me,inn:G.inn,top:G.top,outs:G.outs,cnt:G.cnt,bases:G.bases,runs:G.runs,hits:G.hits,N:G.N,ph:G.phase,bid:G.bid|0,bt:G.bt,wo:G.walkoff,m:$('msg').textContent,sw:n-G.swingT<400?n-G.swingT:null,pitcherHands:G.pitcherHands,batterSides:G.batterSides,p:p&&{id:p.id,type:p.type,x:p.x,y:p.y,dur:p.dur,sg:p.sg,age:n-p.t0,fr:G.phase==='pitch'?null:p.t},f:f&&{id:f.id,out:f.out,fi:f.fi,ri:f.ri,wall:f.wall,to:f.to,kind:f.kind,dur:f.dur,h:f.h,diving:f.diving,age:n-f.t0},mv:G.mv&&{id:G.mv.id,age:n-G.mv.t0,dur:G.mv.dur,moves:G.mv.moves,stay:G.mv.stay},th:G.th&&{id:G.th.id,age:n-G.th.t0,dur:G.th.dur,from:G.th.from,to:G.th.to,steps:G.th.steps},rl:G.rl&&{id:G.rl.id,age:n-G.rl.t0,moves:G.rl.moves}}
}
let lastSync=0;const sync=()=>{const n=performance.now();if(G.net==='host'&&G.gid&&n-lastSync>110){lastSync=n;send('snap',snap())}};
setInterval(sync,200);
function validSnap(s){
 if(!s||typeof s!=='object'||!Number.isFinite(s.seq)||!Number.isInteger(s.inn)||s.inn<1||s.inn>20||typeof s.top!=='boolean'||!Number.isInteger(s.N)||s.N<1||s.N>20||!Number.isInteger(s.outs)||s.outs<0||s.outs>3)return false;
 if(!s.cnt||!Number.isInteger(s.cnt.b)||s.cnt.b<0||s.cnt.b>3||!Number.isInteger(s.cnt.s)||s.cnt.s<0||s.cnt.s>2)return false;
 if(!Array.isArray(s.bases)||s.bases.length!==4||s.bases.some(v=>v!==0&&v!==1))return false;
 if(!Array.isArray(s.runs)||s.runs.length!==2||s.runs.some(a=>!Array.isArray(a)||a.length>20||a.some(v=>v!=null&&(!Number.isFinite(Number(v))||!Number.isInteger(Number(v))||Number(v)<0||Number(v)>999))))return false;
 if(!Array.isArray(s.hits)||s.hits.length!==2||s.hits.some(v=>!Number.isInteger(Number(v))||Number(v)<0||Number(v)>999))return false;
 if(s.p&&(typeof s.p.type!=='string'||!Object.hasOwn(TY,s.p.type)||!Number.isFinite(Number(s.p.dur))||Number(s.p.dur)<=0||!Number.isFinite(Number(s.p.x))||Number(s.p.x)<0||Number(s.p.x)>220||!Number.isFinite(Number(s.p.y))||Number(s.p.y)<0||Number(s.p.y)>220||!Number.isFinite(Number(s.p.age))||Number(s.p.age)<0))return false;
 if(!['idle','ready','aim','sent','pitch','busy','over'].includes(s.ph))return false;
 return true
}
function applySnap(s){
 if(G.net!=='guest'||!validSnap(s))return;
 if(s.gid!==G.gid){G.gid=s.gid;G.seq=0;gb=0;G.over=false;$('ov').style.display='none';if(Number.isInteger(s.hostTeam))G.me=1-s.hostTeam}
 if(s.seq<=G.seq)return;G.seq=s.seq;const n=performance.now();
 Object.assign(G,{N:Number(s.N),inn:Number(s.inn),top:s.top,outs:Number(s.outs),cnt:{b:Number(s.cnt.b),s:Number(s.cnt.s)},bases:s.bases.map(Number),runs:s.runs.map(a=>a.map(v=>v==null?null:Number(v))),hits:s.hits.map(Number),walkoff:!!s.wo,pitcherHands:s.pitcherHands,batterSides:s.batterSides});
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
 const ms=(p.t-1)*p.dur,[bx,by]=bp(p,p.t),r=batResult(p,ms,bx,by,cl(m.x,0,220),cl(m.y,0,220));result(r.k,ms,r)
}
function netStart(rm){
 RM=rm;
 rm.on('snap',m=>{if(!m.isMe)applySnap(m.data)});
 rm.on('throw',m=>{const d=m.data;if(!m.isMe&&G.net==='host'&&G.phase==='aim'&&!canPit()&&d){
  const type=typeof d.type==='string'&&Object.hasOwn(TY,d.type)?d.type:'s';
  const pos=v=>{const n=Number(v);return Number.isFinite(n)?cl(n,0,220):110};
  throwP(type,pos(d.x),pos(d.y));
 }});
 rm.on('swing',m=>{if(!m.isMe&&G.net==='host'&&!canBat())remoteSwing(m.data)});
 rm.on('hello',m=>{const d=m.data;if(!m.isMe&&G.net==='hosting'&&d&&d.room===roomCode){
  $('ov').style.display='none';const team=Math.random()<.5?0:1;
  newGame(hostN,true,true,team);G.net='host';G.me=team;G.seq=0;G.gid=Math.random();startHalf();
 }});
 rm.onLeave(()=>{if(G.net==='host'||G.net==='guest'){closeRoom();G.net=null;$('ov').style.display='flex';$('ovt').textContent='対戦相手が切断しました';$('ovs').textContent='部屋を閉じました。もう一度対戦するには新しい部屋を作ってね。';document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=false)}});
}
async function hostRoom(N){
 if(waitingRoom)return;closeRoom();
 $('ov').style.display='flex';const room=sbRoom();
 if(!room){$('ovs').textContent='Supabaseの設定が未入力か、読み込めなかった…(index.htmlの設定を確認)';return}
 const code=Math.random().toString(36).substring(2,8).toUpperCase();let rm;
 try{rm=await room.join('yk'+code)}catch(e){$('ovs').textContent='部屋を作れなかった。もう一度試してね';return}
 hostN=N;roomCode=code;waitingRoom=true;G.net='hosting';netStart(rm);$('ovt').textContent='合言葉 '+code;$('ovs').textContent='相手にこの6桁を伝えて。入ってくるのを待ってるよ…';
 document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=true)
}
$('jn').onclick=async()=>{
 if(waitingRoom)return;
 const c=$('code').value.trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(c)){$('ovs').textContent='合言葉を6桁で入れてね';return}
 closeRoom();const room=sbRoom();if(!room){$('ovs').textContent='Supabaseの設定が未入力か、読み込めなかった…(index.htmlの設定を確認)';return}
 let rm;try{rm=await room.join('yk'+c)}catch(e){$('ovs').textContent='部屋に入れなかった…(招待や権限を確認してね)';return}
 roomCode=c;newGame(3,true,true);G.net='guest';G.me=1;G.seq=0;G.gid=null;netStart(rm);waitingRoom=true;$('ovs').textContent='ホストを待ってる…';
 helloTimer=setInterval(()=>{if(G.gid||G.net!=='guest'){clearInterval(helloTimer);helloTimer=null}else send('hello',{room:c})},1000);send('hello',{room:c});
 document.querySelectorAll('#ov [data-n],#jn').forEach(b=>b.disabled=true)
};