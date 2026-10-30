const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launchHeadlessSession } = require('../security-demo/browser-session');
const { salesFixture } = require('./helpers/sales-fixture');
const salesAPI = require('../api/sales-data');
const config = require('../vercel.json');

test('sales recorder persists creation, record editing and sale deletion and updates profits under the production CSP', { timeout: 90000 }, async t => {
  const fixture = salesFixture(t);
  const root = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-sales-qa-'));
  let session;
  const server = http.createServer(async (req, res) => {
    res.status = code => { res.statusCode = code; return res; };
    res.json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/sales-data') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      req.body = Buffer.concat(chunks).toString();
      return salesAPI(req, res);
    }
    const file = path.resolve(root, '.' + (url.pathname === '/sales' ? '/sales.html' : url.pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.status(404).end();
    for (const rule of config.headers) {
      if (rule.source === '/(.*)' || rule.source === url.pathname) for (const header of rule.headers) res.setHeader(header.key, header.value);
    }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    fixture.challenge.hostname = '127.0.0.1';
    session = await launchHeadlessSession();
    const { cdp } = session;
    const errors = [];
    cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text));
    const evaluate = async expression => {
      const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const until = async expression => {
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      throw new Error('Timed out: ' + expression);
    };
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.cspViolations=[];
      addEventListener('securitypolicyviolation',e=>cspViolations.push(e.violatedDirective+':'+e.blockedURI));
      window.turnstile={render(selector,options){window.challengeOptions=options;const box=document.createElement('div');box.style.width=options.size==='compact'?'150px':'300px';box.style.height=options.size==='compact'?'140px':'65px';document.querySelector(selector).append(box);return 'test-widget';},remove(){document.querySelector('#sales-challenge').replaceChildren();}};
    ` });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output, browserContextId: targetInfo.browserContextId });
    const navigate = async () => {
      await cdp.send('Page.navigate', { url: base + '/sales' });
      await until(`document.querySelector('#feedback')?.textContent==='Records are up to date.'`);
    };
    const choose = async action => {
      await evaluate(`document.querySelector('[data-action="${action}"]').click()`);
      if (await evaluate(`!document.querySelector('#save-entry').disabled`)) return;
      if (action !== 'editor' && action !== 'batch-sale') await until(`!document.querySelector('#save-entry').disabled`);
    };
    const fill = async values => evaluate(`(() => {for(const [id,value] of Object.entries(${JSON.stringify(values)})){const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
    const change = async (id, value, checked = false) => evaluate(`(() => {const field=document.getElementById(${JSON.stringify(id)});field[${checked ? '"checked"' : '"value"'}]=${JSON.stringify(value)};field.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const submit = async () => evaluate(`document.querySelector('#entry-form').requestSubmit()`);
    const saved = async revision => until(`document.querySelector('#feedback').textContent.includes('saved') || document.querySelector('#feedback').textContent.startsWith('Sale deleted')`).then(() => assert.equal(JSON.parse(fixture.raw).revision, revision));

    await cdp.send('Page.navigate', { url: base + '/sales' });
    await until('!!window.challengeOptions');
    assert.equal(await evaluate('window.challengeOptions.size'), 'normal');
    for (const width of [320, 375, 1440]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: width < 760 });
      assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'), true, 'Verification gate overflow at ' + width);
    }
    assert.equal(await evaluate(`document.querySelector('#recorder-content').hidden`), true);
    assert.equal(fixture.commands.length, 0, 'Records must not be read before page verification');
    await evaluate(`window.challengeOptions.callback('test-token')`);
    await until(`document.querySelector('#feedback').textContent==='Records are up to date.'`);
    assert.equal(fixture.verifications, 1);
    assert.equal(await evaluate(`document.querySelector('#verification-gate').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#entry-panel').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹0.00');
    assert.equal(await evaluate(`document.querySelector('meta[name=robots]').content.includes('noindex')`), true);
    assert.equal(await evaluate(`document.querySelector('.overview').compareDocumentPosition(document.querySelector('.action-section')) & Node.DOCUMENT_POSITION_FOLLOWING`), 4);
    await choose('batch-sale');
    assert.equal(await evaluate(`document.querySelector('#save-entry').disabled`), true);
    await choose('batch');
    await until(`!document.querySelector('#save-entry').disabled`);
    await fill({ 'books-ordered': '40' });
    for (const cost of ['-10', '1e3', '1.234', '0']) {
      await fill({ cost }); await submit();
      assert.equal(await evaluate(`document.querySelector('#cost').getAttribute('aria-invalid')`), 'true');
      assert.equal(fixture.raw, null);
    }
    await fill({ cost: '1000.50', 'books-ordered': '40' }); await submit(); await saved(1);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '-₹1,000.50');
    const batchId = JSON.parse(fixture.raw).batches[0].id;
    await choose('batch-sale');
    await fill({ 'batch-id': batchId, format: 'Paperback', price: '1200.75', 'payment-name': '<img src=x onerror=alert(1)>' });
    await submit(); await saved(2);
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹1,200.75');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹200.25');
    assert.equal(await evaluate(`document.querySelector('#records').innerText.includes('<img src=x onerror=alert(1)>')`), true);
    assert.equal(await evaluate(`document.querySelectorAll('#records img').length`), 0);
    assert.ok(JSON.parse(fixture.raw).sales[0].createdAt);
    await choose('online-sale');
    await fill({ format: 'Hardcover', price: '399.25' }); await submit(); await saved(3);
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹1,600.00');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹599.50');
    assert.equal(await evaluate(`document.querySelector('#author-profit').textContent`), '₹99.92');
    assert.equal(await evaluate(`document.querySelector('.profit-table tbody tr td:nth-child(4)').textContent`), '₹200.25');

    // Reload from server state; no browser storage is used to recover records.
    await navigate();
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹1,600.00');
    assert.equal(await evaluate(`localStorage.length`), 0);
    assert.equal(await evaluate(`typeof window.challengeOptions`), 'undefined', 'Reload should reuse the verified session');
    assert.equal(fixture.verifications, 1);
    assert.equal(await evaluate(`!!document.querySelector('[data-action="cancel"]')`), false);
    await choose('editor');
    await change('editor-record', 'batch:' + batchId);
    assert.equal(await evaluate(`document.querySelector('#cost').value`), '1000.50');
    assert.equal(await evaluate(`!!document.querySelector('#delete-sale')`), false, 'Batches must never have a delete icon');
    await fill({ cost: '900.50' }); await submit(); await saved(4);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹699.50');
    await fill({ cost: '1000.50' }); await submit(); await saved(5);
    const firstSaleId = JSON.parse(fixture.raw).sales[0].id;
    const originalTime = JSON.parse(fixture.raw).sales[0].createdAt;
    await change('editor-record', 'sale:' + firstSaleId);
    assert.equal(await evaluate(`document.querySelector('#price').value`), '1200.75');
    await fill({ price: '1300.75', format: 'Hardcover', 'payment-name': 'Corrected buyer' });
    await submit(); await saved(6);
    assert.equal(JSON.parse(fixture.raw).sales[0].createdAt, originalTime);
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹1,700.00');
    await change('edit-channel', 'online');
    assert.equal(await evaluate(`document.querySelector('#edit-batch-field').hidden`), true);
    await change('edit-channel', 'batch');
    assert.equal(await evaluate(`document.querySelector('#price').value`), '1300.75');
    await evaluate(`document.querySelector('#delete-sale').click()`);
    assert.equal(await evaluate(`document.querySelector('#delete-confirmation').hidden`), false);
    await evaluate(`document.querySelector('#keep-sale').click()`);
    assert.equal(await evaluate(`document.querySelector('#delete-confirmation').hidden`), true);
    assert.equal(JSON.parse(fixture.raw).sales.length, 2);
    await evaluate(`document.querySelector('#delete-sale').click();document.querySelector('#confirm-delete-sale').click()`);
    await saved(7);
    assert.equal(JSON.parse(fixture.raw).sales.some(sale=>sale.id===firstSaleId), false);
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹399.25');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '-₹601.25');
    assert.equal(await evaluate(`document.querySelector('#author-profit').textContent`), '-₹100.21');
    assert.equal(await evaluate(`document.querySelector('#total-books').textContent`), '1 book sold');

    // Fail a save, retain all inputs, then retry it without losing or duplicating records.
    await choose('online-sale');
    await fill({ format: 'Paperback', price: '50.25', 'payment-name': 'Retry name' });
    fixture.offline = true;
    await submit(); await until(`document.querySelector('#entry-error').textContent.includes('try again')`);
    assert.equal(await evaluate(`document.querySelector('#price').value`), '50.25');
    fixture.offline = false;
    await until(`!document.querySelector('#save-entry').disabled`);
    await submit(); await saved(8);
    assert.equal(JSON.parse(fixture.raw).sales.length, 2);
    assert.equal(fixture.verifications, 1, 'All saves, edits and deletions share one page check');

    await change('record-type', 'batch');
    assert.equal(await evaluate(`document.querySelectorAll('#records .record-row').length`), 1);
    assert.equal(await evaluate(`!!document.querySelector('#record-batch')`), true);
    assert.equal(await evaluate(`!!document.querySelector('#record-format')`), false);
    await change('record-type', 'sale');
    await change('record-channel', 'online');
    await change('record-format', 'Hardcover');
    assert.equal(await evaluate(`document.querySelectorAll('#records .record-row').length`), 1);
    await change('record-date-enabled', true, true);
    await change('record-date', '2000-01-01');
    assert.equal(await evaluate(`document.querySelectorAll('#records .record-row').length`), 0);
    await change('record-date-enabled', false, true);
    assert.equal(await evaluate(`document.querySelector('#record-date').disabled`), true);
    await change('record-format', 'all');
    await change('record-channel', 'batch');
    await change('record-batch', batchId);
    assert.equal(await evaluate(`document.querySelectorAll('#records .record-row').length`), 0);
    await change('record-type', 'all');
    await change('record-channel', 'all');

    await choose('editor');
    await change('editor-type', 'batch');
    assert.equal(await evaluate(`document.querySelector('#editor-record').options.length`), 2);
    await change('editor-record', 'batch:' + batchId);
    assert.equal(await evaluate(`!!document.querySelector('#delete-sale')`), false);
    await change('editor-type', 'sale');
    await change('editor-channel', 'batch');
    await change('editor-batch', batchId);
    assert.equal(await evaluate(`document.querySelector('#editor-record').options.length`), 1, 'Deleted sales must not reappear');
    await change('editor-channel', 'online');
    await change('editor-format', 'Hardcover');
    assert.equal(await evaluate(`document.querySelector('#editor-record').options.length`), 2);
    await change('editor-date-enabled', true, true);
    await change('editor-date', '2000-01-01');
    assert.equal(await evaluate(`document.querySelector('#editor-record').options.length`), 1);
    await change('editor-date-enabled', false, true);

    await evaluate(`document.querySelector('#export').click()`);
    const filename = 'formula-racing-camp-sales-' + new Date().toISOString().slice(0, 10) + '.xlsx';
    const downloaded = path.join(output, filename);
    for (let i = 0; i < 100 && !fs.existsSync(downloaded); i++) await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(fs.readFileSync(downloaded).subarray(0, 4).toString('hex'), '504b0304');
    assert.ok(fs.readFileSync(downloaded).includes(Buffer.from('Batch profits')));
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹449.50', 'Filters do not alter overview totals');

    // An expired session returns to the single gate without losing an unfinished sale.
    await choose('online-sale');
    await fill({ format: 'Paperback', price: '20.00', 'payment-name': 'Preserved after expiry' });
    await cdp.send('Network.clearBrowserCookies');
    await submit();
    await until('!!window.challengeOptions && !document.querySelector("#verification-gate").hidden');
    assert.equal(await evaluate(`document.querySelector('#price').value`), '20.00');
    await evaluate(`window.challengeOptions.callback('test-token')`);
    await until(`document.querySelector('#verification-gate').hidden`);
    assert.equal(fixture.verifications, 2);
    await submit(); await saved(9);
    assert.equal(await evaluate(`document.querySelector('.books-left').textContent`), '40');
    await choose('batch-sale');
    await fill({ 'batch-id': batchId, format: 'Paperback', quantity: '3', price: '100.00' });
    assert.equal(await evaluate(`document.querySelector('#sale-total').textContent`), 'Sale total: ₹300.00');
    await submit(); await saved(10);
    assert.equal(await evaluate(`document.querySelector('.books-left').textContent`), '37');
    const quantitySale = JSON.parse(fixture.raw).sales.find(sale => sale.batchId === batchId);
    await choose('editor');
    await change('editor-channel', 'all');
    await change('editor-format', 'all');
    await change('editor-record', 'sale:' + quantitySale.id);
    assert.equal(await evaluate(`document.querySelector('#quantity').value`), '3');
    await fill({ quantity: '5' }); await submit(); await saved(11);
    assert.equal(await evaluate(`document.querySelector('.books-left').textContent`), '35');
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹969.50');
    fs.unlinkSync(downloaded);
    await evaluate(`document.querySelector('#export').click()`);
    for (let i = 0; i < 100 && !fs.existsSync(downloaded); i++) await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(fs.readFileSync(downloaded).includes(Buffer.from('Books left')));
    await fill({ quantity: '41' }); await submit();
    await until(`document.querySelector('#entry-error').textContent.includes('enough books')`);
    assert.equal(JSON.parse(fixture.raw).revision, 11);
    assert.equal(await evaluate(`document.querySelector('#quantity').value`), '41');
    await evaluate(`document.querySelector('#delete-sale').click();document.querySelector('#confirm-delete-sale').click()`);
    await saved(12);
    assert.equal(await evaluate(`document.querySelector('.books-left').textContent`), '40');
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹469.50');
    await choose('editor');
    await change('editor-record', 'sale:' + JSON.parse(fixture.raw).sales.find(sale => sale.format === 'Hardcover').id);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then(result => fs.writeFileSync(path.join(output, 'desktop.png'), Buffer.from(result.data, 'base64')));
    for (const action of ['batch', 'batch-sale', 'online-sale', 'editor']) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      await choose(action);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true, action + ' mobile overflow');
    }
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then(result => fs.writeFileSync(path.join(output, 'mobile.png'), Buffer.from(result.data, 'base64')));
    assert.deepEqual(errors, []);
    assert.deepEqual(await evaluate('cspViolations'), []);
    console.log('Sales screenshots and Excel export: ' + output);
  } finally {
    if (session) await session.close();
    await new Promise(resolve => server.close(resolve));
  }
});
