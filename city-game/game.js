// עיר לבנייה — תלת-ממד עם Three.js (הקובץ מקומי ב-vendor/, בלי רשת).
// העיר מתרחבת: קונים שטח חדש ליד השטח הקיים (חלקות בהירות עם דגל). דרך מתחברת אוטומטית
// לכל דרך שלידה, ובית מקבל שביל קצר מהכניסה אל הדרך.
// המחירים נגזרים מ-REWARDS כדי להישאר בפרופורציה לשאר המשחקים:
//   דרך ועץ = create, בית = level, בית ספר = perfect.
//   שטח חדש = perfect, וכל שטח נוסף יקר עוד create.

const START_COLS = 5;      // השטח ההתחלתי: 5 על 4 חלקות
const START_ROWS = 4;
const STORE_KEY = 'kidlearn-city-v2';
const OLD_STORE_KEY = 'kidlearn-city';   // הגרסה הקודמת (רשת קבועה 5×4), לצורך מעבר חלק

const W = window.KidLearnWallet;
const R = W ? W.REWARDS : { create: 5, level: 10, perfect: 20 };

const ITEMS = [
    { id: 'road',   name: 'דרך',     icon: '🛣️', price: R.create },
    { id: 'tree',   name: 'עץ',      icon: '🌳', price: R.create },
    { id: 'house',  name: 'בית',     icon: '🏠', price: R.level },
    { id: 'school', name: 'בית ספר', icon: '🏫', price: R.perfect },
];
const START_COUNT = START_COLS * START_ROWS;
const LAND_BASE = R.perfect;     // מחיר השטח הנוסף הראשון
const LAND_STEP = R.create;      // כל שטח נוסף יקר עוד צעד אחד

// שכנים: צפון = -z, מזרח = +x, דרום = +z, מערב = -x
const DIRS = [
    { name: 'N', dc: 0,  dr: -1 },
    { name: 'E', dc: 1,  dr: 0 },
    { name: 'S', dc: 0,  dr: 1 },
    { name: 'W', dc: -1, dr: 0 },
];
// סיבוב (סביב ציר Y) שמפנה את החזית של המבנה (+z) לעבר כיוון הדרך
const FACE_ROT = { S: 0, E: Math.PI / 2, N: Math.PI, W: -Math.PI / 2 };

const GRASS = ['#7cc35a', '#86cc62', '#72b651'];
const HOUSE_WALLS = ['#ffe0b2', '#c8e6c9', '#bbdefb', '#f8bbd0', '#fff59d'];
const HOUSE_ROOFS = ['#c0392b', '#6d4c41', '#5d4037'];
const FOLIAGE = ['#2e7d32', '#388e3c', '#43a047'];
const BUSH = ['#558b2f', '#689f38'];

const $ = (id) => document.getElementById(id);
let selected = 'house';

// --- מצב העיר ---
// owned:     Set של מפתחות "c,r" של החלקות שבבעלות הילד
// buildings: Map של "c,r" -> מזהה מבנה (רק לחלקות שבבעלות)
let owned = new Set();
let buildings = new Map();

// --- עזרים לנתונים ---
function key(c, r) { return c + ',' + r; }
function parseKey(k) { const [c, r] = k.split(',').map(Number); return { c, r }; }
function isOwned(c, r) { return owned.has(key(c, r)); }
function buildingAt(c, r) { return buildings.get(key(c, r)) || null; }
function roadAt(c, r) { return buildingAt(c, r) === 'road'; }
function itemById(id) { return ITEMS.find(x => x.id === id); }
function balance() { return W ? W.balance() : 0; }
function feedback(msg) { $('feedback').textContent = msg; }

function landPrice() {
    return LAND_BASE + LAND_STEP * Math.max(0, owned.size - START_COUNT);
}

// חלקה שעוד לא נקנתה, אבל נוגעת בשטח שבבעלות הילד
function isSale(c, r) {
    if (isOwned(c, r)) return false;
    return DIRS.some(d => isOwned(c + d.dc, r + d.dr));
}

function bounds() {
    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    for (const k of owned) {
        const { c, r } = parseKey(k);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
    }
    return { minC, maxC, minR, maxR };
}

