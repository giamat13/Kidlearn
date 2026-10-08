// קובץ הגדרות למשחק הזיכרון
const CONFIG = {
    // סוג הקלפים: 'numbers' - רק מספרים, 'letters' - רק אותיות, 'both' - שניהם
    cardType: 'both', // ברירת מחדל: שניהם
    
    // מספרים זמינים (0-9)
    numbers: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    
    // אותיות זמינות (א-ת)
    letters: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'],
    
    // מספר זוגות במשחק
    pairsCount: 8
};

// פונקציה לקבלת קלפים לפי ההגדרות
function getAvailableCards() {
    let availableCards = [];
    
    switch(CONFIG.cardType) {
        case 'numbers':
            availableCards = [...CONFIG.numbers];
            break;
        case 'letters':
            availableCards = [...CONFIG.letters];
            break;
        case 'both':
        default:
            availableCards = [...CONFIG.numbers, ...CONFIG.letters];
            break;
    }
    
    return availableCards;
}
