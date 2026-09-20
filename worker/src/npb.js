const SEASON = '2026';
const BASE_URL = `https://npb.jp/games/${SEASON}`;
const NPBCONFIG = {
  season: SEASON,
  dataKey: 'npb-2026',
  centralStandingsUrl: `https://npb.jp/bis/${SEASON}/stats/std_c.html`,
  pacificStandingsUrl: `https://npb.jp/bis/${SEASON}/stats/std_p.html`,
  csInfoUrl: `${BASE_URL}/info_cs.html`,
  scheduleMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11]
};
const JAPAN_SERIES_DATES = ['2026-10-24', '2026-10-25', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-31', '2026-11-01'];

const TEAM_DEFINITIONS = [
  { code: 't', league: 'central', name: '阪神タイガース', short: '阪神', aliases: ['阪神タイガース', '阪神'] },
  { code: 'g', league: 'central', name: '読売ジャイアンツ', short: '巨人', aliases: ['読売ジャイアンツ', 'ジャイアンツ', '巨人'] },
  { code: 'db', league: 'central', name: '横浜DeNAベイスターズ', short: 'DeNA', aliases: ['横浜DeNAベイスターズ', 'DeNAベイスターズ', '横浜DeNA', 'DeNA'] },
  { code: 's', league: 'central', name: '東京ヤクルトスワローズ', short: 'ヤクルト', aliases: ['東京ヤクルトスワローズ', 'ヤクルトスワローズ', 'ヤクルト'] },
  { code: 'd', league: 'central', name: '中日ドラゴンズ', short: '中日', aliases: ['中日ドラゴンズ', '中日'] },
  { code: 'c', league: 'central', name: '広島東洋カープ', short: '広島', aliases: ['広島東洋カープ', '広島カープ', '広島'] },
  { code: 'h', league: 'pacific', name: '福岡ソフトバンクホークス', short: 'ソフトバンク', aliases: ['福岡ソフトバンクホークス', 'ソフトバンクホークス', 'ソフトバンク'] },
  { code: 'l', league: 'pacific', name: '埼玉西武ライオンズ', short: '西武', aliases: ['埼玉西武ライオンズ', '西武ライオンズ', '西武'] },
  { code: 'f', league: 'pacific', name: '北海道日本ハムファイターズ', short: '日本ハム', aliases: ['北海道日本ハムファイターズ', '日本ハムファイターズ', '日本ハム'] },
  { code: 'b', league: 'pacific', name: 'オリックス・バファローズ', short: 'オリックス', aliases: ['オリックス・バファローズ', 'オリックスバファローズ', 'オリックス'] },
  { code: 'm', league: 'pacific', name: '千葉ロッテマリーンズ', short: 'ロッテ', aliases: ['千葉ロッテマリーンズ', 'ロッテマリーンズ', 'ロッテ'] },
  { code: 'e', league: 'pacific', name: '東北楽天ゴールデンイーグルス', short: '楽天', aliases: ['東北楽天ゴールデンイーグルス', '楽天ゴールデンイーグルス', '楽天'] }
];
const TEAMS_BY_ALIAS = TEAM_DEFINITIONS.flatMap((team) => team.aliases.map((alias) => [alias, team])).sort((a, b) => b[0].length - a[0].length);
const TEAM_BY_CODE = Object.fromEntries(TEAM_DEFINITIONS.map((team) => [team.code, team]));
const ABBREVIATION_TO_CODE = {
  '対神': 't', '対巨': 'g', '対デ': 'db', '対ヤ': 's', '対中': 'd', '対広': 'c',
  '対ソ': 'h', '対西': 'l', '対日': 'f', '対オ': 'b', '対ロ': 'm', '対楽': 'e'
};
const HEADERS = { 'User-Agent': 'sport-portal/1.0', Accept: 'text/html,application/xhtml+xml' };

export function emptyNpbData(update = {}) {
  return {
    schemaVersion: 1,
    sport: 'npb',
    season: SEASON,
    matches: [],
    standings: { central: { rows: [], headToHead: [], interleague: [] }, pacific: { rows: [], headToHead: [], interleague: [] } },
    postseason: { cs: { rules: null, schedule: [] }, japanSeries: { schedule: [] } },
    update
  };
}

function decodeEntities(value) {
  return String(value ?? '').replace(/&(#x?[\da-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, code) => {
    const lower = code.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    if (lower === 'nbsp') return ' ';
    if (lower.startsWith('#')) {
      const hex = lower[1] === 'x';
      const point = Number.parseInt(lower.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return entity;
  });
}

function htmlText(value) {
  return decodeEntities(String(value ?? '')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img\b([^>]*)>/gi, (_tag, attrs) => ` ${attrs.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] || ''} `)
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[\s\u3000\u00a0]+/g, ' ')
    .trim();
}

function htmlAttributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)) result[match[1].toLowerCase()] = decodeEntities(match[2]);
  return result;
}

