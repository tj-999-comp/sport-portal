const state = { data: null, updating: false, dates: [], selectedDate: null };
const $ = (selector) => document.querySelector(selector);
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

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(date);
}
function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(value));
}
function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(value));
}
function formatLongDate(dateString) {
  const [year, month, day] = dateString.split('-');
  return `${year}年${Number(month)}月${Number(day)}日`;
}
function weekdayLabel(dateString) {
  return new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(`${dateString}T00:00:00+09:00`));
}
function todayJst() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

function renderStatus(update = {}) {
  const indicator = $('#status-indicator');
  indicator.className = `status-indicator ${update.status || ''}`;
  const failed = update.status === 'failure';
  $('#status-label').textContent = failed ? '更新失敗' : update.status === 'success' ? '更新済み' : '読み込み中';
  $('#status-detail').textContent = failed ? (update.message || '前回正常に取得したデータを表示しています') : update.message || 'J1リーグのデータを表示しています';
  $('#updated-at').textContent = update.at ? formatTime(update.at) : '';
}

function updateDateSelection(date, centerDate = true) {
  state.selectedDate = date;
  $('#selected-date').textContent = date ? formatLongDate(date) : '';
  const activeButton = [...$('#date-nav').querySelectorAll('.date-chip')].find((button) => button.dataset.date === date);
  $('#date-nav').querySelectorAll('.date-chip').forEach((button) => button.classList.toggle('active', button === activeButton));
  const dateNav = $('#date-nav');
  if (centerDate && activeButton && dateNav.classList.contains('is-scrollable')) {
    const navRect = dateNav.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const targetLeft = dateNav.scrollLeft + buttonRect.left - navRect.left - (dateNav.clientWidth - buttonRect.width) / 2;
    dateNav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'auto' });
  }
  updateMatchDaysHeight(date);
}

function renderDateNav(dates, selectedDate) {
  const dateNav = $('#date-nav');
  dateNav.innerHTML = dates.map((date) => {
    const dateObject = new Date(`${date}T00:00:00+09:00`);
    return `<button class="date-chip${date === selectedDate ? ' active' : ''}" type="button" data-date="${escapeHtml(date)}"><small>${escapeHtml(`${dateObject.getMonth() + 1}月`)}</small><strong>${escapeHtml(dateObject.getDate())}</strong><span>${escapeHtml(weekdayLabel(date))}</span></button>`;
  }).join('');
  updateScrollState(dateNav);
  dateNav.querySelectorAll('.date-chip').forEach((button) => button.addEventListener('click', () => scrollToDate(button.dataset.date)));
}

function settleDateNavSelection() {
  const dateNav = $('#date-nav');
  if (!dateNav.classList.contains('is-scrollable') || !dateNav.clientWidth) return;
  const navRect = dateNav.getBoundingClientRect();
  const center = navRect.left + navRect.width / 2;
  const closest = [...dateNav.querySelectorAll('.date-chip')].reduce((current, chip) => {
    const chipRect = chip.getBoundingClientRect();
    const distance = Math.abs(chipRect.left + chipRect.width / 2 - center);
    return !current || distance < current.distance ? { chip, distance } : current;
  }, null)?.chip;
  if (!closest) return;
  const closestRect = closest.getBoundingClientRect();
  const targetLeft = dateNav.scrollLeft + closestRect.left - navRect.left - (dateNav.clientWidth - closestRect.width) / 2;
  if (closest.dataset.date !== state.selectedDate) scrollToDate(closest.dataset.date, 'smooth', false);
  dateNav.scrollTo({ left: Math.max(0, targetLeft), behavior: 'auto' });
}

function syncDateSelectionFromDateNav() {
  window.clearTimeout(dateNavScrollTimer);
  dateNavScrollTimer = window.setTimeout(settleDateNavSelection, 120);
}

function updateScrollState(element) {
  element.classList.toggle('is-scrollable', element.scrollWidth > element.clientWidth + 1);
}

function updatePageScrollState() {
  const root = document.documentElement;
  const needsScroll = root.scrollHeight > root.clientHeight + 1;
  root.classList.toggle('page-is-scrollable', needsScroll);
}

