// «Досвід гравців» (functions/src/experience.js) against an in-memory Firestore: telemetryIngest deduplicates by event_id
// (and says so), counts each event once, and does not rewrite the game doc per batch; the team roles of `experience`;
// an error after the paid Claude call is charged for it (settle with error.paid), not refunded.
// Run: npm test
const path = require('path');
const crypto = require('crypto');
const store = new Map();
const INC = (n) => ({ __inc: n }), DEL = { __del: 1 }, TS = { __ts: 1 };
function merge(a, b) {
  const o = Object.assign({}, a);
  Object.entries(b).forEach(([k, v]) => {
    if (v === DEL) delete o[k];
    else if (v && v.__inc !== undefined) o[k] = (o[k] || 0) + v.__inc;
    else if (v && typeof v === 'object' && !Array.isArray(v) && v !== TS && !v.__ts2 && a && typeof a[k] === 'object') o[k] = merge(a[k], v);
    else o[k] = v && typeof v === 'object' && !Array.isArray(v) && v !== TS ? merge({}, v) : v;
  });
  return o;
}
let gameWrites = 0;
const snap = (p) => ({ id: p.split('/').pop(), ref: doc(p), exists: store.has(p), data: () => store.get(p) });
function doc(p) {
  return { path: p, id: p.split('/').pop(), collection: (c) => col(p + '/' + c), get: async () => snap(p),
    set: async (d, o) => { store.set(p, o && o.merge ? merge(store.get(p) || {}, d) : merge({}, d)); },
    update: async (d) => { if (!store.has(p)) throw new Error('NOT_FOUND'); if (p.split('/').length === 4) gameWrites++; store.set(p, merge(store.get(p), d)); } };
}
function col(p) {
  const q = (filters) => ({ where: (f, op, v) => q(filters.concat([[f, v]])), orderBy: () => q(filters), limit: () => q(filters),
    get: async () => ({ docs: [...store.keys()].filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/') && filters.every(([f, v]) => store.get(k)[f] === v)).map(snap) }) });
  return Object.assign(q([]), { doc: (id) => doc(p + '/' + (id || crypto.randomBytes(6).toString('hex'))), add: async (d) => { const r = doc(p + '/' + crypto.randomBytes(6).toString('hex')); await r.set(d); return r; } });
}
const batch = () => { const ops = []; return { set: (r, d, o) => ops.push(() => r.set(d, o)), commit: async () => { for (const f of ops) await f(); } }; };
const db = { collection: (c) => col(c), batch, getAll: async (...refs) => refs.map((r) => snap(r.path)), recursiveDelete: async () => {} };
const admin = { firestore: { FieldValue: { increment: INC, delete: () => DEL, serverTimestamp: () => TS, arrayUnion: (...a) => a }, Timestamp: { fromMillis: (n) => ({ ms: n }) } },
  auth: () => ({ verifyIdToken: async (t) => ({ uid: t }) }) };
const settled = [];
const stub = (rel, exports) => { const f = require.resolve(path.join(__dirname, '../functions/src', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
stub('common.js', { onRequest: (o, h) => h, admin, db, cors: (req, res, fn) => fn(), publicMessage: (e) => e.message, claudeApiKey: { value: () => 'k' },
  getPlanBudget: (p) => ({ allowGameDev: p === 'worldbuilder' }), getBalance: () => ({ available: 100000 }), reserve: async () => ({ id: 'r1', available: 99000 }),
  charge: async () => ({ userCost: 10 }), refund: async () => {}, cutOff: (m) => new Error(m), settle: async (d, uid, r, e) => { settled.push({ uid, paid: e && e.paid }); } });
stub('claude.js', { modelFor: async () => ({ tier: 'sonnet', model: 'm' }), claudeText: async () => ({ text: 'not json at all', model: 'm', usage: { input_tokens: 100, output_tokens: 50 }, stopReason: 'end_turn' }) });
const EX = require('../functions/src/experience.js');
const { teamAccess } = require('../functions/src/team.js')._team;
const { statsDue, STATS_EVERY_MS } = EX._experience;

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const call = async (fn, req) => { let out = {}; const res = { set() {}, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, send(b) { out.body = b; return this; } }; await fn(req, res); return out; };

(async () => {
  // ---- team roles ----
  const W = { owner: 'u1', team: { a: { role: 'admin' }, e: { role: 'editor' }, v: { role: 'viewer' }, c: { role: 'custom', edit: ['experience'] }, c2: { role: 'custom', edit: ['levels'] } } };
  const r = (u) => { const x = teamAccess(W, u, 'experience', 'telemetry'); return x ? x.uid + ':' + x.ai + ':' + x.owner : 'none'; };
  check([r('u1'), r('a'), r('e'), r('c'), r('c2'), r('v'), r('x')].join(' '), 'u1:true:true u1:true:false u1:false:false u1:false:false none none none',
    'owner and admin do everything (on the owner\'s plan), an editor / a member of the section — without ✦, a viewer and outsiders — nothing');

  // ---- telemetryIngest ----
  const G = 'worlds/w1/games/g1', key = 'wwi_' + 'x'.repeat(30), h = crypto.createHash('sha256').update(key).digest('hex');
  store.set('worlds/w1', W); store.set(G, { title: 'G' }); store.set('users/u1', { plan: 'worldbuilder', subscriptionStatus: 'active' });
  store.set('ingestKeys/' + h, { uid: 'u1', worldId: 'w1', gameId: 'g1' });
  const ev = (i) => ({ event_id: 'evt-' + String(i).padStart(4, '0'), event_name: 'ZoneEntered', build_id: '0.1', session_id: 's1', player_id: 'p1', timestamp: Date.now() });
  const ingest = (events) => call(EX.telemetryIngest, { method: 'POST', ip: '1.1.1.' + Math.random(), headers: { authorization: 'Bearer ' + key }, body: { events } });
  const a1 = await ingest([ev(1), ev(2), ev(2)]);
  const day = new Date().toISOString().slice(0, 10), daily = () => store.get(G + '/telemetryDaily/' + day) || {};
  check(a1.body.accepted + '|' + a1.body.duplicates + '|' + daily().total, '2|1|2', 'a repeated event_id in one batch is stored and counted once, the answer says duplicates: 1');
  const a2 = await ingest([ev(2), ev(3)]);
  check(a2.body.accepted + '|' + a2.body.duplicates + '|' + daily().total, '1|1|3', 'a retried event from an earlier batch is not counted again');
  check(gameWrites + '|' + (store.get(G).telemetryStats || {}).count, '1|2', 'the game doc gets telemetryStats once (the first batch of the day), not per batch');
  check(statsDue({ day, at: Date.now() - STATS_EVERY_MS - 1 }, day, Date.now()) + '|' + statsDue({ day: '2000-01-01', at: Date.now() }, day, Date.now()), 'true|true', 'the summary is refreshed after 10 minutes or when the day turns');

  // ---- experience: roles and the paid call ----
  const ex = (uid, body) => call(EX.experience, { method: 'POST', headers: { authorization: 'Bearer ' + uid }, body: Object.assign({ worldId: 'w1', gameId: 'g1' }, body) });
  check((await ex('e', { op: 'metrics' })).code, 200, 'an editor of the team recomputes the metrics (was «немає доступу»)');
  check((await ex('e', { op: 'playtest' })).code, 403, 'an editor CANNOT run ✦ (no tokens)');
  check((await ex('v', { op: 'metrics' })).code, 403, 'a viewer CANNOT');
  check((await ex('a', { op: 'purge' })).code, 403, 'an admin CANNOT purge the game\'s telemetry (owner only)');
  // the mocked Claude answer is not JSON → the error comes AFTER the paid call
  settled.length = 0;
  const bad = await ex('a', { op: 'playtest' });
  check(bad.code + '|' + settled.length + '|' + (settled[0] && settled[0].uid) + '|' + !!(settled[0] && settled[0].paid && settled[0].paid.usage), '500|1|u1|true',
    'an admin ✦ runs on the owner tokens; an unparsable answer after the paid call → settle with its usage (charged, not refunded)');

  // ---- get_telemetry_schema names the events the retention metrics need (v2.146.1) ----
  const req = EX._experience.telemetrySchema({}, [], [], [], []).required_events || '';
  check(['SessionStarted', 'SessionEnded', 'player_id', 'GameCompleted', 'RewardReceived'].every((x) => req.includes(x)), true, 'the schema REQUIRES session start / end, a stable player_id, GameCompleted and the first action / reward');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
