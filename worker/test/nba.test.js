import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyNBAData, fetchFreshNBAData, normalizeAPISportsSeason, parseAPISportsGame, parseAPISportsStandings, performNBAUpdate } from '../src/nba.js';
import worker from '../src/index.js';

function standingsFixture() {
  return ['East', 'West'].flatMap((conference) => Array.from({ length: 15 }, (_, index) => ({
    team: { name: `${conference} team ${index + 1}`, code: `${conference[0]}${String(index + 1).padStart(2, '0')}` },
    conference: { name: conference.toLowerCase(), rank: index + 1, win: 8, loss: 4, gamesBehind: index ? index / 2 : 0 },
    win: { home: 5, away: 3, total: 8, percentage: '0.667', lastTen: 7 },
    loss: { home: 1, away: 3, total: 4, lastTen: 3 },
    streak: 'W2'
  })));
}

function gameFixture(overrides = {}) {
  return {
    id: '001',
    league: 'standard',
    stage: 'Regular Season',
    date: { start: '2026-10-20T23:00:00.000Z' },
    status: { short: 3, long: 'Finished' },
    teams: { home: { id: 1, name: 'Boston Celtics', code: 'BOS' }, visitors: { id: 2, name: 'New York Knicks', code: 'NYK' } },
    scores: { home: { points: 112 }, visitors: { points: 106 } },
    arena: { name: 'TD Garden', city: 'Boston', state: 'MA', country: 'USA' },
    ...overrides
  };
}

test('NBA game normalization converts provider times to JST and hides live scores', () => {
  const finished = parseAPISportsGame(gameFixture());
  assert.equal(finished.date, '2026-10-21');
  assert.equal(finished.category, 'regular');
  assert.equal(finished.homeScore, 112);
  assert.equal(finished.awayScore, 106);
  assert.equal(finished.venue, 'TD Garden');

  const live = parseAPISportsGame(gameFixture({ id: '002', status: { short: 2, long: 'In Play' }, scores: { home: { points: 65 }, visitors: { points: 60 } } }));
  assert.equal(live.status, 'inProgress');
  assert.equal(live.homeScore, null);
  assert.equal(live.awayScore, null);

  assert.equal(parseAPISportsGame(gameFixture({ stage: 'NBA Cup Group Play' })).category, 'cup-group');
  assert.equal(parseAPISportsGame(gameFixture({ stage: 'Play-In' })).category, 'play-in');
  assert.equal(parseAPISportsGame(gameFixture({ stage: 'Playoffs' })).category, 'playoffs');
  assert.equal(parseAPISportsGame(gameFixture({ stage: 'NBA Finals' })).category, 'finals');
});

test('standings require complete East and West conferences and preserve provider ranks', () => {
  const standings = parseAPISportsStandings(standingsFixture());
  assert.equal(standings.status, 'success');
  assert.equal(standings.east.length, 15);
  assert.equal(standings.west[0].rank, 1);
  assert.equal(standings.east[0].home, '5-1');
  assert.equal(standings.east[0].road, '3-3');
  assert.equal(standings.east[0].conferenceRecord, '8-4');
  assert.throws(() => parseAPISportsStandings(standingsFixture().slice(0, 29)), /15チームずつ/);
});

test('schedule keeps unknown categories explicitly unclassified instead of guessing from numeric stage IDs', () => {
  const numericStage = normalizeAPISportsSeason([gameFixture({ stage: 1 })], standingsFixture());
  assert.equal(numericStage.matches[0].category, 'unknown');
  assert.equal(numericStage.coverage.unclassifiedGames, 1);
  assert.equal(normalizeAPISportsSeason([gameFixture({ stage: 'Mystery' })], standingsFixture()).coverage.unclassifiedGames, 1);
});

test('schedule rejects duplicate IDs and incomplete records', () => {
  assert.throws(() => normalizeAPISportsSeason([gameFixture(), gameFixture()], standingsFixture()), /重複/);
  assert.throws(() => normalizeAPISportsSeason([], standingsFixture()), /空です/);
});

test('standings stay unavailable when the provider has not published rows yet', () => {
  assert.deepEqual(parseAPISportsStandings([]), { east: [], west: [], status: 'unavailable' });
  const data = normalizeAPISportsSeason([gameFixture()], []);
  assert.equal(data.matches.length, 1);
  assert.equal(data.standings.status, 'unavailable');
});

