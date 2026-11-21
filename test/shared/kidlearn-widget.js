// Login button (bottom left). Signed out: opens the login page (login/index.html), and returns here after signing in.
// Signed in: signs out. Include after kidlearn-cloud.js and call KidLearn.init(); this file auto-mounts on DOMContentLoaded.
(function () {
  // Read now, while this script is running: the login page is one folder up from shared/
  const LOGIN_PAGE = document.currentScript ? new URL("../login/index.html", document.currentScript.src).href : null;

  const css = `
    #kl-btn{position:fixed;bottom:14px;left:14px;z-index:9999;border:none;border-radius:20px;
      padding:10px 16px;background:#C2185B;color:#fff;font-size:14px;font-family:'Varela Round',sans-serif;
      cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);min-height:44px}
    #kl-btn:focus-visible{outline:3px solid #FF6B9D;outline-offset:2px}
  `;

  function mount() {
    if (document.getElementById("kl-btn")) return;

    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "kl-btn";
    btn.type = "button";
    btn.textContent = "התחברות";
    btn.addEventListener("click", () => {
      if (window.KidLearn.currentUser()) {
        window.KidLearn.logOut();
        return;
      }
      if (!LOGIN_PAGE) return;
      const url = new URL(LOGIN_PAGE);
      url.searchParams.set("next", location.href);
      location.href = url.href;
    });
    document.body.appendChild(btn);

    window.KidLearn.onAuthChange((profile) => {
      btn.textContent = profile ? `${profile.username} (יציאה)` : "התחברות";
    });
  }

  window.KidLearn = window.KidLearn || {};
  window.KidLearn.widget = { mount };
  document.addEventListener("DOMContentLoaded", mount);
})();
