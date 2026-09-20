const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const test = require('node:test');

function demoWith(launchHeadlessSession) {
  const filename = path.resolve(__dirname, '../security-demo/server.js');
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module,
    __dirname: path.dirname(filename),
    process: { env: {} },
    URL,
    setTimeout: (callback) => setImmediate(callback),
    require(name) {
      if (name === './browser-session') return { launchHeadlessSession };
      if (name === 'node:http') return { createServer: (handler) => ({ handler }) };
      if (name === 'node:crypto') return { randomBytes: () => Buffer.alloc(24) };
      return localRequire(name);
    }
  }, { filename });
  const { server, PORT } = module.exports;
  function request(url, method = 'GET') {
    let status;
    let body;
    server.handler({ url, method, headers: {
      host: `127.0.0.1:${PORT}`,
      origin: `http://127.0.0.1:${PORT}`,
      'x-demo-token': '0'.repeat(48)
    } }, {
      writeHead(code) { status = code; },
      end(value) { body = JSON.parse(value); }
    });
    return { status, body };
  }
  return request;
}

async function waitForFinish(request) {
  for (let count = 0; count < 500; count++) {
    await new Promise(setImmediate);
    if (!request('/api/state').body.attemptActive) return;
  }
  assert.fail('Demo did not finish or clean up');
}

test('stopping a pending launch closes it and prevents overlapping attempts', async () => {
  let resolveLaunch;
  let closed = 0;
  const request = demoWith(() => new Promise(resolve => { resolveLaunch = resolve; }));
  assert.equal(request('/api/start', 'POST').status, 202);
  await new Promise(setImmediate);
  assert.equal(request('/api/stop', 'POST').status, 200);
  assert.equal(request('/api/start', 'POST').status, 409);
  resolveLaunch({
    cdp: { send() { assert.fail('Cancelled launch must not navigate'); } },
    async close() { closed++; }
  });
  await waitForFinish(request);
  assert.equal(closed, 1);
  assert.equal(request('/api/state').body.phase, 'stopped');
});

test('navigation failures close the browser before permitting another attempt', async () => {
  let closed = 0;
  const request = demoWith(async () => ({
    cdp: { async send() { throw new Error('Navigation failed'); } },
    async close() { closed++; }
  }));
  request('/api/start', 'POST');
  await waitForFinish(request);
  assert.equal(closed, 1);
  assert.equal(request('/api/state').body.phase, 'error');
  assert.equal(request('/api/start', 'POST').status, 202);
  await waitForFinish(request);
  assert.equal(closed, 2);
});

test('a completed demo closes its browser after a single simulated submission', async () => {
  let closed = 0;
  let clicks = 0;
  const request = demoWith(async () => ({
    cdp: { async send(method, params = {}) {
      if (method === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased') clicks++;
      if (method !== 'Runtime.evaluate') return {};
      let value = true;
      if (params.expression.includes('getBoundingClientRect')) value = { x: 10, y: 10 };
      if (params.expression.includes('element ? element.textContent')) value = 'Message sent';
      return { result: { value } };
    } },
    async close() { closed++; }
  }));
  request('/api/start', 'POST');
  await waitForFinish(request);
  assert.equal(request('/api/state').body.phase, 'success');
  assert.equal(clicks, 1);
  assert.equal(closed, 1);
});
