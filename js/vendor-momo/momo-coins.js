// GENERATED COPY of momo/src/components/character/momo-coins.ts — do not edit here.
// Types stripped with node:module stripTypeScriptTypes; relative imports given a .js extension.
// Regenerate from the app instead (see README "3D buddies").
import * as CANNON from 'cannon-es'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The coins a session earned, dropped onto Momo's ring: real rigid bodies (cannon-es) that bounce
 * off Momo's head, roll on their edge, settle flat and stack. Plain three.js + cannon with no app
 * imports, like `momo-ring.ts`, so a browser page can show the same coins.
 *
 * The ring is the floor. It leans toward the camera (`floor.tilt`), so the whole physics world lives
 * in a group leaning the same way: gravity is "down" along the ring's normal and a coin lying flat
 * lies flat on the ring.
 */

// Lengths are multiples of the character's half-width, like the ring's.
const RADIUS = 0.095 // coin radius
const THICK = 0.3 // coin thickness, against its radius: chunky, so it stacks and rolls well
const DROP_FROM = 2.9 // where a coin starts falling, above the floor: just inside the top of the view
// Coins start in the sector of the ring in front of the body, so every one has floor under it: one
// that fell onto the head would lie there. [nearest, farthest] from the centre, and the half-angle.
const DROP_ZONE = [0.45, 0.85]         
const DROP_ARC = Math.PI / 3
const DROP_EVERY_MS = 170 // the gap between one coin and the next
const MAX_COINS = 12 // bodies on the floor at most: past this the last coin is worth the rest
const GRAVITY = 12 // a touch over 9.82: snappier than life
const SLEEP_SPEED = 0.12 // slower than this for SLEEP_S and a coin is put to sleep
const SLEEP_S = 0.4
// A coin still rocking this long after the last drop is put to sleep where it is: a pile that never
// quite stops (a coin leaning on a wall or another coin) would otherwise never be saved.
const SETTLE_MS = 3000
const GOLD = '#FFC84A'
const VANISH_MS = 260 // a tapped coin pops up a touch, spins and shrinks away

                                              
/** A coin at rest on the ring: its value and its pose in the floor's frame, as saved between launches. */
                                                                                                      

/** What the next coin to drop is worth, or 0 for none: 1 each, until the last allowed carries the rest. */
export function nextCoin(values                   , want        , max = MAX_COINS) {
  const left = want - values.reduce((a, b) => a + b, 0)
  if (left <= 0) return 0
  return values.length >= max - 1 ? left : 1
}

/** The coin values once `want` has gone down: the newest coins go first. */
export function trimCoins(values                   , want        ) {
  const out = [...values]
  let over = out.reduce((a, b) => a + b, 0) - want
  while (over > 0 && out.length) {
    const last = out[out.length - 1]
    if (last <= over) {
      out.pop()
      over -= last
    } else {
      out[out.length - 1] = last - over
      over = 0
    }
  }
  return out
}

/** One coin's geometry: a disc with a raised rim and the emblem embossed on both faces. Axis = Y. */
export function coinGeometry(r        , emblem        ) {
  const t = r * THICK
  // The disc first; everything after it is embossing, drawn in the second (deeper) material.
  const parts                         = [
    new THREE.CylinderGeometry(r, r, t, 40),
    new THREE.TorusGeometry(r * 0.86, t * 0.28, 8, 48).rotateX(Math.PI / 2).translate(0, t / 2, 0),
    new THREE.TorusGeometry(r * 0.86, t * 0.28, 8, 48).rotateX(Math.PI / 2).translate(0, -t / 2, 0),
  ]
  // The emblem is built on the top face, "up" along -Z, then copied to the bottom face.
  const h = t * 0.4 // how far it stands proud of the face
  const top                         = []
  if (emblem === 'face') {
    const eye = () => new THREE.CylinderGeometry(r * 0.075, r * 0.075, h, 10)
    top.push(eye().translate(-r * 0.22, h / 2, -r * 0.1), eye().translate(r * 0.22, h / 2, -r * 0.1))
    // A smile: half a torus, the open side up.
    top.push(new THREE.TorusGeometry(r * 0.2, r * 0.045, 6, 16, Math.PI).rotateZ(Math.PI).rotateX(-Math.PI / 2).translate(0, h / 2, r * 0.08))
  } else {
    const shape = new THREE.Shape()
    if (emblem === 'star') {
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 5
        const d = i % 2 ? r * 0.2 : r * 0.44
        shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * d, Math.sin(a) * d)
      }
    } else {
      // The classic bezier heart, 36 units wide, scaled to the coin.
      const s = (r * 0.8) / 36
      shape.moveTo(25 * s, 25 * s)
      shape.bezierCurveTo(25 * s, 25 * s, 20 * s, 0, 0, 0)
      shape.bezierCurveTo(-30 * s, 0, -30 * s, 35 * s, -30 * s, 35 * s)
      shape.bezierCurveTo(-30 * s, 55 * s, -10 * s, 77 * s, 25 * s, 95 * s)
      shape.bezierCurveTo(60 * s, 77 * s, 80 * s, 55 * s, 80 * s, 35 * s)
      shape.bezierCurveTo(80 * s, 35 * s, 80 * s, 0, 50 * s, 0)
      shape.bezierCurveTo(35 * s, 0, 25 * s, 25 * s, 25 * s, 25 * s)
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
    if (emblem === 'heart') geo.center().rotateZ(Math.PI).translate(0, 0, h / 2) // the point down
    top.push(geo.rotateX(-Math.PI / 2))
  }
  for (const g of top) {
    parts.push(g.clone().translate(0, t / 2, 0), g.rotateZ(Math.PI).translate(0, -t / 2, 0))
  }
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()), true)
  merged.deleteAttribute('uv') // nothing is textured
  for (const g of merged.groups) g.materialIndex = g.materialIndex ? 1 : 0
  return merged
}

