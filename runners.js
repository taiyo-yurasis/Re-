/* runners.js — 走者の目標塁から次の配置・走塁アニメーションを計算する */
// targets は「元の塁:目標塁」。この関数は G・DOM・時計に触れない純関数。
function settle(targets,batterTarget=null,opts={}){
 const bases=[0,0,0,0],moves=[],stay=[];
 let runs=0;
 const targetAt=b=>Array.isArray(targets)?targets[b]:targets?.[b];
 const addMove=(a,b)=>moves.push(opts.T==null?{a,b}:{a,b,T:opts.T});
 for(let from=3;from>=1;from--){
  const target=targetAt(from);
  if(target==null)continue;
  if(target>=4){runs++;addMove(from,4);continue}
  let to=Math.max(from,Math.min(3,Math.trunc(target)));
  while(to>from&&bases[to])to--;
  bases[to]=1;
  if(to>from)addMove(from,to);else stay.push(from);
 }
 if(batterTarget!=null){
  if(batterTarget>=4){runs++;addMove(0,4)}
  else{
   let to=Math.max(1,Math.min(3,Math.trunc(batterTarget)));
   while(to>1&&bases[to])to--;
   bases[to]=1;addMove(0,to);
  }
 }
 return{bases,runs,moves,stay};
}

// 純関数の結果をゲーム状態とアニメーションに反映する薄いラッパー。
function applyRunnerResult(result,duration){
 G.bases=result.bases;
 const now=performance.now();
 const dur=duration??Math.max(0,...result.moves.map(m=>m.T??(m.b-m.a)*580));
 G.mv=result.moves.length?{id:++pid,t0:now,dur,moves:result.moves,stay:result.stay}:null;
}
