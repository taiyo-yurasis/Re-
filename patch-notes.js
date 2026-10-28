/* patch-notes.js — 公開済みアップデート履歴 */
(() => {
  const currentVersion = '1.6.3';
  const updates = [
    {
      version: '1.6.3',
      title: 'フィールドが表示されないことがある問題を修正',
      changes: [
        'タブを切り替えたあとなどに、フィールドの芝や土が表示されなくなることがある問題を修正しました。'
      ]
    },
    {
      version: '1.6.2',
      title: '観戦中の表示の乱れを修正',
      changes: [
        '観戦中に画面がちらつくことがある問題を修正しました。'
      ]
    },
    {
      version: '1.6.1',
      title: 'オンライン観戦モードを追加',
      changes: [
        'オンライン対戦を観戦できるようになりました。合言葉を入れて「観戦する」を押すと、試合の途中からでも見られます。',
        '対戦中の画面に合言葉と観戦人数が表示されるようになりました。プレイ中の人に合言葉を教えてもらえば、その場で観戦に入れます。'
      ]
    },
    {
      version: '1.6.0',
      title: '満塁時のゴロと野手の守備範囲を見直し',
      changes: [
        '満塁でゴロを打ったときの処理が3パターンになりました。全員進塁して本塁でアウト／三塁走者が生還して打者が一塁アウト／本塁から一塁へのダブルプレー、のいずれかになります。',
        '深いフライを内野手が外野まで追いかけることがなくなり、外野手が捕球するようになりました。'
      ]
    },
    {
      version: '1.5.1',
      title: '打撃練習で打球がフィールドを飛ぶように',
      changes: [
        '打撃練習で、打ったボールが試合と同じようにフィールド上を飛ぶようになりました。着地点は判定に使った打球データから計算しているので、角度や推定飛距離の感覚がつかみやすくなります。'
      ]
    },
    {
      version: '1.5.0',
      title: 'CPUが対戦相手を読むようになりました',
      changes: [
        'CPU投手が打者の傾向を読むようになりました。空振りの多い球種を増やしたり、打たれている球種を減らしたり、ボール球をよく振る打者には決め球を多めに投げます。',
        'CPU打者も投手の傾向を読むようになりました。よく投げる球種やコースは待ち構えて打ってきますが、あまり投げない球は意表を突かれます。配球を散らすと読みを外せます。',
        '読みが効くのはCPU Lv3（軽め）と Lv4（フル）で、試合が進んでサンプルが貯まってから少しずつ効いてきます。Lv1・Lv2 は今まで通りです。'
      ]
    },
    {
      version: '1.4.1',
      title: 'CPUが超スローボールを投げるように',
      changes: [
        'CPUの配球に超スローボールを追加しました（全カウントで1%）。実データではほとんど投げられない球種ですが、ゲーム用にたまに出てくるようにしています。'
      ]
    },
    {
      version: '1.4.0',
      title: '新球種「カットボール」「超スローボール」を追加',
      changes: [
        '新球種「カットボール」と「超スローボール」を追加しました。',
        'この2球種はプロトタイプで、強化、弱体化の可能性があります',
        '内角・外角のベストタイミングを25msから40msに調整しました。'
      ]
    },
    {
      version: '1.3.2',
      title: '打撃練習で打者の左右を選べるように',
      changes: [
        '打撃練習の設定に「打者」の選択（右のみ／左のみ／左右ランダム）を追加しました。試合設定の打者設定と連動します。'
      ]
    },
    {
      version: '1.3.1',
      title: 'エラーとファインプレーの確率を調整',
      changes: [
        '野手のエラーの確率を10%から5%に下げました。',
        'ヒット性の当たりがファインプレーで取られる確率も10%から5%に下げました。'
      ]
    },
    {
      version: '1.3.0',
      title: 'CPU投手の配球をMLBの実データに基づいて再現',
      changes: [
        'CPU投手の配球を、MLBの全投球データ（Statcast 2025年シーズン）に基づいて作り直しました。',
        'カウントによって球種の割合が変わります。追い込まれるとストレート中心、追い込むと決め球やゾーン外への誘い球が増えます。',
        '空振りした球種をもう一度投げてくるなど、実際の配球の組み立ても再現。難易度が高いほどデータに忠実になります。'
      ]
    },
    {
      version: '1.2.7',
      title: 'ダブルプレー時の進塁とCPU投手の配球を調整',
      changes: [
        'ダブルプレーが成立したとき、二塁・三塁の走者が必ず次の塁に進むようになりました（イニングが終わる併殺は除く）。',
        '強いCPU投手が、ストライクゾーンの際を狙って投げてくるようになりました。難易度が高いほど際への投球が増えます。'
      ]
    },
    {
      version: '1.2.6',
      title: 'ストライクゾーンの判定を微調整',
      changes: [
        'ストライクの判定範囲を、ゾーンの黄色い枠線の外側の縁まで広げました。枠に中心がかかっているボールはストライクになります。'
      ]
    },
    {
      version: '1.2.5',
      title: '深いフライの表示を修正',
      changes: [
        '深いフライを外野手が捕球するとき、ボールがフェンスを越えて飛んでいくように見える問題を修正しました。'
      ]
    },
    {
      version: '1.2.4',
      title: '守備の連携プレーを改善',
      changes: [
        'ダブルプレーのとき、二塁にカバーが入るようになりました。セカンドやショートが二塁の近くで捕球した場合は、捕球した野手が自分で二塁を踏んでから一塁へ送球します。',
        '外野からの送球の中継プレーを、打球方向に合わせた形に見直しました。本塁への送球はセカンドやショートが中継に入り（入らない場合は直接のバックホーム）、もう一方の二遊間が二塁をカバーします。'
      ]
    },
    {
      version: '1.2.3',
      title: '細かい不具合の修正',
      changes: [
        '四球のときに、前の投球の詳細メッセージが残ってしまう問題を修正しました。',
        'オンライン対戦の通信データ検証を厳しくしました（異常なデータを受け取りにくくなります）。'
      ]
    },
    {
      version: '1.2.2',
      title: '精査で見つけた不具合の修正',
      changes: [
        'オンライン対戦で、ヒット時の外野手の動きがホストとゲストで食い違う問題を修正しました。',
        'タイブレーク無制限のオンライン対戦で、延長が長引くとゲスト側の画面が止まる可能性があった問題を修正しました。'
      ]
    },
    {
      version: '1.2.1',
      title: 'タイブレーク追加とホーム画面の整理',
      changes: [
        'タイブレークを追加しました。同点のまま規定回を終えた場合、ノーアウト二塁から始まる延長戦に入ります（MLB方式）。',
        'タイブレークは設定で「なし / 1イニング / 無制限（決着まで）」から選べます。デフォルトは「なし」で、その場合は従来どおり試合ptで勝敗が決まります。',
        'ホーム画面を整理し、ボタンは CPU戦・オンライン・打撃練習・パッチノート・ルール説明だけになりました。各設定はモードごとの画面に移しました。'
      ]
    },
    {
      version: '1.2.0',
      title: '打球の数字をMLBの実測に較正',
      changes: [
        '打球速度と飛距離のスケールを現実の野球に合わせて見直しました。平均打球速度は約142km/h、フェンスまでの距離は110mが目安です。',
        '速い打球ほど・高い打球ほど空気抵抗で伸びなくなり、上がりすぎた打球が不自然に飛ぶことが減りました。',
        '深いフライがフェンス手前で捕球されるようになり、フライの結果がより現実らしくなりました。',
        '上下のズレが打球速度に与える影響を抑え、角度をつけた打球でも速度が落ちにくくなりました。'
      ]
    },
    {
      version: '1.1.3',
      title: '打撃まわりの細かな不整合を修正',
      changes: [
        'オンライン対戦で、ゲストの投球だけ球速がランダムにブレる問題を修正しました。',
        'タイミング表示とCPU打者のタイミングが、コース別の理想タイミングと一致するようになりました。',
        'ゴロのときに推定飛距離が0mと表示される問題を修正しました。'
      ]
    },
    {
      version: '1.1.2',
      title: 'フライの飛距離を打球計算と連動',
      changes: [
        'フライアウトの飛距離が打球の物理計算と連動するようになり、浅いフライで不自然に犠牲フライが発生することが減りました。'
      ]
    },
    {
      version: '1.1.1',
      title: '守備の不具合を修正',
      changes: [
        '一塁手がゴロを捕球して一塁を離れた際、投手が一塁をカバーするようにしました。'
      ]
    },
    {
      version: '1.1.0',
      title: '打撃システムを物理モデルに刷新',
      changes: [
        'ミート度・打球角度・打球速度・飛距離をもとに打球結果を計算する新しい打撃システムを導入しました。',
        '球種ごとの打撃補正を調整し、カーブとツーシームの強さを見直しました。'
      ]
    },
    {
      version: '1.0.15',
      title: 'UIを更新',
      changes: [
        'コードの修正をしました。'
      ]
    },
    {
      version: '1.0.14',
      title: 'CPU難易度と共通打撃判定を追加',
      changes: [
        'CPUの投球・打撃に4段階の難易度設定を追加しました。',
        'CPUの打撃結果をプレイヤーと共通の batResult() で判定するようにしました。'
      ]
    },
    {
      version: '1.0.13',
      title: '試合結果の処理を整理',
      changes: [
        'ボール、ストライク、ファウル、ゴロ、フライの処理を専用関数に分割しました。',
        'result() は打撃練習の分岐とイベント別処理の振り分けを担当します。',
        '走者処理と画面操作の回帰テストを追加しました。'
      ]
    },
    {
      version: '1.0.12',
      title: 'ゴロアウト・フライの走者処理を共通化',
      changes: [
        'ゴロアウト時の走者進塁と併殺時の塁状況を settle() 経由で計算するようにしました。',
        '2アウトからのゴロ・フライでは、走者が進塁しても第3アウトによる得点を認めないようにしました。',
        '犠牲フライと二塁走者のタッチアップを settle() に統合し、走者配置と走塁アニメーションを一括で反映します。'
      ]
    },
    {
      version: '1.0.11',
      title: '走者処理と守備位置決定を整理',
      changes: [
        '進塁・押し出し・四球の共通処理を runners.js の純関数 settle() にまとめました。',
        '打球生成時に守備位置を確定し、描画側が守備位置を変更しないようにしました。',
        '外野への打球の最低飛距離補正を共通化し、重複処理を削除しました。',
        'hit() の不要な走者情報の詰め替えと変数名の衝突を整理しました。'
      ]
    },
    {
      version: '1.0.10',
      title: 'ツーシームの遅振り補正を調整',
      changes: [
        'ツーシームの遅振りペナルティを0.50に設定し、遅れたスイングでミート補正が強くなりすぎないようにしました。'
      ]
    },
    {
      version: '1.0.9',
      title: 'オンライン対戦と操作の安定性を改善',
      changes: [
        'オンライン接続のタイムアウトと、キャンセル後の接続処理を改善しました。',
        '同期データの検証を強化し、不正な投球要求を受け付けないようにしました。',
        '入力欄などを操作中の誤発動と、キー長押しによる連続操作を防ぎました。',
        '描画・ゲーム更新でエラーが起きた場合に、原因をコンソールへ記録し、ループが停止しにくいようにしました。',
        '投球・打撃そのものに制限時間は追加していません。'
      ]
    },
    {
      version: '1.0.8',
      title: '投球の狙いとブレを修正',
      changes: [
        'カーソル中心を、ブレがない場合の着弾予定位置として扱うようにしました。',
        '狙いのブレは投球確定時に一度だけ決まり、投球中に着弾位置が変わらないようにしました。',
        '投球前のプレビューにブレを反映せず、投球中の球種変更を無効化しました。'
      ]
    },
    {
      version: '1.0.7',
      title: '打撃補正と変化球の軌道を調整',
      changes: [
        'カーブのミートボーナスを強化し、遅振りペナルティを維持しました。',
        'ツーシームのミートボーナスを強化し、遅振りペナルティをなくしました。',
        'スライダーの到達時間、カーブの高さ別の軌道、ツーシームの横変化を調整しました。'
      ]
    },
    {
      version: '1.0.6',
      title: '送球・進塁・得点処理を調整',
      changes: [
        '走者配置と打球結果に応じて送球先を決めるようにしました。',
        '走者なし・三塁走者のみの二塁打では、二塁または三塁へ50:50で送球先を選びます。',
        '内野安打・エラー相当の既存プレーでは一塁への送球演出を行うようにしました。',
        '得点が入ったプレーで、実際の得点数に応じて「+x点!」を表示するようにしました。',
        '2アウトからのフライでは打球時点で走者が進塁を開始し、第3アウト後に追加進塁・得点が発生しないようにしました。'
      ]
    },
    {
      version: '1.0.5',
      title: '打撃判定を調整',
      changes: [
        'カーブに、着地点とスイング時のボール位置のうち近い方を基準にする判定方式を追加しました。',
        'カーブとツーシームに、タイミングが合った際のミート補正と、遅れた場合の補正減少を追加しました。',
        '打撃練習で、判定に使った基準点やミート補正・遅れによる減少率を確認できるようにしました。'
      ]
    },
    {
      version: '1.0.4',
      title: 'SBOカウントの表示を修正',
      changes: [
        'ボール・ストライク・アウトの表示位置を揃えました。'
      ]
    },
    {
      version: '1.0.3',
      title: 'モードの整理',
      changes: [
        'オフライン対人戦モードを削除しました。',
        'CPU戦・オンライン・打撃練習の3つのモードに整理しました。'
      ]
    },
    {
      version: '1.0.2',
      title: '打撃練習の描画を修正',
      changes: [
        '一部の環境で、古い打球の位置が画面に残る問題を修正しました。'
      ]
    },
    {
      version: '1.0.1',
      title: '試合進行を修正',
      changes: [
        '規定回終了後に試合が正しく終了しない問題を修正しました。'
      ]
    },
    {
      version: '1.0.0',
      title: 'バージョン表示を追加',
      changes: [
        'ホーム画面で現在のゲームバージョンを確認できるようになりました。'
      ]
    },
    {
      initial: true,
      title: '初期アップデート',
      changes: [
        '先攻・後攻に応じたCPU戦の操作と試合進行を修正しました。',
        '打球方向をスイングの判定角度に連動させ、打撃結果の表示を改善しました。',
        '走者の進塁やアウト時の得点処理を修正しました。',
        '投球の回転表現や球種の表示を調整しました。',
        'iPadなどのタッチ操作でカーソルを動かしやすくしました。',
        '打者の左右を打席ごとにランダムで切り替える設定を追加しました。',
        'オンライン対戦の接続・同期処理を改善しました。'
      ]
    }
  ];

  const openButton = document.getElementById('patch-notes-button');
  const overlay = document.getElementById('patch-ov');
  const closeButton = document.getElementById('patch-close');
  const list = document.getElementById('patch-list');
  const versionLabel = document.getElementById('current-version');
  const badge = document.getElementById('patch-notes-badge');
  const rulesButton = document.getElementById('rules-button');
  const rulesOverlay = document.getElementById('rules-ov');
  const rulesCloseButton = document.getElementById('rules-close');
  const readVersionKey = 'yakyu-stadium-patch-notes-read-version';

  if (!openButton || !overlay || !closeButton || !list || !versionLabel) return;

  function syncBadge() {
    let readVersion = '';
    try { readVersion = localStorage.getItem(readVersionKey) || ''; } catch (_) {}
    if (badge) badge.hidden = readVersion === currentVersion;
  }
  function markRead() {
    try { localStorage.setItem(readVersionKey, currentVersion); } catch (_) {}
    syncBadge();
  }
  syncBadge();
  versionLabel.textContent = 'Ver.' + currentVersion;

  updates.forEach((update) => {
    const article = document.createElement('article');
    article.className = 'patch-entry' + (update.initial ? ' initial' : '');

    const heading = document.createElement('h3');
    heading.textContent = update.initial ? update.title : 'Ver.' + update.version;
    article.appendChild(heading);

    if (update.title && !update.initial && update.version !== '1.0.0') {
      const subtitle = document.createElement('h4');
      subtitle.textContent = update.title;
      article.appendChild(subtitle);
    }

    const items = document.createElement('ul');
    update.changes.forEach((change) => {
      const item = document.createElement('li');
      item.textContent = change;
      items.appendChild(item);
    });
    article.appendChild(items);
    list.appendChild(article);
  });

  let previousFocus = null;

  function openModal() {
    markRead();
    previousFocus = document.activeElement;
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeButton.focus();
  }

  function closeModal() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  openButton.addEventListener('click', openModal);
  closeButton.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (overlay.classList.contains('open')) closeModal();
    if (rulesOverlay && rulesOverlay.classList.contains('open')) closeRulesModal();
  });

  let previousRulesFocus = null;
  function openRulesModal() {
    if (!rulesOverlay || !rulesCloseButton) return;
    previousRulesFocus = document.activeElement;
    rulesOverlay.classList.add('open');
    rulesOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    rulesCloseButton.focus();
  }
  function closeRulesModal() {
    if (!rulesOverlay) return;
    rulesOverlay.classList.remove('open');
    rulesOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (previousRulesFocus && typeof previousRulesFocus.focus === 'function') previousRulesFocus.focus();
  }
  if (rulesButton && rulesOverlay && rulesCloseButton) {
    rulesButton.addEventListener('click', openRulesModal);
    rulesCloseButton.addEventListener('click', closeRulesModal);
    rulesOverlay.addEventListener('click', (event) => {
      if (event.target === rulesOverlay) closeRulesModal();
    });
  }
})();
