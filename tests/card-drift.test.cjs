// ↻ Card → plan (functions/src/card-drift.js, v2.154): a design change of a card a DONE task built → one sync task; a rename, a status, the
// programmer's own write, a card nothing built yet → nothing; a second change joins the open sync task. Run: npm test
const path = require('path');
const F = path.join(__dirname, '../functions/');
require.cache[require.resolve(F + 'src/common.js')] = { exports: { admin: { firestore: { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...a) => ({ __union: a }) } } }, db: {} } };
const { driftOf, byProgrammer, onCard, minor } = require(F + 'src/card-drift.js')._drift;
let fails = 0; const check = (got, want, msg) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)); if (!ok) fails++; };

check(driftOf({ title: 'A', fields: { hp: '60', group: 'x' }, status: 'agreed' }, { title: 'B', fields: { hp: '80', group: 'y' }, status: 'ingame' }).map((d) => d.key + ':' + d.from + '>' + d.to), ['hp:60>80'],
  'only design fields count: a rename, a group move and a status change are not drift');
check(driftOf({ mech: { a: 1 } }, { mech: { a: 2 } }).map((d) => d.key), ['mech'], 'a mechanic constructor change is drift');
check([byProgrammer({ agentAt: 1000, updatedAt: 1000 }), byProgrammer({ agentAt: 1000, agentRole: 'designer', updatedAt: 1000 }), byProgrammer({ agentAt: 1000, updatedAt: 99999 })], [true, false, false],
  'the programmer key\'s own write is the card catching up; the designer\'s or an older mark is not');

// a tiny in-memory game: tasks with array-contains, set with merge
function game(tasks) {
  const docs = new Map(tasks.map((t) => [t.id, t]));
  return { docs, collection: () => ({
    where: (f, op, v) => ({ get: async () => ({ docs: [...docs.values()].filter((t) => (t[f] || []).includes(v)).map((t) => ({ id: t.id, data: () => t })) }) }),
    doc: (id) => ({ set: async (d, o) => { docs.set(id, o && o.merge ? { ...(docs.get(id) || {}), ...d } : { ...d }); } }) }) };
}
(async () => {
  const before = { title: 'Зілля', fields: { heal: '60%' } }, after = { title: 'Зілля', fields: { heal: '40%' }, updatedAt: 5000 };
  let g = game([{ id: 'G1.3', cards: ['c:pot'], status: 'todo' }]);
  check(await onCard(g, 'pot', before, after), null, 'a card no done task built yet: the open tasks read it as it is — nothing');
  g = game([{ id: 'G1.3', cards: ['c:pot'], status: 'done', milestone: 'G1', epic: 'G1.E2' }]);
  const r = await onCard(g, 'pot', before, after), sy = g.docs.get(r && r.id);
  check(!!sy && [sy.kind, sy.status, sy.milestone, sy.epic, sy.builtBy, sy.cards[0], /60% → 40%/.test(sy.detail)], ['sync', 'todo', 'G1', 'G1.E2', 'G1.3', 'c:pot', true],
    'a built card changed → one sync task in the same milestone and epic, with what changed');
  const r2 = await onCard(g, 'pot', after, { ...after, fields: { heal: '45%' } });
  check([r2 && r2.added, [...g.docs.values()].filter((t) => t.kind === 'sync').length], [true, 1], 'a second change joins the open sync task — never a second one');
  const gp = game([{ id: 'G1.3', cards: ['c:pot'], status: 'done' }, { id: 'G2.1', cards: ['c:pot'], status: 'in_progress' }]);
  const rp = await onCard(gp, 'pot', before, { ...after, agentAt: 5000, agentBy: 'Claude Code' }), dd = (gp.docs.get('pot') || {}).devDrift;
  check([rp, [...gp.docs.values()].filter((t) => t.kind === 'sync').length, dd && dd.__union[0].key + ':' + dd.__union[0].from + '>' + dd.__union[0].to + ':' + dd.__union[0].task],
    [{ devDrift: 1 }, 0, 'heal:60%>40%:G2.1'], 'the programmer changing a design number on its own: no sync task, a divergence on the card for the author');
  const ga = game([{ id: 'AU-1', kind: 'author', cards: ['c:pot'], status: 'in_progress' }]);
  check([await onCard(ga, 'pot', before, { ...after, agentAt: 5000 }), ga.docs.get('pot').devDrift.__union[0].author], [null, 'AU-1'], 'the programmer on the author\'s instruction for this card: an info mark for the designer, no decision');
  check(await onCard(game([{ id: 'G1.3', cards: ['c:pot'], status: 'done' }]), 'pot', before, { ...after, noSyncAt: 5000 }), null, 'save_card sync: false — no task');
  check(driftOf({ fields: { rules: 'Маги бʼють наземних.' } }, { fields: { rules: 'Маги бʼють наземних і дістають летючих.' } }).map((d) => d.key), ['rules'], 'a few words in a rule field always count');
  check(driftOf({ fields: { text: 'Старий маг у синій мантії, що любить чай і книги' } }, { fields: { text: 'Старий маг у синій мантії, що любить чай та книги' } }).length, 0, 'a reworded description does not');
  const gw = game([{ id: 'G1.5', cards: ['c:pot'], status: 'in_progress' }]);
  await onCard(gw, 'pot', before, after);
  check(((gw.docs.get('G1.5').cardChanged || {}).__union || [])[0].keys, 'heal', 'a card changed while a task on it is open: «звір перед здачею» on that task');
  check([minor('Зілля лікує на 40% здоровʼя одразу після бою', 'Зілля лікує на 40% здоровя одразу після бою'), minor('лікує 40%', 'лікує 60%'), minor('Синє зілля', 'Червоне велике зілля')], [true, false, false],
    'a typo is not drift; a number or a real rewrite is');
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
