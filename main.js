/* Momo site: scrolling, reveals and the DOM half of every scene. The 3D half is js/stage.js,
   which reads window.momoStory (written here) for the scroll-driven story.

   Progressive enhancement: everything reads fine without GSAP. Only once GSAP is confirmed do we
   add .anim to <html>, which is what lets CSS hide things before they reveal. */
(() => {
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const gsap = window.gsap;
  const ST = window.ScrollTrigger;
  const smooth = 'power3.out';

  // ---------------------------------------------------------------- the story's state (also for stage.js)
  // Four beats over the sticky section; hits = when, inside beat 1, each app bounces off the shield.
  const story = (window.momoStory = { p: 0, beat: 0, local: 0, hits: [0.3, 0.45, 0.6, 0.75] });
  const how = $('#how');
  const steps = $$('.step');
  const dots = $$('.dots i');
  const hudTime = $('#hudTime');
  const hudLabel = $('#hudLabel');
  const hudReward = $('#hudReward');
  const hudFail = $('#hudFail');
  const hudStreak = $('#hudStreak');
  const apps = $$('#hudApps .app');
  const stageEl = $('.how__stage');
  let beat = -1;
  const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function storyUpdate() {
    if (!how) return;
    const r = how.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    story.p = p;
    story.beat = Math.min(3, Math.floor(p * 4));
    story.local = p * 4 - story.beat;
    if (story.beat !== beat) {
      beat = story.beat;
      steps.forEach((s, i) => s.classList.toggle('is-on', i === beat));
      dots.forEach((d, i) => d.classList.toggle('is-on', i === beat));
      if (gsap) {
        gsap.to(hudReward, { autoAlpha: beat === 3 ? 1 : 0, y: beat === 3 ? 0 : 16, duration: 0.6, ease: smooth });
        gsap.to(hudFail, { autoAlpha: beat === 2 ? 1 : 0, y: beat === 2 ? 0 : 16, duration: 0.6, ease: smooth });
      }
      hudStreak.textContent = beat === 3 ? '8' : '7';
    }
    // The clock: 25 minutes across the session, stopped where the buddy quit.
    const done = beat === 3 ? 1 : beat === 2 ? 0.58 : (p / 0.5) * 0.7;
    hudTime.textContent = beat === 3 && story.local > 0.3 ? '00:00' : mmss(25 * 60 * (1 - Math.min(1, done)));
    hudLabel.textContent = ['focusing', 'shield up', 'quit at 10:30', 'complete'][beat];
    hudTime.parentElement.style.color = beat === 2 ? 'var(--peach)' : beat === 3 ? 'var(--coral)' : '';
    // Beat 1: apps fly at the buddy and bounce off the shield.
    // Each one flies in (k 0..0.6), meets the shield, and is knocked back out (0.6..1).
    const far = Math.min(stageEl.clientWidth, 560) * 0.6;
    apps.forEach((a, i) => {
      const k = beat === 1 ? (story.local - story.hits[i] + 0.18) / 0.3 : -1;
      if (k <= 0 || k >= 1) return void (a.style.opacity = 0);
      const ang = (i / apps.length) * Math.PI * 2 + 0.5;
      const incoming = k < 0.6;
      const d = incoming ? far * (1 - (k / 0.6) ** 2 * 0.62) : far * (0.38 + ((k - 0.6) / 0.4) * 0.7);
      a.style.opacity = incoming ? Math.min(1, k * 5) : 1 - (k - 0.6) / 0.4;
      a.style.transform = `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d * 0.55}px) rotate(${incoming ? 0 : (k - 0.6) * 60}deg)`;
    });
  }

  // ---------------------------------------------------------------- buddies lab (DOM half)
  const SAY = {
    ghost: ['Momo, the one you start with.', 'Momo deflates like a sad balloon.'],
    ghost_mint: ['Mint: a calm sprout with a leaf on top.', 'Mint wilts into a heap.'],
  };
  const say = $('#labSay');
  let pick = 'ghost';
  $$('.buddy').forEach((btn) =>
    btn.addEventListener('click', () => {
      $$('.buddy').forEach((b) => {
        b.classList.toggle('is-on', b === btn);
        b.setAttribute('aria-checked', String(b === btn));
      });
      pick = btn.dataset.id;
      say.textContent = SAY[pick][0];
      document.dispatchEvent(new CustomEvent('buddy:select', { detail: { id: pick } }));
    }),
  );
  $$('[data-act]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      say.textContent = act === 'quit' ? `${SAY[pick][1]} Tap it to bring it back.` : 'Session complete. Coins earned!';
      document.dispatchEvent(new CustomEvent('buddy:act', { detail: { act } }));
    }),
  );

  $('[data-view=lab]')?.addEventListener('click', () => {
    if (say.textContent.includes('Tap it')) say.textContent = 'Back on its feet. ' + SAY[pick][0];
  });

  // ---------------------------------------------------------------- streak chain
  const chain = $('#chain');
  for (let i = 0; i < 14; i++) chain.appendChild(document.createElement('i'));
  const links = $$('i', chain);
  const streakN = $('#streakN');
  const setStreak = (n) => {
    links.forEach((l, i) => l.classList.toggle('is-lit', i < n));
    streakN.textContent = n;
  };

  // ---------------------------------------------------------------- the room's shared clock
  const roomTime = $('#roomTime');
  let roomS = 18 * 60 + 24;
  if (!RM) setInterval(() => (roomTime.textContent = mmss((roomS = roomS > 0 ? roomS - 1 : 25 * 60))), 1000);

  // ---------------------------------------------------------------- header
  // The wordmark folds away after a little scroll (CSS transition), leaving the icon.
  const hdr = $('#hdr');
  const onScroll = () => {
    hdr.classList.toggle('is-stuck', scrollY > 8);
    hdr.classList.toggle('is-compact', scrollY > 80);
    storyUpdate();
  };

  if (!gsap || !ST || RM) {
    // Static page: every step and state shown plainly.
    setStreak(12);
    $('#appGrid')?.classList.add('is-locked');
    $$('.tile__lock').forEach((l) => (l.style.opacity = 1));
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return;
  }

  // ================================================================= motion from here on
  document.documentElement.classList.add('anim');
  gsap.registerPlugin(ST);

  const lenis = window.Lenis ? new window.Lenis({ lerp: 0.1, smoothWheel: true }) : null;
  if (lenis) {
    window.__lenis = lenis;
    lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    // In-page links glide instead of jumping.
    $$('a[href^="#"]').forEach((a) =>
      a.addEventListener('click', (e) => {
        const target = $(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: a.getAttribute('href') === '#how' ? 0 : -72, duration: 1.4 });
      }),
    );
  }
  gsap.ticker.add(onScroll);

  // Reveal-on-scroll for anything marked .rise.
  ST.batch('.rise', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => els.forEach((el, i) => setTimeout(() => el.classList.add('is-in'), i * 90)),
  });

  // Hero: the headline rises line by line, then the stage settles.
  gsap.from('.hero__h1 .line > span', { yPercent: 110, duration: 1.1, ease: 'power4.out', stagger: 0.09, delay: 0.1 });
  gsap.from('.hud-chip', { autoAlpha: 0, y: 14, duration: 1, ease: smooth, stagger: 0.12, delay: 0.7 });
  // The HUD breathes with Momo: a few pixels, slowly.
  $$('.hud-chip').forEach((f, i) =>
    gsap.to(f, { y: i % 2 ? 5 : -5, duration: 3 + i * 0.6, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.8 }),
  );
  // The hero's focus clock counts down.
  const heroTime = $('#heroTime');
  let heroS = 25 * 60;
  setInterval(() => (heroTime.textContent = mmss((heroS = heroS > 1 ? heroS - 1 : 25 * 60))), 1000);
  // Hero parts drift apart a little as you scroll away.
  gsap.to('.hero__copy', { yPercent: -10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  // Strict Mode: the shield closes round the grid and every app but Momo locks, one by one.
  const grid = $('#appGrid');
  gsap
    .timeline({ scrollTrigger: { trigger: grid, start: 'top 75%', end: 'center 45%', scrub: 0.6 } })
    .from('.tile', { y: 30, autoAlpha: 0, stagger: 0.05, ease: smooth, duration: 0.5 })
    .to('.apps__shield', { opacity: 1, scale: 1, duration: 0.5, ease: smooth, startAt: { scale: 1.08 } })
    .add(() => grid.classList.toggle('is-locked', true))
    .to('.tile:not(.tile--momo) .tile__lock', { opacity: 1, stagger: 0.06, duration: 0.3, ease: smooth }, '<');
  ST.create({ trigger: grid, start: 'center 45%', onLeaveBack: () => grid.classList.remove('is-locked'), onEnter: () => grid.classList.add('is-locked') });

  // Streak: the chain lights up as you scroll, and the flame grows with it.
  const flame = { n: 1 };
  gsap.to(flame, {
    n: 12,
    ease: 'none',
    scrollTrigger: { trigger: '.streak', start: 'top 70%', end: 'center 40%', scrub: 0.4 },
    onUpdate: () => setStreak(Math.round(flame.n)),
  });
  setStreak(1);
  gsap.fromTo('.flame__svg', { scale: 0.6 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.streak', start: 'top 70%', end: 'center 40%', scrub: 0.4 } });

  // Achievements: cards turn up into place, each catching the light as it lands.
  gsap.from('.badge', {
    rotateX: -50,
    y: 60,
    autoAlpha: 0,
    duration: 1,
    ease: smooth,
    stagger: { each: 0.08, grid: 'auto', from: 'start' },
    scrollTrigger: { trigger: '#badges', start: 'top 80%', once: true },
    onComplete() {
      $$('.badge').forEach((b, i) => setTimeout(() => b.classList.add('is-shine'), i * 80));
    },
  });
  // A gentle tilt toward the pointer.
  if (matchMedia('(hover: hover)').matches) {
    $$('.badge').forEach((b) => {
      const rx = gsap.quickTo(b, 'rotateX', { duration: 0.6, ease: smooth });
      const ry = gsap.quickTo(b, 'rotateY', { duration: 0.6, ease: smooth });
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        rx(((e.clientY - r.top) / r.height - 0.5) * -14);
        ry(((e.clientX - r.left) / r.width - 0.5) * 14);
      });
      b.addEventListener('pointerleave', () => {
        rx(0);
        ry(0);
      });
    });
  }

  // Leaderboard bars fill; the room's buddies arrive.
  gsap.from('.board__bar i', { scaleX: 0, duration: 1.4, ease: 'power2.out', stagger: 0.12, scrollTrigger: { trigger: '#board', start: 'top 80%', once: true } });
  gsap.from('.room__peers figure', { y: 30, autoAlpha: 0, duration: 0.9, ease: smooth, stagger: 0.08, scrollTrigger: { trigger: '.room', start: 'top 80%', once: true } });

  addEventListener('load', () => ST.refresh());
})();
