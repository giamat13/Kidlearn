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
      const storedUsername = (snap.data() || {}).username;
      currentProfile = { uid: user.uid, username: storedUsername || (user.email || "").split("@")[0] };
      authListeners.forEach((cb) => cb(currentProfile));
    });
  }

  function onAuthChange(cb) {
    authListeners.push(cb);
    if (currentProfile !== undefined) cb(currentProfile);
  }

  function currentUser() {
    return currentProfile;
  }

  async function signUp(username, password) {
    if (!isValidUsername(username)) {
      throw new Error("שם משתמש חייב להיות 3-20 תווים באנגלית/מספרים בלבד");
    }
    const cred = await auth.createUserWithEmailAndPassword(usernameToAuthEmail(username), password);
    await db.collection("users").doc(cred.user.uid).set({
      username: username.trim().toLowerCase(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
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

  function requireAuth() {
    if (!auth.currentUser) throw new Error("צריך להתחבר קודם");
  }

  async function saveData(gameId, data) {
    requireAuth();
    await db.collection("users").doc(auth.currentUser.uid).collection("saves").doc(gameId)
      .set({ data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
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
    async add(name, email) {
      requireAuth();
      const ref = await db.collection("users").doc(auth.currentUser.uid).collection("contacts").add({
        name, email, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return ref.id;
    },
    async remove(contactId) {
      requireAuth();
      await db.collection("users").doc(auth.currentUser.uid).collection("contacts").doc(contactId).delete();
    },
  };

  // Sends straight from the browser via EmailJS (no server/Cloud Function needed,
  // works on Firebase's free Spark plan). Requires shared/kidlearn-emailjs-config.js
  // and the EmailJS SDK script to be loaded before KidLearn.init().
  async function sendFamilyMessage(contactId, subject, body) {
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

    const messageRef = db.collection("messages").doc();
    await messageRef.set({
      fromUid: uid,
      fromUsername,
      toName: contact.name,
      toEmail: contact.email,
      subject: subject || "הודעה חדשה מ-KidLearn",
      body,
      replied: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    const replyLink = new URL("reply.html?id=" + messageRef.id, location.href).href;
    const { serviceId, templateId } = window.KIDLEARN_EMAILJS_CONFIG;
    await window.emailjs.send(serviceId, templateId, {
      to_email: contact.email,
      to_name: contact.name,
      from_username: fromUsername,
      subject: subject || `הודעה חדשה מ-${fromUsername} ב-KidLearn`,
      message: body,
      reply_link: replyLink,
    });

    return { messageId: messageRef.id };
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

  window.KidLearn = {
    init, onAuthChange, currentUser, signUp, logIn, logOut, linkEmail,
    saveData, loadData, contacts, sendFamilyMessage, listSentMessages,
    _internal: { usernameToAuthEmail, isValidUsername },
  };
})();