function startingPlots() {
    const s = new Set();
    for (let r = 0; r < START_ROWS; r++) {
        for (let c = 0; c < START_COLS; c++) s.add(key(c, r));
    }
    return s;
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
        if (saved && Array.isArray(saved.owned)) {
            owned = new Set(saved.owned);
            buildings = new Map(Object.entries(saved.buildings || {}));
            return;
        }
    } catch (e) { /* אין אחסון — מתחילים מחדש */ }

    // מעבר מהגרסה הקודמת: אותו שטח 5×4 ואותם מבנים
    owned = startingPlots();
    buildings = new Map();
    try {
        const old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || 'null');
        if (Array.isArray(old) && old.length === START_COUNT) {
            old.forEach((id, i) => {
                if (id) buildings.set(key(i % START_COLS, Math.floor(i / START_COLS)), id);
            });
        }
    } catch (e) {}
}

function saveState() {
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
            owned: [...owned],
            buildings: Object.fromEntries(buildings),
        }));
    } catch (e) {}
}

// --- גיאומטריה וחומרים (נשמרים במטמון כדי שלא ייווצרו מחדש בכל ציור) ---
const geoCache = new Map();
const matCache = new Map();

function cached(cache, k, make) {
    if (!cache.has(k)) cache.set(k, make());
    return cache.get(k);
}

function boxG(w, h, d) { return cached(geoCache, `b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)); }
function cylG(rt, rb, h, seg) { return cached(geoCache, `c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)); }
function coneG(r, h, seg) { return cached(geoCache, `k${r}|${h}|${seg}`, () => new THREE.ConeGeometry(r, h, seg)); }
function icoG(r) { return cached(geoCache, `i${r}`, () => new THREE.IcosahedronGeometry(r, 0)); }

function mat(color, extra) {
    const k = color + '|' + JSON.stringify(extra || {});
    return cached(matCache, k, () => new THREE.MeshStandardMaterial(
        Object.assign({ color, roughness: 0.8, metalness: 0 }, extra || {})
    ));
}

function part(parent, geometry, color, x, y, z, extra) {
    const m = new THREE.Mesh(geometry, mat(color, extra));
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
}

// מספר "אקראי" קבוע לכל חלקה (כדי שהעיר לא תשתנה בכל רענון)
function rnd(seed, k) {
    const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
    return x - Math.floor(x);
}

function seedOf(c, r) {
    return (c + 500) * 1000 + (r + 500);
}

function facingRot(c, r) {
    for (const d of DIRS) {
        if (roadAt(c + d.dc, r + d.dr)) return FACE_ROT[d.name];
    }
    return 0;
}

// --- בניית חלקה שבבעלות הילד ---
function buildCell(c, r) {
    const group = new THREE.Group();
    group.position.set(c, 0, r);
    const seed = seedOf(c, r);

    // קרקע: קובייה שהחלק העליון שלה בגובה 0
    part(group, boxG(1, 0.1, 1), GRASS[Math.floor(rnd(seed, 1) * GRASS.length)], 0, -0.05, 0);

    const id = buildingAt(c, r);
    if (id === 'road') buildRoad(group, c, r);
    else if (id === 'tree') buildTree(group, seed);
    else if (id === 'house') buildHouse(group, seed, c, r);
    else if (id === 'school') buildSchool(group, c, r);
    else if (rnd(seed, 8) < 0.3) buildBush(group, seed);   // שיחים קטנים על שטח ריק
    return group;
}

// חלקה למכירה: לוח דשא בהיר עם דגל צהוב
function buildSale(c, r) {
    const group = new THREE.Group();
    group.position.set(c, 0, r);
    part(group, boxG(0.94, 0.03, 0.94), '#eef8e0', 0, 0.015, 0);
    part(group, cylG(0.02, 0.02, 0.45, 5), '#8d6e63', -0.3, 0.22, -0.3);
    part(group, boxG(0.22, 0.14, 0.02), '#ffca28', -0.2, 0.4, -0.3);
    return group;
}

