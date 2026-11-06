// לונה פארק: המסך. החוקים נמצאים ב-logic.js (AmusementLogic).
// אטרקציה בעיר: הנתונים נשמרים לפי החלקה (?cell=c,r) במכשיר ובחשבון. עובד גם בדפדפן רגיל בלי כניסה.
// ההכנסה לדקה נשמרת בנתונים, והעיר מוסיפה אותה למסים שלה (משולם לבד, גם כשהילד לא בעיר, עד 3 שעות).
(function () {
  const L = window.AmusementLogic;
  const W = window.KidLearnWallet;
  const store = KidLearnAttraction.create('kidlearn-amusement');
  const $ = (id) => document.getElementById(id);

  let state = L.normalize(store.load());
  L.decay(state, Date.now() - state.at);
  state.at = Date.now();
  let selected = L.RIDES[0].id;

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
  function meter(label, value, cls, pct, note) {
    const w = Math.max(0, Math.min(100, Math.round(pct)));
    return `<div class="meter"><div class="meter-head"><span>${label}</span><strong>${value}</strong></div>` +
      (cls ? `<div class="meter-bar"><div class="meter-fill ${cls}" style="width:${w}%"></div></div>` : '') +
      `<div class="meter-note">${note || ''}</div></div>`;
  }

  function renderStats() {
    const q = L.queueRatio(state);
    const queueNote = !L.rideCount(state) ? 'עוד אין מתקנים' : q > 1 ? 'תור ארוך, חלק עוזבים. קנו עוד מתקנים' : q > 0.7 ? 'קצת תור' : 'אין תור';
    $('stats').innerHTML =
      meter('💰 הכנסה', `${state.rate.toFixed(1)} 🪙 לדקה`, '', 0, `עד ${L.RATE_MAX} לדקה. נכנס לעיר לבד`) +
      meter('🚶 מבקרים', `${L.servedPerMin(state).toFixed(1)} בדקה`, '', 0, queueNote) +
      meter('🛡️ בטיחות', `${Math.round(state.safety)}%`, 'safe', state.safety, 'בטיחות נמוכה מרחיקה מבקרים') +
      meter('⏳ עומס תורים', `${Math.round(Math.min(2, q) * 50)}%`, 'queue', Math.min(2, q) * 50, 'כמה המתקנים עמוסים') +
      meter('🎢 מתקנים', L.rideCount(state), '', 0, `${L.kinds(state)} סוגים, ${L.funPairs(state)} במסלול כיף`) +
      meter('🗺️ שטח', `${state.cols}×${state.rows}`, '', 0, `${L.freeCells(state)} משבצות פנויות`);
  }

  function renderControls() {
    $('modes').innerHTML = '';
    [['entry', '🎟️ כרטיס כניסה'], ['perRide', '🎠 תשלום על כל מתקן (1 🪙)']].forEach(([m, label]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (state.mode === m ? ' on' : '');
      b.setAttribute('aria-pressed', String(state.mode === m));
      b.textContent = label;
      b.onclick = () => { L.setMode(state, m); persist(); say(m === 'entry' ? 'כל מבקר משלם פעם אחת בכניסה' : 'כל מבקר משלם מטבע על כל מתקן שהוא עולה עליו'); renderAll(); };
      $('modes').appendChild(b);
    });
    $('prices').innerHTML = '';
    if (state.mode === 'entry') {
      L.PRICES.forEach((p) => {
        const b = document.createElement('button');
        b.className = 'chip' + (state.price === p ? ' on' : '');
        b.setAttribute('aria-pressed', String(state.price === p));
        b.textContent = `כרטיס ${p} 🪙`;
        b.onclick = () => { L.setPrice(state, p); persist(); say(p === 1 ? 'כרטיס זול: הרבה מבקרים' : p === 2 ? 'כרטיס בינוני' : 'כרטיס יקר: פחות מבקרים'); renderAll(); };
        $('prices').appendChild(b);
      });
    }
    const i = L.inspect(state), x = L.canExpand(state);
    $('inspectBtn').textContent = i.ok ? `🛠️ בדיקת בטיחות (${i.cost} 🪙)` : '🛠️ בדיקת בטיחות';
    $('expandBtn').textContent = x.ok ? `➕ הרחבת השטח (${x.cost} 🪙, שורה חדשה)` : '➕ השטח במקסימום';
    $('inspectBtn').disabled = !i.ok;
    $('expandBtn').disabled = !x.ok;
  }

  // ---------- תלת-ממד ----------
  const S = KidLearn3D.create({
    container: $('scene'),
    sky: '#d6ecff',
    bounds: () => ({ minC: 0, maxC: state.cols - 1, minR: 0, maxR: state.rows - 1 }),
    hoverColor: (x, y) => {
      if (x < 0 || y < 0 || x >= state.cols || y >= state.rows) return null;
      return state.grid[L.cellKey(x, y)] ? '#ff9800' : '#ffeb3b';
    },
    onTap: (x, y) => onCell(x, y),
  });
  const anims = [];   // פונקציות (t) שמזיזות חלקים של מתקנים

  function buildRide(id, seed) {
    const g = new S.THREE.Group();
    const { part, box, cyl, cone, ico, tor } = S;
    const T = S.THREE;
    if (id === 'swing') {
      const frame = '#e53935';
      [-0.34, 0.34].forEach((x) => {
        part(g, box(0.04, 0.62, 0.04), frame, x, 0.31, -0.12).rotation.z = x < 0 ? -0.18 : 0.18;
        part(g, box(0.04, 0.62, 0.04), frame, x, 0.31, 0.12).rotation.z = x < 0 ? -0.18 : 0.18;
      });
      part(g, box(0.74, 0.04, 0.04), '#b71c1c', 0, 0.6, 0);
      [-0.14, 0.14].forEach((x, i) => {
        const sw = new T.Group();
        sw.position.set(x, 0.6, 0);
        part(sw, box(0.01, 0.34, 0.01), '#cfd8dc', -0.05, -0.17, 0);
        part(sw, box(0.01, 0.34, 0.01), '#cfd8dc', 0.05, -0.17, 0);
        part(sw, box(0.14, 0.03, 0.08), i ? '#42a5f5' : '#ffca28', 0, -0.35, 0);
        g.add(sw);
        anims.push((t) => { sw.rotation.x = Math.sin(t * 2.2 + i * 1.6) * 0.5; });
      });
    } else if (id === 'carousel') {
      part(g, cyl(0.4, 0.42, 0.06, 20), '#ffd54f', 0, 0.03, 0);
      const spin = new T.Group();
      g.add(spin);
      part(spin, cyl(0.04, 0.04, 0.5, 8), '#fafafa', 0, 0.3, 0);
      for (let k = 0; k < 5; k++) {
        const a = k * Math.PI * 2 / 5;
        const h = new T.Group();
        h.position.set(Math.cos(a) * 0.26, 0, Math.sin(a) * 0.26);
        part(h, cyl(0.012, 0.012, 0.4, 5), '#ffd54f', 0, 0.26, 0);
        part(h, box(0.14, 0.09, 0.07), ['#ec407a', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc'][k], 0, 0.22, 0);
        part(h, ico(0.04), ['#ec407a', '#42a5f5', '#66bb6a', '#ffa726', '#ab47bc'][k], 0.07, 0.29, 0);
        h.rotation.y = -a;
        spin.add(h);
        anims.push((t) => { h.position.y = Math.sin(t * 3 + k) * 0.03; });
      }
      part(g, cone(0.46, 0.22, 20), '#e53935', 0, 0.62, 0);
      part(g, cone(0.12, 0.1, 8), '#fafafa', 0, 0.78, 0);
      anims.push((t) => { spin.rotation.y = t * 0.8; });
    } else if (id === 'bumper') {
      part(g, box(0.86, 0.04, 0.86), '#546e7a', 0, 0.02, 0);
      part(g, box(0.86, 0.07, 0.03), '#e53935', 0, 0.075, -0.43);
      part(g, box(0.86, 0.07, 0.03), '#e53935', 0, 0.075, 0.43);
      part(g, box(0.03, 0.07, 0.86), '#e53935', -0.43, 0.075, 0);
      part(g, box(0.03, 0.07, 0.86), '#e53935', 0.43, 0.075, 0);
      [['#ffca28', -0.2, -0.15], ['#42a5f5', 0.18, 0.1], ['#66bb6a', -0.12, 0.24]].forEach(([c, x, z], i) => {
        const car = new T.Group();
        car.position.set(x, 0.04, z);
        part(car, box(0.22, 0.08, 0.14), c, 0, 0.06, 0);
        part(car, box(0.1, 0.06, 0.1), tintOf(c), -0.02, 0.12, 0);
        part(car, cyl(0.005, 0.005, 0.16, 4), '#37474f', 0.06, 0.2, 0);
        g.add(car);
        anims.push((t) => {
          car.position.x = x + Math.sin(t * 1.3 + i * 2) * 0.12;
          car.position.z = z + Math.cos(t * 1.1 + i * 3) * 0.1;
          car.rotation.y = Math.sin(t * 1.3 + i * 2) * 0.5;
        });
      });
    } else if (id === 'ferris') {
      const wheel = new T.Group();
      wheel.position.set(0, 0.55, 0);
      const ring = new T.Mesh(tor(0.42, 0.025), S.mat('#e53935'));
      ring.castShadow = true;
      wheel.add(ring);
      for (let k = 0; k < 4; k++) {
        const spoke = new T.Mesh(box(0.84, 0.015, 0.015), S.mat('#fafafa'));
        spoke.rotation.z = k * Math.PI / 4;
        wheel.add(spoke);
      }
      const pods = [];
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        const pod = new T.Mesh(box(0.09, 0.09, 0.09), S.mat(['#ffca28', '#42a5f5', '#66bb6a', '#ec407a'][k % 4]));
        pod.castShadow = true;
        pod.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0);
        wheel.add(pod);
        pods.push(pod);
      }
      g.add(wheel);
      [-0.1, 0.1].forEach((z) => {
        part(g, box(0.035, 0.6, 0.035), '#78909c', -0.12, 0.28, z).rotation.z = -0.22;
        part(g, box(0.035, 0.6, 0.035), '#78909c', 0.12, 0.28, z).rotation.z = 0.22;
      });
      anims.push((t) => { wheel.rotation.z = t * 0.35; pods.forEach((p) => { p.rotation.z = -wheel.rotation.z; }); });
    } else if (id === 'water') {
      part(g, box(0.86, 0.03, 0.86), '#4fc3f7', 0, 0.02, 0.0);
      part(g, box(0.2, 0.7, 0.2), '#fafafa', -0.26, 0.35, -0.2);
      part(g, box(0.26, 0.04, 0.26), '#e53935', -0.26, 0.72, -0.2);
      const slide = part(g, box(0.18, 0.03, 0.78), '#29b6f6', 0.0, 0.38, -0.02);
      slide.rotation.set(0.0, 0, 0);
      slide.position.set(-0.04, 0.38, 0.05);
      slide.rotation.x = 0.62; slide.rotation.y = -0.42;
      part(g, box(0.5, 0.05, 0.3), '#0288d1', 0.2, 0.05, 0.28);
      const splash = part(g, ico(0.05), '#e1f5fe', 0.28, 0.1, 0.3);
      anims.push((t) => { splash.position.y = 0.1 + Math.abs(Math.sin(t * 3)) * 0.12; });
    } else {
      // coaster: מסלול גלי וקרון שנוסע עליו
      part(g, box(0.9, 0.02, 0.9), '#cfd8dc', 0, 0.01, 0);
      const pts = [];
      const N = 24;
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        pts.push(new T.Vector3(-0.4 + 0.8 * u, 0.22 + 0.34 * Math.pow(Math.sin(u * Math.PI * 2.5), 2), Math.sin(u * Math.PI * 2) * 0.22));
      }
      for (let i = 0; i < N; i++) {
        const a = pts[i], b = pts[i + 1];
        const m = new T.Mesh(box(1, 0.04, 0.07), S.mat('#e53935'));
        m.castShadow = true;
        m.position.copy(a).add(b).multiplyScalar(0.5);
        const len = a.distanceTo(b);
        m.scale.x = len * 1.05;
        m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
        m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
        g.add(m);
        if (i % 3 === 0) part(g, box(0.025, a.y, 0.025), '#78909c', a.x, a.y / 2, a.z);
      }
      const cart = new T.Group();
      part(cart, box(0.14, 0.07, 0.08), '#ffca28', 0, 0.06, 0);
      part(cart, box(0.06, 0.05, 0.06), '#42a5f5', 0.03, 0.11, 0);
      g.add(cart);
      anims.push((t) => {
        const u = (t * 0.12) % 1, f = u * N, i = Math.min(N - 1, Math.floor(f)), w = f - i;
        cart.position.lerpVectors(pts[i], pts[i + 1], w);
        cart.rotation.z = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      });
    }
    return g;
  }
  function tintOf(hex) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (sh) => Math.min(255, Math.round(((n >> sh) & 255) * 0.8));
    return '#' + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('');
  }

  function buildTile(x, y, hasRide, fun) {
    const g = new S.THREE.Group();
    g.position.set(x, 0, y);
    S.part(g, S.box(0.98, 0.04, 0.98), (x + y) % 2 ? '#b39ddb' : '#a58ad2', 0, 0.0, 0);
    if (fun) {
      // מסלול כיף: פינות צהובות על המשבצת
      [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]].forEach(([dx, dz]) => S.part(g, S.cyl(0.04, 0.04, 0.02, 8), '#ffd54f', dx, 0.03, dz));
    }
    if (hasRide) g.add(buildRide(hasRide));
    return g;
  }

  function buildFence() {
    const g = new S.THREE.Group();
    const x0 = -0.5, x1 = state.cols - 0.5, z0 = -0.5, z1 = state.rows - 0.5;
    const wood = '#8e24aa';
    S.part(g, S.box(x1 - x0, 0.1, 0.03), wood, (x0 + x1) / 2, 0.08, z0);
    S.part(g, S.box(0.03, 0.1, z1 - z0), wood, x0, 0.08, (z0 + z1) / 2);
    S.part(g, S.box(0.03, 0.1, z1 - z0), wood, x1, 0.08, (z0 + z1) / 2);
    const cx = (x0 + x1) / 2;
    S.part(g, S.box((x1 - x0) / 2 - 0.35, 0.1, 0.03), wood, x0 + ((x1 - x0) / 2 - 0.35) / 2, 0.08, z1);
    S.part(g, S.box((x1 - x0) / 2 - 0.35, 0.1, 0.03), wood, x1 - ((x1 - x0) / 2 - 0.35) / 2, 0.08, z1);
    S.part(g, S.box(0.05, 0.42, 0.05), '#6a1b9a', cx - 0.35, 0.21, z1);
    S.part(g, S.box(0.05, 0.42, 0.05), '#6a1b9a', cx + 0.35, 0.21, z1);
    S.part(g, S.box(0.8, 0.1, 0.05), '#ffca28', cx, 0.45, z1);
    // כביש כניסה
    S.part(g, S.box(0.7, 0.03, 1.4), '#90a4ae', cx, 0.0, z1 + 0.7);
    return g;
  }

  function drawPark() {
    if (!S.ok) return;
    anims.length = 0;
    const cells = new Map();
    const fun = new Set();
    for (const [k, id] of Object.entries(state.grid)) {
      const [x, y] = k.split(',').map(Number);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const o = state.grid[L.cellKey(x + dx, y + dy)]; return o && o !== id; })) fun.add(k);
    }
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const k = L.cellKey(x, y);
        cells.set(k, buildTile(x, y, state.grid[k], fun.has(k)));
      }
    }
    cells.set('fence', buildFence());
    S.setCells(cells);
  }
  if (S.ok) {
    S.onFrame((dt, t) => { if (!S.reduceMotion) anims.forEach((fn) => fn(t)); });
    $('centerBtn').onclick = () => S.fit();
    S.fit();
  } else {
    $('centerBtn').hidden = true;
  }

  function onCell(x, y) {
    if (state.grid[L.cellKey(x, y)]) {
      const cur = L.RIDE_BY_ID[state.grid[L.cellKey(x, y)]];
      if (!confirm(`למחוק את ${cur.name}? יוחזר חצי מהמחיר.`)) return;
      const r = L.remove(state, x, y);
      if (W) W.earn(r.refund, { reason: 'החזר מתקן', silent: true });
      persist();
      say(`הסרתם ${L.RIDE_BY_ID[r.id].name}. הוחזרו ${r.refund} 🪙`);
      return renderAll();
    }
    const c = L.canPlace(state, selected, x, y);
    if (!c.ok) return say(c.msg);
    if (!pay(c.cost)) return;
    L.place(state, selected, x, y);
    persist();
    say(`בניתם ${L.RIDE_BY_ID[selected].name}! −${c.cost} 🪙`);
    renderAll();
  }

  function renderShop() {
    const box = $('shop');
    box.innerHTML = '';
    L.RIDES.forEach((r) => {
      const b = document.createElement('button');
      b.className = 'card' + (r.id === selected ? ' selected' : '');
      b.setAttribute('aria-pressed', String(r.id === selected));
      b.innerHTML = `<span class="icon">${r.icon}</span><span>${r.name}</span><small>⭐ ריגוש ${r.thrill} · ${r.cap} מבקרים בדקה</small><span class="price">${r.price} 🪙</span>`;
      b.onclick = () => { selected = r.id; renderAll(); $('hint').textContent = `נבחר: ${r.name}. לחצו על משבצת ריקה בשטח כדי לבנות.`; };
      box.appendChild(b);
    });
  }

  function renderAll() {
    refresh();
    renderStats();
    renderControls();
    drawPark();
    renderShop();
  }

  $('inspectBtn').onclick = () => {
    const i = L.inspect(state);
    if (!i.ok) return say(i.msg);
    if (!pay(i.cost)) return;
    state.safety = 100;
    persist();
    say(`בדקתם את המתקנים, הכול בטוח! −${i.cost} 🪙`);
    renderAll();
  };
  $('expandBtn').onclick = () => {
    const x = L.canExpand(state);
    if (!x.ok) return say(x.msg);
    if (!pay(x.cost)) return;
    L.expand(state);
    persist();
    say(`נוספה שורה לשטח! −${x.cost} 🪙`);
    renderAll();
    if (S.ok) S.fit();
  };

  if (W) W.onChange(() => { $('balance').textContent = balance(); });
  else $('balance').textContent = 0;

  setInterval(() => {
    L.decay(state, 5000);
    persist(false);
    renderStats();
    renderControls();
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
