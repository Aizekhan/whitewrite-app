// Bugs as tasks + the decision log (functions/src/mcp.js, v2.78.1): report_bug is idempotent and respects the gates,
// get_next_task takes open S1/S2 bugs first, an open S1 keeps a gate from being ready, decisions merge newest first.
// Run: npm test
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const pick = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
const M = new Function('admin', 'crypto',
  pick('const OPEN =', '// ---------- tools') + pick('function lockedBy', 'function taskView') + src.match(/^const sha1 = .*$/m)[0] +
  '\nfunction rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }' +
  '\nconst logged = []; async function logExecution(ctx, key, type, taskId, data) { logged.push(type + ":" + taskId); }' +
  '\nreturn { pickNext, gatesView, reportBug, decisionLog, logged };')(admin, crypto);

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const fakeGame = (world) => {
  const store = world || {};
  return { store, collection: () => ({ doc: (id) => ({
    create: async (d) => { if (store[id]) { const e = new Error('6 ALREADY_EXISTS: Document already exists'); e.code = 6; throw e; } store[id] = d; },
    get: async () => ({ data: () => store[id] }) }) }) };
};
const ms = [{ id: 'G0', track: 'mvp', name: 'Setup' }, { id: 'G1', track: 'mvp', name: 'Greybox' }];
const mkCtx = (tasks, gates = {}) => ({ plan: { plan: { gated: true, milestones: ms }, gates }, tasks, cards: [], gref: fakeGame() });
const all = () => true;

