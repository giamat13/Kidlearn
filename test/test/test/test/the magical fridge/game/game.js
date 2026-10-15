// כל המזון במשחק
const allFoods = [
    // בריא
    { icon: "🥦", name: "ברוקולי", healthy: true },
    { icon: "🥕", name: "גזר", healthy: true },
    { icon: "🥗", name: "סלט ירקות", healthy: true },
    { icon: "🍎", name: "תפוח", healthy: true },
    { icon: "🍊", name: "תפוז", healthy: true },
    { icon: "🍋", name: "לימון", healthy: true },
    { icon: "🥛", name: "חלב", healthy: true },
    { icon: "🥚", name: "ביצים", healthy: true },
    { icon: "🍳", name: "חביתה", healthy: true },
    { icon: "🐟", name: "דג סלמון", healthy: true },
    { icon: "🍣", name: "סושי", healthy: true },
    { icon: "🍞", name: "לחם", healthy: true },
    { icon: "🌰", name: "אגוזים", healthy: true },
    { icon: "🧅", name: "בצל", healthy: true },
    { icon: "🫒", name: "זיתים", healthy: true },
    { icon: "🌴", name: "תמרים", healthy: true },
    
    // לא בריא
    { icon: "🍕", name: "פיצה", healthy: false },
    { icon: "🍔", name: "המבורגר", healthy: false },
    { icon: "🍟", name: "צ'יפס", healthy: false },
    { icon: "🍫", name: "שוקולד", healthy: false },
    { icon: "🍿", name: "תפוצ'יפס", healthy: false },
];

let score = 0;
let lives = 3;
let currentFood = null;

// אלמנטים
const foodItem = document.getElementById('foodItem');
const foodIcon = document.getElementById('foodIcon');
const foodName = document.getElementById('foodName');
const healthyBox = document.getElementById('healthyBox');
const unhealthyBox = document.getElementById('unhealthyBox');
const scoreDisplay = document.getElementById('score');
const livesDisplay = document.getElementById('lives');
const feedback = document.getElementById('feedback');
const gameOver = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');

// פונקציה לבחירת מזון אקראי
function getRandomFood() {
    const randomIndex = Math.floor(Math.random() * allFoods.length);
    return allFoods[randomIndex];
}

// פונקציה להצגת מזון חדש
function showNewFood() {
    currentFood = getRandomFood();
    foodIcon.textContent = currentFood.icon;
    foodName.textContent = currentFood.name;
    feedback.textContent = '';
    feedback.className = 'feedback';
}

// פונקציה לבדיקת התשובה
function checkAnswer(isHealthyBox) {
    const correct = (isHealthyBox && currentFood.healthy) || (!isHealthyBox && !currentFood.healthy);
    
    if (correct) {
        score += 10;
        scoreDisplay.textContent = score;
        feedback.textContent = '🎉 כל הכבוד! תשובה נכונה!';
        feedback.className = 'feedback correct';
    } else {
        lives--;
        livesDisplay.textContent = lives;
        feedback.textContent = '❌ אופס! טעות קטנה. נסה שוב!';
        feedback.className = 'feedback wrong';
        
        if (lives <= 0) {
            endGame();
            return;
        }
    }
    
    setTimeout(() => {
        showNewFood();
    }, 1500);
}

// פונקציה לסיום המשחק
function endGame() {
    finalScore.textContent = score;
    gameOver.classList.add('show');
}

// פונקציה להתחלת משחק חדש
function restartGame() {
    score = 0;
    lives = 3;
    scoreDisplay.textContent = score;
    livesDisplay.textContent = lives;
    gameOver.classList.remove('show');
    showNewFood();
}

// Drag and Drop
let draggedElement = null;

foodItem.addEventListener('dragstart', (e) => {
    draggedElement = foodItem;
    foodItem.classList.add('dragging');
});

foodItem.addEventListener('dragend', () => {
    foodItem.classList.remove('dragging');
    healthyBox.classList.remove('drag-over');
    unhealthyBox.classList.remove('drag-over');
});

// Healthy Box
healthyBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    healthyBox.classList.add('drag-over');
});

healthyBox.addEventListener('dragleave', () => {
    healthyBox.classList.remove('drag-over');
});

healthyBox.addEventListener('drop', (e) => {
    e.preventDefault();
    healthyBox.classList.remove('drag-over');
    checkAnswer(true);
});

// Unhealthy Box
unhealthyBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    unhealthyBox.classList.add('drag-over');
});

unhealthyBox.addEventListener('dragleave', () => {
    unhealthyBox.classList.remove('drag-over');
});

unhealthyBox.addEventListener('drop', (e) => {
    e.preventDefault();
    unhealthyBox.classList.remove('drag-over');
    checkAnswer(false);
});

// לחיצה על הארגזים (למובייל)
healthyBox.addEventListener('click', () => {
    if (currentFood) {
        checkAnswer(true);
    }
});

unhealthyBox.addEventListener('click', () => {
    if (currentFood) {
        checkAnswer(false);
    }
});

// התחלת המשחק
showNewFood();
