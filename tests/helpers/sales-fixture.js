const { randomUUID } = require('node:crypto');

function salesFixture(t) {
  const names = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) value === undefined ? delete process.env[name] : process.env[name] = value;
  });
  process.env.UPSTASH_REDIS_REST_URL = 'https://sales-redis.example.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token';
  process.env.TURNSTILE_SITE_KEY = 'test-site-key';
  process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
  const fixture = { raw: null, commands: [], offline: false, verifications: 0, challenge: { success: true, action: 'sales', hostname: 'localhost' } };
  t.mock.method(global, 'fetch', async (url, options) => {
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') { fixture.verifications++; return { ok: true, json: async () => fixture.challenge }; }
    if (url !== 'https://sales-redis.example.test') throw new Error('Unexpected external request');
    if (fixture.offline) throw new Error('Storage offline');
    const args = JSON.parse(options.body);
    fixture.commands.push(args);
    let result;
    if (args[0] === 'GET') result = fixture.raw;
    else if (args[0] === 'EVAL') {
      result = (fixture.raw || '') === args[4] ? 1 : 0;
      if (result) fixture.raw = args[5];
    } else throw new Error('Unexpected Redis command');
    return { ok: true, json: async () => ({ result }) };
  });
  fixture.request = (action, fields = {}) => ({ action, requestId: randomUUID(), ...(action === 'batch' ? { booksOrdered: 40 } : {}), ...fields });
  return fixture;
}

module.exports = { salesFixture };
