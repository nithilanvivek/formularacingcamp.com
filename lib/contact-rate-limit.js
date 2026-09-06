const crypto = require('node:crypto');

const CONTACT_RATE_LIMIT = 5;
const CONTACT_RATE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CONTACT_RATE_KEY_PREFIX = 'frc:contact-rate:v1';

function redisConfig() {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').replace(/\/$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return { url, token, configured: Boolean(url && token) };
}

function digestIdentifier(type, value, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${type}:${String(value || '').trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 40);
}

function identityKeys({ ip, email, secret }) {
  const identities = [];
  if (ip) identities.push(['ip', ip]);
  if (email) identities.push(['email', email]);
  return identities.map(([type, value]) => `${CONTACT_RATE_KEY_PREFIX}:${type}:${digestIdentifier(type, value, secret)}`);
}

async function redisCommand(command) {
  const config = redisConfig();
  if (!config.configured) throw new Error('Contact rate-limit storage is not configured');

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(command)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error || `Rate-limit storage returned ${response.status}`);
  return payload.result;
}

async function reserveContactSubmission({ ip, email, secret, now = Date.now() }) {
  if (!secret) throw new Error('A rate-limit hashing secret is required');
  const keys = identityKeys({ ip, email, secret });
  if (!keys.length) throw new Error('A rate-limit identity is required');

  const member = `${now}:${crypto.randomUUID()}`;
  const script = [
    "#!lua flags=allow-key-locking",
    "local now = tonumber(ARGV[1])",
    "local window = tonumber(ARGV[2])",
    "local limit = tonumber(ARGV[3])",
    "local member = ARGV[4]",
    "local highest = 0",
    "local retry_at = 0",
    "for _, key in ipairs(KEYS) do",
    "  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - window)",
    "  local count = redis.call('ZCARD', key)",
    "  if count > highest then highest = count end",
    "  if count >= limit then",
    "    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')",
    "    local reset = tonumber(oldest[2]) + window",
    "    if reset > retry_at then retry_at = reset end",
    "  end",
    "end",
    "if retry_at > 0 then return {0, 0, retry_at} end",
    "for _, key in ipairs(KEYS) do",
    "  redis.call('ZADD', key, now, member)",
    "  redis.call('PEXPIRE', key, window)",
    "end",
    "return {1, limit - highest - 1, now + window}"
  ].join('\n');

  const result = await redisCommand([
    'EVAL',
    script,
    keys.length,
    ...keys,
    now,
    CONTACT_RATE_WINDOW_MS,
    CONTACT_RATE_LIMIT,
    member
  ]);
  const allowed = Number(result?.[0]) === 1;

  return {
    allowed,
    limit: CONTACT_RATE_LIMIT,
    remaining: allowed ? Math.max(0, Number(result?.[1]) || 0) : 0,
    resetAt: Math.max(now, Number(result?.[2]) || now),
    reservation: allowed ? { keys, member } : null
  };
}

async function releaseContactSubmission(reservation) {
  if (!reservation?.keys?.length || !reservation.member) return;
  const script = [
    "#!lua flags=allow-key-locking",
    "for _, key in ipairs(KEYS) do redis.call('ZREM', key, ARGV[1]) end",
    "return 1"
  ].join('\n');
  await redisCommand(['EVAL', script, reservation.keys.length, ...reservation.keys, reservation.member]);
}

module.exports = {
  CONTACT_RATE_LIMIT,
  CONTACT_RATE_WINDOW_MS,
  digestIdentifier,
  identityKeys,
  redisConfig,
  releaseContactSubmission,
  reserveContactSubmission
};
