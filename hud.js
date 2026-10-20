/* hud.js — スコア表示・バナー・メッセージ */
/* ---- HUD ---- */
function banner(t,c){G.bid=(G.bid|0)+1;G.bt=[t,c];const b=$('bn');b.textContent=t;b.className='';void b.offsetWidth;b.className='on'+(c?' '+c:'')}
const setMsg=t=>$('msg').textContent=t;
function updateHud(){
 const n=Math.max(G.N,G.inn);let h='<tr><th></th>';
 for(let i=1;i<=n;i++)h+=`<th>${i}</th>`;
 h+='<th>R</th><th>H</th></tr>';
 (G.pvp?['P1','P2']:['あなた','CPU']).forEach((nm,t)=>{h+=`<tr><td style="color:${TC[t]}">${nm}</td>`;for(let i=0;i<n;i++){const v=G.runs[t][i];h+=`<td>${v==null?'':v}</td>`}h+=`<td><b>${tot(t)}</b></td><td>${G.hits[t]}</td></tr>`});
 $('sb').innerHTML=h;
 const L=(k,v,m)=>`<div>${k}${Array.from({length:m},(_,i)=>`<i class="l ${i<v?'on l'+k.toLowerCase():''}"></i>`).join('')}</div>`;
 $('cn').innerHTML=L('B',G.cnt.b,3)+L('S',G.cnt.s,2)+L('O',Math.min(G.outs,2),2);
 
 const defTeam = G.top ? 1 : 0;
 const handStr = G.pitcherHands && G.pitcherHands[defTeam] === 1 ? '右投' : '左投';
 const curBatterSide = G.batterSides ? (G.batterSides[G.top ? 0 : 1] === 'right' ? '右打' : '左打') : '右打';
 $('st').textContent=`${G.inn}回${G.top?'表':'裏'} (${handStr} / ${curBatterSide})  ${G.pvp?(G.top?'🏏 P1攻撃 / P2投手':'🏏 P2攻撃 / P1投手')+(G.net?(G.me?' [あなた=P2]':' [あなた=P1]'):''):G.top?'🏏 あなたの攻撃':'⚾ あなたの守備'}`;
 
 document.querySelectorAll('.pt').forEach(b=>b.classList.toggle('on',b.dataset.t===G.sel));sync();
}
