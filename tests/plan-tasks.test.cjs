// The production plan's ids are the server's (functions/src/gamedev.js cleanPlan / numberMilestones / reconcileTasks): a missing or repeated
// milestone id never makes «undefined.1» or two tasks in one doc; a kept (started / done) task never silently hides a new one; a kept task
// whose milestone vanished still shows in the plan. Run: npm test
const path = require('path');
const { cleanPlan, numberMilestones, reconcileTasks } = require(path.join(__dirname, '../functions/src/gamedev.js'))._gdd;

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const T = (id, title, deps) => ({ id, title, deps: deps || [] });

// milestones: ids by track, whatever the AI sent
const ms = numberMilestones([{ name: 'a' }, { id: 'G1', name: 'b' }, { id: 'G1', track: 'expansion', name: 'c' }, { track: 'extra', name: 'd' }, { track: 'nope', name: 'e' }, { track: 'extra', name: 'f' }]);
check(ms.map((m) => m.id + ':' + m.track).join(' '), 'G0:mvp G1:mvp X1:expansion F1:extra G2:mvp F2:extra', 'milestones: G0… / X1… / F1… by track, an unknown track = mvp');

// tasks: renumbered per milestone, deps follow
const p = cleanPlan({ plan: { milestones: [
  { name: 'Setup', tasks: [T(undefined, 'Repo'), T('x', 'Scene', ['undefined.1']), T('x', 'CI', ['x'])] },
  { id: 'G0', name: 'Greybox', tasks: [T('G1.1', 'Loop', ['G0.2']), T('G1.1', 'Enemy', ['G1.1', 'Q9.1', 'G0.7'])] },
] } });
check(p.milestones.map((m) => m.id).join(), 'G0,G1', 'cleanPlan: a missing and a repeated milestone id become G0, G1');
check(p.milestones[0].tasks.map((t) => t.id).join(), 'G0.1,G0.2,G0.3', 'tasks numbered «<milestone>.<n>», never «undefined.1»');
check(p.milestones[1].tasks.map((t) => t.id).join(), 'G1.1,G1.2', 'repeated raw task ids become two tasks');
check(JSON.stringify(p.milestones[0].tasks.map((t) => t.deps)), JSON.stringify([[], [], ['G0.2']]), 'deps: the raw id → its new id (first of the repeated), an unknown dep dropped');
check(JSON.stringify(p.milestones[1].tasks.map((t) => t.deps)), JSON.stringify([['G0.2'], ['G1.1']]), 'deps to an earlier milestone by number; self / unknown / out of range dropped');

// kept tasks against the new plan
const plan = { milestones: [{ id: 'G0', track: 'mvp', name: 'Setup', tasks: [T('G0.1', 'Project setup'), T('G0.2', 'Input map', ['G0.1']), T('G0.3', 'Save system', ['G0.2'])] },
  { id: 'EXP', name: 'manual', tasks: [] }] };
const old = [
  { id: 'G0.1', milestone: 'G0', status: 'done', title: 'Project setup', detail: 'old detail' }, // the same task — shown as it is
  { id: 'G0.2', milestone: 'G0', status: 'in_progress', title: 'Camera rig' },                 // another task on the new id
  { id: 'G0.9', milestone: 'G0', status: 'review', title: 'Audio bus' },                       // not in the new plan, its milestone is
  { id: 'G3.1', milestone: 'G3', status: 'done', title: 'Boss fight' },                        // its milestone is gone
  { id: 'G0.3', milestone: 'G0', status: 'todo', title: 'Old save', assignee: { uid: 'u1' } }, // open → replaced, keeps the person
  { id: 'G0.5', milestone: 'G0', status: 'todo', title: 'Dropped' },                           // open, not in the new plan → deleted
  { id: 'B1', milestone: 'G0', status: 'todo', kind: 'bug', title: 'Crash' },
];
const r = reconcileTasks(plan, old, { milestones: [{ id: 'G3', name: 'Boss', goal: 'g' }] });
const g0 = plan.milestones[0];
check(r.writes.map((w) => w.id).join(), 'G0.4,G0.3', 'the kept same task is not rewritten; the new «Input map» moves off the kept «Camera rig» id');
check(g0.tasks.map((t) => t.id + ' ' + t.title).join(' | '), 'G0.1 Project setup | G0.4 Input map | G0.3 Save system | G0.2 Camera rig | G0.9 Audio bus', 'the plan lists what the task docs hold: kept ones included');
check(g0.tasks[0].detail, 'old detail', 'a kept same task shows its own text in the plan');
check(JSON.stringify(r.writes.find((w) => w.id === 'G0.3').data.deps), JSON.stringify(['G0.4']), 'deps follow the moved task');
check(r.writes.find((w) => w.id === 'G0.3').data.assignee.uid, 'u1', 'a replaced open task keeps its person');
check(r.writes.map((w) => w.data.order).join(), '2,3', 'every new task keeps its own order');
check(r.drop.join(), 'G0.5', 'only the open task the new plan replaced without a successor is deleted (bugs never)');
const car = plan.milestones.find((m) => m.id === 'G3');
check(!!car && car.carried && car.track === '' && car.name === 'Boss' && car.tasks.map((t) => t.id).join() === 'G3.1', true, 'a kept task whose milestone vanished: a carried milestone without a gate');
check(plan.milestones.map((m) => m.id).join(), 'G0,G3,EXP', 'carried milestones go before the manual ones');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
