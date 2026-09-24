const SEASON = '2026-27';
const START_YEAR = 2026;
const SOURCE = 'https://www.bleague.jp';
const SCHEDULE = `${SOURCE}/schedule/`;
const STANDINGS = `${SOURCE}/standings/`;
const LEAGUE_DEFINITIONS = {
  premier: { label: 'Bプレミア', tab: '1', dataKey: 'b-premier-2026-27', zones: ['東地区', '西地区'] },
  one: { label: 'Bワン', tab: '2', dataKey: 'b-one-2026-27', zones: ['北地区', '東地区', '中地区', '西地区', '南地区'] },
  next: { label: 'Bネクスト', tab: '3', dataKey: 'b-next-2026-27', zones: ['1地区'] }
};

export const BLEAGUE_KEYS = Object.keys(LEAGUE_DEFINITIONS);
export const BLEAGUES = Object.fromEntries(BLEAGUE_KEYS.map((league) => [league, { ...LEAGUE_DEFINITIONS[league], league, season: SEASON }]));
export const B_CONFIG = BLEAGUES.premier;

const HEADERS = { 'User-Agent': 'sport-portal/1.0 (+https://www.bleague.jp)', Accept: 'text/html,application/xhtml+xml' };
const MONTHS = [
  [2026, 9], [2026, 10], [2026, 11], [2026, 12],
  [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5]
];
export const B_UPDATE_PARTS = MONTHS.length;

