/* render3d.js — 描画専用の Three.js フィールド表示。ゲーム状態は読み取りのみ。 */
const FIELD3D_SCALE = 0.036;
const FIELD3D_CAMERAS = [
 {id:'catcher', label:'捕手後方'},
 {id:'chase', label:'打球追跡'}
];
/* ---- 本塁周辺の実物比率 (選手身長 H を単位とする) ----
   選手モデルの身長 H (world) = 頭頂ローカル .935 × group scale .45 ≒ .42。
   本塁幅 .239H (実物43.18cm、辺の比率 17:8.5:12 を辺長優先)、
   バッターボックス 長さ1.011H×幅.674H・本塁平行辺から.084H離隔・長手中心は本塁の肩ラインに一致、
   キャッチャーボックス 幅.604H×長さ1.348H・後端は頂点の1.348H後方、ライン幅 約.05H (実物7.6〜10.2cm)。
   出典: MLB Official Baseball Rules 2.01/2.02・巻頭図 / 公認野球規則 2.02 (調査レポート 2026-11-02)。 */
const PLAYER_H3D = .42;
const PLATE_U3D = PLAYER_H3D*.239/17;              // 本塁の単位辺 (17インチ相当) ≒ .0059
const BOX_CX3D = PLATE_U3D*8.5+.084*PLAYER_H3D+.674*PLAYER_H3D/2; // バッターボックス中心の |x| ≒ .227
const BOX_CZ3D = -PLATE_U3D*8.5;                    // バッターボックス中心の z (本塁の肩ライン) ≒ -.050

// 2Dフィールド座標を、ホーム原点・外野が-Zのワールド座標へ写す純関数。
// 試作方針 (広め・実寸寄り): フィールドは画面に収めるために圧縮しない。
// FIELD3D_SCALE は選手モデルに対して広めに取り (本塁〜センター約12.7、
// 本塁〜投手板約3.0)、選手も小さめに置くことで内野の間隔と奥行きを稼ぐ。
// 全体が1画面に収まらない分は、捕手後方のタイトな画角・打球追跡など
// カメラのフレーミング側で処理する (判定の2D座標は不変)。
function toWorld(x,y,h=0){return{x:(x-240)*FIELD3D_SCALE,y:h*FIELD3D_SCALE,z:(y-375)*FIELD3D_SCALE}}
/* ボールの影を置く地面の高さ (world y)。影は従来 y=.012 固定だったため、
   それより高い層 (マウンドの土 .025 / 内野芝ダイヤモンド .014) の上では
   地面の下に埋まって消え、内野土 (.008) の上に出る本塁寄りで初めて
   見えていた (Taiyo 指摘 2026-11-03: 影が途中からしか出ていない)。
   そこで影はボール真下の最上層の表面に沿わせる: 2D フィールド座標で
   どの層の上にいるかを求め、その上面を返す (呼び出し側で僅かに浮かせる)。
   層の高さは render3dInitScene の fieldPoly/disk/box の値と一致させる。 */
function fieldGroundY3D(x,y){
 let g=.004; // 芝リング (.0024 以下)・外野扇形 (-.03)・全面グラウンド (-.045) の上
 if(Math.hypot(x-240,y-300)<=108)g=Math.max(g,.008); // 内野土の円
 if(Math.abs(x-240)+Math.abs(y-304)<=50)g=Math.max(g,.014); // 内野芝ダイヤモンド
 if(Math.hypot(x-240,y-292)<=13)g=Math.max(g,.025); // マウンド
 for(let i=1;i<=3;i++){const b=BS[i];if(b&&Math.abs(x-b.x)<=3.1&&Math.abs(y-b.y)<=3.1)g=Math.max(g,.0725)} // 塁ベース上面
 if(Math.abs(x-240)<=1.5&&y>=372&&y<=375.5)g=Math.max(g,.048); // 本塁板
 return g;
}
function cameraModeNext(mode){const i=FIELD3D_CAMERAS.findIndex(q=>q.id===mode);return FIELD3D_CAMERAS[(i+1+FIELD3D_CAMERAS.length)%FIELD3D_CAMERAS.length].id}
function fieldPlayerFacing(from,to){return Math.atan2(to.x-from.x,to.z-from.z)}
// 投球の捕球点 (2D座標+高さ)。投球軌道の終点 (fieldBallState) と捕手ミットの照準 (render3dUpdate) で
// 共用し、「ボールが届く場所」と「ミットが構える場所」を常に一致させる。
/* 到達点の原点・スケールは実物比率に合わせる (表示専用。2D の bp / 判定には触らない)。
   旧方式 (.065 一律 + 中心 h=11) は 2D ゾーンの正方形をそのまま写していたため、実物比率で
   作った本塁・バッターボックスに対して到達点が外へ行きすぎていた (実測: セル中心の到達
   world X ±.193/±.064・Y .589/.460/.332/.203。ゾーン端 Δ67.5px で横 .158 world に対し、
   本塁の半幅は .050 world しかなく、端の球がバッターボックス内側 (内縁 .086 world) の
   奥まで入り込んで打者に当たって見えた。高さも中心 .396 world = 0.94H と頭近くで、
   上端は 1.32H まで上がっていた)。
   新方式: 横は本塁幅 (43.18cm = .100 world) をゾーン幅 135px に対応させ
   (.000743 world/px → 係数 .0206)、縦は実測ゾーン (下端 約48cm〜上端 約101cm、
   中心 約74cm = .172 world、高さ .122 world) を同じ 135px に対応させる
   (.000907 world/px → h 係数 .0252、中心 h=4.79)。到達範囲は X ±.082 world /
   Y .070〜.277 world に収まり、端の球でもボックス内縁の外側で止まる。
   捕手の腕のリーチ (肩 .234 + 腕 .162 = .396 world) の内側なので、後段のミット
   追従が体を持ち上げなくてもミットが届く範囲でもある。 */
function pitchCatchPoint(p){const[ex,ey]=bp(p,1);return{x:240+(ex-110)*.0206,y:382,h:cl(4.79+(110-ey)*.0252,1.2,8.4)}}
/* 投球のリリース点 (3D表示専用・fieldBallState の始点)。
   旧始点 {x:240,y:299,h:25} は world (0, .900, -2.736) で、投手モデルの頭頂
   (.935×scale.45 ≒ .421 world) より .479 world (約1.14H) も上にあり、ボールが
   投手の頭のはるか上から出現して見えた。
   新始点は投球モーション開始フレーム (rel=0、throwArm=-2.3) の投げ手 (arms[0])
   先端の実測位置に合わせる: 肩ピボット world (-.072, .306, -2.988) から
   腕先端ローカル (0,-.31,0) を rotation.x=-2.3 で回すと手先は
   world (-.072, .399, -2.884) になる (頭頂まで -.022、肩まで +.093)。
   これを fieldBallState の座標系 (2Dフィールドpx + h) へ換算した値が下記で、
   world 換算で手先と一致する (x: 240-.072/.036=238、y: 375-2.884/.036≒294.9、
   h: .399/.036≒11.08)。 */
function pitchReleasePoint(){return{x:238,y:294.89,h:11.08}}
/* ===== 統合テスト環境: 実験機能② 捕手視点ゾーン板 (A案) =====
   捕手視点での打撃を試すための表示専用レイヤー。設計 (Taiyo と合意した A案):
   - 本塁の位置にストライクゾーンの板を 3D 空間内に立て、その表面 (CanvasTexture) に
     2D パネル版の軌道を映す。板上の球は従来のゾーンパネル (drawZone) と同じ
     bp(p,t)・同じ p.t で描き、到達位置もタイミングもパネルと完全一致する。
     判定の読みはこの板上のパネル版軌道で行う (従来の2層構造を捕手視点の1画面に収める形)。
   - 板上のボールの描画は従来パネルとまったく同じにする (到達半径 19 の黄リング +
     baseball() の円盤、縫い目と spinState の回転つき、半径の育ち方 3→19 も同一)。
     回転 (スピン) が読めることが打撃の読みの要 (Taiyo 指示 2026-11-03)。一時期
     「板では中心リングだけ」にしていたが、それでは回転が分からず打てないため廃止。
   - 3D のボールは、板 ON の間だけ「目 (FP_EYE3D) → 板のボールの現在位置」を
     通る視線レイの上に組み立てる (fieldBallState の fpRay 分岐)。中心の画面
     投影はレイの定義により板のボールと全時点で一致する。奥行きだけが
     リリース点の深さ (z=-2.884) から板平面 (z=-.16) へ t^1.25 で進み、
     到達 (t=1) で板平面上の板のボールそのものに重なって止まるため、板・
     地面・カメラへのめり込みは起きない。ボールの見かけの大きさも毎フレーム
     板のボールに合わせる (fpScale: 板のボールの角半径 × そのフレームの
     レイ上の距離)。板のボールは従来パネルと同じ円盤 (縫い目・回転つき) を
     維持し、3D の球と中心・大きさが重なるので画面上は1つの球に見える。
     板 OFF 時は従来軌道 (リリース点→捕球点 + bp 偏差・等倍) のまま不変。
   - 板の配置 (Taiyo 改善案 + 始点一致の詰め 2026-11-03): 「板のボールの
     始点 (bp の始点) の投影 = 投手の手 (リリース点) の投影」のときにだけ
     レイ方式と「手から投げているように見えること」が両立するため、板の
     位置と大きさをその条件で解いた: サイズ .44→.40、中心 y .20→.1685、
     中心 x は投手の左右別 (右 +.0125 / 左 -.0310、zboardPosFor)。始点と
     手の画面距離は右 30.2px / 左 35.9px → どちらも 0.3px 未満 (幾何計算値、
     実フレームでも drawZoneBoard のトレース startAlign で測る)。サイズを
     小さくした分だけゾーン下端の球 (到達 y=176) でも円盤下端が y=.014 と
     地面 (土の上面 .008) の上に残る。板平面は従来どおり z=-.16。
   - 打撃操作は現行のドラッグ&リリース (G.cur) をそのまま使う。ミートカーソルは
     G.cur を板の上にも描くので、板を見ながら合わせられる。
   - 到達後・空振り後の表示 (2026-11-03 改訂): 2D 側 (板の円盤・従来パネル) の
     消去は pitchBallGone (plays.js) が位相に依存せず一元管理する: 到達後は
     到達点に留まって全位相で +280ms で消去、空振り時はスイング時点で凍結し
     +350ms で消去。見逃しでも球が板を越えて迫ったり、円盤だけが目の前に
     残り続けたりはしない。一方 3D 球は、板 ON の間だけ着弾した瞬間と空振りの
     瞬間に即座に消す (fieldBallState の fpRay 分岐冒頭)。到達点に留まる 3D 球が
     板の円盤からはみ出して見えるためで、凍結もしない。板 OFF 時の 3D 球は
     従来どおり pitchBallGone の規則 (到達 +280ms / 空振り凍結 +350ms) に従う。
     板のテクスチャ範囲はイーファスの頂点から最下点 (到達 y=220) の
     円盤下端まで拡張済みで、下部の帯は地面に遮られず描くよう描画距離も
     下限まで伸ばしてある (ZBOARD_RANGE3D 側のコメント参照) ので、
     3D 球だけが単独で見える区間も、一番下で板の球が切れることもない。
   - 打球後 (2026-11-03): 打球が発生したら (G.fl の間) 一人称と板は一時停止し、
     カメラは既存の打球追跡でボールを見る。G.fl が消える次の投球の準備
     (ready) で一人称＋板表示へ自動で戻る (render3dUpdate の fpSuspend)。
   - カメラ (Taiyo 訂正 2026-11-02): 「捕手視点」を名乗るならカメラが捕手の後方に
     あること自体がおかしい。トグル ON の間はカメラを捕手の目の位置 (一人称) へ
     自動で切り替える (render3dUpdate の fpActive 上書き)。r3dMode (捕手後方/
     打球追跡の選択状態) 自体は書き換えないので、OFF に戻せば元のカメラへ戻る。
   - 判定・タイミング計算・2D モードには一切触らない。トグル OFF では板は出ず従来表示。 */
const ZBOARD_EXP={enabled:false};
/* 一人称カメラの目位置とゾーン板の配置は、カメラ (render3dUpdate)・板メッシュ
   (render3dInitScene)・投球の停止位置 (fieldBallState) の3者が必ず同じ値を
   参照するよう、ここで一元化する。どれか1つでもズレると画面上の位置関係が崩れる。 */
const FP_EYE3D={x:0,y:.28,z:.25};
const ZBOARD_SIZE3D=.40;
/* 板の中心位置は投手の左右で変える: bp の始点 x は sg で ±12px 振れるのに
   3D の手の位置 (pitchReleasePoint) は固定なので、静止した板では左右どちらか
   しか始点が手に合わない。右投げ用を既定 (ZBOARD_POS3D) とし、左投げでは
   x を -.0310 に寄せる (y/z は共通)。投手の左右は半イニング内では固定なので
   板が投球ごとに動くことはない。 */