function updateMatchDaysHeight(date = state.selectedDate) {
  const root = $('#match-days');
  const target = date ? root.querySelector(`[data-date="${date}"]`) : null;
  if (!target) {
    root.style.removeProperty('height');
    requestAnimationFrame(updatePageScrollState);
    return;
  }
  root.style.height = 'auto';
  root.style.height = `${target.offsetHeight}px`;
  requestAnimationFrame(updatePageScrollState);
}

function scrollToDate(date, behavior = 'smooth', centerDate = true) {
  const root = $('#match-days');
  const target = root.querySelector(`[data-date="${date}"]`);
  if (!target) return;
  updateDateSelection(date, centerDate);
  root.scrollTo({ left: Math.max(0, target.offsetLeft - root.offsetLeft), behavior });
}

function syncDateSelectionFromScroll() {
  const root = $('#match-days');
  if (!root.children.length || !root.clientWidth) return;
  const index = rootToClosestMatchDayIndex(root, root.scrollLeft);
  const date = root.children[index]?.dataset.date;
  if (date && date !== state.selectedDate) updateDateSelection(date);
}

function rootToClosestMatchDayIndex(root, scrollLeft) {
  return [...root.children].reduce((closestIndex, child, index) => {
    const closestDistance = Math.abs((root.children[closestIndex].offsetLeft - root.offsetLeft) - scrollLeft);
    const distance = Math.abs((child.offsetLeft - root.offsetLeft) - scrollLeft);
    return distance < closestDistance ? index : closestIndex;
  }, 0);
}

function handleMatchDaysWheel(event) {
  const root = $('#match-days');
  if (!root.classList.contains('is-scrollable')) return;
  const horizontalDelta = Math.abs(event.deltaX) >= Math.abs(event.deltaY) ? event.deltaX : event.shiftKey ? event.deltaY : 0;
  if (!horizontalDelta) return;
  event.preventDefault();
  matchWheelDelta += horizontalDelta;
  window.clearTimeout(matchWheelResetTimer);
  matchWheelResetTimer = window.setTimeout(() => { matchWheelDelta = 0; }, 160);
  if (matchWheelLocked) return;
  if (Math.abs(matchWheelDelta) < matchSwipeThreshold) return;
  const currentIndex = rootToClosestMatchDayIndex(root, root.scrollLeft);
  const direction = matchWheelDelta > 0 ? 1 : -1;
  const nextIndex = Math.min(root.children.length - 1, Math.max(0, currentIndex + direction));
  matchWheelDelta = 0;
  if (nextIndex === currentIndex) return;
  matchWheelLocked = true;
  root.scrollTo({ left: root.children[nextIndex].offsetLeft - root.offsetLeft, behavior: 'smooth' });
  window.clearTimeout(matchWheelUnlockTimer);
  matchWheelUnlockTimer = window.setTimeout(() => { matchWheelLocked = false; }, 420);
}

function handleMatchDaysPointerDown(event) {
  const root = $('#match-days');
  if (!root.classList.contains('is-scrollable')) return;
  if (event.pointerType === 'touch') return;
  if (matchSwipeLocked) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  matchPointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, startScroll: root.scrollLeft, horizontal: false };
}

function handleMatchDaysPointerMove(event) {
  if (!matchPointer || event.pointerId !== matchPointer.id) return;
  const root = $('#match-days');
  const deltaX = event.clientX - matchPointer.startX;
  const deltaY = event.clientY - matchPointer.startY;
  if (!matchPointer.horizontal && Math.abs(deltaX) <= Math.abs(deltaY)) return;
  if (!matchPointer.horizontal) {
    matchPointer.horizontal = true;
    root.setPointerCapture(event.pointerId);
    root.classList.add('is-dragging');
  }
  event.preventDefault();
  const limitedDelta = Math.max(-72, Math.min(72, deltaX));
  root.scrollLeft = matchPointer.startScroll - limitedDelta;
}

