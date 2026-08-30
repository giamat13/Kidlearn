// Floating login/signup button. Include after kidlearn-cloud.js and call KidLearn.init(),
// then KidLearn.widget.mount() (or just include this file - it auto-mounts on DOMContentLoaded).
(function () {
  const css = `
    #kl-btn{position:fixed;bottom:14px;left:14px;z-index:9999;border:none;border-radius:20px;
      padding:10px 16px;background:#FF6B9D;color:#fff;font-size:14px;font-family:sans-serif;
      cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    #kl-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;
      align-items:center;justify-content:center}
    #kl-modal[hidden]{display:none}
    #kl-modal .kl-box{background:#fff;border-radius:16px;padding:24px;width:280px;
      font-family:sans-serif;direction:rtl;text-align:right}
    #kl-modal input{width:100%;box-sizing:border-box;padding:8px;margin:6px 0;border:1px solid #ccc;
      border-radius:8px;font-size:14px}
    #kl-modal button{width:100%;padding:9px;margin-top:8px;border:none;border-radius:8px;
      background:#FF6B9D;color:#fff;font-size:14px;cursor:pointer}
    #kl-modal .kl-tab{background:none;color:#333;border-bottom:2px solid transparent;width:auto;
      display:inline-block;padding:6px 10px;margin-left:4px}
    #kl-modal .kl-tab.active{border-color:#FF6B9D;font-weight:bold}
    #kl-modal .kl-close{background:none;color:#999;width:auto;float:left}
    #kl-modal .kl-err{color:#c0392b;font-size:12px;min-height:16px}
  `;

  function mount() {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "kl-btn";
    btn.textContent = "התחברות";
    document.body.appendChild(btn);

    const modal = document.createElement("div");
    modal.id = "kl-modal";
    modal.hidden = true;
    modal.innerHTML = `
      <div class="kl-box">
        <button class="kl-close">✕</button>
        <div>
          <button class="kl-tab active" data-tab="login">התחברות</button>
          <button class="kl-tab" data-tab="signup">חשבון חדש</button>
        </div>
        <input id="kl-username" placeholder="שם משתמש (אנגלית)" autocomplete="username">
        <input id="kl-password" type="password" placeholder="סיסמה" autocomplete="current-password">
        <div class="kl-err"></div>
        <button id="kl-submit">כניסה</button>
      </div>`;
    document.body.appendChild(modal);

    let tab = "login";
    const err = modal.querySelector(".kl-err");
    modal.querySelectorAll(".kl-tab").forEach((t) =>
      t.addEventListener("click", () => {
        tab = t.dataset.tab;
        modal.querySelectorAll(".kl-tab").forEach((x) => x.classList.toggle("active", x === t));
        modal.querySelector("#kl-submit").textContent = tab === "login" ? "כניסה" : "יצירת חשבון";
        err.textContent = "";
      })
    );
    modal.querySelector(".kl-close").addEventListener("click", () => (modal.hidden = true));

    modal.querySelector("#kl-submit").addEventListener("click", async () => {
      const username = modal.querySelector("#kl-username").value;
      const password = modal.querySelector("#kl-password").value;
      err.textContent = "";
      try {
        if (tab === "login") await window.KidLearn.logIn(username, password);
        else await window.KidLearn.signUp(username, password);
        modal.hidden = true;
      } catch (e) {
        err.textContent = e.message || "שגיאה, נסו שוב";
      }
    });

    btn.addEventListener("click", () => {
      if (window.KidLearn.currentUser()) {
        window.KidLearn.logOut();
      } else {
        modal.hidden = false;
      }
    });

    window.KidLearn.onAuthChange((profile) => {
      btn.textContent = profile ? `${profile.username} (יציאה)` : "התחברות";
    });
  }

  window.KidLearn = window.KidLearn || {};
  window.KidLearn.widget = { mount };
  document.addEventListener("DOMContentLoaded", mount);
})();
