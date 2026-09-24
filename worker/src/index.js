import { emptyNpbData, performNpbUpdate } from './npb.js';
import { B_UPDATE_PARTS, BLEAGUES, BLEAGUE_KEYS, applyMatchResultsToStandings, emptyBLeagueData, performBLeagueUpdate } from './b_league.js';

const SEASON = '2026';
const LEAGUE_DEFINITIONS = {
  j1: { label: 'J1', schedulePath: 'j1', dataKey: 'j1-2026' },
  j2: { label: 'J2', schedulePath: 'j2', dataKey: 'j2-2026' },
  j3: { label: 'J3', schedulePath: 'j3', dataKey: 'j3-2026' }
};

export const CONFIG = {
  season: SEASON,
  league: 'j1',
  scheduleUrl: 'https://www.jleague.jp/j1/match/search-list/?category=j1&startdate=2026-01-01&enddate=2026-12-31',
  standingsUrl: 'https://www.jleague.jp/j1/standings/',
  dataKey: LEAGUE_DEFINITIONS.j1.dataKey,
  label: LEAGUE_DEFINITIONS.j1.label,
  schedulePath: LEAGUE_DEFINITIONS.j1.schedulePath
};

export const LEAGUE_KEYS = Object.keys(LEAGUE_DEFINITIONS);
export const LEAGUES = Object.fromEntries(LEAGUE_KEYS.map((league) => [league, {
  ...LEAGUE_DEFINITIONS[league],
  season: SEASON,
  league,
  scheduleUrl: `https://www.jleague.jp/${LEAGUE_DEFINITIONS[league].schedulePath}/match/search-list/?category=${league}&startdate=${SEASON}-01-01&enddate=${SEASON}-12-31`,
  standingsUrl: `https://www.jleague.jp/${LEAGUE_DEFINITIONS[league].schedulePath}/standings/`
}]));

export function getLeagueConfig(league = CONFIG.league) { return LEAGUES[league] || null; }

export function scheduleUrls(year = CONFIG.season, config = CONFIG) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const lastDay = new Date(Date.UTC(Number(year), month, 0)).getUTCDate();
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    return `${config.scheduleUrl.split('&startdate=')[0]}&startdate=${first}&enddate=${last}`;
  });
}

