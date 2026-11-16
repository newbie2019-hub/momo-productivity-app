// GENERATED COPY of momo/src/components/character/momo-effects.ts — do not edit here.
// Types stripped with node:module stripTypeScriptTypes; relative imports given a .js extension.
// Regenerate from the app instead (see README "3D buddies").
import * as THREE from 'three'

import { BLEND, discGeometry } from './momo-ring.js'

/**
 * Looks that belong to one character and live in the app, not in its model. Ember, Aqua and Dusk
 * are all Momo's model (`ghost.glb`): what makes each one itself is here. `addLook` is the way in.
 */

// ponytail: the ring's radius is measured from the body by momo-ring (its half-width); all these characters are Momo's model, so it is a number here. Take it from addRing if a look ever goes on another body.
const RING_R = 0.57 // the glowing ring under the character: what a collapsed character leaves on the floor fills it
const BODY_TOP = 1.15 // the resting body's height

const m_ = (o                ) => (o              ).material

/**
 * Moves a burn on to how collapsed the character is (`flat`): it stands as it is while the fire goes
 * from under its hem to over its head (the edge is ragged, so it starts and ends well clear).
 * Gives back how much of the face to show: it rides cloth that is no longer falling, so it goes first.
 */
function burnAway(burn                                                      , flat        ) {
  burn.hold.value = THREE.MathUtils.smoothstep(flat, 0, 0.08)
  burn.line.value = -0.35 + (BODY_TOP + 0.65) * THREE.MathUtils.smoothstep(flat, BURN_FROM, BURN_TO)
  return 1 - THREE.MathUtils.smoothstep(flat, BURN_FROM, BURN_FROM + 0.2)
}

/** Moves a look on to `nowMs`. `flat` is how far the character has collapsed (0 standing, 1 a pile). */
                                                        

/**
 * Dresses a freshly loaded (or cloned) model as character `id`, and returns what keeps it moving;
 * null for a character with no look of its own. Call it once per model, before the first frame.
 */
export function addLook(id        , model                )              {
  const mats                                             = {}
  let head                            
  let torso                            
  let skin                            
  const bones                   = []
  model.traverse((o) => {
    if ((o              ).isBone) bones.push(o)
    if ((o                     ).isSkinnedMesh && (m_(o)                              )?.name === 'Body') skin = o
    const m = (o              ).material                                          
    if (m?.name) mats[m.name] = m
    if ((o              ).isBone && o.name === 'head') head = o
    if ((o              ).isBone && o.name === 'body') torso = o
  })
  const { Body: body, Blush: blush, FaceDark: face } = mats
  if (!body) return null
  // The face goes when a body turns to water or shadow: `show` is 1 for all of it, 0 for none.
  const faceMats = [blush, face, mats.Highlight].filter((m) => !!m).map((m) => ({ m, full: 1 }))
  const showFace = (show        ) => {
    for (const f of faceMats) Object.assign(f.m, { transparent: show < 1 || f.full < 1, opacity: f.full * show })
  }
  if (id === 'ghost_ember') {
    body.color.set('#F4733F')
    blush?.color.set('#F6644B')
    // Failed, Ember does not deflate: it stands as it is while its own fire burns it away from the hem up.
    const burn = { line: { value: -1 }, hold: { value: 0 }, edge: ['#FF6B14', '#FFE68C']                     }
    const lamp = { time: { value: 0 }, lit: { value: 1 } } // the fire inside lights the cloth round it
    seeThrough(body, EMBER_CLEAR, 0.97, undefined, undefined, burn, lamp)
    const lantern = addLantern(model, head, torso)
    return (nowMs, flat) => {
      showFace(burnAway(burn, flat))
      lamp.time.value = (nowMs / 1000) % 1000
      lamp.lit.value = 1 - THREE.MathUtils.smoothstep(flat, 0.35, 0.6) // out with the fire itself
      lantern(nowMs, flat)
    }
  }
  if (id === 'ghost_aqua') {
    body.color.set('#7FD8DE')
    blush?.color.set('#FF9DB5')
    body.roughness = 0.18
    const melt = { value: 0 }
    const time = { value: 0 }
    const scatter = { value: 0 }
    seeThrough(body, WATER_CLEAR, WATER_EDGE, undefined, { amount: melt, time, radius: RING_R, depth: WATER_DEPTH, ripples: 0.3, scatter })
    const drips = addDrips(model, '#BDF3F5', head)
    return (nowMs, flat) => {
      time.value = (nowMs / 1000) % 1000
      melt.value = THREE.MathUtils.smoothstep(flat, MELT_FROM, MELT_TO)
      scatter.value = THREE.MathUtils.smoothstep(flat, SCATTER_FROM, 1)
      showFace(1 - THREE.MathUtils.smoothstep(flat, MELT_FROM, (MELT_FROM + MELT_TO) / 2))
      drips(nowMs, flat)
    }
  }
  if (id === 'ghost_frost') {
    body.color.set(FROST_BODY)
    body.roughness = 0.6 // frosted, not wet
    blush?.color.set('#8FBFEF')
    const frost = makeFrost(model, body, bones, head)
    return (nowMs, flat) => {
      const whole = frost(nowMs, flat)
      if (skin) skin.visible = whole
      showFace(whole ? 1 : 0)
    }
  }
  if (id === 'ghost_shadow') {
    blush?.color.set(DUSK_BLUSH_COLOR)
    for (const f of faceMats) f.full = f.m === blush ? DUSK_BLUSH : f.m === face ? DUSK_EYES : 1 // the highlights stay as they are
    showFace(1)
    const dusk = makeDusk(model, body, head, face)
    return (nowMs, flat) => showFace(dusk(nowMs, flat))
  }
  return null
}

// ---------------------------------------------------------------------------- Ember: a paper lantern
// Ember is hollow and see-through, with a small fire burning inside it: a round heart with flames
// climbing off it. Sparks rise round it, its halo burns, and when it collapses the fire spreads
// over the floor round the pile.
const FIRE_HOT = '#FFC25A' // the heart of the fire
const FIRE_WARM = '#FF7A2E' // its edges
const EMBER_CLEAR = 0.6 // how solid the body is where you look straight through it
const BURN_FROM = 0.12 // how far into the collapse a burning character (Ember, Dusk) catches fire
const BURN_TO = 0.8 // and where the last of it has burned away
const FIRE_Y = 0.36 // the inner fire's height in the resting body (the body is 1.15 tall, the face is above this)
const LAMP_REACH = 0.62 // how far over the cloth the fire's light reaches (the body is 1.15 tall)
const LAMP_GAIN = 0.75 // how bright that light is
const FIRE_R = 0.11 // the radius of its round heart

const HALO_Y = 1.3 // a halo's height in the resting model (the body's top is 1.15)
const HALO_R = 0.2
const HALO_TILT = -0.3 // tipped toward the viewer, so it reads as a ring and not a line

/** A ring over the head, riding `head` (the head bone) so it follows every movement. Shrinks away as the character collapses. */
function addHalo(model                , head                            , tube        , mat                , y = HALO_Y) {
  const halo = new THREE.Mesh(new THREE.TorusGeometry(HALO_R, tube, 12, 48), mat)
  halo.rotation.x = Math.PI / 2 + HALO_TILT
  halo.position.y = y
  halo.frustumCulled = false
  model.add(halo)
  model.updateMatrixWorld(true)
  head?.attach(halo)
  const full = halo.scale.clone()
  return { halo, fold: (flat        ) => halo.scale.copy(full).multiplyScalar(Math.max(0.001, 1 - flat * 3)) }
}

/**
 * A wall of fire standing on a circle of radius `r`, `h` high, burning as one sheet all the way
 * round. `cells` is how many licks of flame fit round it. It stands along +Y, or along -Z for a halo
 * (whose ring lies in its XY plane with -Z up). `uSpread` scales the circle, `uGrow` the height.
 */
