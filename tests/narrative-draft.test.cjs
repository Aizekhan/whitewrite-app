// AI quest / dialogue drafts (functions/src/narrative.js): the proposal keeps only real canon ids, stage/line numbers become ids.
// Run: npm test
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/narrative.js'), 'utf8');
const { cleanQuest, cleanDialogue } = new Function(src.slice(src.indexOf('const QUEST_TYPES'), src.indexOf('function parseJson')) +
  src.slice(src.indexOf('// The AI refers'), src.indexOf('async function sourceText')) + ';return { cleanQuest, cleanDialogue };')();

const ents = [{ id: 'char_a', kind: 'characters' }, { id: 'char_b', kind: 'characters' }, { id: 'loc_1', kind: 'locations' }, { id: 'fac_1', kind: 'factions' }, { id: 'evt_1', kind: 'events' },
  { id: 'c:boss', kind: 'characters', card: true }, { id: 'c:lvl1', kind: 'locations', card: true }]; // game cards come in through refPool
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

const q = cleanQuest({ title: 'Hammer', type: 'weird', giver: 'char_x', characters: ['char_a', 'char_zz', 'loc_1'], locations: ['loc_1'], factions: ['fac_1'],
  objectives: ['Find', 'Return'], stages: [{ title: 'Search', next: [{ to: 2, cond: 'found' }, { to: 9 }, { to: 1 }] }, { title: 'Return', end: true }, { title: 'Lost', fail: true, end: true }],
  repeat: { mode: 'hourly' }, ideas: ['A new smith'] }, ents);
check(q.type, 'side', 'an unknown type falls back to side');
check(q.giver, '', 'an invented giver id is dropped');
check(q.characters.join(), 'char_a', 'only real characters of the right kind stay');
check(q.factions.join(), 'fac_1', 'factions kept');
const qc = cleanQuest({ giver: 'c:boss', characters: ['c:boss', 'c:nope'], locations: ['c:lvl1', 'c:boss'], events: ['evt_1', 'char_a'], stages: [{ title: 'Go', end: true }] }, ents);
check(qc.giver + '|' + qc.characters.join() + '|' + qc.locations.join(), 'c:boss|c:boss|c:lvl1', 'game cards are linked by c:<id> in their role');
check(qc.events.join(), 'evt_1', 'only canon events go to events');
check(q.objectives, 'Find\nReturn', 'objectives become lines');
check(q.stages.map((s) => s.id).join(), 's1,s2,s3', 'stage numbers become s1…');
check(q.stages[0].next.map((b) => b.to + ':' + b.cond).join(), 's2:found', 'out-of-range and self links are dropped');
check(q.stages[2].fail && !q.stages[2].end, true, 'a failure stage is not a success end');
check(q.repeat.mode, 'once', 'an unknown repeat mode falls back to once');
check(q.ideas.join(), 'A new smith', 'new ideas come back as notes');
const d = cleanDialogue({ title: 'Talk', participants: ['char_a', 'loc_1', 'char_q'], location: 'loc_1',
  nodes: [{ speaker: 'char_a', text: 'Hi', next: 2 }, { speaker: 'player', text: 'Choose', choices: [{ text: 'A', to: 3 }, { text: 'B', to: 7 }] }, { speaker: 'char_b', text: 'Bye' }, { text: '' }] }, ents);
check(d.participants.join(), 'char_a', 'only real characters are participants');
check(d.location, 'loc_1', 'a real location stays');
check(d.nodes.length, 3, 'empty lines are dropped');
check(d.nodes[0].next, 'n2', 'next becomes a line id');
check(d.nodes[1].choices.map((c) => c.to).join(), 'n3,', 'a choice to a missing line loses its target');
check(d.nodes[2].speaker + '|' + d.nodes[2].end, '|true', 'a non-participant speaker is cleared; the last line ends');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
