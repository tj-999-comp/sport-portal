import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyData, parseScheduleHtml, parseStandingsHtml, performUpdate, scheduleUrls } from '../src/index.js';
import { onRequest as protectPagesRequest } from '../../functions/_middleware.js';
import worker from '../src/index.js';

function basicAuth(user, password) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

test('Pages middleware rejects missing and invalid Basic auth', async () => {
  const env = { BASIC_AUTH_USER: 'owner', BASIC_AUTH_PASSWORD: 'secret' };
  const next = async () => new Response('ok');
  const missing = await protectPagesRequest({ request: new Request('https://example.test/'), env, next });
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get('WWW-Authenticate'), /^Basic realm=/);

  const invalid = await protectPagesRequest({ request: new Request('https://example.test/', { headers: { Authorization: basicAuth('owner', 'wrong') } }), env, next });
  assert.equal(invalid.status, 401);
});

test('Pages middleware passes valid Basic auth without exposing credentials', async () => {
  const request = new Request('https://example.test/', { headers: { Authorization: basicAuth('owner', 'secret') } });
  const response = await protectPagesRequest({ request, env: { BASIC_AUTH_USER: 'owner', BASIC_AUTH_PASSWORD: 'secret' }, next: async () => new Response('ok') });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'ok');
  assert.equal(response.headers.get('Authorization'), null);
  assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow, noarchive');
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(response.headers.get('Referrer-Policy'), 'no-referrer');
});

test('Worker protects data and update APIs with Basic auth', async () => {
  const env = {
    BASIC_AUTH_USER: 'owner',
    BASIC_AUTH_PASSWORD: 'secret',
    SPORTAL_DATA: { async get() { return emptyData(); }, async put() {} }
  };
  const unauthenticated = await worker.fetch(new Request('https://example.test/api/status'), env);
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get('WWW-Authenticate'), /^Basic realm=/);

  const authenticated = await worker.fetch(new Request('https://example.test/api/status', { headers: { Authorization: basicAuth('owner', 'secret') } }), env);
  assert.equal(authenticated.status, 200);
  assert.deepEqual(await authenticated.json(), { update: {}, hasData: false });
});

test('static privacy controls prevent indexing', async () => {
  const robots = await readFile(new URL('../../app/robots.txt', import.meta.url), 'utf8');
  const headers = await readFile(new URL('../../app/_headers', import.meta.url), 'utf8');
  const html = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
  assert.match(robots, /Disallow:\s*\//);
  assert.match(headers, /X-Robots-Tag:\s*noindex/i);
  assert.match(html, /<meta\s+name="robots"\s+content="[^"]*noindex/i);
});

test('design review keeps the latest proposal visible and history collapsed', async () => {
  const html = await readFile(new URL('../../app/design-review.html', import.meta.url), 'utf8');
  assert.match(html, /提案No\.01/);
  assert.match(html, /<details class="proposal-history">/);
  assert.doesNotMatch(html, /<details class="proposal-history"[^>]*open/);
  assert.match(html, /stg.*Preview|Preview.*stg/i);
  assert.match(html, /採用理由/);
});

test('portal root links to the J.League page and keeps the review page separate', async () => {
  const portal = await readFile(new URL('../../app/index.html', import.meta.url), 'utf8');
  const jLeague = await readFile(new URL('../../app/j-league/index.html', import.meta.url), 'utf8');
  assert.match(portal, /href="\/j-league\/"/);
  assert.match(portal, /href="\/design-review\.html"/);
  assert.match(jLeague, /href="\/"/);
  assert.match(jLeague, /href="\/design-review\.html"/);
});

test('STG Wrangler environment is isolated and manual-only by default', async () => {
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');
  assert.match(config, /\[env\.stg\]\s+name = "sport-portal-api-stg"/);
  assert.match(config, /\[env\.stg\.vars\]\s+APP_ORIGIN = "https:\/\/stg\.sport-portal\.pages\.dev"/);
  assert.match(config, /\[\[env\.stg\.kv_namespaces\]\][\s\S]*?binding = "SPORTAL_DATA"[\s\S]*?id = "a2ddffe1d704474db6ae5f7ba65c67b9"/);
  assert.match(config, /\[env\.stg\.triggers\]\s+crons = \[\]/);
});

test('parses official-style schedule cards and keeps match states', () => {
  const html = `<article data-match-id="m1" data-date="2026-09-06" data-matchday="6" data-kickoff="18:00" data-home-team="鹿島アントラーズ" data-away-team="浦和レッズ" data-status="finished" data-home-score="0" data-away-score="1"></article><article data-match-id="m2" data-date="2026-09-11" data-matchday="7" data-kickoff="19:00" data-home-team="京都サンガF.C." data-away-team="柏レイソル" data-status="scheduled"></article>`;
  const result = parseScheduleHtml(html);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { id: 'm1', date: '2026-09-06', matchday: '6', kickoff: '18:00', home: { name: '鹿島アントラーズ', short: '鹿島' }, away: { name: '浦和レッズ', short: '浦和' }, status: 'finished', homeScore: 0, awayScore: 1 });
  assert.equal(result[1].status, 'scheduled');
});

