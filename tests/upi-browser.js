const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { launchHeadlessSession } = require('../security-demo/browser-session');

const root = path.resolve(__dirname, '..');
const config = require('../vercel.json');
const output = process.env.UPI_QA_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'camp-upi-'));

async function until(check, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timed out: ' + description);
}

test('UPI studio validates, generates and exports locally under the production CSP', { timeout: 120000 }, async () => {
  fs.mkdirSync(output, { recursive: true });
  let session, server;
  const errors = [], requests = [], cases = [];
  try {
    let base = process.env.UPI_LIVE_BASE_URL;
    if (!base) {
      server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const file = path.resolve(root, '.' + (url.pathname === '/upi' ? '/upi.html' : url.pathname));
        if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.writeHead(404).end();
          return;
        }
        for (const header of config.headers.find(rule => rule.source === '/(.*)').headers) {
          res.setHeader(header.key, header.value);
        }
        res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.ico': 'image/x-icon' })[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      base = `http://127.0.0.1:${server.address().port}`;
    }
    session = await launchHeadlessSession();
    const { cdp } = session;
    const evaluate = async expression => {
      const response = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text + ': ' + response.exceptionDetails.exception?.description);
      return response.result.value;
    };
    cdp.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails.text));
    await cdp.send('Network.enable');
    cdp.on('Network.requestWillBeSent', event => requests.push({ url: event.request.url, method: event.request.method }));
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.cspViolations=[];addEventListener("securitypolicyviolation",e=>cspViolations.push(e.violatedDirective+":"+e.blockedURI));' });
    const { targetInfo } = await cdp.send('Target.getTargetInfo');
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output, browserContextId: targetInfo.browserContextId });
    await cdp.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'], origin: base, browserContextId: targetInfo.browserContextId });
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await cdp.send('Page.navigate', { url: base + '/upi' });
    await until(() => evaluate('typeof paymentURI === "function" && document.readyState === "complete"'), 'studio loaded');
    assert.equal(await evaluate('location.pathname'), '/upi');
    assert.equal(await evaluate('document.title'), 'Camp Pay — UPI QR Studio');
    assert.equal(await evaluate('document.querySelector("header .header-note").getAttribute("href")'), '/sales');
    assert.equal(await evaluate('document.querySelector("header .header-note").textContent'), 'OPEN CAMP SALES ↗');
    assert.equal(await evaluate('document.querySelectorAll("#png:disabled,#svg:disabled,#copy:disabled").length'), 3);
    assert.equal(await evaluate('getComputedStyle(document.body).color'), 'rgb(21, 28, 53)');
    assert.equal(await evaluate('Array.from(document.images).every(image=>image.complete && image.naturalWidth>0)'), true);
    const fill = values => evaluate(`(() => { for (const [id,value] of Object.entries(${JSON.stringify(values)})) { $(id).value=value; $(id).dispatchEvent(new Event('input',{bubbles:true})); } })()`);
    const submit = () => evaluate(`$('form').requestSubmit()`);
    await submit();
    assert.equal(await evaluate(`$('name').getAttribute('aria-invalid')`), 'true');
    await fill({ name: 'Test Camp', vpa: 'invalid' });
    await submit();
    assert.equal(await evaluate(`$('vpa').getAttribute('aria-invalid')`), 'true');
    for (const amount of ['0', '-5', '1.234', '1e3', '1000000000']) {
      await fill({ vpa: 'test.camp@upi', amount });
      await submit();
      assert.equal(await evaluate(`$('amount').getAttribute('aria-invalid')`), 'true');
      assert.equal(await evaluate(`$('png').disabled`), true);
    }
    await fill({ name: 'Camp & Friends <Test> 🏁', vpa: 'test.camp@upi', amount: '1234.50', note: 'Camp & books / ₹ paid?' });
    const exportCase = async (label, logo, color) => {
      await evaluate(`document.querySelector('[data-color="${color}"]').click(); $('logo').checked=${logo}; $('logo').dispatchEvent(new Event('input',{bubbles:true}));`);
      await submit();
      await until(() => evaluate(`$('status').textContent==='READY TO SCAN'`), label + ' generated');
      assert.equal(await evaluate(`document.querySelectorAll('#qr svg').length`), 1);
      assert.equal(await evaluate(`document.querySelectorAll('#qr image').length`), logo ? 1 : 0);
      assert.equal(await evaluate(`$('payee').textContent`), 'Camp & Friends <Test> 🏁');
      assert.equal(await evaluate(`$('payee').children.length`), 0);
      const expected = await evaluate('uri');
      const parsed = new URL(expected);
      assert.equal(parsed.protocol, 'upi:');
      assert.equal(parsed.hostname, 'pay');
      assert.equal(parsed.searchParams.get('pa'), 'test.camp@upi');
      assert.equal(parsed.searchParams.get('pn'), 'Camp & Friends <Test> 🏁');
      assert.equal(parsed.searchParams.get('cu'), 'INR');
      assert.equal(parsed.searchParams.get('am'), '1234.50');
      assert.equal(parsed.searchParams.get('tn'), 'Camp & books / ₹ paid?');
      for (const extension of ['svg', 'png']) {
        const downloaded = path.join(output, 'camp-upi-qr.' + extension);
        if (fs.existsSync(downloaded)) fs.unlinkSync(downloaded);
        await evaluate(`$('${extension}').click()`);
        await until(() => fs.existsSync(downloaded) && fs.statSync(downloaded).size > 100, label + ' ' + extension + ' download');
        const destination = path.join(output, label + '.' + extension);
        fs.renameSync(downloaded, destination);
        if (extension === 'png') {
          const bytes = fs.readFileSync(destination);
          assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
          assert.equal(bytes.readUInt32BE(16), 1200);
          assert.equal(bytes.readUInt32BE(20), 1200);
        } else {
          const svg = fs.readFileSync(destination, 'utf8');
          assert.match(svg, /viewBox=/);
          assert.equal(svg.includes('data:image/webp;base64,'), logo);
        }
      }
      cases.push({ label, uri: expected });
    };
    await exportCase('brand-logo', true, 'brand');
    await evaluate(`$('copy').click()`);
    await until(() => evaluate(`$('feedback').textContent==='Payment link copied.'`), 'clipboard copy');
    assert.equal(await evaluate('navigator.clipboard.readText()'), cases[0].uri);
    await exportCase('black-logo', true, 'black');
    await exportCase('brand-plain', false, 'brand');
    await exportCase('black-plain', false, 'black');
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(output, 'desktop.png'), Buffer.from(screenshot.data, 'base64'));
    await fill({ amount: '', note: '' });
    assert.equal(await evaluate(`$('png').disabled && $('copy').disabled && !document.querySelector('#qr>svg')`), true);
    await submit();
    const optional = new URL(await evaluate('uri'));
    assert.equal(optional.searchParams.has('am'), false);
    assert.equal(optional.searchParams.has('tn'), false);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'), true);
    const mobile = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(output, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
    assert.deepEqual(errors, []);
    assert.deepEqual(await evaluate('cspViolations'), []);
    assert.equal(requests.some(request => request.method !== 'GET'), false);
    assert.equal(requests.some(request => request.url.includes('test.camp') || request.url.includes('1234.50')), false);
    assert.equal(requests.some(request => request.url.includes('chatgpt.site')), false);
    fs.writeFileSync(path.join(output, 'qr-cases.json'), JSON.stringify(cases, null, 2));
    console.log('UPI QA output: ' + output);
  } finally {
    if (session) await session.close();
    if (server) await new Promise(resolve => server.close(resolve));
  }
});
