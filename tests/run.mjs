// Runs every tests/*.test.* file; exit 1 if any fails. `npm test` (all) · `npm run test:rules` (only the Firestore rules).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => /\.test\.(c|m)?js$/.test(f)).sort();
const failed = [];
for (const f of files) {
  console.log('\n== ' + f);
  const r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  process.stdout.write((r.stdout || '').split('\n').filter((l) => /^(PASS|FAIL|ALL PASSED|\d+ FAILED)/.test(l)).join('\n') + '\n');
  if (r.status !== 0) failed.push(f);
}
console.log(failed.length ? '\nFAILED: ' + failed.join(', ') : '\nALL TEST FILES PASSED (' + files.length + ')');
process.exit(failed.length ? 1 : 0);
