// לונה פארק: מודלים תלת-ממדיים של המתקנים והדוכנים (צורות פשוטות, בלי קבצים חיצוניים).
// ParkModels.build(id) מחזיר { g, anim(t), seat }. seat = המקום שממנו רואים כש"עולים על המתקן".
// כל מתקן נבנה סביב (0,0,0) ונכנס במשבצת של 6 על 6. החזית היא +z.
(function (root) {
  const K = root.K3D;
  if (!K) { root.ParkModels = null; return; }
  const T = K.THREE;
  const { part, group, boxG, cylG, coneG, sphG, torusG } = K;
  const COL = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043', '#26c6da', '#ec407a'];
  const geoOnce = {};
  const once = (k, f) => geoOnce[k] || (geoOnce[k] = f());

  function bulb(p, x, y, z, c) {
    const m = new T.Mesh(sphG(0.07, 8), K.glow(c || '#fff3b0'));
    m.position.set(x, y, z);
    p.add(m);
    return m;
  }
  function ringBulbs(p, r, y, n) { for (let i = 0; i < n; i++) bulb(p, Math.cos(i / n * 6.283) * r, y, Math.sin(i / n * 6.283) * r, i % 2 ? '#fff3b0' : '#ffab91'); }
  // נוסע קטן שיושב
  function rider(p, x, y, z, i) {
    const g = group(p, x, y, z);
    part(g, sphG(0.11, 8), COL[i % 8], 0, 0, 0);
    part(g, sphG(0.085, 8), ['#f1c27d', '#8d5524', '#ffdbac'][i % 3], 0, 0.17, 0);
    return g;
  }
  // זוג רגלי A שמחזיקות ציר בגובה h
  function aFrame(g, z, h, half, c) {
    const len = Math.hypot(half, h), a = Math.atan2(half, h);
    [1, -1].forEach((s) => { part(g, boxG(0.16, len, 0.16), c, s * half / 2, h / 2, z).rotation.z = s * a; });
  }
  // ספסל בחזית המשבצת: עמדת כרטיסים קטנה
  function booth(g, x, z, c) {
    part(g, boxG(0.6, 0.8, 0.5), c, x, 0.4, z);
    part(g, coneG(0.5, 0.35, 4), '#fafafa', x, 0.98, z).rotation.y = Math.PI / 4;
  }

  const B = {};

  B.swing = () => {
    const g = new T.Group();
    part(g, cylG(1, 1.2, 0.3, 18), '#5c6bc0', 0, 0.15, 0);
    part(g, cylG(0.16, 0.22, 3.3, 12), '#fafafa', 0, 1.9, 0);
    [0.9, 1.7, 2.5].forEach((y, i) => part(g, cylG(0.19, 0.19, 0.2, 12), COL[i], 0, y, 0));
    const top = group(g, 0, 3.5, 0);
    part(top, cylG(2, 2, 0.14, 18), '#ffca28', 0, 0, 0);
    part(top, coneG(2, 0.9, 18), '#ef5350', 0, 0.5, 0);
    part(top, coneG(1, 0.6, 18), '#fafafa', 0, 0.95, 0);
    part(top, sphG(0.15, 10), '#ffca28', 0, 1.35, 0);
    ringBulbs(top, 2, -0.12, 12);
    const sw = [];
    let seat = null;
    for (let i = 0; i < 8; i++) {
      const th = i / 8 * 6.283;
      const a = group(top, Math.cos(th) * 1.7, -0.1, Math.sin(th) * 1.7);
      a.rotation.y = -th;
      const s = group(a, 0, 0, 0);
      part(s, cylG(0.012, 0.012, 1.6, 4), '#90a4ae', 0, -0.8, 0.12);
      part(s, cylG(0.012, 0.012, 1.6, 4), '#90a4ae', 0, -0.8, -0.12);
      part(s, boxG(0.3, 0.05, 0.32), COL[i], 0, -1.6, 0);
      const r = rider(s, 0, -1.45, 0, i);
      if (!seat) seat = r;
      sw.push(s);
    }
    return { g, seat, anim: (t) => { top.rotation.y = t * 1.1; const tilt = 0.6 + Math.sin(t * 0.5) * 0.12; sw.forEach((s) => { s.rotation.z = tilt; }); } };
  };

  B.carousel = () => {
    const g = new T.Group();
    part(g, cylG(2.2, 2.3, 0.25, 22), '#8e24aa', 0, 0.125, 0);
    const rot = group(g, 0, 0, 0);
    part(rot, cylG(2.05, 2.05, 0.08, 22), '#fff8e1', 0, 0.3, 0);
    part(rot, cylG(0.32, 0.36, 2.5, 14), '#f8bbd0', 0, 1.55, 0);
    [0.8, 1.5, 2.2].forEach((y) => part(rot, cylG(0.35, 0.35, 0.12, 14), '#ffca28', 0, y, 0));
    part(rot, cylG(2.3, 2.3, 0.2, 22), '#ffca28', 0, 2.85, 0);
    part(rot, coneG(2.3, 1.1, 22), '#ec407a', 0, 3.5, 0);
    part(rot, coneG(1.2, 0.8, 22), '#fff8e1', 0, 3.95, 0);
    part(rot, sphG(0.17, 10), '#ffca28', 0, 4.5, 0);
    ringBulbs(rot, 2.3, 2.7, 14);
    const horses = [];
    for (let i = 0; i < 6; i++) {
      const th = i / 6 * 6.283;
      const p = group(rot, Math.cos(th) * 1.5, 0, Math.sin(th) * 1.5);
      p.rotation.y = -th;
      part(p, cylG(0.03, 0.03, 2.5, 6), '#ffd54f', 0, 1.55, 0, { metalness: 0.6, roughness: 0.3 });
      const h = group(p, 0, 1, 0);
      const c = i % 2 ? '#fafafa' : '#a1887f';
      part(h, sphG(0.5, 12), c, 0, 0, 0).scale.set(0.42, 0.46, 0.9);
      part(h, cylG(0.08, 0.1, 0.4, 8), c, 0, 0.25, -0.34).rotation.x = -0.5;
      part(h, sphG(0.13, 10), c, 0, 0.44, -0.5).scale.set(0.9, 0.9, 1.4);
      part(h, boxG(0.04, 0.3, 0.3), '#5d4037', 0, 0.32, -0.3);
      [[-0.09, -0.25], [0.09, -0.25], [-0.09, 0.25], [0.09, 0.25]].forEach(([x, z]) => part(h, cylG(0.035, 0.03, 0.34, 6), c, x, -0.33, z));
      part(h, boxG(0.3, 0.06, 0.3), COL[i], 0, 0.22, 0.02);
      const r = rider(h, 0, 0.4, 0.02, i + 2);
      horses.push({ h, r });
    }
    return { g, seat: horses[0].r, anim: (t) => { rot.rotation.y = t * 0.7; horses.forEach((o, i) => { o.h.position.y = 1 + Math.sin(t * 2.4 + i * 2.1) * 0.22; }); } };
  };

  B.bumper = () => {
    const g = new T.Group();
    part(g, boxG(4.8, 0.12, 4.8), '#455a64', 0, 0.06, 0, { roughness: 0.4 });
    [[0, 2.4, 4.9, 0.2], [0, -2.4, 4.9, 0.2], [2.4, 0, 0.2, 4.9], [-2.4, 0, 0.2, 4.9]].forEach(([x, z, w, d], i) => part(g, boxG(w, 0.3, d), i % 2 ? '#ffca28' : '#ef5350', x, 0.2, z));
    [[-2.3, -2.3], [2.3, -2.3], [-2.3, 2.3], [2.3, 2.3]].forEach(([x, z]) => part(g, cylG(0.09, 0.09, 2.5, 8), '#fafafa', x, 1.25, z));
    part(g, boxG(5, 0.14, 5), '#1e88e5', 0, 2.55, 0);
    part(g, boxG(5.1, 0.1, 5.1), '#ffca28', 0, 2.45, 0);
    for (let i = 0; i < 10; i++) { bulb(g, -2.25 + i * 0.5, 2.36, 2.5); bulb(g, 2.5, 2.36, -2.25 + i * 0.5); bulb(g, -2.5, 2.36, -2.25 + i * 0.5); }
    const cars = [];
    for (let i = 0; i < 5; i++) {
      const c = group(g, 0, 0.12, 0);
      part(c, torusG(0.42, 0.09, 16), '#212121', 0, 0.12, 0).rotation.x = Math.PI / 2;
      part(c, cylG(0.4, 0.42, 0.26, 14), COL[i], 0, 0.2, 0);
      part(c, boxG(0.5, 0.3, 0.1), COL[i], 0, 0.4, -0.3);
      part(c, cylG(0.012, 0.012, 2.1, 4), '#90a4ae', 0, 1.3, -0.34);
      bulb(c, 0.2, 0.3, 0.38, '#fff3b0'); bulb(c, -0.2, 0.3, 0.38, '#fff3b0');
      const r = rider(c, 0, 0.42, 0, i);
      cars.push({ c, r, a: 0.5 + i * 0.13, b: 0.37 + i * 0.09, p: i * 1.7 });
    }
    return {
      g, seat: cars[0].r,
      anim: (t) => cars.forEach((o) => {
        const x = Math.sin(t * o.a + o.p) * 1.75, z = Math.cos(t * o.b + o.p * 1.3) * 1.75;
        const dx = Math.cos(t * o.a + o.p) * o.a, dz = -Math.sin(t * o.b + o.p * 1.3) * o.b;
        o.c.position.x = x; o.c.position.z = z;
        o.c.rotation.y = Math.atan2(dx, dz);
      }),
    };
  };

  B.ferris = () => {
    const g = new T.Group();
    const H = 3.1, R = 2.35;
    part(g, boxG(4, 0.2, 2), '#7e57c2', 0, 0.1, 0);
    aFrame(g, 0.7, H, 1.6, '#fafafa'); aFrame(g, -0.7, H, 1.6, '#fafafa');
    part(g, cylG(0.14, 0.14, 1.8, 10), '#ffca28', 0, H, 0).rotation.x = Math.PI / 2;
    booth(g, 1.9, 1.4, '#ef5350');
    const wheel = group(g, 0, H, 0);
    [0.35, -0.35].forEach((z) => {
      part(wheel, torusG(R, 0.06, 40), '#ef5350', 0, 0, z);
      part(wheel, torusG(R * 0.5, 0.04, 30), '#42a5f5', 0, 0, z);
      for (let i = 0; i < 4; i++) part(wheel, boxG(0.06, R * 2, 0.06), '#eceff1', 0, 0, z).rotation.z = i * Math.PI / 4;
    });
    part(wheel, cylG(0.3, 0.3, 0.9, 12), '#ffca28', 0, 0, 0).rotation.x = Math.PI / 2;
    const cabs = [];
    for (let i = 0; i < 8; i++) {
      const th = i / 8 * 6.283;
      const p = group(wheel, Math.cos(th) * R, Math.sin(th) * R, 0);
      bulb(p, 0, 0, 0.42); bulb(p, 0, 0, -0.42);
      part(p, cylG(0.03, 0.03, 0.7, 6), '#90a4ae', 0, 0, 0).rotation.x = Math.PI / 2;
      const c = group(p, 0, 0, 0);
      part(c, cylG(0.3, 0.24, 0.34, 12), COL[i], 0, -0.42, 0);
      part(c, coneG(0.36, 0.2, 12), COL[(i + 3) % 8], 0, 0.02, 0);
      [-0.22, 0.22].forEach((x) => part(c, cylG(0.015, 0.015, 0.36, 4), '#eceff1', x, -0.14, 0));
      const r = rider(c, 0, -0.28, 0, i);
      cabs.push({ c, r });
    }
    return { g, seat: cabs[0].r, anim: (t) => { wheel.rotation.z = t * 0.32; cabs.forEach((o) => { o.c.rotation.z = -wheel.rotation.z; }); } };
  };

  B.water = () => {
    const g = new T.Group();
    const curve = once('waterCurve', () => new T.CatmullRomCurve3([[-1.6, 3.15, -1.5], [0.4, 2.8, -2], [1.9, 2.1, -1], [1.7, 1.3, 0.5], [0.6, 0.6, 1.5], [-0.8, 0.3, 1.5]].map((p) => new T.Vector3(...p))));
    const tube = new T.Mesh(once('waterTube', () => new T.TubeGeometry(curve, 48, 0.3, 10, false)), K.mat('#29b6f6', { roughness: 0.25, transparent: true, opacity: 0.8 }));
    tube.castShadow = true;
    g.add(tube);
    // מגדל
    [[-2.1, -2], [-1.1, -2], [-2.1, -1], [-1.1, -1]].forEach(([x, z]) => part(g, cylG(0.07, 0.07, 3.1, 8), '#8d6e63', x, 1.55, z));
    part(g, boxG(1.3, 0.1, 1.3), '#a1887f', -1.6, 2.85, -1.5);
    part(g, coneG(1.05, 0.7, 4), '#ffca28', -1.6, 4.25, -1.5).rotation.y = Math.PI / 4;
    [[-2.1, -2], [-1.1, -2], [-2.1, -1], [-1.1, -1]].forEach(([x, z]) => part(g, cylG(0.04, 0.04, 1, 6), '#8d6e63', x, 3.4, z));
    for (let i = 0; i < 9; i++) part(g, boxG(0.5, 0.05, 0.08), '#d7ccc8', -2.3, 0.3 + i * 0.3, -1.5);
    [[0.4, -2, 2.6], [1.9, -1, 1.9], [1.7, 0.5, 1.1]].forEach(([x, z, h]) => part(g, cylG(0.06, 0.06, h, 6), '#90a4ae', x, h / 2, z));
    // בריכה
    part(g, boxG(3.6, 0.3, 2), '#eceff1', -0.6, 0.15, 1.5);
    part(g, boxG(3.3, 0.06, 1.7), '#4fc3f7', -0.6, 0.31, 1.5, { roughness: 0.1 }).castShadow = false;
    const boat = group(g, 0, 0, 0);
    part(boat, sphG(0.2, 10), '#ff7043', 0, 0, 0).scale.set(1, 0.6, 1.5);
    const r = rider(boat, 0, 0.12, 0, 2);
    const splash = K.sprite('💦', 0.7);
    splash.position.set(-0.9, 0.8, 1.5);
    g.add(splash);
    return {
      g, seat: r,
      anim: (t) => {
        const u = (t * 0.16) % 1, e = u * u * (3 - 2 * u);
        curve.getPointAt(e, boat.position);
        const tg = curve.getTangentAt(e);
        boat.rotation.y = Math.atan2(tg.x, tg.z);
        splash.visible = u > 0.9 || u < 0.06;
      },
    };
  };

  B.coaster = () => {
    const g = new T.Group();
    const curve = once('coasterCurve', () => new T.CatmullRomCurve3([[-2.3, 0.7, 2.2], [0, 0.6, 2.4], [2.3, 0.9, 2.1], [2.5, 2.4, 0], [2.1, 3.9, -2.1], [0, 2.2, -2.5], [-2.1, 3.3, -2.1], [-2.5, 1.7, 0]].map((p) => new T.Vector3(...p)), true));
    [[0.11, '#ef5350'], [-0.11, '#ef5350']].forEach(([off, c]) => {
      const m = new T.Mesh(once('coasterRail', () => new T.TubeGeometry(curve, 140, 0.045, 6, true)), K.mat(c, { metalness: 0.5, roughness: 0.35 }));
      m.position.y = off * 0.3; m.scale.set(1 + off * 0.35, 1, 1 + off * 0.35);
      m.castShadow = true;
      g.add(m);
    });
    const v = new T.Vector3();
    for (let i = 0; i < 16; i++) {
      curve.getPointAt(i / 16, v);
      const m = part(g, cylG(0.05, 0.05, 1, 6), '#eceff1', v.x, v.y / 2, v.z);
      m.scale.y = v.y;
      part(g, boxG(0.5, 0.05, 0.1), '#8d6e63', v.x, v.y - 0.06, v.z).rotation.y = Math.atan2(v.x, v.z);
    }
    part(g, boxG(2.4, 0.3, 1), '#7e57c2', 0, 0.15, 2.4);
    [-1.1, 1.1].forEach((x) => part(g, cylG(0.05, 0.05, 1.5, 6), '#fafafa', x, 0.9, 2.85));
    part(g, boxG(2.6, 0.1, 1.2), '#ffca28', 0, 1.7, 2.5);
    const carts = [];
    for (let i = 0; i < 3; i++) {
      const c = group(g, 0, 0, 0);
      c.rotation.order = 'YXZ';
      part(c, boxG(0.5, 0.26, 0.62), COL[i * 2], 0, 0.2, 0);
      part(c, boxG(0.5, 0.2, 0.08), COL[i * 2 + 1], 0, 0.4, 0.3);
      const r = rider(c, 0, 0.42, -0.05, i + 4);
      carts.push({ c, r });
    }
    let u = 0, last = 0;
    return {
      g, seat: carts[0].r,
      anim: (t) => {
        const dt = Math.min(0.1, t - last); last = t;
        curve.getPointAt(u % 1, v);
        u += dt * (0.05 + Math.max(0, 4.2 - v.y) * 0.03);   // מהר בירידות, לאט בעליות
        carts.forEach((o, i) => {
          const uu = (u - i * 0.035 + 1) % 1;
          curve.getPointAt(uu, o.c.position);
          const tg = curve.getTangentAt(uu);
          o.c.rotation.y = Math.atan2(tg.x, tg.z);
          o.c.rotation.x = -Math.asin(Math.max(-1, Math.min(1, tg.y)));
        });
      },
    };
  };

  B.teacups = () => {
    const g = new T.Group();
    part(g, cylG(2.3, 2.4, 0.2, 22), '#26c6da', 0, 0.1, 0);
    const rot = group(g, 0, 0.2, 0);
    part(rot, cylG(2.1, 2.1, 0.08, 22), '#fff8e1', 0, 0.04, 0);
    for (let i = 0; i < 8; i++) part(rot, cylG(0.22, 0.22, 0.09, 10), COL[i], Math.cos(i * 0.785) * 0.75, 0.045, Math.sin(i * 0.785) * 0.75);
    // קומקום במרכז
    part(rot, sphG(0.45, 14), '#f48fb1', 0, 0.5, 0).scale.set(1, 0.85, 1);
    part(rot, cylG(0.2, 0.2, 0.06, 12), '#fafafa', 0, 0.9, 0);
    part(rot, sphG(0.08, 8), '#ffca28', 0, 0.98, 0);
    part(rot, coneG(0.1, 0.5, 8), '#f48fb1', 0.5, 0.6, 0).rotation.z = -1;
    part(rot, torusG(0.2, 0.05, 14), '#f48fb1', -0.48, 0.5, 0);
    const cups = [];
    for (let i = 0; i < 5; i++) {
      const th = i / 5 * 6.283;
      const c = group(rot, Math.cos(th) * 1.45, 0.08, Math.sin(th) * 1.45);
      part(c, cylG(0.56, 0.5, 0.05, 16), '#fafafa', 0, 0.025, 0);
      part(c, cylG(0.46, 0.32, 0.45, 16), COL[i + 1], 0, 0.28, 0);
      part(c, cylG(0.4, 0.4, 0.02, 16), K.tint(COL[i + 1], 0.6), 0, 0.5, 0);
      part(c, torusG(0.16, 0.045, 12), COL[i + 1], 0.5, 0.28, 0);
      const r = rider(c, 0.14, 0.52, 0, i);
      rider(c, -0.14, 0.52, 0, i + 3);
      cups.push({ c, r });
    }
    return { g, seat: cups[0].r, anim: (t) => { rot.rotation.y = t * 0.45; cups.forEach((o, i) => { o.c.rotation.y = t * (i % 2 ? 2.4 : -2) + i; }); } };
  };

  B.pirate = () => {
    const g = new T.Group();
    const H = 3.6;
    part(g, boxG(4.4, 0.2, 2.4), '#5d4037', 0, 0.1, 0);
    aFrame(g, 1, H, 1.5, '#ffca28'); aFrame(g, -1, H, 1.5, '#ffca28');
    part(g, cylG(0.12, 0.12, 2.3, 10), '#455a64', 0, H, 0).rotation.x = Math.PI / 2;
    const sw = group(g, 0, H, 0);
    [0.55, -0.55].forEach((z) => { part(sw, boxG(0.1, 2.5, 0.1), '#eceff1', 0.5, -1.2, z).rotation.z = 0.2; part(sw, boxG(0.1, 2.5, 0.1), '#eceff1', -0.5, -1.2, z).rotation.z = -0.2; });
    const ship = group(sw, 0, -2.7, 0);
    part(ship, sphG(0.5, 16), '#6d4c41', 0, 0, 0).scale.set(3.4, 1, 1.3);
    part(ship, boxG(2.6, 0.08, 1.1), '#a1887f', 0, 0.3, 0);
    part(ship, boxG(2.8, 0.2, 0.06), '#ffca28', 0, 0.42, 0.58);
    part(ship, boxG(2.8, 0.2, 0.06), '#ffca28', 0, 0.42, -0.58);
    part(ship, coneG(0.2, 0.9, 8), '#ffca28', 1.9, 0.25, 0).rotation.z = -1.2;
    part(ship, boxG(0.3, 0.5, 0.9), '#5d4037', -1.5, 0.5, 0);
    part(ship, cylG(0.04, 0.04, 1.2, 6), '#3e2723', 0, 0.9, 0);
    part(ship, boxG(0.5, 0.32, 0.02), '#212121', 0.27, 1.3, 0);
    K.sign(ship, '☠️', 0.26, 0.27, 1.3, 0.02);
    let seat = null;
    for (let i = 0; i < 6; i++) { const r = rider(ship, -1 + i * 0.4, 0.45, i % 2 ? 0.25 : -0.25, i); if (i === 5) seat = r; }
    return { g, seat, anim: (t) => { sw.rotation.z = Math.sin(t * 1.25) * 1.05; } };
  };

  B.tower = () => {
    const g = new T.Group();
    part(g, cylG(1.4, 1.6, 0.3, 8), '#37474f', 0, 0.15, 0);
    part(g, boxG(0.7, 6.4, 0.7), '#eceff1', 0, 3.5, 0);
    for (let i = 0; i < 6; i++) part(g, boxG(0.74, 0.25, 0.74), COL[i], 0, 1 + i * 1.05, 0);
    part(g, boxG(1.1, 0.25, 1.1), '#ef5350', 0, 6.8, 0);
    const star = new T.Mesh(sphG(0.3, 12), K.glow('#ffeb3b'));
    star.position.set(0, 7.25, 0);
    g.add(star);
    const ring = group(g, 0, 1, 0);
    [[0, 0.75, 1.9, 0.5], [0, -0.75, 1.9, 0.5], [0.75, 0, 0.5, 1.9], [-0.75, 0, 0.5, 1.9]].forEach(([x, z, w, d]) => part(ring, boxG(w, 0.3, d), '#1e88e5', x, 0, z));
    let seat = null;
    for (let i = 0; i < 8; i++) {
      const side = i >> 1, o = i % 2 ? 0.3 : -0.3;
      const p = [[o, 1.05], [o, -1.05], [1.05, o], [-1.05, o]][side];
      part(ring, boxG(0.3, 0.5, 0.3), '#ffca28', p[0], 0.25, p[1]);
      const r = rider(ring, p[0] * 1.12, 0.2, p[1] * 1.12, i);
      if (!seat) seat = r;
    }
    return {
      g, seat,
      anim: (t) => {
        const p = (t % 9) / 9;
        let y;
        if (p < 0.5) { const e = p / 0.5; y = 0.9 + (5.9 - 0.9) * e * e * (3 - 2 * e); }
        else if (p < 0.68) y = 5.9 + Math.sin(t * 20) * 0.015;
        else if (p < 0.78) { const e = (p - 0.68) / 0.1; y = 5.9 - (5.9 - 1.4) * e * e; }
        else { const e = (p - 0.78) / 0.22; y = 0.9 + 0.5 * Math.abs(Math.cos(e * 9.4)) * (1 - e); }
        ring.position.y = y;
      },
    };
  };

  // ---- דוכנים ----
  function stand(g, c1, c2) {
    part(g, boxG(1.8, 1, 1.2), c1, 0, 0.5, 0);
    part(g, boxG(1.9, 0.08, 1.3), '#fafafa', 0, 1.04, 0);
    [[-0.85, 0.55], [0.85, 0.55], [-0.85, -0.55], [0.85, -0.55]].forEach(([x, z]) => part(g, cylG(0.04, 0.04, 1.3, 6), '#eceff1', x, 1.65, z));
    part(g, boxG(2.2, 0.12, 1.7), c2, 0, 2.35, 0.1);
    for (let i = 0; i < 4; i++) part(g, boxG(0.28, 0.13, 1.72), '#fafafa', -0.83 + i * 0.55, 2.35, 0.1);
    for (let i = 0; i < 6; i++) bulb(g, -1 + i * 0.4, 2.25, 0.95);
  }
  B.popcorn = () => {
    const g = new T.Group();
    stand(g, '#ef5350', '#ef5350');
    part(g, boxG(0.8, 0.7, 0.7), '#e3f2fd', 0, 1.45, 0, { transparent: true, opacity: 0.45, roughness: 0.1 }).castShadow = false;
    for (let i = 0; i < 14; i++) part(g, sphG(0.09, 6), i % 3 ? '#fff9c4' : '#ffe082', (K.rnd(i, 1) - 0.5) * 0.6, 1.15 + K.rnd(i, 2) * 0.35, (K.rnd(i, 3) - 0.5) * 0.5);
    const s = K.sprite('🍿', 0.9);
    s.position.set(0, 3.1, 0);
    g.add(s);
    return { g, anim: (t) => { s.position.y = 3.1 + Math.sin(t * 2) * 0.08; } };
  };
  B.icecream = () => {
    const g = new T.Group();
    stand(g, '#81d4fa', '#f06292');
    const c = group(g, 0, 2.5, 0);
    part(c, coneG(0.35, 0.9, 12), '#d7a86e', 0, 0.45, 0).rotation.x = Math.PI;
    part(c, sphG(0.36, 12), '#f8bbd0', 0, 1.05, 0);
    part(c, sphG(0.3, 12), '#fff9c4', 0, 1.5, 0);
    part(c, sphG(0.09, 8), '#e53935', 0, 1.85, 0);
    return { g, anim: (t) => { c.rotation.y = t * 0.8; } };
  };
  B.balloon = () => {
    const g = new T.Group();
    stand(g, '#ce93d8', '#42a5f5');
    const bs = [];
    for (let i = 0; i < 9; i++) {
      const x = -0.9 + (i % 3) * 0.9 + (K.rnd(i, 4) - 0.5) * 0.3, z = (K.rnd(i, 5) - 0.5) * 0.6, h = 2.9 + (i / 3 | 0) * 0.45;
      part(g, cylG(0.006, 0.006, h - 1, 3), '#eeeeee', x, 1 + (h - 1) / 2, z).castShadow = false;
      const b = part(g, sphG(0.26, 12), COL[i % 8], x, h, z, { roughness: 0.2 });
      b.scale.set(1, 1.2, 1);
      bs.push({ b, h, i });
    }
    return { g, anim: (t) => bs.forEach((o) => { o.b.position.y = o.h + Math.sin(t * 1.5 + o.i) * 0.07; }) };
  };

  root.ParkModels = { build: (id) => (B[id] || B.swing)() };
})(typeof window !== 'undefined' ? window : globalThis);
