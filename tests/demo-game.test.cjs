// 🎓 the demo game «Ліхтарник» (functions/demo-game.js, v2.146): every required GDD stage filled, a model example — no design warnings,
// constructor cards without issues, a clean quest and dialogue, the ladder and the plan pointing at real cards; the server keeps it
// outside the plan's limit and the rules keep .demo server-only. Run: npm test
const fs = require('fs'), path = require('path');
const D = require('../functions/demo-game.js'), G = require('../functions/gdd-schema.js'), M = require('../functions/mechanics.js');
const DS = require('../functions/design-checks.js'), N = require('../functions/narrative-validate.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

for (const lang of ['uk', 'en']) {
  const d = D.build(lang), ids = new Set(d.cards.map((c) => 'c:' + c.id));
  const count = (id) => (id === 'plan' ? (d.plan.milestones.length ? 1 : 0) : id === 'quests' ? d.quests.length : id === 'dialogues' ? d.dialogues.length : d.cards.filter((c) => c.data.section === id).length);
  check(G.STAGES.filter((s) => !s.optional).map((s) => G.stageState(s, count)).join(','), G.STAGES.filter((s) => !s.optional).map(() => 'done').join(','), `${lang}: every required stage is done`);
  const cs = d.cards.map((c) => Object.assign({ id: c.id, key: 'c:' + c.id }, c.data));
  const st = DS.status(cs, lang);
  check(st.issues.filter((i) => i.level === 'warn').map((i) => i[lang]).join(' | '), '', `${lang}: no design warnings (pillars, aesthetics, ladder, risk)`);
  check(st.pillars.pillars.length, 3, `${lang}: three pillars read from the overview`);
  check(st.ladder.levels.length, 4, `${lang}: four levels on the ladder`);
  M.setCardNamer((t) => t, () => cs);
  check(cs.filter((c) => c.mech).map((c) => c.title + ':' + M.check(c.mech).issues.filter((x) => x.level !== 'tip').length).join(','), cs.filter((c) => c.mech).map((c) => c.title + ':0').join(','), `${lang}: constructor cards have no issues`);
  const q = Object.assign({ id: d.quests[0].id }, d.quests[0].data), dl = Object.assign({ id: d.dialogues[0].id }, d.dialogues[0].data);
  const refs = { entities: N.refPool([], cs), quests: [q] };
  check(N.validateQuest(q, refs).filter((x) => x.level === 'error').length + N.validateDialogue(dl, refs).filter((x) => x.level === 'error').length, 0, `${lang}: the quest and the dialogue have no graph errors`);
  const pointed = [].concat(...cs.map((c) => ((c.intent && c.intent.ladder) || []).map((x) => 'c:' + x.m)), ...d.tasks.map((t) => t.cards), [q.giver], dl.participants);
  check(pointed.filter((r) => !ids.has(r)).join(','), '', `${lang}: the ladder, the tasks, the giver and the speakers point at demo cards`);
  check(d.cards.length + d.quests.length + d.dialogues.length + d.tasks.length + 1 < 500, true, `${lang}: one Firestore batch is enough`);
}
check(D.build('en').cards.find((c) => c.id === 'demo_overview').data.title, 'Lamplighter', 'English text for an English author');
const proj = fs.readFileSync(path.join(__dirname, '../functions/src/projects.js'), 'utf8');
check(/where\('demo', '==', true\)/.test(proj) && /DEMO_EXISTS/.test(proj) && /!demo && count >= limit/.test(proj), true, 'createGame: the demo is outside the limit, one per author');
const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
check(/'auditRunning', 'demo'\]/.test(rules), true, 'firestore.rules: games/{g}.demo is server-only');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
