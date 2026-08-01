const assert = require('node:assert/strict');
const test = require('node:test');

const counters = require('../lib/analytics-counters');
const trackAction = require('../api/track-action');
const launchGameSubmit = require('../api/launch-game-submit');

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; }
  };
}

function saveEnvironment() {
  const names = [
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'LAUNCH_GAME_WEBHOOK_URL',
    'LAUNCH_GAME_TEST_WEBHOOK_URL',
    'LAUNCH_GAME_GITHUB_TOKEN',
    'GITHUB_TOKEN',
    'RESEND_API_KEY',
    'VERCEL'
  ];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  return () => names.forEach((name) => {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  });
}

function configureRedis() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'server-only-test-token';
}

test('counter reader applies the requested date range to every action', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  const originalFetch = global.fetch;
  configureRedis();
  let command;
  global.fetch = async (_url, options) => {
    command = JSON.parse(options.body);
    const values = command.slice(2).map((_field, index) => index % counters.ACTION_DEFINITIONS.length === 0 ? 2 : 1);
    return { ok: true, status: 200, json: async () => ({ result: values }) };
  };

  const result = await counters.readActions({ since: '2026-07-31', until: '2026-08-01' });
  global.fetch = originalFetch;
  restore();

  assert.equal(command[0], 'HMGET');
  assert.equal(command.length, 2 + counters.ACTION_DEFINITIONS.length * 2);
  assert.equal(result.configured, true);
  assert.equal(result.actions[0].count, 4);
  assert.equal(result.actions[1].count, 2);
});

test('same-origin interaction endpoint increments the selected store only', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  const originalFetch = global.fetch;
  configureRedis();
  let command;
  global.fetch = async (_url, options) => {
    command = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ result: 1 }) };
  };
  const req = {
    method: 'POST',
    headers: {
      host: 'www.formularacingcamp.com',
      origin: 'https://www.formularacingcamp.com',
      referer: 'https://www.formularacingcamp.com/go/book/'
    },
    body: { action: 'book_store_selected', store: 'amazon_kindle' }
  };
  const res = responseRecorder();
  await trackAction(req, res);
  global.fetch = originalFetch;
  restore();

  assert.equal(res.statusCode, 202);
  assert.equal(command[0], 'HINCRBY');
  assert.match(command[2], /:book:amazon_kindle$/);
});

test('interaction endpoint rejects cross-origin counter requests', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  const originalFetch = global.fetch;
  configureRedis();
  let calls = 0;
  global.fetch = async () => { calls += 1; };
  const req = {
    method: 'POST',
    headers: {
      host: 'www.formularacingcamp.com',
      origin: 'https://example.com',
      referer: 'https://www.formularacingcamp.com/go/puzzles/'
    },
    body: { action: 'puzzles_opened' }
  };
  const res = responseRecorder();
  await trackAction(req, res);
  global.fetch = originalFetch;
  restore();

  assert.equal(res.statusCode, 403);
  assert.equal(calls, 0);
});

test('accepted production game submission increments the Redis counter once', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  const originalFetch = global.fetch;
  const originalLog = console.log;
  configureRedis();
  delete process.env.LAUNCH_GAME_WEBHOOK_URL;
  delete process.env.LAUNCH_GAME_GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  delete process.env.RESEND_API_KEY;
  console.log = () => {};
  let command;
  global.fetch = async (_url, options) => {
    command = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ result: 1 }) };
  };
  const req = {
    method: 'POST',
    body: {
      sessionId: 'accepted-session-1',
      username: 'driver_one',
      playerName: 'Driver One',
      email: 'driver@example.com',
      score: 1200,
      levels: { reaction: true, dash: true, strategy: true },
      antiCheat: { tabHiddenCount: 0, hiddenMs: 0, blurCount: 0 }
    }
  };
  const res = responseRecorder();
  await launchGameSubmit(req, res);
  global.fetch = originalFetch;
  console.log = originalLog;
  restore();

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.analyticsCounterStatus, 'counted');
  assert.equal(command[0], 'EVAL');
  assert.match(command.at(-1), /:discount_game:submitted$/);
});

test('invalid game submission never increments the Redis counter', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  const originalFetch = global.fetch;
  const originalLog = console.log;
  configureRedis();
  console.log = () => {};
  let calls = 0;
  global.fetch = async () => { calls += 1; };
  const req = { method: 'POST', body: { sessionId: 'invalid-session' } };
  const res = responseRecorder();
  await launchGameSubmit(req, res);
  global.fetch = originalFetch;
  console.log = originalLog;
  restore();

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.analyticsCounterStatus, 'skipped_invalid');
  assert.equal(calls, 0);
});
