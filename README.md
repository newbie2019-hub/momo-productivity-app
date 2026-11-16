# momo-site

Marketing site for **Momo: Pomodoro Gamified**, plus the two legal pages the App
Store requires.

Static HTML, CSS and plain ES modules. No build step, no npm, nothing to install.

```
python3 -m http.server 8899    # serve it: ES modules and the .glb models need http, not file://
```

## Pages

| Path            | File                     |
| --------------- | ------------------------ |
| `/`             | `index.html`             |
| `/privacy`      | `privacy/index.html`     |
| `/terms-of-use` | `terms-of-use/index.html` |

Directory-per-page, so the clean URLs work as-is on GitHub Pages, Netlify, Vercel
and Cloudflare with no rewrite rules. Every link and asset path is relative, so it
also works from a subdirectory (`user.github.io/momo-site/`) and from `file://`.

## Before you publish

The legal pages contain placeholders that must be filled in, listed in an HTML
comment at the top of each file:

- `[Legal entity]` — the company or sole trader operating Momo
- `[Business address]` — required for store listings in some regions
- `[Country/State]` — governing law (Terms only)

They're written to match what the app actually does — the data in
`users/{uid}`, the session records, RevenueCat, Firebase, the fact that Strict
Mode app selections never leave the device — but **have a lawyer read them.** Not
legal advice.

Once the App Store listing exists, add a download button next to the waitlist forms.

## The design

The app's dark theme (`momo/src/constants/theme.ts`): one warm dark ground, one
accent (Momo's coral #FF9585 to blush #FF5F6D) and one warm neutral (cream #F6EDE4
plus a muted warm grey). No other colours in the UI: buddy colours appear only on
the 3D buddies and their own rings. The backdrop is a single fixed `.ambient` layer
of very soft coral glows with a faint film grain, so sections never show a seam.

The pitch leads with Strict Mode and the game loop (coins, streaks, achievements,
leaderboards, focus rooms); buddies support it. Only Momo and Mint are shown as
buddies, with Aqua as a teaser behind frosted glass and in the story's quit beat.
Never call the characters "ghosts" in copy: they are buddies, Momo is the main one.
No pricing or coin costs anywhere on the page.

Third-party JS, all from CDNs with pinned versions: Lenis + GSAP 3.13/ScrollTrigger
(classic scripts), three 0.187 + cannon-es 0.20 (importmap in `index.html`), and the
Firebase JS SDK 11.10 (loaded by `js/waitlist.js` on first use).

| File | Does |
| --- | --- |
| `main.js` | Lenis, reveals, the DOM half of every scene, and `window.momoStory` (scroll progress of "How it works") |
| `js/stage.js` | Every live 3D buddy, through one WebGL canvas |
| `js/waitlist.js`, `js/firebase-config.js` | The two waitlist forms |
| `js/vendor-momo/` | **Generated** copies of the app's three.js code; do not edit |

`main.js` only adds `.anim` (which lets CSS hide things before they reveal) once
GSAP has loaded, so a blocked CDN leaves a plain, readable page.
`prefers-reduced-motion` turns off Lenis, the sticky story (its steps just stack),
and holds the 3D on still frames.

## 3D buddies

One fixed `<canvas id="gl">` over the page, under the header, with pointer events
off. Each `[data-view]` element (hero, story, lab, join) and each small
`[data-buddy]` slot (roster, leaderboard, focus room, teaser) is a window: every
frame the renderer draws that view's scene into the element's rectangle with a
viewport + scissor. Views are built when they come within ~900px of the screen, and
the loop stops whenever no view is visible. DPR is capped at 1.75. There are no
static character images: while loading, and without WebGL, a slot shows a soft glow.

After drawing, one full-screen pass raises each pixel's alpha to its brightest
channel. The additive glows write colour but no alpha; Chrome composites that as
light, Firefox does not (it showed the ring as a grey disc). Keep that pass.

The import map must stay above the first `modulepreload`/module script: Firefox and
Safari ignore an import map that arrives after a module load (bare `three` then
fails and no 3D shows).

`stage.js` drives the buddies the way `momo/scripts/render-clip.mjs` does: same
lights, camera, clip sequencing, flatness from the `Collapse*` morph targets, floor
shadow, tilt-when-flat, and `ring.update(now, tapAt, progress, 1, cast, 1 - flat)`.

**The app code** lives in `js/vendor-momo/`: `momo-ring`, `momo-effects` (`addLook`,
used here for Aqua), `momo-dome` (the Strict Mode shield) and
`momo-coins` (rigid-body coins via cannon-es). Regenerate after the app changes:

```
node scripts/vendor-momo.mjs     # Node 24+, expects the app repo at ../momo
```

**The models** in `assets/models/` are trimmed copies of the app's GLBs, meshopt
compressed (decoded by three's `MeshoptDecoder`) with positions and morph targets
left as floats. Quantizing them (gltfpack, `gltf-transform meshopt`) breaks the
`Collapse*` morphs on the GPU: the collapsed body lands off its ring. Draco mangles
morph targets too.

| File | From | Clips kept | Size |
| --- | --- | --- | --- |
| `ghost.glb` | `ghost/ghost.glb` (Momo, Aqua) | Idle, IdleBlink, IdleLook, Focus, Celebrate, IdleBounce, Happy, Failed, DeflatedIdle, Reinflate, Greeting, Wave | 2.2 MB |
| `mint.glb` | `ghost_mint/mint.glb` | Idle, IdleBlink, IdleBounce, Happy, Celebrate, Failed, DeflatedIdle, Reinflate | 2.2 MB |

The unused `Prop*` meshes are dropped too. `scripts/trim-model.mjs` does it all
(see its header). `ghost.glb` loads up front; `mint.glb` when the page reaches it.

## Waitlist

`setDoc(doc(db, 'waitlist', email), { email, createdAt: serverTimestamp(), source: 'site' })`
with `email` trimmed and lowercased. The Firestore rule allows create only, with
exactly those keys and `email` equal to the doc id, so a second signup with the same
email comes back `permission-denied`, which the form shows as "already on the list".
App Check (reCAPTCHA Enterprise) is enforced; the site key is in
`js/firebase-config.js` and only works on the domains registered for it. A filled
honeypot pretends to succeed and writes nothing.

## The Strict Mode app grid

The tiles are **category icons, not brand logos**: neutral squircles with a
chat, video or photos glyph. They read as a home screen at a glance without naming
anyone.

That's deliberate. Reproducing real marks (Instagram, TikTok, YouTube…) is a
trademark question, depicting named brands as *blocked* in store-listing
marketing is a review risk, and hand-drawn approximations of someone's logo look
worse than a clean generic icon anyway.

If you decide you want the real thing, every major platform publishes an official
brand-asset kit — drop the SVGs in and swap the `<use href="#i-…">` for an
`<img>` inside `.tile__ico`; the squircle, shadow, lock badge and blocking
animation all keep working. Check each platform's brand guidelines first, several
explicitly forbid showing their mark altered or disparaged.

## Assets

Everything under `assets/` derives from the app repo (`momo/assets/`), re-encoded
for the web: `img/badge-*.webp` are the app's achievement art
(`momo/assets/badges/`) at 256px. Encode new art with `cwebp`.
