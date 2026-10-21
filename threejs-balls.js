/* ═══════════════════════════════════════════════════════════
   BXP – threejs-balls.js
   3D Sport Balls — Section Process Background
   ▸ Ballons football, tennis, volley, rugby, basket
   ▸ Textures canvas 2D générées procéduralement
   ▸ Flottement doux + rotation 3D
   ▸ Parallax au scroll
   ▸ Lumières dorées et argentées
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function supportsWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!supportsWebGL()) return;

  function whenThree(fn) {
    if (typeof THREE !== 'undefined') fn();
    else setTimeout(() => whenThree(fn), 30);
  }
  whenThree(buildBalls);

  /* ════════════════════════════════════════════════════
     BALL TEXTURE FACTORIES (Canvas 2D → THREE.CanvasTexture)
  ════════════════════════════════════════════════════ */

  function makeCanvas(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return [c, c.getContext('2d')];
  }

  /* ── Football (soccer) ─────────────────────────────
     White sphere + black pentagonal patches
     Approximation via equirectangular-like flat patterns */
  function makeFootballTexture() {
    const [c, ctx] = makeCanvas(512);
    // White base
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#111111';
    // Draw hexagonal patch pattern (simplified flat wrap)
    // Row 1 patches — top band
    const hexData = [
      { x: 256, y:  60, r: 52 },
      { x:  60, y: 160, r: 48 },
      { x: 456, y: 160, r: 48 },
      { x: 160, y: 256, r: 52 },
      { x: 356, y: 256, r: 52 },
      { x:  30, y: 356, r: 44 },
      { x: 256, y: 356, r: 50 },
      { x: 480, y: 356, r: 44 },
      { x: 110, y: 460, r: 46 },
      { x: 400, y: 460, r: 46 },
    ];
    hexData.forEach(({ x, y, r }) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 - Math.PI / 6;
        const px = x + r * Math.cos(angle);
        const py = y + r * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    });

    // Add pentagon on top/bottom (equirectangular poles)
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(256 + 38 * Math.cos(a), 14 + 28 * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5 + Math.PI / 2;
      ctx.lineTo(256 + 38 * Math.cos(a), 498 + 28 * Math.sin(a));
    }
    ctx.closePath();
    ctx.fill();

    return new THREE.CanvasTexture(c);
  }

  /* ── Tennis ball ───────────────────────────────────
     Yellow-green with white curved seam lines */
  function makeTennisTexture() {
    const [c, ctx] = makeCanvas(512);
    // Yellow-green base
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#c8e000');
    grad.addColorStop(0.5, '#b8d000');
    grad.addColorStop(1, '#a8c000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Felt texture (subtle noise)
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    // White seam — two S-shaped curves (characteristic tennis seam)
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';

    // First seam curve
    ctx.beginPath();
    ctx.moveTo(  0, 256);
    ctx.bezierCurveTo(128,  60, 384,  60, 512, 256);
    ctx.stroke();

    // Second seam curve (mirrored — wraps around sphere)
    ctx.beginPath();
    ctx.moveTo(  0, 256);
    ctx.bezierCurveTo(128, 450, 384, 450, 512, 256);
    ctx.stroke();

    // Thin dark edge on seams
    ctx.strokeStyle = 'rgba(150,180,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.bezierCurveTo(128, 60, 384, 60, 512, 256);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 256);
    ctx.bezierCurveTo(128, 450, 384, 450, 512, 256);
    ctx.stroke();

    return new THREE.CanvasTexture(c);
  }

  /* ── Volleyball ────────────────────────────────────
     White/blue/yellow panels */
  function makeVolleyballTexture() {
    const [c, ctx] = makeCanvas(512);
    // White base
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(0, 0, 512, 512);

    // Panel colors
    const panels = [
      { color: '#1565C0', y: 0,   h: 160 },   // blue top
      { color: '#f8f8f8', y: 160, h: 96  },   // white mid-top
      { color: '#F9A825', y: 256, h: 96  },   // yellow mid-bottom
      { color: '#1565C0', y: 352, h: 160 },   // blue bottom
    ];

    panels.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(0, p.y, 512, p.h);
    });

    // Vertical split panels (left half different)
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(0, 0, 256, 512);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#e8e8ff';
    ctx.fillRect(0, 0, 256, 512);
    ctx.globalCompositeOperation = 'source-over';

    // Seam lines
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 8;
    // Horizontal seam
    ctx.beginPath(); ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();
    // Vertical seam
    ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.stroke();
    // Diagonal seam
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(170, 100, 340, 412, 512, 512);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(512, 0);
    ctx.bezierCurveTo(340, 100, 170, 412, 0, 512);
    ctx.stroke();

    return new THREE.CanvasTexture(c);
  }

  /* ── Rugby ball ────────────────────────────────────
     Brown leather + white lace */
  function makeRugbyTexture() {
    const [c, ctx] = makeCanvas(512);
    // Leather gradient
    const grad = ctx.createRadialGradient(180, 160, 20, 256, 256, 300);
    grad.addColorStop(0, '#c4783a');
    grad.addColorStop(0.4, '#9e5a22');
    grad.addColorStop(1, '#5c2f0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Leather texture lines
    ctx.strokeStyle = 'rgba(80,35,5,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 30);
      ctx.bezierCurveTo(170, i * 30 + 8, 340, i * 30 - 8, 512, i * 30);
      ctx.stroke();
    }

    // White lace in center
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 12;
    // Main lace bar
    ctx.beginPath();
    ctx.moveTo(196, 256);
    ctx.lineTo(316, 256);
    ctx.stroke();
    // Lace stitches
    ctx.lineWidth = 5;
    [216, 236, 256, 276, 296].forEach(x => {
      ctx.beginPath();
      ctx.moveTo(x, 232);
      ctx.lineTo(x, 280);
      ctx.stroke();
    });

    // Seam lines
    ctx.strokeStyle = 'rgba(60,25,5,0.6)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.stroke();

    return new THREE.CanvasTexture(c);
  }

  /* ── Basketball ────────────────────────────────────
     Orange with black seam lines */
  function makeBasketballTexture() {
    const [c, ctx] = makeCanvas(512);
    // Orange gradient
    const grad = ctx.createRadialGradient(180, 150, 10, 256, 256, 280);
    grad.addColorStop(0, '#ff8c00');
    grad.addColorStop(0.5, '#e06800');
    grad.addColorStop(1, '#b84000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Pebble texture (subtle)
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 3000; i++) {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(Math.random() * 512, Math.random() * 512, Math.random() * 2 + .5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Black seam lines (3 great-circle approximations)
    ctx.strokeStyle = '#1a0a00';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';

    // Horizontal seam
    ctx.beginPath();
    ctx.moveTo(0, 256); ctx.lineTo(512, 256); ctx.stroke();

    // Vertical seam
    ctx.beginPath();
    ctx.moveTo(256, 0); ctx.lineTo(256, 512); ctx.stroke();

    // Left curved seam
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.bezierCurveTo(160, 128, 160, 384, 256, 512);
    ctx.stroke();

    // Right curved seam
    ctx.beginPath();
    ctx.moveTo(256, 0);
    ctx.bezierCurveTo(352, 128, 352, 384, 256, 512);
    ctx.stroke();

    return new THREE.CanvasTexture(c);
  }

  /* ════════════════════════════════════════════════════
     BUILD SCENE
  ════════════════════════════════════════════════════ */
  function buildBalls() {
    const section = document.getElementById('process');
    if (!section) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Make process section relative for absolute canvas */
    section.style.position = 'relative';
    section.style.overflow = 'hidden';

    /* ── Renderer ─────────────────────────────────── */
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = false;

    const canvas = renderer.domElement;
    Object.assign(canvas.style, {
      position:      'absolute',
      inset:         '0',
      width:         '100%',
      height:        '100%',
      zIndex:        '0',
      pointerEvents: 'none',
      display:       'block',
    });
    canvas.setAttribute('aria-hidden', 'true');
    section.insertBefore(canvas, section.firstChild);

    /* ── Scene ────────────────────────────────────── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 30);

    /* ── Lights ───────────────────────────────────── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    const goldLight = new THREE.PointLight(0xD4A820, 1.5, 60);
    goldLight.position.set(15, 10, 15);
    scene.add(goldLight);

    const silverLight = new THREE.PointLight(0xB8BEC8, 1.0, 60);
    silverLight.position.set(-15, -8, 10);
    scene.add(silverLight);

    /* ── Resize ───────────────────────────────────── */
    let W = 0, H = 0;
    function onResize() {
      W = section.offsetWidth;
      H = section.offsetHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H, false);
    }
    onResize();
    window.addEventListener('resize', onResize, { passive: true });

    /* ── Ball factory ─────────────────────────────── */
    const textures = [
      makeFootballTexture(),
      makeTennisTexture(),
      makeVolleyballTexture(),
      makeBasketballTexture(),
      makeRugbyTexture(),
    ];

    const ballTypes = [
      { name: 'football',   geo: () => new THREE.SphereGeometry(1, 32, 32),    texIdx: 0, scale: [1, 1, 1]        },
      { name: 'tennis',     geo: () => new THREE.SphereGeometry(.7, 28, 28),   texIdx: 1, scale: [1, 1, 1]        },
      { name: 'volleyball', geo: () => new THREE.SphereGeometry(.95, 28, 28),  texIdx: 2, scale: [1, 1, 1]        },
      { name: 'basketball', geo: () => new THREE.SphereGeometry(1, 28, 28),    texIdx: 3, scale: [1, 1, 1]        },
      { name: 'rugby',      geo: () => new THREE.SphereGeometry(.8, 28, 20),   texIdx: 4, scale: [.72, 1, 1.52]   },
    ];

    const balls = [];

    /* 3 ballons positionnés au niveau du titre "Our Process" (zone haute) */
    const ballConfigs = isMobile ? [] : [
      { typeIdx: 0, x: -13, y: 9.5, z: -4,  scale: 1.1  },  /* football — gauche */
      { typeIdx: 3, x:   0, y: 10.5, z: -6, scale: 1.0  },  /* basket   — centre */
      { typeIdx: 1, x:  13, y: 9.0, z: -3,  scale: 0.85 },  /* tennis   — droite */
    ];

    ballConfigs.forEach(cfg => {
      const type = ballTypes[cfg.typeIdx];
      const tex  = textures[type.texIdx];

      const mat  = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.52,
        metalness: 0.08,
        transparent: true,
        opacity: 0.82,
      });

      const mesh = new THREE.Mesh(type.geo(), mat);
      mesh.scale.setScalar(cfg.scale);
      mesh.position.set(cfg.x, cfg.y, cfg.z);
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
      );

      mesh.userData = {
        baseX:  cfg.x,
        baseY:  cfg.y,
        rotX:   (Math.random() - .5) * .010,
        rotY:   (Math.random() - .5) * .013,
        rotZ:   (Math.random() - .5) * .005,
        floatS: Math.random() * .25 + .15,
        floatA: Math.random() * .9 + .4,
        floatB: Math.random() * .6 + .25,
        phase:  Math.random() * Math.PI * 2,
      };

      scene.add(mesh);
      balls.push(mesh);
    });

    /* ── Scroll parallax ──────────────────────────── */
    let scrollY = 0;
    window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

    /* ── Visibility ───────────────────────────────── */
    let sectionVisible = false;
    const obs = new IntersectionObserver(
      entries => { sectionVisible = entries[0].isIntersecting; },
      { threshold: 0 }
    );
    obs.observe(section);

    /* ── Animation ────────────────────────────────── */
    let time = 0;
    let lastFrame = 0;

    function animate(now) {
      requestAnimationFrame(animate);
      if (!sectionVisible) return;
      if (now - lastFrame < 14) return;
      lastFrame = now;

      if (!prefersReduced) time += .012;

      /* Scroll parallax on camera */
      const sectionTop    = section.getBoundingClientRect().top + scrollY;
      const scrollIntoSec = Math.max(0, scrollY - sectionTop + window.innerHeight);
      camera.position.y   = scrollIntoSec * .004;

      /* Animate light pulse */
      goldLight.intensity   = 1.3 + Math.sin(time * .8) * .4;
      silverLight.intensity = 0.8 + Math.cos(time * .6) * .3;

      balls.forEach(ball => {
        const d = ball.userData;
        /* Spin */
        ball.rotation.x += d.rotX;
        ball.rotation.y += d.rotY;
        ball.rotation.z += d.rotZ;
        /* Float */
        ball.position.x = d.baseX + Math.sin(time * d.floatS + d.phase) * d.floatA;
        ball.position.y = d.baseY + Math.cos(time * d.floatS * .7 + d.phase) * d.floatB;
      });

      renderer.render(scene, camera);
    }
    animate(0);

    /* Pause when hidden */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && sectionVisible) animate(0);
    });
  }

})();
