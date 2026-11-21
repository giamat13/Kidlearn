// ערכת תלת-ממד משותפת למשחקי האטרקציות (גן חיות, לונה פארק).
// דורשת THREE (city-game/vendor/three.min.js). OrbitControls רשות.
// בלי WebGL הפונקציה createStage מחזירה null, והמשחק ממשיך לעבוד עם הלוחות בלבד.
//
//   const stage = K3D.createStage(document.getElementById('scene'), { ... });
//   K3D.part(group, K3D.boxG(1, 1, 1), '#ff0000', x, y, z);
//   stage.frame((dt, t) => { ... });  stage.onTap = (e) => stage.pick(e, [group]);
(function (root) {
  const THREE = root.THREE;
  if (!THREE) { root.K3D = null; return; }

  const geo = new Map();
  const mats = new Map();
  const texs = new Map();
  const glowMats = [];
  let nightNow = false;
  const cached = (m, k, f) => { if (!m.has(k)) m.set(k, f()); return m.get(k); };

  // --- גיאומטריה (במטמון) ---
  const boxG = (w, h, d) => cached(geo, `b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  const cylG = (rt, rb, h, seg) => cached(geo, `c${rt}|${rb}|${h}|${seg || 14}`, () => new THREE.CylinderGeometry(rt, rb, h, seg || 14));
  const coneG = (r, h, seg) => cached(geo, `k${r}|${h}|${seg || 14}`, () => new THREE.ConeGeometry(r, h, seg || 14));
  const sphG = (r, seg) => cached(geo, `s${r}|${seg || 14}`, () => new THREE.SphereGeometry(r, seg || 14, Math.max(8, Math.round((seg || 14) * 0.7))));
  const torusG = (r, tube, seg, arc) => cached(geo, `t${r}|${tube}|${seg || 28}|${arc || 0}`, () => new THREE.TorusGeometry(r, tube, 8, seg || 28, arc || Math.PI * 2));

  // צבעים: הקוד כותב צבעי מסך (sRGB), והתאורה מחושבת בליניארי
  const color = (c) => new THREE.Color(c).convertSRGBToLinear();

  function mat(c, extra) {
    const k = c + '|' + JSON.stringify(extra || {});
    return cached(mats, k, () => {
      const o = Object.assign({ roughness: 0.78, metalness: 0 }, extra || {});
      o.color = color(c);
      if (o.emissive) o.emissive = color(o.emissive);
      return new THREE.MeshStandardMaterial(o);
    });
  }

  // חומר זוהר (נורות, שלטים): חלש ביום וחזק בלילה
  function glow(c) {
    return cached(mats, 'glow|' + c, () => {
      const m = new THREE.MeshStandardMaterial({ color: color(c), emissive: color(c), emissiveIntensity: nightNow ? 1.8 : 0.35, roughness: 0.4 });
      glowMats.push(m);
      return m;
    });
  }

  function part(parent, geometry, c, x, y, z, extra) {
    const m = new THREE.Mesh(geometry, typeof c === 'string' ? mat(c, extra) : c);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function group(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(g);
    return g;
  }

  // גוון בהיר (f>1) או כהה (f<1)
  function tint(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
    return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
  }

  // מספר "אקראי" קבוע לפי זרע
  function rnd(seed, k) {
    const x = Math.sin(seed * 12.9898 + (k || 0) * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // --- טקסט ואימוג'י כתמונה ---
  function textTex(text, opts) {
    const o = opts || {};
    const k = text + '|' + (o.bg || '') + '|' + (o.fg || '');
    return cached(texs, k, () => {
      const px = 96;
      const cv = document.createElement('canvas');
      let ctx = cv.getContext('2d');
      const font = `700 ${px}px "Varela Round", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Arial, sans-serif`;
      ctx.font = font;
      const w = Math.max(px, Math.ceil(ctx.measureText(text).width)) + (o.bg ? 56 : 16);
      cv.width = w;
      cv.height = px + 40;
      ctx = cv.getContext('2d');
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      if (o.bg) {
        ctx.fillStyle = o.bg;
        const r = 36;
        ctx.beginPath();
        ctx.moveTo(r, 4); ctx.lineTo(w - r, 4); ctx.quadraticCurveTo(w - 4, 4, w - 4, r);
        ctx.lineTo(w - 4, cv.height - r); ctx.quadraticCurveTo(w - 4, cv.height - 4, w - r, cv.height - 4);
        ctx.lineTo(r, cv.height - 4); ctx.quadraticCurveTo(4, cv.height - 4, 4, cv.height - r);
        ctx.lineTo(4, r); ctx.quadraticCurveTo(4, 4, r, 4);
        ctx.fill();
      } else {
        ctx.lineWidth = 10;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.strokeText(text, w / 2, cv.height / 2 + 4);
      }
      ctx.fillStyle = o.fg || '#2d2d4a';
      ctx.fillText(text, w / 2, cv.height / 2 + 4);
      const t = new THREE.CanvasTexture(cv);
      t.encoding = THREE.sRGBEncoding;
      t.userData = { aspect: cv.width / cv.height };
      return t;
    });
  }

  // שלט שתמיד פונה למצלמה. size = הגובה ביחידות עולם
  function sprite(text, size, opts) {
    const t = textTex(text, opts);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
    s.scale.set((size || 1) * t.userData.aspect, size || 1, 1);
    return s;
  }

  // לוח שטוח עם טקסט (שלט על קיר)
  function sign(parent, text, w, x, y, z, opts) {
    const t = textTex(text, opts);
    const h = w / t.userData.aspect;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  function skyTex(top, bottom) {
    return cached(texs, 'sky|' + top + bottom, () => {
      const cv = document.createElement('canvas');
      cv.width = 4; cv.height = 256;
      const ctx = cv.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, top); g.addColorStop(1, bottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
      const t = new THREE.CanvasTexture(cv);
      t.encoding = THREE.sRGBEncoding;
      return t;
    });
  }

  // --- במה: מצלמה, אורות, שמיים, לחיצות ולולאת ציור ---
  function createStage(container, opts) {
    const o = Object.assign({
      sky: ['#58b7ff', '#dff4ff'], nightSky: ['#0b1033', '#3a2a6b'],
      fog: [45, 150], fov: 42, camPos: [0, 12, 15], target: [0, 0, 0],
      minDist: 5, maxDist: 42, shadow: 24, height: (w) => Math.max(300, Math.min(Math.round(w * 0.7), 560)),
    }, opts || {});
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
    const touch = !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, touch ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = skyTex(o.sky[0], o.sky[1]);
    scene.fog = new THREE.Fog(color(o.sky[1]), o.fog[0], o.fog[1]);
    const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.1, 400);
    camera.position.set(...o.camPos);

    let controls = null;
    if (THREE.OrbitControls) {
      controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.minDistance = o.minDist;
      controls.maxDistance = o.maxDist;
      controls.maxPolarAngle = Math.PI * 0.46;
      controls.target.set(...o.target);
      controls.update();
    } else {
      camera.lookAt(...o.target);
    }

    const hemi = new THREE.HemisphereLight(color('#eaf6ff'), color('#86a868'), 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(color('#fff1d0'), 1.5);
    sun.castShadow = true;
    const ms = touch ? 1024 : 2048;
    sun.shadow.mapSize.set(ms, ms);
    Object.assign(sun.shadow.camera, { left: -o.shadow, right: o.shadow, top: o.shadow, bottom: -o.shadow, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);
    const SUN_OFF = new THREE.Vector3(14, 26, 12);

    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const frames = [];
    const particles = [];
    const clouds = [];
    let rideCam = null;

    const stage = {
      THREE, renderer, scene, camera, controls, sun, hemi, touch, onTap: null, onHover: null, night: false,
      frame(cb) { frames.push(cb); },
      ndc(e) {
        const r = renderer.domElement.getBoundingClientRect();
        return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      },
      // מה נמצא מתחת לסמן: מחזיר את userData.pick הראשון שנמצא בדרך למעלה
      pick(e, roots) {
        raycaster.setFromCamera(stage.ndc(e), camera);
        const hits = raycaster.intersectObjects(roots, true);
        for (const h of hits) {
          let ob = h.object;
          while (ob) {
            if (ob.userData && ob.userData.pick !== undefined) return { pick: ob.userData.pick, point: h.point, object: ob };
            ob = ob.parent;
          }
        }
        return null;
      },
      groundPoint(e) {
        raycaster.setFromCamera(stage.ndc(e), camera);
        const p = new THREE.Vector3();
        return raycaster.ray.intersectPlane(ground, p) ? p : null;
      },
      // מכוון את המצלמה: מרכז, מרחק וגבולות
      look(tx, tz, dist, maxDist) {
        if (maxDist && controls) controls.maxDistance = maxDist;
        const t = new THREE.Vector3(tx, 0, tz);
        camera.position.set(tx, dist * 0.72, tz + dist * 0.78);
        if (controls) { controls.target.copy(t); controls.update(); } else camera.lookAt(t);
      },
      // פיצוץ קטן של אימוג'ים (לבבות, כוכבים, מטבעות)
      burst(pos, text, n, o2) {
        const p2 = Object.assign({ size: 0.45, up: 2.2, spread: 1.4, life: 1.1, gravity: 3 }, o2 || {});
        for (let i = 0; i < (n || 6); i++) {
          const s = sprite(Array.isArray(text) ? pick(text) : text, p2.size);
          s.material = s.material.clone();
          s.position.copy(pos);
          scene.add(s);
          particles.push({ s, vx: (Math.random() - 0.5) * p2.spread, vy: p2.up * (0.6 + Math.random() * 0.6), vz: (Math.random() - 0.5) * p2.spread, life: p2.life, max: p2.life, g: p2.gravity });
        }
      },
      // טקסט שעולה ונעלם ("+2 🪙")
      float(pos, text, size) {
        const s = sprite(text, size || 0.6);
        s.material = s.material.clone();
        s.position.copy(pos);
        scene.add(s);
        particles.push({ s, vx: 0, vy: 1.1, vz: 0, life: 1.4, max: 1.4, g: 0 });
      },
      addClouds(n, area, y) {
        const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
        for (let i = 0; i < n; i++) {
          const g = new THREE.Group();
          const puffs = 3 + Math.floor(Math.random() * 3);
          for (let k = 0; k < puffs; k++) {
            const m = new THREE.Mesh(sphG(1, 10), white);
            m.position.set((k - puffs / 2) * 1.1, Math.random() * 0.4, (Math.random() - 0.5) * 0.8);
            m.scale.set(1 + Math.random() * 0.6, 0.6 + Math.random() * 0.3, 0.9 + Math.random() * 0.4);
            g.add(m);
          }
          g.position.set((Math.random() - 0.5) * area * 2, y + Math.random() * 5, (Math.random() - 0.5) * area * 2);
          g.scale.setScalar(1 + Math.random() * 1.4);
          g.userData = { v: 0.25 + Math.random() * 0.4, area };
          scene.add(g);
          clouds.push(g);
        }
        stage.cloudMat = white;
      },
      setNight(on) {
        nightNow = stage.night = !!on;
        const sky = on ? o.nightSky : o.sky;
        scene.background = skyTex(sky[0], sky[1]);
        scene.fog.color.copy(color(sky[1]));
        hemi.intensity = on ? 0.42 : 0.95;
        hemi.color.copy(color(on ? '#8ea2ff' : '#eaf6ff'));
        sun.intensity = on ? 0.38 : 1.5;
        sun.color.copy(color(on ? '#9fb6ff' : '#fff1d0'));
        if (stage.cloudMat) stage.cloudMat.opacity = on ? 0.35 : 0.92;
        glowMats.forEach((m) => { m.emissiveIntensity = on ? 1.8 : 0.35; });
      },
      // מצלמת נסיעה: fn(camera, t) מציב את המצלמה בכל פריים. null מחזיר שליטה לילד
      setRideCam(fn) {
        if (fn && !rideCam) stage.savedCam = { p: camera.position.clone(), t: controls ? controls.target.clone() : null };
        rideCam = fn || null;
        if (controls) controls.enabled = !rideCam;
        if (!rideCam && stage.savedCam) {
          camera.position.copy(stage.savedCam.p);
          if (controls && stage.savedCam.t) { controls.target.copy(stage.savedCam.t); controls.update(); }
          stage.savedCam = null;
        }
      },
      resize() {
        const w = container.clientWidth || 320;
        const h = o.height(w);
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      },
    };

    stage.resize();
    root.addEventListener('resize', stage.resize);
    if (root.ResizeObserver) new ResizeObserver(stage.resize).observe(container);

    // לחיצה קצרה בלי גרירה = בחירה. גרירה או שתי אצבעות = סיבוב וזום
    const canvas = renderer.domElement;
    const pointers = new Set();
    let px = 0, py = 0, dragged = false;
    canvas.addEventListener('pointerdown', (e) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) dragged = true;
      else { px = e.clientX; py = e.clientY; dragged = false; }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - px, e.clientY - py) > 7) dragged = true;
      if (stage.onHover && !pointers.size) stage.onHover(e);
    });
    canvas.addEventListener('pointerup', (e) => {
      const tap = pointers.size === 1 && !dragged;
      pointers.delete(e.pointerId);
      if (tap && stage.onTap && !rideCam) stage.onTap(e);
    });
    canvas.addEventListener('pointercancel', (e) => { dragged = true; pointers.delete(e.pointerId); });
    canvas.addEventListener('pointerleave', () => { if (stage.onHover) stage.onHover(null); });

    let last = 0, time = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      time += dt;
      frames.forEach((f) => f(dt, time));
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.vy -= p.g * dt;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        p.s.material.opacity = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
        if (p.life <= 0) { scene.remove(p.s); p.s.material.dispose(); particles.splice(i, 1); }
      }
      clouds.forEach((c) => {
        c.position.x += c.userData.v * dt;
        if (c.position.x > c.userData.area) c.position.x = -c.userData.area;
      });
      if (rideCam) rideCam(camera, time);
      else if (controls) controls.update();
      // השמש עוקבת אחרי מרכז המבט, כדי שהצל יהיה חד בכל מקום
      const tg = controls ? controls.target : new THREE.Vector3();
      sun.target.position.copy(tg);
      sun.position.copy(tg).add(SUN_OFF);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
    return stage;
  }

  // --- מודלים משותפים ---
  const SHIRTS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#ff7043', '#00acc1', '#f06292'];
  const PANTS = ['#37474f', '#5d4037', '#283593', '#455a64'];
  const SKINS = ['#f1c27d', '#8d5524', '#ffdbac', '#c68642'];
  const HAIRS = ['#3e2723', '#212121', '#a1662f', '#f4d03f', '#6d4c41'];

  // אדם קטן: רגליים וזרועות על צירים כדי שיתנדנדו בהליכה. o.kid = ילד, o.balloon = צבע בלון
  function person(o) {
    o = o || {};
    const g = new THREE.Group();
    const shirt = o.shirt || pick(SHIRTS);
    const skin = pick(SKINS);
    const pants = pick(PANTS);
    part(g, cylG(0.1, 0.12, 0.3, 10), shirt, 0, 0.47, 0);
    part(g, sphG(0.11, 12), skin, 0, 0.74, 0);
    const hair = part(g, sphG(0.115, 12), pick(HAIRS), 0, 0.77, -0.015);
    hair.scale.set(1, 0.75, 1);
    part(g, sphG(0.016, 6), '#212121', -0.04, 0.75, 0.1);
    part(g, sphG(0.016, 6), '#212121', 0.04, 0.75, 0.1);
    const legs = [-0.055, 0.055].map((x) => {
      const p = group(g, x, 0.32, 0);
      part(p, cylG(0.045, 0.04, 0.3, 8), pants, 0, -0.15, 0);
      part(p, boxG(0.08, 0.04, 0.13), '#263238', 0, -0.3, 0.025);
      return p;
    });
    const arms = [-0.14, 0.14].map((x) => {
      const p = group(g, x, 0.6, 0);
      part(p, cylG(0.035, 0.03, 0.26, 8), shirt, 0, -0.13, 0);
      part(p, sphG(0.035, 8), skin, 0, -0.27, 0);
      return p;
    });
    if (o.hat) {
      part(g, cylG(0.13, 0.13, 0.02, 12), o.hat, 0, 0.83, 0);
      part(g, cylG(0.08, 0.09, 0.08, 12), o.hat, 0, 0.87, 0);
    }
    if (o.balloon) {
      arms[1].rotation.x = -2.6;
      part(g, cylG(0.004, 0.004, 0.6, 4), '#eeeeee', 0.16, 1.15, 0.06);
      const b = part(g, sphG(0.14, 12), o.balloon, 0.16, 1.55, 0.06, { roughness: 0.25 });
      b.scale.set(1, 1.15, 1);
    }
    g.scale.setScalar((o.kid ? 0.72 : 1) * (o.scale || 1));
    return { g, legs, arms, hasBalloon: !!o.balloon, phase: Math.random() * 6 };
  }

  function walkPose(p, dt, speed) {
    p.phase += dt * 9 * (speed || 1);
    const s = Math.sin(p.phase);
    p.legs[0].rotation.x = s * 0.6;
    p.legs[1].rotation.x = -s * 0.6;
    p.arms[0].rotation.x = -s * 0.5;
    if (!p.hasBalloon) p.arms[1].rotation.x = s * 0.5;
  }
  function stillPose(p) {
    p.legs[0].rotation.x = p.legs[1].rotation.x = p.arms[0].rotation.x = 0;
    if (!p.hasBalloon) p.arms[1].rotation.x = 0;
  }

  const LEAVES = ['#2e7d32', '#388e3c', '#43a047', '#4caf50'];
  // עץ: round (עגול), pine (אורן), palm (דקל), blossom (פריחה)
  function tree(parent, x, z, s, seed, kind) {
    const g = group(parent, x, 0, z);
    seed = seed || 1;
    g.rotation.y = rnd(seed, 1) * 6.28;
    g.scale.setScalar(s || 1);
    if (kind === 'pine') {
      part(g, cylG(0.07, 0.1, 0.5, 8), '#6d4c41', 0, 0.25, 0);
      const c = LEAVES[Math.floor(rnd(seed, 2) * 2)];
      part(g, coneG(0.55, 0.8, 9), c, 0, 0.8, 0);
      part(g, coneG(0.43, 0.7, 9), tint(c, 1.1), 0, 1.25, 0);
      part(g, coneG(0.3, 0.6, 9), tint(c, 1.2), 0, 1.65, 0);
    } else if (kind === 'palm') {
      for (let i = 0; i < 5; i++) part(g, cylG(0.07 - i * 0.006, 0.08 - i * 0.006, 0.34, 8), i % 2 ? '#a1887f' : '#8d6e63', i * i * 0.012, 0.17 + i * 0.32, 0).rotation.z = -i * 0.05;
      const top = group(g, 0.3, 1.72, 0);
      for (let k = 0; k < 7; k++) {
        const f = group(top, 0, 0, 0);
        f.rotation.y = (k / 7) * 6.28;
        const leaf = part(f, sphG(0.5, 8), k % 2 ? '#388e3c' : '#43a047', 0.42, -0.08, 0);
        leaf.scale.set(1, 0.09, 0.3);
        leaf.rotation.z = -0.45;
      }
      part(top, sphG(0.07, 8), '#5d4037', 0.05, -0.08, 0.06);
      part(top, sphG(0.07, 8), '#5d4037', -0.06, -0.08, -0.03);
    } else {
      const c = kind === 'blossom' ? '#f48fb1' : LEAVES[Math.floor(rnd(seed, 2) * LEAVES.length)];
      part(g, cylG(0.07, 0.12, 0.7, 8), '#6d4c41', 0, 0.35, 0);
      part(g, cylG(0.03, 0.05, 0.3, 6), '#6d4c41', 0.12, 0.7, 0).rotation.z = -0.7;
      part(g, sphG(0.5, 12), c, 0, 1.1, 0);
      part(g, sphG(0.36, 12), tint(c, 1.13), 0.34, 0.95, 0.12);
      part(g, sphG(0.34, 12), tint(c, 0.88), -0.3, 0.92, -0.16);
      part(g, sphG(0.3, 12), tint(c, 1.06), 0.02, 1.42, 0.1);
      if (kind === 'blossom') for (let k = 0; k < 6; k++) part(g, sphG(0.06, 6), '#fff0f5', (rnd(seed, 10 + k) - 0.5) * 0.9, 1 + rnd(seed, 20 + k) * 0.6, (rnd(seed, 30 + k) - 0.5) * 0.9);
    }
    return g;
  }

  function bush(parent, x, z, s, seed) {
    const g = group(parent, x, 0, z);
    g.scale.setScalar(s || 1);
    const c = LEAVES[Math.floor(rnd(seed || 1, 3) * LEAVES.length)];
    part(g, sphG(0.28, 10), c, 0, 0.2, 0).scale.set(1.1, 0.8, 1);
    part(g, sphG(0.2, 10), tint(c, 1.12), 0.22, 0.16, 0.08);
    part(g, sphG(0.18, 10), tint(c, 0.9), -0.2, 0.14, -0.06);
    return g;
  }

  function rock(parent, x, z, s, seed) {
    const m = part(parent, cached(geo, 'rock', () => new THREE.DodecahedronGeometry(0.3, 0)), rnd(seed || 1, 4) > 0.5 ? '#9e9e9e' : '#8d8d8d', x, 0.16 * (s || 1), z, { roughness: 1 });
    m.scale.set((s || 1) * (0.9 + rnd(seed || 1, 5) * 0.5), (s || 1) * 0.7, (s || 1));
    m.rotation.y = rnd(seed || 1, 6) * 6.28;
    return m;
  }

  function flowers(parent, x, z, seed, n) {
    const cols = ['#f06292', '#ffd54f', '#ff8a65', '#ba68c8', '#ffffff', '#ef5350'];
    for (let k = 0; k < (n || 5); k++) {
      const fx = x + (rnd(seed, 40 + k) - 0.5) * 0.7, fz = z + (rnd(seed, 50 + k) - 0.5) * 0.7;
      part(parent, cylG(0.012, 0.012, 0.16, 5), '#558b2f', fx, 0.08, fz);
      part(parent, sphG(0.055, 8), cols[Math.floor(rnd(seed, 60 + k) * cols.length)], fx, 0.18, fz);
    }
  }

  // פנס רחוב עם נורה שזוהרת בלילה
  function lamp(parent, x, z, h) {
    h = h || 1.5;
    const g = group(parent, x, 0, z);
    part(g, cylG(0.07, 0.09, 0.1, 10), '#37474f', 0, 0.05, 0);
    part(g, cylG(0.028, 0.035, h, 8), '#455a64', 0, h / 2, 0);
    part(g, cylG(0.1, 0.06, 0.05, 10), '#37474f', 0, h + 0.02, 0);
    const b = new THREE.Mesh(sphG(0.1, 10), glow('#fff3b0'));
    b.position.set(0, h + 0.13, 0);
    g.add(b);
    return g;
  }

  function bench(parent, x, z, rot) {
    const g = group(parent, x, 0, z);
    g.rotation.y = rot || 0;
    part(g, boxG(0.7, 0.05, 0.24), '#a1887f', 0, 0.24, 0);
    part(g, boxG(0.7, 0.2, 0.04), '#8d6e63', 0, 0.42, -0.12).rotation.x = -0.15;
    [-0.3, 0.3].forEach((bx) => {
      part(g, boxG(0.05, 0.24, 0.24), '#37474f', bx, 0.12, 0);
      part(g, boxG(0.05, 0.05, 0.3), '#37474f', bx, 0.34, 0);
    });
    return g;
  }

  // גדר מקו (x1,z1) עד (x2,z2): עמודים וקורות. kind: wood / white / metal
  function fence(parent, x1, z1, x2, z2, o) {
    o = Object.assign({ h: 0.55, kind: 'wood', step: 0.8 }, o || {});
    const cols = { wood: ['#8d6e63', '#a1887f'], white: ['#f5f5f5', '#ffffff'], metal: ['#546e7a', '#90a4ae'], rope: ['#6d4c41', '#d7ccc8'] }[o.kind];
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.round(len / o.step));
    const g = group(parent, 0, 0, 0);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      part(g, o.kind === 'metal' ? cylG(0.03, 0.03, o.h, 6) : boxG(0.08, o.h, 0.08), cols[0], x1 + dx * t, o.h / 2, z1 + dz * t);
    }
    const rails = o.kind === 'metal' ? [0.25, 0.5, 0.75, 0.97] : [0.45, 0.85];
    rails.forEach((f) => {
      const r = part(g, boxG(len, o.kind === 'metal' ? 0.025 : 0.06, 0.035), cols[1], (x1 + x2) / 2, o.h * f, (z1 + z2) / 2);
      r.rotation.y = -Math.atan2(dz, dx);
    });
    return g;
  }

  // שרשרת דגלונים צבעוניים בין שתי נקודות
  function bunting(parent, a, b, n) {
    const cols = ['#ef5350', '#ffca28', '#42a5f5', '#66bb6a', '#ab47bc', '#ff7043'];
    const g = group(parent, 0, 0, 0);
    for (let i = 0; i <= (n || 8); i++) {
      const t = i / (n || 8);
      const sag = Math.sin(t * Math.PI) * 0.25;
      const f = part(g, coneG(0.07, 0.16, 3), cols[i % cols.length], a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t);
      f.rotation.x = Math.PI;
      f.castShadow = false;
    }
    return g;
  }

  root.K3D = {
    THREE, boxG, cylG, coneG, sphG, torusG, mat, glow, color, part, group, tint, rnd, pick, textTex, sprite, sign,
    createStage, person, walkPose, stillPose, tree, bush, rock, flowers, lamp, bench, fence, bunting,
  };
})(typeof window !== 'undefined' ? window : globalThis);