function finishMatchDaysPointer(event) {
  if (!matchPointer || event.pointerId !== matchPointer.id) return;
  const root = $('#match-days');
  const deltaX = event.clientX - matchPointer.startX;
  const currentIndex = rootToClosestMatchDayIndex(root, matchPointer.startScroll);
  const direction = Math.abs(deltaX) >= matchSwipeThreshold ? (deltaX < 0 ? 1 : -1) : 0;
  if (matchPointer.horizontal) {
    event.preventDefault();
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
  if (!root.classList.contains('is-scrollable') || matchSwipeLocked || event.touches.length !== 1) return;
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
  const limitedDelta = Math.max(-72, Math.min(72, deltaX));
  root.scrollLeft = matchTouch.startScroll - limitedDelta;
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

function cancelMatchDaysTouch() {
  if (!matchTouch) return;
  $('#match-days').classList.remove('is-dragging');
  matchTouch = null;
}

function renderMatches(matches = []) {
  const root = $('#match-days');
  root.innerHTML = '';
  $('#empty-state').hidden = true;
  const byDay = new Map();
  matches.forEach((match) => { if (!byDay.has(match.date)) byDay.set(match.date, []); byDay.get(match.date).push(match); });
  const dates = [...byDay.keys()].sort();
  const today = todayJst();
  state.dates = dates;
  const defaultDate = dates.find((date) => date >= today) || dates[0];
  const selectedDate = state.selectedDate && dates.includes(state.selectedDate) ? state.selectedDate : defaultDate;
  state.selectedDate = selectedDate || null;
  renderDateNav(dates, selectedDate);
  updateDateSelection(selectedDate);
  dates.forEach((date) => {
    const dayMatches = byDay.get(date) || [];
    const day = document.createElement('article');
    const isToday = date === today;
    day.className = `match-day${isToday ? ' today' : ''}`;
    day.dataset.date = date;
    day.innerHTML = dayMatches.length ? '<div class="match-list"></div>' : '<p class="no-matches">本日の試合はありません</p>';
    const list = day.querySelector('.match-list');
    dayMatches.sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || '')).forEach((match) => {
      const finished = match.status === 'finished';
      const homeWon = finished && Number(match.homeScore) > Number(match.awayScore);
      const awayWon = finished && Number(match.awayScore) > Number(match.homeScore);
      const stateText = match.status === 'postponed' ? '延期' : match.status === 'cancelled' ? '中止' : finished ? '試合終了' : match.kickoff || '未定';
      const card = document.createElement('div');
      card.className = 'match-card';
      card.innerHTML = `<div class="match-meta"><span>第${escapeHtml(match.matchday || '―')}節</span><span class="${finished ? 'match-time' : 'match-state'}">${escapeHtml(stateText)}</span></div><div class="scoreline"><div class="team-row home${homeWon ? ' winner' : awayWon ? ' loser' : ''}"><span class="team-name">${escapeHtml(match.home?.short || match.home?.name)}</span>${finished ? `<span class="score">${escapeHtml(match.homeScore)}</span>` : ''}</div><span class="score-divider" aria-hidden="true">—</span><div class="team-row away${awayWon ? ' winner' : homeWon ? ' loser' : ''}">${finished ? `<span class="score">${escapeHtml(match.awayScore)}</span>` : ''}<span class="team-name">${escapeHtml(match.away?.short || match.away?.name)}</span></div></div>`;
      list.append(card);
    });
    root.append(day);
  });
  root.onscroll = syncDateSelectionFromScroll;
  $('#date-nav').onscroll = syncDateSelectionFromDateNav;
  updateScrollState(root);
  requestAnimationFrame(() => {
    if (selectedDate) scrollToDate(selectedDate, 'auto');
    updateMatchDaysHeight(selectedDate);
    updatePageScrollState();
  });
}

function renderStandings(rows = []) {
  $('#standings-body').innerHTML = rows.map((row) => `<tr><td>${escapeHtml(row.rank)}</td><td class="team-column">${escapeHtml(row.team)}</td><td>${escapeHtml(row.played)}</td><td>${escapeHtml(row.wins)}</td><td>${escapeHtml(row.draws)}</td><td>${escapeHtml(row.losses)}</td><td>${escapeHtml(row.goalsFor)}</td><td>${escapeHtml(row.goalsAgainst)}</td><td>${escapeHtml(row.goalDifference)}</td><td>${escapeHtml(row.points)}</td></tr>`).join('');
}
function render(data) { state.data = data; renderStatus(data.update); renderMatches(data.matches); renderStandings(data.standings); }

