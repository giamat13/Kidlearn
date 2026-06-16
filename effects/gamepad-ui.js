/**
 * gamepad-ui.js — שכבת שליטה בבקר משחק (Xbox/PS/גנרי) על ממשק העמוד.
 *
 * זה לא משחק — הבקר רק שולט בעמוד עצמו (סמן עכבר וירטואלי + ניווט פוקוס).
 * לא נוגע במקלדת/עכבר הקיימים, פועל לצידם.
 *
 * שימוש: הוסף בכל עמוד HTML:
 *   <script src="effects/gamepad-ui.js"></script>
 *
 * עובד מודולרית וגנרית על כל עמוד — אם אין אלמנטים פוקוסביליים בעמוד,
 * חלק הניווט בין כרטיסיות פשוט לא יעשה כלום (לא ממציא דבר).
 */
(function () {
    'use strict';

    // ---------- הגדרות ----------
    var DEADZONE = 0.15;
    var CURSOR_MAX_SPEED = 18; // פיקסלים לפריים בהטיה מקסימלית
    var FOCUS_OUTLINE_COLOR = '#FF6B9D';
    var BACK_BUTTON_SELECTOR = '[data-gamepad-back]'; // סלקטור לכפתור Back
    var BUTTON_COOLDOWN_MS = 250; // זמן מינימלי בין שתי הפעלות של אותו כפתור, נגד ריצוד/לחיצות כפולות

    // מצב debug: הפעל ע"י window.GAMEPAD_DEBUG = true בקונסול, או ?gpdebug ב-URL.
    // מדפיס לקונסול כל כפתור שנלחץ (אינדקס) — שימושי לבדוק מיפוי בבקר לא-סטנדרטי.
    var DEBUG = /[?&]gpdebug\b/.test(location.search);

    // ---------- מצב ----------
    var cursorX = window.innerWidth / 2;
    var cursorY = window.innerHeight / 2;
    var cursorEl = null;
    var focusEl = null;
    var rafId = null;

    // מצב כפתורים קודם, לכל gamepad index, ל-edge detection
    // prevButtons[gamepadIndex] = [bool, bool, ...]
    var prevButtons = {};

    // נעילה + cooldown גנריים לכל "פעולה" (Back / A-click / LB / RB):
    // locked[actionName][padIndex] - חובה לשחרר את הכפתור לפני הפעלה חדשה.
    // lastFire[actionName][padIndex] - חותמת זמן ההפעלה האחרונה, לאכיפת BUTTON_COOLDOWN_MS.
    // מונע גם ירי חוזר כשהדף לא מתחלף (goBack שמחליף תצוגה) וגם ריצוד של הבקר.
    var actionLocked = {};
    var actionLastFire = {};

    // מפעיל fn לכלל-once-per-press, עם cooldown, לפעולה בשם actionName על בקר padIndex.
    // pressedNow: האם הכפתור/ים הרלוונטיים לחוצים כרגע בפריים הזה.
    function fireWithCooldown(actionName, padIndex, pressedNow, fn) {
        if (!actionLocked[actionName]) actionLocked[actionName] = {};
        if (!actionLastFire[actionName]) actionLastFire[actionName] = {};
        if (!pressedNow) {
            actionLocked[actionName][padIndex] = false; // שוחרר - מאפשר הפעלה הבאה
            return;
        }
        if (actionLocked[actionName][padIndex]) return; // עדיין לחוץ מההפעלה הקודמת
        actionLocked[actionName][padIndex] = true;
        var now = performance.now();
        var last = actionLastFire[actionName][padIndex] || 0;
        if (now - last < BUTTON_COOLDOWN_MS) return; // בתוך חלון ה-cooldown
        actionLastFire[actionName][padIndex] = now;
        fn();
    }

    // ---------- יצירת סמן ויזואלי ----------
    function createCursor() {
        var el = document.createElement('div');
        el.id = 'gamepad-virtual-cursor';
        el.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'width:28px',
            'height:28px',
            'margin-left:-4px',
            'margin-top:-4px',
            'pointer-events:none',
            'z-index:2147483647',
            'transform:translate(' + cursorX + 'px,' + cursorY + 'px)',
            'display:none',
            'will-change:transform'
        ].join(';');
        el.innerHTML =
            '<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));">' +
            '<path d="M2 2 L2 22 L8 17 L11.5 25 L15 23.5 L11.5 16 L19 16 Z" fill="#FF6B9D" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>' +
            '</svg>';
        document.body.appendChild(el);
        return el;
    }

    function showCursor() {
        if (cursorEl) cursorEl.style.display = 'block';
    }

    function moveCursorTo(x, y) {
        cursorX = Math.max(0, Math.min(window.innerWidth - 1, x));
        cursorY = Math.max(0, Math.min(window.innerHeight - 1, y));
        if (cursorEl) {
            cursorEl.style.transform = 'translate(' + cursorX + 'px,' + cursorY + 'px)';
        }
    }

    // ---------- קליק תחת הסמן ----------
    function clickAtCursor() {
        var el = document.elementFromPoint(cursorX, cursorY);
        if (!el) return;
        clickAtCursor_Custom(el);
    }

    function clickAtCursor_Custom(el) {
        if (!el) return;
        var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        var opts = {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: rect ? rect.left + rect.width / 2 : cursorX,
            clientY: rect ? rect.top + rect.height / 2 : cursorY
        };
        try {
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
        } catch (e) {
            // דפדפן ישן מאוד - fallback
            if (el.click) el.click();
        }
        if (rect) {
            flashCursor();
        }
    }

    // ---------- כפתור Back ----------
    // בודק שהאלמנט באמת גלוי (לא display:none / visibility:hidden / מחוץ ל-DOM).
    // חשוב כי בחלק מהמשחקים יש כמה כפתורי Back שחלקם מוסתרים (מסך סיום וכו').
    function isVisible(el) {
        if (!el) return false;
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        var style = window.getComputedStyle(el);
        return style.visibility !== 'hidden' && style.display !== 'none';
    }

    function triggerBack() {
        flashCursor();
        // מאתר את כל כפתורי ה-Back ובוחר את הראשון שגלוי כרגע.
        var candidates = document.querySelectorAll(BACK_BUTTON_SELECTOR);
        var backEl = null;
        for (var i = 0; i < candidates.length; i++) {
            if (isVisible(candidates[i])) {
                backEl = candidates[i];
                break;
            }
        }
        if (backEl) {
            // .click() מפעיל onclick inline, listeners, וניווט של <a>.
            if (typeof backEl.click === 'function') {
                backEl.click();
            } else {
                backEl.dispatchEvent(new MouseEvent('click', {
                    bubbles: true, cancelable: true, view: window
                }));
            }
            return;
        }
        // אין כפתור Back גלוי בעמוד הזה — fallback לניווט אחורה של הדפדפן.
        if (window.history.length > 1) {
            window.history.back();
        }
    }

    function flashCursor() {
        if (!cursorEl) return;
        cursorEl.style.transition = 'none';
        cursorEl.style.opacity = '0.4';
        requestAnimationFrame(function () {
            cursorEl.style.transition = 'opacity 150ms';
            cursorEl.style.opacity = '1';
        });
    }

    // ---------- ניווט בין כרטיסיות/אלמנטים פוקוסביליים ----------
    var FOCUSABLE_SELECTOR =
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="tab"]';

    function getFocusableElements() {
        var nodes = document.querySelectorAll(FOCUSABLE_SELECTOR);
        var list = [];
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (el.disabled) continue;
            var rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            var style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') continue;
            list.push(el);
        }
        return list;
    }

    function setFocusVisual(el) {
        if (focusEl && focusEl !== el) {
            focusEl.style.outline = focusEl._gpPrevOutline || '';
            focusEl.style.outlineOffset = focusEl._gpPrevOutlineOffset || '';
        }
        focusEl = el;
        if (!el) return;
        el._gpPrevOutline = el.style.outline;
        el._gpPrevOutlineOffset = el.style.outlineOffset;
        el.style.outline = '3px solid ' + FOCUS_OUTLINE_COLOR;
        el.style.outlineOffset = '2px';
        if (el.focus) {
            try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); }
        }
        if (el.scrollIntoView) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
        // עדכון הסמן הויזואלי למרכז האלמנט הממוקד, כדי שלחיצת A תפעל עליו
        var rect = el.getBoundingClientRect();
        moveCursorTo(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    function navigateFocusable(direction) {
        var list = getFocusableElements();
        if (list.length === 0) return; // אין אלמנטים פוקוסביליים בעמוד - דלג
        var idx = focusEl ? list.indexOf(focusEl) : -1;
        var nextIdx;
        if (idx === -1) {
            nextIdx = direction > 0 ? 0 : list.length - 1;
        } else {
            nextIdx = (idx + direction + list.length) % list.length;
        }
        setFocusVisual(list[nextIdx]);
        showCursor();
    }

    // ---------- קריאת בקרים ----------
    function applyDeadzone(v) {
        return Math.abs(v) < DEADZONE ? 0 : v;
    }

    function buttonPressed(buttons, index) {
        if (!buttons || index >= buttons.length) return false;
        var b = buttons[index];
        return !!(b && (b.pressed || (typeof b === 'number' && b > 0.5)));
    }

    function pollGamepads() {
        var pads = navigator.getGamepads ? navigator.getGamepads() : [];
        for (var i = 0; i < pads.length; i++) {
            var pad = pads[i];
            if (!pad || !pad.connected) continue;
            handlePad(pad);
        }
        rafId = requestAnimationFrame(pollGamepads);
    }

    function handlePad(pad) {
        var buttons = pad.buttons || [];
        var axes = pad.axes || [];
        var prev = prevButtons[pad.index] || [];

        // --- תנועת סמן: סטיק שמאלי (axes 0/1) ---
        var ax0 = axes.length > 0 ? applyDeadzone(axes[0]) : 0;
        var ax1 = axes.length > 1 ? applyDeadzone(axes[1]) : 0;

        // --- תנועת סמן: D-pad (כפתורים 12-15) כחילופין לסטיק ---
        var dpadUp = buttonPressed(buttons, 12);
        var dpadDown = buttonPressed(buttons, 13);
        var dpadLeft = buttonPressed(buttons, 14);
        var dpadRight = buttonPressed(buttons, 15);

        var dx = ax0;
        var dy = ax1;
        if (dpadLeft) dx = -1;
        if (dpadRight) dx = 1;
        if (dpadUp) dy = -1;
        if (dpadDown) dy = 1;

        if (dx !== 0 || dy !== 0) {
            showCursor();
            moveCursorTo(cursorX + dx * CURSOR_MAX_SPEED, cursorY + dy * CURSOR_MAX_SPEED);
        }

        // --- כפתור A (אינדקס 0) = קליק, עם נעילת-שחרור + cooldown ---
        fireWithCooldown('a', pad.index, buttonPressed(buttons, 0), clickAtCursor);

        // --- LB/RB (4/5) = ניווט כרטיסיות/פוקוס, עם נעילת-שחרור + cooldown ---
        fireWithCooldown('lb', pad.index, buttonPressed(buttons, 4), function () {
            navigateFocusable(-1);
        });
        fireWithCooldown('rb', pad.index, buttonPressed(buttons, 5), function () {
            navigateFocusable(1);
        });

        // --- כפתור Back: B (1) / View-Select (8) / Start-Menu (9) ---
        // ב-mapping סטנדרטי B הוא הכפתור המוכר ל"חזרה/ביטול".
        var backNow = buttonPressed(buttons, 1) ||
                      buttonPressed(buttons, 8) ||
                      buttonPressed(buttons, 9);
        fireWithCooldown('back', pad.index, backNow, triggerBack);

        // שמירת מצב הכפתורים לפריים הבא (edge detection)
        var snapshot = [];
        for (var i = 0; i < buttons.length; i++) {
            snapshot[i] = buttonPressed(buttons, i);
            if ((DEBUG || window.GAMEPAD_DEBUG) && snapshot[i] && !prev[i]) {
                console.log('[gamepad] button down index=' + i +
                    ' mapping=' + pad.mapping + ' id=' + pad.id);
            }
        }
        prevButtons[pad.index] = snapshot;
    }

    // ---------- אתחול ----------
    function init() {
        if (!navigator.getGamepads) return; // Gamepad API לא נתמך בדפדפן הזה
        cursorEl = createCursor();

        window.addEventListener('gamepadconnected', function () {
            showCursor();
            if (!rafId) pollGamepads();
        });
        window.addEventListener('gamepaddisconnected', function (e) {
            var idx = e.gamepad.index;
            delete prevButtons[idx];
            for (var action in actionLocked) delete actionLocked[action][idx];
            for (var action2 in actionLastFire) delete actionLastFire[action2][idx];
        });

        // התחל לדגום בכל מקרה (ייתכן שבקר כבר מחובר לפני האירוע)
        pollGamepads();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
