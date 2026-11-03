// «Заповни світ своїми матеріалами» (functions/world-fill.js): the file is parsed strictly (bad JSON / other format / empty →
// refused), the merge matches by kind + name, fills only empty fields unless «replace», resolves links / who by name, keeps
// rules and facts unique, and never invents anything. Run: npm test
const F = require('../functions/world-fill.js');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
let seq = 0; const newId = (k) => k + '_' + (++seq);

check(F.parse('{oops').error === 'json', 'broken JSON is refused');
check(F.parse({ format: 'whitewrite.world/1', world: {} }).error === 'format', 'another format is refused');
check(F.parse({ format: F.FORMAT }).error === 'empty', 'an empty file is refused');
check(F.parse(JSON.stringify(F.TEMPLATE)).error === 'empty', 'the untouched template is empty (blank objects dropped)');
const p0 = F.parse({ characters: [{ name: 'Ліра' }] });
check(p0.data && p0.warnings.indexOf('noformat') >= 0, 'no format key: accepted with a warning');

const file = {
  format: F.FORMAT,
  world: { tagline: 'Світ туманів', summary: 'Довгий опис', rules: ['Магія має ціну', 'магія має ціну'], facts: [{ k: 'Столиця', v: 'Аркен' }, { k: 'Місяців', v: '2' }] },
  characters: [{ name: 'Ліра', desc: 'Мисливиця', story: 'Народилася в Аркені', role: 'героїня', life: [{ at: '12', text: 'Втратила брата' }], links: [{ to: 'Орден Попелу', rel: 'членкиня' }] },
               { name: 'Борн', desc: 'Коваль' }],
  locations: [{ name: 'Аркен', desc: 'Столиця', look: 'Сірі вежі' }],
  factions: [{ name: 'Орден Попелу', desc: 'Мисливці' }],
  events: [{ name: 'Падіння вежі', at: 301, when: '3-тя епоха', who: ['Ліра', 'Невідомий'], links: [{ to: 'Аркен', rel: 'місце' }] }],
  culture: { peoples: [{ name: 'Туманники', desc: 'Народ боліт', origin: 'Болота' }], customs: [{ name: '', desc: 'без назви' }] }
};
const parsed = F.parse(JSON.stringify(file)).data;
check(parsed.culture.customs.length === 0, 'an item without a name is dropped');

// an existing world: a short summary from the form, one rule, Ліра already there with a description
const cur = { world: { summary: 'Коротко', rules: ['Магія має ціну'], facts: [{ k: 'Столиця', v: 'Аркен' }] },
  entities: [{ id: 'char_a', kind: 'characters', name: 'Ліра', desc: 'Стара назва опису', dossier: {} }], lore: [] };
const pl = F.plan(parsed, cur, { newId });
check(pl.world.tagline === 'Світ туманів' && pl.world.summary === undefined, 'world: an empty tagline is filled, the filled summary is kept');
check(pl.kept.indexOf('world.summary') >= 0, 'the kept summary is reported');
check(!pl.world.rules && pl.counts.rules === 0, 'a rule already there (any case) is not added again');
check(pl.world.facts.length === 2 && pl.counts.facts === 1, 'a new fact is added, the same key is not doubled');
const lira = pl.writes.filter((w) => w.id === 'char_a')[0];
check(lira && !lira.isNew && lira.doc.desc === undefined && lira.doc.dossier.story === 'Народилася в Аркені', 'an existing character: same id, the desc kept, the empty biography filled');
check(lira.doc.lifeNotes.length === 1 && lira.doc.role === 'героїня', 'life notes and role are added');
const order = pl.writes.filter((w) => w.doc.name === 'Орден Попелу')[0];
check(order && order.isNew && lira.doc.relations[0].id === order.id && lira.doc.relations[0].kind === 'членкиня', 'a link to an entity further down the file resolves to its new id');
const ev = pl.writes.filter((w) => w.doc.title === 'Падіння вежі')[0];
check(ev && ev.doc.at === 301 && ev.doc.characters.length === 1 && ev.doc.characters[0] === 'char_a', 'an event: time kept as a number, who → known character ids only');
check(ev.doc.relations[0].id === pl.writes.filter((w) => w.doc.name === 'Аркен')[0].id, 'an event links its location');
check(ev.doc.origin.source === 'explicit' && ev.doc.slug === 'падіння-вежі', 'a new entity is explicit canon with a slug');
const people = pl.writes.filter((w) => w.col === 'lore')[0];
check(people && people.doc.group === 'peoples' && people.doc.fields.origin === 'Болота', 'culture goes to lore with its group fields');

const pr = F.plan(parsed, cur, { newId, replace: true });
check(pr.world.summary === 'Довгий опис' && pr.writes.filter((w) => w.id === 'char_a')[0].doc.desc === 'Мисливиця', '«replace»: filled fields take the file\'s value');

// the same file twice: the second run changes nothing
const after = { world: Object.assign({}, cur.world, pr.world), entities: cur.entities.concat(pr.writes.filter((w) => w.col === 'entities' && w.isNew).map((w) => w.doc)).map((e) => {
  const u = pr.writes.filter((w) => w.id === e.id && !w.isNew)[0]; return u ? Object.assign({}, e, u.doc) : e; }), lore: pr.writes.filter((w) => w.col === 'lore').map((w) => Object.assign({ id: w.id }, w.doc)) };
const again = F.plan(parsed, after, { newId, replace: true });
check(!again.world && again.writes.length === 0, 'importing the same file again writes nothing');

const txt = F.prompt('uk', 'D:\\Morra\\notes', 'Морра');
check(txt.indexOf('D:\\Morra\\notes\\whitewrite-world.json') >= 0 && txt.indexOf('"format": "whitewrite.fill/1"') >= 0 && txt.indexOf('Раса, вид чи народ — НЕ фракція') >= 0, 'the prompt names the folder, carries the template and the rules');
check(F.prompt('en', '').indexOf('that I attach') >= 0, 'no folder: the prompt asks for attached notes');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
