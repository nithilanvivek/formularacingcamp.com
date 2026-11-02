const test = require('node:test');
const assert = require('node:assert/strict');
const workbook = require('../assets/sales/workbook');

function files(bytes) {
  const buffer = Buffer.from(bytes), result = {};
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const size = buffer.readUInt32LE(offset + 18), nameLength = buffer.readUInt16LE(offset + 26), extraLength = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString();
    result[name] = buffer.subarray(start, start + size).toString();
    offset = start + size;
  }
  assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'ZIP central directory must follow the files');
  return result;
}

test('Excel exports contain all records, numeric INR, sortable dates and linked profit formulas', async () => {
  const ledger = {
    batches: [{ id: 'b1', number: 1, costPaise: 10000, booksOrdered: 40, createdAt: '2026-10-30T00:00:00Z' }],
    sales: [
      { id: 's1', number: 1, channel: 'batch', batchId: 'b1', format: 'Paperback', quantity: 3, pricePaise: 15000, paymentName: '=SUM(A1:A2) & <name>', status: 'active', createdAt: '2026-10-30T00:00:00Z' },
      { id: 's2', number: 2, channel: 'online', format: 'Hardcover', pricePaise: 50000, status: 'cancelled', createdAt: '2026-10-30T00:00:00Z', cancelledAt: '2026-10-30T01:00:00Z' }
    ]
  };
  const blob = workbook.create(ledger), exported = files(await blob.arrayBuffer());
  assert.equal(blob.type, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  assert.equal(Object.keys(exported).length, 13);
  const summary = exported['xl/worksheets/sheet1.xml'], profits = exported['xl/worksheets/sheet2.xml'], sales = exported['xl/worksheets/sheet4.xml'];
  assert.match(summary, /<c r="B6" s="2"><f>SUMIF\(.+?<\/f><v>450<\/v>/);
  assert.match(summary, /<c r="B9" s="2"><f>B6-B8-B12<\/f><v>350<\/v>/);
  assert.match(profits, /<f>C2-B2<\/f><v>350<\/v>/);
  assert.match(profits, /<f>F2-E2<\/f><v>37<\/v>/);
  assert.match(profits, /Income per author \(INR\)/);
  assert.match(profits, /<c r="H2" s="2"><f>D2\/Summary!\$B\$10<\/f><v>58\.333333333333336<\/v>/);
  assert.match(sales, /<c r="F2" s="0" t="inlineStr"><is><t xml:space="preserve">=SUM\(A1:A2\) &amp; &lt;name&gt;<\/t>/);
  assert.match(sales, /<c r="G2" s="2"><v>150<\/v>/);
  assert.match(sales, /<c r="K2" s="0"><v>3<\/v>/);
  assert.match(sales, /<c r="L2" s="2"><f>G2\*K2<\/f><v>450<\/v>/);
  assert.match(sales, /<c r="H2" s="3"><v>[\d.]+<\/v>/);
  assert.match(sales, /cancelled/);
  assert.match(sales, /<autoFilter ref="A1:M3"\/>/);
  assert.match(sales, /state="frozen"/);
});

test('an empty sales recorder still exports a valid eight-sheet workbook with zero totals', () => {
  const exported = files(workbook.build({ batches: [], sales: [] }));
  assert.match(exported['xl/workbook.xml'], /name="Batch profits"/);
  assert.match(exported['xl/worksheets/sheet1.xml'], /<f>B6-B8-B12<\/f><v>0<\/v>/);
  assert.match(exported['xl/worksheets/sheet4.xml'], /dimension ref="A1:M1"/);
});


test('stall costs export separately and reduce total profit without altering batch profit', () => {
  const ledger = {
    batches: [{ id: 'b1', number: 1, costPaise: 10000, booksOrdered: 40, createdAt: '2026-10-31T00:00:00Z' }],
    sales: [{ id: 's1', number: 1, channel: 'batch', batchId: 'b1', format: 'Paperback', pricePaise: 20000, status: 'active', createdAt: '2026-10-31T00:00:00Z' }],
    extraCosts: [{ id: 'c1', description: '=Delivery & taxes', costPaise: 12550, channel: 'online', createdAt: '2026-10-31T01:00:00Z' }]
  };
  const exported = files(workbook.build(ledger));
  assert.match(exported['xl/workbook.xml'], /name="Extra costs"/);
  assert.match(exported['xl/worksheets/sheet1.xml'], /<f>B6-B8-B12<\/f><v>-25.5<\/v>/);
  assert.match(exported['xl/worksheets/sheet1.xml'], /<f>SUM\(&apos;Extra costs&apos;!D2:D2\)<\/f><v>125.5<\/v>/);
  assert.match(exported['xl/worksheets/sheet2.xml'], /<f>C2-B2<\/f><v>100<\/v>/);
  assert.match(exported['xl/worksheets/sheet5.xml'], /<c r="D2" s="2"><v>125.5<\/v>/);
  assert.match(exported['xl/worksheets/sheet5.xml'], /=Delivery &amp; taxes/);
  assert.match(exported['xl/worksheets/sheet5.xml'], /<c r="E2" s="3"><v>[\d.]+<\/v>/);
  assert.match(exported['xl/_rels/workbook.xml.rels'], /Id="rId9"[^>]+relationships\/styles/);
});

test('merchandising export links expenses into profit and includes batch payment attribution', () => {
  const ledger = {
    batches: [{ id: 'b1', number: 1, costPaise: 10000, booksOrdered: 40, paidBy: 'Nandana', createdAt: '2026-11-02T00:00:00Z' }],
    sales: [{ id: 's1', number: 1, channel: 'batch', batchId: 'b1', format: 'Paperback', pricePaise: 20000, paidTo: 'Tejas', status: 'active', createdAt: '2026-11-02T00:00:00Z' }],
    extraCosts: [{ id: 'm1', description: '=Stickers & mugs', costPaise: 5025, paidBy: 'Nihira', createdAt: '2026-11-02T01:00:00Z' }]
  };
  const exported = files(workbook.build(ledger));
  assert.match(exported['xl/workbook.xml'], /name="Extra costs"/);
  assert.match(exported['xl/worksheets/sheet1.xml'], /<f>B6-B8-B12<\/f><v>49.75<\/v>/);
  assert.match(exported['xl/worksheets/sheet1.xml'], /<f>SUM\(&apos;Extra costs&apos;!D2:D2\)<\/f><v>50.25<\/v>/);
  assert.match(exported['xl/worksheets/sheet2.xml'], /<f>C2-B2<\/f><v>100<\/v>/);
  assert.match(exported['xl/worksheets/sheet3.xml'], /<c r="F2"[^>]+>.*?Nandana/);
  assert.match(exported['xl/worksheets/sheet4.xml'], /<c r="M2"[^>]+>.*?Tejas/);
  assert.match(exported['xl/worksheets/sheet5.xml'], /<c r="D2" s="2"><v>50.25<\/v>/);
  assert.match(exported['xl/worksheets/sheet5.xml'], /=Stickers &amp; mugs/);
  assert.match(exported['xl/worksheets/sheet5.xml'], /Nihira/);
});

test('author export includes payment history, net formulas and missing attribution without hiding old records', () => {
  const ledger = {
    batches: [{ id: 'b', number: 1, costPaise: 60000, booksOrdered: 40, paidBy: 'Tejas', createdAt: '2026-11-02T00:00:00Z' }],
    sales: [{ id: 's', number: 1, channel: 'online', pricePaise: 10000, format: 'Paperback', status: 'active', createdAt: '2026-11-02T00:00:00Z' }],
    authorPayments: [{ id: 'p', transactionId: 'batch:b:Jaskirat:Tejas', kind: 'batch', sourceId: 'b', label: 'Batch 001 · Books ordered', basisFrom: 'Jaskirat', basisTo: 'Tejas', from: 'Jaskirat', to: 'Tejas', amountPaise: 10000, createdAt: '2026-11-02T01:00:00Z' }]
  };
  const exported = files(workbook.build(ledger));
  assert.match(exported['xl/workbook.xml'], /name="Author transactions"/);
  assert.match(exported['xl/workbook.xml'], /name="Author balances"/);
  assert.match(exported['xl/worksheets/sheet6.xml'], /Paid/);
  assert.match(exported['xl/worksheets/sheet6.xml'], /Unpaid/);
  assert.match(exported['xl/worksheets/sheet7.xml'], /dimension ref="A1:E16"/);
  assert.match(exported['xl/worksheets/sheet7.xml'], /<c r="C2" s="2"><f>SUMIFS.+?<\/f><v>0<\/v>/);
  assert.match(exported['xl/worksheets/sheet7.xml'], /<c r="D2" s="0" t="str"><f>IF.+?<\/f><v>Settled<\/v>/);
  assert.match(exported['xl/worksheets/sheet8.xml'], /recipient/);
  assert.match(exported['xl/worksheets/sheet8.xml'], /Order 0001/);
});
