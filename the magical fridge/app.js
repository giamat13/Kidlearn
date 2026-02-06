// הגדרת המבנה של המקרר - רק מטא-דאטה על המדפים
const fridgeStructure = {
  shelves: [
    {
      id: "vegetables",
      label: "🥗 מדף ירקות וסלטים",
      jsonFile: "vegetables.json"
    },
    {
      id: "fruits",
      label: "🍎 מדף פירות",
      jsonFile: "fruits.json"
    },
    {
      id: "proteins",
      label: "🥛 מדף חלבונים ומוצרי חלב",
      jsonFile: "proteins.json"
    },
    {
      id: "fast-food",
      label: "🍔 מדף מזון מהיר (לצריכה מתונה)",
      jsonFile: "fast-food.json"
    },
    {
      id: "snacks",
      label: "🍫 מדף חטיפים ומשקאות",
      jsonFile: "snacks.json"
    }
  ]
};

// טעינת המקרר - טוען את כל הנתונים מקבצי JSON
async function loadFridge() {
    try {
        const shelvesWithData = await Promise.all(
            fridgeStructure.shelves.map(async (shelf) => {
                const response = await fetch(`food/${shelf.jsonFile}`);
                if (!response.ok) {
                    throw new Error(`Failed to load ${shelf.jsonFile}`);
                }
                const items = await response.json();
                return {
                    ...shelf,
                    items: items
                };
            })
        );
        
        renderFridge(shelvesWithData);
    } catch (error) {
        console.error('Error loading fridge data:', error);
        const fridgeElement = document.querySelector('.fridge');
        fridgeElement.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">שגיאה בטעינת נתוני המקרר. אנא בדוק את קבצי ה-JSON בתיקיית food/</div>';
    }
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
