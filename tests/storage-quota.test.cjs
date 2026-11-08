// Storage quota (functions/src/storage-quota.js): uploads under worlds/{w}/ count toward the owner's plan over all their
// worlds; a file past the quota is deleted (and not taken off again); removals take bytes off. Run: npm test
const path = require('path');
const F = (p) => require.resolve(path.join(__dirname, '../functions', p));
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const store = {}, deleted = [];
const INC = (n) => ({ __inc: n });
const apply = (cur, d) => { const o = Object.assign({}, cur); for (const [k, v] of Object.entries(d)) o[k] = v && v.__inc !== undefined ? (o[k] || 0) + v.__inc : v; return o; };
const doc = (p) => ({ get: async () => ({ exists: !!store[p], data: () => store[p], get: (k) => (store[p] || {})[k] }),
  set: async (d) => { store[p] = apply(store[p], d); }, update: async (d) => { if (!store[p]) throw new Error('NOT_FOUND'); store[p] = apply(store[p], d); } });
const db = { collection: (c) => ({ doc: (id) => doc(c + '/' + id),
  where: (f, op, v) => ({ get: async () => ({ docs: Object.keys(store).filter((k) => k.startsWith(c + '/') && store[k][f] === v).map((k) => ({ get: (x) => store[k][x] })) }) }) }) };
const admin = { firestore: { FieldValue: { increment: INC, serverTimestamp: () => 'TS' } },
  storage: () => ({ bucket: () => ({ file: (name) => ({ setMetadata: async () => {}, delete: async () => { deleted.push(name); } }) }) }) };
require.cache[F('src/common.js')] = { loaded: true, exports: { admin, db, getPlanBudget: require(F('plans.js')).getPlanBudget } };
const Q = require(F('src/storage-quota.js'))._quota;
const GB = Q.GB, MB = 1024 * 1024;

(async () => {
  store['users/u1'] = { plan: 'free' }; store['worlds/w1'] = { owner: 'u1' }; store['worlds/w2'] = { owner: 'u1' };
  check(Q.worldOf('worlds/w1/games/g/files/c/x.png') === 'w1' && Q.worldOf('library/anims/a.glb') === null, 'only files under worlds/{w}/ count');
  await Q.onUpload({ name: 'worlds/w1/files/e/a.png', size: 600 * MB });
  await Q.onUpload({ name: 'worlds/w2/games/g/files/c/b.png', size: 300 * MB });
  check(store['storageUsage/w1'].bytes === 600 * MB && store['storageUsage/w2'].owner === 'u1', 'each world keeps its bytes and its owner');
  const r = await Q.onUpload({ name: 'worlds/w2/games/g/files/c/c.fbx', size: 200 * MB });
  check(r.deleted && deleted.includes('worlds/w2/games/g/files/c/c.fbx') && store['storageUsage/w2'].bytes === 300 * MB, 'Free (1 GB, all worlds together): the file past the quota is deleted, not counted');
  await Q.onRemove({ name: 'worlds/w2/games/g/files/c/c.fbx', size: 200 * MB, metadata: { wwUncounted: '1' } });
  check(store['storageUsage/w2'].bytes === 300 * MB, 'deleting a file that was never counted takes nothing off');
  await Q.onRemove({ name: 'worlds/w1/files/e/a.png', size: 600 * MB });
  check(store['storageUsage/w1'].bytes === 0, 'a removed file takes its bytes off');
  check((await Q.onUpload({ name: 'worlds/w2/games/g/files/c/c.fbx', size: 200 * MB })).counted, 'with room again the same file is kept');
  store['users/u1'].plan = 'worldbuilder';
  check((await Q.onUpload({ name: 'worlds/w1/files/e/big.mp4', size: 5 * GB })).counted, 'Worldbuilder (50 GB) takes what Free could not');
  check(!(await Q.onUpload({ name: 'worlds/gone/files/x.png', size: 1 })).counted, 'a file of a deleted world is not counted (cleanup removes it)');
  const P = require(F('paid-features.js'));
  check(['free', 'storyteller', 'novelist', 'worldbuilder'].map((p) => P.planBudget(p).storageGB).join() === '1,2,5,50', 'the quotas live in the registry: 1 · 2 · 5 · 50 GB');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
