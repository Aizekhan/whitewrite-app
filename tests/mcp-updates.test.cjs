// 🔔 get_updates (functions/src/mcp.js, v2.120): what changed in the game since the key last asked — the author's task events, gates,
// decided change requests, cards / quests / dialogues / canon the author changed (Claude Code's own save_* writes left out), capped at 50,
// the mark mcpKeys/{sha}.lastUpdatesAt written by the server only. Run: npm test
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const pick = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } } };
const M = new Function('admin', 'crypto',
  pick('const OPEN =', '// ---------- tools') + pick('function lockedBy', 'function taskView') + src.match(/^const sha1 = .*$/m)[0] +
  pick('const UPD_CAP', '// ---------- writes') +
  '\nfunction rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }' +
  '\nreturn { updatesSince, UPD_CAP };')(admin, crypto);

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const T = (ms) => ({ toMillis: () => ms }); // a Firestore Timestamp
const SINCE = 1000000, LATER = 2000000, OLD = 500000;
const ctx = (over) => Object.assign({ plan: { plan: { milestones: [{ id: 'G0', track: 'mvp', name: 'Setup' }] }, gates: {} }, tasks: [], cards: [], entities: [] }, over);
const key = { lastUpdatesAt: T(SINCE), createdAt: T(1) };
const types = (r) => r.updates.map((x) => x.type).join();

// ---- tasks: the author's events since the mark, plan tasks, bugs
let r = M.updatesSince(ctx({ tasks: [
  { id: 'G0.1', title: 'Jump', milestone: 'G0', status: 'rework', createdAt: T(OLD), history: [{ type: 'claimed', by: 'claude-code', at: OLD }, { type: 'returned', by: 'author', comment: 'Too floaty', at: LATER }] },
  { id: 'G0.2', title: 'Run', milestone: 'G0', status: 'done', createdAt: T(OLD), history: [{ type: 'accepted', by: 'author', at: LATER + 1 }] },
  { id: 'G0.3', title: 'Old', milestone: 'G0', status: 'done', createdAt: T(OLD), history: [{ type: 'accepted', by: 'author', at: OLD }] },
  { id: 'G0.4', title: 'New plan task', milestone: 'G0', status: 'todo', createdAt: T(LATER), history: [] },
  { id: 'G0.5', title: 'Blocked', milestone: 'G0', status: 'todo', createdAt: T(OLD), history: [{ type: 'blocked', by: 'claude-code', at: OLD }, { type: 'unblocked', by: 'author', comment: 'Use the stone texture', at: LATER }] },
  { id: 'BUG-A', kind: 'bug', severity: 's1', title: 'Crash', milestone: 'G0', status: 'todo', createdAt: T(LATER), history: [{ type: 'reported', by: 'author', at: LATER }] },
  { id: 'BUG-B', kind: 'bug', severity: 's3', title: 'Mine', milestone: 'G0', status: 'todo', createdAt: T(LATER), history: [{ type: 'reported', by: 'claude-code', at: LATER }] },
] }), key, {}, {});
check(types(r), 'task_rework,blocker_answered,new_bug,task_accepted,new_task', 'the author’s task events since the mark, most important first');
check(r.updates[0].comment + '|' + r.updates[1].comment, 'Too floaty|Use the stone texture', 'rework and blocker answers carry the author’s comment');
check(r.updates.some((x) => x.id === 'G0.3' || x.id === 'BUG-B'), false, 'events before the mark and the agent’s own bug are left out');
check(r.updates.find((x) => x.type === 'new_bug').severity, 's1', 'a new bug shows its severity');
check(r.since, new Date(SINCE).toISOString(), 'since = the key’s lastUpdatesAt');

