// 🧭 GDD schema (functions/gdd-schema.js, v2.138): every game section of the Bible is in the schema and the other way round, every
// «not here → go to» points at a real section, the sections Claude Code may write = MCP save_card's, stages are 1–13 in order.
// Run: npm test
const fs = require('fs'), path = require('path');
const G = require('../functions/gdd-schema.js');
const bible = fs.readFileSync(path.join(__dirname, '../app/gamebible.js'), 'utf8');
const mcp = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

// the Bible's game sections: GAME[] ids + the special ones gameSectionsAll() adds
const gameArr = bible.slice(bible.indexOf('var GAME = ['), bible.indexOf('var TL_STD'));
const ids = [...gameArr.matchAll(/^ {4}\{ id: "([a-z]+)"/gm)].map((m) => m[1]);
const specials = { GSTORIES: 'gstories', GAMEMAP_SEC: 'gamemap', FORGE_SEC: 'forge', ISSUES: 'issues', PLAN: 'plan', QUESTS: 'quests', DIALOGUES: 'dialogues', EXPERIENCE: 'experience', KNOWLEDGE: 'knowledge', ACTIVITY: 'activity', MARKETING: 'marketing' };
const allLine = /return GAME\.concat\(own, \[([^\]]+)\]\)/.exec(bible);
check(!!allLine, true, 'gameSectionsAll lists the special sections');
(allLine ? allLine[1].split(',').map((x) => x.trim()) : []).forEach((v) => { if (specials[v]) ids.push(specials[v]); else check(v, 'a known special', 'special section ' + v + ' is mapped in this test'); });
if (/id: "chapters"/.test(bible)) ids.push('chapters');

ids.forEach((id) => check(!!G.section(id), true, `Bible section ${id} is in the schema`));
G.SECTIONS.forEach((s) => check(ids.includes(s.id), true, `schema section ${s.id} is in the Bible`));
G.SECTIONS.forEach((s) => s.not.forEach((x) => check(x.goTo === 'canon' || !!G.section(x.goTo), true, `${s.id}: «not here» → ${x.goTo} exists`)));
G.SECTIONS.forEach((s) => check(!!(s.uk && s.en && s.here && s.here.uk && s.here.en), true, `${s.id}: names and «goes here» in uk + en`));

// stages: 1..13, each has sections, each section's stage exists
check(G.STAGES.map((s) => s.n).join(','), Array.from({ length: 13 }, (_, i) => i + 1).join(','), 'stages are 1–13 in order');
G.STAGES.forEach((st) => check(G.SECTIONS.some((s) => s.stage === st.n), true, `stage ${st.n} has sections`));
G.STAGES.forEach((st) => (st.need || []).forEach((r) => r[0].forEach((id) => check(!!G.section(id), true, `stage ${st.n} minimum names ${id}`))));

// the sections save_card writes = the schema's write sections
const ws = /const WRITE_SECS = \[([^\]]+)\]/.exec(mcp);
const mcpWrite = ws ? ws[1].split(',').map((x) => x.trim().replace(/'/g, '')).sort().join(',') : '';
check(mcpWrite, G.SECTIONS.filter((s) => s.write).map((s) => s.id).sort().join(','), 'MCP save_card sections = the schema\'s «Claude Code writes»');

// order and state
check(G.order(['tech', 'overview', 'own_x', 'mechanics']).join(','), 'overview,mechanics,tech,own_x', 'order: by stage, the author\'s own last');
const st2 = G.stage(2);
check(G.stageState(st2, () => 0), 'empty', 'no mechanics → empty');
check(G.stageState(st2, (id) => (id === 'mechanics' ? 2 : 0)), 'partial', 'two mechanics → partial (minimum 3)');
check(G.stageState(st2, (id) => (id === 'mechanics' ? 3 : 0)), 'done', 'three mechanics → done');
check(G.stageState(G.stage(5), (id) => (id === 'characters' ? 4 : 0)), 'partial', 'heroes without enemies → partial');
check(G.stageState(G.stage(12), (id) => (id === 'telemetry' ? 1 : 0)), 'done', 'an optional stage is done with anything in it');
const rules = G.promptRules('en', ['overview', 'companions']);
check(/overview — Game overview/.test(rules) && /companions/.test(rules) && !/^- mechanics/m.test(rules), true, 'promptRules lists only the asked sections');
check(G.forAgent('uk').stages.length, 13, 'forAgent gives all stages');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
