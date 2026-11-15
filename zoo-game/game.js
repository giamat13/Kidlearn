// גן החיות: המסך. החוקים נמצאים ב-logic.js (ZooLogic), המודלים ב-animals.js (ZooModels).
// אטרקציה בעיר: הנתונים נשמרים לפי החלקה (?cell=c,r) במכשיר ובחשבון. עובד גם בדפדפן רגיל בלי כניסה.
// ההכנסה לדקה נשמרת בנתונים, והעיר מוסיפה אותה למסים שלה (משולם לבד, גם כשהילד לא בעיר, עד 3 שעות).
(function () {
  const L = window.ZooLogic;
  const W = window.KidLearnWallet;
  const K = window.K3D;
  const M = window.ZooModels;
  const store = KidLearnAttraction.create('kidlearn-zoo');
  const $ = (id) => document.getElementById(id);

  let state = L.normalize(store.load());
  L.decay(state, Date.now() - state.at);   // זמן שעבר מאז הפעם האחרונה: האוכל והניקיון ירדו
  state.at = Date.now();

  let tab = 'animals';
  let sel = null;        // סוג החיה שנבחר (בלחיצה על מתחם)
  let quiz = null;       // השאלה הפתוחה בחידון
  let quizMsg = '';

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
  function pay(cost) {
    if (!W) { say('אי אפשר לשלם עכשיו 🪙'); return false; }
    if (balance() < cost) { say(`חסרים לכם ${cost - balance()} 🪙`); return false; }
    return W.spend(cost);
  }
  function earn(n, reason) { if (W) W.earn(n, { reason, silent: true }); }

  // ---------- תלת-ממד ----------
  const PEN = 5, GAP = 5.6, SIDE = 4.1;
  const HOME = {
    meadow: { ground: '#8fd16a', fence: 'wood' }, ice: { ground: '#eef7ff', fence: 'white' },
    jungle: { ground: '#5fae4e', fence: 'wood' }, savanna: { ground: '#d9c27a', fence: 'wood' },
    bamboo: { ground: '#7fc56a', fence: 'wood' }, water: { ground: '#9ad17a', fence: 'white' },
  };
  const STRONG = { lion: 1, tiger: 1, crocodile: 1 };   // גדר מתכת גבוהה
  const still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const stage = K && M ? K.createStage($('scene'), { camPos: [0, 11, 16], target: [0, 0, -1], maxDist: 60, shadow: 26 }) : null;
  let world = null, sig = '', animals = [], people = [], rowsDrawn = -1, petAt = 0;

  function penPos(i) { return { x: (i % 2 ? 1 : -1) * SIDE, z: -Math.floor(i / 2) * GAP }; }
  function penList() {
    const list = state.order.filter((id) => state.animals[id] > 0);
    if (L.freeSlots(state) > 0) list.push(null);   // מגרש ריק למתחם הבא
    return list;
  }

  function buildPen(id, i) {
    const a = L.ANIMAL_BY_ID[id];
    const p = penPos(i), h = PEN / 2 - 0.15, home = HOME[a.home];
    const g = K.group(world, p.x, 0, p.z);
    g.userData.pick = { type: 'pen', id };
    K.part(g, K.boxG(PEN - 0.2, 0.08, PEN - 0.2), home.ground, 0, 0.04, 0).castShadow = false;
    const fo = STRONG[id] ? { kind: 'metal', h: 0.85, step: 0.6 } : { kind: home.fence, h: 0.5 };
    [[-h, -h, h, -h], [-h, h, h, h], [-h, -h, -h, h], [h, -h, h, h]].forEach((f) => K.fence(g, f[0], f[1], f[2], f[3], fo));
    const s = i * 7 + 3, R = (k) => K.rnd(s, k);
    if (a.home === 'meadow') {
      for (let k = 0; k < 4; k++) K.flowers(g, (R(k) - 0.5) * 3.4, (R(k + 5) - 0.5) * 3.4, s + k, 5);
      K.bush(g, -1.8, -1.8, 1.2, s); K.bush(g, 1.7, -1.6, 1, s + 1);
    } else if (a.home === 'ice') {
      const w = K.part(g, K.cylG(1.2, 1.2, 0.03, 24), '#7fd3f5', 0.5, 0.09, 0.4, { roughness: 0.15 }); w.castShadow = false;
      [[-1.5, -1.4, 0.9], [-0.7, -1.7, 0.6], [1.6, -1.5, 0.7]].forEach(([x, z, sz]) => K.part(g, K.boxG(sz, sz * 0.7, sz), '#d6f0ff', x, sz * 0.35 + 0.08, z, { roughness: 0.2 }).rotation.y = x);
    } else if (a.home === 'jungle') {
      K.tree(g, -1.7, -1.7, 1.2, s, 'palm'); K.tree(g, 1.7, -1.5, 1, s + 1, 'palm');
      K.bush(g, 1.8, 1.6, 1.3, s + 2); K.bush(g, -1.8, 0.4, 1.1, s + 3); K.rock(g, 0.6, -1.7, 1.2, s);
    } else if (a.home === 'savanna') {
      K.tree(g, -1.6, -1.6, 1.5, s, 'round'); K.rock(g, 1.6, -1.6, 1.6, s); K.rock(g, 1.9, -1, 1, s + 1); K.bush(g, -1.9, 1.5, 0.9, s);
    } else if (a.home === 'bamboo') {
      for (let k = 0; k < 12; k++) {
        const bx = -2 + R(k) * 4, bz = -2 + R(k + 20) * 0.9, bh = 1.3 + R(k + 40) * 1.1;
        K.part(g, K.cylG(0.035, 0.04, bh, 6), k % 2 ? '#7cb342' : '#558b2f', bx, bh / 2, bz);
        K.part(g, K.sphG(0.14, 6), '#9ccc65', bx, bh, bz).scale.set(1, 0.5, 1);
      }
      K.rock(g, 1.6, 1.5, 1.2, s);
    } else {
      const w = K.part(g, K.cylG(1.5, 1.5, 0.03, 24), '#4fc3f7', 0, 0.09, 0, { roughness: 0.15 }); w.castShadow = false;
      K.bush(g, -1.9, -1.8, 1, s); K.tree(g, 1.8, -1.8, 0.9, s, 'palm'); K.rock(g, -1.7, 1.7, 1, s);
    }
    // קערת אוכל ושלט, בצד שפונה לשביל
    const fx = p.x < 0 ? 1 : -1;
    K.part(g, K.cylG(0.24, 0.18, 0.14, 12), '#d7ccc8', fx * 1.7, 0.15, 1.7);
    K.part(g, K.cylG(0.19, 0.19, 0.03, 12), state.fed >= 50 ? '#7cb342' : '#6d4c41', fx * 1.7, 0.22, 1.7);
    K.part(g, K.cylG(0.04, 0.04, 1.3, 6), '#6d4c41', fx * (h + 0.1), 0.65, 1.2);
    const sp = K.sprite(`${a.icon} ${a.name} ×${state.animals[id]}`, 0.5, { bg: '#ffffff' });
    sp.position.set(fx * (h + 0.1), 1.6, 1.2);
    g.add(sp);
    // החיות עצמן (עד 6 מוצגות; כל שלישית היא גור קטן)
    const n = Math.min(6, state.animals[id]);
    for (let k = 0; k < n; k++) {
      const m = M.build(id), sc = k % 3 === 2 ? 0.6 : 1;
      m.g.scale.setScalar(sc);
      const lim = Math.max(0.3, PEN / 2 - 0.7 - m.size * sc);
      const an = { id, pen: g, baby: sc < 1, m, lim, x: (R(k + 60) - 0.5) * 2 * lim, z: (R(k + 70) - 0.5) * 2 * lim, tx: 0, tz: 0, wait: R(k + 80) * 3, rot: R(k + 90) * 6.28, moving: false, jump: 0, ph: R(k) * 6 };
      m.g.position.set(an.x, 0.08, an.z);
      m.g.rotation.y = an.rot;
      g.add(m.g);
      animals.push(an);
    }
  }

  function buildLot(i) {
    const p = penPos(i);
    const g = K.group(world, p.x, 0, p.z);
    g.userData.pick = { type: 'lot' };
    K.part(g, K.boxG(PEN - 0.2, 0.08, PEN - 0.2), '#a9d98c', 0, 0.04, 0).castShadow = false;
    [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]].forEach(([x, z]) => K.part(g, K.boxG(0.1, 0.4, 0.1), '#ffca28', x, 0.2, z));
    const sp = K.sprite('➕ מתחם חדש', 0.55, { bg: '#fff8dc' });
    sp.position.set(0, 1.2, 0);
    g.add(sp);
  }

  function buildGate(zEnd) {
    const g = K.group(world, 0, 0, 3.6);
    [-1.7, 1.7].forEach((x) => {
      K.part(g, K.boxG(0.5, 2.6, 0.5), '#8d6e63', x, 1.3, 0);
      K.part(g, K.coneG(0.45, 0.5, 4), '#2e7d32', x, 2.85, 0).rotation.y = Math.PI / 4;
    });
    K.part(g, K.boxG(3.9, 0.7, 0.3), '#ffca28', 0, 2.5, 0);
    K.sign(g, '🦁 גן החיות 🐼', 3.2, 0, 2.5, 0.16);
    K.bunting(g, [-1.7, 2.05, 0.3], [1.7, 2.05, 0.3], 10);
    // רחבה ושביל
    const len = 5.5 - zEnd;
    K.part(world, K.boxG(3, 0.06, len), '#ecdcb4', 0, 0.03, 5.5 - len / 2).castShadow = false;
    K.part(world, K.boxG(13, 0.06, 3.4), '#ecdcb4', 0, 0.028, 5.2).castShadow = false;
    for (let z = 2; z > zEnd; z -= GAP) {
      K.lamp(world, -1.25, z - GAP / 2 + 0.2); K.lamp(world, 1.25, z - GAP / 2 + 0.2);
      K.bench(world, -1.2, z - 2.6, Math.PI / 2); K.bench(world, 1.2, z - 2.6, -Math.PI / 2);
    }
    for (let k = 0; k < 14; k++) {
      const z = 7 - k * 3, kind = ['round', 'pine', 'blossom'][k % 3];
      if (z < zEnd - 4) break;
      K.tree(world, -8 - K.rnd(k, 1) * 2, z, 1.3 + K.rnd(k, 2), k, kind);
      K.tree(world, 8 + K.rnd(k, 3) * 2, z, 1.3 + K.rnd(k, 4), k + 50, kind);
    }
  }

  // שדרוגים שנקנו מופיעים כמבנים ברחבת הכניסה
  function buildUpgrades() {
    const add = (id, x, fn) => {
      if (!L.upLevel(state, id)) return;
      const g = K.group(world, x, 0, 5.3);
      g.userData.pick = { type: 'up' };
      fn(g);
    };
    add('kiosk', -3.4, (g) => {
      K.part(g, K.boxG(1.3, 0.9, 1), '#fff3e0', 0, 0.45, 0);
      K.part(g, K.boxG(1.5, 0.12, 1.3), '#ef5350', 0, 1.25, 0.1);
      [-0.5, 0, 0.5].forEach((x) => K.part(g, K.boxG(0.25, 0.13, 1.31), '#ffffff', x, 1.25, 0.1));
      [-0.6, 0.6].forEach((x) => K.part(g, K.cylG(0.03, 0.03, 0.4, 6), '#90a4ae', x, 1, 0.6));
      K.part(g, K.coneG(0.16, 0.4, 10), '#d7a86e', 0, 1.6, 0).rotation.x = Math.PI;
      K.part(g, K.sphG(0.2, 12), '#f48fb1', 0, 1.9, 0);
    });
    add('gift', 3.4, (g) => {
      K.part(g, K.boxG(1.4, 1, 1.1), '#bbdefb', 0, 0.5, 0);
      K.part(g, K.coneG(1.15, 0.6, 4), '#8e24aa', 0, 1.3, 0).rotation.y = Math.PI / 4;
      K.part(g, K.boxG(0.35, 0.6, 0.04), '#6d4c41', 0, 0.3, 0.56);
      K.sign(g, '🎁', 0.5, 0, 1.3, 0.6);
    });
    add('vet', -5.4, (g) => {
      K.part(g, K.boxG(1.3, 1, 1.1), '#fafafa', 0, 0.5, 0);
      K.part(g, K.boxG(1.4, 0.1, 1.2), '#4dd0e1', 0, 1.05, 0);
      K.part(g, K.boxG(0.4, 0.12, 0.05), '#e53935', 0, 0.7, 0.56);
      K.part(g, K.boxG(0.12, 0.4, 0.05), '#e53935', 0, 0.7, 0.56);
    });
    add('feeder', 5.4, (g) => {
      K.part(g, K.cylG(0.5, 0.5, 1.4, 16), '#b0bec5', 0, 0.9, 0, { metalness: 0.4, roughness: 0.4 });
      K.part(g, K.coneG(0.56, 0.45, 16), '#e53935', 0, 1.82, 0);
      K.part(g, K.coneG(0.5, 0.3, 16), '#90a4ae', 0, 0.15, 0).rotation.x = Math.PI;
    });
    add('keeper', 2, (g) => {
      const p = K.person({ shirt: '#2e7d32', hat: '#f4d03f' });
      p.g.scale.setScalar(1.2);
      g.add(p.g);
      g.position.z = 4.4;
      K.part(g, K.cylG(0.02, 0.02, 1, 6), '#8d6e63', 0.25, 0.5, 0.05);
      K.part(g, K.boxG(0.26, 0.12, 0.05), '#fdd835', 0.25, 0.06, 0.05);
    });
  }

  function buildMess(zEnd) {
    const hit = K.mat('#ffffff', { transparent: true, opacity: 0, depthWrite: false });
    for (let k = 0; k < L.messCount(state); k++) {
      const g = K.group(world, (K.rnd(k, 7) - 0.5) * 2, 0.06, 2.5 - K.rnd(k, 8) * (2.5 - zEnd));
      g.userData.pick = { type: 'mess' };
      K.part(g, K.sphG(0.13, 8), '#8d6e63', 0, 0.06, 0);
      K.part(g, K.sphG(0.1, 8), '#6d4c41', 0.14, 0.04, 0.05);
      K.part(g, K.boxG(0.16, 0.02, 0.12), '#eeeeee', -0.12, 0.02, 0.1).rotation.y = k;
      K.part(g, K.sphG(0.08, 8), '#9ccc65', -0.02, 0.04, -0.14);
      K.part(g, K.sphG(0.45, 8), hit, 0, 0.2, 0).castShadow = false;
    }
  }

  function signature() {
    return JSON.stringify([state.order, state.animals, state.up, L.messCount(state), L.freeSlots(state) > 0, state.fed >= 50, Math.min(10, Math.ceil(L.visitorsPerMin(state) * 3))]);
  }
  function fit() {
    const rows = Math.max(1, Math.ceil(penList().length / 2));
    stage.look(0, -(rows - 1) * GAP / 2 + 0.5, 12 + rows * 3.2, 30 + rows * 8);
  }
  function draw() {
    if (!stage || riding) return;   // באמצע רכיבה או סיור לא בונים את הגן מחדש
    const s = signature();
    if (s === sig) return;
    sig = s;
    if (world) stage.scene.remove(world);
    world = new K.THREE.Group();
    animals = [];
    people = [];
    const pens = penList();
    const rows = Math.max(1, Math.ceil(pens.length / 2));
    const zEnd = -(rows - 1) * GAP - PEN / 2 - 0.5;
    K.part(world, K.boxG(300, 0.2, 300), '#7cc35a', 0, -0.1, 0).castShadow = false;
    pens.forEach((id, i) => (id ? buildPen(id, i) : buildLot(i)));
    buildGate(zEnd);
    buildUpgrades();
    buildMess(zEnd);
    // מבקרים מטיילים בשביל
    const n = Math.min(10, Math.ceil(L.visitorsPerMin(state) * 3));
    for (let k = 0; k < n; k++) {
      const p = K.person({ kid: k % 3 === 0, balloon: k % 4 === 1 ? K.pick(['#ef5350', '#42a5f5', '#ffca28']) : null });
      const v = { p, x: (k % 2 ? 0.7 : -0.7) + (Math.random() - 0.5) * 0.5, z: 3 - Math.random() * (3 - zEnd), dir: k % 2 ? 1 : -1, sp: 0.5 + Math.random() * 0.4, wait: 0, zEnd };
      p.g.position.set(v.x, 0.06, v.z);
      world.add(p.g);
      people.push(v);
    }
    stage.scene.add(world);
    if (rows !== rowsDrawn) { rowsDrawn = rows; fit(); }
  }

  function stepAnimal(a, dt, t) {
    const g = a.m.g;
    if (a.wait > 0) {
      a.wait -= dt;
      a.moving = false;
      if (a.wait <= 0) { a.tx = (Math.random() * 2 - 1) * a.lim; a.tz = (Math.random() * 2 - 1) * a.lim; }
    } else {
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), step = a.m.speed * dt;
      if (d <= step) { a.wait = 1 + Math.random() * 4; a.moving = false; }
      else { a.x += dx / d * step; a.z += dz / d * step; a.rot = Math.atan2(dx, dz); a.moving = true; }
    }
    if (a.moving) a.ph += dt * (4 + a.m.speed * 8);
    const s = Math.sin(a.ph);
    a.m.legs.forEach((leg, i) => { leg.rotation.x = a.moving ? (i === 0 || i === 3 ? s : -s) * 0.5 : 0; });
    a.jump = Math.max(0, a.jump - dt * 2.2);
    g.position.set(a.x, 0.08 + (a.moving && a.m.hop ? Math.abs(s) * a.m.hop : 0) + Math.sin(a.jump * Math.PI) * 0.45, a.z);
    g.rotation.z = a.moving && a.m.waddle ? s * a.m.waddle : 0;
    let diff = a.rot - g.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    g.rotation.y += diff * Math.min(1, dt * 5);
    a.m.anim(t + a.ph, a.moving);
  }
  function stepPerson(v, dt) {
    if (v.wait > 0) { v.wait -= dt; K.stillPose(v.p); return; }
    v.z += v.dir * v.sp * dt;
    if (v.z > 3.2) v.dir = -1; else if (v.z < v.zEnd) v.dir = 1;
    else if (Math.random() < dt * 0.08) { v.wait = 2 + Math.random() * 3; v.p.g.rotation.y = v.x < 0 ? -Math.PI / 2 : Math.PI / 2; return; }
    v.p.g.position.z = v.z;
    v.p.g.rotation.y = v.dir > 0 ? 0 : Math.PI;
    K.walkPose(v.p, dt, v.sp);
  }

  // ---------- חוויות: רכיבה על חיה, רכבת ספארי, מופע חיות, וחיה שבורחת מהמתחם ----------
  let riding = false, rideTimer = 0, nightPref = false;
  let showLeft = 0, showClock = 0;
  let runner = null, runnerClock = 45;   // שניות עד שחיה תברח
  const hidden = () => K.mat('#ffffff', { transparent: true, opacity: 0, depthWrite: false });

  function exitRide() {
    if (!stage || !riding) return;
    clearTimeout(rideTimer);
    riding = false;
    stage.setRideCam(null);
    $('exitBtn').hidden = true;
    draw();
  }
  function startRide(fn, ms, label) {
    exitRide();
    riding = true;
    stage.setRideCam(fn);
    $('exitBtn').textContent = label;
    $('exitBtn').hidden = false;
    rideTimer = setTimeout(exitRide, ms);
    $('scene').scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  }
  // רכיבה: המצלמה יושבת על הגב של החיה ורואה את המתחם מהעיניים שלה
  function rideAnimal(id) {
    const a = L.ANIMAL_BY_ID[id];
    const an = animals.find((x) => x.id === id && !x.baby) || animals.find((x) => x.id === id);
    if (!stage || !a || !an) return say('כדי לרכוב צריך חיה בגן ותצוגת תלת-ממד');
    const top = new K.THREE.Box3().setFromObject(an.m.g).max.y + 0.3;
    an.wait = 0.01;
    startRide((cam) => {
      const g = an.m.g, r = g.rotation.y, px = an.pen.position.x + g.position.x, pz = an.pen.position.z + g.position.z;
      cam.position.set(px - Math.sin(r) * 0.15, top + g.position.y - 0.08, pz - Math.cos(r) * 0.15);
      cam.lookAt(px + Math.sin(r) * 4, top - 0.6, pz + Math.cos(r) * 4);
    }, 20000, '⬇️ לרדת מהחיה');
    state.rode++;
    persist(false);
    say(`🤠 יוהו! אתם רוכבים על ה${a.name}`);
  }
  // רכבת ספארי: נסיעה לאורך השביל עד סוף הגן ובחזרה, עם מבט לחיות משני הצדדים
  function safari() {
    if (!stage) return say('הסיור זמין רק בתצוגת תלת-ממד');
    if (!L.animalCount(state)) return say('קנו חיה ראשונה, ואז צאו לסיור');
    const rows = Math.max(1, Math.ceil(penList().length / 2));
    const zEnd = -(rows - 1) * GAP - PEN / 2, len = 4.5 - zEnd, dur = len / 1.5;
    const t0 = performance.now();
    let over = false;
    startRide((cam) => {
      const sec = (performance.now() - t0) / 1000, u = sec / dur;   // 0 עד 2: הלוך וחזור
      if (u >= 2) { if (!over) { over = true; setTimeout(exitRide, 0); } return; }
      const back = u > 1, z = 4.5 - (back ? 2 - u : u) * len;
      cam.position.set(0, 1.25 + (still ? 0 : Math.sin(sec * 9) * 0.015), z);
      cam.lookAt(Math.sin(sec * 0.7) * 5, 0.7, z + (back ? 3 : -3));
    }, (dur * 2 + 2) * 1000, '⬇️ לרדת מהרכבת');
    state.tours++;
    persist(false);
    say('🚂 רכבת הספארי יוצאת לדרך! הביטו בחיות משני הצדדים');
  }
  // חיה שברחה: רצה בשביל עם סימן קריאה מעליה. לחיצה עליה מחזירה אותה למתחם ומזכה בפרס
  function spawnRunner() {
    const ids = Object.keys(state.animals).filter((id) => state.animals[id] > 0);
    runnerClock = 70 + Math.random() * 50;
    if (!stage || runner || riding || !ids.length || document.hidden) return;
    const id = K.pick(ids), a = L.ANIMAL_BY_ID[id], m = M.build(id);
    const rows = Math.max(1, Math.ceil(penList().length / 2));
    const zEnd = -(rows - 1) * GAP - PEN / 2;
    const g = new K.THREE.Group();
    g.userData.pick = { type: 'escape' };
    m.g.scale.setScalar(0.8);
    g.add(m.g);
    const sp = K.sprite('❗', 0.55, { bg: '#ffeb3b' });
    sp.position.y = new K.THREE.Box3().setFromObject(m.g).max.y + 0.5;
    g.add(sp);
    K.part(g, K.sphG(0.9, 8), hidden(), 0, 0.5, 0).castShadow = false;   // אזור לחיצה גדול
    runner = { id, m, g, z: zEnd + 1, dir: 1, left: 40, ph: 0, zEnd };
    g.position.set(0, 0.06, runner.z);
    stage.scene.add(g);
    say(`❗ ${a.icon} ה${a.name} ברח מהמתחם! לחצו עליו כדי להחזיר אותו`);
  }
  function dropRunner() {
    if (runner) stage.scene.remove(runner.g);
    runner = null;
  }
  function stepFun(dt, t) {
    runnerClock -= dt;
    if (runnerClock <= 0) spawnRunner();
    const r = runner;
    if (r) {
      r.left -= dt;
      if (r.left <= 0) { dropRunner(); say('החיה חזרה לבד למתחם שלה'); }
      else if (!still) {
        r.z += r.dir * Math.max(1.3, r.m.speed * 2.2) * dt;
        if (r.z > 3) r.dir = -1; else if (r.z < r.zEnd) r.dir = 1;
        r.g.position.set(Math.sin(t * 1.3) * 0.7, 0.06, r.z);
        r.g.rotation.y = r.dir > 0 ? 0 : Math.PI;
        r.ph += dt * 12;
        const s = Math.sin(r.ph);
        r.m.legs.forEach((leg, i) => { leg.rotation.x = (i === 0 || i === 3 ? s : -s) * 0.6; });
        r.m.anim(t, true);
      }
    }
    // מופע: החיות קופצות ומסתובבות בתורות, וקונפטי עף מעל המתחמים
    if (showLeft > 0) {
      showLeft -= dt;
      showClock -= dt;
      if (showClock <= 0 && animals.length && !still) {
        showClock = 0.3;
        const a = K.pick(animals);
        a.jump = 1;
        a.rot += Math.PI;
        stage.burst(new K.THREE.Vector3(a.pen.position.x + a.x, 1.3, a.pen.position.z + a.z), ['🎉', '⭐', '👏', '🎵', '🎈'], 5, { size: 0.6, spread: 2.5 });
      }
    }
  }

  if (stage) {
    stage.addClouds(7, 60, 22);
    stage.frame((dt, t) => {
      stepFun(dt, t);
      if (still) return;
      animals.forEach((a) => stepAnimal(a, dt, t));
      people.forEach((v) => stepPerson(v, dt));
    });
    stage.onTap = (e) => {
      const h = world && stage.pick(e, runner ? [runner.g, world] : [world]);
      if (!h) return;
      const p = h.pick;
      if (p.type === 'escape' && runner) {
        const a = L.ANIMAL_BY_ID[runner.id], coins = L.caughtOne(state);
        earn(coins, 'תפסתם חיה שברחה');
        h.point.y += 0.5;
        stage.burst(h.point, ['🎉', '❤️', '⭐'], 8, { size: 0.6, spread: 2.5 });
        dropRunner();
        persist(false);
        say(`🏃 תפסתם את ה${a.name} והחזרתם אותו למתחם! +${coins} 🪙`);
        renderAll();
      } else if (p.type === 'lot') { setTab('animals'); say('בחרו חיה חדשה מהרשימה למטה'); }
      else if (p.type === 'up') setTab('ups');
      else if (p.type === 'mess') {
        L.handClean(state);
        stage.burst(h.point, ['✨', '🧹'], 6);
        say('אספתם לכלוך. הגן נקי יותר!');
        persist(false);
        renderAll();
      } else if (p.type === 'pen') {
        sel = p.id;
        const a = L.ANIMAL_BY_ID[p.id];
        h.point.y += 0.6;
        stage.burst(h.point, ['❤️', '💕', '🥕'], 5);
        animals.forEach((an) => { if (an.m.g.parent === h.object || an.m.g.parent === h.object.parent) an.jump = 1; });
        if (Date.now() - petAt > 1500 && state.fed < 100) { petAt = Date.now(); L.handFeed(state); persist(false); }
        say(`${a.icon} ליטפתם והאכלתם את ה${a.name}`);
        renderAll();
      }
    };
    $('centerBtn').onclick = () => { exitRide(); fit(); };
    $('exitBtn').onclick = exitRide;
    $('nightBtn').onclick = () => { nightPref = !nightPref; stage.setNight(nightPref); $('nightBtn').textContent = nightPref ? '☀️ יום' : '🌙 לילה'; };
  } else {
    $('scene').innerHTML = '<p class="no3d">התלת-ממד לא זמין במכשיר הזה. אפשר לשחק בעזרת הלוחות למטה.</p>';
    $('centerBtn').hidden = $('nightBtn').hidden = true;
  }

  // ---------- לוחות ----------
  const TABS = [['animals', '🐾 חיות'], ['care', '🥕 טיפול'], ['fun', '🎪 חוויות'], ['ups', '🏗️ שדרוגים'], ['goals', '🎯 משימות'], ['album', '📖 אלבום'], ['quiz', '❓ חידון']];
  function setTab(t) { tab = t; renderAll(); }

  function renderHud() {
    const st = L.stars(state);
    $('hud').innerHTML =
      `<span title="כוכבי הגן">${'⭐'.repeat(st)}${'☆'.repeat(5 - st)}</span>` +
      `<span>💰 ${state.rate.toFixed(1)} לדקה</span>` +
      `<span>🚶 ${L.visitorsPerMin(state).toFixed(1)}</span>` +
      `<span>😊 ${L.happiness(state)}%</span>` +
      `<span>🐾 ${L.animalCount(state)}/${L.capacity(state)}</span>`;
  }
  function renderTabs() {
    const ready = L.goalsReady(state);
    $('tabs').innerHTML = TABS.map(([id, label]) =>
      `<button class="tab${id === tab ? ' on' : ''}" role="tab" aria-selected="${id === tab}" data-a="tab" data-id="${id}">${label}${id === 'goals' && ready ? `<b class="badge">${ready}</b>` : ''}</button>`).join('');
  }
  function renderSel() {
    const box = $('sel');
    const a = sel && L.ANIMAL_BY_ID[sel];
    const n = a ? state.animals[sel] || 0 : 0;
    box.hidden = !n;
    if (!n) return;
    box.innerHTML = `<div><strong>${a.icon} ${a.name} ×${n}</strong><small>${a.fact}</small></div>` +
      `<button class="act" data-a="buy" data-id="${sel}">➕ עוד אחד (${a.price} 🪙)</button>` +
      (stage ? `<button class="act" data-a="ride" data-id="${sel}">🤠 רכיבה</button>` : '') +
      `<button class="act ghost" data-a="sell" data-id="${sel}">מכירה (+${Math.floor(a.price / 2)} 🪙)</button>`;
  }
  function meter(label, value, cls, pct, note) {
    return `<div class="meter"><div class="meter-head"><span>${label}</span><strong>${value}</strong></div>` +
      `<div class="meter-bar"><div class="meter-fill ${cls}" style="width:${Math.max(0, Math.min(100, Math.round(pct)))}%"></div></div>` +
      `<div class="meter-note">${note}</div></div>`;
  }

  const PANELS = {
    animals() {
      const free = L.freeSlots(state);
      return `<p class="note">${free > 0 ? `נשארו ${free} מקומות פנויים. לחיצה על חיה קונה אותה. לכל סוג יש מתחם משלו.` : 'אין מקום בגן. הרחיבו אותו בלשונית הטיפול.'}</p><div class="cards">` +
        L.ANIMALS.map((a) => {
          const n = state.animals[a.id] || 0;
          return `<button class="card${balance() < a.price || free <= 0 ? ' cant' : ''}" data-a="buy" data-id="${a.id}">` +
            `<span class="icon">${a.icon}</span><span>${a.name}</span>${n ? `<span class="own">יש לכם ${n}</span>` : ''}<span class="price">${a.price} 🪙</span></button>`;
        }).join('') + '</div>';
    },
    care() {
      const f = L.feed(state), c = L.clean(state), x = L.canExpand(state);
      return '<div class="meters">' +
        meter('🥕 אוכל', `${Math.round(state.fed)}%`, 'fed', state.fed, 'ליטוף חיה מאכיל אותה קצת, בחינם') +
        meter('🧹 ניקיון', `${Math.round(state.clean)}%`, 'clean', state.clean, 'לחצו על ערימות לכלוך בשביל כדי לאסוף אותן') +
        '</div><div class="row">' +
        `<button class="act" data-a="feed" ${f.ok ? '' : 'disabled'}>🥕 האכלה מלאה${f.ok ? ` (${f.cost} 🪙)` : ''}</button>` +
        `<button class="act" data-a="clean" ${c.ok ? '' : 'disabled'}>🧹 ניקיון מלא${c.ok ? ` (${c.cost} 🪙)` : ''}</button>` +
        `<button class="act" data-a="expand" ${x.ok ? '' : 'disabled'}>${x.ok ? `➕ הרחבת הגן (${x.cost} 🪙, עוד ${L.SLOT_STEP} מקומות)` : '➕ הגן במקסימום'}</button>` +
        '</div><h2>🎟️ מחיר כרטיס</h2><div class="row">' +
        L.PRICES.map((p) => `<button class="chip${state.price === p ? ' on' : ''}" aria-pressed="${state.price === p}" data-a="price" data-id="${p}">${p} 🪙</button>`).join('') +
        `</div><p class="note">כרטיס יקר: פחות מבקרים, אבל כל אחד משלם יותר. ההכנסה (עד ${L.rateMax(state)} 🪙 לדקה) נכנסת לעיר לבד.</p>`;
    },
    fun() {
      const wait = L.showWait(state, Date.now());
      const mine = state.order.filter((id) => state.animals[id] > 0);
      return '<p class="note">סיור ברכבת, מופע של החיות ורכיבה על חיה. לפעמים חיה בורחת מהמתחם: מי שתופס אותה בשביל מקבל פרס.</p><div class="row">' +
        '<button class="act" data-a="safari">🚂 רכבת ספארי</button>' +
        `<button class="act${wait ? '' : ' pulse'}" data-a="show" ${wait ? 'disabled' : ''}>🎪 מופע חיות${wait ? ` (בעוד ${Math.ceil(wait / 60000)} דק')` : ''}</button>` +
        '</div><h2>🤠 רכיבה על חיה</h2><div class="row">' +
        (mine.length ? mine.map((id) => { const a = L.ANIMAL_BY_ID[id]; return `<button class="chip" data-a="ride" data-id="${id}">${a.icon} ${a.name}</button>`; }).join('') : '<span class="note">קנו חיה כדי לרכוב עליה</span>') +
        `</div><p class="note">מופעים: ${state.shows} · רכיבות: ${state.rode} · סיורים: ${state.tours} · חיות שנתפסו: ${state.caught}</p>`;
    },
    ups() {
      return '<div class="list">' + L.UPGRADES.map((u) => {
        const lv = L.upLevel(state, u.id), c = L.canUpgrade(state, u.id);
        return `<div class="item"><span class="icon">${u.icon}</span><div><strong>${u.name}${u.price.length > 1 ? ` (רמה ${lv}/${u.price.length})` : ''}</strong><small>${u.desc}</small></div>` +
          (c.ok ? `<button class="act" data-a="up" data-id="${u.id}">${c.cost} 🪙</button>` : '<span class="done">✅ נקנה</span>') + '</div>';
      }).join('') + '</div>';
    },
    goals() {
      return '<div class="list">' + L.GOALS.map((g) => {
        const st = L.goalState(state, g);
        return `<div class="item ${st}"><span class="icon">${g.icon}</span><div><strong>${g.text}</strong><small>פרס: ${g.reward} 🪙</small></div>` +
          (st === 'ready' ? `<button class="act pulse" data-a="claim" data-id="${g.id}">🎁 קבלו פרס</button>` : st === 'done' ? '<span class="done">✅</span>' : '<span class="done">⏳</span>') + '</div>';
      }).join('') + '</div>';
    },
    album() {
      return '<div class="list">' + L.ANIMALS.map((a) => {
        const has = state.animals[a.id] > 0;
        return `<div class="item${has ? '' : ' locked'}"><span class="icon">${has ? a.icon : '❔'}</span><div><strong>${has ? a.name : '???'}</strong><small>${has ? a.fact : 'קנו את החיה כדי לגלות עובדה עליה'}</small></div></div>`;
      }).join('') + '</div>';
    },
    quiz() {
      if (!L.animalCount(state)) return '<p class="note">קנו חיה ראשונה כדי לשחק בחידון "מי אני?"</p>';
      if (quiz) {
        return `<p class="q">🤔 מי אני? ${quiz.fact}</p><div class="row center">` +
          quiz.options.map((id) => { const a = L.ANIMAL_BY_ID[id]; return `<button class="act big" data-a="ans" data-id="${id}">${a.icon} ${a.name}</button>`; }).join('') + '</div>';
      }
      const wait = L.quizWait(state, Date.now());
      return `<p class="q">${quizMsg || 'עובדה על אחת החיות שלכם, ואתם מנחשים מי זו.'}</p>` +
        (wait > 0 ? `<p class="note">השאלה הבאה בעוד ${Math.ceil(wait / 1000)} שניות</p>` : `<div class="row center"><button class="act big" data-a="quiz">❓ שאלה חדשה (פרס ${L.QUIZ_REWARD} 🪙)</button></div>`);
    },
  };

  function renderAll() {
    refresh();
    renderHud();
    renderTabs();
    renderSel();
    $('panel').innerHTML = PANELS[tab]();
    draw();
  }

  const ACTS = {
    tab: (id) => { tab = id; },
    buy(id) {
      const a = L.ANIMAL_BY_ID[id], c = L.canBuy(state, id);
      if (!c.ok) return say(c.msg);
      if (!pay(c.cost)) return;
      L.buy(state, id);
      sel = id;
      persist();
      say(`${a.icon} קניתם ${a.name}! −${c.cost} 🪙`);
    },
    sell(id) {
      const a = L.ANIMAL_BY_ID[id];
      if (!confirm(`למכור את ה${a.name}? יוחזר חצי מהמחיר.`)) return;
      const r = L.sell(state, id);
      if (!r.ok) return say(r.msg);
      earn(r.refund, `מכרתם ${a.name}`);
      persist();
      say(`מכרתם ${a.name}. הוחזרו ${r.refund} 🪙`);
    },
    feed() {
      const f = L.feed(state);
      if (!f.ok) return say(f.msg);
      if (!pay(f.cost)) return;
      state.fed = 100;
      persist();
      say(`האכלתם את כל החיות! −${f.cost} 🪙`);
    },
    clean() {
      const c = L.clean(state);
      if (!c.ok) return say(c.msg);
      if (!pay(c.cost)) return;
      state.clean = 100;
      persist();
      say(`הגן מבריק! −${c.cost} 🪙`);
    },
    expand() {
      const x = L.canExpand(state);
      if (!x.ok) return say(x.msg);
      if (!pay(x.cost)) return;
      L.expand(state);
      persist();
      say(`הגן גדל! יש מקום ל־${L.capacity(state)} חיות. −${x.cost} 🪙`);
    },
    price(id) {
      L.setPrice(state, +id);
      persist();
    },
    up(id) {
      const c = L.canUpgrade(state, id);
      if (!c.ok) return say(c.msg);
      if (!pay(c.cost)) return;
      L.upgrade(state, id);
      persist();
      say(`${L.UPGRADE_BY_ID[id].icon} ${L.UPGRADE_BY_ID[id].name} נבנה! −${c.cost} 🪙`);
    },
    claim(id) {
      const r = L.claimGoal(state, id);
      if (!r.ok) return say(r.msg);
      earn(r.reward, 'משימה בגן החיות');
      persist();
      say(`🎉 כל הכבוד! קיבלתם ${r.reward} 🪙`);
    },
    ride(id) { rideAnimal(id); },
    safari() { safari(); },
    show() {
      const r = L.runShow(state, Date.now());
      if (!r.ok) return say(r.msg);
      earn(r.tips, 'מופע חיות');
      persist();
      showLeft = 8;
      if (stage) $('scene').scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
      say(`🎪 איזה מופע! המבקרים השאירו ${r.tips} 🪙`);
    },
    quiz() {
      if (L.quizWait(state, Date.now()) > 0) return;
      quiz = L.makeQuiz(state);
      quizMsg = '';
    },
    ans(id) {
      if (!quiz) return;
      const right = L.ANIMAL_BY_ID[quiz.answer];
      if (id === quiz.answer) { earn(L.QUIZ_REWARD, 'חידון גן החיות'); quizMsg = `✅ נכון! זה ${right.icon} ${right.name}. קיבלתם ${L.QUIZ_REWARD} 🪙`; }
      else quizMsg = `לא הפעם. התשובה: ${right.icon} ${right.name}`;
      quiz = null;
      L.quizAnswered(state, Date.now());
      persist(false);
    },
  };
  document.querySelector('.container').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    ACTS[b.dataset.a](b.dataset.id);
    renderAll();
  });

  if (W) W.onChange(() => { $('balance').textContent = balance(); if (tab === 'animals') renderAll(); });
  $('balance').textContent = balance();

  // עם הזמן החיות מתלכלכות ורעבות, ולפעמים נולד גור. שומרים במכשיר בלבד כדי לא להעמיס על הענן
  setInterval(() => {
    L.decay(state, 5000);
    const baby = L.tryBreed(state, Date.now());
    if (baby) {
      const a = L.ANIMAL_BY_ID[baby];
      say(`🍼 נולד גור ${a.name} בגן!`);
      persist();
    } else persist(false);
    if (quiz || tab === 'album') { renderHud(); renderTabs(); draw(); } else renderAll();
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
