const { createHash } = require('node:crypto');
const { redisConfig } = require('./analytics-counters');
const model = require('../assets/sales/model');

const LEDGER_KEY = 'frc:sales:v1:ledger';
const COMPARE_AND_SAVE = [
  "local current = redis.call('GET', KEYS[1]) or ''",
  'if current ~= ARGV[1] then return 0 end',
  "redis.call('SET', KEYS[1], ARGV[2])",
  'return 1'
].join('\n');

function problem(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

async function command(args) {
  const { url, token, configured } = redisConfig();
  if (!configured) throw problem('Sales storage is not configured. No records have been saved.', 503);
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000)
  });
  const payload = await response.json();
  if (!response.ok || payload.error) throw problem('Sales storage is unavailable. Please try again.', 503);
  return payload.result;
}

function decode(raw) {
  if (raw === null) return { version: 1, revision: 0, batches: [], sales: [] };
  const state = JSON.parse(raw);
  if (state.version !== 1 || !Array.isArray(state.batches) || !Array.isArray(state.sales) || (state.extraCosts !== undefined && !Array.isArray(state.extraCosts)) || !Number.isSafeInteger(state.revision)) {
    throw problem('Sales storage could not be read. Existing records have not been changed.', 503);
  }
  // Legacy sales each represented one book. Only Batch 001 has a known opening count.
  for (const sale of state.sales) if (sale.quantity === undefined) sale.quantity = 1;
  for (const batch of state.batches) if (batch.booksOrdered === undefined) batch.booksOrdered = batch.number === 1 ? 40 : null;
  return state;
}

async function readLedger() {
  for (let attempt = 0; attempt < 4; attempt++) {
    const raw = await command(['GET', LEDGER_KEY]);
    const state = decode(raw);
    if (raw === null || JSON.stringify(state) === raw) return state;
    state.revision++;
    if (Number(await command(['EVAL', COMPARE_AND_SAVE, 1, LEDGER_KEY, raw, JSON.stringify(state)])) === 1) return state;
  }
  throw problem('Records are being updated. Please refresh.', 409);
}

function checkStock(state, batchId) {
  const batch = model.summary(state).batchProfits.find(batch => batch.id === batchId);
  if (!batch || batch.booksOrdered === null) throw problem('Set the number of books ordered for this batch in Record Editor first.');
  if (batch.booksLeft < 0) throw problem(`Batch ${String(batch.number).padStart(3, '0')} does not have enough books. Reduce the sale quantity or correct the batch’s books ordered.`, 409);
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw problem('Choose a valid sales action.');
  if (!['batch', 'batch-sale', 'online-sale', 'edit-batch', 'edit-sale', 'delete-sale', 'extra-cost', 'edit-extra-cost'].includes(body.action)) throw problem('Choose a valid sales action.');
  if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) throw problem('A valid request ID is required. Refresh the page and try again.');
  if (JSON.stringify(body).length > 4096) throw problem('This request is too large.', 413);
}

