const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
const TURNSTILE_VERIFY_ENDPOINT = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_ACTION = 'contact';
const DEFAULT_CONTACT_FROM = 'Formula Racing Camp <contact@mail.formularacingcamp.com>';
const DEFAULT_CONTACT_TO = 'authors@formularacingcamp.com';

function requestBody(req) {
if (req.body && typeof req.body === 'object') return req.body;
if (typeof req.body === 'string') {
try { return JSON.parse(req.body); } catch { return {}; }
}
return {};
}

function requestHostname(req) {
const host = String(req.headers?.host || '').split(',')[0].trim().toLowerCase();
if (!host) return '';
try { return new URL(`https://${host}`).hostname; } catch { return ''; }
}

function sameOrigin(req) {
const hostname = requestHostname(req);
const origin = String(req.headers?.origin || '').trim().toLowerCase();
if (!hostname || !origin) return false;
try { return new URL(origin).hostname.toLowerCase() === hostname; } catch { return false; }
}

function clientIp(req) {
return String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
}

function isValidEmail(email) {
return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function cleanText(value, maxLength) {
return String(value || '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
return String(value ?? '')
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#39;');
}

function contactRecipient() {
const configured = process.env.CONTACT_TO || process.env.LAUNCH_GAME_REPLY_TO || process.env.LAUNCH_GAME_ADMIN_EMAIL || DEFAULT_CONTACT_TO;
return String(configured)
.split(',')
.map((email) => email.trim())
.find(isValidEmail) || DEFAULT_CONTACT_TO;
}

function contactPayload(body) {
return {
email: cleanText(body?.email, 160).toLowerCase(),
subject: cleanText(body?.subject, 140),
message: cleanText(body?.message, 3000),
turnstileToken: cleanText(body?.turnstileToken, 2048)
};
}

async function verifyTurnstile(payload, req, secretKey) {
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8000);

try {
const body = {
secret: secretKey,
response: payload.turnstileToken
};
const remoteip = clientIp(req);
if (remoteip) body.remoteip = remoteip;

const response = await fetch(TURNSTILE_VERIFY_ENDPOINT, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(body),
signal: controller.signal
});

if (!response.ok) return { available: false, valid: false };
const result = await response.json();
const valid = result.success === true
&& result.action === TURNSTILE_ACTION
&& String(result.hostname || '').toLowerCase() === requestHostname(req);
return { available: true, valid };
} catch (error) {
console.error('Contact verification failed', error.name === 'AbortError' ? 'timeout' : 'request_error');
return { available: false, valid: false };
} finally {
clearTimeout(timeout);
}
}

function contactText(payload) {
return [
`From: ${payload.email}`,
`Subject: ${payload.subject}`,
'',
payload.message
].join('\n');
}

function contactHtml(payload) {
return `
<div style="font-family: Arial, Helvetica, sans-serif; color: #10131a; line-height: 1.5;">
  <h1 style="margin: 0 0 12px;">New Formula Racing Camp message</h1>
  <p><strong>From:</strong> ${escapeHtml(payload.email)}</p>
  <p><strong>Subject:</strong> ${escapeHtml(payload.subject)}</p>
  <div style="margin-top: 18px; padding: 14px; border: 1px solid #d1d5db; background: #f8fbff;">
    ${escapeHtml(payload.message).replace(/\n/g, '<br>')}
  </div>
</div>`.trim();
}

module.exports = async function handler(req, res) {
res.setHeader('Cache-Control', 'private, no-store, max-age=0');
res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

if (req.method !== 'POST') {
res.setHeader('Allow', 'POST');
res.status(405).json({ ok: false, error: 'method_not_allowed' });
return;
}

const apiKey = String(process.env.RESEND_API_KEY || '').trim();
const turnstileSecret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
if (!turnstileSecret) {
res.status(503).json({ ok: false, error: 'captcha_unavailable' });
return;
}

if (!apiKey) {
res.status(503).json({ ok: false, error: 'email_not_configured' });
return;
}

const payload = contactPayload(requestBody(req));
if (!isValidEmail(payload.email) || !payload.subject || !payload.message) {
res.status(400).json({ ok: false, error: 'invalid_contact_message' });
return;
}

if (!sameOrigin(req)) {
res.status(403).json({ ok: false, error: 'invalid_source' });
return;
}

if (!payload.turnstileToken) {
res.status(400).json({ ok: false, error: 'captcha_required' });
return;
}

const verification = await verifyTurnstile(payload, req, turnstileSecret);
if (!verification.available) {
res.status(502).json({ ok: false, error: 'captcha_unavailable' });
return;
}
if (!verification.valid) {
res.status(400).json({ ok: false, error: 'captcha_failed' });
return;
}

let response;
try {
response = await fetch(RESEND_EMAIL_ENDPOINT, {
method: 'POST',
headers: {
Authorization: `Bearer ${apiKey}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({
from: process.env.CONTACT_EMAIL_FROM || DEFAULT_CONTACT_FROM,
to: [contactRecipient()],
reply_to: payload.email,
subject: `Formula Racing Camp: ${payload.subject}`,
html: contactHtml(payload),
text: contactText(payload)
})
});
} catch (error) {
console.error('Contact email failed', 'request_error');
res.status(502).json({ ok: false, error: 'contact_email_failed' });
return;
}

if (!response.ok) {
console.error('Contact email failed', response.status, await response.text());
res.status(502).json({ ok: false, error: 'contact_email_failed' });
return;
}

res.status(200).json({ ok: true });
};

module.exports.contactPayload = contactPayload;
module.exports.requestBody = requestBody;
module.exports.requestHostname = requestHostname;
module.exports.sameOrigin = sameOrigin;
