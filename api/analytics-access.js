const crypto = require('node:crypto');

const COOKIE_NAME = 'frc_analytics_access';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionToken(password) {
  return crypto
    .createHmac('sha256', password)
    .update('formula-racing-camp-analytics-session-v1')
    .digest('base64url');
}

function cookieValue(req, name) {
  for (const cookie of String(req.headers.cookie || '').split(';')) {
    const separator = cookie.indexOf('=');
    if (separator === -1) continue;
    if (cookie.slice(0, separator).trim() === name) {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    }
  }
  return '';
}

function submittedValue(req, name) {
  if (req.body && typeof req.body === 'object') return String(req.body[name] || '');
  return String(new URLSearchParams(String(req.body || '')).get(name) || '');
}

function isSecureRequest(req) {
  return Boolean(process.env.VERCEL) || String(req.headers['x-forwarded-proto'] || '').includes('https');
}

function setSessionCookie(req, res, value, maxAge) {
  const secure = isSecureRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly${secure}; SameSite=Strict; Max-Age=${maxAge}`
  );
}

function documentShell(content, title, scripts = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet">
  <meta name="description" content="Private analytics dashboard for Formula Racing Camp.">
  <meta name="theme-color" content="#07111b">
  <title>${title} | Formula Racing Camp</title>
  <link rel="icon" type="image/webp" href="/assets/site/f1-camp-logo-transparent.webp?v=20260731-webp1">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20260731">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&amp;family=Poppins:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/assets/analytics/dashboard.css?v=20260731-hobby1">
</head>
<body>
  <div class="site-shell">
    <header class="site-header">
      <a class="site-brand" href="/" aria-label="Formula Racing Camp home">
        <img src="/assets/site/f1-camp-logo-transparent.webp?v=20260731-webp1" alt="">
        <span>Formula Racing Camp</span>
      </a>
      <span class="private-label"><i aria-hidden="true"></i> Private analytics</span>
    </header>
    ${content}
  </div>
  ${scripts}
</body>
</html>`;
}

function loginPage({ invalid = false, unavailable = false } = {}) {
  const message = unavailable
    ? 'Analytics access is not configured yet.'
    : invalid
      ? 'That password did not make the grid. Try again.'
      : '';
  return documentShell(`
    <main class="lock-screen">
      <div class="lock-mark" aria-hidden="true"><span></span></div>
      <p class="eyebrow">Private dashboard</p>
      <h1>Team telemetry,<br>behind the pit wall.</h1>
      <p class="lock-copy">Enter the dashboard password to see traffic, popular pages, devices, and on-site interactions.</p>
      <form class="lock-form" action="/analytics" method="post">
        <label for="password">Dashboard password</label>
        <div class="password-row">
          <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
          <button type="submit">Unlock <span aria-hidden="true">→</span></button>
        </div>
        <p class="form-status" role="alert">${message}</p>
      </form>
      <p class="privacy-note">The password and Vercel access token are checked only on the server.</p>
    </main>`, 'Analytics Access');
}

