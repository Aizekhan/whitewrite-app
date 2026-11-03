// Model watch decisions (functions/src/model-watch.js) with stubbed Firestore / Storage / fetch / claudeText. Run: npm test
const path = require('path');
const F = require('path').join(__dirname, '../functions/');
const store = {}; const notices = []; const files = [];
const docRef = (p) => ({ get: async () => ({ exists: !!store[p], data: () => store[p] }), set: async (d, o) => { store[p] = Object.assign({}, o && o.merge ? store[p] : {}, d); } });
const db = { collection: (c) => ({ doc: (id) => docRef(c + '/' + id), add: async (d) => { notices.push(d); return { id: 'n' + notices.length }; } }) };
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS' } }, storage: () => ({ bucket: () => ({ file: (n) => ({ save: async () => files.push(n) }) }) }) };
require.cache[require.resolve(F + 'src/common.js')] = { exports: { onRequest: (o, f) => f, admin, db, cors: (q, r, f) => f(), claudeApiKey: { value: () => 'k' }, requireAdmin: async () => true } };
let smokeFail = false;
require.cache[require.resolve(F + 'src/claude.js')] = { exports: {
  activeModels: async () => Object.assign({ haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' }, (store['config/ai_models'] || {}).active || {}),
  claudeText: async ({}, o) => { if (smokeFail) throw new Error('400 output_config.effort not supported'); return { text: 'Туман повільно сповзає з вершин дерев.' }; } } };
require.cache[require.resolve('firebase-functions/v2/scheduler', { paths: [F] })] = { exports: { onSchedule: (o, f) => f } };
const W = require(F + 'src/model-watch.js');

let models, priceRows, depRows = [];
const mk = (id, name, created, extra) => Object.assign({ id, display_name: name, created_at: created, max_input_tokens: 1000000, max_tokens: 128000,
  capabilities: { effort: { supported: true }, thinking: { types: { adaptive: { supported: true } } } } }, extra || {});
const row = (n, a, b) => `| ${n} | $${a} / MTok | $1 / MTok | $2 / MTok | $0.1 / MTok | $${b} / MTok |`;
global.fetch = async (url) => url.includes('/v1/models')
  ? { ok: true, json: async () => ({ data: models, has_more: false }) }
  : url.includes('deprecations') ? { text: async () => '| API model name | Current state | Deprecated | Tentative retirement date |\n| :- | :- | :- | :- |\n' + depRows.join('\n') + '\n' }
  : { text: async () => '| Model | Base input tokens | 5m | 1h | hits | Output tokens |\n|---|---|---|---|---|---|\n' + priceRows.join('\n') + '\n' };
const base = () => [mk('claude-haiku-5-5', 'Claude Haiku 5.5', '2026-08-01T00:00:00Z'), mk('claude-sonnet-5-5', 'Claude Sonnet 5.5', '2026-09-01T00:00:00Z'), mk('claude-opus-5-5', 'Claude Opus 5.5', '2026-09-01T00:00:00Z')];
const baseRows = () => [row('Claude Haiku 5.5', 0.10, 0.50), row('Claude Sonnet 5.5', 2, 10), row('Claude Opus 5.5', 4, 20)];
const run = (fn) => require(F + 'index.js') && W.modelWatchRun({}, { json: (j) => j, status: () => ({ json: (j) => { throw new Error(JSON.stringify(j)); } }) });
let fails = 0; const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

(async () => {
  const go = async () => { const r = await W.modelWatchRun({}, { json: (j) => j, status: () => ({ json: (j) => { throw new Error(JSON.stringify(j)); } }) }); return r; };
  // 1. nothing new
  models = base(); priceRows = baseRows(); await go();
  check(notices.length === 0 && store['config/ai_models'].active.sonnet === 'claude-sonnet-5-5', 'all current → no notice, no switch');
  // 2. a new Sonnet, same price → auto switch + info notice + file
  models = base().concat(mk('claude-sonnet-6', 'Claude Sonnet 6', '2026-12-01T00:00:00Z')); priceRows = baseRows().concat(row('Claude Sonnet 6', 2, 10));
  await go();
  check(store['config/ai_models'].active.sonnet === 'claude-sonnet-6' && notices.length === 1 && notices[0].severity === 'info' && files.length === 1, 'new Sonnet at the same price → switched automatically, info notice + file');
  check(!!store['config/ai_models'].pricing['claude-sonnet-6'], 'its price goes to the live pricing (billing knows it)');
  // 3. a new Opus 60% pricier → held, critical
  models = models.concat(mk('claude-opus-6', 'Claude Opus 6', '2026-12-02T00:00:00Z')); priceRows = priceRows.concat(row('Claude Opus 6', 6.4, 32));
  await go();
  const crit = notices[notices.length - 1];
  check(store['config/ai_models'].active.opus === 'claude-opus-5-5' && crit.severity === 'critical' && /\+60%/.test(crit.body) && /paid-features/.test(crit.body), 'new Opus +60% → NOT switched, critical notice asks to re-price: ' + crit.title);
  const n = notices.length; await go();
  check(notices.length === n, 'the same held version is not re-announced every day');
  // 4. new Haiku without a price → held
  models = models.concat(mk('claude-haiku-6', 'Claude Haiku 6', '2026-12-03T00:00:00Z')); await go();
  check(store['config/ai_models'].active.haiku === 'claude-haiku-5-5' && /ціни немає/.test(notices[notices.length - 1].body), 'new Haiku with no price → held');
  // 5. smoke call fails → held
  priceRows = priceRows.concat(row('Claude Haiku 6', 0.1, 0.5)); store['config/ai_models'].held = {}; smokeFail = true; await go(); smokeFail = false;
  console.log(JSON.stringify(notices.slice(-2).map(x=>x.title)), store["config/ai_models"].active.haiku);
  check(store['config/ai_models'].active.haiku === 'claude-haiku-5-5' && notices.some((x) => x.tier === 'haiku' && /пробний виклик/.test(x.body)), 'a failing test call in our request shape → held');
  // 6. active model's price rises 20% → live pricing updated + critical
  priceRows = priceRows.map((r) => r.startsWith('| Claude Sonnet 6 ') ? row('Claude Sonnet 6', 2.4, 12) : r); await go();
  check(store['config/ai_models'].pricing['claude-sonnet-6'].output === 12 && /зросла/.test(notices.find((x) => /Ціна Claude Sonnet 6/.test(x.title)).title), 'the active model gets 20% pricier → billing follows, critical notice');
  check(store['config/ai_models'].priceIndex.sonnet === 1.2 && store['config/ai_models'].priceIndex.haiku === 1, 'the price index follows: Sonnet 1.2 → every shown ✦ price +20%');
  // 7. the active Opus is retired → forced to the newest priced one
  models = models.filter((m) => m.id !== 'claude-opus-5-5'); await go();
  check(store['config/ai_models'].active.opus === 'claude-opus-6' && notices[notices.length - 1].severity === 'critical' && /примусово/.test(notices[notices.length - 1].title), 'the active Opus retired → forced switch + critical notice');
  // 8. cadence: settle everything → 'watch' mode; a scheduled run inside 14 days is skipped, after 14 days it runs
  const S = () => store['config/ai_models'];
    S().active.haiku = 'claude-haiku-6'; await go();
  check(S().mode === 'watch' && !Object.keys(S().held).length, 'all settled → back to «every 2 weeks» mode: ' + JSON.stringify(S().held));
  const t0 = S().fullAt, n8 = notices.length;
  const skip = await W._modelWatch.runWatch({ now: t0 + 3 * 864e5 });
  check(/пропуск/.test(skip[0]) && S().fullAt === t0, 'scheduled run on day 3 in watch mode → skipped: ' + skip[0]);
  await W._modelWatch.runWatch({ now: t0 + 15 * 864e5 });
  check(S().fullAt === t0 + 15 * 864e5, 'after 14 days → the full check runs');
  // 9. early warning from the docs: a newer Sonnet priced in the docs, not in our Models API yet → pre-analysis, daily
  priceRows = priceRows.concat(row('Claude Sonnet 7', 2.64, 13.2));
  const F = t0 + 15 * 864e5; await W._modelWatch.runWatch({ now: F + 14 * 864e5 });
  const up = notices[notices.length - 1];
  check(S().mode === 'daily' && S().upcoming.sonnet && /Sonnet 7/.test(up.title) && up.severity === 'info' && /\+10%/.test(up.body) && S().active.sonnet === 'claude-sonnet-6', 'upcoming Sonnet 7 in the docs → info pre-analysis (+10%, will switch itself), daily mode, users stay: ' + up.title);
  const n9 = notices.length; await W._modelWatch.runWatch({ now: F + 15 * 864e5 });
  check(notices.length === n9 && S().fullAt === F + 15 * 864e5, 'daily mode runs the next day, the upcoming one is not re-announced');
  // it appears → switched automatically, upcoming cleared
  models = models.concat(mk('claude-sonnet-7', 'Claude Sonnet 7', '2027-01-01T00:00:00Z')); await W._modelWatch.runWatch({ now: F + 16 * 864e5 });
  check(S().active.sonnet === 'claude-sonnet-7' && !S().upcoming.sonnet && S().mode === 'watch', 'Sonnet 7 appears → switched, back to every-2-weeks mode');
  // 10. the active Opus deprecated, retirement in 60 days, the newer Opus is +60% → held, daily; 10 days before retirement → forced
  models = models.concat(mk('claude-opus-7', 'Claude Opus 7', '2027-01-02T00:00:00Z')); priceRows = priceRows.concat(row('Claude Opus 7', 10.24, 51.2));
  const T = F + 30 * 864e5, ret = new Date(T + 60 * 864e5).toUTCString().slice(5, 16);
  depRows = ['| claude-opus-6 | Deprecated | January 5, 2027 | ' + new Date(T + 60 * 864e5).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ' |'];
  await W._modelWatch.runWatch({ now: T });
  check(S().deprecated.opus && S().deprecated.opus.id === 'claude-opus-6' && S().active.opus === 'claude-opus-6' && S().held.opus === 'claude-opus-7' && S().mode === 'daily'
    && notices.some((x) => /застарілою/.test(x.title)), 'deprecated active Opus → critical notice with the date, new one held (+60%), daily mode, users stay');
  await W._modelWatch.runWatch({ now: T + 50 * 864e5 });
  check(S().active.opus === 'claude-opus-7' && S().mode === 'watch' && /скоро знімуть/.test(notices[notices.length - 1].title) && !S().deprecated.opus, 'within 14 days of retirement → forced switch to the priced newer Opus: ' + notices[notices.length - 1].title);
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