// דרך: ריבוע מרכזי + זרוע לכל שכנה שהיא דרך. הזרועות מגיעות עד שפת החלקה,
// ולכן דרך מחוברת בדיוק לדרך שלידה.
function buildRoad(group, c, r) {
    const ASPHALT = '#3d3f47';
    const LINE = '#f5f5f5';
    const y = 0.012;
    part(group, boxG(0.42, 0.024, 0.42), ASPHALT, 0, y, 0);

    for (const d of DIRS) {
        if (!roadAt(c + d.dc, r + d.dr)) continue;
        const sx = d.dc !== 0 ? 0.5 : 0.42;
        const sz = d.dr !== 0 ? 0.5 : 0.42;
        part(group, boxG(sx, 0.024, sz), ASPHALT, d.dc * 0.25, y, d.dr * 0.25);
        // קו הפרדה מקווקו באמצע הזרוע
        const lx = d.dc !== 0 ? 0.12 : 0.03;
        const lz = d.dr !== 0 ? 0.12 : 0.03;
        part(group, boxG(lx, 0.006, lz), LINE, d.dc * 0.36, y + 0.015, d.dr * 0.36);
    }
}

function buildTree(group, seed) {
    const s = 0.85 + rnd(seed, 2) * 0.35;
    const ox = (rnd(seed, 3) - 0.5) * 0.25;
    const oz = (rnd(seed, 4) - 0.5) * 0.25;
    part(group, cylG(0.05, 0.07, 0.3, 7), '#6d4c41', ox, 0.15, oz);
    const crown = part(group, icoG(0.24), FOLIAGE[Math.floor(rnd(seed, 5) * FOLIAGE.length)], ox, 0.46, oz);
    crown.scale.setScalar(s);
}

function buildBush(group, seed) {
    const ox = (rnd(seed, 9) - 0.5) * 0.6;
    const oz = (rnd(seed, 10) - 0.5) * 0.6;
    const b = part(group, icoG(0.12), BUSH[Math.floor(rnd(seed, 11) * BUSH.length)], ox, 0.09, oz);
    b.scale.set(1, 0.8, 1);
}

// שביל קצר מהכניסה אל הדרך (רק אם יש דרך סמוכה)
function addDoorPath(parent, hasRoad) {
    if (!hasRoad) return;
    part(parent, boxG(0.14, 0.01, 0.22), '#d7ccc8', 0, 0.005, 0.39);
}

// בית: גוף, גג משולש, דלת וחלונות בחזית (+z) שמסתובבת לעבר הדרך
function buildHouse(group, seed, c, r) {
    const house = new THREE.Group();
    house.rotation.y = facingRot(c, r);
    const hasRoad = DIRS.some(d => roadAt(c + d.dc, r + d.dr));

    part(house, boxG(0.56, 0.42, 0.56), HOUSE_WALLS[Math.floor(rnd(seed, 6) * HOUSE_WALLS.length)], 0, 0.21, 0);
    const roof = part(house, coneG(0.4, 0.3, 4), HOUSE_ROOFS[Math.floor(rnd(seed, 7) * HOUSE_ROOFS.length)], 0, 0.57, 0);
    roof.rotation.y = Math.PI / 4;   // פינות הגג באלכסון, כדי שהצלעות יתיישרו עם הקירות
    part(house, boxG(0.08, 0.2, 0.08), '#8d6e63', 0.15, 0.6, -0.1);      // ארובה
    part(house, boxG(0.12, 0.2, 0.02), '#6d4c41', 0, 0.1, 0.285);        // דלת
    part(house, boxG(0.12, 0.12, 0.02), '#90caf9', -0.16, 0.27, 0.285, { roughness: 0.3 });
    part(house, boxG(0.12, 0.12, 0.02), '#90caf9', 0.16, 0.27, 0.285, { roughness: 0.3 });
    addDoorPath(house, hasRoad);

    group.add(house);
}

// בית ספר: בניין גדול עם גג שטוח, שורת חלונות, דלת ודגל
function buildSchool(group, c, r) {
    const school = new THREE.Group();
    school.rotation.y = facingRot(c, r);
    const hasRoad = DIRS.some(d => roadAt(c + d.dc, r + d.dr));

    part(school, boxG(0.8, 0.6, 0.8), '#ffd166', 0, 0.3, 0);
    part(school, boxG(0.86, 0.06, 0.86), '#9e9e9e', 0, 0.63, 0);
    for (const x of [-0.24, 0, 0.24]) {
        part(school, boxG(0.14, 0.14, 0.02), '#90caf9', x, 0.36, 0.41, { roughness: 0.3 });
    }
    part(school, boxG(0.16, 0.22, 0.02), '#6d4c41', 0, 0.11, 0.41);      // דלת
    part(school, cylG(0.015, 0.015, 0.5, 5), '#eeeeee', -0.3, 0.88, -0.3); // עמוד דגל
    part(school, boxG(0.2, 0.12, 0.01), '#e53935', -0.2, 1.08, -0.3);     // הדגל
    addDoorPath(school, hasRoad);

    group.add(school);
}