function addFireWall(
  parent                ,
  r        ,
  h        ,
  cells        ,
  time                   ,
  /** `hot` is its heart's colour and `warm` its tips'. `dark`: painted over what is behind it, not added to it as light, so its heart can be black. `core` is how hot it must be to show its heart's colour (low = nearly all heart), `low` the least height it burns at. */
  { halo = false, hot = FIRE_HOT, warm = FIRE_WARM, dark = false, core = -1, low = -1 }                                                                                               = {},
) {
  if (core < 0) core = dark ? 0.12 : 0.55 // dark fire is nearly all heart: only its tips are lit
  if (low < 0) low = dark ? 0.02 : 0.15
  const g = new THREE.CylinderGeometry(r, r, h, 64, 1, true)
  g.translate(0, h / 2, 0)
  if (halo) g.rotateX(-Math.PI / 2)
  const uniforms = { uTime: time, uSpread: { value: 1 }, uGrow: { value: 1 }, uLit: { value: 1 }, uHot: { value: new THREE.Color(hot) }, uWarm: { value: new THREE.Color(warm) } }
  const mesh = new THREE.Mesh(
    g,
    new THREE.ShaderMaterial({
      ...(dark ? { transparent: true, depthWrite: false } : BLEND),
      side: THREE.DoubleSide,
      uniforms,
      vertexShader: `varying vec2 vUv; uniform float uSpread; uniform float uGrow;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * vec3(uSpread, uGrow, uSpread), 1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uLit; uniform vec3 uHot; uniform vec3 uWarm;
        ${FIRE_GLSL}
        void main() { gl_FragColor = fireColor(fire(vUv.x * ${cells.toFixed(1)}, vUv.y, ${cells.toFixed(1)}, uTime, ${low.toFixed(2)}), uHot, uWarm, uLit, ${core.toFixed(2)}); }`, // dark fire is nearly all heart: only its tips are lit
    }),
  )
  mesh.frustumCulled = false
  mesh.renderOrder = 4 // as the cards are
  parent.add(mesh)
  return { mesh, uniforms }
}

/** One camera-facing card: where its foot is, how big it is, and how far it drifts up over its life (0 = it stays put, less = it falls). */
                                                                                 

const CARD_VERTEX = `
  attribute vec2 aCorner; attribute vec2 aSize; attribute float aSeed; attribute float aRise;
  uniform float uTime; uniform float uSpread; uniform float uGrow;
  varying vec2 vUv; varying float vSeed; varying float vLife;
  void main() {
    vSeed = aSeed;
    vLife = fract(uTime * (0.22 + 0.2 * aSeed) + aSeed * 7.0);
    vec3 c = position;
    c.xz *= uSpread;
    c.y += vLife * aRise;
    c.x += sin(vLife * 6.0 + aSeed * 40.0) * 0.05 * step(0.001, abs(aRise));
    vec4 mv = modelViewMatrix * vec4(c, 1.0);
    mv.xy += vec2(aCorner.x * aSize.x, aCorner.y * aSize.y * uGrow) * length(modelViewMatrix[0].xyz);
    vUv = vec2(aCorner.x * 2.0, aCorner.y);
    gl_Position = projectionMatrix * mv;
  }`
/**
 * Fire as one burning sheet, not separate flames: `fire(across, up, wrap, t, low)` is how hot it is at a
 * point (`across` in noise cells, repeating every `wrap` of them so it joins up round a ring; `up` 0 at
 * its foot, 1 at its top; `low` is the least height it burns at, as a share of the tallest). The pattern only ever climbs, so it flickers without sliding sideways.
 */
const FIRE_GLSL = `
  float fireHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fireNoise(vec2 p, float wrap) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, wrap), x1 = mod(i.x + 1.0, wrap);
    return mix(mix(fireHash(vec2(x0, i.y)), fireHash(vec2(x1, i.y)), f.x), mix(fireHash(vec2(x0, i.y + 1.0)), fireHash(vec2(x1, i.y + 1.0)), f.x), f.y);
  }
  float fire(float across, float up, float wrap, float t, float low) {
    float reach = low + (1.0 - low) * pow(fireNoise(vec2(across, t * 1.3), wrap), 1.6);      // how high it burns here, just now: from low to a tall tongue
    float lick = fireNoise(vec2(across * 2.0, up * 4.0 - t * 4.5), wrap * 2.0) - 0.5;  // the flicker climbing through it
    return 1.0 - up / reach + lick * 0.5;
  }
  vec4 fireColor(float heat, vec3 hot, vec3 warm, float lit, float core) {
    return vec4(mix(warm, hot, smoothstep(core, core + 0.45, heat)), clamp(heat * 2.0, 0.0, 1.0) * lit); // thin at its tips, never a hard edge
  }`
/** One small fire on a card: the burning sheet, narrowed to a point at its top. */
const FLAME_FRAGMENT = `
  varying vec2 vUv; uniform float uTime; uniform float uLit; uniform vec3 uHot; uniform vec3 uWarm;
  ${FIRE_GLSL}
  void main() {
    float x = vUv.x + sin(vUv.y * 5.0 - uTime * 3.0) * 0.12 * vUv.y;
    x /= mix(0.4, 1.0, smoothstep(0.0, 0.3, vUv.y)); // narrow at its foot, widest a third of the way up
    float heat = abs(x) < 1.0 ? fire(x * 0.9 + 7.0, vUv.y / (1.0 - x * x), 1000.0, uTime * 0.7, 0.6) : 0.0;
    gl_FragColor = fireColor(heat, uHot, uWarm, uLit, 0.55);
  }`
/** The fire's round heart: white-hot in the middle, and a wide soft light round it. The card is four times the heart across. */
const HEART_FRAGMENT = `
  varying vec2 vUv; varying float vSeed; uniform float uTime; uniform float uLit; uniform vec3 uHot; uniform vec3 uWarm;
  void main() {
    float r = length(vec2(vUv.x, vUv.y * 2.0 - 1.0)) * 4.0 / (0.95 + 0.05 * sin(uTime * 9.0));
    float core = 1.0 - smoothstep(0.55, 1.0, r);
    float around = (1.0 - smoothstep(0.6, 4.0, r)) * 0.4;
    gl_FragColor = vec4(mix(uWarm, mix(uHot, vec3(1.0, 0.95, 0.8), core * core), core), (core + around) * uLit * (0.9 + 0.1 * sin(uTime * 11.3) * sin(uTime * 6.7)));
  }`
/** A soft cloud of light filling the card, nothing at its edges. */
const MIST_FRAGMENT = `
  varying vec2 vUv; uniform float uLit; uniform vec3 uHot;
  void main() { gl_FragColor = vec4(uHot, pow(1.0 - min(1.0, length(vec2(vUv.x, vUv.y * 2.0 - 1.0))), 1.6) * uLit); }`
/** A snowflake: six arms, each with a pair of barbs, turning slowly as it falls. */
const FLAKE_FRAGMENT = `
  varying vec2 vUv; varying float vSeed; varying float vLife; uniform float uTime; uniform float uLit; uniform vec3 uHot;
  void main() {
    vec2 p = vec2(vUv.x, vUv.y * 2.0 - 1.0);
    float r = length(p);
    float a = mod(atan(p.y, p.x) + uTime * (0.4 + vSeed) + vSeed * 6.0 + 0.5236, 1.0472) - 0.5236; // folded onto one arm
    vec2 q = vec2(r * cos(a), abs(r * sin(a)));
    float arm = (1.0 - smoothstep(0.05, 0.11, q.y)) * step(q.x, 0.92);
    vec2 b = q - vec2(0.48, 0.0);
    float along = b.x * 0.5 + b.y * 0.866;
    float barb = (1.0 - smoothstep(0.04, 0.1, abs(b.x * 0.866 - b.y * 0.5))) * step(0.0, along) * step(along, 0.3);
    gl_FragColor = vec4(uHot, max(max(arm, barb), 1.0 - smoothstep(0.1, 0.2, r)) * sin(vLife * 3.14159) * uLit);
  }`
