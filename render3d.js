/* render3d.js — 描画専用の Three.js フィールド表示。ゲーム状態は読み取りのみ。 */
const FIELD3D_SCALE = 0.025;
const FIELD3D_CAMERAS = [
 {id:'catcher', label:'捕手後方'},
 {id:'wide', label:'バックネット'},
 {id:'overhead', label:'俯瞰'},
 {id:'auto', label:'自動'}
];

// 2Dフィールド座標を、ホーム原点・外野が-Zのワールド座標へ写す純関数。
function toWorld(x,y,h=0){return{x:(x-240)*FIELD3D_SCALE,y:h*FIELD3D_SCALE,z:(y-375)*FIELD3D_SCALE}}
function cameraModeNext(mode){const i=FIELD3D_CAMERAS.findIndex(q=>q.id===mode);return FIELD3D_CAMERAS[(i+1+FIELD3D_CAMERAS.length)%FIELD3D_CAMERAS.length].id}
function fieldPlayerFacing(from,to){return Math.atan2(to.x-from.x,to.z-from.z)}
function fieldBallState(game,now){
 if(game.th){const t=game.th,elapsed=now-t.t0;
  if(t.steps){let start=0,pos=null,air=false,carry=false;for(const q of t.steps){const a=start+(q.dly||0),b=a+q.dur;if(elapsed<a){pos={x:q.from.x,y:q.from.y};carry=!!q.carry;break}if(elapsed<b){const p=cl((elapsed-a)/q.dur,0,1);pos={x:q.from.x+(q.to.x-q.from.x)*p,y:q.from.y+(q.to.y-q.from.y)*p};air=!q.carry;carry=!!q.carry;if(air)pos.h=Math.sin(p*Math.PI)*14;break}start=b;pos={x:q.to.x,y:q.to.y};carry=!!q.carry}return pos?{...pos,h:pos.h||0,visible:true,carry}:null}
  const p=elapsed/t.dur;if(p<0||p>=1)return null;return{x:t.from.x+(t.to.x-t.from.x)*p,y:t.from.y+(t.to.y-t.from.y)*p,h:Math.sin(p*Math.PI)*14,visible:true,carry:false};
 }
 if(game.fl){const f=game.fl,p=cl((now-f.t0)/f.dur,0,1),back=f.wall?cl((now-f.t0-f.dur)/300,0,1)*16:0,dx=f.to.x-HP.x,dy=f.to.y-HP.y,len=Math.hypot(dx,dy)||1;return{x:HP.x+dx*p-dx/len*back,y:HP.y+dy*p-dy/len*back,h:f.kind==='ground'?Math.abs(Math.sin(p*Math.PI*5))*8*(1-p):f.h*4*p*(1-p),visible:true,carry:false}}
 if(game.phase==='pitch'&&game.pitch){const p=game.pitch,t=cl(p.t||0,0,1),[x,y]=bp(p,t);return{x:240+(x-110)*.45,y:292+78*t,h:60-y*.18,visible:true,carry:false}}
 return null;
}

