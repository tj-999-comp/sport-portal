export const NBA_SEASON = '2026-27';
export const NBA_SEASON_YEAR = 2026;
export const NBA_DATA_KEY = 'nba-2026-27';
export const BALLDONTLIE_NBA_BASE_URL = 'https://api.balldontlie.io/v1';

const NBA_HEADERS = {
  accept: 'application/json',
  'user-agent': 'sport-portal/1.0 (+private basketball schedule viewer)'
};
const GAME_TYPES = ['preseason', 'regular', 'ist', 'playin', 'playoffs'];
const PAGE_SIZE = 100;
const REQUEST_GAP_MS = 12_500;
const FULL_SCHEDULE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export function emptyNBAData(update = {}) {
  return {
    schemaVersion: 1,
    sport: 'nba',
    season: NBA_SEASON,
    provider: 'balldontlie',
    matches: [],
    standings: { east: [], west: [], eastern: [], western: [], status: 'unavailable' },
    coverage: { unclassifiedGames: 0 },
    nbaCup: { status: 'unsupported', groups: [], knockout: [] },
    postseason: { status: 'unsupported', playIn: [], playoffs: [] },
    cup: { status: 'unsupported', groups: [], rounds: [] },
    playIn: { status: 'unsupported', east: [], west: [] },
    playoffs: { status: 'unsupported', rounds: [] },
    update
  };
}

const iso = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

function jstDate(value, fallback) {
  const parsed = iso(value);
  if (parsed) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(parsed));
    const part = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    return `${part.year}-${part.month}-${part.day}`;
  }
  return typeof fallback === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fallback) ? fallback : null;
}

function kickoffJst(startsAt) {
  return startsAt
    ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(startsAt))
    : null;
}

function lifecycle(game) {
  const value = String(game.status_state ?? '').toLowerCase();
  const mapping = {
    scheduled: 'scheduled', in_progress: 'inProgress', final: 'finished',
    postponed: 'postponed', canceled: 'cancelled', delayed: 'delayed',
    suspended: 'interrupted', abandoned: 'cancelled', unknown: 'unknown'
  };
  if (mapping[value]) return mapping[value];
  const status = String(game.status ?? '').toLowerCase();
  if (/^final$|finished|ended/.test(status)) return 'finished';
  if (game.postponed || /postpon/.test(status)) return 'postponed';
  if (/cancel/.test(status)) return 'cancelled';
  if (/delay/.test(status)) return 'delayed';
  if (/suspend|interrupt/.test(status)) return 'interrupted';
  if (/quarter|halftime|in progress|overtime/.test(status)) return 'inProgress';
  if (iso(status)) return 'scheduled';
  return 'unknown';
}

function categoryFor(game, requestedType) {
  if (requestedType === 'preseason') return 'preseason';
  if (requestedType === 'playin') return 'playIn';
  if (requestedType === 'playoffs') return 'playoffs';
  if (requestedType === 'ist' || game.ist_stage) {
    const stage = String(game.ist_stage ?? '').toLowerCase();
    if (/group/.test(stage)) return 'nbaCupGroupPlay';
    if (/quarterfinal|semifinal|championship/.test(stage)) return 'nbaCupKnockout';
    return 'unknown';
  }
  if (requestedType === 'regular') return 'regularSeason';
  return 'unknown';
}

