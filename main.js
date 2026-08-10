/* ===========================================================================
   Momo — site behaviour. Lenis + GSAP/ScrollTrigger from CDN.

   Two ideas hold the page together:
   1. The whole page is one 25-minute session. Scroll progress IS the clock, so
      the header, the hero dial, the phone's timer and the Dynamic Island all
      read from it.
   2. The buddy reacts. Each act declares the screen, and the island state, that
      it wants; the sticky phone follows along.
   =========================================================================== */

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktop = matchMedia('(min-width: 1041px)');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const HAS_GSAP = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

// Only now may CSS hide anything: if the CDN failed, the page stays fully readable.
if (HAS_GSAP && !REDUCED) document.documentElement.classList.add('anim');

const mmss = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/* --- smooth scrolling ----------------------------------------------------
   Lenis drives the scroll and ScrollTrigger reads from it, so scrubbed
   animations stay locked to the eased position instead of the raw one. Both are
   skipped entirely under reduced motion — native scrolling is the honest
   fallback, and hijacking it is exactly what that setting asks you not to do.
   ---------------------------------------------------------------------- */
let lenis = null;
if (HAS_GSAP && !REDUCED && typeof Lenis !== 'undefined') {
  lenis = new Lenis({ duration: 1.05, wheelMultiplier: 0.9, touchMultiplier: 1.6 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  // GSAP freezes tweens when a frame takes too long; that stalls reveals on slow
  // devices (and inside headless screenshots). We drive the ticker ourselves.
  gsap.ticker.lagSmoothing(0);

  // In-page links have to go through Lenis or they fight it.
  $$('a[href^="#"]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const target = $(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -70 });
    }),
  );
}

/* --- the buddy's vocabulary, said by the headline ----------------------- */
(() => {
  const cycler = $('#cycler');
  if (!cycler) return;
  const words = ['notices', 'waits', 'cheers', 'sulks'];

  words.forEach((w, i) => {
    const s = document.createElement('span');
    s.textContent = w;
    s.setAttribute('aria-hidden', 'true');
    if (i === 0) s.className = 'is-on';
    cycler.append(s);
  });
  if (REDUCED) return;

  let i = 0;
  const spans = [...cycler.children];
  setInterval(() => {
    spans[i].classList.remove('is-on');
    i = (i + 1) % spans.length;
    spans[i].classList.add('is-on');
    cycler.setAttribute('aria-label', words[i]);
  }, 2400);
})();

/* --- headline: split into words for the CSS stagger --------------------- */
(() => {
  const pre = $('#h1 .pre');
  if (!pre) return;
  const out = [];
  let n = 0;
  [...pre.childNodes].forEach((node) => {
    if (node.nodeType !== 3) return out.push(node);
    node.textContent.split(/(\s+)/).forEach((chunk) => {
      if (!chunk.trim()) return out.push(document.createTextNode(' '));
      const s = document.createElement('span');
      s.className = 'word';
      s.style.setProperty('--i', n++); // CSS reads --i for its delay
      s.textContent = chunk;
      out.push(s);
    });
  });
  pre.replaceChildren(...out);
})();

