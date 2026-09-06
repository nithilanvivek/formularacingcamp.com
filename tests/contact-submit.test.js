const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const contactConfig = require('../api/contact-config');
const contactSubmit = require('../api/contact-submit');

function responseRecorder() {
return {
statusCode: 200,
headers: {},
body: undefined,
setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
status(code) { this.statusCode = code; return this; },
json(value) { this.body = value; return this; },
end() { return this; }
};
}

function request(body = {}) {
return {
method: 'POST',
headers: {
host: 'www.formularacingcamp.com',
origin: 'https://www.formularacingcamp.com',
'x-forwarded-for': '203.0.113.8'
},
body: {
email: 'reader@example.com',
subject: 'Book question',
message: 'Where can I find the preview?',
turnstileToken: 'verified-token',
...body
}
};
}

function saveEnvironment() {
const names = ['RESEND_API_KEY', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'];
const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
return () => names.forEach((name) => {
if (saved[name] === undefined) delete process.env[name];
else process.env[name] = saved[name];
});
}

function configureContact() {
process.env.RESEND_API_KEY = 'resend-test-key';
process.env.TURNSTILE_SITE_KEY = 'turnstile-test-site-key';
process.env.TURNSTILE_SECRET_KEY = 'turnstile-test-secret-key';
}

test('contact config exposes only the public Turnstile site key', { concurrency: false }, () => {
const restore = saveEnvironment();
configureContact();
const res = responseRecorder();
contactConfig({ method: 'GET' }, res);
restore();

assert.equal(res.statusCode, 200);
assert.deepEqual(res.body, { ok: true, siteKey: 'turnstile-test-site-key' });
assert.doesNotMatch(JSON.stringify(res.body), /secret/i);
});

test('contact submission fails closed when Turnstile is not configured', { concurrency: false }, async () => {
const restore = saveEnvironment();
const originalFetch = global.fetch;
process.env.RESEND_API_KEY = 'resend-test-key';
delete process.env.TURNSTILE_SECRET_KEY;
let calls = 0;
global.fetch = async () => { calls += 1; };

const res = responseRecorder();
await contactSubmit(request(), res);
global.fetch = originalFetch;
restore();

assert.equal(res.statusCode, 503);
assert.equal(res.body.error, 'captcha_unavailable');
assert.equal(calls, 0);
});

test('contact submission rejects missing tokens before external requests', { concurrency: false }, async () => {
const restore = saveEnvironment();
const originalFetch = global.fetch;
configureContact();
let calls = 0;
global.fetch = async () => { calls += 1; };

const res = responseRecorder();
await contactSubmit(request({ turnstileToken: '' }), res);
global.fetch = originalFetch;
restore();

assert.equal(res.statusCode, 400);
assert.equal(res.body.error, 'captcha_required');
assert.equal(calls, 0);
});

test('failed Turnstile verification never sends email', { concurrency: false }, async () => {
const restore = saveEnvironment();
const originalFetch = global.fetch;
configureContact();
const urls = [];
global.fetch = async (url) => {
urls.push(url);
return { ok: true, json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) };
};

const res = responseRecorder();
await contactSubmit(request(), res);
global.fetch = originalFetch;
restore();

assert.equal(res.statusCode, 400);
assert.equal(res.body.error, 'captcha_failed');
assert.deepEqual(urls, ['https://challenges.cloudflare.com/turnstile/v0/siteverify']);
});

test('Turnstile action and hostname must match the contact request', { concurrency: false }, async () => {
const restore = saveEnvironment();
const originalFetch = global.fetch;
configureContact();
let calls = 0;
global.fetch = async () => {
calls += 1;
return { ok: true, json: async () => ({ success: true, action: 'login', hostname: 'www.formularacingcamp.com' }) };
};

const res = responseRecorder();
await contactSubmit(request(), res);
global.fetch = originalFetch;
restore();

assert.equal(res.statusCode, 400);
assert.equal(res.body.error, 'captcha_failed');
assert.equal(calls, 1);
});

test('verified contact submission sends one Resend email without the token', { concurrency: false }, async () => {
const restore = saveEnvironment();
const originalFetch = global.fetch;
configureContact();
const calls = [];
global.fetch = async (url, options) => {
calls.push({ url, options });
if (url.includes('/siteverify')) {
return {
ok: true,
json: async () => ({ success: true, action: 'contact', hostname: 'www.formularacingcamp.com' })
};
}
return { ok: true, text: async () => '' };
};

const res = responseRecorder();
await contactSubmit(request(), res);
global.fetch = originalFetch;
restore();

assert.equal(res.statusCode, 200);
assert.equal(calls.length, 2);
assert.match(calls[0].url, /siteverify$/);
assert.equal(JSON.parse(calls[0].options.body).response, 'verified-token');
assert.equal(calls[1].url, 'https://api.resend.com/emails');
assert.doesNotMatch(calls[1].options.body, /verified-token/);
});

test('Resend network errors return a controlled failure after verification', { concurrency: false }, async () => {
const restore = saveEnvironment();
const originalFetch = global.fetch;
const originalError = console.error;
configureContact();
console.error = () => {};
let calls = 0;
global.fetch = async (url) => {
calls += 1;
if (url.includes('/siteverify')) {
return {
ok: true,
json: async () => ({ success: true, action: 'contact', hostname: 'www.formularacingcamp.com' })
};
}
throw new Error('network unavailable');
};

const res = responseRecorder();
await contactSubmit(request(), res);
global.fetch = originalFetch;
console.error = originalError;
restore();

assert.equal(res.statusCode, 502);
assert.equal(res.body.error, 'contact_email_failed');
assert.equal(calls, 2);
});

test('contact page and CSP include the Turnstile integration', () => {
const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');

assert.match(index, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
assert.match(index, /id="contact-turnstile"/);
assert.match(app, /turnstileToken: contactTurnstileToken/);
assert.match(vercel, /frame-src 'self' https:\/\/challenges\.cloudflare\.com/);
});
