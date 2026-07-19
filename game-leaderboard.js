const LEADERBOARD_ENDPOINT = '/api/launch-game-leaderboard';
const LEADERBOARD_BUCKET_KEY = 'frcLaunchLeaderboardBucket';

const bucket = 'main';

const elements = {
eyebrow: document.getElementById('leaderboard-eyebrow'),
title: document.getElementById('leaderboard-title'),
note: document.getElementById('leaderboard-note'),
listTitle: document.getElementById('leaderboard-list-title'),
status: document.getElementById('leaderboard-status'),
list: document.getElementById('leaderboard-list'),
mainLink: document.getElementById('main-leaderboard-link')
};

function formatScore(value) {
return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function formatDate(value) {
if (!value) {
return 'Submission time pending';
}

const date = new Date(value);
if (Number.isNaN(date.getTime())) {
return 'Submission time pending';
}

return date.toLocaleString(undefined, {
month: 'short',
day: 'numeric',
hour: 'numeric',
minute: '2-digit'
});
}

function setPageCopy() {
try {
sessionStorage.setItem(LEADERBOARD_BUCKET_KEY, bucket);
} catch (error) {
}

elements.mainLink.classList.toggle('active', bucket === 'main');

elements.eyebrow.textContent = 'Launch-week standings';
elements.title.textContent = 'Launch Grand Prix Leaderboard';
elements.note.textContent = 'Scores are shown after successful submission and may still be reviewed before prizes are emailed.';
elements.listTitle.textContent = 'Top Runs';
}

function addText(parent, tagName, className, text) {
const element = document.createElement(tagName);
if (className) {
element.className = className;
}
element.textContent = text;
parent.appendChild(element);
return element;
}

function renderEntries(entries) {
elements.list.textContent = '';

if (!entries.length) {
elements.status.textContent = 'No leaderboard runs have been recorded yet.';
return;
}

elements.status.textContent = `${entries.length} ${entries.length === 1 ? 'run' : 'runs'} shown.`;

entries.forEach((entry, index) => {
const item = document.createElement('li');
item.className = 'leaderboard-entry';

addText(item, 'span', 'leaderboard-rank', `#${index + 1}`);

const driver = document.createElement('div');
driver.className = 'leaderboard-driver';
addText(driver, 'strong', '', entry.username || 'anonymous_driver');
addText(driver, 'span', '', formatDate(entry.submittedAt));
item.appendChild(driver);

const score = document.createElement('div');
score.className = 'leaderboard-score';
addText(score, 'strong', '', String(formatScore(entry.score)));
addText(score, 'span', '', `L1 ${formatScore(entry.scores?.reaction)} / L2 ${formatScore(entry.scores?.dash)} / L3 ${formatScore(entry.scores?.strategy)}`);
item.appendChild(score);

elements.list.appendChild(item);
});
}

async function loadLeaderboard() {
setPageCopy();

try {
const response = await fetch(`${LEADERBOARD_ENDPOINT}?bucket=${encodeURIComponent(bucket)}`, {
headers: {
Accept: 'application/json'
}
});

if (!response.ok) {
throw new Error('Leaderboard unavailable');
}

const result = await response.json();
renderEntries(Array.isArray(result.entries) ? result.entries : []);
} catch (error) {
elements.status.textContent = 'Leaderboard could not load. Please try again in a moment.';
}
}

loadLeaderboard();
