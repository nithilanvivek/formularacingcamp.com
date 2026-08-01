const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const analyticsAccess = require('../api/analytics-access');
const analyticsData = require('../api/analytics-data');

const projectRoot = path.resolve(__dirname, '..');

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
    end() { return this; }
  };
}

function authenticatedCookie(password) {
  return `frc_analytics_access=${analyticsData.sessionToken(password)}`;
}

function saveEnvironment() {
  const names = ['ANALYTICS_DASHBOARD_PASSWORD', 'VERCEL_ANALYTICS_TOKEN', 'VERCEL_ANALYTICS_PROJECT_ID', 'VERCEL_ANALYTICS_TEAM_ID', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'VERCEL'];
  const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  return () => names.forEach((name) => {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  });
}

test('dashboard rejects an incorrect password with 401', { concurrency: false }, () => {
  const restore = saveEnvironment();
  process.env.ANALYTICS_DASHBOARD_PASSWORD = 'test-password';
  const req = { method: 'POST', headers: {}, body: { password: 'wrong-password' } };
  const res = responseRecorder();
  analyticsAccess(req, res);
  restore();
  assert.equal(res.statusCode, 401);
  assert.match(res.headers['x-robots-tag'], /noindex/);
});

test('analytics API rejects requests without an authenticated cookie', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  process.env.ANALYTICS_DASHBOARD_PASSWORD = 'test-password';
  const req = { method: 'GET', headers: { host: 'localhost:4174' }, query: { days: '30' } };
  const res = responseRecorder();
  await analyticsData(req, res);
  restore();
  assert.equal(res.statusCode, 401);
  assert.match(res.headers['x-robots-tag'], /noindex/);
});

test('localhost gets clearly labeled transition-route sample data only', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  process.env.ANALYTICS_DASHBOARD_PASSWORD = 'test-password';
  delete process.env.VERCEL;
  delete process.env.VERCEL_ANALYTICS_TOKEN;
  delete process.env.VERCEL_ANALYTICS_PROJECT_ID;
  const req = { method: 'GET', headers: { host: 'localhost:4174', cookie: authenticatedCookie('test-password') }, query: { days: '7' } };
  const res = responseRecorder();
  await analyticsData(req, res);
  restore();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sample, true);
  assert.deepEqual(res.body.actions.map(({ key, name }) => ({ key, name })), analyticsData.TRACKED_ACTIONS.map(({ key, name }) => ({ key, name })));
  assert.equal('events' in res.body, false);
});

test('production never falls back to sample analytics', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  process.env.VERCEL = '1';
  process.env.ANALYTICS_DASHBOARD_PASSWORD = 'test-password';
  delete process.env.VERCEL_ANALYTICS_TOKEN;
  delete process.env.VERCEL_ANALYTICS_PROJECT_ID;
  const req = { method: 'GET', headers: { host: 'www.formularacingcamp.com', cookie: authenticatedCookie('test-password') }, query: { days: '30' } };
  const res = responseRecorder();
  await analyticsData(req, res);
  restore();
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.sample, undefined);
});

test('production queries only visit aggregates, official dimensions, and limits of at most 100', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  const originalFetch = global.fetch;
  const requestedUrls = [];
  process.env.VERCEL = '1';
  process.env.ANALYTICS_DASHBOARD_PASSWORD = 'test-password';
  process.env.VERCEL_ANALYTICS_TOKEN = 'server-only-test-token';
  process.env.VERCEL_ANALYTICS_PROJECT_ID = 'project-id';
  process.env.VERCEL_ANALYTICS_TEAM_ID = 'team-id';
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    const parsed = new URL(url);
    const by = parsed.searchParams.getAll('by')[0];
    const filter = parsed.searchParams.get('filter') || '';
    let data = [];
    if (by === 'day') data = [{ timestamp: '2026-07-31T00:00:00.000Z', pageviews: filter ? 2 : 20, visitors: filter ? 1 : 12 }];
    if (by === 'requestPath') data = [{ requestPath: '/', pageviews: 20, visitors: 12 }];
    if (by === 'referrerHostname') data = [{ referrerHostname: 'google.com', pageviews: 8, visitors: 6 }];
    if (by === 'deviceType') data = [{ deviceType: 'desktop', pageviews: 12, visitors: 8 }];
    if (by === 'browserName') data = [{ browserName: 'Chrome', pageviews: 10, visitors: 7 }];
    return { ok: true, status: 200, json: async () => ({ data }) };
  };

  const req = { method: 'GET', headers: { host: 'www.formularacingcamp.com', cookie: authenticatedCookie('test-password') }, query: { days: '90' } };
  const res = responseRecorder();
  await analyticsData(req, res);
  global.fetch = originalFetch;
  restore();

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sample, false);
  assert.equal('events' in res.body, false);
  assert.deepEqual(res.body.actions.map(({ key, name }) => ({ key, name })), analyticsData.TRACKED_ACTIONS.map(({ key, name }) => ({ key, name })));
  assert.equal(res.body.actionsAvailable, false);
  assert.equal(requestedUrls.length, 6);
  requestedUrls.forEach((url) => {
    const parsed = new URL(url);
    assert.match(parsed.pathname, /\/visits\/aggregate$/);
    assert.doesNotMatch(parsed.pathname, /\/events\//);
    assert.equal(parsed.searchParams.has('filter'), false);
    assert.ok(Number(parsed.searchParams.get('limit')) <= 100);
    parsed.searchParams.getAll('by').forEach((dimension) => {
      assert.ok(['requestPath', 'referrerHostname', 'deviceType', 'browserName', 'day'].includes(dimension));
    });
  });
  const dailyUrls = requestedUrls.map((url) => new URL(url)).filter((url) => url.searchParams.getAll('by').includes('day'));
  assert.equal(dailyUrls.length, 2);
  dailyUrls.forEach((url) => {
    assert.ok(analyticsData.daysInRange({ since: url.searchParams.get('since'), until: url.searchParams.get('until') }) <= analyticsData.MAX_DAILY_QUERY_DAYS);
  });
});

