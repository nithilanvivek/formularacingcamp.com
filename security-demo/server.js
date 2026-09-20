const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { launchHeadlessSession } = require('./browser-session');

const HOST = '127.0.0.1';
const PORT = Number(process.env.FRC_SECURITY_DEMO_PORT || 4173);
const TARGET_URL = 'https://nithi.land/contact/';
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
  await closeBrowserSession();
  throwIfStopped(attempt);
  state.phase = 'launching';
  addLog('Starting a fresh Chromium headless shell session', 'action');

  const session = await launchHeadlessSession();
  if (attempt.cancelled) {
    await session.close();
    throwIfStopped(attempt);
  }
  attempt.session = session;
  const cdp = session.cdp;

  state.phase = 'navigating';
  addLog(`Navigating to ${TARGET_URL}`, 'action');
  await cdp.send('Page.navigate', { url: TARGET_URL });
  const ready = await waitFor(
    () => evaluate(cdp, "document.readyState === 'complete' && Boolean(document.querySelector('[data-contact-form]'))"),
    20000,
    200,
    attempt
  );
  if (!ready) throw new Error('The production contact form did not finish loading');
  addLog('Production contact form loaded', 'ok');

  state.phase = 'typing';
  await focusAndType(cdp, '[data-contact-form] [name="name"]', DEMO_NAME, 'Test name', attempt);
  await focusAndType(cdp, '[data-contact-form] [name="email"]', DEMO_EMAIL, 'Test email', attempt);
  await focusAndType(cdp, '[data-contact-form] [name="subject"]', DEMO_SUBJECT, 'Test subject', attempt);
  await focusAndType(cdp, '[data-contact-form] [name="message"]', DEMO_MESSAGE, 'Test message', attempt);
  addLog('Honeypot field intentionally left empty', 'ok');

  state.phase = 'verifying';
  addLog('Waiting for Turnstile to evaluate the browser normally', 'action');
  let verificationPassed = await waitFor(
    () => evaluate(cdp, "document.querySelector('[data-contact-form] button[type=\"submit\"]')?.disabled === false"),
    TURNSTILE_AUTOMATIC_WAIT_MS,
    300,
    attempt
  );
  if (!verificationPassed) {
    state.phase = 'checkbox';
    addLog('Turnstile requested its checkbox. The bot is clicking it once.', 'warn');
    await clickTurnstileCheckbox(cdp, attempt);
    addLog('Automated checkbox click dispatched; observing Turnstile’s decision', 'action');
    verificationPassed = await waitFor(
      () => evaluate(cdp, `(() => {
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
      const verificationStatus = await evaluate(cdp, "document.querySelector('[data-contact-status]')?.textContent.trim() || ''");
      addLog(verificationStatus || 'Turnstile did not accept the automated checkbox click within 20 seconds. No message was sent.', 'warn');
      return;
    }
    addLog('Turnstile accepted the automated checkbox click; submission is now enabled', 'ok');
  } else {
    addLog('Turnstile enabled the form without an interactive challenge', 'ok');
  }

  state.phase = 'submitting';
  addLog('Clicking Send Message once', 'action');
  await clickSubmit(cdp, attempt);

  const outcome = await waitFor(async () => {
    const status = await evaluate(cdp, `(() => {
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
    await closeBrowserSession(attempt);
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
    state.phase = 'stopped';
    addLog(`Attempt ${activeAttempt.id} stopped by the operator`, 'warn');
    void closeBrowserSession();
    json(res, 200, { ok: true, attempt: activeAttempt.id });
    return;
  }

  json(res, 404, { ok: false, error: 'not_found' });
});

async function closeBrowserSession(attempt = activeAttempt) {
  const session = attempt?.session;
  if (session) await session.close().catch(() => {});
  if (attempt && attempt.session === session) attempt.session = undefined;
}

async function cleanup() {
  if (activeAttempt) activeAttempt.cancelled = true;
  await closeBrowserSession();
}

if (require.main === module) {
  addLog('Ready. Every Start press permits one checkbox click and one real, labeled email attempt.', 'info');
  server.listen(PORT, HOST, () => {
    console.log(`nithi.land contact security demo: http://${HOST}:${PORT}`);
  });
  process.once('SIGINT', async () => { await cleanup(); process.exit(0); });
  process.once('SIGTERM', async () => { await cleanup(); process.exit(0); });
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
