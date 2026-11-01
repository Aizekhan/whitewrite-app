// MCP Project Knowledge + development activity log (functions/src/mcp.js) against an in-memory Firestore.
// Run: npm test
const path = require('path');
const store = new Map(); // path → data
const DEL = { __del: 1 }, TS = { __ts: 1 };
const inc = (n) => ({ __inc: n });
function merge(a, b) {
  const o = Object.assign({}, a);
  Object.entries(b).forEach(([k, v]) => {
    if (k.includes('.')) { const [h, t] = k.split('.'); o[h] = merge(o[h] || {}, { [t]: v }); return; }
    if (v === DEL) delete o[k];
    else if (v && v.__inc !== undefined) o[k] = (o[k] || 0) + v.__inc;
    else if (v && typeof v === 'object' && !Array.isArray(v) && v !== TS && a && typeof a[k] === 'object') o[k] = merge(a[k], v);
    else o[k] = v && typeof v === 'object' && !Array.isArray(v) && v !== TS ? merge({}, v) : v;
  });
  return o;
}
const snap = (p) => ({ id: p.split('/').pop(), ref: doc(p), exists: store.has(p), data: () => store.get(p) });
function doc(p) {
  return { path: p, id: p.split('/').pop(), collection: (c) => col(p + '/' + c), get: async () => snap(p),
    set: async (d, o) => { store.set(p, o && o.merge ? merge(store.get(p) || {}, d) : merge({}, d)); } };
}
function query(p, filters = [], ord = null, lim = 0) {
  const run = () => {
    let ids = [...store.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'));
    ids = ids.filter((k) => filters.every(([f, v]) => store.get(k)[f] === v));
    if (ord) ids.sort((a, b) => String(store.get(b)[ord]).localeCompare(String(store.get(a)[ord])));
    if (lim) ids = ids.slice(0, lim);
    return { docs: ids.map(snap) };
  };
  return { get: async () => run(), where: (f, op, v) => query(p, filters.concat([[f, v]]), ord, lim), orderBy: (f) => query(p, filters, f, lim),
    limit: (n) => query(p, filters, ord, n), select: () => query(p, filters, ord, lim) };
}
function col(p) { return Object.assign(query(p), { doc: (id) => doc(p + '/' + id) }); }
const writer = () => { const ops = []; return { set: (r, d, o) => ops.push(() => r.set(d, o)), close: async () => { for (const f of ops) await f(); }, commit: async () => { for (const f of ops) await f(); } }; };
const db = { collection: (c) => col(c), getAll: async (...refs) => refs.map((r) => snap(r.path)), bulkWriter: writer, batch: writer };
const admin = { firestore: { FieldValue: { increment: inc, delete: () => DEL, serverTimestamp: () => TS } } };
const stub = (rel, exports) => { const f = require.resolve(path.join(__dirname, '../functions/src', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
stub('common.js', { onRequest: (o, h) => h, admin, db, getPlanBudget: () => ({ allowGameDev: true }) });
stub('experience.js', { _experience: { telemetrySchema: () => ({}), intentText: () => '' } });
const { knowledgeSubmit, knowledgeStatus, knowledgeSearch, activitySubmit } = require('../functions/src/mcp.js')._mcp;

const G = 'worlds/w1/games/g1';
const ctx = { gref: doc(G), game: {} }, key = { worldId: 'w1', gameId: 'g1', prefix: 'wwk_test' };
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const err = async (f) => { try { await f(); return ''; } catch (e) { return e.message; } };
const GUID = (n) => String(n).padStart(32, 'a');
const recs = [
  { kind: 'prefab', guid: GUID(1), path: 'Assets/Prefabs/Hero.prefab', name: 'Hero', components: ['Animator', 'HeroController'], deps: [GUID(2)] },
  { kind: 'asset', guid: GUID(2), path: 'Assets/Materials/Hero.mat', type: 'Material', labels: ['hero'] },
  { kind: 'script', guid: GUID(3), path: 'Assets/Scripts/HeroController.cs', namespace: 'Game', public_api: ['Jump()'] },
  { kind: 'asset', guid: 'x', path: 'C:/Users/me/secret.png' },
  { kind: 'asset', path: '../outside.txt' },
  { kind: 'relation', from: 'guid:' + GUID(1), to: 'guid:' + GUID(3), rel: 'uses', confirmed: true },
  { kind: 'relation', from: 'guid:' + GUID(1), to: 'card:c:hero', rel: 'maps_to_card', confirmed: false },
  { kind: 'framework', name: 'RPG Framework', version: '0.30.0' },
];

(async () => {
  check(/begin/.test(await err(() => knowledgeSubmit(ctx, { snapshot_id: 's1', part: 'records', records: [] }))), true, 'records before begin are refused');
  check(/Unsupported schema/.test(await err(() => knowledgeSubmit(ctx, { snapshot_id: 's1', part: 'begin', manifest: { schema: 'other/9' } }))), true, 'a foreign schema is refused');
  await knowledgeSubmit(ctx, { snapshot_id: 's1', part: 'begin', manifest: { schema: 'whitewrite.knowledge/1', scope: 'full', coverage: { prefab: { found: 1 } } } });
  const r1 = await knowledgeSubmit(ctx, { snapshot_id: 's1', part: 'records', records: recs });
  check(r1.added + '/' + r1.relations + '/' + r1.rejected, '3/1/3', 'three assets, one relation; absolute path, ../ path and an unconfirmed card link rejected');
  check(store.get(G + '/kAssets/' + GUID(1)).details.components.join(), 'Animator,HeroController', 'prefab details are kept');
  const r2 = await knowledgeSubmit(ctx, { snapshot_id: 's1', part: 'records', records: recs });
  check(r2.added + '/' + r2.updated + '/' + r2.skipped, '0/0/3', 'sending the same records again changes nothing');
  await knowledgeSubmit(ctx, { snapshot_id: 's1', part: 'end', report_md: '# Report' });
  const st = await knowledgeStatus(ctx, {});
  check(st.status + '|' + st.counts.added + '|' + st.framework.version, 'imported|3|0.30.0', 'status: imported, counts, framework');
  check((await knowledgeSubmit(ctx, { snapshot_id: 's1', part: 'begin', manifest: {} })).status, 'duplicate', 'an imported snapshot is not imported twice');
  // a partial scan removes nothing; a full scan marks the unseen as missing
  await knowledgeSubmit(ctx, { snapshot_id: 's2', part: 'begin', manifest: { scope: 'partial' } });
  await knowledgeSubmit(ctx, { snapshot_id: 's2', part: 'records', records: [recs[0]] });
  await knowledgeSubmit(ctx, { snapshot_id: 's2', part: 'end' });
  check([1, 2, 3].filter((n) => store.get(G + '/kAssets/' + GUID(n)).missingSince).length, 0, 'a partial scan tombstones nothing');
  await knowledgeSubmit(ctx, { snapshot_id: 's3', part: 'begin', manifest: { scope: 'full' } });
  await knowledgeSubmit(ctx, { snapshot_id: 's3', part: 'records', records: [recs[0], { ...recs[1], description: 'red' }] });
  const e3 = await knowledgeSubmit(ctx, { snapshot_id: 's3', part: 'end' });
  check(e3.tombstoned + '|' + store.get(G + '/kAssets/' + GUID(3)).missingSince + '|' + !!store.get(G + '/kAssets/' + GUID(3)).path, '1|s3|true', 'a full scan marks the unseen script missing, never deletes it');
  check(store.get(G + '/kAssets/' + GUID(2)).description, 'red', 'a changed record is updated');
  // search
  check((await knowledgeSearch(ctx, { q: 'hero' })).total, 3, 'search by text');
  check((await knowledgeSearch(ctx, { type: 'material' })).assets[0].path, 'Assets/Materials/Hero.mat', 'search by type');
  check((await knowledgeSearch(ctx, { guid: GUID(3) })).assets[0].missing, true, 'search by guid shows the missing mark');
  const rel = await knowledgeSearch(ctx, { related_to: GUID(1) });
  check(rel.relations.length + '|' + rel.total, '1|3', 'related_to: the relation, the dependency and the script');
  // activity log
  const act = { session_id: 'sess-1', commit: 'abc1234', summary: 'Added a double jump.', entries: [
    { entry_id: 'e1', change: 'added', category: 'mechanic', text: 'Double jump', player_impact: 'Reach higher ledges', privacy: 'marketing_approved' },
    { entry_id: 'e2', text: 'Refactor input', category: 'whatever' }, { entry_id: '', text: 'no id' }] };
  const a1 = await activitySubmit(ctx, key, act);
  check(a1.accepted + '|' + a1.duplicates + '|' + a1.verify, '2|0|unverified', 'two entries accepted; no repo → unverified');
  const e2 = store.get(G + '/activity/sess-1/entries/e2');
  check(e2.category + '|' + e2.privacy + '|' + e2.status, 'other|internal|completed', 'defaults: unknown category → other, privacy → internal');
  store.set(G + '/activity/sess-1/entries/e1', { ...store.get(G + '/activity/sess-1/entries/e1'), privacy: 'excluded' }); // the author re-marked it
  const a2 = await activitySubmit(ctx, key, act);
  check(a2.accepted + '|' + a2.duplicates + '|' + store.get(G + '/activity/sess-1/entries/e1').privacy, '0|2|excluded', 'a retry adds nothing and keeps the author\'s mark');
  check(/session_id/.test(await err(() => activitySubmit(ctx, key, { entries: [] }))), true, 'a session without id is refused');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})();
