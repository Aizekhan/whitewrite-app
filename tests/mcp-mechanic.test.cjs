// MCP save_mechanic (functions/src/mcp.js v2.132.0): the agent fills a constructor mechanic — a skill tree's points and nodes,
// typed values, links between rows by name, the author's own field; the previous version is kept for «↶ Скасувати».
// Run: npm test
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const pick = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const NV = require('../functions/narrative-validate.js'), MECH = require('../functions/mechanics.js');
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL', arrayUnion: (v) => ['UNION', v] } } };
const { saveMechanic } = new Function('NV', 'admin', 'MECH',
  pick('const str =', '// ---------- tools') + pick('async function narrative', '// 🎙') +
  pick('// ---------- ✎ writes on the user', 'async function callTool') +
  'function rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }' +
  ';return { saveMechanic };')(NV, admin, MECH);

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const writes = [];
const gref = { set: async () => {}, collection: () => ({ doc: (id) => ({ set: async (body) => { writes.push({ id, body }); } }) }) };
const mech = JSON.parse(JSON.stringify(MECH.instantiate('prog_skilltree', 'uk')));
mech.sections.find((s) => s.id === 'nodes').rows[0].icon = { id: 'f1', url: 'u' };
const firstId = mech.sections.find((s) => s.id === 'nodes').rows[0]._id;
const ctx = { gref, game: {}, entities: [], cards: [
  { id: 't1', section: 'progression', title: 'Дерево навичок', status: 'idea', fields: { group: 'Дерева' }, mech },
  { id: 'h1', section: 'characters', title: 'Герой', fields: {} },
] };
const key = { prefix: 'wwk_ab12' };
(async () => {
  const out = await saveMechanic(ctx, key, { ref: 'Дерево навичок', status: 'ingame', purpose: 'Три гілки', sections: [
    { id: 'points', values: { 'Очок за рівень': '2', maxLevel: 10, respec: 'немає', owner: 'Герой' }, add_fields: [{ label: 'Очки за вбивство героя', type: 'num' }] },
    { id: 'points', values: { 'Очки за вбивство героя': 5 } },
    { id: 'Дерево', rows: [
      { id: firstId, name: 'Друге дихання', cost: 1, ranks: 3, effect: '+10% витривалості' },
      { name: 'Крила', kind: 'Ключовий вузол', cost: 3, effect: 'Політ', needs: ['Друге дихання'], branch: 'Прокачка себе' },
      { name: 'Зайвий', cost: 'багато', needs: 'Нема такого' },
    ] },
  ] });
  const b = writes[writes.length - 1].body, pts = b.mech.sections.find((s) => s.id === 'points'), nodes = b.mech.sections.find((s) => s.id === 'nodes');
  check(b.status + '|' + b.mech.purpose + '|' + b.fields.text, 'ingame|Три гілки|Три гілки', 'status, purpose (and the card text) change');
  check(pts.values.perLevel, 2, 'a value by its label, typed as a number');
  check(pts.values.maxLevel + '|' + pts.values.respec, '10|none', 'a choice by its label → its value');
  check(JSON.stringify(pts.values.owner), '["h1"]', 'a card field by the card title → its id');
  const own = pts.fields.find((f) => f.custom);
  check(own && own.l + '|' + own.t + '|' + pts.values[own.k], 'Очки за вбивство героя|num|5', 'an own field is added and filled');
  check(nodes.rows.length, 3, 'the rows sent are the table now (the template nodes are gone)');
  check(nodes.rows[0].name + '|' + (nodes.rows[0].icon && nodes.rows[0].icon.id), 'Друге дихання|f1', 'a row by its id keeps what was not sent (its emblem)');
  check(JSON.stringify(nodes.rows[1].needs), JSON.stringify([firstId]), 'needs by a node name → its id');
  check(nodes.rows[1].kind, 'keystone', 'a node kind by its label');
  check(nodes.rows[2].cost === undefined && (out.not_changed || []).some((w) => /not a number/.test(w)), true, 'a non-number is reported, not stored');
  check((out.not_changed || []).some((w) => /no row "Нема такого"/.test(w)), true, 'an unknown required node is reported');
  check(b.agentPrev.status + '|' + (b.agentPrev.mech.sections.find((s) => s.id === 'nodes').rows.length > 3), 'idea|true', 'the previous version is kept for undo');
  check(b.agentKey, 'wwk_ab12', 'the key that wrote it');
  const e1 = await saveMechanic(ctx, key, { ref: 'c:nope', purpose: 'x' }).then(() => '', (e) => e.message);
  check(/No constructor mechanic/.test(e1), true, 'an unknown mechanic is refused');
  const e2 = await saveMechanic({ ...ctx, game: { agentWrite: false } }, key, { ref: 'c:t1', purpose: 'x' }).then(() => '', (e) => e.message);
  check(/turned off/.test(e2), true, 'the author can turn agent writes off');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch((e) => { console.log('FAIL', e.stack); process.exit(1); });
