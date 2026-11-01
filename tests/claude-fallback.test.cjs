// Call-time fallback (functions/src/claude.js withFallback). Run: npm test
const F = require('path').join(__dirname, '../functions/');
const store = { 'config/ai_models': { active: { opus: 'claude-opus-6' },
  snapshot: { 'claude-opus-6': { created: 3 }, 'claude-opus-5-5': { created: 2 }, 'claude-sonnet-5-5': { created: 2 } } } };
const notices = [];
const docRef = (p) => ({ get: async () => ({ exists: !!store[p], data: () => store[p] }),
  set: async (d, o) => { const cur = store[p] || {}; store[p] = o && o.merge ? Object.assign({}, cur, d, d.broken ? { broken: Object.assign({}, cur.broken, d.broken) } : {}) : d; } });
const db = { collection: (c) => ({ doc: (id) => docRef(c + '/' + id), add: async (d) => { notices.push(d); return { id: 'n' + notices.length }; } }) };
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } }, storage: () => ({ bucket: () => ({ file: () => ({ save: async () => {} }) }) }) };
require.cache[require.resolve(F + 'src/common.js')] = { exports: { admin, db } };
const C = require(F + 'src/claude.js');
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const gone = new Set();
const call = async (m) => { if (gone.has(m)) { const e = new Error('404 {"type":"error","error":{"type":"not_found_error","message":"model: ' + m + '"}}'); e.status = 404; throw e; } return { model: m }; };

(async () => {
  check((await C.withFallback('claude-opus-6', call)).model === 'claude-opus-6' && !notices.length, 'a live model → no fallback');
  gone.add('claude-opus-6');
  const r1 = await C.withFallback('claude-opus-6', call);
  check(r1.model === 'claude-opus-5-5' && store['config/ai_models'].broken['claude-opus-6'].to === 'claude-opus-5-5' && store['config/ai_models'].mode === 'daily'
    && notices.length === 1 && notices[0].severity === 'critical', 'Opus 6 vanished → same tier (Opus 5.5), remembered, watch to daily, critical notice');
  check((await C.activeModels(db)).opus === 'claude-opus-5-5', 'later calls go straight to the replacement');
  gone.add('claude-opus-5-5');
  const r2 = await C.withFallback('claude-opus-5-5', call);
  check(r2.model === 'claude-sonnet-5-5', 'no Opus left → one tier down (Sonnet), not up');
  gone.add('claude-haiku-5-5');
  let threw = false; try { await C.withFallback('claude-haiku-5-5', call); } catch (e) { threw = C.isGone(e); }
  check(threw, 'Haiku has no lower tier and never goes up → the error stays');
  let other = false; try { await C.withFallback('claude-sonnet-5-5', async () => { const e = new Error('529 overloaded'); e.status = 529; throw e; }); } catch (e) { other = e.status === 529; }
  check(other && notices.length === 2, 'other errors (overload) are not treated as a vanished model');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
