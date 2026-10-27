/* practice.js — 打撃練習モード(自由練習)。結果を横取りして成績に集計し、約1〜2秒後に次の球を出す */
const pracCfg={types:new Set(['s','sl','c','f','sh','cu','ct','ss']),course:'r'};
const PR_RL={ball:'ボール',look:'見逃しストライク',miss:'空振り',foul:'ファウル','1B':'ヒット','2B':'ツーベース','3B':'スリーベース',HR:'ホームラン!!',fly:'フライアウト',gr:'ゴロアウト'};
const PR_DL={pull:'引っ張り',center:'センター',oppo:'流し'},PR_CL={in:'内角',mid:'真ん中',out:'外角'};
const pracStats=()=>({n:0,sw:0,msSum:0,miss:0,foul:0,look:0,ball:0,play:0,res:{'1B':0,'2B':0,'3B':0,HR:0,fly:0,gr:0},tier:{solid:0,normal:0,weak:0}});

function startPractice(){
 newGame(3,false);G.humanTeam=0;G.top=true;G.prac=pracStats();
 $('hint').textContent='';
 $('prac-ctl').style.display='flex';ready()}

// 次の球(球種・コース)。ready() から呼ばれる
function pracPitch(){
 const ts=[...pracCfg.types],t=ts[ri(0,ts.length-1)],c=pracCfg.course,sgn=G.batterSides[0]==='left'?-1:1;
 let x;const y=rnd(66,154);
 if(c==='in')x=110-sgn*rnd(26,60);else if(c==='out')x=110+sgn*rnd(26,60);else if(c==='mid')x=110+rnd(-20,20);else x=rnd(60,160);
 return{t,x,y}}

// 打球を試合と同じ見た目でフィールドに飛ばす (判定は変えず、着地点の計算だけ試合側と揃える)。
// 飛ばした場合は flight の完了後に次の球へ進むので true を返す
function pracFlight(k,info,ms){
 const a=(info&&Number.isFinite(info.angle)?cl(info.angle,-44,44):cl(cl((ms||0)*.3,-38,38)+rnd(-9,9),-42,42))*P/180;
 const done=()=>later(350,ready);
 if(k==='gr'){
  const d=rnd(70,130);
  flight({x:240+d*Math.sin(a),y:375-d*Math.cos(a)},'ground',done,1);
  return true;
 }
 if(k==='fly'){
  const d=flyDistPx(info);
  flight({x:240+d*Math.sin(a),y:375-d*Math.cos(a)},'fly',done,1);
  return true;
 }
 if(k==='1B'||k==='2B'||k==='3B'||k==='HR'){
  const edge=(k==='2B'||k==='3B')&&Math.abs(a)>=36*P/180;
  const wall=(k==='2B'||k==='3B')&&!edge;
  const ground=edge||(k==='1B'&&Math.random()<.5);
  const d=wall?R-8:(k==='1B'?rnd(190,230):k==='2B'?rnd(235,290):k==='3B'?rnd(295,312):rnd(345,380));
  flight({x:240+d*Math.sin(a),y:375-d*Math.cos(a)},k==='HR'?'hr':ground?'ground':'fly',done,0,wall?{wall:true}:null);
  return true;
 }
 return false;
}

