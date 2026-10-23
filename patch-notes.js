/* patch-notes.js — 公開済みアップデート履歴 */
(() => {
  const currentVersion = '1.0.14';
  const updates = [
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

  if (!openButton || !overlay || !closeButton || !list || !versionLabel) return;

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
    if (event.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });
})();
