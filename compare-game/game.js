const ROUNDS = 10;
const POINTS = 10;
const EQUAL_CHANCE = 0.2;   // כמה אחוז מהסיבובים יהיו שני מספרים שווים

let maxN = 20;
let round = 0;
let score = 0;
let correctCount = 0;
let a = 0;
let b = 0;
let answered = false;
let nextTimer = null;

const $ = (id) => document.getElementById(id);

const SIGN_NAME = { '>': 'גדול מ־', '<': 'קטן מ־', '=': 'שווה ל־' };

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

function randomInt(n) {
    return Math.floor(Math.random() * n);
}

function signFor(x, y) {
    if (x > y) return '>';
    if (x < y) return '<';
    return '=';
}

function newPair() {
    const x = 1 + randomInt(maxN);
    const y = Math.random() < EQUAL_CHANCE ? x : 1 + randomInt(maxN);
    return [x, y];
}

function nextRound() {
    round++;
    answered = false;
    [a, b] = newPair();

    $('qNum').textContent = `${round}/${ROUNDS}`;
    $('score').textContent = score;
    $('numA').textContent = a;
    $('numB').textContent = b;
    $('signBox').textContent = '?';
    $('signBox').classList.remove('ok', 'bad');
    $('feedback').textContent = '';

    document.querySelectorAll('.choice').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('correct', 'wrong');
    });
}

function answer(btn) {
    if (answered) return;
    answered = true;

    const chosen = btn.dataset.sign;
    const right = signFor(a, b);
    const ok = chosen === right;

    $('signBox').textContent = right;
    document.querySelectorAll('.choice').forEach(c => {
        c.disabled = true;
        if (c.dataset.sign === right) c.classList.add('correct');
    });

    if (ok) {
        correctCount++;
        score += POINTS;
        $('signBox').classList.add('ok');
        $('feedback').textContent = 'נכון! 🎉';
        if (window.KidLearnWallet) KidLearnWallet.earn(KidLearnWallet.REWARDS.answer, { reason: 'מי גדול' });
    } else {
        btn.classList.add('wrong');
        $('signBox').classList.add('bad');
        $('feedback').textContent = `${a} ${SIGN_NAME[right]} ${b}`;
    }
    $('score').textContent = score;

    nextTimer = setTimeout(() => {
        if (round >= ROUNDS) endGame();
        else nextRound();
    }, 1600);
}

function startGame() {
    clearTimeout(nextTimer);
    maxN = +document.querySelector('.opt.selected').dataset.max;
    round = 0;
    score = 0;
    correctCount = 0;
    showScreen('game-screen');
    nextRound();
}

function endGame() {
    $('finalScore').textContent = score;
    $('endInfo').textContent = `${correctCount} מתוך ${ROUNDS} נכונות`;
    $('endTitle').textContent = correctCount >= 7 ? 'כל הכבוד! 🎉' : 'יפה מאוד! המשיכו להתאמן 💪';
    showScreen('end-screen');
}

document.querySelectorAll('.opt').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
});

document.querySelectorAll('.choice').forEach(btn => {
    btn.addEventListener('click', () => answer(btn));
});

$('startBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);
$('setupBtn').addEventListener('click', () => {
    clearTimeout(nextTimer);
    showScreen('setup-screen');
});
