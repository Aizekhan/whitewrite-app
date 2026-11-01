// Shared setup for all Cloud Functions modules: admin SDK, CORS, secrets, auth guards.
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const cors = require('cors')({
  origin: [
    'https://whitewrite.com',
    'https://www.whitewrite.com',
    'https://whitewrite-app.web.app',
    'https://whitewrite-app.firebaseapp.com',
    /^http:\/\/localhost:\d+$/ // Allow localhost with any port for development
  ],
  credentials: true
});
const Anthropic = require('@anthropic-ai/sdk');
const { AI_MODELS, MODEL_PRICING } = require('../ai-models.js');
const { charge, getBalance, reserve, refund } = require('../token-service.js');
const { getPlanBudget } = require('../plans.js');
const { loadCanon, mergeSuggestions } = require('../canon-store.js');
// Legacy plan migration completed on 2026-06-26, no longer needed

admin.initializeApp();
const db = admin.firestore();

// Define secrets
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const claudeApiKey = defineSecret('CLAUDE_API_KEY');
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const lemonSqueezyApiKey = defineSecret('LEMON_SQUEEZY_API_KEY');
const lemonSqueezyWebhookSecret = defineSecret('LEMON_SQUEEZY_WEBHOOK_SECRET');

// Phase 1.1 + 3.0: Token Budget System — plans live in plans.js (single source of truth)

// Helper: Verify Firebase ID token
async function verifyAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
}

// Helper: Admin-only guard (custom claim `admin: true`, set via functions/set-admin.js)
// Returns true if allowed; otherwise sends 401/403 and returns false.
async function requireAdmin(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    if (decoded.admin === true) return true;
  } catch (error) {
    res.status(401).json({ error: 'Invalid auth token' });
    return false;
  }
  res.status(403).json({ error: 'Admin only' });
  return false;
}

// Canon → prompt text (world, facts, laws, entities with their current state); shared by generation and analysis
function buildCanonContext(canon) {
  const sections = [];
  const world = canon.world || {};
  // Entities come from two writers: AI extraction (name/description/trait…) and
  // the WorldTree editor (title/desc/motivation…) — read both.
  const nameOf = (x) => x.name || x.title || 'без назви';
  const descOf = (x) => x.description || x.desc || x.motivation ||
    [x.role, x.trait, x.goal].filter(Boolean).join('; ') || 'немає опису';
  // Current state = state at the end of the latest scene (continuity)
  const stateOf = (x) => {
    const parts = [x.status && `статус: ${x.status}`, x.location && `де: ${x.location}`].filter(Boolean);
    return parts.length ? ` [зараз — ${parts.join('; ')}]` : '';
  };

  // World — summary, facts, and laws first: they frame everything below
  const worldText = world.summary || world.description;
  if (worldText) {
    sections.push('**Всесвіт:**\n' + worldText);
  }
  const facts = (world.facts || []).filter(f => f && f.k && f.v);
  if (facts.length > 0) {
    sections.push('**Факти світу:**\n' + facts.map(f => `- ${f.k}: ${f.v}`).join('\n'));
  }
  const rules = (world.rules || []).map(r => String(r).trim()).filter(Boolean);
  if (rules.length > 0) {
    sections.push('**ЗАКОНИ СВІТУ (непорушні — фізика цього всесвіту):**\n' + rules.map((r, i) => `${i + 1}. ${r}`).join('\n'));
  }

  // Characters
  const chars = Object.values(canon.characters || {});
  if (chars.length > 0) {
    sections.push('**Персонажі:**\n' + chars.map(c =>
      `- ${nameOf(c)}: ${descOf(c)}${stateOf(c)}`
    ).join('\n'));
  }

  // Locations
  const locs = Object.values(canon.locations || {});
  if (locs.length > 0) {
    sections.push('**Локації:**\n' + locs.map(l =>
      `- ${nameOf(l)}: ${descOf(l)}`
    ).join('\n'));
  }

  // Events
  const events = Object.values(canon.events || {});
  if (events.length > 0) {
    sections.push('**Події:**\n' + events.map(e =>
      `- ${nameOf(e)}: ${descOf(e)}`
    ).join('\n'));
  }

  // Factions
  const factions = Object.values(canon.factions || {});
  if (factions.length > 0) {
    sections.push('**Фракції:**\n' + factions.map(f =>
      `- ${nameOf(f)}: ${descOf(f)}`
    ).join('\n'));
  }

  // Artifacts
  const artifacts = Object.values(canon.artifacts || {});
  if (artifacts.length > 0) {
    sections.push('**Артефакти:**\n' + artifacts.map(a =>
      `- ${nameOf(a)}: ${descOf(a)}${a.owner ? ` [власник: ${a.owner}]` : ''}`
    ).join('\n'));
  }

  return sections.length > 0 ? sections.join('\n\n') : 'Канон порожній — ти створюєш світ з нуля.';
}

module.exports = {
  buildCanonContext,
  onRequest,
  admin,
  db,
  cors,
  Anthropic,
  AI_MODELS,
  MODEL_PRICING,
  charge,
  getBalance,
  reserve,
  refund,
  getPlanBudget,
  loadCanon,
  mergeSuggestions,
  geminiApiKey,
  claudeApiKey,
  stripeSecretKey,
  stripeWebhookSecret,
  lemonSqueezyApiKey,
  lemonSqueezyWebhookSecret,
  verifyAuth,
  requireAdmin,
};
