const LABELS = { premier: 'B.PREMIER', one: 'B.ONE', next: 'B.NEXT' };
const state = { league: 'premier', dataByLeague: new Map(), data: null, dates: [], selectedDates: {}, selectedDate: null, tab: 'standings', updating: false, token: 0 };
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '—').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
const dateLabel = (date) => { if (!date) return '2026-27シーズン'; const [year, month, day] = date.split('-'); return `${year}年${Number(month)}月${Number(day)}日`; };
const weekday = (date) => new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(`${date}T00:00:00+09:00`));
const updateText = (value) => value ? new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(value)) : '';

let dateNavScrollTimer = null;
let matchWheelUnlockTimer = null;
let matchWheelResetTimer = null;
let matchWheelLocked = false;
let matchWheelDelta = 0;
let matchSwipeUnlockTimer = null;
let matchSwipeLocked = false;
let matchPointer = null;
let matchTouch = null;
const matchSwipeThreshold = 72;

function status(update = {}) {
  const failed = update.status === 'failure';
  $('#status-indicator').className = `status-indicator ${update.status || ''}`;
  $('#status-label').textContent = failed ? '更新失敗' : update.status === 'success' ? '更新済み' : '読み込み中';
  $('#status-detail').textContent = failed ? (update.message || '前回正常に取得したデータを表示しています') : `${LABELS[state.league]}のデータを表示しています`;
  $('#updated-at').textContent = updateText(update.at);
}

function updateLeagueTabSelection(league) {
  document.querySelectorAll('.league-tab').forEach((button) => {
    const selected = button.dataset.league === league;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  $('#league-panel').setAttribute('aria-label', `${LABELS[league]}の試合日程・結果`);
  document.title = `スポーツポータル | 2026-27 ${LABELS[league]}`;
}

function updateScrollState(element) { element.classList.toggle('is-scrollable', element.scrollWidth > element.clientWidth + 1); }
function updateBScrollSurfaces() { document.querySelectorAll('#date-nav, #match-days, .b-modal-tabs').forEach(updateScrollState); }
function updatePageScrollState() { document.documentElement.classList.toggle('page-is-scrollable', document.documentElement.scrollHeight > document.documentElement.clientHeight + 1); }

function updateMatchDaysHeight(date = state.selectedDate) {
  const root = $('#match-days');
  const target = date ? root.querySelector(`[data-date="${CSS.escape(date)}"]`) : null;
  if (!target) { root.style.removeProperty('height'); requestAnimationFrame(updatePageScrollState); return; }
  root.style.height = 'auto';
  root.style.height = `${target.offsetHeight}px`;
  requestAnimationFrame(updatePageScrollState);
}

function settleDateNavSelection() {
  const nav = $('#date-nav');
  if (!nav.classList.contains('is-scrollable') || !nav.clientWidth) return;
  const navRect = nav.getBoundingClientRect();
  const center = navRect.left + navRect.width / 2;
  const closest = [...nav.querySelectorAll('.date-chip')].reduce((current, chip) => {
    const rect = chip.getBoundingClientRect();
    const distance = Math.abs(rect.left + rect.width / 2 - center);
    return !current || distance < current.distance ? { chip, distance } : current;
  }, null)?.chip;
  if (!closest) return;
  const rect = closest.getBoundingClientRect();
  const targetLeft = nav.scrollLeft + rect.left - navRect.left - (nav.clientWidth - rect.width) / 2;
  if (closest.dataset.date !== state.selectedDate) selectDate(closest.dataset.date, 'auto', false);
  nav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'auto' });
}

function syncDateSelectionFromDateNav() { window.clearTimeout(dateNavScrollTimer); dateNavScrollTimer = window.setTimeout(settleDateNavSelection, 120); }

function scrollToDate(date, behavior = 'smooth', centerDate = true) {
  const root = $('#match-days');
  const target = root.querySelector(`[data-date="${CSS.escape(date)}"]`);
  if (!target) return;
  selectDate(date, behavior, false, centerDate);
  root.scrollTo({ left: Math.max(0, target.offsetLeft - root.offsetLeft), behavior });
}

