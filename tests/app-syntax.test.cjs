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
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
