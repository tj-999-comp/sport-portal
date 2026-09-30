export const NBA_SEASON = '2026-27';
export const NBA_SEASON_YEAR = 2026;
export const NBA_DATA_KEY = 'nba-2026-27';
export const API_SPORTS_NBA_BASE_URL = 'https://v2.nba.api-sports.io';

const NBA_HEADERS = {
  accept: 'application/json',
  'user-agent': 'sport-portal/1.0 (+private basketball schedule viewer)'
};

export function emptyNBAData(update = {}) {
  return {
    schemaVersion: 1,
    sport: 'nba',
    season: NBA_SEASON,
    provider: 'api-sports',
    matches: [],
    standings: { east: [], west: [], status: 'unavailable' },
    coverage: { unclassifiedGames: 0 },
    cup: { status: 'unsupported', groups: [], rounds: [] },
    playIn: { status: 'unsupported', east: [], west: [] },
    playoffs: { status: 'unsupported', rounds: [] },
    update
  };
}

function iso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function categoryFor(game) {
  // API-Sports documents `stage` as a provider value and shows numeric IDs in
  // its current response examples. Never treat `league=standard` or a number
  // as proof that a game is regular-season; the same league includes preseason.
  const stage = String(game.stage ?? '').toLowerCase();
  if (/nba cup|in-season|in season|\bcup\b/.test(stage)) {
    if (/quarter.?final|semi.?final|\bfinal\b|championship|knockout/.test(stage)) return 'cup-knockout';
    if (/group/.test(stage)) return 'cup-group';
    return 'unknown';
  }
  if (/play-in|play in/.test(stage)) return 'play-in';
  if (/nba finals|^finals$/.test(stage)) return 'finals';
  if (/playoff|postseason|post-season/.test(stage)) return 'playoffs';
  if (/preseason|pre-season/.test(stage)) return 'preseason';
  if (/regular|standard/.test(stage)) return 'regular';
  return 'unknown';
}

function statusFor(game) {
  const code = Number(game.status?.short);
  const raw = String(game.status?.long ?? '').toLowerCase();
  if (code === 3 || /final|finished|ended/.test(raw)) return 'finished';
  if (code === 4 || /postpon/.test(raw)) return 'postponed';
  if (code === 5 || /delay/.test(raw)) return 'delayed';
  if (code === 6 || /cancel/.test(raw)) return 'cancelled';
  if (/suspend|interrupt/.test(raw)) return 'interrupted';
  if (code === 2 || /live|quarter|halftime|overtime|in progress/.test(raw)) return 'inProgress';
  if (code === 1 || /not started|scheduled|time tbd|^$/.test(raw)) return 'scheduled';
  return 'unknown';
}

export function parseAPISportsGame(game) {
  const rawStart = game.date?.start;
  const rawDate = typeof rawStart === 'string' ? rawStart : game.date?.date;
  const dateOnly = typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
  const startsAt = dateOnly ? null : iso(rawStart);
  const date = dateOnly || (startsAt ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(startsAt)) : null);
  const status = statusFor(game);
  const isFinal = status === 'finished';
  const home = game.teams?.home;
  const away = game.teams?.visitors;
  return {
    id: String(game.id ?? ''),
    date,
    startsAt,
    category: categoryFor(game),
    stage: game.stage ?? null,
    status,
    statusText: game.status?.long ?? null,
    home: { id: home?.id ?? null, name: home?.name ?? null, code: home?.code ?? null },
    away: { id: away?.id ?? null, name: away?.name ?? null, code: away?.code ?? null },
    homeScore: isFinal && Number.isInteger(game.scores?.home?.points) ? game.scores.home.points : null,
    awayScore: isFinal && Number.isInteger(game.scores?.visitors?.points) ? game.scores.visitors.points : null,
    venue: game.arena?.name ?? null,
    city: game.arena?.city ?? null,
    state: game.arena?.state ?? null,
    country: game.arena?.country ?? null
  };
}

function record(wins, losses) {
  return Number.isInteger(wins) && Number.isInteger(losses) ? `${wins}-${losses}` : null;
}

