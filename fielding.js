/* fielding.js — 守備到達判定 (Ver.1.7.3)
 *
 * 物理モデル (batResultPhysics) が作った打球 (速度・打球角度・方向・推定飛距離) を
 * 入力に、結果を先に抽選せず、野手がその打球に本当に到達できるかを
 * シミュレーションして結果 (アウト/安打/長打/HR) を決める。
 * ダイナマイト野球の方式 (先行シミュレーションで結果が創発する) の Re- 版で、
 * 打球・守備シミュレーター (アーティファクト) で検証した判定を本編の
 * フィールド寸法 (フェンス FENCE_PX=341px・塁間約100px) に合わせて移植したもの。
 *
 * 決め方の柱:
 *  1) 担当は到着時刻の単純レースではなく、ゾーン別の優先順位表で決める。
 *  2) 外野の芝 (本塁から grassLinePx 以遠) は外野手のテリトリー。内野手は
 *     外野手が明確に間に合わない浅い打球のときだけ代わる。
 *  3) 捕れなかった打球は、回収+返球と走者の競争 (回収レース) で塁を決める。
 *     浅い場所で野手の前に確保された打球は、時間が経っていても単打まで。
 *  4) HR かフェンス直撃かは、フェンス面での打球高度で分ける。
 *  5) 一塁手・三塁手の定位置はフェア地域内 (core.js の FD)。
 *
 * このファイルは純粋関数のみ (DOM・時刻に触らない) なので、tuner.js と
 * 単体テストからそのまま呼べる。乱数は使わない (同じ打球には同じ結果)。
 */

// 野手の到達時刻 (ms)。反応時間 + 加速 (accelMs で最高速到達) を積分した移動時間。
function fielderArrivalMs(distPx, reactMs, accelMs){
 const F=CONFIG.fielding, top=CONFIG.speed.runPx;
 const d=Math.max(0, distPx-CONFIG.fielding.catchMarginPx);
 if(d<=0) return reactMs;
 const A=accelMs||F.accelMs, dAccel=top*A/2; // 加速区間で進む距離
 if(d<=dAccel) return reactMs+Math.sqrt(2*A*d/top);
 return reactMs+A+(d-dAccel)/top;
}
const fielderPos=i=>({x:FD[i][0], y:FD[i][1]});
const distToHome=(x,y)=>Math.hypot(x-HP.x, y-HP.y);

// 方向 (deg, +は右翼側) と深さから、捕球候補の優先順位表を返す。
// 並びは「そのゾーンの主担当 → 次点 → バックアップ」。深いフライは外野手のみ。
function flyCandidates(angle, depth){
 const a=angle, deep=depth>=CONFIG.fielding.deepFlyPx, shallow=depth<70;
 if(shallow){
  // 本塁近くのポップ: 投手と両コーナーが主役
  if(a>=14) return [2,0,3];
  if(a<=-14) return [5,0,4];
  return [0,3,4];
 }
 if(a>=28) return deep?[8,7]:[8,3,2];
 if(a>=8) return deep?[8,7]:[8,7,3];
 if(a>-8) return deep?(a>=0?[7,8]:[7,6]):[7,3,4];
 if(a>-28) return deep?[6,7]:[6,7,4];
 return deep?[6,7]:[6,4,5];
}
function groundCandidates(angle){
 // 投手が処理するのは正面の打球だけ (SS・2B 方向のゴロを取りに行くことはない)
 const a=angle;
 if(a>=28) return [2,3];
 if(a>=8) return [3,2];
 if(a>-8) return a>=0?[3,4,0]:[4,3,0];
 if(a>-28) return [4,5];
 return [5,4];
}
const ofByAngle=a=>a>=18?8:a<=-18?6:7;

// 回収レース: 回収時刻 + 持ち替え + 返球到達 vs 走者 (900ms/塁)。
// 戻り先は二塁 (長打阻止の基準)。3B は深い/壁/ギャップ系だけに許す。
function retrievalBases(fieldMs, fromPos, opt){
 const F=CONFIG.fielding, run=CONFIG.speed.runnerMsPerBase;
 const throwMs=Math.hypot(fromPos.x-BS[2].x, fromPos.y-BS[2].y)/CONFIG.speed.throwPx;
 const backMs=fieldMs+F.transferMs+throwMs;
 if(backMs>run*3 && opt.canTriple) return '3B';
 if(backMs>run*2) return '2B';
 return '1B';
}

