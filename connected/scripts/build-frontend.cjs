const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { root, base } = require('./frontend-config.cjs');
const output = path.join(root, 'dist');
// Only the generated dist directory belonging to this project may be replaced.
if (path.relative(root, output) !== 'dist') throw Error('Invalid build output.');
if (process.platform === 'win32') {
  execFileSync('cmd.exe', ['/d', '/s', '/c', `npm --prefix intro run build -- --base ${base}`], { cwd: root, stdio: 'inherit' });
} else {
  execFileSync('npm', ['--prefix', 'intro', 'run', 'build', '--', '--base', base], { cwd: root, stdio: 'inherit' });
}
fs.rmSync(output, { recursive: true, force: true });
fs.cpSync(path.join(root, 'intro', 'dist'), output, { recursive: true });
fs.cpSync(path.join(root, 'web', 'story'), path.join(output, 'story'), { recursive: true });
fs.writeFileSync(path.join(output, '.nojekyll'), '');
fs.writeFileSync(path.join(output, 'frontend-build.json'), JSON.stringify({ base, entry: 'index.html', story: 'story/index.html' }) + '\n');
if (fs.existsSync(path.join(output, 'private')) || fs.existsSync(path.join(output, 'server.py'))) throw Error('Server content must not enter the frontend build.');
console.log(`Complete public frontend: ${output} (base ${base}). Backend and private owner templates excluded.`);
