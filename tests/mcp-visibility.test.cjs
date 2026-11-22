// 👁 MCP sees everything the author sees (owner's rule 2026-11-22, CLAUDE.md «MCP бачить усе, що бачить автор»): every field of plan/current,
// the plan, the game and world docs, and every game / world collection the Game Bible reads must be read by functions/src/mcp.js too;
// every shared module the Bible computes with must be required by mcp.js. A deliberate exception — HIDDEN with the reason. Run: npm test
const fs = require('fs'), path = require('path');
const g = fs.readFileSync(path.join(__dirname, '../app/gamebible.js'), 'utf8'), m = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const HIDDEN = { // name → why the agent does not need it (only pure visuals, the Bible's own plumbing, or secrets) — the reason is required
  'world.json': 'not a field: a file extension in a string', 'world.md': 'not a field: a file extension', 'world.jpg': 'not a field: a file extension',
  'game.js': 'not a field: a file extension', 'plan.md': 'not a field: a file extension',
};
const grab = (re) => [...new Set([...g.matchAll(re)].map((x) => x[1]))];
const seen = (n) => new RegExp("[.'\"`]" + n + "(?![\\w$])").test(m);
let fails = 0; const fail = (msg) => { console.log('FAIL ' + msg); fails++; };
const SCOPES = { planDoc: /planDoc\.(\w+)/g, plan: /[^.\w]plan\.(\w+)/g, game: /[^.\w]game\.(\w+)/g, world: /[^.\w]world\.(\w+)/g,
  'gref().collection': /gref\(\)\.collection\("(\w+)"\)/g, 'wref().collection': /wref\(\)\.collection\("(\w+)"\)/g };
Object.entries(SCOPES).forEach(([scope, re]) => {
  const miss = grab(re).filter((n) => !seen(n) && !HIDDEN[scope.replace(/\(\)\.collection/, '') + '.' + n] && !HIDDEN[scope + '.' + n]);
  if (miss.length) fail(`${scope}: the Bible reads ${miss.join(', ')} — MCP does not. Give it to the agent (a tool or a field) or add it to HIDDEN with the reason.`);
  else console.log('PASS ' + scope + ': everything the Bible reads, MCP reads');
});
// the shared modules the Bible computes with (window.__X = functions/x.js) → mcp.js requires them, so both count the same
const CLIENT_ONLY = { __PAID_FEATURES: 'prices — the server gates them itself', __FILL: 'card-fill prompts (UI helper)', __GB_LINKS: 'link rendering', __GB_EXPORT: 'browser export to MD / PDF',
  __NARRATIVE: 'required as narrative-validate.js', __GAMEMAP: 'required as game-map.js', __SETUP_GUIDES: 'required as setup-guides.js', __STYLE: 'required as style-guide.js', __DESIGN: 'required as design-checks.js',
  __TASK_TYPES: 'required as task-types.js', __CARD_REFS: 'required as card-refs.js', __ASSET_KIT: 'required as asset-kit.js', __MECH: 'required as mechanics.js', __PERSONA: 'required as persona.js', __FORGE: 'required as forge.js', __GDD: 'required as gdd-schema.js' };
const FILE = { __NARRATIVE: 'narrative-validate', __GAMEMAP: 'game-map', __SETUP_GUIDES: 'setup-guides', __STYLE: 'style-guide', __DESIGN: 'design-checks', __TASK_TYPES: 'task-types',
  __CARD_REFS: 'card-refs', __ASSET_KIT: 'asset-kit', __MECH: 'mechanics', __PERSONA: 'persona', __FORGE: 'forge', __GDD: 'gdd-schema' };
const mods = grab(/window\.(__[A-Z][A-Z_]+)/g);
const bad = mods.filter((x) => !CLIENT_ONLY[x] || (FILE[x] && !m.includes(`require('../${FILE[x]}.js')`)));
if (bad.length) fail('shared modules the Bible uses and MCP does not require: ' + bad.join(', ') + ' — require them in mcp.js (or list them in CLIENT_ONLY with the reason)');
else console.log('PASS every module the Bible computes with is required by MCP (' + mods.length + ')');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exitCode = fails ? 1 : 0;
