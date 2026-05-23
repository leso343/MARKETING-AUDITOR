/**
 * Generate PWA icons (192x192 and 512x512) from the brand mark.
 * Run: npx tsx scripts/generate-pwa-icons.ts
 */
import fs from "node:fs";
import path from "node:path";

// The brand SVG — page + magnifying glass
const SVG = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#030303"/>
  <g transform="translate(96, 48) scale(5)">
    <rect x="10" y="4" width="32" height="42" rx="3" fill="#1e293b" stroke="#475569" stroke-width="2"/>
    <path d="M32 4 L42 4 L42 14 Z" fill="#334155" stroke="#475569" stroke-width="1"/>
    <rect x="16" y="18" width="20" height="2" rx="1" fill="#475569"/>
    <rect x="16" y="24" width="15" height="2" rx="1" fill="#475569"/>
    <rect x="16" y="30" width="18" height="2" rx="1" fill="#475569"/>
    <rect x="16" y="36" width="12" height="2" rx="1" fill="#475569"/>
    <circle cx="44" cy="44" r="11" fill="none" stroke="#ef4444" stroke-width="3"/>
    <circle cx="44" cy="44" r="9" fill="#ef444415"/>
    <line x1="52" y1="52" x2="60" y2="60" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M38 44 L42 48 L50 40" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </g>
</svg>`;

async function generate() {
  // Try to use sharp if available, otherwise write SVGs
  try {
    const sharp = await import("sharp");

    const svg512 = Buffer.from(SVG);
    await sharp.default(svg512).resize(512, 512).png().toFile(path.join(process.cwd(), "public", "icon-512.png"));
    await sharp.default(svg512).resize(192, 192).png().toFile(path.join(process.cwd(), "public", "icon-192.png"));
    console.log("✓ Generated public/icon-192.png and public/icon-512.png");
  } catch {
    // sharp not available — write SVG files instead
    fs.writeFileSync(path.join(process.cwd(), "public", "icon-512.svg"), SVG);
    console.log("⚠ sharp not available — wrote SVG instead. Install sharp for PNG generation.");
  }
}

generate();
