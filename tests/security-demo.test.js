const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const demo = require('../security-demo/server');

test('security demo is fixed to one labeled Formula Racing Camp contact attempt', () => {
  assert.equal(demo.HOST, '127.0.0.1');
  assert.equal(demo.TARGET_URL, 'https://www.formularacingcamp.com/#contact');
  assert.equal(demo.DEMO_EMAIL, 'security-test@formularacingcamp.com');
  assert.match(demo.DEMO_SUBJECT, /security demo/i);
  assert.match(demo.DEMO_MESSAGE, /controlled automated security test/i);
});

test('security demo rejects non-local hosts and untrusted start requests', () => {
  assert.equal(demo.safeRequestHost({ headers: { host: 'attacker.example' } }), false);
  assert.equal(demo.safeRequestHost({ headers: { host: `127.0.0.1:${demo.PORT}` } }), true);
  assert.equal(demo.safeStartRequest({ headers: {
    host: `127.0.0.1:${demo.PORT}`,
    origin: 'https://attacker.example',
    'x-demo-token': 'wrong'
  } }), false);
});

test('security demo is excluded from production deployment and documents its safeguards', () => {
  const root = path.resolve(__dirname, '..');
  const vercelIgnore = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'security-demo/server.js'), 'utf8');

  assert.match(vercelIgnore, /^security-demo\/$/m);
  assert.match(server, /attemptUsed/);
  assert.match(server, /Turnstile did not enable submission/);
  assert.doesNotMatch(server, /turnstileToken\s*=|cf-turnstile-response/);
});
