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
    assert.equal(await evaluate(`!!document.querySelector('[data-action="online-sale"]')`), false);
    await choose('batch-sale');
    assert.equal(await evaluate(`document.querySelector('#save-entry').disabled`), true);
    await choose('batch');
    assert.deepEqual(await evaluate(`Array.from(document.querySelector('#paid-by').options).slice(1).map(option=>option.value)`), ['Tejas','Jaskirat','Nandana','Nithilan','Shaurya','Nihira']);
    await fill({ cost: '1000.50', 'books-ordered': '40' });
    await submit();
    assert.equal(fixture.raw, null, 'Payer is required');
    await fill({ 'paid-by': 'Tejas' });
    for (const cost of ['-10', '1e3', '1.234', '0']) {
      await fill({ cost }); await submit();
      assert.equal(await evaluate(`document.querySelector('#cost').getAttribute('aria-invalid')`), 'true');
      assert.equal(fixture.raw, null);
    }
    await fill({ cost: '1000.50' }); await submit(); await saved(1);
    assert.equal(await evaluate(`document.querySelector('.batch-author-income').textContent`), '-₹166.75');
    assert.equal(JSON.parse(fixture.raw).batches[0].paidBy, 'Tejas');
    const batchId = JSON.parse(fixture.raw).batches[0].id;
    await choose('batch-sale');
    await fill({ 'batch-id': batchId, format: 'Paperback', quantity: '3', price: '400.25', 'payment-name': '<img src=x onerror=alert(1)>' });
    await submit();
    assert.equal(JSON.parse(fixture.raw).revision, 1, 'Recipient is required');
    await fill({ 'paid-to': 'Nithilan' }); await submit(); await saved(2);
    const saleId = JSON.parse(fixture.raw).sales[0].id;
    const saleTime = JSON.parse(fixture.raw).sales[0].createdAt;
    assert.equal(JSON.parse(fixture.raw).sales[0].paidTo, 'Nithilan');
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹1,200.75');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹200.25');
    assert.equal(await evaluate(`document.querySelector('.batch-author-income').textContent`), '₹33.38');
    assert.equal(await evaluate(`document.querySelector('.books-left').textContent`), '37');
    assert.equal(await evaluate(`document.querySelectorAll('#records img').length`), 0);
    assert.equal(await evaluate(`document.querySelector('#records').textContent.includes('Payment received by: Nithilan')`), true);

    // Historical online sales survive retirement, with no new online-sale action.
    fixture.seedOnline({ format: 'Hardcover', price: '399.25' });
    const legacySaleId = JSON.parse(fixture.raw).sales[1].id;
    await navigate();
    assert.equal(await evaluate(`document.querySelector('#total-sales').textContent`), '₹1,600.00');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹599.50');
    assert.equal(await evaluate(`localStorage.length`), 0);
    assert.equal(fixture.verifications, 1);
    assert.equal(await evaluate(`document.querySelector('#author-attribution').hidden`), false);
    await evaluate(`document.querySelector('[data-fix-author]').click()`);
    assert.equal(await evaluate(`document.querySelector('#editor-record').value`), 'sale:' + legacySaleId);
    assert.equal(await evaluate(`document.querySelector('#paid-to').value`), '');
    await choose('editor');
    await change('editor-record', 'batch:' + batchId);
    assert.equal(await evaluate(`document.querySelector('#paid-by').value`), 'Tejas');
    assert.equal(await evaluate(`!!document.querySelector('#delete-sale')`), false);
    await fill({ cost: '900.50', 'paid-by': 'Nandana' }); await submit(); await saved(4);
    assert.equal(await evaluate(`document.querySelector('.batch-author-income').textContent`), '₹50.04');
    await change('editor-record', 'sale:' + saleId);
    assert.equal(await evaluate(`document.querySelector('#paid-to').value`), 'Nithilan');
    assert.equal(await evaluate(`Array.from(document.querySelector('#edit-channel').options).some(option=>option.value==='online')`), false);
    await fill({ quantity: '5', 'paid-to': 'Shaurya' }); await submit(); await saved(5);
    assert.equal(JSON.parse(fixture.raw).sales[0].createdAt, saleTime);
    assert.equal(JSON.parse(fixture.raw).sales[0].paidTo, 'Shaurya');
    assert.equal(await evaluate(`document.querySelector('.books-left').textContent`), '35');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹1,500.00');

    await choose('extra-cost');
    await fill({ 'description': '<img src=x> Stickers', cost: '200.25', 'paid-by': 'Jaskirat' });
    await submit(); await saved(6);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹1,299.75');
    assert.equal(await evaluate(`document.querySelector('.batch-author-income').textContent`), '₹183.46');
    assert.equal(await evaluate(`document.querySelectorAll('#records img').length`), 0);
    const purchase = JSON.parse(fixture.raw).extraCosts[0];
    await change('record-type', 'extra-cost');
    assert.equal(await evaluate(`document.querySelectorAll('#records .record-row').length`), 1);
    assert.equal(await evaluate(`!!document.querySelector('#record-format')`), false);
    await change('record-date-enabled', true, true);
    await change('record-date', '2000-01-01');
    assert.equal(await evaluate(`document.querySelectorAll('#records .record-row').length`), 0);
    await change('record-date-enabled', false, true);
    await choose('editor');
    await change('editor-type', 'extra-cost');
    await change('editor-record', 'extra-cost:' + purchase.id);
    assert.equal(await evaluate(`document.querySelector('#paid-by').value`), 'Jaskirat');
    await fill({ 'description': 'Stickers', cost: '250.50', 'paid-by': 'Nihira' }); await submit(); await saved(7);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹1,249.50');
    assert.equal(await evaluate(`document.querySelector('#author-profit').textContent`), '₹208.25');
    await choose('extra-cost');
    await fill({ description: 'Delivery', cost: '50.25', 'paid-by': 'Tejas' }); await submit(); await saved(8);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '₹1,199.25');
    await choose('editor');
    await change('editor-type', 'sale');
    await change('editor-channel', 'batch');
    await change('editor-record', 'sale:' + saleId);
    await fill({ quantity: '41' }); await submit();
    await until(`document.querySelector('#entry-error').textContent.includes('enough books')`);
    assert.equal(JSON.parse(fixture.raw).revision, 8);
    await evaluate(`document.querySelector('#delete-sale').click()`);
    await evaluate(`document.querySelector('#keep-sale').click()`);
    assert.equal(await evaluate(`document.querySelector('#delete-confirmation').hidden`), true);
    await evaluate(`document.querySelector('#delete-sale').click();document.querySelector('#confirm-delete-sale').click()`);
    await saved(9);
    assert.equal(await evaluate(`document.querySelector('.books-left').textContent`), '40');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '-₹802.00');
    await change('editor-channel', 'online');
    await change('editor-record', 'sale:' + legacySaleId);
    assert.equal(await evaluate(`document.querySelector('#paid-to-field').hidden`), false);
    await fill({ price: '450.25', 'paid-to': 'Jaskirat' }); await submit(); await saved(10);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '-₹751.00');

    // Storage errors keep the purchase and retry without duplication.
    await choose('extra-cost');
    await fill({ 'description': 'T-shirts', cost: '60.25', 'paid-by': 'Tejas' });
    fixture.offline = true;
    await submit(); await until(`document.querySelector('#entry-error').textContent.includes('try again')`);
    assert.equal(await evaluate(`document.querySelector('#description').value`), 'T-shirts');
    fixture.offline = false;
    await submit(); await saved(11);
    assert.equal(JSON.parse(fixture.raw).extraCosts.length, 3);
    // Expired verification keeps the unfinished batch sale and selected recipient.
    await choose('batch-sale');
    await fill({ 'batch-id': batchId, format: 'Paperback', price: '20.00', 'paid-to': 'Nithilan' });
    await cdp.send('Network.clearBrowserCookies');
    await submit();
    await until('!!window.challengeOptions && !document.querySelector("#verification-gate").hidden');
    assert.equal(await evaluate(`document.querySelector('#paid-to').value`), 'Nithilan');
    await evaluate(`window.challengeOptions.callback('test-token')`);
    await until(`document.querySelector('#verification-gate').hidden`);
    await submit(); await saved(12);
    assert.equal(fixture.verifications, 2);
    assert.equal(await evaluate(`document.querySelector('.books-left').textContent`), '39');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), '-₹791.25');
    await navigate();
    assert.equal(await evaluate(`document.querySelector('#extra-costs-total').textContent`), 'Extra costs: ₹361.00');
    assert.equal(await evaluate(`document.querySelectorAll('#author-balances tbody tr').length`), 15);
    assert.equal(await evaluate(`document.querySelector('#author-attribution').hidden`), true);
    assert.equal(await evaluate(`!!document.querySelector('[data-action="merch-purchase"]')`), false);
    const accounting = require('../assets/sales/model');
    const debt = accounting.authorDashboard(JSON.parse(fixture.raw)).pending.find(entry => entry.kind === 'batch' && entry.from === 'Nihira');
    const pairSelector = '[data-author-pair="Nandana:Nihira"]';
    const owingBefore = await evaluate(`document.querySelector(${JSON.stringify(pairSelector)}).textContent`);
    const profitBefore = await evaluate(`document.querySelector('#total-profit').textContent`);
    await choose('batch');
    await fill({ cost: '222.22', 'books-ordered': '10', 'paid-by': 'Shaurya' });
    await evaluate(`Array.from(document.querySelectorAll('[data-author-pay]')).find(button=>button.dataset.authorPay===${JSON.stringify(debt.id)}).click()`);
    await until(`document.querySelector('#author-feedback').textContent.startsWith('Payment recorded')`);
    assert.equal(JSON.parse(fixture.raw).revision, 13);
    assert.equal(JSON.parse(fixture.raw).authorPayments.length, 1);
    assert.equal(await evaluate(`document.querySelector('#cost').value`), '222.22', 'Marking a payment must keep unfinished record inputs');
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), profitBefore);
    assert.notEqual(await evaluate(`document.querySelector(${JSON.stringify(pairSelector)}).textContent`), owingBefore);
    await change('author-status', 'paid');
    assert.equal(await evaluate(`document.querySelectorAll('[data-author-undo]').length`), 1);
    assert.equal(await evaluate(`document.querySelectorAll('[data-author-pay]').length`), 0);
    await evaluate(`document.querySelector('[data-author-undo]').click()`);
    await until(`document.querySelector('#author-feedback').textContent.startsWith('Payment marked unpaid')`);
    assert.equal(JSON.parse(fixture.raw).revision, 14);
    await change('author-status', 'pending');
    assert.equal(await evaluate(`document.querySelector(${JSON.stringify(pairSelector)}).textContent`), owingBefore);
    await evaluate(`Array.from(document.querySelectorAll('[data-author-pay]')).find(button=>button.dataset.authorPay===${JSON.stringify(debt.id)}).click()`);
    await until(`document.querySelector('#author-feedback').textContent.startsWith('Payment recorded')`);
    assert.equal(JSON.parse(fixture.raw).revision, 15);
    await navigate();
    assert.equal(JSON.parse(fixture.raw).authorPayments.filter(payment=>!payment.voidedAt).length, 1);
    assert.equal(await evaluate(`document.querySelector('#total-profit').textContent`), profitBefore);
    await evaluate(`document.querySelector('#export').click()`);
    const filename = 'formula-racing-camp-sales-' + new Date().toISOString().slice(0, 10) + '.xlsx';
    const downloaded = path.join(output, filename);
    for (let i = 0; i < 100 && !fs.existsSync(downloaded); i++) await new Promise(resolve => setTimeout(resolve, 30));
    const bytes = fs.readFileSync(downloaded);
    for (const text of ['Author transactions', 'Author balances', 'Attribution needed', 'Extra costs', 'Stickers', 'Nihira', 'Paid by', 'Payment received by', 'Nandana', 'Nithilan']) assert.ok(bytes.includes(Buffer.from(text)), 'Export missing ' + text);
    await choose('editor');
    await change('editor-type', 'extra-cost');
    await change('editor-record', 'extra-cost:' + purchase.id);
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }).then(result => fs.writeFileSync(path.join(output, 'desktop.png'), Buffer.from(result.data, 'base64')));
    for (const [selector, filename] of [['.author-dashboard', 'author-transactions.png'], ['#author-balances', 'author-balances.png']]) {
      const bounds = await evaluate(`(() => {const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:rect.x+scrollX,y:rect.y+scrollY,width:rect.width,height:Math.min(rect.height,1000),scale:1};})()`);
      await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: bounds }).then(result => fs.writeFileSync(path.join(output, filename), Buffer.from(result.data, 'base64')));
    }
    for (const action of ['batch', 'batch-sale', 'extra-cost', 'editor']) {
      for (const width of [320, 375]) {
        await cdp.send('Emulation.setDeviceMetricsOverride', { width, height: 812, deviceScaleFactor: 1, mobile: true });
        await choose(action);
        assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), true, action + ' mobile overflow');
      }
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
