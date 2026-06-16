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

    // ---------- מצב ----------
    var cursorX = window.innerWidth / 2;
    var cursorY = window.innerHeight / 2;
    var cursorEl = null;
    var focusEl = null;
    var rafId = null;

    // מצב כפתורים קודם, לכל gamepad index, ל-edge detection
    // prevButtons[gamepadIndex] = [bool, bool, ...]
    var prevButtons = {};

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

        // --- כפתור A (אינדקס 0) = קליק, עם edge-detection ---
        var aPressed = buttonPressed(buttons, 0);
        var aPrev = !!prev[0];
        if (aPressed && !aPrev) {
            clickAtCursor();
        }

        // --- LB/RB (4/5) = ניווט כרטיסיות/פוקוס, עם edge-detection ---
        var lbPressed = buttonPressed(buttons, 4);
        var rbPressed = buttonPressed(buttons, 5);
        var lbPrev = !!prev[4];
        var rbPrev = !!prev[5];
        if (lbPressed && !lbPrev) {
            navigateFocusable(-1);
        }
        if (rbPressed && !rbPrev) {
            navigateFocusable(1);
        }

        // --- Button 9 (Back/Select) = לחץ על כפתור Back אם קיים ---
        var backPressed = buttonPressed(buttons, 9);
        var backPrev = !!prev[9];
        if (backPressed && !backPrev) {
            var backEl = document.querySelector(BACK_BUTTON_SELECTOR);
            if (backEl) {
                clickAtCursor_Custom(backEl);
            }
        }

        // שמירת מצב הכפתורים לפריים הבא (edge detection)
        var snapshot = [];
        for (var i = 0; i < buttons.length; i++) {
            snapshot[i] = buttonPressed(buttons, i);
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
            delete prevButtons[e.gamepad.index];
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
