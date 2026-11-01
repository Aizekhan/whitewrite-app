// Model watch — keeps the Claude models current without a deploy, and without surprises (owner decision 2026-11-02).
// Daily: list the models (Anthropic Models API) + read the official price table, then per tier (haiku/sonnet/opus):
//  · a newer version of the tier is switched in AUTOMATICALLY only when every check passes:
//      its price is known, a typical call costs ≤ MAX_PRICE_RATIO × the current one, it keeps the capabilities we use
//      (context, output, effort, adaptive thinking) and a real smoke call in our request shape returns text;
//  · otherwise nothing switches and a CRITICAL admin notice explains what to decide (e.g. re-price the plans);
//  · a price change of the active model updates the live pricing (the charge is the real API cost, so billing follows)
//    and a rise above PRICE_ALERT also raises a critical notice (plan budgets / typical prices need a look);
//  · the active model disappearing from the API (retired) forces the switch to the newest priced one + a notice.
// State: config/ai_models { active: {tier: id}, pricing: {id: {...}}, snapshot: {id: {...}}, checkedAt, lastChange }.
// Notices: admin_notices/{id} (admins see a banner in the Account) + a Markdown file admin/notices/… in Storage.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, admin, db, cors, claudeApiKey, requireAdmin } = require('./common');
const { AI_MODELS, MODEL_PRICING } = require('../ai-models.js');
const { activeModels, claudeText } = require('./claude');

const TIERS = ['haiku', 'sonnet', 'opus'];
const PRICING_URL = 'https://platform.claude.com/docs/en/about-claude/pricing.md';
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

async function notify(n) {
  const at = new Date();
  const doc = Object.assign({ kind: 'ai-model', resolved: false, createdAt: admin.firestore.FieldValue.serverTimestamp() }, n);
  const ref = await db.collection('admin_notices').add(doc);
  const md = `# ${n.severity === 'critical' ? '⚠ КРИТИЧНО: ' : ''}${n.title}\n\n${at.toISOString()} · tier: ${n.tier || '—'}\n\n${n.body}\n`;
  try {
    await admin.storage().bucket().file(`admin/notices/${at.toISOString().slice(0, 10)}-${n.tier || 'models'}-${ref.id}.md`)
      .save(md, { contentType: 'text/markdown; charset=utf-8' });
  } catch (e) { console.warn('[modelWatch] notice file:', e.message); }
  console.log(`[modelWatch] notice (${n.severity}): ${n.title}`);
}

