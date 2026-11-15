// עיר לבנייה — המודלים התלת-ממדיים, חלק א׳ (נכתבו מחדש מאפס).
// כאן: ערכת הבנייה (CityKit), קרקע, דרכים, שער, עצים, דברים קטנים, בתים, בניינים, אנשים ומכוניות.
// הקובץ נטען לפני game.js. הוא משתמש בעזרים של game.js (part, boxG, mat, rnd...) רק בזמן ריצה, לא בזמן הטעינה.
// החוצה יוצאים: buildCell, buildSale, drawOutsideRoad, makePersonModel, makeCarModel ו-CityKit.
(function () {
'use strict';

const PI = Math.PI;
const P = (parent, geo, color, x, y, z, extra) => part(parent, geo, color, x, y, z, extra);
const B = (w, h, d) => boxG(w, h, d);
const C = (rt, rb, h, seg) => cylG(rt, rb, h, seg || 10);
const K = (r, h, seg) => coneG(r, h, seg || 10);
const S = (r) => icoG(r);
const geo = (k, make) => cached(geoCache, k, make);
const pick = (arr, seed, k) => arr[Math.floor(rnd(seed, k) * arr.length)];

// --- צורות חדשות ---
// קופסה עם פינות מעוגלות (במבט מלמעלה): נותנת לבניינים מראה רך של צעצוע
function softG(w, h, d, rad) {
    rad = Math.max(0.001, Math.min(rad == null ? 0.03 : rad, w / 2 - 0.001, d / 2 - 0.001));
    return geo(`s${w}|${h}|${d}|${rad}`, () => {
        const x = w / 2, z = d / 2, s = new THREE.Shape();
        s.moveTo(-x + rad, -z);
        s.lineTo(x - rad, -z); s.quadraticCurveTo(x, -z, x, -z + rad);
        s.lineTo(x, z - rad); s.quadraticCurveTo(x, z, x - rad, z);
        s.lineTo(-x + rad, z); s.quadraticCurveTo(-x, z, -x, z - rad);
        s.lineTo(-x, -z + rad); s.quadraticCurveTo(-x, -z, -x + rad, -z);
        const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 4 });
        g.rotateX(-PI / 2);
        g.translate(0, -h / 2, 0);
        return g;
    });
}
// גג רעפים משולש (מנסרה). הרכס לאורך ציר x, הבסיס ב-y=0
function gableG(w, h, d) {
    return geo(`g${w}|${h}|${d}`, () => {
        const s = new THREE.Shape();
        s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.lineTo(-d / 2, 0);
        const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
        g.translate(0, 0, -w / 2);
        g.rotateY(PI / 2);
        return g;
    });
}
// גג פירמידה מעל מלבן (ארבעה שיפועים), ממורכז ב-y
function hipG(w, h, d) {
    return geo(`h${w}|${h}|${d}`, () => {
        let g = new THREE.ConeGeometry(1, h, 4);
        g.rotateY(PI / 4);
        g.scale(w / 1.4142, 1, d / 1.4142);
        g = g.toNonIndexed();
        g.computeVertexNormals();
        return g;
    });
}
// כיפה (חצי כדור), הבסיס ב-y=0
function domeG(r) { return geo(`d${r}`, () => new THREE.SphereGeometry(r, 14, 7, 0, PI * 2, 0, PI / 2)); }
function torusG(r, tube, arc) { return geo(`t${r}|${tube}|${arc || 0}`, () => new THREE.TorusGeometry(r, tube, 6, 20, arc || PI * 2)); }

// --- דברים שזזים או מאירים (game.js מפעיל אותם בכל פריים) ---
const FX = { glass: [], lights: [], chimneys: [], spinners: [], bobbers: [] };
function resetFX() { FX.chimneys.length = 0; FX.spinners.length = 0; FX.bobbers.length = 0; }

// זכוכית: חלונות. בלילה כל החלונות נדלקים
function glassMat(alt) {
    const m = mat(alt ? '#b9e1f7' : '#86c5ec', { roughness: 0.2, metalness: 0.15 });
    if (!m.userData.fx) { m.userData.fx = 1; FX.glass.push(m); }
    return m;
}
function G(parent, g, x, y, z, alt) {
    const m = new THREE.Mesh(g, glassMat(alt));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
}
// אור: פנסים, שלטים מוארים ופנסי מכוניות. בלילה הם מתחזקים
function L(parent, g, color, x, y, z, base) {
    const mesh = P(parent, g, color, x, y, z, { emissive: color, emissiveIntensity: base == null ? 0.5 : base });
    const m = mesh.material;
    if (!m.userData.fx) { m.userData.fx = 1; m.userData.base = m.emissiveIntensity; FX.lights.push(m); }
    mesh.castShadow = false;
    return mesh;
}
function spin(obj, axis, speed) { FX.spinners.push({ o: obj, axis, speed }); return obj; }
function bob(obj, amp, speed, phase) { FX.bobbers.push({ o: obj, y: obj.position.y, a: amp, sp: speed, ph: phase || 0 }); return obj; }

function sub(parent, x, y, z, ry) {
    const g = new THREE.Group();
    g.position.set(x || 0, y || 0, z || 0);
    if (ry) g.rotation.y = ry;
    parent.add(g);
    return g;
}
// קיר: קבוצה מסובבת, כך שכל מה ששמים בה ב-z=d נמצא על הקיר. k: 0 חזית, 1 ימין, 2 גב, 3 שמאל
function face(parent, k, dist) {
    const g = sub(parent, 0, 0, 0, k * PI / 2);
    g.userData.d = dist;
    return g;
}
function win(g, x, y, w, h, o) {
    o = o || {};
    const z = g.userData.d, fr = o.frame || '#ffffff';
    P(g, B(w + 0.03, h + 0.03, 0.012), fr, x, y, z);
    G(g, B(w, h, 0.02), x, y, z + 0.001, o.alt);
    if (!o.plain) P(g, B(w + 0.05, 0.014, 0.03), fr, x, y - h / 2 - 0.018, z + 0.01);
    if (o.cross) { P(g, B(w, 0.01, 0.024), fr, x, y, z + 0.001); P(g, B(0.01, h, 0.024), fr, x, y, z + 0.001); }
    if (o.shut) [-1, 1].forEach(s => P(g, B(0.035, h + 0.02, 0.012), o.shut, x + s * (w / 2 + 0.036), y, z + 0.003));
    if (o.box) {
        P(g, B(w + 0.02, 0.03, 0.04), '#9c6b4a', x, y - h / 2 - 0.035, z + 0.026);
        [-1, 0, 1].forEach(i => P(g, S(0.018), ['#ff6f91', '#ffd54f', '#ff8a65'][i + 1], x + i * w * 0.3, y - h / 2 - 0.012, z + 0.03));
    }
}
function door(g, x, w, h, col, o) {
    o = o || {};
    const z = g.userData.d;
    P(g, B(w + 0.035, h + 0.02, 0.012), o.frame || '#ffffff', x, h / 2 + 0.01, z);
    if (o.glass) G(g, B(w, h, 0.02), x, h / 2, z + 0.002, true);
    else {
        P(g, B(w, h, 0.02), col, x, h / 2, z + 0.002);
        P(g, S(0.011), '#ffd54f', x + w * 0.3, h * 0.48, z + 0.016);
    }
    P(g, B(w + 0.09, 0.02, 0.06), '#c9c5bd', x, 0.01, z + 0.035);
    if (o.canopy) P(g, B(w + 0.12, 0.018, 0.1), o.canopy, x, h + 0.045, z + 0.05);
}
// שביל אבני מדרך מהדלת אל הדרך (רק אם יש דרך ליד)
function pathTo(b, c, r, frontZ, x) {
    if (!roadNextTo(c, r)) return;
    for (let z = frontZ + 0.08, i = 0; z < 0.5; z += 0.085, i++) {
        P(b, C(0.045, 0.045, 0.012, 8), '#dcd5c8', (x || 0) + (i % 2 ? 0.014 : -0.014), 0.006, z).castShadow = false;
    }
}
function shrub(b, x, z, s, col) {
    s = s || 1;
    P(b, S(0.06), col || '#4f9d3a', x, 0.042 * s, z).scale.set(s, s * 0.8, s);
}
function hedge(b, x, z, w, d) { P(b, softG(w, 0.07, d, 0.02), '#3f8f3a', x, 0.035, z); }
function fence(b, x0, x1, z, col) {
    const n = Math.max(2, Math.round((x1 - x0) / 0.065));
    for (let i = 0; i <= n; i++) P(b, B(0.016, 0.08, 0.012), col || '#ffffff', x0 + (x1 - x0) * i / n, 0.04, z);
    P(b, B(x1 - x0, 0.012, 0.008), col || '#ffffff', (x0 + x1) / 2, 0.052, z);
}
function chimney(b, x, y, z, col) {
    P(b, B(0.07, 0.18, 0.07), col || '#a65f4a', x, y + 0.09, z);
    FX.chimneys.push(P(b, B(0.09, 0.02, 0.09), '#5d4037', x, y + 0.19, z));
}
// דוד שמש על הגג
function solarHeater(b, x, y, z) {
    P(b, C(0.035, 0.035, 0.1, 8), '#f5f5f5', x, y + 0.085, z - 0.03).rotation.z = PI / 2;
    P(b, B(0.1, 0.05, 0.02), '#9e9e9e', x, y + 0.025, z - 0.03);
    P(b, B(0.12, 0.012, 0.1), '#263a6b', x, y + 0.04, z + 0.04, { roughness: 0.3 }).rotation.x = 0.5;
}
function flag(b, x, y, z, col, h) {
    h = h || 0.3;
    P(b, C(0.008, 0.008, h, 5), '#eeeeee', x, y + h / 2, z);
    P(b, B(0.11, 0.07, 0.008), col, x + 0.06, y + h - 0.045, z);
    P(b, S(0.012), '#ffd54f', x, y + h, z);
}
// רכב קטן שחונה ליד מבנה (ניידת, אמבולנס, כבאית...)
function miniCar(b, x, z, ry, col, o) {
    o = o || {};
    const g = sub(b, x, 0, z, ry);
    P(g, softG(0.13, 0.055, 0.25, 0.03), col, 0, 0.06, 0);
    P(g, softG(0.115, 0.05, 0.13, 0.03), o.top || col, 0, 0.11, -0.015);
    G(g, B(0.1, 0.035, 0.006), 0, 0.112, 0.052);
    if (o.stripe) P(g, B(0.134, 0.016, 0.2), o.stripe, 0, 0.065, 0);
    if (o.bar) L(g, B(0.08, 0.018, 0.03), o.bar, 0, 0.145, -0.015, 0.5);
    [[-0.065, 0.075], [0.065, 0.075], [-0.065, -0.075], [0.065, -0.075]].forEach(([wx, wz]) => {
        P(g, C(0.03, 0.03, 0.025, 10), '#22262b', wx, 0.03, wz).rotation.z = PI / 2;
    });
    return g;
}
function plot(b, col, size) {
    P(b, softG(size || 0.92, 0.02, size || 0.92, 0.06), col, 0, 0.01, 0).castShadow = false;
}

