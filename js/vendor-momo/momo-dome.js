// GENERATED COPY of momo/src/components/character/momo-dome.ts — do not edit here.
// Types stripped with node:module stripTypeScriptTypes; relative imports given a .js extension.
// Regenerate from the app instead (see README "3D buddies").
import * as THREE from 'three'

import { BLEND } from './momo-ring.js'

/**
 * Strict Mode's shield, inside the 3D scene: a glass half-dome standing on the ring, over whatever
 * is on it (Momo, the onboarding phone). Plain three.js, like `momo-ring.ts`.
 *
 * Drawn the way the ring's glow is, additively with no bloom: almost clear in the middle, bright
 * at its silhouette (a fresnel rim), so it reads as glass in the ring's colour. It grows up out of
 * the ring when switched on, and flares once when something hits it (a notification it blocked).
 */
const GROW_MS = 450 // on: rises out of the ring; off: sinks back, a little faster
const HIT_MS = 800 // a hit's flare, fading out
const WIDE = 1.12 // dome radius against the ring's

export function addDome(
  scene             ,
  floor                                                           ,
  color        ,
  /** How tall the dome stands above the ring, world units: enough to cover what is on it. */
  height        ,
) {
  const r = floor.radius * WIDE
  const geo = new THREE.SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2)
  geo.scale(1, height / r, 1)
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uGlow: { value: 0 },
    uHit: { value: 0 },
  }
  const mat = new THREE.ShaderMaterial({
    ...BLEND,
    side: THREE.DoubleSide,
    uniforms,
    vertexShader: `
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vY = uv.y;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uGlow, uHit;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
        // A faint band of light low on the dome, where it meets the ring.
        float base = smoothstep(0.75, 1.0, vY) * 0.35;
        float a = (0.05 + 0.75 * rim + base) * uGlow * (1.0 + 1.6 * uHit);
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.25 * uHit), a);
        #include <colorspace_fragment>
      }`,
  })
  const mesh = new THREE.Mesh(geo, mat)
  const group = new THREE.Group()
  group.position.copy(floor.position)
  group.rotation.x = floor.tilt // stands square on the tilted ring
  group.add(mesh)
  group.visible = false
  scene.add(group)

  let k = 0 // 0 sunk into the ring … 1 standing
  let last = 0
  return {
    /** `on`: the shield is up. `hitAt`: when it last blocked something, ms (0 = never). */
    update(nowMs        , on         , hitAt = 0) {
      const dt = last ? Math.min(0.1, (nowMs - last) / 1000) : 0
      last = nowMs
      k = on ? Math.min(1, k + (dt * 1000) / GROW_MS) : Math.max(0, k - (dt * 1000) / (GROW_MS * 0.7))
      const shown = 1 - (1 - k) ** 3 // ease out
      group.visible = shown > 0.001
      group.scale.set(0.85 + 0.15 * shown, shown, 0.85 + 0.15 * shown)
      uniforms.uGlow.value = shown
      uniforms.uHit.value = hitAt ? Math.max(0, 1 - (nowMs - hitAt) / HIT_MS) ** 2 : 0
    },
  }
}
