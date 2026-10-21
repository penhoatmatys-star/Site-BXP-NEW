/* ═══════════════════════════════════════════════════════════
   BXP – ball-video.js
   Chroma key (green screen removal) via Canvas 2D
   Le fond vert est remplacé par de la transparence frame par frame
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function initBallVideo() {
    const section = document.getElementById('process');
    if (!section) return;

    /* ── Vidéo source (cachée) ── */
    const video = document.querySelector('.process-ball-video');
    if (!video) return;

    /* ── Canvas de rendu (visible) ── */
    const canvas = document.createElement('canvas');
    canvas.className = 'process-ball-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    section.insertBefore(canvas, section.firstChild);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    /* Dimensionner le canvas selon la vidéo */
    function setSize() {
      const vw = video.videoWidth  || 640;
      const vh = video.videoHeight || 640;
      canvas.width  = vw;
      canvas.height = vh;
    }

    /* ── Chroma key : supprime les pixels verts ── */
    function drawFrame() {
      if (!video.paused && !video.ended) {
        const w = canvas.width;
        const h = canvas.height;

        ctx.drawImage(video, 0, 0, w, h);

        const frame = ctx.getImageData(0, 0, w, h);
        const d = frame.data;

        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];

          /* Pixel vert dominant → transparent */
          if (g > 80 && g > r * 1.35 && g > b * 1.35) {
            d[i + 3] = 0;
          }
        }

        ctx.putImageData(frame, 0, 0);
      }
      requestAnimationFrame(drawFrame);
    }

    video.addEventListener('loadedmetadata', () => {
      setSize();
      video.play().catch(() => {});
    });

    video.addEventListener('play', drawFrame);

    /* Si la vidéo est déjà prête */
    if (video.readyState >= 2) {
      setSize();
      video.play().catch(() => {});
      drawFrame();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBallVideo);
  } else {
    initBallVideo();
  }
})();
