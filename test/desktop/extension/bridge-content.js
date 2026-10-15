// נטען רק בדפי Kidlearn (ראו manifest.json). מעביר הודעות מהדף לתוסף ובחזרה.
// הדף שולח window.postMessage עם channel "kidlearn-bridge" (ראו shared/kidlearn-bridge.js).

const CHANNEL = "kidlearn-bridge";

window.addEventListener("message", (event) => {
  // רק הודעות מהחלון הזה ומאותו מקור
  if (event.source !== window || event.origin !== location.origin) return;

  const msg = event.data;
  if (!msg || msg.channel !== CHANNEL || msg.direction !== "to-extension") return;

  // בדיקה שהתוסף מותקן: לא נוגעים ברקע
  if (msg.type === "hello") {
    window.postMessage({ channel: CHANNEL, direction: "to-page", type: "ready" }, location.origin);
    return;
  }

  const reply = (response) => {
    window.postMessage({ channel: CHANNEL, direction: "to-page", id: msg.id, response }, location.origin);
  };

  try {
    chrome.runtime.sendMessage({ id: msg.id, action: msg.action, payload: msg.payload ?? null }, (response) => {
      const error = chrome.runtime.lastError;
      reply(error ? { id: msg.id, ok: false, error: "extension_error", detail: error.message } : response);
    });
  } catch (error) {
    // קורה כשהתוסף עודכן ולא נטען מחדש. הדף יקבל שגיאה במקום לחכות
    reply({ id: msg.id, ok: false, error: "extension_reloaded", detail: String(error) });
  }
});
