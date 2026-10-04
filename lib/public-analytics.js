// Only published, fixed routes may appear in anonymous analytics. Never infer
// safety from a path's shape: chart IDs and unknown historical routes stay private.
const PUBLIC_PATHS = new Set([
  "/",
  "/game",
  "/game-leaderboard",
  "/go/book",
  "/go/puzzles",
  "/go/youtube",
  "/llms-full.txt",
  "/llms.txt",
  "/preview",
  "/privacy",
  "/puzzles",
  "/terms"
]);
const DEVICES = new Set(['desktop', 'mobile', 'tablet']);
const BROWSERS = new Set(['Chrome', 'Safari', 'Firefox', 'Edge', 'Opera', 'Samsung Internet', 'Mobile Safari', 'Chrome Mobile', 'IE', 'Other', 'Unknown']);
const EVENTS = new Set(['App Download', 'Project Action']);

function count(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function publicPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[%?#\\\s]/.test(value)) return null;
  const path = value.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/\/+$/, '') || '/';
  return PUBLIC_PATHS.has(path) ? path : null;
}

function visits(rows, dimension) {
  const groups = new Map();
  for (const row of rows || []) {
    let label = row[dimension];
    if (dimension === 'requestPath') {
      label = publicPath(label);
      if (label === null) continue;
    } else if (dimension === 'referrerHostname') {
      // Publish hostname only; reject URLs, IPs, local hosts and other identifiers.
      if (label !== 'Direct' && !(typeof label === 'string' && label.length <= 253 &&
          /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(label) &&
          !/\.(?:local|internal|localhost|test|invalid)$/i.test(label))) label = 'Other';
    } else if (dimension === 'deviceType') {
      if (!DEVICES.has(label)) label = 'Other';
    } else if (dimension === 'browserName') {
      if (!BROWSERS.has(label)) label = 'Other';
    } else {
      throw new Error('Unsupported analytics dimension');
    }
    const safe = groups.get(label) || { [dimension]: label, pageviews: 0, visitors: 0 };
    safe.pageviews += count(row.pageviews);
    safe.visitors += count(row.visitors);
    groups.set(label, safe);
  }
  return [...groups.values()].sort((a, b) => b.pageviews - a.pageviews);
}

function trend(rows) {
  return (rows || []).filter(row => typeof row.timestamp === 'string' &&
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(row.timestamp) &&
    Number.isFinite(Date.parse(row.timestamp))).map(row => ({
      timestamp: new Date(row.timestamp).toISOString(),
      pageviews: count(row.pageviews), visitors: count(row.visitors)
    }));
}

function events(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const name = EVENTS.has(row.eventName) ? row.eventName : 'Other events';
    const safe = groups.get(name) || { eventName: name, count: 0, visitors: 0 };
    safe.count += count(row.count);
    safe.visitors += count(row.visitors);
    groups.set(name, safe);
  }
  return [...groups.values()];
}

module.exports = { count, publicPath, visits, trend, events };
