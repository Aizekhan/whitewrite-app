// Model watch — keeps the Claude models current without a deploy, and without surprises (owner decision 2026-11-02).
// Cadence: a full check every 14 days ('watch' mode); while something is in flight — a new version is announced or
// out, a switch is held for the admin, the active model is deprecated, or a model vanished — it checks DAILY
// ('daily' mode) and drops back to 'watch' when all is settled. Users stay on the current model until a switch.
// Early warning: the deprecations page (retirement dates of our models) and the docs (a newer version priced or
// listed there before our key sees it in the Models API) → a pre-analysis notice, so the switch is prepared.
// A full check: list the models (Anthropic Models API) + read the official price table, then per tier (haiku/sonnet/opus):
//  · a newer version of the tier is switched in AUTOMATICALLY only when every check passes:
//      its price is known, a typical call costs ≤ MAX_PRICE_RATIO × the current one, it keeps the capabilities we use
//      (context, output, effort, adaptive thinking) and a real smoke call in our request shape returns text;
//  · otherwise nothing switches and a CRITICAL admin notice explains what to decide (e.g. re-price the plans);
//  · a price change of the active model updates the live pricing (the charge is the real API cost, so billing follows)
//    and a rise above PRICE_ALERT also raises a critical notice (plan budgets / typical prices need a look);
//  · the active model disappearing from the API (retired), or its retirement date coming within RETIRE_SOON,
//    forces the switch to the newest priced one + a notice;
//  · between checks a vanished model is caught at call time (claude.js withFallback → config/ai_models.broken).
// State: config/ai_models { active: {tier: id}, pricing, snapshot, held, upcoming, deprecated, broken, mode, fullAt, checkedAt, lastChange }.
// Notices: admin_notices/{id} (admins see a banner in the Account) + a Markdown file admin/notices/… in Storage.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, admin, db, cors, claudeApiKey, requireAdmin } = require('./common');
const { AI_MODELS, MODEL_PRICING } = require('../ai-models.js');
const { priceIndexFor } = require('../paid-features.js');
const { claudeText } = require('./claude');
const { notify } = require('./admin-notice');
// outbound calls time out: a hanging remote must not hold the function until its own timeout
const fetch = (url, o = {}) => globalThis.fetch(url, { signal: AbortSignal.timeout(20000), ...o });

const TIERS = ['haiku', 'sonnet', 'opus'];
const PRICING_URL = 'https://platform.claude.com/docs/en/about-claude/pricing.md';
const DEPRECATIONS_URL = 'https://platform.claude.com/docs/en/about-claude/model-deprecations.md';
const DAY = 24 * 3600 * 1000;
const FULL_EVERY = 14 * DAY;  // 'watch' mode: a full check every two weeks
const RETIRE_SOON = 14 * DAY; // a deprecated active model is replaced this long before its retirement date
const MAX_PRICE_RATIO = 1.25; // a new version may cost at most +25% per typical call to switch by itself
const PRICE_ALERT = 1.10;     // the active model's own price rising >10% → critical notice
const NEED = { maxTokens: 48000, context: 200000 }; // our longest call (game plan) and prompt size
const TYPICAL = { input: 1500, output: 2000 };       // a scene-sized call, to compare prices

// The official price table → { 'Claude Sonnet 5.5': {input, output, cacheWrite, cacheRead, over?} }
function parsePricing(md) {
  const out = {};
  const num = (cell) => { const m = String(cell).match(/\$([\d.]+)/); return m ? parseFloat(m[1]) : null; };
  const lines = md.split('\n');
  const head = lines.findIndex((l) => /^\|\s*Model\s*\|.*Base input/i.test(l));
  if (head < 0) return out;
  for (let i = head + 2; i < lines.length && lines[i].startsWith('|'); i++) {
    const c = lines[i].split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 6) continue;
    const name = c[0].replace(/<[^>]+>/g, '').replace(/\s*\(.*\)\s*$/, '').trim();
    const p = { input: num(c[1]), cacheWrite: num(c[2]), cacheRead: num(c[4]), output: num(c[5]) };
    if (p.input == null || p.output == null) continue;
    const over = c[0].match(/over ([\d,]+) tokens/i);
    if (over) { if (out[name]) out[name].over = Object.assign({ tokens: parseInt(over[1].replace(/,/g, ''), 10) }, p); }
    else if (!out[name]) out[name] = p;
  }
  return out;
}

