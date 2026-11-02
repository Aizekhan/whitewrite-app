// The game's visual style (functions/style-guide.js): which style a card takes, palettes, the staleness signature,
// the AI verdict clean-up. Run: npm test
const SG = require('../functions/style-guide.js');
let fails = 0;
const check = (got, want, msg) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)); if (!ok) fails++; };

const overall = { id: 'o', section: 'artstyle', order: 1, title: 'Загальний', fields: { group: 'Загальний стиль', palette: '#2040c0 — синій', avoid: '#e02020 — червоний', manifesto: 'Похмуре фентезі' } };
const forest = { id: 'f', section: 'artstyle', order: 2, title: 'Ліс', fields: { group: 'Біоми й локації', palette: '#20a040 — зелений', places: '- Темний ліс\nБолото' } };
const desert = { id: 'd', section: 'artstyle', order: 3, title: 'Пустеля', fields: { group: 'Біоми й локації', avoid: '#00ff00', places: 'Дюни' } };
const all = [desert, forest, overall, { id: 'x', section: 'assets', title: 'Темний ліс' }];

let r = SG.resolveStyle(all, ['Синій камінь']);
check([r.overall && r.overall.id, r.biome], ['o', null], 'a card with no biome match takes the overall style');
r = SG.resolveStyle(all, ['Щось', 'темний ЛІС']);
check(r.biome && r.biome.id, 'f', 'the biome is matched by subsection / location, case-insensitive, list markers ignored');
check(SG.palettes(r).palette.map((x) => x.hex), ['#20a040'], 'the biome palette replaces the overall one');
check(SG.palettes(r).avoid.map((x) => x.hex), ['#e02020'], 'colours to avoid come from the overall style');
r = SG.resolveStyle(all, ['Дюни']);
check(SG.palettes(r).palette.map((x) => x.hex), ['#2040c0'], 'a biome without a palette uses the overall one');
check(SG.palettes(r).avoid.map((x) => x.hex), ['#e02020', '#00ff00'], 'colours to avoid add up');
check(SG.resolveStyle([forest], ['x']).overall, null, 'no overall card → null, not a biome');

const sig1 = SG.styleSig(SG.resolveStyle(all, ['Болото']));
check(SG.styleSig(SG.resolveStyle(all, ['Болото'])), sig1, 'the signature is stable');
const forest2 = Object.assign({}, forest, { fields: Object.assign({}, forest.fields, { light: 'туман' }) });
check(SG.styleSig(SG.resolveStyle([overall, forest2], ['Болото'])) !== sig1, true, 'a changed style text changes the signature (old AI scores go stale)');
const forest3 = Object.assign({}, forest, { files: [{ id: 'r1', name: 'ref.png', type: 'image/png', url: 'u' }] });
check(SG.styleSig(SG.resolveStyle([overall, forest3], ['Болото'])) !== sig1, true, 'a new style reference changes the signature');
check(/Похмуре фентезі/.test(SG.styleBrief(SG.resolveStyle(all, ['Болото']))) && /BIOME — "Ліс"/.test(SG.styleBrief(SG.resolveStyle(all, ['Болото']))), true, 'the brief has the overall manifesto and the biome');

check(SG.cleanVerdict({ score: '87.4', summary: 'ok', issues: ['a', '', 'b'], fixes: 'x' }), { score: 87, verdict: 'fits', summary: 'ok', issues: ['a', 'b'], fixes: [] }, 'the AI verdict is cleaned');
check(SG.cleanVerdict({ score: 150 }).score, 100, 'the score is clamped');
check([SG.cleanVerdict({ score: 55 }).verdict, SG.cleanVerdict({ score: 12 }).verdict, SG.cleanVerdict({}).verdict], ['partly', 'off', 'unknown'], 'the verdict follows the score');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
