const store = require('../lib/sales-store');

async function verifyChallenge(token, hostname) {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || '').trim();
  if (!secret || !String(process.env.TURNSTILE_SITE_KEY || '').trim()) {
    throw Object.assign(new Error('Bot verification is not configured. No record has been saved.'), { status: 503 });
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

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    if (req.method === 'GET') return res.status(200).json({ ...store.publicLedger(await store.readLedger()), turnstileSiteKey: String(process.env.TURNSTILE_SITE_KEY || '').trim() });
    const origin = String(req.headers?.origin || '');
    const host = String(req.headers?.host || '').toLowerCase();
    let source;
    try { source = new URL(origin); } catch { /* Reject missing or invalid origins. */ }
    if (!source || source.host.toLowerCase() !== host || !['http:', 'https:'].includes(source.protocol)) {
      return res.status(403).json({ error: 'Open the sales recorder on this site to save records.' });
    }
    if (!String(req.headers?.['content-type'] || '').toLowerCase().startsWith('application/json')) {
      return res.status(415).json({ error: 'Send records as JSON.' });
    }
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: 'Invalid request.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 8192) return res.status(400).json({ error: 'Invalid sales request.' });
    if (!await verifyChallenge(body.turnstileToken, source.hostname.toLowerCase())) {
      return res.status(400).json({ error: 'Complete the bot verification and try again.' });
    }
    return res.status(200).json(store.publicLedger(await store.saveEntry(body)));
  } catch (error) {
    const status = error.status || 503;
    return res.status(status).json({ error: error.status ? error.message : 'Sales storage is unavailable. Your form has been kept; try again.' });
  }
};
