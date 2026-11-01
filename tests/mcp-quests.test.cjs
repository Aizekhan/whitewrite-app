// MCP quest / dialogue views (functions/src/mcp.js): only approved ones reach Claude Code, canon refs resolved, checks attached.
// Run: npm test
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const pick = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const NV = require('../functions/narrative-validate.js');
const { findApproved, questView, dialogueView } = new Function('NV',
  pick('const str =', '// ---------- tools') + pick('const entRef', '// ---------- writes') +
  'function rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }' +
  ';return { findApproved, questView, dialogueView };')(NV);

const ctx = { entities: [{ id: 'char_a', kind: 'characters', name: 'Ada', desc: 'A smith' }, { id: 'loc_1', kind: 'locations', name: 'Forge' }] };
const q1 = { id: 'q1', title: 'The Lost Hammer', approval: 'approved', giver: 'char_a', locations: ['loc_1', 'loc_x'], objectives: 'Find it\nBring it back',
  stages: [{ id: 's1', title: 'Search', next: [{ to: 's2', cond: 'has_hammer' }] }, { id: 's2', title: 'Return', end: true }] };
const q2 = { id: 'q2', title: 'Draft', approval: 'review', stages: [] };
const d1 = { id: 'd1', title: 'Ask Ada', approval: 'approved', questId: 'q1', stageId: 's1', participants: ['char_a'],
  nodes: [{ id: 'n1', speaker: 'char_a', text: 'Hello', choices: [{ text: 'Bye', to: 'n2' }] }, { id: 'n2', speaker: 'player', text: 'Bye', end: true }] };
const n = { quests: [q1, q2], dialogues: [d1] };
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const err = (f) => { try { f(); return ''; } catch (e) { return e.message; } };

check(findApproved(n.quests, 'q1', 'Quest').id, 'q1', 'finds an approved quest by id');
check(findApproved(n.quests, 'the lost hammer', 'Quest').id, 'q1', 'finds it by title, case-insensitive');
check(/not approved yet \(review\)/.test(err(() => findApproved(n.quests, 'q2', 'Quest'))), true, 'a quest in review is refused');
check(/not found/.test(err(() => findApproved(n.quests, 'q9', 'Quest'))), true, 'an unknown quest is refused');
const v = questView(ctx, n, q1);
check(v.giver.name + '|' + v.giver.description, 'Ada|A smith', 'the giver comes with its canon description');
check(v.locations.map((l) => l.missing ? 'missing' : l.name).join(','), 'Forge,missing', 'a broken canon link is marked missing');
check(v.objectives.length, 2, 'objectives split by line');
check(v.start + '>' + v.stages[0].next[0].to + ' if ' + v.stages[0].next[0].condition, 's1>s2 if has_hammer', 'start, branch and condition');
check(v.dialogues.map((d) => d.id + '@' + d.stage).join(), 'd1@s1', 'the quest lists its dialogues with stages');
check(v.checks.map((c) => c.code).join(), 'missingRef', 'the graph check rides along');
const dv = dialogueView(ctx, n, d1);
check(dv.quest.title + '/' + dv.quest.stage, 'The Lost Hammer/s1', 'the dialogue knows its quest and stage');
check(dv.nodes.map((x) => x.speaker_name).join(), 'Ada,player', 'speakers resolved to names');
check(dv.nodes[0].choices[0].to, 'n2', 'choices keep their targets');
check(dv.checks.length, 0, 'a clean dialogue has no issues');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