function dashboardPage() {
  return documentShell(`
    <main class="dashboard" id="dashboard">
      <header class="dashboard-hero">
        <div>
          <p class="eyebrow">Audience race data</p>
          <h1>Site analytics</h1>
          <p class="dashboard-intro">A private view of what readers are exploring and where they choose to continue.</p>
        </div>
        <div class="dashboard-tools">
          <div class="range-switch" aria-label="Analytics date range">
            <button type="button" data-range="7" aria-pressed="false">7 days</button>
            <button type="button" class="is-active" data-range="30" aria-pressed="true">30 days</button>
            <button type="button" data-range="90" aria-pressed="false">90 days</button>
          </div>
          <button class="quiet-button" id="refresh-button" type="button">Refresh</button>
          <form action="/analytics" method="post"><input type="hidden" name="action" value="logout"><button class="quiet-button" type="submit">Lock</button></form>
        </div>
      </header>

      <div class="status-row">
        <span class="sample-badge" id="sample-badge" hidden>Local sample data</span>
        <p class="dashboard-status" id="dashboard-status" aria-live="polite">Loading analytics…</p>
      </div>
      <p class="data-note">Page-view totals can appear before page, referrer, device, and browser breakdowns. Vercel’s detailed panels become useful after a few days of visitor activity.</p>

      <div class="metric-grid" aria-label="Analytics summary">
        <article class="metric-card metric-card--blue"><p>Visitors</p><strong id="visitors-total">—</strong><span>Privacy-friendly daily visitors</span></article>
        <article class="metric-card metric-card--orange"><p>Page views</p><strong id="pageviews-total">—</strong><span>Pages opened</span></article>
        <article class="metric-card metric-card--green"><p>Tracked actions</p><strong id="interactions-total">—</strong><span>Transition page views</span></article>
        <article class="metric-card metric-card--purple"><p>Action routes</p><strong id="action-types-total">—</strong><span>Distinct routes used</span></article>
      </div>

      <section class="panel panel--wide" aria-labelledby="traffic-title">
        <header class="panel-heading">
          <div><p class="panel-kicker">Traffic</p><h2 id="traffic-title">Daily activity</h2></div>
          <div class="chart-keys"><span class="chart-key chart-key--views"><i></i> Page views</span><span class="chart-key chart-key--visitors"><i></i> Visitors</span></div>
        </header>
        <div class="chart-wrap" id="traffic-chart"></div>
      </section>

      <div class="panel-grid">
        <section class="panel" aria-labelledby="pages-title"><header class="panel-heading"><div><p class="panel-kicker">Content</p><h2 id="pages-title">Top pages</h2></div></header><div class="rank-list" id="top-pages"></div></section>
        <section class="panel" aria-labelledby="referrers-title"><header class="panel-heading"><div><p class="panel-kicker">Discovery</p><h2 id="referrers-title">Top referrers</h2></div></header><div class="rank-list" id="referrer-list"></div></section>
        <section class="panel" aria-labelledby="devices-title"><header class="panel-heading"><div><p class="panel-kicker">Technology</p><h2 id="devices-title">Devices</h2></div></header><div class="rank-list" id="device-list"></div></section>
        <section class="panel" aria-labelledby="browsers-title"><header class="panel-heading"><div><p class="panel-kicker">Technology</p><h2 id="browsers-title">Browsers</h2></div></header><div class="rank-list" id="browser-list"></div></section>
        <section class="panel panel--wide panel--events" aria-labelledby="actions-title"><header class="panel-heading"><div><p class="panel-kicker">Interactions</p><h2 id="actions-title">Tracked actions</h2></div><span class="event-pill">Page-view routes</span></header><div class="event-grid" id="action-list"></div></section>
      </div>

      <footer class="dashboard-footer"><span id="updated-at">Not refreshed yet</span><span>Private · noindex · Vercel Web Analytics</span></footer>
    </main>`, 'Analytics', '<script src="/assets/analytics/dashboard.js?v=20260731-hobby1"></script>');
}

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');

  const password = process.env.ANALYTICS_DASHBOARD_PASSWORD;
  if (!password) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(503).send(loginPage({ unavailable: true }));
  }

  if (req.method === 'POST') {
    if (submittedValue(req, 'action') === 'logout') {
      setSessionCookie(req, res, '', 0);
      res.setHeader('Location', '/analytics');
      return res.status(303).end();
    }

    if (!secureEqual(submittedValue(req, 'password'), password)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(401).send(loginPage({ invalid: true }));
    }

    setSessionCookie(req, res, sessionToken(password), COOKIE_MAX_AGE);
    res.setHeader('Location', '/analytics');
    return res.status(303).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authenticated = secureEqual(cookieValue(req, COOKIE_NAME), sessionToken(password));
  const html = authenticated ? dashboardPage() : loginPage();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(req.method === 'HEAD' ? '' : html);
};

module.exports.secureEqual = secureEqual;
module.exports.sessionToken = sessionToken;
