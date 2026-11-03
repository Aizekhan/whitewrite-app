// 🔌 Інтеграції (functions/src/integrations.js): only the world owner sets keys; a refused key is not stored; the page sees
// only provider / last 4 / check; a game without its own key uses the world's; purge removes a game's or a world's keys.
// Run: npm test
const path = require('path');
const store = new Map();
const DEL = { del: true };
function setDeep(o, dotted, v) { const k = dotted.split('.'); let x = o; k.slice(0, -1).forEach((p) => { x = x[p] = x[p] || {}; }); if (v === DEL) delete x[k[k.length - 1]]; else x[k[k.length - 1]] = v; }
function doc(p) {
  return { id: p.split('/').pop(), path: p,
    collection: (c) => col(p + '/' + c),
    get: async () => ({ id: p.split('/').pop(), exists: store.has(p), data: () => store.get(p), ref: doc(p) }),
    set: async (v, o) => { const cur = o && o.merge && store.has(p) ? store.get(p) : {}; Object.keys(v).forEach((k) => { if (v[k] === DEL) delete cur[k]; else cur[k] = v[k]; }); store.set(p, cur); },
    update: async (v) => { if (!store.has(p)) throw new Error('no doc ' + p); const cur = store.get(p); Object.keys(v).forEach((k) => setDeep(cur, k, v[k])); },
    delete: async () => { store.delete(p); } };
}
function col(c) {
  return { doc: (id) => doc(c + '/' + id),
    where: (f, op, v) => ({ get: async () => ({ docs: [...store.keys()].filter((k) => k.startsWith(c + '/') && k.split('/').length === c.split('/').length + 1 && store.get(k)[f] === v).map((k) => ({ id: k.split('/').pop(), ref: doc(k), data: () => store.get(k) })) }) }) };
}
const db = { collection: col };
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'ts', delete: () => DEL }, Timestamp: { now: () => 'now' } } };
const f = require.resolve(path.join(__dirname, '../functions/src/common.js'));
require.cache[f] = { id: f, filename: f, loaded: true, exports: { onRequest: (o, h) => h, admin, db, cors: () => {} } };
const { handle, getIntegrationKey, purge } = require('../functions/src/integrations.js')._integrations;

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const tryErr = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

(async () => {
  store.set('worlds/w1', { owner: 'u1' }); store.set('worlds/w1/games/g1', { title: 'G' }); store.set('worlds/w1/games/g2', { title: 'H' });
  let status = 200; global.fetch = async () => ({ status, ok: status < 300 });

  check((await tryErr(() => handle({ op: 'set', worldId: 'w1', kind: 'image', provider: 'openai', key: 'sk-test-12345678' }, 'u2'))).status === 403, 'a stranger cannot set a key');
  status = 401;
  const bad = await tryErr(() => handle({ op: 'set', worldId: 'w1', gameId: 'g1', kind: 'model3d', provider: 'meshy', key: 'msy_wrongkey123' }, 'u1'));
  check(bad && bad.body.code === 'KEY_REJECTED' && !store.has('integrationKeys/w1__g1'), 'a key the service refuses is not stored');
  check((await tryErr(() => handle({ op: 'set', worldId: 'w1', kind: 'image', provider: 'openai', key: 'sk test' }, 'u1'))).status === 400, 'a key with spaces is refused');
  check((await tryErr(() => handle({ op: 'set', worldId: 'w1', kind: 'sound', provider: 'x', key: 'abcdefgh1' }, 'u1'))).status === 400, 'an unknown kind is refused');

  status = 200;
  const r = await handle({ op: 'set', worldId: 'w1', kind: 'model3d', provider: 'meshy', key: 'msy_world_key_ABCD' }, 'u1');
  check(r.check === 'ok' && r.tail === 'ABCD', 'an accepted world key: checked, last 4 shown');
  const pub = store.get('worlds/w1').integrations.model3d;
  check(pub.provider === 'meshy' && pub.tail === 'ABCD' && !JSON.stringify(store.get('worlds/w1')).includes('msy_world'), 'the world doc carries no key, only provider / tail / check');
  status = 500;
  const r2 = await handle({ op: 'set', worldId: 'w1', gameId: 'g1', kind: 'model3d', provider: 'tripo', key: 'tsk_game_key_WXYZ' }, 'u1');
  check(r2.check === 'unverified', 'the service failing to answer keeps the key as «not checked»');
  check((await handle({ op: 'set', worldId: 'w1', kind: 'image', provider: 'other', name: 'MyGen', key: 'any-key-0000' }, 'u1')).check === 'unverified', '«other» service: stored without a check');

  check((await getIntegrationKey('w1', 'g1', 'model3d')).key === 'tsk_game_key_WXYZ', "the game's own key comes first");
  const fb = await getIntegrationKey('w1', 'g2', 'model3d');
  check(fb && fb.key === 'msy_world_key_ABCD' && fb.from === 'world', "a game without its own key uses the world's");
  check(await getIntegrationKey('w1', 'g2', 'nothing') === null, 'no key → null');

  await handle({ op: 'remove', worldId: 'w1', gameId: 'g1', kind: 'model3d' }, 'u1');
  check(!store.get('worlds/w1/games/g1').integrations.model3d && (await getIntegrationKey('w1', 'g1', 'model3d')).from === 'world', 'removing the game key falls back to the world key');

  await handle({ op: 'set', worldId: 'w1', gameId: 'g1', kind: 'image', provider: 'fal', key: 'fal-key-00000' }, 'u1');
  await purge('w1', 'g1');
  check(!store.has('integrationKeys/w1__g1') && store.has('integrationKeys/w1'), 'purging a game removes only its keys');
  await purge('w1');
  check(![...store.keys()].some((k) => k.startsWith('integrationKeys/')), 'purging a world removes all its keys');
  store.set('worlds/w1', Object.assign(store.get('worlds/w1'), { freeze: { reason: 'sale' } }));
  check((await tryErr(() => handle({ op: 'set', worldId: 'w1', kind: 'image', provider: 'openai', key: 'sk-test-12345678' }, 'u1'))).status === 409, 'a frozen world takes no keys');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
