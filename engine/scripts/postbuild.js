// Copy the HTML template alongside the compiled generator so the runtime can find it.
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', 'report', 'template.html');
const destDir = path.resolve(__dirname, '..', '..', 'dist', 'engine', 'report');
fs.mkdirSync(destDir, { recursive: true });
const dest = path.join(destDir, 'template.html');
fs.copyFileSync(src, dest);
console.log(`[postbuild] copied template -> ${path.relative(process.cwd(), dest)}`);
