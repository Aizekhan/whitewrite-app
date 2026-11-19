// The daily GitHub backup (functions/src/backup.js dueOrder): a failing backup never starves the healthy ones — it waits
// 6 h × 2^(errors − 1) (at most a day) after its last failure, and the due worlds run healthy first, then the longest without a backup.
// Run: npm test
const path = require('path');
const F = (p) => require.resolve(path.join(__dirname, '../functions', p));
require.cache[F('src/common.js')] = { loaded: true, exports: { onRequest: (o, h) => h, admin: { firestore: { FieldValue: {} } }, db: {}, cors: () => {} } };
['src/ledger.js', 'src/github-token.js', 'src/snapshot.js'].forEach((f) => { require.cache[F(f)] = { loaded: true, exports: {} }; });
const { dueOrder } = require(F('src/backup.js'))._backup;

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const H = 3600 * 1000, NOW = Date.UTC(2026, 10, 19, 12), at = (h) => ({ toMillis: () => NOW - h * H });
const W = (id, backup) => ({ id, data: () => ({ backup }) });
const docs = [
  W('err1', { errors: 1, lastErrorAt: at(7), lastAt: at(100) }),   // 1 failure 7 h ago → due again (waits 6 h), but after the healthy ones
  W('err1new', { errors: 1, lastErrorAt: at(2), lastAt: at(100) }), // 1 failure 2 h ago → waits
  W('err3', { errors: 3, lastErrorAt: at(20), lastAt: at(200) }),   // 3 failures → waits 24 h
  W('ok-old', { lastAt: at(50) }), W('ok', { lastAt: at(21) }), W('fresh', { lastAt: at(5) }), W('never', {}),
];
check(dueOrder(docs, NOW).map((d) => d.id).join(), 'never,ok-old,ok,err1', 'healthy first (the longest without a backup first), a failing one after them, backed-off and fresh ones skipped');
check(dueOrder([W('err3', { errors: 3, lastErrorAt: at(25) })], NOW).length, 1, 'after a day even a long-failing backup is tried again');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
