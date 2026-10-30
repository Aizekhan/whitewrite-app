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

module.exports = {
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