const ZBOARD_POS3D={x:.0125,y:.1685,z:-.16};
/* 板テクスチャの対応範囲 (2026-11-03 拡張): 超スローボール (イーファス) の bp は
   頂点でパネル座標 y≈-92 まで上がる。旧板は 220×220 の範囲しか描けず、その区間は
   板の球がテクスチャ外で消え、視線レイ上の 3D 球だけが空に浮いて見えた。
   そこで板メッシュとテクスチャの対応範囲を 360×360 論理 px (パネル座標
   x∈[-70,290] / y∈[-130,230]) へ広げ、全球種の軌道 (イーファスの頂点・到達時の
   円盤半径・黄リングを含む) が常に板の上に描かれ続けるようにする。パネル座標→
   ワールドの換算係数 (ZBOARD_SIZE3D/220) は不変なので、枠・球・カーソルの
   ワールド位置は従来と完全一致する。メッシュは範囲の中心 (パネル座標 (110,50))
   の分だけグループ原点から +Y にずらして置く。
   下限の追加拡張 (2026-11-03、イーファス時と同じ方式): 狙える最下点は到達
   y=220 (狙いのクランプ 0〜220 が上限) で、到達時の円盤半径は最大 20.6
   (3+16×1.1)、黄リング 19、カーソルの十字は中心から 22 下まで伸びるため、
   描画の下端は y≈242 に達する。旧下限 230 では円盤の下部がテクスチャ外で
   切れ、一番下に投げると球が消えたように見えた。そこで対応範囲を
   400×400 論理 px (x∈[-90,310] / y∈[-130,270]) へ広げ、下端に約 28px の
   余裕を持たせた。上限 (-130) と換算係数は不変で、メッシュは範囲の中心
   (パネル座標 (110,70)) の分だけグループ原点から +Y にずらして置く
   (各帯の位置は render3dInitScene の zbBand が範囲から計算する)。視線レイ
   構築 (boardBallWorld3D) は元々クランプを持たず線形写像のみ。
   描画距離の追加拡張 (2026-11-03、Taiyo 訂正): それでも一番下の球は
   フィールド上で消えた。原因はテクスチャでもメッシュの届く範囲でも
   なく、本塁前の地面が一人称カメラと板の間の視線を遮ること: 板面で
   ワールド y<.008 (内野土の上面) になる部分 (パネル y≈198 より下) は
   土の後ろに隠れ、到達 y=220 の円盤 (ワールド y -.069〜+.006) は全体が
   地面に隠れてしまった。従来パネルのキャンバスを広げるのは筋違いで、
   直すのはフィールド上の板の「描画距離」: 板メッシュをパネル
   y=ZBOARD_SPLIT_Y3D で上下の帯に分割し、下の帯だけ深度テストを切って
   板面として描き切る (render3dInitScene の zbBand)。これで対応範囲の
   下限 270 まで実際に描画が届く。分割より上は従来どおり深度テスト
   ありで、3D 球・選手との重なり方は不変。 */
const ZBOARD_RANGE3D=400,ZBOARD_OFFX3D=90,ZBOARD_OFFY3D=130;
const ZBOARD_PLANE3D=ZBOARD_SIZE3D*ZBOARD_RANGE3D/220;
const ZBOARD_SPLIT_Y3D=170;
function zboardPosFor(sg){return sg<0?{x:-.031,y:.1685,z:-.16}:ZBOARD_POS3D}
/* 現在の板位置: 投球中はその投球の sg、狙い中は守備側投手の左右に合わせる。 */
function zboardCurrentPos(){
 let sg=1;
 if(typeof G!=='undefined'&&G){
  if(G.pitch&&G.pitch.sg)sg=G.pitch.sg;
  else if(G.pitcherHands){const dt=G.top?1:0;sg=G.pitcherHands[dt]||1}
 }
 return zboardPosFor(sg);
}
/* 板のボール (パネル座標 bp(p,t)) のワールド座標。板は無回転 (正対) なので
   中心 + テクスチャ座標の線形写像で決まる。レイ組み立てと計測で共用する。 */
function boardBallWorld3D(p,t,pos){
 const b=bp(p,cl(t,0,1)),pp=pos||zboardCurrentPos();
 return{x:pp.x+(b[0]-110)/220*ZBOARD_SIZE3D,y:pp.y+(110-b[1])/220*ZBOARD_SIZE3D,z:pp.z};
}
function fieldBallState(game,now){
 if(game.th){const t=game.th,elapsed=now-t.t0;
  if(t.steps){let start=0,pos=null,air=false,carry=false;for(const q of t.steps){const a=start+(q.dly||0),b=a+q.dur;if(elapsed<a){pos={x:q.from.x,y:q.from.y};carry=!!q.carry;break}if(elapsed<b){const p=cl((elapsed-a)/q.dur,0,1);pos={x:q.from.x+(q.to.x-q.from.x)*p,y:q.from.y+(q.to.y-q.from.y)*p};air=!q.carry;carry=!!q.carry;if(air)pos.h=Math.sin(p*Math.PI)*14;break}start=b;pos={x:q.to.x,y:q.to.y};carry=!!q.carry}return pos?{...pos,h:pos.h||0,visible:true,carry}:null}
  const p=elapsed/t.dur;if(p<0||p>=1)return null;return{x:t.from.x+(t.to.x-t.from.x)*p,y:t.from.y+(t.to.y-t.from.y)*p,h:Math.sin(p*Math.PI)*14,visible:true,carry:false};
 }
 if(game.fl){const f=game.fl,p=cl((now-f.t0)/f.dur,0,1),back=f.wall?cl((now-f.t0-f.dur)/300,0,1)*16:0,dx=f.to.x-HP.x,dy=f.to.y-HP.y,len=Math.hypot(dx,dy)||1;return{x:HP.x+dx*p-dx/len*back,y:HP.y+dy*p-dy/len*back,h:f.kind==='ground'?Math.abs(Math.sin(p*Math.PI*5))*8*(1-p):flightHeightPx(f,p),visible:true,carry:false}}
 if(game.pitch&&(game.phase==='pitch'||game.phase==='busy')){
  const p=game.pitch,tRaw=(Number.isFinite(p.t0)&&Number.isFinite(p.dur)&&p.dur>0)?(now-p.t0)/p.dur:cl(p.t||0,0,1);
  // 消去は位相に依存させない (pitchBallGone): 空振り凍結中は hideAt まで
  // 凍結位置に留まり、それを過ぎたら消える。到達後はどの位相でも
  // 到達 +280ms で消え、到達点からカメラ側へ進むことはない。
  // pitchBallGone は plays.js の定義が正本。通常の読み込み順 (plays.js → render3d.js)
  // では常に存在するが、render3d.js 単体で読み込む検証環境向けに、同じ規則の
  // フォールバック (空振り凍結は hideAt まで / 到達後は +280ms) を内蔵する。
  const pitchGone=(typeof pitchBallGone==='function')?pitchBallGone(p,now)
   :(p.frozenT!=null?now>=p.hideAt:(Number.isFinite(p.t0)&&Number.isFinite(p.dur)&&now>p.t0+p.dur+280));
  if(pitchGone)return null;
  const tRaw2=p.frozenT!=null?p.frozenT:cl(tRaw,0,1);
  /* 板 ON (一人称) のときだけ: 3D ボールを「目→板のボールの現在位置」の
     視線レイ上に組み立てる (基準は板/パネル側の bp)。中心の投影はレイの
     定義で板のボールと全時点で一致する。奥行き (z) だけがリリース点の
     深さから板平面へ t^1.25 で進み、t=1 でレイ係数 1 = 板のボールそのもの
     の位置に止まる。始点は板の配置調整 (zboardPosFor) で目のレイが投手の
     手を通るよう揃えてあるため、t=0 ではボールは手の位置・手の深さに
     あり、「投手がリリースポイントから投げている」見え方と中心一致が
     両立する。大きさは fpScale で板のボールの見かけに毎フレーム合わせ、
     画面上は板の円盤と重なって1つの球に見える (板の円盤自体は従来パネル
     と同じ描画を維持する)。返り値は従来どおりフィールド座標に逆換算し、
     fpRay/fpScale/fpWorld を添える (描画側がスケールと検証に使う)。
     板 OFF 時・判定・到達点・従来パネルには一切触らない。 */
  if(typeof ZBOARD_EXP!=='undefined'&&ZBOARD_EXP.enabled){
   // 3D 球の即時消去 (Taiyo 指示 2026-11-03): 板 ON の間は、着弾した瞬間
   // (tRaw が 1 に達した瞬間) と空振りの瞬間 (result('miss') が frozenT を
   // 立てた瞬間) に 3D 球を消す。到達点に留まる 3D 球は板の円盤からわずかに
   // はみ出して見えるため、3D 側だけを即時に消し、残りは 2D 側の従来規則
   // (板の円盤・従来パネル: 到達点で止まって +280ms で消去 / 空振りは凍結
   // して +350ms で消去、pitchBallGone が管理) に任せる。凍結もしないので
   // 空振り後に 3D 球がその場に残ることもない。板 OFF 時の 3D 軌道・到達後の
   // 留まり方は従来どおり不変。コンタクト時は G.fl が優先される (この分岐に
   // 入る前に打球側が返る) ので、打球への切り替えにも影響しない。
   if(p.frozenT!=null||tRaw>=1)return null;
   const t=tRaw2,pos=zboardPosFor(p.sg||1),bw=boardBallWorld3D(p,t,pos),eye=FP_EYE3D,relF=pitchReleasePoint(),relW=toWorld(relF.x,relF.y,relF.h);
   // 奥行きは t<1 の飛行中だけここで組み立てる (到達・空振り凍結の状態は
   // 上の即時消去で既に return null 済み)。t が 1 に近づくにつれ板平面へ
   // 収束するので、板を越えてカメラ側へ進むことは構造的にない。
   const zT=(p.frozenT!=null?p.frozenT>=1:tRaw>=1)?pos.z:relW.z+(pos.z-relW.z)*Math.pow(t,1.25),lam=(zT-eye.z)/(bw.z-eye.z);
   const wx=eye.x+(bw.x-eye.x)*lam,wy=eye.y+(bw.y-eye.y)*lam;
   const dBoard=Math.hypot(bw.x-eye.x,bw.y-eye.y,bw.z-eye.z),dBall=Math.hypot(wx-eye.x,wy-eye.y,zT-eye.z);
   const boardR=(3+16*Math.min(t,1.1))*ZBOARD_SIZE3D/220;
   const fpScale=Math.max(.05,(boardR*dBall/Math.max(1e-6,dBoard))/.06);
   return{x:wx/FIELD3D_SCALE+240,y:zT/FIELD3D_SCALE+375,h:wy/FIELD3D_SCALE,visible:true,carry:false,fpRay:true,fpScale:fpScale,fpWorld:{x:+wx.toFixed(4),y:+wy.toFixed(4),z:+zT.toFixed(4)}};
  }
  // 板 OFF: 投球はゾーン画面の座標を流用せず、投手のリリース位置から捕手のミットへ直に飛ばす。
  // 到達点だけ bp(p,1) のゾーン目標で左右・高低をずらし、ミットの位置と球の行き先を一致させる。
  // busy(判定直後)でも到達までは飛球を続け、到達後しばらくはミットに収まったままにする(打球・送球がある場合はそちらが優先)。
  const t=tRaw2;
  const start=pitchReleasePoint(),end=pitchCatchPoint(p);
  // 変化球の曲がり: リリース→捕球点の直線補間に、2D の bp が描く
  // 「bp 始点→終点の直線からの偏差」を重ねる。bp は球種別の変化プロファイル
  // (スライダーの食い込み+終盤の曲がり、カーブ/フォークの遅れて落ちる形、
  // ツーシーム・カットの breakAt の効き始め、超スローの山なり) を全て含む。
  // 軌道の統一 (Taiyo 指示 2026-11-02): 基準はゾーン (板/パネル) 側。3D だけに
  // 乗っていた曲がり増幅 (×2: 横 .0412 / 高さ .0504) は廃止し、偏差の換算は
  // 捕球点マッピングとまったく同じ係数 (横: ゾーンpx×.0206、高さ: ゾーンpx
  // ×.0252。bp の y は下向きなので高さでは符号を反転する) に揃えた。これで
  // 3D の球の直線からの偏差を捕球点マッピングでゾーン座標へ戻すと、板上の
  // 球の偏差と全時点で一致する (係数が等倍なので差は 0。drawZoneBoard の
  // トレース trajDevDiff で実測できる)。偏差は t=0 と t=1 で 0 になるため、
  // 始点 (リリース点) と到達点 (pitchCatchPoint = ミットの位置)、飛行時間、
  // 判定・2D 側の数値は従来と完全一致する。ストレートは bp 自体が直線なので
  // 偏差 0 のまま。
  const[bx,by]=bp(p,t),[sx,sy]=bp(p,0),[ex,ey]=bp(p,1);
  const devX=bx-(sx+(ex-sx)*t),devY=by-(sy+(ey-sy)*t);
  return{x:start.x+(end.x-start.x)*t+devX*.0206,y:start.y+(end.y-start.y)*t,h:start.h+(end.h-start.h)*t-devY*.0252,visible:true,carry:false};
 }
 return null;
}
// ファインプレー/捕球モーションの種類を打球状況から決める純関数 (3D表示専用・判定には使わない)。
// 野手の定位置から着地点までの移動ベクトルを、本塁向き(野手の正面)を基準に
// 前進成分 fwd と横成分 lat へ分解し、距離と打球の高さ (fl.h) で振り分ける:
//  横に遠い→dive / 前へ突っ込む→slide / フェンス際の高い打球 (ファインプレーのみ)→jump / 近い→reach (倒れず腕を伸ばす)
function fieldCatchPlayType(fl){
 if(!fl||fl.fi==null||!FD[fl.fi]||!fl.to)return 'reach';
 const s=FD[fl.fi],tx=fl.to.x-s[0],ty=fl.to.y-s[1],dist=Math.hypot(tx,ty);
 const fx=HP.x-s[0],fy=HP.y-s[1],fl2=Math.hypot(fx,fy)||1,ux=fx/fl2,uy=fy/fl2;
 const fwd=tx*ux+ty*uy,lat=Math.abs(tx*uy-ty*ux);
 const dHome=Math.hypot(fl.to.x-HP.x,fl.to.y-HP.y);
 if(fl.kind==='ground'){
  if(dist<42)return 'reach';
  // 横成分が少しでも目立つゴロはダイブ (グラブを横へ投げ出す/バックハンド) に寄せる。
  // 足から滑る slide は「前に突っ込む」打球専用で、横への slide は実野球の動きと合わない。
  // 旧閾値 (下限34 / 前進比.85) では斜めのゴロの9割が slide に落ちていた (実測)。
  if(lat>=Math.max(30,Math.abs(fwd)*.6))return 'dive';
  if(fwd>=18)return 'slide';
  return dist>=80?'dive':'slide';
 }
 // ジャンプはファインプレー専用。さらに「フェンス際」かつ「捕球高さが立ちリーチを
 // 明らかに超える」ときだけに限定する。通常捕球では条件を満たしても jump にせず、
 // この後の dive / slide / reach 判定に回す (レンダラー側の格下げ・ボールの消去
 // タイミング・DBG の catchType 表示もすべてこの関数の結果に揃う)。
 // フェンス際 = 着地点とフェンス (本塁から FENCE_PX=341 の円弧) の距離が 18px 以内。
 // (wall の打球は FENCE_PX-4=337 に着くので当然含まれるが、明示しておく)
 // 捕球高さ = 捕球時点 (飛行の94%) のボール高さ (px、物理プロファイル flightHeightPx)。
 // 立ちリーチはジャンプ量の基準 0.55 world = 22px で、その 1.25 倍 (27.5px) 以上を
 // 「明らかに超える」とする。
 // さらに野手がフェンス方向へ走っている (外向き移動が支配的) ことも求める。
 const fenceGap=FENCE_PX-dHome,catchH=flightHeightPx(fl,.94);
 const rx=(fl.to.x-HP.x)/(dHome||1),ry=(fl.to.y-HP.y)/(dHome||1),outward=tx*rx+ty*ry;
 if(fl.finePlay&&(fenceGap<=18||fl.wall)&&catchH>=27.5&&outward>=Math.max(12,dist*.5))return 'jump';
 if(dist<46)return 'reach';
 if(lat>=Math.max(36,Math.abs(fwd)*.9))return 'dive';
 if(fwd>=30)return 'slide';
 // 背走 (オーバーザショルダー) のダイブは -42 から。旧 -52 では dist>=46 の背走打球の
 // 約1/4が「50px近く後ろのボールを立ったまま reach」になっていた (実測15/64件)。
 if(fwd<=-42)return 'dive';
 return 'reach';
}
// 2D版 drawField の走者描画と同じ規則で、表示すべき走者の2D座標を返す純関数。
// mv 進行中は stay(残留塁)と moves(進塁、アウトで消える m.o 付き)を、それ以外は塁上の走者を返す。
function fieldRunnerStates(game,now){
 const out=[];
 const mv=game.mv&&now-game.mv.t0<game.mv.dur?game.mv:null;
 if(mv){
  for(const b of mv.stay||[])out.push({x:BS[b].x,y:BS[b].y,run:false});
  for(const m of mv.moves||[]){const el=now-mv.t0;if(m.o&&el>=m.o)continue;const q=rpos(m.a,m.b,cl(el/(m.T||CONFIG.speed.runnerMsPerBase*(m.b-m.a)),0,1));out.push({x:q[0],y:q[1],run:true})}
 }else if(game.bases){for(let b=1;b<4;b++)if(game.bases[b])out.push({x:BS[b].x,y:BS[b].y,run:false})}
 return out;
}
// 3D表示の可否。このアーティファクトでは CONFIG.render3d=true で公開済み。
// (テスト環境フラグ ?3d=1 / localStorage yakyu-stadium-3d=test も引き続き有効)
function render3dTestAccess(){try{return new URLSearchParams(location.search).get('3d')==='1'||localStorage.getItem('yakyu-stadium-3d')==='test'}catch(e){return false}}
function render3dAllowed(){return (typeof CONFIG!=='undefined'&&CONFIG.render3d===true)||render3dTestAccess()}

