// Hebrew niqqud (vowelization) for family-mail letters, via Dicta's free public
// Nakdan API (https://nakdan.dicta.org.il) - vocalizes text client-side for
// reading practice. Nothing is sent anywhere except the message text itself,
// and nothing is saved back to Firestore.
window.KidLearnNikud = (function () {
  const API_URL = "https://nakdan-u1-0.loadbalancer.dicta.org.il/api";

  function isHebrew(text) {
    return /[֐-׿]/.test(String(text || ""));
  }

  async function addNikud(text) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        task: "nakdan", genre: "modern", data: text,
        addmorph: false, keepqq: false, nodageshdefmem: false, patachma: false, keepmetagim: true,
      }),
    });
    if (!res.ok) throw new Error("nikud service unavailable");
    const tokens = await res.json();
    // Each token is either a separator (space/punctuation, used as-is) or a
    // word with ranked vocalization guesses - options[0] is the top guess.
    return tokens.map((t) => (t.sep ? t.word : (t.options && t.options[0]) || t.word)).join("");
  }

  // Wires a button that toggles textEl's displayed text between plain and
  // vocalized (fetched once on first click, then cached).
  function attachButton(textEl) {
    const original = textEl.textContent;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary nikud-btn";
    btn.textContent = "🔤 נקד";
    let vocalized = null;
    let showing = false;
    btn.addEventListener("click", async () => {
      if (showing) {
        textEl.textContent = original;
        btn.textContent = "🔤 נקד";
        showing = false;
        return;
      }
      if (!vocalized) {
        btn.disabled = true;
        btn.textContent = "מנקד...";
        try {
          vocalized = await addNikud(original);
        } catch (e) {
          btn.textContent = "🔤 נקד";
          btn.disabled = false;
          alert("שירות הניקוד לא זמין כרגע, נסו שוב מאוחר יותר");
          return;
        }
        btn.disabled = false;
      }
      textEl.textContent = vocalized;
      btn.textContent = "↩️ בטל ניקוד";
      showing = true;
    });
    return btn;
  }

  return { isHebrew, addNikud, attachButton };
})();
