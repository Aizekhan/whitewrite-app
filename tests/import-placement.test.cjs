// The notes import places things by the GDD schema (GDD refocus §3.5) — no API call: for each sample of tests/fixtures/import-placement.json
// the schema routes its classic confusion (from → to), the import prompt carries that rule, and the post-processing (cleanImport) folds
// duplicates the same way MCP save_card refuses them. The real AI run on the same samples: scripts/import-placement-live.mjs (the owner's key).
// Run: npm test
const path = require('path');
const GDD = require('../functions/gdd-schema.js');
const { cleanImport, importPrompt } = require(path.join(__dirname, '../functions/src/gamedev.js'))._gdd;
const { samples } = require('./fixtures/import-placement.json');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

// the shelves the Bible sends for a game: every card section of the schema
const shelves = GDD.SECTIONS.filter((s) => s.write).map((s) => ({ id: s.id, kind: 'game', name: s.en, fields: [], groups: [] }));
const ids = shelves.map((s) => s.id);
samples.forEach((x) => {
  const from = GDD.section(x.rule.from);
  check(!!(from && from.not.some((n) => n.goTo === x.rule.to)), true, `${x.id}: the schema sends it from ${x.rule.from} to ${x.rule.to}`);
  x.expect.forEach((e) => check(ids.includes(e.section), true, `${x.id}: ${e.section} is an import shelf`));
  const p = importPrompt(x.md, shelves, [], { title: 'T', rules: [] }, 'Ukrainian', []);
  const line = p.split('\n').find((l) => l.startsWith('- ' + x.rule.from + ' — ')) || '';
  check(line.includes('NOT here') && line.includes('→ ' + x.rule.to), true, `${x.id}: the prompt says what of ${x.rule.from} goes to ${x.rule.to}`);
  check(p.includes(x.md), true, `${x.id}: the prompt carries the notes`);
});

// post-processing: the duplicate check of MCP save_card
const have = [{ id: 'e1', section: 'enemies', title: 'Вовк' }, { id: 'p1', section: 'progression', title: 'Прокачка героя' }, { id: 'h', section: 'enemies', title: 'Старий вовк', hidden: true }];
const out = cleanImport({ cards: [
  { section: 'companions', title: '🐺 вовк', fields: { HP: '40' } },
  { section: 'progression', title: 'Прокачка героя v5', fields: { 'Рівні': '1–30' } },
  { section: 'progression', title: 'Прокачка героя (нова)', fields: { 'Рівні': '1–40', 'Очки': '+1' } },
  { section: 'mechanics', title: 'Вовк — AI зграї', fields: { 'Правило': 'оточують' } },
  { section: 'nowhere', title: 'Щось', fields: {} },
] }, shelves, [], { rules: [] }, have).cards;
const at = (t) => out.filter((c) => c.title === t);
check(at('Вовк').length + ' ' + (at('Вовк')[0] || {}).section, '1 enemies', 'the same thing in a twin section lands on the existing card (its title and section)');
check(at('Прокачка героя').length, 1, 'a newer version of an existing card is folded onto it');
check((at('Прокачка героя')[0] || { fields: {} }).fields['Рівні'], '1–30\n\n1–40', 'two copies in one import become one card, fields joined');
check(out.some((c) => c.section === 'mechanics' && /AI зграї/.test(c.title)), true, 'a different thing in another section stays its own card');
check(out.some((c) => c.title === 'Щось' && c.section === 'overview'), true, 'an unknown section falls back to the overview');
check(out.length, 4, 'nothing else is lost');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
