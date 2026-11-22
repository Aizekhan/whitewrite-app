// ✅ Tasks close themselves only with proof (v2.155, functions/task-types.js + mcp.js autoBlock — the game-designer agent's three safeguards):
// the proof of the task's type, the server check, no unsettled divergence on its cards, a rule change only inside an epic the author agreed;
// the designer's review relaxes only the word-matched criteria. Plus the weekly summary (plan-weekly.js) and the replan as a proposal
// (gamedev.js hasPlanWork / planDiff). Run: npm test
const path = require('path');
const F = path.join(__dirname, '../functions/');
const TT = require(F + 'task-types.js');
let fails = 0; const check = (got, want, msg) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)); if (!ok) fails++; };

// types
check([TT.typeOf({ type: 'balance' }), TT.typeOf({ owner: 'art' }), TT.typeOf({ owner: 'design' }), TT.typeOf({ kind: 'bug' }), TT.typeOf({ owner: 'dev' })], ['balance', 'content', 'mechanic', 'mechanic', 'tech'],
  'a task\'s type: its own, else from the owner (old plans have none)');
check(TT.check('mechanic', TT.clean({ playtest: 'Пройшов 3 хвилі, маги б\'ють летючих', console_errors: 0 })).ok, true, 'a mechanic: a playtest + no console errors');
check(TT.check('mechanic', TT.clean({ playtest: 'Пройшов 3 хвилі, маги б\'ють летючих', console_errors: 2 })).missing, ['console'], 'console errors → not proved');
check(TT.check('mechanic', TT.clean({ playtest: 'Пройшов 3 хвилі, все ок' })).missing, ['console'], 'no console count → not proved (0 must be said)');
check(TT.check('balance', TT.clean({ numbers: 'дуже добре все' })).ok, false, 'balance without numbers is not a bot run');
check(TT.check('balance', TT.clean({ numbers: '200 прогонів: хвиля 10 проходить 62%' })).ok, true, 'balance with the numbers');
check([TT.check('content', { licence: 'cc0' }).ok, TT.check('content', { licence: 'cc-by' }).ok, TT.check('content', TT.clean({ licence: 'stolen' })).ok], [true, false, false], 'content: own / CC0 only');
check([TT.check('ui', TT.clean({ screenshot: 'https://x/y.png', ui_check: 'гра без читання: ок' })).ok, TT.check('ui', TT.clean({ screenshot: 'C:\\shot.png', ui_check: 'гра без читання: ок' })).ok], [true, false], 'ui: a screenshot URL + the check');
check([TT.check('tech', {}, { tests: { ran: true, failed: 0 } }).ok, TT.check('tech', {}, { tests: { ran: false, failed: 0 } }).ok], [true, false], 'tech: tests that ran and passed');

// the safeguards
const { autoBlock } = require(F + 'src/mcp.js')._mcp;
const proofOk = { proof: { ok: true }, check: { allCriteriaMet: true, testsGreen: true, cardsSynced: true } };
const ctx = (plan, cards) => ({ plan: plan || {}, cards: cards || [{ id: 'pot', title: 'Зілля' }], tasks: [] });
const t = { id: 'G1.3', type: 'mechanic', epic: 'G1.E1', cards: ['c:pot'] };
check(autoBlock(ctx({ epicsOk: { 'G1.E1': { at: 1 } } }), t, proofOk, 0), [], 'all safeguards pass inside an agreed epic → closes itself');
check(autoBlock(ctx(), t, proofOk, 0), ['epic'], 'a rule (mechanic) outside an agreed epic waits');
check(autoBlock(ctx(), { ...t, type: 'tech' }, proofOk, 0), [], 'a technical task does not need the epic');
check(autoBlock(ctx(), { ...t, kind: 'sync' }, proofOk, 0), [], 'a ↻ sync task follows the card the author already decided');
check(autoBlock(ctx({ epicsOk: { 'G1.E1': {} }, autoClose: false }), t, proofOk, 0), ['off'], 'the author turned it off');
check(autoBlock(ctx({ epicsOk: { 'G1.E1': {} } }), t, { ...proofOk, proof: { ok: false } }, 2), ['proof', 'questions'], 'no proof, open questions');
check(autoBlock(ctx({ epicsOk: { 'G1.E1': {} } }, [{ id: 'pot', devDrift: [{ key: 'heal' }] }]), t, proofOk, 0), ['divergence'], 'an unsettled divergence on its card waits');
check(autoBlock(ctx({ epicsOk: { 'G1.E1': {} } }, [{ id: 'pot', devDrift: [{ key: 'heal', author: 'AU-1' }] }]), t, proofOk, 0), [], 'a change on the author\'s instruction is no divergence');
const weak = { ...proofOk, check: { allCriteriaMet: false, testsGreen: true, cardsSynced: true } };
check([autoBlock(ctx({ epicsOk: { 'G1.E1': {} } }), t, weak, 0), autoBlock(ctx({ epicsOk: { 'G1.E1': {} } }), t, weak, 0, 'designer')], [['check'], []], 'the designer may judge the word-matched criteria');
check(autoBlock(ctx({ epicsOk: { 'G1.E1': {} } }), t, { ...proofOk, check: { allCriteriaMet: true, testsGreen: false, cardsSynced: false } }, 0, 'designer'), ['check', 'cards'], 'never red tests or lagging cards, even for the designer');

