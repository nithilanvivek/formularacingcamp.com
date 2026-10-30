const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../assets/sales/model');
const { salesFixture } = require('./helpers/sales-fixture');
const store = require('../lib/sales-store');
const handler = require('../api/sales-data');
const verification = require('../lib/sales-verification');

test('sales amounts accept decimal INR and retain exact paise', () => {
  assert.equal(model.parseMoney('349.50'), 34950);
  assert.equal(model.parseMoney(' 12.5 '), 1250);
  assert.equal(model.parseMoney('0.01') + model.parseMoney('0.02'), 3);
  assert.equal(model.parseMoney('1000'), 100000);
  for (const value of ['', '0', '0.00', '-1', '1.234', '1e3', 'Infinity', '1,000', '10000000', null]) {
    assert.throws(() => model.parseMoney(value));
  }
});

test('batch numbering stays unique and sales require a known batch and format', () => {
  const batches = [{ id: 'batch-1', number: 1 }, { id: 'batch-3', number: 3 }];
  assert.deepEqual(model.createBatch(batches, '1250.50', 'batch-4', '2026-10-30T12:00:00Z'), {
    id: 'batch-4', number: 4, costPaise: 125050, createdAt: '2026-10-30T12:00:00Z'
  });
  const input = { batchId: 'batch-1', format: 'Paperback', price: '349.50' };
  assert.equal(model.createBatchSale(batches, input, 'order-1', 'now').pricePaise, 34950);
  assert.throws(() => model.createBatchSale(batches, { ...input, batchId: 'unknown' }, 'order-1', 'now'));
  assert.throws(() => model.createBatchSale(batches, { ...input, format: 'Ebook' }, 'order-1', 'now'));
});

test('profits subtract full batch costs, exclude cancellations and include online stall sales', () => {
  const batches = [{ id: 'b1', number: 1, costPaise: 10000 }, { id: 'b2', number: 2, costPaise: 20000 }];
  const sales = [
    { batchId: 'b1', pricePaise: 15000, status: 'active' },
    { batchId: 'b1', pricePaise: 8000, status: 'cancelled' },
    { channel: 'online', pricePaise: 7000, status: 'active' }
  ];
  const totals = model.summary({ batches, sales });
  assert.equal(totals.salesPaise, 22000);
  assert.equal(totals.profitPaise, -8000);
  assert.equal(totals.booksSold, 2);
  assert.deepEqual(totals.batchProfits.map(batch => batch.profitPaise), [5000, -20000]);
  assert.equal(totals.profitPaise / 6, -8000 / 6);
});

test('record filters combine type, sale channel, format, batch and recorded day in India time', () => {
  const entries = [
    { kind: 'batch', id: 'b1', createdAt: '2026-10-29T19:00:00Z' },
    { kind: 'sale', batchId: 'b1', channel: 'batch', format: 'Paperback', createdAt: '2026-10-29T19:00:00Z' },
    { kind: 'sale', channel: 'online', format: 'Hardcover', createdAt: '2026-10-30T19:00:00Z' }
  ];
  const all = { type: 'all', channel: 'all', format: 'all', batchId: 'all', dateEnabled: false, date: '2026-10-30' };
  const count = changes => entries.filter(entry => model.matchesFilters(entry, { ...all, ...changes })).length;
  assert.equal(count({}), 3);
  assert.equal(count({ type: 'batch' }), 1);
  assert.equal(count({ type: 'sale', channel: 'batch', format: 'Paperback', batchId: 'b1', dateEnabled: true }), 1);
  assert.equal(count({ type: 'sale', channel: 'batch', format: 'Hardcover' }), 0);
  assert.equal(count({ channel: 'online', dateEnabled: true }), 0);
  assert.equal(count({ channel: 'online', dateEnabled: true, date: '2026-10-31' }), 1);
  assert.equal(count({ batchId: 'unknown' }), 0);
});

test('server persists dated batches and sales, retries safely, and retains cancelled orders', async t => {
  const fixture = salesFixture(t);
  const batchRequest = fixture.request('batch', { cost: '100.10' });
  const first = await store.saveEntry(batchRequest);
  assert.equal(first.batches[0].number, 1);
  assert.ok(Number.isFinite(Date.parse(first.batches[0].createdAt)));
  assert.equal((await store.saveEntry(batchRequest)).batches.length, 1);
  const saleRequest = fixture.request('batch-sale', { batchId: first.batches[0].id, format: 'Paperback', price: '200.25', paymentName: '  Buyer <one>  ' });
  const second = await store.saveEntry(saleRequest);
  assert.equal(second.sales[0].paymentName, 'Buyer <one>');
  assert.equal((await store.saveEntry(saleRequest)).sales.length, 1);
  await assert.rejects(store.saveEntry({ ...saleRequest, price: '99.00' }), { status: 409 });
  await store.saveEntry(fixture.request('online-sale', { format: 'Hardcover', price: '300.50' }));
  const cancel = fixture.request('cancel', { orderId: second.sales[0].id });
  const cancelled = await store.saveEntry(cancel);
  assert.equal(cancelled.sales.length, 2);
  assert.equal(cancelled.sales[0].status, 'cancelled');
  assert.ok(Number.isFinite(Date.parse(cancelled.sales[0].cancelledAt)));
  assert.equal((await store.saveEntry(cancel)).revision, cancelled.revision);
  assert.equal(model.summary(cancelled).profitPaise, 20040);
  assert.equal('fingerprint' in store.publicLedger(cancelled).sales[0], false);
  assert.equal('cancelRequestId' in store.publicLedger(cancelled).sales[0], false);
  await assert.rejects(store.saveEntry(fixture.request('cancel', { orderId: second.sales[0].id })), { status: 409 });
});

