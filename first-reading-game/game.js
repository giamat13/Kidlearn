const SENTENCES_PER_ROUND = 6;
const POINTS_PER_CORRECT = 40;
const STREAK_BONUS = 10;
const MISTAKE_PENALTY = 5;

let score = 0;
let streak = 0;
let maxStreak = 0;
let correctCount = 0;
let roundIndex = 0;
let roundItems = [];
let currentBuild = [];       // מילים שנבחרו לפי סדר
let tilesState = [];         // מצב זמינות של כל אריח במאגר הנוכחי
let targetSequence = [];     // רצף המילים הנכון

// --- כניסה למשחק ---
function startGame() {
    score = 0;
    streak = 0;
    maxStreak = 0;
    correctCount = 0;
    roundIndex = 0;

    document.getElementById('end-screen').style.display = 'none';
    document.getElementById('sentence-screen').style.display = 'block';

    roundItems = pickRandom(SENTENCE_BANK, SENTENCES_PER_ROUND);
    updateSentenceScore();
    showSentenceItem();
}

function pickRandom(arr, n) {
    const copy = shuffle(arr);
    return copy.slice(0, Math.min(n, copy.length));
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function shuffleIndices(n) {
    const idx = Array.from({ length: n }, (_, i) => i);
    return shuffle(idx);
}

// ===================== המשפט הראשון שלי =====================

function showSentenceItem() {
    if (roundIndex >= roundItems.length) {
        endGame();
        return;
    }

    const item = roundItems[roundIndex];
    targetSequence = [...item.words];
    currentBuild = [];

    document.getElementById('sentenceEmoji').textContent = item.emoji;
    document.getElementById('sQuestionNum').textContent = `${roundIndex + 1}/${roundItems.length}`;
    document.getElementById('sFeedbackArea').innerHTML = '';

    const slotsWrap = document.getElementById('sentenceSlots');
    slotsWrap.innerHTML = '';
    targetSequence.forEach(() => {
        const slot = document.createElement('div');
        slot.className = 'build-slot';
        slotsWrap.appendChild(slot);
    });

    let wordPool = [...targetSequence];
    tilesState = wordPool.map(() => true);
    const shuffledOrder = shuffleIndices(wordPool.length);

    const bank = document.getElementById('wordBank');
    bank.innerHTML = '';
    shuffledOrder.forEach(origIdx => {
        const btn = document.createElement('button');
        btn.className = 'tile-btn';
        btn.textContent = wordPool[origIdx];
        btn.dataset.idx = origIdx;
        btn.onclick = () => pickSentenceWord(origIdx, btn);
        bank.appendChild(btn);
    });
}

function pickSentenceWord(origIdx, btn) {
    if (!tilesState[origIdx]) return;
    tilesState[origIdx] = false;
    btn.disabled = true;

    currentBuild.push({ origIdx, word: btn.textContent, btn });
    renderSentenceSlots();

    if (currentBuild.length === targetSequence.length) {
        checkSentenceAnswer();
    }
}

function renderSentenceSlots() {
    const slots = document.querySelectorAll('#sentenceSlots .build-slot');
    slots.forEach((slot, i) => {
        if (currentBuild[i]) {
            slot.textContent = currentBuild[i].word;
            slot.classList.add('filled');
        } else {
            slot.textContent = '';
            slot.classList.remove('filled');
        }
    });
    slots.forEach((slot, i) => {
        slot.onclick = () => {
            if (currentBuild[i]) returnSentenceWord(i);
        };
    });
}

function returnSentenceWord(slotIndex) {
    const entry = currentBuild[slotIndex];
    if (!entry) return;
    tilesState[entry.origIdx] = true;
    entry.btn.disabled = false;
    currentBuild.splice(slotIndex, 1);
    renderSentenceSlots();
}

function clearSentenceBuild() {
    currentBuild.forEach(entry => {
        tilesState[entry.origIdx] = true;
        entry.btn.disabled = false;
    });
    currentBuild = [];
    renderSentenceSlots();
}

function checkSentenceAnswer() {
    const built = currentBuild.map(e => e.word).join(' ');
    const correct = built === targetSequence.join(' ');

    document.querySelectorAll('#wordBank .tile-btn').forEach(b => b.disabled = true);
    const slots = document.querySelectorAll('#sentenceSlots .build-slot');

    if (correct) {
        slots.forEach(s => s.classList.add('correct-flash'));
        const pts = POINTS_PER_CORRECT + streak * STREAK_BONUS;
        score += pts;
        streak++;
        if (streak > maxStreak) maxStreak = streak;
        correctCount++;
        showFeedback('sFeedbackArea', true);
    } else {
        slots.forEach(s => s.classList.add('wrong-flash'));
        score = Math.max(0, score - MISTAKE_PENALTY);
        streak = 0;
        showFeedback('sFeedbackArea', false);
    }

    updateSentenceScore();
    roundIndex++;
    setTimeout(showSentenceItem, 1400);
}

function updateSentenceScore() {
    document.getElementById('sScoreDisplay').textContent = score;
    document.getElementById('sStreakDisplay').textContent = streak;
}

// ===================== משותף: פידבק / סיום =====================

function showFeedback(areaId, correct) {
    const area = document.getElementById(areaId);
    if (correct) {
        const praise = ['מעולה! 🌟', 'כל הכבוד! 🎉', 'נכון! ✅', 'מדהים! 🔥', 'יפה מאוד! 💪'];
        area.innerHTML = `<span class="feedback-msg">${praise[Math.floor(Math.random() * praise.length)]}</span>`;
    } else {
        area.innerHTML = `<span class="feedback-msg" style="color:#fca5a5">כמעט! נסו שוב בפעם הבאה 😊</span>`;
    }
}

function endGame() {
    document.getElementById('sentence-screen').style.display = 'none';

    const record = getRecord();
    const isRecord = score > record;
    if (isRecord) saveRecord(score);

    document.getElementById('finalScore').textContent = score;
    document.getElementById('endCorrect').textContent = `${correctCount}/${roundItems.length}`;
    document.getElementById('endStreak').textContent = maxStreak;
    document.getElementById('endRecord').textContent = isRecord ? score : Math.max(score, record);
    document.getElementById('recordBadge').style.display = isRecord ? 'inline-block' : 'none';

    const pct = correctCount / roundItems.length;
    const title = pct === 1 ? '🏆 מושלם!' : pct >= 0.8 ? '🌟 כל הכבוד!' : pct >= 0.6 ? '😊 יפה!' : '💪 נסה שוב!';
    document.getElementById('endTitle').textContent = title;

    document.getElementById('end-screen').style.display = 'block';
}

// --- שיא ---
function getRecord() {
    return parseInt(localStorage.getItem('firstReadingRecord') || '0');
}
function saveRecord(s) {
    localStorage.setItem('firstReadingRecord', s);
}

window.addEventListener('load', startGame);