// ---- フライ/ライナー (打球角度 >= groundAng) ----
function resolveFly(info, a, ar){
 const F=CONFIG.fielding, C=CONFIG;
 const launch=info.launch, v=info.speed/3.6, lr=launch*P/180;
 const hangMs=2*v*Math.sin(lr)/9.8*1000*F.hangScale;
 // HR の境界はゲームの物差し (phys.hrMin) に合わせる。フェンス面での高度は
 // 実際の初速から計算し、空気抵抗で低くなる分を dragHeightK で割り引く
 // (実飛距離と一致する等価初速で計算すると、高度まで過小評価してしまう)。
 const fenceM=C.phys.hrMin;
 const distM=Number.isFinite(info.dist)?info.dist:(v*v*Math.sin(2*lr)/9.8*C.phys.distK);
 let fenceH=null;
 if(distM>=fenceM){
  const cos=Math.cos(lr);
  fenceH=F.dragHeightK*(Math.tan(lr)*fenceM-9.8*fenceM*fenceM/(2*v*v*cos*cos));
 }
 const isHR=fenceH!==null && fenceH>=F.fenceHeightM;
 const isWall=fenceH!==null && !isHR;
 const landPx=isWall?FENCE_PX-4:Math.min(distM*C.flyPxPerM, FENCE_PX);
 const to={x:HP.x+landPx*Math.sin(ar), y:HP.y-landPx*Math.cos(ar)};
 // 表示用プロファイル (判定と同じ物理から作る。表示側の独自式は廃止):
 //  hangMs=判定の滞空そのもの / dispMs=表示の飛行時間 (壁直撃・HR はフェンス面到達まで)
 //  apexM=頂点高度 (m、フェンス高度と同じ dragHeightK 割り引き) / fenceH=フェンス面高度 (m)
 //  hRatio=dispMs/hangMs (壁直撃では表示終端の高さが fenceH と一致する)
 const apexM=F.dragHeightK*(v*Math.sin(lr))**2/(2*9.8);
 const cos=Math.cos(lr);
 const fenceMs=fenceH!==null&&cos>0.05?fenceM/(v*cos)*1000*F.hangScale:null;
 const prof={hangMs, apexM, fenceH};
 if(isHR) return {k:'HR', resolved:true, to:null, fi:ofByAngle(a), wall:false, ...prof, dispMs:fenceMs??hangMs, hRatio:1};

 const depth=landPx;
 const cands=flyCandidates(a, depth);
 // 外野手の最速到達 (テリトリー判定用)
 let ofBest=Infinity;
 for(const i of cands) if(i>=6) ofBest=Math.min(ofBest, fielderArrivalMs(Math.hypot(fielderPos(i).x-to.x, fielderPos(i).y-to.y), F.reactFlyMs));
 let catcher=null, catchRatio=0;
 for(const i of cands){
  const p=fielderPos(i);
  const arr=fielderArrivalMs(Math.hypot(p.x-to.x, p.y-to.y), F.reactFlyMs);
  // 外野テリトリー: 内野手は、外野手が明確に間に合わない浅い打球のときだけ
  if(i<6 && depth>F.grassLinePx && !(ofBest>hangMs+F.territorySlackMs && depth<190)) continue;
  if(arr<=hangMs){ catcher=i; catchRatio=hangMs>0?arr/hangMs:1; break; }
 }
 if(catcher!==null){
  return {k:'fly', resolved:true, to, fi:catcher, finePlay:catchRatio>=F.finePlayRatio, wall:false, ...prof, dispMs:hangMs, hRatio:1};
 }
 // 捕れなかった: 回収レースで塁を決める (担当は優先順位の先頭の外野手)。
 // 外野手の頭上を越えた打球は、振り向いて壁まで追う時間が余分にかかる。
 const ri=cands.find(i=>i>=6) ?? ofByAngle(a);
 const rp=fielderPos(ri);
 const arrR=fielderArrivalMs(Math.hypot(rp.x-to.x, rp.y-to.y), F.reactFlyMs);
 const overshoot=Math.max(0, depth-distToHome(rp.x, rp.y));
 const fieldMs=Math.max(hangMs, arrR)+(overshoot>0?220+overshoot/C.speed.runPx:60);
 if(isWall){
  const k=retrievalBases(fieldMs, to, {canTriple:true});
  return {k:k==='1B'?'2B':k, resolved:true, to, fi:ri, wall:true, ...prof, dispMs:fenceMs??hangMs, hRatio:hangMs>0?(fenceMs??hangMs)/hangMs:1};
 }
 if(depth>=F.deepHitPx){
  const k=retrievalBases(fieldMs, to, {canTriple:Math.abs(a)>=14});
  return {k, resolved:true, to, fi:ri, wall:false, ...prof, dispMs:hangMs, hRatio:1};
 }
 return {k:'1B', resolved:true, to, fi:ri, wall:false, ...prof, dispMs:hangMs, hRatio:1};
}

