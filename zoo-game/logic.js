// גן חיות: החוקים והחישובים (בלי מסך, כדי שאפשר יהיה לבדוק אותם).
// ההכנסה לדקה (rate) נשמרת יחד עם הנתונים של החלקה. העיר מוסיפה אותה למסים שלה ומשלמת אוטומטית.
(function (root) {
  const ANIMALS = [
    { id: 'rabbit',  icon: '🐰', name: 'ארנב',      price: 20 },
    { id: 'sheep',   icon: '🐑', name: 'כבשה',      price: 30 },
    { id: 'penguin', icon: '🐧', name: 'פינגווין',  price: 70 },
    { id: 'monkey',  icon: '🐒', name: 'קוף',       price: 50 },
    { id: 'giraffe', icon: '🦒', name: "ג'ירפה",    price: 80 },
    { id: 'elephant', icon: '🐘', name: 'פיל',      price: 100 },
    { id: 'lion',    icon: '🦁', name: 'אריה',      price: 120 },
    { id: 'panda',   icon: '🐼', name: 'פנדה',      price: 160 },
  ];
  const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));
  const BASE_SLOTS = 4;          // מקומות לחיות בהתחלה
  const SLOT_STEP = 4;           // כל הרחבה מוסיפה כמה מקומות
  const MAX_EXPANSIONS = 10;
  const RATE_MAX = 3;            // מטבעות בדקה לגן חיות אחד, לכל היותר
  const PRICES = [1, 2, 3];      // מחירי כניסה אפשריים
  const ELASTIC = { 1: 1, 2: 0.75, 3: 0.5 };   // ככל שהכרטיס יקר יותר, פחות מבקרים
  const FED_LOSS_PER_MIN = 2;
  const CLEAN_LOSS_PER_MIN = 1.5;
  const CARE_FLOOR = 20;         // בהזנחה מלאה הרמה לא יורדת מתחת לזה
  const AWAY_CAP_MS = 3 * 60 * 60 * 1000;

  const clampN = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function newState(now) {
    return { animals: {}, expansions: 0, fed: 100, clean: 100, price: 1, at: now || Date.now(), rate: 0, summary: '' };
  }

  // מנקה נתונים שנשמרו (או הגיעו מהענן) לצורה בטוחה
  function normalize(d, now) {
    const s = newState(now);
    if (!d || typeof d !== 'object') return s;
    if (d.animals && typeof d.animals === 'object') {
      for (const a of ANIMALS) {
        const n = Math.floor(+d.animals[a.id] || 0);
        if (n > 0) s.animals[a.id] = Math.min(n, 99);
      }
    }
    s.expansions = clampN(Math.floor(+d.expansions || 0), 0, MAX_EXPANSIONS);
    s.fed = clampN(+d.fed || 0, 0, 100);
    s.clean = clampN(+d.clean || 0, 0, 100);
    if (d.fed === undefined) s.fed = 100;
    if (d.clean === undefined) s.clean = 100;
    s.price = PRICES.includes(+d.price) ? +d.price : 1;
    s.at = +d.at || s.at;
    // אם נשמרו יותר חיות ממקומות (נתונים פגומים), מורידים את העודף
    let over = animalCount(s) - capacity(s);
    for (const a of ANIMALS.slice().reverse()) {
      while (over > 0 && s.animals[a.id] > 0) { s.animals[a.id]--; over--; }
      if (!s.animals[a.id]) delete s.animals[a.id];
    }
    s.rate = rateOf(s);
    s.summary = summaryOf(s);
    return s;
  }

  const capacity = (s) => BASE_SLOTS + SLOT_STEP * s.expansions;
  const animalCount = (s) => Object.values(s.animals).reduce((a, b) => a + b, 0);
  const speciesCount = (s) => Object.values(s.animals).filter((n) => n > 0).length;
  const freeSlots = (s) => capacity(s) - animalCount(s);
  const expandCost = (s) => 40 * (s.expansions + 1);
  const happiness = (s) => Math.round((s.fed + s.clean) / 2);
  const careCost = (s) => 2 + Math.floor(animalCount(s) / 4);
  // עניין: כל חיה מוסיפה, ומגוון מוסיף הרבה יותר
  const interest = (s) => animalCount(s) * 0.5 + speciesCount(s) * 1.5;

  function visitorsPerMin(s) {
    if (animalCount(s) === 0) return 0;
    return 0.15 * interest(s) * (happiness(s) / 100) * (ELASTIC[s.price] || 1);
  }
  function rateOf(s) {
    return Math.round(Math.min(RATE_MAX, visitorsPerMin(s) * s.price) * 100) / 100;
  }
  function summaryOf(s) {
    const n = animalCount(s);
    if (!n) return 'עוד אין חיות';
    return `${n} חיות, ${speciesCount(s)} סוגים, ${visitorsPerMin(s).toFixed(1)} מבקרים בדקה`;
  }

  // הזנחה: האוכל והניקיון יורדים עם הזמן (גם כשהילד לא במשחק, עד 3 שעות), אבל לא מתחת ל-CARE_FLOOR
  function decay(s, ms) {
    const min = clampN(ms, 0, AWAY_CAP_MS) / 60000;
    s.fed = Math.max(CARE_FLOOR, s.fed - FED_LOSS_PER_MIN * min);
    s.clean = Math.max(CARE_FLOOR, s.clean - CLEAN_LOSS_PER_MIN * min);
    return s;
  }

  // פעולות: מחזירות { ok, cost, msg }. התשלום עצמו נעשה במסך (בארנק), כאן רק הכללים
  function canBuy(s, id) {
    const a = ANIMAL_BY_ID[id];
    if (!a) return { ok: false, msg: 'חיה לא מוכרת' };
    if (freeSlots(s) <= 0) return { ok: false, msg: 'אין מקום בגדרות. הרחיבו את הגן' };
    return { ok: true, cost: a.price };
  }
  function buy(s, id) {
    const c = canBuy(s, id);
    if (!c.ok) return c;
    s.animals[id] = (s.animals[id] || 0) + 1;
    return c;
  }
  function sell(s, id) {
    if (!(s.animals[id] > 0)) return { ok: false, msg: 'אין חיה כזו' };
    s.animals[id]--;
    if (!s.animals[id]) delete s.animals[id];
    return { ok: true, refund: Math.floor(ANIMAL_BY_ID[id].price / 2) };
  }
  function canExpand(s) {
    if (s.expansions >= MAX_EXPANSIONS) return { ok: false, msg: 'הגן כבר בגודל המקסימום' };
    return { ok: true, cost: expandCost(s) };
  }
  function expand(s) {
    const c = canExpand(s);
    if (c.ok) s.expansions++;
    return c;
  }
  function feed(s) {
    if (animalCount(s) === 0) return { ok: false, msg: 'עוד אין חיות להאכיל' };
    if (s.fed >= 95) return { ok: false, msg: 'החיות שבעות' };
    return { ok: true, cost: careCost(s) };
  }
  function clean(s) {
    if (animalCount(s) === 0) return { ok: false, msg: 'עוד אין מה לנקות' };
    if (s.clean >= 95) return { ok: false, msg: 'הגן נקי' };
    return { ok: true, cost: careCost(s) };
  }
  function setPrice(s, p) {
    if (!PRICES.includes(p)) return false;
    s.price = p;
    return true;
  }

  const api = {
    ANIMALS, ANIMAL_BY_ID, BASE_SLOTS, SLOT_STEP, MAX_EXPANSIONS, RATE_MAX, PRICES, CARE_FLOOR, AWAY_CAP_MS,
    newState, normalize, capacity, animalCount, speciesCount, freeSlots, expandCost, happiness, careCost,
    interest, visitorsPerMin, rateOf, summaryOf, decay, canBuy, buy, sell, canExpand, expand, feed, clean, setPrice,
  };
  root.ZooLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
