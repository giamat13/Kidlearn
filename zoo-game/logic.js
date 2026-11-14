// גן חיות: החוקים והחישובים (בלי מסך, כדי שאפשר יהיה לבדוק אותם).
// ההכנסה לדקה (rate) נשמרת יחד עם הנתונים של החלקה. העיר מוסיפה אותה למסים שלה ומשלמת אוטומטית.
(function (root) {
  // home: סוג המתחם (קובע את המראה בתלת-ממד). fact: עובדה לאלבום ולחידון
  // id של חיה הוא גם מזהה השמור בנתונים, לכן לא משנים אותו. חיות חדשות מוסיפים בסוף
  const ANIMALS = [
    { id: 'rabbit',  icon: '🐰', name: 'ארנב',      price: 20,  home: 'meadow',  fact: 'השיניים של הארנב לא מפסיקות לגדול כל החיים.' },
    { id: 'sheep',   icon: '🐑', name: 'כבשה',      price: 30,  home: 'meadow',  fact: 'מהצמר של הכבשה מכינים סוודרים חמים.' },
    { id: 'penguin', icon: '🐧', name: 'פינגווין',  price: 70,  home: 'ice',     fact: 'הפינגווין הוא ציפור שלא עפה, אבל שוחה מהר מאוד.' },
    { id: 'monkey',  icon: '🐒', name: 'קוף',       price: 50,  home: 'jungle',  fact: 'יש קופים שנאחזים בענפים בעזרת הזנב.' },
    { id: 'giraffe', icon: '🦒', name: "ג'ירפה",    price: 80,  home: 'savanna', fact: "הג'ירפה היא החיה הגבוהה ביותר בעולם." },
    { id: 'elephant', icon: '🐘', name: 'פיל',      price: 100, home: 'savanna', fact: 'הפיל שותה מים ומתקלח בעזרת החדק שלו.' },
    { id: 'lion',    icon: '🦁', name: 'אריה',      price: 120, home: 'savanna', fact: 'את שאגת האריה שומעים ממרחק של קילומטרים.' },
    { id: 'panda',   icon: '🐼', name: 'פנדה',      price: 160, home: 'bamboo',  fact: 'הפנדה אוכלת במבוק רוב שעות היום.' },
    { id: 'flamingo', icon: '🦩', name: 'פלמינגו',  price: 60,  home: 'water',   fact: 'הפלמינגו ורוד בגלל האוכל שהוא אוכל.' },
    { id: 'zebra',   icon: '🦓', name: 'זברה',      price: 90,  home: 'savanna', fact: 'לכל זברה יש דוגמת פסים משלה, כמו טביעת אצבע.' },
    { id: 'crocodile', icon: '🐊', name: 'תנין',    price: 110, home: 'water',   fact: 'השיניים של התנין מתחלפות בחדשות כל החיים.' },
    { id: 'tiger',   icon: '🐯', name: 'טיגריס',    price: 140, home: 'jungle',  fact: 'הטיגריס אוהב לשחות, שלא כמו רוב החתולים.' },
  ];
  const ANIMAL_BY_ID = Object.fromEntries(ANIMALS.map((a) => [a.id, a]));
  const BASE_SLOTS = 4;          // מקומות לחיות בהתחלה
  const SLOT_STEP = 4;           // כל הרחבה מוסיפה כמה מקומות
  const MAX_EXPANSIONS = 10;
  const RATE_MAX = 3;            // מטבעות בדקה לגן חיות אחד, לפני שדרוגים
  const PRICES = [1, 2, 3];      // מחירי כניסה אפשריים
  const ELASTIC = { 1: 1, 2: 0.75, 3: 0.5 };   // ככל שהכרטיס יקר יותר, פחות מבקרים
  const FED_LOSS_PER_MIN = 2;
  const CLEAN_LOSS_PER_MIN = 1.5;
  const CARE_FLOOR = 20;         // בהזנחה מלאה הרמה לא יורדת מתחת לזה
  const AWAY_CAP_MS = 3 * 60 * 60 * 1000;
  const BREED_MS = 8 * 60 * 1000;   // כל כמה זמן יכול להיוולד גור
  const QUIZ_MS = 45 * 1000;        // הפסקה בין שאלות בחידון
  const QUIZ_REWARD = 2;
  const HAND_CLEAN = 6;             // כמה ניקיון מוסיף איסוף לכלוך אחד ביד
  const HAND_FEED = 4;              // כמה אוכל מוסיף ליטוף והאכלה ביד

  // שדרוגים: נקנים פעם אחת (או בכמה רמות). price לפי רמה
  const UPGRADES = [
    { id: 'kiosk',  icon: '🍦', name: 'קיוסק גלידה',    price: [60],      desc: 'המבקרים קונים גלידה: 15% יותר הכנסה' },
    { id: 'gift',   icon: '🎁', name: 'חנות מזכרות',    price: [90],      desc: 'בובות ומזכרות: עוד 15% הכנסה' },
    { id: 'feeder', icon: '🥣', name: 'מאכיל אוטומטי',  price: [50, 100], desc: 'החיות נעשות רעבות לאט יותר' },
    { id: 'keeper', icon: '🧑‍🌾', name: 'שומר הגן',      price: [50, 100], desc: 'הגן מתלכלך לאט יותר' },
    { id: 'vet',    icon: '🩺', name: 'וטרינר',         price: [80],      desc: 'גורים נולדים מהר פי 2' },
  ];
  const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

  const clampN = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  function newState(now) {
    return {
      animals: {}, order: [], expansions: 0, fed: 100, clean: 100, price: 1, up: {}, done: [], born: 0,
      breedAt: 0, quizAt: 0, at: now || Date.now(), rate: 0, summary: '',
    };
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
    if (d.up && typeof d.up === 'object') {
      for (const u of UPGRADES) {
        const lv = clampN(Math.floor(+d.up[u.id] || 0), 0, u.price.length);
        if (lv > 0) s.up[u.id] = lv;
      }
    }
    if (Array.isArray(d.done)) s.done = GOALS.map((g) => g.id).filter((id) => d.done.includes(id));
    s.born = clampN(Math.floor(+d.born || 0), 0, 9999);
    s.breedAt = +d.breedAt || 0;
    s.quizAt = +d.quizAt || 0;
    // אם נשמרו יותר חיות ממקומות (נתונים פגומים), מורידים את העודף
    let over = animalCount(s) - capacity(s);
    for (const a of ANIMALS.slice().reverse()) {
      while (over > 0 && s.animals[a.id] > 0) { s.animals[a.id]--; over--; }
      if (!s.animals[a.id]) delete s.animals[a.id];
    }
    // סדר המתחמים: לפי הסדר שבו נקנו הסוגים. סוג שנמכר כולו שומר על המתחם שלו
    const seen = new Set();
    (Array.isArray(d.order) ? d.order : []).forEach((id) => { if (ANIMAL_BY_ID[id] && !seen.has(id)) { seen.add(id); s.order.push(id); } });
    ANIMALS.forEach((a) => { if (s.animals[a.id] && !seen.has(a.id)) { seen.add(a.id); s.order.push(a.id); } });
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
  const upLevel = (s, id) => (s.up && s.up[id]) || 0;
  // שדרוגים: המבקרים מוציאים יותר, והתקרה עולה
  const spendMult = (s) => 1 + 0.15 * upLevel(s, 'kiosk') + 0.15 * upLevel(s, 'gift');
  const rateMax = (s) => RATE_MAX + 0.5 * upLevel(s, 'kiosk') + 0.5 * upLevel(s, 'gift');

  function visitorsPerMin(s) {
    if (animalCount(s) === 0) return 0;
    return 0.15 * interest(s) * (happiness(s) / 100) * (ELASTIC[s.price] || 1);
  }
  function rateOf(s) {
    return Math.round(Math.min(rateMax(s), visitorsPerMin(s) * s.price * spendMult(s)) * 100) / 100;
  }
  // כוכבים (0 עד 5): לפי העניין בגן ושמחת המבקרים
  const STAR_STEPS = [1.5, 5, 10, 16, 24];
  function stars(s) {
    const score = interest(s) * happiness(s) / 100;
    return STAR_STEPS.filter((t) => score >= t).length;
  }
  function summaryOf(s) {
    const n = animalCount(s);
    if (!n) return 'עוד אין חיות';
    return `${'⭐'.repeat(stars(s))} ${n} חיות, ${speciesCount(s)} סוגים, ${visitorsPerMin(s).toFixed(1)} מבקרים בדקה`.trim();
  }

  // הזנחה: האוכל והניקיון יורדים עם הזמן (גם כשהילד לא במשחק, עד 3 שעות), אבל לא מתחת ל-CARE_FLOOR
  function decay(s, ms) {
    const min = clampN(ms, 0, AWAY_CAP_MS) / 60000;
    if (s.fed > CARE_FLOOR) s.fed = Math.max(CARE_FLOOR, s.fed - FED_LOSS_PER_MIN * (1 - 0.35 * upLevel(s, 'feeder')) * min);
    if (s.clean > CARE_FLOOR) s.clean = Math.max(CARE_FLOOR, s.clean - CLEAN_LOSS_PER_MIN * (1 - 0.35 * upLevel(s, 'keeper')) * min);
    return s;
  }

  // פעולות: מחזירות { ok, cost, msg }. התשלום עצמו נעשה במסך (בארנק), כאן רק הכללים
  function canBuy(s, id) {
    const a = ANIMAL_BY_ID[id];
    if (!a) return { ok: false, msg: 'חיה לא מוכרת' };
    if (freeSlots(s) <= 0) return { ok: false, msg: 'אין מקום בגן. הרחיבו אותו בלשונית הטיפול' };
    return { ok: true, cost: a.price };
  }
  function addAnimal(s, id) {
    s.animals[id] = (s.animals[id] || 0) + 1;
    if (!s.order.includes(id)) s.order.push(id);
  }
  function buy(s, id) {
    const c = canBuy(s, id);
    if (!c.ok) return c;
    addAnimal(s, id);
    return c;
  }
  function sell(s, id) {
    if (!(s.animals[id] > 0)) return { ok: false, msg: 'אין חיה כזו' };
    s.animals[id]--;
    if (!s.animals[id]) { delete s.animals[id]; s.order = s.order.filter((x) => x !== id); }
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

  // טיפול ביד (בלי תשלום): איסוף לכלוך והאכלה של חיה אחת
  function handClean(s) { s.clean = Math.min(100, s.clean + HAND_CLEAN); return s.clean; }
  function handFeed(s) { s.fed = Math.min(100, s.fed + HAND_FEED); return s.fed; }
  // כמה ערימות לכלוך רואים בגן עכשיו
  const messCount = (s) => (animalCount(s) ? Math.max(0, Math.min(8, Math.floor((95 - s.clean) / 9))) : 0);

  // שדרוגים
  function canUpgrade(s, id) {
    const u = UPGRADE_BY_ID[id];
    if (!u) return { ok: false, msg: 'שדרוג לא מוכר' };
    const lv = upLevel(s, id);
    if (lv >= u.price.length) return { ok: false, msg: 'השדרוג כבר ברמה הגבוהה ביותר' };
    return { ok: true, cost: u.price[lv], level: lv + 1 };
  }
  function upgrade(s, id) {
    const c = canUpgrade(s, id);
    if (c.ok) s.up[id] = c.level;
    return c;
  }

  // גורים: כשיש שתי חיות מאותו סוג, מקום פנוי והגן מטופל, נולד גור פעם בכמה דקות. מחזיר את הסוג או null
  const breedMs = (s) => BREED_MS / (1 + upLevel(s, 'vet'));
  function breedCandidate(s) {
    let best = null;
    for (const id of s.order) {
      const n = s.animals[id] || 0;
      if (n >= 2 && (!best || n < s.animals[best])) best = id;
    }
    return best;
  }
  function tryBreed(s, now) {
    if (!s.breedAt) { s.breedAt = now + breedMs(s); return null; }
    if (now < s.breedAt) return null;
    const id = breedCandidate(s);
    if (!id || freeSlots(s) <= 0 || happiness(s) < 60) { s.breedAt = now + 60000; return null; }
    addAnimal(s, id);
    s.born++;
    s.breedAt = now + breedMs(s);
    return id;
  }

  // משימות: כל אחת מזכה בפרס פעם אחת
  const GOALS = [
    { id: 'first',   icon: '🐾', text: 'קנו חיה ראשונה',          reward: 5,  ok: (s) => animalCount(s) >= 1 },
    { id: 'kinds3',  icon: '🦒', text: 'שלושה סוגי חיות בגן',      reward: 8,  ok: (s) => speciesCount(s) >= 3 },
    { id: 'ten',     icon: '🔟', text: 'עשר חיות בגן',             reward: 10, ok: (s) => animalCount(s) >= 10 },
    { id: 'baby',    icon: '🍼', text: 'גור ראשון נולד בגן',       reward: 8,  ok: (s) => s.born >= 1 },
    { id: 'up',      icon: '🏗️', text: 'קנו שדרוג ראשון',          reward: 8,  ok: (s) => Object.keys(s.up).length >= 1 },
    { id: 'kinds6',  icon: '🦁', text: 'שישה סוגי חיות בגן',       reward: 15, ok: (s) => speciesCount(s) >= 6 },
    { id: 'stars3',  icon: '⭐', text: 'גן של שלושה כוכבים',       reward: 10, ok: (s) => stars(s) >= 3 },
    { id: 'stars5',  icon: '🌟', text: 'גן של חמישה כוכבים',       reward: 25, ok: (s) => stars(s) >= 5 },
    { id: 'kinds12', icon: '🏆', text: 'כל 12 סוגי החיות בגן',     reward: 40, ok: (s) => speciesCount(s) >= ANIMALS.length },
  ];
  const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));
  const goalState = (s, g) => (s.done.includes(g.id) ? 'done' : g.ok(s) ? 'ready' : 'open');
  const goalsReady = (s) => GOALS.filter((g) => goalState(s, g) === 'ready').length;
  function claimGoal(s, id) {
    const g = GOAL_BY_ID[id];
    if (!g || goalState(s, g) !== 'ready') return { ok: false, msg: 'המשימה עוד לא הושלמה' };
    s.done.push(id);
    return { ok: true, reward: g.reward };
  }

  // חידון "מי אני?": עובדה על חיה שיש בגן, ושלוש תשובות. rand = פונקציה כמו Math.random
  function quizWait(s, now) { return Math.max(0, (s.quizAt || 0) + QUIZ_MS - now); }
  function makeQuiz(s, rand) {
    rand = rand || Math.random;
    const mine = ANIMALS.filter((a) => s.animals[a.id] > 0);
    if (!mine.length) return null;
    const answer = mine[Math.floor(rand() * mine.length)];
    const others = ANIMALS.filter((a) => a.id !== answer.id);
    const options = [answer];
    while (options.length < 3) {
      const o = others.splice(Math.floor(rand() * others.length), 1)[0];
      options.push(o);
    }
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { fact: answer.fact, answer: answer.id, options: options.map((a) => a.id) };
  }
  function quizAnswered(s, now) { s.quizAt = now; }

  const api = {
    ANIMALS, ANIMAL_BY_ID, UPGRADES, UPGRADE_BY_ID, GOALS, BASE_SLOTS, SLOT_STEP, MAX_EXPANSIONS, RATE_MAX, PRICES,
    CARE_FLOOR, AWAY_CAP_MS, BREED_MS, QUIZ_MS, QUIZ_REWARD,
    newState, normalize, capacity, animalCount, speciesCount, freeSlots, expandCost, happiness, careCost,
    interest, visitorsPerMin, rateOf, rateMax, spendMult, stars, summaryOf, decay, canBuy, buy, sell, canExpand, expand,
    feed, clean, setPrice, handClean, handFeed, messCount, upLevel, canUpgrade, upgrade, breedCandidate, tryBreed,
    goalState, goalsReady, claimGoal, quizWait, makeQuiz, quizAnswered,
  };
  root.ZooLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