// --- חלקה ---
function buildCell(c, r) {
    const group = new THREE.Group();
    group.position.set(c, 0, r);
    const seed = seedOf(c, r);
    // אריח דשא מעוגל, בשני גוונים לסירוגין כמו לוח משחק
    const even = ((c + r) % 2 + 2) % 2 === 0;
    P(group, softG(0.98, 0.1, 0.98, 0.06), even ? '#8fd168' : '#82c65b', 0, -0.05, 0).castShadow = false;

    // כל מה שמעל האריח נמצא בקבוצה אחת, כדי שאפשר יהיה להקפיץ אותו כשבונים
    const content = sub(group, 0, 0, 0);
    const v = variantAt(c, r);
    const cat = v ? v.cat : null;
    let top = 0.5;
    if (cat === 'road') {
        buildRoad(content, c, r, v);
        if (isEntrance(c, r)) buildGate(content);
    } else if (cat === 'park') {
        top = CityKit.build.park(content, seed, c, r, v) || 0.4;
    } else if (cat === 'school') {
        top = CityKit.build.school(content, seed, c, r, v) || 0.9;
    } else if (cat && CityKit.build[cat]) {
        // מבנה רגיל: מסתובב עם החזית אל הדרך
        const b = sub(content, 0, 0, 0, facingRot(c, r));
        const res = CityKit.build[cat](b, seed, v, c, r) || {};
        pathTo(b, c, r, res.front == null ? 0.3 : res.front, res.px);
        top = res.top || 0.5;
    }

    const list = decorAt(c, r);
    let last = null;
    if (list.length) last = buildDecor(content, seed, list, plotBlock(v));
    else if (!cat) buildWild(content, seed);

    // מבנה משודרג: כוכבי זהב מרחפים מעליו (כוכב לכל רמה מעל הראשונה)
    const lv = levelAt(c, r);
    if (cat && lv > 1 && buildingActive(c, r)) {
        const stars = sub(content, 0, top + 0.14, 0);
        for (let i = 0; i < lv - 1; i++) {
            const st = P(stars, K(0.045, 0.07, 4), '#ffc400', (i - (lv - 2) / 2) * 0.12, 0, 0);
            st.castShadow = false;
            const low = P(stars, K(0.045, 0.07, 4), '#ffc400', (i - (lv - 2) / 2) * 0.12, -0.07, 0);
            low.rotation.x = PI;
            low.castShadow = false;
        }
        bob(stars, 0.03, 2.5, seed % 5);
    }
    group.userData.top = top;

    // מבנה בלי דרך לא עובד: סיכה אדומה מרחפת מעליו
    if (cat && !buildingActive(c, r)) {
        const pin = sub(content, 0, top + 0.2, 0);
        P(pin, K(0.05, 0.12, 8), '#e53935', 0, 0, 0).rotation.x = PI;
        P(pin, S(0.065), '#e53935', 0, 0.09, 0);
        P(pin, S(0.028), '#ffffff', 0, 0.09, 0.045);
        bob(pin, 0.04, 3, seed % 7);
    }
    group.userData.pop = last || content;
    return group;
}

// חלקה למכירה: אריח בהיר שקוף למחצה, יתדות בפינות ושלט צהוב עם פלוס
function buildSale(c, r) {
    const g = new THREE.Group();
    g.position.set(c, 0, r);
    P(g, softG(0.9, 0.04, 0.9, 0.08), '#f6fbe8', 0, -0.02, 0, { transparent: true, opacity: 0.7 }).castShadow = false;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => P(g, C(0.014, 0.014, 0.1, 6), '#ffb300', sx * 0.38, 0.05, sz * 0.38));
    P(g, C(0.014, 0.014, 0.34, 6), '#8d6e63', 0, 0.17, 0);
    P(g, B(0.26, 0.16, 0.03), '#ffca28', 0, 0.39, 0);
    P(g, B(0.11, 0.03, 0.036), '#ffffff', 0, 0.39, 0);
    P(g, B(0.03, 0.11, 0.036), '#ffffff', 0, 0.39, 0);
    return g;
}

// שטח ריק: לפעמים צומח בו משהו קטן
function buildWild(g, seed) {
    const t = rnd(seed, 8);
    if (t > 0.42) return;
    const x = (rnd(seed, 9) - 0.5) * 0.6, z = (rnd(seed, 10) - 0.5) * 0.6;
    if (t < 0.14) {
        [[0, 0], [0.04, 0.02], [-0.03, 0.035]].forEach(([dx, dz], i) => P(g, K(0.02, 0.08 + i * 0.02, 4), '#5fae45', x + dx, 0.04 + i * 0.01, z + dz));
    } else if (t < 0.28) {
        [['#ff6f91', 0, 0], ['#ffd54f', 0.06, 0.03], ['#ffffff', -0.04, 0.05]].forEach(([col, dx, dz]) => {
            P(g, C(0.005, 0.005, 0.07, 4), '#4caf50', x + dx, 0.035, z + dz);
            P(g, S(0.022), col, x + dx, 0.08, z + dz);
        });
    } else if (t < 0.35) {
        P(g, S(0.07), '#a7a39a', x, 0.03, z).scale.set(1.2, 0.6, 1);
        P(g, S(0.035), '#bdb9b0', x + 0.08, 0.015, z + 0.03);
    } else {
        shrub(g, x, z, 1.3, '#4c9a3e');
        shrub(g, x + 0.08, z + 0.04, 0.9, '#62ad49');
    }
}

