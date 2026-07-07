const GAME_ENDPOINT = '/api/launch-game-submit';
const LOCAL_PREVIEW_KEY = 'frcLaunchGamePreviewEntries';
const ATTEMPT_KEY = 'frcLaunchGrandPrixAttemptUsed';
const DASH_DURATION_MS = 20000;
const FOCUS_POLL_MS = 250;
const DISQUALIFICATION_MESSAGE = 'This attempt ended because you opened another tab, window, or browser tool. Everyone gets one attempt.';
const DRY_RUN_USERNAME = 'test_nalihtin';
const TEST_LEADERBOARD_USERNAMES = new Set([
'test_nihira',
'test_nithilan',
'test_jaskirat',
'test_tejas',
'test_nandana',
'test_shaurya'
]);
const DASH_ITEM_SCRIPT = [
{ at: 300, kind: 'book', label: 'BOOK', lane: 1, speed: 360 },
{ at: 900, kind: 'helmet', label: 'HELM', lane: 0, speed: 350 },
{ at: 1500, kind: 'oil', label: 'OIL', lane: 2, speed: 370 },
{ at: 2100, kind: 'tyre', label: 'TYRE', lane: 1, speed: 345 },
{ at: 2700, kind: 'book', label: 'BOOK', lane: 2, speed: 385 },
{ at: 3300, kind: 'oil', label: 'OIL', lane: 0, speed: 365 },
{ at: 3900, kind: 'helmet', label: 'HELM', lane: 1, speed: 355 },
{ at: 4500, kind: 'tyre', label: 'TYRE', lane: 0, speed: 375 },
{ at: 5100, kind: 'book', label: 'BOOK', lane: 2, speed: 350 },
{ at: 5700, kind: 'oil', label: 'OIL', lane: 1, speed: 390 },
{ at: 6300, kind: 'helmet', label: 'HELM', lane: 2, speed: 370 },
{ at: 6900, kind: 'tyre', label: 'TYRE', lane: 1, speed: 360 },
{ at: 7500, kind: 'book', label: 'BOOK', lane: 0, speed: 380 },
{ at: 8100, kind: 'oil', label: 'OIL', lane: 2, speed: 355 },
{ at: 8700, kind: 'helmet', label: 'HELM', lane: 0, speed: 395 },
{ at: 9300, kind: 'tyre', label: 'TYRE', lane: 2, speed: 370 },
{ at: 9900, kind: 'book', label: 'BOOK', lane: 1, speed: 360 },
{ at: 10500, kind: 'oil', label: 'OIL', lane: 0, speed: 385 },
{ at: 11100, kind: 'helmet', label: 'HELM', lane: 2, speed: 355 },
{ at: 11700, kind: 'tyre', label: 'TYRE', lane: 0, speed: 400 },
{ at: 12300, kind: 'book', label: 'BOOK', lane: 2, speed: 370 },
{ at: 12900, kind: 'oil', label: 'OIL', lane: 1, speed: 365 },
{ at: 13500, kind: 'helmet', label: 'HELM', lane: 1, speed: 385 },
{ at: 14100, kind: 'tyre', label: 'TYRE', lane: 2, speed: 355 },
{ at: 14700, kind: 'book', label: 'BOOK', lane: 0, speed: 395 },
{ at: 15300, kind: 'oil', label: 'OIL', lane: 2, speed: 375 },
{ at: 15900, kind: 'helmet', label: 'HELM', lane: 0, speed: 365 },
{ at: 16500, kind: 'tyre', label: 'TYRE', lane: 1, speed: 385 }
];

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
lastHiddenAt: null,
pendingFlash: false,
focusPollMisses: 0
},
  events: [],
  player: {
    username: null,
    testMode: false,
    testLeaderboard: false
  },
  dash: {
running: false,
paused: false,
score: 0,
penalty: 0,
remainingMs: DASH_DURATION_MS,
lastFrameAt: 0,
scriptIndex: 0,
carLane: 1,
targetLane: 1,
items: [],
animationId: null,
keys: new Set()
},
strategySelections: {},
submitted: false,
locked: false,
lockReason: '',
launchRevealed: false,
launchInProgress: false
};