const J1_TEAM_NAMES = [
  ['ＦＣ町田ゼルビア', '町田'], ['ヴィッセル神戸', '神戸'], ['鹿島アントラーズ', '鹿島'], ['柏レイソル', '柏'],
  ['サンフレッチェ広島', '広島'], ['ＦＣ東京', 'FC東京'], ['横浜Ｆ・マリノス', '横浜FM'], ['ファジアーノ岡山', '岡山'],
  ['セレッソ大阪', 'Ｃ大阪'], ['川崎フロンターレ', '川崎Ｆ'], ['水戸ホーリーホック', '水戸'], ['浦和レッズ', '浦和'],
  ['ガンバ大阪', 'Ｇ大阪'], ['名古屋グランパス', '名古屋'], ['京都サンガF.C.', '京都'], ['アビスパ福岡', '福岡'],
  ['清水エスパルス', '清水'], ['Ｖ・ファーレン長崎', '長崎'], ['東京ヴェルディ', '東京Ｖ'], ['ジェフユナイテッド千葉', '千葉']
];
const OTHER_TEAM_NAMES = [
  ['北海道コンサドーレ札幌', '札幌'], ['ヴァンラーレ八戸', '八戸'], ['モンテディオ山形', '山形'], ['いわきＦＣ', 'いわき'],
  ['ＲＢ大宮アルディージャ', '大宮'], ['横浜ＦＣ', '横浜FC'], ['湘南ベルマーレ', '湘南'], ['カターレ富山', '富山'],
  ['ベガルタ仙台', '仙台'], ['アルビレックス新潟', '新潟'], ['藤枝ＭＹＦＣ', '藤枝'], ['サガン鳥栖', '鳥栖'],
  ['栃木シティ', '栃木Ｃ'], ['大分トリニータ', '大分'], ['徳島ヴォルティス', '徳島'], ['愛媛ＦＣ', '愛媛'],
  ['ＦＣ今治', '今治'], ['レノファ山口ＦＣ', '山口'], ['ブラウブリッツ秋田', '秋田'], ['福島ユナイテッドＦＣ', '福島'],
  ['鹿児島ユナイテッドＦＣ', '鹿児島'], ['ＦＣ琉球', '琉球'], ['ロアッソ熊本', '熊本'], ['ヴァンフォーレ甲府', '甲府'],
  ['高知ユナイテッドＳＣ', '高知'], ['ＳＣ相模原', '相模原'], ['松本山雅ＦＣ', '松本'], ['カマタマーレ讃岐', '讃岐'],
  ['ギラヴァンツ北九州', '北九州'], ['ザスパ群馬', '群馬'], ['ＦＣ岐阜', '岐阜'], ['ＦＣ大阪', 'FC大阪'],
  ['ガイナーレ鳥取', '鳥取'], ['ＡＣ長野パルセイロ', '長野'], ['奈良クラブ', '奈良'], ['ツエーゲン金沢', '金沢'],
  ['レイラック滋賀ＦＣ', '滋賀'], ['栃木ＳＣ', '栃木SC'], ['テゲバジャーロ宮崎', '宮崎'], ['鹿児島ユナイテッドFC', '鹿児島']
];
const TEAM_NAMES = [...J1_TEAM_NAMES, ...OTHER_TEAM_NAMES];
const TEAM_LOOKUP = TEAM_NAMES.flatMap(([name, short]) => [[name, { name, short }], [name.replaceAll('Ｆ', 'F').replaceAll('Ｃ', 'C'), { name, short }], [short, { name, short }]]);
const TEAM_SEARCH_NAMES = [...new Set(TEAM_NAMES.flatMap(([name]) => [name, name.replaceAll('Ｆ', 'F').replaceAll('Ｃ', 'C')]))];
const SOURCE_HEADERS = { 'User-Agent': 'sport-portal/1.0 (+https://www.jleague.jp/)' };

export function emptyData(update = {}, config = CONFIG) {
  return { schemaVersion: 1, league: config.league, season: config.season, matches: [], standings: [], update };
}