// --- דרכים ---
// כיכר עגולה במרכז + זרוע לכל שכנה שהיא דרך. הזרועות מגיעות עד שפת החלקה, ולכן כל הסוגים מתחברים זה לזה
const ROADS = {
    road:    { w: 0.5,  base: '#4b4f5c', curb: '#cfd2d8', line: '#ffffff' },
    highway: { w: 0.56, base: '#2c2e36', curb: '#8d9099', dbl: true },
    dirt:    { w: 0.44, base: '#b98b5f' },
    sand:    { w: 0.44, base: '#ecd49c' },
    stone:   { w: 0.42, base: '#cfcdc6', curb: '#a9a69d' },
    brick:   { w: 0.44, base: '#c2674b', curb: '#8e3f2c' },
    plank:   { w: 0.4,  base: '#6b4a30' },
    bike:    { w: 0.34, base: '#39a85a', curb: '#ffffff', line: '#ffffff' },
};
function buildRoad(g, c, r, v) {
    const st = ROADS[v.id] || ROADS.road;
    const w = st.w, y = 0.012, ly = 0.0255, seed = seedOf(c, r);
    const flat = (m) => { m.castShadow = false; return m; };
    const arms = DIRS.filter(d => roadAt(c + d.dc, r + d.dr) || (isEntrance(c, r) && d.name === 'W'));
    flat(P(g, C(w / 2, w / 2, 0.023, 18), st.base, 0, y, 0));
    arms.forEach(d => {
        const a = sub(g, 0, 0, 0, Math.atan2(d.dc, d.dr));   // הזרוע נבנית לכיוון +z ומסובבת אל השכנה
        flat(P(a, B(w, 0.022, 0.5), st.base, 0, y, 0.25));
        if (st.curb) [-1, 1].forEach(s => flat(P(a, B(0.03, 0.03, 0.5 - w / 2), st.curb, s * (w / 2 + 0.015), 0.015, 0.25 + w / 4)));
        if (st.dbl) {
            [-0.018, 0.018].forEach(x => flat(P(a, B(0.012, 0.004, 0.5), '#ffcc33', x, ly, 0.25)));
            [-1, 1].forEach(s => flat(P(a, B(0.012, 0.004, 0.5), '#ffffff', s * (w / 2 - 0.035), ly, 0.25)));
        } else if (st.line) {
            const cross = v.id === 'road' && arms.length >= 3;
            if (cross) [-0.165, -0.055, 0.055, 0.165].forEach(x => flat(P(a, B(0.05, 0.004, 0.1), '#ffffff', x, ly, 0.33)));
            else flat(P(a, B(0.022, 0.004, 0.1), st.line, 0, ly, 0.2));
            flat(P(a, B(0.022, 0.004, 0.08), st.line, 0, ly, 0.45));
        }
        if (v.id === 'dirt') {
            [-0.09, 0.09].forEach(x => flat(P(a, B(0.05, 0.004, 0.5), '#a17850', x, ly, 0.25)));
        } else if (v.id === 'sand') {
            [0.14, 0.34].forEach((z, i) => flat(P(a, B(0.2, 0.004, 0.014), '#dcc083', i ? 0.05 : -0.05, ly, z)).rotation.y = i ? 0.3 : -0.3);
        } else if (v.id === 'stone') {
            [[-0.09, 0.1], [0.09, 0.18], [-0.09, 0.27], [0.09, 0.35], [-0.09, 0.44]].forEach(([x, z], i) => flat(P(a, C(0.055, 0.055, 0.012, 6), ['#b9b6ad', '#e2dfd6', '#a9a69d'][i % 3], x, 0.026, z)));
        } else if (v.id === 'brick') {
            [0.06, 0.16, 0.26, 0.36, 0.46].forEach((z, i) => {
                flat(P(a, B(w, 0.004, 0.008), '#9a4a35', 0, ly, z));
                flat(P(a, B(0.008, 0.004, 0.1), '#9a4a35', i % 2 ? 0.1 : -0.1, ly, z - 0.05));
            });
        } else if (v.id === 'plank') {
            [0.05, 0.15, 0.25, 0.35, 0.45].forEach((z, i) => flat(P(a, B(w - 0.02, 0.014, 0.085), i % 2 ? '#b98d55' : '#a97c48', 0, 0.03, z)));
        }
    });
    // פרטים במרכז
    if (v.id === 'bike') {
        [-0.05, 0.05].forEach(x => flat(P(g, torusG(0.035, 0.007), '#ffffff', x, 0.028, 0)).rotation.x = PI / 2);
        flat(P(g, B(0.1, 0.006, 0.012), '#ffffff', 0, 0.03, 0));
    } else if (v.id === 'stone') {
        [[0, 0], [0.1, -0.08], [-0.1, 0.07]].forEach(([x, z], i) => flat(P(g, C(0.055, 0.055, 0.012, 6), ['#e2dfd6', '#b9b6ad', '#a9a69d'][i], x, 0.027, z)));
    } else if (v.id === 'plank') {
        flat(P(g, C(w / 2 - 0.02, w / 2 - 0.02, 0.014, 18), '#b98d55', 0, 0.03, 0));
    } else if (v.id === 'dirt' || v.id === 'sand') {
        [[-0.1, 0.06], [0.11, -0.07], [0.03, 0.13]].forEach(([x, z], i) => P(g, S(0.02), v.id === 'dirt' ? '#8d6a4a' : '#d4b46c', x + rnd(seed, i) * 0.03, 0.024, z));
    } else if (v.id === 'road' && arms.length !== 2) {
        flat(P(g, C(0.06, 0.06, 0.004, 12), '#3a3d47', 0, ly, 0));   // מכסה ביוב
    }
}

// שער הכניסה לעיר: שני עמודי אבן עם פנסים, ושלט כחול מעל הכביש
function buildGate(g) {
    [-0.34, 0.34].forEach(z => {
        P(g, softG(0.09, 0.5, 0.09, 0.02), '#ddd4c5', -0.46, 0.25, z);
        P(g, B(0.11, 0.03, 0.11), '#8a7f72', -0.46, 0.515, z);
        L(g, S(0.035), '#ffe082', -0.46, 0.565, z, 0.5);
    });
    P(g, B(0.05, 0.11, 0.62), '#2f7dd1', -0.46, 0.43, 0);
    P(g, B(0.056, 0.035, 0.46), '#ffffff', -0.46, 0.43, 0);
    [-0.2, 0, 0.2].forEach((z, i) => P(g, K(0.03, 0.06, 3), ['#ff6f61', '#ffd54f', '#66bb6a'][i], -0.46, 0.34, z).rotation.x = PI);
}

// הכביש שמגיע מבחוץ: סוללה מהשער עד קצה העולם (או עד שטח אחר שבבעלות הילד)
let outsideGroup = null;
function drawOutsideRoad() {
    if (!scene) return;
    if (outsideGroup) scene.remove(outsideGroup);
    outsideGroup = new THREE.Group();
    scene.add(outsideGroup);
    const row = entranceR;
    let c = entranceC - 1;
    while (c > -29 && !isOwned(c, row)) c--;
    const startX = entranceC - 0.5, endX = c + 0.5, len = startX - endX;
    if (len <= 0.01) return;
    const mid = (startX + endX) / 2;
    P(outsideGroup, B(len, 0.124, 0.5), '#4b4f5c', mid, -0.039, row).castShadow = false;
    [-1, 1].forEach(s => P(outsideGroup, B(len, 0.13, 0.05), '#cfd2d8', mid, -0.035, row + s * 0.275).castShadow = false);
    for (let x = startX - 0.3; x > endX + 0.1; x -= 0.5) {
        P(outsideGroup, B(0.12, 0.004, 0.022), '#ffffff', x, 0.0255, row).castShadow = false;
    }
}

// --- עצים ---
const FOL = ['#3f9b46', '#56ad4a', '#2f8a4e'];
const TREES = {
    tree(t, seed) {
        const col = pick(FOL, seed, 5);
        P(t, C(0.035, 0.06, 0.3, 7), '#7a5236', 0, 0.15, 0);
        P(t, C(0.016, 0.022, 0.12, 5), '#7a5236', 0.06, 0.26, 0).rotation.z = -0.8;
        [[0.2, 0.3, 0.94], [0.165, 0.43, 1.06], [0.11, 0.55, 1.18]].forEach(([rad, y, f]) => {
            P(t, S(rad), tint(col, f), 0, y, 0).scale.y = 0.72;
        });
    },
    palm(t) {
        for (let i = 0; i < 4; i++) {
            P(t, C(0.028, 0.036, 0.17, 7), i % 2 ? '#b08a5e' : '#9f7850', 0.012 * i * i, 0.085 + 0.16 * i, 0).rotation.z = -0.07 * i;
        }
        const top = sub(t, 0.12, 0.68, 0);
        for (let k = 0; k < 7; k++) {
            const pv = sub(top, 0, 0, 0, k * PI * 2 / 7);
            P(pv, B(0.26, 0.012, 0.07), k % 2 ? '#3fa34d' : '#35924a', 0.13, -0.03, 0).rotation.z = -0.35;
            P(pv, B(0.12, 0.01, 0.05), '#4cb35c', 0.29, -0.11, 0).rotation.z = -0.95;
        }
        [[0.03, 0.02], [-0.03, 0.01], [0, -0.035]].forEach(([x, z]) => P(top, S(0.028), '#6b4a2f', x, -0.03, z));
    },
    blossom(t) {
        P(t, C(0.03, 0.05, 0.26, 6), '#5b3a29', 0, 0.13, 0);
        P(t, C(0.02, 0.028, 0.2, 5), '#5b3a29', 0.06, 0.32, 0).rotation.z = -0.6;
        P(t, C(0.02, 0.028, 0.2, 5), '#5b3a29', -0.06, 0.32, 0).rotation.z = 0.6;
        [[0.13, 0.44, 0, 0.13, '#f8a5c2'], [-0.13, 0.44, 0.02, 0.12, '#f78fb3'], [0, 0.52, -0.04, 0.15, '#fbc4d8'], [0.02, 0.4, 0.1, 0.1, '#ffd9e6']]
            .forEach(([x, y, z, rad, col]) => P(t, S(rad), col, x, y, z));
        [[0.15, 0.1], [-0.12, 0.14], [0.05, -0.16]].forEach(([x, z]) => P(t, C(0.02, 0.02, 0.004, 6), '#f8a5c2', x, 0.004, z).castShadow = false);
    },
    pine(t) {
        P(t, C(0.03, 0.045, 0.2, 6), '#6b4a34', 0, 0.1, 0);
        [[0.26, 0.22, 0.22], [0.39, 0.18, 0.2], [0.51, 0.135, 0.2], [0.63, 0.085, 0.18]].forEach(([y, rad, h], i) => {
            P(t, K(rad, h, 7), i % 2 ? '#34895a' : '#2c7a4b', 0, y, 0);
        });
    },
    apple(t) {
        P(t, C(0.035, 0.06, 0.28, 7), '#7a5236', 0, 0.14, 0);
        P(t, S(0.2), '#4caf50', 0, 0.42, 0).scale.set(1.15, 0.9, 1.15);
        P(t, S(0.13), '#66bb6a', 0.1, 0.53, 0.04);
        for (let k = 0; k < 6; k++) {
            const a = k * PI / 3 + 0.4;
            P(t, S(0.027), '#e53935', Math.cos(a) * 0.2, 0.38 + (k % 3) * 0.06, Math.sin(a) * 0.2);
        }
        P(t, S(0.025), '#e53935', 0.14, 0.022, 0.12);
    },
    olive(t) {
        P(t, C(0.04, 0.075, 0.2, 6), '#8b7355', 0, 0.1, 0).rotation.z = 0.15;
        P(t, C(0.028, 0.04, 0.17, 6), '#8b7355', 0.035, 0.26, 0).rotation.z = -0.4;
        [[-0.1, 0.4, 0, '#93a878'], [0.12, 0.42, 0.03, '#a3b588'], [0, 0.48, -0.06, '#869c6b'], [0.02, 0.4, 0.1, '#9bb07f']]
            .forEach(([x, y, z, col]) => P(t, S(0.13), col, x, y, z).scale.set(1.2, 0.6, 1.1));
        [[0.14, 0.37, 0.08], [-0.15, 0.36, 0.05], [0.04, 0.42, 0.16], [-0.04, 0.44, -0.16]].forEach(([x, y, z]) => P(t, S(0.016), '#2f3a2c', x, y, z));
    },
    willow(t) {
        P(t, C(0.04, 0.06, 0.36, 7), '#6b5137', 0, 0.18, 0);
        P(t, domeG(0.24), '#8bc34a', 0, 0.36, 0);
        for (let k = 0; k < 12; k++) {
            const a = k * PI / 6;
            P(t, B(0.035, 0.24 + (k % 3) * 0.03, 0.012), k % 2 ? '#a5d16a' : '#93c653', Math.cos(a) * 0.22, 0.26, Math.sin(a) * 0.22).rotation.y = -a + PI / 2;
        }
    },
    cactus(t) {
        P(t, C(0.05, 0.055, 0.4, 8), '#4f9a57', 0, 0.2, 0);
        P(t, S(0.05), '#4f9a57', 0, 0.4, 0);
        P(t, B(0.08, 0.035, 0.035), '#4f9a57', 0.07, 0.2, 0);
        P(t, C(0.03, 0.03, 0.14, 6), '#4f9a57', 0.11, 0.28, 0);
        P(t, S(0.03), '#4f9a57', 0.11, 0.35, 0);
        P(t, B(0.07, 0.03, 0.03), '#4f9a57', -0.065, 0.27, 0);
        P(t, C(0.026, 0.026, 0.1, 6), '#4f9a57', -0.1, 0.33, 0);
        P(t, S(0.022), '#ff6f91', 0, 0.46, 0);
        P(t, S(0.018), '#ffd54f', -0.1, 0.39, 0);
        P(t, S(0.045), '#5aa864', 0.13, 0.035, 0.1).scale.y = 0.8;
    },
};
function buildTree(g, seed, v) {
    const t = sub(g, 0, 0, 0);
    t.scale.setScalar(0.9 + rnd(seed, 2) * 0.25);
    (TREES[v.id] || TREES.tree)(t, seed);
}

