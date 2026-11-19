// Paid AI calls stay paid on error (audit 2026-11-19): an error thrown AFTER the Claude call reached the API carries its usage
// (error.paid → token-service settle charges it, never a full refund); long runs end on their own deadline before the platform
// kills them; the reserve of an uncapped run rises toward its worst case. Source-level guards — the billing logic itself is
// exercised in tests/billing.test.cjs. Run: npm test
const fs = require('fs'), path = require('path');
const src = (f) => fs.readFileSync(path.join(__dirname, '../functions', f), 'utf8');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const style = src('src/style.js'), scenes = src('src/scenes.js'), genesis = src('src/genesis.js'), advise = src('src/canon-sync.js'), gd = src('src/gamedev.js'), wf = src('src/world-folder.js');
check(!/finally\s*\{[^}]*\berror\b/.test(style), 'style.js: no settle(…, error) in a finally (error is undefined there — nothing was settled)');
check((style.match(/paid = \{ model: msg\.model, usage: msg\.usage \}/g) || []).length === 2 && (style.match(/if \(paid && !error\.paid\) error\.paid = paid/g) || []).length === 2,
  'style.js: styleCheck and styleFromRefs charge a bad answer (no score / no style / not JSON)');
check(/const paid = \{ paid: \{ model: out\.model, usage: out\.usage \} \}/.test(scenes) && (scenes.match(/, paid\)/g) || []).length >= 2, 'scenes.js: a cut / too short reconstruction is charged');
check(/lastError && lastError\.paid/.test(scenes), 'scenes.js: a refused or empty scene keeps its paid usage');
check(/if \(paid && !error\.paid\) error\.paid = paid/.test(genesis), 'genesis.js: a world that is not JSON / has no seed is charged');
check(/beforeTimeout\(claudeText/.test(genesis) && /GENESIS_TIMEOUT_S = 900/.test(genesis), 'genesis.js: 900 s and an own deadline (24k tokens did not fit 300 s)');
check(/beforeTimeout\(claudeText/.test(advise) && /ADVISE_TIMEOUT_S = 300/.test(advise), 'canon-sync.js «✦ Порадити»: 300 s and an own deadline');
check(/await beforeTimeout\(\(async \(\) => \{/.test(gd) && /GAMEDEV_TIMEOUT_S = 3600/.test(gd) && /notePaid\(db, uid, reservation/.test(gd), 'gamedev.js: 3600 s, an own deadline, every call noted on the hold');
check(/reserve\(db, uid, reserveCost, \{ hold: true, cap, upTo \}\)/.test(gd), 'gamedev.js: the reserve keeps the cap and rises toward the worst case');
check(/settle\(db, uid, reservation, error, 'world_folder', \{ cap \}\)/.test(wf) && /hold: true, cap \}/.test(wf), 'world-folder.js: a failure is never charged above «не більше N»');
const ts = src('token-service.js');
check(require('../functions/token-service.js').HOLD_MS > 3600 * 1000, 'HOLD_MS is longer than the longest function timeout (3600 s)');
check(!/throw new Error\(`economy_operations/.test(ts), 'charge() never throws on a missing economy entry after a paid call');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
