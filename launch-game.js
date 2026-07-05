const GAME_ENDPOINT = '/api/launch-game-submit';
const LOCAL_PREVIEW_KEY = 'frcLaunchGamePreviewEntries';
const ATTEMPT_KEY = 'frcLaunchGrandPrixAttemptUsed';
const STRATEGY_CODE = '5284';

const state = {
sessionId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
startedAt: null,
completedAt: null,
activeLevel: 1,
scores: {
reaction: 0,
dash: 0,
strategy: 0
},
levels: {
reaction: false,
dash: false,
strategy: false
},
antiCheat: {
tabHiddenCount: 0,
blurCount: 0,
hiddenMs: 0,
lastHiddenAt: null
},
  events: [],
  player: {
    username: null,
    testMode: false
  },
  dash: {
running: false,
paused: false,
score: 0,
penalty: 0,
remainingMs: 25000,
lastFrameAt: 0,
spawnMs: 0,
carLane: 1,
targetLane: 1,
items: [],
animationId: null,
keys: new Set()
},
strategySelections: {},
submitted: false,
locked: false,
lockReason: ''
};

const elements = {
startGameBtn: document.getElementById('start-game-btn'),
usernameInput: document.getElementById('username-input'),
usernameModeNote: document.getElementById('username-mode-note'),
totalScore: document.getElementById('total-score'),
levelsComplete: document.getElementById('levels-complete'),
runStatus: document.getElementById('run-status'),
reviewFlags: document.getElementById('review-flags'),
levelTabs: Array.from(document.querySelectorAll('[data-level-tab]')),
lights: Array.from(document.querySelectorAll('#lights-grid span')),
reactionArmBtn: document.getElementById('reaction-arm-btn'),
reactionLaunchBtn: document.getElementById('reaction-launch-btn'),
reactionMessage: document.getElementById('reaction-message'),
dashCanvas: document.getElementById('pit-lane-canvas'),
dashStartBtn: document.getElementById('dash-start-btn'),
dashMessage: document.getElementById('dash-message'),
pauseOverlay: document.getElementById('pause-overlay'),
steerButtons: Array.from(document.querySelectorAll('.steer-btn')),
strategyGrid: document.getElementById('strategy-grid'),
strategyCode: document.getElementById('strategy-code'),
codeSubmitBtn: document.getElementById('code-submit-btn'),
strategyMessage: document.getElementById('strategy-message'),
entryPanel: document.getElementById('entry-panel'),
entryForm: document.getElementById('entry-form'),
entrySubmitBtn: document.getElementById('entry-submit-btn'),
entryMessage: document.getElementById('entry-message')
};

const ctx = elements.dashCanvas.getContext('2d');

const strategyChallenges = [
{
id: 'tyres',
title: 'Rain clouds are arriving',
prompt: 'You are on slicks and the track is getting wet. What is the smartest call?',
digit: '5',
correct: 'Switch to intermediates',
choices: ['Stay on slicks', 'Switch to intermediates', 'Use hard tyres']
},
{
id: 'energy',
title: 'Final straight attack',
prompt: 'You need extra speed for one overtake. What should the driver save and deploy?',
digit: '2',
correct: 'Battery energy',
choices: ['Battery energy', 'Extra fuel', 'Brake dust']
},
{
id: 'pit',
title: 'Slow stop recovery',
prompt: 'A slow pit stop costs time. What is the best next move?',
digit: '8',
correct: 'Clean laps with no mistakes',
choices: ['Panic and pit again', 'Clean laps with no mistakes', 'Ignore blue flags']
},
{
id: 'drag',
title: 'Chasing on a straight',
prompt: 'The car ahead punches a hole in the air. Which move helps you gain speed?',
digit: '4',
correct: 'Use the slipstream',
choices: ['Use the slipstream', 'Open the parachute', 'Drive off line']
}
];

let reactionReadyAt = 0;
let reactionTimer = null;
let reactionLightInterval = null;
let reactionArmed = false;
let reactionFinished = false;

function recordEvent(type, details = {}) {
state.events.push({
type,
at: Date.now(),
details
});
}

function totalScore() {
return state.scores.reaction + state.scores.dash + state.scores.strategy;
}

function completedCount() {
return Object.values(state.levels).filter(Boolean).length;
}

function getReviewStatus() {
if (state.locked) {
return 'Invalid';
}

if (state.antiCheat.tabHiddenCount >= 3 || state.antiCheat.hiddenMs > 20000) {
return 'Review';
}

if (state.antiCheat.tabHiddenCount > 0 || state.antiCheat.blurCount > 2) {
return 'Warning';
}

return 'Clean';
}

