// נתוני המדפים - קבצי JSON מוטמעים בקוד לפתרון בעיית CORS
const fridgeData = {
  shelves: [
    {
      id: "vegetables",
      label: "🥗 מדף ירקות וסלטים",
      jsonFile: "vegetables.json",
      items: [
        {
          icon: "🥦",
          name: "ברוקולי",
          type: "positive",
          title: "✓ למה ברוקולי טוב לי?",
          description: "גורם לך להיות חזק! עוזר למערכת החיסון שלך להילחם בחיידקים, שומר על העצמות שלך חזקות ועוזר לך לגדול גבוה! 🦸‍♂️"
        },
        {
          icon: "🥕",
          name: "גזר",
          type: "positive",
          title: "✓ למה גזר טוב לי?",
          description: "עוזר לשמור על עיניים בריאות! גם עושה את העור שלך יפה ועוזר לגוף שלך להילחם במחלות. גזר זה כמו סופר-פאוור לגוף! ✨"
        },
        {
          icon: "🥗",
          name: "סלט ירקות",
          type: "positive",
          title: "✓ למה סלט טוב לי?",
          description: "מלא בחומרים טובים שעושים אותך בריא! עוזר לבטן שלך לעבוד טוב, נותן לך הרבה אנרגיה ועוזר לשמור על משקל בריא. כמו דלק לגוף! 🚀"
        }
      ]
    },
    {
      id: "fruits",
      label: "🍎 מדף פירות",
      jsonFile: "fruits.json",
      items: [
        {
          icon: "🍎",
          name: "תפוח",
          type: "positive",
          title: "✓ למה תפוח טוב לי?",
          description: "תפוח עוזר לך להרגיש שבע ומלא אנרגיה! טוב ללב שלך, לשיניים שלך ועוזר לך להישאר בריא. תפוח ביום מרחיק את הרופא! 🍎❤️"
        }
      ]
    },
    {
      id: "proteins",
      label: "🥛 מדף חלבונים ומוצרי חלב",
      jsonFile: "proteins.json",
      items: [
        {
          icon: "🥛",
          name: "חלב",
          type: "positive",
          title: "✓ למה חלב טוב לי?",
          description: "עושה את העצמות והשיניים שלך חזקות מאוד! עוזר לשרירים שלך לגדול ונותן לך כוח. כמו דבק חזק לעצמות! 🦴💪"
        },
        {
          icon: "🥚",
          name: "בצים",
          type: "positive",
          title: "✓ למה ביצים טובות לי?",
          description: "ביצים מלאות בחומרים שעוזרים לך לגדול! עושות אותך חזק, עוזרות לעיניים שלך ונותנות לך הרבה אנרגיה. סופר-מזון! 🌟"
        },
        {
          icon: "🐟",
          name: "דג סלמון",
          type: "positive",
          title: "✓ למה דג טוב לי?",
          description: "דג עושה את המוח שלך חכם יותר! עוזר ללב שלך להיות חזק ועושה את העור שלך יפה. מזון-על למוח! 🧠💙"
        }
      ]
    },
    {
      id: "fast-food",
      label: "🍔 מדף מזון מהיר (לצריכה מתונה)",
      jsonFile: "fast-food.json",
      items: [
        {
          icon: "🍕",
          name: "פיצה",
          type: "negative",
          title: "⚠ שים לב",
          description: "פיצה טעימה מאוד אבל יש בה הרבה מלח ושומן. אם אוכלים הרבה פיצה, זה לא כל כך טוב לגוף. אפשר לאכול מדי פעם בתור פינוק! 🍕"
        },
        {
          icon: "🍔",
          name: "המבורגר",
          type: "negative",
          title: "⚠ שים לב",
          description: "המבורגר יש בו הרבה שומן ומלח. אם אוכלים הרבה המבורגרים, הגוף לא מרגיש טוב ואפשר להשמין. טוב לאכול רק מדי פעם! 🍔"
        },
        {
          icon: "🍟",
          name: "צ'יפס",
          type: "negative",
          title: "⚠ שים לב",
          description: "צ'יפס מטוגן בשמן ויש בו הרבה מלח. זה טעים אבל לא כל כך בריא. אם אוכלים הרבה צ'יפס, זה לא טוב ללב ולגוף. רק לפעמים! 🍟"
        }
      ]
    },
    {
      id: "snacks",
      label: "🍫 מדף חטיפים ומשקאות",
      jsonFile: "snacks.json",
      items: [
        {
          icon: "🍫",
          name: "שוקולד",
          type: "negative",
          title: "⚠ שים לב",
          description: "שוקולד מתוק וטעים אבל יש בו הרבה סוכר. אם אוכלים יותר מדי, זה יכול לגרום לכאב שיניים ולא טוב לגוף. אבל קצת שוקולד יכול לשפר את מצב הרוח ולגרום לחיוך! 🍫😊"
        }
      ]
    }
  ]
};

// טעינת המקרר מהנתונים המוטמעים
function loadFridge() {
    renderFridge(fridgeData.shelves);
}

function renderFridge(shelves) {
    const fridgeElement = document.querySelector('.fridge');
    
    shelves.forEach(shelf => {
        const shelfDiv = document.createElement('div');
        shelfDiv.className = 'shelf';
        
        const shelfLabel = document.createElement('div');
        shelfLabel.className = 'shelf-label';
        shelfLabel.textContent = shelf.label;
        
        const shelfItems = document.createElement('div');
        shelfItems.className = 'shelf-items';
        
        shelf.items.forEach(item => {
            const foodItem = createFoodItem(item);
            shelfItems.appendChild(foodItem);
        });
        
        shelfDiv.appendChild(shelfLabel);
        shelfDiv.appendChild(shelfItems);
        fridgeElement.appendChild(shelfDiv);
    });
}

function createFoodItem(item) {
    const foodItem = document.createElement('div');
    foodItem.className = 'food-item';
    
    const foodIcon = document.createElement('div');
    foodIcon.className = 'food-icon';
    foodIcon.textContent = item.icon;
    
    const foodName = document.createElement('div');
    foodName.className = 'food-name';
    foodName.textContent = item.name;
    
    const foodInfo = document.createElement('div');
    foodInfo.className = 'food-info';
    
    const infoTitle = document.createElement('div');
    infoTitle.className = `info-title ${item.type}`;
    infoTitle.textContent = item.title;
    
    const description = document.createTextNode(item.description);
    
    foodInfo.appendChild(infoTitle);
    foodInfo.appendChild(description);
    
    foodItem.appendChild(foodIcon);
    foodItem.appendChild(foodName);
    foodItem.appendChild(foodInfo);
    
    return foodItem;
}

// טעינת המקרר כשהדף נטען
document.addEventListener('DOMContentLoaded', loadFridge);
