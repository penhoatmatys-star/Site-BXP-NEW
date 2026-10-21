/* ═══════════════════════════════════════════════════════════
   BXP – threejs-hero.js
   Premium 3D WebGL Hero Background
   ▸ Particle nebula (gold + silver)
   ▸ Floating wireframe geometries (icosahedrons, torus, octahedrons)
   ▸ Mouse parallax with depth layers
   ▸ Constellation lines between nearby particles
   ▸ Subtle energy glow effect
   ▸ Mobile-adaptive performance
═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── WebGL detection ──────────────────────────────────── */
  function supportsWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!supportsWebGL()) return;

  /* ── Wait for THREE to load ───────────────────────────── */
  function whenReady(fn) {
    if (typeof THREE !== 'undefined') fn();
    else { setTimeout(() => whenReady(fn), 30); }
  }
  whenReady(buildScene);

  /* ══════════════════════════════════════════════════════
     MAIN SCENE
  ══════════════════════════════════════════════════════ */
  function buildScene() {
    const hero = document.getElementById('hero');
    if (!hero) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── Renderer ───────────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.5));
    renderer.setClearColor(0x000000, 0);

    const canvas = renderer.domElement;
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '3',
      pointerEvents: 'none',
      display: 'block',
    });
    canvas.setAttribute('aria-hidden', 'true');

    /* Insert between vignette and grain canvas */
    const vignette = hero.querySelector('.hero-vignette');
    hero.insertBefore(canvas, vignette ? vignette.nextSibling : hero.querySelector('#grain-canvas'));

    /* ── Scene & Camera ─────────────────────────────────── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    camera.position.set(0, 0, 40);

    /* ── Resize handler ─────────────────────────────────── */
    let W = 0, H = 0;
    function onResize() {
      W = hero.offsetWidth;
      H = hero.offsetHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
    }
    onResize();
    window.addEventListener('resize', onResize, { passive: true });

    /* ── Brand colors ───────────────────────────────────── */
    const C_GOLD    = new THREE.Color(0xD4A820);
    const C_GOLD_L  = new THREE.Color(0xF2C43A);
    const C_SILVER  = new THREE.Color(0xB8BEC8);
    const C_SILVER_L = new THREE.Color(0xD8DDE6);

    /* ════════════════════════════════════════════════════
       1. PARTICLE NEBULA
    ════════════════════════════════════════════════════ */
    const N_PARTICLES = isMobile ? 220 : 520;
    const pPositions  = new Float32Array(N_PARTICLES * 3);
    const pColors     = new Float32Array(N_PARTICLES * 3);
    const pSizes      = new Float32Array(N_PARTICLES);
    const pVelocities = [];

    for (let i = 0; i < N_PARTICLES; i++) {
      const i3 = i * 3;
      const r  = 35 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);

      pPositions[i3]     = r * Math.sin(phi) * Math.cos(theta);
      pPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * .65;
      pPositions[i3 + 2] = (Math.random() - .5) * 30;

      /* Color distribution: 60% gold, 25% gold-light, 15% silver */
      const rnd = Math.random();
      const c   = rnd < .6 ? C_GOLD : rnd < .85 ? C_GOLD_L : C_SILVER;
      pColors[i3] = c.r; pColors[i3+1] = c.g; pColors[i3+2] = c.b;

      pSizes[i] = Math.random() * 1.6 + .4;

      pVelocities.push({
        x: (Math.random() - .5) * .008,
        y: (Math.random() - .5) * .005,
        z: (Math.random() - .5) * .004,
      });
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeo.setAttribute('color',    new THREE.BufferAttribute(pColors,    3));
    pGeo.setAttribute('size',     new THREE.BufferAttribute(pSizes,     1));

    /* Custom shader material — glowing circles with smooth edges */
    const pMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:    { value: 0 },
        uOpacity: { value: .55 },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;
        void main() {
          vColor = color;
          // Breathing opacity per particle (staggered)
          vAlpha = 0.4 + 0.35 * sin(uTime * 0.8 + position.x * 0.15 + position.y * 0.1);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (280.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          // Smooth circle with glow
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float alpha = (1.0 - smoothstep(0.2, 0.5, d)) * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
    });

    const particleSystem = new THREE.Points(pGeo, pMat);
    scene.add(particleSystem);

    /* ════════════════════════════════════════════════════
       2. CONSTELLATION LINES (connect nearby particles)
    ════════════════════════════════════════════════════ */
    function buildConstellationLines() {
      const linePositions = [];
      const lineColors    = [];
      const threshold     = isMobile ? 10 : 12;
      const maxLines      = isMobile ? 60 : 150;
      let count = 0;

      for (let i = 0; i < N_PARTICLES && count < maxLines; i++) {
        const ax = pPositions[i*3], ay = pPositions[i*3+1], az = pPositions[i*3+2];
        for (let j = i + 1; j < N_PARTICLES && count < maxLines; j++) {
          const bx = pPositions[j*3], by = pPositions[j*3+1], bz = pPositions[j*3+2];
          const dist = Math.sqrt((ax-bx)**2 + (ay-by)**2 + (az-bz)**2);
          if (dist < threshold) {
            linePositions.push(ax,ay,az, bx,by,bz);
            const alpha = 1 - dist / threshold;
            const c = Math.random() > .5 ? C_GOLD : C_SILVER;
            lineColors.push(c.r,c.g,c.b, c.r,c.g,c.b);
            count++;
          }
        }
      }

      const lGeo = new THREE.BufferGeometry();
      lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      lGeo.setAttribute('color',    new THREE.Float32BufferAttribute(lineColors, 3));
      const lMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: .12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return new THREE.LineSegments(lGeo, lMat);
    }

    const constellations = buildConstellationLines();
    scene.add(constellations);

    /* ════════════════════════════════════════════════════
       3. FLOATING WIREFRAME GEOMETRIES
    ════════════════════════════════════════════════════ */
    const shapes = [];
    const N_SHAPES = isMobile ? 7 : 16;

    const GEOS = [
      () => new THREE.IcosahedronGeometry(1, 0),    // low-poly diamond
      () => new THREE.OctahedronGeometry(1, 0),     // crystal
      () => new THREE.TorusGeometry(.9, .22, 6, 20),// ring / medal
      () => new THREE.IcosahedronGeometry(.7, 1),   // rounder sphere
      () => new THREE.TetrahedronGeometry(1, 0),    // triangle solid
    ];

    for (let i = 0; i < N_SHAPES; i++) {
      const geoFn    = GEOS[i % GEOS.length];
      const isGold   = Math.random() > .38;
      const baseColor = isGold
        ? (Math.random() > .5 ? C_GOLD : C_GOLD_L)
        : (Math.random() > .5 ? C_SILVER : C_SILVER_L);

      const mat = new THREE.MeshBasicMaterial({
        color: baseColor,
        wireframe: true,
        transparent: true,
        opacity: Math.random() * .18 + .04,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geoFn(), mat);

      /* Spread across the scene, pushing back in Z */
      mesh.position.set(
        (Math.random() - .5) * 55,
        (Math.random() - .5) * 35,
        (Math.random() - .5) * 20 - 8,
      );

      const s = Math.random() * 3.5 + 1.2;
      mesh.scale.setScalar(s);

      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );

      /* Per-shape animation data */
      mesh.userData = {
        rx:     (Math.random() - .5) * .007,
        ry:     (Math.random() - .5) * .007,
        rz:     (Math.random() - .5) * .004,
        baseX:  mesh.position.x,
        baseY:  mesh.position.y,
        phase:  Math.random() * Math.PI * 2,
        speed:  Math.random() * .35 + .2,
        floatA: Math.random() * 1.8 + .6,   // amplitude X
        floatB: Math.random() * 1.2 + .4,   // amplitude Y
        depth:  mesh.position.z,
      };

      scene.add(mesh);
      shapes.push(mesh);
    }

    /* ════════════════════════════════════════════════════
       4. GLOW RINGS (large, very transparent tori)
    ════════════════════════════════════════════════════ */
    function addGlowRing(x, y, z, radius, color, opacity) {
      const geo = new THREE.TorusGeometry(radius, .04, 4, 64);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        wireframe: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.set(x, y, z);
      ring.rotation.x = Math.PI * .3;
      ring.rotation.y = Math.random() * Math.PI;
      ring.userData = { ry: .003 + Math.random() * .003 };
      scene.add(ring);
      return ring;
    }

    const glowRings = [
      addGlowRing( 8,  4, -12, 14, C_GOLD,   .06),
      addGlowRing(-10, -3, -15, 10, C_SILVER, .05),
      addGlowRing( 2, -6,  -8,  8, C_GOLD_L, .04),
    ];

    /* ════════════════════════════════════════════════════
       5. AMBIENT LIGHT FLARES (point sprites)
    ════════════════════════════════════════════════════ */
    function addFlare(x, y, z, color) {
      const geo = new THREE.SphereGeometry(.1, 8, 8);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: .0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.userData = { phase: Math.random() * Math.PI * 2, speed: .6 + Math.random() * .5 };
      scene.add(mesh);
      return mesh;
    }

    /* ── Mouse state ────────────────────────────────────── */
    let mouseX = 0, mouseY = 0;
    let smoothX = 0, smoothY = 0;

    document.addEventListener('mousemove', e => {
      mouseX = (e.clientX / window.innerWidth  - .5);
      mouseY = (e.clientY / window.innerHeight - .5);
    }, { passive: true });

    /* Gyro support for mobile */
    if (isMobile && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', e => {
        mouseX = (e.gamma || 0) / 45;
        mouseY = (e.beta  || 0) / 45 - .5;
      }, { passive: true });
    }

    /* ── Scroll: pause when hero is offscreen ───────────── */
    let heroVisible = true;
    const heroObserver = new IntersectionObserver(
      entries => { heroVisible = entries[0].isIntersecting; },
      { threshold: 0 }
    );
    heroObserver.observe(hero);

    /* ════════════════════════════════════════════════════
       ANIMATION LOOP
    ════════════════════════════════════════════════════ */
    let time = 0;
    let lastFrame = 0;
    let raf;

    function animate(now) {
      raf = requestAnimationFrame(animate);
      if (!heroVisible) return;

      /* Throttle to ~60fps */
      if (now - lastFrame < 14) return;
      lastFrame = now;

      if (!prefersReduced) {
        time += .012;
      }

      /* Smooth mouse */
      smoothX += (mouseX - smoothX) * .05;
      smoothY += (mouseY - smoothY) * .05;

      /* Camera parallax */
      camera.position.x += (smoothX * 5  - camera.position.x) * .04;
      camera.position.y += (-smoothY * 3 - camera.position.y) * .04;
      camera.lookAt(0, 0, 0);

      /* Update particle shader time */
      pMat.uniforms.uTime.value = time;

      /* Slowly rotate entire particle field */
      particleSystem.rotation.y = time * .025;
      particleSystem.rotation.x = time * .008;
      constellations.rotation.y = time * .025;
      constellations.rotation.x = time * .008;

      /* Animate shapes */
      shapes.forEach(obj => {
        const d = obj.userData;
        obj.rotation.x += d.rx;
        obj.rotation.y += d.ry;
        obj.rotation.z += d.rz;

        /* Float / breath */
        obj.position.x = d.baseX + Math.sin(time * d.speed + d.phase)      * d.floatA;
        obj.position.y = d.baseY + Math.cos(time * d.speed * .7 + d.phase) * d.floatB;

        /* Parallax by depth: closer = more movement */
        const depthFactor = Math.max(0, (15 + d.depth) / 15) * 1.5;
        obj.position.x += smoothX * depthFactor * 3;
        obj.position.y -= smoothY * depthFactor * 2;
      });

      /* Animate glow rings */
      glowRings.forEach(r => {
        r.rotation.y += r.userData.ry;
        r.rotation.z += r.userData.ry * .4;
      });

      renderer.render(scene, camera);
    }

    animate(0);

    /* ── Pause when tab is hidden ───────────────────────── */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && heroVisible) animate(0);
    });
  }

})();
