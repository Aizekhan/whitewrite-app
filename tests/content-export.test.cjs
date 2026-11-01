// Export to RPG Framework content import "rpgframework.content/1" (functions/narrative-validate.js toFrameworkContent).
// Run: npm test
const NV = require('../functions/narrative-validate.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

const q = { id: 'q1', title: 'Hammer', type: 'main', approval: 'approved', summary: 'Find it', prereqs: ['q0'], giver: 'c:boss1', characters: ['char_a'], events: ['evt_1'],
  objectives: 'Find the golem\nReturn', rewards: '200 XP', repeat: { mode: 'repeatable', cooldown: '24 год' },
  stages: [{ id: 's1', title: 'Go', objective: 'Reach Forge-1', next: [{ to: 's2', cond: 'golem_defeated' }, { to: 's3', cond: '' }] }, { id: 's2', end: true }, { id: 's3', fail: true }] };
const d = { id: 'd1', title: 'Talk', type: 'quest', approval: 'approved', participants: ['char_a'], questId: 'q1', stageId: 's1', location: 'c:lvl1',
  nodes: [{ id: 'n1', speaker: 'char_a', text: 'Hi', locKey: 'dlg.t.n1', cond: 'met_before', choices: [{ text: 'Yes', to: 'n2' }, { text: 'No', to: 'n2', cond: 'brave' }] },
    { id: 'n2', speaker: 'player', text: 'Ok', effects: 'give_item:key; set_flag:met; give_currency:gold:50', end: true }] };
const c = NV.toFrameworkContent([q, { id: 'q9', approval: 'review', stages: [] }], [d, { id: 'd9', approval: 'draft', nodes: [] }], { game: 'G' });

check(c.schema, 'rpgframework.content/1', 'the schema tag the importer checks (badSchema otherwise)');
check(NV.toFrameworkContent([], [{ id: 'd2', approval: 'approved', nodes: [{ id: 'n1', text: 'Hi', end: true }] }]).dialogues[0].nodes[0].type, '', 'a one-line talk: the start is a plain line, not type end (startIsEnd)');
check(c.quests.length + '/' + c.dialogues.length, '1/1', 'only approved quests and dialogues are exported');
const x = c.quests[0];
check(x.description + '|' + x.prerequisites.join() + '|' + x.start, 'Find it|q0|s1', 'summary → description, prerequisites, start');
check(x.repeatable + '|' + x.cooldownSeconds, 'true|86400', 'repeatable with «24 год» → 86400 s');
check(x.objectives.map((o) => o.id + ':' + o.type).join(), 'o1:custom,o2:custom', 'free-text objectives → custom objectives');
check(x.rewards[0].type + ':' + x.rewards[0].id, 'custom:200 XP', 'free-text rewards → a custom reward');
check(x.stages.map((s) => s.outcome).join(), 'none,success,failure', 'end → success, fail → failure');
check(x.stages[0].description + '|' + x.stages[0].next.map((b) => b.to + '=' + b.condition).join(), 'Reach Forge-1|s2=golem_defeated,s3=', 'stage objective → description, branches keep conditions');
check(x.refs.giver + '|' + x.refs.events.join(), 'c:boss1|evt_1', 'refs travel as opaque strings');
check(NV.toFrameworkContent([{ id: 'q', approval: 'approved', repeat: { mode: 'daily' }, stages: [] }], []).quests[0].cooldownSeconds, 86400, 'daily → 86400 s');
check(NV.toFrameworkContent([{ id: 'q', approval: 'approved', stages: [] }], []).quests[0].repeatable, false, 'once → not repeatable');
const y = c.dialogues[0];
check(y.quest + '/' + y.stage + '|' + y.start + '|' + y.participants.join(), 'q1/s1|n1|char_a', 'quest, stage, start, participants');
check(y.nodes[0].key + '|' + y.nodes[0].condition.type + ':' + y.nodes[0].condition.id, 'dlg.t.n1|custom:met_before', 'loc key and a free-text condition');
check(y.nodes[0].choices.map((ch) => ch.id + '>' + ch.to + (ch.condition ? '?' + ch.condition.id : '')).join(), 'c1>n2,c2>n2?brave', 'choices get c1, c2… ids');
check(y.nodes[1].type + '|' + y.nodes[1].next.length, 'end|0', 'an end line → type end');
check(JSON.stringify(y.nodes[1].effects), '[{"kind":"giveItem","target":"key"},{"kind":"setVariable","target":"met","amount":1},{"kind":"giveCurrency","target":"gold","amount":50}]', 'effects text → framework effects');
check(NV.cooldownSeconds('30 хв') + ',' + NV.cooldownSeconds('2 days') + ',' + NV.cooldownSeconds('soon'), '1800,172800,0', 'cooldown units; unknown text → 0');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