function selectDate(date, behavior = 'smooth', syncCarousel = true, centerDate = true) {
  if (!date) return;
  state.selectedDate = date;
  state.selectedDates[state.league] = date;
  $('#selected-date').textContent = dateLabel(date);
  const activeButton = [...$('#date-nav').querySelectorAll('.date-chip')].find((button) => button.dataset.date === date);
  $('#date-nav').querySelectorAll('.date-chip').forEach((button) => button.classList.toggle('active', button === activeButton));
  const nav = $('#date-nav');
  if (centerDate && activeButton && nav.classList.contains('is-scrollable')) {
    const navRect = nav.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const targetLeft = nav.scrollLeft + buttonRect.left - navRect.left - (nav.clientWidth - buttonRect.width) / 2;
    nav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'auto' });
  }
  updateMatchDaysHeight(date);
  if (!syncCarousel) return;
  const root = $('#match-days');
  const panel = root.querySelector(`[data-date="${CSS.escape(date)}"]`);
  if (panel) root.scrollTo({ left: Math.max(0, panel.offsetLeft - root.offsetLeft), behavior });
}

function renderDates(dates) {
  state.dates = dates;
  const remembered = state.selectedDates[state.league];
  const selected = remembered && dates.includes(remembered) ? remembered : dates.find((date) => date >= today()) || dates.at(-1) || null;
  const dateNav = $('#date-nav');
  dateNav.innerHTML = dates.map((date) => {
    const parsed = new Date(`${date}T00:00:00+09:00`);
    return `<button class="date-chip${date === selected ? ' active' : ''}" type="button" data-date="${esc(date)}"><small>${parsed.getMonth() + 1}月</small><strong>${parsed.getDate()}</strong><span>${weekday(date)}</span></button>`;
  }).join('');
  dateNav.querySelectorAll('.date-chip').forEach((button) => button.addEventListener('click', () => scrollToDate(button.dataset.date, 'auto')));
  dateNav.onscroll = syncDateSelectionFromDateNav;
  updateScrollState(dateNav);
  selectDate(selected, 'auto', false);
}

function renderMatches(matches = []) {
  const byDate = new Map();
  matches.forEach((match) => { if (!byDate.has(match.date)) byDate.set(match.date, []); byDate.get(match.date).push(match); });
  const dates = [...byDate.keys()].sort();
  renderDates(dates);
  const root = $('#match-days');
  root.innerHTML = dates.map((date) => {
    const cards = byDate.get(date).sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || '')).map((match) => {
      const finished = match.status === 'finished';
      const homeWon = finished && Number(match.homeScore) > Number(match.awayScore);
      const awayWon = finished && Number(match.awayScore) > Number(match.homeScore);
      const stateText = match.status === 'postponed' ? '延期' : match.status === 'cancelled' ? '中止' : finished ? '試合終了' : match.kickoff || '時刻未定';
      return `<div class="match-card"><div class="match-meta"><span>${esc(match.competition || 'レギュラーシーズン')}${match.matchday ? `・第${esc(match.matchday)}節` : ''}</span><span class="${finished ? 'match-time' : 'match-state'}">${esc(stateText)}</span></div><div class="scoreline"><div class="team-row home${homeWon ? ' winner' : awayWon ? ' loser' : ''}"><div class="team-name-block"><span class="team-side-label">Home</span><span class="team-name">${esc(match.home?.short || match.home?.name)}</span></div><span class="score${finished ? '' : ' score-placeholder'}">${finished ? esc(match.homeScore) : '0'}</span></div><span class="score-divider" aria-hidden="true">—</span><div class="team-row away${awayWon ? ' winner' : homeWon ? ' loser' : ''}"><span class="score${finished ? '' : ' score-placeholder'}">${finished ? esc(match.awayScore) : '0'}</span><div class="team-name-block"><span class="team-side-label">Away</span><span class="team-name">${esc(match.away?.short || match.away?.name)}</span></div></div></div>${match.venue ? `<div class="match-meta"><span>${esc(match.venue)}</span></div>` : ''}</div>`;
    }).join('');
    return `<article class="match-day" data-date="${esc(date)}"><div class="match-list">${cards}</div></article>`;
  }).join('');
  $('#empty-state').hidden = dates.length > 0;
  if (!dates.length) { $('#empty-state').textContent = state.data ? 'このカテゴリーの試合予定はありません' : 'データを取得できていません'; $('#empty-state').hidden = false; }
  root.onscroll = syncDateSelectionFromScroll;
  updateScrollState(root);
  updateBScrollSurfaces();
  requestAnimationFrame(() => { if (state.selectedDate) scrollToDate(state.selectedDate, 'auto'); else updateMatchDaysHeight(null); updatePageScrollState(); });
}

