// Every browser script parses, and no stray control character hides in it (a broken i18n.js shows raw keys on every page). Run: npm test
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const app = path.join(__dirname, '..', 'app');
const files = fs.readdirSync(app).filter((f) => /\.js$/.test(f)).map((f) => path.join(app, f))
  .concat(fs.readdirSync(path.join(app, 'firebase')).filter((f) => /\.js$/.test(f)).map((f) => path.join(app, 'firebase', f)));
files.forEach((f) => {
  const name = path.relative(app, f).replace(/\\/g, '/');
  if (/\.mjs$|gb-3d\.js$|cosmograph/.test(name)) return; // ES modules are checked by the build
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  check(r.status === 0, name + ' parses' + (r.status ? ': ' + (r.stderr || '').split('\n').slice(0, 4).join(' ') : ''));
  check(!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(fs.readFileSync(f, 'utf8')), name + ' has no control characters');
});
// a second function declaration with the same name in the Bible's one big scope silently replaces the first (v2.146.1: a design-panel
// cardChip(id) took the place of the plan's cardChip(ref) — the ladder matrix showed raw ids)
const dupes = (fs.readFileSync(path.join(app, 'gamebible.js'), 'utf8').match(/^  function [A-Za-z0-9_$]+/gm) || []).map((x) => x.trim()).filter((x, i, a) => a.indexOf(x) !== i);
check(!dupes.length, 'gamebible.js declares each top-level function once' + (dupes.length ? ': ' + dupes.join(', ') : ''));
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
