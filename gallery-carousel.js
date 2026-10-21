/* ═══════════════════════════════════════════════════════════
   BXP – gallery-carousel.js  |  Cinematic Drag Carousel
   Features: momentum drag · depth scale · lightbox · filter
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Wait for GSAP ─────────────────────────────────────── */
  function whenReady(fn) {
    if (typeof gsap !== 'undefined') fn();
    else setTimeout(function () { whenReady(fn); }, 50);
  }
  /* ── Constants ─────────────────────────────────────────── */
  var SNAP_EASE = 'power4.out';
  var SNAP_DUR  = 0.55;

  /* ── State ─────────────────────────────────────────────── */
  var track, allCards, vis, progressBar, counterEl;
  var currentIdx = 0;
  var offsetX    = 0;
  var snapTween  = null;

  /* Drag */
  var drag = {
    on: false, type: '',
    startX: 0, startY: 0, startOff: 0,
    lastX: 0, lastT: 0, velX: 0,
    moved: false, axis: null,
    targetCard: null, /* card element captured at pointerdown */
  };

  /* Lightbox */
  var lb = {
    el: null, bgEl: null, imgEl: null,
    tagEl: null, titleEl: null, ctrEl: null,
    prevBtn: null, nextBtn: null,
    active: false, idx: 0, cards: [],
  };

  /* Dims */
  var CW, CH, GAP, SLOT;

  /* ── Init ──────────────────────────────────────────────── */
  function init() {
    /* Register plugin before any ScrollTrigger usage */
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    track       = document.getElementById('gc-track');
    progressBar = document.getElementById('gc-progress-bar');
    counterEl   = document.getElementById('gc-counter');
    if (!track) return;

    allCards = Array.prototype.slice.call(track.querySelectorAll('.gc-card'));
    vis = allCards.slice();

    lb.el      = document.getElementById('gc-lightbox');
    lb.bgEl    = document.getElementById('gc-lb-bg');
    lb.imgEl   = document.getElementById('gc-lb-img');
    lb.tagEl   = document.getElementById('gc-lb-tag');
    lb.titleEl = document.getElementById('gc-lb-title');
    lb.ctrEl   = document.getElementById('gc-lb-counter');
    lb.prevBtn = document.getElementById('gc-lb-prev');
    lb.nextBtn = document.getElementById('gc-lb-next');

    computeDims();
    layoutCards();
    snapTo(0, true);
    bindDrag();
    bindArrows();
    bindFilter();
    bindLightbox();
    bindKeyboard();
    bindResize();
    scrollReveal();
  }

  /* ── Dimensions ────────────────────────────────────────── */
  function computeDims() {
    var mobile = window.innerWidth <= 640;
    var tablet = window.innerWidth <= 960;
    if (mobile) {
      CW  = Math.min(Math.round(window.innerWidth * 0.78), 300);
      CH  = 380;
      GAP = 14;
    } else if (tablet) {
      CW  = 260;
      CH  = 380;
      GAP = 18;
    } else {
      CW  = 300;
      CH  = 420;
      GAP = 20;
    }
    SLOT = CW + GAP;

    allCards.forEach(function (c) {
      c.style.width  = CW + 'px';
      c.style.height = CH + 'px';
    });
    track.style.height = CH + 'px';
  }

  /* ── Layout (absolute positioning) ────────────────────── */
  function layoutCards() {
    vis.forEach(function (c, i) {
      c.style.left = (i * SLOT) + 'px';
    });
    /* Track wide enough to always allow last card to center */
    track.style.width = (vis.length * SLOT + window.innerWidth) + 'px';
  }

  /* ── Snap offset for card index ────────────────────────── */
  function centerOf(idx) {
    return (window.innerWidth / 2) - (idx * SLOT) - (CW / 2);
  }

  /* ── Snap to card ──────────────────────────────────────── */
  function snapTo(idx, instant) {
    idx = clamp(idx, 0, vis.length - 1);
    currentIdx = idx;
    var target = centerOf(idx);

    if (snapTween) { snapTween.kill(); snapTween = null; }

    if (instant) {
      offsetX = target;
      gsap.set(track, { x: offsetX, force3D: true });
      refreshCards();
    } else {
      var obj = { x: offsetX };
      snapTween = gsap.to(obj, {
        x: target,
        duration: SNAP_DUR,
        ease: SNAP_EASE,
        onUpdate: function () {
          offsetX = obj.x;
          gsap.set(track, { x: offsetX, force3D: true });
          refreshCards();
        },
        onComplete: function () { snapTween = null; }
      });
    }
    updateProgress();
  }

  /* ── Refresh card depth / opacity ─────────────────────── */
  function refreshCards() {
    var vCenter = window.innerWidth / 2;
    vis.forEach(function (card, i) {
      var cardCenter = offsetX + i * SLOT + CW / 2;
      var dist = Math.abs(cardCenter - vCenter);
      /* t: 1 = perfectly centred, 0 = far away */
      var t = Math.max(0, 1 - dist / (SLOT * 2.2));

      var scale   = 0.82 + 0.18 * t;   /* 0.82 → 1.00 */
      var opacity = 0.30 + 0.70 * t;   /* 0.30 → 1.00 */
      var tz      = -100 * (1 - t);    /* z depth */

      gsap.set(card, { scale: scale, opacity: opacity, z: tz, force3D: true });
      card.classList.toggle('is-active', i === currentIdx);
    });
  }

  /* ── Progress bar + counter ────────────────────────────── */
  function updateProgress() {
    var pct = vis.length > 1 ? (currentIdx / (vis.length - 1)) * 100 : 100;
    if (progressBar) progressBar.style.width = pct + '%';
    if (counterEl) {
      counterEl.textContent =
        pad(currentIdx + 1) + ' / ' + pad(vis.length);
    }
  }

  /* ── Drag ──────────────────────────────────────────────── */
  function bindDrag() {
    track.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup',     onUp);
    window.addEventListener('pointercancel', onUp);
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });
  }

  function onDown(e) {
    if (e.button > 0) return;
    drag.on      = true;
    drag.type    = e.pointerType;
    drag.startX  = e.clientX;
    drag.startY  = e.clientY;
    drag.startOff = offsetX;
    drag.lastX   = e.clientX;
    drag.lastT   = Date.now();
    drag.velX    = 0;
    drag.moved   = false;
    drag.axis    = null;

    /* Capture which card was clicked before pointer capture redirects e.target */
    drag.targetCard = e.target && typeof e.target.closest === 'function'
      ? e.target.closest('.gc-card') : null;

    if (snapTween) { snapTween.kill(); snapTween = null; }
    try { track.setPointerCapture(e.pointerId); } catch (_) {}
    track.style.cursor = 'grabbing';
  }

  function onMove(e) {
    if (!drag.on) return;

    var dx  = e.clientX - drag.startX;
    var dy  = e.clientY - drag.startY;
    var adx = Math.abs(dx);
    var ady = Math.abs(dy);

    /* Detect scroll axis once movement threshold reached */
    if (!drag.axis && (adx > 6 || ady > 6)) {
      drag.axis = adx >= ady ? 'h' : 'v';
    }

    /* If vertical scroll, release drag */
    if (drag.axis === 'v') {
      drag.on = false;
      track.style.cursor = '';
      return;
    }

    /* Prevent page scroll during horizontal drag */
    if (drag.axis === 'h') {
      e.preventDefault();
    }

    var now = Date.now();
    var dt  = Math.max(now - drag.lastT, 1);
    drag.velX  = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = now;

    var threshold = drag.type === 'mouse' ? 4 : 8;
    if (adx > threshold) drag.moved = true;

    /* Rubber band at boundaries */
    var minX = centerOf(vis.length - 1);
    var maxX = centerOf(0);
    var rawX = drag.startOff + dx;
    if      (rawX < minX) rawX = minX + (rawX - minX) * 0.16;
    else if (rawX > maxX) rawX = maxX + (rawX - maxX) * 0.16;

    offsetX = rawX;
    gsap.set(track, { x: offsetX, force3D: true });

    /* Live active-card tracking */
    var vC      = window.innerWidth / 2;
    var closest = 0;
    var minD    = Infinity;
    vis.forEach(function (_, i) {
      var d = Math.abs(offsetX + i * SLOT + CW / 2 - vC);
      if (d < minD) { minD = d; closest = i; }
    });
    currentIdx = closest;
    refreshCards();
    updateProgress();
  }

  function onUp(e) {
    if (!drag.on) return;
    drag.on = false;
    track.style.cursor = '';

    if (!drag.moved) {
      /* Use card captured at pointerdown (setPointerCapture changes e.target) */
      var card = drag.targetCard;
      if (card) {
        var idx = vis.indexOf(card);
        if (idx === currentIdx) {
          openLightbox(idx);
        } else if (idx >= 0) {
          snapTo(idx);
        }
      }
      return;
    }

    /* Flick: velocity → extra cards */
    var flick = drag.velX * 320;
    var extra  = Math.round(-flick / SLOT);
    snapTo(clamp(currentIdx + extra, 0, vis.length - 1));
  }

  /* ── Arrows ────────────────────────────────────────────── */
  function bindArrows() {
    var prev = document.getElementById('gc-prev');
    var next = document.getElementById('gc-next');
    if (prev) prev.addEventListener('click', function () { snapTo(currentIdx - 1); });
    if (next) next.addEventListener('click', function () { snapTo(currentIdx + 1); });
  }

  /* ── Filter ────────────────────────────────────────────── */
  function bindFilter() {
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');

        var filter = btn.dataset.filter;

        /* Animate out current visible cards */
        gsap.to(vis, {
          opacity: 0, scale: 0.80, y: 16,
          duration: 0.22, stagger: 0.025, ease: 'power2.in',
          onComplete: function () {
            /* Show / hide */
            allCards.forEach(function (c) {
              c.style.display = (filter === 'all' || c.dataset.cat === filter) ? '' : 'none';
            });
            vis = allCards.filter(function (c) { return c.style.display !== 'none'; });
            currentIdx = 0;
            layoutCards();
            snapTo(0, true);

            /* Animate in */
            gsap.fromTo(vis,
              { opacity: 0, scale: 0.84, y: 20 },
              {
                opacity: 0.30, scale: 0.82, y: 0,
                duration: 0.45, stagger: 0.06, ease: 'power3.out',
                onComplete: refreshCards
              }
            );
          }
        });
      });
    });
  }

  /* ── Lightbox ──────────────────────────────────────────── */
  function bindLightbox() {
    if (!lb.el) return;
    var closeBtn = document.getElementById('gc-lb-close');
    var overlay  = document.getElementById('gc-lb-overlay');
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
    if (overlay)  overlay.addEventListener('click', closeLightbox);
    if (lb.prevBtn) lb.prevBtn.addEventListener('click', function () {
      if (lb.idx > 0) { lb.idx--; renderLightbox(); }
    });
    if (lb.nextBtn) lb.nextBtn.addEventListener('click', function () {
      if (lb.idx < lb.cards.length - 1) { lb.idx++; renderLightbox(); }
    });
  }

  function openLightbox(idx) {
    if (!lb.el) return;
    lb.cards  = vis.slice();
    lb.idx    = idx;
    lb.active = true;

    renderLightbox();

    lb.el.style.display = 'flex';
    lb.el.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';

    gsap.fromTo(lb.el,
      { opacity: 0 },
      { opacity: 1, duration: 0.32, ease: 'power2.out' }
    );
    var content = lb.el.querySelector('.gc-lb-content');
    if (content) {
      gsap.fromTo(content,
        { scale: 0.88, opacity: 0, y: 30 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
      );
    }
  }

  function closeLightbox() {
    if (!lb.active) return;
    lb.active = false;
    gsap.to(lb.el, {
      opacity: 0, duration: 0.25, ease: 'power2.in',
      onComplete: function () {
        lb.el.setAttribute('aria-hidden', 'true');
        lb.el.style.display = 'none';
        document.body.style.overflow = '';
        /* Stop any playing video to free resources */
        if (lb.imgEl) { lb.imgEl.innerHTML = ''; lb.imgEl.style.backgroundImage = 'none'; }
      }
    });
  }

  function renderLightbox() {
    var card = lb.cards[lb.idx];
    if (!card) return;

    var img   = card.dataset.img;
    var video = card.dataset.video;
    var loc   = card.dataset.location;
    var cat   = card.dataset.cat;
    /* Use already-translated tag text from the card */
    var tagText = (card.querySelector('.gc-tag') || {}).textContent || card.dataset.cat;

    if (video) {
      /* Video card: play the clip inside the lightbox frame */
      if (lb.bgEl)  lb.bgEl.style.backgroundImage = 'none';
      if (lb.imgEl) {
        lb.imgEl.style.backgroundImage = 'none';
        lb.imgEl.innerHTML =
          '<video src="' + video + '" autoplay loop muted playsinline controls ' +
          'style="width:100%;height:100%;object-fit:cover;display:block"></video>';
      }
    } else {
      if (lb.bgEl)  lb.bgEl.style.backgroundImage  = "url('" + img + "')";
      if (lb.imgEl) {
        lb.imgEl.innerHTML = '';
        lb.imgEl.style.backgroundImage = "url('" + img + "')";
      }
    }
    if (lb.tagEl) {
      lb.tagEl.textContent = tagText.trim();
      lb.tagEl.className   = 'gc-lb-tag ' + (cat === 'athlete' ? 'gold-text' : 'silver-text');
    }
    if (lb.titleEl) lb.titleEl.textContent = loc;
    if (lb.ctrEl)   lb.ctrEl.textContent   = pad(lb.idx + 1) + ' / ' + pad(lb.cards.length);

    if (lb.prevBtn) lb.prevBtn.style.opacity = lb.idx > 0 ? '1' : '0.22';
    if (lb.nextBtn) lb.nextBtn.style.opacity = lb.idx < lb.cards.length - 1 ? '1' : '0.22';

    /* Content swap animation */
    if (lb.active) {
      var content = lb.el.querySelector('.gc-lb-content');
      if (content) {
        gsap.fromTo(content,
          { opacity: 0.55, scale: 0.96 },
          { opacity: 1, scale: 1, duration: 0.28, ease: 'power2.out' }
        );
      }
    }
  }

  /* ── Keyboard ──────────────────────────────────────────── */
  function bindKeyboard() {
    window.addEventListener('keydown', function (e) {
      if (lb.active) {
        if (e.key === 'Escape') { closeLightbox(); }
        if (e.key === 'ArrowLeft'  && lb.idx > 0)                      { lb.idx--; renderLightbox(); }
        if (e.key === 'ArrowRight' && lb.idx < lb.cards.length - 1)    { lb.idx++; renderLightbox(); }
      } else {
        if (e.key === 'ArrowLeft')  snapTo(currentIdx - 1);
        if (e.key === 'ArrowRight') snapTo(currentIdx + 1);
      }
    });

    allCards.forEach(function (card) {
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          var idx = vis.indexOf(card);
          if (idx < 0) return;
          if (idx === currentIdx) openLightbox(idx);
          else snapTo(idx);
        }
      });
    });
  }

  /* ── Resize ────────────────────────────────────────────── */
  function bindResize() {
    var timer;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        computeDims();
        layoutCards();
        snapTo(currentIdx, true);
      }, 180);
    }, { passive: true });
  }

  /* ── Scroll reveal ─────────────────────────────────────── */
  function scrollReveal() {
    if (typeof ScrollTrigger === 'undefined') return;
    gsap.from('#gallery-carousel', {
      opacity: 0, y: 48, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: '#gallery', start: 'top 75%', once: true }
    });
  }

  /* ── Helpers ───────────────────────────────────────────── */
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* ── Bootstrap — MUST be last, after all var assignments ── */
  whenReady(init);

})();
