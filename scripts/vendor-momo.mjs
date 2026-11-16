// Regenerates js/vendor-momo/*.js from the app's plain three.js TS (Node 24+: stripTypeScriptTypes).
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
// Run from anywhere: node scripts/vendor-momo.mjs (expects the app repo next to this one, at ../momo).
const SRC = new URL('../../momo/src/components/character/', import.meta.url).pathname;
const OUT = new URL('../js/vendor-momo/', import.meta.url).pathname;
for (const n of ['momo-ring', 'momo-effects', 'momo-dome', 'momo-coins']) {
  const js = stripTypeScriptTypes(readFileSync(SRC + n + '.ts', 'utf8'))
    .replace(/from '(\.\/[^']+?)'/g, (m, p) => (p.endsWith('.js') ? m : `from '${p}.js'`));
  writeFileSync(OUT + n + '.js', `// GENERATED COPY of momo/src/components/character/${n}.ts — do not edit here.\n// Types stripped with node:module stripTypeScriptTypes; relative imports given a .js extension.\n// Regenerate from the app instead (see README "3D buddies").\n` + js);
}
