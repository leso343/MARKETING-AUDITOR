/**
 * Removes white/near-white backgrounds from logos and copies them
 * into the correct public/ locations for the dashboard.
 */
import { createRequire } from 'module';
import { copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

mkdirSync(join(root, 'public/logos'), { recursive: true });
mkdirSync(join(root, 'public/csvs/take-charge-roofing'), { recursive: true });

// ── S&A Marketing logo: remove white background ──────────────────────────────
const snaIn  = 'C:/Users/Lester/blank-pages/sa-marketing-logo.png';
const snaOut = join(root, 'public/logos/agency.png');

await sharp(snaIn)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
    const { width, height, channels } = info;
    const visited = new Uint8Array(width * height);

    // BFS flood-fill from all 4 edges — removes connected background
    const isBackground = (idx) => {
      const r = data[idx * channels];
      const g = data[idx * channels + 1];
      const b = data[idx * channels + 2];
      return r > 180 && g > 180 && b > 180; // catches white + light grey
    };

    const queue = [];
    const seed = (x, y) => {
      const idx = y * width + x;
      if (!visited[idx] && isBackground(idx)) { visited[idx] = 1; queue.push(idx); }
    };
    for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
    for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }

    while (queue.length) {
      const idx = queue.pop();
      data[idx * channels + 3] = 0;
      const x = idx % width, y = Math.floor(idx / width);
      for (const [nx, ny] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nidx = ny * width + nx;
          if (!visited[nidx] && isBackground(nidx)) { visited[nidx] = 1; queue.push(nidx); }
        }
      }
    }

    // Second pass: remove any remaining grey/white pixels (the interior "S&A" watermark)
    // Targets pixels with high brightness AND low colour saturation (grey tones)
    for (let i = 0; i < width * height; i++) {
      const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2];
      const brightness = Math.max(r, g, b);
      const saturation = brightness - Math.min(r, g, b);
      if (brightness > 160 && saturation < 60) {
        // Smooth fade at the threshold to avoid hard edges
        const fade = Math.min(1, (brightness - 160) / 60);
        data[i * channels + 3] = Math.round(data[i * channels + 3] * (1 - fade));
      }
    }

    return sharp(data, { raw: { width, height, channels } }).png().toFile(snaOut);
  });

console.log('✓ S&A Marketing logo  →', snaOut.replace(root, ''));

// ── Take Charge Roofing logo: already transparent, just copy ────────────────
const tcrIn  = 'C:/Users/Lester/Downloads/report_assets/take_charge_logo.png';
const tcrOut = join(root, 'public/csvs/take-charge-roofing/logo.png');

// Re-export via sharp to normalise the file (strip metadata, optimise)
await sharp(tcrIn).png({ compressionLevel: 8 }).toFile(tcrOut);
console.log('✓ Take Charge Roofing →', tcrOut.replace(root, ''));

console.log('\nDone. Both logos are ready.');
