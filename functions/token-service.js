// ============================================================================
// Token Service — Universal AI Operation Billing & Tracking
// ============================================================================
// Phase 5.1: Single entry point for ALL AI operations
// - Reads prices from economy_operations (data-driven, NOT hardcoded)
// - Deducts user tokens
// - Logs usage_logs with real API cost (apiCostUSD, tokens breakdown)
//
// Usage:
//   const { charge } = require('./token-service.js');
//   await charge(db, uid, operation, model, usage, projectId);

const admin = require('firebase-admin');
const { MODEL_PRICING } = require('./ai-models.js');

/**
 * Charge user for AI operation + log usage
 *
 * @param {FirebaseFirestore.Firestore} db - Firestore instance
 * @param {string} uid - User ID
 * @param {string} operation - Operation name ('generateScene', 'extractCanon', 'analyzeScene')
 * @param {string} model - Actual model used (from API response, e.g. 'claude-opus-4-20250514')
 * @param {object} usage - API usage object { input_tokens, output_tokens, cache_creation_input_tokens?, cache_read_input_tokens? }
 * @param {string} projectId - Project ID (for logging)
 * @param {object} options - Optional params { sceneId?, provider? }
 * @returns {Promise<{ userCost: number, apiCostUSD: number }>}
 */
async function charge(db, uid, operation, model, usage, projectId, options = {}) {
  console.log(`[TokenService] Charging ${uid} for ${operation} (model: ${model})`);

  // 1. Read user-facing cost from economy_operations
  const economyDoc = await db.collection('economy_operations').doc(operation).get();
  if (!economyDoc.exists) {
    throw new Error(`economy_operations/${operation} not found — cannot charge`);
  }

  const economyData = economyDoc.data();
  const provider = options.provider || 'claude'; // Default to Claude (can be 'gemini')

  if (!economyData.providers || !economyData.providers[provider]) {
    throw new Error(`economy_operations/${operation} missing provider: ${provider}`);
  }

  const userCost = economyData.providers[provider].cost; // Fixed cost user pays (e.g. 300, 15, 50)

  console.log(`[TokenService] User cost: ${userCost} tokens (from economy_operations/${operation}/${provider})`);

  // 2. Calculate real API cost from usage
  let apiCostUSD = 0;
  let inputTokens = usage.input_tokens || 0;
  let outputTokens = usage.output_tokens || 0;
  let cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  let cacheReadTokens = usage.cache_read_input_tokens || 0;

  const pricing = MODEL_PRICING[model];
  if (pricing) {
    const inputCost = inputTokens * pricing.input / 1000000;
    const outputCost = outputTokens * pricing.output / 1000000;
    const cacheWriteCost = cacheCreationTokens * (pricing.cacheWrite || pricing.input) / 1000000;
    const cacheReadCost = cacheReadTokens * (pricing.cacheRead || pricing.input) / 1000000;

    apiCostUSD = inputCost + outputCost + cacheWriteCost + cacheReadCost;

    console.log(`[TokenService] API cost breakdown:
      - Input: ${inputTokens} tokens × $${pricing.input}/M = $${inputCost.toFixed(4)}
      - Output: ${outputTokens} tokens × $${pricing.output}/M = $${outputCost.toFixed(4)}
      - Cache write: ${cacheCreationTokens} tokens × $${pricing.cacheWrite || pricing.input}/M = $${cacheWriteCost.toFixed(4)}
      - Cache read: ${cacheReadTokens} tokens × $${pricing.cacheRead || pricing.input}/M = $${cacheReadCost.toFixed(4)}
      - TOTAL: $${apiCostUSD.toFixed(4)}`);
  } else {
    console.warn(`[TokenService] ⚠️ Unknown model pricing: ${model} — apiCostUSD will be $0.0000`);
  }

  // 3. Deduct user tokens
  await db.collection('users').doc(uid).update({
    tokensUsed: admin.firestore.FieldValue.increment(userCost)
  });

  console.log(`[TokenService] ✅ Deducted ${userCost} tokens from user ${uid}`);

  // 4. Log to usage_logs
  const logEntry = {
    uid,
    operation,
    model,
    projectId,
    sceneId: options.sceneId || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),

    // User charge (fixed)
    userTokensCharged: userCost,

    // Real API usage
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
    apiCostUSD: parseFloat(apiCostUSD.toFixed(4)),

    // Full usage object for debugging
    rawUsage: usage
  };

  await db.collection('usage_logs').add(logEntry);

  console.log(`[TokenService] ✅ Logged usage_logs entry (apiCostUSD: $${apiCostUSD.toFixed(4)})`);

  return { userCost, apiCostUSD };
}

module.exports = { charge };