// --- סצנה ---
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let hoverMesh = null;
let raycaster = null;
let groundPlane = null;
const groups = new Map();   // "c,r" -> Group שמוצג בסצנה

function init3D() {
    const container = $('scene');
    if (!window.THREE) {
        container.textContent = 'התלת-ממד לא נטען. רעננו את העמוד.';
        return false;
    }
    try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (e) {
        container.textContent = 'המכשיר הזה לא תומך בתלת-ממד.';
        return false;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#bfe9ff');

    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 4;
    controls.maxPolarAngle = Math.PI * 0.42;

    scene.add(new THREE.HemisphereLight('#ffffff', '#7a9a55', 0.85));
    const sun = new THREE.DirectionalLight('#ffffff', 0.9);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);

    // הדשא שמתחת לעיר (נשאר במרכז, והשטח מתרחב מעליו)
    const base = new THREE.Mesh(boxG(60, 0.1, 60), mat('#5f9c45'));
    base.position.y = -0.15;
    base.receiveShadow = true;
    scene.add(base);

    // הדגשת החלקה שמתחת לסמן
    hoverMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.96, 0.96),
        new THREE.MeshBasicMaterial({ color: '#ffeb3b', transparent: true, opacity: 0.45, depthWrite: false })
    );
    hoverMesh.rotation.x = -Math.PI / 2;
    hoverMesh.position.y = 0.04;
    hoverMesh.visible = false;
    scene.add(hoverMesh);

    raycaster = new THREE.Raycaster();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    resize();
    window.addEventListener('resize', resize);

    const canvas = renderer.domElement;
    let pressX = 0;
    let pressY = 0;
    let dragged = false;
    canvas.addEventListener('pointerdown', (e) => {
        pressX = e.clientX;
        pressY = e.clientY;
        dragged = false;
    });
    canvas.addEventListener('pointermove', (e) => {
        if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 6) dragged = true;
        updateHover(e);
    });
    canvas.addEventListener('pointerup', (e) => {
        if (dragged) return;   // גרירה לסיבוב, לא לחיצה
        const cell = cellAt(e);
        if (cell) onCell(cell.c, cell.r);
    });
    canvas.addEventListener('pointerleave', () => { hoverMesh.visible = false; });

    drawAll();
    fitCamera();
    animate();
    return true;
}

// מכוון את המצלמה למרכז העיר, ומרחיק אותה ככל שהעיר גדלה
function fitCamera() {
    if (!controls) return;
    const b = bounds();
    const cx = (b.minC + b.maxC) / 2;
    const cz = (b.minR + b.maxR) / 2;
    const span = Math.max(b.maxC - b.minC + 1, b.maxR - b.minR + 1);
    const k = Math.max(1, span / START_COLS);
    controls.target.set(cx, 0, cz);
    camera.position.set(cx, 6.4 * k, cz + 6.6 * k);
    controls.maxDistance = 14 * k;
    controls.update();
}

function resize() {
    const w = $('scene').clientWidth;
    const h = Math.min(Math.round(w * 0.8), 440);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// איזו חלקה נמצאת מתחת לסמן (שלנו או למכירה), או null אם מחוץ לעיר
function cellAt(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
    const c = Math.round(p.x);
    const r = Math.round(p.z);
    return (isOwned(c, r) || isSale(c, r)) ? { c, r } : null;
}

function updateHover(e) {
    const cell = cellAt(e);
    if (!cell) {
        hoverMesh.visible = false;
        return;
    }
    const { c, r } = cell;
    hoverMesh.position.x = c;
    hoverMesh.position.z = r;
    let color = '#4fc3f7';                       // כחול = קנייה של שטח
    if (isOwned(c, r)) color = buildingAt(c, r) ? '#ff9800' : '#ffeb3b';   // כתום = יוסר, צהוב = לבנייה
    hoverMesh.material.color.set(color);
    hoverMesh.visible = true;
}

// ציור מחדש של חלקה. דרך ומבנה מסתכלים על השכנים, לכן מציירים גם את הארבעה הסמוכים
function drawCell(c, r) {
    if (!scene) return;
    const k = key(c, r);
    const old = groups.get(k);
    if (old) {
        scene.remove(old);
        groups.delete(k);
    }
    let g = null;
    if (isOwned(c, r)) g = buildCell(c, r);
    else if (isSale(c, r)) g = buildSale(c, r);
    if (g) {
        scene.add(g);
        groups.set(k, g);
    }
}

function drawAround(c, r) {
    [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]].forEach(([dc, dr]) => drawCell(c + dc, r + dr));
}