async function saveEntry(body) {
  validateRequest(body);
  const payload = { action: body.action, batchId: body.batchId, format: body.format, price: body.price, cost: body.cost, orderId: body.orderId, paymentName: body.paymentName, recordId: body.recordId, expectedVersion: body.expectedVersion, channel: body.channel, quantity: body.quantity, booksOrdered: body.booksOrdered, description: body.description };
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  for (let attempt = 0; attempt < 4; attempt++) {
    const raw = await command(['GET', LEDGER_KEY]);
    const state = decode(raw);
    state.extraCosts ||= [];
    const receipt = (state.mutationReceipts || []).find(item => item.id === body.requestId);
    if (receipt) {
      if (receipt.fingerprint !== fingerprint) throw problem('This request ID was already used. Refresh and try again.', 409);
      return state;
    }
    const duplicate = [...state.batches, ...state.sales, ...state.extraCosts].find(record => record.id === body.requestId || record.cancelRequestId === body.requestId);
    if (duplicate) {
      const previous = duplicate.cancelRequestId === body.requestId ? duplicate.cancelFingerprint : duplicate.fingerprint;
      if (previous !== fingerprint) throw problem('This request ID was already used. Refresh and try again.', 409);
      return state;
    }
    const now = new Date().toISOString();
    if ((state.deletedSaleIds || []).includes(body.requestId)) throw problem('This sale was deleted. Refresh your records.', 409);
    const nextSaleNumber = Math.max(state.nextSaleNumber || 1, ...state.sales.map(sale => sale.number + 1));
    if (['edit-batch', 'edit-sale', 'delete-sale', 'edit-extra-cost'].includes(body.action)) {
      const records = body.action === 'edit-batch' ? state.batches : body.action === 'edit-extra-cost' ? state.extraCosts : state.sales;
      const record = records.find(item => item.id === body.recordId);
      if (!record) throw problem('This record no longer exists. Refresh your records.', 404);
      if (!Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 0) throw problem('Refresh the record before editing it.');
      if ((record.recordVersion || 0) !== body.expectedVersion) throw problem('This record was changed on another device. Refresh before saving your changes.', 409);
      if (body.action === 'delete-sale') {
        state.sales = state.sales.filter(sale => sale.id !== record.id);
        state.deletedSaleIds = [...(state.deletedSaleIds || []), record.id];
        state.nextSaleNumber = nextSaleNumber;
      } else {
        try {
          if (body.action === 'edit-batch') {
            record.costPaise = model.parseMoney(body.cost);
            record.booksOrdered = model.parseQuantity(body.booksOrdered ?? record.booksOrdered);
            checkStock(state, record.id);
          }
          else if (body.action === 'edit-extra-cost') {
            const fields = model.createExtraCost(body, record.id, record.createdAt);
            Object.assign(record, { description: fields.description, costPaise: fields.costPaise });
          } else {
            if (!['batch', 'online'].includes(body.channel)) throw problem('Choose Batch sale or Online stall.');
            const input = { ...body, quantity: body.quantity ?? record.quantity };
            const fields = body.channel === 'batch'
              ? model.createBatchSale(state.batches, input, record.id, record.createdAt)
              : model.createOnlineSale(input, record.id, record.createdAt);
            // Keep identity, original timestamp and legacy cancellation status.
            Object.assign(record, { channel: fields.channel, format: fields.format, quantity: fields.quantity, pricePaise: fields.pricePaise, paymentName: fields.paymentName });
            if (fields.channel === 'batch') record.batchId = fields.batchId;
            else delete record.batchId;
            if (record.channel === 'batch' && record.status === 'active') checkStock(state, record.batchId);
          }
        } catch (error) { throw problem(error.message, error.status || 400); }
        record.updatedAt = now;
        record.recordVersion = (record.recordVersion || 0) + 1;
      }
      state.mutationReceipts = [...(state.mutationReceipts || []), { id: body.requestId, fingerprint }].slice(-2000);
    } else {
      if (state.batches.length + state.sales.length + state.extraCosts.length >= 20000) throw problem('The recorder is full. Export your records and contact the site administrator.', 409);
      try {
        if (body.action === 'batch') {
          state.batches.push({ ...model.createBatch(state.batches, body.cost, body.requestId, now, body.booksOrdered), fingerprint });
        } else if (body.action === 'extra-cost') {
          state.extraCosts.push({ ...model.createExtraCost(body, body.requestId, now), fingerprint });
        } else {
          const sale = body.action === 'batch-sale'
            ? model.createBatchSale(state.batches, body, body.requestId, now)
            : model.createOnlineSale(body, body.requestId, now);
          state.sales.push({ ...sale, number: nextSaleNumber, fingerprint });
          if (sale.channel === 'batch') checkStock(state, sale.batchId);
          state.nextSaleNumber = nextSaleNumber + 1;
        }
      } catch (error) {
        throw problem(error.message, error.status || 400);
      }
    }
    try { model.summary(state); } catch (error) { throw problem(error.message); }
    state.revision++;
    const saved = await command(['EVAL', COMPARE_AND_SAVE, 1, LEDGER_KEY, raw || '', JSON.stringify(state)]);
    if (Number(saved) === 1) return state;
  }
  throw problem('Another team member updated the records. Try saving again.', 409);
}

// Internal retry metadata is not part of the downloadable sales records.
function publicLedger(state) {
  const clean = record => {
    const { fingerprint, cancelFingerprint, cancelRequestId, ...fields } = record;
    return fields;
  };
  return { version: state.version, revision: state.revision, batches: state.batches.map(clean), sales: state.sales.map(clean), extraCosts: (state.extraCosts || []).map(clean) };
}

module.exports = { readLedger, saveEntry, publicLedger, LEDGER_KEY };
