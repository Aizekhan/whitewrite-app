// The service is interconnected (CLAUDE.md «Чекліст кожної нової функції»): these checks find on their own what a new
// feature forgot to plug in — new card references outside functions/card-refs.js, MCP tools without a KB line, Cloud
// Functions missing from ARCHITECTURE.md, plan flags outside functions/paid-features.js. Run: npm test (and the commit gate).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const list = (dir, re) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => re.test(f)).map((f) => dir + '/' + f);
let fails = 0;
const check = (ok, msg, fix) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok || !fix ? '' : '\n     → ' + fix)); if (!ok) fails++; };

// 1. Card references — a ratchet: every place code builds or names a card reference is counted per file; more than the
//    baseline means a new reference that must become a KIND of functions/card-refs.js (then raise the baseline here).
const SRC = list('app', /\.(js|jsx|html)$/).concat(list('functions', /\.js$/), list('functions/src', /\.js$/))
  .filter((f) => !/card-refs\.js$|kb\.js$|i18n\.js$/.test(f));
const REF = /["']c:["']\s*\+|\b(cardIds?|card_ids?|cardRefs?|card_ref)\b/g;
const BASE = JSON.parse(read('tests/card-refs.baseline.json'));
SRC.forEach((f) => {
  const n = (read(f).match(REF) || []).length, b = (BASE.counts[f] || 0);
  check(n <= b, `card references in ${f}: ${n} (baseline ${b})`,
    `a new reference to a card? add a KIND to functions/card-refs.js (it then shows in «🔗 Що зачепить зміна» and MCP used_by), then set "${f}": ${n} in tests/card-refs.baseline.json with a note why`);
  if (n < b) console.log(`     (lower the baseline of ${f} to ${n})`);
});

// 2. Every MCP tool is explained in the Knowledge base (uk + en share the article ids; the names are the same in both)
const mcp = read('functions/src/mcp.js'), kb = read('app/kb.js');
const tools = [...mcp.matchAll(/^  \{ name: '([a-z_]+)'/gm)].map((m) => m[1]);
check(tools.length > 30, `MCP tools found: ${tools.length}`);
tools.forEach((t) => check(kb.indexOf(t) >= 0, `MCP tool ${t} is in app/kb.js`, `name it in the «Ключі MCP» / «MCP keys» articles of app/kb.js (uk + en)`));

// 3. Every Cloud Function is in ARCHITECTURE.md
const arch = read('ARCHITECTURE.md'), idx = read('functions/index.js');
let fns = [...idx.matchAll(/^exports\.(\w+)/gm)].map((m) => m[1]);
for (const m of idx.matchAll(/Object\.assign\(exports, require\('(.+?)'\)\)/g)) fns = fns.concat([...read('functions/' + m[1].replace('./', '') + '.js').matchAll(/^exports\.(\w+) =/gm)].map((x) => x[1]).filter((x) => x[0] !== '_'));
check(fns.length > 30, `Cloud Functions found: ${fns.length}`);
fns.forEach((f) => check(arch.indexOf(f) >= 0, `function ${f} is in ARCHITECTURE.md`, 'describe it in ARCHITECTURE.md (the module tree or its section)'));

// 4. Every plan flag the code reads is a flag of the registry (no gating outside functions/paid-features.js)
const P = require(path.join(ROOT, 'functions/paid-features.js'));
const flags = Object.keys(P.planBudget('worldforge'));
const LEGACY = { allowCanonExtraction: 'auto-canon removed 2026-11-02 — never set, so syncCanonFromProject always answers 410' };
const code = list('functions/src', /\.js$/).concat(list('app', /\.(js|jsx|html)$/)).filter((f) => !/kb\.js$/.test(f)).map(read).join('\n');
[...new Set([...code.matchAll(/\ballow[A-Z]\w+/g)].map((m) => m[0]))].forEach((f) =>
  check(flags.indexOf(f) >= 0 || !!LEGACY[f], `plan flag ${f} is in functions/paid-features.js`, 'add the feature to the registry (functions/paid-features.js) — CLAUDE.md rule'));

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
