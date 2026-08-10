# momo-site

Marketing site for **Momo: Pomodoro Gamified**, plus the two legal pages the App
Store requires.

Static HTML, CSS and one JS file. No build step, no npm, nothing to install.

```
open index.html                # works straight from disk
python3 -m http.server 8899    # or serve it, to exercise the /privacy paths
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

Also swap the two `#get` anchors in `index.html` for the real App Store URL once
you have one.

## The design

Palette and type come from the app's own system (`momo/docs/design.md`,
`src/constants/theme.ts`) — the site commits to the app's **dark** theme so it
reads as the same product. One structural idea carries the page: **the whole site
is one 25-minute session.** Scroll progress is the clock, which is why the header
counter, the hero dial, the phone's timer, the lockscreen Live Activity and the
Dynamic Island all show the same number, and why section eyebrows are timestamps
(`00:00`, `08:30`, `25:00`) rather than `01 / 02 / 03`.

Third-party JS is two CDN files: GSAP + ScrollTrigger, and Lenis for smooth
scrolling. Both are progressive enhancement — `main.js` only adds the `.anim`
class that allows CSS to hide anything *after* it confirms GSAP loaded, so a
blocked CDN degrades to a static, fully readable page. `prefers-reduced-motion`
disables Lenis entirely and pins the sprites to a single frame.

### The ghost is real app art

`assets/sprites/*.webp` are the app's actual sprite sheets: 6×6 grids of 36
frames at 12fps. Two stepped CSS keyframes walk the grid — no JS, no canvas.

Two things to know if you touch it:

- The timing function must be `steps(6, jump-none)`. Plain `steps(6)` is
  `jump-end`, which lands on 0/16.7/33.3/…/83.3% and never reaches the last
  frame, so every position falls between two frames and you get two half-ghosts.
- Scale sprites with `--gs` (which drives `width`/`height`), never
  `transform: scale()`. A transform shrinks the paint but leaves a full-size
  layout box, which pushes characters out of their cards — and `transform` is
  already used by the per-state animations.

Only the `idle` sheets shipped with the app, so `busy` / `sad` / `celebrating`
are expressed as transforms on the idle loop.

## Device mockups

The screens inside the phone frame are rebuilt in CSS from the app's real design
tokens, so they stay crisp at any size, animate, and can't drift out of date
silently the way a stale PNG does.

To use real captures instead, replace a `.screen` div with an image — the frame,
radii, shadow and Dynamic Island keep working:

```html
<div class="screen is-on" data-screen="home">
  <img src="assets/screens/13-home.png" alt="" style="width:100%;height:100%;object-fit:cover" />
</div>
```

Capture them with the flow in the app repo:

```bash
cd ../momo && scripts/screens/run.sh --no-rc   # writes docs/screens/captures/
```

`assets/screens/onboarding-raw.png` is one such capture, kept for reference.

## Assets

Everything under `assets/` is derived from the app repo (`momo/assets/`) and
re-encoded for the web — the hero sprite sheet goes from 4.3 MB PNG to 203 KB
WebP. To regenerate after new art lands, resize with `sips` and encode with
`cwebp`; sprite sheets must be scaled by an exact integer divisor so frame
boundaries stay on whole pixels.
