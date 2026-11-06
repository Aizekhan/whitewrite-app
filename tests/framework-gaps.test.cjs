// RPG Framework gaps (functions/mechanics.js): capabilities.json parsed, statuses, a mechanic's capabilities and gaps,
// the template notes switched to the game's manifest, the agent's export. Run: npm test
const path = require('path');
const M = require(path.join(__dirname, '../functions/mechanics.js'));
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

const B = M.FW_BUILTIN;
check(Object.keys(B.caps).length + '/' + Object.keys(B.missing).length, '86/8', 'the built-in snapshot: 86 capabilities, 8 known gaps (0.41.0: + ai.adaptation, combat.analytics, telemetry.*)');
check(Object.keys(B.caps).every((id) => /^[a-z_]+\.[a-z0-9_]+$/.test(id)), true, 'ids are «module.name»');
check(M.capStatus(B, 'combat.parry').status + ' ' + M.capStatus(B, 'combat.enemy_parry').ki + ' ' + M.capStatus(B, 'ai.boss_phases').status + ' ' + M.capStatus(B, 'ai.adaptation').status + ' ' + M.capStatus(B, 'x.y').status,
  'full KI-24 missing full unknown', 'statuses: full, partial with its KI, missing, unknown');

const man = M.parseCaps(JSON.stringify({ format: 'rpgframework.capabilities/1', version: '0.41.0', released: '2026-12-01',
  modules: [{ id: 'combat', capabilities: [{ id: 'combat.combos', status: 'full', title: 'Combos', api: ['EnemyMove.Next'] }, { id: 'bad id', status: 'full' }] }],
  missing: [{ id: 'ai.adaptation', title: 'Adaptive AI', notes: 'not yet', ki: 'KI-30' }] }));
check(man.version + ' ' + Object.keys(man.caps).join() + ' ' + man.caps['combat.combos'].a[0], '0.41.0 combat.combos EnemyMove.Next', 'capabilities.json parsed, a bad id dropped, api kept');
check(M.parseCaps({ format: 'other' }), 'format must be rpgframework.capabilities/1', 'a wrong format is refused');
check(M.parseCaps('{'), 'not JSON', 'broken JSON is refused');

const m = { tpl: 'umcf', cat: 'combat', sections: [{ id: 'combos' }, { id: 'adaptation' }, { id: 'attacks' }], fw: { caps: ['save.cloud'], need: 'Boss phases', decisions: { 'ai.adaptation': 'framework' } } };
check(M.mechCaps(m).map((c) => c.id).join(), 'combat.combos,ai.adaptation,combat.attack_phases,combat.stamina_cost,save.cloud', 'a mechanic relies on its template parts + the author\'s picks');
check(M.frameworkGaps(m).map((g) => g.id + ':' + g.status + ':' + g.decision).join(' | '),
  'combat.combos:partial: | save.cloud:partial: | custom:missing:', 'gaps on the built-in list (adaptation is full since 0.41.0), with the decision and the author\'s own text');
check(M.frameworkGaps(m, man).map((g) => g.id).join(), 'ai.adaptation,combat.attack_phases,combat.stamina_cost,save.cloud,custom', 'on the game\'s manifest: combos is full there, absent ids are unknown → gaps');
check(M.frameworkNote('umcf', 'combos', man).status + ' ' + /^v0\.41\.0 · Combos — full · API: EnemyMove\.Next/.test(M.frameworkNote('umcf', 'combos', man).uk), 'exists true', 'a template part takes the game\'s manifest');
check(M.frameworkNote('umcf', 'overview', man).status, 'partial', 'an unmapped part keeps the hand-written note');
check(M.frameworkNote('umcf', 'combos').status, 'partial', 'no manifest → the hand-written note as before');
const x = M.exportMech({ id: 'c1', title: 'Combat', mech: Object.assign({}, m, { sections: [], fw: { caps: ['save.cloud', 'ai.adaptation'], decisions: { 'ai.adaptation': 'framework' } } }) }, 'en', [], man);
check(x.framework.version + ' ' + x.framework.gaps.map((g) => g.capability + '=' + g.decision).join('/'), '0.41.0 save.cloud=undecided/ai.adaptation=requested from the framework', 'the agent sees the version, the gaps and the decisions');
check(Object.keys(M.FW_CAPS).every((t) => Object.keys(M.FW_CAPS[t]).every((sec) => M.FW_CAPS[t][sec].every((id) => B.caps[id] || B.missing[id]))), true, 'every mapped capability exists in the 0.41.0 manifest');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
