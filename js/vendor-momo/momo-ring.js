// GENERATED COPY of momo/src/components/character/momo-ring.ts — do not edit here.
// Types stripped with node:module stripTypeScriptTypes; relative imports given a .js extension.
// Regenerate from the app instead (see README "3D buddies").
import * as THREE from 'three'

/**
 * Momo's stage, inside the 3D scene: the glowing ring it floats over, the light the ring casts, and
 * two streaks of light that orbit it — in front of the body, then hidden behind it. Plain three.js with no app imports,
 * so the same code can be drawn in a browser page to check the look without a device.
 *
 * The glow is two flat additive bands around a thin bright torus instead of bloom: post-processing
 * on expo-gl costs a full-screen pass every frame.
 */

// Tuning knobs. Lengths are multiples of the character's half-width, so any model gets a ring
// that fits it.
const RADIUS = 1.0 // ring radius
const TUBE = 0.007 // core thickness: a hairline, the glow bands around it do the rest
const DROP = 0.16 // how far under the character's lowest point the ring sits
// The camera looks at Momo almost level, which would flatten a level ring to a sliver. Leaning it
// toward the camera opens it into an ellipse.
const TILT = (16 * Math.PI) / 180
const LIGHT = 1.9 // ring light strength (candela)
const RIM = 0.9 // warm back light strength
const BREATH_S = 5.5 // one slow brightness breath
const FLASH_MS = 700 // how long a tap's extra glow lasts
// The orbiting streaks: [radius, lean toward the camera, sideways roll, seconds per lap (negative
// = the other way), brightness]. Radii stay above 1 so a streak never cuts through the arms.
const ORBITS = [
  [1.3, 0.3, 0.42, 9, 0.9],
  [1.55, 0.5, -0.3, -14, 0.6],
]         
const ORBIT_TUBE = 0.007 // streak thickness
const ORBIT_ARC = Math.PI * 0.85 // how much of the lap one streak covers
// The session's progress ring only.
const TRACK = 0.03 // brightness of the part not reached yet, against the lit part
const EDGE = 0.012 // half the width of the soft ends of the lit arc, in laps
const FRONT = 1.0 // size while it faces the camera round the countdown, against its settled size

/** How much of the ring is lit, 0..1, for any number: an unlimited session's progress is not one. */
export const litShare = (progress        ) => (progress > 0 ? Math.min(1, progress) : 0)