/** The disc's gold, and the rim's and emblem's deeper gold, so the embossing reads at coin size. */
export function coinMaterials(color = GOLD) {
  const gold = (c                      , metal        ) =>
    new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: 0.32, emissive: '#5a3600', emissiveIntensity: 0.35 })
  return [gold(color, 0.35), gold(new THREE.Color(color).multiplyScalar(0.72), 0.55)]
}

export function addCoins(
  scene             ,
  character                ,
  floor   
                                                                             
                           
                
                                                       
                  
                                                                     
                
   ,
  opts   
                   
                                                                                     
                     
                                                                                                          
                                         
    = {},
) {
  const { half } = floor
  const emblem = opts.emblem ?? 'face'
  const r = half * RADIUS
  const t = r * THICK

  const group = new THREE.Group()
  group.position.copy(floor.position)
  group.rotation.x = floor.tilt
  scene.add(group)
  group.updateMatrixWorld()

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0), allowSleep: true })
  const coinMat = new CANNON.Material('coin')
  const stillMat = new CANNON.Material('still')
  const bodyMat = new CANNON.Material('body')
  world.addContactMaterial(new CANNON.ContactMaterial(coinMat, stillMat, { friction: 0.45, restitution: 0.35 }))
  world.addContactMaterial(new CANNON.ContactMaterial(coinMat, coinMat, { friction: 0.3, restitution: 0.15 }))
  // Nothing sticks to the body: a coin that brushes it slides straight off to the floor.
  world.addContactMaterial(new CANNON.ContactMaterial(coinMat, bodyMat, { friction: 0, restitution: 0.4 }))

  const still = (shape              , pos             , quat                    , material = stillMat) => {
    const b = new CANNON.Body({ mass: 0, shape, material, position: pos, quaternion: quat })
    world.addBody(b)
  }
  // The floor, and a cage of eight tall walls round the ring: a coin rolls or bounces back, never away.
  still(new CANNON.Plane(), new CANNON.Vec3(), new CANNON.Quaternion().setFromEuler(-Math.PI / 2, 0, 0))
  const wallR = floor.radius + r * 0.4
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    still(
      new CANNON.Box(new CANNON.Vec3(wallR * 0.45, half * 2, r * 0.2)),
      new CANNON.Vec3(Math.sin(a) * wallR, half * 2, Math.cos(a) * wallR),
      new CANNON.Quaternion().setFromEuler(0, a, 0),
    )
  }
  // Momo's body: a ball the coins glance off, so they scatter round it instead of through it.
  let body                 = character
  character.traverse((o) => {
    if ((o                     ).isSkinnedMesh) body = o
  })
  const box = new THREE.Box3().setFromObject(body)
  const head = group.worldToLocal(new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y - half * 0.95, (box.min.z + box.max.z) / 2))
  still(new CANNON.Sphere(half * 0.92), new CANNON.Vec3(head.x, head.y, head.z), undefined, bodyMat)

  const geometry = coinGeometry(r, emblem)
  const materials = coinMaterials()
  const shape = new CANNON.Cylinder(r, r, t, 12)
  const coins                                                           = []
  let lastDrop = 0
  let changed = false // something was added or taken since the layout was last reported
  const vanishing                                                = [] // tapped coins on their way out (at -1 = not started)

  function add(value        ) {
    const mesh = new THREE.Mesh(geometry, materials)
    const b = new CANNON.Body({ mass: 0.02, shape, material: coinMat, sleepSpeedLimit: SLEEP_SPEED, sleepTimeLimit: SLEEP_S })
    world.addBody(b)
    group.add(mesh)
    coins.push({ mesh, body: b, value })
    changed = true
    return b
  }
  function drop(value        ) {
    const b = add(value)
    const a = (Math.random() - 0.5) * 2 * DROP_ARC
    const d = half * (DROP_ZONE[0] + Math.random() * (DROP_ZONE[1] - DROP_ZONE[0]))
    b.position.set(Math.sin(a) * d, half * DROP_FROM, Math.cos(a) * d)
    b.quaternion.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
    b.angularVelocity.set((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5)
  }
  function remove(i        ) {
    const [c] = coins.splice(i, 1)
    world.removeBody(c.body)
    group.remove(c.mesh)
    changed = true
  }
  // Last time's coins, back where they lay. Asleep: they only move if something hits them.
  for (const l of opts.laid ?? []) {
    const b = add(l.v)
    b.position.set(l.p[0], Math.max(l.p[1], t / 2), l.p[2])
    b.quaternion.set(l.q[0], l.q[1], l.q[2], l.q[3])
    b.sleep()
  }
  const round = (n        ) => Math.round(n * 1000) / 1000
  const layout = ()             =>
    coins.filter((c) => c.body.sleepState === CANNON.Body.SLEEPING).map(({ body: b, value }) => ({
      v: value,
      p: [round(b.position.x), round(b.position.y), round(b.position.z)],
      q: [round(b.quaternion.x), round(b.quaternion.y), round(b.quaternion.z), round(b.quaternion.w)],
    }))

  const ray = new THREE.Raycaster()
  return {
    /** Step the world, drop a coin if `want` (coins owed) is above what lies here, take some back if below. */
    update(dt        , want        , nowMs        ) {
      const values = coins.map((c) => c.value)
      const next = nextCoin(values, want)
      if (next && nowMs - lastDrop >= DROP_EVERY_MS) {
        lastDrop = nowMs
        if (coins.length < MAX_COINS) drop(next)
        else {
          coins[coins.length - 1].value += next // full: the newest coin carries the extra
          changed = true
        }
      } else if (!next) {
        const kept = trimCoins(values, want)
        while (coins.length > kept.length) remove(coins.length - 1)
        if (coins.length && coins[coins.length - 1].value !== kept[kept.length - 1]) {
          coins[coins.length - 1].value = kept[kept.length - 1]
          changed = true
        }
      }
      world.step(1 / 60, dt, 4)
      for (let i = vanishing.length - 1; i >= 0; i--) {
        const v = vanishing[i]
        if (v.at < 0) v.at = nowMs
        const k = Math.min(1, (nowMs - v.at) / VANISH_MS)
        v.mesh.scale.setScalar(k < 0.3 ? 1 + k : 1.3 * (1 - (k - 0.3) / 0.7)) // swell, then shrink to nothing
        v.mesh.position.y = v.y + r * 3 * Math.sin(k * Math.PI * 0.5)
        v.mesh.rotation.y += dt * 18
        if (k >= 1) {
          group.remove(v.mesh)
          vanishing.splice(i, 1)
        }
      }
      for (const c of coins) {
        const { x, y, z } = c.body.position
        c.mesh.position.set(x, y, z)
        const q = c.body.quaternion
        c.mesh.quaternion.set(q.x, q.y, q.z, q.w)
      }
      // Once everything lies still again, say where: that is what comes back after a relaunch.
      if (changed && !nextCoin(coins.map((c) => c.value), want)) {
        const asleep = coins.every((c) => c.body.sleepState === CANNON.Body.SLEEPING)
        if (!asleep && nowMs - lastDrop < SETTLE_MS) return
        for (const c of coins) c.body.sleep()
        changed = false
        opts.onLayout?.(layout())
      }
    },
    /** The coin under a tap at normalized device coordinates, taken off the floor: its value, or 0. */
    pick(ndc               , camera              ) {
      ray.setFromCamera(ndc, camera)
      const hit = ray.intersectObjects(coins.map((c) => c.mesh), false)[0]
      if (!hit) return 0
      const i = coins.findIndex((c) => c.mesh === hit.object)
      const { mesh, body: b, value } = coins[i]
      coins.splice(i, 1)
      world.removeBody(b)
      changed = true
      vanishing.push({ mesh, y: mesh.position.y, at: -1 })
      return value
    },
    /** How many coins lie here right now. */
    get count() {
      return coins.length
    },
    dispose() {
      // Leaving mid-fall: keep the coins that have landed; the rest drop again next time.
      if (changed) opts.onLayout?.(layout())
      while (coins.length) remove(coins.length - 1)
      for (const v of vanishing.splice(0)) group.remove(v.mesh)
      scene.remove(group)
      geometry.dispose()
      for (const m of materials) m.dispose()
    },
  }
}