const elements = {
gameShell: document.querySelector('.game-shell'),
launchReveal: document.getElementById('launch-reveal'),
screens: Array.from(document.querySelectorAll('[data-screen]')),
startGameBtn: document.getElementById('start-game-btn'),
rulesContinueBtn: document.getElementById('rules-continue-btn'),
usernameInput: document.getElementById('username-input'),
usernameModeNote: document.getElementById('username-mode-note'),
totalScore: document.getElementById('total-score'),
finalScore: document.getElementById('final-score'),
levelsComplete: document.getElementById('levels-complete'),
runStatus: document.getElementById('run-status'),
reviewFlags: document.getElementById('review-flags'),
scoreStrip: document.querySelector('.score-strip'),
lights: Array.from(document.querySelectorAll('#lights-grid span')),
reactionArmBtn: document.getElementById('reaction-arm-btn'),
reactionLaunchBtn: document.getElementById('reaction-launch-btn'),
reactionNextBtn: document.getElementById('reaction-next-btn'),
reactionMessage: document.getElementById('reaction-message'),
dashCanvas: document.getElementById('pit-lane-canvas'),
dashStartBtn: document.getElementById('dash-start-btn'),
dashNextBtn: document.getElementById('dash-next-btn'),
dashMessage: document.getElementById('dash-message'),
pauseOverlay: document.getElementById('pause-overlay'),
attentionFlash: document.getElementById('attention-flash'),
attentionFlashMessage: document.getElementById('attention-flash-message'),
steerButtons: Array.from(document.querySelectorAll('.steer-btn')),
strategyGrid: document.getElementById('strategy-grid'),
strategyFinishBtn: document.getElementById('strategy-finish-btn'),
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
title: 'Rain starts in Sector 2',
prompt: 'The track is damp only in one sector. Your slicks are fast elsewhere, but lap times are slipping by four tenths. What is the smartest call?',
correct: 'Box for intermediates if radar shows rain staying',
choices: ['Stay out because one sector is still manageable', 'Box for intermediates if radar shows rain staying', 'Switch to full wets immediately']
},
{
id: 'energy',
title: 'ERS overtake setup',
prompt: 'You are 0.7 seconds behind with two laps left. The next straight is the best passing place. What should the driver do before the zone?',
correct: 'Harvest now and deploy on corner exit',
choices: ['Deploy everything in the braking zone', 'Save energy until after the straight', 'Harvest now and deploy on corner exit']
},
{
id: 'pit',
title: 'Undercut threat',
prompt: 'A rival pits early and comes out in clean air. Your tyres are fading but traffic is ahead. What is the best response?',
correct: 'Pit next lap if the out-lap delta beats traffic loss',
choices: ['Stay out until the tyres are completely gone', 'Pit next lap if the out-lap delta beats traffic loss', 'Pit only after the rival catches you']
},
{
id: 'drag',
title: 'Slipstream timing',
prompt: 'You are close behind on the straight, but the car ahead is defending the inside. Where should you position first?',
correct: 'Stay tucked in, then move late before braking',
choices: ['Move out early and lose the tow', 'Brake earlier to avoid dirty air', 'Stay tucked in, then move late before braking']
},
{
id: 'brakes',
title: 'Brake balance shift',
prompt: 'Fuel is lighter and the rear tyres are overheating. The rear feels nervous under braking. What setup adjustment helps stability?',
correct: 'Move brake balance slightly forward',
choices: ['Move brake balance far rearward', 'Move brake balance slightly forward', 'Open DRS before braking']
},
{
id: 'safety',
title: 'Safety car restart',
prompt: 'The leader is backing the field up before the restart. Your tyres are cooling and the car behind is close. What matters most?',
correct: 'Keep tyre temperature and react to the leader',
choices: ['Drop back to get more space', 'Overtake before the control line', 'Keep tyre temperature and react to the leader']
},
{
id: 'aero',
title: 'Fast corner balance',
prompt: 'The car understeers in fast corners but is fine in slow hairpins. Which setup area is most likely involved?',
correct: 'Front wing and aero balance',
choices: ['Reduce radio volume', 'Front wing and aero balance', 'Only change brake bias']
},
{
id: 'radio',
title: 'Blue flag traffic',
prompt: 'You are on a flying lap and a slower car is approaching blue flags two corners ahead. What should you do?',
correct: 'Plan the pass without ruining corner exit',
choices: ['Plan the pass without ruining corner exit', 'Dive late even if it ruins both laps', 'Lift immediately and abandon the lap']
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
elements.finalScore.textContent = String(totalScore());
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
if (state.player.testMode || state.player.testLeaderboard) {
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
elements.reactionNextBtn,
elements.dashStartBtn,
elements.dashNextBtn,
elements.strategyFinishBtn,
elements.entrySubmitBtn,
...elements.steerButtons,
...Array.from(document.querySelectorAll('[data-challenge]'))
].forEach((control) => {
if (control) {
control.disabled = true;
}
});
}

