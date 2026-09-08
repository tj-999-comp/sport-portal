const state = { data: null, updating: false, dates: [], selectedDate: null };
const $ = (selector) => document.querySelector(selector);

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

function updateDateSelection(date) {
  state.selectedDate = date;
  $('#selected-date').textContent = date ? formatLongDate(date) : '';
  $('#date-nav').querySelectorAll('.date-chip').forEach((button) => button.classList.toggle('active', button.dataset.date === date));
}

function renderDateNav(dates, selectedDate) {
  $('#date-nav').innerHTML = dates.map((date) => `<button class="date-chip${date === selectedDate ? ' active' : ''}" type="button" data-date="${escapeHtml(date)}"><small>${escapeHtml(weekdayLabel(date))}</small><strong>${escapeHtml(new Date(`${date}T00:00:00+09:00`).getDate())}</strong></button>`).join('');
  $('#date-nav').querySelectorAll('.date-chip').forEach((button) => button.addEventListener('click', () => scrollToDate(button.dataset.date)));
}

function scrollToDate(date, behavior = 'smooth') {
  const root = $('#match-days');
  const target = root.querySelector(`[data-date="${date}"]`);
  if (!target) return;
  updateDateSelection(date);
  root.scrollTo({ left: target.offsetLeft, behavior });
}

function syncDateSelectionFromScroll() {
  const root = $('#match-days');
  if (!root.children.length || !root.clientWidth) return;
  const index = Math.min(root.children.length - 1, Math.max(0, Math.round(root.scrollLeft / root.clientWidth)));
  const date = root.children[index]?.dataset.date;
  if (date && date !== state.selectedDate) updateDateSelection(date);
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
      const stateText = match.status === 'postponed' ? '延期' : match.status === 'cancelled' ? '中止' : finished ? `${match.homeScore} - ${match.awayScore}` : match.kickoff || '未定';
      const card = document.createElement('div');
      card.className = 'match-card';
      card.innerHTML = `<div class="match-meta"><span>第${escapeHtml(match.matchday || '―')}節</span><span class="${finished ? 'match-time' : 'match-state'}">${escapeHtml(stateText)}</span></div><div class="team-row${homeWon ? ' winner' : awayWon ? ' loser' : ''}"><span class="team-name">${escapeHtml(match.home?.short || match.home?.name)}</span>${finished ? `<span class="score">${escapeHtml(match.homeScore)}</span>` : ''}</div><div class="team-row${awayWon ? ' winner' : homeWon ? ' loser' : ''}"><span class="team-name">${escapeHtml(match.away?.short || match.away?.name)}</span>${finished ? `<span class="score">${escapeHtml(match.awayScore)}</span>` : ''}</div>`;
      list.append(card);
    });
    root.append(day);
  });
  root.onscroll = syncDateSelectionFromScroll;
  if (selectedDate) requestAnimationFrame(() => scrollToDate(selectedDate, 'auto'));
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

$('#refresh-button').addEventListener('click', refresh);
$('#standings-button').addEventListener('click', () => $('#standings-dialog').showModal());
$('#close-standings').addEventListener('click', () => $('#standings-dialog').close());
$('#standings-dialog').addEventListener('click', (event) => { if (event.target === $('#standings-dialog')) $('#standings-dialog').close(); });
loadData();
