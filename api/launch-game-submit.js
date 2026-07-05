const MAX_SCORE = 4000;
const DRY_RUN_USERNAME = 'test_nalihtin';
const TEST_LEADERBOARD_USERNAMES = new Set([
'test_nihira',
'test_nithilan',
'test_jaskirat',
'test_tejas',
'test_nandana',
'test_shaurya'
]);

function setCors(res) {
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isValidEmail(email) {
return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizedUsername(payload) {
return String(payload?.username || '').trim().toLowerCase();
}

function reviewStatus(payload) {
const flags = [];

if (!payload || typeof payload !== 'object') {
return { status: 'invalid', flags: ['missing_payload'] };
}

if (!payload.sessionId) flags.push('missing_session');
if (!payload.playerName || String(payload.playerName).trim().length < 2) flags.push('missing_player_name');
if (!isValidEmail(payload.email)) flags.push('invalid_email');
if (!Number.isFinite(payload.score) || payload.score < 0 || payload.score > MAX_SCORE) flags.push('invalid_score');
if (!payload.levels || !payload.levels.reaction || !payload.levels.dash || !payload.levels.strategy) flags.push('incomplete_levels');

const antiCheat = payload.antiCheat || {};
if (antiCheat.tabHiddenCount > 0) flags.push('tab_changed');
if (payload.locked === true) flags.push('attempt_locked');
if (payload.lockReason) flags.push(`lock_${payload.lockReason}`);
if (antiCheat.tabHiddenCount >= 3) flags.push('multiple_tab_switches');
if (antiCheat.hiddenMs > 20000) flags.push('long_hidden_time');
if (antiCheat.blurCount > 0) flags.push('focus_lost');
if (antiCheat.blurCount > 5) flags.push('many_window_blurs');

if (flags.some((flag) => ['missing_payload', 'invalid_email', 'invalid_score', 'incomplete_levels', 'tab_changed', 'attempt_locked', 'focus_lost'].includes(flag))) {
return { status: 'invalid', flags };
}

if (flags.length > 0) {
return { status: 'review', flags };
}

return { status: 'clean', flags };
}

module.exports = async function handler(req, res) {
setCors(res);

if (req.method === 'OPTIONS') {
res.status(204).end();
return;
};

if (req.method !== 'POST') {
res.status(405).json({ ok: false, error: 'method_not_allowed' });
return;
}

const payload = req.body || {};
const review = reviewStatus(payload);
const username = normalizedUsername(payload);
const isDryRun = payload.testMode === true || username === DRY_RUN_USERNAME;
const isTestLeaderboard = payload.testLeaderboard === true || TEST_LEADERBOARD_USERNAMES.has(username);

if (isDryRun) {
res.status(200).json({
ok: true,
dryRun: true,
entryId: payload.sessionId,
reviewStatus: 'test',
flags: ['test_mode_not_saved']
});
return;
}

const entry = {
...payload,
testLeaderboard: isTestLeaderboard,
entryBucket: isTestLeaderboard ? 'test_leaderboard' : 'production',
serverReceivedAt: new Date().toISOString(),
serverReviewStatus: review.status,
serverReviewFlags: review.flags
};
const webhookUrl = isTestLeaderboard
? process.env.LAUNCH_GAME_TEST_WEBHOOK_URL
: process.env.LAUNCH_GAME_WEBHOOK_URL;

if (webhookUrl) {
try {
const response = await fetch(webhookUrl, {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify(entry)
});

if (!response.ok) {
throw new Error(`Webhook failed with ${response.status}`);
}
} catch (error) {
res.status(502).json({ ok: false, error: 'submission_webhook_failed' });
return;
}
} else {
console.log('Launch game entry received without webhook configured', entry);
}

res.status(review.status === 'invalid' ? 400 : 200).json({
ok: review.status !== 'invalid',
entryId: payload.sessionId,
entryBucket: entry.entryBucket,
reviewStatus: review.status,
flags: review.flags
});
}
