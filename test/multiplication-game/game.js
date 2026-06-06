const QUESTIONS_PER_ROUND = 10;
const QUESTION_TIME = 30;      // שניות לכל שאלה
const MAX_BASE_POINTS = 100;   // ניקוד מקסימלי לשאלה
const MIN_BASE_POINTS = 5;     // ניקוד מינימלי אם ענו ברגע האחרון
const STREAK_BONUS = 5;        // בונוס לכל תשובה ברצף

let selectedTables = [2, 3, 4, 5];
let score = 0;
let streak = 0;
let maxStreak = 0;
let correctCount = 0;
let currentQuestion = null;
let questionIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let answered = false;
let questions = [];

// --- הגדרות ---
function buildTablesGrid() {
    const grid = document.getElementById('tablesGrid');
    grid.innerHTML = '';
    for (let i = 2; i <= 10; i++) {
        const btn = document.createElement('button');
        btn.className = 'table-btn' + (selectedTables.includes(i) ? ' selected' : '');
        btn.textContent = '×' + i;
        btn.onclick = () => toggleTable(i, btn);
        grid.appendChild(btn);
    }
    updateStartBtn();
}

function toggleTable(num, btn) {
    if (selectedTables.includes(num)) {
        selectedTables = selectedTables.filter(t => t !== num);
        btn.classList.remove('selected');
    } else {
        selectedTables.push(num);
        btn.classList.add('selected');
    }
    updateStartBtn();
}

function selectAll() {
    selectedTables = [2, 3, 4, 5, 6, 7, 8, 9, 10];
    buildTablesGrid();
}

function clearAll() {
    selectedTables = [];
    buildTablesGrid();
}

function updateStartBtn() {
    document.getElementById('startBtn').disabled = selectedTables.length === 0;
}

// --- שאלות ---
function generateQuestions() {
    const pool = [];
    for (const t of selectedTables) {
        for (let i = 1; i <= 10; i++) {
            pool.push({ a: t, b: i });
        }
    }
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, QUESTIONS_PER_ROUND);
}