// --- דברים קטנים ---
const PROPS = {
    bench(g) {
        [-0.13, 0.13].forEach(x => {
            P(g, B(0.02, 0.2, 0.14), '#3b3f46', x, 0.1, 0);
            P(g, B(0.03, 0.015, 0.15), '#3b3f46', x, 0.2, 0.005);
        });
        [-0.04, 0, 0.04].forEach(z => P(g, B(0.3, 0.015, 0.035), '#b9824f', 0, 0.12, z));
        [0.2, 0.26].forEach(y => P(g, B(0.3, 0.04, 0.012), '#b9824f', 0, y, -0.065));
    },
    fountain(g) {
        P(g, C(0.3, 0.33, 0.1, 10), '#d3cdc2', 0, 0.05, 0);
        P(g, C(0.27, 0.27, 0.02, 10), '#5fc4ee', 0, 0.095, 0, { roughness: 0.15 });
        P(g, C(0.04, 0.06, 0.2, 8), '#c2bcb0', 0, 0.2, 0);
        P(g, C(0.14, 0.05, 0.05, 10), '#d3cdc2', 0, 0.32, 0);
        P(g, C(0.12, 0.12, 0.012, 10), '#7fd3f3', 0, 0.346, 0, { roughness: 0.15 });
        P(g, C(0.012, 0.02, 0.14, 6), '#d6f1fc', 0, 0.42, 0);
        bob(P(g, S(0.035), '#e6f7ff', 0, 0.5, 0), 0.025, 5, 0);
        for (let k = 0; k < 4; k++) {
            const a = k * PI / 2 + 0.4;
            bob(P(g, S(0.02), '#d6f1fc', Math.cos(a) * 0.1, 0.4, Math.sin(a) * 0.1), 0.03, 5, k + 1);
        }
    },
    tap(g) {
        P(g, softG(0.12, 0.26, 0.12, 0.03), '#b9c4cc', 0, 0.13, 0);
        P(g, C(0.08, 0.06, 0.03, 10), '#e3e9ee', 0, 0.275, 0);
        P(g, C(0.01, 0.01, 0.06, 6), '#90a4ae', 0, 0.32, -0.03);
        P(g, B(0.012, 0.012, 0.05), '#90a4ae', 0, 0.35, -0.008);
        P(g, S(0.014), '#1e88e5', 0.062, 0.2, 0);
        P(g, C(0.07, 0.07, 0.004, 10), '#8fd4f2', 0.02, 0.004, 0.12).castShadow = false;
    },
    lamp(g) {
        P(g, C(0.035, 0.045, 0.06, 8), '#2f3640', 0, 0.03, 0);
        P(g, C(0.014, 0.018, 0.56, 6), '#2f3640', 0, 0.34, 0);
        P(g, B(0.14, 0.014, 0.014), '#2f3640', 0.06, 0.62, 0);
        P(g, K(0.05, 0.03, 6), '#2f3640', 0.12, 0.605, 0);
        L(g, C(0.034, 0.022, 0.05, 6), '#ffe9a8', 0.12, 0.565, 0, 0.6);
    },
    bin(g) {
        P(g, C(0.065, 0.055, 0.18, 10), '#3f9d5a', 0, 0.09, 0);
        P(g, C(0.068, 0.068, 0.014, 10), '#2f7d46', 0, 0.13, 0);
        P(g, domeG(0.068), '#ff9f43', 0, 0.18, 0).scale.y = 0.5;
        P(g, S(0.014), '#2f3640', 0, 0.22, 0);
    },
    flowers(g, seed) {
        P(g, C(0.19, 0.2, 0.04, 10), '#c9b79c', 0, 0.02, 0);
        P(g, C(0.17, 0.17, 0.01, 10), '#6b4a34', 0, 0.042, 0);
        const colors = ['#ff6f91', '#ffd54f', '#ff8a65', '#ba68c8', '#ffffff', '#ef5350'];
        for (let k = 0; k < 7; k++) {
            const a = k * 0.9 + rnd(seed, 20 + k), rad = k ? 0.06 + rnd(seed, 30 + k) * 0.08 : 0;
            const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
            P(g, C(0.006, 0.006, 0.09, 4), '#4caf50', x, 0.09, z);
            P(g, S(0.026), colors[k % colors.length], x, 0.145, z);
        }
    },
    mailbox(g) {
        [-0.04, 0.04].forEach(x => P(g, B(0.015, 0.14, 0.015), '#5a5a5a', x, 0.07, 0));
        P(g, softG(0.15, 0.16, 0.11, 0.02), '#e23b3b', 0, 0.22, 0);
        P(g, C(0.055, 0.055, 0.15, 10), '#e23b3b', 0, 0.3, 0).rotation.z = PI / 2;
        P(g, B(0.09, 0.012, 0.005), '#2b2b2b', 0, 0.26, 0.057);
        P(g, B(0.07, 0.04, 0.004), '#ffffff', 0, 0.19, 0.057);
    },
    sign(g) {
        P(g, C(0.012, 0.012, 0.46, 6), '#8d99a6', 0, 0.23, 0);
        P(g, C(0.125, 0.125, 0.016, 8), '#ffffff', 0, 0.52, 0).rotation.set(PI / 2, PI / 8, 0);
        P(g, C(0.11, 0.11, 0.02, 8), '#e53935', 0, 0.52, 0.002).rotation.set(PI / 2, PI / 8, 0);
        P(g, B(0.13, 0.035, 0.006), '#ffffff', 0, 0.52, 0.014);
    },
    umbrella(g) {
        P(g, C(0.26, 0.26, 0.006, 12), '#f1dfae', 0, 0.003, 0).castShadow = false;
        P(g, C(0.01, 0.01, 0.5, 6), '#eeeeee', 0, 0.25, 0);
        P(g, K(0.25, 0.1, 8), '#ff6b6b', 0, 0.5, 0);
        P(g, C(0.25, 0.25, 0.012, 8), '#ffffff', 0, 0.446, 0);
        P(g, S(0.015), '#ffffff', 0, 0.56, 0);
        P(g, B(0.1, 0.02, 0.22), '#4fc3f7', 0.14, 0.05, 0.07);
        P(g, B(0.1, 0.02, 0.1), '#4fc3f7', 0.14, 0.085, -0.075).rotation.x = -0.7;
    },
    statue(g) {
        P(g, softG(0.26, 0.06, 0.26, 0.02), '#a9a59c', 0, 0.03, 0);
        P(g, softG(0.18, 0.12, 0.18, 0.02), '#c2beb4', 0, 0.12, 0);
        const bronze = '#6fa192';
        P(g, C(0.035, 0.05, 0.16, 8), bronze, 0, 0.26, 0);
        P(g, C(0.05, 0.04, 0.14, 8), bronze, 0, 0.4, 0);
        P(g, S(0.04), bronze, 0, 0.51, 0);
        P(g, C(0.014, 0.014, 0.14, 5), bronze, 0.065, 0.5, 0).rotation.z = -0.5;
        P(g, C(0.014, 0.014, 0.12, 5), bronze, -0.06, 0.39, 0).rotation.z = -0.25;
        L(g, S(0.025), '#ffd54f', 0.1, 0.58, 0, 0.5);
    },
};