export function parseBallDontLieGame(game, requestedType = 'regular') {
  const startsAt = iso(game.datetime);
  const date = jstDate(startsAt, game.date);
  const status = lifecycle(game);
  const isFinal = status === 'finished';
  const home = game.home_team || {};
  const away = game.visitor_team || {};
  const stage = game.ist_stage || null;
  return {
    id: String(game.id ?? ''),
    date,
    providerDate: game.date ?? null,
    providerSeasonType: requestedType,
    startsAt,
    startAt: startsAt,
    kickoff: kickoffJst(startsAt),
    category: categoryFor(game, requestedType),
    stage,
    competitionLabel: stage ? `NBA Cup: ${stage}` : '',
    subLabel: '',
    status,
    statusText: game.status ?? null,
    home: { id: String(home.id ?? ''), name: home.full_name ?? null, tricode: home.abbreviation ?? null },
    away: { id: String(away.id ?? ''), name: away.full_name ?? null, tricode: away.abbreviation ?? null },
    homeScore: isFinal && Number.isInteger(game.home_team_score) ? game.home_team_score : null,
    awayScore: isFinal && Number.isInteger(game.visitor_team_score) ? game.visitor_team_score : null,
    venue: null,
    city: null,
    state: null,
    country: null
  };
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestGamesPage(type, cursor, apiKey, fetchImpl, dates = []) {
  const url = new URL('games', `${BALLDONTLIE_NBA_BASE_URL}/`);
  url.searchParams.set('seasons[]', String(NBA_SEASON_YEAR));
  url.searchParams.set('season_type', type);
  url.searchParams.set('per_page', String(PAGE_SIZE));
  if (cursor != null) url.searchParams.set('cursor', String(cursor));
  for (const date of dates) url.searchParams.append('dates[]', date);
  const response = await fetchImpl(url, { headers: { ...NBA_HEADERS, Authorization: apiKey } });
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error(`BALLDONTLIE /games (${type}) の応答がJSONではありません`); }
  if (!response.ok) {
    const details = payload?.error?.message || payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(`BALLDONTLIE /games (${type}): ${String(details)}`);
  }
  if (!Array.isArray(payload?.data)) throw new Error(`BALLDONTLIE /games (${type}) の応答形式が不正です`);
  return payload;
}

async function fetchGamesOfType(type, apiKey, fetchImpl, requestState, dates = []) {
  const games = [];
  const seenCursors = new Set();
  let cursor = null;
  for (;;) {
    if (requestState.count >= 50) throw new Error('BALLDONTLIEのページ数がWorkerのサブリクエスト上限に達しました');
    if (requestState.count > 0) await wait(REQUEST_GAP_MS);
    const payload = await requestGamesPage(type, cursor, apiKey, fetchImpl, dates);
    requestState.count += 1;
    games.push(...payload.data.map((game) => parseBallDontLieGame(game, type)));
    const next = payload.meta?.next_cursor;
    if (next == null || payload.data.length === 0) break;
    const nextCursor = String(next);
    if (seenCursors.has(nextCursor)) throw new Error(`BALLDONTLIE /games (${type}) のページカーソルが重複しています`);
    seenCursors.add(nextCursor);
    cursor = next;
  }
  return games;
}

export function normalizeBallDontLieSeason(games, now = new Date()) {
  if (!Array.isArray(games) || games.length === 0) throw new Error('BALLDONTLIEから2026-27シーズンの試合が取得できませんでした');
  if (games.some((game) => !game.id || !game.date || !game.home.name || !game.away.name)) {
    throw new Error('BALLDONTLIEの日程に必須項目がありません');
  }
  const unique = new Map();
  for (const game of games) {
    const current = unique.get(game.id);
    // The IST endpoint can overlap the regular-season endpoint. Prefer its
    // explicit Cup stage when the provider returns the same game in both.
    if (!current || (game.category.startsWith('nbaCup') && !current.category.startsWith('nbaCup'))) unique.set(game.id, game);
  }
  const matches = [...unique.values()].sort((a, b) => (a.startsAt || a.date).localeCompare(b.startsAt || b.date));
  if (matches.some((game) => game.status === 'unknown')) throw new Error('BALLDONTLIEの日程に状態を認識できない試合があります');
  const playIn = matches.filter((game) => game.category === 'playIn');
  const playoffs = matches.filter((game) => game.category === 'playoffs');
  return {
    ...emptyNBAData(),
    matches,
    standings: { east: [], west: [], eastern: [], western: [], status: 'unavailable' },
    coverage: { unclassifiedGames: matches.filter((game) => game.category === 'unknown').length },
    postseason: { status: 'gamesOnly', playIn, playoffs },
    nbaCup: { status: 'gamesOnly', groups: [], knockout: matches.filter((game) => game.category === 'nbaCupKnockout') },
    update: { status: 'success', at: now.toISOString(), provider: 'BALLDONTLIE' }
  };
}