function rootToClosestMatchDayIndex(root, scrollLeft) {
  return [...root.children].reduce((closestIndex, child, index) => {
    const closestDistance = Math.abs((root.children[closestIndex].offsetLeft - root.offsetLeft) - scrollLeft);
    const distance = Math.abs((child.offsetLeft - root.offsetLeft) - scrollLeft);
    return distance < closestDistance ? index : closestIndex;
  }, 0);
}
function syncDateSelectionFromScroll() {
  const root = $('#match-days');
  if (!root.children.length || !root.clientWidth) return;
  const date = root.children[rootToClosestMatchDayIndex(root, root.scrollLeft)]?.dataset.date;
  if (date && date !== state.selectedDate) selectDate(date, 'auto', false);
}
function isMatchGestureSurface(target) {
  const element = target instanceof Element ? target : target?.parentElement;
  return Boolean(element?.closest('main')) && !element.closest('.app-header, .date-nav, .bottom-nav, .standings-sheet, button, a');
}
function handleMatchDaysWheel(event) {
  const root = $('#match-days');
  if (!root.classList.contains('is-scrollable')) return;
  const delta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
  if (!delta) return;
  event.preventDefault();
  matchWheelDelta += delta;
  window.clearTimeout(matchWheelResetTimer);
  matchWheelResetTimer = window.setTimeout(() => { matchWheelDelta = 0; }, 160);
  if (matchWheelLocked || Math.abs(matchWheelDelta) < matchSwipeThreshold) return;
  const currentIndex = rootToClosestMatchDayIndex(root, root.scrollLeft);
  const nextIndex = Math.min(root.children.length - 1, Math.max(0, currentIndex + (matchWheelDelta > 0 ? 1 : -1)));
  matchWheelDelta = 0;
  if (nextIndex === currentIndex) return;
  matchWheelLocked = true;
  root.scrollTo({ left: root.children[nextIndex].offsetLeft - root.offsetLeft, behavior: 'smooth' });
  window.clearTimeout(matchWheelUnlockTimer);
  matchWheelUnlockTimer = window.setTimeout(() => { matchWheelLocked = false; }, 420);
}
function handleMatchDaysPointerDown(event) {
  const root = $('#match-days');
  if (!isMatchGestureSurface(event.target) || matchSwipeLocked || event.pointerType === 'touch') return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  matchPointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startScroll: root.scrollLeft, horizontal: false };
}
function handleMatchDaysPointerMove(event) {
  if (!matchPointer || event.pointerId !== matchPointer.id) return;
  const root = $('#match-days');
  const deltaX = event.clientX - matchPointer.startX;
  const deltaY = event.clientY - matchPointer.startY;
  if (!matchPointer.horizontal && Math.abs(deltaX) <= Math.abs(deltaY)) return;
  if (!matchPointer.horizontal) { matchPointer.horizontal = true; root.setPointerCapture(event.pointerId); root.classList.add('is-dragging'); }
  event.preventDefault();
  root.scrollLeft = matchPointer.startScroll - Math.max(-72, Math.min(72, deltaX));
}
function finishMatchDaysPointer(event) {
  if (!matchPointer || event.pointerId !== matchPointer.id) return;
  const root = $('#match-days');
  const deltaX = event.clientX - matchPointer.startX;
  const currentIndex = rootToClosestMatchDayIndex(root, matchPointer.startScroll);
  if (matchPointer.horizontal) {
    event.preventDefault();
    const direction = Math.abs(deltaX) >= matchSwipeThreshold ? (deltaX < 0 ? 1 : -1) : 0;
    const nextIndex = Math.min(root.children.length - 1, Math.max(0, currentIndex + direction));
    root.classList.remove('is-dragging');
    matchSwipeLocked = true;
    window.clearTimeout(matchSwipeUnlockTimer);
    matchSwipeUnlockTimer = window.setTimeout(() => { matchSwipeLocked = false; }, 520);
    root.scrollTo({ left: root.children[nextIndex].offsetLeft - root.offsetLeft, behavior: 'smooth' });
  }
  if (root.hasPointerCapture(event.pointerId)) root.releasePointerCapture(event.pointerId);
  matchPointer = null;
}
function handleMatchDaysTouchStart(event) {
  const root = $('#match-days');
  if (!isMatchGestureSurface(event.target) || matchSwipeLocked || event.touches.length !== 1) return;
  const touch = event.touches[0];
  matchTouch = { startX: touch.clientX, startY: touch.clientY, startScroll: root.scrollLeft, horizontal: false };
}
function handleMatchDaysTouchMove(event) {
  if (!matchTouch || event.touches.length !== 1) return;
  const root = $('#match-days');
  const touch = event.touches[0];
  const deltaX = touch.clientX - matchTouch.startX;
  const deltaY = touch.clientY - matchTouch.startY;
  if (!matchTouch.horizontal && Math.abs(deltaX) <= Math.abs(deltaY)) return;
  matchTouch.horizontal = true;
  event.preventDefault();
  root.classList.add('is-dragging');
  root.scrollLeft = matchTouch.startScroll - Math.max(-72, Math.min(72, deltaX));
}
function finishMatchDaysTouch(event) {
  if (!matchTouch) return;
  const root = $('#match-days');
  const touch = event.changedTouches?.[0];
  const deltaX = touch ? touch.clientX - matchTouch.startX : 0;
  if (matchTouch.horizontal) {
    event.preventDefault();
    const currentIndex = rootToClosestMatchDayIndex(root, matchTouch.startScroll);
    const direction = Math.abs(deltaX) >= matchSwipeThreshold ? (deltaX < 0 ? 1 : -1) : 0;
    const nextIndex = Math.min(root.children.length - 1, Math.max(0, currentIndex + direction));
    root.classList.remove('is-dragging');
    matchSwipeLocked = true;
    window.clearTimeout(matchSwipeUnlockTimer);
    matchSwipeUnlockTimer = window.setTimeout(() => { matchSwipeLocked = false; }, 520);
    root.scrollTo({ left: root.children[nextIndex].offsetLeft - root.offsetLeft, behavior: 'smooth' });
  }
  root.classList.remove('is-dragging');
  matchTouch = null;
}
function cancelMatchDaysTouch() { if (!matchTouch) return; $('#match-days').classList.remove('is-dragging'); matchTouch = null; }