/** A glint: a sharp four-point star that flashes once in each life. */
const GLINT_FRAGMENT = `
  varying vec2 vUv; varying float vLife; uniform float uLit; uniform vec3 uHot;
  void main() {
    vec2 p = abs(vec2(vUv.x, vUv.y * 2.0 - 1.0));
    float star = max(0.0, 1.0 - sqrt(p.x) - sqrt(p.y)) * 2.5 + max(0.0, 1.0 - length(p) * 3.0);
    gl_FragColor = vec4(uHot, min(1.0, star) * pow(sin(vLife * 3.14159), 10.0) * uLit);
  }`
/** A spark: a soft dot that fades in and out over its life. */
const SPARK_FRAGMENT = `
  varying vec2 vUv; varying float vLife; uniform float uLit; uniform vec3 uHot;
  void main() {
    float r = length(vec2(vUv.x, vUv.y * 2.0 - 1.0));
    gl_FragColor = vec4(uHot, (1.0 - smoothstep(0.2, 1.0, r)) * sin(vLife * 3.14159) * uLit);
  }`

/** Cards drawn as light, all in one mesh. `uSpread` scales where they stand (x, z), `uGrow` how tall they are. */
function addCards(parent                , cards        , fragmentShader        , time                   , through = false) {
  const g = new THREE.BufferGeometry()
  const corners = [-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1]
  const pos           = [], corner           = [], size           = [], seed           = [], rise           = [], index           = []
  cards.forEach((c, i) => {
    for (let k = 0; k < 4; k++) {
      pos.push(...c.at)
      corner.push(corners[k * 2], corners[k * 2 + 1])
      size.push(c.w, c.h)
      seed.push(rand(i + 1))
      rise.push(c.rise ?? 0)
    }
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3)
  })
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('aCorner', new THREE.Float32BufferAttribute(corner, 2))
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 2))
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1))
  g.setAttribute('aRise', new THREE.Float32BufferAttribute(rise, 1))
  g.setIndex(index)
  const uniforms = { uTime: time, uSpread: { value: 1 }, uGrow: { value: 1 }, uLit: { value: 1 }, uHot: { value: new THREE.Color(FIRE_HOT) }, uWarm: { value: new THREE.Color(FIRE_WARM) } }
  // `through`: seen through whatever is in front of it (the fire inside Ember, through its cloth).
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ ...BLEND, depthTest: !through, uniforms, vertexShader: CARD_VERTEX, fragmentShader }))
  mesh.frustumCulled = false
  mesh.renderOrder = 4 // after a see-through body, or the body is drawn over whatever stands in front of it
  parent.add(mesh)
  return { mesh, uniforms }
}

const HALO_FLAME_H = 0.22 // how high its fire reaches (the halo is 0.4 across)
const HALO_GLOW = 0.1 // how far the halo's glow reaches from the ring