export function addRing(
  scene             ,
  character                ,
  color        ,
  opts   
                                     
                   
                                                                                                           
                      
                                                                                                            
                         
       
                                                                                                
                                                                                            
       
                      
    = {},
) {
  // Size from the skinned body alone: the whole file also holds props that sit off to the side.
  let body                 = character
  character.traverse((o) => {
    if ((o                     ).isSkinnedMesh) body = o
  })
  const box = new THREE.Box3().setFromObject(body)
  const half = (box.max.x - box.min.x) / 2
  const r = half * RADIUS * (opts.radius ?? 1)

  const group = new THREE.Group()
  group.position.set((box.min.x + box.max.x) / 2, box.min.y - half * DROP, (box.min.z + box.max.z) / 2)
  group.rotation.x = -(Math.PI / 2 - TILT)
  scene.add(group)
  const settled = group.position.clone()
  const flat = group.rotation.x

  // The progress ring: one shader for the core and the bands, all reading the same `uProgress`, so
  // moving the arc is one number a frame and no geometry is ever rebuilt.
  const shared = {
    uProgress: { value: 0 },
    uFlip: { value: 0 }, // 1 = the lit arc runs the other way round from the far point
    uGlow: { value: 1 },
    uLit: { value: new THREE.Color(color) },
    uTrack: { value: new THREE.Color(color).multiplyScalar(TRACK) },
  }
  // `cap` is a band's half-width in laps: the lit arc ends that much sooner at the band's edges
  // than along its middle, so the glow closes round the tip instead of stopping at a straight cut.
  const arcMat = (strength        , cap        ) =>
    new THREE.ShaderMaterial({
      ...BLEND,
      side: cap ? THREE.DoubleSide : THREE.FrontSide,
      uniforms: { ...shared, uStrength: { value: strength }, uCap: { value: cap } },
      vertexShader: `
        attribute vec2 arc;
        varying vec2 vArc;
        void main() {
          vArc = arc;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform float uProgress, uFlip, uGlow, uStrength, uCap;
        uniform vec3 uLit, uTrack;
        varying vec2 vArc;
        void main() {
          // Both ends of the arc are soft and rounded, less and less over the last tenth: a full
          // ring has no ends, and they would leave a notch in it.
          float ends = 1.0 - smoothstep(0.9, 1.0, uProgress);
          float tip = (1.0 - vArc.y) * uCap * ends;
          float soft = ${EDGE} + uCap * 0.4;
          // Stretched by the soft end's width, so 0 is fully dark and 1 fully lit.
          float end = uProgress * (1.0 + 2.0 * soft) - soft;
          float at = uFlip > 0.5 ? 1.0 - vArc.x : vArc.x;
          float lit = (1.0 - smoothstep(end - soft, end + soft, at + tip))
            * smoothstep(tip - soft * ends, tip + soft * ends + 0.0001, at);
          gl_FragColor = vec4(mix(uTrack, uLit, lit) * vArc.y, uStrength * uGlow);
          #include <colorspace_fragment>
        }`,
    })
  // What that shader needs at each vertex: how far round the ring it is (0 at the far, 12 o'clock
  // point, growing clockwise as the camera sees it) and its brightness across the band. Both
  // shapes are built from that far point anticlockwise, 97 vertices a lap, hence `1 -`.
  const arcAttr = (geo                      , fall                       ) => {
    const n = geo.attributes.position.count
    const a = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) a.set([1 - (i % 97) / 96, fall(i)], i * 2)
    geo.setAttribute('arc', new THREE.BufferAttribute(a, 2))
  }

  const torus = new THREE.TorusGeometry(r, half * TUBE, 12, 96).rotateZ(Math.PI / 2)
  if (opts.progress) arcAttr(torus, () => 1)
  const solid = new THREE.MeshBasicMaterial({ color })
  const core = new THREE.Mesh(torus, opts.progress ? arcMat(1, 0) : solid)
  // The progress ring's bands: the same shapes as `ringBands`, lit by the arc shader instead.
  const arcBand = ([width, strength]                           ) => {
    const geo = bandGeometry(r, half, width)
    arcAttr(geo, bandFall)
    return { mesh: new THREE.Mesh(geo, arcMat(strength, (half * width) / (2 * Math.PI * r))), mat: null, strength }
  }
  const glows = opts.progress ? BANDS.map(arcBand) : ringBands(r, half, color)
  group.add(core, ...glows.map((g) => g.mesh))
  // Ahead of a see-through character (the session's Momo), so the far side of the ring shows
  // through the body instead of being cut out by it. Harmless when the character is solid.
  for (const m of group.children) m.renderOrder = -1
  const base = solid.color.clone()

  const orbits = makeOrbits(scene, box.getCenter(new THREE.Vector3()), half, color, opts.orbitTilt)

  // The ring's light. It sits under the front of the ring, so the lower body the camera sees
  // catches it; `distance` makes it fade out before it reaches the face.
  const light = new THREE.PointLight(color, LIGHT, half * 3.2, 1.6)
  light.position.set(group.position.x, group.position.y - half * 0.3, group.position.z + r * 0.9)
  scene.add(light)

  const rim = new THREE.DirectionalLight(color, RIM)
  rim.position.set(1.5, 1.2, -3)
  scene.add(rim)

  return {
    /** Where the ring lies once settled, for anything that stands on it (the coins). */
    floor: { position: settled, tilt: TILT, radius: r, half },
    /**
     * `nowMs` drives the breathing; `tapMs` is when Momo was last tapped (0 = never). `progress`
     * (0..1) is how much of a progress ring is lit. `pose` moves a ring that has a `front` from
     * there (0) to its place under the character (1). `cast` (0..1) brings up what belongs to the
     * character rather than the ring: the light on it and the orbits round it. `orbit` (0..1) is
     * the orbits alone, for a character the light still falls on but nothing circles (flat on the floor).
     */
    update(nowMs        , tapMs        , progress = 0, pose = 1, cast = pose, orbit = cast) {
      const breath = ringBreath(nowMs)
      const flash = tapMs ? Math.max(0, 1 - (nowMs - tapMs) / FLASH_MS) ** 2 : 0
      const k = 0.88 + 0.12 * breath + 0.6 * flash
      light.intensity = LIGHT * k * cast
      rim.intensity = RIM * cast
      solid.color.copy(base).lerp(WHITE, 0.1 * breath + 0.4 * flash)
      for (const g of glows) if (g.mat) g.mat.opacity = g.strength * k
      shared.uGlow.value = k
      shared.uProgress.value = litShare(progress)
      // Round the countdown the arc fills from the top, clockwise like a clock. Under Momo it
      // starts at the far point, directly behind the body, and comes round by the left to the
      // front and on to the right. The direction changes over once, while the settled ring is
      // empty, so the change is never seen.
      if (pose >= 1 && shared.uProgress.value < 0.02) shared.uFlip.value = 1
      if (opts.front) {
        group.position.lerpVectors(opts.front, settled, pose)
        group.rotation.x = flat * pose
        group.scale.setScalar(FRONT + (1 - FRONT) * pose)
      }
      spinOrbits(orbits, nowMs, (1 + flash) * orbit)
    },
  }
}

// The ring's glow, narrow to wide: [half-width against the character's half-width, strength]. Each
// band is fainter and softer than the last, so the line melts outward.
const BANDS = [
  [0.06, 0.7],
  [0.2, 0.34],
  [0.55, 0.16],
]         
const bandGeometry = (r        , half        , width        ) =>
  new THREE.RingGeometry(r - half * width, r + half * width, 96, 8, Math.PI / 2)
