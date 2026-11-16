// Every live 3D buddy on the page, drawn by ONE WebGL renderer into one fixed canvas (#gl).
// Each [data-view] / [data-buddy] element is a window: per frame the renderer draws that view's
// scene into the element's rectangle (viewport + scissor). Nothing is drawn, and the loop is off,
// while no view is on screen. Without WebGL the slots keep their soft CSS glow.
//
// The buddies are the app's own: the trimmed GLBs in assets/models, dressed and lit by the app's
// three.js code (js/vendor-momo, generated from momo/src/components/character). Driven the way
// momo/scripts/render-clip.mjs drives them: same lights, camera, clip sequencing, `Collapse*`
// flatness, floor shadow, tilt-when-flat and ring.update call.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { addRing, discGeometry } from './vendor-momo/momo-ring.js';
import { addLook } from './vendor-momo/momo-effects.js';
import { addDome } from './vendor-momo/momo-dome.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const DPR_MAX = 1.75;
// CHARACTER_GLOW (momo/src/constants/characters.ts); Momo's is its coral.
const GLOW = {
  ghost: '#FF9585',
  ghost_mint: '#C9DF9E',
  ghost_aqua: '#7FD8DE', // only as a glimpse: the story's quit beat and the teaser
};
const FILE = { ghost_mint: 'mint' }; // Aqua is Momo's model, dressed by code
const IDLE = ['Idle', 'IdleBlink', 'Idle', 'IdleLook', 'IdleBlink'];
const JOY = ['Celebrate', 'IdleBounce', 'Happy', 'IdleBounce'];
const FADE_S = 0.25;
const ENTER_MS = 900; // a buddy drops into place, easing to a stop (the app's DROP_MS)
const ENTER_FROM = 1.4;

const canvas = document.getElementById('gl');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  console.warn('Momo: no WebGL', e);
}

if (renderer) start();

