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
  assert.equal(Object.keys(exported).length, 10);
  const summary = exported['xl/worksheets/sheet1.xml'], profits = exported['xl/worksheets/sheet2.xml'], sales = exported['xl/worksheets/sheet4.xml'];
  assert.match(summary, /<c r="B6" s="2"><f>SUMIF\(.+?<\/f><v>450<\/v>/);
  assert.match(summary, /<c r="B9" s="2"><f>B6-B8-B12<\/f><v>350<\/v>/);
  assert.match(profits, /<f>C2-B2<\/f><v>350<\/v>/);
  assert.match(profits, /<f>F2-E2<\/f><v>37<\/v>/);
  assert.match(sales, /<c r="F2" s="0" t="inlineStr"><is><t xml:space="preserve">=SUM\(A1:A2\) &amp; &lt;name&gt;<\/t>/);
  assert.match(sales, /<c r="G2" s="2"><v>150<\/v>/);
  assert.match(sales, /<c r="K2" s="0"><v>3<\/v>/);
  assert.match(sales, /<c r="L2" s="2"><f>G2\*K2<\/f><v>450<\/v>/);
  assert.match(sales, /<c r="H2" s="3"><v>[\d.]+<\/v>/);
  assert.match(sales, /cancelled/);
  assert.match(sales, /<autoFilter ref="A1:L3"\/>/);
  assert.match(sales, /state="frozen"/);
});

test('an empty sales recorder still exports a valid five-sheet workbook with zero totals', () => {
  const exported = files(workbook.build({ batches: [], sales: [] }));
  assert.match(exported['xl/workbook.xml'], /name="Batch profits"/);
  assert.match(exported['xl/worksheets/sheet1.xml'], /<f>B6-B8-B12<\/f><v>0<\/v>/);
  assert.match(exported['xl/worksheets/sheet4.xml'], /dimension ref="A1:L1"/);
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
  assert.match(exported['xl/_rels/workbook.xml.rels'], /Id="rId6"[^>]+relationships\/styles/);
});
