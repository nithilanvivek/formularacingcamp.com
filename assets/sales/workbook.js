(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./model'));
  else root.CampSalesWorkbook = factory(root.CampSales);
})(typeof globalThis === 'object' ? globalThis : this, function (model) {
  'use strict';
  const encoder = new TextEncoder();
  const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const xml = value => String(value).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const text = value => ({ value: value ?? '', style: 0 });
  const amount = paise => ({ value: paise / 100, style: 2 });
  const date = value => value ? { value: Date.parse(value) / 86400000 + 25569 + 5.5 / 24, style: 3 } : text('');
  const formula = (expression, value, style = 2) => ({ formula: expression, value, style });
  const header = values => values.map(value => ({ value, style: 1 }));
  const batchName = batch => `Batch ${String(batch.number).padStart(3, '0')}`;
  const orderName = sale => `Order ${String(sale.number).padStart(4, '0')}`;

  // A small uncompressed ZIP writer keeps exports on-device without a CDN or server upload.
  function zip(files) {
    const chunks = [], directory = [];
    let offset = 0, directorySize = 0;
    const crc32 = bytes => {
      let crc = 0xffffffff;
      for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
    for (const [name, content] of files) {
      const filename = encoder.encode(name), data = encoder.encode(content), crc = crc32(data);
      const local = new Uint8Array(30 + filename.length), view = new DataView(local.buffer);
      view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(12, 33, true);
      view.setUint32(14, crc, true); view.setUint32(18, data.length, true); view.setUint32(22, data.length, true); view.setUint16(26, filename.length, true);
      local.set(filename, 30);
      const central = new Uint8Array(46 + filename.length), cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(14, 33, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, filename.length, true); cv.setUint32(42, offset, true);
      central.set(filename, 46);
      chunks.push(local, data); directory.push(central);
      offset += local.length + data.length; directorySize += central.length;
    }
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, directorySize, true); ev.setUint32(16, offset, true);
    const result = new Uint8Array(offset + directorySize + end.length);
    let position = 0;
    for (const part of [...chunks, ...directory, end]) { result.set(part, position); position += part.length; }
    return result;
  }

  function worksheet(rows, widths, filter = false) {
    const lastColumn = String.fromCharCode(64 + widths.length);
    const cells = rows.map((row, r) => `<row r="${r + 1}"${r === 0 ? ' ht="28" customHeight="1"' : ''}>${row.map((input, c) => {
      const cell = input && typeof input === 'object' ? input : text(input);
      const ref = String.fromCharCode(65 + c) + (r + 1);
      if (typeof cell.value === 'number') {
        if (!Number.isFinite(cell.value)) throw new Error('A workbook value could not be exported. Refresh your records and try again.');
        return `<c r="${ref}" s="${cell.style || 0}">${cell.formula ? `<f>${xml(cell.formula)}</f>` : ''}<v>${cell.value}</v></c>`;
      }
      // Names are always text, even if they begin with '=' or another formula prefix.
      return `<c r="${ref}" s="${cell.style || 0}" t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;
    }).join('')}</row>`).join('');
    return declaration + `<worksheet xmlns="${ns}"><dimension ref="A1:${lastColumn}${rows.length}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${filter ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${widths.map((width, i) => `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${cells}</sheetData>${filter ? `<autoFilter ref="A1:${lastColumn}${rows.length}"/>` : ''}</worksheet>`;
  }

  function build(ledger, exportedAt = new Date().toISOString()) {
    const totals = model.summary(ledger), endSales = Math.max(2, ledger.sales.length + 1), endBatches = Math.max(2, ledger.batches.length + 1);
    const salesRange = column => `Sales!$${column}$2:$${column}$${endSales}`;
    const batches = [header(['Batch', 'Record ID', 'Cost (INR)', 'Ordered at (IST)', 'Books ordered']), ...ledger.batches.map(batch => [batchName(batch), batch.id, amount(batch.costPaise), date(batch.createdAt), batch.booksOrdered == null ? text('') : { value: batch.booksOrdered, style: 0 }])];
    const sales = [header(['Order', 'Record ID', 'Channel', 'Batch', 'Format', 'Payment name', 'Price per book (INR)', 'Recorded at (IST)', 'Status', 'Cancelled at (IST)', 'Quantity', 'Sale total (INR)']), ...ledger.sales.map((sale, i) => [
      orderName(sale), sale.id, sale.channel === 'online' ? 'Online stall' : 'Batch sale', sale.batchId ? batchName(ledger.batches.find(batch => batch.id === sale.batchId)) : '', sale.format, sale.paymentName || '', amount(sale.pricePaise), date(sale.createdAt), sale.status, date(sale.cancelledAt), { value: model.quantity(sale), style: 0 }, formula(`G${i + 2}*K${i + 2}`, model.saleTotal(sale) / 100)
    ])];
    const profits = [header(['Batch', 'Cost (INR)', 'Active sales (INR)', 'Profit (INR)', 'Books sold', 'Books ordered', 'Books left']), ...totals.batchProfits.map((batch, i) => {
      const row = i + 2;
      return [text(batchName(batch)), formula(`Batches!C${row}`, batch.costPaise / 100), formula(`SUMIFS(${salesRange('L')},${salesRange('D')},Batches!A${row},${salesRange('I')},"active")`, batch.revenuePaise / 100), formula(`C${row}-B${row}`, batch.profitPaise / 100), formula(`SUMIFS(${salesRange('K')},${salesRange('D')},Batches!A${row},${salesRange('I')},"active")`, batch.booksSold, 0), batch.booksOrdered === null ? text('') : formula(`Batches!E${row}`, batch.booksOrdered, 0), batch.booksLeft === null ? text('') : formula(`F${row}-E${row}`, batch.booksLeft, 0)];
    })];
    const summary = [
      [{ value: 'Formula Racing Camp — Sales', style: 4 }], [], ['Exported at (IST)', date(exportedAt)], [], header(['Metric', 'Value']),
      ['Total sales (INR)', formula(`SUMIF(${salesRange('I')},"active",${salesRange('L')})`, totals.salesPaise / 100)],
      ['Books sold', formula(`SUMIF(${salesRange('I')},"active",${salesRange('K')})`, totals.booksSold, 0)],
      ['Total batch costs (INR)', formula(`SUM(Batches!C2:C${endBatches})`, totals.costsPaise / 100)],
      ['Total profit (INR)', formula('B6-B8', totals.profitPaise / 100)],
      ['Number of authors', { value: 6, style: 0 }],
      ['Profit per author (INR)', formula('B9/B10', totals.profitPaise / 100 / 6)], [],
      ['Profit uses active sales minus all batch costs.'],
      ['Online stall costs are not recorded. Cancelled sales are excluded.'],
      ['Source: Camp Sales server records · www.formularacingcamp.com/sales']
    ];
    const names = ['Summary', 'Batch profits', 'Batches', 'Sales'];
    const sheets = [worksheet(summary, [76, 30]), worksheet(profits, [20, 22, 24, 22, 16, 18, 16], true), worksheet(batches, [20, 40, 22, 30, 18], true), worksheet(sales, [20, 40, 20, 20, 18, 36, 26, 30, 18, 30, 16, 24], true)];
    const styles = declaration + `<styleSheet xmlns="${ns}"><numFmts count="2"><numFmt numFmtId="164" formatCode="${xml('"₹"#,##0.00;[Red]"-₹"#,##0.00')}"/><numFmt numFmtId="165" formatCode="${xml('dd mmm yyyy, hh:mm "IST"')}"/></numFmts><fonts count="3"><font><sz val="11"/><color rgb="FF151C35"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="18"/><color rgb="FF2457DF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2457DF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    return zip([
      ['[Content_Types].xml', declaration + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
      ['_rels/.rels', declaration + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
      ['xl/workbook.xml', declaration + `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`],
      ['xl/_rels/workbook.xml.rels', declaration + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
      ['xl/styles.xml', styles], ...sheets.map((sheet, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheet])
    ]);
  }

  return { build, create: (ledger, exportedAt) => new Blob([build(ledger, exportedAt)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }) };
});