function jstToday(now) {
  return jstDate(now.toISOString());
}

function shiftDate(date, amount) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function needsFullScheduleRefresh(previous, now) {
  if (previous?.provider !== 'balldontlie' || !Array.isArray(previous.matches) || previous.matches.length === 0) return true;
  const lastFullRefresh = Date.parse(previous.update?.scheduleAt || '');
  return !Number.isFinite(lastFullRefresh) || now.getTime() - lastFullRefresh >= FULL_SCHEDULE_REFRESH_MS;
}

async function fetchFullSeason(apiKey, fetchImpl, requestState, now) {
  const games = [];
  for (const type of GAME_TYPES) games.push(...await fetchGamesOfType(type, apiKey, fetchImpl, requestState));
  const data = normalizeBallDontLieSeason(games, now);
  return {
    ...data,
    update: { ...data.update, scheduleAt: now.toISOString(), resultsAt: now.toISOString(), refreshMode: 'full' }
  };
}

async function refreshRecentGames(previous, apiKey, fetchImpl, requestState, now) {
  const today = jstToday(now);
  const recentJstDates = new Set([today, shiftDate(today, -1)]);
  const datesByType = new Map(GAME_TYPES.map((type) => [type, new Set()]));
  for (const match of previous.matches) {
    if (!recentJstDates.has(match.date) || !match.providerDate || !datesByType.has(match.providerSeasonType)) continue;
    datesByType.get(match.providerSeasonType).add(match.providerDate);
  }

  const refreshed = [];
  for (const type of GAME_TYPES) {
    const dates = [...datesByType.get(type)];
    if (dates.length) refreshed.push(...await fetchGamesOfType(type, apiKey, fetchImpl, requestState, dates));
  }
  const byId = new Map(previous.matches.map((match) => [match.id, match]));
  for (const game of refreshed) byId.set(game.id, game);
  const data = normalizeBallDontLieSeason([...byId.values()], now);
  return {
    ...data,
    update: {
      ...data.update,
      scheduleAt: previous.update.scheduleAt,
      resultsAt: now.toISOString(),
      refreshMode: 'recent'
    }
  };
}

export async function fetchFreshNBAData(fetchImpl = fetch, now = new Date(), env = {}, previous = emptyNBAData()) {
  if (!env.BALLDONTLIE_API_KEY) throw new Error('STG WorkerにBALLDONTLIE_API_KEY Secretが設定されていません');
  const requestState = { count: 0 };
  if (needsFullScheduleRefresh(previous, now)) return fetchFullSeason(env.BALLDONTLIE_API_KEY, fetchImpl, requestState, now);
  return refreshRecentGames(previous, env.BALLDONTLIE_API_KEY, fetchImpl, requestState, now);
}

export async function performNBAUpdate(env, now = new Date(), fetchImpl = fetch) {
  const previous = await env.SPORTAL_DATA.get(NBA_DATA_KEY, 'json') || emptyNBAData();
  try {
    const data = await fetchFreshNBAData(fetchImpl, now, env, previous);
    await env.SPORTAL_DATA.put(NBA_DATA_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    const failed = { ...previous, update: { ...previous.update, status: 'failure', attemptedAt: now.toISOString(), message: error instanceof Error ? error.message : '更新に失敗しました' } };
    await env.SPORTAL_DATA.put(NBA_DATA_KEY, JSON.stringify(failed));
    throw Object.assign(new Error(failed.update.message), { data: failed });
  }
}
