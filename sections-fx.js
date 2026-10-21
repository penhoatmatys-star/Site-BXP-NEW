/* ═══════════════════════════════════════════════════════
   BXP – sections-fx.js
   Animations: Facilitate (network canvas, 3D tilt, spotlight,
   staggered reveals) + Mission (manifesto, columns)
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function whenReady(fn) {
    if (typeof gsap !== 'undefined' && document.readyState !== 'loading') { fn(); }
    else if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', function () { whenReady(fn); }); }
    else { setTimeout(function () { whenReady(fn); }, 40); }
  }

  /* ── Network canvas: drifting gold nodes, connected ───── */
  function initNetwork() {
    var canvas = document.querySelector('.fac-net');
    var section = document.getElementById('facilitate');
    if (!canvas || !section || reducedMotion) return;

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, pts = [], running = false, rafId = 0;
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var LINK = 150;

    function resize() {
      W = section.offsetWidth; H = section.offsetHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      var n = Math.max(26, Math.min(64, Math.round(W / 24)));
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: 1 + Math.random() * 1.4
        });
      }
    }

    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      var i, j, p, q, dx, dy, d;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        for (j = i + 1; j < pts.length; j++) {
          q = pts[j];
          dx = p.x - q.x; dy = p.y - q.y;
          d = dx * dx + dy * dy;
          if (d < LINK * LINK) {
            var a = (1 - Math.sqrt(d) / LINK) * 0.22;
            ctx.strokeStyle = 'rgba(212,168,32,' + a.toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        ctx.fillStyle = 'rgba(212,168,32,.55)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      rafId = requestAnimationFrame(tick);
    }

    var io = new IntersectionObserver(function (entries) {
      var vis = entries[0].isIntersecting;
      if (vis && !running) { running = true; tick(); }
      else if (!vis && running) { running = false; cancelAnimationFrame(rafId); }
    }, { rootMargin: '80px' });

    resize();
    io.observe(section);
    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT);
      rT = setTimeout(resize, 180);
    });
  }

  /* ── Cards: 3D tilt + mouse spotlight ─────────────────── */
  function initCardTilt() {
    if (reducedMotion) return;
    var cards = document.querySelectorAll('.fac-card');
    var fine = window.matchMedia('(pointer: fine)').matches;

    cards.forEach(function (card) {
      if (!fine) return;
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        card.style.setProperty('--mx', x + 'px');
        card.style.setProperty('--my', y + 'px');
        var ry = ((x / r.width) - 0.5) * 5;
        var rx = ((y / r.height) - 0.5) * -5;
        gsap.to(card, { rotateX: rx, rotateY: ry, y: -4, duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
      });
      card.addEventListener('pointerleave', function () {
        gsap.to(card, { rotateX: 0, rotateY: 0, y: 0, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
      });
    });
  }

  /* ── Scroll reveals ────────────────────────────────────── */
  function initReveals() {
    if (typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    /* Facilitate cards: cascade with depth */
    gsap.utils.toArray('.fac-card').forEach(function (card, i) {
      gsap.from(card, {
        opacity: 0,
        y: 70,
        rotateX: reducedMotion ? 0 : 10,
        scale: 0.96,
        duration: 1,
        ease: 'power3.out',
        delay: (i % 2) * 0.14,
        scrollTrigger: { trigger: card, start: 'top 90%' }
      });
      var num = card.querySelector('.fac-num');
      if (num) {
        gsap.from(num, {
          opacity: 0, x: 30,
          duration: 1.1, ease: 'power3.out', delay: 0.25 + (i % 2) * 0.14,
          scrollTrigger: { trigger: card, start: 'top 90%' }
        });
      }
    });

    /* Facilitate icons: pop in */
    gsap.utils.toArray('.fac-icon').forEach(function (icon) {
      gsap.from(icon, {
        scale: 0, rotate: -18,
        duration: 0.9, ease: 'back.out(2)', delay: 0.2,
        scrollTrigger: { trigger: icon, start: 'top 92%' }
      });
    });

    /* Mission text */
    gsap.from('.mission-text', {
      opacity: 0, y: 40, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.mission-text', start: 'top 88%' }
    });

    /* Manifesto: blur-in + lines expanding outwards */
    var man = document.querySelector('.mission-manifesto');
    if (man) {
      var tl = gsap.timeline({
        scrollTrigger: { trigger: man, start: 'top 82%' }
      });
      tl.from('.manifesto-text', {
        opacity: 0,
        scale: 0.9,
        filter: 'blur(10px)',
        duration: 1.1,
        ease: 'power3.out'
      });
      tl.from('.manifesto-line:first-child', {
        scaleX: 0, transformOrigin: 'left center', duration: 1, ease: 'power3.inOut'
      }, 0.15);
      tl.from('.manifesto-line:last-child', {
        scaleX: 0, transformOrigin: 'right center', duration: 1, ease: 'power3.inOut'
      }, 0.15);
    }

    /* Mission columns: slide from both sides */
    var cols = document.querySelectorAll('.mission-col');
    if (cols.length === 2) {
      gsap.from(cols[0], {
        opacity: 0, x: -56, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.mission-cols', start: 'top 85%' }
      });
      gsap.from(cols[1], {
        opacity: 0, x: 56, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '.mission-cols', start: 'top 85%' }
      });
      gsap.from('.mission-col-divider', {
        scaleY: 0, transformOrigin: 'top center', duration: 1.2, ease: 'power3.inOut', delay: 0.2,
        scrollTrigger: { trigger: '.mission-cols', start: 'top 85%' }
      });
    }

    /* Contact intro */
    gsap.from('.contact-intro', {
      opacity: 0, y: 24, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: '.contact-intro', start: 'top 92%' }
    });
  }

  /* ── Process: track switch + accordion ────────────────── */
  function initProcess() {
    var acc = document.getElementById('proc-acc');
    if (!acc) return;
    var switcher = document.querySelector('.proc-switch');
    var tabs = switcher ? switcher.querySelectorAll('.proc-tab') : [];
    var items = acc.querySelectorAll('.proc-item');

    /* Accordion: one open at a time, clicking open item closes it */
    items.forEach(function (item) {
      var head = item.querySelector('.proc-head');
      head.addEventListener('click', function () {
        var wasOpen = item.classList.contains('is-open');
        items.forEach(function (it) {
          it.classList.remove('is-open');
          it.querySelector('.proc-head').setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          item.classList.add('is-open');
          head.setAttribute('aria-expanded', 'true');
        }
      });
    });

    /* Track switch: swap i18n keys club <-> athlete, re-render */
    function setTrack(track) {
      acc.dataset.track = track;
      if (switcher) switcher.classList.toggle('is-athlete', track === 'athlete');
      tabs.forEach(function (tab) {
        var on = tab.dataset.track === track;
        tab.classList.toggle('active', on);
        tab.setAttribute('aria-selected', String(on));
      });
      acc.querySelectorAll('[data-i18n]').forEach(function (el) {
        el.dataset.i18n = el.dataset.i18n.replace(/\.(club|athlete)\./, '.' + track + '.');
      });
      if (typeof setLanguage === 'function' && typeof currentLang !== 'undefined') {
        setLanguage(currentLang);
      }
      /* Subtle content swap animation */
      if (typeof gsap !== 'undefined' && !reducedMotion) {
        gsap.fromTo(acc, { opacity: 0.35, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
      }
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        if (!tab.classList.contains('active')) setTrack(tab.dataset.track);
      });
    });

    /* Reveal items on scroll */
    if (typeof ScrollTrigger !== 'undefined') {
      items.forEach(function (item, i) {
        gsap.from(item, {
          opacity: 0, y: 36,
          duration: 0.8, ease: 'power3.out', delay: i * 0.08,
          scrollTrigger: { trigger: '.proc-wrap', start: 'top 85%', once: true }
        });
      });
    }
  }

  whenReady(function () {
    initNetwork();
    initCardTilt();
    initReveals();
    initProcess();
  });
})();
