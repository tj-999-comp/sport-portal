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

const scoreOptions = [
  ['勝敗見出し', 'score-result-heading'],
  ['勝者帯', 'score-winner-band'],
  ['勝者矢印', 'score-winner-arrow'],
  ['トロフィー', 'score-trophy'],
  ['WIN / LOSE', 'score-win-lose'],
  ['勝者を上段', 'score-winner-top'],
  ['勝利スタンプ', 'score-stamp'],
  ['勝敗色分け', 'score-result-color'],
  ['スコアボード式', 'score-board'],
  ['勝者を主役', 'score-winner-focus']
];

const previousScoreOptions = [
  ['横一列', 'score-inline'],
  ['左右カラム', 'score-columns'],
  ['中央スコア', 'score-center'],
  ['スコアピル', 'score-pill'],
  ['縦積みコンパクト', 'score-stacked'],
  ['勝者ラベル', 'score-winner-label'],
  ['勝敗バッジ', 'score-result-badge'],
  ['勝者マーク', 'score-winner-mark'],
  ['勝敗カラム', 'score-result-columns'],
  ['勝者ハイライト', 'score-winner-highlight']
];

const motionOptions = [
  ['中央スナップ', 'motion-snap', '止まる位置を日付の中央に固定'],
  ['1日ロック', 'motion-lock', '入力の勢いを受けても1日だけ進む'],
  ['しきい値付き', 'motion-threshold', '小さな揺れでは日付を切り替えない'],
  ['即時ページ送り', 'motion-direct', '入力を検知した瞬間に次の日へ'],
  ['日付自由／試合1日', 'motion-split', '日付は連続、試合一覧は1日ずつ']
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

function createScoreOption([title, variant], index, label = '案') {
  return `<article class="review-card score-card">
    <div class="card-caption"><span>${label} ${String(index + 1).padStart(2, '0')}</span><strong>${title}</strong></div>
    <div class="score-preview ${variant}">
      <p class="score-meta">18:00 · 第29節</p>
      <p class="score-victory-note">浦和の勝利</p>
      <div class="score-match">
        <div class="score-team home winner">
          <span class="score-marker" aria-hidden="true">✓</span>
          <span class="score-result-label">勝者</span>
          <strong>浦和</strong><b>2</b>
        </div>
        <span class="score-divider" aria-hidden="true">—</span>
        <div class="score-team away loser">
          <span class="score-result-label">敗者</span>
          <span class="score-marker" aria-hidden="true">—</span>
          <b>1</b><strong>鹿島</strong>
        </div>
      </div>
    </div>
  </article>`;
}

function createMotionOption([title, variant, description], index) {
  const motionDates = ['9/5', '9/6', '9/7', '9/8', '9/9', '9/10', '9/11', '9/12', '9/13'];
  const pages = motionDates.map((date, dateIndex) => `<article class="motion-page" data-motion-page="${dateIndex}">
    <div class="motion-page-head"><span>試合日</span><strong>${date}</strong></div>
    <div class="motion-match-row"><span>${dateIndex % 2 ? '浦和' : '鹿島'}</span><b>${dateIndex % 3 === 0 ? '2 — 1' : '— — —'}</b><span>${dateIndex % 2 ? '神戸' : '広島'}</span></div>
    <div class="motion-match-row"><span>${dateIndex % 2 ? '川崎' : '柏'}</span><b>${dateIndex % 2 ? '1 — 0' : '— — —'}</b><span>${dateIndex % 2 ? 'G大阪' : '新潟'}</span></div>
  </article>`).join('');
  const dateRail = motionDates.map((date, dateIndex) => `<button class="motion-date${dateIndex === 1 ? ' is-active' : ''}" type="button" data-motion-date="${dateIndex}" aria-label="${date}を表示"><span>${date}</span></button>`).join('');
  return `<article class="review-card motion-card" data-motion-variant="${variant}">
    <div class="card-caption"><span>案 ${String(index + 1).padStart(2, '0')}</span><strong>${title}</strong>${index === 4 ? '<em class="choice-tag">本命</em>' : ''}</div>
    <div class="motion-preview ${variant}">
      <div class="motion-date-rail" data-motion-date-rail>${dateRail}</div>
      <div class="motion-window" data-motion-window>
        <div class="motion-track" data-motion-track>${pages}</div>
      </div>
      <div class="motion-readout"><span data-motion-description>${description}</span><output data-motion-status>2 / ${motionDates.length}</output></div>
      <div class="motion-controls">
        <button type="button" data-motion-prev aria-label="前の日へ">←</button>
        <span>横入力デモ</span>
        <button type="button" data-motion-next aria-label="次の日へ">→</button>
      </div>
      <p class="motion-hint">左右にドラッグ / ホイール / 矢印</p>
    </div>
  </article>`;
}

document.querySelector('#league-options').innerHTML = leagueOptions.map(createLeagueOption).join('');
document.querySelector('#navigation-options').innerHTML = navigationOptions.map(createNavigationOption).join('');
document.querySelector('#date-options').innerHTML = dateOptions.map(createDateOption).join('');
document.querySelector('#score-options').innerHTML = scoreOptions.map((option, index) => createScoreOption(option, index)).join('');
document.querySelector('#score-history-options').innerHTML = previousScoreOptions.map((option, index) => createScoreOption(option, index, '旧案')).join('');
document.querySelector('#motion-options').innerHTML = motionOptions.map(createMotionOption).join('');

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

function setMotionIndex(card, nextIndex, behavior = 'smooth') {
  const track = card.querySelector('[data-motion-track]');
  const pages = track.querySelectorAll('.motion-page');
  const index = Math.min(pages.length - 1, Math.max(0, nextIndex));
  card.dataset.motionIndex = String(index);
  track.style.setProperty('--motion-offset', `${index * -100}%`);
  track.style.setProperty('--motion-drag', '0px');
  card.querySelector('[data-motion-status]').textContent = `${index + 1} / ${pages.length}`;
  card.querySelectorAll('.motion-date').forEach((date) => date.classList.toggle('is-active', Number(date.dataset.motionDate) === index));
  if (behavior === 'auto') track.classList.add('is-immediate');
  else track.classList.remove('is-immediate');
  window.clearTimeout(card.motionImmediateTimer);
  if (behavior === 'auto') card.motionImmediateTimer = window.setTimeout(() => track.classList.remove('is-immediate'), 30);
}

function setupMotionCard(card) {
  const preview = card.querySelector('.motion-preview');
  const track = card.querySelector('[data-motion-track]');
  let pointerStart = null;
  let pointerDelta = 0;
  let lockedUntil = 0;
  const variant = card.dataset.motionVariant;
  card.dataset.motionIndex = '1';

  const moveByInput = (direction, behavior = 'smooth') => {
    if (Date.now() < lockedUntil) return;
    const current = Number(card.dataset.motionIndex || 1);
    setMotionIndex(card, current + direction, behavior);
    if (variant === 'motion-lock' || variant === 'motion-split') lockedUntil = Date.now() + 420;
  };

  preview.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button, [data-motion-date-rail]')) return;
    pointerStart = event.clientX;
    pointerDelta = 0;
    preview.setPointerCapture(event.pointerId);
    track.classList.add('is-dragging');
  });
  preview.addEventListener('pointermove', (event) => {
    if (pointerStart === null) return;
    pointerDelta = event.clientX - pointerStart;
    if (variant !== 'motion-direct') track.style.setProperty('--motion-drag', `${Math.max(-72, Math.min(72, pointerDelta))}px`);
  });
  const finishPointer = () => {
    if (pointerStart === null) return;
    const threshold = variant === 'motion-threshold' ? 42 : 24;
    const direction = Math.abs(pointerDelta) >= threshold ? (pointerDelta < 0 ? 1 : -1) : 0;
    track.classList.remove('is-dragging');
    track.style.setProperty('--motion-drag', '0px');
    pointerStart = null;
    pointerDelta = 0;
    if (direction) moveByInput(direction);
  };
  preview.addEventListener('pointerup', finishPointer);
  preview.addEventListener('pointercancel', finishPointer);
  preview.addEventListener('wheel', (event) => {
    if (event.target.closest('[data-motion-date-rail]')) return;
    const horizontalDelta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
    if (!horizontalDelta) return;
    event.preventDefault();
    moveByInput(horizontalDelta > 0 ? 1 : -1, variant === 'motion-direct' ? 'auto' : 'smooth');
  }, { passive: false });
  card.querySelector('[data-motion-prev]').addEventListener('click', () => moveByInput(-1, variant === 'motion-direct' ? 'auto' : 'smooth'));
  card.querySelector('[data-motion-next]').addEventListener('click', () => moveByInput(1, variant === 'motion-direct' ? 'auto' : 'smooth'));
  card.querySelector('[data-motion-date-rail]').addEventListener('click', (event) => {
    const date = event.target.closest('[data-motion-date]');
    if (date) setMotionIndex(card, Number(date.dataset.motionDate), 'smooth');
  });
}

document.querySelectorAll('.motion-card').forEach(setupMotionCard);
