const $ = (selector) => document.querySelector(selector);
const state = { data: null, selectedDate: null, modalTab: 'standings', lastFocus: null, updating: false };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function todayJst() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()); }
function dateLabel(value) {
  const [year, month, day] = value.split('-').map(Number);
  const week = new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(`${value}T00:00:00+09:00`));
  return { short: `${month}/${day}`, full: `${year}年${month}月${day}日（${week}）`, week };
}
function timeLabel(value) {
  if (!value) return '時刻未定';
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(value));
}
function categoryLabel(match) {
  return ({ preseason: 'プレシーズン', regular: 'レギュラーシーズン', 'cup-group': 'NBA Cup グループプレー', 'cup-knockout': 'NBA Cup ノックアウト', 'play-in': 'Play-In', playoffs: 'プレーオフ', finals: 'NBA Finals' })[match.category] || '大会区分未取得';
}
function statusLabel(match) {
  if (match.status === 'finished') return '試合終了';
  if (match.status === 'inProgress') return '試合中';
  if (match.status === 'postponed') return '延期';
  if (match.status === 'delayed') return '開始遅延';
  if (match.status === 'cancelled') return '中止';
  if (match.status === 'interrupted') return '中断';
  if (match.status === 'scheduled') return match.startsAt ? `開始予定 ${timeLabel(match.startsAt)}` : '開始時刻未定';
  return '状態未取得';
}
function showStatus(update, hasData) {
  const dot = $('#nba-status-dot');
  dot.className = `nba-status-dot ${update?.status || ''}`;
  $('#nba-status-label').textContent = update?.status === 'failure' ? '更新失敗' : update?.status === 'success' ? '更新済み' : '未取得';
  $('#nba-status-detail').textContent = update?.status === 'failure'
    ? `${update.message || 'データを更新できませんでした'}${hasData ? '・前回正常データを表示中' : ''}`
    : hasData ? (state.data?.coverage?.unclassifiedGames ? `試合予定・結果を表示中・大会区分未取得 ${state.data.coverage.unclassifiedGames}件` : '試合予定・結果を表示しています') : 'NBAデータの取得を待っています';
  $('#nba-updated-at').textContent = update?.at ? `更新 ${timeLabel(update.at)}` : '';
}
function availableDates() { return [...new Set((state.data?.matches || []).map((game) => game.date).filter(Boolean))].sort(); }
function initialDate(dates) { return dates.find((date) => date >= todayJst()) || dates.at(-1) || null; }
function renderDateNav(dates) {
  $('#date-nav').innerHTML = dates.map((date) => {
    const label = dateLabel(date);
    return `<button type="button" class="nba-date-chip${date === state.selectedDate ? ' active' : ''}" data-nba-date="${date}" aria-pressed="${date === state.selectedDate}"><span>${label.short}</span><small>${label.week}</small></button>`;
  }).join('');
}
function renderGame(game) {
  const final = game.status === 'finished' && Number.isInteger(game.homeScore) && Number.isInteger(game.awayScore);
  const winner = (home) => final && (home ? game.homeScore > game.awayScore : game.awayScore > game.homeScore);
  return `<article class="nba-game-card">
    <div class="nba-game-meta"><span>${escapeHtml(categoryLabel(game))}</span><strong>${escapeHtml(statusLabel(game))}</strong></div>
    <div class="nba-matchup">
      <div class="nba-team${winner(true) ? ' winner' : ''}"><span class="nba-side">HOME</span><span>${escapeHtml(game.home?.name || '未確定')}</span></div>
      <span class="nba-score">${final ? escapeHtml(game.homeScore) : '—'}</span>
      <span class="nba-versus" aria-hidden="true">—</span>
      <span class="nba-score">${final ? escapeHtml(game.awayScore) : '—'}</span>
      <div class="nba-team nba-team-away${winner(false) ? ' winner' : ''}"><span class="nba-side">AWAY</span><span>${escapeHtml(game.away?.name || '未確定')}</span></div>
    </div>
    <div class="nba-game-footer"><span>${escapeHtml(game.venue || '会場未発表')}</span><span>${escapeHtml(game.city || '')}</span></div>
  </article>`;
}
function renderMatches() {
  const dates = availableDates();
  if (!state.selectedDate || !dates.includes(state.selectedDate)) state.selectedDate = initialDate(dates);
  renderDateNav(dates);
  $('#selected-date').textContent = state.selectedDate ? dateLabel(state.selectedDate).full : '2026-27 NBAシーズン';
  const games = (state.data?.matches || []).filter((game) => game.date === state.selectedDate).sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || ''));
  $('#nba-day-list').innerHTML = games.map(renderGame).join('');
  const empty = $('#nba-empty');
  empty.hidden = games.length > 0;
  empty.textContent = state.data?.update?.status === 'failure' && !state.data.matches.length
    ? 'NBAの試合情報を取得できません。更新状態を確認してください。'
    : state.data?.update?.status === 'success' && !dates.length ? '2026-27シーズンの日程はまだ提供元にありません。'
      : state.selectedDate ? 'この日の試合情報はありません。' : 'NBAデータの取得を待っています。';
}
function fmt(value) { return value === null || value === undefined || value === '' ? '—' : escapeHtml(value); }
function renderStandings() {
  const data = state.data?.standings;
  if (!data || data.status !== 'success') return '<p class="nba-unavailable">順位表データは未取得です。</p>';
  const headers = ['Rank', 'Team', 'W', 'L', 'WIN%', 'GB', 'CONF', 'HOME', 'ROAD', 'LAST 10', 'STREAK', 'STATUS'];
  const table = (rows, label) => `<section class="nba-standing-section"><h3>${label}</h3><div class="nba-table-scroll" role="region" tabindex="0" aria-label="${label}順位表"><table class="nba-standings-table"><thead><tr>${headers.map((header) => `<th scope="col">${header}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr><td>${fmt(row.rank)}</td><th scope="row">${fmt(row.team)}</th><td>${fmt(row.wins)}</td><td>${fmt(row.losses)}</td><td>${fmt(row.winPercentage)}</td><td>${fmt(row.gamesBehind)}</td><td>${fmt(row.conferenceRecord)}</td><td>${fmt(row.home)}</td><td>${fmt(row.road)}</td><td>${fmt(row.lastTen)}</td><td>${fmt(row.streak)}</td><td>${fmt(row.postseasonStatus)}</td></tr>`).join('')}</tbody></table></div></section>`;
  return `${table(data.east || [], '東カンファレンス')}${table(data.west || [], '西カンファレンス')}<p class="nba-table-note">STATUSは提供元の進出・敗退情報がある場合のみ表示します。—は情報未取得を示します。</p>`;
}
function bracketRows(rounds) {
  if (!Array.isArray(rounds) || !rounds.length) return '<p class="nba-unavailable">組み合わせは公式発表待ちです。</p>';
  return rounds.map((round) => `<section class="nba-round"><h3>${escapeHtml(round.label || 'ラウンド')}</h3>${(round.games || []).map((game) => `<article class="nba-bracket-game"><span>${escapeHtml(game.home?.name || '未定')} ${game.homeScore ?? ''}</span><span>vs</span><span>${escapeHtml(game.away?.name || '未定')} ${game.awayScore ?? ''}</span><small>${escapeHtml(game.statusText || '日程未発表')}</small></article>`).join('') || '<p>公式発表待ち</p>'}</section>`).join('');
}
function renderCup() {
  const cup = state.data?.cup;
  if (!cup || cup.status !== 'success') return '<p class="nba-unavailable">NBA Cupのグループ順位・進出状況は、現在の提供元から取得できません。</p><h3>ノックアウト</h3><p class="nba-unavailable">対戦表は提供元の対応を確認中です。</p>';
  const groups = (cup.groups || []).map((group) => `<section class="nba-standing-section"><h3>${escapeHtml(group.name)}</h3><div class="nba-table-scroll" role="region" tabindex="0" aria-label="${escapeHtml(group.name)}順位"><table class="nba-standings-table"><thead><tr><th>Rank</th><th>Team</th><th>W</th><th>L</th><th>Point Differential</th></tr></thead><tbody>${(group.teams || []).map((team) => `<tr><td>${fmt(team.rank)}</td><th>${fmt(team.name)}</th><td>${fmt(team.wins)}</td><td>${fmt(team.losses)}</td><td>${fmt(team.pointDifferential)}</td></tr>`).join('')}</tbody></table></div></section>`).join('');
  return `${groups || '<p class="nba-unavailable">グループ順位は公式発表待ちです。</p>'}${bracketRows(cup.rounds)}<p class="nba-table-note">成績の算入区分は2026-27シーズンのNBA Cup公式ルールに従います。</p>`;
}
function renderInfo() {
  const content = $('#nba-modal-content');
  if (state.modalTab === 'standings') content.innerHTML = renderStandings();
  else if (state.modalTab === 'cup') content.innerHTML = renderCup();
  else if (state.modalTab === 'playIn') {
    const playIn = state.data?.playIn;
    content.innerHTML = playIn?.status === 'success' ? `${bracketRows([{ label: '東カンファレンス', games: playIn.east }, { label: '西カンファレンス', games: playIn.west }])}` : '<p class="nba-unavailable">Play-Inの出場チーム・日程は、現在の提供元から取得できません。</p>';
  } else {
    const playoffs = state.data?.playoffs;
    content.innerHTML = playoffs?.status === 'success' ? bracketRows(playoffs.rounds) : '<p class="nba-unavailable">プレーオフの対戦表は、現在の提供元から取得できません。</p>';
  }
}
function setModalTab(tab, focus = false) {
  state.modalTab = tab;
  for (const button of document.querySelectorAll('[data-nba-tab]')) {
    const selected = button.dataset.nbaTab === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  }
  renderInfo();
}
function openModal() {
  state.lastFocus = document.activeElement;
  const sheet = $('#nba-info-sheet');
  sheet.hidden = false;
  sheet.setAttribute('aria-hidden', 'false');
  $('#nba-info-open').setAttribute('aria-expanded', 'true');
  document.body.classList.add('nba-modal-open');
  setModalTab('standings');
  $('#nba-info-close').focus();
}
function closeModal() {
  const sheet = $('#nba-info-sheet');
  sheet.hidden = true;
  sheet.setAttribute('aria-hidden', 'true');
  $('#nba-info-open').setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nba-modal-open');
  state.lastFocus?.focus();
}
function render() {
  const hasData = Boolean(state.data?.matches?.length || state.data?.standings?.status === 'success' || state.data?.cup?.status === 'success' || state.data?.playIn?.status === 'success' || state.data?.playoffs?.status === 'success');
  showStatus(state.data?.update || {}, hasData);
  renderMatches();
}
async function loadData() {
  const response = await fetch('/api/nba/data', { headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`NBAデータを読み込めません (${response.status})`);
  state.data = await response.json();
  render();
}
async function refresh() {
  if (state.updating) return;
  if (!window.confirm('API-SportsからNBAの日程・順位データを更新しますか？')) return;
  state.updating = true;
  const button = $('#nba-refresh');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  $('#nba-status-label').textContent = '更新中';
  $('#nba-status-detail').textContent = 'NBAの試合・順位情報を取得しています';
  try {
    const response = await fetch('/api/nba/update', { method: 'POST', headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json();
    if (payload.data) state.data = payload.data;
    if (!response.ok) throw new Error(payload.error || 'NBA情報を更新できませんでした');
    render();
  } catch (error) {
    if (state.data) state.data.update = { ...state.data.update, status: 'failure', message: error.message };
    render();
  } finally {
    state.updating = false;
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

document.addEventListener('click', (event) => {
  const dateButton = event.target.closest('[data-nba-date]');
  if (dateButton) { state.selectedDate = dateButton.dataset.nbaDate; renderMatches(); return; }
  const tab = event.target.closest('[data-nba-tab]');
  if (tab) { setModalTab(tab.dataset.nbaTab); return; }
});
$('#nba-refresh').addEventListener('click', refresh);
$('#nba-info-open').addEventListener('click', openModal);
$('#nba-info-close').addEventListener('click', closeModal);
$('#nba-sheet-backdrop').addEventListener('click', closeModal);
$('.nba-modal-tabs').addEventListener('keydown', (event) => {
  const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!delta) return;
  const tabs = [...document.querySelectorAll('[data-nba-tab]')];
  const current = tabs.findIndex((tab) => tab.dataset.nbaTab === state.modalTab);
  const next = tabs[(current + delta + tabs.length) % tabs.length];
  setModalTab(next.dataset.nbaTab, true);
  event.preventDefault();
});
$('#nba-info-sheet').addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key !== 'Tab') return;
  const focusable = [...$('#nba-info-sheet').querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]')].filter((element) => element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
  else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
});
$('#nba-day-list').addEventListener('touchstart', (event) => { const t = event.changedTouches[0]; $('#nba-day-list').dataset.touchX = t.clientX; $('#nba-day-list').dataset.touchY = t.clientY; }, { passive: true });
$('#nba-day-list').addEventListener('touchend', (event) => {
  const dates = availableDates();
  const t = event.changedTouches[0];
  const dx = Number($('#nba-day-list').dataset.touchX) - t.clientX;
  const dy = Number($('#nba-day-list').dataset.touchY) - t.clientY;
  if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy)) return;
  const index = dates.indexOf(state.selectedDate);
  const next = dates[index + (dx > 0 ? 1 : -1)];
  if (next) { state.selectedDate = next; renderMatches(); }
}, { passive: true });

loadData().catch((error) => {
  showStatus({ status: 'failure', message: error.message }, false);
  $('#nba-empty').hidden = false;
  $('#nba-empty').textContent = error.message;
});
