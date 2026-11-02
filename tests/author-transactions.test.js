const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../assets/sales/model');
const store = require('../lib/sales-store');
const { salesFixture } = require('./helpers/sales-fixture');
const pay = (fixture, entry) => fixture.request('pay-author-transaction', { transactionId: entry.id, from: entry.from, to: entry.to, expectedAmountPaise: entry.amountPaise });
const pair = (dashboard, a, b) => dashboard.pairs.find(pair => [pair.first, pair.second].includes(a) && [pair.first, pair.second].includes(b));

test('each cash flow has five author shares, income reverses direction, and 15 pairs net both directions', () => {
  const ledger = { batches: [{ id: 'b', number: 1, costPaise: 60000, paidBy: 'Tejas' }], sales: [{ id: 's', number: 1, status: 'active', pricePaise: 120000, paidTo: 'Nithilan' }], extraCosts: [{ id: 'm', description: 'Mug', costPaise: 60000, paidBy: 'Jaskirat' }] };
  const dashboard = model.authorDashboard(ledger);
  assert.equal(dashboard.pending.length, 15);
  assert.equal(dashboard.pairs.length, 15);
  assert.equal(new Set(dashboard.pairs.map(pair => `${pair.first}:${pair.second}`)).size, 15);
  assert.equal(dashboard.pending.filter(entry => entry.kind === 'batch').every(entry => entry.to === 'Tejas' && entry.from !== 'Tejas' && entry.amountPaise === 10000), true);
  assert.equal(dashboard.pending.filter(entry => entry.kind === 'sale').every(entry => entry.from === 'Nithilan' && entry.to !== 'Nithilan' && entry.amountPaise === 20000), true);
  assert.equal(pair(dashboard, 'Tejas', 'Jaskirat').amountPaise, 0);
  assert.equal(pair(dashboard, 'Tejas', 'Nithilan').from, 'Nithilan');
  assert.equal(pair(dashboard, 'Tejas', 'Nithilan').amountPaise, 30000);
});

test('whole-paise splits conserve every cash flow, exclude self transfers, and flag unknown holders', () => {
  for (let amount = 1; amount < 20; amount++) {
    for (const holder of model.PEOPLE) {
      const dashboard = model.authorDashboard({ batches: [{ id: 'b', number: 1, costPaise: amount, paidBy: holder }], sales: [] });
      const ownShare = Math.floor(amount / 6) + (model.PEOPLE.indexOf(holder) < amount % 6 ? 1 : 0);
      assert.equal(dashboard.pending.reduce((sum, entry) => sum + entry.amountPaise, 0) + ownShare, amount);
      assert.equal(dashboard.pending.every(entry => entry.from !== entry.to && Number.isInteger(entry.amountPaise) && entry.amountPaise > 0), true);
    }
  }
  const dashboard = model.authorDashboard({ batches: [{ id: 'b', number: 1, costPaise: 100 }], sales: [{ id: 's', number: 1, pricePaise: 200, status: 'active' }, { id: 'cancelled', status: 'cancelled', pricePaise: 100 }] });
  assert.equal(dashboard.pending.length, 0);
  assert.deepEqual(dashboard.unattributed.map(entry => entry.missing), ['payer', 'recipient']);
  assert.equal(dashboard.pairs.every(pair => pair.amountPaise === 0), true);
});

