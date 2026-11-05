const ROUNDS = 10;
const POINTS = 10;

// דקות שמותר לתרגל, לפי הרמה שנבחרה
const LEVELS = {
    hour: [0],
    half: [0, 30],
    quarter: [0, 15, 30, 45],
};

let level = 'half';
let round = 0;
let score = 0;
let correctCount = 0;
let target = null;      // { h, m } — השעה שהשעון מראה
let answered = false;
let hintUsed = false;
let nextTimer = null;

const HINT_COST = 2;    // מטבעות לרמז

const $ = (id) => document.getElementById(id);
const SVG_NS = 'http://www.w3.org/2000/svg';

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function fmt(t) {
    return `${t.h}:${pad(t.m)}`;
}

function randomInt(n) {
    return Math.floor(Math.random() * n);
}

function randomTime() {
    const minutes = LEVELS[level];
    return { h: randomInt(12) + 1, m: minutes[randomInt(minutes.length)] };
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// 4 אפשרויות: התשובה הנכונה + 3 שעות אחרות שונות
function makeChoices(correctT) {
    const seen = new Set([fmt(correctT)]);
    const list = [correctT];
    let guard = 0;
    while (list.length < 4 && guard++ < 500) {
        const t = randomTime();
        if (!seen.has(fmt(t))) {
            seen.add(fmt(t));
            list.push(t);
        }
    }
    return shuffle(list);
}

// --- ציור השעון ב-SVG ---
// זווית 0 = 12 למעלה, והזוויות עולות עם כיוון השעון
function polar(r, deg) {
    const rad = deg * Math.PI / 180;
    return [100 + r * Math.sin(rad), 100 - r * Math.cos(rad)];
}

function el(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

function drawClock(t) {
    const svg = $('clock');
    svg.innerHTML = '';

    svg.appendChild(el('circle', { cx: 100, cy: 100, r: 96, fill: '#fff', stroke: '#5b4b8a', 'stroke-width': 6 }));

    // סימני שעה
    for (let i = 0; i < 12; i++) {
        const [x1, y1] = polar(84, i * 30);
        const [x2, y2] = polar(93, i * 30);
        svg.appendChild(el('line', { x1, y1, x2, y2, stroke: '#5b4b8a', 'stroke-width': 4, 'stroke-linecap': 'round' }));
    }

    // מספרים 1-12
    for (let n = 1; n <= 12; n++) {
        const [x, y] = polar(70, (n % 12) * 30);
        const text = el('text', {
            x, y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
            'font-size': 20, 'font-weight': 800, fill: '#2a2560',
        });
        text.textContent = n;
        svg.appendChild(text);
    }

    // מחוג שעות (קצר ועבה) — זווית = השעה + חלק השעה שעברה
    const hourAngle = ((t.h % 12) + t.m / 60) * 30;
    const [hx, hy] = polar(48, hourAngle);
    svg.appendChild(el('line', { class: 'hour-hand', x1: 100, y1: 100, x2: hx, y2: hy, stroke: '#f72585', 'stroke-width': 9, 'stroke-linecap': 'round' }));

    // מחוג דקות (ארוך ודק)
    const [mx, my] = polar(72, t.m * 6);
    svg.appendChild(el('line', { x1: 100, y1: 100, x2: mx, y2: my, stroke: '#2a2560', 'stroke-width': 5, 'stroke-linecap': 'round' }));

    svg.appendChild(el('circle', { cx: 100, cy: 100, r: 6, fill: '#2a2560' }));
}

// --- מהלך המשחק ---
function startGame() {
    clearTimeout(nextTimer);
    level = document.querySelector('.opt.selected').dataset.level;
    round = 0;
    score = 0;
    correctCount = 0;
    showScreen('game-screen');
    nextRound();
}

function nextRound() {
    round++;
    answered = false;
    hintUsed = false;
    target = randomTime();

    $('qNum').textContent = `${round}/${ROUNDS}`;
    $('score').textContent = score;
    $('feedback').textContent = '';
    $('hintBtn').disabled = false;
    drawClock(target);

    const box = $('choices');
    box.innerHTML = '';
    makeChoices(target).forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.textContent = fmt(t);
        btn.onclick = () => answer(t, btn);
        box.appendChild(btn);
    });
}

// רמז: מדגיש את מחוג השעות. עולה HINT_COST מטבעות מהארנק המשותף
function useHint() {
    if (answered || hintUsed) return;
    if (!window.KidLearnWallet || !KidLearnWallet.spend(HINT_COST)) {
        $('feedback').textContent = 'אין מספיק כסף לרמז 🪙';
        return;
    }
    hintUsed = true;
    $('hintBtn').disabled = true;
    KidLearnWallet.toast(`−${HINT_COST} 💰 רמז`);
    document.querySelector('#clock .hour-hand').classList.add('hint-on');
    $('feedback').textContent = 'המחוג הצהוב הקצר מראה את השעה 👆';
}

function answer(t, btn) {
    if (answered) return;
    answered = true;
    $('hintBtn').disabled = true;

    const right = fmt(target);
    const ok = fmt(t) === right;

    document.querySelectorAll('.choice').forEach(b => {
        b.disabled = true;
        if (b.textContent === right) b.classList.add('correct');
    });

    if (ok) {
        correctCount++;
        score += POINTS;
        $('feedback').textContent = 'נכון! 🎉';
        if (window.KidLearnWallet) KidLearnWallet.earn(KidLearnWallet.REWARDS.answer, { reason: 'השעון' });
    } else {
        btn.classList.add('wrong');
        $('feedback').textContent = `כמעט! השעה היא ${right}`;
    }
    $('score').textContent = score;

    nextTimer = setTimeout(() => {
        if (round >= ROUNDS) endGame();
        else nextRound();
    }, 1600);
}

function endGame() {
    $('finalScore').textContent = score;
    $('endInfo').textContent = `${correctCount} מתוך ${ROUNDS} נכונות`;
    $('endTitle').textContent = correctCount >= 7 ? 'כל הכבוד! 🎉' : 'יפה מאוד! המשיכו להתאמן 💪';
    showScreen('end-screen');
}

// --- חיבור כפתורים ---
document.querySelectorAll('.opt').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.opt').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    });
});

$('startBtn').addEventListener('click', startGame);
$('hintBtn').addEventListener('click', useHint);
$('againBtn').addEventListener('click', startGame);
$('setupBtn').addEventListener('click', () => {
    clearTimeout(nextTimer);
    showScreen('setup-screen');
});
