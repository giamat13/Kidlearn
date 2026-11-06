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
  const bar = (cls, v) => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, Math.round(v)))}%"></i></div>`;

  function renderStats() {
    const q = L.queueRatio(state);
    const queueNote = !L.rideCount(state) ? '' : q > 1 ? 'תור ארוך, חלק עוזבים. קנו עוד מתקנים' : q > 0.7 ? 'קצת תור' : 'אין תור';
    $('stats').innerHTML = `
      <div class="stat">💰 הכנסה<b>${state.rate.toFixed(1)} 🪙 לדקה</b><small>עד ${L.RATE_MAX} לדקה. נכנס לעיר לבד</small></div>
      <div class="stat">🚶 מבקרים<b>${L.servedPerMin(state).toFixed(1)} בדקה</b><small>${queueNote}</small></div>
      <div class="stat">🛡️ בטיחות ${Math.round(state.safety)}%${bar('safe', state.safety)}</div>
      <div class="stat">⏳ עומס תורים ${Math.round(Math.min(2, q) * 50)}%${bar('queue', Math.min(2, q) * 50)}</div>
      <div class="stat">🎢 מתקנים<b>${L.rideCount(state)}</b><small>${L.kinds(state)} סוגים, ${L.funPairs(state)} במסלול כיף</small></div>
      <div class="stat">🗺️ שטח<b>${state.cols}×${state.rows}</b><small>${L.freeCells(state)} משבצות פנויות</small></div>`;
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

  function renderPark() {
    const box = $('park');
    box.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
    box.innerHTML = '';
    const funKeys = new Set();
    for (const [k, id] of Object.entries(state.grid)) {
      const [x, y] = k.split(',').map(Number);
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const o = state.grid[L.cellKey(x + dx, y + dy)]; return o && o !== id; })) funKeys.add(k);
    }
    for (let y = 0; y < state.rows; y++) {
      for (let x = 0; x < state.cols; x++) {
        const k = L.cellKey(x, y);
        const id = state.grid[k];
        const b = document.createElement('button');
        b.className = 'cell' + (id ? ' has' : '') + (funKeys.has(k) ? ' fun' : '');
        b.setAttribute('role', 'gridcell');
        b.textContent = id ? L.RIDE_BY_ID[id].icon : '';
        b.setAttribute('aria-label', id ? `${L.RIDE_BY_ID[id].name}, לחצו להסרה` : 'משבצת ריקה, לחצו כדי לבנות');
        b.onclick = () => onCell(x, y);
        box.appendChild(b);
      }
    }
  }

  function onCell(x, y) {
    if (state.grid[L.cellKey(x, y)]) {
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
      b.innerHTML = `<span class="icon">${r.icon}</span><span>${r.name}</span><small>⭐ ריגוש ${r.thrill} · תור: ${r.cap} בדקה</small><span class="price">${r.price} 🪙</span>`;
      b.onclick = () => { selected = r.id; renderAll(); $('hint').textContent = `נבחר: ${r.name}. לחצו על משבצת ריקה בשטח כדי לבנות.`; };
      box.appendChild(b);
    });
  }

  function renderAll() {
    refresh();
    renderStats();
    renderControls();
    renderPark();
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