// עצים וקישוטים בחלקה. לכל פריט יש עיגול לפי המקום שהוא תופס, והעיגולים מסתדרים בחלקה בלי לעלות זה על זה:
// הגדולים קודם, מהמרכז החוצה (או מהפינות פנימה, כשמבנה תופס את האמצע). כשצפוף מדי, כולם קטנים קצת.
// מחזיר את הפריט האחרון שנוסף
const DECOR_R = { 1: 0.085, 2: 0.12, 3: 0.16, 4: 0.21 };
const DECOR_GROW = { 1: 1, 2: 1, 3: 1.15, 4: 1.35 };
function packDecor(items, block) {
    const spots = [];
    for (let x = -5; x <= 5; x++) for (let z = -5; z <= 5; z++) spots.push([x * 0.08, z * 0.08]);
    const edge = (p) => Math.max(Math.abs(p[0]), Math.abs(p[1]));
    spots.sort((a, b) => block ? edge(b) - edge(a) || Math.hypot(b[0], b[1]) - Math.hypot(a[0], a[1]) : Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
    let shrink = 1;
    for (let attempt = 0; attempt < 9; attempt++, shrink *= 0.85) {
        const placed = [];
        const ok = items.every(it => {
            const rad = DECOR_R[it.sp] * shrink;
            const spot = spots.find(p => edge(p) + rad <= 0.49
                && (!block || edge(p) >= block + rad * 0.5)
                && placed.every(q => Math.hypot(p[0] - q.x, p[1] - q.z) >= (rad + q.rad) * 0.92));
            if (!spot) return false;
            placed.push({ it, x: spot[0], z: spot[1], rad });
            return true;
        });
        if (ok) return { placed, shrink };
    }
    // חלקה מלאה מדי (שמירה ישנה): מפזרים בכל זאת, קטן
    return { shrink, placed: items.map((it, i) => ({ it, x: (rnd(i, 71) - 0.5) * 0.8, z: (rnd(i, 72) - 0.5) * 0.8, rad: 0 })) };
}
function buildDecor(group, seed, ids, block) {
    const items = [];
    ids.forEach((id, i) => { if (VARIANT_BY_ID[id]) items.push({ i, v: VARIANT_BY_ID[id], sp: Math.min(4, Math.max(1, spaceOf(id))) }); });
    const sorted = items.slice().sort((a, b) => b.sp - a.sp || a.i - b.i);
    const { placed, shrink } = packDecor(sorted, block || 0);
    let last = null, lastI = -1;
    placed.forEach(({ it, x, z }) => {
        const i = it.i, v = it.v;
        const g = sub(group, x + (rnd(seed, 40 + i) - 0.5) * 0.03, 0, z + (rnd(seed, 50 + i) - 0.5) * 0.03, rnd(seed, 60 + i) * PI * 2);
        g.scale.setScalar((v.size || 0.6) * DECOR_GROW[it.sp] * shrink);
        const itemSeed = seed + (i + 1) * 17;
        if (v.cat === 'tree') buildTree(g, itemSeed, v);
        else (PROPS[v.id] || PROPS.bench)(g, itemSeed);
        if (i > lastI) { lastI = i; last = g; }
    });
    return last;
}

// --- בתים ---
const WALLS = ['#fde8c9', '#dff0d8', '#d6e9fb', '#fbdde6', '#fff3b8', '#ffe2cc'];
const ROOFS = ['#c8553d', '#8a5a44', '#5f7c8a', '#b5651d'];
// גוף של בית: יסוד, קירות וגג. מחזיר את הקבוצה, קיר החזית, גובה הקירות, הגובה הכולל ומיקום החזית
function shell(b, o) {
    const z0 = o.z == null ? -0.06 : o.z;
    const m = sub(b, o.x || 0, 0, z0);
    P(m, softG(o.w + 0.04, 0.04, o.d + 0.04, 0.03), o.found || '#b9b0a2', 0, 0.02, 0);
    P(m, softG(o.w, o.h, o.d, o.rad == null ? 0.03 : o.rad), o.wall, 0, 0.04 + o.h / 2, 0);
    const y = 0.04 + o.h;
    if (o.roof === 'gable') P(m, gableG(o.w + 0.07, o.rh, o.d + 0.09), o.rc, 0, y, 0);
    else if (o.roof === 'gableZ') P(m, gableG(o.d + 0.07, o.rh, o.w + 0.09), o.rc, 0, y, 0).rotation.y = PI / 2;
    else if (o.roof === 'hip') P(m, hipG(o.w + 0.09, o.rh, o.d + 0.09), o.rc, 0, y + o.rh / 2, 0);
    else P(m, softG(o.w + 0.05, 0.03, o.d + 0.05, 0.03), o.rc, 0, y + 0.015, 0);
    return { m, f: face(m, 0, o.d / 2), y, top: y + (o.rh || 0.03), front: z0 + o.d / 2 };
}
const HOUSES = {
    house(b, seed) {
        const wall = pick(WALLS, seed, 6), roof = pick(ROOFS, seed, 7);
        const s = shell(b, { w: 0.56, d: 0.44, h: 0.28, wall, roof: 'gable', rh: 0.2, rc: roof });
        chimney(s.m, 0.17, s.y + 0.04, -0.1);
        [-0.18, 0.18].forEach(x => win(s.f, x, 0.2, 0.1, 0.11, { cross: true, shut: tint(roof, 0.85) }));
        door(s.f, 0, 0.1, 0.19, tint(roof, 0.7), { canopy: roof });
        [1, 3].forEach(k => win(face(s.m, k, 0.28), 0, 0.2, 0.12, 0.1, { cross: true }));
        fence(b, -0.46, -0.1, 0.4);
        shrub(b, 0.32, 0.3, 1.1);
        shrub(b, 0.4, 0.22, 0.8, '#ff8fab');
        return s;
    },
    cabin(b) {
        const s = shell(b, { w: 0.46, d: 0.4, h: 0.24, wall: '#a9764a', roof: 'gable', rh: 0.2, rc: '#4e6b3a', found: '#8d8478', rad: 0.01 });
        [0, 1, 2, 3].forEach(k => {
            const f = face(s.m, k, k % 2 ? 0.23 : 0.2);
            [0.1, 0.17, 0.24].forEach(y => P(f, B((k % 2 ? 0.4 : 0.46) + 0.02, 0.012, 0.012), '#7d5231', 0, y, f.userData.d + 0.002));
        });
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => P(s.m, C(0.024, 0.024, 0.24, 6), '#8a5c38', sx * 0.23, 0.16, sz * 0.2));
        // ארובת אבן חיצונית
        P(s.m, softG(0.09, 0.5, 0.09, 0.02), '#9d9a94', 0.27, 0.25, -0.05);
        FX.chimneys.push(P(s.m, B(0.11, 0.02, 0.11), '#6b6862', 0.27, 0.51, -0.05));
        // מרפסת עץ קטנה
        P(s.m, B(0.34, 0.02, 0.12), '#b9824f', 0, 0.03, 0.26);
        [-0.15, 0.15].forEach(x => P(s.m, C(0.012, 0.012, 0.2, 5), '#7d5231', x, 0.13, 0.31));
        P(s.m, B(0.38, 0.015, 0.15), '#4e6b3a', 0, 0.24, 0.27).rotation.x = 0.25;
        win(s.f, -0.13, 0.17, 0.09, 0.09, { cross: true, frame: '#7d5231' });
        door(s.f, 0.07, 0.09, 0.17, '#6b4326', { frame: '#7d5231' });
        // ערימת בולי עץ
        [[0, 0.025], [0.05, 0.025], [0.025, 0.065]].forEach(([dx, y]) => P(b, C(0.024, 0.024, 0.14, 6), '#b08a5e', -0.36 + dx, y, 0.22).rotation.x = PI / 2);
        return Object.assign(s, { px: 0.07 });
    },
    villa(b) {
        const s = shell(b, { x: -0.06, w: 0.5, d: 0.42, h: 0.34, wall: '#fff6e3', roof: 'hip', rh: 0.18, rc: '#c96f4a', z: -0.1 });
        // אגף נמוך עם מרפסת גג
        P(b, softG(0.24, 0.22, 0.32, 0.03), '#fbe9cf', 0.3, 0.15, -0.08);
        P(b, softG(0.26, 0.02, 0.34, 0.03), '#e0c9a6', 0.3, 0.27, -0.08);
        [[0.3, 0.085, 0.24, 0.008], [0.425, -0.08, 0.008, 0.33]].forEach(([x, z, w, d]) => P(b, B(w, 0.05, d), '#ffffff', x, 0.305, z));
        P(b, C(0.006, 0.006, 0.16, 5), '#eeeeee', 0.3, 0.36, -0.1);
        P(b, K(0.1, 0.05, 8), '#ff8a65', 0.3, 0.46, -0.1);
        win(face(b, 0, 0.08), 0.3, 0.16, 0.12, 0.1, { shut: '#3f7cac' });
        // חזית: דלת עם קשת, עמודים וחלונות גבוהים
        door(s.f, 0.06, 0.11, 0.2, '#7a4b2b', { canopy: '#c96f4a' });
        [-0.03, 0.15].forEach(x => P(s.m, C(0.016, 0.016, 0.26, 8), '#ffffff', x, 0.13, 0.29));
        [-0.15].forEach(x => win(s.f, x, 0.22, 0.09, 0.15, { shut: '#3f7cac' }));
        win(face(s.m, 3, 0.25), 0, 0.22, 0.14, 0.13, { shut: '#3f7cac' });
        // בריכה
        P(b, softG(0.3, 0.02, 0.18, 0.05), '#eef3f5', 0.27, 0.01, 0.33).castShadow = false;
        P(b, softG(0.26, 0.012, 0.14, 0.04), '#4fc3f7', 0.27, 0.02, 0.33, { roughness: 0.1 }).castShadow = false;
        hedge(b, -0.33, 0.3, 0.2, 0.06);
        return Object.assign(s, { px: 0 });
    },
    cottage(b) {
        const s = shell(b, { w: 0.5, d: 0.42, h: 0.26, wall: '#fbf3df', roof: 'gable', rh: 0.3, rc: '#d8b25f' });
        P(s.m, B(0.6, 0.03, 0.06), '#b8923f', 0, s.y + 0.295, 0);   // רכס הגג
        const beam = '#6b4a34', z = s.f.userData.d + 0.003;
        [-0.24, 0.24].forEach(x => P(s.f, B(0.02, 0.26, 0.012), beam, x, 0.17, z));
        P(s.f, B(0.5, 0.02, 0.012), beam, 0, 0.29, z);
        [-1, 1].forEach(sg => P(s.f, B(0.02, 0.2, 0.012), beam, sg * 0.105, 0.19, z).rotation.z = sg * 0.5);
        chimney(s.m, -0.16, s.y + 0.08, -0.08, '#b5694d');
        [-0.17, 0.17].forEach(x => win(s.f, x, 0.2, 0.09, 0.09, { cross: true, box: true, frame: beam }));
        door(s.f, 0, 0.09, 0.17, '#2f8a4e', { frame: beam });
        P(s.f, C(0.045, 0.045, 0.02, 12), '#2f8a4e', 0, 0.17, s.f.userData.d + 0.002).rotation.x = PI / 2;
        [['#ff6f91', -0.36, 0.26], ['#ffd54f', -0.3, 0.34], ['#ba68c8', 0.34, 0.3], ['#ffffff', 0.4, 0.22]].forEach(([col, x, zz]) => shrub(b, x, zz, 0.7, col));
        hedge(b, 0.36, 0.4, 0.2, 0.05);
        return s;
    },
    duplex(b) {
        const cols = [['#ffe9a8', '#c8553d', '#8e3f2c'], ['#cfe8f7', '#5f7c8a', '#35505c']];
        let s = null;
        [-1, 1].forEach((sg, i) => {
            const [wall, roof, dr] = cols[i];
            s = shell(b, { x: sg * 0.19, w: 0.37, d: 0.44, h: 0.42, wall, roof: 'gableZ', rh: 0.16, rc: roof });
            door(s.f, -sg * 0.07, 0.09, 0.18, dr, { canopy: roof });
            win(s.f, sg * 0.08, 0.14, 0.09, 0.1, { cross: true });
            [-0.09, 0.09].forEach(x => win(s.f, x, 0.33, 0.09, 0.09, { cross: true }));
            win(face(s.m, sg > 0 ? 1 : 3, 0.185), 0, 0.33, 0.12, 0.09);
        });
        chimney(b, 0, 0.5, -0.12);
        P(b, B(0.012, 0.08, 0.3), '#ffffff', 0, 0.04, 0.32);   // גדר בין שתי החצרות
        shrub(b, -0.42, 0.3, 0.9);
        shrub(b, 0.42, 0.3, 0.9, '#ff8fab');
        return Object.assign(s, { px: 0.12, top: 0.62 });
    },
    modern(b) {
        P(b, softG(0.66, 0.03, 0.5, 0.02), '#c9c5bd', 0, 0.015, -0.06);
        P(b, softG(0.6, 0.2, 0.42, 0.015), '#f4f5f7', -0.03, 0.13, -0.08);
        P(b, softG(0.46, 0.18, 0.5, 0.015), '#b98556', 0.1, 0.32, -0.02);
        P(b, softG(0.5, 0.02, 0.54, 0.015), '#3a3f47', 0.1, 0.42, -0.02);
        P(b, softG(0.62, 0.015, 0.44, 0.015), '#3a3f47', -0.03, 0.237, -0.08);
        const f = face(b, 0, 0.13);
        P(f, B(0.33, 0.17, 0.01), '#3a3f47', -0.14, 0.13, 0.13);
        G(f, B(0.3, 0.14, 0.016), -0.14, 0.13, 0.132);
        door(f, 0.16, 0.09, 0.18, '#3a3f47', { frame: '#3a3f47' });
        const f2 = face(b, 0, 0.23);
        G(f2, B(0.4, 0.1, 0.016), 0.1, 0.33, 0.232, true);
        G(face(b, 1, 0.33), B(0.3, 0.1, 0.016), 0.02, 0.33, 0.332, true);
        P(b, C(0.012, 0.012, 0.2, 6), '#3a3f47', 0.3, 0.13, 0.2);
        [-0.02, 0.2].forEach(x => P(b, B(0.16, 0.01, 0.1), '#1f3a6e', x, 0.45, -0.08, { roughness: 0.3 }).rotation.x = -0.35);
        P(b, B(0.3, 0.012, 0.16), '#c9a27a', -0.2, 0.012, 0.3);
        P(b, softG(0.1, 0.08, 0.1, 0.02), '#3f8f3a', 0.38, 0.04, 0.34);
        P(b, S(0.04), '#a7a39a', -0.4, 0.02, 0.36).scale.y = 0.6;
        return { top: 0.46, front: 0.13, px: 0.16 };
    },
    farm(b) {
        // אסם אדום עם גג כפול
        const s = shell(b, { x: -0.14, w: 0.44, d: 0.5, h: 0.28, wall: '#c0392b', roof: 'gableZ', rh: 0.13, rc: '#5b4636', z: -0.08, rad: 0.01 });
        P(s.m, gableG(0.57, 0.12, 0.3), '#4a382b', 0, s.y + 0.07, 0).rotation.y = PI / 2;
        const z = s.f.userData.d + 0.002;
        P(s.f, B(0.24, 0.22, 0.012), '#ffffff', 0, 0.11, z - 0.002);
        P(s.f, B(0.2, 0.2, 0.014), '#8e2a20', 0, 0.1, z);
        [-1, 1].forEach(sg => P(s.f, B(0.26, 0.02, 0.016), '#ffffff', 0, 0.1, z + 0.002).rotation.z = sg * 0.78);
        P(s.f, B(0.09, 0.07, 0.014), '#ffffff', 0, 0.27, z);
        // ממגורה
        P(b, C(0.09, 0.09, 0.5, 12), '#d9dde1', 0.27, 0.25, -0.2);
        [0.15, 0.32].forEach(y => P(b, C(0.093, 0.093, 0.012, 12), '#9aa5ad', 0.27, y, -0.2));
        P(b, domeG(0.09), '#9aa5ad', 0.27, 0.5, -0.2);
        // חבילות חציר וטרקטור
        [0.18, 0.28].forEach(x => P(b, C(0.05, 0.05, 0.08, 10), '#e3c15a', x, 0.05, 0.08).rotation.x = PI / 2);
        const t = sub(b, 0.3, 0, 0.32, -PI / 2);
        P(t, B(0.08, 0.05, 0.15), '#3fa34d', 0, 0.075, 0);
        P(t, B(0.075, 0.07, 0.06), '#3fa34d', 0, 0.13, -0.04);
        [-1, 1].forEach(sg => {
            P(t, C(0.045, 0.045, 0.025, 10), '#22262b', sg * 0.055, 0.045, -0.04).rotation.z = PI / 2;
            P(t, C(0.026, 0.026, 0.02, 8), '#22262b', sg * 0.05, 0.026, 0.06).rotation.z = PI / 2;
        });
        // ערוגות
        [0.3, 0.36, 0.42].forEach(zz => {
            P(b, B(0.3, 0.008, 0.035), '#8a6a4a', -0.24, 0.006, zz).castShadow = false;
            [-0.34, -0.24, -0.14].forEach(x => P(b, S(0.018), '#66bb6a', x, 0.02, zz));
        });
        return Object.assign(s, { top: 0.6, px: -0.02 });
    },
    mansion(b) {
        const s = shell(b, { w: 0.5, d: 0.4, h: 0.44, wall: '#fbf1e2', roof: 'flat', rc: '#e6d9c3', z: -0.1 });
        P(s.m, softG(0.46, 0.1, 0.36, 0.04), '#4f5d6b', 0, s.y + 0.08, 0);
        P(s.m, softG(0.36, 0.02, 0.26, 0.03), '#3d4954', 0, s.y + 0.14, 0);
        flag(s.m, 0, s.y + 0.15, 0, '#c8553d', 0.2);
        [-1, 1].forEach(sg => {
            P(s.m, C(0.1, 0.1, 0.56, 12), '#fbf1e2', sg * 0.33, 0.3, 0);
            P(s.m, C(0.105, 0.105, 0.02, 12), '#e6d9c3', sg * 0.33, 0.585, 0);
            P(s.m, K(0.125, 0.22, 12), '#4f5d6b', sg * 0.33, 0.7, 0);
            P(s.m, S(0.016), '#ffd54f', sg * 0.33, 0.82, 0);
            G(s.m, B(0.06, 0.1, 0.01), sg * 0.33, 0.4, 0.1);
            hedge(b, sg * 0.34, 0.3, 0.2, 0.06);
        });
        // אכסדרה: מדרגות, ארבעה עמודים וגמלון
        P(s.m, B(0.36, 0.02, 0.14), '#d9d4c8', 0, 0.03, 0.26);
        [-0.15, -0.05, 0.05, 0.15].forEach(x => P(s.m, C(0.016, 0.02, 0.28, 8), '#ffffff', x, 0.18, 0.3));
        P(s.m, B(0.36, 0.03, 0.14), '#ffffff', 0, 0.335, 0.26);
        P(s.m, gableG(0.36, 0.08, 0.14), '#ffffff', 0, 0.35, 0.26);
        door(s.f, 0, 0.12, 0.22, '#6b3f2a');
        [-0.17, 0.17].forEach(x => { win(s.f, x, 0.17, 0.07, 0.13); win(s.f, x, 0.37, 0.07, 0.1); });
        win(s.f, 0, 0.4, 0.09, 0.07, { plain: true });
        return Object.assign(s, { top: 0.84, front: 0.23 });
    },
};

