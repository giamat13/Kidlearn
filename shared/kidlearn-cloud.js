// KidLearn cloud account: username+password (no email required), cloud game saves,
// family contacts, and family email sending. Include after the firebase-*-compat.js
// CDN scripts and shared/kidlearn-firebase-config.js, then call KidLearn.init().
(function () {
  const AUTH_DOMAIN_SUFFIX = "@kidlearn.local";

  function usernameToAuthEmail(username) {
    const clean = String(username || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    return clean + AUTH_DOMAIN_SUFFIX;
  }

  function isValidUsername(username) {
    return /^[a-z0-9_]{3,20}$/.test(String(username || "").trim().toLowerCase());
  }

  function isValidDisplayName(name) {
    const clean = String(name || "").trim();
    return clean.length >= 1 && clean.length <= 30;
  }

  // Same keys as "grade" in games.json and the grade select on index.html.
  // The rules in firestore.rules accept the same list.
  const GRADES = [
    "preschool", "kindergarten", "first", "second", "third", "fourth", "fifth",
    "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
  ];

  function isValidGrade(grade) {
    return GRADES.includes(grade);
  }

  let app, auth, db, analytics;
  let currentProfile = null; // { uid, username }
  const authListeners = [];

  function init(config) {
    config = config || window.KIDLEARN_FIREBASE_CONFIG;
    app = firebase.initializeApp(config);
    auth = firebase.auth();
    db = firebase.firestore();
    if (config.measurementId && firebase.analytics) {
      analytics = firebase.analytics();
    }
    if (window.KIDLEARN_EMAILJS_CONFIG && window.emailjs) {
      window.emailjs.init(window.KIDLEARN_EMAILJS_CONFIG.publicKey);
    }
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        currentProfile = null;
        authListeners.forEach((cb) => cb(null));
        return;
      }
      const snap = await db.collection("users").doc(user.uid).get();
      const stored = snap.data() || {};
      currentProfile = {
        uid: user.uid,
        username: stored.username || (user.email || "").split("@")[0],
        avatarEmoji: stored.avatarEmoji || "🙂",
        displayName: stored.displayName || "",
        grade: stored.grade || null,
      };
      authListeners.forEach((cb) => cb(currentProfile));
      ensureUsernameIndex(user.uid, stored.username); // lets friends find this account (older accounts get it on login)
    });
  }

  function onAuthChange(cb) {
    authListeners.push(cb);
    if (currentProfile !== undefined) cb(currentProfile);
  }

  function currentUser() {
    return currentProfile;
  }

  async function signUp(username, password, displayName, grade) {
    if (!isValidUsername(username)) {
      throw new Error("שם משתמש חייב להיות 3-20 תווים באנגלית/מספרים בלבד");
    }
    if (!isValidDisplayName(displayName)) {
      throw new Error("צריך להזין שם (עד 30 תווים)");
    }
    if (!isValidGrade(grade)) {
      throw new Error("צריך לבחור כיתה");
    }
    const cred = await auth.createUserWithEmailAndPassword(usernameToAuthEmail(username), password);
    // name and grade are written in the same call as the username, so a new profile is never half-filled
    await db.collection("users").doc(cred.user.uid).set({
      username: username.trim().toLowerCase(),
      displayName: displayName.trim(),
      grade,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await ensureUsernameIndex(cred.user.uid, username.trim().toLowerCase());
    return cred.user.uid;
  }

  async function logIn(username, password) {
    await auth.signInWithEmailAndPassword(usernameToAuthEmail(username), password);
  }

  function logOut() {
    return auth.signOut();
  }

  // Recovery email is stored for future reference only; it is not yet wired to a
  // password-reset flow (would need its own emailing, same as sendFamilyMessage).
  async function linkEmail(email) {
    requireAuth();
    await db.collection("users").doc(auth.currentUser.uid).set({ recoveryEmail: email }, { merge: true });
  }

  // Per-game switches, stored per account in users/{uid}/gameSettings/{gameId} = { off: true | false }.
  // A game with no document keeps its default from games.json ("defaultOff").
  // Without an account the switches are kept on this device (localStorage), so they work for everyone.
  const LOCAL_GAMES_KEY = "kidlearn-games-off";

  function readLocalGamesOff() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_GAMES_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function writeLocalGamesOff(off) {
    try {
      localStorage.setItem(LOCAL_GAMES_KEY, JSON.stringify(off));
    } catch (e) {
      // storage is blocked (private window): the switch works until the page is closed
    }
  }

  // Returns { gameId: true | false } for every game that was switched at least once.
  // A game that is not in the map keeps its default (games.json "defaultOff").
  async function getGamesOff() {
    if (!auth || !auth.currentUser) return readLocalGamesOff();
    const snap = await db.collection("users").doc(auth.currentUser.uid).collection("gameSettings").get();
    const off = {};
    snap.docs.forEach((d) => {
      off[d.id] = d.data().off === true;
    });
    return off;
  }

  async function setGameOff(gameId, off) {
    if (!/^[a-z0-9-]{1,60}$/.test(String(gameId || ""))) {
      throw new Error("מזהה משחק לא תקין");
    }
    if (!auth || !auth.currentUser) {
      const local = readLocalGamesOff();
      local[gameId] = off === true;
      writeLocalGamesOff(local);
      return off === true;
    }
    await db.collection("users").doc(auth.currentUser.uid).collection("gameSettings").doc(gameId)
      .set({ off: off === true });
    return off === true;
  }

  async function setAvatar(emoji) {
    requireAuth();
    await db.collection("users").doc(auth.currentUser.uid).set({ avatarEmoji: emoji }, { merge: true });
    if (currentProfile) currentProfile.avatarEmoji = emoji;
  }

  function requireAuth() {
    if (!auth.currentUser) throw new Error("צריך להתחבר קודם");
  }

  async function saveData(gameId, data) {
    requireAuth();
    await db.collection("users").doc(auth.currentUser.uid).collection("saves").doc(gameId)
      .set({ data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  }

  async function deleteData(gameId) {
    requireAuth();
    await db.collection("users").doc(auth.currentUser.uid).collection("saves").doc(gameId).delete();
  }

  async function loadData(gameId) {
    requireAuth();
    const snap = await db.collection("users").doc(auth.currentUser.uid).collection("saves").doc(gameId).get();
    return snap.exists ? snap.data().data : null;
  }

  const contacts = {
    async list() {
      requireAuth();
      const snap = await db.collection("users").doc(auth.currentUser.uid).collection("contacts").orderBy("createdAt").get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    // `email` is a real email, or a KidLearn username (no "@") for a KidLearn friend.
    async add(name, email) {
      requireAuth();
      email = String(email || "").trim();
      if (!email.includes("@")) {
        email = email.toLowerCase();
        if (!isValidUsername(email)) throw new Error("שם משתמש KidLearn לא תקין (אותיות באנגלית ומספרים)");
        if (email === (currentProfile || {}).username) throw new Error("זה השם שלכם 🙂");
        const found = await db.collection("usernames").doc(email).get();
        if (!found.exists) throw new Error("לא מצאנו משתמש KidLearn בשם הזה");
      }
      const ref = await db.collection("users").doc(auth.currentUser.uid).collection("contacts").add({
        name, email, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return ref.id;
    },
    // Merge extra fields onto a contact (e.g. { city, lat, lon } used by the weather game).
    async update(contactId, fields) {
      requireAuth();
      await db.collection("users").doc(auth.currentUser.uid).collection("contacts").doc(contactId).set(fields, { merge: true });
    },
    async remove(contactId) {
      requireAuth();
      await db.collection("users").doc(auth.currentUser.uid).collection("contacts").doc(contactId).delete();
    },
  };

  // Sends straight from the browser via EmailJS (no server/Cloud Function needed,
  // works on Firebase's free Spark plan). Requires shared/kidlearn-emailjs-config.js
  // and the EmailJS SDK script to be loaded before KidLearn.init().
  async function sendFamilyMessage(contactId, subject, body, bgTheme, imageData) {
    requireAuth();
    if (!window.emailjs || !window.KIDLEARN_EMAILJS_CONFIG) {
      throw new Error("EmailJS לא הוגדר - ראו shared/kidlearn-emailjs-config.js");
    }
    const uid = auth.currentUser.uid;
    const contactSnap = await db.collection("users").doc(uid).collection("contacts").doc(contactId).get();
    if (!contactSnap.exists) throw new Error("איש הקשר לא נמצא");
    const contact = contactSnap.data();

    const userSnap = await db.collection("users").doc(uid).get();
    const fromUsername = (userSnap.data() || {}).username || "ילד/ה מ-KidLearn";
    const fromAvatar = (userSnap.data() || {}).avatarEmoji || "🙂";

    // Send first, and only record the message in history if EmailJS actually
    // accepted it - otherwise a bad contact address (e.g. corrupted/typo'd
    // email) would still show up as "sent" even though nothing went out.
    const messageRef = db.collection("messages").doc();
    const replyLink = "https://giamat13.github.io/Kidlearn/family-mail/reply.html?id=" + messageRef.id;
    const { serviceId, templateId } = window.KIDLEARN_EMAILJS_CONFIG;
    // The email itself only carries the subject and a link - the body, avatar,
    // background and image are shown on reply.html, which we fully control.
    // (Gmail and Outlook both block/strip base64 data: images in HTML email
    // regardless of escaping, so there's no reliable way to inline the photo
    // in the email itself without real image hosting.)
    await window.emailjs.send(serviceId, templateId, {
      to_email: contact.email,
      to_name: contact.name,
      from_username: fromUsername,
      from_avatar: fromAvatar,
      subject: `הודעה מ: ${fromUsername} ${subject || "הודעה חדשה"}`,
      reply_link: replyLink,
    });

    await messageRef.set({
      fromUid: uid,
      fromUsername,
      fromAvatar,
      toName: contact.name,
      toEmail: contact.email,
      subject: subject || "הודעה חדשה מ-KidLearn",
      body,
      bgTheme: bgTheme || null,
      image: imageData || null,
      replied: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { messageId: messageRef.id };
  }

  // ---- Friends inside KidLearn --------------------------------------------------
  // usernames/{username} = { uid } is the only public lookup (get by exact name, no listing).
  // A contact whose "email" has no "@" is a KidLearn username (see isKidLearnContact).
  // friendLetters/{id} are letters to such a contact; `amount` is KidLearn money that
  // the sender's wallet paid and the recipient's wallet receives when the letter is opened.
  const MAX_LETTER_MONEY = 500;
  const MAX_LETTER_BODY = 10000;

  async function ensureUsernameIndex(uid, username) {
    if (!db || !username) return;
    try {
      const ref = db.collection("usernames").doc(username);
      const snap = await ref.get();
      if (!snap.exists) await ref.set({ uid });
    } catch (e) { /* offline or rules not updated yet: friends just can't find this account */ }
  }

  function isKidLearnContact(contact) {
    return !!contact && !String(contact.email || "").includes("@");
  }

  // Letter to a KidLearn username. `amount` of KidLearn money is taken from this wallet now.
  async function sendFriendLetter(username, { subject, body, bgTheme, image, amount }) {
    requireAuth();
    const profile = currentProfile || {};
    const target = await db.collection("usernames").doc(String(username || "").trim().toLowerCase()).get();
    if (!target.exists) throw new Error("לא מצאנו משתמש KidLearn בשם הזה");
    const friendUid = target.data().uid;
    amount = Math.floor(+amount || 0);
    if (amount < 0 || amount > MAX_LETTER_MONEY) throw new Error("אפשר לצרף עד " + MAX_LETTER_MONEY + " כסף Kidlearn");
    if (!body || body.length > MAX_LETTER_BODY) throw new Error("המכתב ריק או ארוך מדי");
    if (amount > 0 && !(window.KidLearnWallet && KidLearnWallet.spend(amount))) {
      throw new Error("אין לכם מספיק כסף Kidlearn");
    }
    try {
      const ref = await db.collection("friendLetters").add({
        fromUid: auth.currentUser.uid,
        toUid: friendUid,
        toUsername: String(username).trim().toLowerCase(),
        fromName: profile.displayName || profile.username || "",
        fromUsername: profile.username || "",
        fromAvatar: profile.avatarEmoji || "🙂",
        subject: subject || "הודעה חדשה",
        body,
        bgTheme: bgTheme || null,
        image: image || null,
        amount,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return { letterId: ref.id };
    } catch (e) {
      if (amount > 0) KidLearnWallet.earn(amount, { silent: true }); // the letter did not go out: give the money back
      throw e;
    }
  }

  async function listFriendLetters(direction) {
    requireAuth();
    const field = direction === "sent" ? "fromUid" : "toUid";
    const snap = await db.collection("friendLetters").where(field, "==", auth.currentUser.uid).get();
    const letters = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    letters.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
    return letters;
  }

  // Marks a received letter as read. The transaction makes sure the attached money is paid only once:
  // returns the amount to add to the wallet (0 if the letter was already opened).
  async function openFriendLetter(letterId) {
    requireAuth();
    const uid = auth.currentUser.uid;
    const ref = db.collection("friendLetters").doc(letterId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.data();
      if (!d || d.toUid !== uid || d.read) return 0;
      tx.update(ref, { read: true });
      return Math.max(0, Math.floor(+d.amount || 0));
    });
  }

  // ---- Debug code log: every use of a debug code is recorded in users/{uid}/debugLog ----
  // A copy is kept on this device too, so uses without an account (or offline) are not lost.
  const DEBUG_LOG_KEY = "kidlearn-debug-log";

  function readLocalDebugLog() {
    try {
      const list = JSON.parse(localStorage.getItem(DEBUG_LOG_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  async function logDebugCode(code) {
    code = String(code || "").trim().toUpperCase().slice(0, 60);
    if (!code) return;
    const local = readLocalDebugLog();
    local.push({ code, at: Date.now() });
    try { localStorage.setItem(DEBUG_LOG_KEY, JSON.stringify(local.slice(-100))); } catch (e) {}
    if (!auth || !auth.currentUser) return;
    try {
      await db.collection("users").doc(auth.currentUser.uid).collection("debugLog").add({
        code,
        at: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { /* offline or rules not updated: the device copy stays */ }
  }

  // Newest first: [{ code, at (ms) }]. Signed in = the account's log, otherwise this device's log.
  async function listDebugLog() {
    if (!auth || !auth.currentUser) return readLocalDebugLog().reverse();
    const snap = await db.collection("users").doc(auth.currentUser.uid).collection("debugLog").get();
    const list = snap.docs.map((d) => {
      const x = d.data();
      return { code: x.code, at: x.at ? x.at.toMillis() : Date.now() };
    });
    list.sort((a, b) => b.at - a.at);
    return list;
  }

  // Generic localStorage<->cloud bridge so existing games can gain cloud saves
  // with two calls instead of a rewrite: pull once at startup, push after a local write.
  async function pullLocalStorageKey(key) {
    if (!auth.currentUser) return;
    const cloud = await loadData(key);
    if (cloud && typeof cloud.raw === "string") localStorage.setItem(key, cloud.raw);
  }

  async function pushLocalStorageKey(key) {
    if (!auth.currentUser) return;
    const raw = localStorage.getItem(key);
    if (raw != null) await saveData(key, { raw });
  }

  async function listSentMessages() {
    requireAuth();
    // Sorted client-side to avoid needing a composite Firestore index for this query.
    const snap = await db.collection("messages").where("fromUid", "==", auth.currentUser.uid).get();
    const messages = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    messages.sort((a, b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
    return messages;
  }

  async function getUnseenReplies() {
    const messages = await listSentMessages();
    return messages.filter((m) => m.replied && !m.replySeenByKid);
  }

  async function markReplySeen(messageId) {
    requireAuth();
    await db.collection("messages").doc(messageId).update({ replySeenByKid: true });
  }

  // Keeps localStorage keys in step with the account (games that save to localStorage).
  // Signed in: a cloud copy replaces a different local copy (returns true if anything changed);
  // with no cloud copy, the local copy is uploaded.
  async function syncKeys(keys) {
    if (!auth || !auth.currentUser) return false;
    let changed = false;
    for (const key of keys) {
      try {
        const cloud = await loadData(key);
        if (cloud && typeof cloud.raw === "string") {
          if (localStorage.getItem(key) !== cloud.raw) {
            localStorage.setItem(key, cloud.raw);
            changed = true;
          }
        } else {
          await pushLocalStorageKey(key);
        }
      } catch (e) { /* offline: the game keeps working on this device */ }
    }
    return changed;
  }

  // Call once after init(). On every sign-in the keys are synced, and the page reloads once
  // if the cloud brought new data, so the game reads it at startup.
  function watchKeys(keys) {
    onAuthChange(async (profile) => {
      if (!profile) return;
      if (await syncKeys(keys)) location.reload();
    });
  }

  // Upload one localStorage key after a write. Never throws (offline is fine).
  function backupKey(key) {
    return pushLocalStorageKey(key).catch(() => {});
  }

  window.KidLearn = {
    init, onAuthChange, currentUser, signUp, logIn, logOut, linkEmail,
    saveData, loadData, deleteData, contacts, sendFamilyMessage, listSentMessages,
    logDebugCode, listDebugLog, isKidLearnContact, sendFriendLetter, listFriendLetters, openFriendLetter,
    getUnseenReplies, markReplySeen, setAvatar, getGamesOff, setGameOff,
    pullLocalStorageKey, pushLocalStorageKey, syncKeys, watchKeys, backupKey,
    _internal: { usernameToAuthEmail, isValidUsername, isValidDisplayName, isValidGrade },
  };
})();
