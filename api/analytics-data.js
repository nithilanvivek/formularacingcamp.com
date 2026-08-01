const crypto = require('node:crypto');
const counters = require('../lib/analytics-counters');

const VERCEL_ANALYTICS_URL = 'https://api.vercel.com/v1/query/web-analytics';
const COOKIE_NAME = 'frc_analytics_access';
const ALLOWED_RANGES = new Set([7, 30, 90]);
const MAX_AGGREGATE_LIMIT = 100;
const MAX_DAILY_QUERY_DAYS = 62;
const HOBBY_REPORTING_DAYS = 31;
const TRACKED_ACTIONS = counters.ACTION_DEFINITIONS;

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

function daysInRange(range) {
  const since = new Date(`${range.since}T00:00:00.000Z`);
  const until = new Date(`${range.until}T00:00:00.000Z`);
  return Math.round((until - since) / 86400000) + 1;
}

function splitRange(range, maximumDays) {
  const chunks = [];
  const finalDate = new Date(`${range.until}T00:00:00.000Z`);
  let startDate = new Date(`${range.since}T00:00:00.000Z`);

  while (startDate <= finalDate) {
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + maximumDays - 1);
    if (endDate > finalDate) endDate.setTime(finalDate.getTime());
    chunks.push({ since: isoDate(startDate), until: isoDate(endDate) });
    startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  }

  return chunks;
}

function sum(rows, field) {
  return rows.reduce((total, row) => total + Number(row[field] || 0), 0);
}

function isLocalRequest(req) {
  const hostname = String(req.headers.host || '').split(':')[0].replace(/^\[|\]$/g, '');
  return !process.env.VERCEL && ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function samplePayload(days, range) {
  const trend = Array.from({ length: days }, (_, index) => {
    const date = new Date(`${range.since}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + index);
    const wave = Math.round(9 + Math.sin(index / 2.4) * 5 + (index % 5));
    return { timestamp: date.toISOString(), pageviews: wave * 3, visitors: wave * 2 };
  });
  const sampleCounts = [8, 26, 7, 5, 3, 11, 18, 12];
  const actions = TRACKED_ACTIONS.map((action, index) => ({ ...action, count: sampleCounts[index] || 0 }));
  return {
    sample: true,
    generatedAt: new Date().toISOString(),
    range: { days, ...range },
    summary: {
      pageviews: sum(trend, 'pageviews'),
      visitors: sum(trend, 'visitors'),
      interactions: sum(actions, 'count'),
      actionTypes: actions.filter((action) => action.count > 0).length
    },
    trend,
    topPages: [{ requestPath: '/', pageviews: 248, visitors: 162 }, { requestPath: '/puzzles', pageviews: 91, visitors: 55 }, { requestPath: '/preview', pageviews: 64, visitors: 39 }, { requestPath: '/game', pageviews: 47, visitors: 31 }],
    referrers: [{ referrerHostname: 'google.com', pageviews: 104, visitors: 78 }, { referrerHostname: 'youtube.com', pageviews: 48, visitors: 34 }, { referrerHostname: 'Direct', pageviews: 42, visitors: 30 }],
    devices: [{ deviceType: 'desktop', pageviews: 226, visitors: 148 }, { deviceType: 'mobile', pageviews: 171, visitors: 107 }, { deviceType: 'tablet', pageviews: 53, visitors: 32 }],
    browsers: [{ browserName: 'Chrome', pageviews: 252, visitors: 166 }, { browserName: 'Safari', pageviews: 132, visitors: 83 }, { browserName: 'Edge', pageviews: 43, visitors: 25 }],
    actions,
    actionsAvailable: true,
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
    const queryRange = options.range || range;
    const parameters = new URLSearchParams({ projectId, since: queryRange.since, until: queryRange.until });
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

  async function dailyQuery(queryRange, options = {}) {
    const chunks = splitRange(queryRange, MAX_DAILY_QUERY_DAYS);
    const rows = await Promise.all(chunks.map((chunk) => query('day', {
      ...options,
      range: chunk,
      limit: daysInRange(chunk)
    })));
    return rows.flat().sort((left, right) => String(left.timestamp).localeCompare(String(right.timestamp)));
  }

  async function loadRange(queryRange) {
    const [trend, topPages, referrers, devices, browsers] = await Promise.all([
      dailyQuery(queryRange),
      query('requestPath', { limit: 12, range: queryRange }),
      query('referrerHostname', { limit: 10, range: queryRange }),
      query('deviceType', { limit: 8, range: queryRange }),
      query('browserName', { limit: 10, range: queryRange })
    ]);
    return { trend, topPages, referrers, devices, browsers };
  }

  try {
    let queryRange = range;
    let rangeData;
    try {
      rangeData = await loadRange(queryRange);
    } catch (error) {
      const hobbyLimit = /hobby plan only grants access to the latest 31 days/i.test(error.message);
      if (!hobbyLimit || days <= HOBBY_REPORTING_DAYS) throw error;
      queryRange = dateRange(HOBBY_REPORTING_DAYS);
      rangeData = await loadRange(queryRange);
    }
    const { trend, topPages, referrers, devices, browsers } = rangeData;
    let actionData;
    try {
      actionData = await counters.readActions(range);
    } catch (error) {
      console.error('Analytics counters could not be loaded:', error.message);
      actionData = { configured: false, actions: TRACKED_ACTIONS.map((action) => ({ ...action, count: 0 })) };
    }
    const actions = actionData.actions;
    const pageviews = sum(trend, 'pageviews');
    const detailsAvailable = [topPages, referrers, devices, browsers].some((rows) => rows.length > 0);

    return res.status(200).json({
      sample: false,
      generatedAt: new Date().toISOString(),
      range: {
        days,
        availableDays: daysInRange(queryRange),
        limited: daysInRange(queryRange) < days,
        ...queryRange
      },
      summary: {
        pageviews,
        visitors: sum(trend, 'visitors'),
        interactions: sum(actions, 'count'),
        actionTypes: actions.filter((action) => action.count > 0).length
      },
      trend,
      topPages,
      referrers,
      devices,
      browsers,
      actions,
      actionsAvailable: actionData.configured,
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
module.exports.MAX_DAILY_QUERY_DAYS = MAX_DAILY_QUERY_DAYS;
module.exports.HOBBY_REPORTING_DAYS = HOBBY_REPORTING_DAYS;
module.exports.daysInRange = daysInRange;
module.exports.splitRange = splitRange;
