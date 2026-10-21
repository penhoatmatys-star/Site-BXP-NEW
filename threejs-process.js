/* ═══════════════════════════════════════════════════════════
   BXP – threejs-process.js
   "Performance Orbital Network" — Three.js 3D Scene
   Central gold sphere + 4 orbiting nodes + particle streams
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    if (typeof THREE === 'undefined') return;

    const section = document.getElementById('process');
    if (!section) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Canvas ── */
    const canvas = document.createElement('canvas');
    canvas.className = 'process-3d-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    section.insertBefore(canvas, section.firstChild);

    /* ── Renderer ── */
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      canvas.remove();
      return;
    }
    const isMobile = window.innerWidth < 768;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    renderer.setClearColor(0x000000, 0);

    /* WebGL context-loss recovery — avoid a permanently black scene. */
    let contextLost = false;
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();        /* allow the browser to restore the context */
      contextLost = true;
    }, false);
    canvas.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      resize();
      if (reducedMotion) animate();   /* redraw the single static frame */
    }, false);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 120);
    camera.position.z = 9.5;

    function resize() {
      const w = section.offsetWidth;
      const h = canvas.offsetHeight || Math.min(Math.max(window.innerHeight * 0.8, 600), 960);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, { passive: true });

    /* ── Colors ── */
    const C_GOLD   = 0xD4A820;
    const C_SILVER = 0xB8BEC8;
    const C_BRIGHT = 0xF2C43A;

    /* ══════════════════════════════════════════════════
       BACKGROUND STAR FIELD
    ══════════════════════════════════════════════════ */
    (function buildStars() {
      const N   = 2200;
      const pos = new Float32Array(N * 3);
      const col = new Float32Array(N * 3);
      const gC  = new THREE.Color(C_GOLD);
      const sC  = new THREE.Color(C_SILVER);

      for (let i = 0; i < N; i++) {
        pos[i*3]   = (Math.random() - 0.5) * 32;
        pos[i*3+1] = (Math.random() - 0.5) * 32;
        pos[i*3+2] = (Math.random() - 0.5) * 18 - 4;
        const c    = Math.random() > 0.45 ? gC : sC;
        col[i*3]   = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

      scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.024, vertexColors: true,
        transparent: true, opacity: 0.38,
        blending: THREE.AdditiveBlending, depthWrite: false
      })));
    })();

    /* ══════════════════════════════════════════════════
       CENTRAL CORE — BXP sphere
    ══════════════════════════════════════════════════ */
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    /* Solid inner sphere */
    const innerCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.52, 32, 32),
      new THREE.MeshBasicMaterial({
        color: C_BRIGHT, transparent: true, opacity: 0.92,
        blending: THREE.AdditiveBlending
      })
    );
    coreGroup.add(innerCore);

    /* Wireframe icosahedron — fast rotation */
    const icoFast = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 1),
      new THREE.MeshBasicMaterial({
        color: C_GOLD, wireframe: true,
        transparent: true, opacity: 0.20,
        blending: THREE.AdditiveBlending
      })
    );
    coreGroup.add(icoFast);

    /* Wireframe icosahedron — slow counter-rotation */
    const icoSlow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.55, 2),
      new THREE.MeshBasicMaterial({
        color: C_SILVER, wireframe: true,
        transparent: true, opacity: 0.07,
        blending: THREE.AdditiveBlending
      })
    );
    coreGroup.add(icoSlow);

    /* Glow halos */
    [{ r: 0.9,  o: 0.22 },
     { r: 1.4,  o: 0.09 },
     { r: 2.1,  o: 0.035 },
     { r: 3.0,  o: 0.012 }].forEach(({ r, o }) => {
      coreGroup.add(new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 16),
        new THREE.MeshBasicMaterial({
          color: C_GOLD, transparent: true, opacity: o,
          side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
        })
      ));
    });

    /* ══════════════════════════════════════════════════
       ORBITAL PLANES — 4 tilted rings
    ══════════════════════════════════════════════════ */
    const orbitDefs = [
      { radius: 3.6, tiltX:  10, tiltZ:  5,  speed: 0.24, phase: 0,              color: C_SILVER, label: '01' },
      { radius: 3.2, tiltX:  40, tiltZ: -7,  speed: 0.19, phase: Math.PI*0.5,    color: C_GOLD,   label: '02' },
      { radius: 4.0, tiltX: -16, tiltZ:  11, speed: 0.27, phase: Math.PI,        color: C_SILVER, label: '03' },
      { radius: 3.4, tiltX:  62, tiltZ:  0,  speed: 0.16, phase: Math.PI*1.5,    color: C_GOLD,   label: '04' },
    ];

    const orbitObjects = orbitDefs.map(def => {
      const group = new THREE.Group();
      group.rotation.x = THREE.MathUtils.degToRad(def.tiltX);
      group.rotation.z = THREE.MathUtils.degToRad(def.tiltZ);
      scene.add(group);

      /* Orbit ring line */
      const ringPts = [];
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.022) {
        ringPts.push(new THREE.Vector3(
          Math.cos(a) * def.radius, 0, Math.sin(a) * def.radius
        ));
      }
      group.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({
          color: def.color, transparent: true, opacity: 0.10,
          blending: THREE.AdditiveBlending
        })
      ));

      /* Node group */
      const nodeGroup = new THREE.Group();
      group.add(nodeGroup);

      /* Octahedron */
      nodeGroup.add(new THREE.Mesh(
        new THREE.OctahedronGeometry(0.26, 0),
        new THREE.MeshBasicMaterial({ color: def.color, blending: THREE.AdditiveBlending })
      ));

      /* Glow layers */
      [{ r: 0.46, o: 0.18 }, { r: 0.72, o: 0.08 }, { r: 1.1, o: 0.025 }].forEach(({ r, o }) => {
        nodeGroup.add(new THREE.Mesh(
          new THREE.SphereGeometry(r, 12, 12),
          new THREE.MeshBasicMaterial({
            color: def.color, transparent: true, opacity: o,
            side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
          })
        ));
      });

      /* Mini ring around node */
      const miniRingPts = [];
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.12) {
        miniRingPts.push(new THREE.Vector3(Math.cos(a) * 0.52, 0, Math.sin(a) * 0.52));
      }
      nodeGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(miniRingPts),
        new THREE.LineBasicMaterial({
          color: def.color, transparent: true, opacity: 0.45,
          blending: THREE.AdditiveBlending
        })
      ));

      return { group, nodeGroup, def };
    });

    /* ══════════════════════════════════════════════════
       PARTICLE STREAMS — center → each node
    ══════════════════════════════════════════════════ */
    const STREAM_N = 70;

    const streams = orbitObjects.map((orb, si) => {
      const pos = new Float32Array(STREAM_N * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: orb.def.color, size: 0.048,
        transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      scene.add(pts);

      const offsets = Array.from({ length: STREAM_N }, (_, i) => i / STREAM_N);
      return { geo, pos, offsets, orb, si };
    });

    /* ══════════════════════════════════════════════════
       CONNECTING LINES — center → node & node ↔ node
    ══════════════════════════════════════════════════ */
    function makeLine(color, opacity) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
        color, transparent: true, opacity,
        blending: THREE.AdditiveBlending
      }));
      scene.add(line);
      return line;
    }

    const centerLines = orbitObjects.map(o => makeLine(o.def.color, 0.20));
    const crossLines  = [[0,1],[1,2],[2,3],[3,0],[0,2],[1,3]].map(() => makeLine(C_SILVER, 0.05));
    const crossPairs  = [[0,1],[1,2],[2,3],[3,0],[0,2],[1,3]];

    /* ══════════════════════════════════════════════════
       MOUSE PARALLAX
    ══════════════════════════════════════════════════ */
    let mX = 0, mY = 0, cX = 0, cY = 0;
    document.addEventListener('mousemove', e => {
      mX = (e.clientX / window.innerWidth  - 0.5) * 2;
      mY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    /* ══════════════════════════════════════════════════
       INTERSECTION OBSERVER — pause when off-screen
    ══════════════════════════════════════════════════ */
    let visible = true;
    const obs = new IntersectionObserver(
      e => { visible = e[0].isIntersecting; },
      { threshold: 0.05 }
    );
    obs.observe(section);

    /* ══════════════════════════════════════════════════
       HELPERS
    ══════════════════════════════════════════════════ */
    function setLine(line, p0, p1) {
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, p0.x, p0.y, p0.z);
      pos.setXYZ(1, p1.x, p1.y, p1.z);
      pos.needsUpdate = true;
    }

    /* ══════════════════════════════════════════════════
       ANIMATION LOOP
    ══════════════════════════════════════════════════ */
    let time   = 0;
    const SPEED = reducedMotion ? 0 : 0.006;
    const ZERO  = new THREE.Vector3(0, 0, 0);
    /* Preallocated to avoid per-frame Vector3 churn (4 nodes × 60fps). */
    const worldPositions = orbitObjects.map(() => new THREE.Vector3());

    function animate() {
      /* Reduced-motion: render a single static frame instead of looping. */
      if (!visible || contextLost) { requestAnimationFrame(animate); return; }
      time += SPEED;

      /* Core */
      coreGroup.rotation.y  = time * 0.40;
      icoFast.rotation.y    = time * 0.55;
      icoFast.rotation.x    = time * 0.18;
      icoSlow.rotation.y    = -time * 0.14;
      icoSlow.rotation.x    = time * 0.09;
      const pulse = 1 + Math.sin(time * 2.6) * 0.055;
      innerCore.scale.setScalar(pulse);

      /* Orbit nodes */
      orbitObjects.forEach((orb, i) => {
        const angle = time * orb.def.speed + orb.def.phase;
        const r     = orb.def.radius;
        orb.nodeGroup.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        orb.nodeGroup.rotation.y = time * 1.6;
        orb.nodeGroup.rotation.x = time * 0.9;
        const nodePulse = 1 + Math.sin(time * 3.2 + i * 1.3) * 0.12;
        orb.nodeGroup.scale.setScalar(nodePulse);

        const wp = worldPositions[i];
        orb.nodeGroup.getWorldPosition(wp);

        /* center → node line */
        setLine(centerLines[i], ZERO, wp);
      });

      /* Particle streams */
      streams.forEach((stream, si) => {
        const nodeWp = worldPositions[si];
        const ctrlX = nodeWp.x * 0.35 + Math.sin(time * 1.2 + si * 1.8) * 2.0;
        const ctrlY = nodeWp.y * 0.35 + Math.cos(time * 0.9 + si * 1.2) * 1.5;
        const ctrlZ = nodeWp.z * 0.35 + Math.sin(time * 0.7 + si * 2.1) * 1.0;
        /* p0 is the origin (0,0,0); p2 is nodeWp — inlined to avoid per-particle object allocs */

        const offsets = stream.offsets;
        for (let i = 0; i < STREAM_N; i++) {
          const tp = offsets[i] = (offsets[i] + 0.014) % 1;
          const u = 1 - tp, ut2 = 2 * u * tp, tt = tp * tp;
          stream.pos[i*3]   = ut2 * ctrlX + tt * nodeWp.x;
          stream.pos[i*3+1] = ut2 * ctrlY + tt * nodeWp.y;
          stream.pos[i*3+2] = ut2 * ctrlZ + tt * nodeWp.z;
        }
        stream.geo.attributes.position.needsUpdate = true;
      });

      /* Cross-connections node ↔ node */
      crossPairs.forEach(([a, b], i) => {
        const pa = worldPositions[a];
        const pb = worldPositions[b];
        if (pa && pb) setLine(crossLines[i], pa, pb);
      });

      /* Camera parallax */
      cX += (mX * 1.9 - cX) * 0.035;
      cY += (-mY * 1.1 - cY) * 0.035;
      camera.position.x = cX;
      camera.position.y = cY;
      camera.lookAt(0, 0, 0);

      /* Very slow scene drift */
      scene.rotation.y += 0.00035;

      renderer.render(scene, camera);

      /* Keep looping only when motion is allowed. */
      if (!reducedMotion) requestAnimationFrame(animate);
    }

    animate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
