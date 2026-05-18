/**
 * Logo background removal + copy to public/
 *
 * S&A  — flood-fill from edges removes ONLY the outer white ring;
 *         the grey "S&A" watermark letters inside are preserved.
 * TCR  — flood-fill removes the solid white rectangle background
 *         from the flat version (clean crisp result).
 */
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

mkdirSync(join(root, 'public/logos'), { recursive: true });
mkdirSync(join(root, 'public/csvs/take-charge-roofing'), { recursive: true });

/** BFS flood-fill from all 4 image edges, making near-white pixels transparent. */
function floodFillEdges(data, width, height, channels, threshold = 240) {
  const visited = new Uint8Array(width * height);

  const isLight = (idx) => {
    const r = data[idx * channels], g = data[idx * channels + 1], b = data[idx * channels + 2];
    return r >= threshold && g >= threshold && b >= threshold;
  };

  const queue = [];
  const seed = (x, y) => {
    const idx = y * width + x;
    if (!visited[idx] && isLight(idx)) { visited[idx] = 1; queue.push(idx); }
  };

  for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
  for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

  while (queue.length) {
    const idx = queue.pop();
    // Soft-fade at the anti-aliased edge for smooth blending
    const r = data[idx * channels], g = data[idx * channels + 1], b = data[idx * channels + 2];
    const brightness = Math.min(r, g, b);
    const fade = Math.max(0, (brightness - (threshold - 20)) / 20);
    data[idx * channels + 3] = Math.round(data[idx * channels + 3] * (1 - fade));

    const x = idx % width, y = Math.floor(idx / width);
    for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nidx = ny * width + nx;
        if (!visited[nidx] && isLight(nidx)) { visited[nidx] = 1; queue.push(nidx); }
      }
    }
  }
}

async function removeBg(inputPath, outputPath, threshold = 240) {
  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  floodFillEdges(data, info.width, info.height, info.channels, threshold);

  await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png({ compressionLevel: 8 })
    .toFile(outputPath);
}

// ── S&A Marketing: edge-flood only (threshold 245 = near-pure-white)
// Grey "S&A" watermark letters (~160-200 brightness) are NOT removed.
await removeBg(
  'C:/Users/Lester/blank-pages/sa-marketing-logo.png',
  join(root, 'public/logos/agency.png'),
  245
);
console.log('✓ S&A Marketing logo saved');

// ── Take Charge Roofing: flat version, solid white bg → flood-fill
await removeBg(
  'C:/Users/Lester/.gemini/antigravity/scratch/report_assets/take_charge_logo_clean.png',
  join(root, 'public/csvs/take-charge-roofing/logo.png'),
  238
);
console.log('✓ Take Charge Roofing logo saved');
console.log('\nDone.');
