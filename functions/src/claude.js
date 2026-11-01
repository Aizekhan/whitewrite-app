// The one door to Claude for every Cloud Function: which model (the author's choice, gated by plan; the active
// ids can be switched by modelWatch in config/ai_models without a deploy) and the request shape the
// current models accept (no temperature, effort instead of thinking budgets, text read by block type).
const Anthropic = require('@anthropic-ai/sdk');
const { AI_MODELS } = require('../ai-models.js');
const { modelTier } = require('../paid-features.js');

const TIER_ORDER = ['haiku', 'sonnet', 'opus'];
const tierOf = (id) => (String(id).match(/^claude-(haiku|sonnet|opus)-\d/) || [])[1] || null;

let active = null, conf = {}, activeAt = 0;
// tier → model id: ai-models.js, overridden by config/ai_models.active (written by modelWatch), cached 5 min.
// A model that vanished mid-flight (config/ai_models.broken[id].to, written by withFallback) is replaced at once.
async function activeModels(db) {
  if (active && Date.now() - activeAt < 5 * 60 * 1000) return active;
  conf = {};
  try { conf = (await db.collection('config').doc('ai_models').get()).data() || {}; } catch (e) { console.warn('[claude] config/ai_models:', e.message); }
  active = Object.assign({}, AI_MODELS.claude, conf.active || {});
  const broken = conf.broken || {};
  for (const t of TIER_ORDER) if (broken[active[t]] && broken[active[t]].to) active[t] = broken[active[t]].to;
  activeAt = Date.now();
  return active;
}

// The model is gone (404 / not_found_error) — not a bad request, not an overload
const isGone = (e) => !!e && (e.status === 404 || /not_found_error/.test(String(e.message)));

// Where to go when a model disappears: another version of the same tier (the ai-models.js default, then the
// newest the watch last saw), else the next tier DOWN (Opus → Sonnet → Haiku) — never up, the reserve would not cover it
async function fallbacksFor(db, dead) {
  await activeModels(db);
  const tier = tierOf(dead), snap = conf.snapshot || {}, broken = conf.broken || {};
  const same = tier ? [AI_MODELS.claude[tier]].concat(Object.keys(snap).filter((id) => tierOf(id) === tier)
    .sort((a, b) => (snap[b].created || 0) - (snap[a].created || 0))) : [];
  const lower = TIER_ORDER.slice(0, Math.max(0, TIER_ORDER.indexOf(tier))).reverse().map((t) => active[t]);
  return [...new Set(same.concat(lower))].filter((id) => id && id !== dead && !broken[id]);
}

// Run fn(model); if the model is gone, retry at once on a working one, remember the swap (every later call goes
// straight there), switch the watch to daily mode and tell the admins. The charge follows the model that answered.
async function withFallback(model, fn) {
  try { return await fn(model); } catch (e) {
    if (!isGone(e)) throw e;
    const { db } = require('./common');
    for (const alt of await fallbacksFor(db, model)) {
      let out;
      try { out = await fn(alt); } catch (e2) { if (isGone(e2)) continue; throw e2; }
      await markBroken(db, model, alt).catch((er) => console.warn('[claude] markBroken:', er.message));
      return out;
    }
    throw e;
  }
}

async function markBroken(db, dead, alt) {
  const ref = db.collection('config').doc('ai_models');
  const seen = ((await ref.get()).data() || {}).broken || {};
  active = null; // re-read on the next call
  if (seen[dead] && seen[dead].to === alt) return;
  await ref.set({ broken: { [dead]: { to: alt, at: Date.now() } }, mode: 'daily' }, { merge: true });
  const down = tierOf(alt) !== tierOf(dead);
  await require('./admin-notice').notify({ severity: 'critical', tier: tierOf(dead), from: dead, to: alt,
    title: `Модель ${dead} раптово недоступна — запити йдуть на ${alt}`,
    body: `API відповів «модель не знайдено» на \`${dead}\`. Запит повторено на \`${alt}\`${down ? ' (нижчий рівень — дешевше, слабше)' : ' (той самий рівень)'}, далі всі виклики йдуть туди одразу; списання — за моделлю, що відповіла.

Сторож перейшов на щоденну перевірку й підбере постійну заміну в цьому рівні. Вручну: \`config/ai_models.active.${tierOf(dead) || '<tier>'}\`, після чого прибрати \`config/ai_models.broken\`.` });
}

// The model for this user: users.settings.aiModel if the plan allows it, else the plan default
async function modelFor(db, user, plan) {
  const tier = modelTier(plan, user && user.settings && user.settings.aiModel);
  return { tier, model: (await activeModels(db))[tier] };
}

// One message → text. effort: 'low' for prose (little thinking), 'medium' for analysis. Thinking counts toward
// max_tokens and is billed as output, so callers leave headroom. A refusal is an error, never an empty scene.
// noFallback: the watch's own test call must see the real error, not a substitute.
async function claudeText(apiKey, { model, prompt, system, maxTokens, effort = 'medium', stream = false, noFallback = false }) {
  const anthropic = new Anthropic({ apiKey });
  const call = async (m) => {
    const body = { model: m, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }], output_config: { effort } };
    if (system) body.system = system;
    return stream ? anthropic.messages.stream(body).finalMessage() : anthropic.messages.create(body);
  };
  const msg = noFallback ? await call(model) : await withFallback(model, call);
  if (msg.stop_reason === 'refusal') throw new Error('Claude відмовився виконати запит');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, usage: msg.usage, model: msg.model || model, stopReason: msg.stop_reason };
}

module.exports = { activeModels, modelFor, claudeText, withFallback, fallbacksFor, isGone, tierOf };
