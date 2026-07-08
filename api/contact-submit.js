const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_CONTACT_FROM = 'Formula Racing Camp <contact@mail.formularacingcamp.com>';
const DEFAULT_CONTACT_TO = 'authors@formularacingcamp.com';

function setCors(res) {
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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
message: cleanText(body?.message, 3000)
};
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
setCors(res);

if (req.method === 'OPTIONS') {
res.status(204).end();
return;
}

if (req.method !== 'POST') {
res.status(405).json({ ok: false, error: 'method_not_allowed' });
return;
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
res.status(503).json({ ok: false, error: 'email_not_configured' });
return;
}

const payload = contactPayload(req.body || {});
if (!isValidEmail(payload.email) || !payload.subject || !payload.message) {
res.status(400).json({ ok: false, error: 'invalid_contact_message' });
return;
}

const response = await fetch(RESEND_EMAIL_ENDPOINT, {
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

if (!response.ok) {
console.error('Contact email failed', response.status, await response.text());
res.status(502).json({ ok: false, error: 'contact_email_failed' });
return;
}

res.status(200).json({ ok: true });
};