function drawAll() {
    const all = new Set(owned);
    for (const k of owned) {
        const { c, r } = parseKey(k);
        DIRS.forEach(d => all.add(key(c + d.dc, r + d.dr)));
    }
    all.forEach(k => {
        const { c, r } = parseKey(k);
        drawCell(c, r);
    });
}

// --- חנות ומונה ---
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

    const price = landPrice();
    const land = document.createElement('button');
    land.className = 'shop-item info' + (bal < price ? ' cant' : '');
    land.innerHTML = `<span class="icon">🗺️</span><span class="name">שטח חדש</span><span class="price">${price} 🪙</span>`;
    land.onclick = () => {
        $('hint').textContent = 'לחצו על חלקה בהירה עם דגל צהוב כדי לקנות אותה. כל שטח חדש מרחיב את העיר.';
    };
    box.appendChild(land);
}

function renderCounts() {
    const counts = {};
    buildings.forEach(id => { counts[id] = (counts[id] || 0) + 1; });
    const parts = ITEMS.filter(item => counts[item.id]).map(item => `${item.icon} ${counts[item.id]} ${item.name}`);
    const land = `🗺️ ${owned.size} חלקות`;
    $('counts').textContent = (parts.length ? `${land} · ${parts.join(' · ')}` : `${land}. העיר עוד ריקה, זמן לבנות!`);
}

function renderAll() {
    renderShop();
    renderCounts();
}

// --- פעולות ---
function setBuilding(c, r, id) {
    if (id) buildings.set(key(c, r), id);
    else buildings.delete(key(c, r));
    saveState();
    drawAround(c, r);
    renderShop();
    renderCounts();
}

// לחיצה על חלקה: שטח חדש אם היא למכירה, הסרה אם יש בה מבנה, ובנייה אחרת
function onCell(c, r) {
    if (!isOwned(c, r)) return buyLand(c, r);
    if (buildingAt(c, r)) return removeAt(c, r);
    place(c, r);
}

function buyLand(c, r) {
    const price = landPrice();
    if (!W) return feedback('אי אפשר לקנות עכשיו 🪙');
    const bal = balance();
    if (bal < price) return feedback(`חסרים לכם ${price - bal} 🪙 כדי לקנות שטח נוסף`);
    if (!W.spend(price)) return feedback('משהו השתבש, נסו שוב');
    owned.add(key(c, r));
    saveState();
    drawAround(c, r);
    fitCamera();
    renderAll();
    feedback(`קניתם שטח חדש! −${price} 🪙`);
}

function place(c, r) {
    const item = itemById(selected);
    const bal = balance();
    if (!W) return feedback('אי אפשר לבנות עכשיו 🪙');
    if (bal < item.price) {
        return feedback(`חסרים לכם ${item.price - bal} 🪙 כדי לבנות ${item.name}`);
    }
    if (!W.spend(item.price)) return feedback('משהו השתבש, נסו שוב');
    setBuilding(c, r, item.id);
    feedback(`בניתם ${item.name}! −${item.price} 🪙`);
}

function removeAt(c, r) {
    const item = itemById(buildingAt(c, r));
    const refund = Math.floor(item.price / 2);
    setBuilding(c, r, null);
    if (W && refund > 0) W.earn(refund, { reason: `החזר ${item.name}` });
    feedback(`הורדתם ${item.name}. הוחזרו ${refund} 🪙`);
}

// --- התחלה ---
loadState();
if (!init3D()) {
    feedback('אי אפשר להציג את העיר בתלת-ממד במכשיר הזה.');
}
if (W) {
    W.onChange((bal) => {
        $('balance').textContent = bal;
        renderShop();
    });
} else {
    $('balance').textContent = 0;
}
renderAll();