test('parses the official standings column order', () => {
  const html = `<table><tr><th>順位</th><th>クラブ</th><th>勝点</th><th>試合</th><th>勝</th><th>分</th><th>負</th><th>得点</th><th>失点</th><th>得失</th></tr><tr><td>1</td><td>ＦＣ町田ゼルビア町田</td><td>16</td><td>6</td><td>5</td><td>1</td><td>0</td><td>18</td><td>5</td><td>13</td></tr><tr><td>2</td><td>ヴィッセル神戸神戸</td><td>13</td><td>6</td><td>4</td><td>1</td><td>1</td><td>9</td><td>4</td><td>5</td></tr></table>`;
  const result = parseStandingsHtml(html);
  assert.deepEqual(result[0], { rank: 1, team: '町田', points: 16, played: 6, wins: 5, draws: 1, losses: 0, goalsFor: 18, goalsAgainst: 5, goalDifference: 13 });
  assert.equal(result[1].team, '神戸');
});

test('uses the linked-card fallback used by the public schedule page', () => {
  const html = `<h2>2026/09/06 (日)</h2><h3>第6節</h3><a href="/match/j1/2026/090601/">18:00 KO鹿島アントラーズ鹿島0試合終了1浦和レッズ浦和メルスタ</a>`;
  const result = parseScheduleHtml(html);
  assert.equal(result.length, 1);
  assert.equal(result[0].date, '2026-09-06');
  assert.equal(result[0].matchday, '6');
  assert.equal(result[0].home.short, '鹿島');
  assert.equal(result[0].away.short, '浦和');
  assert.deepEqual([result[0].homeScore, result[0].awayScore], [0, 1]);
});

test('parses current nested J.League match links and derives date from href', () => {
  const html = `<h2>2026/9/6 (日)</h2><a class="m-schedule__link" href="/match/j1/2026/090601/"><div data-match="true"><span>鹿島アントラーズ</span><p>18:00</p><span>浦和レッズ</span><span>2試合終了1</span></div></a>`;
  const result = parseScheduleHtml(html);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { id: '090601', date: '2026-09-06', matchday: null, kickoff: '18:00', home: { name: '鹿島アントラーズ', short: '鹿島' }, away: { name: '浦和レッズ', short: '浦和' }, status: 'finished', homeScore: 2, awayScore: 1 });
});

test('retains the previous payload when a refresh fails', async () => {
  const oldData = { ...emptyData({ status: 'success', at: '2026-09-06T00:00:00.000Z' }), matches: [{ id: 'old' }], standings: [{ rank: 1, team: '町田' }] };
  const writes = [];
  const env = { SPORTAL_DATA: { async get() { return oldData; }, async put(_key, value) { writes.push(JSON.parse(value)); } } };
  await assert.rejects(() => performUpdate(env, new Date('2026-09-07T00:00:00.000Z'), async () => new Response('down', { status: 503 })));
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].matches, oldData.matches);
  assert.equal(writes[0].update.status, 'failure');
});

test('shares one in-flight update when manual and scheduled refreshes overlap', async () => {
  const writes = [];
  let reads = 0;
  let requests = 0;
  const env = { SPORTAL_DATA: {
    async get() { reads += 1; return emptyData({ status: 'success', at: '2026-09-07T00:00:00.000Z' }); },
    async put(_key, value) { writes.push(JSON.parse(value)); }
  } };
  const fetchImpl = async () => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return new Response('down', { status: 503 });
  };
  const first = performUpdate(env, new Date('2026-09-08T00:00:00.000Z'), fetchImpl);
  const second = performUpdate(env, new Date('2026-09-08T00:01:00.000Z'), fetchImpl);
  await assert.rejects(() => first);
  await assert.rejects(() => second);
  assert.equal(reads, 1);
  assert.equal(requests, 1);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].update.status, 'failure');
});

test('returns a stable empty data shape before first update', () => {
  assert.deepEqual(emptyData(), { schemaVersion: 1, league: 'j1', season: '2026', matches: [], standings: [], update: {} });
});

test('splits the season into 12 source windows under the official result limit', () => {
  const urls = scheduleUrls();
  assert.equal(urls.length, 12);
  assert.match(urls[0], /startdate=2026-01-01&enddate=2026-01-31/);
  assert.match(urls[11], /startdate=2026-12-01&enddate=2026-12-31/);
});