// --- בניינים ---
const APT_WALLS = ['#f3e3c8', '#e8d5c0', '#dfe7ea', '#f2d9c9', '#e3ecd8'];
const ACCENTS = ['#ff7043', '#42a5f5', '#66bb6a', '#ab47bc', '#ffca28'];
// רצועות חלונות: רצועת זכוכית אחת לכל קומה, על הקירות שנבחרו
function bands(m, w, d, y0, h, floors, faces) {
    const gap = h / floors;
    faces.forEach(k => {
        const f = face(m, k, (k % 2 ? w : d) / 2);
        for (let i = 0; i < floors; i++) G(f, B((k % 2 ? d : w) - 0.1, gap * 0.45, 0.012), 0, y0 + gap * (i + 0.55), f.userData.d + 0.001, i % 2 === 1);
    });
}
// מגדל זכוכית: גוף מזכוכית עם טבעות לבנות בין הקומות
function glassTower(m, w, d, y0, h, floors, alt, x) {
    G(m, softG(w, h, d, 0.04), x || 0, y0 + h / 2, 0, alt).castShadow = true;
    for (let i = 0; i <= floors; i++) P(m, softG(w + 0.016, 0.012, d + 0.016, 0.045), '#eef1f4', x || 0, y0 + h * i / floors, 0);
}
const APTS = {
    apt(b, seed) {
        const wall = pick(APT_WALLS, seed, 6), acc = pick(ACCENTS, seed, 7);
        const w = 0.52, d = 0.44, h = 0.78, m = sub(b, 0, 0, -0.06);
        P(m, softG(w + 0.03, 0.12, d + 0.03, 0.03), '#a79f93', 0, 0.06, 0);
        P(m, softG(w, h, d, 0.03), wall, 0, 0.12 + h / 2, 0);
        P(m, softG(w + 0.03, 0.03, d + 0.03, 0.03), '#6b6259', 0, 0.12 + h + 0.015, 0);
        const f = face(m, 0, d / 2), gap = h / 4;
        for (let i = 0; i < 4; i++) {
            const y = 0.12 + gap * (i + 0.5);
            [-0.19, 0.19].forEach(x => win(f, x, y, 0.08, 0.09, { plain: true }));
            // מרפסת באמצע כל קומה
            G(f, B(0.1, 0.11, 0.012), 0, y - 0.01, d / 2 + 0.001, true);
            P(f, B(0.18, 0.012, 0.07), '#d9d4c8', 0, y - 0.07, d / 2 + 0.035);
            P(f, B(0.18, 0.045, 0.008), acc, 0, y - 0.045, d / 2 + 0.067);
        }
        door(f, 0, 0.1, 0.1, '', { glass: true, canopy: acc });
        bands(m, w, d, 0.12, h, 4, [1, 2, 3]);
        const top = 0.12 + h + 0.03;
        P(m, softG(0.14, 0.09, 0.14, 0.01), wall, 0.12, top + 0.045, -0.1);
        solarHeater(m, -0.14, top, -0.05);
        solarHeater(m, -0.14, top, 0.12);
        return { top: top + 0.12, front: -0.06 + d / 2 };
    },
    tower(b) {
        const m = sub(b, 0, 0, -0.04);
        P(m, softG(0.56, 0.12, 0.5, 0.04), '#8f98a3', 0, 0.06, 0);
        glassTower(m, 0.44, 0.4, 0.12, 1.1, 8);
        P(m, softG(0.3, 0.06, 0.28, 0.03), '#eef1f4', 0, 1.25, 0);
        P(m, C(0.11, 0.11, 0.01, 14), '#4b4f5c', 0, 1.285, 0);
        [-0.03, 0.03].forEach(x => P(m, B(0.012, 0.004, 0.08), '#ffffff', x, 1.292, 0));
        P(m, B(0.06, 0.004, 0.012), '#ffffff', 0, 1.292, 0);
        door(face(m, 0, 0.25), 0, 0.12, 0.1, '', { glass: true, canopy: '#eef1f4' });
        return { top: 1.3, front: 0.21 };
    },
    studio(b) {
        P(b, softG(0.5, 0.22, 0.44, 0.03), '#ffd9a8', 0, 0.11, -0.06);
        P(b, softG(0.42, 0.22, 0.4, 0.03), '#ff9f68', 0.04, 0.33, -0.08);
        P(b, softG(0.46, 0.02, 0.44, 0.03), '#7a4b3a', 0.04, 0.45, -0.08);
        const f = face(b, 0, 0.16);
        P(f, B(0.25, 0.15, 0.01), '#ffffff', -0.09, 0.12, 0.16);
        G(f, B(0.22, 0.12, 0.016), -0.09, 0.12, 0.162);
        door(f, 0.14, 0.09, 0.17, '#7a4b3a');
        // חלון עגול בקומה השנייה
        const f2 = face(b, 0, 0.12);
        P(f2, C(0.075, 0.075, 0.012, 16), '#ffffff', 0.04, 0.34, 0.12).rotation.x = PI / 2;
        G(f2, C(0.06, 0.06, 0.016, 16), 0.04, 0.34, 0.122).rotation.x = PI / 2;
        // מדרגות חיצוניות וגינת גג
        [0, 1, 2, 3].forEach(i => P(b, B(0.07, 0.022, 0.05), '#c9c5bd', -0.3, 0.03 + i * 0.05, 0.1 - i * 0.05));
        shrub(b, -0.08, -0.1, 0.9); P(b, S(0.04), '#4f9d3a', 0.14, 0.49, -0.12);
        P(b, C(0.005, 0.005, 0.12, 5), '#eeeeee', 0.04, 0.52, 0);
        P(b, K(0.08, 0.04, 8), '#42a5f5', 0.04, 0.59, 0);
        return { top: 0.6, front: 0.16, px: 0.14 };
    },
    senior(b) {
        const s = shell(b, { w: 0.7, d: 0.46, h: 0.34, wall: '#d9efe0', roof: 'hip', rh: 0.14, rc: '#6fa58a', z: -0.08 });
        [-0.24, 0.24].forEach(x => { win(s.f, x, 0.14, 0.11, 0.09, { box: true }); win(s.f, x, 0.29, 0.11, 0.08); });
        win(s.f, 0, 0.29, 0.1, 0.08);
        door(s.f, 0, 0.12, 0.18, '', { glass: true, canopy: '#6fa58a' });
        // שלט עגול עם צלב ירוק
        P(s.m, C(0.07, 0.07, 0.014, 16), '#ffffff', 0, 0.45, 0.2).rotation.x = PI / 2;
        P(s.m, B(0.09, 0.028, 0.02), '#43a047', 0, 0.45, 0.205);
        P(s.m, B(0.028, 0.09, 0.02), '#43a047', 0, 0.45, 0.205);
        // רמפה עם מעקה, ספסל ופרחים
        P(b, B(0.2, 0.012, 0.07), '#c9c5bd', 0.17, 0.02, 0.19).rotation.z = 0.12;
        P(b, B(0.2, 0.008, 0.008), '#8d99a6', 0.17, 0.09, 0.225);
        const seat = sub(b, -0.32, 0, 0.3);
        seat.scale.setScalar(0.6);
        PROPS.bench(seat);
        [['#ff6f91', 0.3], ['#ffd54f', 0.38]].forEach(([col, x]) => shrub(b, x, 0.32, 0.7, col));
        return s;
    },
    terrace(b) {
        [[0.7, 0.6, 0], [0.7, 0.44, -0.08], [0.7, 0.28, -0.16]].forEach(([w, d, z], i) => {
            const y0 = 0.22 * i;
            P(b, softG(w, 0.22, d, 0.02), i % 2 ? '#f1ebdf' : '#f7f3ea', 0, y0 + 0.11, z);
            const fz = z + d / 2;
            G(b, B(w - 0.14, 0.11, 0.012), 0, y0 + 0.12, fz + 0.001, i === 1);
            if (i < 2) {
                // אדנית ירוקה ומעקה זכוכית על שפת המרפסת
                P(b, softG(w - 0.04, 0.04, 0.05, 0.01), '#8a6a4a', 0, y0 + 0.24, fz - 0.03);
                [-0.26, -0.13, 0, 0.13, 0.26].forEach((x, k) => P(b, S(0.03), k % 2 ? '#ff8fab' : '#4f9d3a', x, y0 + 0.275, fz - 0.03));
            }
        });
        // פרגולת עץ על הגג
        [[-0.28, -0.24], [0.28, -0.24], [-0.28, -0.08], [0.28, -0.08]].forEach(([x, z]) => P(b, B(0.02, 0.14, 0.02), '#a97c48', x, 0.73, z));
        [-0.24, -0.16, -0.08].forEach(z => P(b, B(0.62, 0.014, 0.03), '#b98d55', 0, 0.805, z));
        door(face(b, 0, 0.3), 0.26, 0.09, 0.17, '#7a5236');
        return { top: 0.82, front: 0.3, px: 0.26 };
    },
    dorm(b) {
        const w = 0.66, d = 0.42, h = 0.6, m = sub(b, 0, 0, -0.08);
        P(m, softG(w, h, d, 0.02), '#c9754f', 0, h / 2, 0);
        P(m, softG(w + 0.03, 0.03, d + 0.03, 0.02), '#5a4338', 0, h + 0.015, 0);
        const f = face(m, 0, d / 2);
        for (let fl = 0; fl < 3; fl++) {
            [-0.24, -0.08, 0.08, 0.24].forEach((x, k) => {
                if (fl === 0 && (k === 1 || k === 2)) return;
                win(f, x, 0.12 + fl * 0.19, 0.08, 0.09, { frame: ACCENTS[(fl + k) % ACCENTS.length], plain: true });
            });
        }
        door(f, 0, 0.16, 0.17, '', { glass: true, canopy: '#7e57c2' });
        P(f, B(0.3, 0.05, 0.012), '#7e57c2', 0, h - 0.02, d / 2 + 0.002);
        bands(m, w, d, 0, h, 3, [1, 2, 3]);
        // מתקן אופניים
        [-0.36, -0.3, -0.24].forEach(x => P(b, torusG(0.03, 0.006), '#3b3f46', x, 0.035, 0.3).rotation.y = PI / 2);
        P(b, B(0.18, 0.008, 0.008), '#8d99a6', -0.3, 0.07, 0.3);
        solarHeater(m, 0.2, h + 0.03, 0);
        return { top: h + 0.14, front: -0.08 + d / 2 };
    },
    twin(b) {
        const m = sub(b, 0, 0, -0.04);
        P(m, softG(0.8, 0.12, 0.5, 0.04), '#9aa3ad', 0, 0.06, 0);
        glassTower(m, 0.28, 0.34, 0.12, 1.15, 8, false, -0.21);
        glassTower(m, 0.28, 0.34, 0.12, 0.95, 7, true, 0.21);
        G(m, B(0.16, 0.07, 0.12), 0, 0.66, 0, true);
        P(m, B(0.17, 0.012, 0.13), '#eef1f4', 0, 0.7, 0);
        P(m, C(0.008, 0.008, 0.22, 5), '#cfd8dc', -0.21, 1.38, 0);
        L(m, S(0.02), '#ff5252', -0.21, 1.5, 0, 0.7);
        P(m, softG(0.16, 0.05, 0.16, 0.02), '#eef1f4', 0.21, 1.1, 0);
        door(face(m, 0, 0.25), 0, 0.14, 0.1, '', { glass: true, canopy: '#eef1f4' });
        return { top: 1.52, front: 0.21 };
    },
    skyscraper(b) {
        const m = sub(b, 0, 0, -0.03);
        P(m, softG(0.52, 0.1, 0.5, 0.04), '#7f8994', 0, 0.05, 0);
        let y = 0.1;
        [[0.44, 0.6, 5], [0.36, 0.55, 5], [0.26, 0.45, 4]].forEach(([w, h, fl], i) => {
            glassTower(m, w, w, y, h, fl, i === 1);
            y += h;
        });
        P(m, softG(0.14, 0.06, 0.14, 0.02), '#eef1f4', 0, y + 0.03, 0);
        P(m, C(0.008, 0.014, 0.34, 6), '#cfd8dc', 0, y + 0.23, 0);
        L(m, S(0.024), '#ff5252', 0, y + 0.41, 0, 0.7);
        door(face(m, 0, 0.25), 0, 0.14, 0.09, '', { glass: true, canopy: '#eef1f4' });
        return { top: y + 0.44, front: 0.22 };
    },
};

