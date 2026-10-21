/* ═══════════════════════════════════════════════════════════
   BXP – hero-field.js  v2
   Terrain de foot interactif + Animation d'entrée cinématique
   ─────────────────────────────────────────────────────────
   CLIC → Ballon lancé → Terrain zoome vers toi → Flash stade
        → La page se déroule vers le contenu
═══════════════════════════════════════════════════════════ */
(function () {
  const hero = document.getElementById('hero');
  const heroBg = document.getElementById('hero-bg');
  if (!hero) return;

  /* Photo hero mode — skip field canvas, keep click-enter animation */
  if (hero.dataset.photoHero === 'true') {
    _initPhotoHeroClick(hero);
    return;
  }

  /* WebGL/Canvas2D check — fall back gracefully on unsupported devices */
  try {
    const testC = document.createElement('canvas');
    const testCtx = testC.getContext('2d');
    if (!testCtx) throw new Error('no 2d');
  } catch (e) {
    return; /* static dark background already set in CSS */
  }

  if (heroBg) heroBg.style.display = 'none';

  /* ── Canvas setup ─────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position:      'absolute',
    inset:         '0',
    width:         '100%',
    height:        '100%',
    zIndex:        '0',
    pointerEvents: 'none', // les clics passent à travers → capturés sur le hero
    display:       'block',
  });
  canvas.setAttribute('aria-hidden', 'true');
  hero.insertBefore(canvas, hero.firstChild);

  const ctx = canvas.getContext('2d');
  let W = 0, H = 0;
  let fieldShift = 0;
  let _resizeW = -1; // tracks last width to ignore height-only changes (mobile address bar)

  function resize() {
    const newW = hero.offsetWidth;
    // Mobile: skip when only height changed (address bar collapse causes pitch teleport)
    if (newW === _resizeW && newW < 640) return;
    _resizeW = newW;
    W = newW;
    H = hero.offsetHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fieldShift = W < 640 ? 0 : W * 0.06;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  function getPitchBounds() {
    if (W < 640) {
      // Cinematic zoom: pitch is 2.5× the screen width so only the center is visible.
      // This fills the screen with grass markings — no black borders.
      const vpW = W * 2.5;
      const vpH = vpW * 0.62;
      const vpX = (W - vpW) / 2;              // negative → pitch extends off both sides
      const vpY = H * 0.34 - vpH * 0.5;       // center circle at 34% height
      return { x: vpX, y: vpY, w: vpW, h: vpH, cx: W / 2, cy: H * 0.34 };
    }
    return { x: 0, y: 0, w: W, h: H, cx: W / 2 + fieldShift, cy: H / 2 };
  }

  /* ── Mouse tracking ──────────────────────────────────── */
  let tx = 0.5, ty = 0.4, sx = 0.5, sy = 0.4;
  let mouseCanvasX = -1, mouseCanvasY = -1;
  const CLICK_RADIUS = 58;

  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width;
    ty = (e.clientY - r.top)  / r.height;
    mouseCanvasX = e.clientX - r.left;
    mouseCanvasY = e.clientY - r.top;
    /* Curseur pointer uniquement sur le cercle central (décalé) */
    if (!e.target.closest('a, button')) {
      const pitch = getPitchBounds();
      const dx = mouseCanvasX - pitch.cx;
      const dy = mouseCanvasY - pitch.cy;
      hero.style.cursor = Math.sqrt(dx*dx + dy*dy) <= CLICK_RADIUS ? 'pointer' : 'default';
    }
  }, { passive: true });

  hero.addEventListener('mouseleave', () => {
    mouseCanvasX = -1; mouseCanvasY = -1;
    hero.style.cursor = 'pointer';
  });

  hero.addEventListener('touchmove', e => {
    const r = hero.getBoundingClientRect();
    tx = (e.touches[0].clientX - r.left) / r.width;
    ty = (e.touches[0].clientY - r.top)  / r.height;
  }, { passive: true });

  function updateNavHover() { /* nav zones supprimées */ }

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,     y + h, x,     y + h - r, r);
    ctx.lineTo(x,    y + r);
    ctx.arcTo(x,     y,     x + r, y,         r);
    ctx.closePath();
  }

  /* ══════════════════════════════════════════════════════
     ANIMATION STATE
  ══════════════════════════════════════════════════════ */
  let entered      = false;  // animation triggered ?
  let zoom         = 1;      // field zoom factor
  let clickX       = W / 2;
  let clickY       = H / 2;
  let flash        = 0;      // 0→1 white flash
  let hintAlpha    = 0;      // "click to enter" hint
  let hintTimer    = 0;
  let ripples      = [];
  let speedLines   = [];
  let footballs    = [];

  /* ══════════════════════════════════════════════════════
     FIELD DRAWING
  ══════════════════════════════════════════════════════ */
  function drawField(zoom, originX, originY) {
    ctx.clearRect(0, 0, W, H);
    const mob = W < 640;

    /* Apply zoom transform from click origin */
    ctx.save();
    if (zoom !== 1) {
      ctx.translate(originX, originY);
      ctx.scale(zoom, zoom);
      ctx.translate(-originX, -originY);
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    const pitch = getPitchBounds();
    const pitchX = pitch.x;
    const pitchY = pitch.y;
    const VW = pitch.w;
    const VH = pitch.h;

    ctx.save();
    ctx.translate(pitchX, pitchY);

    /* ── Base dark grass ── */
    ctx.fillStyle = '#030f03';
    ctx.fillRect(0, 0, VW, VH);

    const STRIPES = 14;
    for (let i = 0; i < STRIPES; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(10,55,10,.92)' : 'rgba(18,72,12,.92)';
      ctx.fillRect(0, i * (VH / STRIPES), VW, VH / STRIPES);
    }

    /* ── Field markings ── */
    ctx.save();
    ctx.translate(mob ? 0 : fieldShift, 0);

    const lw  = Math.max(mob ? 1.8 : 1.5, VW * (mob ? .0044 : .0018));
    const PX  = VW * (mob ? .08 : .16), PY = VH * (mob ? .075 : .10);
    const FW  = VW - PX*2, FH = VH - PY*2;
    const cx  = VW / 2,    cy = VH / 2;

    ctx.strokeStyle = mob ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.78)';
    ctx.lineWidth   = lw;
    ctx.lineCap     = 'round';

    // Outer rect
    roundRect(ctx, PX, PY, FW, FH);

    // Half-line
    line(cx, PY, cx, PY + FH);

    // Center circle
    circle(cx, cy, Math.min(FW, FH) * .14);

    // Center dot
    dot(cx, cy, lw * 2.5, 'rgba(255,255,255,.9)');

    // Penalty areas
    const PAW = FW * .19, PAH = FH * .46;
    roundRect(ctx, PX,           cy - PAH/2, PAW, PAH);
    roundRect(ctx, PX+FW-PAW,    cy - PAH/2, PAW, PAH);

    // 6-yard boxes
    const GAW = FW * .065, GAH = FH * .20;
    roundRect(ctx, PX,        cy - GAH/2, GAW, GAH);
    roundRect(ctx, PX+FW-GAW, cy - GAH/2, GAW, GAH);

    // Goals (thicker)
    ctx.lineWidth = lw * 2.5;
    ctx.strokeStyle = mob ? 'rgba(255,255,255,.94)' : 'rgba(255,255,255,.95)';
    const GOALH = FH * .14, GOALD = FW * .013;
    goalRect(PX - GOALD, cy - GOALH/2, GOALD, GOALH);
    goalRect(PX + FW,    cy - GOALH/2, GOALD, GOALH);
    ctx.lineWidth = lw;
    ctx.strokeStyle = mob ? 'rgba(255,255,255,.78)' : 'rgba(255,255,255,.78)';

    // Penalty spots + arcs
    [PX + FW * .138, PX + FW * .862].forEach((px, i) => {
      dot(px, cy, lw * 2.5, 'rgba(255,255,255,.9)');
      const dr = Math.min(FW,FH) * .115;
      ctx.beginPath();
      if (i === 0) ctx.arc(px, cy, dr, -Math.PI*.38, Math.PI*.38);
      else         ctx.arc(px, cy, dr,  Math.PI*.62, Math.PI*1.38);
      ctx.stroke();
    });

    // Corner arcs
    const CR = Math.min(VW,VH) * .022;
    arcCorner(PX,    PY,    CR, 0,          Math.PI/2);
    arcCorner(PX+FW, PY,    CR, Math.PI/2,  Math.PI);
    arcCorner(PX,    PY+FH, CR, -Math.PI/2, 0);
    arcCorner(PX+FW, PY+FH, CR, Math.PI,    3*Math.PI/2);

    ctx.restore(); /* fin du décalage field markings */
    ctx.restore(); /* fin du terrain contenu mobile */
    ctx.restore(); /* fin du zoom */

    /* ── Spotlight interactive (pas de décalage) ── */
    const gx = sx * W, gy = sy * H;
    const sr = Math.min(W,H) * .7;
    const spot = ctx.createRadialGradient(gx, gy, 0, gx, gy, sr);
    spot.addColorStop(0,   'rgba(212,168,32,.18)');
    spot.addColorStop(.3,  'rgba(180,140,18,.08)');
    spot.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);

    /* ── Vignette ── */
    const vigOpacity = W < 640 ? .34 : .72;
    const vig = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*.1, W/2, H/2, Math.max(W,H)*.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${vigOpacity})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  }

  /* ── Helpers ────────────────────────────────────────── */
  function line(x1,y1,x2,y2){ ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); }
  function circle(x,y,r){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.stroke(); }
  function dot(x,y,r,c){ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); }
  function roundRect(c,x,y,w,h){ ctx.beginPath(); ctx.rect(x,y,w,h); ctx.stroke(); }
  function goalRect(x,y,w,h){ ctx.beginPath(); ctx.rect(x,y,w,h); ctx.stroke(); }
  function arcCorner(x,y,r,s,e){ ctx.beginPath(); ctx.arc(x,y,r,s,e); ctx.stroke(); }

  /* ══════════════════════════════════════════════════════
     "CLICK TO ENTER" HINT — centré sur le rond central
  ══════════════════════════════════════════════════════ */
  function drawHint(alpha) {
    if (alpha <= 0) return;
    const t     = Date.now() / 1000;
    const pulse = .72 + .28 * Math.sin(t * 2.2);

    const pitch = getPitchBounds();
    const rx = pitch.cx;
    const ry = pitch.cy;

    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    /* ── Outer pulsing ring ── */
    const outerR = 50 + Math.sin(t * 1.4) * 5;
    ctx.globalAlpha = alpha * pulse * .45;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth   = 1.2;
    ctx.beginPath();
    ctx.arc(rx, ry, outerR, 0, Math.PI * 2);
    ctx.stroke();

    /* ── Inner ring ── */
    const innerR = 32 + Math.sin(t * 1.8) * 3;
    ctx.globalAlpha = alpha * pulse * .8;
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth   = 2;
    ctx.shadowColor = 'rgba(255,215,0,.6)';
    ctx.shadowBlur  = 12;
    ctx.beginPath();
    ctx.arc(rx, ry, innerR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* ── Arrow icon ── */
    ctx.globalAlpha = alpha * (.65 + .35 * Math.sin(t * 2.6));
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.shadowColor = 'rgba(0,0,0,.7)';
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(rx, ry - 16);
    ctx.lineTo(rx, ry + 16);
    ctx.moveTo(rx - 11, ry + 5);
    ctx.lineTo(rx,      ry + 16);
    ctx.lineTo(rx + 11, ry + 5);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════
     FOOTBALL ICON (canvas 2D)
  ══════════════════════════════════════════════════════ */
  function drawBall(x, y, size, spin, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(spin);

    /* Shadow */
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur  = size * .4;

    /* White sphere */
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    ctx.fill();

    /* Black patches (simplified) */
    ctx.fillStyle   = '#111';
    ctx.shadowBlur  = 0;
    const patch = [
      [0, 0, size*.48],
      [size*.65, 0, size*.28],
      [-size*.65, 0, size*.28],
      [0, size*.68, size*.28],
      [0, -size*.68, size*.28],
      [size*.45, size*.52, size*.2],
      [-size*.45, size*.52, size*.2],
      [size*.45, -size*.52, size*.2],
      [-size*.45,-size*.52, size*.2],
    ];
    patch.forEach(([px, py, pr]) => {
      // clip to sphere
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, size * .98, 0, Math.PI * 2);
      ctx.clip();
      // draw hexagonal patch
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3;
        const hx = px + pr * .8 * Math.cos(a);
        const hy = py + pr * .8 * Math.sin(a);
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════
     SPEED LINES
  ══════════════════════════════════════════════════════ */
  function drawSpeedLines(cx, cy, progress, alpha) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,.9)';

    const numLines = 32;
    for (let i = 0; i < numLines; i++) {
      const angle  = (i / numLines) * Math.PI * 2;
      const minR   = 30 + (i % 3) * 20;
      const maxR   = minR + 60 + (i % 5) * 60 + progress * 400;
      const lw     = .5 + (i % 3) * .5;
      const la     = .3 + .5 * (i % 2);

      ctx.globalAlpha = alpha * la;
      ctx.lineWidth   = lw;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * minR, cy + Math.sin(angle) * minR);
      ctx.lineTo(cx + Math.cos(angle) * maxR, cy + Math.sin(angle) * maxR);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ══════════════════════════════════════════════════════
     RIPPLE RINGS
  ══════════════════════════════════════════════════════ */
  function drawRipples() {
    ripples.forEach(r => {
      if (r.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha  = r.alpha;
      ctx.strokeStyle  = r.color;
      ctx.lineWidth    = r.lw || 2;
      ctx.shadowColor  = r.color;
      ctx.shadowBlur   = 12;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ══════════════════════════════════════════════════════
     ENTRANCE ANIMATION
  ══════════════════════════════════════════════════════ */
  function triggerEntrance(e) {
    if (entered) return;
    entered = true;

    /* Support custom target section */
    const targetSectionId = e._targetId || null;

    const rect = hero.getBoundingClientRect();
    clickX = e.clientX - rect.left;
    clickY = e.clientY - rect.top;

    /* Initial ripples at click */
    for (let i = 0; i < 4; i++) {
      ripples.push({
        x: clickX, y: clickY,
        radius: 0,
        maxR:   60 + i * 80,
        speed:  4 + i * 2,
        alpha:  .9,
        lw:     2 - i * .3,
        color:  i % 2 === 0 ? '#FFD700' : '#ffffff',
        delay:  i * 80,
        born:   Date.now(),
      });
    }

    /* Football spawns at click and flies toward viewer */
    footballs.push({
      x:       clickX,
      y:       clickY,
      size:    22,
      spin:    0,
      alpha:   1,
      born:    Date.now(),
    });

    if (typeof gsap === 'undefined') {
      fallbackEntrance();
      return;
    }

    const state = { zoom: 1, flash: 0, contentAlpha: 1, hintOut: hintAlpha };

    /* Camera rush — field zooms toward click point */
    gsap.to(state, {
      zoom: 14,
      duration: 1.6,
      ease: 'power3.in',
      onUpdate: () => { zoom = state.zoom; }
    });

    /* Hero text out */
    gsap.to('.hero-content', {
      opacity: 0,
      y: -20,
      duration: .6,
      delay: .35,
      ease: 'power3.in',
    });

    /* Hint fades out */
    gsap.to(state, {
      hintOut: 0,
      duration: .3,
      onUpdate: () => { hintAlpha = state.hintOut; }
    });

    /* Speed lines appear */
    gsap.delayedCall(.4, () => {
      const sl = { progress: 0, alpha: 0 };
      gsap.to(sl, { progress: 1, alpha: .8, duration: .9, ease: 'power2.in',
        onUpdate: () => { speedLineState = sl; } });
    });

    /* Flash — stadium lights peak */
    gsap.to(state, {
      flash: 1,
      duration: .25,
      delay: 1.35,
      ease: 'power3.in',
      onUpdate: () => { flash = state.flash; }
    });

    /* Flash out */
    gsap.to(state, {
      flash: 0,
      duration: .6,
      delay: 1.62,
      ease: 'power2.out',
      onUpdate: () => { flash = state.flash; }
    });

    /* Scroll to target section */
    gsap.delayedCall(1.4, () => {
      const sectionEl = targetSectionId
        ? document.getElementById(targetSectionId)
        : (document.getElementById('stats') ||
           document.getElementById('about') ||
           document.getElementById('process'));
      if (!sectionEl) return;

      const navH = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--nav-h')) || 76;
      const top = sectionEl.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top, behavior: 'smooth' });
    });

    /* After scroll: reset hero for possible revisit */
    gsap.delayedCall(2.8, () => {
      gsap.to('.hero-content', { opacity: 1, y: 0, duration: .5 });
      zoom     = 1;
      flash    = 0;
      entered  = false;
      ripples  = [];
      footballs = [];
      speedLineState = null;
    });
  }

  function fallbackEntrance() {
    const next = document.getElementById('stats') || document.getElementById('about');
    if (next) next.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { entered = false; }, 1000);
  }

  /* ── Speed line state ──────────────────────────────── */
  let speedLineState = null;

  /* ══════════════════════════════════════════════════════
     CLICK HANDLER (on hero section, not canvas)
  ══════════════════════════════════════════════════════ */
  hero.style.cursor = 'default';

  hero.addEventListener('click', e => {
    if (e.target.closest('a, button, .lang-btn, .nav-link')) return;
    const r  = hero.getBoundingClientRect();
    const pitch = getPitchBounds();
    const dx = e.clientX - r.left - pitch.cx;
    const dy = e.clientY - r.top  - pitch.cy;
    /* Clic valide uniquement dans le cercle central (décalé) */
    if (Math.sqrt(dx*dx + dy*dy) > CLICK_RADIUS) return;
    /* Force le scroll vers #about (Who We Are) */
    const ev = { clientX: e.clientX, clientY: e.clientY, _targetId: 'about' };
    triggerEntrance(ev);
  });

  /* Add pointer-events to hero sub-content so it's clickable */
  const heroContent = hero.querySelector('.hero-content');
  if (heroContent) heroContent.style.pointerEvents = 'none';

  const heroActions = hero.querySelector('.hero-actions');
  if (heroActions) {
    heroActions.style.pointerEvents = 'auto';
    heroActions.querySelectorAll('a').forEach(a => a.style.pointerEvents = 'auto');
  }

  /* ══════════════════════════════════════════════════════
     MAIN DRAW LOOP
  ══════════════════════════════════════════════════════ */
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => Date.now();

  function draw() {
    /* Smooth spotlight */
    if (!prefersReduced) {
      sx += (tx - sx) * .04;
      sy += (ty - sy) * .04;
    }

    /* Field (with zoom transform if entering) */
    drawField(zoom, clickX, clickY);

    /* ── Ripples ── */
    const t = now();
    ripples = ripples.filter(r => {
      if (t < r.born + (r.delay || 0)) return true;
      r.radius += r.speed;
      r.alpha  *= .945;
      return r.alpha > .02;
    });
    drawRipples();

    /* ── Football ── */
    footballs.forEach(ball => {
      const age    = (t - ball.born) / 1000;
      const growth = Math.min(1, age * 1.2);
      ball.spin   += .15;
      const size   = ball.size + growth * Math.min(W, H) * .35;
      const alpha  = Math.max(0, 1 - Math.pow(growth, 1.5) * 1.2);
      drawBall(ball.x, ball.y, size, ball.spin, alpha * (zoom > 4 ? .7 : 0));
    });
    footballs = footballs.filter(b => (t - b.born) < 2000);

    /* ── Speed lines ── */
    if (speedLineState) {
      drawSpeedLines(clickX, clickY, speedLineState.progress, speedLineState.alpha);
    }

    /* ── Hint ── */
    if (!entered) {
      hintTimer += .016;
      hintAlpha = Math.min(1, Math.max(0, (hintTimer - 2.5) * .4));
    }
    drawHint(hintAlpha);

    /* ── White flash (stadium lights) ── */
    if (flash > 0) {
      /* Strobe effect */
      const strobe = Math.sin(now() * .04) > 0 ? 1 : .6;
      ctx.fillStyle = `rgba(255,255,240,${flash * .92 * strobe})`;
      ctx.fillRect(0, 0, W, H);

      /* Gold tint at edges */
      const gv = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H));
      gv.addColorStop(.4, 'rgba(255,255,255,0)');
      gv.addColorStop(1,  `rgba(212,168,32,${flash * .5})`);
      ctx.fillStyle = gv;
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ── Loop ───────────────────────────────────────────── */
  function loop() {
    requestAnimationFrame(loop);
    draw();
  }
  loop();

})();

/* ═══════════════════════════════════════════════════════════
   Photo hero mode — click anywhere on hero → flash + scroll
═══════════════════════════════════════════════════════════ */
function _initPhotoHeroClick(hero) {
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:absolute', 'inset:0', 'background:#fff',
    'opacity:0', 'pointer-events:none', 'z-index:20',
    'transition:none'
  ].join(';');
  hero.style.position = 'relative';
  hero.appendChild(overlay);

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  hero.addEventListener('click', e => {
    if (e.target.closest('a, button, .lang-btn, .nav-link')) return;

    const target = document.getElementById('stats') ||
                   document.getElementById('about') ||
                   document.getElementById('process');
    if (!target) return;

    /* Reduced motion: skip the full-screen white flash, just scroll. */
    if (prefersReduced) {
      const navH = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--nav-h')) || 76;
      const top = target.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top });
      return;
    }

    if (typeof gsap !== 'undefined') {
      gsap.to(overlay, { opacity: .85, duration: .22, ease: 'power3.in',
        onComplete: () => {
          const navH = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--nav-h')) || 76;
          const top = target.getBoundingClientRect().top + window.scrollY - navH;
          window.scrollTo({ top, behavior: 'smooth' });
          gsap.to(overlay, { opacity: 0, duration: .55, delay: .15, ease: 'power2.out' });
        }
      });
    } else {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
}