function tableBlocks(html) { return [...String(html).matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]); }
function tableRows(table) {
  return [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => ({
    html: row[0],
    cells: [...row[1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map((cell) => ({ html: cell[3], text: htmlText(cell[3]), attrs: htmlAttributes(cell[2]) }))
  }));
}
function normalizeDigits(value) { return String(value ?? '').replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0)); }
function jstToday(now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(now); }
function teamForAlias(alias) {
  const team = TEAMS_BY_ALIAS.find(([candidate]) => candidate === alias)?.[1];
  return team ? { code: team.code, league: team.league, name: team.name, short: team.short } : null;
}

function findTeams(cardText) {
  const text = cardText.replace(/[\s\u3000]/g, '');
  const hits = [];
  const occupied = [];
  for (const [alias, team] of TEAMS_BY_ALIAS) {
    const needle = alias.replace(/[\s\u3000]/g, '');
    let from = 0;
    while (from < text.length) {
      const index = text.indexOf(needle, from);
      if (index < 0) break;
      const end = index + needle.length;
      if (!occupied.some(([start, stop]) => index < stop && end > start) && !hits.some((hit) => hit.team.code === team.code)) {
        hits.push({ index, end, team });
        occupied.push([index, end]);
      }
      from = end;
    }
  }
  return hits.sort((a, b) => a.index - b.index).map((hit) => ({ code: hit.team.code, league: hit.team.league, name: hit.team.name, short: hit.team.short }));
}