function updateScoreboard() {
elements.totalScore.textContent = String(totalScore());
elements.levelsComplete.textContent = `${completedCount()}/3`;
elements.reviewFlags.textContent = getReviewStatus();

if (state.submitted) {
elements.runStatus.textContent = 'Submitted';
} else if (state.locked) {
elements.runStatus.textContent = 'Attempt ended';
} else if (completedCount() === 3) {
elements.runStatus.textContent = 'Ready to submit';
} else if (state.startedAt) {
elements.runStatus.textContent = `Level ${state.activeLevel}`;
} else {
elements.runStatus.textContent = 'Ready';
}

elements.levelTabs.forEach((tab) => {
const level = Number(tab.dataset.levelTab);
tab.classList.toggle('active', level === state.activeLevel);
if (level === 2) {
tab.disabled = !state.levels.reaction;
}
if (level === 3) {
tab.disabled = !state.levels.dash;
}
if (state.locked) {
tab.disabled = true;
}
});

if (completedCount() === 3) {
elements.entryPanel.hidden = false;
elements.entryPanel.classList.add('active');
}
}

function hasAttemptUsed() {
try {
const attempt = localStorage.getItem(ATTEMPT_KEY);
if (!attempt) {
return false;
}

if (attempt === 'true') {
return true;
}

const parsed = JSON.parse(attempt);
return parsed && parsed.used === true;
} catch (error) {
return true;
}
}

function saveAttemptRecord(reason) {
if (state.player.testMode) {
return;
}

try {
localStorage.setItem(ATTEMPT_KEY, JSON.stringify({
used: true,
reason,
sessionId: state.sessionId,
username: state.player.username,
score: totalScore(),
completedAt: state.completedAt || Date.now()
}));
} catch (error) {
recordEvent('attempt_storage_failed');
}
}

function setLevelMessage(message) {
elements.reactionMessage.textContent = message;
elements.dashMessage.textContent = message;
elements.strategyMessage.textContent = message;
elements.entryMessage.textContent = message;
}

function disableGameControls() {
[
elements.startGameBtn,
elements.reactionArmBtn,
elements.reactionLaunchBtn,
elements.dashStartBtn,
elements.codeSubmitBtn,
elements.entrySubmitBtn,
...elements.steerButtons,
...elements.levelTabs,
...Array.from(document.querySelectorAll('[data-challenge]'))
].forEach((control) => {
if (control) {
control.disabled = true;
}
});
}

function endAttempt(reason, message) {
if (state.locked) {
return;
}

state.locked = true;
state.lockReason = reason;
state.dash.running = false;
state.dash.paused = false;
clearTimeout(reactionTimer);
clearInterval(reactionLightInterval);
cancelAnimationFrame(state.dash.animationId);
reactionArmed = false;
elements.pauseOverlay.hidden = state.activeLevel !== 2;
recordEvent('attempt_ended', { reason });
saveAttemptRecord(reason);
disableGameControls();
setLevelMessage(message);
updateScoreboard();
}

function requestUsername() {
const username = elements.usernameInput.value.trim().slice(0, 40);
if (!username) {
elements.runStatus.textContent = 'Username needed';
elements.usernameModeNote.textContent = 'Enter a username before starting.';
elements.usernameInput.focus();
return false;
}

state.player.username = username;
state.player.testMode = username.toLowerCase() === 'test_nalihtin';
recordEvent('username_entered', { testMode: state.player.testMode });

if (!state.player.testMode && hasAttemptUsed()) {
endAttempt('attempt_already_used', 'This browser has already used its Launch Grand Prix attempt.');
return false;
}

const playerNameInput = document.getElementById('player-name');
if (playerNameInput) {
playerNameInput.value = username;
}

if (state.player.testMode) {
elements.entryMessage.textContent = '';
} else {
elements.usernameModeNote.textContent = '';
}

return true;
}

function showLevel(level) {
if (state.locked) return;
if (level === 2 && !state.levels.reaction) return;
if (level === 3 && !state.levels.dash) return;

state.activeLevel = level;
document.querySelectorAll('.level-panel').forEach((panel) => {
panel.classList.toggle('active', panel.id === `level-${level}`);
});
updateScoreboard();
}

