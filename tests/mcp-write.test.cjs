// MCP writes on the user's word (functions/src/mcp.js save_card / save_quest / save_dialogue, v2.117): field names → keys,
// a canon entity's game card, a new card takes the section's fields, the previous version kept for «↶ Повернути», the author's switch.
// Run: npm test
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const pick = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const NV = require('../functions/narrative-validate.js');
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
const { saveCard, saveNarrative } = new Function('NV', 'admin',
  pick('const str =', '// ---------- tools') + pick('async function narrative', '// 🎙') +
  pick('// ---------- ✎ writes on the user', 'async function callTool') +
  'function rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }' +
  ';return { saveCard, saveNarrative };')(NV, admin);

const writes = [];
const gref = { collection: (col) => ({ doc: (id) => ({ set: async (body, opt) => { writes.push({ col, id, body, merge: !!(opt && opt.merge) }); } }),
  get: async () => ({ docs: col === 'quests' ? [{ id: 'q1', data: () => ({ title: 'Old', approval: 'approved', stages: [{ id: 's1', end: true }] }) }]
    : col === 'dialogues' ? [{ id: 'd1', data: () => ({ title: 'Talk', approval: 'draft', nodes: [{ id: 'n1', text: 'Hi', voice: ['snd1'], vstatus: 'rec', end: true }] }) }] : [] }) }) };
const mk = (game) => ({ gref, game: game || {},
  entities: [{ id: 'char_a', kind: 'characters', name: 'Ada' }, { id: 'loc_1', kind: 'locations', name: 'Forge' }],
  cards: [
    { id: 'e1', section: 'enemies', title: 'Wolf', order: 1, defs: [{ key: 'hp', label: 'Здоровʼя' }, { key: 'look', label: 'Вигляд' }, { key: 'pic', label: 'Картинка', type: 'image' }], fields: { hp: '10' } },
    { id: 'e2', section: 'enemies', title: 'Bear', order: 2, defs: [], fields: { hp: '30' } },
    { id: 'char_a', section: 'characters', canonRef: 'char_a', title: 'Ada', defs: [], fields: { role: 'smith' } },
  ] });
const key = { prefix: 'wwk_ab12' };
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const err = async (f) => { try { await f(); return ''; } catch (e) { return e.message; } };
const last = () => writes[writes.length - 1];

(async () => {
  // update a game card by field labels
  let out = await saveCard(mk(), key, { ref: 'c:e1', fields: { 'здоровʼя': '25', 'Слабкість': 'вогонь', Картинка: 'x' }, status: 'agreed' });
  let w = last();
  check(w.id + ' ' + w.merge, 'e1 true', 'an update merges into the card');
  check(w.body.fields.hp + '|' + w.body.fields.f_слабкість, '25|вогонь', 'a label (any case) maps to its key, a new name becomes a new field');
  check(w.body.defs.map((d) => d.key).join(), 'hp,look,pic,f_слабкість', 'the new field joins the card\'s field list');
  check((out.not_changed_file_fields || []).join(), 'Картинка', 'a picture field is not written with text');
  check(w.body.agentPrev.fields.hp + '|' + w.body.agentPrev.status, '10|null', 'the previous version is kept for undo');
  check(w.body.status + ' ' + w.body.agentKey, 'agreed wwk_ab12', 'status and the key that wrote it');

  // a card with no own field list keeps the section's when one is added
  await saveCard(mk(), key, { ref: 'c:e2', fields: { Вигляд: 'бурий' } });
  check(last().body.defs.map((d) => d.key).join() + '|' + last().body.fields.look, 'hp,look,pic|бурий', 'an empty field list is seeded from the section');

  // create
  out = await saveCard(mk(), key, { section: 'enemies', title: 'Boar', fields: { 'Здоровʼя': '15' } });
  w = last();
  check(out.created + ' ' + /^c:card_/.test(out.ref), 'true true', 'a new card gets an id');
  check(w.body.defs.length + '|' + w.body.fields.hp + '|' + w.body.status + '|' + w.body.agentPrev._new, '3|15|idea|true', 'a new card takes the latest card\'s fields of the section');
  check(/section must be/.test(await err(() => saveCard(mk(), key, { section: 'plan', title: 'X' }))), true, 'no cards in the plan / unknown sections');
  check(/needs a title/.test(await err(() => saveCard(mk(), key, { section: 'enemies' }))), true, 'a new card needs a title');
  check(/status must be/.test(await err(() => saveCard(mk(), key, { ref: 'c:e1', status: 'done' }))), true, 'only the Bible statuses');

  // canon entity through this game
  out = await saveCard(mk(), key, { ref: 'e:char_a', fields: { role: 'blacksmith' }, note: 'n' });
  check(last().id + '|' + last().body.canonRef + '|' + last().body.fields.role + '|' + last().body.note, 'char_a|char_a|blacksmith|n', 'a canon entity changes its game card (an existing field key)');
  out = await saveCard(mk(), key, { ref: 'e:loc_1', fields: { Клімат: 'сухий' } });
  check(last().id + '|' + last().body.section + '|' + last().body.title + '|' + out.created_game_card, 'loc_1|locations|Forge|true', 'a canon entity without a game card gets one');
  check(/World Bible/.test(await err(() => saveCard(mk(), key, { ref: 'e:char_a', title: 'Queen Ada' }))), true, 'a canon name is renamed only in the World Bible');

  // the author's switch
  check(/turned off/.test(await err(() => saveCard(mk({ agentWrite: false }), key, { ref: 'c:e1', note: 'x' }))), true, 'agentWrite: false stops every write');

  // quests
  out = await saveNarrative(mk(), key, 'quests', { title: 'Hunt', giver: 'Ada', locations: ['Forge', 'c:e1'], stages: [{ id: 's1', title: 'Go', next: [{ to: 's2' }] }, { id: 's2', end: true }] });
  w = last();
  check(w.col + '|' + w.body.approval + '|' + w.body.giver + '|' + w.body.locations.join(), 'quests|draft|char_a|loc_1,c:e1', 'a new quest: draft, names resolved to refs');
  check(out.checks.filter((c) => c.level === 'error').length, 0, 'a sound quest has no errors');
  out = await saveNarrative(mk(), key, 'quests', { id: 'q1', summary: 'new' });
  w = last();
  check(w.body.summary + '|' + (w.body.approval === undefined) + '|' + w.body.agentPrev.title + '|' + w.body.agentPrev.summary, 'new|true|Old|null', 'an update changes only what was sent, approval stays the author\'s, the old version kept');
  check(/No quest/.test(await err(() => saveNarrative(mk(), key, 'quests', { id: 'q9', title: 'x' }))), true, 'an unknown id is refused');

  // dialogues: the voice-over stays with its line
  await saveNarrative(mk(), key, 'dialogues', { id: 'd1', nodes: [{ id: 'n1', speaker: 'Ada', text: 'Hello', end: true }] });
  w = last();
  check(w.body.nodes[0].speaker + '|' + w.body.nodes[0].voice.join() + '|' + w.body.nodes[0].vstatus, 'char_a|snd1|rec', 'a rewritten line keeps its recorded voice');

  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
