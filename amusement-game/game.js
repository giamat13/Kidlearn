// לונה פארק: המסך. החוקים נמצאים ב-logic.js (AmusementLogic), המודלים ב-rides.js (ParkModels).
// אטרקציה בעיר: הנתונים נשמרים לפי החלקה (?cell=c,r) במכשיר ובחשבון. עובד גם בדפדפן רגיל בלי כניסה.
// ההכנסה לדקה נשמרת בנתונים, והעיר מוסיפה אותה למסים שלה (משולם לבד, גם כשהילד לא בעיר, עד 3 שעות).
(function () {
  const L = window.AmusementLogic;
  const W = window.KidLearnWallet;
  const K = window.K3D;
  const M = window.ParkModels;
  const store = KidLearnAttraction.create('kidlearn-amusement');
  const $ = (id) => document.getElementById(id);

  let state = L.normalize(store.load());
  L.decay(state, Date.now() - state.at);
  state.at = Date.now();

  let tab = 'build';
  let chosen = null;     // המתקן שנבחר בחנות ומחכה למשבצת
  let sel = null;        // המשבצת שנבחרה (מתקן קיים)

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
  const CELL = 6;
  const still = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const stage = K && M ? K.createStage($('scene'), { sky: ['#4fb3ff', '#ffe9c9'], camPos: [0, 16, 22], target: [0, 0, -6], maxDist: 80, shadow: 30, fog: [60, 190] }) : null;
  let world = null, sig = '', rides = new Map(), people = [], rowsDrawn = -1, nightPref = false, rideTimer = 0;
  const cx = (c) => (c - (state.cols - 1) / 2) * CELL;
  const cz = (r) => -r * CELL;

  function buildCell(x, y) {
    const k = L.cellKey(x, y), id = state.grid[k];
    const g = K.group(world, cx(x), 0, cz(y));
    if (!id) {
      g.userData.pick = { type: 'cell', x, y };
      K.part(g, K.cylG(2.5, 2.5, 0.06, 28), '#bfe3a0', 0, 0.09, 0).castShadow = false;
      K.part(g, K.torusG(2.5, 0.06, 36), '#ffffff', 0, 0.12, 0).rotation.x = Math.PI / 2;
      return;
    }
    g.userData.pick = { type: 'ride', k };
    const item = L.ITEM_BY_ID[id], lv = L.levelOf(state, k), broken = L.isBroken(state, k);
    K.part(g, K.cylG(2.75, 2.75, 0.06, 28), ['#f6e7c6', '#ffe0b2', '#ffd180'][lv - 1], 0, 0.09, 0).castShadow = false;
    const m = M.build(id);
    if (item.stall) { m.g.scale.setScalar(1.25); m.g.position.z = -0.6; }
    g.add(m.g);
    const tag = K.sprite(broken ? '🔧 מקולקל' : `${item.icon} ${item.name}${lv > 1 ? ' ' + '⭐'.repeat(lv - 1) : ''}`, 0.5, { bg: broken ? '#ffcdd2' : '#ffffff' });
    tag.position.set(0, 0.75, 2.75);
    g.add(tag);
    if (lv > 1) [-2.3, 2.3].forEach((fx) => { K.part(g, K.cylG(0.03, 0.03, 1.6, 6), '#eceff1', fx, 0.8, 2.3); K.part(g, K.coneG(0.16, 0.4, 3), lv > 2 ? '#ffca28' : '#42a5f5', fx + 0.18, 1.45, 2.3).rotation.z = -Math.PI / 2; });
    rides.set(k, { m, broken, g });
  }

  function buildPark() {
    const w = state.cols * CELL, d = state.rows * CELL, zc = -(state.rows - 1) * CELL / 2, h = w / 2 + 0.6, z0 = CELL / 2 + 0.6, z1 = zc - d / 2 - 0.6;
    K.part(world, K.boxG(400, 0.2, 400), '#7cc35a', 0, -0.1, 0).castShadow = false;
    K.part(world, K.boxG(w + 1.2, 0.1, d + 1.2), '#e3d5bb', 0, 0.02, zc).castShadow = false;
    K.part(world, K.boxG(4, 0.1, 4), '#e3d5bb', 0, 0.02, z0 + 2).castShadow = false;
    K.fence(world, -h, z1, h, z1, { kind: 'white' });
    K.fence(world, -h, z1, -h, z0, { kind: 'white' });
    K.fence(world, h, z1, h, z0, { kind: 'white' });
    K.fence(world, -h, z0, -2.2, z0, { kind: 'white' });
    K.fence(world, 2.2, z0, h, z0, { kind: 'white' });
    // שער
    const g = K.group(world, 0, 0, z0);
    [-2.2, 2.2].forEach((x, i) => {
      K.part(g, K.cylG(0.35, 0.4, 3.4, 12), i ? '#ef5350' : '#42a5f5', x, 1.7, 0);
      K.part(g, K.coneG(0.5, 0.8, 12), '#ffca28', x, 3.8, 0);
      K.part(g, K.sphG(0.14, 8), K.glow('#fff3b0'), x, 4.3, 0);
    });
    K.part(g, K.boxG(4.8, 0.9, 0.3), '#8e24aa', 0, 3.2, 0);
    K.sign(g, '🎡 לונה פארק 🎢', 4.2, 0, 3.2, 0.16);
    K.bunting(g, [-2.2, 2.7, 0.2], [2.2, 2.7, 0.2], 12);
    // פנסים בצמתים, עצים מסביב
    for (let j = 0; j <= state.rows; j++) for (let i = 0; i <= state.cols; i++) if ((i + j) % 2 === 0) K.lamp(world, (i - state.cols / 2) * CELL, CELL / 2 - j * CELL, 2);
    for (let k = 0; k < 40; k++) {
      const side = k % 3, t = K.rnd(k, 1);
      const x = side === 0 ? -h - 2 - K.rnd(k, 2) * 5 : side === 1 ? h + 2 + K.rnd(k, 2) * 5 : (t - 0.5) * (w + 14);
      const z = side === 2 ? z1 - 2 - K.rnd(k, 3) * 5 : z0 + 3 - t * (d + 8);
      K.tree(world, x, z, 1.6 + K.rnd(k, 4) * 1.4, k, ['round', 'pine', 'blossom', 'round'][k % 4]);
    }
  }

  function signature() {
    return JSON.stringify([state.rows, state.grid, state.lv, state.broken, Math.min(14, Math.ceil(L.servedPerMin(state) * 3))]);
  }
  function fit() {
    stage.setRideCam(null);
    $('exitBtn').hidden = true;
    stage.look(0, -(state.rows - 1) * CELL / 2 + 1, 17 + state.rows * 3.6, 50 + state.rows * 8);
  }
  function draw() {
    if (!stage) return;
    const s = signature();
    if (s === sig) return;
    sig = s;
    exitRide();
    if (world) stage.scene.remove(world);
    world = new K.THREE.Group();
    rides = new Map();
    people = [];
    buildPark();
    for (let y = 0; y < state.rows; y++) for (let x = 0; x < state.cols; x++) buildCell(x, y);
    // מבקרים הולכים בשבילים שבין המתקנים
    const n = Math.min(14, Math.ceil(L.servedPerMin(state) * 3));
    for (let k = 0; k < n; k++) {
      const p = K.person({ kid: k % 3 === 0, balloon: k % 4 === 1 ? K.pick(['#ef5350', '#42a5f5', '#ffca28', '#66bb6a']) : null });
      p.g.scale.multiplyScalar(1.5);
      const v = { p, i: Math.floor(Math.random() * (state.cols + 1)), j: Math.floor(Math.random() * (state.rows + 1)), sp: 0.9 + Math.random() * 0.6, wait: Math.random() * 2, ox: (Math.random() - 0.5) * 0.9, oz: (Math.random() - 0.5) * 0.9 };
      v.x = v.tx = (v.i - state.cols / 2) * CELL; v.z = v.tz = CELL / 2 - v.j * CELL;
      p.g.position.set(v.x + v.ox, 0.07, v.z + v.oz);
      world.add(p.g);
      people.push(v);
    }
    stage.scene.add(world);
    if (state.rows !== rowsDrawn) { rowsDrawn = state.rows; fit(); }
  }

  function stepPerson(v, dt) {
    if (v.wait > 0) { v.wait -= dt; K.stillPose(v.p); return; }
    const dx = v.tx - v.x, dz = v.tz - v.z, d = Math.hypot(dx, dz), step = v.sp * dt;
    if (d <= step) {
      v.x = v.tx; v.z = v.tz;
      if (Math.random() < 0.3) v.wait = 1 + Math.random() * 3;
      // הצומת הבא: אחד מהשכנים
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => [v.i + a, v.j + b]).filter(([a, b]) => a >= 0 && a <= state.cols && b >= 0 && b <= state.rows);
      [v.i, v.j] = K.pick(opts);
      v.tx = (v.i - state.cols / 2) * CELL; v.tz = CELL / 2 - v.j * CELL;
    } else {
      v.x += dx / d * step; v.z += dz / d * step;
      v.p.g.rotation.y = Math.atan2(dx, dz);
      K.walkPose(v.p, dt, v.sp * 0.7);
    }
    v.p.g.position.set(v.x + v.ox, 0.07, v.z + v.oz);
  }

  // "לעלות על המתקן": המצלמה יושבת במושב ומסתכלת קדימה
  function exitRide() {
    if (!stage) return;
    clearTimeout(rideTimer);
    stage.setRideCam(null);
    $('exitBtn').hidden = true;
  }
  function rideOn(k) {
    const r = rides.get(k);
    if (!stage || !r || !r.m.seat) return say('אי אפשר לעלות על זה');
    if (r.broken) return say('המתקן מקולקל. תקנו אותו קודם 🔧');
    const V = K.THREE.Vector3, v = new V(), prev = new V(), dir = new V(0, 0, -1);
    r.m.seat.getWorldPosition(prev);
    stage.setRideCam((cam) => {
      r.m.seat.getWorldPosition(v);
      const d = v.clone().sub(prev);
      if (d.lengthSq() > 1e-7) dir.lerp(d.normalize(), 0.12).normalize();
      prev.copy(v);
      cam.position.set(v.x, v.y + 0.5, v.z);
      cam.lookAt(v.x + dir.x * 5, v.y + 0.3 + dir.y * 3, v.z + dir.z * 5);
    });
    $('exitBtn').hidden = false;
    clearTimeout(rideTimer);
    rideTimer = setTimeout(exitRide, 25000);
    state.rode++;
    persist(false);
    say('🎥 יוהו! אתם על המתקן');
  }

  function fireworks() {
    if (!stage) return;
    stage.setNight(true);
    let n = 0;
    const iv = setInterval(() => {
      const p = new K.THREE.Vector3((Math.random() - 0.5) * state.cols * CELL, 8 + Math.random() * 5, -Math.random() * state.rows * CELL);
      stage.burst(p, ['✨', '🎆', '⭐', '💥', '🎇'], 14, { size: 1.1, spread: 7, up: 2, life: 1.6, gravity: 1.6 });
      if (++n >= 12) { clearInterval(iv); setTimeout(() => stage.setNight(nightPref), 1600); }
    }, 380);
  }

  if (stage) {
    stage.addClouds(8, 80, 28);
    stage.frame((dt, t) => {
      if (still) return;
      rides.forEach((r) => { if (!r.broken) r.m.anim(t); });
      people.forEach((v) => stepPerson(v, dt));
    });
    stage.onTap = (e) => {
      const h = world && stage.pick(e, [world]);
      if (!h) return;
      const p = h.pick;
      if (p.type === 'ride') { sel = p.k; chosen = null; renderAll(); }
      else if (p.type === 'cell') {
        if (!chosen) { tab = 'build'; say('בחרו מתקן מהרשימה למטה, ואז לחצו על משבצת ריקה'); return renderAll(); }
        if (placeAt(chosen, p.x, p.y)) { h.point.y = 1.5; stage.burst(h.point, ['✨', '🎉', '⭐'], 10, { size: 0.7, spread: 4 }); }
        renderAll();
      }
    };
    $('centerBtn').onclick = fit;
    $('exitBtn').onclick = exitRide;
    $('nightBtn').onclick = () => { nightPref = !nightPref; stage.setNight(nightPref); $('nightBtn').textContent = nightPref ? '☀️ יום' : '🌙 לילה'; };
  } else {
    $('scene').innerHTML = '<p class="no3d">התלת-ממד לא זמין במכשיר הזה. אפשר לשחק בעזרת הלוחות למטה.</p>';
    $('centerBtn').hidden = $('nightBtn').hidden = true;
  }

  function placeAt(id, x, y) {
    const item = L.ITEM_BY_ID[id], c = L.canPlace(state, id, x, y);
    if (!c.ok) { say(c.msg); return false; }
    if (!pay(c.cost)) return false;
    L.place(state, id, x, y);
    sel = L.cellKey(x, y);
    persist();
    say(`${item.icon} בניתם ${item.name}! −${c.cost} 🪙`);
    return true;
  }

  // ---------- לוחות ----------
  const TABS = [['build', '🎢 בנייה'], ['manage', '🛠️ ניהול'], ['goals', '🎯 משימות']];

  function renderHud() {
    const st = L.stars(state), bad = L.brokenCount(state), q = L.queueRatio(state);
    $('hud').innerHTML =
      `<span title="כוכבי הפארק">${'⭐'.repeat(st)}${'☆'.repeat(5 - st)}</span>` +
      `<span>💰 ${state.rate.toFixed(1)} לדקה</span>` +
      `<span>🚶 ${L.servedPerMin(state).toFixed(1)}</span>` +
      `<span${state.safety < 50 ? ' class="warn"' : ''}>🛡️ ${Math.round(state.safety)}%</span>` +
      (q > 1 ? '<span class="warn">⏳ תור ארוך</span>' : '') +
      (bad ? `<span class="warn">🔧 ${bad} מקולקלים</span>` : '');
  }
  function renderTabs() {
    const ready = L.goalsReady(state);
    $('tabs').innerHTML = TABS.map(([id, label]) =>
      `<button class="tab${id === tab ? ' on' : ''}" role="tab" aria-selected="${id === tab}" data-a="tab" data-id="${id}">${label}${id === 'goals' && ready ? `<b class="badge">${ready}</b>` : ''}</button>`).join('');
  }
  function renderSel() {
    const box = $('sel');
    const item = sel && L.ITEM_BY_ID[state.grid[sel]];
    box.hidden = !item;
    if (!item) return;
    const lv = L.levelOf(state, sel), up = L.canUpgrade(state, sel), broken = L.isBroken(state, sel);
    box.innerHTML = `<div><strong>${item.icon} ${item.name}${item.stall ? '' : ` · רמה ${lv}/${L.MAX_LEVEL}`}</strong>` +
      `<small>${item.stall ? 'המבקרים קונים כאן, וההכנסה גדלה' : broken ? 'מקולקל: לא מושך מבקרים עד שמתקנים' : 'שדרוג מושך יותר מבקרים ומקצר את התור'}</small></div>` +
      (broken ? `<button class="act pulse" data-a="fix">🔧 תיקון (${L.repairCost(state, sel)} 🪙)</button>` : '') +
      (!item.stall && stage && !broken ? '<button class="act" data-a="ride">🎥 לעלות</button>' : '') +
      (up.ok ? `<button class="act" data-a="up">⬆️ שדרוג (${up.cost} 🪙)</button>` : '') +
      `<button class="act ghost" data-a="remove">הסרה (+${Math.floor(item.price / 2)} 🪙)</button>`;
  }
  function meter(label, value, cls, pct, note) {
    return `<div class="meter"><div class="meter-head"><span>${label}</span><strong>${value}</strong></div>` +
      `<div class="meter-bar"><div class="meter-fill ${cls}" style="width:${Math.max(0, Math.min(100, Math.round(pct)))}%"></div></div>` +
      `<div class="meter-note">${note}</div></div>`;
  }
  function cards(list) {
    return '<div class="cards">' + list.map((r) =>
      `<button class="card${r.id === chosen ? ' selected' : ''}${balance() < r.price ? ' cant' : ''}" aria-pressed="${r.id === chosen}" data-a="choose" data-id="${r.id}">` +
      `<span class="icon">${r.icon}</span><span>${r.name}</span><small>${r.stall ? 'מגדיל הכנסה' : `ריגוש ${r.thrill} · ${r.cap} בדקה`}</small><span class="price">${r.price} 🪙</span></button>`).join('') + '</div>';
  }

  const PANELS = {
    build() {
      const free = L.freeCells(state);
      return `<p class="note">${free ? (stage ? 'בחרו מתקן ואז לחצו על עיגול ירוק בפארק.' : 'לחיצה על מתקן בונה אותו במקום הפנוי הבא.') + ' מתקנים שונים זה ליד זה נותנים בונוס.' : 'אין מקום פנוי. הרחיבו את השטח בלשונית הניהול.'}</p>` +
        cards(L.RIDES) + '<h2>🍿 דוכנים</h2>' + cards(L.STALLS);
    },
    manage() {
      const i = L.inspect(state), x = L.canExpand(state), q = L.queueRatio(state), wait = L.showWait(state, Date.now());
      return '<div class="meters">' +
        meter('🛡️ בטיחות', `${Math.round(state.safety)}%`, 'safe', state.safety, 'בטיחות נמוכה מרחיקה מבקרים וגורמת לתקלות') +
        meter('⏳ תור', q > 1 ? 'ארוך מדי' : 'בסדר', 'queue', q * 100, 'תור ארוך? בנו או שדרגו מתקנים') +
        '</div><div class="row">' +
        `<button class="act" data-a="inspect" ${i.ok ? '' : 'disabled'}>🛠️ בדיקת בטיחות${i.ok ? ` (${i.cost} 🪙)` : ''}</button>` +
        `<button class="act" data-a="expand" ${x.ok ? '' : 'disabled'}>${x.ok ? `➕ הרחבת השטח (${x.cost} 🪙)` : '➕ השטח במקסימום'}</button>` +
        `<button class="act${wait ? '' : ' pulse'}" data-a="show" ${wait ? 'disabled' : ''}>🎆 מופע זיקוקים${wait ? ` (בעוד ${Math.ceil(wait / 60000)} דק')` : ''}</button>` +
        '</div><h2>🎟️ איך משלמים?</h2><div class="row">' +
        `<button class="chip${state.mode === 'entry' ? ' on' : ''}" data-a="mode" data-id="entry">כרטיס כניסה</button>` +
        `<button class="chip${state.mode === 'perRide' ? ' on' : ''}" data-a="mode" data-id="perRide">מטבע לכל מתקן</button>` +
        (state.mode === 'entry' ? L.PRICES.map((p) => `<button class="chip${state.price === p ? ' on' : ''}" aria-pressed="${state.price === p}" data-a="price" data-id="${p}">${p} 🪙</button>`).join('') : '') +
        `</div><p class="note">ההכנסה (עד ${L.rateMax(state).toFixed(1)} 🪙 לדקה) נכנסת לעיר לבד. כל סוג דוכן מעלה אותה.</p>`;
    },
    goals() {
      return '<div class="list">' + L.GOALS.map((g) => {
        const st = L.goalState(state, g);
        return `<div class="item ${st}"><span class="icon">${g.icon}</span><div><strong>${g.text}</strong><small>פרס: ${g.reward} 🪙</small></div>` +
          (st === 'ready' ? `<button class="act pulse" data-a="claim" data-id="${g.id}">🎁 קבלו פרס</button>` : st === 'done' ? '<span class="done">✅</span>' : '<span class="done">⏳</span>') + '</div>';
      }).join('') + '</div>';
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
    choose(id) {
      if (!stage) {
        const f = L.firstFree(state);
        if (!f) return say('אין מקום פנוי. הרחיבו את השטח');
        return placeAt(id, f.x, f.y);
      }
      chosen = chosen === id ? null : id;
      sel = null;
      if (chosen) say(`נבחר: ${L.ITEM_BY_ID[id].name}. לחצו על עיגול ירוק בפארק`);
    },
    ride() { rideOn(sel); },
    up() {
      const c = L.canUpgrade(state, sel);
      if (!c.ok) return say(c.msg);
      if (!pay(c.cost)) return;
      L.upgrade(state, sel);
      persist();
      say(`⬆️ המתקן שודרג לרמה ${c.level}! −${c.cost} 🪙`);
    },
    fix() {
      const c = L.repair(state, sel);
      if (!c.ok) return say(c.msg);
      if (!pay(c.cost)) return;
      L.fixed(state, sel);
      persist();
      say(`🔧 המתקן תוקן וחזר לעבוד! −${c.cost} 🪙`);
    },
    remove() {
      const item = L.ITEM_BY_ID[state.grid[sel]];
      if (!item || !confirm(`להסיר את ${item.name}? יוחזר חצי מהמחיר.`)) return;
      const [x, y] = sel.split(',').map(Number);
      const r = L.remove(state, x, y);
      if (!r.ok) return say(r.msg);
      earn(r.refund, `הסרתם ${item.name}`);
      sel = null;
      persist();
      say(`הסרתם ${item.name}. הוחזרו ${r.refund} 🪙`);
    },
    inspect() {
      const i = L.inspect(state);
      if (!i.ok) return say(i.msg);
      if (!pay(i.cost)) return;
      state.safety = 100;
      persist();
      say(`🛠️ כל המתקנים נבדקו ובטוחים! −${i.cost} 🪙`);
    },
    expand() {
      const x = L.canExpand(state);
      if (!x.ok) return say(x.msg);
      if (!pay(x.cost)) return;
      L.expand(state);
      persist();
      say(`הפארק גדל! −${x.cost} 🪙`);
    },
    show() {
      const r = L.runShow(state, Date.now());
      if (!r.ok) return say(r.msg);
      earn(r.tips, 'מופע זיקוקים');
      persist();
      fireworks();
      say(`🎆 איזה מופע! המבקרים השאירו ${r.tips} 🪙`);
    },
    mode(id) { L.setMode(state, id); persist(); },
    price(id) { L.setPrice(state, +id); persist(); },
    claim(id) {
      const r = L.claimGoal(state, id);
      if (!r.ok) return say(r.msg);
      earn(r.reward, 'משימה בלונה פארק');
      persist();
      say(`🎉 כל הכבוד! קיבלתם ${r.reward} 🪙`);
    },
  };
  document.querySelector('.container').addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b || b.disabled) return;
    ACTS[b.dataset.a](b.dataset.id);
    renderAll();
  });

  if (W) W.onChange(() => { $('balance').textContent = balance(); if (tab === 'build') renderAll(); });
  $('balance').textContent = balance();

  // עם הזמן הבטיחות יורדת, ולפעמים מתקן מתקלקל. שומרים במכשיר בלבד כדי לא להעמיס על הענן
  setInterval(() => {
    L.decay(state, 5000);
    const k = L.tickBreak(state, Date.now());
    if (k) { say(`🔧 אוי! ${L.ITEM_BY_ID[state.grid[k]].name} התקלקל. לחצו עליו כדי לתקן`); persist(); }
    else persist(false);
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
