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

  /* ---- Video facade -------------------------------------------------------
     Reveals the poster overlay only once JS is available. The <video> keeps its
     native controls throughout, so nothing here is load-bearing. */
  $$('[data-vfacade]').forEach(function (wrap) {
    var video = $('video', wrap);
    var cover = $('.vfacade__cover', wrap);
    if (!video || !cover) return;
    cover.hidden = false;
    cover.addEventListener('click', function () {
      cover.hidden = true;
      video.focus({ preventScroll: true });
      var p = video.play();
      /* Autoplay policies reject play() when it is not seen as a user gesture;
         the controls are already visible, so failing here is harmless. */
      if (p && p.catch) p.catch(function () {});
    });
    /* Bring the cover back when the clip finishes, so the section returns to a
       composed state instead of a black frame. */
    video.addEventListener('ended', function () { cover.hidden = false; });
  });

  /* ---- Scroll timeline ----------------------------------------------------
     Vanilla replacement for Framer Motion's useScroll/useTransform: the rail's
     fill height is just scroll progress through the timeline, written to a CSS
     custom property. Reads are batched into rAF so the scroll handler never
     does layout work per event, and the observer means it only runs while the
     section is actually on screen. Without JS the rail stays unfilled. */
  var tl = $('#timeline');
  if (tl) {
    var fill = $('.tline__fill', tl);
    var items = $$('.tline__item', tl);

    /* Only wire the JS path where scroll-driven CSS is unavailable. Where it
       is supported the animation is already running off the main thread, and
       adding a scroll listener on top would be duplicated work. */
    var cssDriven = window.CSS && CSS.supports && CSS.supports('animation-timeline: view()');

    if (fill && !reduced && !cssDriven) {
      var ticking = false;

      var paint = function () {
        ticking = false;
        var r = tl.getBoundingClientRect();
        var vh = innerHeight;
        /* Progress from the moment the timeline's top reaches 10% down the
           viewport until its end passes the midpoint — the window the original
           expressed as offset: ["start 10%", "end 50%"]. */
        var start = vh * 0.1;
        var span = r.height - (vh * 0.5) + start;
        var p = span > 0 ? (start - r.top) / span : 0;
        p = Math.max(0, Math.min(1, p));
        fill.style.setProperty('--fill', p * 100 + '%');

        /* Light up each entry once the fill has reached its dot. */
        var reached = r.top + r.height * p;
        items.forEach(function (it) {
          var d = it.querySelector('.tline__dot');
          if (d) it.classList.toggle('is-passed', d.getBoundingClientRect().top <= reached);
        });
      };

      /* No IntersectionObserver gate here on purpose. Gating the handler on an
         observer meant one missed callback left the rail frozen at 0% for the
         whole page. rAF throttling already keeps this to one layout read per
         frame, which is cheap enough to just always run. */
      var onScroll = function () {
        if (!ticking) { ticking = true; requestAnimationFrame(paint); }
      };
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', onScroll, { passive: true });
      paint();
    } else if (fill) {
      /* Reduced motion: show the rail complete rather than animating it. */
      fill.style.setProperty('--fill', '100%');
      items.forEach(function (it) { it.classList.add('is-passed'); });
    }
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
    /* Order comes from the panels, not the cards: the marquee repeats each
       piece, so a card-derived list would contain duplicates and break prev/next. */
    var order = panels.map(function (p) { return p.id.replace(/^p-/, ''); });

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
      var link = e.target.closest && e.target.closest('[data-piece]');
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

    /* ---- Steps ------------------------------------------------------------
       Pagination is switched on here rather than in the markup: if this script
       never runs, every fieldset stays visible and the form still submits in
       one POST with all fields present. */
    var steps = $$('.step', form);
    var marks = $$('.steps__item', form);
    var back = $('#form-back'), next = $('#form-next'), send = $('#form-send');
    var errBox = $('#form-error');

    if (steps.length > 1 && back && next && send) {
      var at = 0;
      form.classList.add('is-stepped');
      $('#steps').removeAttribute('aria-hidden');

      var render = function () {
        steps.forEach(function (s, i) { s.classList.toggle('is-active', i === at); });
        marks.forEach(function (m, i) {
          m.classList.toggle('is-current', i === at);
          m.classList.toggle('is-done', i < at);
        });
        back.hidden = at === 0;
        next.hidden = at === steps.length - 1;
        send.hidden = at !== steps.length - 1;
        if (errBox) errBox.hidden = true;
      };

      /* Native constraint validation, scoped to the visible step. reportValidity
         on the whole form would try to focus a control inside a hidden fieldset,
         which browsers refuse to do — the submit would fail silently. */
      var stepValid = function () {
        var fields = $$('input, select, textarea', steps[at]);
        for (var i = 0; i < fields.length; i++) {
          if (!fields[i].checkValidity()) {
            fields[i].reportValidity();
            return false;
          }
        }
        /* The checkbox group has no native "one of" rule. */
        if (at === 1 && !form.querySelector('[name=need]:checked')) {
          if (errBox) {
            errBox.textContent = 'Pick at least one thing you need — or "Not sure yet".';
            errBox.hidden = false;
          }
          return false;
        }
        return true;
      };

      next.addEventListener('click', function () {
        if (!stepValid()) return;
        at = Math.min(at + 1, steps.length - 1);
        render();
        steps[at].scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
        var first = $('input, select, textarea', steps[at]);
        if (first) first.focus({ preventScroll: true });
      });

      back.addEventListener('click', function () {
        at = Math.max(at - 1, 0);
        render();
        steps[at].scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      });

      /* A field left invalid on an earlier step would otherwise block submit
         with no visible cause, so jump back to whichever step actually fails. */
      form.addEventListener('submit', function (e) {
        for (var i = 0; i < steps.length; i++) {
          var fields = $$('input, select, textarea', steps[i]);
          for (var j = 0; j < fields.length; j++) {
            if (!fields[j].checkValidity()) {
              e.preventDefault();
              at = i; render();
              fields[j].reportValidity();
              return;
            }
          }
        }
      });

      render();
    }
  }
})();
