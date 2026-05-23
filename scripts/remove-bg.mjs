// Remove black background from icon PNGs by making near-black pixels transparent
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

const files = process.argv.slice(2);
if (!files.length) {
  console.log("Usage: node scripts/remove-bg.mjs rocket.png [other.png ...]");
  process.exit(1);
}

const THRESHOLD = 40; // pixels with R,G,B all below this are made transparent

for (const file of files) {
  const filePath = join(iconsDir, file);
  console.log(`Processing ${file}...`);

  const image = sharp(filePath);
  const { width, height, channels } = await image.metadata();

  // Ensure we have RGBA
  const raw = await image.ensureAlpha().raw().toBuffer();
  const pixels = Buffer.from(raw);

  let removed = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (r < THRESHOLD && g < THRESHOLD && b < THRESHOLD) {
      pixels[i + 3] = 0; // set alpha to 0
      removed++;
    }
  }

  const total = width * height;
  console.log(`  Removed ${removed}/${total} pixels (${((removed / total) * 100).toFixed(1)}%)`);

  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(filePath);

  console.log(`  Saved ${filePath}`);
}

console.log("Done!");
