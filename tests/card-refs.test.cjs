// «What points at a card» (functions/card-refs.js): every kind of reference resolves both ways where it should, and the
// registry covers the reference fields the data model has. Run: npm test
const path = require('path');
const F = path.join(__dirname, '../functions');
const REFS = require(path.join(F, 'card-refs.js'));
const NV = require(path.join(F, 'narrative-validate.js'));
const MECH = require(path.join(F, 'mechanics.js'));

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

const G = {
  cards: [
    { id: 'hero', section: 'characters', title: 'Ліра', forge: { loadouts: [{ name: 'Бій', items: { hand: 'sword' } }] } },
    { id: 'sword', section: 'items', title: 'Меч', forge: { owners: ['hero'] } },
    { id: 'jump', section: 'mechanics', title: 'Стрибок', mech: { links: ['dash'], sections: [] } },
    { id: 'dash', section: 'mechanics', title: 'Ривок', mech: { links: [], sections: [] } },
    { id: 'snd', section: 'audio', title: 'Удар меча' },
    { id: 'music', section: 'audio', title: 'Музика бою', mech: { sections: [{ id: 's', kind: 'table', fields: [{ k: 'track', t: 'sound', l: 'Трек' }], rows: [{ _id: 'r1', track: ['snd'] }] }] } },
    { id: 'cave', section: 'levels', title: 'Печера', planTask: 'M1.2' },
    { id: 'rina', section: 'characters', canonRef: 'char_rina', title: '' },
    { id: 'st0', section: 'artstyle', title: 'Загальний', order: 1, fields: {} },
    { id: 'st1', section: 'artstyle', title: 'Підземелля', order: 2, fields: { group: 'Біоми', places: 'Печера' } },
    { id: 'gone', section: 'items', title: 'Схований', hidden: true, forge: { owners: ['hero'] } },
  ],
  entities: [{ id: 'char_rina', kind: 'characters', name: 'Ріна' }],
  quests: [{ id: 'q1', title: 'Втрачений меч', giver: 'c:hero', characters: ['char_rina'], source: { type: 'card', id: 'sword' } }],
  dialogues: [{ id: 'd1', title: 'Розмова', participants: ['c:hero', 'char_rina'], nodes: [{ id: 'n1', speaker: 'c:hero', voice: ['snd'] }, { speaker: 'player' }] }],
  tasks: [{ id: 'M1.1', status: 'review' }],
  plan: { milestones: [{ id: 'G1', tasks: [{ id: 'M1.1', title: 'Бій мечем', cards: ['c:sword', 'new:Печера', 'new:Щит'] }, { id: 'M1.2', title: 'Greybox печери', cards: [] }] }] },
};
const rows = (key) => REFS.usedBy(G, key, 'uk').map((r) => r.kind + ':' + r.side + ':' + (r.from.title || r.from.key)).sort().join(' | ');

check(rows('c:hero'), 'dialogue:in:Розмова | loadout:out:Меч | owner:in:Меч | quest:in:Втрачений меч', 'a character: quest giver, dialogue, its item (owner) and loadout');
check(rows('c:sword'), 'loadout:in:Ліра | owner:out:Ліра | quest:in:Втрачений меч | task:in:Бій мечем', 'an item: the quest made from it, the task, owner and loadout');
check(rows('e:char_rina'), 'dialogue:in:Розмова | quest:in:Втрачений меч', 'a canon character (plain id in quests) is the e: key');
check(rows('c:jump') + ' / ' + rows('c:dash'), 'mech:out:Ривок / mech:in:Стрибок', 'mechanic links both ways');
check(rows('c:snd'), 'slot:in:Музика бою | voice:in:Розмова', 'an audio card: Sound factory slot and a voice line');
check(rows('c:cave'), 'style:out:Підземелля | task:in:Greybox печери | task:in:Бій мечем', 'a level: planTask, a "new:" plan ref matched by title, its style biome');
check(rows('c:st1'), 'style:in:Печера', 'a biome lists what it styles');
check(REFS.usedBy(G, 'c:sword', 'uk').filter((r) => r.kind === 'task')[0].from.status, 'review', 'a task carries its live status');
check(rows('c:hero').indexOf('Схований'), -1, 'hidden cards point nowhere');
check(REFS.usedBy(G, 'c:sword', 'en').filter((r) => r.kind === 'owner')[0].label, 'Item owner', 'labels in English for MCP');