test('schedule recognizes NBA Finals and retains date-only games without inventing a tipoff time', () => {
  const finals = parseAPISportsGame(gameFixture({ stage: 'NBA Finals', date: { start: '2027-06-01' } }));
  assert.equal(finals.category, 'finals');
  assert.equal(finals.date, '2027-06-01');
  assert.equal(finals.startsAt, null);
});

test('standings use the documented top-level games-behind and streak direction fields', () => {
  const fixture = standingsFixture();
  fixture[0].gamesBehind = '2.5';
  fixture[0].streak = 3;
  fixture[0].winStreak = false;
  const [row] = parseAPISportsStandings(fixture).east;
  assert.equal(row.gamesBehind, '2.5');
  assert.equal(row.streak, 'L3');
});

test('fetches the 2026 NBA season from API-Sports with a server-side key', async () => {
  const requests = [];
  const responses = [[gameFixture()], standingsFixture()];
  const data = await fetchFreshNBAData(async (url, init) => {
    requests.push({ url: new URL(url), init });
    return { ok: true, async json() { return { response: responses[requests.length - 1] }; } };
  }, new Date('2026-10-22T00:00:00.000Z'), { NBA_API_KEY: 'test-only' });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url.pathname, '/games');
  assert.equal(requests[0].url.searchParams.get('league'), 'standard');
  assert.equal(requests[0].url.searchParams.get('season'), '2026');
  assert.equal(requests[1].url.pathname, '/standings');
  assert.equal(requests[0].init.headers['x-apisports-key'], 'test-only');
  assert.equal(data.matches.length, 1);
  assert.equal(data.standings.east.length, 15);
});

test('simultaneous NBA updates share one provider fetch and one KV write', async () => {
  const originalFetch = globalThis.fetch;
  const responses = [[gameFixture()], standingsFixture()];
  let requests = 0;
  let writes = 0;
  globalThis.fetch = async () => {
    const response = responses[Math.floor(requests / 1)];
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { ok: true, async json() { return { response }; } };
  };
  const env = {
    BASIC_AUTH_USER: 'owner',
    BASIC_AUTH_PASSWORD: 'secret',
    NBA_API_KEY: 'test-only',
    SPORTAL_DATA: { async get() { return null; }, async put() { writes += 1; } }
  };
  const auth = { Authorization: `Basic ${Buffer.from('owner:secret').toString('base64')}` };
  try {
    const responsesFromWorker = await Promise.all([
      worker.fetch(new Request('https://example.test/api/nba/update', { method: 'POST', headers: auth }), env),
      worker.fetch(new Request('https://example.test/api/nba/update', { method: 'POST', headers: auth }), env)
    ]);
    assert.deepEqual(responsesFromWorker.map((response) => response.status), [200, 200]);
    assert.equal(requests, 2);
    assert.equal(writes, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('failed NBA refresh preserves previously stored schedule and standings', async () => {
  const prior = { ...emptyNBAData(), matches: [parseAPISportsGame(gameFixture())], standings: parseAPISportsStandings(standingsFixture()), update: { status: 'success', at: '2026-10-21T00:00:00.000Z' } };
  let stored = prior;
  const env = { SPORTAL_DATA: { async get() { return stored; }, async put(key, value) { assert.equal(key, 'nba-2026-27'); stored = JSON.parse(value); } } };
  await assert.rejects(performNBAUpdate(env, new Date('2026-10-22T00:00:00.000Z'), fetch), /NBA_API_KEY/);
  assert.equal(stored.matches[0].id, '001');
  assert.equal(stored.standings.east.length, 15);
  assert.equal(stored.update.status, 'failure');
});

test('NBA API routes require Basic auth and keep their payload separate', async () => {
  const env = { BASIC_AUTH_USER: 'owner', BASIC_AUTH_PASSWORD: 'secret', SPORTAL_DATA: { async get() { return null; }, async put() {} } };
  const unauthorized = await worker.fetch(new Request('https://example.test/api/nba/status'), env);
  assert.equal(unauthorized.status, 401);
  const auth = { Authorization: `Basic ${Buffer.from('owner:secret').toString('base64')}` };
  const status = await worker.fetch(new Request('https://example.test/api/nba/status', { headers: auth }), env);
  assert.deepEqual(await status.json(), { update: {}, hasData: false });
  const data = await worker.fetch(new Request('https://example.test/api/nba/data', { headers: auth }), env);
  assert.deepEqual(await data.json(), emptyNBAData());
});