function start() {
  renderer.setClearColor(0x000000, 0);
  renderer.autoClear = false;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const files = {};
  const load = (id) => (files[FILE[id] ?? 'ghost'] ??= loader.loadAsync(`assets/models/${FILE[id] ?? 'ghost'}.glb`));

  // ------------------------------------------------------------------ one buddy, as in the app
  function makeBuddy(gltf, id, { ring: ringOpts, dome } = {}) {
    const rig = new THREE.Group();
    const model = cloneSkinned(gltf.scene);
    // Clones share materials; looks recolour them, so every buddy gets its own set. One copy per
    // original: meshes that share a material (both eyes) must still share it, as addLook expects.
    const copies = new Map();
    const own = (m) => copies.get(m) ?? copies.set(m, m.clone()).get(m);
    model.traverse((o) => {
      if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(own) : own(o.material);
      o.frustumCulled = false; // skinned bounds are the rest pose
    });
    if (id === 'ghost') {
      model.traverse((o) => {
        if (o.material?.name === 'Body') o.material.color.set('#FF9585');
        if (o.material?.name === 'Blush') o.material.color.set('#FF5F6D');
      });
    }
    rig.add(model);
    rig.updateMatrixWorld(true);
    const look = addLook(id, model);
    const ring = addRing(rig, model, GLOW[id], ringOpts);
    const shield = dome ? addDome(rig, ring.floor, GLOW[id], ring.floor.half * 3) : null;

    let cloth;
    model.traverse((o) => {
      const dict = o.morphTargetDictionary;
      const steps = dict ? Object.keys(dict).filter((k) => k.startsWith('Collapse')) : [];
      if (dict && steps.length) cloth = { mesh: o, keys: steps.map((k) => [dict[k], Number(k.slice(8)) / steps.length]) };
    });
    const flatness = () =>
      cloth ? Math.min(1, cloth.keys.reduce((s, [i, share]) => s + cloth.mesh.morphTargetInfluences[i] * share, 0)) : 0;
    const shadowMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, opacity: 0 });
    const shadow = new THREE.Mesh(discGeometry(1, [0.03, 0.015, 0.01, 1]), shadowMat);
    shadow.position.y = 0.008;
    shadow.renderOrder = -0.5;
    shadow.frustumCulled = false;
    model.add(shadow);

    const mixer = new THREE.AnimationMixer(model);
    const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
    const has = (n) => !!clips[n];
    let current = null;
    let name = null;
    let ended = false;
    let mode = 'idle';
    let n = 0;
    const fading = new Set();
    mixer.addEventListener('finished', (e) => {
      if (e.action === current) ended = true;
    });
    function play(clip, fade = FADE_S) {
      if (!has(clip)) clip = 'Idle';
      const next = mixer.clipAction(clips[clip]);
      const prev = current;
      next.reset().setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
      next.play();
      fading.delete(next);
      if (prev && prev !== next) {
        if (fade) {
          prev.crossFadeTo(next, fade, false);
          fading.add(prev);
        } else prev.stop();
      }
      current = next;
      name = clip;
      ended = false;
      mixer.update(0); // pose it now: no frame of rest pose in between
    }
    const down = () => name === 'Failed' || name === 'DeflatedIdle';
    function nextClip() {
      if (mode === 'focus') return has('Focus') ? 'Focus' : 'Idle';
      if (mode === 'sad') return 'DeflatedIdle';
      if (mode === 'joy') return JOY.filter(has)[++n % JOY.filter(has).length];
      if (mode === 'wave' && n++ % 3 === 2) return has('Wave') ? 'Wave' : 'IdleBounce';
      return IDLE.filter(has)[n++ % IDLE.filter(has).length];
    }

    let enterAt = -1;
    let scrubbing = false;
    let tapAt = 0;
    const b = {
      id,
      rig,
      model,
      ring,
      progress: 0,
      shieldOn: false,
      hitAt: 0,
      get clip() {
        return name;
      },
      get flat() {
        return flatness();
      },
      /** idle | focus | joy | sad | wave: what to keep playing. */
      setMode(m, { fade = FADE_S } = {}) {
        scrubbing = false;
        if (m === mode && current) return;
        const wasDown = down();
        mode = m;
        n = 0;
        if (m === 'sad') return down() ? null : play('Failed', 0.15);
        if (wasDown) return play('Reinflate', 0.1); // from flat on the floor this is the only way up
        play(m === 'joy' ? 'Celebrate' : nextClip(), fade);
      },
      /** One clip, then back to the mode's loop. */
      once(clip) {
        scrubbing = false;
        if (down()) return;
        play(clip, 0.15);
      },
      /** Hold clip `clip` at `t` (0..1) — scroll-driven. */
      scrub(clip, t) {
        if (name !== clip || !scrubbing) {
          play(clip, 0);
          scrubbing = true;
        }
        current.paused = false;
        current.time = THREE.MathUtils.clamp(t, 0, 1) * clips[clip].duration;
        mixer.update(0);
      },
      tap(now) {
        tapAt = now;
      },
      enter(now) {
        enterAt = now;
      },
      update(dt, now) {
        if (!scrubbing) {
          mixer.update(dt);
          if (ended || !current) {
            if (name === 'Reinflate') mode = mode === 'sad' ? 'idle' : mode;
            play(down() && mode === 'sad' ? 'DeflatedIdle' : nextClip(), name === 'Focus' || !name ? FADE_S : 0);
          }
        }
        for (const f of fading) {
          if (f.getEffectiveWeight() === 0) {
            f.stop();
            fading.delete(f);
          }
        }
        const flat = flatness();
        look?.(now, flat);
        shadow.visible = flat > 0.01;
        shadowMat.opacity = 0.6 * flat;
        const s = 0.5 + 0.3 * flat;
        shadow.scale.set(s, 1, s * 0.9);
        model.rotation.x = ring.floor.tilt * flat;
        // The entrance: drop in from above, the light and orbits coming up as it lands.
        const landed = enterAt < 0 ? 1 : Math.min(1, (now - enterAt) / ENTER_MS);
        model.position.y = ENTER_FROM * (1 - landed) ** 3;
        ring.update(now, tapAt, b.progress, 1, landed, landed * (1 - flat));
        shield?.update(now, b.shieldOn, b.hitAt);
      },
    };
    play('Idle', 0);
    return b;
  }

  // ------------------------------------------------------------------ views
  const views = [];
  function makeView(el, { span = 2.08, minWidth = 2.2, lookY = 0.62 } = {}) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffe9dc, 2.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(-1.5, 3, 4);
    scene.add(key);
    const camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
    const v = { el, scene, camera, span, minWidth, lookY, visible: false, ready: false, tick: null, buddies: [] };
    v.fit = (w, h) => {
      camera.aspect = w / h;
      const vertical = Math.max(v.span, v.minWidth / camera.aspect);
      camera.position.set(0, v.lookY, vertical / 2 / Math.tan((camera.fov * Math.PI) / 360));
      camera.lookAt(0, v.lookY, 0);
      camera.updateProjectionMatrix();
    };
    views.push(v);
    io.observe(el);
    return v;
  }
  const live = (v) => {
    v.ready = true;
    v.el.classList.add('is-live');
    kick();
  };

  // ------------------------------------------------------------------ the loop
  let last = performance.now();
  let running = false;
  let dirty = true;
  const FROZEN = 2600; // reduced motion: one moment, held
  const ticker = window.gsap?.ticker;

  // The glows are additive and write no alpha (momo-ring's BLEND), which leaves colour brighter
  // than its alpha in our see-through canvas. Chrome composites that as added light; Firefox does
  // not (it shows a grey disc where the floor shadow's alpha meets the glow). So after drawing,
  // raise every pixel's alpha to at least its brightest channel: valid premultiplied colour that
  // looks the same as a glow over a dark page, in every browser.
  let grab = null;
  const fix = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { map: { value: null } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader:
        'uniform sampler2D map; varying vec2 vUv; void main() { vec4 c = texture2D(map, vUv); gl_FragColor = vec4(0.0, 0.0, 0.0, max(c.r, max(c.g, c.b))); }',
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor, // colour stays as drawn
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.MaxEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    }),
  );
  fix.frustumCulled = false;
  const fixScene = new THREE.Scene().add(fix);
  const fixCam = new THREE.OrthographicCamera();
  function fixAlpha(W, H) {
    const w = canvas.width;
    const h = canvas.height;
    if (!grab || grab.image.width !== w || grab.image.height !== h) {
      grab?.dispose();
      grab = new THREE.FramebufferTexture(w, h);
      fix.material.uniforms.map.value = grab;
    }
    renderer.setScissorTest(false);
    renderer.copyFramebufferToTexture(grab);
    renderer.setViewport(0, 0, W, H);
    renderer.render(fixScene, fixCam);
  }

  function frame() {
    const t = performance.now();
    const dt = Math.min(0.1, (t - last) / 1000);
    last = t;
    const now = RM ? FROZEN : t;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, DPR_MAX);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(W, H, false);
    }
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    let drawn = false;
    for (const v of views) {
      if (!v.ready || !v.visible) continue;
      const r = v.el.getBoundingClientRect();
      const y0 = Math.max(r.top, 0);
      const y1 = Math.min(r.bottom, H);
      if (y1 <= y0 || r.width < 2) continue;
      v.tick?.(RM ? 0 : dt, now);
      for (const b of v.buddies) if (b.rig.visible) b.update(RM ? 0 : dt, now);
      v.fit(r.width, r.height);
      renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
      renderer.setScissor(r.left, H - y1, r.width, y1 - y0);
      renderer.render(v.scene, v.camera);
      drawn = true;
    }
    if (drawn) fixAlpha(W, H);
    dirty = false;
    if (RM) stop();
  }
  function kick() {
    dirty = true;
    if (running) return;
    running = true;
    last = performance.now();
    if (ticker) ticker.add(frame);
    else (function loop() {
      if (!running) return;
      frame();
      requestAnimationFrame(loop);
    })();
  }
  function stop() {
    running = false;
    ticker?.remove(frame);
  }
  // Only run while some view is on screen.
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = views.find((x) => x.el === e.target);
        if (v) v.visible = e.isIntersecting;
      }
      if (views.some((v) => v.visible && v.ready)) kick();
      else {
        stop();
        frame(); // clear what was last drawn
      }
    },
    { rootMargin: '80px 0px' },
  );
  if (RM) {
    addEventListener('scroll', kick, { passive: true });
    addEventListener('resize', kick);
  }
  // Build a view only once it comes near: spreads the shader compiles out over the scroll.
  const near = (el, build) => {
    const o = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          o.disconnect();
          build();
        }
      },
      { rootMargin: '900px 0px' },
    );
    o.observe(el);
  };
  const enter = (b) => !RM && b.enter(performance.now());
  // A waitlist signup in `form`'s section: that section's Momo jumps for joy, then goes back to its
  // loop. With reduced motion it just holds the jump's peak for a moment.
  const onJoined = (section, b) =>
    document.addEventListener('waitlist:joined', (e) => {
      if (!section.contains(e.target)) return;
      b.tap(performance.now());
      if (RM) {
        b.scrub('Celebrate', 0.45);
        setTimeout(() => (b.scrub('Idle', 0), kick()), 2500);
      } else b.once('Celebrate');
      kick();
    });

  // ------------------------------------------------------------------ hero: Momo on its ring
  const heroEl = document.querySelector('[data-view=hero]');
  if (heroEl) {
    const v = makeView(heroEl, { span: 2.2, minWidth: 2.4, lookY: 0.6 });
    load('ghost').then(async (gltf) => {
      const momo = makeBuddy(gltf, 'ghost');
      v.scene.add(momo.rig);
      v.buddies.push(momo);
      await renderer.compileAsync(v.scene, v.camera);
      enter(momo);
      live(v);
      // Follow the pointer a little.
      let tx = 0;
      let ty = 0;
      addEventListener('pointermove', (e) => {
        tx = (e.clientX / innerWidth - 0.5) * 0.7;
        ty = (e.clientY / innerHeight - 0.5) * 0.12;
      });
      v.tick = (dt) => {
        const k = 1 - Math.exp(-dt * 3);
        momo.rig.rotation.y += (tx - momo.rig.rotation.y) * k;
        momo.rig.rotation.x += (ty - momo.rig.rotation.x) * k;
      };
      const cheer = () => {
        momo.tap(performance.now());
        momo.once(Math.random() < 0.5 ? 'Celebrate' : 'IdleBounce');
        kick();
      };
      heroEl.addEventListener('click', cheer);
      onJoined(heroEl.closest('section'), momo);
    }, fail);
  }

  // ------------------------------------------------------------------ how it works: the story
  const storyEl = document.querySelector('[data-view=story]');
  if (storyEl) {
    near(storyEl, async () => {
      const v = makeView(storyEl, { span: 2.35, minWidth: 2.5, lookY: 0.66 });
      const gltf = await load('ghost').catch(fail);
      if (!gltf) return;
      const ringOpts = { progress: true, radius: 1.12, orbitTilt: 0.8 };
      const momo = makeBuddy(gltf, 'ghost', { ring: ringOpts, dome: true });
      const aqua = makeBuddy(gltf, 'ghost_aqua', { ring: ringOpts });
      v.scene.add(momo.rig, aqua.rig);
      v.buddies.push(momo, aqua);
      aqua.rig.visible = false;
      momo.setMode('focus', { fade: 0 });
      // The coins are real rigid bodies (cannon-es), loaded only once the story is near.
      let coins = null;
      import('./vendor-momo/momo-coins.js').then(({ addCoins }) => {
        coins = addCoins(momo.rig, momo.model, momo.ring.floor);
      }, (e) => console.warn('Momo: coins unavailable', e));
      await renderer.compileAsync(v.scene, v.camera);
      live(v);

      let beat = -1;
      let hit = -1;
      let lit = 0;
      const glow = ['rgb(255 95 109 / 0.3)', 'rgb(255 149 133 / 0.26)', 'rgb(255 95 109 / 0.18)', 'rgb(255 149 133 / 0.34)'];
      v.tick = (dt, now) => {
        const s = window.momoStory ?? { beat: 0, local: 0, hits: [] };
        if (s.beat !== beat) {
          const from = beat;
          beat = s.beat;
          storyEl.style.setProperty('--story-glow', glow[beat]);
          momo.rig.visible = beat !== 2;
          aqua.rig.visible = beat === 2;
          if (beat === 2) enter(aqua);
          if (from === 2 && beat !== 2) enter(momo);
          momo.setMode(beat === 3 ? 'joy' : 'focus', { fade: from === -1 ? 0 : FADE_S });
          if (beat === 3) momo.tap(now);
        }
        // The ring fills across the session; the quit beat freezes it where Aqua gave up.
        const target = beat === 0 ? 0.04 + 0.4 * s.local : beat === 1 ? 0.44 + 0.26 * s.local : beat === 2 ? 0.58 : Math.min(1, 0.7 + s.local * 0.9);
        lit += (target - lit) * (1 - Math.exp(-dt * 6)) || target - lit;
        momo.progress = lit;
        aqua.progress = 0.58;
        // Strict Mode: the shield stands through beat 2, and flares as each app bounces off it.
        momo.shieldOn = beat === 1;
        const h = beat === 1 ? s.hits.filter((x) => s.local >= x).length : -1;
        if (h > hit && h > 0) momo.hitAt = now;
        hit = h;
        // Quit: the collapse is the scroll.
        if (beat === 2) aqua.scrub('Failed', (s.local - 0.12) / 0.7);
        coins?.update(dt, beat === 3 && s.local > 0.08 ? 5 : 0, now);
      };
    });
  }

  // ------------------------------------------------------------------ buddies: try one
  const labEl = document.querySelector('[data-view=lab]');
  if (labEl) {
    near(labEl, () => {
      const v = makeView(labEl, { span: 2.15, minWidth: 2.5, lookY: 0.6 });
      const made = {};
      let shown = null;
      let want = 'ghost';
      let pendingAct = null;
      async function show(id) {
        want = id;
        if (!made[id]) {
          labEl.classList.remove('is-live');
          made[id] = load(id).then(async (gltf) => {
            const b = makeBuddy(gltf, id);
            b.rig.visible = false;
            v.scene.add(b.rig);
            v.buddies.push(b);
            await renderer.compileAsync(v.scene, v.camera);
            return b;
          });
        }
        const b = await made[id].catch(fail);
        if (!b || want !== id) return;
        if (shown && shown !== b) shown.rig.visible = false;
        if (shown !== b) {
          b.rig.visible = true;
          b.setMode('idle', { fade: 0 });
          enter(b);
        }
        shown = b;
        live(v);
        if (pendingAct) act(pendingAct);
        pendingAct = null;
      }
      function act(what) {
        if (!shown || shown.id !== want) return void (pendingAct = what);
        shown.tap(performance.now());
        if (RM) {
          // No motion: show where each reaction ends up, as a still.
          if (what === 'finish') shown.scrub('Celebrate', 0.45);
          else if (what === 'quit') shown.scrub('Failed', 1);
          else shown.scrub('Idle', 0);
          return kick();
        }
        if (what === 'finish') shown.setMode('joy');
        else if (what === 'quit') shown.setMode('sad');
        else if (what === 'tap') {
          if (shown.clip === 'Failed') return;
          if (shown.clip === 'DeflatedIdle') shown.setMode('idle');
          else shown.once('IdleBounce');
        }
        kick();
      }
      document.addEventListener('buddy:select', (e) => show(e.detail.id));
      document.addEventListener('buddy:act', (e) => act(e.detail.act));
      labEl.addEventListener('click', () => act('tap'));
      show(document.querySelector('.buddy.is-on')?.dataset.id ?? 'ghost');
    });
  }

  // ------------------------------------------------------------------ small live buddies
  // Roster, leaderboard and study room: each slot its own little idle scene, on its own ring.
  // data-mood="sad": the one who left the room lies deflated.
  for (const el of document.querySelectorAll('[data-buddy]')) {
    near(el, async () => {
      const id = el.dataset.buddy;
      const v = makeView(el, { span: 2.05, minWidth: 2.05, lookY: 0.55 });
      const gltf = await load(id).catch(fail);
      if (!gltf) return;
      const b = makeBuddy(gltf, id);
      v.scene.add(b.rig);
      v.buddies.push(b);
      if (el.dataset.mood === 'sad') RM ? b.scrub('Failed', 1) : b.setMode('sad', { fade: 0 });
      // The teaser: a dark silhouette; its ring's glow is what shows through the glass.
      if (el.dataset.mood === 'tease') {
        b.model.traverse((o) => {
          for (const m of o.isMesh ? [o.material].flat() : []) {
            m.color?.set('#0f0b0a');
            m.emissive?.set('#000000');
          }
        });
      }
      await renderer.compileAsync(v.scene, v.camera);
      live(v);
    });
  }

  // ------------------------------------------------------------------ join: Momo waves you in
  const joinEl = document.querySelector('[data-view=join]');
  if (joinEl) {
    near(joinEl, async () => {
      const v = makeView(joinEl, { span: 2.2, minWidth: 2.4, lookY: 0.6 });
      const gltf = await load('ghost').catch(fail);
      if (!gltf) return;
      const momo = makeBuddy(gltf, 'ghost');
      v.scene.add(momo.rig);
      v.buddies.push(momo);
      momo.setMode('wave', { fade: 0 });
      await renderer.compileAsync(v.scene, v.camera);
      live(v);
      joinEl.addEventListener('click', () => {
        momo.tap(performance.now());
        momo.once('Celebrate');
      });
      onJoined(joinEl.closest('section'), momo);
    });
  }
}

function fail(e) {
  console.warn('Momo: could not load a buddy', e);
}
