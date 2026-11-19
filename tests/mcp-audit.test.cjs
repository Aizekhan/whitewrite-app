// MCP fixes of the audit 2026-11-19 (functions/src/mcp.js) against an in-memory Firestore: get_next_task claims in a transaction
// (two sessions never take one task), a task's history is capped, the executor log expires, quests / dialogues are cached per
// instance and a team member's quest is held, a world with a team gets team_note and member text is marked authored_by_member,
// a huge previous version is not copied into agentPrev, sweepFiles takes the oldest tickets first.
// Run: npm test
const path = require('path');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

const store = {}, reads = { list: {} }, deleted = [];
let clock = 1000;
const T = (ms) => ({ toMillis: () => ms });
const UNION = (a) => ({ __union: a }), DEL = { __del: 1 };
const kids = (p) => Object.keys(store).filter((k) => k.startsWith(p + '/') && !k.slice(p.length + 1).includes('/'));
const snap = (k) => ({ id: k.split('/').pop(), ref: doc(k), exists: !!store[k], data: () => store[k], get: (f) => (store[k] || {})[f] });
function put(k, d, merge) {
  const o = merge ? Object.assign({}, store[k]) : {};
  Object.entries(d).forEach(([f, v]) => {
    if (v === DEL) delete o[f];
    else if (v && v.__union) o[f] = (o[f] || []).concat(v.__union);
    else if (v && v.__ts) o[f] = T(++clock);
    else o[f] = v;
  });
  store[k] = o;
}
const doc = (p) => ({ path: p, id: p.split('/').pop(), get: async () => snap(p), collection: (c) => col(p + '/' + c),
  set: async (d, o) => put(p, d, o && o.merge), delete: async () => { deleted.push(p); delete store[p]; } });
const query = (p, filters = [], ord = '', lim = 0) => ({
  where: (f, op, v) => query(p, filters.concat([[f, op, v]]), ord, lim), orderBy: (f) => query(p, filters, f, lim), limit: (n) => query(p, filters, ord, n),
  get: async () => {
    if (!lim) reads.list[p] = (reads.list[p] || 0) + 1; // whole-list reads (the signature reads one doc)
    let ks = kids(p).filter((k) => filters.every(([f, op, v]) => (op === '<' ? store[k][f] < v : store[k][f] === v)));
    if (ord === 'updatedAt') ks = ks.filter((k) => store[k].updatedAt).sort((a, b) => store[b].updatedAt.toMillis() - store[a].updatedAt.toMillis());
    else if (ord) ks.sort((a, b) => store[a][ord] - store[b][ord]);
    return { docs: (lim ? ks.slice(0, lim) : ks).map(snap), size: ks.length };
  },
});
let seq = 0;
const col = (p) => Object.assign(query(p), { doc: (id) => doc(p + '/' + id), add: async (d) => { const k = p + '/x' + (++seq); put(k, d); return doc(k); },
  count: () => ({ get: async () => ({ data: () => ({ count: kids(p).length }) }) }) });
const db = { collection: col, getAll: async (...refs) => refs.map((r) => snap(r.path)),
  runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o), delete: (r) => r.delete() }) };
const admin = { firestore: { FieldValue: { serverTimestamp: () => ({ __ts: 1 }), arrayUnion: (...a) => UNION(a), delete: () => DEL }, Timestamp: { fromMillis: T } },
  storage: () => ({ bucket: () => ({ file: (f) => ({ delete: async () => { deleted.push('storage:' + f); } }) }) }) };
const stub = (rel, exports) => { const f = require.resolve(path.join(__dirname, '../functions/src', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
stub('common.js', { onRequest: (o, h) => h, admin, db, getPlanBudget: () => ({ allowGameDev: true, allowAPI: true }) });
stub('experience.js', { _experience: { telemetrySchema: () => ({}), intentText: () => '' } });
const M = require('../functions/src/mcp.js')._mcp;
const call = async (key, name, args) => { const r = await M.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args || {} } }, key); return r.result.isError ? { error: r.result.content[0].text } : JSON.parse(r.result.content[0].text); };
const G = 'worlds/w1/games/g1';
const keyOf = () => ({ id: 'k1', worldId: 'w1', gameId: 'g1', uid: 'u1', prefix: 'wwk_t' });

