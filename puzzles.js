// Crossword data
const crosswordEntries = [
{ num: 1, answer: 'SLIPSTREAM', row: 0, col: 0, direction: 'across' },
{ num: 4, answer: 'CHICANE', row: 2, col: 0, direction: 'across' },
{ num: 7, answer: 'QUALIFYING', row: 4, col: 0, direction: 'across' },
{ num: 1, answer: 'GEARBOX', row: 0, col: 10, direction: 'down' },
{ num: 2, answer: 'STRATEGY', row: 0, col: 11, direction: 'down' },
{ num: 3, answer: 'CARBON', row: 0, col: 12, direction: 'down' }
];

const crosswordRows = 8;
const crosswordCols = 13;
let crosswordSolution = [];


// Wordle data
const wordleWords = ['RACING'];
let wordleAnswer = 'RACING';
let wordleGuesses = [];
let wordleGameOver = false;


// Quiz data
const quizQuestions = [
{
number: '000001',
date: 'Sunday 26th April 2026',
question: 'Which F1 Driver of which team holds the world record for fastest pit stop?',
options: ['Max Verstappen, Red Bull', 'Lando Norris, Red Bull', 'Lando Norris, McLaren', 'Max Verstappen, McLaren'],
correct: 2
},
{
number: '000002',
date: 'Sunday 3rd May 2026',
question: 'What does a yellow light mean on the F1 circuit during a race?',
options: ['Race is stopped.', 'Danger is ahead', 'You are going too slow', 'Service vehicle ahead'],
correct: 1
}
];


let currentQuizIndex = quizQuestions.length - 1; // Start with latest
let quizScore = 0;
let quizAnswered = false;


function initCrossword() {
const grid = document.getElementById('crossword-grid');
grid.innerHTML = '';
grid.style.setProperty('--crossword-cols', crosswordCols);
crosswordSolution = buildCrosswordSolution();

for (let i = 0; i < crosswordRows; i++) {
for (let j = 0; j < crosswordCols; j++) {
const cell = document.createElement('div');
cell.style.position = 'relative';
const solutionLetter = crosswordSolution[i][j];

if (!solutionLetter) {
const blocked = document.createElement('div');
blocked.className = 'crossword-cell blocked';
blocked.setAttribute('aria-hidden', 'true');
cell.appendChild(blocked);
grid.appendChild(cell);
continue;
}

const input = document.createElement('input');
input.type = 'text';
input.maxLength = 1;
input.className = 'crossword-cell';
input.setAttribute('aria-label', `Crossword row ${i + 1}, column ${j + 1}`);
input.dataset.row = i;
input.dataset.col = j;
input.addEventListener('input', (e) => {
e.target.value = e.target.value.toUpperCase();
e.target.classList.remove('incorrect');
});
cell.appendChild(input);

const cluePos = crosswordEntries.find(c => c.row === i && c.col === j);
if (cluePos) {
const numberLabel = document.createElement('div');
numberLabel.textContent = cluePos.number;
numberLabel.style.position = 'absolute';
numberLabel.style.top = '2px';
numberLabel.style.left = '2px';
numberLabel.style.fontSize = '0.65rem';
numberLabel.style.fontWeight = 'bold';
numberLabel.style.color = '#000';
numberLabel.style.lineHeight = '1';
numberLabel.style.pointerEvents = 'none';
cell.appendChild(numberLabel);
}

grid.appendChild(cell);
}
}
}

function buildCrosswordSolution() {
const solution = Array.from({ length: crosswordRows }, () => Array(crosswordCols).fill(''));

crosswordEntries.forEach(entry => {
entry.answer.split('').forEach((letter, offset) => {
const row = entry.row + (entry.direction === 'down' ? offset : 0);
const col = entry.col + (entry.direction === 'across' ? offset : 0);
solution[row][col] = letter;
});
});

return solution;
}

function resetCrossword() {
document.querySelectorAll('#crossword-grid input').forEach(cell => {
cell.value = '';
cell.classList.remove('incorrect');
});
document.getElementById('crossword-message').innerHTML = '';
}


function checkCrossword() {
const cells = document.querySelectorAll('#crossword-grid input');
let correct = true;
let filled = true;

cells.forEach(cell => {
const row = parseInt(cell.dataset.row);
const col = parseInt(cell.dataset.col);
const value = cell.value.toUpperCase();
const expected = crosswordSolution[row][col];

cell.classList.remove('incorrect');

if (!value) {
filled = false;
correct = false;
return;
}

if (value !== expected) {
correct = false;
cell.classList.add('incorrect');
}
});


const message = document.getElementById('crossword-message');
if (correct) {
message.innerHTML = '<div class="message success">✓ Perfect! You solved it!</div>';
} else if (!filled) {
message.innerHTML = '<div class="message error">Fill every white square before checking.</div>';
} else {
message.innerHTML = '<div class="message error">✗ Not quite. Keep trying!</div>';
}
}