export function parseAPISportsStandings(records) {
  if (records.length === 0) return { east: [], west: [], status: 'unavailable' };
  const east = [];
  const west = [];
  for (const item of records) {
    const conferenceName = String(item.conference?.name ?? '').toLowerCase();
    const rows = conferenceName.startsWith('e') ? east : conferenceName.startsWith('w') ? west : null;
    if (!rows) continue;
    const wins = Number.isInteger(item.win?.total) ? item.win.total : null;
    const losses = Number.isInteger(item.loss?.total) ? item.loss.total : null;
    rows.push({
      rank: Number.isInteger(item.conference?.rank) ? item.conference.rank : null,
      team: item.team?.name ?? null,
      code: item.team?.code ?? null,
      wins,
      losses,
      winPercentage: item.win?.percentage ?? null,
      gamesBehind: item.gamesBehind ?? item.conference?.gamesBehind ?? null,
      conferenceRecord: Number.isInteger(item.conference?.win) && Number.isInteger(item.conference?.loss) ? `${item.conference.win}-${item.conference.loss}` : null,
      home: record(item.win?.home, item.loss?.home),
      road: record(item.win?.away, item.loss?.away),
      lastTen: record(item.win?.lastTen, item.loss?.lastTen),
      streak: typeof item.streak === 'object'
        ? item.streak?.currentStreak ?? item.streak?.display ?? null
        : Number.isInteger(item.streak) && typeof item.winStreak === 'boolean'
          ? `${item.winStreak ? 'W' : 'L'}${Math.abs(item.streak)}`
          : typeof item.streak === 'string' ? item.streak : null,
      postseasonStatus: typeof item.postseasonStatus === 'string' ? item.postseasonStatus : typeof item.clinched === 'string' ? item.clinched : null
    });
  }
  const valid = east.length === 15 && west.length === 15 && [...east, ...west].every((row) => Number.isInteger(row.rank) && row.team && Number.isInteger(row.wins) && Number.isInteger(row.losses));
  if (!valid) throw new Error('NBA順位データに15チームずつの東西順位がそろっていません');
  return { east: east.sort((a, b) => a.rank - b.rank), west: west.sort((a, b) => a.rank - b.rank), status: 'success' };
}

export function normalizeAPISportsSeason(games, standings, now = new Date()) {
  if (!Array.isArray(games) || !Array.isArray(standings)) throw new Error('API-Sportsのデータ形式が不正です');
  if (!games.length) throw new Error('2026-27シーズンの日程が空です');
  const matches = games.map(parseAPISportsGame);
  if (matches.some((game) => !game.id || !game.date || !game.home.name || !game.away.name || game.status === 'unknown')) {
    throw new Error('NBA日程に必須項目または試合状態を認識できない試合があります');
  }
  if (new Set(matches.map((game) => game.id)).size !== matches.length) throw new Error('NBA日程に重複した試合があります');
  const normalizedStandings = parseAPISportsStandings(standings);
  return {
    ...emptyNBAData(),
    matches: matches.sort((a, b) => (a.startsAt || a.date).localeCompare(b.startsAt || b.date)),
    standings: normalizedStandings,
    coverage: { unclassifiedGames: matches.filter((game) => game.category === 'unknown').length },
    update: { status: 'success', at: now.toISOString(), provider: 'API-Sports' }
  };
}

async function requestAPISports(path, params, apiKey, fetchImpl) {
  const url = new URL(path, API_SPORTS_NBA_BASE_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetchImpl(url, { headers: { ...NBA_HEADERS, 'x-apisports-key': apiKey } });
  if (!response.ok) throw new Error(`API-Sports応答エラー (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload.response)) throw new Error(payload.errors && Object.keys(payload.errors).length ? 'API-Sportsがデータ取得を拒否しました' : 'API-Sportsの応答に試合データがありません');
  return payload.response;
}

export async function fetchFreshNBAData(fetchImpl = fetch, now = new Date(), env = {}) {
  if (!env.NBA_API_KEY) throw new Error('STG WorkerにNBA_API_KEY Secretが設定されていません');
  const games = await requestAPISports('/games', { league: 'standard', season: NBA_SEASON_YEAR }, env.NBA_API_KEY, fetchImpl);
  const standings = await requestAPISports('/standings', { league: 'standard', season: NBA_SEASON_YEAR }, env.NBA_API_KEY, fetchImpl);
  return normalizeAPISportsSeason(games, standings, now);
}

export async function performNBAUpdate(env, now = new Date(), fetchImpl = fetch) {
  const previous = await env.SPORTAL_DATA.get(NBA_DATA_KEY, 'json') || emptyNBAData();
  try {
    const data = await fetchFreshNBAData(fetchImpl, now, env);
    await env.SPORTAL_DATA.put(NBA_DATA_KEY, JSON.stringify(data));
    return data;
  } catch (error) {
    const failed = { ...previous, update: { ...previous.update, status: 'failure', at: now.toISOString(), message: error instanceof Error ? error.message : '更新に失敗しました' } };
    await env.SPORTAL_DATA.put(NBA_DATA_KEY, JSON.stringify(failed));
    throw Object.assign(new Error(failed.update.message), { data: failed });
  }
}
