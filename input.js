/* input.js — 入力(ポインタ/キー)とタイトル画面のボタン */
/* ---- input ---- */
const setCur=(x,y)=>{G.cur.x=cl(x,0,220);G.cur.y=cl(y,0,220)};
const zpt=e=>{const r=zc.getBoundingClientRect();return[(e.clientX-r.left)/r.width*220,(e.clientY-r.top)/r.height*220]};
const fpt=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)/r.width*220,(e.clientY-r.top)/r.height*220]};

function act(){if(G.phase==='aim'){if(pitHuman())pitchNow()}else swing()}
let lastT=null,mdown=false;

function bind(el){
 el.addEventListener('pointerdown',e=>{e.preventDefault();
  if(e.pointerType==='mouse'){
   if(el===zc) setCur(...zpt(e));
   else if(el===cv) setCur(...fpt(e));
   if(G.phase==='aim') pitchNow(); else mdown=true;
  } else {lastT=[e.clientX,e.clientY]}
 });
 el.addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse'){
   if(el===zc) setCur(...zpt(e));
   else if(el===cv) setCur(...fpt(e));
  } else if(lastT){
   const k=220/zc.getBoundingClientRect().width*1.6;
   setCur(G.cur.x+(e.clientX-lastT[0])*k, G.cur.y+(e.clientY-lastT[1])*k);
   lastT=[e.clientX,e.clientY];
  }
 });
}
bind(zc);bind(cv);
addEventListener('pointerup',e=>{const w=e.pointerType==='mouse'?mdown:lastT;mdown=false;lastT=null;if(w&&batHuman()&&G.phase==='pitch')swing()});
addEventListener('pointercancel',()=>{lastT=null;mdown=false});
$('sw').addEventListener('pointerdown',e=>{e.preventDefault();pitchNow()});

document.querySelectorAll('.pt').forEach(b=>b.addEventListener('click',()=>{G.sel=b.dataset.t;if(G.phase==='aim')resetPitchOffset();updateHud()}));
$('tg1').addEventListener('click',()=>{
 $('tg1').classList.add('on');$('tg2').classList.remove('on');
 $('p_group1').style.display='flex';$('p_group2').style.display='none';
});
$('tg2').addEventListener('click',()=>{
 $('tg2').classList.add('on');$('tg1').classList.remove('on');
 $('p_group2').style.display='flex';$('p_group1').style.display='none';
});

document.querySelectorAll('[data-ph]').forEach(b=>b.addEventListener('click',e=>{
 document.querySelectorAll('[data-ph]').forEach(x=>x.classList.remove('on'));
 e.target.classList.add('on');
 cfgPitcher = +e.target.dataset.ph;
}));
document.querySelectorAll('[data-bs]').forEach(b=>b.addEventListener('click',e=>{
 document.querySelectorAll('[data-bs]').forEach(x=>x.classList.remove('on'));
 e.target.classList.add('on');
 cfgBatter = e.target.dataset.bs;
}));
document.querySelectorAll('[data-cpu-first]').forEach(b=>b.addEventListener('click',e=>{
 document.querySelectorAll('[data-cpu-first]').forEach(x=>x.classList.remove('on'));
 e.target.classList.add('on');cfgCpuFirst=e.target.dataset.cpuFirst==='1';
}));

addEventListener('keydown',e=>{
 if(e.code==='Space'||e.key==='Enter'){e.preventDefault();act()}
});
document.querySelectorAll('#ov [data-n]').forEach(b=>b.addEventListener('click',()=>{
 $('ov').style.display='none';if(pvpSel===2)return hostRoom(+b.dataset.n);newGame(+b.dataset.n,pvpSel,openingTop(pvpSel));startHalf()}));

let pvpSel=0,ck='';
document.querySelectorAll('#ov [data-m]').forEach(b=>b.addEventListener('click',()=>{
 pvpSel=+b.dataset.m;
 document.querySelectorAll('#ov [data-m]').forEach(x=>x.classList.toggle('on',x===b));
 $('cpu-order-row').style.display=pvpSel===0?'flex':'none';
}));
function ctl(){const k=G.net?(G.phase==='aim'&&canPit()?'p':'h'):G.pvp?(G.phase==='aim'?'p':'h'):(G.top?'h':'p');if(k===ck)return;ck=k;
 $('pts').style.display=k==='p'?'flex':'none';$('sw').style.display=k==='p'?'':'none';$('hint').style.display=k==='h'?'flex':'none'}
