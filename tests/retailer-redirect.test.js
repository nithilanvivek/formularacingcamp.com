const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const counters = require('../lib/analytics-counters');
const analyticsData = require('../api/analytics-data');
const safe = require('../lib/public-analytics');
const trackAction = require('../api/track-action');
const redirect = require('../api/short-link-redirect');

const root = path.resolve(__dirname, '..');
const destinations = {
  amazon: 'https://www.amazon.in/dp/B0H8ZYFV7Q',
  kindle: 'https://www.amazon.in/dp/B0H7TH9QW6',
  flipkart: 'https://www.flipkart.com/search?q=Formula%20Racing%20Camp%20book',
  np: 'https://notionpress.com/in/read/formula-racing-camp',
  youtube: 'https://www.youtube.com/@WhereF1RulesTheWorld'
};

function response() {
  return {
    headers: {}, statusCode: 200,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    end() { return this; },
    json(value) { this.body = value; return this; }
  };
}

function mockRedis(t, fetch) {
  const names = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN'];
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
    names.forEach(name => {
      if (saved[name] === undefined) delete process.env[name];
      else process.env[name] = saved[name];
    });
  });
  names.forEach(name => delete process.env[name]);
  if (fetch) {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-secret';
    global.fetch = fetch;
  }
}

test('each public short link increments only its own daily counter and redirects to its fixed destination', async t => {
  const commands = [];
  mockRedis(t, async (_url, options) => {
    assert.ok(options.signal instanceof AbortSignal);
    commands.push(JSON.parse(options.body));
    return { ok: true, json: async () => ({ result: 1 }) };
  });
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  for (const [link, destination] of Object.entries(destinations)) {
    const rewrite = config.rewrites.find(rule => rule.source === `/${link}`);
    assert.equal(rewrite.destination, `/api/short-link-redirect?shortLink=${link}`);
    assert.ok(!config.redirects.some(rule => rule.source === `/${link}`));
    const destinationUrl = new URL(rewrite.destination, 'https://www.formularacingcamp.com');
    const handler = require(`..${destinationUrl.pathname}`);
    const res = response();
    // User-supplied destinations/store parameters cannot change the fixed route.
    await handler({ method: 'GET', query: { ...Object.fromEntries(destinationUrl.searchParams), url: 'https://evil.example', store: 'kindle' } }, res);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, destination);
    assert.match(res.headers['cache-control'], /no-store/);
    assert.match(res.headers['x-robots-tag'], /noindex/);
    assert.deepEqual(commands.at(-1), ['HINCRBY', counters.COUNTER_HASH_KEY, `${new Date().toISOString().slice(0, 10)}:short_link:${link}`, 1]);
  }
  assert.equal(commands.length, 5);
});

test('HEAD requests and unsupported methods never increment counters', async t => {
  let calls = 0;
  mockRedis(t, async () => { calls += 1; throw new Error('Unexpected fetch'); });
  const handler = redirect;
  const head = response();
  await handler({ method: 'HEAD', query: { shortLink: 'amazon' } }, head);
  assert.equal(head.statusCode, 302);
  assert.equal(head.headers.location, destinations.amazon);
  const post = response();
  await handler({ method: 'POST', query: { shortLink: 'amazon' } }, post);
  assert.equal(post.statusCode, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.equal(post.headers.location, undefined);
  assert.equal(calls, 0);
});

test('counter outages and missing configuration still let visitors reach the retailer', async t => {
  mockRedis(t, async () => { throw new Error('Counter offline'); });
  t.mock.method(console, 'error', () => {});
  const handler = redirect;
  for (const configured of [true, false]) {
    if (!configured) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const res = response();
    await handler({ method: 'GET', query: { shortLink: 'np' } }, res);
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, destinations.np);
  }
});

test('analytics publishes the new short links and omits legacy retailer entries and paths', async () => {
  const definitions = analyticsData.TRACKED_ACTIONS;
  assert.deepEqual(definitions.filter(row => row.key.startsWith('redirect_')).map(row => row.detail), ['/amazon', '/kindle', '/flipkart', '/np', '/youtube']);
  assert.ok(!definitions.some(row => row.key.startsWith('book_')));
  assert.equal(counters.fieldForAction('book_store_selected', { store: 'amazon_print' }), null);
  assert.equal(counters.fieldForAction('youtube_opened'), null);
  assert.ok(!definitions.some(row => row.key === 'youtube_opened'));
  assert.equal(safe.publicPath('/go/youtube/'), null);
  assert.equal(safe.publicPath('/go/book/'), null);
  assert.deepEqual(safe.visits([{ requestPath: '/go/book', pageviews: 20, visitors: 10 }], 'requestPath'), []);
  const res = response();
  await trackAction({ method: 'POST', headers: { host: 'www.formularacingcamp.com', origin: 'https://www.formularacingcamp.com', referer: 'https://www.formularacingcamp.com/go/book/' }, body: { action: 'book_store_selected', store: 'amazon_print' } }, res);
  assert.equal(res.statusCode, 403);
});

test('all buy buttons use short links without client interception', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const expected = { amazon: '/amazon', kindle: '/kindle', flipkart: '/flipkart', notion: '/np' };
  for (const [name, route] of Object.entries(expected)) {
    const links = [...html.matchAll(new RegExp(`class="retailer-button retailer-${name}" href="([^"]+)"`, 'g'))];
    assert.equal(links.length, 2);
    links.forEach(link => assert.equal(link[1], route));
  }
  assert.match(html, /class="book-offer-buy" href="\/np"/);
  assert.equal((html.match(/href="\/youtube"/g) || []).length, 3);
  assert.doesNotMatch(html, /href="(?:\/go\/youtube|https:\/\/tinyurl\.com\/bdhk648b)"/);
  const listeners = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'interaction-routes.js'), 'utf8'), {
    URL,
    window: { location: { href: 'https://www.formularacingcamp.com/', origin: 'https://www.formularacingcamp.com', assign() { assert.fail('Retailer click must use its anchor'); } } },
    document: { addEventListener(name, fn) { listeners[name] = fn; } }
  });
  for (const route of [...Object.values(expected), '/youtube']) {
    listeners.click({ target: { closest() { return { href: `https://www.formularacingcamp.com${route}` }; } }, preventDefault() { assert.fail('Retailer click must retain normal link behavior'); } });
  }
});

test('unknown, missing, repeated and inherited short-link names cannot redirect or count', async t => {
  let calls = 0;
  mockRedis(t, async () => { calls += 1; throw new Error('Unexpected counter'); });
  for (const shortLink of [undefined, 'unknown', 'https://evil.example', ['amazon', 'youtube'], '__proto__', 'constructor']) {
    const res = response();
    await redirect({ method: 'GET', query: { shortLink } }, res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.headers.location, undefined);
  }
  assert.equal(calls, 0);
});
