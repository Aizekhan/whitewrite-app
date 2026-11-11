// MCP subsections (functions/src/mcp.js v2.125): save_card puts a card into a subsection (fields.group / fields.category) — by `subsection`
// or by a field the agent named group / Група / Підрозділ — never as a field of its own; the standard names equal gamebible.js GAME groups.
// Run: npm test
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const bible = fs.readFileSync(path.join(__dirname, '../app/gamebible.js'), 'utf8');
const pick = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const NV = require('../functions/narrative-validate.js'), MECH = require('../functions/mechanics.js');
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } } };
const { saveCard, SUB_STD, subList } = new Function('NV', 'admin', 'MECH',
  pick('const str =', '// ---------- tools') + pick('async function narrative', '// 🎙') +
  pick('// ---------- ✎ writes on the user', 'async function callTool') +
  'function rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }' +
  ';return { saveCard, SUB_STD, subList };')(NV, admin, MECH);

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

// 1. the standard subsections are the Bible's
Object.keys(SUB_STD).forEach((id) => {
  const m = new RegExp('\\{ id: "' + id + '",[^\\n]*\\n\\s*groups: \\{ uk: (\\[[^\\]]*\\]), en: (\\[[^\\]]*\\]) \\}').exec(bible);
  if (!m) { check(false, true, `gamebible.js has groups for ${id}`); return; }
  const uk = JSON.parse(m[1]), en = JSON.parse(m[2]);
  check(JSON.stringify(SUB_STD[id]), JSON.stringify(uk.map((x, i) => [x, en[i]])), `${id}: the MCP subsections = the Bible's`);
});

// 2. save_card
const writes = [];
const gref = { collection: (col) => ({ doc: (id) => ({ set: async (body, opt) => { writes.push({ id, body }); } }) }) };
const ctx = { gref, game: { subsections: { mechanics: ['Своя група'] } }, entities: [],
  cards: [
    { id: 'w1', section: 'enemies', title: 'Wolf', defs: [{ key: 'f_group', label: 'group' }, { key: 'f_група', label: 'Група' }, { key: 'hp', label: 'HP' }], fields: { f_group: 'Звичайні вороги', f_група: '', hp: '10' } },
    { id: 'g1', section: 'enemies', title: 'Goblins', defs: [], fields: { group: 'Звичайні вороги' } },
    { id: 'm1', section: 'mechanics', title: 'Mentor', defs: [], fields: {} },
  ] };
const key = { prefix: 'wwk_ab12' };
const last = () => writes[writes.length - 1].body;
(async () => {
  let out = await saveCard(ctx, key, { ref: 'c:w1', fields: { group: 'Елітні вороги' } });
  let b = last();
  check(b.fields.group, 'Елітні вороги', 'a field named group sets the subsection field');
  check(b.fields.f_group + '|' + b.fields['f_група'], 'DEL|DEL', 'the stray group fields of earlier attempts are cleared');
  check(b.defs.map((d) => d.key).join(), 'hp', '…and leave the field list');
  check(out.subsection, 'Елітні вороги', 'the answer names the subsection');
  await saveCard(ctx, key, { ref: 'c:w1', subsection: 'bosses' });
  check(last().fields.group, 'Боси', 'subsection in English, any case → the Bible\'s name');
  await saveCard(ctx, key, { ref: 'c:w1', fields: { 'Підрозділ': 'Звичайні вороги', HP: '12' } });
  check(last().fields.group + '|' + last().fields.hp + '|' + ('f_підрозділ' in last().fields), 'Звичайні вороги|12|false', '«Підрозділ» is the subsection, the other fields still change');
  out = await saveCard(ctx, key, { section: 'enemies', title: 'Boss of the pass', subsection: 'Боси' });
  check(last().fields.group, 'Боси', 'a new card is born in its subsection');
  out = await saveCard(ctx, key, { ref: 'c:m1', subsection: 'Здібності' });
  check(last().fields.group, 'Навички й здібності', 'an old mechanics name → today\'s');
  out = await saveCard(ctx, key, { ref: 'c:m1', subsection: 'Економіка' });
  check(last().fields.group + '|' + !!out.new_subsection, 'Економіка й крафт|false', 'the start of one real name → that name');
  out = await saveCard(ctx, key, { ref: 'c:m1', subsection: 'Магія крові' });
  check(last().fields.group + '|' + (!!out.new_subsection && /Економіка й крафт/.test(out.new_subsection)), 'Магія крові|true', 'an unknown name is kept as a new one, the answer lists the real ones');
  check(subList(ctx, 'mechanics').indexOf('Своя група') >= 0, true, 'the author\'s own subsections are listed');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
