const crypto = require('node:crypto');

const VERCEL_ANALYTICS_URL = 'https://api.vercel.com/v1/query/web-analytics';
const COOKIE_NAME = 'frc_analytics_access';
const ALLOWED_RANGES = new Set([7, 30, 90]);
const MAX_AGGREGATE_LIMIT = 100;
const TRACKED_ACTIONS = [
  { requestPath: '/go/book/', name: 'Official book' },
  { requestPath: '/go/puzzles/', name: 'F1 puzzles' },
  { requestPath: '/go/youtube/', name: 'YouTube channel' }
];

function secureEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionToken(password) {
  return crypto.createHmac('sha256', password).update('formula-racing-camp-analytics-session-v1').digest('base64url');
}

function cookieValue(req, name) {
  for (const cookie of String(req.headers.cookie || '').split(';')) {
    const separator = cookie.indexOf('=');
    if (separator === -1) continue;
    if (cookie.slice(0, separator).trim() === name) return decodeURIComponent(cookie.slice(separator + 1).trim());
  }
  return '';
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function dateRange(days) {
  const until = new Date();
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - days + 1);
  return { since: isoDate(since), until: isoDate(until) };
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function isLocalRequest(req) {
  const hostname = String(req.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '');
  return !process.env.VERCEL && ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function odataString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function samplePayload(days, range) {
  const trend = Array.from({ length: days }, (_, index) => {
    const date = new Date(`${range.since}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const wave = Math.round(9 + Math.sin(index / 2.4) * 5 + (index % 5));
    return { timestamp: date.toISOString(), pageviews: wave * 3, visitors: wave * 2 };
  });
  const actions = [
    { name: 'Official book', requestPath: '/go/book/', pageviews: 26, visitors: 19 },
    { name: 'F1 puzzles', requestPath: '/go/puzzles/', pageviews: 18, visitors: 14 },
    { name: 'YouTube channel', requestPath: '/go/youtube/', pageviews: 12, visitors: 10 }
  ];
  return {
    sample: true,
    generatedAt: new Date().toISOString(),
    range: { days, ...range },
    summary: {
      pageviews: sum(trend, 'pageviews'),
      visitors: sum(trend, 'visitors'),
      interactions: sum(actions, 'pageviews'),
      actionTypes: actions.filter((action) => action.pageviews > 0).length
    },
    trend,
    topPages: [{ requestPath: '/', pageviews: 248, visitors: 162 }, { requestPath: '/puzzles', pageviews: 91, visitors: 55 }, { requestPath: '/preview', pageviews: 64, visitors: 39 }, { requestPath: '/game', pageviews: 47, visitors: 31 }],
    referrers: [{ referrerHostname: 'google.com', pageviews: 104, visitors: 78 }, { referrerHostname: 'youtube.com', pageviews: 48, visitors: 34 }, { referrerHostname: 'Direct', pageviews: 42, visitors: 30 }],
    devices: [{ deviceType: 'desktop', pageviews: 226, visitors: 148 }, { deviceType: 'mobile', pageviews: 171, visitors: 107 }, { deviceType: 'tablet', pageviews: 53, visitors: 32 }],
    browsers: [{ browserName: 'Chrome', pageviews: 252, visitors: 166 }, { browserName: 'Safari', pageviews: 132, visitors: 83 }, { browserName: 'Edge', pageviews: 43, visitors: 25 }],
    actions,
    waitingForVisitorData: false
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = process.env.ANALYTICS_DASHBOARD_PASSWORD;
  if (!password || !secureEqual(cookieValue(req, COOKIE_NAME), sessionToken(password))) {
    return res.status(401).json({ error: 'Analytics authentication required.' });
  }

  const requestedRange = Number(req.query?.days);
  const days = ALLOWED_RANGES.has(requestedRange) ? requestedRange : 30;
  const range = dateRange(days);
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_ANALYTICS_PROJECT_ID;
  const teamId = process.env.VERCEL_ANALYTICS_TEAM_ID;

  if ((!token || !projectId) && isLocalRequest(req)) return res.status(200).json(samplePayload(days, range));
  if (!token || !projectId) {
    return res.status(503).json({ error: 'Vercel Analytics API access is not configured.' });
  }

  async function query(groupBy, options = {}) {
    const parameters = new URLSearchParams({ projectId, since: range.since, until: range.until });
    if (teamId) parameters.set('teamId', teamId);
    if (options.limit) {
      const limit = Math.min(MAX_AGGREGATE_LIMIT, Math.max(1, Number(options.limit) || 1));
      parameters.set('limit', String(limit));
    }
    if (options.filter) parameters.set('filter', options.filter);
    for (const dimension of Array.isArray(groupBy) ? groupBy : [groupBy]) {
      if (dimension) parameters.append('by', dimension);
    }
    const response = await fetch(`${VERCEL_ANALYTICS_URL}/visits/aggregate?${parameters}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `Vercel Analytics returned ${response.status}`);
    return Array.isArray(payload.data) ? payload.data : [];
  }

  try {
    const actionQueries = TRACKED_ACTIONS.map((action) => query('day', {
      filter: `requestPath eq ${odataString(action.requestPath)}`,
      limit: days
    }));
    const [trend, topPages, referrers, devices, browsers, ...actionSeries] = await Promise.all([
      query('day', { limit: days }),
      query('requestPath', { limit: 12 }),
      query('referrerHostname', { limit: 10 }),
      query('deviceType', { limit: 8 }),
      query('browserName', { limit: 10 }),
      ...actionQueries
    ]);
    const actions = TRACKED_ACTIONS.map((action, index) => ({
      ...action,
      pageviews: sum(actionSeries[index], 'pageviews'),
      visitors: sum(actionSeries[index], 'visitors')
    }));
    const pageviews = sum(trend, 'pageviews');
    const detailsAvailable = [topPages, referrers, devices, browsers].some((rows) => rows.length > 0);

    return res.status(200).json({
      sample: false,
      generatedAt: new Date().toISOString(),
      range: { days, ...range },
      summary: {
        pageviews,
        visitors: sum(trend, 'visitors'),
        interactions: sum(actions, 'pageviews'),
        actionTypes: actions.filter((action) => action.pageviews > 0).length
      },
      trend,
      topPages,
      referrers,
      devices,
      browsers,
      actions,
      waitingForVisitorData: pageviews === 0 || !detailsAvailable
    });
  } catch (error) {
    console.error('Analytics dashboard query failed:', error.message);
    return res.status(502).json({ error: 'Vercel Analytics could not be loaded right now. Please try again.' });
  }
};

module.exports.dateRange = dateRange;
module.exports.secureEqual = secureEqual;
module.exports.sessionToken = sessionToken;
module.exports.TRACKED_ACTIONS = TRACKED_ACTIONS;
module.exports.MAX_AGGREGATE_LIMIT = MAX_AGGREGATE_LIMIT;
