const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const HOST = '127.0.0.1';
const PORT = Number(process.env.FRC_SECURITY_DEMO_PORT || 4173);
const TARGET_URL = 'https://nithi.land/contact/';
const BROWSER_CANDIDATES = [
  process.env.FRC_BROWSER_PATH,
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
].filter(Boolean);
const TURNSTILE_AUTOMATIC_WAIT_MS = 5000;
const TURNSTILE_CLICK_RESULT_WAIT_MS = 20000;
const DEMO_NAME = 'Local Security Test';
const DEMO_EMAIL = 'security-test@nithi.land';
const DEMO_SUBJECT = 'Local security demo – automated nithi.land contact attempt';
const DEMO_MESSAGE = 'This is one controlled automated security test of the nithi.land contact form. No reply is needed.';
const STATIC_DIR = __dirname;
const pageToken = crypto.randomBytes(24).toString('hex');

const state = {
  phase: 'ready',
  attemptActive: false,
  attemptCount: 0,
  logs: []
};

let chromeProcess;
let chromeProfile;
let activeCdp;
let activeAttempt;

class AttemptStoppedError extends Error {
  constructor() {
    super('Attempt stopped by the operator');
    this.name = 'AttemptStoppedError';
  }
}

function throwIfStopped(attempt) {
  if (attempt?.cancelled) throw new AttemptStoppedError();
}

function addLog(message, tone = 'info') {
  state.logs.push({ at: new Date().toISOString(), message, tone });
  if (state.logs.length > 100) state.logs.shift();
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body));
}

function safeRequestHost(req) {
  return new Set([`${HOST}:${PORT}`, `localhost:${PORT}`]).has(String(req.headers.host || '').toLowerCase());
}

function safeStartRequest(req) {
  const origin = String(req.headers.origin || '').toLowerCase();
  return safeRequestHost(req)
    && new Set([`http://${HOST}:${PORT}`, `http://localhost:${PORT}`]).has(origin)
    && req.headers['x-demo-token'] === pageToken;
}

function serveFile(res, filename, contentType, substitutions = {}) {
  let body = fs.readFileSync(path.join(STATIC_DIR, filename), 'utf8');
  for (const [key, value] of Object.entries(substitutions)) body = body.replaceAll(key, value);
  res.writeHead(200, {
    'Content-Type': `${contentType}; charset=utf-8`,
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  res.end(body);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(getValue, timeoutMs, intervalMs = 200, attempt) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    throwIfStopped(attempt);
    const value = await getValue();
    if (value) return value;
    await sleep(intervalMs);
  }
  throwIfStopped(attempt);
  return null;
}

class CdpConnection {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result || {});
    });
    this.socket.addEventListener('close', () => {
      for (const { reject } of this.pending.values()) reject(new Error('Browser connection closed'));
      this.pending.clear();
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket.close();
  }
}

async function readDevToolsPort(profileDirectory, attempt) {
  const portFile = path.join(profileDirectory, 'DevToolsActivePort');
  const contents = await waitFor(() => {
    try { return fs.readFileSync(portFile, 'utf8'); } catch { return null; }
  }, 10000, 200, attempt);
  if (!contents) throw new Error('Chrome did not expose its local debugging port');
  return Number(contents.split(/\r?\n/)[0]);
}

async function findPageTarget(port, attempt) {
  return waitFor(async () => {
    try {
      const response = await fetch(`http://${HOST}:${port}/json/list`);
      const targets = await response.json();
      return targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl) || null;
    } catch {
      return null;
    }
  }, 10000, 200, attempt);
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Page evaluation failed');
  return result.result?.value;
}

async function focusAndType(cdp, selector, text, label, attempt) {
  throwIfStopped(attempt);
  const found = await evaluate(cdp, `(() => {
    const field = document.querySelector(${JSON.stringify(selector)});
    if (!field) return false;
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.focus();
    field.value = '';
    return true;
  })()`);
  if (!found) throw new Error(`${label} field was not found`);
  await sleep(500);
  for (const character of text) {
    throwIfStopped(attempt);
    await cdp.send('Input.insertText', { text: character });
    await sleep(24);
  }
  addLog(`${label} entered`, 'action');
  await sleep(350);
}

