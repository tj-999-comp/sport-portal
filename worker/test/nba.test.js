import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyNBAData, fetchFreshNBAData, normalizeBallDontLieSeason, parseBallDontLieGame, performNBAUpdate } from '../src/nba.js';

function gameFixture(overrides = {}) {
  return {
    id: 1001,
    date: '2026-10-11',
    datetime: '2026-10-12T02:00:00.000Z',
    status: 'Final',
    status_state: 'final',
    period: 4,
    home_team: { id: 1, full_name: 'Toronto Raptors', abbreviation: 'TOR' },
    visitor_team: { id: 2, full_name: 'Miami Heat', abbreviation: 'MIA' },
    home_team_score: 105,
    visitor_team_score: 129,
    ...overrides
  };
}

function response(data) {
  return { ok: true, async json() { return { data, meta: { next_cursor: null, per_page: 100 } }; } };
}

test('BALLDONTLIE game normalization uses JST dates and only publishes final scores', () => {
  const final = parseBallDontLieGame(gameFixture(), 'preseason');
  assert.equal(final.date, '2026-10-12');
  assert.equal(final.providerDate, '2026-10-11');
  assert.equal(final.category, 'preseason');
  assert.equal(final.homeScore, 105);
  assert.equal(final.awayScore, 129);

  const live = parseBallDontLieGame(gameFixture({ status: 'Q2 05:00', status_state: 'in_progress', home_team_score: 65, visitor_team_score: 60 }));
  assert.equal(live.status, 'inProgress');
  assert.equal(live.homeScore, null);
  assert.equal(live.awayScore, null);
});

test('first refresh fetches the supported season types with the server-side key', async () => {
  const requests = [];
  const previousSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback) => { queueMicrotask(callback); return 0; };
  try {
    const data = await fetchFreshNBAData(async (url, init) => {
      const parsedUrl = new URL(url);
      requests.push({ url: parsedUrl, init });
      const type = parsedUrl.searchParams.get('season_type');
      return response([gameFixture({ id: 1000 + requests.length, status_state: 'scheduled', status: '2026-10-20T23:00:00Z', datetime: '2026-10-20T23:00:00Z', date: '2026-10-20' })]);
    }, new Date('2026-10-12T00:00:00Z'), { BALLDONTLIE_API_KEY: 'test-only' });
    assert.deepEqual(requests.map(({ url }) => url.searchParams.get('season_type')), ['preseason', 'regular', 'ist', 'playin', 'playoffs']);
    assert.equal(requests[0].url.pathname, '/v1/games');
    assert.equal(requests[0].url.searchParams.get('seasons[]'), '2026');
    assert.equal(requests[0].url.searchParams.get('per_page'), '100');
    assert.equal(requests[0].init.headers.Authorization, 'test-only');
    assert.equal(data.matches.length, 5);
    assert.equal(data.update.refreshMode, 'full');
    assert.ok(data.update.scheduleAt);
  } finally {
    globalThis.setTimeout = previousSetTimeout;
  }
});

test('daily refresh requests only cached games from JST yesterday and today, preserving the rest of the schedule', async () => {
  const recent = parseBallDontLieGame(gameFixture(), 'regular');
  const future = parseBallDontLieGame(gameFixture({
    id: 2002,
    date: '2026-10-20',
    datetime: '2026-10-20T23:00:00.000Z',
    status: '2026-10-20T23:00:00Z',
    status_state: 'scheduled',
    home_team_score: 0,
    visitor_team_score: 0
  }), 'regular');
  const prior = {
    ...normalizeBallDontLieSeason([recent, future], new Date('2026-10-10T00:00:00.000Z')),
    update: { status: 'success', scheduleAt: '2026-10-10T00:00:00.000Z' }
  };
  const requests = [];
  const updated = await fetchFreshNBAData(async (url) => {
    const parsedUrl = new URL(url);
    requests.push(parsedUrl);
    return response([gameFixture({ home_team_score: 105, visitor_team_score: 129 })]);
  }, new Date('2026-10-12T04:00:00.000Z'), { BALLDONTLIE_API_KEY: 'test-only' }, prior);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].searchParams.get('season_type'), 'regular');
  assert.deepEqual(requests[0].searchParams.getAll('dates[]'), ['2026-10-11']);
  assert.equal(updated.matches.length, 2);
  assert.equal(updated.matches.find((match) => match.id === '1001').homeScore, 105);
  assert.equal(updated.matches.find((match) => match.id === '2002').status, 'scheduled');
  assert.equal(updated.update.scheduleAt, prior.update.scheduleAt);
  assert.equal(updated.update.refreshMode, 'recent');
});

test('failed refresh preserves prior schedule and standings data', async () => {
  const prior = {
    ...emptyNBAData(),
    matches: [parseBallDontLieGame(gameFixture(), 'regular')],
    update: { status: 'success', scheduleAt: '2026-10-10T00:00:00.000Z' }
  };
  let stored = prior;
  const env = { SPORTAL_DATA: { async get() { return stored; }, async put(key, value) { assert.equal(key, 'nba-2026-27'); stored = JSON.parse(value); } } };
  await assert.rejects(performNBAUpdate(env, new Date('2026-10-12T04:00:00.000Z'), fetch), /BALLDONTLIE_API_KEY/);
  assert.equal(stored.matches[0].id, '1001');
  assert.equal(stored.update.status, 'failure');
});
