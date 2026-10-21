/* hud.js — スコア表示・バナー・メッセージ */
function banner(t,c){G.bid=(G.bid|0)+1;G.bt=[t,c];const b=$('bn');b.textContent=t;b.className='';void b.offsetWidth;b.className='on'+(c?' '+c:'')}
const setMsg=t=>$('msg').textContent=t;
function updateHud(){
 if(G.prac)return pracHud();
 const n=Math.max(G.N,G.inn),sb=$('sb');
 sb.replaceChildren();
 const head=document.createElement('tr'),blank=document.createElement('th');head.appendChild(blank);
 for(let i=1;i<=n;i++){const th=document.createElement('th');th.textContent=String(i);head.appendChild(th)}
 for(const label of ['R','H']){const th=document.createElement('th');th.textContent=label;head.appendChild(th)}
 sb.appendChild(head);
 for(let t=0;t<2;t++){
  const tr=document.createElement('tr'),name=document.createElement('td');
  name.style.color=TC[t];name.textContent=G.pvp?(t===0?'P1 (ビジター)':'P2 (ホーム)'):(t===G.humanTeam?'あなた':'CPU');tr.appendChild(name);
  for(let i=0;i<n;i++){const td=document.createElement('td');td.textContent=G.runs[t][i]==null?'':String(G.runs[t][i]);tr.appendChild(td)}
  const total=document.createElement('td'),b=document.createElement('b');b.textContent=String(tot(t));total.appendChild(b);
  const hits=document.createElement('td');hits.textContent=String(G.hits[t]);tr.append(total,hits);sb.appendChild(tr);
 }
 const L=(k,v,m)=>`<div>${k}${Array.from({length:m},(_,i)=>`<i class="l ${i<v?'on l'+k.toLowerCase():''}"></i>`).join('')}</div>`;
 $('cn').innerHTML=L('B',G.cnt.b,3)+L('S',G.cnt.s,2)+L('O',Math.min(G.outs,2),2);
 const battingTeam=G.top?0:1,defTeam=1-battingTeam;
 const handStr=G.pitcherHands&&G.pitcherHands[defTeam]===1?'右投':'左投';
 const curBatterSide=G.batterSides?(G.batterSides[battingTeam]==='right'?'右打':'左打'):'右打';
 const humanBatting=G.net?batHuman():(!G.pvp&&battingTeam===G.humanTeam);
 $('st').textContent=`${G.inn}回${G.top?'表':'裏'} (${handStr} / ${curBatterSide})  ${G.pvp?(G.top?'🏏 P1攻撃 / P2投手':'🏏 P2攻撃 / P1投手')+(G.net?(G.me===0?' [あなた=P1]':' [あなた=P2]'):''):humanBatting?'🏏 あなたの攻撃':'⚾ あなたの守備'}`;
 document.querySelectorAll('.pt').forEach(b=>b.classList.toggle('on',b.dataset.t===G.sel));sync();
}