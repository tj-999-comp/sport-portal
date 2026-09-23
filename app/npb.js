const $ = (selector) => document.querySelector(selector);
const state = { data: null, league: 'central', modalLeague: 'central', modalTab: 'standings', selectedDate: null, selectedByLeague: {}, updating: false, scrollTimer: null };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function todayJst() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()); }
function dateLabel(date) {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' }).format(parsed);
}
function fullDateLabel(date) {
  if (!date) return '2026年';
  const [year, month, day] = date.split('-').map(Number);
  return `${year}年${month}月${day}日`;
}
function weekdayLabel(date) {
  return new Intl.DateTimeFormat('ja-JP', { weekday: 'short', timeZone: 'Asia/Tokyo' }).format(new Date(`${date}T00:00:00+09:00`));
}
function timeLabel(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' }).format(new Date(value));
}
function timeText(value) {
  if (!value) return '開始時刻未定';
  const [hour, minute] = value.split(':').map(Number);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function formatStatus(update = {}, hasData = false) {
  const dot = $('#npb-status-dot');
  dot.className = `npb-status-dot ${update.status || ''}`;
  $('#npb-status-label').textContent = update.status === 'failure' ? '更新失敗' : update.status === 'success' ? '更新済み' : '未更新';
  $('#npb-status-detail').textContent = update.message || (hasData ? 'NPB公式の日程・結果を表示しています' : 'データを取得できていません');
  $('#npb-updated-at').textContent = update.at ? timeLabel(update.at) : '';
}

function matchesForLeague() {
  const matches = state.data?.matches || [];
  return matches.filter((match) => {
    if (match.kind === 'event') return !match.league || match.league === state.league;
    if (match.category === 'regular') return match.league === state.league || match.league === 'interleague';
    return match.league === state.league || match.league === 'interleague';
  });
}

function updateTabs() {
  document.querySelectorAll('[data-npb-league]').forEach((button) => {
    const active = button.dataset.npbLeague === state.league;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.title = `スポーツポータル | 2026 ${state.league === 'central' ? 'セ・リーグ' : 'パ・リーグ'}`;
}

function statusText(match) {
  if (match.status === 'finished') return '試合終了';
  if (match.status === 'cancelled') return '中止';
  if (match.status === 'postponed') return '延期';
  if (match.status === 'inProgress') return '試合中';
  if (match.status === 'unplayed') return '未確定';
  return timeText(match.kickoff);
}

function categoryText(match) {
  if (match.category === 'cs') return `クライマックスシリーズ${match.stage === 'first' ? '・ファーストステージ' : match.stage === 'final' ? '・ファイナルステージ' : ''}`;
  if (match.category === 'japanSeries') return '日本シリーズ';
  if (match.league === 'interleague') return 'セ・パ交流戦';
  return '公式戦';
}

function renderGame(match) {
  if (match.kind === 'event') {
    return `<article class="npb-card"><div class="npb-card-meta"><span>${escapeHtml(categoryText(match))}</span><strong class="npb-match-status">予定</strong></div><p class="npb-event-title">${escapeHtml(match.title || 'ポストシーズン')}</p><p class="npb-event-detail">出場球団未確定${match.venue ? ` ・ ${escapeHtml(match.venue)}` : ''}</p></article>`;
  }
  const finished = match.status === 'finished' && Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore);
  const homeWon = finished && match.homeScore > match.awayScore;
  const awayWon = finished && match.awayScore > match.homeScore;
  const score = (teamScore, won, side) => finished ? `<span class="npb-score ${side} ${won ? 'winner' : ''}">${escapeHtml(teamScore)}</span>` : `<span class="npb-score ${side}" aria-hidden="true"></span>`;
  const postseasonTitle = match.category === 'regular' ? categoryText(match) : categoryText(match);
  return `<article class="npb-card">
    <div class="npb-card-meta"><span>${escapeHtml(postseasonTitle)}</span><strong class="npb-match-status">${escapeHtml(statusText(match))}</strong></div>
    <div class="npb-scoreline">
      <div class="npb-team home${homeWon ? ' winner' : ''}"><span class="npb-side-label">Home</span><span class="npb-team-name">${escapeHtml(match.home?.short || match.home?.name || '未確定')}</span></div>
      ${score(match.homeScore, homeWon, 'home')}<span class="npb-score-divider" aria-hidden="true">—</span>${score(match.awayScore, awayWon, 'away')}
      <div class="npb-team away${awayWon ? ' winner' : ''}"><span class="npb-side-label">Away</span><span class="npb-team-name">${escapeHtml(match.away?.short || match.away?.name || '未確定')}</span></div>
    </div>
    ${match.venue ? `<p class="npb-card-footer">${escapeHtml(match.venue)}</p>` : ''}
  </article>`;
}

function centerDate(date, behavior = 'auto') {
  const nav = $('#npb-date-nav');
  const chip = [...nav.querySelectorAll('[data-date]')].find((button) => button.dataset.date === date);
  if (chip) {
    chip.setAttribute('aria-current', 'date');
    nav.querySelectorAll('[data-date]').forEach((button) => { if (button !== chip) button.removeAttribute('aria-current'); });
    const navRect = nav.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const targetLeft = nav.scrollLeft + chipRect.left - navRect.left - (nav.clientWidth - chipRect.width) / 2;
    nav.scrollTo({ left: Math.max(0, targetLeft), behavior });
  }
}

function setDaysHeight(date = state.selectedDate) {
  const root = $('#npb-days');
  root.style.height = 'auto';
  const panel = date ? [...root.children].find((item) => item.dataset.date === date) : null;
  if (panel) root.style.height = `${panel.offsetHeight}px`;
}

function selectDate(date, behavior = 'smooth', syncCarousel = true) {
  if (!date) return;
  state.selectedDate = date;
  state.selectedByLeague[state.league] = date;
  $('#npb-selected-date').textContent = fullDateLabel(date);
  centerDate(date, behavior);
  setDaysHeight(date);
  if (!syncCarousel) return;
  const root = $('#npb-days');
  const panel = [...root.children].find((item) => item.dataset.date === date);
  if (panel) {
    const rootRect = root.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    root.scrollTo({ left: Math.max(0, root.scrollLeft + panelRect.left - rootRect.left), behavior });
  }
}

function renderMatches() {
  const root = $('#npb-days');
  const matches = matchesForLeague().sort((a, b) => `${a.date}${a.kickoff || ''}${a.id}`.localeCompare(`${b.date}${b.kickoff || ''}${b.id}`));
  const byDate = new Map();
  for (const match of matches) {
    if (!byDate.has(match.date)) byDate.set(match.date, []);
    byDate.get(match.date).push(match);
  }
  const dates = [...byDate.keys()].sort();
  const today = todayJst();
  const defaultDate = dates.includes(today) ? today : dates.find((date) => date > today) || dates.at(-1) || null;
  const remembered = state.selectedByLeague[state.league];
  const selected = remembered && dates.includes(remembered) ? remembered : defaultDate;
  state.selectedDate = selected;
  $('#npb-selected-date').textContent = fullDateLabel(selected);
  $('#npb-date-nav').innerHTML = dates.map((date) => {
    const parsed = new Date(`${date}T00:00:00+09:00`);
    return `<button class="npb-date-chip" type="button" data-date="${escapeHtml(date)}"${date === selected ? ' aria-current="date"' : ''}><small>${escapeHtml(`${parsed.getMonth() + 1}月`)}</small><strong>${parsed.getDate()}</strong><span>${escapeHtml(weekdayLabel(date))}</span></button>`;
  }).join('');
  $('#npb-date-nav').querySelectorAll('[data-date]').forEach((button) => button.addEventListener('click', () => selectDate(button.dataset.date)));
  root.innerHTML = dates.map((date) => `<section class="npb-day" data-date="${escapeHtml(date)}" aria-label="${escapeHtml(fullDateLabel(date))}"><div class="npb-day-list">${byDate.get(date).map(renderGame).join('')}</div></section>`).join('');
  $('#npb-empty').hidden = dates.length > 0;
  $('#npb-empty').textContent = state.data?.matches?.length ? `${state.league === 'central' ? 'セ・リーグ' : 'パ・リーグ'}の試合データはありません` : 'データを取得できていません';
  if (!dates.length) root.innerHTML = '<p class="npb-no-matches">このリーグの試合予定はありません</p>';
  root.onscroll = () => {
    window.clearTimeout(state.scrollTimer);
    state.scrollTimer = window.setTimeout(() => {
      const panels = [...root.querySelectorAll('.npb-day')];
      if (!panels.length) return;
      const closest = panels.reduce((best, panel) => {
        const distance = Math.abs(panel.getBoundingClientRect().left - root.getBoundingClientRect().left);
        return !best || distance < best.distance ? { panel, distance } : best;
      }, null)?.panel;
      if (closest && closest.dataset.date !== state.selectedDate) selectDate(closest.dataset.date, 'auto', false);
    }, 100);
  };
  if (selected) requestAnimationFrame(() => selectDate(selected, 'auto'));
  else setDaysHeight(null);
}

window.addEventListener('resize', () => setDaysHeight());

function render(data) {
  state.data = data;
  const hasData = Boolean(data?.matches?.length || data?.standings?.central?.rows?.length || data?.standings?.pacific?.rows?.length);
  formatStatus(data?.update || {}, hasData);
  updateTabs();
  renderMatches();
  if (!$('#npb-standings-modal').hidden) renderModalContent();
}

async function loadData() {
  formatStatus({}, false);
  try {
    const response = await fetch('/api/npb/data', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('NPBデータを読み込めませんでした');
    render(await response.json());
  } catch (error) {
    formatStatus({ status: 'failure', message: error.message }, false);
    $('#npb-empty').hidden = false;
  }
}

async function refresh() {
  if (state.updating || !window.confirm('NPBの試合予定・結果・順位情報を更新します。よろしいですか？')) return;
  state.updating = true;
  const button = $('#npb-refresh');
  button.disabled = true;
  button.querySelector('small').textContent = '更新中…';
  formatStatus({ status: 'loading', message: 'NPB公式サイトから取得しています' }, Boolean(state.data?.matches?.length));
  try {
    const response = await fetch('/api/npb/update', { method: 'POST', headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (result.data) render(result.data);
    if (!response.ok) throw new Error(result.error || 'NPBデータの更新に失敗しました');
  } catch (error) {
    formatStatus({ status: 'failure', message: error.message, at: new Date().toISOString() }, Boolean(state.data?.matches?.length));
  } finally {
    state.updating = false;
    button.disabled = false;
    button.querySelector('small').textContent = '手動更新';
  }
}

function setModal(open) {
  const modal = $('#npb-standings-modal');
  const panel = modal.querySelector('.npb-modal-panel');
  if (open) {
    window.clearTimeout(modalHideTimer);
    window.cancelAnimationFrame(modalOpenFrame);
    modalClosing = false;
    modalOpenedFrom = document.activeElement;
    state.modalLeague = state.league;
    renderModalContent();
    setStandingsButton(true);
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    modalOpenFrame = requestAnimationFrame(() => { modal.classList.add('is-open'); panel.focus(); });
  } else {
    if (modal.hidden || modalClosing) return;
    window.cancelAnimationFrame(modalOpenFrame);
    modalClosing = true;
    setStandingsButton(false);
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    modalHideTimer = window.setTimeout(() => { modal.hidden = true; modalClosing = false; }, 360);
    modalOpenedFrom?.focus();
  }
}

let modalOpenedFrom = null;
let modalHideTimer = null;
let modalOpenFrame = null;
let modalClosing = false;

function setStandingsButton(open) {
  const button = $('#npb-standings-open');
  button.classList.toggle('is-open', open);
  button.setAttribute('aria-label', open ? '各種順位を閉じる' : '各種順位を開く');
  button.setAttribute('aria-expanded', String(open));
  button.querySelector('span').textContent = open ? '×' : '▦';
  button.querySelector('small').textContent = open ? '閉じる' : '各種順位';
}

function teamName(team) { return team?.short || team?.name || '未確定'; }
function modalLeagueLabel(league = state.modalLeague) { return league === 'central' ? 'セ・リーグ' : 'パ・リーグ'; }

function renderStandingsLeagueTable(league) {
  const rows = state.data?.standings?.[league]?.rows || [];
  const label = modalLeagueLabel(league);
  if (!rows.length) return `<section class="npb-standings-league"><h3>${label}</h3><p class="npb-modal-empty">順位表を取得できていません</p></section>`;
  return `<section class="npb-standings-league"><h3>${label}</h3><div class="npb-table-wrap npb-standing-wrap" tabindex="0" aria-label="${label}順位表"><table class="npb-data-table npb-standing-table"><thead><tr><th>順位</th><th>球団</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th><th>差</th><th>残試合数</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.rank)}</td><td class="team-cell">${escapeHtml(teamName(row.team))}</td><td>${escapeHtml(row.wins ?? '—')}</td><td>${escapeHtml(row.losses ?? '—')}</td><td>${escapeHtml(row.draws ?? '—')}</td><td>${escapeHtml(row.winPercentage ?? '—')}</td><td>${escapeHtml(row.gamesBehind == null ? '—' : Number(row.gamesBehind).toFixed(1))}</td><td>${remainingGames(row, 143)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function renderStandingsTable() {
  return `<div class="npb-standings-stack">${renderStandingsLeagueTable('central')}${renderStandingsLeagueTable('pacific')}</div>`;
}

function remainingGames(row, totalGames) {
  const played = Number(row?.played);
  return Number.isFinite(played) ? escapeHtml(Math.max(0, totalGames - played)) : '—';
}

function renderInterleagueStandings() {
  const allRows = [
    ...(state.data?.standings?.central?.interleague || []),
    ...(state.data?.standings?.pacific?.interleague || [])
  ];
  const rows = [...new Map(allRows.filter((row) => row?.team?.code).map((row) => [row.team.code, row])).values()]
    .sort((a, b) => Number(b.winPercentage || 0) - Number(a.winPercentage || 0) || Number(b.wins || 0) - Number(a.wins || 0) || Number(a.losses || 0) - Number(b.losses || 0));
  if (!rows.length) return '<p class="npb-modal-empty">交流戦の順位表を取得できていません</p>';
  return `<div class="npb-table-wrap npb-standing-wrap" tabindex="0" aria-label="交流戦順位表"><table class="npb-data-table npb-standing-table npb-interleague-table"><thead><tr><th>順位</th><th>球団</th><th>勝</th><th>敗</th><th>分</th><th>勝率</th><th>残試合数</th></tr></thead><tbody>${rows.map((row, index) => `<tr><td>${index + 1}</td><td class="team-cell">${escapeHtml(teamName(row.team))}</td><td>${escapeHtml(row.wins ?? '—')}</td><td>${escapeHtml(row.losses ?? '—')}</td><td>${escapeHtml(row.draws ?? '—')}</td><td>${escapeHtml(row.winPercentage ?? '—')}</td><td>${remainingGames(row, 18)}</td></tr>`).join('')}</tbody></table></div>`;
}

function actualPostseasonGames(category, league, stage = null) {
  return (state.data?.matches || []).filter((match) => match.kind === 'game' && match.category === category && (!league || match.league === league) && (!stage || match.stage === stage));
}

function renderPostseasonGame(match) {
  if (match.kind === 'event') return '';
  const finished = match.status === 'finished' && Number.isInteger(match.homeScore) && Number.isInteger(match.awayScore);
  const result = finished ? `　${match.homeScore} - ${match.awayScore}` : `　${escapeHtml(statusText(match))}`;
  return `<li class="npb-bracket-game"><time>${escapeHtml(dateLabel(match.date))}</time><span>${escapeHtml(teamName(match.home))}${result}　${escapeHtml(teamName(match.away))}</span></li>`;
}

function renderCsLeague(league, rules, schedule) {
  const firstGames = actualPostseasonGames('cs', league, 'first').sort((a, b) => a.date.localeCompare(b.date));
  const finalGames = actualPostseasonGames('cs', league, 'final').sort((a, b) => a.date.localeCompare(b.date));
  const firstDates = schedule.filter((item) => item.stage === 'first');
  const finalDates = schedule.filter((item) => item.stage === 'final');
  const firstTeams = [...new Map(firstGames.flatMap((match) => [match.home, match.away]).filter(Boolean).map((team) => [team.code, team])).values()];
  const finalTeams = [...new Map(finalGames.flatMap((match) => [match.home, match.away]).filter(Boolean).map((team) => [team.code, team])).values()];
  const renderStage = (label, dates, games, teams, detail) => {
    const datesText = dates.map((item) => item.reserve ? `${dateLabel(item.date)} 予備日` : `${dateLabel(item.date)} 第${item.gameNumber}試合`).join(' ・ ');
    const participants = teams.length ? teams.map(teamName).join(' vs ') : '出場球団未確定';
    return `<section class="npb-bracket-stage"><h4>${label}</h4><p class="npb-bracket-teams">${escapeHtml(participants)}</p><p class="npb-bracket-rule">${escapeHtml(detail)}</p><p class="npb-bracket-dates">${escapeHtml(datesText || '公式日程未発表')}</p>${games.length ? `<ol class="npb-bracket-games">${games.map(renderPostseasonGame).join('')}</ol>` : '<p class="npb-bracket-pending">試合結果未確定</p>'}</section>`;
  };
  const first = renderStage('ファーストステージ', firstDates, firstGames, firstTeams, `${rules.firstStage.games}試合制・先に${rules.firstStage.winsToAdvance}勝。2位球団のホーム開催。`);
  const finalRule = rules.finalStage;
  const finalDetail = `${finalRule.standard.games}試合制・1位に${finalRule.standard.advantageWins}勝のアドバンテージ、先に${finalRule.standard.winsToAdvance}勝で勝者。ゲーム差10以上、または勝率5割未満の場合は${finalRule.conditional.games}試合制・2勝アドバンテージ・先に5勝。`;
  const final = renderStage('ファイナルステージ', finalDates, finalGames, finalTeams, finalDetail);
  return `<section class="npb-playoff-league"><h3>${modalLeagueLabel(league)}</h3><div class="npb-bracket">${first}<div class="npb-bracket-connector" aria-hidden="true">›</div>${final}</div></section>`;
}

function renderCs() {
  const cs = state.data?.postseason?.cs;
  if (!cs?.rules) return '<p class="npb-modal-empty">クライマックスシリーズ情報を取得できていません</p>';
  return `<p class="npb-table-note">出場球団は公式に確定するまで表示せず、予定日だけを表示します。</p>${renderCsLeague('central', cs.rules, cs.schedule || [])}${renderCsLeague('pacific', cs.rules, cs.schedule || [])}`;
}

function renderJapanSeries() {
  const schedule = state.data?.postseason?.japanSeries?.schedule || [];
  if (!schedule.length) return '<p class="npb-modal-empty">日本シリーズの日程情報を取得できていません</p>';
  const games = actualPostseasonGames('japanSeries').sort((a, b) => a.date.localeCompare(b.date));
  const teams = [...new Map(games.flatMap((match) => [match.home, match.away]).filter(Boolean).map((team) => [team.code, team])).values()];
  const central = teams.find((team) => team.league === 'central');
  const pacific = teams.find((team) => team.league === 'pacific');
  const list = schedule.map((item) => {
    const game = games.find((match) => match.date === item.date);
    if (game) return renderPostseasonGame(game);
    return `<li class="npb-bracket-game"><time>${escapeHtml(dateLabel(item.date))}</time><span>第${escapeHtml(item.gameNumber)}戦　対戦球団未確定${item.venue ? ` ・ ${escapeHtml(item.venue)}` : ''}</span></li>`;
  }).join('');
  return `<section class="npb-playoff-league"><h3>日本シリーズ</h3><div class="npb-bracket npb-japan-bracket"><section class="npb-bracket-stage"><h4>セ・リーグ優勝球団</h4><p class="npb-bracket-teams">${escapeHtml(teamName(central))}</p></section><div class="npb-bracket-connector" aria-hidden="true">×</div><section class="npb-bracket-stage"><h4>パ・リーグ優勝球団</h4><p class="npb-bracket-teams">${escapeHtml(teamName(pacific))}</p></section></div><p class="npb-table-note">日本シリーズの日程はNPB公式発表に基づきます。未確定の対戦球団・結果は補完していません。</p><ol class="npb-bracket-games npb-series-games">${list}</ol></section>`;
}

function renderModalContent() {
  document.querySelectorAll('[data-npb-modal-tab]').forEach((button) => {
    const active = button.dataset.npbModalTab === state.modalTab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  const content = $('#npb-modal-content');
  if (!state.data) {
    content.innerHTML = '<p class="npb-modal-empty">NPBデータを取得できていません</p>';
    return;
  }
  content.innerHTML = state.modalTab === 'standings' ? renderStandingsTable()
    : state.modalTab === 'interleague' ? renderInterleagueStandings()
      : state.modalTab === 'cs' ? renderCs()
        : renderJapanSeries();
}

document.querySelectorAll('[data-npb-modal-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    state.modalTab = button.dataset.npbModalTab;
    renderModalContent();
  });
  button.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...document.querySelectorAll('[data-npb-modal-tab]')];
    const index = tabs.indexOf(button);
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    next.focus();
    next.click();
  });
});

document.querySelectorAll('[data-npb-league]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.npbLeague === state.league) return;
    state.league = button.dataset.npbLeague;
    updateTabs();
    renderMatches();
  });
  button.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = state.league === 'central' ? 'pacific' : 'central';
    document.querySelector(`[data-npb-league="${next}"]`).click();
    document.querySelector(`[data-npb-league="${next}"]`).focus();
  });
});
$('#npb-refresh').addEventListener('click', refresh);
$('#npb-standings-open').addEventListener('click', () => setModal($('#npb-standings-modal').hidden || modalClosing));
$('#npb-modal-backdrop').addEventListener('click', () => setModal(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setModal(false); });
loadData();
