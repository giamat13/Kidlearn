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
    #kl-modal .kl-signup[hidden]{display:none}
    #kl-modal select{width:100%;box-sizing:border-box;padding:8px;margin:6px 0;border:1px solid #ccc;
      border-radius:8px;font-size:14px;background:#fff}
    #kl-modal .kl-switch{background:none;color:#c2185b;text-decoration:underline;font-size:13px}
  `;

  function mount() {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.id = "kl-btn";
    btn.textContent = "התחברות";
    document.body.appendChild(btn);

    // Same keys and labels as the grade select in index.html (and "grade" in games.json)
    const GRADE_OPTIONS = [
      ["preschool", "טרום חובה"], ["kindergarten", "גן חובה"],
      ["first", "כיתה א׳"], ["second", "כיתה ב׳"], ["third", "כיתה ג׳"], ["fourth", "כיתה ד׳"],
      ["fifth", "כיתה ה׳"], ["sixth", "כיתה ו׳"], ["seventh", "כיתה ז׳"], ["eighth", "כיתה ח׳"],
      ["ninth", "כיתה ט׳"], ["tenth", "כיתה י׳"], ["eleventh", "כיתה י\"א"], ["twelfth", "כיתה י\"ב"],
    ];
    const gradeOptions = GRADE_OPTIONS
      .map(([key, label]) => `<option value="${key}">${label}</option>`)
      .join("");

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
        <div class="kl-signup" hidden>
          <input id="kl-name" placeholder="שם הילד/ה" maxlength="30" autocomplete="given-name">
          <select id="kl-grade"><option value="">בחרו כיתה</option>${gradeOptions}</select>
        </div>
        <input id="kl-username" placeholder="שם משתמש (אנגלית)" autocomplete="username">
        <input id="kl-password" type="password" placeholder="סיסמה" autocomplete="current-password">
        <div class="kl-err"></div>
        <button id="kl-submit">כניסה</button>
        <button class="kl-switch" id="kl-switch"></button>
      </div>`;
    document.body.appendChild(modal);

    const err = modal.querySelector(".kl-err");
    const submit = modal.querySelector("#kl-submit");
    const switchLink = modal.querySelector("#kl-switch");
    const signupFields = modal.querySelector(".kl-signup");
    let tab = "login";

    function setTab(next) {
      tab = next;
      modal.querySelectorAll(".kl-tab").forEach((x) => x.classList.toggle("active", x.dataset.tab === tab));
      signupFields.hidden = tab !== "signup";
      submit.textContent = tab === "login" ? "כניסה" : "יצירת חשבון";
      // on the sign-up screen this link leads back to login, and the other way round
      switchLink.textContent = tab === "login" ? "אין לי חשבון? הרשמה" : "כבר יש לי חשבון? להתחברות";
      err.textContent = "";
    }
    setTab("login");

    modal.querySelectorAll(".kl-tab").forEach((t) => t.addEventListener("click", () => setTab(t.dataset.tab)));
    switchLink.addEventListener("click", () => setTab(tab === "login" ? "signup" : "login"));
    modal.querySelector(".kl-close").addEventListener("click", () => (modal.hidden = true));

    submit.addEventListener("click", async () => {
      const username = modal.querySelector("#kl-username").value;
      const password = modal.querySelector("#kl-password").value;
      const displayName = modal.querySelector("#kl-name").value;
      const grade = modal.querySelector("#kl-grade").value;
      err.textContent = "";
      try {
        if (tab === "login") await window.KidLearn.logIn(username, password);
        else await window.KidLearn.signUp(username, password, displayName, grade);
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