// The deprecations page → { 'claude-sonnet-4-5-20250929': {state, retires, replacement} }. Two table shapes:
// | API model name | Current state | Deprecated | Tentative retirement date | and | Retirement date | Deprecated model | Recommended replacement |
function parseDeprecations(md) {
  const out = {};
  const date = (x) => { const t = Date.parse(String(x).replace(/^not sooner than\s*/i, '')); return isNaN(t) ? null : t; };
  for (const l of String(md).split('\n')) {
    if (!l.startsWith('|')) continue;
    const c = l.split('|').slice(1, -1).map((x) => x.trim().replace(/`/g, ''));
    if (c.length >= 4 && /^claude-/.test(c[0])) {
      const soon = /not sooner/i.test(c[3]);
      out[c[0]] = Object.assign(out[c[0]] || {}, { state: c[1], retires: soon ? null : date(c[3]) });
    } else if (c.length >= 3 && /^claude-/.test(c[1]) && /^claude-/.test(c[2])) {
      out[c[1]] = Object.assign({ retires: date(c[0]) }, out[c[1]] || {}, { replacement: c[2] });
    }
  }
  return out;
}

// version of an id / a display name, to tell "newer": claude-sonnet-5-5 → [5,5], 'Claude Sonnet 6' → [6,0]
const verOfId = (id) => { const m = String(id).match(/^claude-(?:haiku|sonnet|opus)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/); return m ? [+m[1], +(m[2] || 0)] : null; };
const verOfName = (n) => { const m = String(n).match(/(?:Haiku|Sonnet|Opus)\s+(\d+)(?:\.(\d+))?$/i); return m ? [+m[1], +(m[2] || 0)] : null; };
const isNewer = (a, b) => !!a && !!b && (a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]));
const tierOfName = (n) => ((String(n).match(/^Claude (Haiku|Sonnet|Opus) \d/i) || [])[1] || '').toLowerCase() || null;
const day = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '—');

async function listModels(apiKey) {
  const all = [];
  let after = null;
  for (let page = 0; page < 10; page++) {
    const url = 'https://api.anthropic.com/v1/models?limit=1000' + (after ? '&after_id=' + encodeURIComponent(after) : '');
    const r = await fetch(url, { headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } });
    if (!r.ok) throw new Error('Models API ' + r.status);
    const j = await r.json();
    all.push(...(j.data || []));
    if (!j.has_more) break;
    after = j.last_id;
  }
  return all.map((m) => {
    const cap = m.capabilities || {};
    return { id: m.id, name: m.display_name, created: Date.parse(m.created_at) || 0, context: m.max_input_tokens || 0, maxTokens: m.max_tokens || 0,
      effort: !!(cap.effort && cap.effort.supported), adaptive: !!(cap.thinking && cap.thinking.types && cap.thinking.types.adaptive && cap.thinking.types.adaptive.supported) };
  });
}

const tierOfId = (id) => (String(id).match(/^claude-(haiku|sonnet|opus)-\d/) || [])[1] || null;
const callCost = (p) => (p ? (TYPICAL.input * p.input + TYPICAL.output * p.output) / 1e6 : null);
const pct = (r) => (r >= 1 ? '+' : '') + Math.round((r - 1) * 100) + '%';

async function runWatch({ force = false, now = Date.now() } = {}) {
  const apiKey = claudeApiKey.value();
  const ref = db.collection('config').doc('ai_models');
  const state = (await ref.get()).data() || {};
  // 'watch' mode: only every FULL_EVERY (the admin button forces a check)
  if (!force && state.mode !== 'daily' && state.fullAt && now - state.fullAt < FULL_EVERY) {
    const r = [`пропуск: режим «раз на 2 тижні», наступна повна перевірка ${day(state.fullAt + FULL_EVERY)}`];
    console.log('[modelWatch]', r[0]);
    return r;
  }
  const active = Object.assign({}, AI_MODELS.claude, state.active || {}); // the switched ids, not the call-time fallbacks
  const livePricing = Object.assign({}, state.pricing || {});
  const known = (id) => livePricing[id] || MODEL_PRICING[id] || null;
  const held = Object.assign({}, state.held || {});
  const upcoming = {}, deprecated = {};
  const was = { upcoming: state.upcoming || {}, deprecated: state.deprecated || {} };

  const models = await listModels(apiKey);
  let table = {}, deps = {};
  try { table = parsePricing(await (await fetch(PRICING_URL)).text()); } catch (e) { console.warn('[modelWatch] pricing page:', e.message); }
  try { deps = parseDeprecations(await (await fetch(DEPRECATIONS_URL)).text()); } catch (e) { console.warn('[modelWatch] deprecations page:', e.message); }
  const priceOf = (m) => (m && table[m.name]) || null; // the official table first, it is the current truth
  const byId = Object.fromEntries(models.map((m) => [m.id, m]));
  const report = [];
  let changed = false;

  for (const tier of TIERS) {
    const curId = active[tier] || AI_MODELS.claude[tier];
    const cur = byId[curId];
    const curPrice = priceOf(cur) || known(curId);

    // 0. early warning: the active model is deprecated → note its retirement date, check daily, prepare the switch
    const dep = deps[curId];
    if (cur && dep && /deprecated|retired/i.test(dep.state || '')) {
      deprecated[tier] = { id: curId, retires: dep.retires || null, replacement: dep.replacement || null };
      if ((was.deprecated[tier] || {}).id !== curId) await notify({ severity: 'critical', tier, from: curId, to: dep.replacement || null,
        title: `${tier}: ${cur.name} оголошено застарілою — знімуть ${day(dep.retires)}`,
        body: `Anthropic позначив \`${curId}\` як «${dep.state}», орієнтовна дата зняття: ${day(dep.retires)}${dep.replacement ? `, рекомендована заміна \`${dep.replacement}\`` : ''}.

Сторож перейшов на щоденну перевірку. Нова версія вмикається сама, щойно пройде перевірки (ціна ≤ ${pct(MAX_PRICE_RATIO)}, можливості, пробний виклик); інакше — не пізніше ніж за ${RETIRE_SOON / DAY} днів до зняття, якщо її ціна відома. Користувачі до того працюють на поточній.` });
    }
    const retireSoon = !!(deprecated[tier] && deprecated[tier].retires && deprecated[tier].retires - now < RETIRE_SOON);

    // 1. the active model's own price moved → billing follows at once (real-cost charge), a rise is flagged
    if (cur && priceOf(cur)) {
      const was = known(curId), now = priceOf(cur);
      if (!was || was.input !== now.input || was.output !== now.output) {
        livePricing[curId] = now; changed = true;
        const r = was ? callCost(now) / callCost(was) : 1;
        if (was && r > PRICE_ALERT) await notify({ severity: 'critical', tier, from: curId, title: `Ціна ${cur.name} зросла (${pct(r)} на типовий виклик)`,
          body: `Було: $${was.input}/$${was.output} за MTok, стало: $${now.input}/$${now.output}.\n\nСписання вже рахує нову ціну (реальна вартість API), але токенів за той самий тариф вистачає на менше дій. **Потрібно:** переглянути \`MODEL_TIERS.typical/scale\`, бюджети тарифів і \`USD_PER_TOKEN\` у \`functions/paid-features.js\`.` });
      }
    }

    // 2. the newest version of this tier
    const cands = models.filter((m) => tierOfId(m.id) === tier).sort((a, b) => b.created - a.created || a.id.length - b.id.length);
    const next = cands[0];
    const retired = !cur;
    if (!next || (cur && (next.id === cur.id || next.created <= cur.created || next.name === cur.name))) {
      delete held[tier]; // nothing newer in the API (or the admin already switched to it)
      // early warning: a newer version already in the docs (price table / deprecations table) but not in our Models API yet
      const curVer = verOfId(curId);
      const docIds = Object.keys(deps).filter((id) => tierOfId(id) === tier && !byId[id] && /active/i.test(deps[id].state || '') && isNewer(verOfId(id), curVer));
      const docNames = Object.keys(table).filter((n) => tierOfName(n) === tier && isNewer(verOfName(n), curVer) && !models.some((m) => m.name === n));
      const name = docNames.sort((a, b) => (isNewer(verOfName(a), verOfName(b)) ? -1 : 1))[0];
      if (name || docIds.length) {
        const price = name ? table[name] : null, ratio = price && curPrice ? callCost(price) / callCost(curPrice) : null;
        const u = upcoming[tier] = { name: name || docIds[0], id: docIds[0] || null, price: price || null, ratio };
        const verdict = !price ? 'ціни ще немає — без неї автоперемикання не буде'
          : ratio > MAX_PRICE_RATIO ? `типовий виклик дорожчий на ${pct(ratio)} (поріг ${pct(MAX_PRICE_RATIO)}) — перемикання чекатиме рішення адміна; підготуй перерахунок \`MODEL_TIERS.typical/scale\` і бюджетів тарифів (\`functions/paid-features.js\`)`
          : `типовий виклик ${pct(ratio)} — у межах порогу, перемкнеться сама, якщо пройде перевірки можливостей і пробний виклик`;
        if ((was.upcoming[tier] || {}).name !== u.name) await notify({ severity: ratio > MAX_PRICE_RATIO ? 'critical' : 'info', tier, from: curId, to: u.id || u.name,
          title: `${tier}: готується ${u.name} — вона вже в документації Anthropic`,
          body: `Нова версія є в документації${u.id ? ` (\`${u.id}\`)` : ''}, але ще не доступна нашому ключу в Models API.${price ? ` Ціна: $${price.input}/$${price.output} за MTok (зараз $${curPrice ? curPrice.input + '/$' + curPrice.output : '?'}).` : ''}

Попередній аналіз: ${verdict}.

Сторож перевіряє щодня, доки вона не зʼявиться. Користувачі працюють на ${cur ? cur.name : curId}.` });
        report.push(`${tier}: ${curId} — актуальна; готується ${u.name}`);
      } else report.push(`${tier}: ${curId} — актуальна`);
      continue;
    }

    const nextPrice = priceOf(next) || known(next.id);
    const problems = [];
    if (!nextPrice) problems.push('ціни немає в офіційній таблиці — списання не змогло б порахувати вартість');
    const ratio = nextPrice && curPrice ? callCost(nextPrice) / callCost(curPrice) : null;
    if (ratio != null && ratio > MAX_PRICE_RATIO) problems.push(`типовий виклик дорожчий на ${pct(ratio)} (поріг ${pct(MAX_PRICE_RATIO)})`);
    if (next.maxTokens && next.maxTokens < NEED.maxTokens) problems.push(`max output ${next.maxTokens} < ${NEED.maxTokens}`);
    if (next.context && next.context < NEED.context) problems.push(`контекст ${next.context} < ${NEED.context}`);
    if (cur && cur.context && next.context && next.context < cur.context) problems.push(`контекст менший, ніж у ${cur.name} (${next.context} < ${cur.context})`);
    if (!next.effort) problems.push('немає параметра effort');
    if (!next.adaptive) problems.push('немає adaptive thinking');
    if (!problems.length) {
      try {
        const t = await claudeText(apiKey, { model: next.id, prompt: 'Одним реченням українською: туман над лісом на світанку.', maxTokens: 2000, effort: 'low', noFallback: true });
        if (!t.text || t.text.trim().length < 10) problems.push('пробний виклик повернув порожній текст');
      } catch (e) { problems.push('пробний виклик нашим форматом запиту впав: ' + String(e.message).slice(0, 300)); }
    }

    const facts = `Поточна: ${cur ? cur.name + ' (`' + curId + '`)' : '`' + curId + '` — більше немає в API'}${curPrice ? `, $${curPrice.input}/$${curPrice.output} за MTok` : ''}.\nНова: ${next.name} (\`${next.id}\`)${nextPrice ? `, $${nextPrice.input}/$${nextPrice.output} за MTok` : ', ціна невідома'}${ratio != null ? `, типовий виклик ${pct(ratio)}` : ''}; контекст ${next.context}, output ${next.maxTokens}.`;
    const forced = retired || retireSoon;
    if (!problems.length || (forced && nextPrice)) {
      active[tier] = next.id;
      if (nextPrice) livePricing[next.id] = nextPrice;
      delete held[tier]; delete deprecated[tier];
      changed = true;
      report.push(`${tier}: ${curId} → ${next.id}`);
      const big = ratio != null && ratio > PRICE_ALERT;
      await notify({ severity: forced || big || problems.length ? 'critical' : 'info', tier, from: curId, to: next.id,
        title: `${tier}: ${retired ? 'стара модель зникла — примусово' : retireSoon ? 'стару скоро знімуть — примусово' : 'автоматично'} ${cur ? cur.name : curId} → ${next.name}`,
        body: facts + (problems.length ? `\n\nПеремкнуто попри зауваження (${retired ? 'стару вже не обслуговують' : 'стару знімуть ' + day(deprecated[tier] ? deprecated[tier].retires : (deps[curId] || {}).retires)}):\n- ${problems.join('\n- ')}` : '\n\nУсі перевірки пройдено: ціна, можливості, пробний виклик.') +
          (big ? `\n\n**Ціна виросла ${pct(ratio)} — переглянь \`MODEL_TIERS.typical/scale\` і бюджети тарифів у \`functions/paid-features.js\`.**` : '') +
          `\n\nВідкат: Firestore \`config/ai_models.active.${tier}\` = \`${curId}\`.` });
    } else {
      report.push(`${tier}: ${next.id} НЕ перемкнуто (${problems.length} зауваж.)`);
      const seen = (state.held || {})[tier];
      if (seen !== next.id) await notify({ severity: 'critical', tier, from: curId, to: next.id, title: `${tier}: нова ${next.name} — потрібне рішення адміна`,
        body: facts + `\n\nАвтоперемикання зупинено:\n- ${problems.join('\n- ')}\n\n**Що зробити:** якщо ціна зросла — перерахувати \`MODEL_TIERS.typical/scale\`, бюджети тарифів і \`USD_PER_TOKEN\` (\`functions/paid-features.js\`), внести ціну в \`MODEL_PRICING\`; тоді перемкнути вручну: \`config/ai_models.active.${tier}\` = \`${next.id}\`.` });
      held[tier] = next.id; changed = true;
    }
  }

  // call-time swaps (claude.js withFallback): settled once the tier moved on; a model listed again and answering is restored
  const broken = Object.assign({}, state.broken || {});
  for (const id of Object.keys(broken)) {
    if (!Object.values(active).includes(id)) { delete broken[id]; continue; }
    if (!byId[id]) continue;
    try {
      const t = await claudeText(apiKey, { model: id, prompt: 'Одним словом: колір неба.', maxTokens: 1000, effort: 'low', noFallback: true });
      if (t.text) { delete broken[id]; report.push(`${id}: знову відповідає — заміну знято`); }
    } catch (e) { /* still gone — keep the swap */ }
  }

  // daily while anything is in flight, back to every two weeks when all is settled
  const busy = [held, upcoming, deprecated, broken].some((o) => Object.keys(o).length);
  const mode = busy ? 'daily' : 'watch';
  if (mode !== state.mode) report.push(busy ? 'режим: щодня (є що відстежувати)' : `режим: раз на 2 тижні, наступна ${day(now + FULL_EVERY)}`);

  const snapshot = Object.fromEntries(models.filter((m) => tierOfId(m.id)).map((m) => [m.id, { name: m.name, created: m.created, context: m.context, maxTokens: m.maxTokens, effort: m.effort, adaptive: m.adaptive }]));
  // the live price index (paid-features.js LIVE PRICES): every ≈ price on the pages and every reserve follows it
  const priceIndex = Object.fromEntries(['haiku', 'sonnet', 'opus'].map((t) => [t, priceIndexFor(t, known(active[t]))]));
  const oldIdx = state.priceIndex || {};
  const moved = Object.keys(priceIndex).filter((t) => Math.abs((oldIdx[t] || 1) - priceIndex[t]) >= 0.001);
  if (moved.length) report.push('індекс цін: ' + moved.map((t) => `${t} ${oldIdx[t] || 1} → ${priceIndex[t]}`).join(', ') + ' — ціни на кнопках, у тарифах і базі знань змінено');
  // the whole doc is written (no merge) so settled keys of held/upcoming/deprecated/broken really disappear
  await ref.set(Object.assign({}, state, { active, pricing: livePricing, priceIndex, snapshot, held, upcoming, deprecated, broken, mode, fullAt: now,
    checkedAt: admin.firestore.FieldValue.serverTimestamp(), report }, changed ? { lastChange: admin.firestore.FieldValue.serverTimestamp() } : {}));
  console.log('[modelWatch]', report.join(' · '));
  return report;
}

// Runs every morning but does the full check only in 'daily' mode or once 14 days have passed (see runWatch)
exports.modelWatch = onSchedule({ schedule: 'every day 06:00', timeZone: 'Europe/Kyiv', secrets: [claudeApiKey], timeoutSeconds: 300 }, async () => { await runWatch(); });

// Admin: run the watch now (same checks)
exports.modelWatchRun = onRequest({ secrets: [claudeApiKey], timeoutSeconds: 300 }, async (req, res) => {
  return cors(req, res, async () => {
    if (!(await requireAdmin(req, res))) return;
    try { res.json({ report: await runWatch({ force: true }) }); } catch (e) { console.error('[modelWatchRun]', e); res.status(500).json({ error: e.message }); }
  });
});

exports._modelWatch = { parsePricing, parseDeprecations, tierOfId, verOfId, verOfName, runWatch };
