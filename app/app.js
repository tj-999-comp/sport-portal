const state = { data: null, updating: false };
const $ = (selector) => document.querySelector(selector);

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(date);
}
function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(value));
}
function todayJst() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }

function renderStatus(update = {}) {
  const indicator = $('#status-indicator');
  indicator.className = `status-indicator ${update.status || ''}`;
  const failed = update.status === 'failure';
  $('#status-label').textContent = failed ? '更新に失敗しました' : update.status === 'success' ? '最新データを取得済み' : 'データ未取得';
  $('#status-detail').textContent = failed ? (update.message || '前回正常に取得したデータを表示しています') : update.message || 'J1リーグのデータを表示しています';
  $('#updated-at').textContent = update.at ? `更新日時 ${formatDateTime(update.at)}` : '';
}

function renderMatches(matches = []) {
  const root = $('#match-days');
  root.innerHTML = '';
  $('#empty-state').hidden = matches.length > 0;
  const byDay = new Map();
  matches.forEach((match) => { if (!byDay.has(match.date)) byDay.set(match.date, []); byDay.get(match.date).push(match); });
  [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([date, dayMatches]) => {
    const day = document.createElement('article');
    const isToday = date === todayJst();
    day.className = `match-day${isToday ? ' today' : ''}`;
    const dayLabel = new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(`${date}T00:00:00+09:00`));
    day.innerHTML = `<div class="day-topline"><div><span class="day-date">${escapeHtml(formatDate(date))}</span><span class="day-weekday"> (${escapeHtml(dayLabel)})</span></div>${isToday ? '<span class="today-badge">今日</span>' : ''}</div><div class="match-list"></div>`;
    const list = day.querySelector('.match-list');
    dayMatches.sort((a, b) => (a.kickoff || '').localeCompare(b.kickoff || '')).forEach((match) => {
      const finished = match.status === 'finished';
      const stateText = match.status === 'postponed' ? '延期' : match.status === 'cancelled' ? '中止' : finished ? `${match.homeScore} - ${match.awayScore}` : match.kickoff || '未定';
      const card = document.createElement('div');
      card.className = 'match-card';
      card.innerHTML = `<div class="match-meta"><span>第${escapeHtml(match.matchday || '―')}節</span><span class="${finished ? 'match-time' : 'match-state'}">${escapeHtml(stateText)}</span></div><div class="team-row"><span class="team-name">${escapeHtml(match.home?.short || match.home?.name)}</span>${finished ? `<span class="score">${escapeHtml(match.homeScore)}</span>` : ''}</div><div class="team-row"><span class="team-name">${escapeHtml(match.away?.short || match.away?.name)}</span>${finished ? `<span class="score">${escapeHtml(match.awayScore)}</span>` : ''}</div>`;
      list.append(card);
    });
    root.append(day);
  });
  const target = [...root.querySelectorAll('.match-day')].find((day) => day.classList.contains('today')) || root.querySelector('.match-day');
  target?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
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