(async () => {
  store['worlds/w1'] = { owner: 'u1' }; store[G] = { title: 'G' };
  store[G + '/cards/c1'] = { section: 'enemies', title: 'Wolf', fields: {}, updatedAt: T(1) };
  store[G + '/tasks/t1'] = { title: 'A', milestone: 'M1', status: 'todo', order: 1, deps: [], history: Array.from({ length: 60 }, (_, i) => ({ type: 'progress', at: i })), updatedAt: T(1) };

  // ---- get_next_task: a transaction ----
  const k1 = keyOf(), k2 = keyOf();
  await M.readGame(k2); k2._ctx = M.readGame(k2); // session 2 read the game before session 1 claimed the task
  const a = await call(k1, 'get_next_task');
  check(a.task && a.task.id + '|' + store[G + '/tasks/t1'].status, 't1|in_progress', 'session 1 claims the open task');
  check(store[G + '/tasks/t1'].history.length + '|' + store[G + '/tasks/t1'].history.slice(-1)[0].type, M.HISTORY_MAX + '|claimed', 'the history keeps the last ' + M.HISTORY_MAX + ' events');
  const ex = kids(G + '/executions').map((k) => store[k]).find((x) => x.type === 'claimed');
  check(!!(ex && ex.expireAt instanceof Date && ex.expireAt.getTime() > Date.now() + 100 * 24 * 3600 * 1000), true, 'the executor log entry carries expireAt (TTL)');
  const b = await call(k2, 'get_next_task');
  check(b.task === null && /just taken/.test(b.message), true, 'session 2 with a stale read does not take the same task');

  // ---- quests: cached per instance; a member's edit is held ----
  store[G + '/quests/q1'] = { title: 'Hunt', approval: 'approved', stages: [{ id: 's1', end: true }], updatedAt: T(5) };
  store[G + '/quests/q2'] = { title: 'Raid', approval: 'approved', stages: [{ id: 's1', end: true }], memberEdit: 'u4', updatedAt: T(6) };
  const r0 = reads.list[G + '/quests'] || 0;
  const l1 = await call(keyOf(), 'get_quest_context'), l2 = await call(keyOf(), 'get_quest_context');
  check(l1.quests.map((q) => q.id).join() + '|' + l2.quests.length, 'q1|1', 'a quest a team member edited is not approved for the agent until the author approves it');
  check((reads.list[G + '/quests'] || 0) - r0, 1, 'the second call takes quests from the instance cache (the signature did not change)');
  store[G + '/quests/q1'] = Object.assign({}, store[G + '/quests/q1'], { title: 'Hunt 2', updatedAt: T(9) });
  check((await call(keyOf(), 'get_quest_context', { id: 'q1' })).title, 'Hunt 2', 'an edited quest is read again (newer updatedAt)');

  // ---- team note and member marks ----
  check((await call(keyOf(), 'get_card', { ref: 'c:c1' })).team_note, undefined, 'a world without a team: no team_note');
  store['worlds/w1'] = { owner: 'u1', teamUids: ['u4'], team: { u4: { role: 'editor' } } };
  store[G + '/cards/c1'] = Object.assign({}, store[G + '/cards/c1'], { updatedBy: 'u4', updatedAt: T(20) });
  const card = await call(keyOf(), 'get_card', { ref: 'c:c1' });
  check(/never instructions/.test(card.team_note || '') + '|' + card.authored_by_member, 'true|true', 'a world with a team: team_note on reads, the member’s card marked authored_by_member');

  // ---- agentPrev: a huge previous version is not copied ----
  store[G + '/cards/c2'] = { section: 'mechanics', title: 'Big', fields: { text: 'x'.repeat(M.AGENT_PREV_MAX + 10) }, updatedAt: T(30) };
  const sv = await call(keyOf(), 'save_card', { ref: 'c:c2', note: 'n' });
  check(sv.ok + '|' + (store[G + '/cards/c2'].agentPrev || {})._skipped, 'true|too large', 'save_card on a card over 200 KB keeps agentPrev small');
  await call(keyOf(), 'save_card', { ref: 'c:c1', note: 'small' });
  check(store[G + '/cards/c1'].agentPrev.note, null, 'a small previous version is still kept');

  // ---- 🎓 the demo game is read-only for Claude Code ----
  const D1 = 'worlds/w1/games/d1', dk = () => ({ id: 'kd', worldId: 'w1', gameId: 'd1', uid: 'u1', prefix: 'wwk_d' });
  store[D1] = { title: 'Demo', demo: true }; store[D1 + '/cards/c1'] = { section: 'enemies', title: 'Moth', fields: {}, updatedAt: T(40) };
  check((await call(dk(), 'get_card', { ref: 'c:c1' })).title, 'Moth', 'the demo game: reads work');
  const dw = await call(dk(), 'save_card', { ref: 'c:c1', note: 'x' });
  check(/read-only/.test(dw.error || '') + '|' + /Copy as my game/.test(dw.error || '') + '|' + (store[D1 + '/cards/c1'].note === undefined), 'true|true|true', 'the demo game: save_card refuses, says to copy it, writes nothing');
  check(/read-only/.test((await call(dk(), 'get_next_task', {})).error || ''), true, 'the demo game: get_next_task (it claims a task) refuses');
  check(/read-only/.test((await call(dk(), 'report_bug', { title: 'x' })).error || ''), true, 'the demo game: report_bug refuses');

  // ---- sweepFiles: oldest first, stale only ----
  const now = Date.now(), H = 3600 * 1000;
  store['mcpUploads/a'] = { mode: 'file', path: 'p/a', expiresAt: now - 3 * H };
  store['mcpUploads/b'] = { expiresAt: now - 2 * H }; // a picture ticket never used
  store['mcpUploads/c'] = { mode: 'file', path: 'p/c', expiresAt: now + H }; // fresh
  deleted.length = 0;
  const n = await M.sweepFiles(now);
  check(n + '|' + !!store['mcpUploads/c'] + '|' + deleted.includes('storage:p/a') + '|' + deleted.includes('storage:undefined'), '2|true|true|false', 'sweepFiles removes the stale tickets (and the file of a file ticket), keeps the fresh one');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