/** Ember's halo: a white-hot ring in a soft glow, burning all the way round. */
function addBurningHalo(model                , head                            , time                   ) {
  const { halo, fold } = addHalo(model, head, 0.012, new THREE.MeshBasicMaterial({ color: '#FFE9B8' }))
  // The glow: a fat ring of light round the thin one, brightest along its middle and gone at its edges.
  const glow = new THREE.Mesh(
    new THREE.TorusGeometry(HALO_R, HALO_GLOW, 12, 48),
    new THREE.ShaderMaterial({
      ...BLEND,
      uniforms: { uTime: time, uWarm: { value: new THREE.Color(FIRE_WARM) } },
      vertexShader: 'varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vN; uniform float uTime; uniform vec3 uWarm;
        void main() { gl_FragColor = vec4(uWarm, pow(clamp(normalize(vN).z, 0.0, 1.0), 2.5) * (0.7 + 0.08 * sin(uTime * 7.0))); }`,
    }),
  )
  glow.frustumCulled = false
  halo.add(glow)
  addFireWall(halo, HALO_R, HALO_FLAME_H, 14, time, { halo: true })
  return fold
}

const SPARKS = 14 // rising round Ember
const FLOOR_FIRE_H = 0.42 // how high the fire round the collapsed Ember reaches
const FLOOR_FIRE_R = RING_R // the fire spreads out to the ring

/** Ember's fire: inside it (riding `torso`, the body bone), on its halo (riding `head`), in the air round it and, collapsed, on the floor. */
function addLantern(model                , head                 , torso                 )       {
  const time = { value: 0 }
  const fold = addBurningHalo(model, head, time)
  // The fire inside: one flame standing on a round heart, and the heart drawn over its foot.
  const inside = new THREE.Group()
  inside.position.y = FIRE_Y
  model.add(inside)
  model.updateMatrixWorld(true)
  torso?.attach(inside)
  const tongues = addCards(inside, [{ at: [0, -FIRE_R * 0.5, 0], w: FIRE_R * 3.4, h: FIRE_R * 3.6 }], FLAME_FRAGMENT, time, true)
  const heart = addCards(inside, [{ at: [0, -FIRE_R * 4, 0], w: FIRE_R * 8, h: FIRE_R * 8 }], HEART_FRAGMENT, time, true)
  heart.mesh.renderOrder = 5
  const sparks = addCards(
    model,
    Array.from({ length: SPARKS }, (_, i) => {
      const a = rand(i + 60) * Math.PI * 2, r = 0.44 + 0.2 * rand(i + 80), s = 0.022 + 0.022 * rand(i + 100)
      return { at: [Math.cos(a) * r, 0.1 + 0.5 * rand(i + 120), Math.sin(a) * r * 0.6], w: s, h: s, rise: 0.55 + 0.4 * rand(i + 140) }
    }),
    SPARK_FRAGMENT,
    time,
  )
  const floor = addFireWall(model, FLOOR_FIRE_R, FLOOR_FIRE_H, 30, time)
  floor.uniforms.uLit.value = 0.75 // its near and far sides are both seen
  floor.mesh.position.y = FLOOR_Y
  const emberGlow = new THREE.Color(FIRE_WARM).multiplyScalar(0.55)
  const floorGlowMat = new THREE.MeshBasicMaterial({ vertexColors: true, ...BLEND, opacity: 0 })
  const floorGlow = new THREE.Mesh(discGeometry(FLOOR_FIRE_R * 1.5, [emberGlow.r, emberGlow.g, emberGlow.b, 1]), floorGlowMat)
  floorGlow.position.y = FLOOR_Y
  floorGlow.frustumCulled = false
  model.add(floorGlow)
  return (nowMs, flat) => {
    time.value = (nowMs / 1000) % 1000
    const burning = 1 - THREE.MathUtils.smoothstep(flat, 0.35, 0.6) // the fire inside is gone once the cloth round it has burned
    const flare = THREE.MathUtils.smoothstep(flat, 0.05, 0.3) // but first it flares up and catches the cloth
    tongues.uniforms.uLit.value = (1.5 + flare) * burning
    tongues.uniforms.uGrow.value = 1 + 1.2 * flare
    heart.uniforms.uLit.value = burning
    fold(flat)
    // The fire takes the floor as it takes the body: it starts under Ember and spreads out to the ring, and goes on burning there.
    const spread = THREE.MathUtils.smoothstep(flat, BURN_FROM, 0.6)
    floor.mesh.visible = floorGlow.visible = spread > 0.001
    floor.uniforms.uSpread.value = 0.45 + 0.55 * spread
    floor.uniforms.uGrow.value = spread
    floorGlowMat.opacity = 0.8 * spread
    sparks.uniforms.uSpread.value = 1 + 0.25 * spread // and the sparks rise from it
  }
}

// ---------------------------------------------------------------------------- Aqua: made of water
// Aqua is see-through, clearer in the middle than at its edges (as a drop of water is), and now
// and then a drop gathers under its hem, falls, and leaves a small ripple on the floor.
const WATER_CLEAR = 0.34 // how solid the body is where you look straight through it
const WATER_EDGE = 0.95 // and at its edges
const BODY_RIPPLE = 0.32 // how bright the light on the waves running down its body is
const DRIP_EVERY_S = 3.2 // one drop per this long, starting somewhere inside it
const DRIP_GROW_S = 0.7 // gathering under the hem
const DRIP_FALL_S = 0.32 // falling
const DRIP_RIPPLE_S = 0.6 // the ripple it leaves
const DRIP_R = 0.032 // the drop's radius (the body is about 0.9 across)
const HEM_Y = 0.13 // where the hem's low points are in the resting model
const FLOOR_Y = 0.012
const MELT_FROM = 0.25 // how far into the collapse Aqua starts to lose its shape
const MELT_TO = 0.7 // and where nothing of its shape is left
const WATER_DEPTH = 0.045 // how high the pool Aqua becomes stands in its middle
const SPLASH_AT = 0.45 // how far Aqua has collapsed when it hits the floor and splashes
const SPLASH_S = 0.75 // how long the splash lasts
const FLOOR_BEADS = 14 // beads of water left lying outside the ring
const SCATTER_FROM = 0.78 // how far into the collapse the pool's edge starts to run out of its circle
const SPLASH_DROPS = 44
const PUDDLE_R = RING_R * 1.5 // the wet floor round the pool Aqua becomes
/** Where under the hem drops gather: x, z in the model. */
const DRIP_SPOTS                     = [[-0.26, 0.3], [0.3, 0.24], [0.02, 0.4], [-0.36, 0.1], [0.4, 0.02]]

/**
 * A see-through body: `clear` solid where you look straight through it, `edge` solid at its edges.
 * With `rim`, the edges also give off light of that colour (it does not need lighting to show).
 */
/** A colour as GLSL. */
const glsl = (hex        ) => {
  const c = new THREE.Color(hex)
  return `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`
}

function seeThrough(
  body                            ,
  clear        ,
  edge        ,
  rim                                      ,
  /** Losing its shape: at `amount` 1 nothing of the body is left but a round pool on the floor, `radius` across and `depth` high in the middle, its edge run out into uneven tongues by `scatter` (0 = a clean circle), with `ripples` bright rings of light running over it (0 = none; `time` is in seconds). */
  melt                                                                                                                                      ,
  /** Burning away: everything below `line` (a height in the resting body, with a ragged edge that glows `edge`) is gone. `hold` 1 keeps the body in its resting shape whatever the collapse does to it. */
  burn                                                                                             ,
  /** Lit from inside by Ember's fire: the cloth glows round where the fire is, flickering with it (`time` in seconds, `lit` 0 = out). */
  lamp                                                      ,
  /** Frost: glints that twinkle over the body (`time` in seconds), and freezing solid: `line` is how far its rime has grown, 0 = as it lives, 1 = white all over. `hold` as for a burn. */
  frost                                                                                ,
) {
  body.transparent = clear < 1 || edge < 1
  const glow = rim ? new THREE.Color(rim.color).multiplyScalar(rim.strength) : null
  // three shares one compiled shader between materials whose onBeforeCompile reads the same, so say what differs.
  body.customProgramCacheKey = () => `seeThrough ${clear} ${edge} ${rim?.color} ${rim?.strength} ${melt?.radius} ${melt?.depth} ${burn?.edge} ${!!lamp} ${!!frost}`
  body.onBeforeCompile = (shader) => {
    if (burn || lamp || frost || melt) {
      // where this bit of cloth is in the resting body: a burn and a lamp stay put in the cloth however it moves
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;')
    }
    if (lamp) {
      shader.uniforms.uLampTime = lamp.time
      shader.uniforms.uLampLit = lamp.lit
    }
    if (frost) {
      shader.uniforms.uFrostTime = frost.time
      shader.uniforms.uFrostLine = frost.line
    }
    const still = burn ?? frost
    if (still) shader.uniforms.uBurnHold = still.hold
    if (still)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uBurnHold;')
        .replace('#include <morphtarget_vertex>', '#include <morphtarget_vertex>\ntransformed = mix(transformed, position, uBurnHold);')
    if (burn) {
      shader.uniforms.uBurnLine = burn.line
    }
    if (melt) {
      shader.uniforms.uMelt = melt.amount
      shader.uniforms.uMeltTime = melt.time
      shader.uniforms.uScatter = melt.scatter ?? { value: 0 }
      // The crown goes to the pool's middle and the hem to its rim, each part in the direction it already
      // faces, so the body opens out into a disc. In place of the collapse's own shapes, before the bones.
      const pool = `
        vec2 poolDir = normalize(position.xz + vec2(0.00001));
        float poolR = pow(1.0 - clamp((position.y - ${HEM_Y.toFixed(2)}) / ${(BODY_TOP - HEM_Y).toFixed(2)}, 0.0, 1.0), 0.7);`
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uMelt;\nuniform float uMeltTime;\nuniform float uScatter;\nvarying float vPool;')
        .replace(
          '#include <morphnormal_vertex>',
          `#include <morphnormal_vertex>${pool}
          vPool = poolR;
          objectNormal = normalize(mix(objectNormal, vec3(poolDir.x * poolR * 0.3, 1.0, poolDir.y * poolR * 0.3), uMelt));`,
        )
        .replace(
          '#include <morphtarget_vertex>',
          // the small lift keeps the arms, which land on the same spot as the body behind them, on top
          `#include <morphtarget_vertex>
// Water, not jelly: waves run down its surface all the time, two sets crossing.
          transformed += objectNormal * (0.011 * sin(position.y * 20.0 + position.x * 5.0 + uMeltTime * 2.6) + 0.007 * sin(position.y * 31.0 - position.z * 9.0 + uMeltTime * 3.7));
          float poolA = atan(poolDir.y, poolDir.x);
          float poolOut = poolR * ${melt.radius.toFixed(3)} * (1.0 + uScatter * poolR * poolR * (0.14 + 0.20 * sin(poolA * 3.0 + 1.0) + 0.14 * sin(poolA * 5.0 + 2.3) + 0.10 * sin(poolA * 9.0 + 0.7) + 0.07 * sin(poolA * 14.0 + 4.0)));
          transformed = mix(transformed, vec3(poolDir.x * poolOut, ${melt.depth.toFixed(3)} * (1.0 - poolR * poolR) + 0.006 * length(position.xz), poolDir.y * poolOut), uMelt);`,
        )
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${melt ? '\nuniform float uMelt;\nuniform float uMeltTime;\nvarying float vPool;' : ''}${burn || lamp || frost || melt ? '\nvarying vec3 vRest;' : ''}${frost ? '\nuniform float uFrostTime;\nuniform float uFrostLine;' : ''}${lamp ? '\nuniform float uLampTime;\nuniform float uLampLit;' : ''}${burn ? '\nuniform float uBurnLine;' : ''}${burn || frost ? `\n${FIRE_GLSL}` : ''}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float edgeOn = 1.0 - clamp(abs(normal.z), 0.0, 1.0);
        ${
          burn
            ? // What is left above the line is charred near it, and the very edge is white-hot.
              `float burnLeft = vRest.y + (fireNoise(vRest.xz * 7.0 + vRest.y * 4.0, 1000.0) - 0.5) * 0.3 - uBurnLine;
              if (burnLeft < 0.0) discard;
              diffuseColor.rgb *= 0.25 + 0.75 * smoothstep(0.03, 0.22, burnLeft);
              totalEmissiveRadiance += mix(${glsl(burn.edge[0])}, ${glsl(burn.edge[1])}, 1.0 - smoothstep(0.0, 0.035, burnLeft)) * (1.0 - smoothstep(0.0, 0.09, burnLeft)) * 2.2;`
            : ''
        }
        ${
          melt
            ? // A pool's edge is its rim, and rings of light run out across it from the middle.
              `float wave = 0.6 * sin(vRest.y * 20.0 + vRest.x * 5.0 + uMeltTime * 2.6) + 0.4 * sin(vRest.y * 31.0 - vRest.z * 9.0 + uMeltTime * 3.7);
              totalEmissiveRadiance += vec3(0.75, 1.0, 1.0) * ${BODY_RIPPLE.toFixed(2)} * smoothstep(0.35, 0.95, wave) * (1.0 - uMelt); // light caught on each wave's crest
              diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(-0.3, -0.9, wave) * (1.0 - uMelt); // and its trough a little darker
              edgeOn = mix(edgeOn, pow(vPool, 5.0), uMelt);
              totalEmissiveRadiance += vec3(${melt.ripples.toFixed(2)}) * uMelt * (1.0 - vPool) * smoothstep(0.75, 1.0, sin(vPool * 30.0 - uMeltTime * 2.2));`
            : ''
        }
        ${
          frost
            ? // Glints: here and there a point of the surface flashes, each to its own beat. Then the freeze, with a bright front where it is still spreading.
              `vec3 glintAt = vRest * 24.0;
              vec3 glintCell = floor(glintAt);
              float glintId = fireHash(glintCell.xy + glintCell.z * 17.0);
              float glint = step(0.84, glintId) * pow(max(0.0, sin(uFrostTime * (1.2 + glintId * 2.6) + glintId * 60.0)), 14.0) * (1.0 - smoothstep(0.05, 0.32, length(fract(glintAt) - 0.5)));
              // Frosted, not clear: a fine sugar grain all over, white rime grown up from the hem and down from the crown in feathers, and a deep blue light in its middle.
              diffuseColor.rgb *= 0.93 + 0.14 * fireHash(floor(vRest.xy * 90.0) + floor(vRest.z * 90.0) * 13.0);
              float rimeAcross = (atan(vRest.z, vRest.x) / 6.2832 + 0.5) * 44.0;
              float feather = 0.55 * fireNoise(vec2(rimeAcross, vRest.y * 7.0), 44.0) + 0.45 * fireNoise(vec2(rimeAcross * 3.0, vRest.y * 26.0), 132.0);
              float frozen = uFrostLine; // 0 = as it lives, 1 = rimed over from hem to crown
              float rime = max(1.0 - smoothstep(0.1, 0.4, vRest.y - (feather - 0.5) * 0.45 - frozen * 1.3), smoothstep(0.95, 1.16, vRest.y + (feather - 0.5) * 0.35 + frozen * 0.9));
              float rimeFront = rime * (1.0 - rime) * 4.0 * step(0.001, frozen); // bright where it is growing just now
              rime *= mix(0.45 + 0.55 * smoothstep(0.3, 0.6, feather), 1.0, frozen);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.985, 1.0), rime * 0.9);
              totalEmissiveRadiance += vec3(0.04, 0.22, 0.6) * pow(1.0 - edgeOn, 3.0) * 0.8 * (1.0 - rime);
              totalEmissiveRadiance += vec3(0.85, 0.95, 1.0) * (glint * (1.6 + 1.4 * frozen) + rimeFront * 0.5);`
            : ''
        }
        ${
          lamp
            ? // Brightest on the cloth right in front of the fire, falling away up and down the body and round its sides.
              `float lampT = uLampTime;
              float lampNear = 1.0 - smoothstep(0.08, ${LAMP_REACH.toFixed(2)}, length(vec2(vRest.x, (vRest.y - ${FIRE_Y.toFixed(2)}) * 0.8)));
              float lampFlicker = 0.86 + 0.09 * sin(lampT * 11.3) * sin(lampT * 6.7) + 0.05 * sin(lampT * 23.0);
              totalEmissiveRadiance += mix(${glsl(FIRE_WARM)}, ${glsl(FIRE_HOT)}, lampNear * lampNear) * lampNear * (0.35 + 0.65 * clamp(normal.z, 0.0, 1.0)) * lampFlicker * uLampLit * ${LAMP_GAIN.toFixed(2)};`
            : ''
        }
        ${glow ? `totalEmissiveRadiance += vec3(${glow.r.toFixed(3)}, ${glow.g.toFixed(3)}, ${glow.b.toFixed(3)}) * pow(edgeOn, 2.2);` : ''}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `diffuseColor.a *= mix(${clear.toFixed(2)}, ${edge.toFixed(2)}, 1.0 - pow(1.0 - edgeOn, 1.5));
        ${frost ? 'diffuseColor.a = mix(diffuseColor.a, 1.0, max(frozen, rime));' : ''}
        #include <opaque_fragment>`,
      )
  }
  body.needsUpdate = true
}

