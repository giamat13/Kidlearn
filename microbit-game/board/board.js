// "הלוח שלי" (My board): a big drawing page the child turns into a game board or a control panel.
//
// This file is an add-on of the micro:bit programming page. The page loads it only when the add-on is on, and it
// never touches the program that is sent to the micro:bit: the board and its stories are kept apart in `board`.
// Everything here runs in the browser. It needs no Chrome extension and no desktop app.
//
// board = {
//   v: 1,
//   strokes: [ { c: "#rrggbb", w: 12, p: [x, y, x, y, ...] } ],      free drawing, in board units (1000 x 600)
//   parts:   [ { id, type, name, x, y, w, h, color?, key?, src? } ],  type: button | slider | key | lamp | counter | label | screen | picture
//   stories: [ { event, part, actions: [ { do, part?, ... } ] } ]    event: press | slide | key (a part of the board starts it)
//
// Every event of the micro:bit (it starts, A, B, a shake, a tilt, ...) is the micro:bit's own. A story of one of them runs its
// board blocks only when the micro:bit says so: the desktop link calls microbitEvent(name). Nothing starts them on the screen alone.
//
// A story of the board (a button, a slider, a key) can also use the micro:bit's own output blocks: show a picture, show a
// word, a drawing, clear the screen. They are shown on the micro:bit through the page's link, while the board plays.
//
// The blocks of the board are named bLampOn, bLampOff, bAdd, bReset, bShow, bWord and bBlank. They can also be in a
// story of the page ("when it starts", "when A is pressed", "when B is pressed"), next to the micro:bit's own blocks:
// the micro:bit runs its blocks, and the board runs the blocks of the board (the page keeps those stories).
// }
//
// The page gives init() a host: { get() -> saved board or null, update(board) -> called after every change }.
(function () {
    'use strict';

    const W = 1000, H = 600;          // the board's own units: a part keeps its place when the screen size changes
    const MAX_PARTS = 20;             // parts (not counting pictures)
    const MAX_PICS = 3;               // uploaded pictures
    const MAX_STORIES = 12;
    const MAX_ACTIONS = 12;
    const MAX_STROKES = 300;
    const MAX_POINTS = 1500;          // points in one stroke
    const MAX_BYTES = 150000;         // the whole board, as saved. Keeps the account copy far below Firestore's 1 MB document limit
    const MAX_COUNT = 99999;

    const COLORS = ['#2B2433', '#E5484D', '#FF8A00', '#F5C400', '#22A06B', '#2F80ED', '#8B5CF6', '#FF6B9D', '#8A5A2B', '#FFFFFF'];
    const COLOR_NAMES = ['שחור', 'אדום', 'כתום', 'צהוב', 'ירוק', 'כחול', 'סגול', 'ורוד', 'חום', 'לבן'];
    const WIDTHS = [{ w: 5, label: 'עט דק' }, { w: 12, label: 'עט בינוני' }, { w: 26, label: 'עט עבה' }];
    const PART_COLORS = ['#FF6B9D', '#FF8A00', '#F5C400', '#22A06B', '#2F80ED', '#8B5CF6'];

    const TYPES = {
        button:  { emoji: '🔴', label: 'כפתור', w: 170, h: 170, color: '#FF6B9D' },
        slider:  { emoji: '🎚️', label: 'סרגל',  w: 380, h: 90,  color: '#2F80ED' },
        key:     { emoji: '⌨️', label: 'מקש',   w: 130, h: 130, color: '#8B5CF6' },
        lamp:    { emoji: '💡', label: 'נורה',  w: 130, h: 130, color: '#F5C400' },
        counter: { emoji: '🔢', label: 'מספר',  w: 220, h: 150, color: '#F5C400' },
        label:   { emoji: '🏷️', label: 'כיתוב', w: 320, h: 90,  color: '#2B2433' },
        screen:  { emoji: '🖥️', label: 'מסך',   w: 240, h: 170, color: '#7CF0C0' },
    };
    const COLORED = ['button', 'slider', 'key', 'lamp', 'counter', 'label']; // the parts that have a colour to choose

    // What a screen can show: a picture or a word. `icon` and `mb` are the names the micro:bit's own screen understands.
    const PICTURES = [
        { icon: 'heart', emoji: '❤️', label: 'לב' }, { icon: 'happy', emoji: '😊', label: 'שמח' },
        { icon: 'sad', emoji: '😢', label: 'עצוב' }, { icon: 'surprised', emoji: '😮', label: 'הפתעה' },
        { icon: 'angry', emoji: '😠', label: 'כועס' }, { icon: 'asleep', emoji: '😴', label: 'ישן' },
        { icon: 'yes', emoji: '✅', label: 'נכון' }, { icon: 'no', emoji: '❌', label: 'לא' },
        { icon: 'up', emoji: '⬆️', label: 'למעלה' }, { icon: 'right', emoji: '➡️', label: 'ימינה' },
        { icon: 'down', emoji: '⬇️', label: 'למטה' }, { icon: 'left', emoji: '⬅️', label: 'שמאלה' },
        { icon: 'house', emoji: '🏠', label: 'בית' }, { icon: 'ghost', emoji: '👻', label: 'רוח' },
        { icon: 'target', emoji: '🎯', label: 'מטרה' },
    ];
    const WORDS = [
        { word: 'HI', text: 'שלום' }, { word: 'GO', text: 'קדימה' }, { word: 'OK', text: 'בסדר' },
        { word: 'YAY', text: 'הידד' }, { word: 'NO', text: 'לא' },
    ];
    const WAITS = [
        { seconds: 0.5, emoji: '⚡', label: 'חצי שנייה' }, { seconds: 1, emoji: '⏳', label: 'שנייה' },
        { seconds: 2, emoji: '⌛', label: '2 שניות' }, { seconds: 3, emoji: '🕐', label: '3 שניות' },
    ];

    // ---- the saved shape: whatever comes from storage is checked and cut to size before it is used ----
    const emptyBoard = () => ({ v: 1, strokes: [], parts: [], stories: [] });
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const num = (v, lo, hi, fallback) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? clamp(Number(v), lo, hi) : fallback);
    const text = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    const HEX = /^#[0-9a-fA-F]{6}$/;
    const IMG = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

    const EVENT_PART = { press: 'button', slide: 'slider', key: 'key' };
    const ACTION_PART = { bLampOn: 'lamp', bLampOff: 'lamp', bAdd: 'counter', bReset: 'counter', bShow: 'screen', bWord: 'screen', bBlank: 'screen' };
    const BOARD_DO = Object.keys(ACTION_PART);
    // The micro:bit's own output blocks, the same ones the page's stories use. In a story of the board they are
    // shown on the micro:bit through the link. (The waits are the board's own.)
    const MB_DO = ['show', 'text', 'draw', 'clear'];

    function cleanMbAction(a) {
        if (!a) return null;
        if (a.do === 'show') return PICTURES.some(p => p.icon === a.icon) ? { do: 'show', icon: a.icon } : null;
        if (a.do === 'text') return WORDS.some(w => w.word === a.word) ? { do: 'text', word: a.word } : null;
        if (a.do === 'draw') return typeof a.pixels === 'string' && /^[01]{25}$/.test(a.pixels) ? { do: 'draw', pixels: a.pixels } : null;
        if (a.do === 'clear') return { do: 'clear' };
        return null;
    }

    function cleanBoard(raw) {
        const out = emptyBoard();
        if (!raw || typeof raw !== 'object') return out;

        for (const s of Array.isArray(raw.strokes) ? raw.strokes.slice(0, MAX_STROKES) : []) {
            if (!s || !Array.isArray(s.p) || s.p.length < 2) continue;
            const p = [];
            for (let i = 0; i + 1 < s.p.length && p.length < MAX_POINTS * 2; i += 2) {
                p.push(Math.round(num(s.p[i], 0, W, 0)), Math.round(num(s.p[i + 1], 0, H, 0)));
            }
            out.strokes.push({ c: HEX.test(s.c) ? s.c : COLORS[0], w: Math.round(num(s.w, 2, 60, 12)), p });
        }

        const ids = new Set();
        let pics = 0;
        for (const q of Array.isArray(raw.parts) ? raw.parts : []) {
            if (!q || typeof q.id !== 'string' || !/^[a-z0-9]{1,12}$/.test(q.id) || ids.has(q.id)) continue;
            const isPic = q.type === 'picture';
            if (!isPic && !TYPES[q.type]) continue;
            if (isPic && (pics >= MAX_PICS || !IMG.test(q.src))) continue;
            if (!isPic && out.parts.filter(x => x.type !== 'picture').length >= MAX_PARTS) continue;
            const base = isPic ? { color: '#FFFFFF', w: 300, h: 220 } : TYPES[q.type];
            const part = {
                id: q.id,
                type: q.type,
                name: text(q.name, q.type === 'label' ? 30 : 16),
                x: 0, y: 0,
                w: num(q.w, 60, W, base.w),
                h: num(q.h, 30, H, base.h),
            };
            part.x = num(q.x, 0, W - part.w, 0);
            part.y = num(q.y, 0, H - part.h, 0);
            if (COLORED.includes(q.type)) part.color = HEX.test(q.color) ? q.color : base.color;
            if (q.type === 'key') part.key = text(q.key, 1);
            if (isPic) {
                part.src = q.src;
                pics++;
            }
            ids.add(q.id);
            out.parts.push(part);
        }

        const typeOf = (id) => (out.parts.find(p => p.id === id) || {}).type;
        for (const s of Array.isArray(raw.stories) ? raw.stories : []) {
            if (out.stories.length >= MAX_STORIES || !s) continue;
            const event = s.event;
            if (!EVENT_PART[event] || typeOf(s.part) !== EVENT_PART[event]) continue;
            const story = { event, part: s.part, actions: [] };
            for (const a of Array.isArray(s.actions) ? s.actions : []) {
                if (story.actions.length >= MAX_ACTIONS || !a) continue;
                if (a.do === 'wait') {
                    if (WAITS.some(w => w.seconds === a.seconds)) story.actions.push({ do: 'wait', seconds: a.seconds });
                    continue;
                }
                if (MB_DO.includes(a.do)) {
                    const mb = cleanMbAction(a);
                    if (mb) story.actions.push(mb);
                    continue;
                }
                if (!ACTION_PART[a.do] || typeOf(a.part) !== ACTION_PART[a.do]) continue;
                if (a.do === 'bShow') {
                    if (PICTURES.some(p => p.icon === a.icon)) story.actions.push({ do: 'bShow', part: a.part, icon: a.icon });
                } else if (a.do === 'bWord') {
                    if (WORDS.some(w => w.word === a.word)) story.actions.push({ do: 'bWord', part: a.part, word: a.word });
                } else if (a.do === 'bAdd') {
                    story.actions.push({ do: 'bAdd', part: a.part, n: 1 });
                } else {
                    story.actions.push({ do: a.do, part: a.part });
                }
            }
            out.stories.push(story);
        }
        return out;
    }

    const sizeOf = (b) => JSON.stringify(b).length;

    // ---- small helpers ----
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    function el(tag, cls, content) {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (content !== undefined) e.textContent = content;
        return e;
    }
    function button(cls, label, onClick) {
        const b = el('button', cls);
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', onClick);
        return b;
    }
    const newId = () => 'p' + Math.random().toString(36).slice(2, 8);

    // ---- state ----
    let host = null;
    let root = null;
    let board = emptyBoard();
    let mode = 'edit';                // 'edit' | 'play'
    let tool = 'move';                // 'move' | 'pen' | 'eraser'
    let colorIndex = 0;
    let widthIndex = 1;
    let selectedId = null;
    let selectedStory = -1;
    let picker = null;                // the id of the screen whose picture is being chosen, or null
    let history = [];                 // earlier lists of strokes, for the undo button
    let visible = false;
    let microbitLinked = false;       // true while a real micro:bit is linked to the board (the page's link sets it)
    let linkReason = '';              // when it is not linked: why, so the child is told in a friendly way
    let noteTimer = 0;

    const play = { gen: 0, active: false, lamps: {}, counters: {}, screens: {}, busy: new Set(), keysOn: false };
    const parts = new Map();          // id -> the element of a part on the stage

    // elements that are built once
    let stage, canvas, ctx, picsLayer, partsLayer, emptyHint, noteEl, toolsBox, inspectorBox, playExtra, modeEdit, modePlay, toStoriesBtn;

    const partById = (id) => board.parts.find(p => p.id === id);
    const partsOf = (type) => board.parts.filter(p => p.type === type);

    function note(textValue, warn) {
        if (!noteEl) return;
        noteEl.textContent = textValue || '';
        noteEl.classList.toggle('warn', !!warn);
        clearTimeout(noteTimer);
        if (textValue) noteTimer = setTimeout(() => { noteEl.textContent = ''; noteEl.classList.remove('warn'); }, 6000);
    }

    // Every change ends here: the page keeps the board with the program
    function commit() {
        try {
            host.update(board);
        } catch (e) {
            // the page could not keep it: the board stays on the screen
        }
        refreshEmptyHint();
    }

    // ================= the page =================
    function build() {
        root.innerHTML = '';
        root.classList.add('bd');

        const top = el('div', 'bd-modes');
        modeEdit = button('bd-mode', '✏️ לערוך', () => setMode('edit'));
        modePlay = button('bd-mode', '▶️ לשחק', () => setMode('play'));
        noteEl = el('p', 'bd-note');
        noteEl.setAttribute('role', 'status');
        noteEl.setAttribute('aria-live', 'polite');
        toStoriesBtn = button('bd-mode', '🧩 לבנות סיפורים', () => { const h = storyHost(); if (h && h.openStories) h.openStories(); });
        top.append(modeEdit, modePlay, toStoriesBtn, noteEl);

        toolsBox = el('div', 'bd-tools');

        const wrap = el('div', 'bd-stage-wrap');
        stage = el('div', 'bd-stage');
        picsLayer = el('div', 'bd-layer bd-pics');
        canvas = el('canvas', 'bd-canvas');
        canvas.setAttribute('aria-label', 'דף הציור');
        partsLayer = el('div', 'bd-layer bd-parts');
        emptyHint = el('div', 'bd-empty', 'ציירו על הלוח, או הוסיפו חלק מהכפתורים שלמעלה 👆');
        stage.append(picsLayer, canvas, partsLayer, emptyHint);
        ctx = canvas.getContext('2d');
        wrap.appendChild(stage);

        inspectorBox = el('div', 'bd-inspector');
        playExtra = el('div', 'bd-play-extra');

        root.append(top, toolsBox, wrap, inspectorBox, playExtra);

        buildTools();
        wireStage();
        if (typeof ResizeObserver === 'function') new ResizeObserver(() => { sizeCanvas(); redraw(); }).observe(stage);
        window.addEventListener('resize', () => { sizeCanvas(); redraw(); });
    }

    function buildTools() {
        toolsBox.innerHTML = '';

        const drawRow = el('div', 'bd-row');
        const toolButtons = [
            ['move', '👆', 'להזיז'], ['pen', '✏️', 'לצייר'], ['eraser', '🧽', 'למחוק'],
        ].map(([name, emoji, label]) => {
            const b = el('button', 'bd-btn');
            b.type = 'button';
            b.dataset.tool = name;
            b.innerHTML = '<span class="emoji" aria-hidden="true"></span><span></span>';
            b.firstChild.textContent = emoji;
            b.lastChild.textContent = label;
            b.addEventListener('click', () => setTool(name));
            return b;
        });
        drawRow.append(...toolButtons);

        COLORS.forEach((c, i) => {
            const s = el('button', 'bd-swatch');
            s.type = 'button';
            s.style.background = c;
            s.dataset.color = String(i);
            s.setAttribute('aria-label', 'צבע ' + COLOR_NAMES[i]);
            s.addEventListener('click', () => { colorIndex = i; if (tool === 'move' || tool === 'eraser') setTool('pen'); else syncTools(); });
            drawRow.appendChild(s);
        });
        WIDTHS.forEach((w, i) => {
            const b = el('button', 'bd-btn bd-width');
            b.type = 'button';
            b.dataset.width = String(i);
            b.setAttribute('aria-label', w.label);
            const dot = el('i');
            dot.style.width = dot.style.height = Math.round(6 + w.w * 0.7) + 'px';
            b.appendChild(dot);
            b.addEventListener('click', () => { widthIndex = i; if (tool === 'move') setTool('pen'); else syncTools(); });
            drawRow.appendChild(b);
        });

        const actionsRow = el('div', 'bd-row');
        const undo = button('bd-btn', '↩️ אחורה', undoStroke);
        undo.id = 'bdUndo';
        const clear = button('bd-btn danger', '🧹 לנקות ציור', () => {
            if (!board.strokes.length) return;
            pushHistory();
            board.strokes = [];
            redraw();
            commit();
            note('הציור נוקה. הכפתור "אחורה" מחזיר אותו 🙂');
            syncTools();
        });
        clear.id = 'bdClear';
        const file = el('input');
        file.type = 'file';
        file.accept = 'image/*';
        file.hidden = true;
        file.setAttribute('aria-label', 'בחירת תמונה');
        file.addEventListener('change', () => { if (file.files && file.files[0]) addPicture(file.files[0]); file.value = ''; });
        const upload = button('bd-btn', '🖼️ להעלות תמונה', () => file.click());
        upload.id = 'bdUpload';
        actionsRow.append(undo, clear, upload, file);

        const partsRow = el('div', 'bd-row');
        partsRow.appendChild(el('span', 'bd-row-title', 'מוסיפים ללוח:'));
        Object.entries(TYPES).forEach(([type, info]) => {
            const b = el('button', 'bd-btn part');
            b.type = 'button';
            b.dataset.part = type;
            b.innerHTML = '<span class="emoji" aria-hidden="true"></span><span></span>';
            b.firstChild.textContent = info.emoji;
            b.lastChild.textContent = info.label;
            b.addEventListener('click', () => addPart(type));
            partsRow.appendChild(b);
        });

        toolsBox.append(drawRow, actionsRow, partsRow);
        syncTools();
    }

    function syncTools() {
        toolsBox.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
        toolsBox.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.color) === colorIndex && tool === 'pen')));
        toolsBox.querySelectorAll('[data-width]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.width) === widthIndex && tool !== 'move')));
        const undo = toolsBox.querySelector('#bdUndo');
        if (undo) undo.disabled = history.length === 0;
        const clear = toolsBox.querySelector('#bdClear');
        if (clear) clear.disabled = board.strokes.length === 0;
        stage.classList.toggle('tool-move', tool === 'move');
        stage.classList.toggle('tool-pen', tool === 'pen');
        stage.classList.toggle('tool-eraser', tool === 'eraser');
    }

    function setTool(name) {
        tool = name;
        syncTools();
    }

    function setMode(next) {
        if (next === mode && stage.classList.contains(next === 'edit' ? 'editing' : 'playing')) return;
        mode = next;
        stopPlay();
        note('');
        modeEdit.setAttribute('aria-pressed', String(mode === 'edit'));
        modePlay.setAttribute('aria-pressed', String(mode === 'play'));
        stage.classList.toggle('editing', mode === 'edit');
        stage.classList.toggle('playing', mode === 'play');
        toolsBox.hidden = mode !== 'edit';
        toStoriesBtn.hidden = mode !== 'edit';
        if (mode === 'play') {
            selectedId = null;
            startPlay();
            linkCall('start');
        }
        renderParts();
        renderInspector();
        renderPlayExtra();
        refreshEmptyHint();
    }

    function refreshEmptyHint() {
        const empty = board.strokes.length === 0 && board.parts.length === 0;
        emptyHint.hidden = !(empty && mode === 'edit');
    }

    // ================= drawing =================
    function sizeCanvas() {
        const w = stage.clientWidth;
        if (!w) return;
        const ratio = window.devicePixelRatio || 1;
        const pxW = Math.round(w * ratio);
        const pxH = Math.round(w * H / W * ratio);
        if (canvas.width !== pxW || canvas.height !== pxH) {
            canvas.width = pxW;
            canvas.height = pxH;
        }
    }

    function drawStroke(s) {
        const k = canvas.width / W;
        ctx.strokeStyle = s.c;
        ctx.fillStyle = s.c;
        ctx.lineWidth = s.w * k;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const p = s.p;
        ctx.beginPath();
        ctx.moveTo(p[0] * k, p[1] * k);
        if (p.length === 2) ctx.lineTo(p[0] * k, p[1] * k);
        for (let i = 2; i + 1 < p.length; i += 2) {
            // smooth: curve toward each point, ending in the middle between it and the next one
            const mx = (p[i] + (p[i + 2] === undefined ? p[i] : p[i + 2])) / 2;
            const my = (p[i + 1] + (p[i + 3] === undefined ? p[i + 1] : p[i + 3])) / 2;
            ctx.quadraticCurveTo(p[i] * k, p[i + 1] * k, mx * k, my * k);
        }
        ctx.stroke();
    }

    function redraw() {
        if (!ctx) return;
        sizeCanvas();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        board.strokes.forEach(drawStroke);
    }

    function pushHistory() {
        history.push(board.strokes.slice());
        if (history.length > 30) history.shift();
    }

    function undoStroke() {
        if (!history.length) return;
        board.strokes = history.pop();
        redraw();
        commit();
        syncTools();
    }

    function unitsAt(e) {
        const r = stage.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    }

    function distToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay;
        const len2 = dx * dx + dy * dy;
        const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }

    function strokeHit(s, x, y, radius) {
        const p = s.p;
        const reach = radius + s.w / 2;
        for (let i = 0; i + 1 < p.length; i += 2) {
            const nx = i + 3 < p.length ? p[i + 2] : p[i];
            const ny = i + 3 < p.length ? p[i + 3] : p[i + 1];
            if (distToSegment(x, y, p[i], p[i + 1], nx, ny) <= reach) return true;
        }
        return false;
    }

    function wireStage() {
        let live = null;       // the stroke being drawn
        let erasing = false;

        canvas.addEventListener('pointerdown', (e) => {
            if (mode !== 'edit' || tool === 'move' || e.button > 0) return;
            e.preventDefault();
            canvas.setPointerCapture(e.pointerId);
            const u = unitsAt(e);
            if (tool === 'pen') {
                live = { c: COLORS[colorIndex], w: WIDTHS[widthIndex].w, p: [Math.round(u.x), Math.round(u.y), Math.round(u.x), Math.round(u.y)] };
                redraw();
                drawStroke(live);
            } else {
                erasing = true;
                pushHistory();
                eraseAt(u);
            }
        });
        canvas.addEventListener('pointermove', (e) => {
            if (live) {
                const u = unitsAt(e);
                const n = live.p.length;
                if (Math.hypot(u.x - live.p[n - 2], u.y - live.p[n - 1]) < 3 || n >= MAX_POINTS * 2) return;
                live.p.push(Math.round(clamp(u.x, 0, W)), Math.round(clamp(u.y, 0, H)));
                redraw();
                drawStroke(live);
            } else if (erasing) {
                eraseAt(unitsAt(e));
            }
        });
        const finish = () => {
            if (live) {
                const stroke = live;
                live = null;
                if (board.strokes.length >= MAX_STROKES) {
                    note('הלוח מלא בציורים. נקו קצת כדי לצייר עוד 🧹', true);
                } else {
                    pushHistory();
                    board.strokes.push(stroke);
                    if (sizeOf(board) > MAX_BYTES) {
                        board.strokes.pop();
                        history.pop();
                        note('הלוח התמלא! נקו קצת כדי לצייר עוד 🧹', true);
                    } else {
                        commit();
                    }
                }
                redraw();
                syncTools();
            }
            if (erasing) {
                erasing = false;
                if (history.length && history[history.length - 1].length === board.strokes.length) history.pop(); // nothing was erased
                commit();
                syncTools();
            }
        };
        canvas.addEventListener('pointerup', finish);
        canvas.addEventListener('pointercancel', finish);

        function eraseAt(u) {
            const before = board.strokes.length;
            board.strokes = board.strokes.filter(s => !strokeHit(s, u.x, u.y, 14));
            if (board.strokes.length !== before) redraw();
        }

        // a tap on an empty place of the board lets go of the chosen part
        stage.addEventListener('pointerdown', (e) => {
            if (mode === 'edit' && tool === 'move' && (e.target === stage || e.target === partsLayer || e.target === picsLayer)) select(null);
        });
    }

    // ================= pictures =================
    function readImage(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
            img.src = url;
        });
    }

    // The picture is made smaller until the whole board is small enough to be saved
    async function addPicture(file) {
        if (!file.type.startsWith('image/')) return note('זה לא נראה כמו תמונה. נסו קובץ אחר 🙂', true);
        if (partsOf('picture').length >= MAX_PICS) return note('יש כבר ' + MAX_PICS + ' תמונות בלוח. מחקו אחת כדי להוסיף.', true);
        let img;
        try {
            img = await readImage(file);
        } catch (e) {
            return note('לא הצלחנו לפתוח את התמונה. נסו תמונה אחרת 🙂', true);
        }
        const tries = [[480, 0.78], [380, 0.7], [300, 0.62], [220, 0.55]];
        for (const [maxSide, quality] of tries) {
            const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
            const cw = Math.max(1, Math.round(img.naturalWidth * scale));
            const ch = Math.max(1, Math.round(img.naturalHeight * scale));
            const c = document.createElement('canvas');
            c.width = cw;
            c.height = ch;
            const g = c.getContext('2d');
            g.fillStyle = '#FFFFFF';
            g.fillRect(0, 0, cw, ch);
            g.drawImage(img, 0, 0, cw, ch);
            const src = c.toDataURL('image/jpeg', quality);
            const ratio = ch / cw;
            const w = ratio > 0.6 ? Math.round(380 / ratio) : 380;
            const part = { id: newId(), type: 'picture', name: '', x: 0, y: 0, w, h: Math.round(w * ratio), src };
            part.x = Math.round((W - part.w) / 2);
            part.y = Math.round((H - part.h) / 2);
            board.parts.push(part);
            if (sizeOf(board) <= MAX_BYTES) {
                select(part.id);
                renderParts();
                renderInspector();
                commit();
                setTool('move');
                return note('התמונה על הלוח! אפשר להזיז אותה ולשנות את הגודל 🖼️');
            }
            board.parts.pop();
        }
        note('התמונה גדולה מדי בשביל הלוח. נסו תמונה אחרת או נקו ציור 🙂', true);
    }

    // ================= parts =================
    function uniqueName(type) {
        const base = TYPES[type].label;
        const used = new Set(board.parts.map(p => p.name));
        for (let n = 1; ; n++) {
            const name = base + ' ' + n;
            if (!used.has(name)) return name;
        }
    }

    // A new part goes where no other part is, so it never hides one that is already on the board
    function freeSpot(w, h) {
        const others = board.parts.filter(p => p.type !== 'picture');
        for (let y = 30; y + h <= H - 30; y += 30) {
            for (let x = 30; x + w <= W - 30; x += 30) {
                const free = others.every(o => x + w + 20 <= o.x || o.x + o.w + 20 <= x || y + h + 30 <= o.y || o.y + o.h + 30 <= y);
                if (free) return { x, y };
            }
        }
        return null;
    }

    function addPart(type) {
        if (mode !== 'edit') return;
        if (partsOf(type).length >= MAX_PARTS || board.parts.filter(p => p.type !== 'picture').length >= MAX_PARTS) {
            return note('יש כבר ' + MAX_PARTS + ' חלקים בלוח. מחקו חלק כדי להוסיף.', true);
        }
        const info = TYPES[type];
        const n = board.parts.length;
        const part = { id: newId(), type, name: type === 'label' ? 'הכיתוב שלי' : uniqueName(type), w: info.w, h: info.h, x: 0, y: 0 };
        const spot = freeSpot(part.w, part.h);
        part.x = spot ? spot.x : clamp(Math.round((W - part.w) / 2 + (n % 5) * 30 - 60), 0, W - part.w);
        part.y = spot ? spot.y : clamp(Math.round((H - part.h) / 2 + (n % 5) * 24 - 48), 0, H - part.h);
        if (COLORED.includes(type)) part.color = info.color;
        if (type === 'key') part.key = '';
        if (sizeOf({ ...board, parts: [...board.parts, part] }) > MAX_BYTES) return note('הלוח התמלא! נקו קצת כדי להוסיף חלק 🧹', true);
        board.parts.push(part);
        setTool('move');
        select(part.id);
        renderParts();
        renderInspector();
        renderStories();
        commit();
        note('הוספתם ' + info.label + '! גררו אותו למקום שבא לכם 👆');
    }

    function removePart(id) {
        const p = partById(id);
        if (!p) return;
        const h0 = storyHost();
        const usedByPage = !!(h0 && h0.usesPart && h0.usesPart(id));
        const used = usedByPage || board.stories.some(s => s.part === id || s.actions.some(a => a.part === id));
        if (used && !confirm('"' + (p.name || TYPES[p.type]?.label || 'התמונה') + '" משמש בסיפור. למחוק אותו בכל זאת?')) return;
        board.parts = board.parts.filter(x => x.id !== id);
        // A story that starts from this part goes away, and the blocks that used it are taken out of the other stories
        board.stories = board.stories.filter(s => s.part !== id);
        board.stories.forEach(s => { s.actions = s.actions.filter(a => a.part !== id); });
        selectedStory = Math.min(selectedStory, board.stories.length - 1);
        if (picker === id) picker = null;
        selectedId = null;
        renderParts();
        renderInspector();
        commit();
        const h = storyHost();
        if (h && h.removePartRefs) h.removePartRefs(id);
        storiesChanged();
    }

    function select(id) {
        selectedId = id;
        parts.forEach((e, key) => e.classList.toggle('sel', key === id));
        renderInspector();
    }

    function setGeom(e, p) {
        e.style.left = (p.x / W * 100) + '%';
        e.style.top = (p.y / H * 100) + '%';
        e.style.width = (p.w / W * 100) + '%';
        e.style.height = (p.h / H * 100) + '%';
        e.style.setProperty('--pw', (p.w / W * 100) + 'cqw');
        e.style.setProperty('--ph', (p.h / W * 100) + 'cqw');
    }

    function renderParts() {
        picsLayer.innerHTML = '';
        partsLayer.innerHTML = '';
        parts.clear();
        board.parts.forEach(p => {
            const e = buildPart(p);
            parts.set(p.id, e);
            (p.type === 'picture' ? picsLayer : partsLayer).appendChild(e);
            updatePart(p);
        });
        if (selectedId && !parts.has(selectedId)) selectedId = null;
        parts.forEach((e, key) => e.classList.toggle('sel', key === selectedId));
    }

    function partLabel(p) {
        return p.type === 'picture' ? 'תמונה' : (p.name || TYPES[p.type].label);
    }

    function buildPart(p) {
        const e = el('div', 'bp bp-' + p.type);
        e.dataset.id = p.id;
        setGeom(e, p);
        if (p.color) e.style.setProperty('--c', p.color);

        let body;
        if (p.type === 'slider') {
            body = el('div', 'bp-body');
            const input = el('input');
            input.type = 'range';
            input.min = '0';
            input.max = '100';
            input.value = '50';
            input.setAttribute('aria-label', partLabel(p));
            let last = 0;
            input.addEventListener('input', () => {
                if (mode !== 'play') return;
                const now = Date.now();
                if (now - last < 120) return; // a moving slider starts the story a few times a second, not hundreds
                last = now;
                runEvent('slide', p.id);
            });
            body.appendChild(input);
        } else if (p.type === 'picture') {
            body = el('div', 'bp-body');
            const img = el('img');
            img.alt = '';
            img.src = p.src;
            body.appendChild(img);
        } else if (p.type === 'button' || p.type === 'key') {
            body = el('button', 'bp-body');
            body.type = 'button';
            const name = p.type === 'key' ? 'key' : 'press';
            // A press starts the story the moment a finger or mouse goes down, so it feels instant and a touch
            // screen never loses it. The keyboard (Enter or Space on the button) arrives as a click without a pointer.
            body.addEventListener('pointerdown', (e) => { if (mode === 'play' && e.isPrimary && e.button === 0) runEvent(name, p.id); });
            body.addEventListener('click', (e) => { if (mode === 'play' && e.detail === 0) runEvent(name, p.id); });
        } else {
            body = el('div', 'bp-body');
        }
        e.appendChild(body);
        if (p.type !== 'picture') e.appendChild(el('div', 'bp-name'));
        e.appendChild(el('div', 'bp-handle'));

        wirePart(e, p);
        return e;
    }

    // What a part shows right now: its name, the letter, the lamp, the number, the screen
    function updatePart(p) {
        const e = parts.get(p.id);
        if (!e) return;
        const body = e.querySelector('.bp-body');
        const name = e.querySelector('.bp-name');
        if (name) name.textContent = p.name;
        if (p.color) e.style.setProperty('--c', p.color);
        e.setAttribute('aria-label', partLabel(p));
        if (body && body.tagName === 'BUTTON') body.tabIndex = mode === 'edit' ? -1 : 0;
        if (mode === 'edit') { e.tabIndex = 0; e.setAttribute('role', 'group'); } else { e.removeAttribute('tabindex'); e.removeAttribute('role'); }
        switch (p.type) {
            case 'button':
                body.textContent = p.name;
                break;
            case 'key':
                body.textContent = p.key || '?';
                body.classList.toggle('empty', !p.key);
                body.setAttribute('aria-label', 'מקש ' + (p.key || p.name));
                break;
            case 'lamp':
                e.classList.toggle('on', !!play.lamps[p.id]);
                break;
            case 'counter':
                body.textContent = String(play.counters[p.id] || 0);
                break;
            case 'label':
                body.textContent = p.name;
                break;
            case 'screen': {
                const state = play.screens[p.id];
                body.classList.toggle('word', !!(state && state.word));
                body.textContent = !state ? '' : state.word ? state.word : state.emoji;
                break;
            }
            default:
        }
    }

    // Moving and resizing a part (edit mode), and the arrow keys
    function wirePart(e, p) {
        e.addEventListener('pointerdown', (ev) => {
            if (mode !== 'edit' || tool !== 'move' || ev.button > 0) return;
            const onHandle = ev.target.classList.contains('bp-handle');
            ev.preventDefault();
            select(p.id);
            e.setPointerCapture(ev.pointerId);
            const start = unitsAt(ev);
            const orig = { x: p.x, y: p.y, w: p.w, h: p.h };
            const ratio = p.h / p.w;
            const move = (m) => {
                const u = unitsAt(m);
                if (onHandle) {
                    const maxW = Math.min(W - p.x, (H - p.y) / ratio);
                    p.w = clamp(orig.w + (u.x - start.x), 60, maxW);
                    p.h = p.w * ratio;
                } else {
                    p.x = clamp(orig.x + u.x - start.x, 0, W - p.w);
                    p.y = clamp(orig.y + u.y - start.y, 0, H - p.h);
                }
                setGeom(e, p);
            };
            const up = () => {
                e.removeEventListener('pointermove', move);
                e.removeEventListener('pointerup', up);
                e.removeEventListener('pointercancel', up);
                roundGeom(p);
                setGeom(e, p);
                commit();
            };
            e.addEventListener('pointermove', move);
            e.addEventListener('pointerup', up);
            e.addEventListener('pointercancel', up);
        });
        e.addEventListener('keydown', (ev) => {
            if (mode !== 'edit' || ev.target !== e) return;
            const step = ev.shiftKey ? 40 : 10;
            const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            if (moves[ev.key]) {
                ev.preventDefault();
                select(p.id);
                p.x = clamp(p.x + moves[ev.key][0], 0, W - p.w);
                p.y = clamp(p.y + moves[ev.key][1], 0, H - p.h);
                roundGeom(p);
                setGeom(e, p);
                commit();
            } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
                ev.preventDefault();
                removePart(p.id);
            } else if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault();
                select(p.id);
            }
        });
        e.addEventListener('focus', () => { if (mode === 'edit' && selectedId !== p.id) select(p.id); });
    }

    function roundGeom(p) {
        p.x = Math.round(p.x);
        p.y = Math.round(p.y);
        p.w = Math.round(p.w);
        p.h = Math.round(p.h);
    }

    function resizePart(p, factor) {
        const w = clamp(Math.round(p.w * factor), 60, W);
        const ratio = p.h / p.w;
        let h = Math.round(w * ratio);
        let nw = w;
        if (h > H) { h = H; nw = Math.round(H / ratio); }
        p.w = nw;
        p.h = h;
        p.x = clamp(p.x, 0, W - p.w);
        p.y = clamp(p.y, 0, H - p.h);
        setGeom(parts.get(p.id), p);
        commit();
    }

    // The settings of the chosen part: name, letter, colour, size, delete
    function renderInspector() {
        inspectorBox.innerHTML = '';
        const p = partById(selectedId);
        inspectorBox.hidden = mode !== 'edit' || !p;
        if (inspectorBox.hidden) return;

        const info = p.type === 'picture' ? { emoji: '🖼️', label: 'תמונה' } : TYPES[p.type];
        inspectorBox.appendChild(el('h3', '', info.emoji + ' ' + info.label));

        if (p.type !== 'picture') {
            const f = el('div', 'bd-field');
            const lab = el('label', '', p.type === 'label' ? 'מה כתוב?' : 'שם:');
            lab.htmlFor = 'bdName';
            const input = el('input');
            input.type = 'text';
            input.id = 'bdName';
            input.maxLength = p.type === 'label' ? 30 : 16;
            input.value = p.name;
            input.addEventListener('input', () => {
                p.name = input.value;
                updatePart(p);
                renderStories();
                commit();
            });
            f.append(lab, input);
            inspectorBox.appendChild(f);
        }

        if (p.type === 'key') {
            const f = el('div', 'bd-field');
            const lab = el('label', '', 'האות:');
            lab.htmlFor = 'bdLetter';
            const input = el('input', 'letter-in');
            input.type = 'text';
            input.id = 'bdLetter';
            input.maxLength = 1;
            input.value = p.key || '';
            input.setAttribute('autocomplete', 'off');
            input.addEventListener('input', () => {
                p.key = input.value.trim().slice(0, 1);
                input.value = p.key;
                updatePart(p);
                renderStories();
                commit();
            });
            f.append(lab, input, el('p', 'bd-help', 'לוחצים על האות הזו במקלדת כשמשחקים.'));
            inspectorBox.appendChild(f);
        }

        if (COLORED.includes(p.type)) {
            const f = el('div', 'bd-field');
            f.appendChild(el('label', '', 'צבע:'));
            (p.type === 'label' ? COLORS.slice(0, 9) : PART_COLORS.concat(['#2B2433'])).forEach((c) => {
                const s = el('button', 'bd-swatch');
                s.type = 'button';
                s.style.background = c;
                s.setAttribute('aria-label', 'צבע ' + (COLOR_NAMES[COLORS.indexOf(c)] || c));
                s.setAttribute('aria-pressed', String(p.color === c));
                s.addEventListener('click', () => {
                    p.color = c;
                    updatePart(p);
                    f.querySelectorAll('.bd-swatch').forEach(x => x.setAttribute('aria-pressed', String(x === s)));
                    commit();
                });
                f.appendChild(s);
            });
            inspectorBox.appendChild(f);
        }

        const size = el('div', 'bd-field');
        size.appendChild(el('label', '', 'גודל:'));
        size.append(button('bd-btn', '➖ קטן', () => resizePart(p, 0.87)), button('bd-btn', '➕ גדול', () => resizePart(p, 1.15)));
        inspectorBox.appendChild(size);

        const del = el('div', 'bd-field');
        del.appendChild(button('bd-btn danger', '🗑️ למחוק את החלק', () => removePart(p.id)));
        inspectorBox.appendChild(del);
    }

    // ================= playing =================
    // The page holds the link to the micro:bit only while the board is playing
    function linkCall(name) {
        try {
            const link = host && host.link;
            if (link && link[name]) link[name]();
        } catch (e) {
            // the link is only an extra: the board plays without it
        }
    }

    function startPlay() {
        play.active = true;
        play.gen++;
        play.lamps = {};
        play.counters = {};
        play.screens = {};
        play.busy.clear();
        if (!play.keysOn) {
            document.addEventListener('keydown', onKey);
            document.addEventListener('keyup', onKeyUp);
            play.keysOn = true;
        }
    }

    function stopPlay() {
        if (play.active) {
            play.active = false;
            linkCall('stop');
        }
        play.gen++;
        play.busy.clear();
        if (play.keysOn) {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('keyup', onKeyUp);
            play.keysOn = false;
        }
    }

    function typingInField(t) {
        return !!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable));
    }

    function onKey(e) {
        if (mode !== 'play' || !visible || e.repeat || e.ctrlKey || e.altKey || e.metaKey || typingInField(e.target)) return;
        const pressed = String(e.key || '').toLowerCase();
        if (pressed.length !== 1) return;
        partsOf('key').filter(p => p.key && p.key.toLowerCase() === pressed).forEach(p => {
            const node = parts.get(p.id);
            if (node) node.classList.add('down');
            runEvent('key', p.id);
        });
    }

    function onKeyUp() {
        parts.forEach(node => node.classList.remove('down'));
    }

    function runEvent(event, partId) {
        if (mode !== 'play') return;
        board.stories.forEach(s => {
            if (s.event === event && s.part === partId) runList(s, s.actions);
        });
    }

    // The micro:bit said that something happened (it started, A, B, a shake ...). The stories of the page with that event
    // have blocks of the board: the board runs those, in order, with the waits between them. The micro:bit's own
    // blocks are not the board's to run. For a key of the remote, the key tells which story.
    function runMicrobitEvent(name, key) {
        if (mode !== 'play') return;
        sharedScripts().filter(sc => sc.event === name && (name !== 'remote' || sc.key === key)).forEach(sc => {
            const mine = sc.actions.filter(a => a.do === 'wait' || BOARD_DO.includes(a.do));
            if (mine.some(a => BOARD_DO.includes(a.do))) runList(sc, mine);
        });
    }

    function sharedScripts() {
        const h = storyHost();
        try {
            const list = h && h.getScripts ? h.getScripts() : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    // A list of blocks does them one after the other. One that is still running is not started again.
    async function runList(key, actions) {
        if (play.busy.has(key)) return;
        play.busy.add(key);
        const gen = play.gen;
        try {
            for (const a of actions) {
                if (gen !== play.gen) return;
                if (a.do === 'wait') {
                    await sleep(a.seconds * 1000);
                    continue;
                }
                doAction(a);
            }
        } finally {
            play.busy.delete(key);
        }
    }

    function doAction(a) {
        const p = partById(a.part);
        switch (a.do) {
            case 'bLampOn': play.lamps[a.part] = true; break;
            case 'bLampOff': play.lamps[a.part] = false; break;
            case 'bAdd': play.counters[a.part] = Math.min(MAX_COUNT, (play.counters[a.part] || 0) + (a.n || 1)); break;
            case 'bReset': play.counters[a.part] = 0; break;
            case 'bShow': {
                const pic = PICTURES.find(x => x.icon === a.icon);
                if (pic) play.screens[a.part] = { emoji: pic.emoji, icon: pic.icon };
                break;
            }
            case 'bWord': {
                const w = WORDS.find(x => x.word === a.word);
                if (w) play.screens[a.part] = { word: w.text, mb: w.word };
                break;
            }
            case 'bBlank': delete play.screens[a.part]; break;
            case 'show':
            case 'text':
            case 'draw':
            case 'clear':
                // A block of the micro:bit in a story of the board: the page's link shows it on the micro:bit
                try {
                    if (api.onMicrobitOutput) api.onMicrobitOutput(a);
                } catch (e) {
                    // the link to the micro:bit must never stop the board
                }
                return;
            default: return;
        }
        if (p) updatePart(p);
        if (p && p.type === 'screen' && api.onScreenChange) {
            try { api.onScreenChange(p.id, play.screens[p.id] || null); } catch (e) { /* the link to the micro:bit must never stop the board */ }
        }
    }

    // The A and B stories start only from the buttons of the real micro:bit (the desktop link calls microbitButton).
    // There are no A and B on the screen. While playing, a story that waits for them says so in a friendly way.
    // What the child is told while playing, when the stories need the micro:bit. Nothing is a scary error: it says what to do.
    const LINK_NOTES = {
        extension: '🔌 כדי שהמיקרוביט יפעיל את הלוח צריך את התוסף של Kidlearn בכרום. בקשו עזרה מהורה 🙋',
        app: '🔌 פתחו את Kidlearn במחשב 🖥️ (האייקון ליד השעון), והמיקרוביט יוכל להפעיל את הלוח.',
        cable: '🔌 חברו את המיקרוביט בכבל. זה נבדק לבד, ואפשר להמשיך לשחק בינתיים.',
        busy: '🔌 הכבל של המיקרוביט תפוס בתוכנה אחרת, למשל עורך Python בדפדפן. סגרו אותה ונסו שוב.',
        update: '🔌 צריך לעדכן את Kidlearn במחשב: פתחו את ההתקנה מחדש.',
        other: '🔌 המיקרוביט לא הצליח להתחבר. נתקו וחברו שוב את הכבל.',
        sending: '🔌 שולחים תוכנית למיקרוביט... כשזה נגמר, הלוח מתחבר לבד. לא לנתק את הכבל!',
        slow: '🔌 זה לוקח יותר זמן מהרגיל. נתקו וחברו שוב את הכבל, ואם זה לא עוזר, שלחו שוב את התוכנית למיקרוביט.',
    };

    function renderPlayExtra() {
        playExtra.innerHTML = '';
        const uses = sharedScripts().some(sc => sc.actions.some(a => BOARD_DO.includes(a.do)))
            || board.stories.some(st => st.actions.some(a => MB_DO.includes(a.do)));
        playExtra.hidden = !(mode === 'play' && uses);
        if (playExtra.hidden) return;
        playExtra.appendChild(el('p', 'bd-mb-note', microbitLinked
            ? '🔌 המיקרוביט מחובר! כשקורה בו משהו (מתחיל, A או B, ניעור...), הוא מפעיל את הלוח. אם הלוח לא זז, שלחו למיקרוביט את התוכנית ("שלחו!") ונסו שוב.'
            : (LINK_NOTES[linkReason] || '🔌 מחברים את המיקרוביט ללוח...')));
    }

    // ================= the stories of the board =================
    function storyInfo(s) {
        const p = partById(s.part);
        switch (s.event) {
            case 'press': return { mark: '👆', label: 'כשלוחצים על ' + (p ? p.name : '') };
            case 'slide': return { mark: '↔️', label: 'כשמזיזים את ' + (p ? p.name : '') };
            default: return { mark: '⌨️', label: p && p.key ? 'כשלוחצים על האות ' + p.key.toUpperCase() : 'כשלוחצים על ' + (p ? p.name : '') };
        }
    }

    function actionInfo(a) {
        const p = partById(a.part);
        const name = p ? p.name : '';
        switch (a.do) {
            case 'bLampOn': return { emoji: '💡', label: 'הדליקו ' + name };
            case 'bLampOff': return { emoji: '🌑', label: 'כבו ' + name };
            case 'bAdd': return { emoji: '➕', label: 'הוסיפו ל' + name };
            case 'bReset': return { emoji: '0️⃣', label: 'אפסו את ' + name };
            case 'bShow': {
                const pic = PICTURES.find(x => x.icon === a.icon);
                return { emoji: pic ? pic.emoji : '?', label: (pic ? pic.label : '') + ' על ' + name };
            }
            case 'bWord': {
                const w = WORDS.find(x => x.word === a.word);
                return { emoji: '🔤', label: '"' + (w ? w.text : '') + '" על ' + name };
            }
            case 'bBlank': return { emoji: '🧹', label: 'נקו את ' + name };
            case 'show': {
                const pic = PICTURES.find(x => x.icon === a.icon);
                return { emoji: pic ? pic.emoji : '?', label: 'במיקרוביט: ' + (pic ? pic.label : '') };
            }
            case 'text': {
                const w = WORDS.find(x => x.word === a.word);
                return { emoji: '🔤', label: 'במיקרוביט: "' + (w ? w.text : a.word) + '"' };
            }
            case 'draw': return { emoji: '🎨', label: 'במיקרוביט: ציור שלי' };
            case 'clear': return { emoji: '🧹', label: 'ניקוי המיקרוביט' };
            default: {
                const w = WAITS.find(x => x.seconds === a.seconds);
                return { emoji: w ? w.emoji : '⏳', label: 'חכו ' + (w ? w.label : '') };
            }
        }
    }

    // The stories are built in the page's own three columns (when / then / what it does), next to the stories of the
    // micro:bit. The page gives the board its places: host.stories = { when, list, then, does, onSelect, openStories, tryBoard }.
    // A board story and a micro:bit story are never chosen together; the page keeps that.
    let storyMsg = '';                // a friendly message about the story that is being built

    function storyHost() {
        return host && host.stories;
    }

    // The chosen story, or the list of stories, changed: the page draws its columns again (and calls renderStories)
    function storiesChanged() {
        const h = storyHost();
        if (h && h.onSelect) h.onSelect();
        else renderStories();
    }

    function selectStory(i) {
        selectedStory = i;
        storyMsg = '';
        picker = null;
        storiesChanged();
    }

    function addStory(event, partId) {
        if (board.stories.length >= MAX_STORIES) {
            storyMsg = 'יש כבר ' + MAX_STORIES + ' סיפורים בלוח. מחקו אחד כדי להוסיף.';
            return renderStories();
        }
        board.stories.push(partId ? { event, part: partId, actions: [] } : { event, actions: [] });
        commit();
        selectStory(board.stories.length - 1);
    }

    function addAction(action) {
        const s = board.stories[selectedStory];
        const refuse = (text) => { storyMsg = text; renderStories(); return false; };
        if (!s) {
            // A story of the page (when it starts, A, B) is chosen: the block goes there, and the page checks the limits
            const h = storyHost();
            if (action && h && h.addToScript && h.sharedTarget && h.sharedTarget()) return h.addToScript(action);
            return refuse('קודם לחצו על "מתי?" כדי לבחור מתי זה יקרה 👆');
        }
        if (s.actions.length >= MAX_ACTIONS) return refuse('יש כבר ' + MAX_ACTIONS + ' בלוקים בסיפור הזה. מחקו אחד כדי להוסיף.');
        if (sizeOf({ ...board, stories: board.stories }) + 80 > MAX_BYTES) return refuse('הלוח התמלא! נקו קצת כדי להוסיף עוד.');
        storyMsg = '';
        s.actions.push(action);
        renderStories();
        commit();
        return true;
    }

    function tile(emoji, label, onClick, extra) {
        const b = el('button', 'tile ' + (extra || ''));
        b.type = 'button';
        b.innerHTML = '<span class="emoji" aria-hidden="true"></span><span class="label"></span>';
        b.firstChild.textContent = emoji;
        b.lastChild.textContent = label;
        b.setAttribute('aria-label', label);
        b.addEventListener('click', onClick);
        return b;
    }

    function renderStories() {
        const h = storyHost();
        if (!h) return;
        const { when, list, then, does } = h;
        [when, list, then, does].forEach(c => { c.innerHTML = ''; });

        // 1: when
        const addWhen = (mark, label, event, partId) => {
            const b = el('button', 'when-btn');
            b.type = 'button';
            b.dataset.event = event;
            const m = el('span', mark === 'A' || mark === 'B' ? 'letter' : 'mark', mark);
            m.setAttribute('aria-hidden', 'true');
            b.append(m, el('span', '', label));
            b.disabled = board.stories.length >= MAX_STORIES;
            b.addEventListener('click', () => addStory(event, partId));
            when.appendChild(b);
        };
        // Start, A and B are the page's own "when" blocks: a story of those can hold the board's blocks too
        partsOf('button').forEach(p => addWhen('👆', 'כשלוחצים על ' + p.name, 'press', p.id));
        partsOf('slider').forEach(p => addWhen('↔️', 'כשמזיזים את ' + p.name, 'slide', p.id));
        partsOf('key').forEach(p => addWhen('⌨️', p.key ? 'כשלוחצים על האות ' + p.key.toUpperCase() : 'כשלוחצים על ' + p.name, 'key', p.id));
        if (!partsOf('button').length && !partsOf('slider').length && !partsOf('key').length) {
            when.appendChild(el('p', 'hint', 'הוסיפו כפתור, סרגל או מקש בלשונית "הלוח שלי", והם יופיעו כאן 🖼️'));
        }
        if (h.tryBoard) when.appendChild(button('btn btn-ghost bd-try', '▶️ לנסות בלוח', () => h.tryBoard()));

        // the board's stories, in the list of stories
        board.stories.forEach((s, i) => {
            const info = storyInfo(s);
            const li = el('li', 'script board-story' + (i === selectedStory ? ' selected' : ''));
            const pick = el('button', 'script-pick');
            pick.type = 'button';
            pick.setAttribute('aria-pressed', String(i === selectedStory));
            const m = el('span', info.mark === 'A' || info.mark === 'B' ? 'letter' : 'mark', info.mark);
            m.setAttribute('aria-hidden', 'true');
            const where = el('span', 'script-count', '🖼️');
            where.setAttribute('aria-hidden', 'true');
            pick.append(m, el('span', 'script-label', info.label), where, el('span', 'script-count', s.actions.length + '/' + MAX_ACTIONS));
            pick.addEventListener('click', () => selectStory(i));
            const del = el('button', 'script-del', '✖');
            del.type = 'button';
            del.setAttribute('aria-label', 'מחיקת הסיפור ' + info.label);
            del.addEventListener('click', () => {
                if (s.actions.length > 0 && !confirm('למחוק את הסיפור "' + info.label + '"?')) return;
                const wasChosen = i === selectedStory;
                board.stories.splice(i, 1);
                if (wasChosen) selectedStory = board.stories.length ? Math.min(i, board.stories.length - 1) : -1;
                else if (i < selectedStory) selectedStory--;
                picker = null;
                commit();
                storiesChanged();
            });
            li.append(pick, del);
            list.appendChild(li);
        });

        // 2: then. A board story gets the board's blocks. A story of the page gets them when the board can hear it
        // (when it starts, A, B); for any other story a friendly line says where they work.
        const own = selectedStory >= 0 && !!board.stories[selectedStory];
        const shared = !own && !!(h.sharedTarget && h.sharedTarget());
        if (!own && !shared) {
            then.appendChild(el('h3', '', '🖼️ הלוח שלי'));
            then.appendChild(el('p', 'hint', 'בחרו קודם "מתי?", ואז יופיעו כאן הבלוקים של הלוח 🖼️'));
        } else if (shared) {
            then.appendChild(el('h3', '', '🖼️ הלוח שלי'));
        }
        let any = false;
        const tiles = el('div', 'tiles bd-tiles');
        partsOf('lamp').forEach(p => {
            any = true;
            tiles.append(tile('💡', 'הדליקו ' + p.name, () => addAction({ do: 'bLampOn', part: p.id })),
                tile('🌑', 'כבו ' + p.name, () => addAction({ do: 'bLampOff', part: p.id })));
        });
        partsOf('counter').forEach(p => {
            any = true;
            tiles.append(tile('➕', 'הוסיפו ל' + p.name, () => addAction({ do: 'bAdd', part: p.id, n: 1 })),
                tile('0️⃣', 'אפסו את ' + p.name, () => addAction({ do: 'bReset', part: p.id })));
        });
        partsOf('screen').forEach(p => {
            any = true;
            tiles.append(tile('🖥️', 'הציגו על ' + p.name, () => {
                if (!own && !shared) return addAction(null);
                picker = picker === p.id ? null : p.id;
                renderStories();
            }, 'word'));
        });
        if (own || shared) {
            if (any) then.appendChild(tiles);
            else then.appendChild(el('p', 'hint', 'הוסיפו נורה, מספר או מסך בלשונית "הלוח שלי", והבלוקים שלהם יופיעו כאן 🖼️'));
        }
        const screen = partById(picker);
        const choose = (action) => {
            if (addAction(action)) {
                picker = null;
                renderStories();
            }
        };
        if ((own || shared) && screen && screen.type === 'screen') {
            const box = el('div', 'bd-picker');
            box.appendChild(el('p', 'drawer-title', 'מה להציג על ' + screen.name + '?'));
            const pics = el('div', 'tiles');
            PICTURES.forEach(pic => pics.appendChild(tile(pic.emoji, pic.label, () => choose({ do: 'bShow', part: screen.id, icon: pic.icon }))));
            box.appendChild(pics);
            const words = el('div', 'tiles');
            WORDS.forEach(w => words.appendChild(tile('🔤', w.text, () => choose({ do: 'bWord', part: screen.id, word: w.word }), 'word')));
            words.appendChild(tile('🧹', 'לנקות', () => choose({ do: 'bBlank', part: screen.id }), 'wait'));
            box.appendChild(words);
            then.appendChild(box);
        }


        // 3: what it does
        const s = board.stories[selectedStory];
        does.appendChild(el('p', 'script-title', s ? 'הסיפור: ' + storyInfo(s).label : 'עדיין לא נבחר סיפור.'));
        const seq = el('ol', 'sequence');
        (s ? s.actions : []).forEach((a, i) => {
            const info = actionInfo(a);
            const li = el('li');
            const num = el('span', 'num', String(i + 1));
            const emoji = el('span', 'emoji', info.emoji);
            emoji.setAttribute('aria-hidden', 'true');
            const remove = el('button', 'remove', '✖');
            remove.type = 'button';
            remove.setAttribute('aria-label', 'מחיקת הבלוק ' + info.label);
            remove.addEventListener('click', () => { s.actions.splice(i, 1); storyMsg = ''; renderStories(); commit(); });
            li.append(num, emoji, el('span', 'label', info.label), remove);
            seq.appendChild(li);
        });
        does.appendChild(seq);
        const hint = el('p', 'hint' + (storyMsg ? ' bd-warn' : ''), storyMsg || (!s ? 'קודם לחצו על "מתי?", ואז בחרו בלוקים.'
            : s.actions.length === 0 ? 'לחצו על בלוק כדי להוסיף אותו 🙂'
            : 'הדברים יקרו לפי הסדר, מלמעלה למטה. לחצו "לנסות בלוח" כדי לשחק ▶️'));
        does.appendChild(hint);
        if (s && s.actions.length) {
            does.appendChild(button('link', '🧹 נקו את הסיפור', () => { s.actions = []; storyMsg = ''; renderStories(); commit(); }));
        }
    }

    // ================= the page talks to the board through this =================
    function load() {
        board = cleanBoard(host.get());
        history = [];
        selectedId = null;
        selectedStory = -1;           // the page decides which story is chosen when a program opens
        storyMsg = '';
        picker = null;
    }

    function renderAll() {
        redraw();
        renderParts();
        renderInspector();
        renderStories();
        renderPlayExtra();
        syncTools();
        refreshEmptyHint();
    }

    const api = {
        // The board's own start: builds the page inside host.root
        init(h) {
            host = h;
            root = h.root;
            load();
            build();
            setMode('edit');
            renderAll();
        },
        // The program that is open changed (opened, new): show its board
        reload() {
            if (!root) return;
            stopPlay();
            load();
            setMode('edit');
            renderAll();
        },
        // The tab is shown or hidden
        setVisible(on) {
            visible = on;
            if (!root) return;
            if (on) {
                sizeCanvas();
                redraw();
            } else {
                setMode('edit');
            }
        },
        // The page asks to add one of the micro:bit's own output blocks to the chosen story of the board
        addMicrobitAction(a) {
            const clean = cleanMbAction(a) || (a && a.do === 'wait' && WAITS.some(w => w.seconds === a.seconds) ? { do: 'wait', seconds: a.seconds } : null);
            return clean ? addAction(clean) : false;
        },
        // The stories of the board, drawn by the page into its own columns
        renderStories,
        hasSelection() {
            return selectedStory >= 0 && !!board.stories[selectedStory];
        },
        // The page chose a micro:bit story: no board story is chosen. The page draws its columns afterwards.
        deselect() {
            selectedStory = -1;
            picker = null;
        },
        storyCount() {
            return board.stories.length;
        },
        // For the page: how a block of the board is shown in a story, and whether a part is still on the board
        describeAction(a) {
            return actionInfo(a);
        },
        hasPart(id) {
            return !!partById(id);
        },
        // The stories of the page changed (a block of the board was added or taken out): the note about A and B follows
        refresh() {
            if (root) renderPlayExtra();
        },
        // True while the board is in the "play" mode (the page restarts the link after a send)
        isPlaying() {
            return !!root && mode === 'play';
        },
        // Start playing (the page shows the board tab first)
        play() {
            if (root) setMode('play');
        },
        // The micro:bit said that something happened (the desktop link calls this): the page's name for the event
        // ('start', 'buttonA', 'buttonB', 'abPress', 'shake', 'faceDown', 'tiltLeft', 'tiltRight', 'tiltForward',
        // 'tiltBack', 'logoTouch', or 'remote' with the key). Nothing on the screen starts these.
        microbitEvent(name, key) {
            runMicrobitEvent(String(name), key);
        },
        microbitStart() {
            runMicrobitEvent('start');
        },
        microbitButton(name) {
            if (name === 'A' || name === 'B') runMicrobitEvent('button' + name);
        },
        // The page's link tells the board whether a real micro:bit is linked, and when not, why
        // ('extension', 'app', 'cable', 'busy', 'update', 'sending', 'slow', 'other')
        setMicrobitLinked(on, reason) {
            microbitLinked = !!on;
            linkReason = on ? '' : String(reason || '');
            if (root) renderPlayExtra();
        },
        // The link to the micro:bit sets this to follow what the screens of the board show: (partId, state | null)
        onScreenChange: null,
        // ... and this to show the micro:bit's own output blocks of a story of the board on the micro:bit: (the block)
        onMicrobitOutput: null,
        // For checks: the board as it is now
        snapshot() {
            return JSON.parse(JSON.stringify(board));
        },
    };

    window.MyBoard = api;
})();
