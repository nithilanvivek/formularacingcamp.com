module.exports = function handler(req, res) {
res.setHeader('Cache-Control', 'private, no-store, max-age=0');
res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');

if (req.method !== 'GET') {
res.setHeader('Allow', 'GET');
res.status(405).json({ ok: false, error: 'method_not_allowed' });
return;
}

const siteKey = String(process.env.TURNSTILE_SITE_KEY || '').trim();
if (!siteKey) {
res.status(503).json({ ok: false, error: 'captcha_unavailable' });
return;
}

res.status(200).json({ ok: true, siteKey });
};
