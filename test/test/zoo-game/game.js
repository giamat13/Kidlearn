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

  function bar(cls, v) { return `<div class="bar ${cls}"><i style="width:${Math.round(v)}%"></i></div>`; }

  function renderStats() {
    const vis = L.visitorsPerMin(state);
    $('stats').innerHTML = `
      <div class="stat">💰 הכנסה<b>${state.rate.toFixed(1)} 🪙 לדקה</b><small>עד ${L.RATE_MAX} לדקה. נכנס לעיר לבד</small></div>
      <div class="stat">🚶 מבקרים<b>${vis.toFixed(1)} בדקה</b><small>כרטיס: ${state.price} 🪙</small></div>
      <div class="stat">🥕 אוכל ${Math.round(state.fed)}%${bar('fed', state.fed)}</div>
      <div class="stat">🧹 ניקיון ${Math.round(state.clean)}%${bar('clean', state.clean)}</div>
      <div class="stat">😊 שמחת המבקרים ${L.happiness(state)}%${bar('happy', L.happiness(state))}</div>
      <div class="stat">🐾 חיות<b>${L.animalCount(state)} מתוך ${L.capacity(state)}</b><small>${L.speciesCount(state)} סוגים. מגוון מביא יותר מבקרים</small></div>`;
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

  function renderZoo() {
    const box = $('zoo');
    box.innerHTML = '';
    const have = L.ANIMALS.filter((a) => state.animals[a.id] > 0);
    if (!have.length) {
      box.innerHTML = '<span class="empty">הגן עוד ריק. קנו חיה ראשונה למטה 👇</span>';
      return;
    }
    have.forEach((a) => {
      const pen = document.createElement('div');
      pen.className = 'pen';
      pen.innerHTML = `<span>${a.icon}</span><small>${a.name} × ${state.animals[a.id]}</small>`;
      const sell = document.createElement('button');
      sell.textContent = `מכירה (+${Math.floor(a.price / 2)})`;
      sell.onclick = () => {
        const r = L.sell(state, a.id);
        if (!r.ok) return say(r.msg);
        if (W) W.earn(r.refund, { reason: `מכרתם ${a.name}`, silent: true });
        persist();
        say(`מכרתם ${a.name}. הוחזרו ${r.refund} 🪙`);
        renderAll();
      };
      pen.appendChild(sell);
      box.appendChild(pen);
    });
  }

  function renderShop() {
    const box = $('shop');
    box.innerHTML = '';
    const free = L.freeSlots(state);
    L.ANIMALS.forEach((a) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.disabled = free <= 0 || balance() < a.price;
      b.innerHTML = `<span class="icon">${a.icon}</span><span>${a.name}</span><span class="price">${a.price} 🪙</span>`;
      b.onclick = () => {
        const c = L.canBuy(state, a.id);
        if (!c.ok) return say(c.msg);
        if (!pay(c.cost)) return;
        L.buy(state, a.id);
        persist();
        say(`קניתם ${a.name}! −${c.cost} 🪙`);
        renderAll();
      };
      box.appendChild(b);
    });
    $('note').textContent = free <= 0 ? 'אין מקום בגדרות. הרחיבו את הגן כדי לקנות עוד חיות.' : `נשארו ${free} מקומות פנויים.`;
  }

  function renderAll() {
    refresh();
    renderStats();
    renderControls();
    renderZoo();
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
