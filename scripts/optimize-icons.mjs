/**
 * Resize + optimize all icon PNGs.
 * 2048×2048 → 512×512 (3× retina for 160px display) with PNG compression.
 */
import sharp from "sharp";
import { readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "public", "icons");

const TARGET = 512;

const files = readdirSync(iconsDir).filter((f) => f.endsWith(".png"));

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const filePath = join(iconsDir, file);
  const before = statSync(filePath).size;
  totalBefore += before;

  const { width, height } = await sharp(filePath).metadata();
  console.log(`${file}: ${width}×${height} (${(before / 1024).toFixed(0)} KB)`);

  await sharp(filePath)
    .resize(TARGET, TARGET, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(filePath + ".tmp");

  // Replace original with optimized
  const { default: fs } = await import("fs");
  fs.unlinkSync(filePath);
  fs.renameSync(filePath + ".tmp", filePath);

  const after = statSync(filePath).size;
  totalAfter += after;
  console.log(`  → ${TARGET}×${TARGET} (${(after / 1024).toFixed(0)} KB) — saved ${((1 - after / before) * 100).toFixed(0)}%`);
}

console.log(`\nTotal: ${(totalBefore / 1024 / 1024).toFixed(1)} MB → ${(totalAfter / 1024 / 1024).toFixed(1)} MB (${((1 - totalAfter / totalBefore) * 100).toFixed(0)}% smaller)`);