let r3d=null,r3dEnabled=false,r3dRequested=false,r3dContextLost=false,r3dMode='catcher',r3dCamPos=null,r3dLook=null;
function render3dIsActive(){return !!(r3dEnabled&&r3d&&!r3dContextLost)}
function render3dInitScene(){
 if(typeof THREE==='undefined'||!$('f3d'))return false;
 const canvas=$('f3d');
 try{
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(480,400,false);
  renderer.setClearColor(0x0a1020,1);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a1020);scene.fog=new THREE.Fog(0x0a1020,18,34);
  const camera=new THREE.PerspectiveCamera(48,1.2,.1,80);
  scene.add(new THREE.HemisphereLight(0xd9e8ff,0x382d26,2.1));
  const sun=new THREE.DirectionalLight(0xffe5b3,2.1);sun.position.set(-7,13,5);scene.add(sun);
  const mat=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});
  const mats={grass:[mat(0x247a43),mat(0x2a894b)],dirt:mat(0xb77748),white:mat(0xf5f1df),line:mat(0xe8e4d8),wall:mat(0x245667),red:mat(0xff5a5f),blue:mat(0x4da3ff),skin:mat(0xe2b98d),pants:mat(0xe9e8e2),bat:mat(0xe1bd75)};
  const root=new THREE.Group();scene.add(root);
  function fieldPoly(points,material,y=.005){
   const verts=[];for(let i=1;i<points.length-1;i++){for(const j of [0,i,i+1]){const p=toWorld(points[j][0],points[j][1]);verts.push(p.x,y,p.z)}}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.material.side=THREE.DoubleSide;root.add(mesh);return mesh
  }
  function disk(x,y,rx,rz,material,height=0,segments=48){const pts=[];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;pts.push([x+Math.cos(a)*rx,y+Math.sin(a)*rz])}return fieldPoly([[x,y],...pts],material,height)}
  function box(x,y,z,sx,sy,sz,material,parent=root){const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
  function sphere(parent,x,y,z,r,material,segments=8){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,segments,6),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
  // 外野芝のローポリ扇形と刈り込み帯
  const wedge=[];for(let i=0;i<=36;i++){const a=-Math.PI/4+i/36*Math.PI/2;wedge.push([240+Math.sin(a)*(R+6),375-Math.cos(a)*(R+6)])}fieldPoly([[240,375],...wedge],mats.grass[0],-.03);
  for(let ring=0;ring<5;ring++){
   const r0=25+ring*39,r1=r0+20,strip=[];
   for(let i=0;i<=16;i++){const a=-Math.PI/4+i/16*Math.PI/2;strip.push([240+Math.sin(a)*r1,375-Math.cos(a)*r1])}
   for(let i=16;i>=0;i--){const a=-Math.PI/4+i/16*Math.PI/2;strip.push([240+Math.sin(a)*r0,375-Math.cos(a)*r0])}
   fieldPoly(strip,mats.grass[(ring+1)%2],.002+ring*.0001);
  }
  // 内野土、ベースライン、マウンド
  disk(240,300,108,108,mats.dirt,.008);
  fieldPoly([[240,354],[290,304],[240,256],[190,304]],mats.grass[1],.014);
  disk(240,292,13,13,mats.dirt,.025,20);
  const home=toWorld(240,375,.045);box(home.x,.045,home.z,.22,.055,.2,mats.white);
  for(let i=1;i<=3;i++){const p=toWorld(BS[i].x,BS[i].y,.045);const base=box(p.x,.045,p.z,.22,.055,.22,mats.white);base.rotation.y=Math.PI/4}
  // ファウルラインは細い直方体、フェンスは連続した曲面メッシュで作る。
  function segment(a,b,width,height,material,y){const p=toWorld(a[0],a[1]),q=toWorld(b[0],b[1]);const len=Math.hypot(q.x-p.x,q.z-p.z),m=box((p.x+q.x)/2,y,(p.z+q.z)/2,len,height,width,material);m.rotation.y=-Math.atan2(q.z-p.z,q.x-p.x);return m}
  for(const sign of [-1,1])segment([240,375],[240+sign*(R+6)*.7071,375-(R+6)*.7071],.025,.012,mats.line,.03);
  const fenceSegments=72,fenceVerts=[],fenceIndices=[],fenceTop=[];
  for(let i=0;i<=fenceSegments;i++){
   const a=-Math.PI/4+i/fenceSegments*Math.PI/2,radius=R+6,fx=240+Math.sin(a)*radius,fy=375-Math.cos(a)*radius,p=toWorld(fx,fy),nx=Math.sin(a),nz=-Math.cos(a);
   const innerX=p.x-nx*.035,innerZ=p.z-nz*.035,outerX=p.x+nx*.035,outerZ=p.z+nz*.035;
   fenceVerts.push(innerX,.02,innerZ,innerX,.42,innerZ,outerX,.02,outerZ,outerX,.42,outerZ);fenceTop.push(new THREE.Vector3(p.x,.43,p.z));
   if(i<fenceSegments){const n=i*4,j=n+4;
    fenceIndices.push(n,n+1,j+1,n,j+1,j, n+2,j+3,n+3,n+2,j+2,j+3,
     n+1,n+3,j+3,n+1,j+3,j+1, n+2,j+2,j,n+2,j,n);
   }
  }
  const fenceGeo=new THREE.BufferGeometry();fenceGeo.setAttribute('position',new THREE.Float32BufferAttribute(fenceVerts,3));fenceGeo.setIndex(fenceIndices);fenceGeo.computeVertexNormals();const fenceMesh=new THREE.Mesh(fenceGeo,mats.wall);fenceMesh.material.side=THREE.DoubleSide;root.add(fenceMesh);
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fenceTop),new THREE.LineBasicMaterial({color:0xffd23f})));
  // 簡易の投手・捕手・野手・打者。共通ジオメトリとマテリアルを使う。
  const bodyGeo=new THREE.CylinderGeometry(.105,.14,.48,7),limbGeo=new THREE.CylinderGeometry(.045,.06,.34,6),headGeo=new THREE.SphereGeometry(.105,8,6),gloveGeo=new THREE.SphereGeometry(.075,7,5);
  const ballRoot=new THREE.Group();root.add(ballRoot);
  const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),mat(0xfffdf5,.55));ballRoot.add(ballMesh);
  const seamMat=new THREE.MeshBasicMaterial({color:0xc83e42});
  for(const side of [-1,1]){const seam=new THREE.Mesh(new THREE.TorusGeometry(.052,.004,4,16,.78*Math.PI),seamMat);seam.position.x=side*.025;seam.rotation.y=side*.45;ballRoot.add(seam)}
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.11,12),new THREE.MeshBasicMaterial({color:0x050807,transparent:true,opacity:.32,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;root.add(shadow);
  const players=[];
  function player(team,x,y,kind){
   const group=new THREE.Group(),world=toWorld(x,y);group.position.set(world.x,0,world.z);group.scale.setScalar(.78);root.add(group);
   const jersey=team===0?mats.red:mats.blue,body=new THREE.Mesh(bodyGeo,jersey);body.position.y=.48;group.add(body);
   const head=new THREE.Mesh(headGeo,mats.skin);head.position.y=.83;group.add(head);
   const legs=[];for(const s of [-1,1]){const leg=new THREE.Mesh(limbGeo,mats.pants);leg.position.set(s*.085,.17,0);group.add(leg);legs.push(leg)}
   const arms=[];for(const s of [-1,1]){const pivot=new THREE.Group();pivot.position.set(s*.16,.68,0);group.add(pivot);const arm=new THREE.Mesh(limbGeo,jersey);arm.position.y=-.14;pivot.add(arm);arms.push(pivot)}
   const glove=new THREE.Mesh(gloveGeo,mats.white);glove.position.set(.24,.37,-.04);group.add(glove);
   let bat=null;if(kind==='batter'){const right=(G.batterSides?G.batterSides[G.top?0:1]:'right')==='right';bat=new THREE.Group();bat.position.set(right?-.01:.01,-.1,-.03);arms[right?0:1].add(bat);const stick=box(0,.31,0,.055,.62,.055,mats.bat,bat);stick.rotation.z=-.12}
   players.push({group,legs,arms,glove,bat,jersey,team,kind,index:players.length,runPhase:0,travel:0,lastX:world.x,lastZ:world.z,yaw:0,pose:0});return group;
  }
  const defense=G.top?1:0,batting=G.top?0:1;
  for(let i=0;i<FD.length;i++)player(defense,FD[i][0],FD[i][1],i===0?'pitcher':i===1?'catcher':'fielder');
  const batterSide=G.batterSides?G.batterSides[G.top?0:1]:'right';player(batting,batterSide==='right'?219:261,370,'batter');
  player(batting,HP.x,HP.y,'runner');
  r3d={renderer,scene,camera,root,players,materials:mats,ballRoot,ballMesh,shadow,autoPlay:false,autoPos:new THREE.Vector3(),autoLook:new THREE.Vector3(),views:{
   catcher:{pos:new THREE.Vector3(0,3.4,5.4),look:new THREE.Vector3(0,.3,-3.2)},
   wide:{pos:new THREE.Vector3(0,5.6,10.4),look:new THREE.Vector3(0,.4,-3.4)},
   overhead:{pos:new THREE.Vector3(0,15,2),look:new THREE.Vector3(0,0,-3.4)},
   auto:{pos:new THREE.Vector3(0,3.4,5.4),look:new THREE.Vector3(0,.3,-3.2)}
  }};
  const onLost=e=>{e.preventDefault();r3dContextLost=true;r3dEnabled=false;const fw=$('f')?.parentElement;if(fw)fw.classList.remove('is-3d');const toggle=$('view-toggle'),cam=$('camera-cycle');if(toggle){toggle.disabled=true;toggle.textContent='2D表示'}if(cam)cam.disabled=true};
  const onRestored=()=>{r3dContextLost=false;try{r3d?.renderer.dispose()}catch(e){}r3d=null;if(render3dInitScene()){const toggle=$('view-toggle'),cam=$('camera-cycle');if(toggle)toggle.disabled=false;if(cam)cam.disabled=false;render3dSetEnabled(r3dRequested)}};
  canvas.addEventListener('webglcontextlost',onLost,false);canvas.addEventListener('webglcontextrestored',onRestored,false);
  return true;
 }catch(error){console.warn('3Dフィールドを初期化できません。2D表示に切り替えます。',error);return false}
}
function render3dSetEnabled(enabled){
 r3dRequested=!!enabled;r3dEnabled=r3dRequested&&!!r3d&&!r3dContextLost;
 const fw=$('f')?.parentElement,button=$('view-toggle');if(fw)fw.classList.toggle('is-3d',r3dEnabled);
 if(button){button.textContent=r3dEnabled?'3D表示':'2D表示';button.setAttribute('aria-pressed',String(r3dEnabled))}
}
function render3dSetMode(mode,persist=true){
 if(!FIELD3D_CAMERAS.some(q=>q.id===mode))mode='catcher';r3dMode=mode;
 try{if(persist)localStorage.setItem('yakyu-stadium-camera',mode)}catch(e){}
 const button=$('camera-cycle');if(button){button.textContent=FIELD3D_CAMERAS.find(q=>q.id===mode).label;button.setAttribute('aria-label','カメラ: '+FIELD3D_CAMERAS.find(q=>q.id===mode).label+'。Cキーで切替')}
}
function initRender3d(){
 const toggle=$('view-toggle'),cameraButton=$('camera-cycle');if(!toggle||!cameraButton)return;
 try{const saved=localStorage.getItem('yakyu-stadium-camera');if(FIELD3D_CAMERAS.some(q=>q.id===saved))r3dMode=saved}catch(e){}
 render3dSetMode(r3dMode,false);
 const ok=render3dInitScene();toggle.disabled=!ok;cameraButton.disabled=!ok;
 if(!ok){toggle.textContent='2D表示';toggle.title='WebGLを利用できないため2D表示です';return}
 render3dSetEnabled(CONFIG.render3d!==false);
 toggle.addEventListener('click',()=>render3dSetEnabled(!r3dEnabled));
 cameraButton.addEventListener('click',()=>render3dSetMode(cameraModeNext(r3dMode)));
 addEventListener('keydown',e=>{if(e.repeat||e.key.toLowerCase()!=='c')return;const target=e.target;if(target instanceof Element&&target.closest('input,textarea,select,button,[contenteditable="true"],[role="dialog"]'))return;if($('ov').style.display!=='none'||$('patch-ov')?.classList.contains('open'))return;render3dSetMode(cameraModeNext(r3dMode))});
}
function render3dUpdate(now){
 if(!render3dIsActive())return;
 const {renderer,scene,camera,players,views}=r3d,home=toWorld(240,375);
 let view=views[r3dMode]||views.catcher;
 const ball=fieldBallState(G,now),playing=!!(G.fl||G.th);
 if(r3dMode==='auto'){
  r3d.autoPlay=playing;
  if(playing&&ball){const p=toWorld(ball.x,ball.y,ball.h);r3d.autoPos.set(p.x,Math.max(2.4,p.y+3.4),p.z+5.4);r3d.autoLook.set(p.x,p.y+.4,p.z);view={pos:r3d.autoPos,look:r3d.autoLook}}
 }
 if(!r3dCamPos){r3dCamPos=view.pos.clone();r3dLook=view.look.clone()}
 r3dCamPos.lerp(view.pos,.075);r3dLook.lerp(view.look,.075);camera.position.copy(r3dCamPos);camera.lookAt(r3dLook);
 const bt=G.top?0:1,defense=1-bt;
 for(let i=0;i<FD.length;i++){
  const [x,y]=fpos(i,now),p=toWorld(x,y),player=players[i],dx=p.x-player.lastX,dz=p.z-player.lastZ,distance=Math.hypot(dx,dz);player.travel+=distance;player.runPhase+=distance*18;player.lastX=p.x;player.lastZ=p.z;players[i].group.position.x=p.x;players[i].group.position.z=p.z;
  const jersey=defense===0?r3d.materials.red:r3d.materials.blue;if(players[i].jersey!==jersey){players[i].jersey=jersey;players[i].group.children[0].material=jersey;players[i].arms.forEach(a=>a.children[0].material=jersey)}
  const moving=distance>.0007,desiredYaw=moving?Math.atan2(dx,dz):fieldPlayerFacing({x:p.x,z:p.z},{x:home.x,z:home.z});
  let yawDelta=((desiredYaw-player.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;player.yaw+=cl(yawDelta,-.09,.09);players[i].group.rotation.y=player.yaw;
  const dive=!!(G.fl?.diving&&G.fl.fi===i),throwing=!!(G.th&&G.th.t0&&now-G.th.t0<500),run=moving?1:0;player.pose+=(run-player.pose)*.18;
  const stride=Math.sin(player.runPhase);player.legs[0].rotation.x=stride*.72*player.pose;player.legs[1].rotation.x=-stride*.72*player.pose;
  player.arms[0].rotation.x=-stride*.48*player.pose+(throwing?.9:0);player.arms[1].rotation.x=stride*.48*player.pose-(dive?.7:0);
  const pulse=Math.sin(now*.005+i)*.012*(1-player.pose);players[i].group.position.y=pulse-(dive?.16:0);
 }
 const batter=players[9],side=G.batterSides?G.batterSides[G.top?0:1]:'right',bx=side==='right'?219:261,bp=toWorld(bx,370);batter.group.position.set(bp.x,Math.sin(now*.004)*.012,bp.z);batter.group.rotation.y=side==='right'?.2:-.2;
 const batterMat=bt===0?r3d.materials.red:r3d.materials.blue;if(batter.jersey!==batterMat){batter.jersey=batterMat;batter.group.children[0].material=batterMat;batter.arms.forEach(a=>a.children[0].material=batterMat)}
 const swing=cl((now-G.swingT)/230,0,1),swinging=G.swingT>0&&now-G.swingT<370,mirror=side==='right'?1:-1;batter.group.visible=!(G.mv&&G.mv.moves.some(m=>m.a===0));batter.arms[0].rotation.z=-.42*mirror+(swinging?mirror*Math.sin(swing*Math.PI)*.85:0);batter.arms[1].rotation.z=.32*mirror+(swinging?mirror*Math.sin(swing*Math.PI)*.7:0);batter.arms[0].rotation.x=-.18;batter.arms[1].rotation.x=.12;if(batter.bat)batter.bat.rotation.z=-.18*mirror+(swinging?mirror*Math.sin(swing*Math.PI)*1.15:0);
 const runner=players[10],runnerMove=G.mv?.moves?.find(m=>m.a===0),elapsed=G.mv?now-G.mv.t0:0;runner.group.visible=!!runnerMove&&(!runnerMove.o||elapsed<runnerMove.o);if(runnerMove){const q=rpos(0,runnerMove.b,cl(elapsed/(runnerMove.T||550*runnerMove.b),0,1)),rp=toWorld(q[0],q[1]);runner.group.position.set(rp.x,0,rp.z);runner.runPhase+=Math.hypot(rp.x-runner.lastX,rp.z-runner.lastZ)*18;const stride=Math.sin(runner.runPhase);runner.legs[0].rotation.x=stride*.72;runner.legs[1].rotation.x=-stride*.72;runner.lastX=rp.x;runner.lastZ=rp.z}
 r3d.ballRoot.visible=!!ball?.visible;
 if(ball){const p=toWorld(ball.x,ball.y,ball.carry?15:ball.h);r3d.ballRoot.position.set(p.x,p.y,p.z);r3d.shadow.position.set(p.x,.012,p.z);const radius=1+cl(ball.h/120,0,.35);r3d.shadow.scale.set(radius,radius,1);r3d.shadow.material.opacity=.32/(1+Math.max(0,ball.h)*.025)}
 renderer.render(scene,camera);
}
