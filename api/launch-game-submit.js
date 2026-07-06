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
const DEFAULT_EMAIL_FROM = 'Formula Racing Camp <game@formularacingcamp.com>';
const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

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

function escapeHtml(value) {
return String(value ?? '')
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#39;');
}

function formatScore(value) {
return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function adminRecipients() {
return String(process.env.LAUNCH_GAME_ADMIN_EMAIL || '')
.split(',')
.map((email) => email.trim())
.filter(isValidEmail);
}

function emailReviewLabel(entry) {
if (entry.testLeaderboard) {
return 'Test leaderboard entry';
}

if (entry.serverReviewStatus === 'review') {
return 'Needs review';
}

return entry.serverReviewStatus === 'clean' ? 'Clean' : 'Invalid';
}

function receiptSubject(entry) {
const prefix = entry.testLeaderboard ? '[Test Leaderboard] ' : '';
return `${prefix}Formula Racing Camp Launch Grand Prix entry received`;
}

function receiptText(entry) {
const scores = entry.scores || {};
return [
`Hi ${entry.playerName || entry.username || 'driver'},`,
'',
'Your Formula Racing Camp Launch Grand Prix run has been received.',
'',
`Username: ${entry.username || 'Not provided'}`,
`Total score: ${formatScore(entry.score)}`,
`Level 1 - Start Lights: ${formatScore(scores.reaction)}`,
`Level 2 - Pit Lane Dash: ${formatScore(scores.dash)}`,
`Level 3 - Strategy Calls: ${formatScore(scores.strategy)}`,
`Review status: ${emailReviewLabel(entry)}`,
'',
'Leaderboard places and Amazon promo codes are sent after launch-week review.',
'Amazon promo codes are one-time use. If someone else uses your code first, it cannot be replaced.',
'',
'Formula Racing Camp'
].join('\n');
}

function receiptHtml(entry) {
const scores = entry.scores || {};
return `
<div style="font-family: Arial, Helvetica, sans-serif; color: #10131a; line-height: 1.5;">
  <h1 style="margin: 0 0 12px;">Launch Grand Prix entry received</h1>
  <p>Hi ${escapeHtml(entry.playerName || entry.username || 'driver')},</p>
  <p>Your Formula Racing Camp Launch Grand Prix run has been received.</p>
  <table style="border-collapse: collapse; margin: 18px 0; min-width: 280px;">
    <tr><td style="padding: 6px 12px; border: 1px solid #d1d5db;"><strong>Username</strong></td><td style="padding: 6px 12px; border: 1px solid #d1d5db;">${escapeHtml(entry.username || 'Not provided')}</td></tr>
    <tr><td style="padding: 6px 12px; border: 1px solid #d1d5db;"><strong>Total score</strong></td><td style="padding: 6px 12px; border: 1px solid #d1d5db;">${formatScore(entry.score)}</td></tr>
    <tr><td style="padding: 6px 12px; border: 1px solid #d1d5db;"><strong>Level 1 - Start Lights</strong></td><td style="padding: 6px 12px; border: 1px solid #d1d5db;">${formatScore(scores.reaction)}</td></tr>
    <tr><td style="padding: 6px 12px; border: 1px solid #d1d5db;"><strong>Level 2 - Pit Lane Dash</strong></td><td style="padding: 6px 12px; border: 1px solid #d1d5db;">${formatScore(scores.dash)}</td></tr>
    <tr><td style="padding: 6px 12px; border: 1px solid #d1d5db;"><strong>Level 3 - Strategy Calls</strong></td><td style="padding: 6px 12px; border: 1px solid #d1d5db;">${formatScore(scores.strategy)}</td></tr>
    <tr><td style="padding: 6px 12px; border: 1px solid #d1d5db;"><strong>Review status</strong></td><td style="padding: 6px 12px; border: 1px solid #d1d5db;">${escapeHtml(emailReviewLabel(entry))}</td></tr>
  </table>
  <p>Leaderboard places and Amazon promo codes are sent after launch-week review.</p>
  <p><strong>Amazon promo codes are one-time use.</strong> If someone else uses your code first, it cannot be replaced.</p>
  <p>Formula Racing Camp</p>
</div>`.trim();
}

async function sendPlayerReceipt(entry, review) {
if (review.status === 'invalid') {
return 'skipped_invalid';
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
return 'not_configured';
}

const recipients = adminRecipients();
const body = {
from: process.env.LAUNCH_GAME_EMAIL_FROM || DEFAULT_EMAIL_FROM,
to: [entry.email],
subject: receiptSubject(entry),
html: receiptHtml(entry),
text: receiptText(entry)
};

if (recipients.length > 0) {
body.bcc = recipients;
}

const response = await fetch(RESEND_EMAIL_ENDPOINT, {
method: 'POST',
headers: {
Authorization: `Bearer ${apiKey}`,
'Content-Type': 'application/json',
'Idempotency-Key': `launch-game-${entry.sessionId || Date.now()}`
},
body: JSON.stringify(body)
});

if (!response.ok) {
throw new Error(`Resend failed with ${response.status}`);
}

return 'sent';
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

let emailStatus = 'skipped_invalid';
if (review.status !== 'invalid') {
try {
emailStatus = await sendPlayerReceipt(entry, review);
} catch (error) {
console.error('Launch game receipt email failed', error);
emailStatus = 'failed';
}
}

res.status(review.status === 'invalid' ? 400 : 200).json({
ok: review.status !== 'invalid',
entryId: payload.sessionId,
entryBucket: entry.entryBucket,
reviewStatus: review.status,
flags: review.flags,
emailStatus
});
}
