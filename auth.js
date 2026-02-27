// ============================================================
//  KidLearn Firebase Auth Helper — v12 modular (ESM)
//  Used as type="module" in every page.
// ============================================================

import { initializeApp }                          from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged }                     from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc,
         setDoc, updateDoc, serverTimestamp }     from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// ── Firebase config (homework-easy-times project) ────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCbHTfv0U0DdVRbKc4FSPQi-VF4zrdX0QQ",
  authDomain:        "homework-easy-times.firebaseapp.com",
  projectId:         "homework-easy-times",
  storageBucket:     "homework-easy-times.firebasestorage.app",
  messagingSenderId: "344316429906",
  appId:             "1:344316429906:web:f15b1371c7a819b528c18b",
  measurementId:     "G-G74QWLL1MJ"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── Helpers ──────────────────────────────────────────────────

function userRef(uid) {
  return doc(db, "users", uid);
}

/**
 * Register a new child account.
 * Firebase email = username@kidlearn.local (no real email needed).
 */
export async function registerUser({ username, password, grade, age, parentPhone, contacts }) {
  const fakeEmail = `${username.toLowerCase().trim()}@kidlearn.local`;
  const cred = await createUserWithEmailAndPassword(auth, fakeEmail, password);
  const uid  = cred.user.uid;
  await setDoc(userRef(uid), {
    username:    username.trim(),
    grade,
    age:         age || null,
    parentPhone: parentPhone || null,
    contacts:    contacts || [],
    scores:      {},
    createdAt:   serverTimestamp()
  });
  return uid;
}

/** Log in with username + password. */
export async function loginUser(username, password) {
  const fakeEmail = `${username.toLowerCase().trim()}@kidlearn.local`;
  const cred = await signInWithEmailAndPassword(auth, fakeEmail, password);
  return cred.user.uid;
}

/** Log out and redirect to login page. */
export async function logoutUser(redirectTo = "login.html") {
  await signOut(auth);
  window.location.href = redirectTo;
}

/** Returns the current user's Firestore profile, or null. */
export async function getCurrentProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(userRef(user.uid));
  return snap.exists() ? { uid: user.uid, ...snap.data() } : null;
}

/** Save a new high score for a game. */
export async function updateScore(gameName, score) {
  const user = auth.currentUser;
  if (!user) return;
  const snap = await getDoc(userRef(user.uid));
  const existing = snap.data()?.scores?.[gameName] || 0;
  if (score > existing) {
    await updateDoc(userRef(user.uid), { [`scores.${gameName}`]: score });
  }
}

/**
 * Auth guard — call with `await requireAuth()` at the top of protected pages.
 * Redirects to login if not signed in.
 */
export function requireAuth(redirectTo = "login.html") {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, user => {
      unsub();
      if (!user) window.location.href = redirectTo;
      else resolve(user);
    });
  });
}

// Also expose auth instance for pages that need onAuthStateChanged directly
export { auth };
