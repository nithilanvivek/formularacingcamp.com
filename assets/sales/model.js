(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.CampSales = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

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

  function createBatch(batches, cost, id, createdAt) {
    return {
      id,
      number: batches.reduce((largest, batch) => Math.max(largest, batch.number), 0) + 1,
      costPaise: parseMoney(cost),
      createdAt
    };
  }

  function createBatchSale(batches, input, id, createdAt) {
    const batch = batches.find(item => item.id === input.batchId);
    if (!batch) throw new Error('Choose an existing batch before recording a sale.');
    if (!['Paperback', 'Hardcover'].includes(input.format)) throw new Error('Choose Paperback or Hardcover.');
    return { id, batchId: batch.id, channel: 'batch', format: input.format, pricePaise: parseMoney(input.price), paymentName: paymentName(input.paymentName), createdAt, status: 'active' };
  }

  function createOnlineSale(input, id, createdAt) {
    if (!['Paperback', 'Hardcover'].includes(input.format)) throw new Error('Choose Paperback or Hardcover.');
    return { id, channel: 'online', format: input.format, pricePaise: parseMoney(input.price), paymentName: paymentName(input.paymentName), createdAt, status: 'active' };
  }

  function paymentName(value = '') {
    if (typeof value !== 'string' || value.trim().length > 80) throw new Error('Payment name must be no longer than 80 characters.');
    return value.trim();
  }

  function summary(ledger) {
    const active = ledger.sales.filter(sale => sale.status === 'active');
    const salesPaise = active.reduce((sum, sale) => sum + sale.pricePaise, 0);
    const costsPaise = ledger.batches.reduce((sum, batch) => sum + batch.costPaise, 0);
    const batchProfits = ledger.batches.map(batch => {
      const sales = active.filter(sale => sale.batchId === batch.id);
      const revenuePaise = sales.reduce((sum, sale) => sum + sale.pricePaise, 0);
      return { ...batch, revenuePaise, profitPaise: revenuePaise - batch.costPaise, booksSold: sales.length };
    });
    return { salesPaise, costsPaise, profitPaise: salesPaise - costsPaise, booksSold: active.length, batchProfits };
  }

  return { parseMoney, money, createBatch, createBatchSale, createOnlineSale, summary };
});
