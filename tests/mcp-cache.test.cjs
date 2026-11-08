// MCP readGame (functions/src/mcp.js): the game's entities, cards and tasks are read once per instance; later calls
// check a signature (count + newest updatedAt) and re-read only when something changed. Run: npm test
const path = require('path');
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

const store = {}, reads = { list: 0 };
const T = (ms) => ({ toMillis: () => ms });
const kids = (p) => Object.keys(store).filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'));
const snap = (k) => ({ id: k.split('/').pop(), exists: !!store[k], data: () => store[k], get: (f) => (store[k] || {})[f] });
const col = (p) => ({
  doc: (id) => doc(p + '/' + id),
  get: async () => { reads.list++; return { docs: kids(p).map(snap) }; },
  count: () => ({ get: async () => ({ data: () => ({ count: kids(p).length }) }) }),
  orderBy: () => ({ limit: () => ({ get: async () => ({ docs: kids(p).filter((k) => store[k].updatedAt).sort((a, b) => store[b].updatedAt.toMillis() - store[a].updatedAt.toMillis()).slice(0, 1).map(snap) }) }) }),
});
const doc = (p) => ({ get: async () => snap(p), collection: (c) => col(p + '/' + c) });
const db = { collection: col };
const stub = (rel, exports) => { const f = require.resolve(path.join(__dirname, '../functions/src', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
stub('common.js', { onRequest: (o, h) => h, admin: { firestore: { FieldValue: {} } }, db, getPlanBudget: () => ({ allowGameDev: true }) });
stub('experience.js', { _experience: { telemetrySchema: () => ({}), intentText: () => '' } });
const { readGame, dropGame } = require('../functions/src/mcp.js')._mcp;

(async () => {
  store['worlds/w1'] = { owner: 'u1' }; store['worlds/w1/games/g1'] = { title: 'G' };
  store['worlds/w1/entities/e1'] = { name: 'Hero', updatedAt: T(1) };
  store['worlds/w1/games/g1/cards/c1'] = { title: 'Sword', updatedAt: T(1) };
  store['worlds/w1/games/g1/tasks/t2'] = { title: 'B', order: 2, updatedAt: T(1) }; store['worlds/w1/games/g1/tasks/t1'] = { title: 'A', order: 1, updatedAt: T(1) };
  const key = { worldId: 'w1', gameId: 'g1', uid: 'u1' };
  const a = await readGame(key);
  check(reads.list === 3 && a.cards.length === 1 && a.tasks.map((t) => t.id).join() === 't1,t2', 'the first call reads the three lists (tasks in order)');
  a.tasks[0].status = 'mutated';
  const b = await readGame(key);
  check(reads.list === 3, 'nothing changed → the lists come from the cache (no list reads)');
  check(b.tasks[0].status === undefined, 'each call gets its own copies: a tool changing one does not change the cache');
  store['worlds/w1/games/g1/cards/c1'] = { title: 'Sword+1', updatedAt: T(2) };
  const c = await readGame(key);
  check(reads.list === 6 && c.cards[0].title === 'Sword+1', 'a card edited (newer updatedAt) → re-read');
  delete store['worlds/w1/games/g1/tasks/t2'];
  const d = await readGame(key);
  check(reads.list === 9 && d.tasks.length === 1, 'a task deleted (count changed) → re-read');
  dropGame(key); await readGame(key);
  check(reads.list === 12, 'after a write by MCP itself the cache is dropped');
  let denied = ''; try { await readGame({ worldId: 'w1', gameId: 'g1', uid: 'u2' }); } catch (e) { denied = e.message; }
  check(/no access/.test(denied), 'another user still gets no access (checked on every call, not cached)');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
