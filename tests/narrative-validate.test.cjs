// Quest & dialogue graph checks (functions/narrative-validate.js — shared by the World Bible and the MCP server).
// Run: npm test
const { validateQuest, validateDialogue, worst } = require('../functions/narrative-validate.js');

const ents = [{ id: 'char_a' }, { id: 'char_b' }, { id: 'loc_1' }];
const st = (id, next, extra) => Object.assign({ id, title: id, next: (next || []).map((to) => ({ to })) }, extra || {});
const nd = (id, extra) => Object.assign({ id, speaker: 'char_a', text: 'Hi' }, extra || {});
const Q = (extra) => Object.assign({ id: 'q1', title: 'Quest', giver: 'char_a', stages: [st('s1', ['s2']), st('s2', [], { end: true })] }, extra || {});
const D = (extra) => Object.assign({ id: 'd1', title: 'Talk', participants: ['char_a'], nodes: [nd('n1', { next: 'n2' }), nd('n2', { end: true })] }, extra || {});
const codes = (l) => l.map((x) => x.code).sort().join(',');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got "${got}", want "${want}")`)); if (!ok) fails++; };
const qc = (q, quests) => codes(validateQuest(q, { entities: ents, quests: quests || [] }));
const dc = (d, quests) => codes(validateDialogue(d, { entities: ents, quests: quests || [] }));

// quests
check(qc(Q()), '', 'a linear quest with an end is clean');
check(qc(Q({ stages: [] })), 'noStages', 'a quest without stages');
check(qc(Q({ stages: [st('s1', ['s2']), st('s2', [])] })), 'deadEnd,noEnd', 'no end stage: the last one is a dead end');
check(qc(Q({ stages: [st('s1', ['s9']), st('s2', [], { end: true })] })), 'badLink,deadEnd,unreachable', 'a link to a missing stage');
check(qc(Q({ stages: [st('s1', ['s2']), st('s2', [], { end: true }), st('s3', [], { end: true })] })), 'unreachable', 'a stage no branch leads to');
check(qc(Q({ stages: [st('s1', ['s2']), st('s2', ['s1']), st('s3', [], { end: true })] })), 'loop,loop,unreachable', 'a loop with no way out');
check(qc(Q({ stages: [st('s1', ['s2']), st('s2', ['s1', 's3']), st('s3', [], { end: true })] })), '', 'a loop with an exit is fine');
check(qc(Q({ stages: [st('s1', ['s2', 's3']), st('s2', [], { end: true }), st('s3', [], { fail: true })] })), '', 'success and failure branches');
check(qc(Q({ stages: [st('s1', ['s2']), st('s2', [], { fail: true })] })), 'noEnd', 'only a failure ending — the quest can never be completed');
check(qc(Q({ stages: [st('s1', ['s2']), st('s1', ['s2']), st('s2', [], { end: true })] })), 'dupId', 'duplicate stage ids');
check(qc(Q({ giver: 'char_x', locations: ['loc_1', 'loc_9'] })), 'missingRef,missingRef', 'a giver and a location missing from the canon');
check(qc(Q({ giver: '' })), 'noGiver', 'no quest giver is a warning');
check(qc(Q({ prereqs: ['q9'] })), 'missingQuest', 'a prerequisite quest that does not exist');
check(qc(Q({ prereqs: ['q2'] }), [{ id: 'q2', prereqs: ['q3'] }, { id: 'q3', prereqs: ['q1'] }]), 'prereqCycle', 'a prerequisite cycle q1→q2→q3→q1');
check(qc(Q({ prereqs: ['q2'] }), [{ id: 'q2', prereqs: ['q3'] }, { id: 'q3', prereqs: [] }]), '', 'a prerequisite chain without a cycle');
check(validateQuest(Q({ prereqs: ['q2'] }), { entities: ents, quests: [{ id: 'q2', prereqs: ['q1'] }] }).find((x) => x.code === 'prereqCycle').path.join('>'), 'q1>q2>q1', 'the cycle path is reported (closed)');
check(qc(Q({ repeat: { mode: 'repeatable', cooldown: '' } })), 'noCooldown', 'a repeatable quest without a cooldown');
check(qc(Q({ repeat: { mode: 'repeatable', cooldown: '24h' } })), '', 'a repeatable quest with a cooldown');
// dialogues
check(dc(D()), '', 'a linear dialogue with an end is clean');
check(dc(D({ nodes: [] })), 'noNodes', 'a dialogue without nodes');
check(dc(D({ participants: [] })), 'noParticipants,speakerNotIn,speakerNotIn', 'no participants (speakers outside them)');
check(dc(D({ nodes: [nd('n1', { choices: [{ text: 'a', to: 'n2' }, { text: 'b', to: 'n3' }] }), nd('n2', { end: true }), nd('n3', { speaker: 'player', end: true })] })), '', 'choices branching to two ends; the player speaks');
check(dc(D({ nodes: [nd('n1', { next: 'n2' }), nd('n2')] })), 'deadEnd', 'a node with no way on and no end mark');
check(dc(D({ nodes: [nd('n1', { next: 'n2' }), nd('n2', { choices: [{ to: 'n1' }] })] })), 'loop,loop', 'a dialogue loop with no exit');
check(dc(D({ nodes: [nd('n1', { next: 'n2' }), nd('n2', { choices: [{ to: 'n1' }, { to: 'n3' }] }), nd('n3', { end: true })] })), '', 'a «ask again» loop with an exit');
check(dc(D({ nodes: [nd('n1', { next: 'n7' })] })), 'badLink,deadEnd', 'a choice to a missing node');
check(dc(D({ nodes: [nd('n1', { end: true }), nd('n2', { end: true })] })), 'unreachable', 'an unreachable node');
check(dc(D({ nodes: [nd('n1', { end: true, text: '' })] })), 'emptyText', 'an empty line');
check(dc(D({ nodes: [nd('n1', { end: true, speaker: 'char_b' })] })), 'speakerNotIn', 'a speaker who is not a participant');
check(dc(D({ participants: ['char_z'] }), []), 'missingRef,speakerNotIn,speakerNotIn', 'a participant missing from the canon');
check(dc(D({ questId: 'q9' })), 'missingQuest', 'a dialogue tied to a missing quest');
check(dc(D({ questId: 'q1', stageId: 's9' }), [Q()]), 'missingStage', 'a dialogue tied to a missing quest stage');
check(dc(D({ questId: 'q1', stageId: 's2' }), [Q()]), '', 'a dialogue tied to a real quest stage');
check(worst(validateQuest(Q({ stages: [] }), { entities: ents })), 'error', 'worst = error');
check(worst(validateQuest(Q({ giver: '' }), { entities: ents })), 'warn', 'worst = warn');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