function table(rows, title) {
  if (!rows?.length) return `<p class="b-note">${esc(title)}の順位情報は公式未発表です。</p>`;
  return `<h3>${esc(title)}</h3><div class="table-wrap" tabindex="0" aria-label="${esc(title)}順位表"><table class="b-zone-table"><thead><tr><th>順位</th><th class="team-column">クラブ</th><th>勝</th><th>負</th><th>勝率</th><th>差</th><th>試合数</th><th>残試合</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${esc(row.rank)}</td><td class="team-column">${esc(row.team)}</td><td>${esc(row.wins)}</td><td>${esc(row.losses)}</td><td>${esc(row.winPercentage)}</td><td>${esc(row.gamesBehind)}</td><td>${esc(row.played)}</td><td>${esc(row.remaining)}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderModal() {
  const content = $('#modal-content');
  const standings = state.data?.standings || {};
  if (state.tab === 'standings') content.innerHTML = (standings.zones || []).map((zone) => table(zone.rows, zone.name)).join('') || '<p class="b-note">順位表を取得できていません。</p>';
  else if (state.tab === 'wildcard') content.innerHTML = state.league === 'next' ? '<p class="b-note">B.NEXTにはワイルドカード制度はありません。</p>' : table(standings.wildcard, 'ワイルドカード順位');
  else { const postseason = state.data?.postseason; content.innerHTML = postseason?.rounds?.length ? postseason.rounds.map((round) => `<div class="b-playoff-card"><strong>${esc(round.name)}</strong><span>${esc(round.home)} — ${esc(round.away)}　${esc(round.score || '予定')}</span></div>`).join('') : `<p class="b-note">${postseason?.status === 'unavailable' ? 'プレーオフの公式情報は未取得です。' : 'プレーオフの日程は公式未発表です。'}</p>`; }
  updateScrollState(content);
  updateBScrollSurfaces();
}
function render(data) {
  state.data = data;
  state.dataByLeague.set(state.league, data);
  updateLeagueTabSelection(state.league);
  status(data.update);
  renderMatches(data.matches || []);
  if (!$('#standings-sheet').hidden) renderModal();
}
async function load(league, force = false) {
  state.league = league;
  updateLeagueTabSelection(league);
  const cached = state.dataByLeague.get(league);
  if (cached && !force) { render(cached); return; }
  const token = ++state.token;
  status({});
  $('#empty-state').hidden = false;
  $('#empty-state').textContent = 'データを読み込んでいます';
  try {
    const response = await fetch(`/api/b-league/data?league=${encodeURIComponent(league)}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('データの読み込みに失敗しました');
    const data = await response.json();
    if (token !== state.token) return;
    render(data);
  } catch (error) {
    if (token !== state.token) return;
    status({ status: 'failure', message: error.message });
    $('#empty-state').hidden = false;
    $('#empty-state').textContent = 'データを取得できませんでした';
    requestAnimationFrame(updatePageScrollState);
  }
}
async function refresh() {
  if (state.updating || !window.confirm(`${LABELS[state.league]}の試合予定・結果・順位を更新します。よろしいですか？`)) return;
  state.updating = true;
  const league = state.league;
  status({ status: 'success', message: '公式サイトからデータを取得しています' });
  $('#refresh-button').disabled = true;
  try {
    const response = await fetch(`/api/b-league/update?league=${encodeURIComponent(league)}`, { method: 'POST', headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '更新に失敗しました');
    render(result.data);
  } catch (error) { status({ status: 'failure', message: error.message }); }
  finally { state.updating = false; $('#refresh-button').disabled = false; }
}
function openModal() {
  const sheet = $('#standings-sheet');
  sheet.hidden = false;
  sheet.setAttribute('aria-hidden', 'false');
  $('#standings-button').setAttribute('aria-expanded', 'true');
  $('#standings-button').classList.add('is-open');
  $('#standings-icon').textContent = '×';
  $('#standings-label').textContent = '閉じる';
  renderModal();
  requestAnimationFrame(() => { sheet.classList.add('is-open'); $('#standings-panel').focus(); });
}
function closeModal() {
  const sheet = $('#standings-sheet');
  sheet.classList.remove('is-open');
  sheet.setAttribute('aria-hidden', 'true');
  $('#standings-button').setAttribute('aria-expanded', 'false');
  $('#standings-button').classList.remove('is-open');
  $('#standings-icon').textContent = '▦';
  $('#standings-label').textContent = '順位';
  window.setTimeout(() => { sheet.hidden = true; }, 360);
}

$('#match-days').addEventListener('wheel', handleMatchDaysWheel, { passive: false });
document.addEventListener('pointerdown', handleMatchDaysPointerDown);
document.addEventListener('pointermove', handleMatchDaysPointerMove);
document.addEventListener('pointerup', finishMatchDaysPointer);
document.addEventListener('pointercancel', finishMatchDaysPointer);
document.addEventListener('touchstart', handleMatchDaysTouchStart, { passive: true });
document.addEventListener('touchmove', handleMatchDaysTouchMove, { passive: false });
document.addEventListener('touchend', finishMatchDaysTouch, { passive: false });
document.addEventListener('touchcancel', cancelMatchDaysTouch, { passive: true });
document.querySelectorAll('.league-tab').forEach((button) => button.addEventListener('click', () => load(button.dataset.league)));
document.querySelectorAll('.b-modal-tab').forEach((button) => button.addEventListener('click', () => {
  state.tab = button.dataset.modalTab;
  document.querySelectorAll('.b-modal-tab').forEach((tab) => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
  renderModal();
}));
$('#refresh-button').addEventListener('click', refresh);
$('#standings-button').addEventListener('click', () => $('#standings-sheet').hidden ? openModal() : closeModal());
$('#standings-backdrop').addEventListener('click', closeModal);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
window.addEventListener('resize', () => { updateBScrollSurfaces(); updateMatchDaysHeight(); updatePageScrollState(); });
load('premier');
