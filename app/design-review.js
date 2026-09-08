const leagueOptions = [
  ['左から伸びる', 'line-left'],
  ['右から伸びる', 'line-right'],
  ['中央から広がる', 'line-center'],
  ['下辺をなぞる', 'line-bottom'],
  ['上辺をなぞる', 'line-top'],
  ['中央が太くなる', 'line-grow'],
  ['短いアクセント', 'line-short'],
  ['矢印までつながる', 'line-arrow'],
  ['段階的に表示', 'line-step'],
  ['ゆっくりフェード', 'line-fade']
];

const navigationOptions = [
  ['下線', 'nav-underline'],
  ['背景ピル', 'nav-pill'],
  ['アイコンリング', 'nav-ring'],
  ['上辺ライン', 'nav-topline'],
  ['下辺ブロック', 'nav-block'],
  ['縦ライン', 'nav-rail'],
  ['ドット', 'nav-dot'],
  ['アイコン塗り', 'nav-fill'],
  ['ラベル太字', 'nav-label'],
  ['小さなバッジ', 'nav-badge'],
  ['円形背景', 'nav-circle'],
  ['角丸タブ', 'nav-tab'],
  ['広い下線', 'nav-wide'],
  ['中央寄せ線', 'nav-center'],
  ['淡い面', 'nav-wash'],
  ['マゼンタ文字', 'nav-color'],
  ['アイコン拡大', 'nav-large-icon'],
  ['ラベル下線', 'nav-label-line'],
  ['二段階', 'nav-double'],
  ['静かな強調', 'nav-quiet']
];

const dateOptions = [
  ['横並びチップ', 'date-chip'],
  ['下線タブ', 'date-tabs'],
  ['大きな日付', 'date-large'],
  ['縦型カレンダー', 'date-calendar'],
  ['丸型', 'date-circle'],
  ['角型', 'date-square'],
  ['最小ラベル', 'date-minimal'],
  ['曜日を主役に', 'date-weekday'],
  ['左右矢印付き', 'date-arrows'],
  ['タイムライン', 'date-timeline'],
  ['月見出し', 'date-month'],
  ['区切り線', 'date-ruled'],
  ['縦ライン強調', 'date-rail'],
  ['淡い背景', 'date-wash'],
  ['黒白反転', 'date-contrast'],
  ['数字のみ', 'date-number'],
  ['連続カレンダー', 'date-strip'],
  ['余白広め', 'date-spacious'],
  ['コンパクト', 'date-compact'],
  ['アクセントバー', 'date-accent']
];

const dates = [
  ['9/5', '土'],
  ['9/6', '日'],
  ['9/7', '月'],
  ['9/8', '火'],
  ['9/9', '水']
];

function createLeagueOption([title, variant], index) {
  const chosen = index === 0;
  return `<article class="review-card league-card${chosen ? ' chosen' : ''}">
    <div class="card-caption"><span>案 ${String(index + 1).padStart(2, '0')}</span><strong>${title}</strong>${chosen ? '<em class="choice-tag">採用</em>' : ''}</div>
    <div class="league-preview ${variant}">
      <button class="league-row${chosen ? ' is-selected' : ''}" type="button" aria-pressed="${chosen}"><span>Jリーグ</span><span class="league-arrow" aria-hidden="true">→</span></button>
    </div>
  </article>`;
}

function createNavigationOption([title, variant], index) {
  const chosen = index === 1;
  return `<article class="review-card navigation-card${chosen ? ' chosen' : ''}">
    <div class="card-caption"><span>案 ${String(index + 1).padStart(2, '0')}</span><strong>${title}</strong>${chosen ? '<em class="choice-tag">採用</em>' : ''}</div>
    <div class="navigation-preview ${variant}">
      <nav class="review-bottom-nav" aria-label="下部メニュー案 ${index + 1}">
        <button class="nav-item is-selected" type="button" aria-pressed="true"><span class="nav-icon" aria-hidden="true">◒</span><span>試合</span></button>
        <button class="nav-item" type="button" aria-pressed="false"><span class="nav-icon" aria-hidden="true">▦</span><span>順位</span></button>
        <button class="nav-item" type="button" aria-pressed="false"><span class="nav-icon" aria-hidden="true">↻</span><span>更新</span></button>
      </nav>
    </div>
  </article>`;
}

function createDateOption([title, variant], index) {
  const chosen = index === 4;
  return `<article class="review-card date-card${chosen ? ' chosen' : ''}">
    <div class="card-caption"><span>案 ${String(index + 1).padStart(2, '0')}</span><strong>${title}</strong>${chosen ? '<em class="choice-tag">採用</em>' : ''}</div>
    <div class="date-preview ${variant}">
      <span class="date-month">2026年9月</span>
      <div class="date-options" role="group" aria-label="日付案 ${index + 1}">
        ${dates.map(([date, weekday], dateIndex) => `<button class="date-option${dateIndex === 1 ? ' is-selected' : ''}" type="button" aria-pressed="${dateIndex === 1}"><strong>${date}</strong><small>${weekday}</small></button>`).join('')}
      </div>
    </div>
  </article>`;
}

document.querySelector('#league-options').innerHTML = leagueOptions.map(createLeagueOption).join('');
document.querySelector('#navigation-options').innerHTML = navigationOptions.map(createNavigationOption).join('');
document.querySelector('#date-options').innerHTML = dateOptions.map(createDateOption).join('');

document.querySelectorAll('.league-row').forEach((button) => {
  button.addEventListener('click', () => {
    const selected = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(selected));
    button.classList.toggle('is-selected', selected);
  });
});

document.querySelectorAll('.review-bottom-nav').forEach((nav) => {
  nav.addEventListener('click', (event) => {
    const button = event.target.closest('.nav-item');
    if (!button) return;
    nav.querySelectorAll('.nav-item').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  });
});

document.querySelectorAll('.date-options').forEach((group) => {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('.date-option');
    if (!button) return;
    group.querySelectorAll('.date-option').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('is-selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  });
});