// ---------------------------------------------------------------------------- Dusk: a shadow with a lit edge
// Dusk is black and see-through, its outline picked out in light, with a dark halo over its head
// (it has no other topper).
const DUSK_BODY = '#0E0C16'
const DUSK_GLOW = '#A98BFF'
const DUSK_CLEAR = 0.55
const DUSK_FLAME_H = 0.7 // how high the dark fire round it burns as it goes
const DUSK_HALO_SOLID = 0.15 // how solid the fire on its halo is
const DUSK_BLUSH_COLOR = '#6A45C4' // a deep violet, close to its edge glow in shadow: it sits in the dark body and not on it
const DUSK_BLUSH = 0.4 // how solid its cheeks are: a faint glow, not a patch
const DUSK_EYES = 0.65 // how solid its eyes and mouth are: see-through, as the body is

/** `head` is what the halo rides (the head bone). `face` is the eyes' and mouth's material. What it returns moves Dusk on, and gives back how much of the face to show. */
function makeDusk(model                , body                            , head                 , face                             ) {
  body.color.set(DUSK_BODY)
  face?.color.set('#000000') // black eyes and mouth, with the same highlights as every other character's (no glow of their own)
  // Failed, Dusk does not crumple: it stands as it is while dark fire (black at its heart, lit at its
  // tips) comes up round it and burns it away from the hem up. Then the fire dies too, and nothing is left.
  const burn = { line: { value: -1 }, hold: { value: 0 }, edge: ['#6B3FE0', '#E2D8FF']                     }
  seeThrough(body, DUSK_CLEAR, 0.97, { color: DUSK_GLOW, strength: 1.5 }, undefined, burn)
  // The halo is made of what the body is: the same dark, as see-through, with the same lit edge.
  const mat = new THREE.MeshStandardMaterial({ color: DUSK_BODY, roughness: body.roughness })
  seeThrough(mat, DUSK_CLEAR, 0.97, { color: DUSK_GLOW, strength: 1.5 })
  const { halo, fold } = addHalo(model, head, 0.013, mat)
  const time = { value: 0 }
  addFireWall(halo, HALO_R, HALO_FLAME_H, 14, time, { halo: true, hot: '#05030A', warm: DUSK_GLOW, dark: true, core: 0.45, low: 0.2 }).uniforms.uLit.value = DUSK_HALO_SOLID // its halo burns as Ember's does, with dark fire: more of it lit, or so small a fire is lost on a dark screen
  const flames = addFireWall(model, RING_R * 0.92, DUSK_FLAME_H, 26, time, { hot: '#05030A', warm: DUSK_GLOW, dark: true })
  flames.mesh.position.y = FLOOR_Y
  const glow = new THREE.Color(DUSK_GLOW).multiplyScalar(0.8)
  const floorMat = new THREE.MeshBasicMaterial({ vertexColors: true, ...BLEND, opacity: 0 })
  const floorGlow = new THREE.Mesh(discGeometry(RING_R * 1.35, [glow.r, glow.g, glow.b, 1]), floorMat)
  floorGlow.position.y = FLOOR_Y
  floorGlow.frustumCulled = false
  model.add(floorGlow)
  return (nowMs        , flat        ) => {
    fold(flat)
    const face = burnAway(burn, flat)
    // The fire comes up as Dusk catches, and dies once the last of it has burned. Filling back up is this in reverse.
    time.value = (nowMs / 1000) % 1000
    const risen = THREE.MathUtils.smoothstep(flat, BURN_FROM, 0.5)
    const left = 1 - THREE.MathUtils.smoothstep(flat, BURN_TO, 0.98)
    flames.mesh.visible = floorGlow.visible = risen > 0.001 && left > 0.001
    flames.uniforms.uSpread.value = 0.5 + 0.5 * risen
    flames.uniforms.uGrow.value = risen * (0.35 + 0.65 * left)
    flames.uniforms.uLit.value = left
    floorMat.opacity = risen * left
    return face
  }
}

