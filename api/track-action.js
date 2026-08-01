const counters = require('../lib/analytics-counters');

const EXPECTED_PATHS = {
  purchase_opened: new Set(['/']),
  book_store_selected: new Set(['/go/book', '/go/book/']),
  puzzles_opened: new Set(['/go/puzzles', '/go/puzzles/']),
  youtube_opened: new Set(['/go/youtube', '/go/youtube/'])
};

function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function requestPath(req) {
  try {
    return new URL(String(req.headers.referer || ''), 'https://invalid.local').pathname;
  } catch {
    return '';
  }
}

function sameOrigin(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  if (!origin) return false;
  try { return new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = requestBody(req);
  const allowedPaths = EXPECTED_PATHS[body.action];
  if (!sameOrigin(req) || !allowedPaths?.has(requestPath(req))) {
    return res.status(403).json({ ok: false, error: 'invalid_source' });
  }

  if (!counters.redisConfig().configured) {
    const local = !process.env.VERCEL && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(req.headers.host || ''));
    if (local) return res.status(202).json({ ok: true, sample: true });
    return res.status(503).json({ ok: false, error: 'counter_unavailable' });
  }

  try {
    await counters.incrementAction(body.action, { store: body.store });
    return res.status(202).json({ ok: true });
  } catch (error) {
    console.error('Analytics counter increment failed:', error.message);
    return res.status(502).json({ ok: false, error: 'counter_failed' });
  }
};

module.exports.EXPECTED_PATHS = EXPECTED_PATHS;
module.exports.requestBody = requestBody;
