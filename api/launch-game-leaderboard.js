const DEFAULT_LEADERBOARD_PATH = 'data/launch-game-leaderboard.json';
const DEFAULT_GITHUB_BRANCH = 'main';

function setCors(res) {
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
res.setHeader('Cache-Control', 'no-store');
}

function githubConfig() {
return {
token: process.env.LAUNCH_GAME_GITHUB_TOKEN || process.env.GITHUB_TOKEN,
owner: process.env.GITHUB_OWNER || 'nithilanvivek',
repo: process.env.GITHUB_REPO || 'formularacingcamp.com',
branch: process.env.GITHUB_BRANCH || DEFAULT_GITHUB_BRANCH,
path: process.env.LAUNCH_GAME_LEADERBOARD_PATH || DEFAULT_LEADERBOARD_PATH
};
}

function githubHeaders(token) {
return {
Authorization: `Bearer ${token}`,
Accept: 'application/vnd.github+json',
'Content-Type': 'application/json',
'User-Agent': 'formularacingcamp-launch-game',
'X-GitHub-Api-Version': '2022-11-28'
};
}

function publicEntry(entry) {
return {
username: entry.username || 'anonymous_driver',
score: Number.isFinite(entry.score) ? Math.max(0, Math.round(entry.score)) : 0,
scores: {
reaction: Number.isFinite(entry.scores?.reaction) ? Math.max(0, Math.round(entry.scores.reaction)) : 0,
dash: Number.isFinite(entry.scores?.dash) ? Math.max(0, Math.round(entry.scores.dash)) : 0,
strategy: Number.isFinite(entry.scores?.strategy) ? Math.max(0, Math.round(entry.scores.strategy)) : 0
},
reviewStatus: entry.reviewStatus || 'review',
entryBucket: entry.entryBucket === 'test_leaderboard' ? 'test_leaderboard' : 'production',
testLeaderboard: entry.testLeaderboard === true,
submittedAt: entry.submittedAt || null
};
}

function podiumPrize(place) {
if (place === 1) return 'Free book; winner will be asked for a delivery address';
if (place === 2) return '50% off paperback and 59% off hardcover; both may be purchased';
if (place === 3) return '40% off paperback and 49% off hardcover; both may be purchased';
return null;
}

async function readLeaderboard() {
const config = githubConfig();
if (!config.token) {
return { entries: [] };
}

const fileUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodeURIComponent(config.path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(config.branch)}`;
const response = await fetch(fileUrl, {
method: 'GET',
headers: githubHeaders(config.token)
});

if (response.status === 404) {
return { entries: [] };
}

if (!response.ok) {
throw new Error(`GitHub read failed with ${response.status}`);
}

const file = await response.json();
const document = JSON.parse(Buffer.from(file.content || '', 'base64').toString('utf8'));
if (!Array.isArray(document.entries)) {
document.entries = [];
}

return document;
}

module.exports = async function handler(req, res) {
setCors(res);

if (req.method === 'OPTIONS') {
res.status(204).end();
return;
}

if (req.method !== 'GET') {
res.status(405).json({ ok: false, error: 'method_not_allowed' });
return;
}

if (req.query?.bucket === 'test') {
res.status(404).json({ ok: false, error: 'leaderboard_not_public' });
return;
}

const bucket = 'production';

try {
const document = await readLeaderboard();
const sortedEntries = document.entries
.map(publicEntry)
.filter((entry) => entry.entryBucket === bucket)
.sort((a, b) => {
if (b.score !== a.score) return b.score - a.score;
return String(a.submittedAt || '').localeCompare(String(b.submittedAt || ''));
});
const entries = sortedEntries
.slice(0, 25)
.map((entry, index) => ({
...entry,
place: index < 3 ? index + 1 : null,
prize: podiumPrize(index + 1),
freeBookWinner: index === 0
}));

res.status(200).json({
ok: true,
bucket,
entries,
placementRule: 'score_desc_then_earliest_submission',
updatedAt: document.updatedAt || null
});
} catch (error) {
console.error('Launch game leaderboard read failed', error);
res.status(502).json({ ok: false, error: 'leaderboard_unavailable' });
}
};