// ---------------------------------------------------------------------------- Frost: made of ice
// Frost is clear, cold ice: see-through with a bright edge, glints running over it, a crown of ice
// crystals over its head and a little snow falling round it. Failed, it does not deflate: it stops
// where it is, freezes solid from the hem up, and shatters; the pieces lie on the ring until a tap
// pulls them back together.
const FROST_BODY = '#7DBDEC'
const FROST_LIGHT = '#EAF8FF' // its edge, its glints, its snow
const FROST_FREEZE_FROM = 0.04 // how far into its end the rime starts to grow
const FROST_RIMED = 0.62 // where the rime has covered all of it
const FROST_SHATTER = 0.68 // and where, frozen through, it breaks
const FROST_FALL = 0.4 // its end runs no faster than this per second (the whole of it is 1), so the rime is seen growing, however fast the clip collapses
const FROST_RISE = 0.8 // and it is put together again no faster than this
const FROST_SHARDS = 44
const BREATH_EVERY_S = 5 // one puff of cold breath per this long
const BREATH_S = 1.5 // and how long it hangs in the air
const MOUTH                           = [0, 0.6, 0.47] // just in front of its mouth, in the resting model
const CROWN_Y = 1.27 // the crown floats just clear of the head (the body's top is 1.15)
const CROWN_R = 0.17
/** The crown's crystals, round the ring from the front: [height, thickness]. Tall ones with small ones between, the tallest in front. */
const CROWN                     = [[0.21, 0.056], [0.09, 0.034], [0.15, 0.046], [0.08, 0.032], [0.17, 0.05], [0.085, 0.034], [0.14, 0.044], [0.085, 0.034], [0.17, 0.05], [0.08, 0.032], [0.15, 0.046], [0.09, 0.034]]

/** One six-sided crystal, 1 high and 1 across at its widest, pointing along +Y from a short point below: cut facets, not a smooth cone. */
function crystalGeometry() {
  const g = new THREE.LatheGeometry([new THREE.Vector2(0, -0.22), new THREE.Vector2(0.5, 0), new THREE.Vector2(0.42, 0.55), new THREE.Vector2(0, 1)], 6)
  return g.toNonIndexed().rotateY(0.3) // its own vertices per face, so each facet is lit as one flat plane
}

/** Ice that things are cut from (the crown, the shards): facets that catch the light, a little see-through, lit from within. */
/** Ice with rime on it, for the crown: white frost on its band and up each crystal from its foot (a crystal points along -Z, 1 long), feathered, the tips left clear. `grow` 1 = rimed to the tips. */
function rimedIce(grow                   ) {
  const m = iceMaterial()
  m.customProgramCacheKey = () => 'rimedIce'
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uRimeGrow = grow
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAt;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvAt = position;')
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vAt;\nuniform float uRimeGrow;\n${FIRE_GLSL}`).replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float crownFeather = 0.6 * fireNoise(vec2(atan(vAt.y, vAt.x) * 2.5 + 20.0, vAt.z * 7.0 + 20.0), 1000.0) + 0.4 * fireHash(floor(vAt.xy * 14.0) + floor(vAt.z * 30.0) * 7.0);
      float crownRime = 1.0 - smoothstep(0.02, 0.4, -vAt.z - (crownFeather - 0.5) * 0.5 - uRimeGrow * 1.3);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), crownRime);
      diffuseColor.a = mix(diffuseColor.a, 1.0, crownRime);
      totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(0.3, 0.34, 0.38), crownRime);`,
    )
  }
  return m
}

function iceMaterial() {
  return new THREE.MeshStandardMaterial({ color: '#D6F0FF', roughness: 0.12, metalness: 0.15, flatShading: true, transparent: true, opacity: 0.9, emissive: '#5FB4EA', emissiveIntensity: 0.4 })
}

/**
 * `bones` are the whole skeleton (held still while Frost is frozen) and `head` what the crown rides.
 * What it returns moves Frost on, and says whether it is still in one piece.
 */
/** An empty thing at `at` in the resting model that rides `bone` from then on, staying upright as the model is. */
function rider(model                , bone                            , at                          ) {
  const o = new THREE.Object3D()
  o.position.set(...at)
  model.add(o)
  model.updateMatrixWorld(true)
  bone?.attach(o)
  return o
}

