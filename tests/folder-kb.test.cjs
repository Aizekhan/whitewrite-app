// «📂 Завантажити теку» of a world (functions/src/world-folder.js + world-fill.js merge) and «Запитай Базу знань»
// (functions/src/kb-help.js): the parts of a folder, merging the parts by name, the base read from app/kb.js. Run: npm test
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '../functions');
const Module = require('module');
const orig = Module._load; // the modules pull Firebase through common.js — the pure parts are tested without it
Module._load = function (req) {
  if (req === './common') return { onRequest: () => () => {}, claudeApiKey: {} };
  if (req === './team') return { _team: {} };
  if (req === './claude') return {};
  return orig.apply(this, arguments);
};
const { _worldFolder } = require(path.join(F, 'src', 'world-folder.js'));
const { _kbHelp } = require(path.join(F, 'src', 'kb-help.js'));
Module._load = orig;
const FILL = require(path.join(F, 'world-fill.js'));
const P = require(path.join(F, 'paid-features.js'));

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

// parts: every piece starts with its file, no part is over the registry size, nothing is lost
const size = P.byOp('worldFolder').price.quote.partChars;
const files = [{ path: 'heroes/lira.md', text: 'a'.repeat(45000) }, { path: 'world.md', text: 'Світ' }, { path: 'laws.txt', text: 'b'.repeat(500) }];
const parts = _worldFolder.parts(files);
check(parts.every((p) => p.length <= size), `no part is over ${size} chars (${parts.map((p) => p.length).join(', ')})`);
check(parts.every((p) => p.startsWith('### FILE: ')), 'every part starts with a file header');
check(parts.join('').replace(/^### FILE: .*$/gm, '').split('a').length - 1 === 45000 && parts.join('').indexOf('Світ') > 0, 'nothing of the files is lost');
check(parts.some((p) => p.indexOf('### FILE: heroes/lira.md (continued)') >= 0), 'a big file is cut into marked pieces');
check(/whitewrite\.fill\/1/.test(_worldFolder.systemText('uk', { title: 'Морра' }, 'characters: Ліра')) && /Ліра/.test(_worldFolder.systemText('uk', { title: 'Морра' }, 'characters: Ліра')),
  'the prompt carries the format and the names already in the world');

// merge: the same name across parts is one item, texts joined, lists without repeats
const m = FILL.merge([
  { world: { summary: 'Перша частина', rules: ['Магія має ціну'] }, characters: [{ name: 'Ліра', desc: 'Мисливиця', links: [{ to: 'Орден', rel: 'член' }] }] },
  { world: { tagline: 'Туман', summary: 'Друга частина', rules: ['Магія має ціну', 'Мертві мовчать'] }, characters: [{ name: '«ліра»', story: 'Біографія', desc: 'Мисливиця', links: [{ to: 'Орден', rel: 'член' }, { to: 'Морра', rel: 'родом' }] }],
    culture: { peoples: [{ name: 'Туманники' }] } },
  null
]);
check(m.characters.length === 1 && m.characters[0].story === 'Біографія' && m.characters[0].desc === 'Мисливиця', 'the same character from two parts is one, fields filled');
check(m.characters[0].links.length === 2, 'links joined without repeats');
check(m.world.rules.length === 2 && m.world.tagline === 'Туман' && /Перша частина\n\nДруга частина/.test(m.world.summary), 'world: rules unique, tagline kept, summaries joined');
const r = FILL.parse(m);
check(!r.error && FILL.plan(r.data, { world: {}, entities: [], lore: [] }, { newId: (k) => k + '_1' }).counts.add.characters === 1, 'the merged file parses and plans one character');

// the Knowledge base on the server: the live kb.js, both languages, plans/prices blocks left to the article
const kb = _kbHelp.readKb(fs.readFileSync(path.join(__dirname, '../app/kb.js'), 'utf8'));
check(kb.uk.length > 30 && kb.uk.length === kb.en.length, `kb.js read in both languages (${kb.uk.length} / ${kb.en.length})`);
const sys = _kbHelp.systemText('uk', kb.uk);
check(sys.indexOf('[agent-launch]') >= 0 && /ARTICLES:/.test(sys) && /Ukrainian/.test(sys), 'the prompt holds the articles with ids and asks for ARTICLES');
check(sys.indexOf('<b>') < 0, 'no HTML in the prompt');
check(_kbHelp.systemText('uk', kb.uk) === sys, 'the prompt is stable (cached)');
check(P.byOp('kbHelper').limit.perDay > 0 && P.byOp('kbHelper').kind === 'free', 'kbHelper: free with a daily limit');
check(P.planBudget('free').allowFolderFill === false && P.planBudget('storyteller').allowFolderFill === true, 'a world folder from Storyteller');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