/** Brightness across a band at vertex `i`: 0 at both edges, 1 along the middle. */
const bandFall = (i        ) => (1 - Math.abs((Math.floor(i / 97) / 8) * 2 - 1)) ** 2.2

/**
 * The glow round a ring of radius `r`: flat bands in the XY plane whose brightness falls off to
 * nothing at both edges. Drawn additively, so black adds no light and a band needs no texture or
 * shader. Set each `mat.opacity` to its `strength` times the brightness wanted. Also used by the
 * Shop's showroom, on the equipped character's platform.
 */
export function ringBands(r        , half        , color        ) {
  const c = new THREE.Color(color)
  return BANDS.map(([width, strength]) => {
    const geo = bandGeometry(r, half, width)
    const n = geo.attributes.position.count
    const rgb = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = bandFall(i)
      rgb.set([c.r * v, c.g * v, c.b * v], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3))
    const mat = new THREE.MeshBasicMaterial({ ...LIGHT_ONLY, opacity: strength, side: THREE.DoubleSide })
    return { mesh: new THREE.Mesh(geo, mat), mat: mat                                  , strength }
  })
}

/** The ring's slow brightness breath at `nowMs`, 0..1. */
export const ringBreath = (nowMs        ) => 0.5 + 0.5 * Math.sin((nowMs / 1000 / BREATH_S) * Math.PI * 2)

/**
 * The streaks of light that orbit a character: round `centre`, sized by the character's half-width,
 * added to `parent`. Each streak is part of a hair-thin torus, bright in the middle and black
 * (invisible, being additive) at both ends, spun round its own axis. It keeps the depth test, so
 * the body hides it as it passes behind. Also used by the Shop's showroom, for the equipped character.
 */
export function makeOrbits(parent                , centre               , half        , color        , orbitTilt = 1) {
  return ORBITS.map(([radius, lean, roll, lapS, strength], n) => {
    const SEG = 80
    const geo = new THREE.TorusGeometry(half * radius, half * ORBIT_TUBE, 6, SEG, ORBIT_ARC)
    const count = geo.attributes.position.count
    const rgb = new Float32Array(count * 3)
    const c = new THREE.Color(color)
    for (let i = 0; i < count; i++) {
      const v = Math.sin(((i % (SEG + 1)) / SEG) * Math.PI) ** 2
      rgb.set([c.r * v, c.g * v, c.b * v], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(rgb, 3))
    const mat = new THREE.MeshBasicMaterial(LIGHT_ONLY)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    const tilt = new THREE.Group()
    tilt.position.copy(centre)
    tilt.rotation.order = 'ZXY' // lay it flat and lean it first, then roll the whole lap sideways
    tilt.rotation.set(-(Math.PI / 2 - lean * orbitTilt), 0, roll * orbitTilt)
    mesh.renderOrder = 1 // after a see-through character, which then hides the streak's far side
    tilt.add(mesh)
    parent.add(tilt)
    // How far toward the camera a point at angle `a` on this lap is, -1 (far side) to 1 (near).
    const ex = new THREE.Vector3(1, 0, 0).applyEuler(tilt.rotation).z
    const ey = new THREE.Vector3(0, 1, 0).applyEuler(tilt.rotation).z
    const near = (a        ) => (Math.cos(a) * ex + Math.sin(a) * ey) / Math.hypot(ex, ey)
    return { mesh, mat, lapS, strength, near, phase: n * 2.1 }
  })
}

/** Turn the streaks to where they are at `nowMs`, at brightness `k` (1 = Home's; 0 hides them). */
export function spinOrbits(orbits                               , nowMs        , k        ) {
  for (const o of orbits) {
    o.mesh.visible = k > 0.01
    o.mesh.rotation.z = o.phase + (nowMs / 1000 / o.lapS) * Math.PI * 2
    // Dimmer on the far side, so it reads as going away and coming back.
    const front = 0.5 + 0.5 * o.near(o.mesh.rotation.z + ORBIT_ARC / 2)
    o.mat.opacity = o.strength * (0.2 + 0.8 * front) * k
  }
}

/** A disc that is `inner` at its centre and fades to nothing at its rim. RGBA vertex colours. */
export function discGeometry(radius        , inner                                  ) {
  const g = new THREE.CircleGeometry(radius, 40)
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 4)
  col.set(inner, 0) // vertex 0 is the centre
  for (let i = 1; i < n; i++) col.set([inner[0], inner[1], inner[2], 0], i * 4)
  g.setAttribute('color', new THREE.BufferAttribute(col, 4))
  g.rotateX(-Math.PI / 2)
  return g
}

const WHITE = new THREE.Color('#ffffff')

// Additive glow that leaves the canvas's alpha alone. Plain AdditiveBlending also adds alpha, and
// on a see-through GL view that paints the glow's black edges as a dark smudge over the screen.
export const BLEND = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.SrcAlphaFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
}         
const LIGHT_ONLY = { vertexColors: true, ...BLEND }         
