/* ==========================================================================
   Progressive enhancement only. Every feature below has a working no-JS path:
   the gallery renders all cards, the lightbox opens via :target, the form
   submits natively, and reveals are disabled by a CSS rule keyed on html.js.
   No dependencies.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- Theme -------------------------------------------------------------
     The inline <head> script already applied any stored choice. This only
     handles the toggle and keeps the label describing the destination. */
  var toggle = $('#theme');
  if (toggle) {
    var label = function () {
      var dark = getComputedStyle(root).colorScheme.indexOf('dark') === 0 ||
                 root.dataset.theme === 'dark';
      toggle.setAttribute('aria-label',
        dark ? 'Switch to light theme' : 'Switch to dark theme');
    };
    label();
    toggle.addEventListener('click', function () {
      var now = root.dataset.theme ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = now === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
      label();
    });
  }

  /* ---- Nav --------------------------------------------------------------- */
  var nav = $('#nav');
  var burger = $('#burger');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    $$('#navlinks a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }
  if (nav) {
    var stick = function () { nav.classList.toggle('is-stuck', scrollY > 8); };
    stick();
    addEventListener('scroll', stick, { passive: true });
  }

  /* ---- Scroll reveal ------------------------------------------------------
     Fires once per element, then stops observing. Never re-animates on the way
     back up — repeated reveals are what make a page feel restless. */
  var revealables = $$('.reveal');
  if (revealables.length && 'IntersectionObserver' in window && !reduced) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        ro.unobserve(e.target);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    revealables.forEach(function (el) { ro.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---- Touch: pan each card once as it comes into view --------------------
     Hover does not exist on touch, so the Scroll Window would otherwise never
     demonstrate itself on the devices most people browse from. */
  if (matchMedia('(hover: none)').matches && 'IntersectionObserver' in window && !reduced) {
    var po = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-seen');
        po.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    $$('.work-card').forEach(function (c) { po.observe(c); });
  }

  /* ---- Gallery filter -----------------------------------------------------
     Toggles [hidden] on markup that is already in the document, so the names
     stay in the source for crawlers no matter which chip is active. */
  var chips = $$('.chip');
  var grid = $('#grid');
  if (chips.length && grid) {
    var status = $('#filter-status');
    var cards = $$('.work-card', grid);
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.dataset.filter;
        chips.forEach(function (c) {
          c.setAttribute('aria-pressed', String(c === chip));
        });
        var shown = 0;
        cards.forEach(function (card) {
          var match = f === 'all' || card.dataset.cat === f;
          card.hidden = !match;
          if (match) shown++;
        });
        if (status) {
          status.textContent = 'Showing ' + shown + ' of ' + cards.length + ' projects';
        }
      });
    });
  }

  /* ---- Lightbox -----------------------------------------------------------
     Enhances the same :target panels the no-JS path uses: adds focus capture
     and restore, Esc and arrow keys, a scroll-progress rail, and a shareable
     ?p=slug URL. Nothing here creates markup. */
  var panels = $$('.lightbox');
  if (panels.length) {
    var openPanel = null;
    var lastFocus = null;
    var order = $$('.work-card__link').map(function (a) { return a.dataset.piece; });

    var rail = function (panel) {
      var sc = $('.lightbox__scroll', panel);
      var bar = $('.lightbox__rail', panel);
      if (!sc || !bar) return;
      var upd = function () {
        var max = sc.scrollHeight - sc.clientHeight;
        bar.style.setProperty('--progress',
          (max > 0 ? (sc.scrollTop / max) * 100 : 0) + '%');
      };
      sc.addEventListener('scroll', upd, { passive: true });
      upd();
    };

    var open = function (slug, focusEl) {
      var panel = document.getElementById('p-' + slug);
      if (!panel) return false;
      close(true);
      lastFocus = focusEl || document.activeElement;
      openPanel = panel;
      panel.classList.add('is-open');
      document.body.classList.add('is-locked');
      if (!$('.lightbox__rail', panel)) {
        var b = document.createElement('span');
        b.className = 'lightbox__rail';
        panel.appendChild(b);
        rail(panel);
      }
      var closeBtn = $('.lightbox__close', panel);
      if (closeBtn) closeBtn.focus();
      history.pushState({ piece: slug }, '', '?p=' + slug);
      return true;
    };

    var close = function (silent) {
      if (!openPanel) return;
      openPanel.classList.remove('is-open');
      openPanel = null;
      document.body.classList.remove('is-locked');
      if (!silent) {
        history.pushState({}, '', location.pathname);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
    };

    var step = function (dir) {
      if (!openPanel) return;
      var i = order.indexOf(openPanel.id.replace(/^p-/, ''));
      var next = order[(i + dir + order.length) % order.length];
      if (next) open(next, lastFocus);
    };

    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('.work-card__link');
      if (link && link.dataset.piece) {
        if (open(link.dataset.piece, link)) e.preventDefault();
        return;
      }
      if (e.target.closest && e.target.closest('.lightbox__close, .lightbox__scrim')) {
        if (openPanel) { e.preventDefault(); close(); }
      }
    });

    document.addEventListener('keydown', function (e) {
      if (!openPanel) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'Tab') {
        /* Focus trap: the panel is fixed over the page, so tabbing out of it
           would land on content the user cannot see. */
        var f = $$('a[href], button, [tabindex]:not([tabindex="-1"])', openPanel);
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    addEventListener('popstate', function () {
      var slug = new URLSearchParams(location.search).get('p');
      if (slug) open(slug); else close(true);
    });

    /* Deep link: /work.html?p=frank-kern opens straight into that piece. */
    var initial = new URLSearchParams(location.search).get('p');
    if (initial) open(initial);
  }

  /* ---- Form: answered counter and the filling rail ------------------------
     Momentum without pagination. Degrades to a static rail and a static count. */
  var form = $('#inquiry-form');
  if (form) {
    var count = $('#form-count');
    var groups = [
      /* form.name is the <form>'s own name attribute, not the field — always
         query for the input explicitly. */
      function () { var el = form.querySelector('input[name=name]'); return !!(el && el.value.trim()); },
      function () { var el = form.querySelector('[name=email]'); return !!(el && el.value && el.checkValidity()); },
      function () { return !!form.querySelector('[name=need]:checked'); },
      function () { var el = form.querySelector('[name=scope]'); return !!(el && el.value.trim().length >= 40); },
      function () { return !!form.querySelector('[name=budget]:checked'); },
      function () { return !!form.querySelector('[name=timeline]:checked'); }
    ];
    var update = function () {
      var done = groups.reduce(function (n, fn) { return n + (fn() ? 1 : 0); }, 0);
      if (count) count.textContent = done + ' of 6 answered';
      form.style.setProperty('--filled', (done / groups.length) * 100 + '%');
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    update();
  }
})();