// --- אנשים ומכוניות (game.js מזיז אותם לאורך הדרכים) ---
const SHIRTS = ['#ef5350', '#42a5f5', '#66bb6a', '#ffca28', '#ab47bc', '#ff7043', '#26c6da', '#ffffff'];
const PANTS = ['#37474f', '#5d4037', '#283593', '#455a64'];
const SKINS = ['#f1c27d', '#8d5524', '#ffdbac', '#c68642'];
const HAIRS = ['#3e2723', '#212121', '#a1662f', '#e0b46c', '#b23b2e'];
const rp = (a) => a[Math.floor(Math.random() * a.length)];

function makePersonModel() {
    const g = new THREE.Group();
    g.scale.setScalar(0.62);
    const shirt = rp(SHIRTS), pants = rp(PANTS), skin = rp(SKINS);
    P(g, C(0.05, 0.06, 0.17, 8), shirt, 0, 0.225, 0);
    P(g, S(0.055), skin, 0, 0.37, 0);
    P(g, domeG(0.06), rp(HAIRS), 0, 0.378, -0.006);
    [-0.02, 0.02].forEach(x => P(g, S(0.008), '#2b2b2b', x, 0.375, 0.052));
    const kind = Math.random();
    if (kind < 0.22) {
        const hat = rp(SHIRTS);
        P(g, C(0.04, 0.045, 0.035, 8), hat, 0, 0.435, 0);
        P(g, C(0.07, 0.07, 0.008, 10), hat, 0, 0.42, 0.015);
    } else if (kind < 0.4) {
        P(g, softG(0.08, 0.1, 0.04, 0.015), rp(SHIRTS), 0, 0.24, -0.07);
    } else if (kind < 0.52) {
        P(g, K(0.085, 0.1, 8), shirt, 0, 0.17, 0);
    }
    const legs = [-0.03, 0.03].map(x => {
        const pv = sub(g, x, 0.14, 0);
        P(pv, C(0.022, 0.02, 0.13, 6), pants, 0, -0.065, 0);
        P(pv, B(0.04, 0.02, 0.06), '#2b2b2b', 0, -0.13, 0.012);
        return pv;
    });
    const arms = [-0.075, 0.075].map(x => {
        const pv = sub(g, x, 0.3, 0);
        P(pv, C(0.017, 0.015, 0.14, 6), shirt, 0, -0.07, 0);
        P(pv, S(0.018), skin, 0, -0.15, 0);
        return pv;
    });
    return { g, legs, arms };
}

