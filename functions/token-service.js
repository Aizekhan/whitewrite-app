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
// GLOBAL CONFIG CACHE (TTL 60s)
// ============================================================================
// Cache economy_config/global to avoid Firestore reads on every operation
let globalConfigCache = {
  globalMarginMultiplier: 1.0,
  tokenToUSD: 0.01,  // Default: 1 token = 1 cent
  lastFetch: 0,
  TTL_MS: 60000  // 60 seconds
};

async function getGlobalConfig(db) {
  const now = Date.now();

  // Cache hit (within TTL)
  if (now - globalConfigCache.lastFetch < globalConfigCache.TTL_MS) {
    return {
      globalMarginMultiplier: globalConfigCache.globalMarginMultiplier,
      tokenToUSD: globalConfigCache.tokenToUSD
    };
  }

  // Cache miss — fetch from Firestore
  try {
    const globalDoc = await db.collection('economy_config').doc('global').get();

    if (globalDoc.exists) {
      const data = globalDoc.data();

      // Validate globalMarginMultiplier
      if (typeof data.globalMarginMultiplier === 'number' && data.globalMarginMultiplier > 0 && !isNaN(data.globalMarginMultiplier)) {
        globalConfigCache.globalMarginMultiplier = data.globalMarginMultiplier;
      } else {
        console.warn(`[TokenService] Invalid globalMarginMultiplier: ${data.globalMarginMultiplier}, using fallback 1.0`);
        globalConfigCache.globalMarginMultiplier = 1.0;
      }

      // Validate tokenToUSD
      if (typeof data.tokenToUSD === 'number' && data.tokenToUSD > 0 && !isNaN(data.tokenToUSD)) {
        globalConfigCache.tokenToUSD = data.tokenToUSD;
      } else {
        console.warn(`[TokenService] Invalid tokenToUSD: ${data.tokenToUSD}, using fallback 0.01`);
        globalConfigCache.tokenToUSD = 0.01;
      }

      globalConfigCache.lastFetch = now;
      console.log(`[TokenService] Global config loaded: margin=${globalConfigCache.globalMarginMultiplier}, tokenToUSD=${globalConfigCache.tokenToUSD}`);

      return {
        globalMarginMultiplier: globalConfigCache.globalMarginMultiplier,
        tokenToUSD: globalConfigCache.tokenToUSD
      };
    } else {
      console.warn('[TokenService] economy_config/global not found, using fallback values');
    }
  } catch (error) {
    console.error('[TokenService] Failed to fetch global config:', error);
  }

  // Fallback: defaults
  globalConfigCache.globalMarginMultiplier = 1.0;
  globalConfigCache.tokenToUSD = 0.01;
  globalConfigCache.lastFetch = now;
  return {
    globalMarginMultiplier: 1.0,
    tokenToUSD: 0.01
  };
}

// Backwards compat wrapper
async function getGlobalMarginMultiplier(db) {
  const config = await getGlobalConfig(db);
  return config.globalMarginMultiplier;
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
  const marginMultiplier = providerData.marginMultiplier || 1.0;

  // 2. Get global config (cached): tokenToUSD + globalMarginMultiplier
  const globalConfig = await getGlobalConfig(db);
  const tokenToUSD = globalConfig.tokenToUSD;
  const globalMarginMultiplier = globalConfig.globalMarginMultiplier;

  console.log(`[TokenService] Global config: tokenToUSD=${tokenToUSD}, globalMargin=${globalMarginMultiplier}`);

  // 3. Calculate estimated API cost (cost-based pricing, Phase 6.1)
  const targetWords = options.targetWords || 700;
  const estimatedCostPer700Words = providerData.estimatedCostPer700Words;

  let estApiCostUSD;
  if (estimatedCostPer700Words != null && estimatedCostPer700Words > 0) {
    // Cost-based pricing: estApiCostUSD = (targetWords / 700) × estimatedCostPer700Words
    estApiCostUSD = (targetWords / 700) * estimatedCostPer700Words;
    console.log(`[TokenService] Cost-based pricing: ${targetWords} words × $${estimatedCostPer700Words}/700 = $${estApiCostUSD.toFixed(4)}`);
  } else {
    // Fallback: word-based or fixed pricing (backwards compat)
    const tokensPer100Words = providerData.tokensPer100Words;
    if (tokensPer100Words > 0) {
      const baseTokens = Math.ceil((targetWords / 100) * tokensPer100Words);
      estApiCostUSD = baseTokens * tokenToUSD;
      console.log(`[TokenService] Word-based fallback: ${baseTokens} tokens × $${tokenToUSD} = $${estApiCostUSD.toFixed(4)}`);
    } else {
      const baseTokens = providerData.baseTokens || providerData.cost || 0;
      estApiCostUSD = baseTokens * tokenToUSD;
      console.log(`[TokenService] Fixed pricing fallback: ${baseTokens} tokens × $${tokenToUSD} = $${estApiCostUSD.toFixed(4)}`);
    }
  }

  console.log(`[TokenService] Margin multiplier: ${marginMultiplier}`);

  // 4. Calculate final user cost with margin (NEW FORMULA: ceil at end only!)
  // userTokens = ceil( (estApiCostUSD / tokenToUSD) × marginMultiplier × globalMargin )
  const userCost = Math.ceil(
    (estApiCostUSD / tokenToUSD) * marginMultiplier * globalMarginMultiplier
  );

  console.log(`[TokenService] User cost (final): ${userCost} tokens = ceil(($${estApiCostUSD.toFixed(4)} / $${tokenToUSD}) × ${marginMultiplier} × ${globalMarginMultiplier})`);

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

  // 6. Log to usage_logs with cost-based pricing + real margin tracking
  const realMarginRatio = apiCostUSD > 0 ? (userCost * tokenToUSD) / apiCostUSD : 0;
  const profitUSD = (userCost * tokenToUSD) - apiCostUSD;
  const cacheSavingsUSD = estApiCostUSD - apiCostUSD; // If positive, cache saved money

  const logEntry = {
    uid,
    operation,
    model,
    projectId,
    sceneId: options.sceneId || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),

    // Cost-based pricing (Phase 6.1 - Final)
    targetWords,                          // Target word count
    estimatedApiCostUSD: parseFloat(estApiCostUSD.toFixed(4)),  // Estimated cost (shown to user)
    tokenToUSD,                           // Conversion rate at time of use
    marginMultiplier,                     // Operation-specific margin
    globalMarginMultiplier,               // Global margin at time of use
    userTokensCharged: userCost,          // Final: ceil((est/tokenToUSD) × margin × global)
    userPaidUSD: parseFloat((userCost * tokenToUSD).toFixed(4)),  // What user paid in $

    // Real API usage
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens: inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens,
    realApiCostUSD: parseFloat(apiCostUSD.toFixed(4)),  // Actual cost paid to API

    // Analytics (for margin tracking)
    realMarginRatio: parseFloat(realMarginRatio.toFixed(2)),  // userPaid / realCost
    profitUSD: parseFloat(profitUSD.toFixed(4)),              // userPaid - realCost
    cacheSavingsUSD: parseFloat(cacheSavingsUSD.toFixed(4)),  // est - real (if cache hit)

    // Full usage object for debugging
    rawUsage: usage
  };

  await db.collection('usage_logs').add(logEntry);

  console.log(`[TokenService] ✅ Logged usage_logs entry (apiCostUSD: $${apiCostUSD.toFixed(4)}, margin tracked)`);

  return { userCost, apiCostUSD, marginMultiplier, globalMarginMultiplier };
}

module.exports = { charge };