// a mechanic's card field: a picked id or a typed title both point at the card, an unknown title points nowhere (v2.78)
const G2 = { cards: [{ id: 'lvl', section: 'levels', title: 'Ліс' }, { id: 'pot', section: 'items', title: 'Зілля' },
  { id: 'eco', section: 'mechanics', title: 'Економіка', mech: { tpl: 'economy', sections: [{ id: 'loot', kind: 'table', rowLabel: 'item', fields: [{ k: 'item', t: 'card', l: 'Предмет' }], rows: [{ _id: 'LT1', item: ['pot'] }, { _id: 'LT2', item: 'ліс, Немає' }] }] } }] };
check(REFS.usedBy(G2, 'c:pot', 'uk').map((r) => r.kind + ':' + r.side + ':' + r.from.title + ':' + r.extra).join(), 'mechcard:in:Економіка:Предмет', 'a picked card in a mechanic (a row named by the link shows the field)');
check(REFS.usedBy(G2, 'c:lvl', 'uk').map((r) => r.kind + ':' + r.from.title).join(), 'mechcard:Економіка', 'a typed title resolves to the card');
check(REFS.usedBy(G2, 'c:eco', 'uk').map((r) => r.side + ':' + r.from.title).sort().join(), 'out:Зілля,out:Ліс', 'the mechanic lists the cards it points at');

// a bug task (kind 'bug', MCP report_bug) lives only in tasks/, outside the plan — it still shows in «🔗 Що зачепить зміна» (v2.78.1)
const G3 = Object.assign({}, G, { tasks: G.tasks.concat([{ id: 'BUG-1', kind: 'bug', severity: 's1', milestone: 'G1', status: 'todo', title: 'Меч проходить крізь стіну', cards: ['c:sword'] }, { id: 'M1.1', cards: ['c:hero'] }]) });
const bug = REFS.usedBy(G3, 'c:sword', 'uk').filter((r) => r.from.id === 'BUG-1')[0];
check(bug && bug.kind + ':' + bug.from.kind + ':' + bug.from.severity + ':' + bug.extra, 'task:bug:s1:bug S1', 'a bug task points at its card with kind + severity');
check(REFS.usedBy(G3, 'c:hero', 'uk').some((r) => r.kind === 'task'), false, 'a plan task doc is read from the plan only (no double edges)');

// coverage: every reference field of the data model is a kind of the registry
const covered = [].concat(...REFS.KINDS.map((k) => k.fields));
const KNOWN = NV.REF_FIELDS.map((k) => 'quest.' + k).concat(['quest.source', 'dialogue.participants', 'dialogue.location', 'dialogue.nodes.speaker', 'dialogue.nodes.voice',
  'plan.milestones.tasks.cards', 'card.planTask', 'tasks.cards (bug)', 'card.mech.links', 'card.mech.sections[sound field]', 'card.mech.sections[card field]', 'card.forge.owners', 'card.forge.loadouts.items', 'card.fields.places (artstyle)']);
KNOWN.forEach((f) => check(covered.indexOf(f) >= 0, true, 'covered: ' + f));
check(MECH.TYPES.filter((t) => ['sound', 'card'].indexOf(t) < 0 && /ref|card|sound|audio/i.test(t)).filter((t) => t !== 'ref' && t !== 'refs').join(), '',
  'mechanics field types pointing at cards are all known (ref / refs point at rows of the same mechanic)');
check(REFS.KINDS.every((k) => k.uk && k.en && typeof k.edges === 'function' && k.fields.length), true, 'every kind has labels, fields and edges');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