const CAR_COLS = ['#ef5350', '#42a5f5', '#ffffff', '#ab47bc', '#66bb6a', '#ff7043', '#26c6da', '#3b3f46'];
function wheels(g, x, zs, rad) {
    zs.forEach(z => [-1, 1].forEach(s => {
        P(g, C(rad, rad, 0.035, 10), '#22262b', s * x, rad, z).rotation.z = PI / 2;
        P(g, C(rad * 0.45, rad * 0.45, 0.04, 8), '#cfd3d8', s * x, rad, z).rotation.z = PI / 2;
    }));
}
function carLights(g, w, y, zf, zb) {
    [-1, 1].forEach(s => {
        L(g, B(0.04, 0.02, 0.01), '#fff6c9', s * w, y, zf, 0.4);
        L(g, B(0.04, 0.018, 0.01), '#ff5252', s * w, y, zb, 0.3);
    });
}
function makeCarModel() {
    const g = new THREE.Group();
    const t = Math.random();
    if (t < 0.14) {
        // אוטובוס צהוב
        P(g, softG(0.2, 0.17, 0.46, 0.04), '#f2b01e', 0, 0.135, 0);
        P(g, B(0.204, 0.02, 0.44), '#3b3f46', 0, 0.09, 0);
        [-1, 1].forEach(s => G(g, B(0.006, 0.06, 0.36), s * 0.1, 0.165, 0, true));
        G(g, B(0.16, 0.07, 0.006), 0, 0.16, 0.229);
        wheels(g, 0.092, [0.14, -0.14], 0.042);
        carLights(g, 0.065, 0.08, 0.231, -0.231);
    } else if (t < 0.28) {
        // משאית קטנה
        P(g, softG(0.19, 0.13, 0.13, 0.03), rp(CAR_COLS), 0, 0.115, 0.125);
        P(g, softG(0.2, 0.17, 0.25, 0.02), '#f5f5f5', 0, 0.135, -0.075);
        G(g, B(0.15, 0.05, 0.006), 0, 0.14, 0.191);
        wheels(g, 0.09, [0.12, -0.12], 0.042);
        carLights(g, 0.065, 0.075, 0.192, -0.201);
    } else {
        const taxi = t < 0.4, col = taxi ? '#ffffff' : rp(CAR_COLS);
        P(g, softG(0.19, 0.075, 0.36, 0.045), col, 0, 0.088, 0);
        P(g, softG(0.16, 0.065, 0.19, 0.04), tint(col, 0.9), 0, 0.155, -0.02);
        G(g, B(0.135, 0.045, 0.006), 0, 0.158, 0.076);
        G(g, B(0.135, 0.045, 0.006), 0, 0.158, -0.116);
        [-1, 1].forEach(s => G(g, B(0.006, 0.042, 0.14), s * 0.081, 0.158, -0.02));
        if (taxi) {
            L(g, B(0.07, 0.025, 0.035), '#ffd54f', 0, 0.2, -0.02, 0.5);
            P(g, B(0.194, 0.02, 0.3), '#ffd54f', 0, 0.085, 0);
        }
        wheels(g, 0.088, [0.11, -0.11], 0.042);
        carLights(g, 0.062, 0.095, 0.181, -0.181);
    }
    return g;
}

// --- יצוא ---
const CityKit = window.CityKit = {
    PI, P, B, C, K, S, G, L, softG, gableG, hipG, domeG, torusG, pick,
    sub, face, win, door, pathTo, shrub, hedge, fence, chimney, solarHeater, flag, miniCar, plot, shell, bands, spin, bob,
    FX, resetFX, TREES, PROPS,
    build: {
        house: (b, seed, v) => (HOUSES[v.id] || HOUSES.house)(b, seed),
        apt: (b, seed, v) => (APTS[v.id] || APTS.apt)(b, seed),
    },
};
window.buildCell = buildCell;
window.buildSale = buildSale;
window.drawOutsideRoad = drawOutsideRoad;
window.makePersonModel = makePersonModel;
window.makeCarModel = makeCarModel;
})();
