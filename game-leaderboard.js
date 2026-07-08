const LEADERBOARD_ENDPOINT = '/api/launch-game-leaderboard';

const params = new URLSearchParams(window.location.search);
const bucket = params.get('bucket') === 'test' ? 'test' : 'main';

const elements = {
eyebrow: document.getElementById('leaderboard-eyebrow'),
title: document.getElementById('leaderboard-title'),
note: document.getElementById('leaderboard-note'),
listTitle: document.getElementById('leaderboard-list-title'),
status: document.getElementById('leaderboard-status'),
list: document.getElementById('leaderboard-list')
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
if (bucket === 'test') {
elements.eyebrow.textContent = 'Testing standings';
elements.title.textContent = 'Test Leaderboard';
elements.note.textContent = 'Test usernames are shown here so trial runs stay separate from the launch-week leaderboard.';
elements.listTitle.textContent = 'Test Runs';
return;
}

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
elements.status.textContent = bucket === 'test'
? 'No test runs have been recorded yet.'
: 'No leaderboard runs have been recorded yet.';
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