/* --- hero dial: a whole session, compressed to 30s ---------------------- */
(() => {
  const dial = $('#dial');
  const time = $('#dialTime');
  const ghost = dial && $('.ghost', dial);
  if (!dial || REDUCED) return;

  const RUN = 26;
  const CHEER = 4;
  let t0 = null;

  const frame = (now) => {
    if (t0 === null) t0 = now;
    const t = ((now - t0) / 1000) % (RUN + CHEER);
    if (t < RUN) {
      const p = t / RUN;
      dial.style.setProperty('--p', p.toFixed(4));
      time.textContent = mmss(1500 * (1 - p));
      if (ghost.dataset.state !== 'busy') ghost.dataset.state = 'busy';
    } else {
      dial.style.setProperty('--p', '1');
      time.textContent = 'done';
      if (ghost.dataset.state !== 'celebrating') ghost.dataset.state = 'celebrating';
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();

if (!HAS_GSAP) {
  // Nothing below can run without ScrollTrigger, and everything below is
  // enhancement. Bail out rather than throwing halfway through.
  console.warn('[momo] GSAP unavailable — scroll animations disabled');
} else {
  /* --- reveals ----------------------------------------------------------- */
  if (REDUCED) {
    $$('.rise').forEach((el) => el.classList.add('is-in'));
  } else {
    $$('.rise').forEach((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: () => el.classList.add('is-in'),
      }),
    );
  }

  /* --- header: the page's clock and progress ---------------------------- */
  (() => {
    const bar = $('#bar');
    const clock = $('#clock');
    const hdr = $('#hdr');
    const outs = [$('#scTimer'), $('#notchTime'), $('#laTime')].filter(Boolean);
    const tracks = [$('#scTrack'), $('#notchBar'), $('#laTrack')].filter(Boolean);

    const paint = (p) => {
      bar.style.setProperty('--p', p.toFixed(4));
      // Countdown, not percentage — the site is a session, so it speaks in minutes.
      const left = 1500 * (1 - p);
      clock.textContent = `${mmss(left)} left`;
      outs.forEach((el) => (el.textContent = mmss(left)));
      tracks.forEach((el) => el.style.setProperty('--p', p.toFixed(4)));
      hdr.classList.toggle('is-stuck', p > 0.005);
    };

    ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (self) => paint(self.progress) });
    paint(0);
  })();

  /* --- the story: acts drive the phone ---------------------------------- */
  (() => {
    const acts = $('#acts');
    const rail = $('.rail');
    const phone = $('#phone');
    if (!acts || !phone) return;

    const screens = $$('.screen', phone);
    const notchTime = $('#notchTime');
    let graceTimer = null;

    const countRewards = () => {
      $$('.reward b', phone).forEach((el, i) => {
        const to = parseFloat(el.textContent.replace('+', ''));
        const plus = el.textContent.trim().startsWith('+');
        const o = { v: 0 };
        gsap.to(o, {
          v: to,
          duration: 0.9,
          delay: 0.18 + i * 0.12,
          ease: 'power2.out',
          onUpdate: () => (el.textContent = (plus ? '+' : '') + Math.round(o.v)),
        });
      });
      gsap.fromTo(
        $$('.reward', phone),
        { scale: 0.86, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'back.out(2.2)' },
      );
    };

    const popChips = () =>
      gsap.fromTo(
        $$('.screen[data-screen="home"] .chip', phone),
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45, stagger: 0.08, ease: 'back.out(2.4)' },
      );

    const show = (act) => {
      const name = act.dataset.screen;
      screens.forEach((s) => s.classList.toggle('is-on', s.dataset.screen === name));

      const island = act.dataset.island || 'off';
      phone.dataset.island = island;

      // Rewards land as a count-up, the way they do in the app's results screen.
      if (name === 'results' && !REDUCED) countRewards();
      if (name === 'home' && !REDUCED) popChips();

      // The grace period is the one number on this page that isn't scroll-driven:
      // it's a real 10-second countdown, because that's what it is in the app.
      clearInterval(graceTimer);
      if (island === 'grace' && notchTime && !REDUCED) {
        let n = 10;
        notchTime.textContent = `⚠ ${n}`;
        graceTimer = setInterval(() => {
          n -= 1;
          notchTime.textContent = `⚠ ${Math.max(0, n)}`;
          if (n <= 0) clearInterval(graceTimer);
        }, 1000);
      }
    };

    const build = () => {
      if (desktop.matches) {
        if (rail.parentElement === acts) acts.before(rail); // phone sits left
        $$('.act', acts).forEach((act) =>
          ScrollTrigger.create({
            trigger: act,
            start: 'top 60%',
            end: 'bottom 40%',
            id: 'act',
            onToggle: (self) => self.isActive && show(act),
          }),
        );
      } else {
        // No sticky on small screens: drop the phone inline after the second beat
        // and hold it on the session screen — the most representative single view.
        const anchor = $$('.act', acts)[1];
        if (anchor && rail.parentElement !== acts) anchor.after(rail);
        show(acts.children[1] || acts.children[0]);
      }
    };

    build();
    desktop.addEventListener('change', () => {
      ScrollTrigger.getById('act') && ScrollTrigger.getAll().forEach((t) => t.vars.id === 'act' && t.kill());
      build();
      ScrollTrigger.refresh();
    });
  })();

  /* --- horizontal shelves ---------------------------------------------- */
  const shelf = (beltSel, secSel) => {
    const belt = $(beltSel);
    const sec = $(secSel);
    if (!belt || !sec || REDUCED) return;
    gsap.to(belt, {
      x: () => -Math.max(0, belt.scrollWidth - window.innerWidth + 40),
      ease: 'none',
      scrollTrigger: {
        trigger: sec,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.6,
        invalidateOnRefresh: true,
      },
    });
  };
  shelf('#castBelt', '#cast');
  shelf('#featBelt', '#more');

  /* --- strict mode: the apps go dark ----------------------------------- */
  (() => {
    const grid = $('#blockGrid');
    if (!grid) return;
    const tiles = $$('.tile:not([data-momo])', grid);
    const momo = $('.tile--momo', grid);

    ScrollTrigger.create({
      trigger: grid,
      start: 'top 72%',
      onEnter: () => {
        momo?.classList.add('is-lit');
        // Staggered by hand rather than tweened: the tiles animate themselves in
        // CSS, this only decides when each one gives up.
        tiles.forEach((t, i) => setTimeout(() => t.classList.add('is-blocked'), 120 + i * 110));
      },
      // Reset on the way back up so the beat replays on a second pass.
      onLeaveBack: () => {
        momo?.classList.remove('is-lit');
        tiles.forEach((t) => t.classList.remove('is-blocked'));
      },
    });
  })();

  /* --- streak calendar -------------------------------------------------- */
  (() => {
    const cal = $('#cal');
    if (!cal) return;
    const missed = new Set([3, 9, 16]);
    // Cells start empty and take their colour one at a time, so you watch the
    // chain build rather than finding it already built.
    const cells = Array.from({ length: 28 }, (_, i) => {
      const el = document.createElement('i');
      el.dataset.k = i === 27 ? 'today' : missed.has(i) ? '' : 'on';
      cal.append(el);
      return el;
    });

    if (REDUCED) {
      cells.forEach((el) => el.dataset.k && el.classList.add(el.dataset.k));
      return;
    }
    ScrollTrigger.create({
      trigger: cal,
      start: 'top 86%',
      once: true,
      onEnter: () =>
        cells.forEach((el, i) =>
          gsap.delayedCall(i * 0.035, () => {
            if (el.dataset.k) el.classList.add(el.dataset.k);
            gsap.fromTo(el, { scale: 0.55 }, { scale: 1, duration: 0.5, ease: 'back.out(2.6)' });
          }),
        ),
    });
  })();

  /* --- micro: small staggered entrances --------------------------------- */
  // One helper, used wherever a group of small things should arrive in sequence
  // rather than all at once. Deliberately restrained: a short travel, one ease.
  const pop = (sel, opts = {}) => {
    const els = $$(sel);
    if (!els.length || REDUCED) return;
    gsap.from(els, {
      opacity: 0,
      y: opts.y ?? 14,
      scale: opts.scale ?? 0.9,
      duration: 0.55,
      ease: 'back.out(1.8)',
      stagger: opts.stagger ?? 0.07,
      scrollTrigger: { trigger: opts.trigger || els[0], start: opts.start || 'top 90%', once: true },
    });
  };

  pop('#facts li', { trigger: '#facts', y: 10, stagger: 0.08, start: 'top 98%' });
  pop('.feat__ico', { stagger: 0.05, trigger: '#more' });
  pop('.cast .card', { trigger: '#cast', y: 22, scale: 0.95, stagger: 0.06 });
  pop('.feat .card', { trigger: '#more', y: 22, scale: 0.96, stagger: 0.06 });
  pop('.badges img', { trigger: '#more', stagger: 0.09 });

  // The Strict Mode card's little week strip fills like the calendar does.
  (() => {
    const strip = $('#lockStrip');
    if (!strip || REDUCED) return;
    const bars = $$('i', strip);
    const keep = bars.map((b) => b.className);
    bars.forEach((b) => (b.className = ''));
    ScrollTrigger.create({
      trigger: strip,
      start: 'top 92%',
      once: true,
      onEnter: () =>
        bars.forEach((b, i) =>
          gsap.delayedCall(i * 0.1, () => {
            b.className = keep[i];
            gsap.fromTo(b, { scaleY: 0.5 }, { scaleY: 1, duration: 0.4, ease: 'back.out(3)' });
          }),
        ),
    });
  })();

  /* --- stats heatmap in the feature shelf ------------------------------ */
  (() => {
    const heat = $('#heat');
    if (!heat) return;
    // A plausible week: quiet mornings, a strong mid-morning block, an evening dip.
    const shape = [8, 22, 46, 74, 88, 62, 30, 18, 34, 58, 44, 16];
    const cells = [];
    for (let row = 0; row < 5; row++) {
      shape.forEach((v) => {
        const i = document.createElement('i');
        const jitter = ((row * 7 + v) % 11) * 3;
        i.style.setProperty('--v', Math.max(6, Math.min(100, v - row * 6 + jitter)));
        heat.append(i);
        cells.push(i);
      });
    }
    if (REDUCED) return;
    // Sweep left-to-right so it reads as a day filling in, not a grid appearing.
    gsap.from(cells, {
      opacity: 0,
      scale: 0.4,
      duration: 0.4,
      ease: 'back.out(2)',
      stagger: { each: 0.008, from: 'start' },
      scrollTrigger: { trigger: heat, start: 'top 92%', once: true },
    });
  })();

  /* --- one small pointer flourish, nothing more ------------------------ */
  if (!REDUCED && matchMedia('(hover: hover)').matches) {
    $$('.btn:not(.btn--soon)').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        gsap.to(btn, {
          x: ((e.clientX - r.left) / r.width - 0.5) * 8,
          y: ((e.clientY - r.top) / r.height - 0.5) * 5,
          duration: 0.35,
          ease: 'power2.out',
        });
      });
      btn.addEventListener('pointerleave', () =>
        gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }),
      );
    });
  }

  // Fonts land after first paint and change every measurement on the page.
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
}
