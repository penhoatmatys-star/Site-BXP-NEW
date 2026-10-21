/* ═══════════════════════════════════════════════════════
   BXP – forms.js  |  Intake form behaviour
   - Conditional section reveals (minor / agent)
   - Client-side validation + inline errors
   - PDF submission via /api/form-submit
═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ───────────────────────────────────────────────────────
     SUBMISSION ENDPOINT
     ───────────────────────────────────────────────────────
     The form posts a structured JSON payload to the BXP server.

     The server generates a detailed BXP-styled PDF and emails it
     to the configured BXP mailbox.
  ─────────────────────────────────────────────────────── */
  var ENDPOINT = window.BXP_FORM_ENDPOINT || '/api/form-submit';

  var T = function (k) { return (typeof window.formsT === 'function') ? window.formsT(k) : k; };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var REDUCED_MOTION = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* ─── Conditional reveals (data-reveal) ─────────────────── */
  function initReveals() {
    var triggers = document.querySelectorAll('[data-reveal]');
    if (!triggers.length) return;

    function sync(input) {
      var target = document.getElementById(input.dataset.reveal);
      if (!target) return;
      var show;
      if (input.type === 'checkbox') {
        show = input.checked;
      } else { /* radio */
        if (!input.checked) return; /* only the selected radio acts */
        show = input.dataset.revealHide !== 'true';
      }
      target.hidden = !show;
    }

    triggers.forEach(function (input) {
      input.addEventListener('change', function () {
        if (input.type === 'radio') {
          /* sync every radio that targets the same element */
          document.querySelectorAll('[data-reveal="' + input.dataset.reveal + '"]')
            .forEach(sync);
        } else {
          sync(input);
        }
      });
    });
  }

  /* ─── Error helpers ─────────────────────────────────────── */
  function fieldErrEl(input) {
    var wrap = input.closest('.fp-field') || input.closest('.fp-qa-field') ||
               input.closest('.fp-checks') || input.closest('.fp-field--half');
    return wrap ? wrap.querySelector('.field-err') : null;
  }

  function setErr(input, msg) {
    var el = fieldErrEl(input);
    if (el) el.textContent = msg;
    var line = (input.closest('.fp-field') || input.closest('.fp-qa-field') || {});
    line = line.querySelector ? line.querySelector('.field-line') : null;
    if (line) line.style.background = '#e06060';
    input.setAttribute('aria-invalid', 'true');
  }

  function clearErr(input) {
    var el = fieldErrEl(input);
    if (el) el.textContent = '';
    var wrap = input.closest('.fp-field') || input.closest('.fp-qa-field');
    var line = wrap ? wrap.querySelector('.field-line') : null;
    if (line) line.style.removeProperty('background');
    input.removeAttribute('aria-invalid');
  }

  /* ─── Validate one form ─────────────────────────────────── */
  function validate(form) {
    var ok = true, firstBad = null;
    var req = T('ff.err.required');

    /* visible required text/email/select/textarea */
    form.querySelectorAll('input[required], select[required], textarea[required]')
      .forEach(function (input) {
        /* skip fields inside a hidden conditional section */
        if (input.closest('[hidden]')) return;

        if (input.type === 'checkbox') {
          if (!input.checked) {
            ok = false;
            var ce = document.getElementById(form.id === 'athlete-form' ? 'af-consent-err' : 'cf-consent-err');
            if (ce) ce.textContent = T('ff.err.consent');
            if (!firstBad) firstBad = input;
          }
          return;
        }

        var val = (input.value || '').trim();
        if (!val) {
          setErr(input, req); ok = false; if (!firstBad) firstBad = input;
        } else if (input.type === 'email' && !EMAIL_RE.test(val)) {
          setErr(input, T('ff.err.email')); ok = false; if (!firstBad) firstBad = input;
        } else {
          clearErr(input);
        }
      });

    /* optional email fields: validate format if filled */
    form.querySelectorAll('input[type="email"]:not([required])').forEach(function (input) {
      if (input.closest('[hidden]')) return;
      var val = (input.value || '').trim();
      if (val && !EMAIL_RE.test(val)) {
        setErr(input, T('ff.err.email')); ok = false; if (!firstBad) firstBad = input;
      } else { clearErr(input); }
    });

    if (firstBad && firstBad.focus) {
      firstBad.focus({ preventScroll: false });
      firstBad.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'center' });
    }
    return ok;
  }

  /* ─── Collect data (for endpoint / debugging) ───────────── */
  function collectRaw(form) {
    var data = {};
    var fd = new FormData(form);
    fd.forEach(function (value, key) {
      if (data[key] !== undefined) {
        if (!Array.isArray(data[key])) data[key] = [data[key]];
        data[key].push(value);
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  function cleanText(text) {
    return (text || '')
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isHidden(el) {
    return Boolean(el.closest('[hidden]'));
  }

  function labelFor(form, input) {
    if (input.id) {
      var byFor = form.querySelector('label[for="' + input.id.replace(/"/g, '\\"') + '"]');
      if (byFor) return cleanText(byFor.textContent);
    }

    var qa = input.closest('.fp-qa-item');
    if (qa) {
      var qaLabel = qa.querySelector('.fp-qa-label');
      var qaQuestion = qa.querySelector('.fp-qa-q');
      return cleanText([qaLabel && qaLabel.textContent, qaQuestion && qaQuestion.textContent].filter(Boolean).join(' - '));
    }

    var yn = input.closest('.fp-yn-row');
    if (yn) {
      var q = yn.querySelector('.fp-q');
      if (q) return cleanText(q.textContent);
    }

    var prio = input.closest('.fp-prio');
    if (prio) {
      var prioLabel = prio.querySelector('.fp-prio-label');
      if (prioLabel) return cleanText(prioLabel.textContent);
    }

    var group = input.closest('.fp-group');
    if (group) {
      var groupQuestion = group.querySelector('.fp-q');
      if (groupQuestion) return cleanText(groupQuestion.textContent);
    }

    var check = input.closest('.fp-check');
    if (check) {
      var checkText = check.querySelector('.fp-check-text');
      if (checkText) return cleanText(checkText.textContent);
    }

    return cleanText(input.name);
  }

  function optionText(input) {
    if (input.tagName === 'SELECT') {
      return cleanText(input.options[input.selectedIndex] && input.options[input.selectedIndex].textContent) || input.value;
    }

    if (input.type === 'radio') {
      var radioLabel = input.closest('label');
      if (radioLabel) return cleanText(radioLabel.textContent);
    }

    if (input.type === 'checkbox') {
      var check = input.closest('.fp-check');
      var checkText = check && check.querySelector('.fp-check-text');
      if (checkText) return cleanText(checkText.textContent);
      var checkboxLabel = input.closest('label');
      if (checkboxLabel) return cleanText(checkboxLabel.textContent);
    }

    return cleanText(input.value);
  }

  function collectSection(form, section, index) {
    var legend = section.querySelector('.fp-legend');
    var legendTitle = legend && legend.querySelector('span:not(.fp-legend-num)');
    var title = legendTitle ? cleanText(legendTitle.textContent) :
      (legend ? cleanText(legend.textContent) : 'Additional Information');
    var controls = Array.prototype.slice.call(section.querySelectorAll('input[name], select[name], textarea[name]'))
      .filter(function (input) { return !isHidden(input); });

    var entries = [];
    var handled = {};

    controls.forEach(function (input) {
      if (handled[input.name]) return;
      var group = controls.filter(function (item) { return item.name === input.name; });
      handled[input.name] = true;

      if (input.type === 'radio') {
        var checkedRadio = group.find(function (item) { return item.checked; });
        entries.push({
          label: labelFor(form, checkedRadio || input),
          value: checkedRadio ? optionText(checkedRadio) : 'Not selected',
          name: input.name
        });
        return;
      }

      if (input.type === 'checkbox') {
        var checkedBoxes = group.filter(function (item) { return item.checked; });
        entries.push({
          label: labelFor(form, input),
          value: checkedBoxes.length ? checkedBoxes.map(optionText).join(', ') : 'Not selected',
          name: input.name
        });
        return;
      }

      entries.push({
        label: labelFor(form, input),
        value: optionText(input) || '-',
        name: input.name
      });
    });

    return {
      title: title || ('Section ' + (index + 1)),
      entries: entries
    };
  }

  function collectPayload(form) {
    var raw = collectRaw(form);
    var titleEl = document.querySelector('.fp-title');
    var title = cleanText(titleEl && titleEl.textContent);
    var formType = form.id === 'athlete-form' ? 'Athlete Contact Form' : 'Club Contact Form';
    var sections = Array.prototype.slice.call(form.querySelectorAll('.fp-section'))
      .filter(function (section) { return !isHidden(section); })
      .map(function (section, index) { return collectSection(form, section, index); })
      .filter(function (section) { return section.entries.length; });

    return {
      formId: form.id,
      formType: formType,
      title: title || formType,
      page: document.title || formType,
      language: document.documentElement.lang || localStorage.getItem('bxp-lang') || 'en',
      submittedAt: new Date().toISOString(),
      raw: raw,
      sections: sections
    };
  }

  /* ─── Wire a form ───────────────────────────────────────── */
  function initForm(formId, submitId, successId) {
    var form = document.getElementById(formId);
    if (!form) return;
    var btn = document.getElementById(submitId);
    var success = document.getElementById(successId);

    /* clear errors as the user fixes fields */
    form.querySelectorAll('input, select, textarea').forEach(function (f) {
      f.addEventListener('input', function () { clearErr(f); });
      f.addEventListener('change', function () {
        clearErr(f);
        var ce = document.getElementById(formId === 'athlete-form' ? 'af-consent-err' : 'cf-consent-err');
        if (ce && f.type === 'checkbox' && f.checked) ce.textContent = '';
      });
    });

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!validate(form)) {
        if (!REDUCED_MOTION && form.animate) {
          form.animate(
            [{ transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
            { duration: 350, easing: 'ease-in-out' }
          );
        }
        return;
      }

      var payload = collectPayload(form);

      var textEl = btn.querySelector('.btn-text');
      var loadEl = btn.querySelector('.btn-loader');
      btn.disabled = true;
      if (textEl) textEl.style.display = 'none';
      if (loadEl) loadEl.style.display = 'flex';

      function releaseButton() {
        btn.disabled = false;
        if (textEl) textEl.style.display = '';
        if (loadEl) loadEl.style.display = 'none';
      }

      function showMessage(message, isError) {
        if (success) {
          success.textContent = message;
          success.classList.toggle('is-error', Boolean(isError));
          success.style.display = 'block';
          success.scrollIntoView({ behavior: REDUCED_MOTION ? 'auto' : 'smooth', block: 'center' });
        }
      }

      function done() {
        releaseButton();
        showMessage(T('ff.success'), false);
        form.reset();
        /* re-hide conditional sections after reset */
        form.querySelectorAll('.fp-conditional').forEach(function (s) { s.hidden = true; });
        setTimeout(function () { if (success) success.style.display = 'none'; }, 8000);
      }

      try {
        var response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          var errPayload = {};
          try { errPayload = await response.json(); } catch (_) {}
          throw new Error(errPayload.error || 'FORM_SUBMIT_FAILED');
        }

        done();
      } catch (err) {
        console.error('[BXP form] submit failed:', err);
        releaseButton();
        var errorMessage = T('ff.error');
        if (errorMessage === 'ff.error') {
          errorMessage = 'The PDF could not be sent. Please try again later or contact BXP directly.';
        }
        showMessage(errorMessage, true);
        return;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initReveals();
    initForm('athlete-form', 'af-submit', 'af-success');
    initForm('club-form', 'cf-submit', 'cf-success');
  });
})();
