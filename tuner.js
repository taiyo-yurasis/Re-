#!/usr/bin/env node
/* Reproducible Monte Carlo harness that calls the game's actual batResult(). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const count = Math.max(1000, Number(process.env.SIM_PITCHES) || 30000);
const seed0 = Number(process.env.SIM_SEED) || 20261023;
const types = ['s', 'sl', 'c', 'f', 'sh', 'cu'];

function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function normal(rng, sd){
  const u = Math.max(1e-12, rng()), v = rng();
  return sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function makeContext(seed){
  let rng = mulberry32(seed);
  const context = {
    console,
    document: { getElementById: () => ({ getContext: () => ({}) }) },
    __random: () => rng()
  };
  vm.createContext(context);
  for(const file of ['config.js', 'core.js', 'pitching.js', 'batting.js']){
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename:file });
  }
  vm.runInContext('Math.random=()=>__random(); G.batterSides=["right","right"]; G.top=true;', context);
  return {context, setSeed(next){rng=mulberry32(next);}};
}
function emptyStats(){
  return {total:0,miss:0,foul:0,hr:0,hit:0,inPlay:0,air:0,airHR:0,flyOut:0,ground:0,groundHit:0,results:{}};
}
function simulate(mode, seed){
  const {context,setSeed}=makeContext(seed);
  context.CONFIG.batMode=mode;
  const stats=emptyStats(), byType={};
  for(const type of types){
    byType[type]=emptyStats();
  }
  // Inputs are generated independently of the result RNG, keeping the same pitches in both modes.
  const inputRng=mulberry32(seed ^ 0x5f3759df);
  const pitches=Array.from({length:count},(_,i)=>{
    const type=types[i%types.length];
    return {
      type, x:44+inputRng()*132, y:44+inputRng()*132,
      ms:normal(inputRng,60), ex:normal(inputRng,9), ey:normal(inputRng,9)
    };
  });
  setSeed(seed ^ 0x13579bdf);
  for(const input of pitches){
    const p={type:input.type,x:input.x,y:input.y,sg:1,dur:context.TY[input.type].d};
    const cx=Math.max(0,Math.min(220,input.x+input.ex));
    const cy=Math.max(0,Math.min(220,input.y+input.ey));
    const r=context.batResult(p,input.ms,cx,cy);
    const s=stats,t=byType[input.type];
    for(const target of [s,t]){
      target.total++;
      target.results[r.k]=(target.results[r.k]||0)+1;
      if(r.k==='miss')target.miss++;
      else if(r.k==='foul')target.foul++;
      else{
        target.inPlay++;
        if(r.k==='HR')target.hr++;
        if(['1B','2B','3B','HR'].includes(r.k))target.hit++;
        if(Number.isFinite(r.launch)&&r.launch>=context.CONFIG.phys.groundAng){
          target.air++;
          if(r.k==='HR')target.airHR++;
          if(r.k==='fly')target.flyOut++;
        }else if(Number.isFinite(r.launch)&&r.launch<context.CONFIG.phys.groundAng){
          target.ground++;
          if(r.k==='1B')target.groundHit++;
        }
      }
    }
  }
  return {stats,byType};
}
function pct(n,d){return d?(100*n/d).toFixed(2)+'%':'n/a';}
function avg(n,d){return d?(n/d).toFixed(3):'n/a';}
function printStats(label,s){
  console.log('\n'+label);
  console.log('全投球HR率: '+pct(s.hr,s.total));
  console.log('HR/FB (launch >= groundAng): '+pct(s.airHR,s.air)+'  ('+s.airHR+'/'+s.air+')');
  console.log('インプレー打率: '+avg(s.hit,s.inPlay)+'  ('+s.hit+'/'+s.inPlay+')');
  console.log('フライアウト率/フライ: '+pct(s.flyOut,s.air));
  console.log('ゴロ安打率: '+pct(s.groundHit,s.ground)+'  ('+s.groundHit+'/'+s.ground+')');
  console.log('空振り率: '+pct(s.miss,s.total)+'  ('+s.miss+'/'+s.total+')');
  console.log('ファウル率: '+pct(s.foul,s.total));
}
const physics=simulate('physics',seed0);
const table=simulate('table',seed0);
console.log('野球盤 STADIUM 実コード Monte Carlo');
console.log('各モード '+count.toLocaleString()+' 球、ゾーン一様、タイミング誤差SD=60ms、カーソル誤差SD=9px/軸、球種均等。seed='+seed0);
printStats('物理モデル',physics.stats);
printStats('従来 hitTable 方式',table.stats);
console.log('\n物理モデル：球種別');
for(const type of types){
  const s=physics.byType[type];
  console.log(type+': HR '+pct(s.hr,s.total)+', HR/FB '+pct(s.airHR,s.air)+', AVG '+avg(s.hit,s.inPlay)+', miss '+pct(s.miss,s.total));
}
