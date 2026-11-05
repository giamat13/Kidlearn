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
let hintUsed = false;
let nextTimer = null;

const HINT_COST = 2;    // מטבעות לרמז

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
    hintUsed = false;
    [a, b] = newPair();

    $('qNum').textContent = `${round}/${ROUNDS}`;
    $('score').textContent = score;
    $('numA').textContent = a;
    $('numB').textContent = b;
    $('numA').classList.remove('hint-on');
    $('numB').classList.remove('hint-on');
    $('signBox').textContent = '?';
    $('signBox').classList.remove('ok', 'bad');
    $('feedback').textContent = '';
    $('hintBtn').disabled = false;

    document.querySelectorAll('.choice').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('correct', 'wrong');
    });
}

// רמז: מדגיש את המספר הקטן (או את שניהם אם הם שווים). עולה HINT_COST מטבעות מהארנק המשותף
function useHint() {
    if (answered || hintUsed) return;
    if (!window.KidLearnWallet || !KidLearnWallet.spend(HINT_COST)) {
        $('feedback').textContent = 'אין מספיק כסף לרמז 🪙';
        return;
    }
    hintUsed = true;
    $('hintBtn').disabled = true;
    KidLearnWallet.toast(`−${HINT_COST} 💰 רמז`);

    if (a === b) {
        $('numA').classList.add('hint-on');
        $('numB').classList.add('hint-on');
        $('feedback').textContent = 'שני המספרים שווים, לכן שניהם מסומנים 👆';
    } else {
        const smaller = a < b ? 'numA' : 'numB';
        $('numA').classList.toggle('hint-on', smaller === 'numA');
        $('numB').classList.toggle('hint-on', smaller === 'numB');
        $('feedback').textContent = 'המספר המסומן הוא הקטן יותר 👆';
    }
}

function answer(btn) {
    if (answered) return;
    answered = true;
    $('hintBtn').disabled = true;

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
$('hintBtn').addEventListener('click', useHint);
$('againBtn').addEventListener('click', startGame);
$('setupBtn').addEventListener('click', () => {
    clearTimeout(nextTimer);
    showScreen('setup-screen');
});
