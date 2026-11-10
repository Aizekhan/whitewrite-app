// Canon editing on the owner's plan (v2.118.0): firestore.rules canonPlans() and storage.rules ownerCanon() repeat the plans
// whose registry budget opens allowWorldTree (functions/paid-features.js, feature 'bible') — rules can't read JS, so this test
// keeps the two copies equal to the registry. Run: npm test
const fs = require('fs'), path = require('path');
const P = require(path.join(__dirname, '../functions/paid-features.js'));
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const want = P.PLAN_ORDER.concat(['worldforge']).filter((p) => P.planBudget(p).allowWorldTree).sort();
const list = (src, re) => { const m = src.match(re); return m ? m[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean).sort() : null; };
const fsPlans = list(read('firestore.rules'), /function canonPlans\(\) \{\s*return \[([^\]]*)\]/);
const stPlans = list(read('storage.rules'), /function ownerCanon\(worldId\) \{\s*return ownerPlan\(worldId\) in \[([^\]]*)\]/);
check(P.FEATURES.some((f) => f.id === 'bible' && f.flag === 'allowWorldTree'), "the registry has the canon-editing gate 'bible' (allowWorldTree)");
check(JSON.stringify(fsPlans) === JSON.stringify(want), `firestore.rules canonPlans() = registry (${fsPlans} / ${want})`);
check(JSON.stringify(stPlans) === JSON.stringify(want), `storage.rules ownerCanon() = registry (${stPlans} / ${want})`);
check(!P.planBudget('free').allowWorldTree, 'Free does not edit the canon (owner decision v2.50)');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
