// שמירה משותפת למשחקי האטרקציות של העיר (גן חיות, לונה פארק).
// כל אטרקציה בעיר היא חלקה, והנתונים שלה נשמרים לפי החלקה: { v, savedAt, cells: { "c,r": {...} } }.
// העיר שולחת את החלקה בכתובת (?cell=c,r). בלי פרמטר (פתיחה ישירה) משתמשים בחלקה "solo".
// עובד בדפדפן רגיל בלי כניסה לחשבון. כשהילד מחובר, הנתונים נשמרים גם בענן (users/{uid}/saves/{key}).
//
//   const store = KidLearnAttraction.create('kidlearn-zoo');
//   store.cell            -> "c,r"
//   store.load()          -> הנתונים של החלקה או null
//   store.save(data)      -> שומר במכשיר ובענן
//   store.syncCloud(cb)   -> אחרי התחברות: הגרסה החדשה יותר מנצחת. cb() נקרא אם הענן החליף נתונים
(function (root) {
  const CELL_RE = /^-?\d{1,4},-?\d{1,4}$/;

  function cellFromSearch(search) {
    try {
      const raw = new URLSearchParams(search || '').get('cell');
      return raw && CELL_RE.test(raw) ? raw : 'solo';
    } catch (e) { return 'solo'; }
  }

  function create(storageKey, opts) {
    opts = opts || {};
    const storage = opts.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    const cell = opts.cell || cellFromSearch(typeof location !== 'undefined' ? location.search : '');
    let pushTimer = null;

    function readAll() {
      try {
        const all = JSON.parse(storage.getItem(storageKey) || 'null');
        if (all && typeof all === 'object' && all.cells && typeof all.cells === 'object') return all;
      } catch (e) {}
      return { v: 1, savedAt: 0, cells: {} };
    }

    function signedIn() {
      const K = root.KidLearn;
      return !!(K && K.currentUser && K.currentUser());
    }

    function push() {
      if (!signedIn() || !root.KidLearn.pushLocalStorageKey) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => { root.KidLearn.pushLocalStorageKey(storageKey).catch(() => {}); }, 700);
    }

    function load() {
      const d = readAll().cells[cell];
      return d && typeof d === 'object' ? d : null;
    }

    // opts.cloud === false: רק במכשיר (לשמירות תכופות, כמו הזנחה עם הזמן). אחרת גם בענן
    function save(data, saveOpts) {
      const all = readAll();
      all.v = 1;
      all.savedAt = Date.now();
      all.cells[cell] = data;
      try { storage.setItem(storageKey, JSON.stringify(all)); } catch (e) {}
      if (!saveOpts || saveOpts.cloud !== false) push();
    }

    function flush() {
      clearTimeout(pushTimer);
      if (signedIn() && root.KidLearn.pushLocalStorageKey) root.KidLearn.pushLocalStorageKey(storageKey).catch(() => {});
    }

    async function syncCloud(cb) {
      if (!signedIn()) return false;
      try {
        const cloud = await root.KidLearn.loadData(storageKey);
        const remote = cloud && typeof cloud.raw === 'string' ? JSON.parse(cloud.raw) : null;
        const local = JSON.parse(storage.getItem(storageKey) || 'null');
        if (remote && (!local || (remote.savedAt || 0) > (local.savedAt || 0))) {
          storage.setItem(storageKey, cloud.raw);
          if (cb) cb();
          return true;
        }
        if (local) push();
      } catch (e) { /* ללא רשת: ממשיכים לשמור במכשיר */ }
      return false;
    }

    return { cell, load, save, flush, syncCloud, readAll };
  }

  const api = { create, cellFromSearch };
  root.KidLearnAttraction = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