function normalizeDate(value, month, season = SEASON) {
  const text = normalizeDigits(value);
  const match = text.match(/^\s*(?:(20\d{2})\s*[年/.-]\s*)?(\d{1,2})\s*[月/.-]\s*(\d{1,2})\s*日?/);
  if (!match) return null;
  const year = match[1] || season;
  const parsedMonth = Number(match[2]);
  const day = Number(match[3]);
  if (parsedMonth < 1 || parsedMonth > 12 || day < 1 || day > 31 || (month && parsedMonth !== month)) return null;
  return `${year}-${String(parsedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseStatus(cardText, noteText, score, date, now) {
  const combined = `${cardText} ${noteText}`;
  if (/中止/.test(combined)) return 'cancelled';
  if (/延期|順延/.test(combined)) return 'postponed';
  if (/ノーゲーム/.test(combined)) return 'unplayed';
  if (/試合終了|ゲームセット/.test(combined)) return 'finished';
  if (/試合中|回表|回裏|延長\d*回/.test(combined)) return 'inProgress';
  if (score) return date < jstToday(now) ? 'finished' : 'inProgress';
  return date < jstToday(now) ? 'unplayed' : 'scheduled';
}

function parseScore(text) {
  const normalized = normalizeDigits(text).replace(/[＊*]/g, ' ');
  const match = normalized.match(/(?:^|\s)(\d{1,2})\s*[-－―–]\s*(\d{1,2})(?:\s|$)/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function eventForText(text, date) {
  if (/クライマックス|CS/.test(text)) {
    const stage = /ファースト/.test(text) ? 'first' : /ファイナル/.test(text) ? 'final' : null;
    const league = /セ[・ ]/.test(text) ? 'central' : /パ[・ ]/.test(text) ? 'pacific' : null;
    return { kind: 'event', category: 'cs', stage, league, date, title: `${league === 'central' ? 'セ' : league === 'pacific' ? 'パ' : 'セ・パ'}・CS${stage === 'first' ? 'ファースト' : stage === 'final' ? 'ファイナル' : ''}ステージ`, status: 'scheduled', home: null, away: null, kickoff: null, venue: null, homeScore: null, awayScore: null };
  }
  if (/日本シリーズ/.test(text)) {
    return { kind: 'event', category: 'japanSeries', date, title: '日本シリーズ', status: 'scheduled', home: null, away: null, kickoff: null, venue: text.match(/(?:セ|パ)[・ ]本拠地球場/)?.[0] || null, homeScore: null, awayScore: null };
  }
  return null;
}

export function parseNpbScheduleHtml(html, month, now = new Date()) {
  const table = tableBlocks(html).find((candidate) => /月日/.test(htmlText(candidate)) && /対戦カード/.test(htmlText(candidate)));
  if (!table) throw new Error(`NPB ${month}月の日程表を見つけられませんでした`);
  const rows = tableRows(table);
  let currentDate = null;
  const matches = [];
  let rowNumber = 0;
  for (const row of rows) {
    rowNumber += 1;
    const allText = row.cells.map((cell) => cell.text).join(' ');
    const dateCellIndex = row.cells.findIndex((cell) => normalizeDate(cell.text, month));
    if (dateCellIndex >= 0) currentDate = normalizeDate(row.cells[dateCellIndex].text, month);
    if (!currentDate) continue;
    const cardIndex = dateCellIndex >= 0 ? dateCellIndex + 1 : 0;
    const cardCell = row.cells[cardIndex];
    if (!cardCell?.text) continue;
    const cardText = cardCell.text;
    const event = eventForText(cardText, currentDate);
    if (event) {
      const venue = row.cells[cardIndex + 1]?.text || '';
      event.venue = venue || event.venue;
      event.id = `npb-${event.category}-${event.league || 'all'}-${event.stage || 'series'}-${currentDate}-${rowNumber}`;
      matches.push(event);
      continue;
    }
    const teams = findTeams(cardText);
    if (teams.length < 2) continue;
    const score = parseScore(cardText);
    const timeText = row.cells[cardIndex + 1]?.text || '';
    const time = normalizeDigits(timeText).match(/\b(\d{1,2}:\d{2})\b/)?.[1] || null;
    const venue = timeText.replace(/\b\d{1,2}:\d{2}\b/g, '').trim() || null;
    const noteText = row.cells[cardIndex + 2]?.text || '';
    const status = parseStatus(cardText, noteText, score, currentDate, now);
    const scheduledEvent = eventForText(allText, currentDate);
    const postseason = scheduledEvent || null;
    matches.push({
      id: `npb-${currentDate}-${teams[0].code}-${teams[1].code}-${time || 'tbd'}`,
      kind: 'game',
      date: currentDate,
      category: postseason?.category || 'regular',
      stage: postseason?.stage || null,
      league: postseason?.league || (teams[0].league === teams[1].league ? teams[0].league : 'interleague'),
      home: teams[0], away: teams[1], kickoff: time, venue,
      status,
      homeScore: status === 'finished' && score ? score[0] : null,
      awayScore: status === 'finished' && score ? score[1] : null
    });
  }
  return matches;
}

function numeric(value) {
  const text = normalizeDigits(value).replace(/−/g, '-').trim();
  if (!text || /^[-—–]+$/.test(text)) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function teamFromText(value) {
  const teams = findTeams(value);
  return teams[0] || null;
}

function recordFromText(value) {
  const text = normalizeDigits(value).replace(/[\s\u3000]/g, '');
  const match = text.match(/(\d+)\s*[-－―–]\s*(\d+)(?:\((\d+)\))?/);
  return match ? { wins: Number(match[1]), losses: Number(match[2]), note: match[3] ? Number(match[3]) : null, text: `${match[1]}勝${match[2]}敗` } : null;
}

function standingsTables(html) {
  return tableBlocks(html).filter((table) => {
    const rows = tableRows(table);
    return rows.some(({ cells }) => cells.some((cell) => /チーム/.test(cell.text)) && cells.some((cell) => /試合/.test(cell.text)));
  });
}

function parseStandingsSection(table) {
  if (!table) throw new Error('NPBの勝敗表が見つかりませんでした');
  const rows = tableRows(table);
  const headerIndex = rows.findIndex(({ cells }) => cells.some((cell) => /チーム/.test(cell.text)) && cells.some((cell) => /試合/.test(cell.text)));
  if (headerIndex < 0) throw new Error('NPB勝敗表の見出しを認識できませんでした');
  const header = rows[headerIndex].cells.map((cell) => cell.text);
  const teamIndex = header.findIndex((text) => /チーム/.test(text));
  const opponents = header.map((text) => ABBREVIATION_TO_CODE[text.replace(/\s/g, '')] || null);
  const parsed = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const cells = row.cells.map((cell) => cell.text);
    const team = teamFromText(cells[teamIndex] || '');
    if (!team) continue;
    const findColumn = (pattern) => header.findIndex((value) => pattern.test(value));
    const valueAt = (pattern) => {
      const index = findColumn(pattern);
      return index < 0 ? null : cells[index] ?? null;
    };
    const rank = parsed.length + 1;
    const rowData = {
      rank,
      team,
      played: numeric(valueAt(/^試合$/)),
      wins: numeric(valueAt(/^勝利$/)),
      losses: numeric(valueAt(/^敗北$/)),
      draws: numeric(valueAt(/^引分$/)),
      winPercentage: valueAt(/^勝率$/)?.trim() || null,
      gamesBehind: numeric(valueAt(/^差$/)),
      home: recordFromText(valueAt(/^ホーム$/) || ''),
      away: recordFromText(valueAt(/^ロード$/) || '')
    };
    const versus = [];
    opponents.forEach((code, index) => {
      if (code) versus.push({ team: TEAM_BY_CODE[code].short, code, record: recordFromText(cells[index] || '') });
    });
    parsed.push({ ...rowData, versus });
  }
  return parsed;
}

export function parseNpbStandingsHtml(html) {
  const tables = standingsTables(html);
  const mainTable = tables[0];
  const rows = parseStandingsSection(mainTable);
  const headToHead = rows.map(({ team, versus }) => ({ team, records: versus }));
  const interleagueTable = tables[1];
  const interleagueRows = interleagueTable ? parseStandingsSection(interleagueTable) : [];
  const interleague = interleagueRows.map((row) => ({ team: row.team, played: row.played, wins: row.wins, losses: row.losses, draws: row.draws, winPercentage: row.winPercentage, records: row.versus }));
  if (rows.length !== 6 || new Set(rows.map((row) => row.team.code)).size !== 6) throw new Error('NPB順位表の球団数が一致しません');
  return { rows, headToHead, interleague };
}

function parseCsSchedule(html) {
  const text = htmlText(html);
  const firstStart = text.indexOf('2026年ファーストステージ日程');
  const finalStart = text.indexOf('2026年ファイナルステージ日程');
  if (firstStart < 0 || finalStart < 0) throw new Error('NPB公式CS日程を読み取れませんでした');
  const parseDays = (section, stage, endMarker) => {
    const start = section.indexOf(stage === 'first' ? '2026年ファーストステージ日程' : '2026年ファイナルステージ日程');
    const end = endMarker ? section.indexOf(endMarker, start) : section.length;
    const fragment = section.slice(start, end > start ? end : section.length);
    const result = [];
    for (const match of fragment.matchAll(/10月\s*(\d{1,2})日[^\n]*?(?:第\s*(\d+)\s*試合|予備日)/g)) {
      const gameNumber = match[2] ? Number(match[2]) : null;
      const date = `2026-10-${String(Number(match[1])).padStart(2, '0')}`;
      result.push({ date, gameNumber, stage, reserve: !gameNumber });
    }
    return result;
  };
  const first = parseDays(text, 'first', '2026年ファイナルステージ日程');
  const final = parseDays(text, 'final', '※ファイナルステージ');
  if (first.length < 4 || final.length < 7) throw new Error('NPB公式CS日程の試合日数を検証できませんでした');
  return {
    rules: {
      source: NPBCONFIG.csInfoUrl,
      firstStage: { games: 3, winsToAdvance: 2, tiedWinsAdvance: 'higherRegularSeasonRank', home: 'secondPlace' },
      finalStage: {
        standard: { games: 6, advantageWins: 1, winsToAdvance: 4 },
        conditional: {
          conditions: [{ type: 'gamesBehind', minimum: 10 }, { type: 'winPercentage', below: 0.5 }],
          operator: 'any', games: 7, advantageWins: 2, winsToAdvance: 5
        },
        tiedWinsAdvance: 'firstPlace', home: 'firstPlace'
      }
    },
    schedule: [...first, ...final].map((item) => ({ ...item, leagues: ['central', 'pacific'] }))
  };
}

function japanSeriesSchedule(matches) {
  const venues = new Map(matches.filter((match) => match.category === 'japanSeries').map((match) => [match.date, match.venue]));
  return JAPAN_SERIES_DATES.map((date, index) => ({ date, gameNumber: index + 1, venue: venues.get(date) || null }));
}

function responseIsHtml(response) {
  return response.headers.get('content-type')?.toLowerCase().includes('html') || false;
}

export async function fetchFreshNpbData(fetchImpl = fetch, now = new Date()) {
  const requests = [];
  for (const month of NPBCONFIG.scheduleMonths) {
    requests.push({ kind: 'schedule', month, url: `${BASE_URL}/schedule_${String(month).padStart(2, '0')}_detail.html` });
  }
  requests.push({ kind: 'standings', league: 'central', url: NPBCONFIG.centralStandingsUrl });
  requests.push({ kind: 'standings', league: 'pacific', url: NPBCONFIG.pacificStandingsUrl });
  requests.push({ kind: 'cs', url: NPBCONFIG.csInfoUrl });
  const contents = new Map();
  for (let index = 0; index < requests.length; index += 3) {
    const batch = requests.slice(index, index + 3);
    const results = await Promise.all(batch.map(async (request) => {
      const response = await fetchImpl(request.url, { headers: HEADERS, redirect: 'follow' });
      if (!response.ok || (response.headers.has('content-type') && !responseIsHtml(response))) throw new Error(`NPB公式サイトの応答エラー (${response.status})`);
      return [request, await response.text()];
    }));
    results.forEach(([request, html]) => contents.set(request, html));
  }
  const matches = [];
  for (const request of requests.filter((item) => item.kind === 'schedule')) matches.push(...parseNpbScheduleHtml(contents.get(request), request.month, now));
  const centralRequest = requests.find((item) => item.kind === 'standings' && item.league === 'central');
  const pacificRequest = requests.find((item) => item.kind === 'standings' && item.league === 'pacific');
  const centralStandings = parseNpbStandingsHtml(contents.get(centralRequest));
  const pacificStandings = parseNpbStandingsHtml(contents.get(pacificRequest));
  const csRequest = requests.find((item) => item.kind === 'cs');
  const cs = parseCsSchedule(contents.get(csRequest));
  if (matches.filter((match) => match.kind === 'game').length < 100) throw new Error('NPB公式日程から試合データを十分に抽出できませんでした');
  const csDates = new Map(cs.schedule.map((item) => [item.date, item.stage]));
  for (const match of matches) {
    if (match.kind !== 'game') continue;
    if (csDates.has(match.date)) {
      match.category = 'cs';
      match.stage = csDates.get(match.date);
    } else if (JAPAN_SERIES_DATES.includes(match.date)) {
      match.category = 'japanSeries';
    }
  }
  const completedPostseasonDates = new Set(matches.filter((match) => match.kind === 'game' && match.category !== 'regular').map((match) => match.category === 'cs' ? `${match.category}:${match.date}:${match.league}` : `${match.category}:${match.date}`));
  const withoutDuplicatePlaceholders = matches.filter((match) => match.kind !== 'event' || !completedPostseasonDates.has(match.category === 'cs' ? `${match.category}:${match.date}:${match.league}` : `${match.category}:${match.date}`));
  const unique = new Map(withoutDuplicatePlaceholders.map((match) => [match.id, match]));
  const uniqueMatches = [...unique.values()].sort((a, b) => `${a.date}${a.kickoff || ''}${a.id}`.localeCompare(`${b.date}${b.kickoff || ''}${b.id}`));
  const postseason = { cs, japanSeries: { schedule: japanSeriesSchedule(uniqueMatches) } };
  return {
    schemaVersion: 1,
    sport: 'npb',
    season: SEASON,
    matches: uniqueMatches,
    standings: { central: centralStandings, pacific: pacificStandings },
    postseason,
    update: { status: 'success', at: now.toISOString() }
  };
}

export async function performNpbUpdate(env, now = new Date(), fetchImpl = fetch) {
  const previous = (await env.SPORTAL_DATA?.get(NPBCONFIG.dataKey, 'json')) || emptyNpbData();
  try {
    const data = await fetchFreshNpbData(fetchImpl, now);
    await env.SPORTAL_DATA.put(NPBCONFIG.dataKey, JSON.stringify(data));
    return data;
  } catch (error) {
    const failed = { ...previous, update: { status: 'failure', at: now.toISOString(), message: error instanceof Error ? error.message : 'NPBデータの更新に失敗しました' } };
    await env.SPORTAL_DATA.put(NPBCONFIG.dataKey, JSON.stringify(failed));
    throw Object.assign(new Error(failed.update.message), { data: failed });
  }
}

export const NPB_CONFIG = NPBCONFIG;