test('simultaneous saves preserve both records and assign distinct batch numbers', async t => {
  salesFixture(t);
  const { randomUUID } = require('node:crypto');
  await Promise.all([100, 200, 300].map(cost => store.saveEntry({ action: 'batch', requestId: randomUUID(), cost: String(cost) })));
  const ledger = await store.readLedger();
  assert.deepEqual(ledger.batches.map(batch => batch.number), [1, 2, 3]);
  assert.equal(model.summary(ledger).costsPaise, 60000);
});

test('invalid sales cannot change saved records, and storage failures never silently save locally', async t => {
  const fixture = salesFixture(t);
  for (const fields of [{ format: 'Other', price: '10' }, { format: 'Hardcover', price: '1e3' }, { format: 'Hardcover', price: '10', paymentName: 'x'.repeat(81) }]) {
    await assert.rejects(store.saveEntry(fixture.request('online-sale', fields)), { status: 400 });
    assert.equal(fixture.raw, null);
  }
  fixture.offline = true;
  await assert.rejects(store.saveEntry(fixture.request('batch', { cost: '500' })));
  assert.equal(fixture.raw, null);
});

async function callAPI(method, body, headers = {}) {
  const response = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; } };
  await handler({ method, body, headers: { host: 'localhost', origin: 'http://localhost', 'content-type': 'application/json', ...headers } }, response);
  return response;
}

test('one page verification unlocks reads and repeated writes; unverified requests cannot access records', async t => {
  const fixture = salesFixture(t);
  const body = fixture.request('batch', { cost: '100.50' });
  assert.equal((await callAPI('POST', body, { origin: 'https://elsewhere.test' })).statusCode, 403);
  const locked = await callAPI('GET');
  assert.equal(locked.statusCode, 401);
  assert.equal(locked.body.verificationRequired, true);
  assert.equal(locked.body.turnstileSiteKey, 'test-site-key');
  assert.equal('batches' in locked.body, false);
  assert.equal(fixture.commands.length, 0);
  assert.equal((await callAPI('POST', body)).statusCode, 401);
  const challenge = { action: 'verify-page', turnstileToken: 'test-token' };
  assert.equal((await callAPI('POST', { ...challenge, turnstileToken: '' })).statusCode, 400);
  fixture.challenge.action = 'contact';
  assert.equal((await callAPI('POST', challenge)).statusCode, 400);
  fixture.challenge.action = 'sales'; fixture.challenge.hostname = 'elsewhere.test';
  assert.equal((await callAPI('POST', challenge)).statusCode, 400);
  assert.equal(fixture.raw, null);
  fixture.challenge.hostname = 'localhost';
  const unlocked = await callAPI('POST', challenge);
  assert.equal(unlocked.statusCode, 200);
  const cookie = unlocked.headers['Set-Cookie'].split(';')[0];
  assert.match(unlocked.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(fixture.verifications, 3);
  const saved = await callAPI('POST', body, { cookie });
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.batches[0].costPaise, 10050);
  assert.equal(saved.headers['Cache-Control'], 'private, no-store, max-age=0');
  assert.ok(saved.headers['X-Robots-Tag'].includes('noindex'));
  const read = await callAPI('GET', undefined, { cookie });
  assert.equal(read.statusCode, 200);
  assert.equal(read.body.batches.length, 1);
  assert.equal((await callAPI('POST', fixture.request('online-sale', { format: 'Paperback', price: '500' }), { cookie })).statusCode, 200);
  assert.equal(fixture.verifications, 3, 'Saving and refreshing must not recheck Turnstile');
  assert.equal(JSON.stringify(read.body).includes('test-secret-key'), false);
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal((await callAPI('POST', challenge)).statusCode, 503);
  assert.equal((await callAPI('DELETE')).statusCode, 405);
  fixture.offline = true;
  process.env.TURNSTILE_SECRET_KEY = 'test-secret-key';
  assert.equal((await callAPI('GET', undefined, { cookie })).statusCode, 503);
});

test('page verification sessions reject expiry, tampering and another hostname', t => {
  salesFixture(t);
  const now = Date.now();
  const cookie = verification.sessionCookie('localhost', now).split(';')[0];
  assert.equal(verification.hasSession({ headers: { cookie } }, 'localhost', now), true);
  assert.equal(verification.hasSession({ headers: { cookie } }, 'localhost', now + verification.SESSION_SECONDS * 1000), false);
  assert.equal(verification.hasSession({ headers: { cookie } }, 'elsewhere.test', now), false);
  assert.equal(verification.hasSession({ headers: { cookie: cookie.slice(0, -1) + '!' } }, 'localhost', now), false);
  const [name, signed] = cookie.split('=');
  const [payload, signature] = signed.split('.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  data.expires += 86400000;
  const tampered = `${name}=${Buffer.from(JSON.stringify(data)).toString('base64url')}.${signature}`;
  assert.equal(verification.hasSession({ headers: { cookie: tampered } }, 'localhost', now), false);
});

test('sales and UPI have noindex in page metadata and HTTP headers, and are absent from the sitemap', () => {
  const root = path.resolve(__dirname, '..');
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  for (const name of ['sales', 'upi']) {
    const html = fs.readFileSync(path.join(root, `${name}.html`), 'utf8');
    assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">/);
    for (const source of [`/${name}`, `/${name}.html`]) {
      assert.ok(config.headers.some(rule => rule.source === source && rule.headers.some(header => header.key === 'X-Robots-Tag' && header.value.includes('noindex'))));
    }
    assert.equal(sitemap.includes(`/${name}<`), false);
  }
});