async function loadData() {
  try {
    const response = await fetch('/api/data', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('データの読み込みに失敗しました');
    render(await response.json());
  } catch (error) {
    renderStatus({ status: 'failure', message: error.message });
    $('#empty-state').hidden = false;
    requestAnimationFrame(updatePageScrollState);
  }
}
async function refresh() {
  if (state.updating) return;
  if (!window.confirm('試合予定・結果・順位表を更新します。よろしいですか？')) return;
  state.updating = true;
  const button = $('#refresh-button'); button.disabled = true; button.textContent = '更新中…';
  renderStatus({ status: 'success', message: '公式サイトからデータを取得しています' });
  try {
    const response = await fetch('/api/update', { method: 'POST', headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '更新に失敗しました');
    render(result.data);
  } catch (error) { renderStatus({ status: 'failure', message: error.message }); }
  finally { state.updating = false; button.disabled = false; button.textContent = '手動更新'; }
}

const standingsSheet = $('#standings-sheet');
const standingsPanel = $('#standings-panel');
const standingsButton = $('#standings-button');
const standingsIcon = $('#standings-icon');
const standingsLabel = $('#standings-label');
const matchDays = $('#match-days');
matchDays.addEventListener('wheel', handleMatchDaysWheel, { passive: false });
matchDays.addEventListener('pointerdown', handleMatchDaysPointerDown);
matchDays.addEventListener('pointermove', handleMatchDaysPointerMove);
matchDays.addEventListener('pointerup', finishMatchDaysPointer);
matchDays.addEventListener('pointercancel', finishMatchDaysPointer);
matchDays.addEventListener('touchstart', handleMatchDaysTouchStart, { passive: true });
matchDays.addEventListener('touchmove', handleMatchDaysTouchMove, { passive: false });
matchDays.addEventListener('touchend', finishMatchDaysTouch, { passive: false });
matchDays.addEventListener('touchcancel', cancelMatchDaysTouch, { passive: true });
let standingsOpenedFrom = null;
let standingsHideTimer = null;
let standingsOpenFrame = null;
let standingsClosing = false;

function setStandingsButton(open) {
  standingsIcon.textContent = open ? '×' : '▦';
  standingsLabel.textContent = open ? '閉じる' : '順位';
  standingsButton.classList.toggle('is-open', open);
  standingsButton.setAttribute('aria-label', open ? '順位表を閉じる' : '順位表を開く');
  standingsButton.setAttribute('aria-expanded', String(open));
}

function openStandings() {
  window.clearTimeout(standingsHideTimer);
  window.cancelAnimationFrame(standingsOpenFrame);
  standingsClosing = false;
  standingsOpenedFrom = document.activeElement;
  setStandingsButton(true);
  standingsSheet.hidden = false;
  standingsSheet.setAttribute('aria-hidden', 'false');
  standingsOpenFrame = requestAnimationFrame(() => {
    standingsSheet.classList.add('is-open');
    standingsPanel.focus();
  });
}

function closeStandings() {
  if (standingsSheet.hidden || standingsClosing) return;
  window.cancelAnimationFrame(standingsOpenFrame);
  standingsClosing = true;
  setStandingsButton(false);
  standingsSheet.classList.remove('is-open');
  standingsSheet.setAttribute('aria-hidden', 'true');
  standingsHideTimer = window.setTimeout(() => {
    standingsSheet.hidden = true;
    standingsClosing = false;
  }, 360);
  standingsOpenedFrom?.focus();
}

$('#refresh-button').addEventListener('click', refresh);
$('#standings-button').addEventListener('click', () => {
  if (standingsSheet.hidden) openStandings();
  else closeStandings();
});
$('#standings-backdrop').addEventListener('click', closeStandings);
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeStandings(); });
window.addEventListener('resize', () => {
  updateScrollState($('#date-nav'));
  updateScrollState($('#match-days'));
  updateMatchDaysHeight();
  requestAnimationFrame(updatePageScrollState);
});
loadData();
