const fs = require('node:fs');
const path = require('node:path');
const { root, base } = require('./frontend-config.cjs');
const output = path.join(root, 'dist');
const failures = [];
let checked = 0;
function reference(value, relative) {
  if (!value || value.startsWith('#') || /^(data:|blob:|https?:|mailto:|tel:)/.test(value)) return;
  const origin = 'https://frontend.example';
  const url = new URL(value, origin + base + relative);
  if (!url.pathname.startsWith(base)) { failures.push(`${relative}: leaves deployment base: ${value}`); return; }
  let file = decodeURIComponent(url.pathname.slice(base.length));
  if (!file || file.endsWith('/')) file += 'index.html';
  const target = path.resolve(output, file);
  if (!target.startsWith(output + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) failures.push(`${relative}: missing ${value}`);
  checked++;
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    const relative = path.relative(output, file).split(path.sep).join('/');
    if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(file, 'utf8');
      for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) reference(match[1], relative);
      if (html.includes('/src/main.tsx')) failures.push(`${relative}: uncompiled React entry`);
    }
    if (entry.name.endsWith('.css')) {
      const css = fs.readFileSync(file, 'utf8');
      for (const match of css.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/g)) reference(match[1], relative);
    }
  }
}
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'frontend-build.json'), 'utf8'));
if (manifest.base !== base) failures.push(`Build base is ${manifest.base}, expected ${base}`);
walk(output);
for (const file of ['index.html', 'story/index.html', 'story/app.js', 'story/journey.css', 'music/player.js', 'music/player.css', 'music/a-little-beginning.mp3', 'music/credits.html', '.nojekyll']) {
  if (!fs.existsSync(path.join(output, file))) failures.push(`Missing ${file}`);
}
for (const file of ['private', 'server.py', 'owner-access.txt', 'teddy.sqlite3']) {
  if (fs.existsSync(path.join(output, file))) failures.push(`Private/server file included: ${file}`);
}
if (failures.length) throw Error(failures.join('\n'));
console.log(`Frontend check passed: ${checked} linked assets/routes under ${base}; compiled entry; private/server files absent.`);