function makeFrost(model                , body                            , bones                  , head                 ) {
  const time = { value: 0 }
  const freeze = { time, line: { value: 0 }, hold: { value: 0 } }
  seeThrough(body, 0.8, 1, { color: FROST_LIGHT, strength: 0.5 }, undefined, undefined, undefined, freeze)
  const ice = iceMaterial()
  const crownIce = rimedIce(freeze.line)

  // The crown: a thin band of ice with crystals standing on it, leaning out a little.
  const { halo: crown } = addHalo(model, head, 0.016, crownIce, CROWN_Y)
  crown.scale.multiplyScalar(CROWN_R / HALO_R)
  const crystal = crystalGeometry()
  const points = new THREE.InstancedMesh(crystal.clone().rotateX(-Math.PI / 2), crownIce, CROWN.length) // the band lies in XY with -Z up
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), at = new THREE.Vector3(), size = new THREE.Vector3()
  CROWN.forEach(([h, w], i) => {
    const a = Math.PI / 2 + (i / CROWN.length) * Math.PI * 2 // the first stands at the front
    q.setFromEuler(new THREE.Euler(0, -0.3, a, 'ZYX')) // turned to face out from the middle, then leaned that way
    points.setMatrixAt(i, m4.compose(at.set(Math.cos(a) * HALO_R, Math.sin(a) * HALO_R, 0), q, size.set(w, w, h).multiplyScalar(HALO_R / CROWN_R)))
  })
  points.frustumCulled = false
  crown.add(points)

  // On the crown: cold vapour pouring off it and sinking past the head, and a star of light on one tall crystal's tip at a time.
  const over = rider(model, head, [0, CROWN_Y, 0])
  const vapour = addCards(
    over,
    Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + rand(i + 900), k = 0.13 + 0.07 * rand(i + 910)
      return { at: [Math.cos(a) * CROWN_R * 1.1, -0.04, Math.sin(a) * CROWN_R * 0.9], w: k, h: k, rise: -(0.22 + 0.16 * rand(i + 920)) }
    }),
    SPARK_FRAGMENT,
    time,
  )
  vapour.uniforms.uHot.value.set(FROST_LIGHT)
  vapour.uniforms.uLit.value = 0.4
  crown.updateMatrixWorld(true)
  const GLINT = 0.13
  const glints = addCards(
    over,
    CROWN.flatMap(([h], i) => {
      if (h < 0.12) return []
      points.getMatrixAt(i, m4)
      const tip = over.worldToLocal(at.set(0, 0, -1).applyMatrix4(m4).applyMatrix4(crown.matrixWorld)) // the crystal's point
      return [{ at: [tip.x, tip.y - GLINT / 2, tip.z]                            , w: GLINT, h: GLINT }]
    }),
    GLINT_FRAGMENT,
    time,
    true,
  )
  glints.uniforms.uHot.value.set('#FFFFFF')

  // Its breath: a puff of cold in front of its mouth every few seconds.
  const mouth = rider(model, head, MOUTH)
  const breath = addCards(mouth, [{ at: [0, -0.07, 0], w: 0.2, h: 0.14 }], MIST_FRAGMENT, time)
  breath.uniforms.uHot.value.set(FROST_LIGHT)
  // It breathes out through a round mouth: the model's own "o" mouth, in place of its smile, for as long as the puff is leaving it.
  const smile = model.getObjectByName('mouth_smile'), round = model.getObjectByName('mouth_o')
  let breathing = false
  let smiled = 1 // the smile's size when the breath began, to put back after

  // Snow: fine flakes drifting down round it.
  const snow = addCards(
    model,
    Array.from({ length: 12 }, (_, i) => {
      const a = rand(i + 500) * Math.PI * 2, r = 0.4 + 0.28 * rand(i + 520), k = 0.05 + 0.04 * rand(i + 540)
      return { at: [Math.cos(a) * r, 0.9 + 0.5 * rand(i + 560), Math.sin(a) * r * 0.6], w: k, h: k, rise: -(0.7 + 0.5 * rand(i + 580)) }
    }),
    FLAKE_FRAGMENT,
    time,
  )
  snow.uniforms.uHot.value.set(FROST_LIGHT)
  // The cold it gives off: a pale light on the floor under it.
  const cold = new THREE.Color(FROST_BODY).multiplyScalar(0.35)
  const floorMat = new THREE.MeshBasicMaterial({ vertexColors: true, ...BLEND, opacity: 0.7 })
  const floor = new THREE.Mesh(discGeometry(RING_R * 1.25, [cold.r, cold.g, cold.b, 1]), floorMat)
  floor.position.y = FLOOR_Y
  floor.frustumCulled = false
  model.add(floor)

  // The pieces it breaks into: each starts on the body's surface and ends lying on the floor, on the ring and a little past it.
  const shards = new THREE.InstancedMesh(crystal, ice, FROST_SHARDS)
  shards.frustumCulled = false
  shards.visible = false
  model.add(shards)
  const piece = Array.from({ length: FROST_SHARDS }, (_, i) => {
    const a = rand(i + 600) * Math.PI * 2, y = HEM_Y + (BODY_TOP + 0.12 - HEM_Y) * rand(i + 620) // some from the crown
    const wide = 0.43 * Math.sqrt(Math.max(0.05, 1 - ((y - 0.5) / 0.68) ** 2)) // the body's outline at that height
    const out = RING_R * (0.15 + 1.25 * rand(i + 640) ** 0.7), b = a + (rand(i + 660) - 0.5) * 1.4
    const k = 0.045 + 0.085 * rand(i + 680)
    return {
      from: new THREE.Vector3(Math.cos(a) * wide, y, Math.sin(a) * wide),
      to: new THREE.Vector3(Math.cos(b) * out, FLOOR_Y + k * 0.25, Math.sin(b) * out),
      arc: 0.15 + 0.5 * rand(i + 700),
      turn: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(i + 720) * 6, rand(i + 740) * 6, rand(i + 760) * 6)),
      lie: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + (rand(i + 780) - 0.5) * 0.5, rand(i + 800) * 6, 0, 'YXZ')), // on its side
      size: new THREE.Vector3(k * (0.5 + 0.5 * rand(i + 820)), k * (1.2 + 1.6 * rand(i + 840)), k * (0.3 + 0.4 * rand(i + 860))),
    }
  })
  // The breath of cold as it breaks.
  const mist = addCards(model, [{ at: [0, 0.05, 0], w: 1.9, h: 1.5 }], MIST_FRAGMENT, time, true)
  mist.uniforms.uHot.value.set(FROST_LIGHT)

  // Frozen, nothing of it moves: the pose it had when the cold took it is put back every frame.
  let pose                                                                       = null

  let end = 0 // how far through its end it is: follows the collapse, but at its own pace
  let last = 0
  return (nowMs        , collapse        ) => {
    time.value = (nowMs / 1000) % 1000
    const dt = last ? Math.max(0, nowMs - last) / 1000 : 0
    last = nowMs
    end += THREE.MathUtils.clamp(collapse - end, -FROST_RISE * dt, FROST_FALL * dt)
    const flat = Math.max(end, Math.min(collapse, 0.04)) // frozen from the first moment, and until the last
    if (flat <= 0.03) pose = null
    else {
      pose ??= bones.map((b) => ({ p: b.position.clone(), q: b.quaternion.clone(), s: b.scale.clone() }))
      bones.forEach((b, i) => (b.position.copy(pose [i].p), b.quaternion.copy(pose [i].q), b.scale.copy(pose [i].s)))
    }
    freeze.hold.value = THREE.MathUtils.smoothstep(flat, 0, 0.05)
    freeze.line.value = THREE.MathUtils.smoothstep(end, FROST_FREEZE_FROM, FROST_RIMED)
    const whole = end < FROST_SHATTER
    // How far the pieces have got: out fast, then settling (and back the same way when it is put together again).
    const gone = 1 - (1 - THREE.MathUtils.clamp((end - FROST_SHATTER) / 0.28, 0, 1)) ** 2.2
    crown.visible = whole
    snow.mesh.visible = whole
    vapour.mesh.visible = glints.mesh.visible = whole
    // The breath leaves its mouth, drifts out and up a little and thins away; none once the cold has taken it.
    const puff = ((nowMs / 1000) % BREATH_EVERY_S) / BREATH_S
    // Only from a smile: a clip that has given it another mouth (a frown, a laugh) keeps it, and that breath is skipped.
    if (puff < 1 && whole && flat <= 0.03 && smile && round && (breathing || (puff < 0.1 && smile.scale.x > 0.5))) {
      if (smile.scale.x > 0.5) smiled = smile.scale.x // fresh from the clip this frame
      breathing = true
      const open = Math.sin(Math.min(1, puff / 0.65) * Math.PI) ** 0.5
      smile.scale.setScalar(Math.max(0.001, smiled * (1 - open)))
      round.scale.setScalar(Math.max(0.001, open))
    } else if (breathing) {
      breathing = false
      smile .scale.setScalar(smiled)
      round .scale.setScalar(0.001)
    }
    breath.mesh.visible = breathing
    breath.mesh.position.set(0.16 * puff, -0.02 * puff, 0.05 * puff)
    breath.mesh.scale.setScalar(0.5 + 0.9 * puff)
    breath.uniforms.uLit.value = 0.85 * Math.sin(puff ** 0.6 * Math.PI)
    shards.visible = !whole
    if (!whole) {
      piece.forEach((s, i) => {
        at.lerpVectors(s.from, s.to, gone)
        at.y += Math.sin(gone * Math.PI) * s.arc
        shards.setMatrixAt(i, m4.compose(at, q.slerpQuaternions(s.turn, s.lie, gone), s.size))
      })
      shards.instanceMatrix.needsUpdate = true
    }
    mist.mesh.visible = !whole && gone < 1
    mist.uniforms.uLit.value = 0.55 * Math.sin(Math.min(1, gone * 1.15) * Math.PI)
    mist.uniforms.uGrow.value = 0.6 + 0.6 * gone
    floorMat.opacity = 0.7 + 0.3 * THREE.MathUtils.smoothstep(flat, FROST_FREEZE_FROM, FROST_SHATTER)
    return whole
  }
}

