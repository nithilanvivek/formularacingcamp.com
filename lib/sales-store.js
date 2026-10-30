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
  if (state.version !== 1 || !Array.isArray(state.batches) || !Array.isArray(state.sales) || !Number.isSafeInteger(state.revision)) {
    throw problem('Sales storage could not be read. Existing records have not been changed.', 503);
  }
  return state;
}

async function readLedger() {
  return decode(await command(['GET', LEDGER_KEY]));
}

function validateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw problem('Choose a valid sales action.');
  if (!['batch', 'batch-sale', 'online-sale', 'cancel'].includes(body.action)) throw problem('Choose a valid sales action.');
  if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) throw problem('A valid request ID is required. Refresh the page and try again.');
  if (JSON.stringify(body).length > 4096) throw problem('This request is too large.', 413);
}

async function saveEntry(body) {
  validateRequest(body);
  const payload = { action: body.action, batchId: body.batchId, format: body.format, price: body.price, cost: body.cost, orderId: body.orderId, paymentName: body.paymentName };
  const fingerprint = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  for (let attempt = 0; attempt < 4; attempt++) {
    const raw = await command(['GET', LEDGER_KEY]);
    const state = decode(raw);
    const duplicate = [...state.batches, ...state.sales].find(record => record.id === body.requestId || record.cancelRequestId === body.requestId);
    if (duplicate) {
      const previous = duplicate.cancelRequestId === body.requestId ? duplicate.cancelFingerprint : duplicate.fingerprint;
      if (previous !== fingerprint) throw problem('This request ID was already used. Refresh and try again.', 409);
      return state;
    }
    const now = new Date().toISOString();
    if (body.action === 'cancel') {
      const sale = state.sales.find(item => item.id === body.orderId);
      if (!sale) throw problem('Choose an existing order.');
      if (sale.status !== 'active') throw problem('This order has already been cancelled.', 409);
      Object.assign(sale, { status: 'cancelled', cancelledAt: now, cancelRequestId: body.requestId, cancelFingerprint: fingerprint });
    } else {
      if (state.batches.length + state.sales.length >= 20000) throw problem('The recorder is full. Export your records and contact the site administrator.', 409);
      try {
        if (body.action === 'batch') {
          state.batches.push({ ...model.createBatch(state.batches, body.cost, body.requestId, now), fingerprint });
        } else {
          const sale = body.action === 'batch-sale'
            ? model.createBatchSale(state.batches, body, body.requestId, now)
            : model.createOnlineSale(body, body.requestId, now);
          state.sales.push({ ...sale, number: state.sales.length + 1, fingerprint });
        }
      } catch (error) {
        throw problem(error.message);
      }
    }
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
  return { ...state, batches: state.batches.map(clean), sales: state.sales.map(clean) };
}

module.exports = { readLedger, saveEntry, publicLedger, LEDGER_KEY };