function textFromHtml(html) {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
function decodeEntities(value) {
  return value.replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/gi, (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' }[entity.toLowerCase()] || entity));
}
function attrs(value) {
  const result = {};
  for (const match of value.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = decodeEntities(match[2]);
  return result;
}
function attr(data, name) { return data[name] || data[`data-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`]; }
function number(value) {
  const match = String(value ?? '').replace(/−/g, '-').match(/-?\d+/);
  return match ? Number(match[0]) : null;
}
function teamFrom(value) {
  const clean = textFromHtml(value).replace(/[\s　]/g, '');
  const found = TEAM_LOOKUP.find(([key]) => clean.includes(key.replace(/[\s　]/g, '')));
  return found?.[1] || { name: clean, short: clean };
}

function parseExplicitMatches(html) {
  const matches = [];
  const blockPattern = /<(?:article|li|div)[^>]*\b(?:data-match|data-match-id|data-game-id)\b[^>]*>[\s\S]*?<\/(?:article|li|div)>/gi;
  for (const blockMatch of html.matchAll(blockPattern)) {
    const block = blockMatch[0];
    const opening = block.match(/^<[^>]+>/)?.[0] || '';
    const data = attrs(opening);
    const blockText = textFromHtml(block);
    const date = attr(data, 'date') || block.match(/20\d{2}-\d{2}-\d{2}/)?.[0];
    const home = attr(data, 'homeTeam');
    const away = attr(data, 'awayTeam');
    if (!date || !home || !away) continue;
    const finished = attr(data, 'status') === 'finished' || blockText.includes('試合終了');
    matches.push({
      id: attr(data, 'matchId') || `${date}-${home}-${away}`,
      date, matchday: attr(data, 'matchday') || blockText.match(/第\s*(\d+)\s*節/)?.[1] || null,
      kickoff: attr(data, 'kickoff') || blockText.match(/\b(\d{1,2}:\d{2})\b/)?.[1] || null,
      home: teamFrom(home), away: teamFrom(away),
      status: attr(data, 'status') || (finished ? 'finished' : 'scheduled'),
      homeScore: number(attr(data, 'homeScore')) ?? (finished ? number(blockText.match(/(\d+)\s*試合終了/)?.[1]) : null),
      awayScore: number(attr(data, 'awayScore')) ?? (finished ? number(blockText.match(/試合終了\s*(\d+)/)?.[1]) : null)
    });
  }
  return matches;
}

function parseLinkedMatches(html) {
  const matches = [];
  const dateMarkers = [...html.matchAll(/<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi)].map((match) => ({ index: match.index, text: textFromHtml(match[0]) }));
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  for (const anchorMatch of html.matchAll(anchorPattern)) {
    const raw = anchorMatch[0];
    const href = anchorMatch[1];
    if (!/(?:\/match\/|\/game\/)/i.test(href)) continue;
    const plain = textFromHtml(raw);
    const marker = dateMarkers.filter(({ index }) => index < anchorMatch.index).at(-1)?.text || '';
    const markerDate = marker.match(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/);
    const hrefDate = href.match(/\/(20\d{2})\/(\d{2})(\d{2})\d{2}\/?(?:$|[?#])/);
    const currentDate = hrefDate
      ? `${hrefDate[1]}-${hrefDate[2]}-${hrefDate[3]}`
      : markerDate
        ? `${markerDate[1]}-${markerDate[2].padStart(2, '0')}-${markerDate[3].padStart(2, '0')}`
        : null;
    if (!currentDate) continue;
    const currentMatchday = marker.match(/第\s*(\d+)\s*節/)?.[1] || null;
    const time = plain.match(/(\d{1,2}:\d{2})\s*(?:KO)?/i)?.[1] || null;
    const teamPositions = TEAM_SEARCH_NAMES.map((name) => ({ name, index: plain.indexOf(name) })).filter((item) => item.index >= 0).sort((a, b) => a.index - b.index);
    if (teamPositions.length < 2) continue;
    const home = teamFrom(teamPositions[0].name);
    const away = teamFrom(teamPositions[1].name);
    const scoreMatch = plain.match(/(\d+)\s*試合終了\s*(\d+)/);
    const status = plain.includes('試合終了') ? 'finished' : plain.includes('延期') ? 'postponed' : plain.includes('中止') ? 'cancelled' : 'scheduled';
    const id = href.split('/').filter(Boolean).pop() || `${currentDate}-${home.short}-${away.short}`;
    matches.push({ id, date: currentDate, matchday: currentMatchday, kickoff: time, home, away, status, homeScore: scoreMatch ? Number(scoreMatch[1]) : null, awayScore: scoreMatch ? Number(scoreMatch[2]) : null });
  }
  return matches;
}

export function parseScheduleHtml(html, _config = CONFIG) {
  const explicit = parseExplicitMatches(html);
  const parsed = explicit.length ? explicit : parseLinkedMatches(html);
  const unique = new Map(parsed.map((match) => [`${match.date}-${match.home.short}-${match.away.short}-${match.kickoff}`, match]));
  return [...unique.values()].sort((a, b) => `${a.date}${a.kickoff || ''}`.localeCompare(`${b.date}${b.kickoff || ''}`));
}

export function parseStandingsHtml(html) {
  const rows = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((cell) => textFromHtml(cell[1]));
    const rank = number(cells[0]);
    if (!rank || cells.length < 10) continue;
    const team = teamFrom(cells[1]);
    const nums = cells.slice(2).map(number).filter((value) => value !== null);
    if (nums.length < 8) continue;
    // J.League official table order is points, matches, wins, draws, losses, GF, GA, GD.
    rows.push({ rank, team: team.short, points: nums[0], played: nums[1], wins: nums[2], draws: nums[3], losses: nums[4], goalsFor: nums[5], goalsAgainst: nums[6], goalDifference: nums[7] });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

function validMatches(matches) {
  return matches.length > 0 && matches.every((match) => match.date && match.home?.short && match.away?.short && ['scheduled', 'finished', 'postponed', 'cancelled'].includes(match.status));
}
function validStandings(standings) { return standings.length >= 2 && standings.every((row) => Number.isInteger(row.rank) && row.team); }

export async function fetchFreshData(fetchImpl = fetch, now = new Date(), league = CONFIG.league) {
  const config = getLeagueConfig(league);
  if (!config) throw new Error(`未対応のリーグです: ${league}`);
  const schedulePages = [];
  for (const url of scheduleUrls(config.season, config)) {
    const response = await fetchImpl(url, { headers: SOURCE_HEADERS, redirect: 'follow' });
    if (!response.ok) throw new Error(`公式サイトの応答エラー (${response.status}/200)`);
    schedulePages.push(await response.text());
  }
  const standingsResponse = await fetchImpl(config.standingsUrl, { headers: SOURCE_HEADERS, redirect: 'follow' });
  if (!standingsResponse.ok) throw new Error(`公式サイトの応答エラー (200/${standingsResponse.status})`);
  const scheduleHtml = schedulePages.join('\n');
  const standingsHtml = await standingsResponse.text();
  const matches = parseScheduleHtml(scheduleHtml, config);
  const standings = parseStandingsHtml(standingsHtml);
  if (!validMatches(matches)) throw new Error('試合データを抽出できませんでした');
  if (!validStandings(standings)) throw new Error('順位表を抽出できませんでした');
  return { schemaVersion: 1, league: config.league, season: config.season, matches, standings, update: { status: 'success', at: now.toISOString() } };
}

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } }); }
function authorized(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');
    return separator >= 0 && decoded.slice(0, separator) === env.BASIC_AUTH_USER && decoded.slice(separator + 1) === env.BASIC_AUTH_PASSWORD;
  } catch { return false; }
}
function unauthorized() { return new Response('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="sport-portal", charset="UTF-8"', 'Cache-Control': 'no-store' } }); }