// ---- ゴロ (打球角度 < groundAng): 打球の進路上で野手が迎撃できるかを判定 ----
// 野手は進路上の任意の点へ走って迎撃する (チャージもこの探索に含まれる)。
// 迎撃できる点の中で「捕球+送球が最速」の点を選び、一塁レースで勝負する。
// 誰も迎撃できなければ外野手の回収レースになる。到達は解析的に計算する
// (ボールは土→芝の2区間減速、野手は加速つき到達時刻) ので決定的に決まる。
function resolveGround(info, a, ar){
 const F=CONFIG.fielding, C=CONFIG;
 const ux=Math.sin(ar), uy=-Math.cos(ar);
 const lr=(info.launch||0)*P/180;
 const v0=(info.speed/3.6)*Math.cos(lr)*C.flyPxPerM/1000*F.rollSpeedK; // px/ms
 const pointAt=d=>({x:HP.x+ux*d, y:HP.y+uy*d});
 // 深さ d までボールが転がる時刻 (届かなければ Infinity)。区間ごとに2次方程式で解く
 const vDirtOut=Math.sqrt(Math.max(0, v0*v0-2*F.rollDecelDirt*F.dirtPx));
 const tDirt=v0>F.rollDecelDirt*0?(v0-vDirtOut)/F.rollDecelDirt:Infinity;
 const stopDepth=vDirtOut>0?F.dirtPx+vDirtOut*vDirtOut/(2*F.rollDecelGrass):(v0*v0)/(2*F.rollDecelDirt);
 const ballTimeAt=d=>{
  if(d<=F.dirtPx){
   const disc=v0*v0-2*F.rollDecelDirt*d;
   return disc<0?Infinity:(v0-Math.sqrt(disc))/F.rollDecelDirt;
  }
  const disc=vDirtOut*vDirtOut-2*F.rollDecelGrass*(d-F.dirtPx);
  return disc<0?Infinity:tDirt+(vDirtOut-Math.sqrt(disc))/F.rollDecelGrass;
 };
 const wall=stopDepth>=FENCE_PX-2;
 const effStop=Math.min(stopDepth, FENCE_PX-6);
 // 候補野手が進路上の点 d で迎撃できるか (到着がボールの通過に間に合うか)。
 // 速いゴロは、野手が先回りして構えている点でしか確保できない。
 const ballSpeedAt=d=>d<=F.dirtPx?Math.sqrt(Math.max(0, v0*v0-2*F.rollDecelDirt*d)):Math.sqrt(Math.max(0, vDirtOut*vDirtOut-2*F.rollDecelGrass*(d-F.dirtPx)));
 const canIntercept=(fi, d, react, slack)=>{
  const pt=pointAt(d), fp=fielderPos(fi);
  const arr=fielderArrivalMs(Math.hypot(fp.x-pt.x, fp.y-pt.y)*F.routeK, react, F.accelGroundMs), bt=ballTimeAt(d);
  if(arr>bt+slack) return false;
  // 速いゴロは、野手が十分に先回りして構えている点でしか確保できない
  // (到達=確保ではない。170km/h級では 260ms 前には着いていないと弾く)
  if(react===F.reactGroundIFMs){
   const bs=ballSpeedAt(d);
   const setNeed=bs>.15?260:bs>F.fastBallPxMs?140:0;
   if(arr>bt-setNeed) return false;
  }
  return true;
 };
 // 内野手: 自分の守備位置の前後 (zoneDepthPx) の範囲で、迎撃点の中から
 // 一塁レースが最速の手を探す。範囲外は担当外 (抜ける打球がここから生まれる)
 const ifCands=groundCandidates(a);
 let best=null;
 for(const fi of ifCands){
  const fp=fielderPos(fi), myDepth=distToHome(fp.x, fp.y);
  const dLo=Math.max(40, myDepth-F.zoneDepthPx), dHi=Math.min(F.grassLinePx, myDepth+F.zoneDepthPx);
  for(let d=dLo; d<=dHi; d+=10){
   if(!canIntercept(fi, d, F.reactGroundIFMs, 40)) continue;
   const pt=pointAt(d);
   const throwMs=Math.hypot(pt.x-BS[1].x, pt.y-BS[1].y)/C.speed.throwPx;
   const total=ballTimeAt(d)*F.raceScale+F.transferMs+throwMs;
   if(!best||total<best.total) best={fi, total, pt, d};
  }
 }
 if(best){
  const to=best.pt;
  // 表示の飛行時間は、判定が使ったボールの到達時刻 ballTimeAt そのもの
  if(best.total<=C.speed.runnerMsPerBase) return {k:'gr', resolved:true, to, fi:best.fi, ground:true, dispMs:ballTimeAt(best.d)};
  return {k:'gr', resolved:true, forceSafe:true, to, fi:best.fi, ground:true, dispMs:ballTimeAt(best.d)};
 }
 // 内野で止まった打球 (ドリブル) は最寄りの内野手が拾って送球勝負
 if(effStop<F.grassLinePx){
  let bi=ifCands[0], bt=Infinity;
  const pt=pointAt(effStop);
  for(const fi of ifCands){
   const fp=fielderPos(fi);
   const arr=fielderArrivalMs(Math.hypot(fp.x-pt.x, fp.y-pt.y)*F.routeK, F.reactGroundIFMs, F.accelGroundMs);
   if(arr<bt){ bt=arr; bi=fi; }
  }
  const throwMs=Math.hypot(pt.x-BS[1].x, pt.y-BS[1].y)/C.speed.throwPx;
  const total=bt*F.raceScale+F.transferMs+throwMs;
  if(total<=C.speed.runnerMsPerBase) return {k:'gr', resolved:true, to:pt, fi:bi, ground:true, dispMs:ballTimeAt(effStop)};
  return {k:'gr', resolved:true, forceSafe:true, to:pt, fi:bi, ground:true, dispMs:ballTimeAt(effStop)};
 }
 // 外野手の回収: 進路上で迎撃できる最も浅い点で確保する
 const ofI=ofByAngle(a), ofP=fielderPos(ofI);
 let fieldDepth=effStop, fieldT=fielderArrivalMs(Math.hypot(ofP.x-pointAt(effStop).x, ofP.y-pointAt(effStop).y), F.reactGroundOFMs, F.accelGroundMs);
 for(let d=F.grassLinePx+5; d<=effStop; d+=12){
  if(canIntercept(ofI, d, F.reactGroundOFMs, 60)){ fieldDepth=d; fieldT=Math.max(fielderArrivalMs(Math.hypot(ofP.x-pointAt(d).x, ofP.y-pointAt(d).y), F.reactGroundOFMs, F.accelGroundMs), ballTimeAt(d)); break; }
 }
 const fPos=pointAt(fieldDepth);
 // 浅い場所で野手の前に確保されたら単打まで (確保位置キャップ)
 const inFront=fieldDepth<=distToHome(ofP.x, ofP.y)+10;
 if(inFront && !wall) return {k:'1B', resolved:true, to:fPos, fi:ofI, ground:true, dispMs:ballTimeAt(fieldDepth)};
 const k=retrievalBases(fieldT*F.raceScale, fPos, {canTriple:wall||Math.abs(a)>=20});
 return {k, resolved:true, to:fPos, fi:ofI, ground:true, wall:k!=='1B'&&wall, dispMs:ballTimeAt(fieldDepth)};
}

// 打球結果の入口。batResultPhysics の info から最終結果を決める。
// 戻り値: {k, resolved:true, to, fi, ...} / 判定できない場合は null (従来処理に任せる)
function resolveBattedBall(info){
 if(!info || !Number.isFinite(info.launch) || !Number.isFinite(info.speed) || !Number.isFinite(info.angle)) return null;
 const F=CONFIG.fielding; if(!F) return null;
 const a=Math.max(-44, Math.min(44, info.angle)), ar=a*P/180;
 if(info.launch<CONFIG.phys.groundAng) return resolveGround(info, a, ar);
 return resolveFly(info, a, ar);
}
