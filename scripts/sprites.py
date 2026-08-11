#!/usr/bin/env python3
"""Rebuild the site's ghost spritesheets from the app's source art.

    python3 scripts/sprites.py [path-to-momo-app]

Each character in the app ships `idle.png` (a flat thumbnail) and `idle_sprite.png`
(a 6x6, 36-frame idle loop). The site animates the sheet in CSS, so it needs the
sheet — downscaled, because the app's frames are far larger than anything the page
draws, and re-encoded to WebP inside a weight budget.

`scale` is the fraction of the app frame kept. The default ghost is drawn big in the
hero dial (--gs .92) so it keeps half scale; the shop ghosts never exceed --gs .52,
so a smaller frame is still ~2x on a retina screen. `q`/`aq` are tuned per sheet —
ember's fire and shadow's glow are high-entropy and cost far more at equal quality.

After running this, update --fw/--fh in styles.css to the frame sizes printed below.
"""

import os
import sys
from pathlib import Path

from PIL import Image

# (app id, site filename, app frame w, app frame h, scale, quality, alpha quality)
SPEC = [
    ('ghost', 'ghost.webp', 510, 498, 0.50, 82, 90),
    ('ghost_mint', 'ghost-mint.webp', 472, 548, 0.46, 80, 85),
    ('ghost_ember', 'ghost-ember.webp', 426, 574, 0.42, 70, 70),
    ('ghost_shadow', 'ghost-shadow.webp', 516, 510, 0.44, 76, 80),
]
COLS = ROWS = 6  # every app sheet is a 6x6 grid of 36 frames
BUDGET_KB = 300  # per sheet; four of these load on one page

app = Path(sys.argv[1] if len(sys.argv) > 1 else
           '/Users/yvansabay/Documents/Projects/Personal-Projects/momo')
src_dir = app / 'assets/characters'
out_dir = Path(__file__).resolve().parent.parent / 'assets/sprites'

for cid, out, fw, fh, scale, q, aq in SPEC:
    src = src_dir / cid / 'idle_sprite.png'
    im = Image.open(src).convert('RGBA')
    if im.size != (fw * COLS, fh * ROWS):
        raise SystemExit(f'{cid}: sheet is {im.size}, expected {(fw * COLS, fh * ROWS)} — '
                         f'frame size changed, update SPEC (and styles.css)')
    frame = (int(fw * scale), int(fh * scale))
    im = im.resize((frame[0] * COLS, frame[1] * ROWS), Image.LANCZOS)
    im.save(out_dir / out, 'WEBP', quality=q, method=6, alpha_quality=aq)
    kb = os.path.getsize(out_dir / out) / 1024
    flag = '' if kb <= BUDGET_KB else f'  ⚠ over {BUDGET_KB}KB budget'
    print(f'{out:20} --fw: {frame[0]}px  --fh: {frame[1]}px   {kb:5.0f} KB{flag}')
