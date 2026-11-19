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

// Game Dev (production plan, tasks, experience, 200 MB files): firestore.rules ownerGameDev() / hasGameDev() and storage.rules ownerGameDev()
// repeat the plans whose budget opens allowGameDev (audit 2026-11-19: three hard-coded copies without a test)
const wantDev = P.PLAN_ORDER.concat(['worldforge']).filter((p) => P.planBudget(p).allowGameDev).sort();
const fsr = read('firestore.rules');
const fsOwnerDev = list(fsr, /function ownerGameDev\(worldId\) \{[^}]*?\.get\('plan', 'free'\) in \[([^\]]*)\]/);
const fsHasDev = list(fsr, /function hasGameDev\(\) \{[^}]*?\.get\('plan', 'free'\) in \[([^\]]*)\]/);
const stOwnerDev = list(read('storage.rules'), /function ownerGameDev\(worldId\) \{\s*return ownerPlan\(worldId\) in \[([^\]]*)\]/);
check(wantDev.length > 0 && !wantDev.includes('free'), `the registry opens Game Dev on paid plans only (${wantDev})`);
check(JSON.stringify(fsOwnerDev) === JSON.stringify(wantDev), `firestore.rules ownerGameDev() = registry allowGameDev (${fsOwnerDev} / ${wantDev})`);
check(JSON.stringify(fsHasDev) === JSON.stringify(wantDev), `firestore.rules hasGameDev() = registry allowGameDev (${fsHasDev} / ${wantDev})`);
check(JSON.stringify(stOwnerDev) === JSON.stringify(wantDev), `storage.rules ownerGameDev() = registry allowGameDev (${stOwnerDev} / ${wantDev})`);

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
