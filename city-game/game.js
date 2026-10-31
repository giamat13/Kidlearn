// עיר לבנייה — בונים עם כסף Kidlearn.
// המחירים נגזרים מ-REWARDS כדי להישאר בפרופורציה לשאר המשחקים:
//   דרך ועץ = מחיר יצירה (create), בית = מחיר רמה (level), בית ספר = מחיר משחק מושלם (perfect).

const COLS = 5;
const ROWS = 4;
const STORE_KEY = 'kidlearn-city';   // שמירת העיר במכשיר של הילד בלבד

const W = window.KidLearnWallet;
const R = W ? W.REWARDS : { create: 5, level: 10, perfect: 20 };

const ITEMS = [
    { id: 'road',   name: 'דרך',     icon: '🛣️', price: R.create },
    { id: 'tree',   name: 'עץ',      icon: '🌳', price: R.create },
    { id: 'house',  name: 'בית',     icon: '🏠', price: R.level },
    { id: 'school', name: 'בית ספר', icon: '🏫', price: R.perfect },
];

const $ = (id) => document.getElementById(id);
let selected = 'house';
let grid = loadGrid();

function itemById(id) {
    return ITEMS.find(x => x.id === id);
}

function balance() {
    return W ? W.balance() : 0;
}

function loadGrid() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (Array.isArray(saved) && saved.length === COLS * ROWS) return saved;
    } catch (e) { /* אין אחסון — מתחילים עיר ריקה */ }
    return new Array(COLS * ROWS).fill(null);
}

function saveGrid() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(grid)); } catch (e) {}
}

function feedback(msg) {
    $('feedback').textContent = msg;
}

// --- ציור ---
function renderShop() {
    const box = $('shop');
    box.innerHTML = '';
    const bal = balance();
    ITEMS.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'shop-item';
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(item.id === selected));
        if (item.id === selected) btn.classList.add('selected');
        if (bal < item.price) btn.classList.add('cant');
        btn.innerHTML = `<span class="icon">${item.icon}</span><span class="name">${item.name}</span><span class="price">${item.price} 🪙</span>`;
        btn.onclick = () => {
            selected = item.id;
            renderShop();
            $('hint').textContent = `נבחר: ${item.name}. לחצו על חלקה ריקה כדי לבנות.`;
        };
        box.appendChild(btn);
    });
}

function renderGrid() {
    const box = $('grid');
    box.innerHTML = '';
    grid.forEach((id, i) => {
        const tile = document.createElement('button');
        tile.className = 'tile' + (id ? ' built' : '');
        tile.setAttribute('aria-label', id ? `${itemById(id).name} — לחצו כדי להחזיר חצי מחיר` : 'חלקה ריקה');
        tile.textContent = id ? itemById(id).icon : '';
        tile.onclick = () => onTile(i);
        box.appendChild(tile);
    });
}

function renderCounts() {
    const counts = {};
    grid.forEach(id => { if (id) counts[id] = (counts[id] || 0) + 1; });
    const parts = ITEMS.filter(item => counts[item.id]).map(item => `${item.icon} ${counts[item.id]} ${item.name}`);
    $('counts').textContent = parts.length ? `בעיר שלכם: ${parts.join(' · ')}` : 'העיר עוד ריקה. זמן לבנות!';
}

function renderAll() {
    renderShop();
    renderGrid();
    renderCounts();
}

// --- פעולות ---
function onTile(i) {
    if (grid[i]) return removeAt(i);
    place(i);
}

function place(i) {
    const item = itemById(selected);
    const bal = balance();
    if (!W) return feedback('אי אפשר לבנות עכשיו 🪙');
    if (bal < item.price) {
        return feedback(`חסרים לכם ${item.price - bal} 🪙 כדי לבנות ${item.name}`);
    }
    if (!W.spend(item.price)) return feedback('משהו השתבש, נסו שוב');
    grid[i] = item.id;
    saveGrid();
    renderAll();
    feedback(`בניתם ${item.name}! −${item.price} 🪙`);
}

function removeAt(i) {
    const item = itemById(grid[i]);
    const refund = Math.floor(item.price / 2);
    grid[i] = null;
    saveGrid();
    if (W && refund > 0) W.earn(refund, { reason: `החזר ${item.name}` });
    renderAll();
    feedback(`הורדתם ${item.name}. הוחזרו ${refund} 🪙`);
}

// --- התחלה ---
if (W) {
    W.onChange((bal) => {
        $('balance').textContent = bal;
        renderShop();
    });
} else {
    $('balance').textContent = 0;
}
renderAll();