const activeUpdatePromises = new Map();
let activeNpbUpdatePromise = null;
const activeBLeagueUpdatePromises = new Map();

async function performUpdateInternal(env, now, fetchImpl, config) {
  const previous = (await env.SPORTAL_DATA?.get(config.dataKey, 'json')) || emptyData({}, config);
  try {
    const data = await fetchFreshData(fetchImpl, now, config.league);
    await env.SPORTAL_DATA.put(config.dataKey, JSON.stringify(data));
    return data;
  } catch (error) {
    const failed = { ...previous, update: { status: 'failure', at: now.toISOString(), message: error instanceof Error ? error.message : '更新に失敗しました' } };
    await env.SPORTAL_DATA.put(config.dataKey, JSON.stringify(failed));
    throw Object.assign(new Error(failed.update.message), { data: failed });
  }
}

export async function performUpdate(env, now = new Date(), fetchImpl = fetch, league = CONFIG.league) {
  const config = getLeagueConfig(league);
  if (!config) throw new Error(`未対応のリーグです: ${league}`);
  // A manual request can be repeated while the first update is in flight.
  // Reuse the promise per league so a failure cannot overwrite a newer write.
  if (activeUpdatePromises.has(config.league)) return activeUpdatePromises.get(config.league);
  const promise = performUpdateInternal(env, now, fetchImpl, config);
  activeUpdatePromises.set(config.league, promise);
  try { return await promise; }
  finally { activeUpdatePromises.delete(config.league); }
}

