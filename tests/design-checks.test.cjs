// 🏛 🪜 ⚠ design checks across cards (functions/design-checks.js, v2.144): a feature serves a pillar of «Огляд гри» (or goes against an
// anti-pillar), the target MDA aesthetics are supported, the learning ladder never uses a mechanic before teaching it, the riskiest
// assumption is written. Run: npm test
const D = require('../functions/design-checks.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

check(D.listOf('1. Вагомий бій — кожен удар відчувається\n2. Дослідження без карти').map((p) => p.name).join('|'), 'Вагомий бій|Дослідження без карти', 'numbered lines; the name stops at « — »');
check(D.listOf('Бій, Дослідження, Атмосфера').length + '|' + D.listOf('- **Тиша**: самотність; - Ритм').map((p) => p.name).join('|'), '3|Тиша|Ритм', 'short comma parts, bullets, bold and «;»');

const ov = { id: 'ov', section: 'overview', fields: { pillars: 'Вагомий бій\nДослідження без карти\nТиша', anti: 'Гринд; PvP', aesthetics: 'Виклик, відкриття', risk: '', riskTest: '' } };
const cards = () => [ov,
  { id: 'jump', section: 'mechanics', title: 'Стрибок', intent: { pillars: ['Дослідження без карти'], aesthetics: ['discovery'] } },
  { id: 'hit', section: 'mechanics', title: 'Атака', intent: { pillars: ['вагомий бій'], against: ['Гринд'] } },
  { id: 'craft', section: 'mechanics', title: 'Крафт' },
  { id: 'rel', section: 'mechanics', title: 'Чекліст релізу', mech: { tpl: 'release' } },
  { id: 'l1', section: 'levels', title: 'Берег', order: 1, intent: { pillars: ['Тиша'], ladder: [{ m: 'jump', step: 'intro' }, { m: 'hit', step: 'test' }] } },
  { id: 'l2', section: 'levels', title: 'Ліс', order: 2, intent: { pillars: ['Вагомий бій'], ladder: [{ m: 'hit', step: 'intro' }, { m: 'jump', step: 'twist' }] } }];

const pm = D.pillarMap(cards(), 'uk'), warns = (l, re) => l.filter((i) => i.level === 'warn' && (!re || re.test(i.uk)));
check(pm.pillars.map((p) => p.name + ':' + p.cards.join('+')).join(), 'Вагомий бій:hit+l2,Дослідження без карти:jump,Тиша:l1', 'a pillar named in another case still matches; who supports each');
check(warns(pm.issues, /не служить/).map((i) => i.ref).join(), 'c:craft', 'a feature serving no pillar (the release checklist is a document, not a feature)');
check(warns(pm.issues, /анти-стовпу «Гринд»/).length, 1, 'a feature going against an anti-pillar');
check(warns(pm.issues, /Естетика «Виклик»/).length + '|' + warns(pm.issues, /Відкриття/).length, '1|0', 'a target aesthetic nothing supports; a supported one is fine');

const lad = D.ladder(cards(), 'uk');
check(lad.levels.map((l) => l.id).join() + '|' + lad.mechanics.find((m) => m.id === 'hit').cells.l1.join(), 'l1,l2|test', 'levels in order; the matrix cell');
check(warns(lad.issues, /раніше, ніж навчили/).map((i) => i.ref).join(), 'c:hit', 'tested on the shore before it is introduced in the forest');
check(warns(lad.issues, /більше ніколи/).map((i) => i.ref).join(), 'c:hit', 'introduced last and never used again');
check(warns(lad.issues).some((i) => i.ref === 'c:jump'), false, 'jump: introduced, then twisted — a good ladder');
check(lad.issues.some((i) => i.ref === 'c:craft' && i.level === 'tip'), true, 'a mechanic on no level is a tip');
const withLink = cards(); withLink[5] = Object.assign({}, withLink[5], { intent: { ladder: [] }, links: [{ to: 'c:hit', role: 'introduces' }] });
check(D.ladder(withLink, 'uk').mechanics.find((m) => m.id === 'hit').cells.l1.join(), 'intro', 'a link_cards «introduces» link counts as an intro step');

check(D.riskOf(cards()).issues[0].level, 'warn', 'no riskiest assumption — a warning');
ov.fields.risk = 'Бій на трьох зонах влучання не набридає за 20 хвилин';
check(D.riskOf(cards()).issues[0].level, 'tip', 'the assumption without a prototype test — a tip');
ov.fields.riskTest = 'Арена з 3 ворогами, 20 хв, гравець сам хоче ще';
check(D.riskOf(cards()).issues.length, 0, 'both written — clean');
check(JSON.stringify(D.cleanIntent({ pillars: [' Бій ', ''], aesthetics: ['challenge', 'nope', 'challenge'], ladder: [{ m: 'a', step: 'intro' }, { m: '', step: 'test' }, { m: 'b', step: 'x' }] })),
  '{"pillars":["Бій"],"aesthetics":["challenge"],"ladder":[{"m":"a","step":"intro"}]}', 'the agent\'s input is cleaned');
check(D.status([], 'en').issues.length, 2, 'an empty game: no pillars, no risk');

// v2.149.2: the author's / an agent's own fields (save_card made f_стовпи …) are read when the standard one is empty (KrumaTD: pillars = [])
const own = [{ id: 'ov', section: 'overview', fields: { f_пілари: '', f_стовпи: 'Трикутник — три шляхи\nТуман війни', f_найризикованіше_припущення: 'Дітям цікаво щоночі вирішувати',
  f_як_прототип_перевірить: '10 хв гри', f_цільові_естетики: 'виклик, фантазія', f_анти_стовпи: 'Не про гринд' }, defs: [{ key: 'f_стовпи', label: 'Стовпи' }] },
  { id: 'm1', section: 'mechanics', title: 'Шляхи', intent: { pillars: ['Трикутник'] } }];
check(D.pillarsOf(own).map((p) => p.name).join('|'), 'Трикутник|Туман війни', 'pillars from the own «Стовпи» field (an empty «Пілари» is skipped)');
check(D.riskOf(own).risk + '|' + D.riskOf(own).test, 'Дітям цікаво щоночі вирішувати|10 хв гри', 'the risk and the prototype test from own fields');
check(D.targetAesthetics(own).join(','), 'fantasy,challenge', 'target aesthetics from an own field');
check(D.antiOf(own).map((p) => p.name).join(), 'Не про гринд', 'anti-pillars are not taken as pillars');
check(D.status(own, 'uk').pillars.features[0].stale.length, 0, 'a card naming the pillar is not «stale»');
check(D.pillarsOf([{ id: 'ov', section: 'overview', fields: { pillars: 'Стандарт', f_стовпи: 'Своє' } }])[0].name, 'Стандарт', 'the standard field wins');
check(['Стовпи', 'pillars', 'Принципи', 'Анти-стовпи: чим гра НЕ є', 'Як прототип перевірить припущення', 'riskiest_assumption', 'Логлайн'].map(D.designKeyOf).join(), 'pillars,pillars,pillars,anti,riskTest,risk,', 'field names → the standard design keys (save_card routes them)');
const mcpSrc = require('fs').readFileSync(require('path').join(__dirname, '../functions/src/mcp.js'), 'utf8');
check(/section === 'overview' \? DESIGN\.designKeyOf\(n\)/.test(mcpSrc) && /const OVERVIEW_DESIGN = \{ pillars:/.test(mcpSrc), true, 'save_card on «Огляд гри» writes the design fields to their standard keys');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
