// גן החיות: המסך. החוקים נמצאים ב-logic.js (ZooLogic).
// אטרקציה בעיר: הנתונים נשמרים לפי החלקה (?cell=c,r) במכשיר ובחשבון. עובד גם בדפדפן רגיל בלי כניסה.
// ההכנסה לדקה נשמרת בנתונים, והעיר מוסיפה אותה למסים שלה (משולם לבד, גם כשהילד לא בעיר, עד 3 שעות).
(function () {
  const L = window.ZooLogic;
  const W = window.KidLearnWallet;
  const store = KidLearnAttraction.create('kidlearn-zoo');
  const $ = (id) => document.getElementById(id);

  let state = L.normalize(store.load());
  // זמן שעבר מאז הפעם האחרונה: האוכל והניקיון ירדו
  L.decay(state, Date.now() - state.at);
  state.at = Date.now();

  function refresh() {
    state.rate = L.rateOf(state);
    state.summary = L.summaryOf(state);
  }
  function persist(cloud) {
    state.at = Date.now();
    refresh();
    store.save(state, cloud === false ? { cloud: false } : undefined);
  }
  function say(msg) { $('feedback').textContent = msg; }
  function balance() { return W ? W.balance() : 0; }

  // תשלום: הארנק המשותף. בלי ארנק אי אפשר לקנות
  function pay(cost) {
    if (!W) { say('אי אפשר לשלם עכשיו 🪙'); return false; }
    if (balance() < cost) { say(`חסרים לכם ${cost - balance()} 🪙`); return false; }
    return W.spend(cost);
  }

  function meter(label, value, cls, pct, note) {
    const w = Math.max(0, Math.min(100, Math.round(pct)));
    return `<div class="meter"><div class="meter-head"><span>${label}</span><strong>${value}</strong></div>` +
      (cls ? `<div class="meter-bar"><div class="meter-fill ${cls}" style="width:${w}%"></div></div>` : '') +
      `<div class="meter-note">${note || ''}</div></div>`;
  }

  function renderStats() {
    const vis = L.visitorsPerMin(state);
    $('stats').innerHTML =
      meter('💰 הכנסה', `${state.rate.toFixed(1)} 🪙 לדקה`, '', 0, `עד ${L.RATE_MAX} לדקה. נכנס לעיר לבד`) +
      meter('🚶 מבקרים', `${vis.toFixed(1)} בדקה`, '', 0, `כרטיס: ${state.price} 🪙`) +
      meter('🥕 אוכל', `${Math.round(state.fed)}%`, 'fed', state.fed, 'חיות רעבות מרחיקות מבקרים') +
      meter('🧹 ניקיון', `${Math.round(state.clean)}%`, 'clean', state.clean, 'גן מלוכלך מרחיק מבקרים') +
      meter('😊 שמחת המבקרים', `${L.happiness(state)}%`, 'happy', L.happiness(state), 'ממוצע של אוכל וניקיון') +
      meter('🐾 חיות', `${L.animalCount(state)} מתוך ${L.capacity(state)}`, '', 0, `${L.speciesCount(state)} סוגים. מגוון מביא יותר מבקרים`);
  }

  function renderControls() {
    $('prices').innerHTML = '';
    L.PRICES.forEach((p) => {
      const b = document.createElement('button');
      b.className = 'chip' + (state.price === p ? ' on' : '');
      b.setAttribute('aria-pressed', String(state.price === p));
      b.textContent = `🎟️ כרטיס ${p} 🪙`;
      b.onclick = () => {
        L.setPrice(state, p);
        persist();
        say(p === 1 ? 'כרטיס זול: הרבה מבקרים' : p === 2 ? 'כרטיס בינוני' : 'כרטיס יקר: פחות מבקרים, אבל כל אחד משלם יותר');
        renderAll();
      };
      $('prices').appendChild(b);
    });
    const f = L.feed(state), c = L.clean(state), x = L.canExpand(state);
    $('feedBtn').textContent = f.ok ? `🥕 האכלה (${f.cost} 🪙)` : '🥕 האכלה';
    $('cleanBtn').textContent = c.ok ? `🧹 ניקיון (${c.cost} 🪙)` : '🧹 ניקיון';
    $('expandBtn').textContent = x.ok ? `➕ הרחבת הגן (${x.cost} 🪙, עוד ${L.SLOT_STEP} מקומות)` : '➕ הגן במקסימום';
    $('feedBtn').disabled = !f.ok;
    $('cleanBtn').disabled = !c.ok;
    $('expandBtn').disabled = !x.ok;
  }

  // ---------- תלת-ממד ----------
  const COLS = 2;        // גדרות בשורה
  const PEN = 2;         // גודל גדר בעולם (בעיר חלקה היא 1)
  const PER_PEN = 4;     // כמה חיות בגדר אחת
  let selected = L.ANIMALS[0].id;
  const S = KidLearn3D.create({
    container: $('scene'),
    sky: '#d9f0ff',
    ground: '#6aa84f',
    cellSize: PEN,
    bounds: () => ({ minC: 0, maxC: COLS - 1, minR: 0, maxR: Math.max(0, rowsNow() - 1) }),
    hoverColor: (c, r) => {
      if (c < 0 || r < 0 || c >= COLS || c + r * COLS >= penCount()) return null;
      return '#ffeb3b';
    },
    onTap: (c, r, wx, wz) => onPen(c + r * COLS, wx - c * PEN, wz - r * PEN),
  });
  const anims = [];
  const walks = new Map();   // מספר גדר -> מצב ההליכה של החיה שבה
  const SPEED = { rabbit: 0.38, sheep: 0.16, penguin: 0.16, monkey: 0.32, giraffe: 0.13, elephant: 0.1, lion: 0.2, panda: 0.1 };
  const WALK_LIM = 0.62;   // עד כמה החיה מתרחקת מהמרכז, כדי לא לעבור דרך הגדר

  function stepWalk(w, node, dt, t) {
    if (w.wait > 0) {
      w.wait -= dt;
      w.moving = false;
      if (w.wait <= 0) {
        w.tx = (Math.random() * 2 - 1) * WALK_LIM;
        w.tz = (Math.random() * 2 - 1) * WALK_LIM;
        w.moving = true;
      }
    } else {
      const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
      const step = (SPEED[w.id] || 0.15) * dt;
      if (d <= step) { w.x = w.tx; w.z = w.tz; w.wait = 1 + Math.random() * 3; w.moving = false; }
      else { w.x += dx / d * step; w.z += dz / d * step; w.rot = -Math.atan2(dz, dx); }
    }
    node.position.x = w.x;
    node.position.z = w.z;
    // פונים בהדרגה לכיוון ההליכה
    let diff = w.rot - node.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    node.rotation.y += diff * Math.min(1, dt * 6);
    // צעדים: קפיצה קטנה ונדנוד בזמן הליכה
    node.position.y = 0.03 + (w.moving ? Math.abs(Math.sin(t * 9)) * 0.02 : 0);
    node.rotation.z = w.moving ? Math.sin(t * 9) * 0.06 : 0;
  }

  function penCount() { return Math.ceil(L.capacity(state) / PER_PEN); }
  function rowsNow() { return Math.ceil(penCount() / COLS); }
  // איזו חיה נמצאת בכל גדר: לפי סדר הרשימה, בלי חורים באמצע
  function slotList() {
    const out = [];
    L.ANIMALS.forEach((a) => { for (let i = 0; i < (state.animals[a.id] || 0); i++) out.push(a.id); });
    return out;
  }
  const slotAnimal = (i) => slotList()[i] || null;

  function buildAnimal(id, seed) {
    const T = S.THREE;
    const g = new T.Group();
    const { part, box, cyl, cone, ico } = S;
    const bob = (fn) => anims.push(fn);
    if (id === 'rabbit') {
      part(g, ico(0.1), '#f5f5f5', 0, 0.12, 0);
      part(g, ico(0.07), '#f5f5f5', 0.1, 0.18, 0);
      part(g, box(0.025, 0.12, 0.03), '#f5f5f5', 0.1, 0.3, -0.03);
      part(g, box(0.025, 0.12, 0.03), '#f5f5f5', 0.1, 0.3, 0.03);
      part(g, ico(0.035), '#ffffff', -0.1, 0.12, 0);
      part(g, ico(0.012), '#d81b60', 0.17, 0.2, -0.03);
      bob((t) => { g.position.y = Math.abs(Math.sin(t * 3 + seed)) * 0.08; });
    } else if (id === 'sheep') {
      part(g, ico(0.15), '#f1efe6', 0, 0.2, 0);
      part(g, ico(0.09), '#f1efe6', 0, 0.3, 0);
      part(g, box(0.1, 0.1, 0.09), '#3e2f2a', 0.17, 0.24, 0);
      [[-0.07, -0.08], [-0.07, 0.08], [0.07, -0.08], [0.07, 0.08]].forEach(([x, z]) => part(g, cyl(0.015, 0.015, 0.1, 5), '#3e2f2a', x, 0.05, z));
      bob((t) => { g.position.y = Math.sin(t * 1.5 + seed) * 0.01; g.rotation.y = Math.sin(t * 0.6 + seed) * 0.3; });
    } else if (id === 'penguin') {
      part(g, cyl(0.09, 0.11, 0.3, 10), '#263238', 0, 0.18, 0);
      part(g, ico(0.08), '#263238', 0, 0.37, 0);
      part(g, cyl(0.07, 0.09, 0.22, 10), '#fafafa', 0.025, 0.17, 0);
      part(g, cone(0.025, 0.07, 6), '#ff9800', 0.1, 0.37, 0).rotation.z = -Math.PI / 2;
      part(g, box(0.03, 0.14, 0.07), '#263238', 0, 0.2, 0.12).rotation.x = 0.3;
      part(g, box(0.03, 0.14, 0.07), '#263238', 0, 0.2, -0.12).rotation.x = -0.3;
      part(g, box(0.1, 0.02, 0.05), '#ff9800', 0.02, 0.01, 0.04);
      part(g, box(0.1, 0.02, 0.05), '#ff9800', 0.02, 0.01, -0.04);
      bob((t) => { g.rotation.z = Math.sin(t * 4 + seed) * 0.12; });
    } else if (id === 'monkey') {
      part(g, ico(0.1), '#8d5a2b', 0, 0.2, 0);
      part(g, ico(0.075), '#8d5a2b', 0.02, 0.35, 0);
      part(g, ico(0.045), '#e0b98a', 0.07, 0.34, 0);
      part(g, ico(0.03), '#8d5a2b', 0.02, 0.35, 0.08);
      part(g, ico(0.03), '#8d5a2b', 0.02, 0.35, -0.08);
      part(g, box(0.03, 0.18, 0.03), '#8d5a2b', 0.06, 0.18, 0.1).rotation.x = -0.4;
      part(g, box(0.03, 0.18, 0.03), '#8d5a2b', 0.06, 0.18, -0.1).rotation.x = 0.4;
      const tail = part(g, cyl(0.012, 0.012, 0.3, 5), '#6d4421', -0.14, 0.26, 0);
      tail.rotation.z = 0.7;
      bob((t) => { g.position.y = Math.abs(Math.sin(t * 2.4 + seed)) * 0.05; tail.rotation.z = 0.7 + Math.sin(t * 4) * 0.25; });
    } else if (id === 'giraffe') {
      part(g, box(0.28, 0.14, 0.14), '#f9a825', 0, 0.3, 0);
      [[-0.1, -0.05], [-0.1, 0.05], [0.1, -0.05], [0.1, 0.05]].forEach(([x, z]) => part(g, cyl(0.016, 0.016, 0.24, 5), '#f9a825', x, 0.12, z));
      const neck = new T.Group();
      neck.position.set(0.1, 0.34, 0);
      part(neck, cyl(0.025, 0.035, 0.42, 6), '#f9a825', 0.04, 0.21, 0).rotation.z = -0.15;
      part(neck, box(0.1, 0.06, 0.06), '#f9a825', 0.1, 0.45, 0);
      part(neck, cyl(0.008, 0.008, 0.05, 4), '#6d4c41', 0.09, 0.51, 0.02);
      part(neck, cyl(0.008, 0.008, 0.05, 4), '#6d4c41', 0.09, 0.51, -0.02);
      g.add(neck);
      [[-0.05, 0.08], [0.06, -0.08], [0.0, 0.07]].forEach(([x, z]) => part(g, ico(0.022), '#8d5a2b', x, 0.32, z));
      bob((t) => { neck.rotation.z = Math.sin(t * 0.9 + seed) * 0.12; });
    } else if (id === 'elephant') {
      part(g, ico(0.2), '#9e9e9e', 0, 0.26, 0);
      part(g, ico(0.12), '#9e9e9e', 0.2, 0.3, 0);
      part(g, cyl(0.03, 0.04, 0.2, 6), '#9e9e9e', 0.3, 0.22, 0);
      [[-0.1, -0.1], [-0.1, 0.1], [0.1, -0.1], [0.1, 0.1]].forEach(([x, z]) => part(g, cyl(0.04, 0.045, 0.14, 6), '#8d8d8d', x, 0.07, z));
      part(g, cyl(0.09, 0.09, 0.015, 10), '#bdbdbd', 0.18, 0.32, 0.12).rotation.x = Math.PI / 2;
      part(g, cyl(0.09, 0.09, 0.015, 10), '#bdbdbd', 0.18, 0.32, -0.12).rotation.x = Math.PI / 2;
      part(g, cone(0.012, 0.07, 5), '#fafafa', 0.3, 0.2, 0.05).rotation.z = -1.2;
      part(g, cone(0.012, 0.07, 5), '#fafafa', 0.3, 0.2, -0.05).rotation.z = -1.2;
      bob((t) => { g.rotation.y = Math.sin(t * 0.5 + seed) * 0.2; });
    } else if (id === 'lion') {
      part(g, box(0.3, 0.14, 0.14), '#e0a030', 0, 0.2, 0);
      [[-0.1, -0.05], [-0.1, 0.05], [0.1, -0.05], [0.1, 0.05]].forEach(([x, z]) => part(g, cyl(0.02, 0.02, 0.14, 5), '#e0a030', x, 0.07, z));
      part(g, ico(0.12), '#8d5a2b', 0.18, 0.26, 0);
      part(g, ico(0.07), '#f0b848', 0.24, 0.25, 0);
      part(g, ico(0.012), '#212121', 0.3, 0.27, 0.03);
      part(g, ico(0.012), '#212121', 0.3, 0.27, -0.03);
      const tail = part(g, cyl(0.012, 0.012, 0.22, 5), '#e0a030', -0.2, 0.22, 0);
      tail.rotation.z = 1.0;
      bob((t) => { tail.rotation.x = Math.sin(t * 2 + seed) * 0.5; g.position.y = Math.sin(t * 1.2 + seed) * 0.01; });
    } else {
      // פנדה
      part(g, ico(0.16), '#fafafa', 0, 0.22, 0);
      part(g, ico(0.1), '#fafafa', 0.14, 0.34, 0);
      part(g, ico(0.04), '#212121', 0.14, 0.43, 0.07);
      part(g, ico(0.04), '#212121', 0.14, 0.43, -0.07);
      part(g, ico(0.03), '#212121', 0.22, 0.36, 0.04);
      part(g, ico(0.03), '#212121', 0.22, 0.36, -0.04);
      part(g, ico(0.02), '#212121', 0.24, 0.33, 0);
      part(g, box(0.1, 0.12, 0.34), '#212121', 0.04, 0.23, 0).scale.set(1, 1, 0.8);
      [[-0.08, -0.1], [-0.08, 0.1], [0.1, -0.1], [0.1, 0.1]].forEach(([x, z]) => part(g, cyl(0.04, 0.04, 0.1, 6), '#212121', x, 0.05, z));
      bob((t) => { g.rotation.z = Math.sin(t * 1.2 + seed) * 0.05; });
    }
    return g;
  }

  function buildPen(c, r, pi) {
    const T = S.THREE;
    const list = slotList();
    const g = new T.Group();
    g.position.set(c * PEN, 0, r * PEN);
    const used = list.slice(pi * PER_PEN, pi * PER_PEN + PER_PEN).filter(Boolean).length;
    S.part(g, S.box(1.96, 0.04, 1.96), used ? '#5fa84a' : '#78b86a', 0, 0, 0);
    // גדר עץ עם פתח בחזית
    const wood = '#8d6e63', H = 0.96;
    S.part(g, S.box(1.92, 0.14, 0.04), wood, 0, 0.1, -H);
    S.part(g, S.box(0.04, 0.14, 1.92), wood, -H, 0.1, 0);
    S.part(g, S.box(0.04, 0.14, 1.92), wood, H, 0.1, 0);
    S.part(g, S.box(0.7, 0.14, 0.04), wood, -0.6, 0.1, H);
    S.part(g, S.box(0.7, 0.14, 0.04), wood, 0.6, 0.1, H);
    [[-H, -H], [H, -H], [-H, H], [H, H], [0, -H], [-H, 0], [H, 0]].forEach(([px, pz]) => S.part(g, S.box(0.06, 0.24, 0.06), '#5d4037', px, 0.12, pz));
    // עצים בפינות האחוריות
    [[-0.75, -0.75], [0.75, -0.75]].forEach(([tx, tz]) => {
      S.part(g, S.cyl(0.03, 0.04, 0.24, 6), '#6d4c41', tx, 0.14, tz);
      S.part(g, S.ico(0.17), '#43a047', tx, 0.38, tz);
    });
    // קערת אוכל: ירוקה כשיש אוכל
    S.part(g, S.cyl(0.11, 0.08, 0.07, 8), '#d7ccc8', 0.65, 0.06, 0.6);
    S.part(g, S.cyl(0.085, 0.085, 0.02, 8), state.fed >= 50 ? '#7cb342' : '#6d4c41', 0.65, 0.1, 0.6);
    // לכלוך כשהגן מלוכלך
    const dirt = state.clean >= 70 ? 0 : state.clean >= 40 ? 3 : 6;
    for (let k = 0; k < dirt; k++) {
      S.part(g, S.ico(0.045), '#6d4c41', (S.rnd(pi + 1, k) - 0.5) * 1.4, 0.04, (S.rnd(pi + 1, k + 9) - 0.5) * 1.4);
    }
    for (let j = 0; j < PER_PEN; j++) {
      const i = pi * PER_PEN + j, id = list[i], seed = i + 1;
      if (!id) {
        // מקום פנוי: שלט קטן
        const fx = j % 2 ? 0.4 : -0.4, fz = j < 2 ? -0.1 : 0.4;
        S.part(g, S.cyl(0.012, 0.012, 0.14, 5), '#5d4037', fx, 0.07, fz);
        S.part(g, S.box(0.16, 0.08, 0.02), '#ffca28', fx, 0.17, fz);
        continue;
      }
      const an = buildAnimal(id, seed);
      an.scale.setScalar(1.3);
      // הליכה: המצב נשמר בין ציורים כדי שהחיה לא תקפוץ למקום אחר
      const walker = new T.Group();
      walker.add(an);
      let w = walks.get(seed);
      if (!w || w.id !== id) {
        w = { id, x: (j % 2 ? 0.4 : -0.4), z: (j < 2 ? -0.3 : 0.2), tx: 0, tz: 0, wait: S.rnd(seed, 3) * 2, rot: S.rnd(seed, 4) * 6.28, moving: false };
        walks.set(seed, w);
      }
      walker.position.set(w.x, 0.03, w.z);
      walker.rotation.y = w.rot;
      g.add(walker);
      anims.push((t, dt) => stepWalk(w, walker, dt, t));
    }
    return g;
  }

  function drawZoo() {
    if (!S.ok) return;
    anims.length = 0;
    const cells = new Map();
    const list = slotList();
    const pens = penCount();
    for (let pi = 0; pi < pens; pi++) {
      const c = pi % COLS, r = Math.floor(pi / COLS);
      cells.set(`${c},${r}`, buildPen(c, r, pi));
    }
    // שער כניסה לגן
    const gate = new S.THREE.Group();
    const z = (rowsNow() - 1) * PEN + 1.25, cx = (COLS - 1) * PEN / 2;
    S.part(gate, S.box(0.09, 0.7, 0.09), '#5d4037', cx - 0.6, 0.35, z);
    S.part(gate, S.box(0.09, 0.7, 0.09), '#5d4037', cx + 0.6, 0.35, z);
    S.part(gate, S.box(1.4, 0.16, 0.09), '#ffca28', cx, 0.72, z);
    S.part(gate, S.box(1.2, 0.03, 1.0), '#bcaaa4', cx, 0, z + 0.5);
    cells.set('gate', gate);
    S.setCells(cells);
  }

  if (S.ok) {
    S.onFrame((dt, t) => { if (!S.reduceMotion) anims.forEach((fn) => fn(t, dt)); });
    $('centerBtn').onclick = () => S.fit();
    S.fit();
  } else {
    $('centerBtn').hidden = true;
  }

  // לחיצה על חיה = למכור אותה. לחיצה על שטח ריק בגדר = לקנות את החיה שנבחרה
  function onPen(pi, lx, lz) {
    const list = slotList();
    let hit = null, best = 0.45;
    for (let j = 0; j < PER_PEN; j++) {
      const i = pi * PER_PEN + j, w = walks.get(i + 1);
      if (!list[i] || !w || w.id !== list[i]) continue;
      const d = Math.hypot(w.x - lx, w.z - lz);
      if (d < best) { best = d; hit = list[i]; }
    }
    if (hit) {
      const a = L.ANIMAL_BY_ID[hit];
      if (!confirm(`למכור את ${a.name}? יוחזר חצי מהמחיר.`)) return;
      const r = L.sell(state, hit);
      if (!r.ok) return say(r.msg);
      if (W) W.earn(r.refund, { reason: `מכרתם ${a.name}`, silent: true });
      persist();
      say(`מכרתם ${a.name}. הוחזרו ${r.refund} 🪙`);
      return renderAll();
    }
    buyAnimal(selected);
  }
  function buyAnimal(id) {
    const a = L.ANIMAL_BY_ID[id];
    const c = L.canBuy(state, id);
    if (!c.ok) return say(c.msg);
    if (!pay(c.cost)) return;
    L.buy(state, id);
    persist();
    say(`קניתם ${a.name}! −${c.cost} 🪙`);
    renderAll();
  }

  function renderShop() {
    const box = $('shop');
    box.innerHTML = '';
    const free = L.freeSlots(state);
    L.ANIMALS.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'card' + (a.id === selected ? ' selected' : '') + (balance() < a.price ? ' cant' : '');
      b.setAttribute('aria-pressed', String(a.id === selected));
      b.innerHTML = `<span class="icon">${a.icon}</span><span>${a.name}</span><span class="price">${a.price} 🪙</span>`;
      b.onclick = () => {
        selected = a.id;
        if (!S.ok) return buyAnimal(a.id);   // בלי תלת-ממד קונים ישר מהחנות
        $('hint').textContent = `נבחר: ${a.name}. לחצו על מקום ריק בגדר כדי לקנות. לחיצה על חיה מוכרת אותה.`;
        renderShop();
      };
      box.appendChild(b);
    });
    $('note').textContent = free <= 0 ? 'אין מקום בגדרות. הרחיבו את הגן כדי לקנות עוד חיות.' : `נשארו ${free} מקומות פנויים.`;
  }

  function renderAll() {
    refresh();
    renderStats();
    renderControls();
    drawZoo();
    renderShop();
  }

  $('feedBtn').onclick = () => {
    const f = L.feed(state);
    if (!f.ok) return say(f.msg);
    if (!pay(f.cost)) return;
    state.fed = 100;
    persist();
    say(`האכלתם את החיות! −${f.cost} 🪙`);
    renderAll();
  };
  $('cleanBtn').onclick = () => {
    const c = L.clean(state);
    if (!c.ok) return say(c.msg);
    if (!pay(c.cost)) return;
    state.clean = 100;
    persist();
    say(`ניקיתם את הגן! −${c.cost} 🪙`);
    renderAll();
  };
  $('expandBtn').onclick = () => {
    const x = L.canExpand(state);
    if (!x.ok) return say(x.msg);
    if (!pay(x.cost)) return;
    L.expand(state);
    persist();
    say(`הגן גדל! עכשיו יש מקום ל־${L.capacity(state)} חיות. −${x.cost} 🪙`);
    renderAll();
    if (S.ok) S.fit();
  };

  if (W) W.onChange(() => { $('balance').textContent = balance(); renderShop(); });
  else $('balance').textContent = 0;

  // עם הזמן החיות מתלכלכות ורעבות. שומרים במכשיר בלבד כדי לא להעמיס על הענן
  setInterval(() => {
    L.decay(state, 5000);
    persist(false);
    renderAll();
  }, 5000);

  window.addEventListener('pagehide', () => { persist(false); store.flush(); });
  if (window.KidLearn && KidLearn.onAuthChange) {
    KidLearn.onAuthChange((profile) => {
      if (!profile) return;
      store.syncCloud(() => {
        state = L.normalize(store.load());
        L.decay(state, Date.now() - state.at);
        state.at = Date.now();
        renderAll();
      });
    });
  }

  persist();
  renderAll();
})();