// ---- design changes: the author's, not the agent's (agentMark: agentAt ≈ updatedAt)
r = M.updatesSince(ctx({
  entities: [{ id: 'hero', kind: 'characters', name: 'Aria', updatedAt: T(LATER) }, { id: 'old', name: 'Old', updatedAt: T(OLD) }],
  cards: [
    { id: 'c1', section: 'levels', title: 'Cave', updatedAt: T(LATER) },
    { id: 'c2', section: 'levels', title: 'By agent', updatedAt: T(LATER), agentAt: LATER + 2000 },
    { id: 'c3', section: 'levels', title: 'Agent then author', updatedAt: T(LATER + 60000), agentAt: LATER },
    { id: 'c4', section: 'mechanics', title: 'Combat', mech: { tpl: 'umcf' }, updatedAt: T(LATER) },
    { id: 'c5', section: 'artstyle', title: 'Style', updatedAt: T(LATER), createdAt: T(LATER) },
    { id: 'hero', canonRef: 'hero', section: 'characters', title: '', updatedAt: T(LATER) },
    { id: 'c6', section: 'levels', title: 'Untouched', updatedAt: T(OLD) }],
}), key, {}, {
  quests: [{ id: 'q1', title: 'Find the key', updatedAt: T(LATER), approval: 'approved' }, { id: 'q2', title: 'Agent quest', updatedAt: T(LATER), agentAt: LATER }],
  dialogues: [{ id: 'd1', title: 'Hello', updatedAt: T(LATER), createdAt: T(LATER) }],
  changeRequests: [{ id: 'cr1', what: 'Bigger arena', status: 'accepted', decidedAt: T(LATER) }, { id: 'cr2', what: 'Open', status: 'open' }, { id: 'cr3', what: 'Old', status: 'rejected', decidedAt: T(OLD) }],
});
const refs = r.updates.map((x) => x.ref || x.id).join();
check(/c2\b|q2/.test(refs), false, 'changes Claude Code made itself (save_card / save_quest) are left out');
check(/c:c1/.test(refs) && /c:c3/.test(refs), true, 'the author’s edits are in — also one made after the agent’s');
check(r.updates.find((x) => x.ref === 'c:c4').type + '|' + r.updates.find((x) => x.ref === 'c:c5').type, 'mechanic_changed|style_changed', 'mechanics and style are named as such');
check(r.updates.find((x) => x.ref === 'c:c5').created, true, 'a new card is marked created');
check(r.updates.filter((x) => x.ref === 'e:hero').map((x) => x.type + ':' + x.title).join(), 'card_changed:Aria,canon_changed:Aria', 'a canon card is e:<id> with the entity name; the canon change too');
check(r.updates.filter((x) => x.type === 'change_request_decided').map((x) => x.id + ':' + x.decision).join(), 'cr1:accepted', 'only change requests decided since the mark');
check(r.updates[0].type, 'change_request_decided', 'decisions come before design edits');
check(/q1/.test(refs) && /d1/.test(refs) && !/c:c6/.test(refs), true, 'quests and dialogues the author changed; older cards are not');

// ---- gates and a new plan
r = M.updatesSince(ctx({ plan: { plan: { milestones: [{ id: 'G0', track: 'mvp', name: 'Setup' }, { id: 'G1', track: 'mvp', name: 'Greybox' }] }, plannedAt: T(LATER),
  gates: { G0: { status: 'approved', at: LATER }, G1: { status: 'returned', at: LATER, comment: 'Lighting is off' } } } }), key, {}, {});
check(types(r), 'gate_returned,gate_approved,plan_generated', 'gates opened / returned and a new plan');
check(r.updates[0].comment + '|' + r.updates[1].name, 'Lighting is off|Setup', 'a returned gate carries the author’s comment');

// ---- since: explicit, first call, bad value
r = M.updatesSince(ctx({ cards: [{ id: 'c1', section: 'levels', title: 'Cave', updatedAt: T(LATER) }] }), key, { since: new Date(LATER + 1).toISOString() }, {});
check(r.total, 0, 'an explicit since: nothing after it');
check(/Змін немає/.test(r.message), true, 'an empty answer says «Змін немає»');
r = M.updatesSince(ctx({ cards: [{ id: 'c1', section: 'levels', title: 'Cave', updatedAt: T(OLD) }] }), { createdAt: T(OLD - 1) }, {}, {});
check(r.total, 1, 'no mark yet: everything since the key was made');
r = M.updatesSince(ctx({ cards: [{ id: 'c1', section: 'levels', title: 'Cave', updatedAt: T(OLD) }] }), key, { since: new Date(1).toISOString() }, {});
check(r.total, 1, 'since further back finds older changes');
let err = ''; try { M.updatesSince(ctx(), key, { since: 'yesterday-ish' }, {}); } catch (e) { err = e.message; }
check(/ISO/.test(err), true, 'a bad since is refused');