/** A stable 0..1 for whole number `n`: the drips keep no state, they are worked out from the clock. */
const rand = (n        ) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** A drop of water of radius `r`: round below, drawn up to a point above. */
function dropGeometry(r        ) {
  const g = new THREE.SphereGeometry(r, 14, 12)
  const p = g.getAttribute('position')
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (y <= 0) continue
    const narrow = Math.max(0, 1 - y / r) ** 0.75 // the top vertex can come out a hair over r, and a negative base is NaN
    p.setXYZ(i, p.getX(i) * narrow, y * 2.3, p.getZ(i) * narrow)
  }
  g.computeVertexNormals()
  return g
}

/** What drops and beads of water are made of: clear in the middle, bright where the light bends at their edges. */
function waterMaterial(color             , shine = 0.5) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.05 })
  seeThrough(mat, 0.22, 0.9, { color: '#FFFFFF', strength: shine })
  return mat
}

/**
 * A burst of `n` small beads (`bead` is the biggest) thrown out from the middle of the floor when the character lands on it, falling
 * back at `gravity` (low = they hang in the air). Returns what moves it on: give it the time in
 * seconds and how collapsed the character is, and it gives back how far through the burst it is
 * (0..1), or -1 when there is none.
 */
function addSplash(model                , bead                      , mat                , n        , gravity        , lasts = SPLASH_S) {
  const blobs = new THREE.InstancedMesh(bead, mat, n)
  blobs.frustumCulled = false
  blobs.renderOrder = 4 // as the cards are
  blobs.visible = false
  model.add(blobs)
  const m4 = new THREE.Matrix4()
  let landedAt = -1 // -1 = standing, ready for the next fall
  return (t        , flat        ) => {
    if (flat < 0.05) landedAt = -1
    else if (landedAt < 0 && flat > SPLASH_AT) landedAt = t
    const since = landedAt < 0 ? -1 : t - landedAt
    blobs.visible = since >= 0 && since < lasts
    if (!blobs.visible) return -1
    for (let i = 0; i < n; i++) {
      const a = ((i + rand(i + 300)) / n) * Math.PI * 2
      const out = RING_R * (0.35 + 0.65 * rand(i + 380)) + (0.3 + 0.8 * rand(i + 320)) * Math.min(since, 0.9) // metres from the middle: they leave from all over the ring
      const up = (1.6 + 1.5 * rand(i + 340)) * since - gravity * since * since
      const k = up < 0 ? 0 : (0.5 + 0.8 * rand(i + 360)) * (1 - since / lasts) ** 0.5
      // long and thin on the way up, as thrown water is, and round at the top of its arc
      const speed = Math.abs(1.6 + 1.5 * rand(i + 340) - 2 * gravity * since)
      m4.makeScale(k, k * (1 + Math.min(2, speed * 0.8)), k).setPosition(Math.cos(a) * out, FLOOR_Y + Math.max(up, 0), Math.sin(a) * out)
      blobs.setMatrixAt(i, m4)
    }
    blobs.instanceMatrix.needsUpdate = true
    return since / lasts
  }
}

/**
 * Drops under `model`'s hem. `rider` is whatever carries the body up and down (so a drop hangs
 * from the hem as Aqua bobs); its height at rest is taken when this is called.
 */
function addDrips(model                , color        , rider                 )       {
  const tone = new THREE.Color(color)
  const dropMat = waterMaterial(tone)
  const drop = new THREE.Mesh(dropGeometry(DRIP_R), dropMat)
  const rippleMat = new THREE.MeshBasicMaterial({ vertexColors: true, ...BLEND, opacity: 0 })
  const ripple = new THREE.Mesh(discGeometry(1, [tone.r * 0.6, tone.g * 0.6, tone.b * 0.6, 1]), rippleMat)
  ripple.position.y = FLOOR_Y
  drop.frustumCulled = ripple.frustumCulled = false
  drop.visible = ripple.visible = false
  model.add(drop, ripple)
  const at = new THREE.Vector3()
  const restY = rider ? model.worldToLocal(rider.getWorldPosition(at)).y : 0
  let hungY = HEM_Y // where the hem was when the drop let go

  // When Aqua hits the floor: drops thrown out and up, one wide ripple, and a wet floor round the pool it becomes.
  const splash = addSplash(model, dropGeometry(0.02), dropMat, SPLASH_DROPS, 4.5)
  // Water does not keep to a circle: beads of it lie where the splash threw them, out past the ring.
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 8), waterMaterial(new THREE.Color('#7FD8DE'), 0.12), FLOOR_BEADS)
  beads.frustumCulled = false
  beads.renderOrder = 4
  model.add(beads)
  const m4 = new THREE.Matrix4()
  const puddleMat = new THREE.MeshBasicMaterial({ vertexColors: true, ...BLEND, opacity: 0 })
  const puddle = new THREE.Mesh(discGeometry(PUDDLE_R, [tone.r * 0.5, tone.g * 0.5, tone.b * 0.5, 1]), puddleMat)
  puddle.position.y = FLOOR_Y
  puddle.frustumCulled = false
  model.add(puddle)

  return (nowMs, flat) => {
    const t = nowMs / 1000
    const since = splash(t, flat)
    const lying = THREE.MathUtils.smoothstep(flat, SCATTER_FROM, 1)
    beads.visible = lying > 0.001
    if (beads.visible) {
      for (let i = 0; i < FLOOR_BEADS; i++) {
        const a = rand(i + 400) * Math.PI * 2, out = RING_R * (1.12 + 0.55 * rand(i + 420)), k = (0.02 + 0.05 * rand(i + 440)) * lying
        m4.makeScale(k * (1 + 0.6 * rand(i + 460)), k * 0.3, k).setPosition(Math.cos(a) * out, FLOOR_Y, Math.sin(a) * out)
        beads.setMatrixAt(i, m4)
      }
      beads.instanceMatrix.needsUpdate = true
    }
    puddle.visible = flat > 0.05
    puddleMat.opacity = 0.75 * Math.min(1, flat * 1.5)
    if (since >= 0 && since < 1) {
      ripple.visible = true
      ripple.position.set(0, FLOOR_Y, 0)
      ripple.scale.setScalar(RING_R * (0.5 + 1.1 * since))
      rippleMat.opacity = 0.9 * (1 - since)
      drop.visible = false
      return
    }
    const n = Math.floor(t / DRIP_EVERY_S)
    const life = DRIP_GROW_S + DRIP_FALL_S + DRIP_RIPPLE_S
    const age = t - n * DRIP_EVERY_S - rand(n) * (DRIP_EVERY_S - life)
    const [x, z] = DRIP_SPOTS[Math.floor(rand(n + 0.5) * DRIP_SPOTS.length)]
    const fall = (age - DRIP_GROW_S) / DRIP_FALL_S
    drop.visible = flat < 0.05 && age >= 0 && fall < 1 // a collapsed Aqua does not drip
    ripple.visible = flat < 0.05 && fall >= 1 && age < life
    if (drop.visible) {
      const grown = Math.min(1, age / DRIP_GROW_S)
      if (fall <= 0) hungY = HEM_Y + (rider ? model.worldToLocal(rider.getWorldPosition(at)).y - restY : 0)
      const y = fall <= 0 ? hungY - DRIP_R * grown : hungY - DRIP_R - (hungY - DRIP_R - FLOOR_Y) * fall * fall
      drop.position.set(x, Math.max(y, FLOOR_Y), z)
      // it swells as it gathers, and is longer than it is wide while it hangs and falls
      drop.scale.set(grown * (1 - 0.15 * grown), grown * (1 + 0.45 * grown), grown * (1 - 0.15 * grown))
    }
    if (ripple.visible) {
      const k = (age - DRIP_GROW_S - DRIP_FALL_S) / DRIP_RIPPLE_S
      ripple.position.set(x, FLOOR_Y, z)
      ripple.scale.setScalar(DRIP_R * (1.5 + 4 * k))
      rippleMat.opacity = 0.9 * (1 - k)
    }
  }
}
