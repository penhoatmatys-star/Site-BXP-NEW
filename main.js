/* ═══════════════════════════════════════════════════════════
   BXP – main.js  |  Premium Animations — GSAP + ScrollTrigger
   Inspired by: Nike.com, Real Madrid CF, F1.com
═══════════════════════════════════════════════════════════ */

function revealHeroStatic() {
  document.querySelectorAll('.hero-eyebrow, .hero-tagline-wrap, .hero-sub, .hero-actions').forEach(el => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });

  const logoImg = document.querySelector('.hero-logo-img');
  if (logoImg) logoImg.style.transform = 'translateY(0)';
}

/* Wait for GSAP to load (give up gracefully if the CDN never responds) */
var _gsapWaitAttempts = 0;
function initSite() {
  if (typeof gsap === 'undefined') {
    if (_gsapWaitAttempts++ > 120) {
      revealHeroStatic();
      return;
    }
    setTimeout(initSite, 50);
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* ─── GRAIN NOISE CANVAS ─────────────────────────── */
  (function initGrain() {
    const canvas = document.getElementById('grain-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let frame = 0;
    let heroVisible = true;

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function renderGrain() {
      /* Skip the expensive ImageData generation when the hero is off-screen;
         just poll cheaply until it comes back into view. */
      if (!heroVisible) { setTimeout(renderGrain, 250); return; }
      const w = canvas.width, h = canvas.height;
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i+1] = d[i+2] = v;
        d[i+3] = 18;
      }
      ctx.putImageData(img, 0, 0);
      frame++;
      if (frame % 3 === 0) requestAnimationFrame(renderGrain);
      else setTimeout(renderGrain, 16);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const hero = document.getElementById('hero');
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(
        e => { heroVisible = e[0].isIntersecting; },
        { threshold: 0 }
      ).observe(hero);
    }

    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      renderGrain();
    }
  })();

  /* Curseur système standard — pas de curseur custom */

  initHeroEntrance();

  /* ─── HERO ENTRANCE ──────────────────────────────── */
  function initHeroEntrance() {
    const eyebrow  = document.querySelector('.hero-eyebrow');
    const bxp      = document.querySelector('.hero-bxp');
    const tagline  = document.querySelector('.hero-tagline-wrap');
    const sub      = document.querySelector('.hero-sub');
    const actions  = document.querySelector('.hero-actions');
    const scroll   = document.querySelector('.hero-scroll');

    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

    gsap.set([sub, actions], { y: 24, opacity: 0 });

    /* Eyebrow */
    tl.to(eyebrow, { opacity: 1, y: 0, duration: .7 }, 0);

    /* Logo — sort du bas */
    const logoImg = document.querySelector('.hero-logo-img');
    if (logoImg) {
      tl.to(logoImg, { y: '0%', duration: 1.1, ease: 'power4.out' }, .15);
    } else if (bxp) {
      tl.to(bxp, { y: '0%', duration: 1.1, ease: 'power4.out' }, .15);
    }

    /* "Best for Performance" — fade+slide */
    if (tagline) {
      tl.to(tagline, {
        opacity: 1,
        y: 0,
        duration: .8,
        ease: 'power3.out'
      }, .7);
    }

    tl.to(sub,     { opacity: 1, y: 0, duration: .7 }, .95);
    tl.to(actions, { opacity: 1, y: 0, duration: .7 }, 1.1);
    tl.to(scroll,  { opacity: 1, duration: .6 },        1.3);
  }

  /* ─── PARALLAX HERO BG ───────────────────────────── */
  (function initParallax() {
    const heroBg = document.getElementById('hero-bg');
    if (!heroBg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: 'bottom top',
      onUpdate: self => {
        const p = self.progress;
        gsap.set(heroBg, { y: p * 120, force3D: true });
      }
    });
  })();

  /* ─── NAVBAR SCROLL ──────────────────────────────── */
  (function initNavbar() {
    const nav = document.getElementById('navbar');
    if (!nav) return;
    ScrollTrigger.create({
      start: 'top -60',
      end: 99999,
      onEnter: () => nav.classList.add('scrolled'),
      onLeaveBack: () => nav.classList.remove('scrolled'),
    });
  })();

  /* ─── MOBILE MENU ────────────────────────────────── */
  (function initMobile() {
    const ham   = document.querySelector('.nav-hamburger');
    const menu  = document.querySelector('.nav-mobile');
    if (!ham || !menu) return;
    function setOpen(open) {
      menu.classList.toggle('open', open);
      ham.classList.toggle('open', open);
      ham.setAttribute('aria-expanded', String(open));
      menu.setAttribute('aria-hidden', String(!open));
    }
    ham.addEventListener('click', () => {
      setOpen(!menu.classList.contains('open'));
    });
    menu.querySelectorAll('.nav-mobile-link').forEach(l => {
      l.addEventListener('click', () => setOpen(false));
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.classList.contains('open')) {
        setOpen(false);
        ham.focus();
      }
    });
  })();

  /* ─── STATS COUNTER ──────────────────────────────── */
  (function initStats() {
    const nums = document.querySelectorAll('.stat-num');
    if (!nums.length) return;

    nums.forEach(num => {
      const target = parseInt(num.dataset.count, 10);

      ScrollTrigger.create({
        trigger: num,
        start: 'top 85%',
        once: true,
        onEnter: () => {
          gsap.to({ val: 0 }, {
            val: target,
            duration: 2,
            ease: 'power2.out',
            onUpdate: function() {
              num.textContent = Math.round(this.targets()[0].val);
            }
          });
        }
      });

      // Animate item in
      gsap.from(num.closest('.stat-item'), {
        opacity: 0,
        y: 30,
        duration: .8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#stats',
          start: 'top 80%',
          once: true
        },
        delay: (Array.from(document.querySelectorAll('.stat-item')).indexOf(num.closest('.stat-item'))) * 0.15
      });
    });
  })();

  /* ─── SECTION REVEALS ────────────────────────────── */
  (function initReveals() {
    /* Split titles — character-by-character 3D reveal */
    document.querySelectorAll('.split-lines').forEach(el => {
      const text = el.innerHTML;
      // Split by <br/> if present
      const lines = text.split(/<br\s*\/?>/i);
      el.innerHTML = lines.map(line =>
        `<div class="sl-line" style="overflow:hidden"><div class="sl-inner">${line}</div></div>`
      ).join('');

      gsap.from(el.querySelectorAll('.sl-inner'), {
        y: '105%',
        duration: .9,
        stagger: .12,
        ease: 'power4.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          once: true
        }
      });
    });

    /* Section labels */
    document.querySelectorAll('.section-label').forEach(el => {
      gsap.from(el, {
        opacity: 0,
        y: 16,
        duration: .7,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });

    /* About text */
    gsap.from('.about-desc', {
      opacity: 0,
      y: 24,
      duration: .8,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.about-desc', start: 'top 85%', once: true }
    });

    gsap.from('.about-badges', {
      opacity: 0,
      y: 20,
      duration: .7,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.about-badges', start: 'top 88%', once: true }
    });

    const aboutSplit = document.querySelector('.about-split');
    if (aboutSplit) {
      gsap.from('.about-split-panel', {
        opacity: 0,
        y: 46,
        rotateX: -10,
        scale: .96,
        duration: 1,
        stagger: .18,
        ease: 'power3.out',
        scrollTrigger: { trigger: aboutSplit, start: 'top 82%', once: true }
      });

      gsap.from('.about-flow', {
        opacity: 0,
        scaleX: .25,
        transformOrigin: 'left center',
        duration: .9,
        stagger: .18,
        ease: 'power3.out',
        scrollTrigger: { trigger: aboutSplit, start: 'top 80%', once: true }
      });

      gsap.from('.flow-node', {
        opacity: 0,
        scale: 0,
        duration: .45,
        stagger: .08,
        ease: 'back.out(2.2)',
        scrollTrigger: { trigger: aboutSplit, start: 'top 78%', once: true }
      });

      gsap.from('.about-split-list li', {
        opacity: 0,
        x: -18,
        duration: .65,
        stagger: .08,
        ease: 'power3.out',
        scrollTrigger: { trigger: aboutSplit, start: 'top 78%', once: true }
      });
    }

    /* Process steps */
    document.querySelectorAll('.process-step').forEach((step, i) => {
      gsap.from(step, {
        opacity: 0,
        y: 50,
        duration: .9,
        ease: 'power3.out',
        delay: (i % 2) * 0.15,
        scrollTrigger: { trigger: step, start: 'top 85%', once: true }
      });
    });

    /* Contact */
    gsap.from('.contact-form', {
      opacity: 0,
      x: -40,
      duration: .9,
      ease: 'power3.out',
      scrollTrigger: { trigger: '#contact', start: 'top 75%', once: true }
    });
    gsap.from('.contact-aside', {
      opacity: 0,
      x: 40,
      duration: .9,
      ease: 'power3.out',
      scrollTrigger: { trigger: '#contact', start: 'top 75%', once: true }
    });

    /* Footer */
    gsap.from('#footer', {
      opacity: 0,
      y: 30,
      duration: .8,
      ease: 'power3.out',
      scrollTrigger: { trigger: '#footer', start: 'top 90%', once: true }
    });
  })();

  /* ─── 3D TILT CARDS ──────────────────────────────── */
  (function initTilt() {
    if (window.matchMedia('(hover:none)').matches) return;

    document.querySelectorAll('.tilt-card').forEach(card => {
      const glare = card.querySelector('.tilt-glare');
      let raf;

      card.addEventListener('mousemove', e => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = (e.clientX - rect.left) / rect.width  - 0.5;
          const y = (e.clientY - rect.top)  / rect.height - 0.5;
          const rotX = -y * 10;
          const rotY =  x * 10;

          gsap.to(card, {
            rotateX: rotX,
            rotateY: rotY,
            transformPerspective: 1200,
            duration: .3,
            ease: 'power2.out',
            force3D: true
          });

          if (glare) {
            const gx = (x + .5) * 100;
            const gy = (y + .5) * 100;
            glare.style.background = `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,.08), transparent 65%)`;
            gsap.to(glare, { opacity: 1, duration: .3 });
          }
        });
      });

      card.addEventListener('mouseleave', () => {
        cancelAnimationFrame(raf);
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          duration: .6,
          ease: 'power3.out',
          force3D: true
        });
        if (glare) gsap.to(glare, { opacity: 0, duration: .4 });
      });
    });
  })();

  /* Magnetic buttons désactivés — curseur standard */

  /* ─── SMOOTH ANCHOR SCROLL ───────────────────────── */
  (function initScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 76;
        const top  = target.getBoundingClientRect().top + window.scrollY - navH;
        window.scrollTo({ top, behavior: 'smooth' });
        // Close mobile menu
        const mobileMenu = document.querySelector('.nav-mobile');
        const mobileButton = document.querySelector('.nav-hamburger');
        mobileMenu?.classList.remove('open');
        mobileMenu?.setAttribute('aria-hidden', 'true');
        mobileButton?.classList.remove('open');
        mobileButton?.setAttribute('aria-expanded', 'false');
      });
    });
  })();

  /* ─── CONTACT FORM ───────────────────────────────── */
  (function initForm() {
    const form    = document.getElementById('contact-form');
    const btnEl   = document.getElementById('submit-btn');
    const success = document.getElementById('form-success');
    if (!form) return;

    function showErr(id, msg) {
      const errEl = document.getElementById(id + '-error');
      const inputEl = form.querySelector(`[name="${id === 'firstname' ? 'firstname' : id === 'lastname' ? 'lastname' : id}"]`);
      if (errEl) errEl.textContent = msg;
      if (inputEl) {
        inputEl.style.color = '#e06060';
        inputEl.closest('.form-field')?.querySelector('.field-line')?.style.setProperty('background', '#e06060');
      }
    }

    function clearErr(field) {
      const errId = field.name === 'firstname' ? 'firstname' :
                    field.name === 'lastname'  ? 'lastname'  : field.name;
      const errEl = document.getElementById(errId + '-error');
      if (errEl) errEl.textContent = '';
      field.style.color = '';
      const line = field.closest('.form-field')?.querySelector('.field-line');
      if (line) line.style.removeProperty('background');
    }

    form.querySelectorAll('input,textarea,select').forEach(f => {
      f.addEventListener('input', () => clearErr(f));
      f.addEventListener('change', () => clearErr(f));
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();
      let valid = true;
      const fn = form.firstname.value.trim();
      const ln = form.lastname.value.trim();
      const em = form.email.value.trim();
      const pr = form.profile.value;
      const ms = form.message.value.trim();
      const errReq   = (typeof t === 'function') ? t('form.err.required') : 'Required.';
      const errEmail = (typeof t === 'function') ? t('form.err.email')    : 'Invalid email.';

      if (!fn) { showErr('firstname', errReq); valid = false; }
      if (!ln) { showErr('lastname',  errReq); valid = false; }
      if (!em) { showErr('email', errReq); valid = false; }
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { showErr('email', errEmail); valid = false; }
      if (!pr) { showErr('profile', errReq); valid = false; }
      if (!ms) { showErr('message', errReq); valid = false; }

      if (!valid) {
        // Shake the form
        gsap.fromTo(form, { x: -8 }, { x: 0, duration: .5, ease: 'elastic.out(1,.3)' });
        return;
      }

      btnEl.disabled = true;
      btnEl.querySelector('.btn-text').style.display = 'none';
      btnEl.querySelector('.btn-loader').style.display = 'flex';

      await new Promise(r => setTimeout(r, 1400));

      btnEl.disabled = false;
      btnEl.querySelector('.btn-text').style.display = '';
      btnEl.querySelector('.btn-loader').style.display = 'none';

      success.textContent = (typeof t === 'function') ? t('form.success') : 'Message sent. We\'ll be in touch.';
      success.style.display = 'block';
      gsap.fromTo(success, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .5 });
      form.reset();
      setTimeout(() => {
        gsap.to(success, { opacity: 0, duration: .4, onComplete: () => { success.style.display = 'none'; } });
      }, 6000);
    });
  })();

  /* ─── PROGRESS INDICATOR LINE ────────────────────── */
  (function initProgressLine() {
    const line = document.createElement('div');
    Object.assign(line.style, {
      position: 'fixed',
      top: '0', left: '0',
      height: '2px',
      width: '0%',
      background: 'linear-gradient(90deg, var(--silver), var(--gold))',
      zIndex: '10001',
      pointerEvents: 'none',
      transition: 'width .1s linear'
    });
    document.body.appendChild(line);

    window.addEventListener('scroll', () => {
      const h = document.documentElement;
      const pct = (window.scrollY / (h.scrollHeight - h.clientHeight)) * 100;
      line.style.width = pct + '%';
    }, { passive: true });
  })();

} // end initSite

/* ─── MISSION BACKGROUND VIDEO ───────────────────────
   Ensure the "Why we exist" background video plays even when
   the browser blocks muted autoplay. Independent of GSAP. */
function initMissionVideo() {
  const video = document.querySelector('.mission-video');
  if (!video) return;
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;

  const tryPlay = () => {
    const p = video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  };

  tryPlay();

  /* Retry on the first user interaction if autoplay was blocked */
  const resume = () => {
    if (video.paused) tryPlay();
    if (!video.paused) {
      ['pointerdown', 'touchstart', 'keydown', 'scroll'].forEach(ev =>
        window.removeEventListener(ev, resume));
    }
  };
  ['pointerdown', 'touchstart', 'keydown', 'scroll'].forEach(ev =>
    window.addEventListener(ev, resume, { passive: true }));

  /* Pause when off-screen to save resources */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) tryPlay();
        else video.pause();
      });
    }, { threshold: 0.05 }).observe(video);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSite);
  document.addEventListener('DOMContentLoaded', initMissionVideo);
} else {
  initSite();
  initMissionVideo();
}
