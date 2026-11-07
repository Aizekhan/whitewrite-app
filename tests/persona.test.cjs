// 🧠 The personality constructor (functions/persona.js) and 🎙 dictation → fields (functions/src/card-fill.js helpers).
// Run: npm test
const P = require('../functions/persona.js');
const { buildCanonContext } = require('../functions/src/common.js');
const { cleanFields, cleanFill, fillPrompt } = require('../functions/src/card-fill.js')._cardFill;
const { byOp, featureCost } = require('../functions/paid-features.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got "${got}", want "${want}")`)); if (!ok) fails++; };

// the questions: unique ids, every one has uk + en, every step has questions
const ids = P.QUESTIONS.map((q) => q.id);
check(new Set(ids).size, ids.length, 'question ids are unique');
check(P.QUESTIONS.every((q) => q.uk && q.en && q.step), true, 'every question has uk, en and its step');
check(P.STEPS.every((s) => s.qs.length && s.uk && s.en), true, 'every step has questions and names');
check(P.TRAITS.every((t) => t.uk.length === 2 && t.en.length === 2), true, 'every trait has two poles in both languages');

// cleanPersona: known ids only, trimmed, traits clamped to −2…2, zero traits dropped
const c = P.cleanPersona({ answers: { want: '  помста  ', nope: 'x', fear: '   ' }, traits: { courage: 7, social: -1, order: 0, bogus: 2 } });
check(JSON.stringify(c), JSON.stringify({ answers: { want: 'помста' }, traits: { social: -1, courage: 2 } }), 'cleanPersona keeps known answers and clamps traits');
check(JSON.stringify(P.cleanPersona(null)), JSON.stringify({ answers: {}, traits: {} }), 'cleanPersona(null) is empty');

// progress and text
check(P.progress(c).done, 3, 'progress counts answers and set traits');
check(P.progress(c).total, P.QUESTIONS.length + P.TRAITS.length, 'progress total = questions + traits');
const t = P.personaText(c, 'uk');
check(/Чого прагне свідомо: помста/.test(t), true, 'personaText names the question');
check(/Темперамент: радше інтроверт, дуже сміливий/.test(t), true, 'personaText words the traits');
check(P.personaText({}, 'en'), '', 'an empty personality gives no text');

// the canon context carries it for scenes / quests / dialogues
const ctx = buildCanonContext({ world: {}, characters: { a: { name: 'Ліра', desc: 'мисливиця', personality: c } }, locations: {}, events: {}, factions: {}, artifacts: {} });
check(/Ліра: мисливиця\n  Особистість: Чого прагне свідомо: помста; Темперамент/.test(ctx), true, 'buildCanonContext adds the personality to a character');

// dictation: only text / table fields with a label; the AI's answer keeps known, changed fields only
const fields = cleanFields([{ key: 'role', label: 'Роль', value: 'танк' }, { key: 'numbers', label: 'Х-ки', type: 'table', value: '| Параметр | Значення |\n|---|---|' }, { key: '', label: 'x' }, { key: 'y' }]);
check(fields.length, 2, 'cleanFields drops fields without a key or label');
check(fields[1].type, 'table', 'a table field stays a table');
const fill = cleanFill({ relevant: true, fields: { role: 'танк', numbers: '| Параметр | Значення |\n|---|---|\n| HP | 120 |', ghost: 'x' }, ignored: 'про іншого персонажа' }, fields);
check(JSON.stringify(Object.keys(fill.fields)), JSON.stringify(['numbers']), 'cleanFill keeps changed known fields only');
check(fill.relevant && fill.ignored === 'про іншого персонажа', true, 'cleanFill passes «ignored» on');
check(cleanFill({ relevant: true, fields: {} }, fields).relevant, false, 'nothing filled → not relevant');
check(cleanFill({ relevant: false, fields: { role: 'хілер' } }, fields).relevant, false, 'the AI says off-topic → not relevant');
check(/Only what was SAID/.test(fillPrompt({ kind: 'card', name: 'Ліра', section: 'Персонажі' }, fields, 'хп сто двадцять', 'Ukrainian')), true, 'the prompt forbids inventing');

// the registry: both are AI actions open on every plan, priced above zero
['voiceFill', 'personaIdeas'].forEach((op) => {
  const f = byOp(op);
  check(!!f && f.kind === 'ai' && f.minPlan === 'free' && featureCost(f, 300) > 0, true, `${op}: an AI action on every plan with a price`);
});

if (fails) { console.log(`\n${fails} FAILED`); process.exit(1); }
console.log('\nALL PASSED');