async function runWatch() {
  const apiKey = claudeApiKey.value();
  const ref = db.collection('config').doc('ai_models');
  const state = (await ref.get()).data() || {};
  const active = Object.assign({}, await activeModels(db));
  const livePricing = Object.assign({}, state.pricing || {});
  const known = (id) => livePricing[id] || MODEL_PRICING[id] || null;

  const models = await listModels(apiKey);
  let table = {};
  try { table = parsePricing(await (await fetch(PRICING_URL)).text()); } catch (e) { console.warn('[modelWatch] pricing page:', e.message); }
  const priceOf = (m) => (m && table[m.name]) || null; // the official table first, it is the current truth
  const byId = Object.fromEntries(models.map((m) => [m.id, m]));
  const report = [];
  let changed = false;

  for (const tier of TIERS) {
    const curId = active[tier] || AI_MODELS.claude[tier];
    const cur = byId[curId];
    const curPrice = priceOf(cur) || known(curId);

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
    if (!next || (cur && (next.id === cur.id || next.created <= cur.created || next.name === cur.name))) { report.push(`${tier}: ${curId} — актуальна`); continue; }

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
        const t = await claudeText(apiKey, { model: next.id, prompt: 'Одним реченням українською: туман над лісом на світанку.', maxTokens: 2000, effort: 'low' });
        if (!t.text || t.text.trim().length < 10) problems.push('пробний виклик повернув порожній текст');
      } catch (e) { problems.push('пробний виклик нашим форматом запиту впав: ' + String(e.message).slice(0, 300)); }
    }

    const facts = `Поточна: ${cur ? cur.name + ' (`' + curId + '`)' : '`' + curId + '` — більше немає в API'}${curPrice ? `, $${curPrice.input}/$${curPrice.output} за MTok` : ''}.\nНова: ${next.name} (\`${next.id}\`)${nextPrice ? `, $${nextPrice.input}/$${nextPrice.output} за MTok` : ', ціна невідома'}${ratio != null ? `, типовий виклик ${pct(ratio)}` : ''}; контекст ${next.context}, output ${next.maxTokens}.`;
    if (!problems.length || (retired && nextPrice)) {
      active[tier] = next.id;
      if (nextPrice) livePricing[next.id] = nextPrice;
      changed = true;
      report.push(`${tier}: ${curId} → ${next.id}`);
      const big = ratio != null && ratio > PRICE_ALERT;
      await notify({ severity: retired || big || problems.length ? 'critical' : 'info', tier, from: curId, to: next.id,
        title: `${tier}: ${retired ? 'стара модель зникла — примусово' : 'автоматично'} ${cur ? cur.name : curId} → ${next.name}`,
        body: facts + (problems.length ? `\n\nПеремкнуто попри зауваження (стару вже не обслуговують):\n- ${problems.join('\n- ')}` : '\n\nУсі перевірки пройдено: ціна, можливості, пробний виклик.') +
          (big ? `\n\n**Ціна виросла ${pct(ratio)} — переглянь \`MODEL_TIERS.typical/scale\` і бюджети тарифів у \`functions/paid-features.js\`.**` : '') +
          `\n\nВідкат: Firestore \`config/ai_models.active.${tier}\` = \`${curId}\`.` });
    } else {
      report.push(`${tier}: ${next.id} НЕ перемкнуто (${problems.length} зауваж.)`);
      const seen = (state.held || {})[tier];
      if (seen !== next.id) await notify({ severity: 'critical', tier, from: curId, to: next.id, title: `${tier}: нова ${next.name} — потрібне рішення адміна`,
        body: facts + `\n\nАвтоперемикання зупинено:\n- ${problems.join('\n- ')}\n\n**Що зробити:** якщо ціна зросла — перерахувати \`MODEL_TIERS.typical/scale\`, бюджети тарифів і \`USD_PER_TOKEN\` (\`functions/paid-features.js\`), внести ціну в \`MODEL_PRICING\`; тоді перемкнути вручну: \`config/ai_models.active.${tier}\` = \`${next.id}\`.` });
      state.held = Object.assign({}, state.held, { [tier]: next.id }); changed = true;
    }
  }

  const snapshot = Object.fromEntries(models.filter((m) => tierOfId(m.id)).map((m) => [m.id, { name: m.name, created: m.created, context: m.context, maxTokens: m.maxTokens, effort: m.effort, adaptive: m.adaptive }]));
  await ref.set(Object.assign({ active, pricing: livePricing, snapshot, held: state.held || {}, checkedAt: admin.firestore.FieldValue.serverTimestamp(), report },
    changed ? { lastChange: admin.firestore.FieldValue.serverTimestamp() } : {}), { merge: true });
  console.log('[modelWatch]', report.join(' · '));
  return report;
}

exports.modelWatch = onSchedule({ schedule: 'every day 06:00', timeZone: 'Europe/Kyiv', secrets: [claudeApiKey], timeoutSeconds: 300 }, async () => { await runWatch(); });

// Admin: run the watch now (same checks)
exports.modelWatchRun = onRequest({ secrets: [claudeApiKey], timeoutSeconds: 300 }, async (req, res) => {
  return cors(req, res, async () => {
    if (!(await requireAdmin(req, res))) return;
    try { res.json({ report: await runWatch() }); } catch (e) { console.error('[modelWatchRun]', e); res.status(500).json({ error: e.message }); }
  });
});

exports._modelWatch = { parsePricing, tierOfId };
