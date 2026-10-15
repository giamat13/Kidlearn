// גשר בין דפי Kidlearn לאפליקציה שרצה במחשב, דרך תוסף הכרום.
//
// Include with <script src="../shared/kidlearn-bridge.js"></script> (path relative to the page).
// Works only when the Kidlearn extension is installed. Without it, every call returns an error object.
//
// API (window.KidLearnBridge):
//   isInstalled()            -> Promise<boolean>: true when the extension answers on this page
//   request(action, payload) -> Promise<{ok, data?, error?}>: asks the desktop app. Never rejects.
//     e.g. KidLearnBridge.request("ping") -> { ok: true, data: { app: "Kidlearn", version, status } }
//
// Errors: "extension_missing", "timeout", "app_not_running", "unknown_action", "host_unavailable".
// The actions the app accepts are listed in desktop/app/BridgeServer.cs (BridgeActions).
//
// Connection status without any call: the extension sets document.documentElement.dataset.kidlearnBridge
// on every Kidlearn page: "checking", "connected" (app answers) or "extension-only" (app not running).
// No attribute means the extension is not installed.
(function () {
  "use strict";

  const CHANNEL = "kidlearn-bridge";
  const REQUEST_TIMEOUT_MS = 5000;
  const HELLO_TIMEOUT_MS = 1000;

  const pending = new Map();
  let installed = false;
  let helloWaiters = [];

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;

    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL || msg.direction !== "to-page") return;

    if (msg.type === "ready") {
      installed = true;
      helloWaiters.splice(0).forEach((waiter) => waiter(true));
      return;
    }

    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    clearTimeout(entry.timer);
    entry.resolve(msg.response);
  });

  function isInstalled() {
    if (installed) return Promise.resolve(true);

    return new Promise((resolve) => {
      const waiter = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        helloWaiters = helloWaiters.filter((w) => w !== waiter);
        resolve(false);
      }, HELLO_TIMEOUT_MS);

      helloWaiters.push(waiter);
      window.postMessage({ channel: CHANNEL, direction: "to-extension", type: "hello" }, location.origin);
    });
  }

  // options.timeoutMs: longer for slow actions such as installing on a micro:bit (default 5 s)
  async function request(action, payload, options) {
    if (!installed && !(await isInstalled())) {
      return { ok: false, error: "extension_missing" };
    }

    const timeoutMs = (options && options.timeoutMs) || REQUEST_TIMEOUT_MS;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve({ ok: false, error: "timeout" });
      }, timeoutMs);

      pending.set(id, { resolve, timer });
      window.postMessage(
        { channel: CHANNEL, direction: "to-extension", id, action, payload: payload ?? null },
        location.origin
      );
    });
  }

  window.KidLearnBridge = { isInstalled, request };
})();
