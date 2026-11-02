(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.CampSales = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const PEOPLE = Object.freeze(['Tejas', 'Jaskirat', 'Nandana', 'Nithilan', 'Shaurya', 'Nihira']);
  function person(value) {
    if (!PEOPLE.includes(value)) throw new Error('Choose a person from the dropdown.');
    return value;
  }

  // Store amounts as integer paise so decimal additions remain exact.
  function parseMoney(value) {
    if (typeof value !== 'string' || !/^\d{1,7}(?:\.\d{1,2})?$/.test(value.trim())) {
      throw new Error('Enter an INR amount with up to two decimal places, such as 349.50.');
    }
    const [rupees, decimals = ''] = value.trim().split('.');
    const paise = Number(rupees) * 100 + Number(decimals.padEnd(2, '0'));
    if (paise <= 0) throw new Error('Enter an amount greater than ₹0.00.');
    return paise;
  }

  function money(paise) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(paise / 100);
  }

  function parseQuantity(value) {
    const text = String(value ?? '').trim();
    if (!/^[1-9]\d{0,5}$/.test(text)) throw new Error('Enter a whole number of books from 1 to 999,999.');
    return Number(text);
  }

  function quantity(sale) { return sale.quantity ?? 1; }
  function saleTotal(sale) { return sale.pricePaise * quantity(sale); }

  function createBatch(batches, cost, id, createdAt, booksOrdered, paidBy) {
    return {
      id,
      number: batches.reduce((largest, batch) => Math.max(largest, batch.number), 0) + 1,
      costPaise: parseMoney(cost),
      booksOrdered: parseQuantity(booksOrdered),
      paidBy: person(paidBy),
      createdAt
    };
  }

  function createBatchSale(batches, input, id, createdAt) {
    const batch = batches.find(item => item.id === input.batchId);
    if (!batch) throw new Error('Choose an existing batch before recording a sale.');
    if (!['Paperback', 'Hardcover'].includes(input.format)) throw new Error('Choose Paperback or Hardcover.');
    return { id, batchId: batch.id, channel: 'batch', paidTo: person(input.paidTo), format: input.format, quantity: parseQuantity(input.quantity ?? 1), pricePaise: parseMoney(input.price), paymentName: paymentName(input.paymentName), createdAt, status: 'active' };
  }

  function createOnlineSale(input, id, createdAt) {
    if (!['Paperback', 'Hardcover'].includes(input.format)) throw new Error('Choose Paperback or Hardcover.');
    return { id, channel: 'online', format: input.format, quantity: parseQuantity(input.quantity ?? 1), pricePaise: parseMoney(input.price), paymentName: paymentName(input.paymentName), createdAt, status: 'active' };
  }

  function createExtraCost(input, id, createdAt) {
    if (typeof input.description !== 'string' || !input.description.trim() || input.description.trim().length > 120) throw new Error('Describe the extra cost in 1 to 120 characters.');
    return { id, channel: 'online', paidBy: person(input.paidBy), description: input.description.trim(), costPaise: parseMoney(input.cost), createdAt };
  }

  function paymentName(value = '') {
    if (typeof value !== 'string' || value.trim().length > 80) throw new Error('Payment name must be no longer than 80 characters.');
    return value.trim();
  }

  function summary(ledger) {
    const active = ledger.sales.filter(sale => sale.status === 'active');
    const salesPaise = active.reduce((sum, sale) => sum + saleTotal(sale), 0);
    const batchCostsPaise = ledger.batches.reduce((sum, batch) => sum + batch.costPaise, 0);
    const extraCostsPaise = (ledger.extraCosts || []).reduce((sum, cost) => sum + cost.costPaise, 0);
    const costsPaise = batchCostsPaise + extraCostsPaise;
    const batchProfits = ledger.batches.map(batch => {
      const sales = active.filter(sale => sale.batchId === batch.id);
      const revenuePaise = sales.reduce((sum, sale) => sum + saleTotal(sale), 0);
      const booksSold = sales.reduce((sum, sale) => sum + quantity(sale), 0);
      const booksOrdered = batch.booksOrdered ?? null;
      return { ...batch, booksOrdered, revenuePaise, profitPaise: revenuePaise - batch.costPaise, booksSold, booksLeft: booksOrdered === null ? null : booksOrdered - booksSold };
    });
    if (!Number.isSafeInteger(salesPaise) || !Number.isSafeInteger(costsPaise)) throw new Error('These amounts exceed the recorder’s supported total.');
    return { salesPaise, costsPaise, batchCostsPaise, extraCostsPaise, profitPaise: salesPaise - costsPaise, booksSold: active.reduce((sum, sale) => sum + quantity(sale), 0), batchProfits };
  }

  // Split every cash flow once. Distribute leftover paise in the fixed author order.
  function authorDashboard(ledger) {
    const targets = new Map(), unattributed = [];
    function split(kind, record, total, holder, income, label) {
      if (!PEOPLE.includes(holder)) { unattributed.push({ kind, id: record.id, label, missing: income ? 'recipient' : 'payer' }); return; }
      PEOPLE.forEach((name, index) => {
        if (name === holder) return;
        const amountPaise = Math.floor(total / PEOPLE.length) + (index < total % PEOPLE.length ? 1 : 0);
        if (!amountPaise) return;
        const basisFrom = income ? holder : name, basisTo = income ? name : holder;
        const id = `${kind}:${record.id}:${basisFrom}:${basisTo}`;
        targets.set(id, { id, kind, sourceId: record.id, label, basisFrom, basisTo, targetPaise: amountPaise, settledPaise: 0, createdAt: record.createdAt });
      });
    }
    for (const batch of ledger.batches) split('batch', batch, batch.costPaise, batch.paidBy, false, `Batch ${String(batch.number).padStart(3, '0')} · Books ordered`);
    for (const cost of ledger.extraCosts || []) split('extra-cost', cost, cost.costPaise, cost.paidBy, false, `Extra cost · ${cost.description}`);
    for (const sale of ledger.sales.filter(sale => sale.status === 'active')) split('sale', sale, saleTotal(sale), sale.paidTo, true, `Order ${String(sale.number).padStart(4, '0')} · Sales income`);
    for (const payment of ledger.authorPayments || []) {
      if (payment.voidedAt) continue;
      if (!targets.has(payment.transactionId)) targets.set(payment.transactionId, { id: payment.transactionId, kind: payment.kind, sourceId: payment.sourceId, label: payment.label, basisFrom: payment.basisFrom, basisTo: payment.basisTo, targetPaise: 0, settledPaise: 0, createdAt: payment.createdAt });
      const target = targets.get(payment.transactionId);
      target.settledPaise += payment.from === target.basisFrom ? payment.amountPaise : -payment.amountPaise;
    }
    const pending = [];
    for (const target of targets.values()) {
      const remaining = target.targetPaise - target.settledPaise;
      if (!Number.isSafeInteger(remaining)) throw new Error('Author balances exceed the recorder’s supported total.');
      if (remaining) pending.push({ ...target, from: remaining > 0 ? target.basisFrom : target.basisTo, to: remaining > 0 ? target.basisTo : target.basisFrom, amountPaise: Math.abs(remaining), adjustment: target.settledPaise !== 0 });
    }
    const pairs = [];
    PEOPLE.forEach((first, index) => {
      for (const second of PEOPLE.slice(index + 1)) {
        const netPaise = pending.reduce((sum, entry) => entry.from === first && entry.to === second ? sum + entry.amountPaise : entry.from === second && entry.to === first ? sum - entry.amountPaise : sum, 0);
        if (!Number.isSafeInteger(netPaise)) throw new Error('Author balances exceed the recorder’s supported total.');
        pairs.push({ first, second, from: netPaise < 0 ? second : first, to: netPaise < 0 ? first : second, amountPaise: Math.abs(netPaise) });
      }
    });
    return { pending, payments: ledger.authorPayments || [], pairs, unattributed };
  }

  function localDay(value = Date.now()) {
    return new Date(new Date(value).getTime() + 19800000).toISOString().slice(0, 10);
  }

  function matchesFilters(entry, filters) {
    if (filters.type !== 'all' && entry.kind !== filters.type) return false;
    if (filters.channel !== 'all' && (entry.channel !== filters.channel)) return false;
    if (filters.format !== 'all' && (entry.kind !== 'sale' || entry.format !== filters.format)) return false;
    if (filters.batchId !== 'all' && (entry.kind === 'batch' ? entry.id : entry.batchId) !== filters.batchId) return false;
    if (filters.dateEnabled && localDay(entry.createdAt) !== filters.date) return false;
    return true;
  }

  return { PEOPLE, person, parseMoney, parseQuantity, quantity, saleTotal, money, createBatch, createBatchSale, createOnlineSale, createExtraCost, summary, authorDashboard, localDay, matchesFilters };
});
