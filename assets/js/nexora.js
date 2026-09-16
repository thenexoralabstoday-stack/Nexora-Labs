/* Copyright (c) 2026 Nexora Labs. All rights reserved. */
/* Nexora Labs — interaction & motion                                       */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  var calm = reduced.matches;
  reduced.addEventListener('change', function (e) { calm = e.matches; });

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ════════════════════════════════════════════════════════════════════
     Navigation — condense on scroll, draw progress along the base rule
     ════════════════════════════════════════════════════════════════════ */

  var nav = $('#nav');
  var navTicking = false;

  function onScroll() {
    if (navTicking) return;
    navTicking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      nav.classList.toggle('is-stuck', y > 24);

      var max = document.documentElement.scrollHeight - window.innerHeight;
      nav.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);

      navTicking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  onScroll();

  /* ════════════════════════════════════════════════════════════════════
     Mobile sheet
     ════════════════════════════════════════════════════════════════════ */

  var toggle = $('#navToggle');
  var sheet = $('#navSheet');
  var open = false;

  function setMenu(next) {
    open = next;
    toggle.setAttribute('aria-expanded', String(open));
    sheet.classList.toggle('is-open', open);
    sheet.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      var first = sheet.querySelector('a');
      if (first) first.focus({ preventScroll: true });
    }
  }

  toggle.addEventListener('click', function () { setMenu(!open); });
  $$('a', sheet).forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) { setMenu(false); toggle.focus(); }
  });

  // Close the sheet if the viewport grows past the mobile breakpoint.
  window.matchMedia('(min-width: 761px)').addEventListener('change', function (e) {
    if (e.matches && open) setMenu(false);
  });

  /* ════════════════════════════════════════════════════════════════════
     Scroll reveal
     ════════════════════════════════════════════════════════════════════ */

  var targets = $$('[data-reveal]');

  if ('IntersectionObserver' in window && !calm) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });

    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ════════════════════════════════════════════════════════════════════
     Anchor scrolling that accounts for the fixed nav
     ════════════════════════════════════════════════════════════════════ */

  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#' || id.length < 2) return;

      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      var offset = nav.offsetHeight + 8;
      var top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: calm ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* ════════════════════════════════════════════════════════════════════
     Pointer-driven depth — one shared rAF loop for every effect
     ════════════════════════════════════════════════════════════════════ */

  var sigil = $('#heroSigil');
  var magnets = $$('[data-magnet]');
  var stages = $$('[data-tilt]');

  var pointer = { x: 0, y: 0 };      // normalised −1 … 1 across the viewport
  var eased = { x: 0, y: 0 };
  var scrollY = 0;
  var looping = false;

  function onPointerMove(e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    start();
  }

  function frame() {
    // Critically damped-ish easing keeps motion soft rather than twitchy.
    eased.x += (pointer.x - eased.x) * 0.06;
    eased.y += (pointer.y - eased.y) * 0.06;

    scrollY = window.scrollY;

    if (sigil) {
      var drift = scrollY * 0.12;                 // slow parallax against the copy
      sigil.style.transform =
        'translate3d(' + (eased.x * 18).toFixed(2) + 'px, calc(-50% + ' +
        (drift + eased.y * 14).toFixed(2) + 'px), 0) rotate(' +
        (eased.x * 1.6).toFixed(2) + 'deg)';
    }

    magnets.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      var dx = (pointer.x * window.innerWidth / 2 + window.innerWidth / 2) - cx;
      var dy = (pointer.y * window.innerHeight / 2 + window.innerHeight / 2) - cy;
      var dist = Math.hypot(dx, dy);
      var range = 150;

      if (dist < range) {
        var pull = (1 - dist / range) * 0.26;
        el.style.transform = 'translate(' + (dx * pull).toFixed(2) + 'px,' + (dy * pull).toFixed(2) + 'px)';
      } else if (el.style.transform) {
        el.style.transform = '';
      }
    });

    var settled = Math.abs(pointer.x - eased.x) < 0.001 && Math.abs(pointer.y - eased.y) < 0.001;
    if (settled) { looping = false; return; }
    requestAnimationFrame(frame);
  }

  function start() {
    if (looping || calm) return;
    looping = true;
    requestAnimationFrame(frame);
  }

  if (!calm && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', start, { passive: true });
    start();
  }

  /* Product stages tilt toward the cursor only while hovered. */
  if (!calm) {
    stages.forEach(function (stage) {
      var device = $('.device', stage);
      if (!device) return;

      stage.addEventListener('pointermove', function (e) {
        var r = stage.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        device.style.setProperty('--ry', (px * 7).toFixed(2) + 'deg');
        device.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg');
      });

      stage.addEventListener('pointerleave', function () {
        device.style.setProperty('--ry', '0deg');
        device.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     Hero embers — a sparse rising field, paused whenever it is unseen
     ════════════════════════════════════════════════════════════════════ */

  (function embers() {
    var canvas = $('#embers');
    if (!canvas || calm) return;

    var ctx = canvas.getContext('2d', { alpha: true });
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0;
    var parts = [];
    var raf = null;
    var visible = true;

    var TINTS = ['0,229,160', '34,211,238', '59,130,246'];

    function resize() {
      var host = canvas.parentElement;
      w = host.offsetWidth;
      h = host.offsetHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function spawn(atBottom) {
      return {
        x: Math.random() * w,
        y: atBottom ? h + Math.random() * 40 : Math.random() * h,
        vy: -(0.12 + Math.random() * 0.3),
        drift: (Math.random() - 0.5) * 0.24,
        phase: Math.random() * Math.PI * 2,
        r: 0.5 + Math.random() * 1.4,
        alpha: 0.18 + Math.random() * 0.42,
        tint: TINTS[(Math.random() * TINTS.length) | 0]
      };
    }

    function seed() {
      // Density scales with area so phones do far less work.
      var count = Math.round(Math.min(46, Math.max(14, (w * h) / 32000)));
      parts = [];
      for (var i = 0; i < count; i++) parts.push(spawn(false));
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        p.phase += 0.01;
        p.y += p.vy;
        p.x += p.drift + Math.sin(p.phase) * 0.22;

        if (p.y < -20 || p.x < -20 || p.x > w + 20) { parts[i] = spawn(true); continue; }

        // Fade in from the bottom and out toward the top of the hero.
        var travel = 1 - p.y / h;
        var a = p.alpha * Math.min(1, travel * 3) * Math.min(1, (1 - travel) * 4 + 0.15);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + p.tint + ',' + a.toFixed(3) + ')';
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    }

    function play() {
      if (raf === null && visible && !document.hidden) raf = requestAnimationFrame(draw);
    }
    function pause() {
      if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }

    resize();
    play();

    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(resize, 160);
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      document.hidden ? pause() : play();
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        visible ? play() : pause();
      }, { threshold: 0 }).observe(canvas);
    }
  })();

  /* ════════════════════════════════════════════════════════════════════
     Contact form — posts to /api/contact, unchanged contract
     ════════════════════════════════════════════════════════════════════ */

  var form = $('#contactForm');
  var status = $('#formStatus');
  var submit = $('#formSubmit');

  function fieldOf(input) { return input.closest('.field'); }

  function validate(input) {
    var value = input.value.trim();
    var ok = value !== '';

    if (ok && input.type === 'email') {
      ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    fieldOf(input).classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    return ok;
  }

  $$('input, textarea', form).forEach(function (input) {
    // Only re-validate after a first failure, so typing is never nagged at.
    input.addEventListener('input', function () {
      if (fieldOf(input).classList.contains('is-invalid')) validate(input);
    });
    input.addEventListener('blur', function () {
      if (input.value.trim() !== '') validate(input);
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var inputs = $$('input, textarea', form);
    var valid = inputs.map(validate).every(Boolean);

    if (!valid) {
      status.className = 'form__status is-error';
      status.textContent = 'Please complete the highlighted fields.';
      var bad = $('.field.is-invalid input, .field.is-invalid textarea', form);
      if (bad) bad.focus();
      return;
    }

    status.className = 'form__status is-sending';
    status.textContent = 'Sending…';
    submit.disabled = true;

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        message: form.message.value.trim()
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        status.className = 'form__status is-ok';
        status.textContent = 'Message received. We read everything, and we’ll reply soon.';
        form.reset();
      })
      .catch(function () {
        status.className = 'form__status is-error';
        status.textContent = 'That didn’t send. Email thenexoralabstoday@gmail.com and we’ll pick it up there.';
      })
      .then(function () {
        submit.disabled = false;
      });
  });
})();