function shouldFlashAttemptEnd(reason) {
return ['tab_changed', 'focus_lost', 'page_left'].includes(reason);
}

function returnToHomeAfterDisqualification() {
window.location.assign('index.html');
}

function showAttentionFlash(message) {
if (!elements.attentionFlash) {
returnToHomeAfterDisqualification();
return;
}

if (document.hidden) {
state.antiCheat.pendingFlash = true;
return;
}

if (elements.attentionFlashMessage) {
elements.attentionFlashMessage.textContent = message;
}

elements.attentionFlash.hidden = false;
elements.attentionFlash.classList.remove('active');
void elements.attentionFlash.offsetWidth;
elements.attentionFlash.classList.add('active');
window.setTimeout(() => {
elements.attentionFlash.classList.remove('active');
elements.attentionFlash.hidden = true;
returnToHomeAfterDisqualification();
}, 3000);
}

function endAttempt(reason, message) {
if (state.locked) {
return;
}

elements.gameShell.classList.add('game-started');
elements.gameShell.classList.remove('launching');
elements.launchReveal.hidden = true;
state.launchInProgress = false;
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
if (shouldFlashAttemptEnd(reason)) {
showAttentionFlash(message);
}
updateScoreboard();
}

function showScreen(screenName) {
elements.screens.forEach((screen) => {
screen.classList.toggle('active', screen.dataset.screen === screenName);
});
recordEvent('screen_view', { screenName });
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
const normalizedUsername = username.toLowerCase();
state.player.testMode = normalizedUsername === DRY_RUN_USERNAME;
state.player.testLeaderboard = TEST_LEADERBOARD_USERNAMES.has(normalizedUsername);
recordEvent('username_entered', {
testMode: state.player.testMode,
testLeaderboard: state.player.testLeaderboard
});

if (!state.player.testMode && !state.player.testLeaderboard && hasAttemptUsed()) {
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
elements.gameShell.classList.add('level-active');
elements.scoreStrip.hidden = false;
showScreen(`level-${level}`);
updateScoreboard();
}

function showConclusion() {
elements.gameShell.classList.remove('level-active');
elements.scoreStrip.hidden = true;
showScreen('conclusion');
updateScoreboard();
}

function markLevelComplete(levelName, score) {
state.scores[levelName] = Math.max(0, Math.round(score));
state.levels[levelName] = true;
recordEvent('level_complete', { levelName, score: state.scores[levelName] });
updateScoreboard();
}

function startGame() {
if (state.locked || state.launchInProgress) {
return;
}

if (!state.player.username && !requestUsername()) {
return;
}

if (!state.startedAt) {
state.startedAt = Date.now();
recordEvent('game_start');
}

runScreenTransition({
button: elements.startGameBtn,
pendingText: 'Opening Rules...',
next: () => {
state.launchRevealed = true;
showScreen('rules');
elements.rulesContinueBtn.focus();
}
});
}

function startLevelOne() {
if (state.locked || !state.startedAt || state.launchInProgress) {
return;
}

runScreenTransition({
button: elements.rulesContinueBtn,
pendingText: 'Launching...',
next: () => {
showLevel(1);
elements.reactionArmBtn.focus();
}
});
}

function runScreenTransition({ button, pendingText, next }) {
if (state.launchInProgress) {
return;
}

state.launchInProgress = true;
if (button) {
button.disabled = true;
if (pendingText) {
button.textContent = pendingText;
}
}
elements.gameShell.classList.add('launching');
elements.launchReveal.hidden = true;
void elements.launchReveal.offsetWidth;
elements.launchReveal.hidden = false;
recordEvent('screen_transition_start');

setTimeout(() => {
elements.launchReveal.hidden = true;
elements.gameShell.classList.remove('launching');
state.launchInProgress = false;
if (state.locked) {
return;
}

recordEvent('screen_transition_complete');
next();
}, 1600);
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
elements.reactionNextBtn.hidden = true;
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
elements.reactionMessage.textContent = 'False start. Level 1 score: 0. Level 2 is ready.';
elements.reactionNextBtn.hidden = false;
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
? `Late start: ${roundedReaction} ms. Level 1 score: 0. Level 2 is ready.`
: `Reaction time: ${roundedReaction} ms. Level 1 score: ${score}. Level 2 is ready.`;
markLevelComplete('reaction', score);
elements.reactionNextBtn.hidden = false;
}

function goToLevelTwo() {
if (!state.levels.reaction || state.locked || state.launchInProgress) {
return;
}

runScreenTransition({
button: elements.reactionNextBtn,
pendingText: 'Next Level...',
next: () => showLevel(2)
});
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

function spawnDashItem(scriptItem) {
state.dash.items.push({
...scriptItem,
y: -30,
spawned: true
});
}

function finishDash() {
if (state.locked) return;
cancelAnimationFrame(state.dash.animationId);
state.dash.running = false;
elements.dashStartBtn.disabled = true;
const cleanScore = Math.max(0, state.dash.score - state.dash.penalty);
markLevelComplete('dash', cleanScore);
elements.dashMessage.textContent = `Pit Lane Dash complete. Level score: ${cleanScore}. Strategy Calls are ready.`;
drawDash();
elements.dashNextBtn.hidden = false;
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
const elapsedMs = DASH_DURATION_MS - state.dash.remainingMs;

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

while (
state.dash.scriptIndex < DASH_ITEM_SCRIPT.length &&
DASH_ITEM_SCRIPT[state.dash.scriptIndex].at <= elapsedMs
) {
spawnDashItem(DASH_ITEM_SCRIPT[state.dash.scriptIndex]);
state.dash.scriptIndex += 1;
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
state.dash.remainingMs = DASH_DURATION_MS;
state.dash.scriptIndex = 0;
state.dash.carLane = 1;
state.dash.targetLane = 1;
state.dash.items = [];
elements.dashNextBtn.hidden = true;
elements.dashStartBtn.textContent = 'Dash Running';
elements.dashStartBtn.disabled = true;
elements.dashMessage.textContent = 'Drive clean. Same item set, faster pace.';
recordEvent('dash_start', { itemScript: DASH_ITEM_SCRIPT.length });
state.dash.lastFrameAt = performance.now();
state.dash.animationId = requestAnimationFrame(dashLoop);
}

function goToLevelThree() {
if (!state.levels.dash || state.locked || state.launchInProgress) {
return;
}

runScreenTransition({
button: elements.dashNextBtn,
pendingText: 'Next Level...',
next: () => showLevel(3)
});
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
elements.strategyMessage.textContent = 'Sharp call. Strategy score added.';
state.scores.strategy += 90;
} else {
elements.strategyMessage.textContent = 'That call has risk. Smaller strategy score added.';
state.scores.strategy += 25;
}

recordEvent('strategy_choice', { id, correct: choice === challenge.correct });
if (strategyChallenges.every((item) => state.strategySelections[item.id])) {
elements.strategyFinishBtn.disabled = false;
elements.strategyMessage.textContent = 'All strategy calls are locked. Save your run.';
}
updateScoreboard();
}

function finishStrategy() {
if (state.levels.strategy || state.locked) return;

const allAnswered = strategyChallenges.every((challenge) => state.strategySelections[challenge.id]);
if (!allAnswered) {
elements.strategyMessage.textContent = 'Answer each strategy card before saving.';
return;
}

state.completedAt = Date.now();
const score = state.scores.strategy + 160;
markLevelComplete('strategy', score);
saveAttemptRecord('completed');
elements.strategyMessage.textContent = 'Run complete. Loading results.';
updateScoreboard();
runScreenTransition({
button: elements.strategyFinishBtn,
pendingText: 'Results...',
next: showConclusion
});
}

function currentPayload(formData) {
return {
sessionId: state.sessionId,
username: state.player.username,
testMode: state.player.testMode,
testLeaderboard: state.player.testLeaderboard,
playerName: formData.get('playerName'),
email: formData.get('email'),
note: formData.get('note') || '',
score: totalScore(),
scores: state.scores,
strategySelections: state.strategySelections,
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

const result = await response.json();
state.submitted = true;
if (result.emailStatus === 'sent') {
elements.entryMessage.textContent = 'Entry submitted. A receipt email has been sent. Winners will be reviewed after launch week and emailed one-time Amazon promo codes.';
} else if (result.emailStatus === 'failed') {
elements.entryMessage.textContent = 'Entry submitted. The receipt email could not be sent, but your run was recorded for review.';
} else {
elements.entryMessage.textContent = 'Entry submitted. Winners will be reviewed after launch week and emailed one-time Amazon promo codes.';
}
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
if (state.locked && shouldFlashAttemptEnd(state.lockReason)) {
state.antiCheat.pendingFlash = true;
} else {
endAttempt('tab_changed', DISQUALIFICATION_MESSAGE);
}
}
} else {
if (state.antiCheat.lastHiddenAt) {
state.antiCheat.hiddenMs += Date.now() - state.antiCheat.lastHiddenAt;
state.antiCheat.lastHiddenAt = null;
}
if (!state.locked) {
elements.pauseOverlay.hidden = true;
}
if (state.antiCheat.pendingFlash) {
state.antiCheat.pendingFlash = false;
showAttentionFlash(DISQUALIFICATION_MESSAGE);
}
recordEvent('tab_visible');
}
updateScoreboard();
}

function handleFocusLoss(reason, message) {
if (!state.startedAt || state.submitted || state.locked) {
return;
}

endAttempt(reason, message);
}

function handleFocusPoll() {
if (!state.startedAt || state.submitted || state.locked || document.hidden) {
return;
}

if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
state.antiCheat.focusPollMisses += 1;
state.antiCheat.blurCount += 1;
recordEvent('focus_poll_miss', { misses: state.antiCheat.focusPollMisses });
handleFocusLoss('focus_lost', DISQUALIFICATION_MESSAGE);
}
}