test('90-day filter clearly falls back to Hobby reporting availability', { concurrency: false }, async () => {
  const restore = saveEnvironment();
  const originalFetch = global.fetch;
  const requestedUrls = [];
  process.env.VERCEL = '1';
  process.env.ANALYTICS_DASHBOARD_PASSWORD = 'test-password';
  process.env.VERCEL_ANALYTICS_TOKEN = 'server-only-test-token';
  process.env.VERCEL_ANALYTICS_PROJECT_ID = 'project-id';
  process.env.VERCEL_ANALYTICS_TEAM_ID = 'team-id';
  global.fetch = async (url) => {
    requestedUrls.push(String(url));
    const parsed = new URL(url);
    const queryRange = { since: parsed.searchParams.get('since'), until: parsed.searchParams.get('until') };
    if (analyticsData.daysInRange(queryRange) > analyticsData.HOBBY_REPORTING_DAYS) {
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid request: the hobby plan only grants access to the latest 31 days of data.' } })
      };
    }
    const by = parsed.searchParams.getAll('by')[0];
    const data = by === 'day'
      ? [{ timestamp: '2026-07-31T00:00:00.000Z', pageviews: 4, visitors: 3 }]
      : [{ [by]: by === 'requestPath' ? '/' : 'Unknown', pageviews: 4, visitors: 3 }];
    return { ok: true, status: 200, json: async () => ({ data }) };
  };

  const req = { method: 'GET', headers: { host: 'www.formularacingcamp.com', cookie: authenticatedCookie('test-password') }, query: { days: '90' } };
  const res = responseRecorder();
  await analyticsData(req, res);
  global.fetch = originalFetch;
  restore();

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.range.days, 90);
  assert.equal(res.body.range.availableDays, analyticsData.HOBBY_REPORTING_DAYS);
  assert.equal(res.body.range.limited, true);
  assert.ok(requestedUrls.some((url) => analyticsData.daysInRange({ since: new URL(url).searchParams.get('since'), until: new URL(url).searchParams.get('until') }) > analyticsData.HOBBY_REPORTING_DAYS));
  assert.ok(requestedUrls.some((url) => analyticsData.daysInRange({ since: new URL(url).searchParams.get('since'), until: new URL(url).searchParams.get('until') }) === analyticsData.HOBBY_REPORTING_DAYS));
});

test('client code has no Hobby-incompatible custom-event calls', () => {
  const files = ['app.js', 'launch-game.js', 'puzzles.js', 'interaction-routes.js'];
  const source = files.map((file) => fs.readFileSync(path.join(projectRoot, file), 'utf8')).join('\n');
  assert.doesNotMatch(source, /trackFrcEvent|\btrack\s*\(|window\.va\s*\(\s*['"]event/);
});

test('transition pages increment Redis actions before continuing', () => {
  for (const route of ['book', 'puzzles', 'youtube']) {
    const html = fs.readFileSync(path.join(projectRoot, 'go', route, 'index.html'), 'utf8');
    assert.match(html, /\/_vercel\/insights\/script\.js/);
    assert.match(html, new RegExp(`history\\.replaceState\\(null,'','/go/${route}/'\\)`));
    assert.match(html, /id="continue-link"/);
    assert.match(html, /interaction-counter\.js/);
    assert.match(html, /go-transition\.js/);
  }
  const transitionScript = fs.readFileSync(path.join(projectRoot, 'assets', 'go-transition.js'), 'utf8');
  assert.match(transitionScript, /frcTrackAction/);
  assert.match(transitionScript, /setTimeout/);
  assert.match(transitionScript, /location\.assign/);
});

test('homepage header includes the tracked YouTube route', () => {
  const homepage = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
  assert.match(homepage, /class="header-action header-action-youtube" href="\/go\/youtube"/);
});

test('analytics routes are excluded from search engines', () => {
  const robots = fs.readFileSync(path.join(projectRoot, 'robots.txt'), 'utf8');
  assert.match(robots, /Disallow: \/analytics\//);
  assert.match(robots, /Disallow: \/api\/analytics-data/);
});
