// "כסף Kidlearn" - one shared wallet for every game.
//
// Include with <script src="../shared/kidlearn-wallet.js"></script> (path relative to the page).
// Works offline (localStorage) and syncs through KidLearn cloud saves when the kid is logged in
// (kidlearn-cloud.js is optional and may load before or after this file).
//
// API (window.KidLearnWallet):
//   balance()                     -> current balance (integer)
//   earn(amount, {reason, silent}) -> adds money, shows a "+N" toast unless silent
//   spend(amount)                 -> true and deducts if affordable, otherwise false
//   onChange(cb)                  -> cb(balance) now and after every change (also from other tabs / cloud)
//   migrateLegacy(gameId, amount) -> one-time import of a game's old private coins
//   REWARDS                       -> the reference economy, keep new games consistent with it
//
// Economy (so prices and rewards stay in proportion across games):
//   a single correct answer / small success ........ 1-2
//   finishing a short round / level ................. 5-10
//   finishing a long game / hard level / perfect run  10-25
//   cosmetic shop items cost roughly 3-10 answers (5-15), big themes 40-120.
(function () {
  const KEY = "kidlearn-wallet";
  const REWARDS = { answer: 2, smallSuccess: 1, round: 8, level: 10, perfect: 20, create: 5 };

  let state = { balance: 0, ops: 0, migrated: {} };
  const listeners = [];
  let pushTimer = null;

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || "{}");
      state = {
        balance: Math.max(0, Math.floor(+d.balance || 0)),
        ops: +d.ops || 0,
        migrated: d.migrated && typeof d.migrated === "object" ? d.migrated : {},
      };
    } catch (e) { /* storage unavailable: in-memory only */ }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      if (window.KidLearn && KidLearn.currentUser && KidLearn.currentUser()) {
        KidLearn.pushLocalStorageKey(KEY).catch(() => {});
      }
    }, 600);
  }

  function notify() {
    updateBadge();
    listeners.forEach((cb) => { try { cb(state.balance); } catch (e) {} });
  }

  function balance() { return state.balance; }

  function earn(amount, opts) {
    amount = Math.floor(+amount || 0);
    if (amount <= 0) return state.balance;
    opts = opts || {};
    state.balance += amount;
    state.ops++;
    persist();
    notify();
    if (!opts.silent) toast("+" + amount + " 💰 כסף Kidlearn" + (opts.reason ? " · " + opts.reason : ""));
    return state.balance;
  }

  function spend(amount) {
    amount = Math.floor(+amount || 0);
    if (amount < 0 || amount > state.balance) return false;
    state.balance -= amount;
    state.ops++;
    persist();
    notify();
    return true;
  }

  function onChange(cb) {
    listeners.push(cb);
    cb(state.balance);
  }

  // One-time import of coins a game used to keep for itself.
  function migrateLegacy(gameId, amount) {
    if (state.migrated[gameId]) return false;
    state.migrated[gameId] = true;
    amount = Math.floor(+amount || 0);
    if (amount > 0) state.balance += amount;
    state.ops++;
    persist();
    notify();
    return true;
  }

  // ---- UI: balance badge + toast -------------------------------------------------
  let badge, toastBox;

  function injectUI() {
    if (badge || !document.body) return;
    const style = document.createElement("style");
    style.textContent = `
      #klw-badge{position:fixed;bottom:14px;right:14px;z-index:9998;background:#fff8dc;color:#7a5200;
        border:2px solid #f2b705;border-radius:20px;padding:6px 12px;font:bold 14px sans-serif;
        box-shadow:0 2px 8px rgba(0,0,0,.25);direction:rtl;pointer-events:none}
      #klw-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-80px);z-index:10001;
        background:#f2b705;color:#3b2a00;border-radius:22px;padding:8px 18px;font:bold 16px sans-serif;
        box-shadow:0 4px 14px rgba(0,0,0,.3);transition:transform .35s;pointer-events:none;direction:rtl}
      #klw-toast.show{transform:translateX(-50%) translateY(0)}
      @media print{#klw-badge,#klw-toast{display:none!important}}
    `;
    document.head.appendChild(style);
    badge = document.createElement("div");
    badge.id = "klw-badge";
    badge.title = "כסף Kidlearn";
    document.body.appendChild(badge);
    toastBox = document.createElement("div");
    toastBox.id = "klw-toast";
    document.body.appendChild(toastBox);
    updateBadge();
  }

  function updateBadge() {
    if (badge) badge.textContent = "💰 " + state.balance + " כסף Kidlearn";
  }

  let toastTimer;
  function toast(msg) {
    injectUI();
    if (!toastBox) return;
    toastBox.textContent = msg;
    toastBox.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove("show"), 1800);
  }

  // ---- cloud sync ----------------------------------------------------------------
  // The side with more recorded operations wins; if local is ahead we push it up.
  async function syncWithCloud() {
    try {
      const cloud = await KidLearn.loadData(KEY);
      const remote = cloud && typeof cloud.raw === "string" ? JSON.parse(cloud.raw) : null;
      if (remote && (+remote.ops || 0) > state.ops) {
        state = {
          balance: Math.max(0, Math.floor(+remote.balance || 0)),
          ops: +remote.ops || 0,
          migrated: Object.assign({}, remote.migrated || {}, state.migrated),
        };
        try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
        notify();
      } else {
        await KidLearn.pushLocalStorageKey(KEY);
      }
    } catch (e) { /* offline or not logged in: stay local */ }
  }

  function hookCloud() {
    let tries = 0;
    const t = setInterval(() => {
      if (window.KidLearn && KidLearn.onAuthChange) {
        clearInterval(t);
        KidLearn.onAuthChange((profile) => { if (profile) syncWithCloud(); });
      } else if (++tries > 40) {
        clearInterval(t);
      }
    }, 250);
  }

  // another tab changed the wallet
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    load();
    notify();
  });

  load();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectUI);
  else injectUI();
  hookCloud();

  window.KidLearnWallet = { balance, earn, spend, onChange, migrateLegacy, toast, REWARDS };
})();
