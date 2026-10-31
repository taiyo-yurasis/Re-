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
  const camera=new THREE.PerspectiveCamera(52,1.2,.1,80);
  scene.add(new THREE.HemisphereLight(0xd9e8ff,0x382d26,2.1));
  const sun=new THREE.DirectionalLight(0xffe5b3,2.1);sun.position.set(-7,13,5);scene.add(sun);
  const mat=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});
  const mats={grass:[mat(0x247a43),mat(0x2a894b)],dirt:mat(0xb77748),white:mat(0xf5f1df),line:mat(0xe8e4d8),wall:mat(0x245667),seat:[mat(0x263552),mat(0x314366)],red:mat(0xff5a5f),blue:mat(0x4da3ff),skin:mat(0xe2b98d),pants:mat(0xe9e8e2),bat:mat(0xe1bd75)};
  const root=new THREE.Group();scene.add(root);
  function fieldPoly(points,material,y=.005){
   const verts=[];for(let i=1;i<points.length-1;i++){for(const j of [0,i,i+1]){const p=toWorld(points[j][0],points[j][1]);verts.push(p.x,y,p.z)}}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.material.side=THREE.DoubleSide;root.add(mesh);return mesh
  }
  function disk(x,y,rx,rz,material,height=0,segments=48){const pts=[];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;pts.push([x+Math.cos(a)*rx,y+Math.sin(a)*rz])}return fieldPoly([[x,y],...pts],material,height)}
  function box(x,y,z,sx,sy,sz,material,parent=root){const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
  function sphere(parent,x,y,z,r,material,segments=8){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,segments,6),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
  // 背景と観客席
  box(0,-.3,-5,.5,.55,.5,mat(0x172238));
  for(let row=0;row<3;row++){
   const radius=7.4+row*.52;
   for(let i=0;i<35;i++){
    const a=(-.78+i/34*1.56),x=Math.sin(a)*radius,z=-Math.cos(a)*radius;
    const seat=new THREE.Mesh(new THREE.BoxGeometry(.36,.42,.32),mats.seat[(i+row)%2]);seat.position.set(x,.22+row*.43,z);seat.rotation.y=a;root.add(seat);
   }
  }
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
  // ファウルラインとフェンス。細い直方体を座標間に置く。
  function segment(a,b,width,height,material,y){const p=toWorld(a[0],a[1]),q=toWorld(b[0],b[1]);const len=Math.hypot(q.x-p.x,q.z-p.z),m=box((p.x+q.x)/2,y,(p.z+q.z)/2,len,height,width,material);m.rotation.y=-Math.atan2(q.z-p.z,q.x-p.x);return m}
  for(const sign of [-1,1])segment([240,375],[240+sign*(R+6)*.7071,375-(R+6)*.7071],.025,.012,mats.line,.03);
  const fence=[];for(let i=0;i<=36;i++){const a=-Math.PI/4+i/36*Math.PI/2;fence.push([240+Math.sin(a)*(R+6),375-Math.cos(a)*(R+6)])}
  for(let i=0;i<fence.length-1;i++)segment(fence[i],fence[i+1],.055,.38,mats.wall,.2);
  // 簡易の投手・捕手・野手・打者。共通ジオメトリとマテリアルを使う。
  const bodyGeo=new THREE.CylinderGeometry(.105,.14,.48,7),limbGeo=new THREE.CylinderGeometry(.045,.06,.34,6),headGeo=new THREE.SphereGeometry(.105,8,6),gloveGeo=new THREE.SphereGeometry(.075,7,5);
  const players=[];
  function player(team,x,y,kind){
   const group=new THREE.Group(),world=toWorld(x,y);group.position.set(world.x,0,world.z);group.scale.setScalar(.78);root.add(group);
   const jersey=team===0?mats.red:mats.blue,body=new THREE.Mesh(bodyGeo,jersey);body.position.y=.48;group.add(body);
   const head=new THREE.Mesh(headGeo,mats.skin);head.position.y=.83;group.add(head);
   const legs=[];for(const s of [-1,1]){const leg=new THREE.Mesh(limbGeo,mats.pants);leg.position.set(s*.085,.17,0);group.add(leg);legs.push(leg)}
   const arms=[];for(const s of [-1,1]){const arm=new THREE.Mesh(limbGeo,jersey);arm.position.set(s*.19,.52,0);arm.rotation.z=s*.42;group.add(arm);arms.push(arm)}
   const glove=new THREE.Mesh(gloveGeo,mats.white);glove.position.set(.24,.37,-.04);group.add(glove);
   if(kind==='batter'){const bat=box(.31,.52,.04,.055,.62,.055,mats.bat,group);bat.rotation.z=-.34}
   players.push({group,legs,arms,glove,jersey,team,kind,index:players.length});return group;
  }
  const defense=G.top?1:0,batting=G.top?0:1;
  for(let i=0;i<FD.length;i++)player(defense,FD[i][0],FD[i][1],i===0?'pitcher':i===1?'catcher':'fielder');
  const batterSide=G.batterSides?G.batterSides[G.top?0:1]:'right';player(batting,batterSide==='right'?219:261,370,'batter');
  r3d={renderer,scene,camera,root,players,materials:mats,views:{
   catcher:{pos:new THREE.Vector3(0,3.0,6.5),look:new THREE.Vector3(0,.5,-3.2)},
   wide:{pos:new THREE.Vector3(0,5.6,10.4),look:new THREE.Vector3(0,.4,-3.4)},
   overhead:{pos:new THREE.Vector3(0,15,2),look:new THREE.Vector3(0,0,-3.4)},
   auto:{pos:new THREE.Vector3(0,3.0,6.5),look:new THREE.Vector3(0,.5,-3.2)}
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
 const view=views[r3dMode]||views.catcher;
 if(!r3dCamPos){r3dCamPos=view.pos.clone();r3dLook=view.look.clone()}
 r3dCamPos.lerp(view.pos,.075);r3dLook.lerp(view.look,.075);camera.position.copy(r3dCamPos);camera.lookAt(r3dLook);
 const bt=G.top?0:1,defense=1-bt;
 for(let i=0;i<FD.length;i++){
  const [x,y]=fpos(i,now),p=toWorld(x,y);players[i].group.position.x=p.x;players[i].group.position.z=p.z;
  const jersey=defense===0?r3d.materials.red:r3d.materials.blue;if(players[i].jersey!==jersey){players[i].jersey=jersey;players[i].group.children[0].material=jersey;players[i].group.children[4].material=jersey;players[i].group.children[5].material=jersey}
  players[i].group.rotation.y=fieldPlayerFacing({x:p.x,z:p.z},{x:home.x,z:home.z});
  const pulse=Math.sin(now*.005+i)*.018;players[i].group.position.y=pulse;
 }
 const batter=players[9],side=G.batterSides?G.batterSides[G.top?0:1]:'right',bx=side==='right'?219:261,bp=toWorld(bx,370);batter.group.position.set(bp.x,Math.sin(now*.004)*.012,bp.z);batter.group.rotation.y=side==='right'?.2:-.2;
 const batterMat=bt===0?r3d.materials.red:r3d.materials.blue;if(batter.jersey!==batterMat){batter.jersey=batterMat;batter.group.children[0].material=batterMat;batter.group.children[4].material=batterMat;batter.group.children[5].material=batterMat}
 renderer.render(scene,camera);
}
