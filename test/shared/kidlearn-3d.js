// סצנת תלת-ממד משותפת לאטרקציות של העיר (גן חיות, לונה פארק). אותו מראה ואותה שליטה כמו בעיר:
// מצלמה שמסתובבת בגרירה, זום, והדגשת החלקה שמתחת לסמן. דורש את three.min.js ו-OrbitControls.js.
//
//   const S = KidLearn3D.create({
//     container, bounds: () => ({ minC, maxC, minR, maxR }),
//     onTap: (c, r) => {}, hoverColor: (c, r) => '#ffeb3b' | null   // null = לא חלקה פעילה
//   });
//   S.ok            -> false אם אין תלת-ממד במכשיר
//   S.part(group, geo, color, x, y, z) ; S.box / S.cyl / S.cone / S.ico / S.tor
//   S.setCells(map) -> Map "c,r" -> Group (מחליף את כל מה שמצויר)
//   S.onFrame(fn)   -> fn(dt, t) בכל פריים (לאנימציות)
//   S.fit()         -> מרכז את המצלמה
(function (root) {
  function create(opts) {
    const T = root.THREE;
    const container = opts.container;
    const S = { ok: false };
    if (!T) { container.textContent = 'התלת-ממד לא נטען. רעננו את העמוד.'; return S; }

    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true }); }
    catch (e) { container.textContent = 'המכשיר הזה לא תומך בתלת-ממד.'; return S; }

    const touchScreen = !!(root.matchMedia && root.matchMedia('(pointer: coarse)').matches);
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, touchScreen ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const size = opts.cellSize || 1;   // גודל חלקה בעולם (ברירת מחדל 1)
    const sky = opts.sky || '#bfe9ff';
    const scene = new T.Scene();
    scene.background = new T.Color(sky);
    scene.fog = new T.Fog(sky, 22, 70);
    const camera = new T.PerspectiveCamera(40, 1, 0.1, 200);
    const controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 4;
    controls.maxDistance = 14;
    controls.maxPolarAngle = Math.PI * 0.42;

    scene.add(new T.HemisphereLight('#ffffff', '#7a9a55', 0.85));
    const sun = new T.DirectionalLight('#ffffff', 0.9);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(touchScreen ? 1024 : 2048, touchScreen ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun);

    // ---- עזרים לבניית צורות (כמו בעיר) ----
    const geoCache = new Map();
    const matCache = new Map();
    const cached = (cache, k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };
    const box = (w, h, d) => cached(geoCache, `b${w}|${h}|${d}`, () => new T.BoxGeometry(w, h, d));
    const cyl = (rt, rb, h, seg) => cached(geoCache, `c${rt}|${rb}|${h}|${seg}`, () => new T.CylinderGeometry(rt, rb, h, seg || 8));
    const cone = (r, h, seg) => cached(geoCache, `k${r}|${h}|${seg}`, () => new T.ConeGeometry(r, h, seg || 8));
    const ico = (r) => cached(geoCache, `i${r}`, () => new T.IcosahedronGeometry(r, 1));
    const tor = (r, tube) => cached(geoCache, `t${r}|${tube}`, () => new T.TorusGeometry(r, tube, 6, 20));
    const mat = (color, extra) => cached(matCache, color + '|' + JSON.stringify(extra || {}),
      () => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, extra || {})));
    function part(parent, geometry, color, x, y, z, extra) {
      const m = new T.Mesh(geometry, mat(color, extra));
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

    // הדשא שמתחת
    const base = new T.Mesh(box(60, 0.1, 60), mat(opts.ground || '#5f9c45'));
    base.position.y = -0.15;
    base.receiveShadow = true;
    scene.add(base);

    const hoverMesh = new T.Mesh(
      new T.PlaneGeometry(0.96, 0.96),
      new T.MeshBasicMaterial({ color: '#ffeb3b', transparent: true, opacity: 0.45, depthWrite: false })
    );
    hoverMesh.rotation.x = -Math.PI / 2;
    hoverMesh.scale.set(size, size, 1);
    hoverMesh.position.y = 0.04;
    hoverMesh.visible = false;
    scene.add(hoverMesh);

    const raycaster = new T.Raycaster();
    const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    const frameFns = [];
    let drawn = new Map();

    function cellAt(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = new T.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const p = new T.Vector3();
      if (!raycaster.ray.intersectPlane(groundPlane, p)) return null;
      const c = Math.round(p.x / size), r = Math.round(p.z / size);
      return opts.hoverColor(c, r) ? { c, r, x: p.x, z: p.z } : null;
    }
    function updateHover(e) {
      const cell = cellAt(e);
      if (!cell) { hoverMesh.visible = false; return; }
      hoverMesh.position.x = cell.c * size;
      hoverMesh.position.z = cell.r * size;
      hoverMesh.material.color.set(opts.hoverColor(cell.c, cell.r));
      hoverMesh.visible = true;
    }

    const canvas = renderer.domElement;
    const pointers = new Set();
    let pressX = 0, pressY = 0, dragged = false;
    canvas.addEventListener('pointerdown', (e) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) dragged = true;
      else { pressX = e.clientX; pressY = e.clientY; dragged = false; }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 6) dragged = true;
      updateHover(e);
    });
    canvas.addEventListener('pointerup', (e) => {
      const isTap = pointers.size === 1 && !dragged;
      pointers.delete(e.pointerId);
      if (!isTap) return;
      const cell = cellAt(e);
      if (cell && opts.onTap) opts.onTap(cell.c, cell.r, cell.x, cell.z);
    });
    canvas.addEventListener('pointercancel', (e) => { dragged = true; pointers.delete(e.pointerId); });
    canvas.addEventListener('pointerleave', () => { hoverMesh.visible = false; });

    function resize() {
      const w = container.clientWidth || 600;
      const h = Math.min(Math.round(w * 0.8), 440);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    function fit() {
      const b = opts.bounds();
      const cx = (b.minC + b.maxC) / 2 * size, cz = (b.minR + b.maxR) / 2 * size;
      controls.target.set(cx, 0, cz);
      // שטח קטן: המצלמה קרובה יותר, כדי שהגן לא ייראה זעיר
      const k = Math.max(0.6, Math.min(1.5, (Math.max(b.maxC - b.minC, b.maxR - b.minR) * size + 3) / 7));
      camera.position.set(cx, 6.4 * k, cz + 6.6 * k);
      controls.update();
    }
    function setCells(map) {
      drawn.forEach((g) => scene.remove(g));
      drawn = map;
      drawn.forEach((g) => scene.add(g));
    }
    function add(g) { scene.add(g); return g; }

    let last = 0;
    function animate(now) {
      requestAnimationFrame(animate);
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      controls.update();
      frameFns.forEach((fn) => fn(dt, now / 1000));
      renderer.render(scene, camera);
    }

    resize();
    root.addEventListener('resize', resize);
    fit();
    requestAnimationFrame(animate);

    Object.assign(S, {
      ok: true, THREE: T, scene, camera, controls, renderer, box, cyl, cone, ico, tor, mat, part, setCells, add, fit,
      onFrame: (fn) => frameFns.push(fn),
      reduceMotion: !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches),
      // מספר "אקראי" קבוע לכל מקום (כדי שהמראה לא ישתנה בכל רענון)
      rnd: (seed, k) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); },
    });
    return S;
  }
  root.KidLearn3D = { create };
})(typeof window !== 'undefined' ? window : globalThis);
