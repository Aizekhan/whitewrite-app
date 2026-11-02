// AI cost watch (functions/src/cost-watch.js): daily API dollars per user + the two alarms. A fake Firestore, no network.
// Run: npm test
const path = require('path');
const src = path.join(__dirname, '../functions/src');
const logs = [
  { uid: 'a', operation: 'generateScene', realApiCostUSD: 4, userPaidUSD: 6, userTokensCharged: 400 },
  { uid: 'a', operation: 'plan', realApiCostUSD: 3, userPaidUSD: 4.5, userTokensCharged: 300 },
  { uid: 'b', operation: 'styleCheck', realApiCostUSD: 0.5, userPaidUSD: 0.2, userTokensCharged: 20 },
  { uid: 'c', operation: 'generateScene', realApiCostUSD: 0.01, userPaidUSD: 0.02, userTokensCharged: 2 },
];
const written = {}, notices = [];
const doc = (col, id) => ({
  get: async () => ({ exists: col === 'users', get: (k) => ({ plan: id === 'a' ? 'worldbuilder' : 'free', email: id + '@x' })[k] }),
  set: async (d) => { written[col + '/' + id] = d; },
});
const db = { collection: (col) => ({ doc: (id) => doc(col, id),
  where: () => ({ get: async () => ({ size: logs.length, docs: logs.map((l) => ({ data: () => l })) }) }) }) };
const admin = { firestore: { Timestamp: { fromMillis: (x) => x }, FieldValue: { serverTimestamp: () => 'now' } } };
require.cache[require.resolve(path.join(src, 'common.js'))] = { exports: { admin, db } };
require.cache[require.resolve(path.join(src, 'admin-notice.js'))] = { exports: { notify: async (n) => notices.push(n) } };
require.cache[require.resolve('firebase-functions/v2/scheduler', { paths: [src] })] = { exports: { onSchedule: () => () => {} } };
const { summarize, COST_ALERT_USD } = require(path.join(src, 'cost-watch.js'))._costWatch;

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
(async () => {
  const r = await summarize(Date.UTC(2026, 10, 2, 12));
  const d = written['admin_costs/2026-11-02'];
  check(!!d, 'the day is written to admin_costs/{YYYY-MM-DD}');
  check(d && d.totalUsd === 7.51 && d.calls === 4 && d.users === 3, 'totals: $7.51 API, 4 calls, 3 users');
  check(d && d.top[0].uid === 'a' && d.top[0].usd === 7 && d.top[0].ops.plan === 1 && d.top[0].plan === 'worldbuilder', 'the costliest user first, with plan and ops');
  check(r.hot === 1 && notices.some((n) => /понад \$5/.test(n.title) && /a@x/.test(n.body) && n.severity === 'warning'), `one user above $${COST_ALERT_USD} → a warning`);
  check(r.loss === 1 && notices.some((n) => n.severity === 'critical' && /нижче вартості/.test(n.title) && /b@x/.test(n.body) && !/c@x/.test(n.body)), 'paid below the API cost → critical (cents ignored)');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})();