let r3d=null,r3dEnabled=false,r3dRequested=false,r3dContextLost=false,r3dMode='catcher',r3dCamPos=null,r3dLook=null;
// ?debug=1 専用の計測スナップショット: 捕球野手の group.position.y を「aimK 適用前の
// 基礎Y」と「適用後の最終Y」に分けて render3dUpdate が毎フレーム書き込む (debug 無効時は
// 記録コード自体が不発で null のまま。通常プレイの描画・性能・保存データに影響しない)。
function render3dIsActive(){return !!(r3dEnabled&&r3d&&!r3dContextLost)}
/* ゾーン板の表面を描く。従来のゾーンパネル (drawZone) と同じ bp(p,t)・
   同じカーソル (G.cur) を、板の CanvasTexture (220 論理座標) に描く。
   装飾 (背景・グリッド・外周枠) は板では省き、黄色いゾーン枠と中身だけにする。
   パネル側の描画コードには手を入れず、ここで同じ規則をなぞることで
   「板上の球 = パネルの球」を保つ (到達位置・タイミングは bp と p.t の共有で一致)。 */
function drawZoneBoard(){
 const zb=r3d&&r3d.zoneBoard;if(!zb)return;
 const c=zb.g,u=44;
 // 装飾は置かない: 背景フィル・グリッド線・外周の白枠は描かず、透明のままにする。
 // 残すのは黄色いゾーン枠と、中身 (球・ミートカーソル・狙いプレビュー) だけ。
 // 描画はテクスチャの拡張範囲 (ZBOARD_RANGE3D) 全体を消してから、パネル座標へ
 // 平行移動して従来どおりの座標で描く (イーファスの頂点など範囲外の球も描ける)。
 c.clearRect(0,0,ZBOARD_RANGE3D,ZBOARD_RANGE3D);
 c.save();c.translate(ZBOARD_OFFX3D,ZBOARD_OFFY3D);
 c.strokeStyle='#ffd23f';c.lineWidth=3;c.strokeRect(u,u,3*u,3*u);
 const p=G.pitch;let boardBall=null,tUsed=null;
 // 板の円盤は 2D 側の規則 (pitchBallGone) で消す: 空振り凍結中は hideAt
 // まで凍結位置に残り、到達後は位相によらず到達 +280ms で消える。
 // 3D 球の方は板 ON の間だけ着弾・空振りの瞬間に即時消去される
 // (fieldBallState 側) ので、円盤だけが残る時間帯があるのが正しい姿。
 const pastCatch=pitchBallGone(p,performance.now());
 if(p&&(G.phase==='pitch'||G.phase==='busy')&&!pastCatch){
  tUsed=cl(p.t,0,1.2);boardBall=bp(p,tUsed);
  const[x,y]=boardBall;
  // 板上のボールは従来パネル (drawZone) とまったく同じ描画: 到達半径 19 の
  // 黄リング + baseball() の円盤 (縫い目と spinState の回転つき、半径は
  // 3+16*min(t,1.1) でパネルと同じ育ち方)。回転が読めることが打撃の読みの要
  // (Taiyo 指示 2026-11-03)。一時期「板では中心リングだけ」にしていたが、
  // それではスピンが分からず打てないため廃止し、円盤を戻した。板テクスチャは
  // 3D ボールより手前に重なるが、3D ボールは軌道 (リリース→板平面) を飛び、
  // 板の球はパネル版の読みを担う共存表示なので、重なりはそのまま見せる。
  c.strokeStyle='rgba(255,210,63,.6)';c.lineWidth=2;c.beginPath();c.arc(x,y,19,0,7);c.stroke();
  baseball(c,x,y,3+16*Math.min(tUsed,1.1),spinState(p,tUsed));
 }
 const aimM=G.phase==='aim'&&canPit();
 let q=G.cur;const rr=aimM?TY[G.sel].j:CONFIG.cursorSize;
 if(aimM){
  const preview=pitchTarget(),[ex,ey]=bp(preview,1);q={x:ex,y:ey};
  c.save();c.beginPath();for(let i=0;i<=24;i++){const[x,y]=bp(preview,i/24);if(i===0)c.moveTo(x,y);else c.lineTo(x,y)}c.setLineDash([4,4]);c.strokeStyle='rgba(94,240,255,.75)';c.lineWidth=2;c.stroke();c.setLineDash([]);
  c.beginPath();c.arc(ex,ey,4,0,7);c.fillStyle='rgba(94,240,255,.85)';c.fill();c.restore();
 }
 // ミートカーソル (打撃) / 狙いカーソル (投球) はパネルと同じ条件・同じ形で板にも出す
 const showCur=G.net!=='spec'&&(aimM||(canBat()&&G.phase!=='idle'&&G.phase!=='over'&&G.phase!=='sent'));
 if(showCur){
  c.strokeStyle='#5ef0ff';c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,rr,0,7);c.stroke();
  c.beginPath();c.moveTo(q.x-rr-6,q.y);c.lineTo(q.x+rr+6,q.y);c.moveTo(q.x,q.y-rr-6);c.lineTo(q.x,q.y+rr+6);c.stroke();
 }
 c.restore();
 zb.tex.needsUpdate=true;
}
// 実験機能②のトグル (フィールド左上 #exp-ctl)。OFF の間は板は出ず、従来表示のまま。
// ON にした瞬間から、render3dUpdate がカメラを捕手の目線 (一人称) へ自動で切り替える。
// カメラの選択状態 (r3dMode) はここでは触らないので、OFF に戻すと元のカメラ
// (捕手後方/打球追跡) へそのまま戻る。
(function(){
 if(typeof $!=='function')return; // ブラウザ外 (単体テストの vm 等) では DOM が無いので何もしない
 const btn=$('exp-zboard');if(!btn)return;
 const paint=()=>{btn.textContent=ZBOARD_EXP.enabled?'捕手視点ゾーン ON':'捕手視点ゾーン OFF';btn.classList.toggle('on',ZBOARD_EXP.enabled);btn.setAttribute('aria-pressed',String(ZBOARD_EXP.enabled))};
 btn.addEventListener('click',()=>{ZBOARD_EXP.enabled=!ZBOARD_EXP.enabled;paint()});
 paint();
})();
function render3dInitScene(){
 if(typeof THREE==='undefined'||!$('f3d'))return false;
 const canvas=$('f3d');
 try{
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.setSize(480,400,false);
  // デーゲーム: 空・霧・ライティング・素材色は前作3D試作(slug: 3d)の球場デザインに寄せる。
  renderer.setClearColor(0x87aecb,1);
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x87aecb);scene.fog=new THREE.Fog(0x87aecb,26,68);
  const camera=new THREE.PerspectiveCamera(54,1.2,.1,160);
  scene.add(new THREE.HemisphereLight(0xd6e9ff,0x4c5b3a,1.9));
  const sun=new THREE.DirectionalLight(0xfff2d6,2.2);sun.position.set(8,14,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-17;sun.shadow.camera.right=17;sun.shadow.camera.top=17;sun.shadow.camera.bottom=-17;sun.shadow.camera.near=1;sun.shadow.camera.far=46;sun.shadow.bias=-0.0004;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xbcd6ff,.5);fill.position.set(-5,4,-8);scene.add(fill);
  const mat=(color,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});
  const mats={grass:[mat(0x38b25a),mat(0x2e9a4c)],dirt:mat(0xc88b52),white:mat(0xf5f1df),line:mat(0xe8e4d8),wall:mat(0x14532d),red:mat(0xff5a5f),blue:mat(0x4da3ff),skin:mat(0xe2b98d),pants:mat(0xe9e8e2),glove:mat(0x7c3f16),bat:mat(0xe1bd75),umpShirt:mat(0x16181d),umpPants:mat(0x3b4048),umpMask:mat(0x23272e),umpBag:mat(0x26262c)};
  const root=new THREE.Group();scene.add(root);
  // 外側グラウンド(PlaneGeometry 36x36, 中心 (0,-3), repeat 6) と同じ UV を返す。
  // PlaneGeometry は u=(x+18)/36, v=(localY+18)/36 で、回転後は localY=-z-3 なので v=(15-z)/36。
  // 内側の芝もこの UV で同じテクスチャを貼れば、縞の位置・幅が外側と連続する。
  function grassUV(p){return[(p.x+18)/36,(15-p.z)/36]}
  function fieldPoly(points,material,y=.005){
   const verts=[],uvs=[];for(let i=1;i<points.length-1;i++){for(const j of [0,i,i+1]){const p=toWorld(points[j][0],points[j][1]);verts.push(p.x,y,p.z);const uv=grassUV(p);uvs.push(uv[0],uv[1])}}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;root.add(mesh);return mesh
  }
  function disk(x,y,rx,rz,material,height=0,segments=48){const pts=[];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;pts.push([x+Math.cos(a)*rx,y+Math.sin(a)*rz])}pts.push(pts[0]);return fieldPoly([[x,y],...pts],material,height)} // 最初の外周点を末尾にも足して扇を閉じる。これが無いと東(+X)方向に三角形1枚分の楔形の欠けができ、一塁側で土の円が三角に欠けて見える
  function box(x,y,z,sx,sy,sz,material,parent=root){const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
  function sphere(parent,x,y,z,r,material,segments=8){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,segments,6),material);mesh.position.set(x,y,z);parent.add(mesh);return mesh}
  // フェンスは全方向で判定と同じ唯一の物差し FENCE_PX (110m) に統一する (流線型は廃止)。
  // 野手の到達範囲も FENCE_PX-3 まで広がったので、柵際の捕球でも干渉しない。
  function fenceRadius(a){return FENCE_PX}
  // 地面全面: 試作と同じ芝の縞テクスチャを敷き、ファウルゾーンやフェンス外にも地面を持たせる(空色の背景が地面に見えないように)。
  const gc=document.createElement('canvas');gc.width=gc.height=512;const gg=gc.getContext('2d');for(let i=0;i<16;i++){gg.fillStyle=i%2?'#2e9a4c':'#38b25a';gg.fillRect(i*32,0,32,512)}
  const gtex=new THREE.CanvasTexture(gc);gtex.wrapS=gtex.wrapT=THREE.RepeatWrapping;gtex.repeat.set(6,6);if('colorSpace' in gtex)gtex.colorSpace=THREE.SRGBColorSpace;
  // 芝は内外で単一マテリアルに統一する: 外側グラウンドも内側(扇形・リング・ダイヤモンド)も
  // 同じ縞テクスチャ・同じ色使いを使う。平色マテリアルだった mats.grass はここで差し替える。
  const grassMat=new THREE.MeshStandardMaterial({map:gtex,roughness:1});grassMat.side=THREE.DoubleSide;
  mats.grass=[grassMat,grassMat];
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(36,36),grassMat);ground.rotation.x=-Math.PI/2;ground.position.set(0,-.045,-3);ground.receiveShadow=true;root.add(ground);
  // 外野芝のローポリ扇形と刈り込み帯
  const wedge=[];for(let i=0;i<=36;i++){const a=-Math.PI/4+i/36*Math.PI/2;wedge.push([240+Math.sin(a)*fenceRadius(a),375-Math.cos(a)*fenceRadius(a)])}fieldPoly([[240,375],...wedge],mats.grass[0],-.03);
  for(let ring=0;ring<5;ring++){
   // 刈り込み帯は扇形ファン(fieldPoly)で作らない。ファンは起点(三塁側)の反対端(一塁側)で
   // 弦が帯を切り落とし、外周付近に三角形の無い楔形の隙間ができるため、
   // 角度区間ごとの四角形(2三角形)で帯をそのまま分割する。
   const r0=25+ring*39,r1=r0+20,y=.002+ring*.0001,verts=[],uvs=[],segs=36;
   for(let i=0;i<segs;i++){
    const a0=-Math.PI/4+i/segs*Math.PI/2,a1=-Math.PI/4+(i+1)/segs*Math.PI/2;
    const o0=toWorld(240+Math.sin(a0)*r1,375-Math.cos(a0)*r1),o1=toWorld(240+Math.sin(a1)*r1,375-Math.cos(a1)*r1),n0=toWorld(240+Math.sin(a0)*r0,375-Math.cos(a0)*r0),n1=toWorld(240+Math.sin(a1)*r0,375-Math.cos(a1)*r0);
    verts.push(o0.x,y,o0.z, n0.x,y,n0.z, o1.x,y,o1.z, o1.x,y,o1.z, n0.x,y,n0.z, n1.x,y,n1.z);
    for(const p of [o0,n0,o1,o1,n0,n1]){const uv=grassUV(p);uvs.push(uv[0],uv[1])}
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,grassMat);mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;root.add(mesh);
  }
  // 内野土、ベースライン、マウンド
  disk(240,300,108,108,mats.dirt,.008);
  fieldPoly([[240,354],[290,304],[240,256],[190,304]],mats.grass[1],.014);
  disk(240,292,13,13,mats.dirt,.025,20);
  // 本塁は五角形の板: 選手身長 H 基準の実物比率 (幅 .239H、辺 17:8.5:12 を辺長優先で組み、
  // 奥行きは 8.5+12/√2 単位)。頂点=HP (捕手側)、前面が投手側。黒いベベル縁を下に敷き、白い板を重ねる。
  // fieldPoly は2D座標経由なので、world寸法を FIELD3D_SCALE で割り戻して渡す。
  const plate2d=s=>{const hw=PLATE_U3D*8.5*s/FIELD3D_SCALE,sh=PLATE_U3D*8.5*s/FIELD3D_SCALE,dp=PLATE_U3D*(8.5+12/Math.SQRT2)*s/FIELD3D_SCALE;
   return [[240,375],[240-hw,375-sh],[240-hw,375-dp],[240+hw,375-dp],[240+hw,375-sh],[240,375]]};
  fieldPoly(plate2d(1.25),mat(0x22242a),.038);
  fieldPoly(plate2d(1),mats.white,.048);
  for(let i=1;i<=3;i++){const p=toWorld(BS[i].x,BS[i].y,.045);const base=box(p.x,.045,p.z,.22,.055,.22,mats.white);base.rotation.y=Math.PI/4}
  // ファウルラインは細い直方体、フェンスは連続した曲面メッシュで作る。
  function segment(a,b,width,height,material,y){const p=toWorld(a[0],a[1]),q=toWorld(b[0],b[1]);const len=Math.hypot(q.x-p.x,q.z-p.z),m=box((p.x+q.x)/2,y,(p.z+q.z)/2,len,height,width,material);m.rotation.y=-Math.atan2(q.z-p.z,q.x-p.x);return m}
  // ファウルライン: 実物の実務どおり、バッターボックスの区間はチョークを引かず途切れさせ、
  // ボックスの前面 (z≒-.26) を過ぎた所から再開する。幅は約.05H。
  for(const sign of [-1,1])segment([240+sign*8,367],[240+sign*fenceRadius(Math.PI/4)*.7071,375-fenceRadius(Math.PI/4)*.7071],.05*PLAYER_H3D,.012,mats.line,.03);
  // バッターボックス (3D): H基準の実物比率 (長さ1.011H×幅.674H、本塁平行辺から.084H離隔、
  // 長手中心は本塁の肩ライン)。実物の実務どおり内側ラインは引かない (外側・前・後の3辺だけ)。
  for(const bs of [-1,1]){
   const bcx=bs*BOX_CX3D,bcz=BOX_CZ3D,bw=.674*PLAYER_H3D,bl=1.011*PLAYER_H3D,lw=.05*PLAYER_H3D;
   box(bcx+bs*bw/2,.032,bcz,lw,.014,bl,mats.line);
   box(bcx,.032,bcz-bl/2,bw,.014,lw,mats.line);box(bcx,.032,bcz+bl/2,bw,.014,lw,mats.line);
  }
  // キャッチャーボックス (3D): 幅.604H×長さ1.348H、後端は本塁頂点の1.348H後方。
  // 前面は実務でも閉じないことが多いので、側線と後端線だけを引く。
  {const cw=.604*PLAYER_H3D,cl2=1.348*PLAYER_H3D,lw=.05*PLAYER_H3D;
   box(-cw/2,.032,cl2/2,lw,.014,cl2,mats.line);box(cw/2,.032,cl2/2,lw,.014,cl2,mats.line);
   box(0,.032,cl2,cw,.014,lw,mats.line);}
  // ゾーン板 (実験機能②・A案): 本塁の位置に立てる板。表面の CanvasTexture に
  // 2D パネル版の軌道 (bp) をそのまま映す (描画は drawZoneBoard)。板は表示専用で、
  // 3D の飛球・判定には触らない。装飾 (背景フィル・グリッド・外周枠) は描かず、
  // 黄色いゾーン枠と球・カーソルだけを透明な板面に浮かせる。
  // 寸法・姿勢は一人称カメラ (捕手の目: 本塁の約 .41 後方・高さ約 .28) 前提で決める:
  // .40 大・配置は zboardPosFor (中心 y .1685 / z -.16、x は投手の左右別:
  // 板上の軌道始点の投影がリリース点の投影と一致する位置。経緯は ZBOARD_POS3D
  // 側のコメント参照)。姿勢は傾けず、捕手の視線に対して
  // 垂直・正対 (rotation は全軸 0) にする。斜めだと枠が歪んでコースが読みにくいため。
  // 両面表示にしてカメラが板面に対してどちらの側に来ても消えないようにする
  // (正面=捕手側から見たときの向きが正像)。
  const zbCanvas=document.createElement('canvas');zbCanvas.width=zbCanvas.height=512;
  const zbCtx=zbCanvas.getContext('2d');zbCtx.scale(512/ZBOARD_RANGE3D,512/ZBOARD_RANGE3D);
  const zbTex=new THREE.CanvasTexture(zbCanvas);if('colorSpace' in zbTex)zbTex.colorSpace=THREE.SRGBColorSpace;
  const zbGroup=new THREE.Group();zbGroup.position.set(ZBOARD_POS3D.x,ZBOARD_POS3D.y,ZBOARD_POS3D.z);zbGroup.rotation.set(0,0,0);root.add(zbGroup);
  // メッシュはテクスチャ拡張範囲 (ZBOARD_RANGE3D) の実寸で作り、範囲の中心が
  // グループ原点 (パネル座標 (110,110) の位置) からずれる分を +Y に寄せる。
  // 透明部分は見えないので、見た目の枠の大きさ・位置は従来と変わらない。
  // 描画距離 (2026-11-03): 板面のパネル y≈198 より下は本塁前の地面 (土の
  // 上面 .008) が視線を遮り、深度テストがあると到達 y=220 の円盤が丸ごと
  // 隠れてしまう。そこでメッシュをパネル y=ZBOARD_SPLIT_Y3D で上下の帯に
  // 分け、下の帯だけ深度テストを切って板面として下限 (270) まで描き切る
  // (上の帯・枠・球の位置関係は従来どおり)。帯ごとの UV は共有テクスチャ
  // の該当区間へ張り替える。
  const zbScale3D=ZBOARD_SIZE3D/220;
  function zbBand(yTop,yBot,depthTest,renderOrder){
   const geo=new THREE.PlaneGeometry(ZBOARD_PLANE3D,(yBot-yTop)*zbScale3D);
   const uv=geo.attributes.uv,vTop=1-(yTop+ZBOARD_OFFY3D)/ZBOARD_RANGE3D,vBot=1-(yBot+ZBOARD_OFFY3D)/ZBOARD_RANGE3D;
   for(let i=0;i<uv.count;i++)uv.setY(i,vBot+(vTop-vBot)*uv.getY(i));
   const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({map:zbTex,transparent:true,depthWrite:false,depthTest:depthTest,side:THREE.DoubleSide}));
   m.position.y=(110-(yTop+yBot)/2)*zbScale3D;m.renderOrder=renderOrder;zbGroup.add(m);return m;
  }
  const zbMesh=zbBand(-ZBOARD_OFFY3D,ZBOARD_SPLIT_Y3D,true,5);
  const zbMeshLow=zbBand(ZBOARD_SPLIT_Y3D,ZBOARD_RANGE3D-ZBOARD_OFFY3D,false,6);
  zbGroup.visible=false;
  const zoneBoard={group:zbGroup,mesh:zbMesh,meshLow:zbMeshLow,canvas:zbCanvas,g:zbCtx,tex:zbTex,size:ZBOARD_SIZE3D,planeSize:ZBOARD_PLANE3D};
  const fenceSegments=72,fenceVerts=[],fenceIndices=[],fenceTop=[];
  for(let i=0;i<=fenceSegments;i++){
   const a=-Math.PI/4+i/fenceSegments*Math.PI/2,radius=fenceRadius(a),fx=240+Math.sin(a)*radius,fy=375-Math.cos(a)*radius,p=toWorld(fx,fy),nx=Math.sin(a),nz=-Math.cos(a);
   const innerX=p.x-nx*.035,innerZ=p.z-nz*.035,outerX=p.x+nx*.035,outerZ=p.z+nz*.035;
   // フェンスの高さは判定の fenceHeightM=4m を表示の物差しで換算: 4m×HEIGHT_PX_PER_M×FIELD3D_SCALE ≒ 1.0 world
   fenceVerts.push(innerX,.02,innerZ,innerX,1.0,innerZ,outerX,.02,outerZ,outerX,1.0,outerZ);fenceTop.push(new THREE.Vector3(p.x,1.01,p.z));
   if(i<fenceSegments){const n=i*4,j=n+4;
    fenceIndices.push(n,n+1,j+1,n,j+1,j, n+2,j+3,n+3,n+2,j+2,j+3,
     n+1,n+3,j+3,n+1,j+3,j+1, n+2,j+2,j,n+2,j,n);
   }
  }
  const fenceGeo=new THREE.BufferGeometry();fenceGeo.setAttribute('position',new THREE.Float32BufferAttribute(fenceVerts,3));fenceGeo.setIndex(fenceIndices);fenceGeo.computeVertexNormals();const fenceMesh=new THREE.Mesh(fenceGeo,mats.wall);fenceMesh.material.side=THREE.DoubleSide;root.add(fenceMesh);
  root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fenceTop),new THREE.LineBasicMaterial({color:0xfacc15})));
  // 距離表示: フェンスは全方向 110m (FENCE_PX) に統一したので、表示も全て 110 に揃える (文字色 #fde68a)。
  function distLabel(text,deg){const a=deg*Math.PI/180,c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');g.font='900 68px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fde68a';g.fillText(text,128,66);const tex=new THREE.CanvasTexture(c);if('colorSpace' in tex)tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(.74,.37),new THREE.MeshBasicMaterial({map:tex,transparent:true}));const r=(fenceRadius(a)-3)*FIELD3D_SCALE;m.position.set(Math.sin(a)*r,.5,-Math.cos(a)*r);m.lookAt(0,.5,3);root.add(m)}
  for(const deg of [-43,-22,0,22,43])distLabel('110',deg); // 両翼はポールと重ならないよう少し内側へ
  // ファウルポール(試作準拠: 黄 #facc15 の柱)。両翼のフェンス端に立てる。
  for(const a of [-Math.PI/4,Math.PI/4]){const r=fenceRadius(a)*FIELD3D_SCALE,pole=new THREE.Mesh(new THREE.CylinderGeometry(.022,.022,1.6,8),new THREE.MeshBasicMaterial({color:0xfacc15}));pole.position.set(Math.sin(a)*r,.8,-Math.cos(a)*r);root.add(pole)}
  // スタンドの弧とスコアボード、ライトタワー(試作の球場シルエット)。すべてフェンスの外側に置き、プレー領域には出ない。
  const stand=new THREE.Mesh(new THREE.CylinderGeometry(16.4,16.4,1.5,48,1,true,Math.PI*.72,Math.PI*.56),mat(0x334155));stand.material.side=THREE.DoubleSide;stand.position.set(0,.72,0);root.add(stand);
  box(0,.9,-15.15,2.6,1.1,.07,mat(0x111827));box(0,1.38,-15.1,2.42,.07,.03,new THREE.MeshBasicMaterial({color:0x86efac}));
  for(const deg of [-32,0,32]){const a=deg*Math.PI/180,r=fenceRadius(a)*FIELD3D_SCALE+.85,tx=Math.sin(a)*r,tz=-Math.cos(a)*r;
   const tower=new THREE.Mesh(new THREE.CylinderGeometry(.035,.05,1.85,8),mat(0x475569));tower.position.set(tx,.925,tz);root.add(tower);
   const head=new THREE.Mesh(new THREE.BoxGeometry(.52,.18,.07),new THREE.MeshBasicMaterial({color:0xfff7cc}));head.position.set(tx,1.98,tz);head.lookAt(0,1.98,0);root.add(head)}
  // 簡易の投手・捕手・野手・打者。共通ジオメトリとマテリアルを使う。
  const bodyGeo=new THREE.CylinderGeometry(.105,.14,.48,7),limbGeo=new THREE.CylinderGeometry(.045,.06,.34,6),headGeo=new THREE.SphereGeometry(.105,8,6),gloveGeo=new THREE.SphereGeometry(.075,7,5);
  const ballRoot=new THREE.Group();root.add(ballRoot);
  const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),mat(0xfffdf5,.55));ballRoot.add(ballMesh);
  const seamMat=new THREE.MeshBasicMaterial({color:0xc83e42});
  for(const side of [-1,1]){const seam=new THREE.Mesh(new THREE.TorusGeometry(.036,.003,4,16,.78*Math.PI),seamMat);seam.position.x=side*.017;seam.rotation.y=side*.45;ballRoot.add(seam)}
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.075,12),new THREE.MeshBasicMaterial({color:0x050807,transparent:true,opacity:.32,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.012;root.add(shadow);
  // 捕球エフェクト (ファインプレー: 閃光+土煙 / ゴロのダイブ・スライド: 土煙のみ)。
  // 発生条件とタイミングは render3dUpdate が G.fl (finePlay / groundPlay) から決める。
  const fxFlash=new THREE.Mesh(new THREE.SphereGeometry(.1,12,8),new THREE.MeshBasicMaterial({color:0xfff2a8,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));fxFlash.visible=false;root.add(fxFlash);
  const fxLight=new THREE.PointLight(0xffe98a,0,4);root.add(fxLight);
  const fxDustMat=new THREE.MeshStandardMaterial({color:0xb08954,roughness:1,transparent:true,opacity:0});
  const fxDust=[],fxDustVel=[];
  for(let i=0;i<16;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.045,6,5),fxDustMat);m.visible=false;root.add(m);fxDust.push(m);const ang=i*2.399;fxDustVel.push({x:Math.cos(ang)*(.35+(i%5)*.13),y:.35+((i*3)%4)*.16,z:Math.sin(ang)*(.35+(i%5)*.13)})}
  const players=[];
  function player(team,x,y,kind){
   const group=new THREE.Group(),world=toWorld(x,y);group.position.set(world.x,0,world.z);group.scale.setScalar(.45);group.rotation.order='YXZ';root.add(group);
   const jersey=team===0?mats.red:mats.blue,body=new THREE.Mesh(bodyGeo,jersey);body.position.y=.48;body.castShadow=true;group.add(body);
   const head=new THREE.Mesh(headGeo,mats.skin);head.position.y=.83;head.castShadow=true;group.add(head);
   // 脚は股関節(腰の高さ)にピボットを置いてそこから振る。棒の中心で回すと足が地面に付かず振り子に見える。
   const legs=[];for(const s of [-1,1]){const hip=new THREE.Group();hip.position.set(s*.085,.36,0);group.add(hip);const leg=new THREE.Mesh(limbGeo,mats.pants);leg.position.y=-.17;hip.add(leg);legs.push(hip)}
   const arms=[];for(const s of [-1,1]){const pivot=new THREE.Group();pivot.position.set(s*.16,.68,0);group.add(pivot);const arm=new THREE.Mesh(limbGeo,jersey);arm.position.y=-.14;pivot.add(arm);arms.push(pivot)}
   // グラブは体への直付けではなく、グラブの手(arms[1])の先端に付ける。腕の動きに連動して初めて「伸ばして捕る」見た目になる。
   const glove=new THREE.Mesh(gloveGeo,mats.glove);glove.position.set(0,-.36,0);arms[1].add(glove);if(kind==='batter'||kind==='runner')glove.visible=false; // グローブは守備側だけ。打者・走者に付けるとボールを持って立っているように見える
   // グラブ色は中暗の橙茶 #7c3f16 (mats.glove): 明るいタンは土 #c88b52 とほぼ同色で埋もれるため、土・芝・フェンスのどれからも分離する濃さにする。グラブは単一マテリアルなのでレース等の差し色は作らない
   // バットは腕の子にせず、グリップ(両手の位置)を支点にした独立パーツにする。
   // グリップ位置と回転は打者更新側で毎フレーム決める(左右で鏡像)。
   // バットの長さはローカル +Z 方向(中心 z=.31 / 長さ .62)。Y を長くすると縦棒になってしまうので注意。
   let bat=null;if(kind==='batter'){bat=new THREE.Group();group.add(bat);box(0,0,.31,.055,.055,.62,mats.bat,bat);box(0,0,.01,.075,.075,.03,mats.bat,bat)}
   players.push({group,legs,arms,glove,bat,body,head,jersey,team,kind,index:players.length,runPhase:0,travel:0,lastX:world.x,lastZ:world.z,yaw:0,pose:0,crouch:0});return group;
  }
  const defense=G.top?1:0,batting=G.top?0:1;
  for(let i=0;i<FD.length;i++)player(defense,FD[i][0],FD[i][1],i===0?'pitcher':i===1?'catcher':'fielder');
  const batterSide=G.batterSides?G.batterSides[G.top?0:1]:'right';player(batting,batterSide==='right'?219:261,370,'batter');
  // 走者は最大4人(塁上3人+打者走者)。塁の状態に合わせて毎フレーム割り当てるプール方式にする。
  for(let i=0;i<4;i++){const g=player(batting,HP.x,HP.y,'runner');g.visible=false}
  // 球審 (本塁審) — 実物調査に基づく装備 (全日本野球協会の審判講習マニュアル/MLBの慣行):
  //  黒いシャツ (Taiyo指定。シャツの下にインサイドプロテクターを着けるため胴は厚みを持たせる)、
  //  チャコールグレーのスラックス (レガースを下に着けるため脚も少し太く)、黒いキャップと黒ベルト・黒靴、
  //  顔の前面にマスク (下にスロートガード)、右腰にボールバッグ (付けるのは球審だけ)。
  // players[] には入れない (打者・走者プールの添字を壊さないため専用オブジェクトで持つ)。
  const umpire=(()=>{
   const group=new THREE.Group();group.scale.setScalar(.45);group.rotation.order='YXZ';root.add(group);
   const body=new THREE.Mesh(bodyGeo,mats.umpShirt);body.position.y=.48;body.scale.set(1.3,1,1.18);body.castShadow=true;group.add(body); // プロテクター分だけ胴を厚く
   const head=new THREE.Mesh(headGeo,mats.skin);head.position.y=.83;head.castShadow=true;group.add(head);
   const cap=new THREE.Mesh(new THREE.CylinderGeometry(.108,.112,.055,8),mats.umpShirt);cap.position.y=.915;group.add(cap); // 黒キャップ (つばはマスク側=+Z)
   const brim=box(0,.885,.13,.15,.02,.09,mats.umpShirt,group);
   const mask=box(0,.83,.125,.17,.21,.045,mats.umpMask,group); // マスク本体 (顔の前面)
   const guard=box(0,.70,.115,.07,.10,.03,mats.umpMask,group);  // スロートガード (喉元へ垂れる部分)
   const legs=[];for(const s of [-1,1]){const hip=new THREE.Group();hip.position.set(s*.095,.36,0);group.add(hip);const leg=new THREE.Mesh(limbGeo,mats.umpPants);leg.position.y=-.17;leg.scale.set(1.25,1,1.25);hip.add(leg);legs.push(hip);
    const shoe=box(0,-.345,.03,.09,.05,.17,mat(0x0c0d10),hip)} // 黒靴
   const arms=[];for(const s of [-1,1]){const pivot=new THREE.Group();pivot.position.set(s*.19,.68,0);group.add(pivot);const arm=new THREE.Mesh(limbGeo,mats.umpShirt);arm.position.y=-.14;pivot.add(arm);arms.push(pivot)}
   const bag=box(-.24,.44,.02,.13,.17,.08,mats.umpBag,group); // ボールバッグ: 審判の右腰 (投手に正対したときの右 = ローカル -X)
   return{group,body,head,legs,arms,mask,guard,cap,brim,crouch:0};
  })();
  r3d={renderer,scene,camera,root,players,runners:players.slice(10),materials:mats,umpire,zoneBoard,ballRoot,ballMesh,shadow,fxFlash,fxLight,fxDust,fxDustMat,fxDustVel,fxT0:-1,fxFlightId:null,fxKind:null,fxSpread:1,fxOrigin:new THREE.Vector3(),chaseActive:false,chasePos:new THREE.Vector3(),chaseLook:new THREE.Vector3(),fpPos:new THREE.Vector3(),fpLook:new THREE.Vector3(),views:{
   catcher:{pos:new THREE.Vector3(0,2.35,3.7),look:new THREE.Vector3(0,.15,-4.4)},
   chase:{pos:new THREE.Vector3(0,2.35,3.7),look:new THREE.Vector3(0,.15,-4.4)}
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
 // 3Dが許可されていない環境では切替UI自体を出さず、常に2D表示にする(このアーティファクトでは許可済み)。
 if(!render3dAllowed()){const ctl=$('view-ctl');if(ctl)ctl.style.display='none';toggle.disabled=true;cameraButton.disabled=true;return}
 try{const saved=localStorage.getItem('yakyu-stadium-camera');if(FIELD3D_CAMERAS.some(q=>q.id===saved))r3dMode=saved}catch(e){}
 render3dSetMode(r3dMode,false);
 const ok=render3dInitScene();toggle.disabled=!ok;cameraButton.disabled=!ok;
 if(!ok){toggle.textContent='2D表示';toggle.title='WebGLを利用できないため2D表示です';return}
 render3dSetEnabled(true);
 toggle.addEventListener('click',()=>render3dSetEnabled(!r3dEnabled));
 cameraButton.addEventListener('click',()=>render3dSetMode(cameraModeNext(r3dMode)));
 addEventListener('keydown',e=>{if(e.repeat||e.key.toLowerCase()!=='c')return;const target=e.target;if(target instanceof Element&&target.closest('input,textarea,select,button,[contenteditable="true"],[role="dialog"]'))return;if($('ov').style.display!=='none'||$('patch-ov')?.classList.contains('open'))return;render3dSetMode(cameraModeNext(r3dMode))});
}
function render3dUpdate(now){
 if(!render3dIsActive())return;
 const {renderer,scene,camera,players,views}=r3d,home=toWorld(240,375);
 let view=views.catcher;
 const ball=fieldBallState(G,now);
 // 一人称 (捕手の目線): 実験トグル「捕手視点ゾーン」ON の間は、カメラ選択
 // (捕手後方/打球追跡) より優先してカメラを捕手の目の位置に置く。OFF に戻れば
 // この上書きが消え、元の r3dMode の視点へ補間で戻る (r3dMode 自体は触らない)。
 // 画面の揺れの廃止 (Taiyo 指示 2026-11-02): 目位置・注視点は本塁の定位置に
 // 完全固定し、捕手モデルからは一切取らない。旧方式は構え中 (crouch>.5) に
 // 捕手モデルの頭から目を取っていたため、(1) crouch の立ち上がり/沈み込みの
 // 補間中は目線が上下に漂い、(2) 投球中はミット追従 (mittK) が group 位置を
 // 水平にずらすたび視点も横へ流れ、投球が終わって mittK が戻ると視点も揺り
 // 戻し、実プレイ動画でも画面全体が揺れて見えた。捕手モデルの構え・ミット
 // 追従の動き自体は従来どおり残し、カメラだけを切り離して固定する。
 // 固定値は旧方式で構えが落ち着いたときの目位置そのもの (0, .28, .25 /
 // 注視点 (0, .33, -3.1)): 到達点 (ミットの位置 z≈.25) より後ろに目を残し、
 // 飛球が板を通過してミットへ届くまでを視野に収める。カメラへの適用も下の
 // 補間を通さず直接コピーするので、ON の間はフレーム間の変動が 0 になる。
 // 打球が発生したら (G.fl の間) 捕手視点は一時停止する: ゾーン板を消し、カメラは
 // 打球追跡に切り替える (下の chase 分岐が fpSuspend でも効く)。G.fl は次の投球の
 // 準備 (ready) で消えるので、その時点で一人称＋板表示へ自動で戻る。
 const fpSuspend=(typeof ZBOARD_EXP!=='undefined')&&ZBOARD_EXP.enabled&&!!G.fl;
 const fpActive=(typeof ZBOARD_EXP!=='undefined')&&ZBOARD_EXP.enabled&&!G.fl;
 let fpView=null;
 if(fpActive){
  r3d.fpPos.set(FP_EYE3D.x,FP_EYE3D.y,FP_EYE3D.z);
  // 注視点は投手のリリース付近の高さで真っ直ぐ前: ゾーン板 (中心 y .20) が画面
  // 中央付近に来て、その向こうに投手、両脇に打者が入る画角にする。
  r3d.fpLook.set(0,.33,-3.1);
  fpView={pos:r3d.fpPos,look:r3d.fpLook};
  view=fpView;
 }
 // 打球追跡: 投球・打撃中は捕手後方と同じ通常視点。打球飛行(G.fl)の間だけ
 // ボールの後方・上方からボールを見続ける。送球(G.th)に入ったら追跡をやめて捕手後方へ戻す
 // (内野の短い送球を追うと視点が回り込んで酔うため)。プレイが終われば view は捕手後方に戻り、
 // 下の補間で滑らかに帰る。後方は「ボール→本塁」方向に取るので、どの方向の打球でも背後から追える。
 let chasing=false,targetFov=fpActive?74:54;
 if(!fpActive&&(r3dMode==='chase'||fpSuspend)&&G.fl&&ball){
  // 打球追跡 (従来・広角): ボールの後方やや遠くから追う。
  chasing=true;targetFov=52;
  const p=toWorld(ball.x,ball.y,ball.h||0);
  const hx=-p.x,hz=-p.z,hl=Math.hypot(hx,hz);
  const dx=hl>.001?hx/hl:0,dz=hl>.001?hz/hl:1;
  r3d.chasePos.set(p.x+dx*5.6,Math.max(2.4,p.y+3.2),p.z+dz*5.6);
  r3d.chaseLook.set(p.x,Math.max(.15,p.y+.25),p.z);
  // 本塁付近: ボール→本塁の方向は本塁に近づくほど長さが消えて不安定になり、
  // 本塁真上ではオフセットが 0 になってカメラがボールの真上から垂直に見下ろしてしまう。
  // そこで本塁から約3.2以内では、本塁の少し後方 (+Z) の低い位置へ滑らかに寄せる。
  // 寄せ先は通常の捕手後方 (高さ2.35 / 後方3.7) より低く・近く (高さ1.55 / 後方2.5) にし、
  // 捕手後方と同じ広さまで引かず、タイトに寄った画角のままにする。
  const homeRaw=cl((3.2-hl)/3.2,0,1),homeK=homeRaw*homeRaw*(3-2*homeRaw);
  if(homeK>0){
   r3d.chasePos.x+=(p.x*.35-r3d.chasePos.x)*homeK;
   r3d.chasePos.y+=(1.55-r3d.chasePos.y)*homeK;
   r3d.chasePos.z+=(home.z+2.5-r3d.chasePos.z)*homeK;
  }
  // 保険: 注視点 (ボール) との水平距離が小さすぎると真下ろしになるため、
  // 最低 1.9 の水平オフセットを本塁後方側で確保する。
  const sepX=r3d.chasePos.x-r3d.chaseLook.x,sepZ=r3d.chasePos.z-r3d.chaseLook.z,sep=Math.hypot(sepX,sepZ);
  if(sep<1.9){
   if(sep>.001){r3d.chasePos.x=r3d.chaseLook.x+sepX/sep*1.9;r3d.chasePos.z=r3d.chaseLook.z+sepZ/sep*1.9}
   else{r3d.chasePos.x=r3d.chaseLook.x;r3d.chasePos.z=r3d.chaseLook.z+1.9}
  }
  view={pos:r3d.chasePos,look:r3d.chaseLook};
 }
 r3d.chaseActive=chasing;
 // ファインプレー: 捕球の瞬間にカメラがその野手へ寄る。捕手後方・打球追跡どちらの
 // ベース視点に対しても目標視点をブレンドするので、両モードで同じ寄り方が効く。
 // 寄りは捕球350ms前から始めて捕球直後に最大、余韻(約1.9秒)の間に元の視点へ戻る。
 // 寄り先は野手の3.8先・高さ1.7までとし、ブレンドは位置4割強・注視6割弱まで (ベース視点を残す)。
 // 寄り切って視点が回り込むと酔うので、あくまで「少し寄る」に留める。
 let zoomK=0;
 if(!fpActive&&G.fl&&G.fl.finePlay){
  const e=now-(G.fl.t0+G.fl.dur);
  if(e>-350&&e<1900){
   const kin=cl((e+350)/450,0,1),kout=cl((1900-e)/700,0,1),k=Math.min(kin,kout);zoomK=k*k*(3-2*k);
   if(zoomK>0){
    const [gx,gy]=fpos(G.fl.fi,now),gw=toWorld(gx,gy),hx=gw.x-home.x,hz=gw.z-home.z,hl=Math.hypot(hx,hz)||1;
    const zp=new THREE.Vector3(gw.x-hx/hl*5.0,2.2,gw.z-hz/hl*5.0),zl=new THREE.Vector3(gw.x,.35,gw.z);
    const bp2=view.pos.clone(),bl2=view.look.clone();bp2.lerp(zp,zoomK*.42);bl2.lerp(zl,zoomK*.58);view={pos:bp2,look:bl2};
   }
  }
 }
 if(!r3dCamPos){r3dCamPos=view.pos.clone();r3dLook=view.look.clone()}
 // 補間は1本化し、フレームレート非依存にする (基準アルファを経過フレーム数で累乗)。
 // 追跡中は注視点を速め・位置を中速で寄せてボールを見失わず、復帰時はゆっくり戻す。
 const dtF=cl(now-(r3d.lastT||now),0,50),frN=dtF>0?dtF/16.7:1;r3d.lastT=now;
 // 一人称では補間を一切通さず、固定した目位置・注視点・FOV をそのまま使う
 // (揺れの廃止: 投球中も含め、ON の間はカメラ位置・注視点のフレーム間変動は
 // 0。ON への切替は1フレームで目線に切り替わる)。OFF へ戻るときは従来の
 // 緩さで元のカメラへ帰る (fpActive が消えたフレームから通常レートになる)。
 if(fpActive){
  r3dCamPos.copy(view.pos);r3dLook.copy(view.look);
  if(camera.fov!==targetFov){camera.fov=targetFov;camera.updateProjectionMatrix()}
 }else{
  const posBase=zoomK>.05?.14:chasing?.085:.06,lookBase=zoomK>.05?.18:chasing?.16:.07;
  r3dCamPos.lerp(view.pos,1-Math.pow(1-posBase,frN));r3dLook.lerp(view.look,1-Math.pow(1-lookBase,frN));
  if(Math.abs((camera.fov||54)-targetFov)>.05){camera.fov=(camera.fov||54)+(targetFov-(camera.fov||54))*Math.min(1,.3*frN);camera.updateProjectionMatrix()}
 }
 camera.position.copy(r3dCamPos);camera.lookAt(r3dLook);
 // 捕球エフェクトの発火: 対象の打球 (finePlay / groundPlay) が捕球時刻に達したフレームで1回だけ。
 if(G.fl&&(G.fl.finePlay||G.fl.groundPlay)&&r3d.fxFlightId!==G.fl.id){
  const catchT=G.fl.t0+G.fl.dur;
  if(now>=catchT&&now<catchT+600){
   r3d.fxFlightId=G.fl.id;r3d.fxT0=catchT;r3d.fxKind=G.fl.finePlay?'fine':'ground';r3d.fxSpread=G.fl.finePlay?1:.6;
   const o=toWorld(G.fl.to.x,G.fl.to.y);r3d.fxOrigin.set(o.x,.18,o.z);
  }
 }
 // 閃光・土煙の更新。画面シェイクは細かい振動が酔いの原因になるので入れない。
 const fxE=r3d.fxT0>0?now-r3d.fxT0:-1;
 if(r3d.fxFlash){
  // 閃光は小さく・薄く・短く: 半径.1の球を最大1.4倍・250msまで。選手の身長を超える大きさにはしない。
  const flashOn=r3d.fxKind==='fine'&&fxE>=0&&fxE<250;
  r3d.fxFlash.visible=flashOn;r3d.fxLight.intensity=flashOn?(1-fxE/250)*.9:0;
  if(flashOn){r3d.fxFlash.position.copy(r3d.fxOrigin);r3d.fxFlash.material.opacity=(1-fxE/250)*.5;const sc=1+fxE/250*.4;r3d.fxFlash.scale.set(sc,sc,sc);r3d.fxLight.position.set(r3d.fxOrigin.x,r3d.fxOrigin.y+.3,r3d.fxOrigin.z)}
  const dustDur=r3d.fxKind==='fine'?800:600,dustOn=fxE>=0&&fxE<dustDur;
  r3d.fxDustMat.opacity=dustOn?.55*(1-fxE/dustDur):0;
  r3d.fxDust.forEach((m,i)=>{
   m.visible=dustOn;if(!dustOn)return;
   const v=r3d.fxDustVel[i],t=fxE/1000*r3d.fxSpread;
   // 土煙の粒は放物線の落下で地面 (y=0) を割らないよう下限で止める (旧式は終盤に最大0.24沈んでいた)。
   m.position.set(r3d.fxOrigin.x+v.x*t,Math.max(.02,r3d.fxOrigin.y+v.y*(fxE/1000)-1.1*(fxE/1000)*(fxE/1000)),r3d.fxOrigin.z+v.z*t);
   const sc=.7+fxE/280;m.scale.set(sc,sc,sc);
  });
 }
 const bt=G.top?0:1,defense=1-bt;
 // 送球者判定: 現在の送球ステップの起点に一番近い野手だけが投げる腕を振る (全員同時は不自然)。
 let throwerIdx=-1,throwStepAge=0,throwerD=Infinity;
 if(G.th){let fromPt=null,st=0;const el=now-G.th.t0;
  if(G.th.steps){let active=false;for(const q of G.th.steps){const a=st+(q.dly||0),b=a+q.dur;if(el<b){fromPt=q.from;throwStepAge=Math.max(0,el-a);active=true;break}st=b}if(!active)fromPt=null}
  else if(el>=0&&el<G.th.dur){fromPt=G.th.from;throwStepAge=el}
  if(fromPt)for(let j=0;j<FD.length;j++){const q=fpos(j,now),d=(q[0]-fromPt.x)**2+(q[1]-fromPt.y)**2;if(d<throwerD){throwerD=d;throwerIdx=j}}}
 for(let i=0;i<FD.length;i++){
  const [x,y]=fpos(i,now),p=toWorld(x,y),player=players[i],dx=p.x-player.lastX,dz=p.z-player.lastZ,distance=Math.hypot(dx,dz);player.travel+=distance;player.runPhase+=distance*18;player.lastX=p.x;player.lastZ=p.z;players[i].group.position.x=p.x;players[i].group.position.z=p.z;
  const jersey=defense===0?r3d.materials.red:r3d.materials.blue;if(players[i].jersey!==jersey){players[i].jersey=jersey;players[i].group.children[0].material=jersey;players[i].arms.forEach(a=>a.children[0].material=jersey)}
  const moving=distance>.0007;
  // 捕球する野手は、止まった途端に本塁 (カメラ) 方向へ向き直させない。移動してきた向きのまま捕る。
  const desiredYaw=moving?Math.atan2(dx,dz):(G.fl&&G.fl.fi===i?player.yaw:fieldPlayerFacing({x:p.x,z:p.z},{x:home.x,z:home.z}));
  let yawDelta=((desiredYaw-player.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;player.yaw+=cl(yawDelta,-.09,.09);players[i].group.rotation.y=player.yaw;
  const run=moving?1:0;player.pose+=(run-player.pose)*.18;
  // ダイブ/スライドの量 (0→1): 捕球に近づくにつれて倒れ込む。
  // ファインプレーは余韻の間キープしてから起き上がり、ゴロの場合は送球 (G.th) が始まると起き上がる。
  // 捕球モーションの種類は打球状況で決める (fieldCatchPlayType)。ファインプレーとゴロの
  // ダイブ/スライドが対象で、通常捕球 (アウトになる捕球) は倒れる種類を腕伸ばしに寄せる。
  // 振り分けは見た目だけで、捕球の成否・タイミング・走者には一切触らない。
  let catchType=null,catchRec=1;
  if(G.fl&&G.fl.fi===i&&(G.fl.finePlay||G.fl.groundPlay||G.fl.out)){
   catchType=fieldCatchPlayType(G.fl);
   if(!G.fl.finePlay&&!G.fl.groundPlay&&(catchType==='dive'||catchType==='slide'||catchType==='jump'))catchType='reach';
  }
  let diveAmt=0,slideAmt=0,jumpAmt=0,reachAmt=0;
  if(catchType){
   const ramp=cl((cl((now-G.fl.t0)/G.fl.dur,0,1)-.55)/.45,0,1);
   let rec=1;
   if(G.fl.groundPlay){if(G.th&&G.th.t0)rec=1-cl((now-G.th.t0)/560,0,1)}
   else if(G.fl.finePlay){const sc2=now-(G.fl.t0+G.fl.dur);if(sc2>1000)rec=1-cl((sc2-1000)/700,0,1)}
   else{const sc2=now-(G.fl.t0+G.fl.dur);if(sc2>0)rec=1-cl(sc2/350,0,1)}
   if(catchType==='jump'&&now>=G.fl.t0+G.fl.dur*.94)rec=Math.min(rec,1-cl((now-(G.fl.t0+G.fl.dur*.94))/450,0,1));
   catchRec=rec;
   const amt=ramp*rec;
   if(catchType==='dive')diveAmt=amt;else if(catchType==='slide')slideAmt=amt;else if(catchType==='jump')jumpAmt=amt;else reachAmt=amt;
  }
  const stride=Math.sin(player.runPhase);player.legs[0].rotation.x=stride*.72*player.pose;player.legs[1].rotation.x=-stride*.72*player.pose;
  // 投げる腕(arms[0])は送球者本人だけ: 後ろへ引いてから前へ振り抜く。
  let throwArm=0;
  if(i===throwerIdx){const tp=cl((throwStepAge+60)/330,0,1);throwArm=-2.05+2.95*(1-(1-tp)*(1-tp))}
  // 投手の簡易ワインドアップ: 投球開始に合わせて腕を後ろ→前へ振り、フォローで上体が少し前へ倒れる。
  let pitchLean=0;
  if(i===0&&G.pitch&&!G.fl){const rel=now-G.pitch.t0;
   if(rel>=0&&rel<560){const tp=cl(rel/300,0,1);throwArm=-2.3+3.25*(tp*tp*(3-2*tp));pitchLean=Math.sin(cl((rel-180)/380,0,1)*Math.PI)*.16}}
  if(i!==1)player.body.rotation.x=pitchLean;
  // 腕と体の付属パーツは毎フレーム既定へ戻してから付ける (前フレームのグラブ狙いの残りを消す)。
  player.arms[0].rotation.set(0,0,0);player.arms[1].rotation.set(0,0,0);
  player.arms[0].position.set(-.16,.68,0);player.arms[1].position.set(.16,.68,0);
  player.legs[0].rotation.z=0;player.legs[1].rotation.z=0; // 脚の横開き (フィギュア4等) は毎フレーム既定へ戻してから付ける
  player.body.position.y=.48;player.head.position.y=.83;player.head.position.z=0;
  // グラブの腕(arms[1])は捕球する野手がボールへ伸ばす。グラブ自体も腕の先に付いているので一緒に届く。
  let reach=0;if(G.fl&&G.fl.fi===i){const fp=cl((now-G.fl.t0)/G.fl.dur,0,1);reach=cl((fp-.45)/.55,0,1)}
  // ダイブは体が大きく前に寝るぶん、グラブの腕も頭の先まで強く伸ばして着地点へ向ける。
  const ext=Math.max(diveAmt*2.3,reach*(G.fl&&G.fl.kind==='ground'?.85:1.4));
  player.arms[0].rotation.x=-stride*.48*player.pose+throwArm;player.arms[1].rotation.x=stride*.48*player.pose-ext;
  if(diveAmt>0){
   // 脚は垂らさず体の軸の延長に後ろへ流す (片脚だけ少し上げて流れを作る)。
   // 脚を真下に残すと「倒れ込む人」に見え、一直線に伸ばすと「飛び込む人」に見える。
   player.legs[0].rotation.x=.05*diveAmt;player.legs[1].rotation.x=.3*diveAmt;
   // 投げ手は dive 専用ポーズ: 空中では横〜後方へ大きく開いてバランスを取り、
   // 倒れ込み〜起き上がりでは後ろの地面を押す向きになる (実物のダイブの定番形)。
   // 前に残すと寝た体の下敷きになる向きになる。グラブ手 (arms[1]) は触らないので捕球照準は維持される。
   player.arms[0].rotation.x+=1.05*diveAmt;
   player.arms[0].rotation.z-=.95*diveAmt;
  }
  if(slideAmt>0){
   // スライディングキャッチの標準形はフィギュア4 (実物の指導源で一致):
   //  上の脚 (legs[0]) は真っ直ぐ伸ばし切り、踵が浮くよう水平よりわずかに上へ向ける。
   //  下の脚 (legs[1]) は屈曲させて上の脚の下へ潜らせる (横へ倒して上脚の下に交差させる)。
   // 両脚真っ直ぐ前方に揃えた形は実物のスライディングキャッチにはほぼ見られない。
   // 数値はグループ後傾 (約27.5°) との合計で決める: 上脚は合計で水平+わずかに上 (踵浮き)、
   // 下脚は斜め下へ残して「曲げて潜らせた」折れを作る。
   player.legs[0].rotation.x=-1.12*slideAmt;player.legs[0].rotation.z=.07*slideAmt;
   player.legs[1].rotation.x=-.42*slideAmt;player.legs[1].rotation.z=-.62*slideAmt; // 内側へ倒して上脚の下へ交差させる (符号は捕手の膝開きと逆向き=内向き)
   // 逆腕は後ろの地面について体を支える向きに。
   player.arms[0].rotation.x+=1.5*slideAmt;
  }
  if(jumpAmt>0){
   player.legs[0].rotation.x-=.8*jumpAmt;player.legs[1].rotation.x-=.45*jumpAmt;
   // 投げ手はフェンス側へ伸ばしてフェンスを探る/支える (ロバーのドリル標準形)。
   // 跳躍中は野手がフェンス (=進行方向) を向いているので、投げ手を前上方へ伸ばし
   // 外側へ開くことがそのまま「フェンスへ手を伸ばす」形になる。
   // グラブ手 (arms[1]) は触らないので、後の腕の照準でグラブはボールへ向けられる。
   player.arms[0].rotation.x+=-1.5*jumpAmt;
   player.arms[0].rotation.z+=-.5*jumpAmt;
  }
  // 投手のセットポジション: 投球前は両手を体の前で合わせる。
  if(i===0&&!G.pitch&&!G.fl&&!G.th&&(G.phase==='aim'||G.phase==='ready'||G.phase==='idle')){player.arms[0].rotation.x=-.5;player.arms[1].rotation.x=-.72}
  // ダイブ/スライドは胴体パーツだけを倒さず、足元(グループ原点)を支点に体ごと倒して「寝かせる」。
  // グループの回転順は YXZ なので、倒れる向きは常にそのときの体の向き (≒進行方向) に一致する。
  //  ダイブ: 前へ約76°まで寝かせ、頭からグラブまでを地面すれすれの一直線にする。
  //  スライド: 後傾は実物の目安 20〜30°に合わせて約27.5° (旧・約58°は深すぎた)。
  //   浅くした分だけ腰の落とし量を .08→.10 に増やし、尻・腰が地面に接したまま滑る形にして
  //   「浮いた腰+浅い後傾」で座り込み/尻餅に見える組み合わせを避ける (腰位置とセットの再調整)。
  // フライの reach は「腕だけ伸ばす」形にする: 体の前傾・沈み・屈みの束は低い打球 (ゴロ)
  // 専用に分離し、フライでは reachCrouch=0 で体幹を立てたまま腕だけをボールへ伸ばす。
  const reachCrouch=G.fl&&G.fl.kind==='ground'?reachAmt:0;
  player.group.rotation.x=diveAmt*1.32-slideAmt*.48+reachCrouch*.42;
  // 待機中は足を地面に付けたまま上体だけごく小さく揺らす。体全体の浮き沈み (pulse) はしない。
  player.body.rotation.z=Math.sin(now*.0016+i*1.7)*.03*(1-player.pose);
  // ジャンプはボールの高さに合わせて跳ぶ (グラブが届く高さまで)。スライドとゴロの腕伸ばしは上体をかがめる (フライの腕伸ばしは体をかがめない)。
  // 下げ量は「腰が地面に接するが沈み込まない」量にする。旧値 (ダイブ.03/スライド.15) は
  // 倒れた体の中心が地面より下へ出て、胴体が芝にめり込んで見えた (ジオメトリ計算で確認)。
  const jumpY=jumpAmt>0&&ball?cl(toWorld(ball.x,ball.y,ball.h).y-.55,0,.35)*jumpAmt:0;
  players[i].group.position.y=-diveAmt*.01-slideAmt*.10-reachCrouch*.04+jumpY;
  // ジャンプ捕球は体ごとフェンスへ寄せる (本塁からフェンス方向へ少し前進させる)。
  // フライでは後のグラブ照準補正 (aimK) が体を動かさないため、この寄せがそのまま残る
  // (接近局面の一定オフセットで、到着後に増減する動きにはならない)。
  // 捕球点そのものの寄せは腕側の fwdA (jump 分) と合わせて行う。
  if(jumpAmt>0){const jl=Math.hypot(p.x,p.z);if(jl>.01){players[i].group.position.x+=p.x/jl*.16*jumpAmt;players[i].group.position.z+=p.z/jl*.16*jumpAmt}}
  const bend=Math.max(reachCrouch,slideAmt*.7);
  if(bend>0){player.body.position.y=.48-.12*bend;player.head.position.y=.83-.16*bend;player.head.position.z=.06*bend;if(i!==1)player.body.rotation.x+=bend*.4}
  // 捕手(FD index 1)だけ専用ポーズ: しゃがんで投手を向き、ミットを前に構える。
  // 自分が打球処理に行く場面では専用ポーズを解いて通常の野手動作に戻す。
  if(i===1){
   const fielding=!!((G.fl&&G.fl.fi===1)||(G.rl&&G.rl.moves.some(m=>m.i===1)));
   player.crouch+=((fielding?0:1)-player.crouch)*.22;
   const c=player.crouch;
   if(c>.01){
    // 投手のほうを向く(通常の本塁向きは逆)
    const mound=toWorld(FD[0][0],FD[0][1]),faceTo=fieldPlayerFacing({x:p.x,z:p.z},{x:mound.x,z:mound.z});
    let fd=((faceTo-player.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;player.yaw+=fd*Math.min(1,.35+.65*c);player.group.rotation.y=player.yaw;
    // しゃがむ: 脚を折って膝を開き、体と頭を下げて上体を少し前傾
    player.legs[0].rotation.x=player.legs[0].rotation.x*(1-c)+1.2*c;player.legs[1].rotation.x=player.legs[1].rotation.x*(1-c)+.95*c;
    player.legs[0].rotation.z=-.3*c;player.legs[1].rotation.z=.3*c;
    player.legs[0].position.x=-(.085+.05*c);player.legs[1].position.x=.085+.05*c;
    player.body.position.y=.48-.17*c;player.body.rotation.x=.38*c;
    player.head.position.y=.83-.23*c;player.head.position.z=.05*c;player.head.rotation.x=.2*c;
    player.arms[0].position.y=.68-.16*c;player.arms[1].position.y=.68-.16*c;
    player.group.position.y=0;
    // 構え中はキャッチャーボックス (z 0〜1.348H) の内側へ寄せる (定位置 z≈.61 は後端線の外)。
    player.group.position.z=p.z*(1-c)+.40*c;
    // 投球到着のタイミングでミットが受ける小さな引き
    let recv=0;
    if(G.pitch){const dt=now-(G.pitch.t0+G.pitch.dur);
     if(G.phase==='pitch'){const t=cl(G.pitch.t||0,0,1);recv=Math.pow(cl((t-.82)/.18,0,1),2)*.05}
     else if(dt>0&&dt<260)recv=Math.sin(dt/260*Math.PI)*.05}
    // ミットの手(arms[1])は投手に向けて前へ、もう片腕は後ろに隠す。
    // ミットは arms[1] の先端に付いているので、この回転だけで前に構えた位置へ来る。
    player.arms[1].rotation.x=player.arms[1].rotation.x*(1-c)+(-1.2-recv*2)*c;player.arms[1].rotation.z=-.15*c;
    player.arms[0].rotation.x=player.arms[0].rotation.x*(1-c)+.6*c;player.arms[0].rotation.z=.2*c;
   }else{
    // 立ち姿に戻す(体の各部品を既定へ)
    player.body.position.y=.48;player.body.rotation.x=0;player.head.position.y=.83;player.head.position.z=0;player.head.rotation.x=0;
    player.legs[0].rotation.z=0;player.legs[1].rotation.z=0;player.legs[0].position.x=-.085;player.legs[1].position.x=.085;
    player.arms[0].position.y=.68;player.arms[1].position.y=.68;player.arms[0].rotation.z=0;player.arms[1].rotation.z=0;
   }
  }
  // グラブをボールの実際の位置に合わせる (捕球する野手のみ・3D表示だけ)。
  // 腕 (グラブ手) はボール方向へ向け、肩も姿勢に合わせて少し下げ/前に出す。
  // それでも残る距離をグループ位置の補正で吸収するのはゴロだけにし、補正は水平 (X/Z)
  // だけに使う (体のYは姿勢モーションだけで決め、補正では一切動かさない=体が地面から
  // 浮かない)。
  // フライでは体ごとの補正を一切しない。飛行中のボールの現在位置へ体を引くと、着地点に
  // 先着した野手が本塁側へ下がってから戻る往復滑りになる (実測で最大0.9 world) ため。
  // フライの一致は、野手が着地点へ先着していること (fpos がアウト捕球では飛行の92%までに
  // 到達させる) と、腕をボールへ向ける照準で担保する。
  if(catchType&&ball&&!G.th){
   const fp3=cl((now-G.fl.t0)/G.fl.dur,0,1),wStart=G.fl.kind==='ground'?.62:.5,wEnd=catchType==='jump'?.94:1;
   let aimK=cl((fp3-wStart)/Math.max(.05,wEnd-wStart),0,1);aimK=aimK*aimK*(3-2*aimK)*catchRec;
   if(aimK>0){
    // jump では肩の前方オフセットを引く (=体がフェンス寄りに残ったままグラブだけがボールへ届く形)。
    // 照準の解き方自体は変えないので、捕球時にグラブ先端=ボールの一致はそのまま保たれる。
    const lower=diveAmt*.16+slideAmt*.2+reachCrouch*.3,fwdA=diveAmt*.18+slideAmt*.06+reachCrouch*.13-jumpAmt*.14;
    player.arms[1].position.set(.16,.68-lower,fwdA);
    const bw=toWorld(ball.x,ball.y,ball.h),Bv=new THREE.Vector3(bw.x,bw.y,bw.z);
    const pv=new THREE.Vector3(.16,.68-lower,fwdA);player.group.localToWorld(pv);
    const dir=Bv.clone().sub(pv),dl=dir.length();
    if(dl>1e-4){
     dir.divideScalar(dl);
     const qw=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),dir);
     const gq=new THREE.Quaternion();player.group.getWorldQuaternion(gq);
     player.arms[1].quaternion.copy(gq.invert().multiply(qw));
     const gv=new THREE.Vector3();player.glove.getWorldPosition(gv);
     // 体は地面から浮かせない: グループ位置の補正は水平成分だけを適用し、Yは捨てる。
     // (Yまで吸収していた旧方式では、ボールが高い飛行中盤に体ごと最大で身長超えまで
     //  引き上げられ、ジャンプ捕球のように見えていた)
     // フライでは水平補正も使わない (上のブロックコメント参照: 先着した野手の往復滑り防止)。
     const aimDelta=Bv.sub(gv);aimDelta.y=0;
     if(G.fl.kind==='ground')player.group.position.addScaledVector(aimDelta,aimK);
    }
   }
  }
  // 捕手のミット追従 (3D表示だけ・判定には触らない): 投球中、ミットを捕球点へ先行して構え直す。
  // 目標は投球軌道の終点そのもの (pitchCatchPoint を fieldBallState と共用) なので、
  // 到達の瞬間にミットとボールの位置が一致する。構え直しは投球の前半 (t≈.4) でほぼ終え、
  // 残りの時間は接近に合わせた微調整だけにする。効き具合 (player.mittK) はフレームレート
  // 非依存に追随させ、投球が替わってもカクつかない。投球が無い場面・打球処理中・送球中は
  // mittK が 0 へ戻って従来の構えに戻る (打球の捕球照準 catchType 側とは競合させない)。
  if(i===1){
   const cFielding=!!((G.fl&&G.fl.fi===1)||(G.rl&&G.rl.moves.some(m=>m.i===1)));
   const tracking=!!(G.pitch&&(G.phase==='pitch'||G.phase==='busy')&&!G.fl&&!G.th&&!cFielding&&player.crouch>.5);
   if(tracking){
    const cp=pitchCatchPoint(G.pitch),cw=toWorld(cp.x,cp.y,cp.h);
    if(!player.mittTarget)player.mittTarget=new THREE.Vector3();
    player.mittTarget.set(cw.x,cw.y,cw.z);
   }
   let want=0;
   if(tracking){
    const pt=cl((now-G.pitch.t0)/Math.max(1,G.pitch.dur),0,1);
    want=cl((pt-.02)/.38,0,1);want=want*want*(3-2*want);
    if(G.phase==='busy'){const over=now-(G.pitch.t0+G.pitch.dur);if(over>220)want=Math.min(want,cl(1-(over-220)/240,0,1))}
   }
   if(cFielding||G.th)player.mittK=0;
   const mk=player.mittK||0,rate=want>mk?.17:.09;
   player.mittK=mk+(want-mk)*(1-Math.pow(1-rate,frN));
   if(player.mittK>.01&&player.mittTarget&&!cFielding&&!G.th){
    const Bv=player.mittTarget;
    const pv=player.arms[1].position.clone();player.group.localToWorld(pv);
    const dir=Bv.clone().sub(pv),dl=dir.length();
    if(dl>1e-4){
     dir.divideScalar(dl);
     const qw=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),dir);
     const gq=new THREE.Quaternion();player.group.getWorldQuaternion(gq);
     // 腕は構えの向きから目標方向へ mittK の割合だけ球面補間し、急に跳ばない。
     player.arms[1].quaternion.slerp(gq.invert().multiply(qw),player.mittK);
     const gv=new THREE.Vector3();player.glove.getWorldPosition(gv);
     // 体は地面に接地したまま: グループ位置の補正は水平 (X/Z) だけに使い、Yは捨てる
     // (野手の aimK 補正と同じ方針)。Yまで吸収していた旧方式では、ミット追従の残差が
     // そのまま体の浮きになり、高めの球ほど捕手が浮いた (実測: 真ん中で group Y
     // +.058、高め +.139、最上段 +.183、極端な高め +.242 world = 0.58H。低めは
     // 逆に沈んだ)。高さ方向は腕の向き (上の slerp) だけで届かせる。到達点の
     // 高さは pitchCatchPoint 側で腕のリーチ内に収めてある。
     const mittDelta=Bv.clone().sub(gv);mittDelta.y=0;
     player.group.position.addScaledVector(mittDelta,player.mittK);
    }
   }
  }
 }
 const batter=players[9],side=G.batterSides?G.batterSides[G.top?0:1]:'right';
 // 打者は実物比率のバッターボックス中心に立つ。2D盤面の打者位置 (219/261,370) は盤面用に
 // 誇張された置き方なので、3Dではボックス中心 (x=±BOX_CX3D, z=BOX_CZ3D) へ置く。
 batter.group.position.set((side==='right'?-1:1)*BOX_CX3D,Math.sin(now*.004)*.012,BOX_CZ3D);
 const batterMat=bt===0?r3d.materials.red:r3d.materials.blue;if(batter.jersey!==batterMat){batter.jersey=batterMat;batter.group.children[0].material=batterMat;batter.arms.forEach(a=>a.children[0].material=batterMat)}
 // スイング: グリップ(肩の高さ・頭の後ろ)を支点に、真横に寝かせた構えから後ろ→体の前→フォローへ
 // 5/8回転(225°)。smoothstep の緩急で、投手方向を向くゾーン通過あたりが最速になる。
 const swingAge=now-G.swingT,mirror=side==='right'?1:-1;
 const sp=(G.swingT>0&&swingAge<370)?cl(swingAge/230,0,1):0,ease=sp*sp*(3-2*sp);
 batter.group.visible=!(G.mv&&G.mv.moves.some(m=>m.a===0));
 // 体は横向きの構え: 右打者は胸が一塁側(+X)、左打者は三塁側(-X)を向き、投手側の肩を投手へ向ける。
 // (従来は rotation.y≈0 で捕手のほうを向いた正面立ちになっていた)
 // スイングに合わせて体も投手方向へ少し回る。
 batter.group.rotation.y=mirror*(Math.PI/2+ease*.55);
 if(batter.bat){
  batter.bat.position.set(-.14*mirror,.72,.1); // グリップは固定。打者左右でグリップごと鏡像
  // バレルの向き(ワールド): 構えは捕手側・体の後ろへ寝かせ、体の前(塁側)→投手方向へ 5/8回転(225°)する。
  // 符号が逆だとバレルが背中側を回って体をすり抜ける。
  const worldA=-mirror*.6+mirror*ease*Math.PI*1.25;
  batter.bat.rotation.set(-.06,worldA-batter.group.rotation.y,0);
 }
 // 腕は両手がグリップに集まって見える角度付け(ローカル座標で計算)。
 // 前腕(投手側の肩)は体を横切ってグリップへ真横に伸ばし、後ろ腕は肩口からグリップへ向けて起こす。
 // どちらの腕の線分もグリップ付近を通る。
 const front=mirror===1?1:0,rear=1-front;
 batter.arms[front].rotation.set(-.25,mirror*.3,-mirror*1.5);
 batter.arms[rear].rotation.set(-1.9,0,mirror*.2);
 // 球審の更新 (3D表示専用): 立ち位置は Taiyo 指示により捕手の真後ろ (本塁の中心線上、
 // 横ずれなし。実物のスロットは採用しない)。足元は構えた捕手 (z≈.40) の少し後ろ。
 // 姿勢は捕手のような深いスクワットにしない: 脚は軽く膝を曲げるだけ+ヒール・トウで
 // 片足を少し前へ出し、上体を腰から前へ倒して目の高さを約0.75H (頭中心の world y ≒ .315)
 // まで下げる。打球が飛んだら構えを解いて立つ。
 if(r3d.umpire){
  const ump=r3d.umpire;
  const uw=toWorld(240,395); // x=本塁中心線の真上、z は捕手の真後ろ
  ump.group.position.set(uw.x,0,uw.z);
  ump.group.rotation.y=fieldPlayerFacing({x:uw.x,z:uw.z},{x:0,z:-2.99});
  const want=(G.pitch||G.phase==='aim'||G.phase==='ready')&&!G.fl&&!G.th?1:0;
  ump.crouch+=(want-ump.crouch)*(1-Math.pow(1-.16,frN));
  const c=ump.crouch;
  ump.legs[0].rotation.x=.30*c;ump.legs[1].rotation.x=.20*c; // 膝は軽く曲げるだけ (捕手の1.2/.95と比べて浅い)
  ump.legs[0].rotation.z=-.14*c;ump.legs[1].rotation.z=.14*c; // 足幅は肩幅程度
  ump.legs[0].position.x=-(.095+.02*c);ump.legs[1].position.x=.095+.02*c;
  ump.legs[0].position.z=-.05*c;ump.legs[1].position.z=.03*c; // ヒール・トウ (片足を少し前へ)
  ump.body.position.y=.48-.05*c;ump.body.rotation.x=.52*c;   // 上体は腰から前へ倒す
  ump.head.position.y=.83-.13*c;ump.head.position.z=.10*c;   // 目の高さ ≒ 0.75H
  // 頭に付く装備 (キャップ・マスク・スロートガード) は頭と一緒に動かす
  ump.cap.position.y=.915-.13*c;ump.cap.position.z=.10*c;
  ump.brim.position.y=.885-.13*c;ump.brim.position.z=.13+.10*c;
  ump.mask.position.y=.83-.13*c;ump.mask.position.z=.125+.10*c;
  ump.guard.position.y=.70-.13*c;ump.guard.position.z=.115+.10*c;
  ump.arms[0].position.y=.68-.05*c;ump.arms[1].position.y=.68-.05*c;
  // 両腕は体の前で軽く曲げ、手を膝の上あたりに置く
  ump.arms[0].rotation.x=-.75*c;ump.arms[1].rotation.x=-.95*c;
  ump.group.position.y=0;
 }
 const runnerMat=bt===0?r3d.materials.red:r3d.materials.blue,runnerStates=fieldRunnerStates(G,now);
 r3d.runners.forEach((runner,i)=>{
  const st=runnerStates[i];runner.group.visible=!!st;if(!st)return;
  if(runner.jersey!==runnerMat){runner.jersey=runnerMat;runner.group.children[0].material=runnerMat;runner.arms.forEach(a=>a.children[0].material=runnerMat)}
  const rp=toWorld(st.x,st.y),dx=rp.x-runner.lastX,dz=rp.z-runner.lastZ,d=Math.hypot(dx,dz);
  runner.group.position.set(rp.x,0,rp.z);
  if(st.run&&d>0){runner.runPhase+=d*18;const stride=Math.sin(runner.runPhase);runner.legs[0].rotation.x=stride*.72;runner.legs[1].rotation.x=-stride*.72;runner.arms[0].rotation.x=-stride*.48;runner.arms[1].rotation.x=stride*.48;if(d>.0007)runner.group.rotation.y=Math.atan2(dx,dz)}
  else{runner.legs[0].rotation.x=0;runner.legs[1].rotation.x=0;runner.group.rotation.y=fieldPlayerFacing({x:rp.x,z:rp.z},{x:home.x,z:home.z})}
  runner.lastX=rp.x;runner.lastZ=rp.z;
 });
 // 捕球の瞬間、ボールはグラブに収まって消える (体の中心や地面に残さない)。
 // ジャンピングキャッチはボールがグラブに届く高さ (飛行の94%) で収める。
 let ballVisible=!!(ball&&ball.visible);
 if(ballVisible&&G.fl&&!G.th&&(G.fl.out||G.fl.finePlay||G.fl.groundPlay)){
  const fp4=(now-G.fl.t0)/G.fl.dur;
  if(fp4>=1||(fieldCatchPlayType(G.fl)==='jump'&&fp4>=.94))ballVisible=false;
 }
 r3d.ballRoot.visible=ballVisible;r3d.shadow.visible=ballVisible;
 // 板 ON の投球 (fpRay) では、3D ボールの見かけの大きさを板のボールに合わせる
 // (fieldBallState が毎フレーム計算した fpScale)。それ以外は従来どおり実寸 1。
 r3d.ballRoot.scale.setScalar(ball&&ball.fpRay&&ball.fpScale?ball.fpScale:1);
 if(ball){const p=toWorld(ball.x,ball.y,ball.carry?15:ball.h);r3d.ballRoot.position.set(p.x,p.y,p.z);r3d.shadow.position.set(p.x,fieldGroundY3D(ball.x,ball.y)+.004,p.z);const radius=1+cl(ball.h/120,0,.35);r3d.shadow.scale.set(radius,radius,1);r3d.shadow.material.opacity=.32/(1+Math.max(0,ball.h)*.025)}
 // ゾーン板 (実験機能②): トグル ON のときだけ板を立て、表面にパネル版軌道を描く。
 // 板の中心は投手の左右に合わせた位置 (zboardCurrentPos) へ毎フレーム置く
 // (始点と手の一致のため。投手の左右は半イニング内では固定)。
 if(r3d.zoneBoard){
  // 板は一人称が有効な間だけ出す。打球中 (fpSuspend) は板ごと消して打球を見る。
  r3d.zoneBoard.group.visible=fpActive;
  if(fpActive){const zp=zboardCurrentPos();r3d.zoneBoard.group.position.set(zp.x,zp.y,zp.z);drawZoneBoard()}
 }
 renderer.render(scene,camera);
}

