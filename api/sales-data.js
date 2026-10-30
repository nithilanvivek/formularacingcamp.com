const store = require('../lib/sales-store');
const verification = require('../lib/sales-verification');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  try {
    const host = String(req.headers?.host || '').toLowerCase();
    const hostname = new URL(`https://${host}`).hostname;
    const verified = verification.hasSession(req, hostname);
    const requireVerification = () => res.status(401).json({ error: 'Complete the page verification to open the sales recorder.', verificationRequired: true, turnstileSiteKey: String(process.env.TURNSTILE_SITE_KEY || '').trim() });
    if (req.method === 'GET') {
      if (!verified) return requireVerification();
      return res.status(200).json(store.publicLedger(await store.readLedger()));
    }
    const origin = String(req.headers?.origin || '');
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
    if (body.action === 'verify-page') {
      if (!verified && !await verification.verifyChallenge(body.turnstileToken, hostname)) {
        return res.status(400).json({ error: 'Complete the bot verification and try again.' });
      }
      res.setHeader('Set-Cookie', verification.sessionCookie(hostname));
      return res.status(200).json(store.publicLedger(await store.readLedger()));
    }
    if (!verified) return requireVerification();
    return res.status(200).json(store.publicLedger(await store.saveEntry(body)));
  } catch (error) {
    const status = error.status || 503;
    return res.status(status).json({ error: error.status ? error.message : 'Sales storage is unavailable. Your form has been kept; try again.' });
  }
};
