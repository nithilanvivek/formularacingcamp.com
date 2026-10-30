const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../assets/sales/model');
const { salesFixture } = require('./helpers/sales-fixture');
const store = require('../lib/sales-store');
const handler = require('../api/sales-data');

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

test('sales API verifies Turnstile action and hostname before saving, rejects cross-origin writes and fails closed', async t => {
  const fixture = salesFixture(t);
  const body = fixture.request('batch', { cost: '100.50', turnstileToken: 'test-token' });
  assert.equal((await callAPI('POST', body, { origin: 'https://elsewhere.test' })).statusCode, 403);
  assert.equal((await callAPI('POST', { ...body, turnstileToken: '' })).statusCode, 400);
  fixture.challenge.action = 'contact';
  assert.equal((await callAPI('POST', body)).statusCode, 400);
  fixture.challenge.action = 'sales'; fixture.challenge.hostname = 'elsewhere.test';
  assert.equal((await callAPI('POST', body)).statusCode, 400);
  assert.equal(fixture.raw, null);
  fixture.challenge.hostname = 'localhost';
  const saved = await callAPI('POST', body);
  assert.equal(saved.statusCode, 200);
  assert.equal(saved.body.batches[0].costPaise, 10050);
  assert.equal(saved.headers['Cache-Control'], 'private, no-store, max-age=0');
  assert.ok(saved.headers['X-Robots-Tag'].includes('noindex'));
  const read = await callAPI('GET');
  assert.equal(read.body.turnstileSiteKey, 'test-site-key');
  assert.equal(JSON.stringify(read.body).includes('test-secret-key'), false);
  delete process.env.TURNSTILE_SECRET_KEY;
  assert.equal((await callAPI('POST', body)).statusCode, 503);
  assert.equal((await callAPI('DELETE')).statusCode, 405);
  fixture.offline = true;
  assert.equal((await callAPI('GET')).statusCode, 503);
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