function htmlText(value) {
  return String(value ?? '').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#x3000;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/[\s\u3000]+/g, ' ').trim();
}
function attrs(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = match[2];
  return result;
}
function unescape(value) { return htmlText(value); }
function number(value) { const match = String(value ?? '').replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0)).match(/-?\d+/); return match ? Number(match[0]) : null; }
function seasonDate(year, month, day) { return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function unique(items, key) { return [...new Map(items.map((item) => [key(item), item])).values()]; }

export function emptyBLeagueData(league = 'premier', update = {}) {
  const config = BLEAGUES[league] || B_CONFIG;
  return { schemaVersion: 1, sport: 'b-league', league: config.league, season: SEASON, matches: [], standings: { zones: [], wildcard: [], status: 'unavailable' }, postseason: { status: 'unavailable', rounds: [] }, update };
}

function parseDateButtons(html, year, month) {
  const dates = [];
  for (const match of html.matchAll(/class=["'][^"']*js-schedule-date-slider-item[^"']*[\s\S]*?data-day=["'](\d{1,2})["'][\s\S]*?<\/div>/gi)) dates.push(seasonDate(year, month, Number(match[1])));
  return unique(dates, (value) => value).sort();
}

function parseStatus(text, homeScore, awayScore) {
  if (/中止/.test(text)) return 'cancelled';
  if (/延期|順延/.test(text)) return 'postponed';
  if (/試合終了|FINAL|試合終了後/.test(text) && homeScore !== null && awayScore !== null) return 'finished';
  return 'scheduled';
}

export function parseScheduleHtml(html, { year = 2026, month = 9, day = null, league = 'premier' } = {}) {
  const matches = [];
  const listPattern = /<li\b[^>]*class=["'][^"']*list-item[^"']*["'][^>]*id=["'](\d+)["'][^>]*>[\s\S]*?<\/li>/gi;
  for (const match of html.matchAll(listPattern)) {
    const block = match[0];
    const text = htmlText(block);
    const id = match[1];
    const homeMatch = block.match(/class=["'][^"']*team home[^"']*["'][\s\S]*?class=["'][^"']*team-name[^"']*["'][^>]*>([\s\S]*?)<\//i);
    const awayMatch = block.match(/class=["'][^"']*team away[^"']*["'][\s\S]*?class=["'][^"']*team-name[^"']*["'][^>]*>([\s\S]*?)<\//i);
    const teams = [homeMatch?.[1], awayMatch?.[1]].map((value) => value ? unescape(value) : '').filter(Boolean);
    if (teams.length !== 2) continue;
    const arena = block.match(/class=["'][^"']*info-arena[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
    const arenaText = htmlText(arena);
    const kickoff = arenaText.match(/\b(\d{1,2}:\d{2})\b/)?.[1] || null;
    const venue = arenaText.replace(/\b\d{1,2}:\d{2}\b/g, '').replace(/^\s*\|\s*/, '').trim() || null;
    const scores = [...block.matchAll(/(?:home-score|home[^>]*score)[^>]*>(?:\s*<[^>]+>)*\s*(\d+)/gi)].map((item) => Number(item[1]));
    const pointText = block.match(/class=["'][^"']*point[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '';
    const pointNumbers = [...htmlText(pointText).matchAll(/\d+/g)].map((item) => Number(item[0]));
    const allScores = scores.length >= 2 ? scores : pointNumbers.slice(0, 2);
    const homeScore = Number.isInteger(allScores[0]) ? allScores[0] : null;
    const awayScore = Number.isInteger(allScores[1]) ? allScores[1] : null;
    const status = parseStatus(text, homeScore, awayScore);
    matches.push({ id, date: seasonDate(year, month, Number(day || text.match(/(?:^|\s)(\d{1,2})日/)?.[1] || 1)), league, home: { short: teams[0], name: teams[0] }, away: { short: teams[1], name: teams[1] }, kickoff, venue, matchday: text.match(/第\s*(\d+)\s*節/)?.[1] || null, status, homeScore: status === 'finished' ? homeScore : null, awayScore: status === 'finished' ? awayScore : null, competition: text.match(/(B\.PREMIER|B\.ONE|B\.NEXT|プレーオフ|ファイナル)/i)?.[1] || 'レギュラーシーズン' });
  }
  return matches;
}

function parseTeamName(cell) { const text = htmlText(cell).replace(/詳細$/, '').trim(); return text.split(/\s+/).at(-1) || text; }
function parseTableRows(table) {
  const rows = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map((cell) => htmlText(cell[1]));
    if (cells.length < 6 || !cells[1] || cells[1] === 'クラブ') continue;
    rows.push({ rank: /^\d+$/.test(cells[0]) ? Number(cells[0]) : null, team: parseTeamName(cells[1]), wins: number(cells[2]), losses: number(cells[3]), winPercentage: cells[4] === '-' ? null : cells[4], gamesBehind: cells[5] === '-' ? null : number(cells[5]), pointsFor: number(cells[6]), pointsAgainst: number(cells[7]), pointDifference: number(cells[8]), played: number(cells[13]), remaining: null });
  }
  return rows;
}

export function parseStandingsHtml(html, { league = 'premier' } = {}) {
  const zones = [];
  const headingPattern = /<h3[^>]*>([^<]*(?:地区|地域)[^<]*)<\/h3>[\s\S]*?<table\b[\s\S]*?<\/table>/gi;
  for (const match of html.matchAll(headingPattern)) {
    const name = htmlText(match[1]);
    const table = match[0].match(/<table\b[\s\S]*?<\/table>/i)?.[0];
    if (!table) continue;
    const rows = parseTableRows(table);
    if (rows.length) zones.push({ name, rows });
  }
  if (!zones.length && league === 'next') {
    const table = html.match(/<table\b[^>]*class=["'][^"']*table-standings[^"']*["'][\s\S]*?<\/table>/i)?.[0];
    const rows = table ? parseTableRows(table) : [];
    if (rows.length) zones.push({ name: '1地区', rows });
  }
  const known = BLEAGUES[league]?.zones || [];
  const ordered = known.map((name) => zones.find((zone) => zone.name.includes(name))).filter(Boolean);
  const allRows = ordered.flatMap((zone) => zone.rows);
  const wildcard = league === 'premier' ? allRows.filter((row) => row.rank > 3) : league === 'one' ? allRows.filter((row) => row.rank > 2) : [];
  return { zones: ordered, wildcard, status: ordered.length ? 'success' : 'unavailable' };
}

async function getText(fetchImpl, url) { const response = await fetchImpl(url, { headers: HEADERS, redirect: 'follow' }); if (!response.ok) throw new Error(`Bリーグ公式サイトの応答エラー (${response.status})`); return response.text(); }
async function getJson(fetchImpl, url) { const response = await fetchImpl(url, { headers: HEADERS, redirect: 'follow' }); if (!response.ok) throw new Error(`Bリーグ日程JSONの応答エラー (${response.status})`); return response.json(); }
async function getJsonWithRetry(fetchImpl, url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await getJson(fetchImpl, url); }
    catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function fetchMonthMatches(fetchImpl, year, month, config) {
  const monthUrl = `${SCHEDULE}?year=${year}&mon=${String(month).padStart(2, '0')}&day=all&tab=${config.tab}`;
  const monthHtml = await getText(fetchImpl, monthUrl);
  const dates = parseDateButtons(monthHtml, year, month);
  const pages = [];
  for (let index = 0; index < dates.length; index += 6) {
    const batch = dates.slice(index, index + 6);
    pages.push(...await Promise.all(batch.map(async (date) => {
      const day = Number(date.slice(-2));
      const url = `${SCHEDULE}?data_format=json&year=${year}&mon=${String(month).padStart(2, '0')}&day=${day}&event=&club=&tab=${config.tab}&ha=&fb=&index=0`;
      const json = await getJsonWithRetry(fetchImpl, url);
      return (json.topics || []).map((topic) => parseScheduleHtml(topic, { year, month, day, league: config.league }));
    })));
  }
  return pages.flat(2);
}

export async function fetchFreshBLeagueData(fetchImpl = fetch, now = new Date(), league = 'premier', { monthIndexes = null, includeStandings = true, allowEmptyMatches = false } = {}) {
  const config = BLEAGUES[league];
  if (!config) throw new Error(`未対応のBリーグカテゴリーです: ${league}`);
  const matchPages = [];
  const months = monthIndexes ? monthIndexes.map((index) => MONTHS[index]).filter(Boolean) : MONTHS;
  for (const [year, month] of months) matchPages.push(await fetchMonthMatches(fetchImpl, year, month, config));
  const matches = unique(matchPages.flat(), (match) => `${match.id}-${match.date}`).sort((a, b) => `${a.date}${a.kickoff || ''}`.localeCompare(`${b.date}${b.kickoff || ''}`));
  const standingsHtml = includeStandings ? await getText(fetchImpl, `${STANDINGS}?tab=${config.tab}&year=${START_YEAR}`) : null;
  const standings = standingsHtml ? parseStandingsHtml(standingsHtml, { league }) : { zones: [], wildcard: [], status: 'partial' };
  if (!allowEmptyMatches && !matches.length) throw new Error('Bリーグの試合日程を抽出できませんでした');
  if (includeStandings && standings.status !== 'success') throw new Error('Bリーグの順位表を抽出できませんでした');
  return { schemaVersion: 1, sport: 'b-league', league, season: SEASON, matches, standings, postseason: { status: 'unavailable', rounds: [], note: 'ポストシーズンの日程・結果は公式発表の取得範囲を確認中です' }, update: { status: 'success', at: now.toISOString() } };
}

export async function performBLeagueUpdate(env, now = new Date(), fetchImpl = fetch, league = 'premier', { part = null, totalParts = B_UPDATE_PARTS } = {}) {
  const config = BLEAGUES[league];
  if (!config) throw new Error(`未対応のBリーグカテゴリーです: ${league}`);
  const previous = (await env.SPORTAL_DATA?.get(config.dataKey, 'json')) || emptyBLeagueData(league);
  const isPartitioned = Number.isInteger(part);
  if (isPartitioned && (part < 0 || part >= totalParts)) throw new Error(`Bリーグ更新パートが不正です: ${part}`);
  const partialKey = `${config.dataKey}:part:${part}`;
  try {
    if (isPartitioned && part === 0) await Promise.all(Array.from({ length: totalParts }, (_, index) => env.SPORTAL_DATA.delete(`${config.dataKey}:part:${index}`)));
    const data = await fetchFreshBLeagueData(fetchImpl, now, league, { monthIndexes: isPartitioned ? [part] : null, includeStandings: !isPartitioned || part === totalParts - 1, allowEmptyMatches: isPartitioned });
    if (isPartitioned && part < totalParts - 1) {
      await env.SPORTAL_DATA.put(partialKey, JSON.stringify({ matches: data.matches }));
      return { ...data, standings: { zones: [], wildcard: [], status: 'partial' }, update: { status: 'partial', part, totalParts, at: now.toISOString() } };
    }
    if (isPartitioned) {
      const partials = await Promise.all(Array.from({ length: totalParts - 1 }, (_, index) => env.SPORTAL_DATA.get(`${config.dataKey}:part:${index}`, 'json')));
      const matches = unique([...(partials.flatMap((item) => item?.matches || [])), ...data.matches], (match) => `${match.id}-${match.date}`).sort((a, b) => `${a.date}${a.kickoff || ''}`.localeCompare(`${b.date}${b.kickoff || ''}`));
      if (!matches.length) throw new Error('Bリーグの分割更新結果が空です');
      const complete = { ...data, matches, update: { status: 'success', at: now.toISOString() } };
      await env.SPORTAL_DATA.put(config.dataKey, JSON.stringify(complete));
      await Promise.all(Array.from({ length: totalParts }, (_, index) => env.SPORTAL_DATA.delete(`${config.dataKey}:part:${index}`)));
      return complete;
    }
    await env.SPORTAL_DATA.put(config.dataKey, JSON.stringify(data));
    return data;
  } catch (error) {
    if (isPartitioned) throw Object.assign(new Error(error instanceof Error ? error.message : 'Bリーグ更新に失敗しました'), { data: previous });
    const failed = { ...previous, update: { status: 'failure', at: now.toISOString(), message: error instanceof Error ? error.message : 'Bリーグ更新に失敗しました' } };
    await env.SPORTAL_DATA.put(config.dataKey, JSON.stringify(failed));
    throw Object.assign(new Error(failed.update.message), { data: failed });
  }
}
