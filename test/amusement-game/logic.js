// לונה פארק: החוקים והחישובים (בלי מסך, כדי שאפשר יהיה לבדוק אותם).
// ההכנסה לדקה (rate) נשמרת יחד עם הנתונים של החלקה. העיר מוסיפה אותה למסים שלה ומשלמת אוטומטית.
(function (root) {
  // thrill: כמה מושך. cap: כמה מבקרים בדקה המתקן יכול לשרת (תור). risk: כמה הוא מרגיש בטוח פחות
  const RIDES = [
    { id: 'swing',    icon: '🪁', name: 'נדנדות',       price: 30,  thrill: 1,   cap: 6 },
    { id: 'carousel', icon: '🎠', name: 'קרוסלה',       price: 40,  thrill: 1.5, cap: 5 },
    { id: 'bumper',   icon: '🚗', name: 'מכוניות מתנגשות', price: 60, thrill: 2, cap: 5 },
    { id: 'ferris',   icon: '🎡', name: 'גלגל ענק',     price: 70,  thrill: 2.5, cap: 6 },
    { id: 'water',    icon: '🌊', name: 'מגלשת מים',    price: 90,  thrill: 3,   cap: 4 },
    { id: 'coaster',  icon: '🎢', name: 'רכבת הרים',    price: 130, thrill: 4,   cap: 3 },
  ];
  const RIDE_BY_ID = Object.fromEntries(RIDES.map((r) => [r.id, r]));
  const START_COLS = 4;
  const START_ROWS = 3;
  const MAX_ROWS = 8;
  const RATE_MAX = 3;            // מטבעות בדקה ללונה פארק אחד, לכל היותר
  const PRICES = [1, 2, 3];
  const ELASTIC = { 1: 1, 2: 0.75, 3: 0.5 };
  const SAFETY_LOSS_PER_MIN = 1.5;
  const SAFETY_FLOOR = 20;
  const AWAY_CAP_MS = 3 * 60 * 60 * 1000;
  const MODES = ['entry', 'perRide'];   // כרטיס כניסה אחד, או תשלום על כל מתקן (מטבע אחד)

  const clampN = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const cellKey = (x, y) => x + ',' + y;

  function newState(now) {
    return { cols: START_COLS, rows: START_ROWS, grid: {}, safety: 100, price: 1, mode: 'entry', at: now || Date.now(), rate: 0, summary: '' };
  }

  function normalize(d, now) {
    const s = newState(now);
    if (!d || typeof d !== 'object') return s;
    s.rows = clampN(Math.floor(+d.rows || START_ROWS), START_ROWS, MAX_ROWS);
    if (d.grid && typeof d.grid === 'object') {
      for (const [k, id] of Object.entries(d.grid)) {
        const m = /^(\d+),(\d+)$/.exec(k);
        if (!m || !RIDE_BY_ID[id]) continue;
        if (+m[1] >= s.cols || +m[2] >= s.rows) continue;
        s.grid[k] = id;
      }
    }
    s.safety = d.safety === undefined ? 100 : clampN(+d.safety || 0, 0, 100);
    s.price = PRICES.includes(+d.price) ? +d.price : 1;
    s.mode = MODES.includes(d.mode) ? d.mode : 'entry';
    s.at = +d.at || s.at;
    s.rate = rateOf(s);
    s.summary = summaryOf(s);
    return s;
  }

  const rideCount = (s) => Object.keys(s.grid).length;
  const kinds = (s) => new Set(Object.values(s.grid)).size;
  const freeCells = (s) => s.cols * s.rows - rideCount(s);
  const expandCost = (s) => 50 * (s.rows - START_ROWS + 1);
  const inspectCost = (s) => 2 + Math.floor(rideCount(s) / 3);

  // מתקן שיש לידו מתקן מסוג אחר מוסיף עניין: "מסלול כיף"
  function funPairs(s) {
    let n = 0;
    for (const [k, id] of Object.entries(s.grid)) {
      const [x, y] = k.split(',').map(Number);
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const o = s.grid[cellKey(x + dx, y + dy)];
        return o && o !== id;
      });
      if (near) n++;
    }
    return n;
  }

  // עניין = כמה המתקנים מושכים + מגוון + מסלול כיף
  function interest(s) {
    const thrill = Object.values(s.grid).reduce((a, id) => a + RIDE_BY_ID[id].thrill, 0);
    return thrill + kinds(s) * 1.5 + funPairs(s) * 0.5;
  }
  // בטיחות נמוכה מרחיקה מבקרים (בין 40% ל-100%)
  const safetyFactor = (s) => 0.4 + 0.6 * (s.safety / 100);
  const ridesPerVisitor = (s) => Math.min(3, rideCount(s));
  const capacityPerMin = (s) => Object.values(s.grid).reduce((a, id) => a + RIDE_BY_ID[id].cap, 0);

  // מבקרים שרוצים להגיע בדקה, ומבקרים שמתקבלים בפועל: אם התור ארוך מדי חלק עוזבים
  function wantedPerMin(s) {
    if (!rideCount(s)) return 0;
    return 0.12 * interest(s) * safetyFactor(s) * (s.mode === 'entry' ? (ELASTIC[s.price] || 1) : 1);
  }
  function queueRatio(s) {
    const need = wantedPerMin(s) * ridesPerVisitor(s);
    const cap = capacityPerMin(s);
    return cap > 0 ? need / cap : 0;
  }
  function servedPerMin(s) {
    const q = queueRatio(s);
    const w = wantedPerMin(s);
    return q > 1 ? w / q : w;
  }
  function rateOf(s) {
    const served = servedPerMin(s);
    const perVisitor = s.mode === 'entry' ? s.price : ridesPerVisitor(s);
    return Math.round(Math.min(RATE_MAX, served * perVisitor) * 100) / 100;
  }
  function summaryOf(s) {
    const n = rideCount(s);
    if (!n) return 'עוד אין מתקנים';
    const q = queueRatio(s);
    return `${n} מתקנים, ${kinds(s)} סוגים, ${servedPerMin(s).toFixed(1)} מבקרים בדקה${q > 1 ? ', יש תור ארוך' : ''}`;
  }

  function decay(s, ms) {
    const min = clampN(ms, 0, AWAY_CAP_MS) / 60000;
    s.safety = Math.max(SAFETY_FLOOR, s.safety - SAFETY_LOSS_PER_MIN * min);
    return s;
  }

  function inGrid(s, x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < s.cols && y >= 0 && y < s.rows; }
  function canPlace(s, id, x, y) {
    const r = RIDE_BY_ID[id];
    if (!r) return { ok: false, msg: 'מתקן לא מוכר' };
    if (!inGrid(s, x, y)) return { ok: false, msg: 'המקום מחוץ לשטח' };
    if (s.grid[cellKey(x, y)]) return { ok: false, msg: 'כבר יש שם מתקן' };
    return { ok: true, cost: r.price };
  }
  function place(s, id, x, y) {
    const c = canPlace(s, id, x, y);
    if (c.ok) s.grid[cellKey(x, y)] = id;
    return c;
  }
  function remove(s, x, y) {
    const id = s.grid[cellKey(x, y)];
    if (!id) return { ok: false, msg: 'אין שם מתקן' };
    delete s.grid[cellKey(x, y)];
    return { ok: true, refund: Math.floor(RIDE_BY_ID[id].price / 2), id };
  }
  function canExpand(s) {
    if (s.rows >= MAX_ROWS) return { ok: false, msg: 'השטח כבר במקסימום' };
    return { ok: true, cost: expandCost(s) };
  }
  function expand(s) {
    const c = canExpand(s);
    if (c.ok) s.rows++;
    return c;
  }
  function inspect(s) {
    if (!rideCount(s)) return { ok: false, msg: 'עוד אין מתקנים לבדוק' };
    if (s.safety >= 95) return { ok: false, msg: 'המתקנים בטוחים' };
    return { ok: true, cost: inspectCost(s) };
  }
  function setPrice(s, p) { if (!PRICES.includes(p)) return false; s.price = p; return true; }
  function setMode(s, m) { if (!MODES.includes(m)) return false; s.mode = m; return true; }

  const api = {
    RIDES, RIDE_BY_ID, START_COLS, START_ROWS, MAX_ROWS, RATE_MAX, PRICES, MODES, SAFETY_FLOOR, AWAY_CAP_MS,
    newState, normalize, rideCount, kinds, freeCells, expandCost, inspectCost, funPairs, interest, safetyFactor,
    ridesPerVisitor, capacityPerMin, wantedPerMin, queueRatio, servedPerMin, rateOf, summaryOf, decay,
    canPlace, place, remove, canExpand, expand, inspect, setPrice, setMode, cellKey,
  };
  root.AmusementLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
