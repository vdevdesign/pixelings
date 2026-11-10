// One-off: convert approved GIFs to animated WebP (much smaller), then
// delete the originals and update manifest.json. GIFs stay in git history.
import sharp from 'sharp';
import { readdirSync, readFileSync, writeFileSync, unlinkSync, statSync, existsSync } from 'fs';
import { join } from 'path';

// Resumable: skips GIFs that already have a .webp sibling (from a previous run).
async function rmRetry(p, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try { unlinkSync(p); return; } catch (e) {
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

const dir = 'src/assets/approved-gifs';
const manifestPath = join(dir, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));

const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.gif'));
let savedBytes = 0;

for (const file of files) {
  const src = join(dir, file);
  const outName = file.replace(/\.gif$/i, '.webp');
  const out = join(dir, outName);
  if (existsSync(out)) continue; // already converted previously
  const before = statSync(src).size;

  await sharp(src, { animated: true })
    .webp({ effort: 5, quality: 70 })
    .toFile(out);

  const after = statSync(out).size;
  savedBytes += before - after;
  await rmRetry(src);
  console.log(`${file} -> ${outName}  ${(before / 1e6).toFixed(2)} MB -> ${(after / 1e6).toFixed(2)} MB`);
}

// manifest references .gif filenames; swap extension to .webp
const newManifest = manifest.map((name) => name.replace(/\.gif$/i, '.webp'));
writeFileSync(manifestPath, JSON.stringify(newManifest, null, 2) + '\n');

console.log(`\nDone. ${files.length} GIFs converted, saved ${(savedBytes / 1e6).toFixed(1)} MB.`);
