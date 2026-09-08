export const CONFIG = {
  season: '2026',
  league: 'j1',
  scheduleUrl: 'https://www.jleague.jp/j1/match/search-list/?category=j1&startdate=2026-01-01&enddate=2026-12-31',
  standingsUrl: 'https://www.jleague.jp/j1/standings/',
  dataKey: 'j1-2026'
};

export function scheduleUrls(year = CONFIG.season) {
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const lastDay = new Date(Date.UTC(Number(year), month, 0)).getUTCDate();
    const first = `${year}-${String(month).padStart(2, '0')}-01`;
    const last = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    return `${CONFIG.scheduleUrl.split('&startdate=')[0]}&startdate=${first}&enddate=${last}`;
  });
}

const TEAM_NAMES = [
  ['ＦＣ町田ゼルビア', '町田'], ['ヴィッセル神戸', '神戸'], ['鹿島アントラーズ', '鹿島'], ['柏レイソル', '柏'],
  ['サンフレッチェ広島', '広島'], ['ＦＣ東京', 'FC東京'], ['横浜Ｆ・マリノス', '横浜FM'], ['ファジアーノ岡山', '岡山'],
  ['セレッソ大阪', 'Ｃ大阪'], ['川崎フロンターレ', '川崎Ｆ'], ['水戸ホーリーホック', '水戸'], ['浦和レッズ', '浦和'],
  ['ガンバ大阪', 'Ｇ大阪'], ['名古屋グランパス', '名古屋'], ['京都サンガF.C.', '京都'], ['アビスパ福岡', '福岡'],
  ['清水エスパルス', '清水'], ['Ｖ・ファーレン長崎', '長崎'], ['東京ヴェルディ', '東京Ｖ'], ['ジェフユナイテッド千葉', '千葉']
];
const TEAM_LOOKUP = TEAM_NAMES.flatMap(([name, short]) => [[name, { name, short }], [name.replaceAll('Ｆ', 'F').replaceAll('Ｃ', 'C'), { name, short }], [short, { name, short }]]);
const SOURCE_HEADERS = { 'User-Agent': 'sport-portal/1.0 (+https://www.jleague.jp/)' };

export function emptyData(update = {}) {
  return { schemaVersion: 1, league: CONFIG.league, season: CONFIG.season, matches: [], standings: [], update };
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
    const teamPositions = TEAM_NAMES.map(([name]) => ({ name, index: plain.indexOf(name) })).filter((item) => item.index >= 0).sort((a, b) => a.index - b.index);
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

export function parseScheduleHtml(html) {
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

export async function fetchFreshData(fetchImpl = fetch, now = new Date()) {
  const schedulePages = [];
  for (const url of scheduleUrls()) {
    const response = await fetchImpl(url, { headers: SOURCE_HEADERS, redirect: 'follow' });
    if (!response.ok) throw new Error(`公式サイトの応答エラー (${response.status}/200)`);
    schedulePages.push(await response.text());
  }
  const standingsResponse = await fetchImpl(CONFIG.standingsUrl, { headers: SOURCE_HEADERS, redirect: 'follow' });
  if (!standingsResponse.ok) throw new Error(`公式サイトの応答エラー (200/${standingsResponse.status})`);
  const scheduleHtml = schedulePages.join('\n');
  const standingsHtml = await standingsResponse.text();
  const matches = parseScheduleHtml(scheduleHtml);
  const standings = parseStandingsHtml(standingsHtml);
  if (!validMatches(matches)) throw new Error('試合データを抽出できませんでした');
  if (!validStandings(standings)) throw new Error('順位表を抽出できませんでした');
  return { schemaVersion: 1, league: CONFIG.league, season: CONFIG.season, matches, standings, update: { status: 'success', at: now.toISOString() } };
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

let activeUpdatePromise = null;

async function performUpdateInternal(env, now, fetchImpl) {
  const previous = (await env.SPORTAL_DATA?.get(CONFIG.dataKey, 'json')) || emptyData();
  try {
    const data = await fetchFreshData(fetchImpl, now);
    await env.SPORTAL_DATA.put(CONFIG.dataKey, JSON.stringify(data));
    return data;
  } catch (error) {
    const failed = { ...previous, update: { status: 'failure', at: now.toISOString(), message: error instanceof Error ? error.message : '更新に失敗しました' } };
    await env.SPORTAL_DATA.put(CONFIG.dataKey, JSON.stringify(failed));
    throw Object.assign(new Error(failed.update.message), { data: failed });
  }
}

export async function performUpdate(env, now = new Date(), fetchImpl = fetch) {
  // A scheduled event and a manual request can share an isolate. Reuse the
  // in-flight operation so a failure cannot overwrite a newer successful write.
  if (activeUpdatePromise) return activeUpdatePromise;
  activeUpdatePromise = performUpdateInternal(env, now, fetchImpl);
  try { return await activeUpdatePromise; }
  finally { activeUpdatePromise = null; }
}

export default {
  async fetch(request, env) {
    if (!authorized(request, env)) return unauthorized();
    const url = new URL(request.url);
    if (url.pathname === '/api/data' && request.method === 'GET') return json((await env.SPORTAL_DATA.get(CONFIG.dataKey, 'json')) || emptyData());
    if (url.pathname === '/api/status' && request.method === 'GET') {
      const data = (await env.SPORTAL_DATA.get(CONFIG.dataKey, 'json')) || emptyData();
      return json({ update: data.update, hasData: data.matches.length > 0 || data.standings.length > 0 });
    }
    if (url.pathname === '/api/update' && request.method === 'POST') {
      try { return json({ data: await performUpdate(env) }); }
      catch (error) { return json({ error: error.message, data: error.data }, 502); }
    }
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  },
  async scheduled(_event, env, ctx) { ctx.waitUntil(performUpdate(env).catch(() => undefined)); }
};