export default {
  async fetch(request, env) {
    if (!authorized(request, env)) return unauthorized();
    const url = new URL(request.url);
    if (url.pathname === '/api/npb/data' && request.method === 'GET') {
      return json((await env.SPORTAL_DATA.get('npb-2026', 'json')) || emptyNpbData());
    }
    if (url.pathname === '/api/npb/status' && request.method === 'GET') {
      const data = (await env.SPORTAL_DATA.get('npb-2026', 'json')) || emptyNpbData();
      return json({ update: data.update, hasData: data.matches.length > 0 || data.standings.central.rows.length > 0 || data.standings.pacific.rows.length > 0 });
    }
    if (url.pathname === '/api/npb/update' && request.method === 'POST') {
      if (!activeNpbUpdatePromise) activeNpbUpdatePromise = performNpbUpdate(env, new Date(), fetch).finally(() => { activeNpbUpdatePromise = null; });
      try { return json({ data: await activeNpbUpdatePromise }); }
      catch (error) { return json({ error: error.message, data: error.data }, 502); }
    }
    if (url.pathname === '/api/b-league/data' && request.method === 'GET') {
      const league = url.searchParams.get('league') || 'premier';
      if (!BLEAGUE_KEYS.includes(league)) return json({ error: `未対応のBリーグカテゴリーです: ${league}` }, 400);
      const data = (await env.SPORTAL_DATA.get(BLEAGUES[league].dataKey, 'json')) || emptyBLeagueData(league);
      return json({ ...data, standings: applyMatchResultsToStandings(data.standings, data.matches, { league }) });
    }
    if (url.pathname === '/api/b-league/status' && request.method === 'GET') {
      const league = url.searchParams.get('league') || 'premier';
      if (!BLEAGUE_KEYS.includes(league)) return json({ error: `未対応のBリーグカテゴリーです: ${league}` }, 400);
      const data = (await env.SPORTAL_DATA.get(BLEAGUES[league].dataKey, 'json')) || emptyBLeagueData(league);
      return json({ update: data.update, hasData: data.matches.length > 0 || data.standings.zones.length > 0 });
    }
    if (url.pathname === '/api/b-league/update' && request.method === 'POST') {
      const league = url.searchParams.get('league') || 'premier';
      if (!BLEAGUE_KEYS.includes(league)) return json({ error: `未対応のBリーグカテゴリーです: ${league}` }, 400);
      const rawPart = url.searchParams.get('part');
      const part = rawPart === null ? null : Number(rawPart);
      if (rawPart !== null && (!Number.isInteger(part) || part < 0 || part >= B_UPDATE_PARTS)) return json({ error: `Bリーグ更新パートが不正です: ${rawPart}` }, 400);
      const updateKey = `${league}:${part === null ? 'full' : part}`;
      if (!activeBLeagueUpdatePromises.has(updateKey)) activeBLeagueUpdatePromises.set(updateKey, performBLeagueUpdate(env, new Date(), fetch, league, { part, totalParts: B_UPDATE_PARTS }).finally(() => activeBLeagueUpdatePromises.delete(updateKey)));
      try { return json({ data: await activeBLeagueUpdatePromises.get(updateKey) }); }
      catch (error) { return json({ error: error.message, data: error.data }, 502); }
    }
    const league = url.searchParams.get('league') || CONFIG.league;
    const config = getLeagueConfig(league);
    if (!config) return json({ error: `未対応のリーグです: ${league}` }, 400);
    if (url.pathname === '/api/data' && request.method === 'GET') return json((await env.SPORTAL_DATA.get(config.dataKey, 'json')) || emptyData({}, config));
    if (url.pathname === '/api/status' && request.method === 'GET') {
      const data = (await env.SPORTAL_DATA.get(config.dataKey, 'json')) || emptyData({}, config);
      return json({ update: data.update, hasData: data.matches.length > 0 || data.standings.length > 0 });
    }
    if (url.pathname === '/api/update' && request.method === 'POST') {
      try { return json({ data: await performUpdate(env, new Date(), fetch, league) }); }
      catch (error) { return json({ error: error.message, data: error.data }, 502); }
    }
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
};
