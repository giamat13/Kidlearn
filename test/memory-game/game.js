// משתני המשחק
let cards = [];
let flippedCards = [];
let matchedPairs = 0;
let moves = 0;
let timer = 0;
let timerInterval = null;
let gameStarted = false;

// פונקציות Cookies
function setCookie(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

// פונקציות ניהול הקלפים שנאספו
function getCollectedCards() {
    const collected = getCookie('collectedCards');
    return collected ? JSON.parse(collected) : [];
}

function addCollectedCard(card) {
    let collected = getCollectedCards();
    if (!collected.includes(card)) {
        collected.push(card);
        setCookie('collectedCards', JSON.stringify(collected));
    }
}

function displayCollectedCards() {
    const collectedCardsDiv = document.getElementById('collectedCards');
    const collected = getCollectedCards();
    
    if (collected.length === 0) {
        collectedCardsDiv.innerHTML = '<div class="no-cards">עדיין לא אספת קלפים. שחק כדי לאסוף!</div>';
    } else {
        collectedCardsDiv.innerHTML = collected
            .map(card => `<div class="collected-card">${card}</div>`)
            .join('');
    }
}

// פונקציית ערבוב מערך
function shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// יצירת לוח המשחק
function createBoard() {
    const availableCards = getAvailableCards();
    const selectedCards = shuffle(availableCards).slice(0, CONFIG.pairsCount);
    const gameCards = shuffle([...selectedCards, ...selectedCards]);
    
    const gameBoard = document.getElementById('gameBoard');
    gameBoard.innerHTML = '';
    
    cards = gameCards.map((value, index) => ({
        id: index,
        value: value,
        flipped: false,
        matched: false
    }));
    
    cards.forEach((card, index) => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.dataset.id = index;
        cardElement.innerHTML = `
            <div class="card-back">?</div>
            <div class="card-value">${card.value}</div>
        `;
        cardElement.addEventListener('click', () => flipCard(index));
        gameBoard.appendChild(cardElement);
    });
}

// הפיכת קלף
function flipCard(index) {
    if (!gameStarted) {
        startTimer();
        gameStarted = true;
    }
    
    const card = cards[index];
    const cardElement = document.querySelector(`[data-id="${index}"]`);
    
    // בדיקות תקינות
    if (card.flipped || card.matched || flippedCards.length === 2) {
        return;
    }
    
    // הפיכת הקלף
    card.flipped = true;
    cardElement.classList.add('flipped');
    flippedCards.push(index);
    
    // בדיקה אם הופכו 2 קלפים
    if (flippedCards.length === 2) {
        moves++;
        updateStats();
        checkMatch();
    }
}

// בדיקת התאמה
function checkMatch() {
    const [index1, index2] = flippedCards;
    const card1 = cards[index1];
    const card2 = cards[index2];
    
    const cardElement1 = document.querySelector(`[data-id="${index1}"]`);
    const cardElement2 = document.querySelector(`[data-id="${index2}"]`);
    
    if (card1.value === card2.value) {
        // זוג נמצא!
        setTimeout(() => {
            card1.matched = true;
            card2.matched = true;
            cardElement1.classList.add('matched');
            cardElement2.classList.add('matched');
            
            // הוספת הקלף לאוסף
            addCollectedCard(card1.value);
            
            matchedPairs++;
            flippedCards = [];
            updateStats();
            
            // בדיקת ניצחון
            if (matchedPairs === CONFIG.pairsCount) {
                setTimeout(showVictory, 500);
            }
        }, 500);
    } else {
        // לא התאים - הפיכה חזרה
        setTimeout(() => {
            card1.flipped = false;
            card2.flipped = false;
            cardElement1.classList.remove('flipped');
            cardElement2.classList.remove('flipped');
            flippedCards = [];
        }, 1000);
    }
}

// עדכון סטטיסטיקות
function updateStats() {
    document.getElementById('moves').textContent = moves;
    document.getElementById('pairs').textContent = `${matchedPairs}/${CONFIG.pairsCount}`;
}

// טיימר
function startTimer() {
    timerInterval = setInterval(() => {
        timer++;
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        document.getElementById('timer').textContent = 
            `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// הצגת הודעת ניצחון
function showVictory() {
    stopTimer();
    
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    document.getElementById('finalStats').textContent = 
        `סיימת ב-${moves} מהלכים ותוך ${timeStr}`;
    
    document.getElementById('overlay').classList.add('show');
    document.getElementById('victoryMessage').classList.add('show');
}

function closeVictory() {
    document.getElementById('overlay').classList.remove('show');
    document.getElementById('victoryMessage').classList.remove('show');
}

// התחלת משחק חדש
function startGame() {
    // איפוס משתנים
    matchedPairs = 0;
    moves = 0;
    timer = 0;
    gameStarted = false;
    flippedCards = [];
    
    // עצירת טיימר קודם
    stopTimer();
    
    // עדכון תצוגה
    updateStats();
    document.getElementById('timer').textContent = '00:00';
    
    // יצירת לוח חדש
    createBoard();
    
    // סגירת הודעת ניצחון אם פתוחה
    closeVictory();
}

// איפוס סטטיסטיקות
function resetStats() {
    if (confirm('האם אתה בטוח שברצונך לאפס את כל הקלפים שאספת?')) {
        deleteCookie('collectedCards');
        displayCollectedCards();
        alert('הסטטיסטיקות אופסו!');
    }
}

// החלפת טאבים
function switchTab(tab) {
    // עדכון כפתורי הטאבים
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    // עדכון תוכן הטאבים
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    if (tab === 'game') {
        document.getElementById('game-tab').classList.add('active');
    } else if (tab === 'mycards') {
        document.getElementById('mycards-tab').classList.add('active');
        displayCollectedCards();
    }
}

// אתחול המשחק בטעינת הדף
window.addEventListener('load', () => {
    startGame();
    displayCollectedCards();
});

function shareAchievement(){
  window.location.href=`../send-message/?game=memory&score=${moves}`;
}