(async () => {
  // ---- get_next_task priority
  const base = [{ id: 'G0.1', milestone: 'G0', status: 'todo', order: 1 }, { id: 'G0.2', milestone: 'G0', status: 'rework', order: 2 },
    { id: 'B3', milestone: 'G0', kind: 'bug', severity: 's3', status: 'todo', order: 8002 }, { id: 'B2', milestone: 'G0', kind: 'bug', severity: 's2', status: 'todo', order: 8001 },
    { id: 'B1', milestone: 'G0', kind: 'bug', severity: 's1', status: 'todo', order: 8000 }, { id: 'BL', milestone: 'G1', kind: 'bug', severity: 's1', status: 'todo' }];
  check(M.pickNext(mkCtx(base), all).id, 'B1', 'an open S1 bug goes first');
  check(M.pickNext(mkCtx(base.filter((t) => t.id !== 'B1')), all).id, 'B2', 'then S2, before rework and todo');
  check(M.pickNext(mkCtx(base.filter((t) => !['B1', 'B2'].includes(t.id))), all).id, 'G0.2', 'S3 bugs wait: rework comes next');
  check(M.pickNext(mkCtx(base.concat([{ id: 'G0.9', milestone: 'G0', status: 'in_progress' }])), all).id, 'G0.9', 'a task in progress is resumed before any bug');
  check(M.pickNext(mkCtx(base.filter((t) => t.id === 'BL')), all), null, 'a bug in a milestone locked by a gate is not taken');
  check(M.pickNext(mkCtx(base), (t) => t.id !== 'B1').id, 'B2', 'a bug assigned to someone else is left to them');

  // ---- gates: an open S1 keeps a gate from being ready (a warning), retro rides along
  const done = [{ id: 'G0.1', milestone: 'G0', status: 'done' }, { id: 'B1', milestone: 'G0', kind: 'bug', severity: 's1', status: 'review' }];
  let g = M.gatesView(mkCtx(done))[0];
  check(g.ready + '|' + g.open_bugs.s1.join() + '|' + !!g.warning, 'false|B1|true', 'an open S1 bug: the gate is not ready, with a warning');
  g = M.gatesView(mkCtx(done.map((t) => ({ ...t, status: 'done' })), { G0: { status: 'approved', retro: { kept: 'jump' } } }))[0];
  check(g.ready + '|' + g.status + '|' + g.retro.kept, 'true|approved|jump', 'all done, no S1: ready; the retro is shown');
  check(M.gatesView({ plan: { plan: { milestones: ms } }, tasks: [] }).length, 0, 'an ungated plan has no gate view');

  // ---- report_bug: idempotent, milestone from the task, locked milestones refused
  const ctx = mkCtx([{ id: 'G0.1', milestone: 'G0', status: 'in_progress' }]);
  const a = await M.reportBug(ctx, {}, { title: 'Falls through floor', severity: 's1', repro: '1. Jump\n2. Land', expected: 'lands', actual: 'falls', cards: ['c:floor', 'bad ref', 'e:loc_1'], client_key: 'k1' });
  const doc = ctx.gref.store[a.id];
  check(a.ok && a.milestone, 'G0', 'the bug goes to the milestone of the task in progress');
  check(doc.kind + '|' + doc.severity + '|' + doc.status + '|' + doc.foundIn, 'bug|s1|todo|agent', 'a bug task: kind, severity, todo, found by the agent');
  check(doc.cards.join(), 'c:floor,e:loc_1', 'card refs are kept, junk dropped');
  const b = await M.reportBug(mkCtx([]), {}, { title: 'Other title', severity: 's2', repro: 'x', client_key: 'k1' });
  check(b.id, a.id, 'the same client_key gives the same id');
  const ctx2 = mkCtx([]); ctx2.gref = fakeGame(ctx.gref.store);
  const c = await M.reportBug(ctx2, {}, { title: 'Falls through floor', severity: 's1', repro: 'again', client_key: 'k1' });
  check(c.duplicate === true && Object.keys(ctx.gref.store).length === 1, true, 'reported twice → one task (idempotent)');
  const d = await M.reportBug(mkCtx([]), {}, { title: 'No key', severity: 'zz', repro: 'steps' });
  check(d.severity + '|' + d.milestone, 's3|G0', 'an unknown severity → s3; no task → the open gate');
  let err = ''; try { await M.reportBug(mkCtx([]), {}, { title: 'x', severity: 's1', repro: 'y', milestone: 'G1' }); } catch (e) { err = e.message; }
  check(/closed until the author approves the gate G0/.test(err), true, 'a bug against a milestone locked by a gate is refused');
  err = ''; try { await M.reportBug(mkCtx([]), {}, { title: 'x', severity: 's1' }); } catch (e) { err = e.message; }
  check(/needs title and repro/.test(err), true, 'a bug without repro steps is refused');

  // ---- decision log: merged, newest first, capped
  const log = M.decisionLog({
    plan: { asked: [{ id: 'q1', question: 'Camera?' }, { id: 'q2', question: 'Open?' }], answers: { q1: 'Third person' }, answeredAt: { q1: 1000 },
      plan: { milestones: ms }, gates: { G0: { status: 'approved', at: 5000, retro: { kept: 'a', cut: 'b', learned: 'c' } }, G1: { status: 'returned', at: 6000 } } },
    cards: [{ id: 'm1', title: 'Combat', updatedAt: 3000, mech: { fw: { decisions: { parry: 'game', warp: '' } } } }],
  }, [{ id: 'cr1', what: 'Bigger arena', status: 'accepted', decidedAt: { toMillis: () => 4000 } }, { id: 'cr2', what: 'Open', status: 'open' }],
  [{ id: 'e1', hypothesis: 'Shorter tutorial', status: 'done', decision: 'ship', decisionNote: 'B wins', decidedAt: 2000 }, { id: 'e2', status: 'running' }]);
  check(log.map((x) => x.type).join(), 'gate,change_request,framework_gap,experiment,question', 'every kind of decision, newest first');
  check(log[0].retro.learned + '|' + log[3].decision + '|' + log[4].decision, 'c|ship|Third person', 'retro, the A/B outcome and the answer are kept');
  check(log.some((x) => /G1|Open/.test(x.title)), false, 'returned gates, open requests, running experiments and unanswered questions are not decisions');
  check(M.decisionLog({ plan: { asked: Array.from({ length: 80 }, (_, i) => ({ id: 'q' + i, question: 'Q' + i })), answers: Object.fromEntries(Array.from({ length: 80 }, (_, i) => ['q' + i, 'a'])) }, cards: [] }, [], []).length, 50, 'capped at 50');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})();
