// Service worker: מקבל בקשות מדפי Kidlearn (דרך bridge-content.js) ומעביר אותן למארח ה-Native Messaging.
// מאשר רק את הפעולות שברשימה, ורק מהדומיין של Kidlearn. את הבדיקה הסופית עושה האפליקציה.

const HOST_NAME = "com.kidlearn.bridge";
const KIDLEARN_ORIGIN = "https://giamat13.github.io";
const ALLOWED_ACTIONS = new Set(["ping"]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || sender.origin !== KIDLEARN_ORIGIN) {
    sendResponse({ ok: false, error: "forbidden" });
    return false;
  }

  if (!message || !ALLOWED_ACTIONS.has(message.action)) {
    sendResponse({ id: message?.id ?? null, ok: false, error: "unknown_action" });
    return false;
  }

  chrome.runtime.sendNativeMessage(
    HOST_NAME,
    { id: message.id, action: message.action, payload: message.payload ?? null },
    (reply) => {
      if (chrome.runtime.lastError) {
        // המארח לא מותקן, או שהוא נכשל לפני שענה
        sendResponse({
          id: message.id,
          ok: false,
          error: "host_unavailable",
          detail: chrome.runtime.lastError.message,
        });
      } else {
        sendResponse(reply);
      }
    }
  );

  // true: התשובה תישלח באופן אסינכרוני
  return true;
});