// ---- the cap: at most 50 items + how many more
r = M.updatesSince(ctx({ cards: Array.from({ length: 70 }, (_, i) => ({ id: 'k' + i, section: 'levels', title: 'L' + i, updatedAt: T(LATER + i) })) }), key, {}, {});
check(r.updates.length + '|' + r.more + '|' + r.total, M.UPD_CAP + '|20|70', 'capped at 50 with «more»');
check(r.updates[0].ref, 'c:k69', 'within a type the newest first');
r = M.updatesSince(ctx({ tasks: [{ id: 'G0.1', milestone: 'G0', status: 'todo', createdAt: T(OLD), history: [] }] }), key, {}, {});
check(/Open tasks are waiting — offer get_next_task/.test(r.message), true, 'no changes but open tasks: offer get_next_task');

// ---- wiring: the tool exists, the mark is written by the server, the instructions and the guides tell the agent to ask
check(/name: 'get_updates'/.test(src) && /case 'get_updates':/.test(src), true, 'get_updates is a tool');
check(/collection\('mcpKeys'\)\.doc\(key\.id\)\.set\(\{ lastUpdatesAt:/.test(src), true, 'the mark lastUpdatesAt goes on the key doc (server)');
const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');
check(/match \/mcpKeys\/\{keyHash\} \{[^}]*hasOnly\(\['uid', 'worldId', 'gameId', 'label', 'prefix', 'createdAt'\]\)[^]*?allow update: if false;/.test(rules), true, 'a client can neither create nor update lastUpdatesAt');
const G = require('../functions/setup-guides.js');
check(/get_updates/.test(G.SESSION_RULE) && /SESSION_RULE/.test(src), true, 'the initialize instructions carry the session rule');
check(/get_updates/.test(G.guide('setup').markdown) && /get_updates/.test(G.guide('activity_log').markdown), true, 'the setup guide and the CLAUDE.md block ask for get_updates');
check(/Підготуй усе для роботи з WhiteWrite/.test(G.guide('setup').markdown), true, 'the setup guide answers «Підготуй усе…»');
// the watch rule (owner): asked once per session, remembered in CLAUDE.md, the loop tools or a ready /loop, no task taken without consent
const W = G.SESSION_RULE;
check(/Стежити за змінами WhiteWrite в цій сесії\? \(так \/ ні \/ завжди \/ ніколи\)/.test(W) && /ONCE/.test(W), true, 'the rule asks once: так / ні / завжди / ніколи');
check(/\/loop, ScheduleWakeup, CronCreate/.test(W) && W.indexOf(G.WATCH_LOOP) >= 0 && /^\/loop 10m /.test(G.WATCH_LOOP), true, 'yes → the scheduling tools, else the ready /loop command');
check(W.indexOf(G.WATCH_LINE + 'always') >= 0 && W.indexOf(G.WATCH_LINE + 'never') >= 0 && /CLAUDE\.md/.test(W), true, 'always / never are remembered in the project CLAUDE.md');
check(/never take a new task on your own/.test(W), true, 'a task found while watching is offered, not taken');
check(G.guide('setup').markdown.indexOf(W) >= 0 && G.guide('activity_log').markdown.indexOf(W) >= 0, true, 'the whole rule is in the setup guide and the CLAUDE.md block');
// a Roblox game (v2.137): its own setup, the same session rule and rules, no Unity install steps; Unity checks marked not applicable
const RB = G.guide('setup', 'roblox').markdown;
check(/Roblox Studio/.test(RB) && RB.indexOf(W) >= 0 && /submit_change_request/.test(RB) && !/winget install Unity\.CLI/.test(RB), true, 'a Roblox game gets the Roblox setup with the same session rule and rules');
check(/winget install Unity\.CLI/.test(G.guide('setup', 'rpg-framework').markdown), true, 'a Unity game keeps the Unity setup');
check(/do not apply/.test(G.guide('unity_env', 'roblox').markdown) && G.guide('setupRoblox') === null, true, 'unity_env does not apply to Roblox; setupRoblox is not a topic of its own');
const init = src.slice(src.indexOf("if (method === 'initialize')"), src.indexOf("else if (method === 'ping')"));
check(/instructions: [^]*GUIDES\.SESSION_RULE/.test(init) && /«Підготуй усе для роботи з WhiteWrite»[^]*get_guide \{topic:"setup"\}/.test(init), true, 'the whole rule and «Підготуй усе…» are in the MCP initialize instructions');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
