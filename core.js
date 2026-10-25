/* core.js — 共通ヘルパー・フィールド定数・ゲーム状態 */
const $=i=>document.getElementById(i),rnd=(a,b)=>a+Math.random()*(b-a),ri=(a,b)=>Math.floor(rnd(a,b+1)),cl=(v,a,b)=>Math.max(a,Math.min(b,v));
const cv=$('f'),cx=cv.getContext('2d'),zc=$('z'),zx=zc.getContext('2d');
const HP={x:240,y:375},R=320,P=Math.PI,TC=['#ff5a5f','#4da3ff'];
const BS=[0,{x:311,y:304},{x:240,y:234},{x:169,y:304}];
const FD=[[240,292],[240,392],[322,300],[285,245],[195,245],[158,300],[120,170],[240,125],[360,170]];
function outfieldTarget(to){
 const dx=to.x-HP.x,dy=to.y-HP.y,len=Math.hypot(dx,dy);
 if(len>=190||len===0)return{x:to.x,y:to.y};
 return{x:HP.x+dx/len*190,y:HP.y+dy/len*190};
}

let pid=0;
let G={id:0};
const later=(ms,fn)=>{const id=G.id;setTimeout(()=>{if(G.id===id)fn()},ms)};
const tot=t=>G.runs[t].reduce((a,b)=>a+b,0);
const batHuman=()=>G.net?(G.top?0:1)===G.me:G.pvp||(G.top?0:1)===G.humanTeam,pitHuman=()=>G.net?(G.top?1:0)===G.me:G.pvp||(G.top?1:0)===G.humanTeam;
// 着地点のゾーン分類: 0=甘い 1=ゾーン内 2=際どい外 3=はっきり外。
// ゾーン内の境界は、表示される枠線(太さ3px)の外側の縁に合わせて中心から67.5pxとする
const dist=p=>{const [x,y]=bp(p,1),m=Math.max(Math.abs(x-110),Math.abs(y-110));return m<=26.4?0:m<=67.5?1:m<=99?2:3};
