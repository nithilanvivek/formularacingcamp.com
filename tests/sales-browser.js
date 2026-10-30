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

test('sales recorder persists all four workflows and updates profits under the production CSP', { timeout: 90000 }, async t => {
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
      window.turnstile={render(selector,options){window.challengeOptions=options;setTimeout(()=>options.callback('test-token'),0);return 'test-widget';},reset(){setTimeout(()=>window.challengeOptions.callback('test-token'),0);}};
    ` });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    const navigate = async () => {
      await cdp.send('Page.navigate', { url: base + '/sales' });
      await until(`document.querySelector('#feedback')?.textContent==='Records are up to date.'`);
    };
    const choose = async action => {
      await evaluate(`document.querySelector('[data-action="${action}"]').click()`);
      if (await evaluate(`!document.querySelector('#save-entry').disabled`)) return;
      if (action !== 'cancel' && action !== 'batch-sale') await until(`!document.querySelector('#save-entry').disabled`);
    };
    const fill = async values => evaluate(`(() => {for(const [id,value] of Object.entries(${JSON.stringify(values)})){const field=document.getElementById(id);field.value=value;field.dispatchEvent(new Event('input',{bubbles:true}));}})()`);
    const submit = async () => evaluate(`document.querySelector('#entry-form').requestSubmit()`);
    const saved = async revision => until(`document.querySelector('#feedback').textContent.includes('saved') || document.querySelector('#feedback').textContent.startsWith('Order cancelled')`).then(() => assert.equal(JSON.parse(fixture.raw).revision, revision));

    await navigate();
    assert.equal(await evaluate(`document.querySelector('#entry-panel').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹0.00');
    assert.equal(await evaluate(`document.querySelector('meta[name=robots]').content.includes('noindex')`), true);
    assert.equal(await evaluate(`document.querySelector('.overview').compareDocumentPosition(document.querySelector('.action-section')) & Node.DOCUMENT_POSITION_FOLLOWING`), 4);
    await choose('batch-sale');
    assert.equal(await evaluate(`document.querySelector('#save-entry').disabled`), true);
    await choose('batch');
    await until(`!document.querySelector('#save-entry').disabled`);
    for (const cost of ['-10', '1e3', '1.234', '0']) {
      await fill({ cost }); await submit();
      assert.equal(await evaluate(`document.querySelector('#cost').getAttribute('aria-invalid')`), 'true');
      assert.equal(fixture.raw, null);
    }
    await fill({ cost: '1000.50' }); await submit(); await saved(1);
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
    assert.equal(await evaluate(`document.querySelector('.profit-table tbody tr td:last-child').textContent`), '₹200.25');

    // Reload from server state; no browser storage is used to recover records.
    await navigate();
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹1,600.00');
    assert.equal(await evaluate(`localStorage.length`), 0);
    await choose('cancel');
    await until(`!document.querySelector('#save-entry').disabled`);
    await fill({ 'order-id': JSON.parse(fixture.raw).sales[0].id });
    await submit();
    assert.match(await evaluate(`document.querySelector('#entry-error').textContent`), /Confirm/);
    await evaluate(`document.querySelector('#confirm-cancel').checked=true`);
    await submit(); await saved(4);
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹399.25');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '-₹601.25');
    assert.equal(await evaluate(`document.querySelector('#author-profit').textContent`), '-₹100.21');
    assert.equal(await evaluate(`document.querySelector('#total-books').textContent`), '1 book sold');
    assert.equal(await evaluate(`document.querySelectorAll('.cancelled').length`), 1);

    // Fail a save, retain all inputs, then retry it without losing or duplicating records.
    await choose('online-sale');
    await fill({ format: 'Paperback', price: '50.25', 'payment-name': 'Retry name' });
    fixture.offline = true;
    await submit(); await until(`document.querySelector('#entry-error').textContent.includes('try again')`);
    assert.equal(await evaluate(`document.querySelector('#price').value`), '50.25');
    fixture.offline = false;
    await until(`!document.querySelector('#save-entry').disabled`);
    await submit(); await saved(5);
    assert.equal(JSON.parse(fixture.raw).sales.length, 3);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then(result => fs.writeFileSync(path.join(output, 'desktop.png'), Buffer.from(result.data, 'base64')));
    for (const action of ['batch', 'batch-sale', 'online-sale', 'cancel']) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      await choose(action);
      assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true, action + ' mobile overflow');
    }
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then(result => fs.writeFileSync(path.join(output, 'mobile.png'), Buffer.from(result.data, 'base64')));
    assert.deepEqual(errors, []);
    assert.deepEqual(await evaluate('cspViolations'), []);
    console.log('Sales screenshots: ' + output);
  } finally {
    if (session) await session.close();
    await new Promise(resolve => server.close(resolve));
  }
});