function generateAnswers(correct) {
    const answers = new Set([correct]);
    while (answers.size < 4) {
        const offset = Math.floor(Math.random() * 20) - 10;
        const candidate = correct + offset;
        if (candidate > 0 && candidate !== correct) answers.add(candidate);
    }
    return shuffle([...answers]);
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ניקוד רציף: יורד ליניארית עם הזמן
function calcBasePoints(remaining) {
    const ratio = Math.max(0, remaining / QUESTION_TIME);
    return Math.round(MIN_BASE_POINTS + (MAX_BASE_POINTS - MIN_BASE_POINTS) * ratio);
}

// --- משחק ---
function startGame() {
    score = 0;
    streak = 0;
    maxStreak = 0;
    correctCount = 0;
    questionIndex = 0;
    questions = generateQuestions();

    document.getElementById('setup-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';

    updateScoreDisplay();
    showQuestion();
}

function showQuestion() {
    if (questionIndex >= questions.length) {
        endGame();
        return;
    }

    answered = false;
    currentQuestion = questions[questionIndex];
    const correct = currentQuestion.a * currentQuestion.b;

    document.getElementById('questionText').textContent =
        `${currentQuestion.a} × ${currentQuestion.b} = ?`;
    document.getElementById('questionNum').textContent =
        `${questionIndex + 1}/${questions.length}`;
    document.getElementById('feedbackArea').innerHTML = '';

    const answers = generateAnswers(correct);
    const grid = document.getElementById('answersGrid');
    grid.innerHTML = '';
    answers.forEach(ans => {
        const btn = document.createElement('button');
        btn.className = 'answer-btn';
        btn.textContent = ans;
        btn.onclick = () => handleAnswer(ans, correct, btn);
        grid.appendChild(btn);
    });

    startTimer();
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = QUESTION_TIME;
    updateTimerBar();
    updateLivePoints();

    timerInterval = setInterval(() => {
        timeLeft = Math.max(0, timeLeft - 0.1);
        updateTimerBar();
        updateLivePoints();

        if (timeLeft === 0) {
            clearInterval(timerInterval);
            timeOut();
        }
    }, 100);
}

function updateTimerBar() {
    const pct = (timeLeft / QUESTION_TIME) * 100;
    const bar = document.getElementById('timerBar');
    bar.style.width = pct + '%';
    bar.classList.toggle('urgent', pct < 30);
}

function updateLivePoints() {
    const pts = calcBasePoints(timeLeft);
    const total = pts + streak * STREAK_BONUS;
    const el = document.getElementById('livePoints');
    el.innerHTML = `ניקוד אפשרי: <span>${total}</span>`;
    el.classList.toggle('urgent', (timeLeft / QUESTION_TIME) < 0.3);
}

function handleAnswer(chosen, correct, btn) {
    if (answered) return;
    answered = true;
    clearInterval(timerInterval);

    const allBtns = document.querySelectorAll('.answer-btn');
    allBtns.forEach(b => b.disabled = true);

    if (chosen === correct) {
        btn.classList.add('correct');
        const pts = calcBasePoints(timeLeft) + streak * STREAK_BONUS;
        score += pts;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        correctCount++;
        showFeedback(true);
        showScorePopup(btn, '+' + pts);
    } else {
        btn.classList.add('wrong');
        allBtns.forEach(b => {
            if (parseInt(b.textContent) === correct) b.classList.add('reveal');
        });
        streak = 0;
        showFeedback(false);
    }

    updateScoreDisplay();
    document.getElementById('livePoints').innerHTML = '';
    questionIndex++;
    setTimeout(showQuestion, 1200);
}

function timeOut() {
    if (answered) return;
    answered = true;

    const correct = currentQuestion.a * currentQuestion.b;
    document.querySelectorAll('.answer-btn').forEach(b => {
        b.disabled = true;
        if (parseInt(b.textContent) === correct) b.classList.add('reveal');
    });
    streak = 0;
    updateScoreDisplay();
    showFeedback(null);
    document.getElementById('livePoints').innerHTML = '';
    questionIndex++;
    setTimeout(showQuestion, 1500);
}

function showFeedback(correct) {
    const area = document.getElementById('feedbackArea');
    if (correct === true) {
        const praise = ['מעולה! 🌟', 'כל הכבוד! 🎉', 'נכון! ✅', 'מדהים! 🔥', 'יפה מאוד! 💪'];
        area.innerHTML = `<span class="feedback-msg">${praise[Math.floor(Math.random() * praise.length)]}</span>`;
    } else if (correct === false) {
        area.innerHTML = `<span class="feedback-msg" style="color:#fca5a5">לא נכון 😕</span>`;
    } else {
        area.innerHTML = `<span class="feedback-msg" style="color:#fca5a5">נגמר הזמן ⏰</span>`;
    }
}

function updateScoreDisplay() {
    document.getElementById('scoreDisplay').textContent = score;
    document.getElementById('streakDisplay').textContent = streak;
}

function showScorePopup(btn, text) {
    const rect = btn.getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = text;
    popup.style.left = (rect.left + rect.width / 2 - 20) + 'px';
    popup.style.top = (rect.top + window.scrollY - 10) + 'px';
    document.body.appendChild(popup);
    popup.addEventListener('animationend', () => popup.remove());
}

// --- סיום ---
function endGame() {
    clearInterval(timerInterval);
    document.getElementById('game-screen').style.display = 'none';

    const record = getRecord();
    const isRecord = score > record;
    if (isRecord) saveRecord(score);

    document.getElementById('finalScore').textContent = score;
    document.getElementById('endCorrect').textContent = `${correctCount}/${questions.length}`;
    document.getElementById('endStreak').textContent = maxStreak;
    document.getElementById('endRecord').textContent = isRecord ? score : Math.max(score, record);
    document.getElementById('recordBadge').style.display = isRecord ? 'inline-block' : 'none';

    const pct = correctCount / questions.length;
    const title = pct === 1 ? '🏆 מושלם!' : pct >= 0.8 ? '🌟 כל הכבוד!' : pct >= 0.6 ? '😊 יפה!' : '💪 נסה שוב!';
    document.getElementById('endTitle').textContent = title;

    document.getElementById('end-screen').style.display = 'block';
}

function goToSetup() {
    clearInterval(timerInterval);
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('setup-screen').style.display = 'block';
}

// --- שיא ---
function getRecord() {
    return parseInt(localStorage.getItem('multiplicationRecord') || '0');
}
function saveRecord(s) {
    localStorage.setItem('multiplicationRecord', s);
}

window.addEventListener('load', buildTablesGrid);