// result() から呼ばれる。アウト・カウント・走者は動かさず、集計と表示だけ行う
function pracResult(k,ms,info){
 const S=G.prac,p=G.pitch,L=CONFIG.tierLabels;S.n++;
 let parts=[TY_NAMES[p.type]];
 if(ms!=null){
  const judge=judgeRef(p,ms,G.cur.x,G.cur.y),dd=judge.dd,lift=(G.cur.y-judge.ry)/CONFIG.cursorSize,J=CONFIG.judge||{};
  // タイミング表示と平均ズレは、判定と同じ実効ズレ(コース別の理想を差し引いた値)で出す
  const ems=effMs(p,ms);
  S.sw++;S.msSum+=ems;
  parts.push(`${ems<0?'早い':'遅い'} ${Math.abs(ems).toFixed(0)}ms`);
  parts.push(J.nearer&&J.nearer[p.type]?`距離 ${dd.toFixed(0)}px(基準:${judge.usedBall?'ボール':'着地点'})`:`距離 ${dd.toFixed(0)}px`);
  const correctionScale=CONFIG.batMode==='physics'?(Number.isFinite(CONFIG.physicsCorrectionScale)?CONFIG.physicsCorrectionScale:1):1;
  if(judge.bonusRate*correctionScale>0)parts.push(`ミート+${(judge.bonusRate*correctionScale*100).toFixed(0)}%`);
  const lateReduction=judge.latePenalty*judge.lateRate*correctionScale;
  if(lateReduction>0)parts.push(`遅れ-${(lateReduction*100).toFixed(0)}%`);
  if(k==='miss')parts.push(Math.abs(ms)>CONFIG.timingWindowMs?'タイミング外':dd>CONFIG.cursorSize?'カーソルが遠い':'ボール球を振った');
  if(info&&info.tier){S.tier[info.tier]++;parts.push('ミート:'+L[info.tier0||info.tier]+(info.tier0&&info.tier0!==info.tier?'→'+L[info.tier]:''))}
  if(k==='foul'&&info&&info.angle!=null)parts.push(`角度 ${info.angle.toFixed(0)}°`);
  if(info&&Number.isFinite(info.speed))parts.push(`打球 ${info.speed.toFixed(0)}km/h / 角度 ${info.launch.toFixed(0)}°`+(Number.isFinite(info.dist)?` / 推定飛距離 ${info.dist.toFixed(0)}m`:''));
  if(info&&info.dir){parts.push(`${PR_DL[info.dir]}×${PR_CL[info.course]}`,lift>CONFIG.liftBand?'フライ寄り':lift<-CONFIG.liftBand?'ゴロ寄り':'ライナー')}
 }
 if(k==='ball')S.ball++;else if(k==='look')S.look++;else if(k==='miss')S.miss++;else if(k==='foul')S.foul++;else{S.play++;S.res[k]++}
 // 見逃し(msがnull/undefined)では直前の打撃詳細を維持する。
 if(ms!=null){const detail=$('hint');if(detail)detail.textContent=`${PR_RL[k]||k} ｜ ${parts.join(' / ')}`;}
 banner(PR_RL[k]||k);setMsg(`[ ${parts.join(' / ')} ] ${PR_RL[k]||k}`);updateHud();
 // インプレーの打球はフィールドを飛ばしてから次の球へ。それ以外は従来通り少し待つ
 if(!(ms!=null&&pracFlight(k,info,ms)))later(500,ready)}

function pracHud(){
 const S=G.prac,sb=$('prac-stats');sb.style.display='table';document.querySelector('.hd').style.display='none';sb.replaceChildren();
 const pc=(v,d)=>d?(v/d*100).toFixed(0)+'%':'-',sw=S.miss+S.foul+S.play,R=S.res,hit=R['1B']+R['2B']+R['3B']+R.HR,xb=R['2B']+R['3B']+R.HR;
 const avg=S.sw?`${S.msSum/S.sw<0?'早め':'遅め'} ${Math.abs(S.msSum/S.sw).toFixed(0)}ms`:'-';
 const rows=[['球数',S.n,'スイング',sw],['空振り',`${S.miss} (${pc(S.miss,sw)})`,'ファウル',`${S.foul} (${pc(S.foul,sw)})`],
  ['見逃し S/B',`${S.look}/${S.ball}`,'インプレー',S.play],['ヒット',`${hit} (${pc(hit,S.play)})`,'長打/HR',`${xb}/${R.HR}`],
  ['平均ズレ',avg,'ミート 芯/普/か',`${S.tier.solid}/${S.tier.normal}/${S.tier.weak}`]];
 rows.forEach(r=>{const tr=document.createElement('tr');r.forEach((v,i)=>{const td=document.createElement(i%2?'td':'th');td.textContent=String(v);tr.appendChild(td)});sb.appendChild(tr)});
 $('cn').textContent='';
 $('st').textContent=`🏏 打撃練習(${G.batterSides[0]==='right'?'右打':'左打'}) 結果が出ると自動で次の球`}
