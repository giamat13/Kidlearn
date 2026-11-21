// Service worker: מקבל בקשות מדפי Kidlearn (דרך bridge-content.js) ומעביר אותן למארח ה-Native Messaging.
// מאשר רק את הפעולות שברשימה, ורק מהדומיין של Kidlearn. את הבדיקה הסופית עושה האפליקציה.

const HOST_NAME = "com.kidlearn.bridge";
const KIDLEARN_ORIGIN = "https://giamat13.github.io";
// Local development: any port on localhost or 127.0.0.1 (the same matches as manifest.json)
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
// Only these actions reach the app. The app checks them again (BridgeActions in BridgeServer.cs)
const ALLOWED_ACTIONS = new Set([
  "ping",
  "microbitStatus",
  "installMicrobit",
  // the link between "my board" and the micro:bit (start, ask what it said, show on its screen, stop)
  "boardLinkStart",
  "boardLinkPoll",
  "boardLinkShow",
  "boardLinkStop",
]);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const fromKidlearn = sender.origin === KIDLEARN_ORIGIN || LOCAL_ORIGIN.test(sender.origin || "");
  if (sender.id !== chrome.runtime.id || !fromKidlearn) {
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
