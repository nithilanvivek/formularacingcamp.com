const { createHmac, timingSafeEqual, randomBytes } = require('node:crypto');

const COOKIE_NAME = 'frc_sales_verified';
const SESSION_SECONDS = 8 * 60 * 60;

function signature(payload) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new Error('Verification is not configured.');
  return createHmac('sha256', secret).update(`sales-page:v1:${payload}`).digest('base64url');
}

function sessionCookie(hostname, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ hostname, expires: now + SESSION_SECONDS * 1000, nonce: randomBytes(16).toString('hex') })).toString('base64url');
  return `${COOKIE_NAME}=${payload}.${signature(payload)}; Path=/api/sales-data; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

function hasSession(req, hostname, now = Date.now()) {
  try {
    const cookie = String(req.headers?.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
    if (!cookie || cookie.length > 1024) return false;
    const parts = cookie.slice(COOKIE_NAME.length + 1).split('.');
    if (parts.length !== 2) return false;
    const [payload, supplied] = parts;
    const expected = signature(payload);
    if (supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return false;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.hostname === hostname && Number.isSafeInteger(session.expires) && session.expires > now && session.expires <= now + SESSION_SECONDS * 1000;
  } catch { return false; }
}

async function verifyChallenge(token, hostname) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret || !String(process.env.TURNSTILE_SITE_KEY || '').trim()) {
    throw Object.assign(new Error('Bot verification is not configured.'), { status: 503 });
  }
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token }), signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw Object.assign(new Error('Bot verification is unavailable. Try again.'), { status: 503 });
  const result = await response.json();
  return result.success === true && result.action === 'sales' && result.hostname === hostname;
}

module.exports = { sessionCookie, hasSession, verifyChallenge, SESSION_SECONDS };
