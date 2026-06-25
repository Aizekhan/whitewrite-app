// ============================================================================
// Token Service — Universal AI Operation Billing & Tracking with Margin
// ============================================================================
// Phase 5.1: Single entry point for ALL AI operations
// Phase 6: Margin architecture (baseTokens × marginMultiplier × globalMarginMultiplier)
// - Reads prices from economy_operations (data-driven, NOT hardcoded)
// - Applies margin multipliers (operation-level + global)
// - Deducts user tokens
// - Logs usage_logs with margin tracking
//
// Usage:
//   const { charge } = require('./token-service.js');
//   await charge(db, uid, operation, model, usage, projectId);

const admin = require('firebase-admin');
const { MODEL_PRICING } = require('./ai-models.js');

// ============================================================================
// GLOBAL MARGIN CACHE (TTL 60s)
// ============================================================================
// Avoid Firestore read on every operation — cache globalMarginMultiplier in memory
let globalMarginCache = {
  value: 1.0,
  lastFetch: 0,
  TTL_MS: 60000  // 60 seconds
};

async function getGlobalMarginMultiplier(db) {
  const now = Date.now();

  // Cache hit (within TTL)
  if (now - globalMarginCache.lastFetch < globalMarginCache.TTL_MS) {
    return globalMarginCache.value;
  }

  // Cache miss — fetch from Firestore
  try {
    const globalDoc = await db.collection('economy_config').doc('global').get();

    if (globalDoc.exists) {
      const data = globalDoc.data();
      const multiplier = data.globalMarginMultiplier;

      // Validate: must be a positive number, fallback to 1.0
      if (typeof multiplier === 'number' && multiplier > 0 && !isNaN(multiplier)) {
        globalMarginCache.value = multiplier;
        globalMarginCache.lastFetch = now;
        console.log(`[TokenService] Global margin multiplier loaded: ${multiplier}`);
        return multiplier;
      } else {
        console.warn(`[TokenService] Invalid globalMarginMultiplier: ${multiplier}, using fallback 1.0`);
      }
    } else {
      console.warn('[TokenService] economy_config/global not found, using fallback 1.0');
    }
  } catch (error) {
    console.error('[TokenService] Failed to fetch globalMarginMultiplier:', error);
  }

  // Fallback: 1.0 (no markup)
  globalMarginCache.value = 1.0;
  globalMarginCache.lastFetch = now;
  return 1.0;
}

/**
 * Calculate user token cost with margin
 * @param {number} baseTokens - Base cost before margin
 * @param {number} marginMultiplier - Operation-specific margin (from economy_operations)
 * @param {number} globalMarginMultiplier - Global margin lever (from economy_config/global)
 * @returns {number} Final user token cost (rounded UP)
 */
function calculateUserTokens(baseTokens, marginMultiplier, globalMarginMultiplier) {
  // Validate inputs (fallback to 1.0 if invalid, except baseTokens which defaults to 0)
  const validBase = (typeof baseTokens === 'number' && baseTokens > 0 && !isNaN(baseTokens))
    ? baseTokens
    : 0;

  const validMargin = (typeof marginMultiplier === 'number' && marginMultiplier > 0 && !isNaN(marginMultiplier))
    ? marginMultiplier
    : 1.0;

  const validGlobal = (typeof globalMarginMultiplier === 'number' && globalMarginMultiplier > 0 && !isNaN(globalMarginMultiplier))
    ? globalMarginMultiplier
    : 1.0;

  // Formula: userTokens = ceil(base × margin × globalMargin)
  // Use Math.ceil to round UP (never undercharge)
  const userTokens = Math.ceil(validBase * validMargin * validGlobal);

  return userTokens;
}

// ============================================================================
// TOKEN CHARGING
// ============================================================================

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

  // 1. Read pricing from economy_operations
  const economyDoc = await db.collection('economy_operations').doc(operation).get();
  if (!economyDoc.exists) {
    throw new Error(`economy_operations/${operation} not found — cannot charge`);
  }

  const economyData = economyDoc.data();
  const provider = options.provider || 'claude'; // Default to Claude (can be 'gemini')

  if (!economyData.providers || !economyData.providers[provider]) {
    throw new Error(`economy_operations/${operation} missing provider: ${provider}`);
  }

  const providerData = economyData.providers[provider];
  const baseTokens = providerData.baseTokens || providerData.cost || 0; // Fallback to 'cost' for backwards compat
  const marginMultiplier = providerData.marginMultiplier || 1.0;

  console.log(`[TokenService] Base tokens: ${baseTokens} (from economy_operations/${operation}/${provider})`);
  console.log(`[TokenService] Margin multiplier: ${marginMultiplier}`);

  // 2. Get global margin multiplier (cached)
  const globalMarginMultiplier = await getGlobalMarginMultiplier(db);
  console.log(`[TokenService] Global margin multiplier: ${globalMarginMultiplier}`);

  // 3. Calculate final user cost with margin
  const userCost = calculateUserTokens(baseTokens, marginMultiplier, globalMarginMultiplier);

  console.log(`[TokenService] User cost (final): ${userCost} tokens = ceil(${baseTokens} × ${marginMultiplier} × ${globalMarginMultiplier})`);

  // 4. Calculate real API cost from usage
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

  // 5. Deduct user tokens
  await db.collection('users').doc(uid).update({
    tokensUsed: admin.firestore.FieldValue.increment(userCost)
  });

  console.log(`[TokenService] ✅ Deducted ${userCost} tokens from user ${uid}`);

  // 6. Log to usage_logs with margin tracking
  const logEntry = {
    uid,
    operation,
    model,
    projectId,
    sceneId: options.sceneId || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),

    // Margin architecture (Phase 6)
    baseTokens,                    // Base cost before margin
    marginMultiplier,              // Operation-specific margin
    globalMarginMultiplier,        // Global margin at time of use
    userTokensCharged: userCost,   // Final charged amount = ceil(base × margin × global)

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

  console.log(`[TokenService] ✅ Logged usage_logs entry (apiCostUSD: $${apiCostUSD.toFixed(4)}, margin tracked)`);

  return { userCost, apiCostUSD, marginMultiplier, globalMarginMultiplier };
}

module.exports = { charge };
