// גן החיות: מודלים תלת-ממדיים של החיות (בנויים מצורות פשוטות ועגולות, בלי קבצים חיצוניים).
// ZooModels.build(id) מחזיר { g, legs, anim(t, moving), size, speed, hop }. החזית של החיה היא +z.
(function (root) {
  const K = root.K3D;
  if (!K) { root.ZooModels = null; return; }
  const { part, group, sphG, cylG, boxG, coneG, torusG } = K;

  // כדור מתוח לאליפסה
  function blob(parent, color, x, y, z, sx, sy, sz, extra) {
    const m = part(parent, sphG(0.5, 16), color, x, y, z, extra);
    m.scale.set(sx, sy, sz);
    return m;
  }
  function eyes(head, dx, y, z, r) {
    r = r || 0.035;
    [-dx, dx].forEach((x) => {
      part(head, sphG(r, 8), '#ffffff', x, y, z);
      part(head, sphG(r * 0.6, 8), '#1b1b1b', x * 1.04, y, z + r * 0.6);
    });
  }

  // גוף של הולך על ארבע: טורסו, ארבע רגליים על צירים. מחזיר נקודות עיגון לראש ולזנב
  function quad(o) {
    const g = new K.THREE.Group();
    const body = group(g, 0, 0, 0);
    const cy = o.legH + o.h / 2 - 0.04;
    blob(body, o.color, 0, cy, 0, o.w, o.h, o.len);
    if (o.belly) blob(body, o.belly, 0, cy - o.h * 0.12, 0, o.w * 0.86, o.h * 0.8, o.len * 0.86);
    const legs = [];
    [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
      const p = group(body, sx * o.w * 0.27, o.legH + 0.03, sz * o.len * 0.3);
      part(p, cylG(o.legR, o.legR * 0.85, o.legH + 0.03, 10), o.legColor || o.color, 0, -(o.legH + 0.03) / 2, 0);
      part(p, sphG(o.legR * 1.1, 8), o.foot || o.legColor || o.color, 0, -o.legH, o.legR * 0.2).scale.set(1, 0.6, 1.2);
      legs.push(p);
    });
    return { g, body, legs, cy, top: cy + o.h / 2, front: o.len / 2, back: -o.len / 2 };
  }

  // זנב מפרקים: כל פרק מסתובב קצת, כך שאפשר לנופף בו
  function chain(parent, x, y, z, n, len, r0, r1, color, bend, tipColor) {
    const segs = [];
    let p = group(parent, x, y, z);
    for (let i = 0; i < n; i++) {
      const r = r0 + (r1 - r0) * (i / Math.max(1, n - 1));
      const m = part(p, cylG(r * 0.85, r, len, 8), i === n - 1 && tipColor ? tipColor : color, 0, 0, -len / 2);
      m.rotation.x = Math.PI / 2;
      segs.push(p);
      p = group(p, 0, 0, -len);
      p.rotation.x = bend;
    }
    return segs;
  }

  // פסים: טבעות סביב הגוף
  function stripes(body, cy, w, h, zs, color) {
    zs.forEach((z) => {
      const k = Math.sqrt(Math.max(0.05, 1 - Math.pow(z / zs.span, 2)));
      const m = part(body, torusG(0.5, 0.035, 20), color, 0, cy, z);
      m.scale.set(w * k * 1.01, h * k * 1.01, 1);
    });
  }
  const zsOf = (len, n) => { const a = []; for (let i = 0; i < n; i++) a.push(-len * 0.34 + (len * 0.68 * i) / (n - 1)); a.span = len / 2; return a; };

  const B = {};

  B.rabbit = () => {
    const q = quad({ len: 0.42, h: 0.3, w: 0.3, legH: 0.09, legR: 0.045, color: '#f3efe9' });
    const head = group(q.body, 0, q.cy + 0.13, 0.2);
    part(head, sphG(0.14, 14), '#f3efe9', 0, 0, 0);
    const ears = [-0.06, 0.06].map((x) => {
      const e = group(head, x, 0.1, -0.02);
      blob(e, '#f3efe9', 0, 0.15, 0, 0.07, 0.34, 0.05);
      blob(e, '#f8bbd0', 0, 0.15, 0.02, 0.035, 0.26, 0.03);
      return e;
    });
    part(head, sphG(0.025, 8), '#f06292', 0, -0.02, 0.135);
    eyes(head, 0.075, 0.03, 0.1, 0.028);
    part(q.body, sphG(0.07, 10), '#ffffff', 0, q.cy + 0.02, q.back);
    return { g: q.g, legs: q.legs, hop: 0.16, speed: 0.9, size: 0.3, anim: (t) => { ears[0].rotation.z = 0.12 + Math.sin(t * 3) * 0.08; ears[1].rotation.z = -0.12 - Math.sin(t * 3 + 1) * 0.08; } };
  };

  B.sheep = () => {
    const q = quad({ len: 0.6, h: 0.46, w: 0.46, legH: 0.2, legR: 0.04, color: '#f4f1e8', legColor: '#3e2f2a' });
    [[0.18, 0.12, 0.12], [-0.18, 0.12, 0.1], [0.16, 0.1, -0.16], [-0.16, 0.12, -0.14], [0, 0.2, 0], [0, 0.14, -0.26], [0, 0.16, 0.2]]
      .forEach(([x, y, z]) => part(q.body, sphG(0.15, 10), '#fbf9f3', x, q.cy + y, z));
    const head = group(q.body, 0, q.cy + 0.1, 0.36);
    blob(head, '#3e2f2a', 0, 0, 0, 0.2, 0.24, 0.28);
    part(head, sphG(0.1, 10), '#fbf9f3', 0, 0.11, -0.04);
    [-1, 1].forEach((s) => blob(head, '#3e2f2a', s * 0.13, 0.03, -0.02, 0.14, 0.06, 0.08));
    eyes(head, 0.07, 0.03, 0.1, 0.026);
    return { g: q.g, legs: q.legs, speed: 0.35, size: 0.45, anim: (t, moving) => { head.rotation.x = moving ? 0 : 0.5 + Math.sin(t * 2) * 0.08; } };
  };

  B.penguin = () => {
    const g = new K.THREE.Group();
    const body = group(g, 0, 0, 0);
    blob(body, '#263238', 0, 0.36, 0, 0.38, 0.62, 0.34);
    blob(body, '#fafafa', 0, 0.33, 0.05, 0.3, 0.52, 0.28);
    const head = group(body, 0, 0.72, 0);
    part(head, sphG(0.15, 14), '#263238', 0, 0, 0);
    blob(head, '#fafafa', 0, -0.02, 0.06, 0.2, 0.18, 0.2);
    part(head, coneG(0.04, 0.12, 8), '#ff9800', 0, -0.01, 0.17).rotation.x = Math.PI / 2;
    eyes(head, 0.07, 0.04, 0.12, 0.026);
    const wings = [-1, 1].map((s) => {
      const p = group(body, s * 0.19, 0.52, 0);
      blob(p, '#263238', s * 0.02, -0.16, 0, 0.07, 0.36, 0.18);
      return p;
    });
    const legs = [-0.09, 0.09].map((x) => {
      const p = group(body, x, 0.06, 0.02);
      blob(p, '#ff9800', 0, -0.03, 0.05, 0.13, 0.05, 0.2);
      return p;
    });
    return { g, legs, waddle: 0.16, speed: 0.4, size: 0.3, anim: (t, moving) => { wings[0].rotation.z = -0.25 - Math.abs(Math.sin(t * (moving ? 8 : 2))) * 0.35; wings[1].rotation.z = -wings[0].rotation.z; } };
  };

  B.monkey = () => {
    const q = quad({ len: 0.46, h: 0.34, w: 0.3, legH: 0.24, legR: 0.04, color: '#8d5a2b', foot: '#e8c39e' });
    const head = group(q.body, 0, q.cy + 0.2, 0.2);
    part(head, sphG(0.15, 14), '#8d5a2b', 0, 0, 0);
    blob(head, '#e8c39e', 0, -0.02, 0.07, 0.22, 0.2, 0.18);
    [-1, 1].forEach((s) => { part(head, sphG(0.06, 10), '#8d5a2b', s * 0.15, 0.03, 0); part(head, sphG(0.035, 8), '#e8c39e', s * 0.16, 0.03, 0.03); });
    eyes(head, 0.055, 0.03, 0.14, 0.024);
    part(head, sphG(0.02, 6), '#5d4037', 0, -0.04, 0.16);
    const tail = chain(q.body, 0, q.cy + 0.06, q.back + 0.02, 5, 0.13, 0.03, 0.02, '#6d4421', -0.5);
    tail[0].rotation.x = 0.9;
    return { g: q.g, legs: q.legs, hop: 0.07, speed: 0.75, size: 0.35, anim: (t) => { tail[0].rotation.y = Math.sin(t * 3) * 0.5; head.rotation.z = Math.sin(t * 1.3) * 0.15; } };
  };

  B.giraffe = () => {
    const c = '#f6b93b';
    const q = quad({ len: 0.8, h: 0.5, w: 0.4, legH: 0.78, legR: 0.05, color: c, foot: '#5d4037' });
    const neck = group(q.body, 0, q.cy + 0.12, 0.3);
    neck.rotation.x = 0.28;
    part(neck, cylG(0.085, 0.13, 1, 12), c, 0, 0.48, 0);
    const mane = part(neck, boxG(0.03, 0.9, 0.05), '#a1662f', 0, 0.5, -0.11);
    mane.castShadow = false;
    const head = group(neck, 0, 1, 0.02);
    head.rotation.x = -0.28;
    blob(head, c, 0, 0.02, 0.1, 0.17, 0.17, 0.34);
    blob(head, '#fbe2a4', 0, -0.01, 0.24, 0.13, 0.12, 0.14);
    [-0.045, 0.045].forEach((x) => { part(head, cylG(0.014, 0.014, 0.1, 6), c, x, 0.14, 0.02); part(head, sphG(0.026, 8), '#5d4037', x, 0.2, 0.02); });
    [-1, 1].forEach((s) => blob(head, c, s * 0.11, 0.07, 0, 0.12, 0.05, 0.07));
    eyes(head, 0.075, 0.05, 0.14, 0.026);
    const spot = '#a1662f';
    [[0.2, 0.08, 0.15], [0.2, -0.04, -0.12], [-0.2, 0.06, -0.05], [-0.2, -0.05, 0.2], [0.17, 0.14, -0.25], [-0.17, 0.14, 0.26], [0, 0.24, 0.05], [0, 0.23, -0.2]]
      .forEach(([x, y, z]) => blob(q.body, spot, x * 0.96, q.cy + y, z, 0.13, 0.11, 0.13));
    [[0.09, 0.2, 0], [-0.09, 0.45, 0], [0.08, 0.7, 0.02], [0, 0.32, 0.1], [0, 0.6, 0.09]].forEach(([x, y, z]) => blob(neck, spot, x, y, z, 0.08, 0.1, 0.08));
    const tail = chain(q.body, 0, q.cy + 0.1, q.back, 3, 0.16, 0.02, 0.015, c, -0.25, '#5d4037');
    tail[0].rotation.x = -1.1;
    return { g: q.g, legs: q.legs, speed: 0.45, size: 0.6, anim: (t) => { neck.rotation.x = 0.28 + Math.sin(t * 0.8) * 0.07; neck.rotation.z = Math.sin(t * 0.5) * 0.05; tail[0].rotation.y = Math.sin(t * 2.4) * 0.4; } };
  };

  B.elephant = () => {
    const c = '#9aa0a6';
    const q = quad({ len: 0.98, h: 0.78, w: 0.72, legH: 0.42, legR: 0.12, color: c, foot: '#7d848b' });
    const head = group(q.body, 0, q.cy + 0.12, 0.5);
    part(head, sphG(0.3, 16), c, 0, 0, 0);
    const ears = [-1, 1].map((s) => {
      const e = group(head, s * 0.24, 0.02, -0.04);
      blob(e, c, s * 0.2, 0, 0, 0.5, 0.56, 0.08);
      blob(e, '#c9b7b7', s * 0.2, 0, 0.03, 0.38, 0.44, 0.05);
      e.rotation.y = s * 0.5;
      return e;
    });
    eyes(head, 0.15, 0.08, 0.24, 0.035);
    const trunk = [];
    let p = group(head, 0, -0.08, 0.26);
    p.rotation.x = 0.5;
    for (let i = 0; i < 6; i++) {
      const r = 0.1 - i * 0.012;
      part(p, cylG(r * 0.9, r, 0.15, 10), c, 0, -0.075, 0);
      trunk.push(p);
      p = group(p, 0, -0.14, 0);
    }
    [-1, 1].forEach((s) => { const t = part(head, coneG(0.035, 0.26, 8), '#fffdf2', s * 0.13, -0.16, 0.26); t.rotation.x = 2.2; });
    const tail = chain(q.body, 0, q.cy + 0.1, q.back + 0.02, 3, 0.14, 0.025, 0.018, c, -0.2, '#5f666d');
    tail[0].rotation.x = -1.2;
    return {
      g: q.g, legs: q.legs, speed: 0.3, size: 0.75,
      anim: (t) => {
        ears.forEach((e, i) => { e.rotation.y = (i ? 1 : -1) * (0.5 + Math.sin(t * 1.6) * 0.18); });
        trunk.forEach((s, i) => { s.rotation.x = (i === 0 ? 0.5 : 0.1) + Math.sin(t * 1.2 - i * 0.5) * 0.12; s.rotation.z = Math.sin(t * 0.9 - i * 0.4) * 0.06; });
        tail[0].rotation.y = Math.sin(t * 2) * 0.35;
      },
    };
  };

  function bigCat(c, o) {
    const q = quad({ len: 0.82, h: 0.42, w: 0.4, legH: 0.3, legR: 0.06, color: c, belly: o.belly });
    const head = group(q.body, 0, q.cy + 0.16, 0.42);
    if (o.mane) {
      blob(head, o.mane, 0, 0, -0.06, 0.56, 0.58, 0.36);
      blob(head, o.mane, 0, -0.14, -0.02, 0.4, 0.36, 0.3);
    }
    part(head, sphG(0.17, 14), c, 0, 0, 0);
    blob(head, '#fff3dc', 0, -0.05, 0.12, 0.2, 0.14, 0.16);
    part(head, sphG(0.03, 8), '#3e2723', 0, -0.01, 0.2);
    [-1, 1].forEach((s) => { part(head, sphG(0.055, 10), o.mane || c, s * 0.12, 0.14, -0.02); part(head, sphG(0.03, 8), '#ffd7b5', s * 0.12, 0.14, 0.01); });
    eyes(head, 0.07, 0.04, 0.14, 0.028);
    if (o.stripes) {
      stripes(q.body, q.cy, 0.4, 0.42, zsOf(0.82, 6), '#212121');
      [-1, 1].forEach((s) => { const m = part(head, boxG(0.02, 0.07, 0.02), '#212121', s * 0.06, 0.14, 0.08); m.rotation.z = s * 0.3; });
    }
    const tail = chain(q.body, 0, q.cy + 0.08, q.back + 0.02, 5, 0.13, 0.03, 0.022, c, 0.3, o.tip);
    tail[0].rotation.x = -0.9;
    return { g: q.g, legs: q.legs, speed: 0.5, size: 0.55, anim: (t) => { tail[0].rotation.y = Math.sin(t * 1.8) * 0.5; tail[2].rotation.y = Math.sin(t * 1.8 + 1) * 0.4; head.rotation.y = Math.sin(t * 0.6) * 0.25; } };
  }
  B.lion = () => bigCat('#e0a030', { mane: '#8d4f1f', tip: '#5d3210', belly: '#f3d08a' });
  B.tiger = () => bigCat('#f08a24', { stripes: true, tip: '#212121', belly: '#fff3dc' });

  B.panda = () => {
    const q = quad({ len: 0.72, h: 0.56, w: 0.56, legH: 0.18, legR: 0.1, color: '#fafafa', legColor: '#212121' });
    blob(q.body, '#212121', 0, q.cy + 0.02, 0.2, 0.585, 0.585, 0.26);
    const head = group(q.body, 0, q.cy + 0.22, 0.34);
    part(head, sphG(0.22, 16), '#fafafa', 0, 0, 0);
    [-1, 1].forEach((s) => {
      part(head, sphG(0.075, 10), '#212121', s * 0.16, 0.18, -0.02);
      const patch = blob(head, '#212121', s * 0.085, 0.03, 0.17, 0.1, 0.13, 0.08);
      patch.rotation.z = s * 0.4;
      part(head, sphG(0.02, 6), '#ffffff', s * 0.085, 0.04, 0.21);
    });
    blob(head, '#ffffff', 0, -0.06, 0.18, 0.14, 0.1, 0.1);
    part(head, sphG(0.028, 8), '#212121', 0, -0.04, 0.23);
    return { g: q.g, legs: q.legs, speed: 0.28, size: 0.55, anim: (t, moving) => { q.body.rotation.z = Math.sin(t * 1.4) * (moving ? 0.07 : 0.03); head.rotation.z = Math.sin(t * 0.9) * 0.12; } };
  };

  B.zebra = () => {
    const q = quad({ len: 0.8, h: 0.44, w: 0.36, legH: 0.5, legR: 0.045, color: '#fafafa', foot: '#212121' });
    stripes(q.body, q.cy, 0.36, 0.44, zsOf(0.8, 7), '#212121');
    q.legs.forEach((l) => [-0.14, -0.28, -0.4].forEach((y) => part(l, cylG(0.05, 0.05, 0.035, 10), '#212121', 0, y, 0)));
    const neck = group(q.body, 0, q.cy + 0.1, 0.3);
    neck.rotation.x = 0.55;
    part(neck, cylG(0.1, 0.14, 0.42, 12), '#fafafa', 0, 0.2, 0);
    [0.1, 0.22, 0.34].forEach((y) => part(neck, cylG(0.125 - y * 0.08, 0.13 - y * 0.08, 0.035, 12), '#212121', 0, y, 0));
    part(neck, boxG(0.04, 0.44, 0.07), '#212121', 0, 0.24, -0.12);
    const head = group(neck, 0, 0.44, 0);
    head.rotation.x = -0.3;
    blob(head, '#fafafa', 0, 0.02, 0.1, 0.18, 0.18, 0.36);
    blob(head, '#212121', 0, -0.01, 0.26, 0.14, 0.13, 0.14);
    [-1, 1].forEach((s) => blob(head, '#fafafa', s * 0.07, 0.13, -0.02, 0.06, 0.14, 0.05));
    eyes(head, 0.08, 0.05, 0.12, 0.026);
    const tail = chain(q.body, 0, q.cy + 0.1, q.back, 3, 0.14, 0.02, 0.015, '#fafafa', -0.2, '#212121');
    tail[0].rotation.x = -1.1;
    return { g: q.g, legs: q.legs, speed: 0.55, size: 0.5, anim: (t, moving) => { tail[0].rotation.y = Math.sin(t * 3) * 0.5; neck.rotation.x = moving ? 0.55 : 0.55 + Math.max(0, Math.sin(t * 0.5)) * 0.8; } };
  };

  B.flamingo = () => {
    const c = '#ff8fab';
    const g = new K.THREE.Group();
    const body = group(g, 0, 0, 0);
    blob(body, c, 0, 0.78, 0, 0.3, 0.28, 0.46);
    [-1, 1].forEach((s) => blob(body, '#ff6f91', s * 0.13, 0.8, -0.03, 0.08, 0.2, 0.38));
    blob(body, '#ff6f91', 0, 0.8, -0.26, 0.12, 0.1, 0.2);
    const legs = [-0.06, 0.06].map((x) => {
      const p = group(body, x, 0.68, 0);
      part(p, cylG(0.015, 0.015, 0.68, 6), '#f06292', 0, -0.34, 0);
      part(p, sphG(0.03, 6), '#f06292', 0, -0.34, 0);
      blob(p, '#f06292', 0, -0.67, 0.04, 0.09, 0.02, 0.14);
      return p;
    });
    const neck = [];
    let p = group(body, 0, 0.86, 0.18);
    p.rotation.x = 0.9;
    [0.9, -0.7, -0.9, 0.5].forEach((bend, i) => {
      part(p, cylG(0.035, 0.04, 0.2, 8), c, 0, 0.1, 0);
      neck.push(p);
      p = group(p, 0, 0.19, 0);
      p.rotation.x = [-0.7, -0.9, 0.5, 1.3][i];
    });
    part(p, sphG(0.065, 10), c, 0, 0.02, 0);
    part(p, coneG(0.035, 0.12, 8), '#fff3e0', 0, 0.1, 0);
    part(p, coneG(0.02, 0.06, 8), '#212121', 0, 0.17, 0);
    eyes(p, 0.045, 0.03, 0.03, 0.018);
    return { g, legs, speed: 0.3, size: 0.3, anim: (t, moving) => { neck[0].rotation.x = 0.9 + Math.sin(t * 0.8) * 0.12; if (!moving) legs[0].rotation.x = -1.1; } };
  };

  B.crocodile = () => {
    const c = '#5d8a3a';
    const q = quad({ len: 1.0, h: 0.22, w: 0.4, legH: 0.07, legR: 0.05, color: c, belly: '#cddc9a' });
    q.legs.forEach((l, i) => { l.position.x *= 1.5; l.rotation.z = (i % 2 ? -1 : 1) * 0.5; });
    const head = group(q.body, 0, q.cy + 0.02, 0.46);
    blob(head, c, 0, 0, 0.2, 0.3, 0.16, 0.6);
    const jaw = group(head, 0, -0.03, 0.02);
    blob(jaw, '#cddc9a', 0, -0.02, 0.2, 0.26, 0.07, 0.54);
    [-1, 1].forEach((s) => {
      part(head, sphG(0.05, 8), c, s * 0.08, 0.08, 0.04);
      part(head, sphG(0.028, 8), '#fff59d', s * 0.09, 0.1, 0.07);
      part(head, sphG(0.014, 6), '#1b1b1b', s * 0.095, 0.105, 0.09);
      for (let i = 0; i < 4; i++) part(head, coneG(0.014, 0.04, 5), '#ffffff', s * (0.11 - i * 0.012), -0.04, 0.16 + i * 0.08).rotation.x = Math.PI;
    });
    for (let i = 0; i < 6; i++) part(q.body, coneG(0.035, 0.07, 5), '#4a7030', 0, q.cy + 0.12, -0.36 + i * 0.14);
    const tail = chain(q.body, 0, q.cy, q.back + 0.08, 5, 0.17, 0.13, 0.03, c, 0);
    return { g: q.g, legs: q.legs, speed: 0.22, size: 0.6, anim: (t, moving) => { tail.forEach((s, i) => { s.rotation.y = Math.sin(t * (moving ? 4 : 1.5) - i * 0.7) * 0.22; }); jaw.rotation.x = moving ? 0 : Math.max(0, Math.sin(t * 0.7)) * 0.35; } };
  };

  root.ZooModels = { build: (id) => (B[id] || B.rabbit)() };
})(typeof window !== 'undefined' ? window : globalThis);