// the weekly summary
const AG = require.resolve(F + 'src/agents.js');
require.cache[AG] = { id: AG, filename: AG, loaded: true, exports: { _agents: { telegramBotToken: {}, tellAuthor: async () => true } } };
const { weekOf, weekText } = require(F + 'src/plan-weekly.js')._weekly;
const now = Date.now(), since = now - 7 * 864e5;
const tasks = [
  { id: 'G1.1', status: 'done', history: [{ type: 'auto_closed', at: now - 1000 }] },
  { id: 'G1.2', status: 'done', history: [{ type: 'accepted', by: 'designer', at: now - 1000 }] },
  { id: 'G1.3', status: 'done', history: [{ type: 'accepted', by: 'author', at: now - 1000 }] },
  { id: 'G1.4', status: 'done', history: [{ type: 'accepted', by: 'author', at: since - 1000 }] },
  { id: 'G1.5', status: 'done', history: [{ type: 'inventory', state: 'done', at: now - 1000 }] },
  { id: 'G1.6', status: 'review' }, { id: 'SY-1', kind: 'sync', status: 'todo', createdAt: now - 5000 },
];
const w = weekOf(tasks, { plan: { milestones: [{ id: 'G1', name: 'Greybox', tasks: tasks.filter((x) => x.id.startsWith('G1')) }] } }, since);
check([w.closed, w.auto, w.designer, w.created, w.sync, w.review, w.ms && w.ms.pct], [3, 1, 1, 1, 1, 1, 83], 'the week: closed 3 (without you 2), the inventory and last week do not count');
check(/без тебе: 2/.test(weekText(w, 0)) && /на перевірці: 1/.test(weekText(w, 0)), true, 'the text says «без тебе: N» and what waits');

// a replan as a proposal
const { hasPlanWork, planDiff } = require(F + 'src/gamedev.js')._gdd;
const prevPlan = { milestones: [{ id: 'G1', name: 'Greybox', tasks: [{ id: 'G1.1' }, { id: 'G1.2' }] }] };
check([hasPlanWork(null, [{ status: 'done' }]), hasPlanWork(prevPlan, [{ id: 'G1.1', status: 'todo' }]), hasPlanWork(prevPlan, [{ id: 'G1.1', status: 'done' }]), hasPlanWork(prevPlan, [{ id: 'B1', kind: 'bug', status: 'done' }])],
  [false, false, true, false], 'a proposal only once the plan has worked-on tasks');
const old = [{ id: 'G1.1', milestone: 'G1', status: 'done', title: 'Сітка' }, { id: 'G1.2', milestone: 'G1', status: 'todo', title: 'Старе' }];
const np = { milestones: [{ id: 'G1', name: 'Greybox', tasks: [{ id: 'G1.1', title: 'Сітка' }, { id: 'G1.3', title: 'Хвилі', state: 'verify' }] }, { id: 'G2', name: 'Перший рівень', tasks: [] }] };
const d = planDiff(np, old, prevPlan);
check([d.add.map((x) => x.id + ':' + x.st), d.drop.map((x) => x.id), d.keep, d.msAdd], [['G1.3:verify'], ['G1.2'], 1, ['Перший рівень']], 'the diff: new tasks with their marks, unstarted removed, the rest kept');
check(np.milestones[0].tasks.length, 2, 'the diff does not touch the proposed plan');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exitCode = fails ? 1 : 0;