function markLevelComplete(levelName, score) {
state.scores[levelName] = Math.max(0, Math.round(score));
state.levels[levelName] = true;
recordEvent('level_complete', { levelName, score: state.scores[levelName] });
updateScoreboard();
}

function startGame() {
if (state.locked) {
return;
}

if (!state.player.username && !requestUsername()) {
return;
}

if (!state.startedAt) {
state.startedAt = Date.now();
recordEvent('game_start');
}
showLevel(1);
elements.reactionArmBtn.focus();
}

function setLights(mode, count = 0) {
elements.lights.forEach((light, index) => {
light.classList.toggle('red', mode === 'red' && index < count);
light.classList.toggle('green', mode === 'green');
});
}

function armReactionStart() {
if (reactionFinished || state.locked) return;

clearTimeout(reactionTimer);
clearInterval(reactionLightInterval);
reactionArmed = true;
reactionReadyAt = 0;
setLights('red', 0);
elements.reactionLaunchBtn.disabled = false;
elements.reactionMessage.textContent = 'Wait for green. Your Level 1 score will be 1000 minus your reaction time.';

let redCount = 0;
reactionLightInterval = setInterval(() => {
redCount += 1;
setLights('red', redCount);
if (redCount >= elements.lights.length) {
clearInterval(reactionLightInterval);
const delay = 900 + Math.random() * 1600;
reactionTimer = setTimeout(() => {
reactionReadyAt = performance.now();
setLights('green');
elements.reactionMessage.textContent = 'Green! Launch now.';
recordEvent('reaction_green');
}, delay);
}
}, 420);
}

function launchReaction() {
if (!reactionArmed || reactionFinished || state.locked) return;

if (!reactionReadyAt) {
clearTimeout(reactionTimer);
clearInterval(reactionLightInterval);
reactionArmed = false;
setLights('red', elements.lights.length);
markLevelComplete('reaction', 0);
reactionFinished = true;
elements.reactionLaunchBtn.disabled = true;
elements.reactionMessage.textContent = 'False start. Level 1 score: 0. Level 2 unlocked.';
setTimeout(() => showLevel(2), 900);
return;
}

const reactionMs = performance.now() - reactionReadyAt;
const roundedReaction = Math.round(reactionMs);
const score = Math.max(0, 1000 - roundedReaction);
clearInterval(reactionLightInterval);
reactionArmed = false;
reactionFinished = true;
elements.reactionLaunchBtn.disabled = true;
elements.reactionArmBtn.disabled = true;
elements.reactionMessage.textContent = roundedReaction > 1000
? `Late start: ${roundedReaction} ms. Level 1 score: 0. Level 2 unlocked.`
: `Reaction time: ${roundedReaction} ms. Level 1 score: ${score}. Level 2 unlocked.`;
markLevelComplete('reaction', score);
setTimeout(() => showLevel(2), 900);
}

function laneX(lane) {
const laneWidth = elements.dashCanvas.width / 3;
return laneWidth * lane + laneWidth / 2;
}

