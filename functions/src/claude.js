// The one door to Claude for every Cloud Function: which model (the author's choice, gated by plan; the active
// ids can be switched by modelWatch in config/ai_models without a deploy) and the request shape the
// current models accept (no temperature, effort instead of thinking budgets, text read by block type).
const Anthropic = require('@anthropic-ai/sdk');
const { AI_MODELS } = require('../ai-models.js');
const { modelTier } = require('../paid-features.js');

let active = null, activeAt = 0;
// tier → model id: ai-models.js, overridden by config/ai_models.active (written by modelWatch), cached 5 min
async function activeModels(db) {
  if (active && Date.now() - activeAt < 5 * 60 * 1000) return active;
  let doc = {};
  try { doc = (await db.collection('config').doc('ai_models').get()).data() || {}; } catch (e) { console.warn('[claude] config/ai_models:', e.message); }
  active = Object.assign({}, AI_MODELS.claude, doc.active || {});
  activeAt = Date.now();
  return active;
}

// The model for this user: users.settings.aiModel if the plan allows it, else the plan default
async function modelFor(db, user, plan) {
  const tier = modelTier(plan, user && user.settings && user.settings.aiModel);
  return { tier, model: (await activeModels(db))[tier] };
}

// One message → text. effort: 'low' for prose (little thinking), 'medium' for analysis. Thinking counts toward
// max_tokens and is billed as output, so callers leave headroom. A refusal is an error, never an empty scene.
async function claudeText(apiKey, { model, prompt, system, maxTokens, effort = 'medium', stream = false }) {
  const anthropic = new Anthropic({ apiKey });
  const body = { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }], output_config: { effort } };
  if (system) body.system = system;
  const msg = stream ? await anthropic.messages.stream(body).finalMessage() : await anthropic.messages.create(body);
  if (msg.stop_reason === 'refusal') throw new Error('Claude відмовився виконати запит');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { text, usage: msg.usage, model: msg.model || model, stopReason: msg.stop_reason };
}

module.exports = { activeModels, modelFor, claudeText };
