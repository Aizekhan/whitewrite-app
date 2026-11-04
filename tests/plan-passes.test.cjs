// The production plan in two passes (functions/src/gamedev.js): the skeleton, then every milestone's tasks in parallel.
// Both passes open with the same cached prefix (the bible is paid once, read from the cache by the milestone calls).
// Run: npm test
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/gamedev.js'), 'utf8');
const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b, src.indexOf(a)));
const { planPrompt, planTasksPrompt } = new Function(cut('const ENGINE_PROFILES', 'const str =') + cut('const answeredText', '\n', 0) + '\n' +
  cut('const PLAN_PIPELINE', '// ---------- GitHub:') + ';return { planPrompt, planTasksPrompt };')();

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const shelves = [{ id: 'levels', name: 'Рівні', kind: 'game', groups: ['Ліс'] }, { id: 'characters', name: 'Персонажі', kind: 'canon', groups: [] }];
const bible = '# World canon: Морра\n## [c:lvl1] Ліс (section: levels)';
const answered = [{ q: 'Камера?', a: 'Від третьої особи' }];
const sk = planPrompt(bible, 'unity', answered, { summary: 'S' }, 'Ukrainian', shelves);
const m = { id: 'G1', track: 'mvp', name: 'Greybox', goal: 'Core loop', scope: 'c:lvl1' };
const tk = planTasksPrompt(bible, 'unity', answered, { summary: 'S' }, 'Ukrainian', shelves, { milestones: [{ id: 'G0', track: 'mvp', name: 'Setup', goal: 'Build' }, m] }, m);
check(Array.isArray(sk) && sk.length === 2 && Array.isArray(tk) && tk.length === 2, true, 'both passes are two content blocks');
check(sk[0].text === tk[0].text && !!sk[0].cache_control && !!tk[0].cache_control, true, 'the same cached prefix opens both passes');
check(sk[0].text.includes(bible) && sk[0].text.includes('Від третьої особи') && sk[0].text.includes('levels — Рівні (subheadings: Ліс)'), true, 'the prefix carries the bible, decisions and game sections');
check(!sk[0].text.includes('characters — Персонажі'), true, 'canon shelves are not game sections');
check(sk[1].text.includes('write NO tasks') && sk[1].text.includes('"scope"') && !sk[1].text.includes('"tasks"'), true, 'the skeleton asks for scope, not tasks');
check(tk[1].text.includes('"G1.1"') && tk[1].text.includes('"scaffold"') && tk[1].text.includes('- G0 [mvp] Setup: Build'), true, 'the milestone pass asks for its tasks + scaffold and sees the whole plan');
check(!tk[1].text.includes(bible), true, 'the bible is not repeated outside the cached prefix');
// v2.78: the gates name the design artefacts — G1 the controls / game feel / loops / level metrics, G4 the release checklist
check(/G1[^\n]*«controls»[^\n]*«game_feel»[^\n]*«loops»[^\n]*«level_metrics»/.test(sk[0].text), true, 'G1 greybox builds on controls, game feel, loops and level metrics');
check(/G4[^\n]*release checklist is green[^\n]*«release» card[^\n]*green = true/.test(sk[0].text), true, 'G4 waits for the release checklist card to be green');
// the bible text carries a constructor mechanic with its computed numbers and open problems
const MECH = require('../functions/mechanics.js');
const { mechText } = new Function('MECH', cut('const str =', '\n') + '\n' + cut('function mechText', '// Canon + this game') + ';return { mechText };')(MECH);
const eco = MECH.instantiate('economy'); eco.sections.find((x) => x.id === 'currencies').rows[0].spend = 100;
const mt = mechText(eco);
check(/^Constructor: Economy & loot \(template economy\)/.test(mt) && /Computed: .*"status":"inflation"/.test(mt) && /Open problems: .*inflation/.test(mt) && !/"balance"/.test(mt), true, 'a mechanic in the bible: template, computed flow (without the hourly series), open problems');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
