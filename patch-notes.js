/* patch-notes.js — 公開済みアップデート履歴 */
(() => {
  const currentVersion = '1.0.4';
  const updates = [
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
