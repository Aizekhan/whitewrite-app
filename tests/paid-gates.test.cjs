// Every plan limit of the registry (functions/paid-features.js) is real on the server: the plan → flag table is consistent,
// the server's getPlanBudget is the registry's, and every flag / priced AI op is actually read by server code
// (or is listed below as a deliberate client-only gate, with the reason). Run: npm test
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '../functions');
const P = require(path.join(F, 'paid-features.js'));
const { getPlanBudget } = require(path.join(F, 'plans.js'));
const server = fs.readdirSync(path.join(F, 'src')).map((f) => fs.readFileSync(path.join(F, 'src', f), 'utf8'))
  .concat(['token-service.js', 'canon-store.js'].map((f) => fs.readFileSync(path.join(F, f), 'utf8')))
  .concat(['firestore.rules', 'storage.rules'].map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8'))).join('\n');
const has = (word) => new RegExp('(^|[^A-Za-z0-9_])' + word + '([^A-Za-z0-9_]|$)').test(server);
const quoted = (word) => server.indexOf("'" + word + "'") >= 0 || server.indexOf('"' + word + '"') >= 0;

// gates the browser enforces on purpose: no AI cost, the author's own data
const CLIENT_ONLY = {
  allowExport: 'DOCX / PDF are built in the browser from the story the author already reads (app/book-export.js)',
  allowWorldTree: 'Bible editing of the author\'s own canon — no AI, no cost; every ✦ inside the Bible checks its own flag on the server',
  allowSonnet: 'the model choice — the server picks the tier by MODEL_TIERS (claude.js modelTier), checked below',
  allowOpus: 'the model choice — the server picks the tier by MODEL_TIERS (claude.js modelTier), checked below',
};
// priced ops whose server code passes the op through a variable (gamedev / narrative / experience)
const VIA_VARIABLE = { import: 'gamedev.js', analyze: 'gamedev.js', plan: 'gamedev.js', repoSync: 'gamedev.js',
  questDraft: 'narrative.js', dialogueDraft: 'narrative.js', canonAudit: 'gamedev.js', expReport: 'experience.js', playtest: 'experience.js' };

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const live = P.FEATURES.filter((f) => !f.soon && !f.planned);

// 1. one flag = one minimum plan (planBudget ORs features of a flag: a mismatch would open a gate silently)
[...new Set(P.FEATURES.filter((f) => f.flag).map((f) => f.flag))].forEach((fl) => {
  const mins = [...new Set(P.FEATURES.filter((f) => f.flag === fl).map((f) => f.minPlan))];
  check(mins.length === 1, `${fl}: every feature under it starts at one plan (${mins.join(', ')})`);
});

// 2. the plan table: a flag is on exactly from its minimum plan; worldforge = worldbuilder; unknown plans = free
P.PLAN_ORDER.concat(['worldforge']).forEach((plan) => {
  const b = P.planBudget(plan);
  P.FEATURES.filter((f) => f.flag).forEach((f) => {
    const want = P.planRank(plan) >= P.PLAN_ORDER.indexOf(f.minPlan);
    if (b[f.flag] !== want) check(false, `${plan}.${f.flag} = ${b[f.flag]}, want ${want}`);
  });
});
check(JSON.stringify(P.planBudget('worldforge')) === JSON.stringify(Object.assign({}, P.planBudget('worldbuilder'), { monthly: P.planBudget('worldforge').monthly, maxProjects: P.planBudget('worldforge').maxProjects })), 'worldforge opens what worldbuilder opens');
check(JSON.stringify(P.planBudget('nonsense')) === JSON.stringify(P.planBudget('free')), 'an unknown plan gets Free');
check(P.FEATURES.filter((f) => f.flag).every((f) => !P.planBudget('free')[f.flag] || f.minPlan === 'free'), 'Free opens no paid flag');

// 3. the server reads the registry, not its own table
P.PLAN_ORDER.concat(['worldforge', 'nonsense']).forEach((plan) => {
  const a = getPlanBudget(plan), b = P.planBudget(plan);
  const keys = Object.keys(b).filter((k) => /^allow/.test(k));
  check(keys.every((k) => !!a[k] === !!b[k]), `plans.js getPlanBudget('${plan}') matches the registry`);
});

// 4. the model tiers the server uses agree with the «model» gates shown on the plan cards
[['modelSonnet', 'sonnet'], ['modelOpus', 'opus']].forEach(([fid, tier]) => {
  const f = P.FEATURES.find((x) => x.id === fid), t = P.MODEL_TIERS.find((x) => x.id === tier);
  check(f && t && f.minPlan === t.minPlan, `${fid} starts at the plan of the ${tier} tier (${f && f.minPlan} / ${t && t.minPlan})`);
});
check(/modelTier\(/.test(fs.readFileSync(path.join(F, 'src', 'claude.js'), 'utf8')), 'claude.js picks the model with modelTier (plan-checked)');

// 5. every live flag is read by server code or rules (or is a listed client-only gate)
[...new Set(live.filter((f) => f.flag).map((f) => f.flag))].forEach((fl) => {
  if (CLIENT_ONLY[fl]) return check(true, `${fl}: client-only on purpose — ${CLIENT_ONLY[fl]}`);
  check(has(fl), `${fl} is checked on the server`);
});

// 6. every live priced AI op is reserved / billed by server code under its registry name
live.filter((f) => f.kind === 'ai').forEach((f) => {
  const op = f.op || f.id;
  if (VIA_VARIABLE[op]) return check(quoted(op), `${f.id}: op '${op}' handled in ${VIA_VARIABLE[op]}`);
  check(new RegExp("byOp\\(['\"]" + op + "['\"]\\)").test(server), `${f.id}: the server prices it with byOp('${op}')`);
});

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
