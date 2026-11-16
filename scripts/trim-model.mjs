// Trim a Momo GLB to the clips the site plays, drop the props no kept clip uses, and compress it.
//   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer
//     (in a scratch dir; the site itself has no npm), then from there:
//   node /path/to/momo-site/scripts/trim-model.mjs ../momo/assets/characters/ghost/ghost.glb assets/models/ghost.glb Idle,IdleBlink,…
// The clip lists the site uses are in README.md.
//
// POSITION and the morph targets stay float. Quantizing them (gltf-transform `meshopt`, gltfpack)
// breaks the Collapse morphs on the GPU in three.js: the collapsed body lands off its ring. Only
// normals, UVs and skin weights are quantized; meshopt compression does the rest.
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization, ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, quantize, reorder } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const [src, out, keepCsv] = process.argv.slice(2);
const keep = new Set(keepCsv.split(','));
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});
const doc = await io.read(src);
const root = doc.getRoot();
for (const a of root.listAnimations()) if (!keep.has(a.getName())) a.dispose();
const missing = [...keep].filter((k) => !root.listAnimations().some((a) => a.getName() === k));
if (missing.length) throw new Error('missing clips ' + missing);
// Nodes a kept clip animates
const animated = new Set();
for (const a of root.listAnimations()) for (const c of a.listChannels()) animated.add(c.getTargetNode()?.getName());
for (const n of root.listNodes()) {
  if (n.getName().startsWith('Prop')) {
    if (animated.has(n.getName())) console.log('keeping animated prop', n.getName());
    else {
      console.log('drop', n.getName());
      n.dispose();
    }
  }
}
await doc.transform(
  resample(),
  prune(),
  dedup(),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ pattern: /^(NORMAL|TANGENT|TEXCOORD_\d+|JOINTS_\d+|WEIGHTS_\d+)$/, patternTargets: /^$/ }),
);
doc.createExtension(KHRMeshQuantization).setRequired(true);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(out, doc);
