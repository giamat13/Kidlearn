const ROUNDS = 10;
const POINTS = 10;
const MIN_ITEMS = 2;
const MAX_ITEMS = 4;

// ערכי המטבעות והשטרות בשקלים. 1, 2, 5, 10 הם מטבעות; 20 ו־50 הם שטרות
const DENOMS = [1, 2, 5, 10, 20, 50];
const NOTES = new Set([20, 50]);

let maxSum = 20;
let round = 0;
let score = 0;
let correctCount = 0;
let total = 0;
let answered = false;
let nextTimer = null;

const $ = (id) => document.getElementById(id);

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

function randomInt(n) {
    return Math.floor(Math.random() * n);
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// קבוצת מטבעות/שטרות שהסכום שלה לא עובר את הגבול שנבחר
function makeSet() {
    for (let tries = 0; tries < 500; tries++) {
        const count = MIN_ITEMS + randomInt(MAX_ITEMS - MIN_ITEMS + 1);
        const items = [];
        let sum = 0;
        for (let i = 0; i < count; i++) {
            const allowed = DENOMS.filter(d => sum + d <= maxSum);
            if (allowed.length === 0) break;
            const pick = allowed[randomInt(allowed.length)];
            items.push(pick);
            sum += pick;
        }
        if (items.length >= MIN_ITEMS && sum >= 3) return items;
    }
    return [1, 2];
}

// 4 אפשרויות: הסכום הנכון + 3 סכומים קרובים אליו
function makeChoices(correct) {
    const set = new Set([correct]);
    const offsets = shuffle([-10, -5, -2, -1, 1, 2, 5, 10]);
    for (const d of offsets) {
        if (set.size >= 4) break;
        const v = correct + d;
        if (v > 0) set.add(v);
    }
    let guard = 0;
    while (set.size < 4 && guard++ < 100) set.add(1 + randomInt(maxSum + 10));
    return shuffle([...set]);
}

function drawWallet(items) {
    const box = $('wallet');
    box.innerHTML = '';
    items.forEach(v => {
        const item = document.createElement('div');
        item.className = 'coin' + (NOTES.has(v) ? ' note' : '');
        item.textContent = `₪${v}`;
        box.appendChild(item);
    });
}

function nextRound() {
    round++;
    answered = false;

    const items = makeSet();
    total = items.reduce((s, v) => s + v, 0);

    $('qNum').textContent = `${round}/${ROUNDS}`;
    $('score').textContent = score;
    $('feedback').textContent = '';
    drawWallet(items);

    const box = $('choices');
    box.innerHTML = '';
    makeChoices(total).forEach(v => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.textContent = `₪${v}`;
        btn.onclick = () => answer(v, btn);
        box.appendChild(btn);
    });
}

function answer(v, btn) {
    if (answered) return;
    answered = true;

    const ok = v === total;
    document.querySelectorAll('.choice').forEach(b => {
        b.disabled = true;
        if (b.textContent === `₪${total}`) b.classList.add('correct');
    });

    if (ok) {
        correctCount++;
        score += POINTS;
        $('feedback').textContent = 'נכון! 🎉';
        if (window.KidLearnWallet) KidLearnWallet.earn(KidLearnWallet.REWARDS.answer, { reason: 'כמה כסף' });
    } else {
        btn.classList.add('wrong');
        $('feedback').textContent = `כמעט! הסכום הוא ₪${total}`;
    }
    $('score').textContent = score;

    nextTimer = setTimeout(() => {
        if (round >= ROUNDS) endGame();
        else nextRound();
    }, 1800);
}

function startGame() {
    clearTimeout(nextTimer);
    maxSum = +document.querySelector('.opt.selected').dataset.max;
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

$('startBtn').addEventListener('click', startGame);
$('againBtn').addEventListener('click', startGame);
$('setupBtn').addEventListener('click', () => {
    clearTimeout(nextTimer);
    showScreen('setup-screen');
});
