// נטען בכל דפי Kidlearn (ראו manifest.json). מעביר הודעות מהדף לתוסף ובחזרה,
// ומזהה ברקע אם האפליקציה במחשב רצה. התוצאה נשמרת ב-data-kidlearn-bridge על <html>:
//   "checking"        הבדיקה עוד רצה
//   "connected"       התוסף מותקן, והאפליקציה עונה
//   "extension-only"  התוסף מותקן, אבל האפליקציה לא עונה
// כשהתוסף לא מותקן, הסקריפט לא נטען, והתכונה לא קיימת. הדף שולח window.postMessage
// עם channel "kidlearn-bridge" (ראו shared/kidlearn-bridge.js).

const CHANNEL = "kidlearn-bridge";
const ATTRIBUTE = "kidlearnBridge";

let connection = "checking";

function publishConnection() {
  // documentElement עשוי להיות עדיין ריק בתחילת הטעינה, ואז מעדכנים שוב ב-DOMContentLoaded
  if (document.documentElement) {
    document.documentElement.dataset[ATTRIBUTE] = connection;
  }
}

publishConnection();
document.addEventListener("DOMContentLoaded", publishConnection);

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

// בדיקה אחת בכל טעינת דף. לא מציגה כלום, רק מעדכנת את התכונה
try {
  chrome.runtime.sendMessage({ id: "startup-check", action: "ping" }, (response) => {
    const failed = chrome.runtime.lastError || !response || !response.ok;
    connection = failed ? "extension-only" : "connected";
    publishConnection();
  });
} catch (error) {
  // התוסף עודכן בזמן שהדף היה פתוח
  connection = "extension-only";
  publishConnection();
}