test('mark paid and mark unpaid are durable, idempotent and do not change profit', async t => {
  const fixture = salesFixture(t);
  const added = await store.saveEntry(fixture.request('batch', { cost: '600' }));
  const entry = model.authorDashboard(added).pending.find(entry => entry.from === 'Nithilan');
  const request = pay(fixture, entry);
  const paid = await store.saveEntry(request);
  assert.equal(model.authorDashboard(paid).pending.length, 4);
  assert.equal(pair(model.authorDashboard(paid), 'Tejas', 'Nithilan').amountPaise, 0);
  assert.equal(model.summary(paid).profitPaise, model.summary(added).profitPaise);
  assert.ok(Number.isFinite(Date.parse(paid.authorPayments[0].createdAt)));
  assert.equal((await store.saveEntry(request)).authorPayments.length, 1);
  await assert.rejects(store.saveEntry(pay(fixture, entry)), { status: 409 });
  const undo = fixture.request('undo-author-payment', { paymentId: paid.authorPayments[0].id });
  const undone = await store.saveEntry(undo);
  assert.ok(undone.authorPayments[0].voidedAt);
  assert.equal(model.authorDashboard(undone).pending.length, 5);
  assert.equal((await store.saveEntry(undo)).revision, undone.revision);
  await store.saveEntry(request); // An old create retry cannot restore a reversed payment.
  assert.ok((await store.readLedger()).authorPayments[0].voidedAt);
  assert.equal(store.publicLedger(paid).authorPayments[0].fingerprint, undefined);
});

test('paid history survives edits, payer changes and deleted income with explicit adjustment/refund debts', async t => {
  const fixture = salesFixture(t);
  const added = await store.saveEntry(fixture.request('batch', { cost: '600' }));
  const batch = added.batches[0];
  const debt = model.authorDashboard(added).pending.find(entry => entry.from === 'Nithilan');
  const settled = await store.saveEntry(pay(fixture, debt));
  const edited = await store.saveEntry(fixture.request('edit-batch', { recordId: batch.id, expectedVersion: 0, cost: '900' }));
  let adjustment = model.authorDashboard(edited).pending.find(entry => entry.id === debt.id);
  assert.equal(adjustment.amountPaise, 5000);
  assert.equal(adjustment.from, 'Nithilan');
  assert.equal(adjustment.adjustment, true);
  assert.deepEqual(edited.authorPayments, settled.authorPayments);
  const reassigned = await store.saveEntry(fixture.request('edit-batch', { recordId: batch.id, expectedVersion: 1, cost: '900', paidBy: 'Nandana' }));
  adjustment = model.authorDashboard(reassigned).pending.find(entry => entry.id === debt.id);
  assert.equal(adjustment.from, 'Tejas');
  assert.equal(adjustment.to, 'Nithilan');
  assert.equal(adjustment.amountPaise, 10000);
  const refunded = await store.saveEntry(pay(fixture, adjustment));
  assert.equal(model.authorDashboard(refunded).pending.some(entry => entry.id === debt.id), false);
  const saleState = await store.saveEntry(fixture.request('batch-sale', { batchId: batch.id, format: 'Paperback', price: '1200', paidTo: 'Shaurya' }));
  const sale = saleState.sales[0];
  const income = model.authorDashboard(saleState).pending.find(entry => entry.kind === 'sale' && entry.to === 'Nihira');
  await store.saveEntry(pay(fixture, income));
  const deleted = await store.saveEntry(fixture.request('delete-sale', { recordId: sale.id, expectedVersion: 0 }));
  const refund = model.authorDashboard(deleted).pending.find(entry => entry.id === income.id);
  assert.equal(refund.from, 'Nihira');
  assert.equal(refund.to, 'Shaurya');
  assert.equal(refund.amountPaise, 20000);
  assert.equal(deleted.authorPayments.length, 3);
});

test('stale and concurrent paid markers cannot settle the same obligation twice or lose another payment', async t => {
  const fixture = salesFixture(t);
  const state = await store.saveEntry(fixture.request('batch', { cost: '600' }));
  const [first, second] = model.authorDashboard(state).pending;
  await assert.rejects(store.saveEntry({ ...pay(fixture, first), expectedAmountPaise: 1 }), { status: 409 });
  await assert.rejects(store.saveEntry({ ...pay(fixture, first), from: 'Nihira' }), { status: 409 });
  const results = await Promise.allSettled([pay(fixture, first), pay(fixture, first), pay(fixture, second)].map(request => store.saveEntry(request)));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 2);
  assert.equal((await store.readLedger()).authorPayments.length, 2);
  assert.equal(model.authorDashboard(await store.readLedger()).pending.length, 3);
});