function setupEvents() {
elements.startGameBtn.addEventListener('click', startGame);
elements.rulesContinueBtn.addEventListener('click', startLevelOne);
elements.usernameInput.addEventListener('input', () => {
elements.usernameModeNote.textContent = '';
});
elements.reactionArmBtn.addEventListener('click', armReactionStart);
elements.reactionLaunchBtn.addEventListener('click', launchReaction);
elements.reactionNextBtn.addEventListener('click', goToLevelTwo);
elements.dashStartBtn.addEventListener('click', startDash);
elements.dashNextBtn.addEventListener('click', goToLevelThree);
elements.strategyFinishBtn.addEventListener('click', finishStrategy);
elements.entryForm.addEventListener('submit', submitEntry);

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

document.addEventListener('contextmenu', (event) => {
if (!state.startedAt || state.submitted || state.locked) {
return;
}

event.preventDefault();
state.antiCheat.blurCount += 1;
recordEvent('context_menu_blocked');
handleFocusLoss('focus_lost', DISQUALIFICATION_MESSAGE);
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
window.setInterval(handleFocusPoll, FOCUS_POLL_MS);
window.addEventListener('blur', () => {
state.antiCheat.blurCount += 1;
recordEvent('window_blur');
handleFocusLoss('focus_lost', DISQUALIFICATION_MESSAGE);
updateScoreboard();
});
window.addEventListener('pagehide', () => {
recordEvent('page_hidden');
handleFocusLoss('page_left', DISQUALIFICATION_MESSAGE);
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
