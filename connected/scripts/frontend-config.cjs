const path = require('node:path');
function option(name, fallback) {
  return process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}
const base = option('base', '/');
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base)) throw Error('Use a base such as / or /MYTED/.');
module.exports = { root: path.resolve(__dirname, '..'), base, option };
