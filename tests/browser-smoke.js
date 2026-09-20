const assert = require('node:assert/strict');
const test = require('node:test');
const { execFileSync } = require('node:child_process');
const { launchHeadlessSession } = require('../security-demo/browser-session');

function checkMacDockRegistration() {
  if (process.platform !== 'darwin') return;
  const processes = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,command='], { encoding: 'utf8' });
  const shell = processes.split('\n').map(line => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .find(match => match && Number(match[2]) === process.pid
      && /\/(?:chrome-headless-shell|headless_shell)\s/.test(match[3]));
  assert.ok(shell, 'The browser must run as a standalone headless shell');
  const policy = execFileSync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', `
    ObjC.import('AppKit');
    var app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(${Number(shell[1])});
    app.isNil() ? -1 : Number(app.activationPolicy);
  `], { encoding: 'utf8' });
  assert.ok([-1, 1, 2].includes(Number(policy.trim())), 'The shell must not register as a regular Dock application');
}

test('dedicated headless shell supports demo interactions and closes cleanly', async () => {
  const session = await launchHeadlessSession();
  const { cdp } = session;
  try {
    checkMacDockRegistration();
    const { product } = await cdp.send('Browser.getVersion');
    assert.match(product, /HeadlessChrome/);

    const html = '<input id="name"><button onclick="document.title=document.querySelector(\'input\').value">Send</button>';
    await cdp.send('Page.navigate', { url: `data:text/html,${encodeURIComponent(html)}` });
    await cdp.send('Runtime.evaluate', {
      expression: `new Promise(resolve => {
        if (document.readyState === 'complete') resolve();
        else addEventListener('load', resolve, { once: true });
      })`,
      awaitPromise: true
    });
    await cdp.send('Runtime.evaluate', { expression: 'document.querySelector("input").focus()' });
    await cdp.send('Input.insertText', { text: 'Headless check passed' });
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `(() => {
        const box = document.querySelector('button').getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      })()`,
      returnByValue: true
    });
    for (const type of ['mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, ...result.value, button: 'left', clickCount: 1 });
    }
    const title = await cdp.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
    assert.equal(title.result.value, 'Headless check passed');
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    assert.ok(screenshot.data.length > 100);
  } finally {
    await session.close();
  }
  await session.close(); // Cleanup is safe when Stop and completion overlap.
  await assert.rejects(cdp.send('Runtime.evaluate', { expression: '1' }), /closed|detached/i);
});