async function clickSubmit(cdp, attempt) {
  throwIfStopped(attempt);
  const point = await evaluate(cdp, `(() => {
    const button = document.querySelector('[data-contact-form] button[type="submit"]');
    if (!button || button.disabled) return null;
    button.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const box = button.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`);
  if (!point) throw new Error('The Send Message button is not available');
  await sleep(700);
  throwIfStopped(attempt);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function clickTurnstileCheckbox(cdp, attempt) {
  throwIfStopped(attempt);
  const widgetFound = await evaluate(cdp, `(() => {
    const widget = document.querySelector('[data-turnstile]');
    if (!widget) return false;
    widget.scrollIntoView({ behavior: 'instant', block: 'center' });
    return true;
  })()`);
  if (!widgetFound) throw new Error('The visible Turnstile widget container was not found');
  await sleep(400);

  const point = await evaluate(cdp, `(() => {
    const widget = document.querySelector('[data-turnstile]');
    if (!widget) return null;
    const box = widget.getBoundingClientRect();
    if (box.width < 80 || box.height < 40 || box.bottom <= 0 || box.top >= window.innerHeight) return null;
    return { x: box.left + Math.min(30, box.width / 8), y: box.top + box.height / 2 };
  })()`);
  if (!point) throw new Error('The Turnstile widget did not settle inside the visible viewport');
  addLog(`Checkbox target settled at screen point ${Math.round(point.x)}, ${Math.round(point.y)}`, 'info');
  await sleep(350);
  throwIfStopped(attempt);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function runDemo(attempt) {
  closeBrowserSession();
  throwIfStopped(attempt);
  state.phase = 'launching';
  const browserPath = BROWSER_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  addLog('Starting a fresh visible Chromium browser session', 'action');

  if (!browserPath) throw new Error('No supported Chromium browser was found. Set FRC_BROWSER_PATH to its executable.');
  if (typeof WebSocket !== 'function') throw new Error('This demo requires Node.js 22 or newer');

  chromeProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'frc-security-demo-'));
  chromeProcess = spawn(browserPath, [
    '--remote-debugging-port=0',
    `--user-data-dir=${chromeProfile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    TARGET_URL
  ], { stdio: 'ignore' });

  const debuggingPort = await readDevToolsPort(chromeProfile, attempt);
  const target = await findPageTarget(debuggingPort, attempt);
  if (!target) throw new Error('The visible Chrome tab could not be reached');

  activeCdp = new CdpConnection(target.webSocketDebuggerUrl);
  await activeCdp.connect();
  await activeCdp.send('Page.enable');
  await activeCdp.send('Runtime.enable');
  await activeCdp.send('Page.bringToFront');

  state.phase = 'navigating';
  addLog(`Navigating to ${TARGET_URL}`, 'action');
  await activeCdp.send('Page.navigate', { url: TARGET_URL });
  const ready = await waitFor(
    () => evaluate(activeCdp, "document.readyState === 'complete' && Boolean(document.querySelector('[data-contact-form]'))"),
    20000,
    200,
    attempt
  );
  if (!ready) throw new Error('The production contact form did not finish loading');
  addLog('Production contact form loaded', 'ok');

  state.phase = 'typing';
  await focusAndType(activeCdp, '[data-contact-form] [name="name"]', DEMO_NAME, 'Test name', attempt);
  await focusAndType(activeCdp, '[data-contact-form] [name="email"]', DEMO_EMAIL, 'Test email', attempt);
  await focusAndType(activeCdp, '[data-contact-form] [name="subject"]', DEMO_SUBJECT, 'Test subject', attempt);
  await focusAndType(activeCdp, '[data-contact-form] [name="message"]', DEMO_MESSAGE, 'Test message', attempt);
  addLog('Honeypot field intentionally left empty', 'ok');

  state.phase = 'verifying';
  addLog('Waiting for Turnstile to evaluate the browser normally', 'action');
  let verificationPassed = await waitFor(
    () => evaluate(activeCdp, "document.querySelector('[data-contact-form] button[type=\"submit\"]')?.disabled === false"),
    TURNSTILE_AUTOMATIC_WAIT_MS,
    300,
    attempt
  );
  if (!verificationPassed) {
    state.phase = 'checkbox';
    addLog('Turnstile requested its checkbox. The bot is clicking it once.', 'warn');
    await clickTurnstileCheckbox(activeCdp, attempt);
    addLog('Automated checkbox click dispatched; observing Turnstile’s decision', 'action');
    verificationPassed = await waitFor(
      () => evaluate(activeCdp, `(() => {
        const button = document.querySelector('[data-contact-form] button[type="submit"]');
        const status = document.querySelector('[data-contact-status]')?.textContent.trim() || '';
        if (button?.disabled === false) return 'passed';
        if (/could not load|timed out|expired|failed/i.test(status)) return 'failed';
        return '';
      })()`),
      TURNSTILE_CLICK_RESULT_WAIT_MS,
      300,
      attempt
    );
    if (verificationPassed !== 'passed') {
      state.phase = 'stopped';
      const verificationStatus = await evaluate(activeCdp, "document.querySelector('[data-contact-status]')?.textContent.trim() || ''");
      addLog(verificationStatus || 'Turnstile did not accept the automated checkbox click within 20 seconds. No message was sent.', 'warn');
      return;
    }
    addLog('Turnstile accepted the automated checkbox click; submission is now enabled', 'ok');
  } else {
    addLog('Turnstile enabled the form without an interactive challenge', 'ok');
  }

  state.phase = 'submitting';
  addLog('Clicking Send Message once', 'action');
  await clickSubmit(activeCdp, attempt);

  const outcome = await waitFor(async () => {
    const status = await evaluate(activeCdp, `(() => {
      const element = document.querySelector('[data-contact-status]');
      return element ? element.textContent.trim() : '';
    })()`);
    if (/message sent/i.test(status)) return { phase: 'success', message: status };
    if (/limit|too many|try again later/i.test(status)) return { phase: 'blocked', message: status };
    if (/could not be sent|unavailable|failed|error/i.test(status)) return { phase: 'error', message: status };
    return null;
  }, 12000, 100, attempt);

  if (!outcome) throw new Error('The site did not report a final submission result');
  state.phase = outcome.phase;
  addLog(outcome.message, outcome.phase === 'success' ? 'ok' : outcome.phase === 'blocked' ? 'warn' : 'error');
}

async function startOnce(attempt) {
  try {
    await runDemo(attempt);
  } catch (error) {
    if (!attempt.cancelled) {
      state.phase = 'error';
      addLog(`Stopped: ${error.message}`, 'error');
    }
  } finally {
    if (activeAttempt === attempt) {
      state.attemptActive = false;
      activeAttempt = undefined;
    }
  }
}

const server = http.createServer((req, res) => {
  if (!safeRequestHost(req)) {
    json(res, 403, { ok: false, error: 'invalid_host' });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/') {
    serveFile(res, 'index.html', 'text/html', { '__DEMO_TOKEN__': pageToken });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/app.js') {
    serveFile(res, 'app.js', 'text/javascript');
    return;
  }
  if (req.method === 'GET' && url.pathname === '/styles.css') {
    serveFile(res, 'styles.css', 'text/css');
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/state') {
    json(res, 200, state);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/start') {
    if (!safeStartRequest(req)) {
      json(res, 403, { ok: false, error: 'invalid_start_request' });
      return;
    }
    if (state.attemptActive) {
      json(res, 409, { ok: false, error: 'attempt_in_progress' });
      return;
    }
    state.attemptActive = true;
    state.attemptCount += 1;
    activeAttempt = { id: state.attemptCount, cancelled: false };
    addLog(`Attempt ${state.attemptCount} started by the operator`, 'info');
    json(res, 202, { ok: true, attempt: state.attemptCount });
    void startOnce(activeAttempt);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/stop') {
    if (!safeStartRequest(req)) {
      json(res, 403, { ok: false, error: 'invalid_stop_request' });
      return;
    }
    if (!state.attemptActive || !activeAttempt) {
      json(res, 409, { ok: false, error: 'no_attempt_in_progress' });
      return;
    }
    activeAttempt.cancelled = true;
    state.attemptActive = false;
    state.phase = 'stopped';
    addLog(`Attempt ${activeAttempt.id} stopped by the operator`, 'warn');
    closeBrowserSession();
    json(res, 200, { ok: true, attempt: activeAttempt.id });
    return;
  }

  json(res, 404, { ok: false, error: 'not_found' });
});

function closeBrowserSession() {
  try { activeCdp?.close(); } catch {}
  try { chromeProcess?.kill(); } catch {}
  if (chromeProfile?.startsWith(os.tmpdir() + path.sep + 'frc-security-demo-')) {
    try { fs.rmSync(chromeProfile, { recursive: true, force: true }); } catch {}
  }
  activeCdp = undefined;
  chromeProcess = undefined;
  chromeProfile = undefined;
}

function cleanup() {
  closeBrowserSession();
}

if (require.main === module) {
  addLog('Ready. Every Start press permits one checkbox click and one real, labeled email attempt.', 'info');
  server.listen(PORT, HOST, () => {
    console.log(`nithi.land contact security demo: http://${HOST}:${PORT}`);
  });
  process.once('SIGINT', () => { cleanup(); process.exit(0); });
  process.once('SIGTERM', () => { cleanup(); process.exit(0); });
  process.once('exit', cleanup);
}

module.exports = {
  DEMO_NAME,
  DEMO_EMAIL,
  DEMO_MESSAGE,
  DEMO_SUBJECT,
  HOST,
  PORT,
  TARGET_URL,
  safeRequestHost,
  safeStartRequest,
  server
};