function initWordle() {
wordleAnswer = wordleWords[Math.floor(Math.random() * wordleWords.length)];
wordleGuesses = [];
wordleGameOver = false;
document.getElementById('wordle-message').innerHTML = '';


const guessesContainer = document.getElementById('wordle-guesses');
guessesContainer.innerHTML = '';


for (let i = 0; i < 6; i++) {
const guessRow = document.createElement('div');
guessRow.className = 'wordle-guess';
for (let j = 0; j < 6; j++) {
const letter = document.createElement('input');
letter.type = 'text';
letter.maxLength = 1;
letter.className = 'wordle-letter';
letter.dataset.guess = i;
letter.dataset.position = j;


// Only enable first row, grey out the rest
if (i > 0) {
letter.disabled = true;
}


letter.addEventListener('keydown', (e) => handleWordleKeypress(e));
letter.addEventListener('input', (e) => {
e.target.value = e.target.value.toUpperCase();
if (e.target.value && j < 5) {
guessesContainer.querySelector(`input[data-guess="${i}"][data-position="${j+1}"]`).focus();
}
});
guessRow.appendChild(letter);
}
guessesContainer.appendChild(guessRow);
}


updateWordleKeyboard();
document.getElementById('wordle-guesses').querySelector('input').focus();
}


function handleWordleKeypress(e) {
const guess = parseInt(e.target.dataset.guess);
const position = parseInt(e.target.dataset.position);


if (e.key === 'Backspace' && !e.target.value && position > 0) {
document.querySelector(`input[data-guess="${guess}"][data-position="${position-1}"]`).focus();
} else if (e.key === 'Enter') {
submitWordleGuess(guess);
}
}




function createConfetti() {
const confettiPieces = 50;
const wordle = document.getElementById('wordle');


for (let i = 0; i < confettiPieces; i++) {
const confetti = document.createElement('div');
confetti.style.position = 'fixed';
confetti.style.width = '10px';
confetti.style.height = '10px';
confetti.style.backgroundColor = ['#22c55e', '#eab308', '#3b82f6', '#f97316', '#ec4899'][Math.floor(Math.random() * 5)];
confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
confetti.style.left = Math.random() * 100 + '%';
confetti.style.top = '-10px';
confetti.style.pointerEvents = 'none';
confetti.style.zIndex = '9999';
confetti.style.animation = `fall ${2 + Math.random() * 1}s linear forwards`;


document.body.appendChild(confetti);


setTimeout(() => confetti.remove(), 3000);
}
}


function submitWordleGuess(guessIndex) {
const inputs = document.querySelectorAll(`input[data-guess="${guessIndex}"]`);
const guess = Array.from(inputs).map(i => i.value).join('');


if (guess.length !== 6) return;


// Track which letters in the answer have been matched
const answerLetters = wordleAnswer.split('');
const feedback = Array(6).fill(null);


// First pass: mark correct positions
for (let i = 0; i < 6; i++) {
if (guess[i] === wordleAnswer[i]) {
feedback[i] = 'correct';
answerLetters[i] = null; // Mark as used
}
}


// Second pass: mark wrong positions (yellow) and absent (gray)
for (let i = 0; i < 6; i++) {
if (feedback[i] === null) { // Not already marked as correct
const letterIndex = answerLetters.indexOf(guess[i]);
if (letterIndex !== -1) {
feedback[i] = 'present';
answerLetters[letterIndex] = null; // Mark as used
} else {
feedback[i] = 'absent';
}
}
}


// Apply feedback to tiles
for (let i = 0; i < 6; i++) {
const input = inputs[i];
input.classList.add(feedback[i]);
input.disabled = true;
}


wordleGuesses.push({ guess, guessIndex });
updateWordleKeyboard();


if (guess === wordleAnswer) {
createConfetti();
document.getElementById('wordle-message').innerHTML = '<div class="message success">✓ You won! The word was ' + wordleAnswer + '</div>';
wordleGameOver = true;
} else if (guessIndex === 5) {
document.getElementById('wordle-message').innerHTML = '<div class="message error">✗ Game Over! The word was ' + wordleAnswer + '</div>';
wordleGameOver = true;
} else {
// Enable next row
const nextRowInputs = document.querySelectorAll(`input[data-guess="${guessIndex+1}"]`);
nextRowInputs.forEach(input => {
input.disabled = false;
input.style.background = '#fff';
input.style.color = '#000';
input.style.borderColor = '#000';
input.style.cursor = 'text';
});
document.querySelector(`input[data-guess="${guessIndex+1}"][data-position="0"]`).focus();
}
}


