const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { root, base, option } = require('./frontend-config.cjs');
const output = path.join(root, 'dist');
const port = Number(option('port', '5195'));
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'frontend-build.json'), 'utf8'));
if (manifest.base !== base) throw Error(`This build uses ${manifest.base}; preview with the matching --base.`);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.mp3': 'audio/mpeg' };
http.createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400).end(); return; }
  if (!pathname.startsWith(base)) { response.writeHead(404).end(); return; }
  let relative = pathname.slice(base.length);
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const target = path.resolve(output, relative);
  const within = path.relative(output, target);
  if (within.startsWith('..') || path.isAbsolute(within) || relative.split('/').some(part => part.startsWith('.') && part !== '.nojekyll')) {
    response.writeHead(404).end(); return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return; }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404).end(); return; }
  const size = fs.statSync(target).size;
  const headers = { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes', 'Content-Length': size };
  let start = 0, end = size - 1;
  if (request.headers.range) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (range && (range[1] || range[2])) {
      start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    } else start = size;
    if (start >= size || end < start) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }).end(); return; }
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    headers['Content-Length'] = end - start + 1;
  }
  response.writeHead(request.headers.range ? 206 : 200, headers);
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(target, { start, end }).pipe(response);
}).listen(port, '127.0.0.1', () => console.log(`Frontend-only preview: http://127.0.0.1:${port}${base}`));