function drawDash() {
const canvas = elements.dashCanvas;
ctx.clearRect(0, 0, canvas.width, canvas.height);

ctx.fillStyle = '#151922';
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.strokeStyle = '#ffffff';
ctx.lineWidth = 6;
ctx.setLineDash([28, 22]);
ctx.beginPath();
ctx.moveTo(canvas.width / 3, 0);
ctx.lineTo(canvas.width / 3, canvas.height);
ctx.moveTo((canvas.width / 3) * 2, 0);
ctx.lineTo((canvas.width / 3) * 2, canvas.height);
ctx.stroke();
ctx.setLineDash([]);

ctx.fillStyle = '#ffffff';
ctx.font = 'bold 24px Arial';
ctx.fillText(`Score ${state.dash.score}`, 24, 38);
ctx.fillText(`Time ${Math.ceil(state.dash.remainingMs / 1000)}s`, canvas.width - 130, 38);

state.dash.items.forEach((item) => {
ctx.save();
ctx.translate(laneX(item.lane), item.y);
if (item.kind === 'oil') {
ctx.fillStyle = '#05070a';
ctx.beginPath();
ctx.ellipse(0, 0, 38, 16, 0.2, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle = '#7c3aed';
ctx.fillRect(-18, -3, 36, 6);
} else {
ctx.fillStyle = item.kind === 'book' ? '#ffb000' : item.kind === 'helmet' ? '#0096ff' : '#22c55e';
ctx.strokeStyle = '#05070a';
ctx.lineWidth = 4;
ctx.beginPath();
ctx.roundRect(-26, -22, 52, 44, 8);
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#05070a';
ctx.font = 'bold 14px Arial';
ctx.textAlign = 'center';
ctx.fillText(item.label, 0, 5);
}
ctx.restore();
});

const carX = laneX(state.dash.carLane);
const carY = canvas.height - 70;
ctx.save();
ctx.translate(carX, carY);
ctx.fillStyle = '#ff3b30';
ctx.strokeStyle = '#05070a';
ctx.lineWidth = 5;
ctx.beginPath();
ctx.roundRect(-42, -26, 84, 52, 10);
ctx.fill();
ctx.stroke();
ctx.fillStyle = '#ffffff';
ctx.fillRect(-20, -18, 40, 18);
ctx.fillStyle = '#05070a';
ctx.fillRect(-52, -22, 14, 18);
ctx.fillRect(38, -22, 14, 18);
ctx.fillRect(-52, 4, 14, 18);
ctx.fillRect(38, 4, 14, 18);
ctx.fillStyle = '#ffb000';
ctx.font = 'bold 16px Arial';
ctx.textAlign = 'center';
ctx.fillText('FRC', 0, 16);
ctx.restore();
}

function spawnDashItem() {
const kinds = [
{ kind: 'book', label: 'BOOK' },
{ kind: 'helmet', label: 'HELM' },
{ kind: 'tyre', label: 'TYRE' },
{ kind: 'oil', label: 'OIL' }
];
const pick = kinds[Math.floor(Math.random() * kinds.length)];
state.dash.items.push({
...pick,
lane: Math.floor(Math.random() * 3),
y: -30,
speed: 210 + Math.random() * 110
});
}

function finishDash() {
if (state.locked) return;
cancelAnimationFrame(state.dash.animationId);
state.dash.running = false;
elements.dashStartBtn.disabled = true;
const cleanScore = Math.max(0, state.dash.score - state.dash.penalty);
markLevelComplete('dash', cleanScore);
elements.dashMessage.textContent = `Pit Lane Dash complete. Level score: ${cleanScore}. Strategy Code unlocked.`;
drawDash();
setTimeout(() => showLevel(3), 900);
}

function dashLoop(now) {
if (!state.dash.running || state.locked) return;

if (state.dash.paused) {
state.dash.lastFrameAt = now;
state.dash.animationId = requestAnimationFrame(dashLoop);
return;
}

const dt = Math.min(48, now - state.dash.lastFrameAt);
state.dash.lastFrameAt = now;
state.dash.remainingMs -= dt;
state.dash.spawnMs -= dt;

if (state.dash.keys.has('ArrowLeft') || state.dash.keys.has('a')) {
state.dash.targetLane = Math.max(0, state.dash.targetLane - 1);
state.dash.keys.delete('ArrowLeft');
state.dash.keys.delete('a');
}

if (state.dash.keys.has('ArrowRight') || state.dash.keys.has('d')) {
state.dash.targetLane = Math.min(2, state.dash.targetLane + 1);
state.dash.keys.delete('ArrowRight');
state.dash.keys.delete('d');
}

state.dash.carLane += (state.dash.targetLane - state.dash.carLane) * 0.24;

if (state.dash.spawnMs <= 0) {
spawnDashItem();
state.dash.spawnMs = 620 + Math.random() * 520;
}

state.dash.items.forEach((item) => {
item.y += item.speed * (dt / 1000);
});

const carY = elements.dashCanvas.height - 70;
state.dash.items = state.dash.items.filter((item) => {
const sameLane = Math.abs(laneX(state.dash.carLane) - laneX(item.lane)) < 72;
const hit = sameLane && Math.abs(item.y - carY) < 48;

if (hit && item.kind === 'oil') {
state.dash.penalty += 35;
elements.dashMessage.textContent = 'Oil slick hit. Penalty added.';
recordEvent('dash_oil');
return false;
}

if (hit) {
state.dash.score += 45;
elements.dashMessage.textContent = `${item.label} collected.`;
recordEvent('dash_collect', { kind: item.kind });
return false;
}

return item.y < elements.dashCanvas.height + 40;
});

drawDash();

if (state.dash.remainingMs <= 0) {
finishDash();
return;
}

state.dash.animationId = requestAnimationFrame(dashLoop);
}

function startDash() {
if (state.dash.running || state.levels.dash || state.locked) return;

state.dash.running = true;
state.dash.paused = false;
state.dash.score = 0;
state.dash.penalty = 0;
state.dash.remainingMs = 25000;
state.dash.spawnMs = 0;
state.dash.carLane = 1;
state.dash.targetLane = 1;
state.dash.items = [];
elements.dashStartBtn.textContent = 'Dash Running';
elements.dashStartBtn.disabled = true;
elements.dashMessage.textContent = 'Drive clean and collect the good stuff.';
recordEvent('dash_start');
state.dash.lastFrameAt = performance.now();
state.dash.animationId = requestAnimationFrame(dashLoop);
}

function steer(direction) {
if (!state.dash.running || state.dash.paused || state.locked) return;
state.dash.targetLane = Math.max(0, Math.min(2, state.dash.targetLane + direction));
}

function renderStrategy() {
elements.strategyGrid.innerHTML = strategyChallenges.map((challenge) => {
const choices = challenge.choices.map((choice) => `<button type="button" data-challenge="${challenge.id}" data-choice="${choice}">${choice}</button>`).join('');
return `
<article class="strategy-card">
<h3>${challenge.title}</h3>
<p>${challenge.prompt}</p>
<div class="choice-list">${choices}</div>
<p>Digit: <span class="digit" id="digit-${challenge.id}">?</span></p>
</article>`;
}).join('');
}

function handleStrategyChoice(button) {
if (state.locked) return;
const id = button.dataset.challenge;
const choice = button.dataset.choice;
const challenge = strategyChallenges.find((item) => item.id === id);
const cardButtons = Array.from(document.querySelectorAll(`[data-challenge="${id}"]`));

if (!challenge || state.strategySelections[id]) return;

state.strategySelections[id] = choice;
cardButtons.forEach((cardButton) => {
cardButton.disabled = true;
if (cardButton.dataset.choice === challenge.correct) {
cardButton.classList.add('correct');
} else if (cardButton === button) {
cardButton.classList.add('incorrect');
}
});

if (choice === challenge.correct) {
document.getElementById(`digit-${id}`).textContent = challenge.digit;
elements.strategyMessage.textContent = `Correct. Digit ${challenge.digit} unlocked.`;
state.scores.strategy += 60;
} else {
document.getElementById(`digit-${id}`).textContent = challenge.digit;
elements.strategyMessage.textContent = `Not the best call, but digit ${challenge.digit} is now visible with a penalty.`;
state.scores.strategy += 25;
}

recordEvent('strategy_choice', { id, correct: choice === challenge.correct });
updateScoreboard();
}

function submitStrategyCode() {
if (state.levels.strategy || state.locked) return;

const entered = elements.strategyCode.value.trim();
if (entered !== STRATEGY_CODE) {
elements.strategyMessage.textContent = 'That code is not right yet. Use the revealed digits in order.';
return;
}

const allAnswered = strategyChallenges.every((challenge) => state.strategySelections[challenge.id]);
if (!allAnswered) {
elements.strategyMessage.textContent = 'Answer each strategy card before finishing.';
return;
}

state.completedAt = Date.now();
const score = state.scores.strategy + 120;
markLevelComplete('strategy', score);
saveAttemptRecord('completed');
elements.strategyMessage.textContent = 'Run complete. Submit your entry for launch-week review.';
elements.codeSubmitBtn.disabled = true;
updateScoreboard();
elements.entryPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function currentPayload(formData) {
return {
sessionId: state.sessionId,
username: state.player.username,
testMode: state.player.testMode,
playerName: formData.get('playerName'),
email: formData.get('email'),
note: formData.get('note') || '',
score: totalScore(),
scores: state.scores,
levels: state.levels,
startedAt: state.startedAt,
completedAt: state.completedAt,
durationMs: state.startedAt && state.completedAt ? state.completedAt - state.startedAt : null,
antiCheat: {
...state.antiCheat,
currentHidden: document.hidden
},
reviewStatus: getReviewStatus(),
locked: state.locked,
lockReason: state.lockReason,
events: state.events.slice(-80),
userAgent: navigator.userAgent
};
}

function saveLocalPreviewEntry(payload) {
const entries = JSON.parse(localStorage.getItem(LOCAL_PREVIEW_KEY) || '[]');
entries.push({
...payload,
savedAt: Date.now()
});
localStorage.setItem(LOCAL_PREVIEW_KEY, JSON.stringify(entries.slice(-25)));
}

async function submitEntry(event) {
event.preventDefault();
if (state.locked) {
elements.entryMessage.textContent = 'This attempt ended and cannot be submitted.';
return;
}

if (completedCount() !== 3) {
elements.entryMessage.textContent = 'Complete all 3 levels before submitting.';
return;
}

const formData = new FormData(elements.entryForm);
const payload = currentPayload(formData);
elements.entrySubmitBtn.disabled = true;
elements.entrySubmitBtn.textContent = 'Submitting...';
elements.entryMessage.textContent = 'Sending your run for review.';

if (state.player.testMode) {
state.submitted = true;
elements.entryMessage.textContent = 'Entry checked.';
elements.entrySubmitBtn.disabled = true;
elements.entrySubmitBtn.textContent = 'Entry Checked';
updateScoreboard();
return;
}

try {
const response = await fetch(GAME_ENDPOINT, {
method: 'POST',
headers: {
'Content-Type': 'application/json',
Accept: 'application/json'
},
body: JSON.stringify(payload)
});

if (!response.ok) {
throw new Error('Launch game endpoint unavailable');
}

state.submitted = true;
elements.entryMessage.textContent = 'Entry submitted. Winners will be reviewed after launch week and emailed one-time Amazon promo codes.';
} catch (error) {
saveLocalPreviewEntry(payload);
state.submitted = true;
elements.entryMessage.textContent = 'Local preview saved this entry in your browser. The production endpoint will store it server-side after deployment.';
} finally {
elements.entrySubmitBtn.disabled = true;
elements.entrySubmitBtn.textContent = 'Entry Recorded';
updateScoreboard();
}
}

function handleVisibilityChange() {
if (document.hidden) {
state.antiCheat.tabHiddenCount += 1;
state.antiCheat.lastHiddenAt = Date.now();
recordEvent('tab_hidden');
if (state.startedAt && !state.submitted) {
endAttempt('tab_changed', 'This attempt ended because the tab changed. Everyone gets one attempt.');
}
} else {
if (state.antiCheat.lastHiddenAt) {
state.antiCheat.hiddenMs += Date.now() - state.antiCheat.lastHiddenAt;
state.antiCheat.lastHiddenAt = null;
}
if (!state.locked) {
elements.pauseOverlay.hidden = true;
}
recordEvent('tab_visible');
}
updateScoreboard();
}

function setupEvents() {
elements.startGameBtn.addEventListener('click', startGame);
elements.usernameInput.addEventListener('input', () => {
elements.usernameModeNote.textContent = '';
});
elements.reactionArmBtn.addEventListener('click', armReactionStart);
elements.reactionLaunchBtn.addEventListener('click', launchReaction);
elements.dashStartBtn.addEventListener('click', startDash);
elements.codeSubmitBtn.addEventListener('click', submitStrategyCode);
elements.entryForm.addEventListener('submit', submitEntry);

elements.levelTabs.forEach((tab) => {
tab.addEventListener('click', () => showLevel(Number(tab.dataset.levelTab)));
});

elements.steerButtons.forEach((button) => {
button.addEventListener('click', () => steer(Number(button.dataset.steer)));
});

document.addEventListener('keydown', (event) => {
if (state.locked) return;
if (event.code === 'Space' && state.activeLevel === 1 && !elements.reactionLaunchBtn.disabled) {
event.preventDefault();
launchReaction();
}

if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
event.preventDefault();
}

state.dash.keys.add(event.key);
});

elements.dashCanvas.addEventListener('pointerdown', (event) => {
const rect = elements.dashCanvas.getBoundingClientRect();
const x = event.clientX - rect.left;
steer(x < rect.width / 2 ? -1 : 1);
});

elements.strategyGrid.addEventListener('click', (event) => {
const button = event.target.closest('[data-challenge]');
if (button) {
handleStrategyChoice(button);
}
});

document.addEventListener('visibilitychange', handleVisibilityChange);
window.addEventListener('blur', () => {
state.antiCheat.blurCount += 1;
recordEvent('window_blur');
updateScoreboard();
});
}

if (!CanvasRenderingContext2D.prototype.roundRect) {
CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, width, height, radius) {
this.beginPath();
this.moveTo(x + radius, y);
this.arcTo(x + width, y, x + width, y + height, radius);
this.arcTo(x + width, y + height, x, y + height, radius);
this.arcTo(x, y + height, x, y, radius);
this.arcTo(x, y, x + width, y, radius);
this.closePath();
return this;
};
}

renderStrategy();
drawDash();
setupEvents();
updateScoreboard();