function updateWordleKeyboard() {
const keyboard = document.getElementById('keyboard');
keyboard.innerHTML = '';


const keyStates = {};
wordleGuesses.forEach(({ guess }) => {
guess.split('').forEach((letter, i) => {
if (letter === wordleAnswer[i]) {
keyStates[letter] = 'correct';
} else if (wordleAnswer.includes(letter) && keyStates[letter] !== 'correct') {
keyStates[letter] = 'present';
} else if (!keyStates[letter]) {
keyStates[letter] = 'absent';
}
});
});


'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').forEach(letter => {
const key = document.createElement('button');
key.textContent = letter;
key.className = 'key' + (keyStates[letter] ? ' ' + keyStates[letter] : '');
key.onclick = () => insertWordleLetter(letter);
keyboard.appendChild(key);
});


// Add Enter key
const enterKey = document.createElement('button');
enterKey.textContent = 'ENTER';
enterKey.className = 'key enter-key';
enterKey.style.fontSize = '0.75rem';
enterKey.onclick = () => {
const allInputs = document.querySelectorAll('input.wordle-letter:not(:disabled)');
for (let input of allInputs) {
if (!input.value) return; // Incomplete word
}
// Find current guess row
const inputs = document.querySelectorAll('input.wordle-letter:not(:disabled)');
if (inputs.length > 0) {
const currentGuess = parseInt(inputs[0].dataset.guess);
submitWordleGuess(currentGuess);
}
};
keyboard.appendChild(enterKey);
}


function insertWordleLetter(letter) {
const allInputs = document.querySelectorAll('input.wordle-letter:not(:disabled)');
for (let input of allInputs) {
if (!input.value) {
input.value = letter;
input.dispatchEvent(new Event('input', { bubbles: true }));
return;
}
}
}


function resetWordle() {
initWordle();
}


function initQuiz() {
currentQuizIndex = quizQuestions.length - 1; // Start with latest
quizScore = 0;
quizAnswered = false;
displayQuizQuestion();
}


function displayQuizQuestion() {
const q = quizQuestions[currentQuizIndex];


// Update the question number and date in the header
const quizSection = document.getElementById('quiz');
const headerDiv = quizSection.querySelector('[style*="border-bottom: 2px solid #000"]');
headerDiv.querySelector('h2').textContent = `QUESTION No. ${q.number}`;
headerDiv.querySelector('div:last-child').textContent = q.date;


const container = document.getElementById('quiz-content');


let html = `
<div class="quiz-question">
<div class="quiz-question-text">${q.question}</div>
<div class="quiz-options">
`;


q.options.forEach((option, index) => {
html += `<button class="quiz-option" onclick="selectQuizOption(${index})" id="option-${index}">${option}</button>`;
});


html += `
</div>
</div>
<div class="button-group">
<button class="btn" onclick="checkQuizAnswer()">Check Answer</button>
<button class="btn" onclick="showNewerQuestion()" id="newer-btn" ${currentQuizIndex === quizQuestions.length - 1 ? 'disabled' : ''}>Newer Questions</button>
<button class="btn" onclick="showOlderQuestions()" id="older-btn" ${currentQuizIndex === 0 ? 'disabled' : ''}>Older Questions</button>
</div>
`;


container.innerHTML = html;
document.getElementById('quiz-message').innerHTML = '';
}


function showOlderQuestions() {
if (currentQuizIndex > 0) {
currentQuizIndex--;
quizAnswered = false;
displayQuizQuestion();
}
}


function showNewerQuestion() {
if (currentQuizIndex < quizQuestions.length - 1) {
currentQuizIndex++;
quizAnswered = false;
displayQuizQuestion();
}
}


function checkQuizAnswer() {
if (quizAnswered) return;


const selectedBtn = document.querySelector('.quiz-option.selected');
if (!selectedBtn) {
document.getElementById('quiz-message').innerHTML = '<div class="message error">Please select an answer first</div>';
return;
}


quizAnswered = true;
const q = quizQuestions[currentQuizIndex];
const buttons = document.querySelectorAll('.quiz-option');


buttons.forEach(btn => btn.disabled = true);


const selectedIndex = Array.from(buttons).indexOf(selectedBtn);


if (selectedIndex === q.correct) {
document.getElementById(`option-${selectedIndex}`).classList.add('correct');
document.getElementById('quiz-message').innerHTML = '<div class="message success">✓ Correct!</div>';
} else {
document.getElementById(`option-${selectedIndex}`).classList.add('incorrect');
document.getElementById(`option-${q.correct}`).classList.add('correct');
document.getElementById('quiz-message').innerHTML = '<div class="message error">✗ Incorrect. The correct answer is: ' + q.options[q.correct] + '</div>';
}
}


function selectQuizOption(index) {
if (quizAnswered) return;


const buttons = document.querySelectorAll('.quiz-option');
buttons.forEach(btn => btn.classList.remove('selected'));


buttons[index].classList.add('selected');
}


function showPuzzle(puzzle) {
document.querySelectorAll('.puzzle-section').forEach(s => s.classList.remove('active'));
document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));


document.getElementById(puzzle).classList.add('active');
document.querySelector(`button[onclick="showPuzzle('${puzzle}')"]`).classList.add('active');
}


// Initialize on load
initCrossword();
initWordle();
initQuiz();
