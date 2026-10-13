const crypto = require('node:crypto');

const COUNTER_HASH_KEY = 'frc:analytics:v1:daily';
const SUBMISSION_DEDUPE_SECONDS = 60 * 60 * 24 * 180;
const SHORT_LINK_FIELDS = {
  amazon: 'short_link:amazon',
  kindle: 'short_link:kindle',
  flipkart: 'short_link:flipkart',
  np: 'short_link:np',
  youtube: 'short_link:youtube'
};
const ACTION_DEFINITIONS = [
  { key: 'discount_game_submitted', field: 'discount_game:submitted', name: 'Discount game entries', metricLabel: 'submissions', detail: 'Accepted production entries' },
  { key: 'purchase_opened', field: 'purchase:opened', name: 'Buy options opened', metricLabel: 'opens', detail: 'Buy the Book control opened' },
  { key: 'redirect_amazon', field: SHORT_LINK_FIELDS.amazon, name: 'Amazon print', metricLabel: 'redirects', detail: '/amazon' },
  { key: 'redirect_kindle', field: SHORT_LINK_FIELDS.kindle, name: 'Amazon Kindle', metricLabel: 'redirects', detail: '/kindle' },
  { key: 'redirect_flipkart', field: SHORT_LINK_FIELDS.flipkart, name: 'Flipkart', metricLabel: 'redirects', detail: '/flipkart' },
  { key: 'redirect_np', field: SHORT_LINK_FIELDS.np, name: 'Notion Press', metricLabel: 'redirects', detail: '/np' },
  { key: 'puzzles_opened', field: 'puzzles:opened', name: 'F1 puzzles', metricLabel: 'opens', detail: 'Puzzle collection opened' },
  { key: 'redirect_youtube', field: SHORT_LINK_FIELDS.youtube, name: 'YouTube channel', metricLabel: 'redirects', detail: '/youtube' }
];

function redisConfig() {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token, configured: Boolean(url && token) };
}

function isoDate(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function datesBetween(since, until) {
  const dates = [];
  const finalDate = new Date(`${until}T00:00:00.000Z`);
  const currentDate = new Date(`${since}T00:00:00.000Z`);
  while (currentDate <= finalDate) {
    dates.push(isoDate(currentDate));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }
  return dates;
}

function counterField(date, field) {
  return `${date}:${field}`;
}

async function redisCommand(command, options = {}) {
  const config = redisConfig();
  if (!config.configured) throw new Error('Upstash Redis is not configured');
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(command),
    signal: options.signal
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || `Upstash Redis returned ${response.status}`);
  return payload.result;
}

function fieldForAction(action, properties = {}) {
  if (action === 'purchase_opened') return 'purchase:opened';
  if (action === 'short_link_opened') return SHORT_LINK_FIELDS[properties.link] || null;
  if (action === 'puzzles_opened') return 'puzzles:opened';
  return null;
}

async function incrementAction(action, properties = {}, now = new Date(), options = {}) {
  const field = fieldForAction(action, properties);
  if (!field) throw new Error('Unknown analytics action');
  return Number(await redisCommand(['HINCRBY', COUNTER_HASH_KEY, counterField(isoDate(now), field), 1], options));
}

async function incrementSubmission(sessionId, now = new Date()) {
  if (!sessionId) throw new Error('A submission session ID is required');
  const digest = crypto.createHash('sha256').update(String(sessionId)).digest('hex').slice(0, 32);
  const seenKey = `frc:analytics:v1:submission:${digest}`;
  const dailyField = counterField(isoDate(now), 'discount_game:submitted');
  const script = [
    "if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end",
    "redis.call('SET', KEYS[2], '1', 'EX', ARGV[1])",
    "redis.call('HINCRBY', KEYS[1], ARGV[2], 1)",
    'return 1'
  ].join('\n');
  return Number(await redisCommand(['EVAL', script, 2, COUNTER_HASH_KEY, seenKey, SUBMISSION_DEDUPE_SECONDS, dailyField])) === 1;
}

async function readActions(range) {
  const config = redisConfig();
  const emptyActions = ACTION_DEFINITIONS.map((action) => ({ ...action, count: 0 }));
  if (!config.configured) return { configured: false, actions: emptyActions };

  const dates = datesBetween(range.since, range.until);
  const fields = dates.flatMap((date) => ACTION_DEFINITIONS.map((action) => counterField(date, action.field)));
  const values = fields.length ? await redisCommand(['HMGET', COUNTER_HASH_KEY, ...fields]) : [];
  const counts = new Map(ACTION_DEFINITIONS.map((action) => [action.field, 0]));

  dates.forEach((date, dateIndex) => {
    ACTION_DEFINITIONS.forEach((action, actionIndex) => {
      const valueIndex = dateIndex * ACTION_DEFINITIONS.length + actionIndex;
      counts.set(action.field, counts.get(action.field) + Number(values?.[valueIndex] || 0));
    });
  });

  return {
    configured: true,
    actions: ACTION_DEFINITIONS.map((action) => ({ ...action, count: counts.get(action.field) || 0 }))
  };
}

module.exports = {
  ACTION_DEFINITIONS,
  COUNTER_HASH_KEY,
  SHORT_LINK_FIELDS,
  datesBetween,
  fieldForAction,
  incrementAction,
  incrementSubmission,
  readActions,
  redisConfig
};
