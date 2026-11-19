// Security fixes of the audit 2026-11-19 outside MCP: a telemetry key stops when its maker no longer owns the world
// (experience.js resolveKey), a friend invite does not tell whether the email has an account nor the name before acceptance
// (team.js), ♥ / follow / report have a daily cap per user (community.js rateOk), a Mastodon host on a private address is refused
// (marketing.js privateIp). Run: npm test
const path = require('path'), crypto = require('crypto');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

const store = new Map();
const snap = (p) => ({ id: p.split('/').pop(), ref: doc(p), exists: store.has(p), data: () => store.get(p), get: (f) => (store.get(p) || {})[f] });
function doc(p) {
  return { path: p, id: p.split('/').pop(), collection: (c) => col(p + '/' + c), get: async () => snap(p),
    set: async (d, o) => store.set(p, Object.assign({}, o && o.merge ? store.get(p) : {}, d)),
    update: async (d) => store.set(p, Object.assign({}, store.get(p), d)), delete: async () => store.delete(p) };
}
const col = (p) => ({ doc: (id) => doc(p + '/' + id), where: () => ({ where: () => ({ get: async () => ({ docs: [] }) }) }) });
const db = { collection: col, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o) }) };
const users = { 'a@x.io': { uid: 'u1', email: 'a@x.io', displayName: 'Alice' }, 'b@x.io': { uid: 'u2', email: 'b@x.io', displayName: 'Bob Secret' } };
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => undefined, increment: (n) => n, arrayUnion: (...a) => a, arrayRemove: (...a) => a } },
  auth: () => ({ verifyIdToken: async (t) => ({ uid: t }), getUserByEmail: async (e) => { if (!users[e]) throw new Error('no user'); return users[e]; },
    getUser: async (uid) => Object.values(users).find((u) => u.uid === uid) }) };
const stub = (rel, exports) => { const f = require.resolve(path.join(__dirname, '../functions/src', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
stub('common.js', { onRequest: (o, h) => h, admin, db, cors: (req, res, fn) => fn(), publicMessage: (e) => e.message, claudeApiKey: { value: () => '' },
  getPlanBudget: (p) => ({ allowGameDev: p === 'worldbuilder' }), charge: () => {}, getBalance: () => ({}), reserve: () => {}, refund: () => {}, settle: () => {}, cutOff: (m) => new Error(m) });
stub('claude.js', { modelFor: () => ({}), claudeText: () => ({}) });
const call = async (fn, req) => { const out = {}; const res = { set() { return this; }, status(c) { out.code = c; return this; }, json(b) { out.body = b; return this; }, send(b) { out.body = b; return this; } }; await fn(req, res); return out; };

(async () => {
  // ---- telemetry: the key's maker must own the world ----
  const EX = require('../functions/src/experience.js');
  const key = 'wwi_' + 'k'.repeat(30), h = crypto.createHash('sha256').update(key).digest('hex');
  store.set('users/u1', { plan: 'worldbuilder' }); store.set('ingestKeys/' + h, { uid: 'u1', worldId: 'w1', gameId: 'g1' });
  store.set('worlds/w1', { owner: 'u9' }); // the world was transferred / bought
  const ing = (ip) => call(EX.telemetryIngest, { method: 'POST', ip, headers: { authorization: 'Bearer ' + key }, body: { events: [] } });
  check((await ing('9.9.9.1')).code, 401, 'a telemetry key of a world its maker no longer owns is refused');
  store.set('worlds/w1', { owner: 'u1' });
  check((await ing('9.9.9.2')).code, 400, 'the owner’s key works (an empty batch → 400 «No events»)');

  // ---- team invite ----
  const { team } = require('../functions/src/team.js');
  const inv = (uid, email) => call(team, { method: 'POST', headers: { authorization: 'Bearer ' + uid }, body: { op: 'invite', email } });
  const known = await inv('u1', 'b@x.io'), unknown = await inv('u1', 'nobody@x.io');
  check(known.code + '|' + unknown.code + '|' + (JSON.stringify(known.body) === JSON.stringify(unknown.body)), '200|200|true', 'an unknown email gets the same answer as a known one');
  check(store.get('users/u1/friends/u2').name, '', 'the inviter does not see the friend’s name before they accept');
  const byMail = [...store.keys()].find((k) => k.startsWith('users/u1/friends/e_'));
  check(!!byMail && store.get(byMail).email + '|' + ('uid' in store.get(byMail)), 'nobody@x.io|false', 'an invite to an email without an account shows as pending (removable by its id)');
  await call(team, { method: 'POST', headers: { authorization: 'Bearer u2' }, body: { op: 'accept', uid: 'u1' } });
  check(store.get('users/u1/friends/u2').status + '|' + store.get('users/u1/friends/u2').name, 'accepted|Bob Secret', 'after acceptance the inviter sees the name');

  // ---- community: daily cap ----
  const { rateOk, RATE } = require('../functions/src/community.js')._community;
  let okN = 0; for (let i = 0; i < RATE.report + 3; i++) if (await rateOk('u5', 'report')) okN++;
  check(okN + '|' + (await rateOk('u5', 'like')), RATE.report + '|true', 'reports stop at the daily cap; other actions count separately');

  // ---- marketing: private addresses ----
  const { privateIp } = require('../functions/src/marketing.js')._marketing;
  check(['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.20.0.1', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'].every(privateIp), true, 'loopback / private / link-local / metadata addresses are private');
  check(['8.8.8.8', '151.101.1.1', '2606:4700::1111'].some(privateIp), false, 'public addresses pass');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
