// The board: a picture the child draws, with buttons, sliders, keys, lamps and numbers on it.
// It is part of the programming page. The page reads it through window.KidlearnBoard, and it runs the
// scripts that start with a board button, slider or key (see index.html). Nothing here is sent to the micro:bit.
(function () {
    const LAYOUT_KEY = 'kidlearn-panel-layout';
    const DB_NAME = 'kidlearn-panel';
    const FILES = 'files';
    const BOARD_W = 960;
    const BOARD_H = 560;
    const IMAGE_MAX = 800; // pixels: bigger pictures are made smaller before they are saved
    const SIZE_FACTOR = { s: 0.7, m: 1, l: 1.4 };

    const DEFAULTS = {
        button: { w: 180, h: 70, label: 'לחצו' },
        slider: { w: 240, h: 80, label: 'סרגל' },
        key: { w: 120, h: 120, label: 'אות', key: '' },
        lamp: { w: 120, h: 120, label: 'נורה' },
        number: { w: 180, h: 110, label: 'מספר' },
        label: { w: 240, h: 60, label: 'שם' },
        image: { w: 300, h: 220 },
        screen: { w: 240, h: 240, label: '' },
    };
    const INPUT_TYPES = ['button', 'slider', 'key'];
    const OUTPUT_TYPES = ['lamp', 'number'];

    const $ = (id) => document.getElementById(id);
    const board = $('bdBoard');
    const drawCanvas = $('bdDraw');
    const ctx = drawCanvas.getContext('2d');

    let widgets = [];
    let selectedId = null;
    let mode = 'edit';          // 'draw' | 'edit' | 'play'
    let eraser = false;
    let awaitingKey = null;     // id of a key widget waiting for the next key press
    let liveOn = false;         // true while the micro:bit is connected
    const seenMb = {};          // 'mb:A' / 'mb:B' -> true once that button was pressed on the micro:bit (then it joins the list)
    const pressed = {};         // input id -> true while it is held down
    const lamps = {};           // lamp id -> on or off, set by the scripts
    const numbers = {};
    const screenFaces = {};     // screen id -> what it shows: { text, size }         // number id -> its count, changed by the scripts
    const imageUrls = {};       // picture id -> object URL, loaded from IndexedDB
    const inputListeners = [];
    const changeListeners = [];

    // ---- storage: the layout in localStorage, pictures and the drawing in IndexedDB ----
    function isWidget(w) {
        return w && typeof w.id === 'string' && INPUT_TYPES.concat(OUTPUT_TYPES, ['label', 'image', 'screen']).includes(w.type);
    }

    function loadLayout() {
        try {
            const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
            if (saved && Array.isArray(saved.widgets)) widgets = saved.widgets.filter(isWidget);
        } catch (e) {
            // a damaged layout is ignored: the board starts empty
        }
    }

    function saveLayout() {
        try {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify({ widgets }));
        } catch (e) {
            // storage is full or blocked: the layout lasts until the page is closed
        }
    }

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => req.result.createObjectStore(FILES);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function putFile(key, value) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(FILES, 'readwrite');
            tx.objectStore(FILES).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function getFile(key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const req = db.transaction(FILES, 'readonly').objectStore(FILES).get(key);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteFile(key) {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(FILES, 'readwrite');
            tx.objectStore(FILES).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function loadDrawing() {
        try {
            const blob = await getFile('drawing');
            if (blob) ctx.drawImage(await createImageBitmap(blob), 0, 0, BOARD_W, BOARD_H);
        } catch (e) {
            // no drawing saved yet, or storage blocked
        }
    }

    function saveDrawing() {
        drawCanvas.toBlob((blob) => {
            if (blob) putFile('drawing', blob).catch(() => {});
        }, 'image/png');
    }

    async function imageUrl(imageId) {
        if (!imageUrls[imageId]) {
            const blob = await getFile(imageId);
            if (!blob) return null;
            imageUrls[imageId] = URL.createObjectURL(blob);
        }
        return imageUrls[imageId];
    }

    // ---- drawing ----
    let drawing = false;
    let last = null;

    function canvasPoint(e) {
        const r = drawCanvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) * (BOARD_W / r.width), y: (e.clientY - r.top) * (BOARD_H / r.height) };
    }

    drawCanvas.addEventListener('pointerdown', (e) => {
        if (mode !== 'draw') return;
        drawing = true;
        last = canvasPoint(e);
        drawCanvas.setPointerCapture(e.pointerId);
    });
    drawCanvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const p = canvasPoint(e);
        ctx.globalCompositeOperation = eraser ? 'destination-out' : 'source-over';
        ctx.strokeStyle = $('bdPenColor').value;
        ctx.lineWidth = Number($('bdPenSize').value);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last = p;
    });
    function endStroke() {
        if (!drawing) return;
        drawing = false;
        saveDrawing();
    }
    drawCanvas.addEventListener('pointerup', endStroke);
    drawCanvas.addEventListener('pointercancel', endStroke);

    // ---- widgets ----
    function nextId() {
        return 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    // The first place on the board, from the top left, where a new widget does not cover another one
    function freeSpot(width, height) {
        const overlaps = (x, y) => widgets.some((o) => x < o.x + o.w && o.x < x + width && y < o.y + o.h && o.y < y + height);
        for (let y = 20; y + height <= BOARD_H; y += 40) {
            for (let x = 20; x + width <= BOARD_W; x += 40) {
                if (!overlaps(x, y)) return { x, y };
            }
        }
        return { x: 20, y: 20 };
    }

    function widgetById(id) {
        return widgets.find((w) => w.id === id) || null;
    }

    // What a child sees for an input: "when this happens"
    function triggerText(x) {
        if (x.type === 'mb') return 'כשלוחצים על ' + x.label + ' במיקרוביט';
        if (x.type === 'key') return x.key ? 'כשלוחצים על האות ' + x.key.toUpperCase() : 'כשלוחצים על אות (עוד לא נבחרה)';
        if (x.type === 'slider') return 'כשמזיזים ' + (x.label || 'את הסרגל');
        return 'כשלוחצים על ' + (x.label || 'הלחצן');
    }

    function addWidget(type, extra) {
        const base = DEFAULTS[type];
        const spot = freeSpot(extra.w || base.w, extra.h || base.h);
        const w = { id: nextId(), type, x: spot.x, y: spot.y, size: 'm', ...base, ...extra };
        if (type !== 'key') delete w.key;
        w.baseW = w.w;
        w.baseH = w.h;
        widgets.push(w);
        selectedId = w.id;
        saveLayout();
        render();
        emitChange();
        return w;
    }

    function emitChange() {
        changeListeners.forEach((fn) => fn());
    }

    function emitInput(w) {
        inputListeners.forEach((fn) => fn({ id: w.id, type: w.type }));
    }

    function render() {
        board.className = 'bd-board ' + mode;
        board.querySelectorAll('.bd-w').forEach((el) => el.remove());
        widgets.forEach((w) => board.appendChild(buildWidget(w)));
        renderProps();
        renderHint();
        refreshOutputs();
        refreshScreens();
    }

    function buildWidget(w) {
        const el = document.createElement('div');
        el.className = 'bd-w' + (w.id === selectedId ? ' selected' : '');
        el.dataset.id = w.id;
        el.style.left = w.x + 'px';
        el.style.top = w.y + 'px';
        el.style.width = w.w + 'px';
        el.style.height = w.h + 'px';

        if (w.type === 'button') {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'bd-btn';
            b.dataset.trigger = w.id;
            b.textContent = w.label;
            b.addEventListener('pointerdown', (e) => {
                if (mode !== 'play') return;
                e.stopPropagation();
                pressed[w.id] = true;
                b.classList.add('down');
                emitInput(w);
            });
            const up = () => {
                if (mode !== 'play') return;
                pressed[w.id] = false;
                b.classList.remove('down');
            };
            b.addEventListener('pointerup', up);
            b.addEventListener('pointerleave', up);
            b.addEventListener('pointercancel', up);
            el.appendChild(b);
        } else if (w.type === 'slider') {
            const box = document.createElement('label');
            box.className = 'bd-slider';
            const text = document.createElement('span');
            text.textContent = w.label;
            const range = document.createElement('input');
            range.type = 'range';
            range.min = '0';
            range.max = '100';
            range.value = '50';
            range.dataset.trigger = w.id;
            range.disabled = mode !== 'play';
            range.addEventListener('pointerdown', (e) => e.stopPropagation());
            range.addEventListener('change', () => emitInput(w));
            box.append(text, range);
            el.appendChild(box);
        } else if (w.type === 'key') {
            const box = document.createElement('div');
            box.className = 'bd-key';
            box.dataset.key = w.id;
            box.innerHTML = '<span></span><span class="bd-key-letter"></span>';
            box.firstChild.textContent = w.label;
            box.lastChild.textContent = w.key ? w.key.toUpperCase() : '?';
            el.appendChild(box);
        } else if (w.type === 'lamp') {
            const box = document.createElement('div');
            box.className = 'bd-lamp';
            box.dataset.lamp = w.id;
            box.innerHTML = '<span class="bd-bulb"></span><span></span>';
            box.lastChild.textContent = w.label;
            el.appendChild(box);
        } else if (w.type === 'number') {
            const box = document.createElement('div');
            box.className = 'bd-number';
            box.dataset.number = w.id;
            box.innerHTML = '<span></span><span class="bd-digits">0</span>';
            box.firstChild.textContent = w.label;
            el.appendChild(box);
        } else if (w.type === 'screen') {
            const box = document.createElement('div');
            box.className = 'bd-screen';
            box.dataset.screen = w.id;
            box.innerHTML = '<span class="bd-screen-face"></span>';
            el.appendChild(box);
        } else if (w.type === 'label') {
            const t = document.createElement('div');
            t.className = 'bd-text';
            t.textContent = w.label;
            el.appendChild(t);
        } else if (w.type === 'image') {
            const img = document.createElement('img');
            img.className = 'bd-image';
            img.alt = '';
            imageUrl(w.imageId).then((url) => { if (url) img.src = url; });
            el.appendChild(img);
        }

        // Dragging moves a widget only in the layout mode
        el.addEventListener('pointerdown', (e) => {
            if (mode !== 'edit') return;
            selectWidget(w.id);
            const start = { x: e.clientX, y: e.clientY, wx: w.x, wy: w.y };
            const move = (ev) => {
                w.x = Math.max(0, Math.min(BOARD_W - w.w, start.wx + ev.clientX - start.x));
                w.y = Math.max(0, Math.min(BOARD_H - w.h, start.wy + ev.clientY - start.y));
                el.style.left = w.x + 'px';
                el.style.top = w.y + 'px';
            };
            const stop = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
                saveLayout();
            };
            window.addEventListener('pointermove', move);
            window.addEventListener('pointerup', stop);
        });
        return el;
    }

    // Lamps and numbers change with the scripts. Only their parts are updated, so buttons under the finger keep working.
    function refreshOutputs() {
        widgets.forEach((w) => {
            if (w.type === 'lamp') {
                const el = board.querySelector('[data-lamp="' + w.id + '"]');
                if (el) el.classList.toggle('on', !!lamps[w.id]);
            } else if (w.type === 'number') {
                const el = board.querySelector('[data-number="' + w.id + '"] .bd-digits');
                if (el) el.textContent = String(numbers[w.id] || 0);
            } else if (w.type === 'key') {
                const el = board.querySelector('[data-key="' + w.id + '"]');
                if (el) el.classList.toggle('down', !!pressed[w.id]);
            }
        });
    }

    // Selection changes in place: rebuilding the board here would detach the element that is being dragged
    function selectWidget(id) {
        selectedId = id;
        board.querySelectorAll('.bd-w').forEach((el) => el.classList.toggle('selected', el.dataset.id === id));
        renderProps();
    }

    // ---- the properties under the board ----
    function renderProps() {
        const w = widgetById(selectedId);
        $('bdPropsEmpty').hidden = !!w;
        $('bdProps').hidden = !w;
        if (!w) return;
        $('bdPropLabel').value = w.label || '';
        $('bdPropLabel').disabled = w.type === 'image';
        document.querySelectorAll('[data-bd-size]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bdSize === (w.size || 'm'))));
        $('bdKeyField').hidden = w.type !== 'key';
        if (awaitingKey === w.id) $('bdPickKey').textContent = 'לחצו על אות עכשיו…';
        else $('bdPickKey').textContent = w.key ? 'האות ' + w.key.toUpperCase() + ' - לשינוי לחצו' : 'לחצו על אות במקלדת';
    }

    function renderHint() {
        const texts = {
            draw: 'עכשיו אפשר לצייר עם העכבר ✏️',
            edit: 'גררו משהו כדי להזיז אותו ✋',
            play: 'לחצו על הכפתורים ועל הסרגל, או על האותיות במקלדת. הנורות נדלקות 💡',
        };
        $('bdHint').textContent = texts[mode];
    }

    function setMode(next) {
        mode = next;
        eraser = false;
        document.querySelectorAll('[data-bd-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bdMode === mode)));
        $('bdEraser').setAttribute('aria-pressed', 'false');
        render();
    }

    // ---- toolbar and properties ----
    document.querySelectorAll('[data-bd-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.bdMode)));
    document.querySelectorAll('[data-bd-add]').forEach((b) => b.addEventListener('click', () => {
        addWidget(b.dataset.bdAdd, {});
        setMode('edit');
    }));
    $('bdEraser').addEventListener('click', () => {
        if (mode !== 'draw') setMode('draw');
        eraser = !eraser;
        $('bdEraser').setAttribute('aria-pressed', String(eraser));
    });
    $('bdClear').addEventListener('click', () => {
        ctx.clearRect(0, 0, BOARD_W, BOARD_H);
        saveDrawing();
    });

    $('bdImage').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, IMAGE_MAX / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        const imageId = 'img' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await putFile(imageId, blob);
        const w = Math.min(420, canvas.width);
        addWidget('image', { imageId, w, h: Math.round(w * canvas.height / canvas.width), label: '' });
        setMode('edit');
    });

    $('bdPropLabel').addEventListener('input', () => {
        const w = widgetById(selectedId);
        if (!w) return;
        w.label = $('bdPropLabel').value.slice(0, 40);
        saveLayout();
        render();
        emitChange();
    });

    // Sizes are words for the child: small, medium, large. Each is a factor of the widget's first size.
    document.querySelectorAll('[data-bd-size]').forEach((b) => b.addEventListener('click', () => setSize(b.dataset.bdSize)));
    function setSize(size) {
        const w = widgetById(selectedId);
        if (!w) return;
        const f = SIZE_FACTOR[size];
        w.size = size;
        w.w = Math.min(BOARD_W, Math.round(w.baseW * f));
        w.h = Math.min(BOARD_H, Math.round(w.baseH * f));
        w.x = Math.max(0, Math.min(BOARD_W - w.w, w.x));
        w.y = Math.max(0, Math.min(BOARD_H - w.h, w.y));
        saveLayout();
        render();
    }

    $('bdPickKey').addEventListener('click', () => {
        awaitingKey = selectedId;
        render();
    });

    $('bdDelete').addEventListener('click', () => {
        widgets = widgets.filter((w) => w.id !== selectedId);
        delete pressed[selectedId];
        delete lamps[selectedId];
        delete numbers[selectedId];
        selectedId = null;
        saveLayout();
        render();
        emitChange();
    });

    // ---- keyboard: a key widget reacts to its key in the play mode ----
    function isTyping(e) {
        return e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
    }

    window.addEventListener('keydown', (e) => {
        if (isTyping(e)) return;
        const key = e.key.length === 1 ? e.key.toLowerCase() : '';
        if (awaitingKey) {
            const w = widgetById(awaitingKey);
            awaitingKey = null;
            if (w && /^[a-z0-9]$/.test(key)) {
                w.key = key;
                saveLayout();
                emitChange();
            }
            render();
            return;
        }
        if (mode !== 'play' || !key || e.repeat) return;
        widgets.filter((w) => w.type === 'key' && w.key === key).forEach((w) => {
            pressed[w.id] = true;
            refreshOutputs();
            emitInput(w);
        });
    });
    window.addEventListener('keyup', (e) => {
        if (mode !== 'play') return;
        const key = e.key.length === 1 ? e.key.toLowerCase() : '';
        widgets.filter((w) => w.type === 'key' && w.key === key).forEach((w) => {
            pressed[w.id] = false;
            refreshOutputs();
        });
    });

    // ---- a whole board as plain data, to keep with a program: widgets, the drawing and the pictures ----
    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
        });
    }

    async function exportState() {
        const images = {};
        for (const w of widgets) {
            if (w.type !== 'image') continue;
            const blob = await getFile(w.imageId);
            if (blob) images[w.imageId] = await blobToDataUrl(blob);
        }
        return { widgets: JSON.parse(JSON.stringify(widgets)), drawing: drawCanvas.toDataURL('image/png'), images };
    }

    async function importState(state) {
        const data = state || {};
        widgets = (Array.isArray(data.widgets) ? data.widgets : []).filter(isWidget);
        selectedId = null;
        for (const m of [pressed, lamps, numbers, screenFaces]) Object.keys(m).forEach((k) => delete m[k]);
        for (const [id, url] of Object.entries(data.images || {})) {
            await putFile(id, await (await fetch(url)).blob());
            delete imageUrls[id];
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, BOARD_W, BOARD_H);
        if (data.drawing) ctx.drawImage(await createImageBitmap(await (await fetch(data.drawing)).blob()), 0, 0, BOARD_W, BOARD_H);
        saveDrawing();
        saveLayout();
        render();
        emitChange();
    }

    // ---- the screen: what the scripts of the board show on it (a picture, a word, or a drawing) ----
    function firstScreen() {
        return widgets.find((w) => w.type === 'screen') || null;
    }

    function showOnScreen(text, size) {
        const s = firstScreen();
        if (!s) {
            $('bdHint').textContent = 'כדי לראות תמונות, שימו "מסך" על הלוח שלי.';
            return false;
        }
        screenFaces[s.id] = { text, size };
        refreshScreens();
        return true;
    }

    function refreshScreens() {
        board.querySelectorAll('[data-screen]').forEach((el) => {
            const face = screenFaces[el.dataset.screen] || { text: '', size: 90 };
            el.firstChild.textContent = face.text;
            el.firstChild.style.fontSize = face.size + 'px';
        });
    }

    // ---- what the page reads ----
    window.KidlearnBoard = {
        exportState,
        importState,
        clearState: () => importState({}),
        saveSnapshot: (id, state) => putFile('snapshot:' + id, state),
        loadSnapshot: (id) => getFile('snapshot:' + id),
        deleteSnapshot: (id) => deleteFile('snapshot:' + id),
        screenShow: (emoji) => showOnScreen(emoji, 90),
        screenText: (word) => showOnScreen(word, 56),
        screenPixels: (pixels) => showOnScreen(
            (String(pixels || '').match(/.{1,5}/g) || []).map((row) => row.split('').map((c) => (c === '1' ? '⬛' : '⬜')).join('')).join('\n'),
            34
        ),
        screenClear: () => showOnScreen('', 90),
        // The micro:bit's button A or B went down or up (from the live link). Only a press starts scripts.
        setLive: (on) => {
            liveOn = !!on;
            emitChange();
        },
        microbitPress: (input) => {
            const id = 'mb:' + input;
            pressed[id] = true;
            inputListeners.forEach((fn) => fn({ id, type: 'mb' }));
        },
        microbitRelease: (input) => {
            pressed['mb:' + input] = false;
        },
        inputs: () => widgets.filter((w) => INPUT_TYPES.includes(w.type)).map((w) => ({ id: w.id, type: w.type, label: w.label || '', key: w.key || '' })),
        outputs: () => widgets.filter((w) => OUTPUT_TYPES.includes(w.type)).map((w) => ({ id: w.id, type: w.type, label: w.label || '' })),
        triggerText: (input) => triggerText(input),
        onInput: (fn) => inputListeners.push(fn),
        onChange: (fn) => changeListeners.push(fn),
        setLamp: (id, on) => {
            lamps[id] = !!on;
            refreshOutputs();
        },
        addToNumber: (id, n) => {
            numbers[id] = (numbers[id] || 0) + n;
            refreshOutputs();
        },
        resetNumber: (id) => {
            numbers[id] = 0;
            refreshOutputs();
        },
    };

    // ---- start ----
    loadLayout();
    render();
    loadDrawing();
})();
