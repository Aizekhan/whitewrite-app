// ❓ The plan's questions through MCP (v2.157, mcp.js planQuestions / planAnswerApply): the open ones with the recommendation, blockers stop the
// plan, an answer goes into the plan and is appended to the question's card field (once), a contradiction into `resolved`. Run: npm test
const path = require('path');
const { planQuestions, planAnswerApply } = require(path.join(__dirname, '../functions/src/mcp.js'))._mcp;
let fails = 0; const check = (got, want, msg) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)); if (!ok) fails++; };

const plan = () => ({ gdd: { summary: 's' },
  asked: [{ id: 'q1', priority: 'blocker', question: 'Бізнес-модель?', options: ['F2P з пропусками', 'Платна'], rec: true, recWhy: 'Roblox', target: { card: 'c:ov', field: 'Бізнес-модель' } },
    { id: 'q2', priority: 'nice', question: 'Біоми?', options: [], target: { card: 'c:gone', field: 'x' } }],
  contradictions: [{ what: 'Брама прибрана, а урок 3 її лагодить', options: ['Переписати урок'], target: { card: 'c:ov', field: 'Нежить без брами' } }] });
let p = planQuestions(plan());
check([p.blockers_open, p.plan_ready, p.questions.length, p.questions[0].recommended, p.contradictions.length, /^t_/.test(p.contradictions[0].id)], [1, false, 2, 'F2P з пропусками', 1, true],
  'open questions with the recommendation; a blocker stops the plan; an old contradiction gets the Bible\'s id');

// a tiny game: plan/current + cards, merge writes with delete()
function game(pd, cards) {
  const docs = { 'plan/current': pd }; cards.forEach((c) => { docs['cards/' + c.id] = c; });
  const merge = (a, b) => { const o = { ...(a || {}) }; Object.entries(b).forEach(([k, v]) => { if (v && v.constructor && v.constructor.name === 'DeleteTransform') return void delete o[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v.constructor && /Transform/.test(v.constructor.name))) o[k] = merge(o[k], v); else if (v && v.constructor && /Transform/.test(v.constructor.name)) o[k] = 'TS'; else o[k] = v; }); return o; };
  const doc = (k) => ({ get: async () => ({ exists: !!docs[k], id: k.split('/')[1], data: () => docs[k] }), set: async (d) => { docs[k] = merge(docs[k], d); } });
  return { docs, collection: (c) => ({ doc: (id) => doc(c + '/' + id), where: (f, op, v) => ({ get: async () => ({ docs: Object.keys(docs).filter((k) => k.startsWith(c + '/') && docs[k][f] === v).map((k) => ({ id: k.split('/')[1], data: () => docs[k] })) }) }) }) };
}
(async () => {
  const g = game(plan(), [{ id: 'ov', section: 'overview', title: 'Огляд', defs: [{ key: 'f_бізнес_модель', label: 'Бізнес-модель' }], fields: { f_бізнес_модель: 'старе' } }]);
  const r = await planAnswerApply(g, 'q1', 'F2P з пропусками', 'Геймдизайнер');
  check([g.docs['plan/current'].answers.q1, g.docs['cards/ov'].fields.f_бізнес_модель, r.card && r.card.field], ['F2P з пропусками', 'старе\n\nF2P з пропусками', 'Бізнес-модель'], 'the answer → the plan and appended to the card field (as the Bible does)');
  await planAnswerApply(g, 'q1', 'F2P з пропусками', 'x');
  check(g.docs['cards/ov'].fields.f_бізнес_модель, 'старе\n\nF2P з пропусками', 'answering again does not append twice');
  check(planQuestions(g.docs['plan/current']).plan_ready, true, 'no blockers left → plan_ready');
  const cid = planQuestions(g.docs['plan/current']).contradictions[0].id;
  await planAnswerApply(g, cid, 'Урок 3 — полагодь мур', 'x');
  check([g.docs['plan/current'].resolved[cid], !!g.docs['cards/ov'].fields.f_нежить_без_брами, (g.docs['cards/ov'].defs || []).some((d) => d.label === 'Нежить без брами')], ['Урок 3 — полагодь мур', true, true], 'a contradiction → resolved, a new field with its label on the card');
  const r2 = await planAnswerApply(g, 'q2', 'Два біоми', 'x');
  check([g.docs['plan/current'].answers.q2, r2.card], ['Два біоми', null], 'a missing card: the answer stays in the plan');
  // v2.158 a list field of the overview (pillars) is never appended with prose
  const gp = game({ gdd: {}, asked: [{ id: 'qp', priority: 'important', question: 'Стовп?', target: { card: 'c:ov', field: 'Стовпи' } }] },
    [{ id: 'ov', section: 'overview', defs: [{ key: 'pillars', label: 'Стовпи гри (3–4)' }], fields: { pillars: 'Ніхто не сидить без діла\nКожна хвиля — рішення' } }]);
  const rp = await planAnswerApply(gp, 'qp', 'Стовп переписано', 'x');
  check([gp.docs['cards/ov'].fields.pillars, rp.list_field, gp.docs['plan/current'].answers.qp], ['Ніхто не сидить без діла\nКожна хвиля — рішення', 'pillars', 'Стовп переписано'], 'pillars: the answer stays in the plan, the list is untouched');
  // v2.158 the analysis table and its age, the template fields
  const { designReadiness, mechTemplate } = require(path.join(__dirname, '../functions/src/mcp.js'))._mcp;
  const dr = designReadiness({ plan: { gdd: { readiness: 40, sections: [{ title: 'Game feel', status: 'missing', notes: 'немає hitstop' }] }, analyzedAt: 1000, answeredAt: { a: 500, b: 2000 } },
    cards: [{ id: 'x', updatedAt: 3000 }, { id: 'y', updatedAt: 10 }] });
  check([dr.readiness, dr.areas[0].missing, dr.stale.answers_since, dr.stale.cards_changed_since, dr.templates.some((t) => t.id === 'game_feel')], [40, 'немає hitstop', 1, 1, true], 'readiness, what is missing, how stale, the templates');
  const tf = mechTemplate('game_feel');
  check([tf.sections[0].fields[0].key, tf.sections[0].fields[1].unit, tf.sections[0].fields[0].required], ['action', 'ms', 'required'], 'a template\'s fields with units and requirement');
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
