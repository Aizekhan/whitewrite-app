// Firebase Pricing Module — Cost-based pricing with tokenToUSD
// Phase 6.1: Transition to transparent cost-based model
// Formula: userTokens = ceil( (estApiCostUSD / tokenToUSD) × marginMultiplier × globalMargin )

// ============================================================================
// PRICING CACHE
// ============================================================================
// Cache pricing data to avoid repeated Firestore reads within same session
let pricingCache = {
  loaded: false,
  timestamp: 0,
  data: {
    operations: {}, // economy_operations data
    global: null    // economy_config/global data (tokenToUSD + globalMarginMultiplier)
  }
};

// ============================================================================
// LOAD PRICING FROM FIRESTORE
// ============================================================================

/**
 * Load pricing from Firestore (economy_operations + economy_config/global)
 * Cached for session duration
 * @returns {Promise<boolean>} success
 */
async function loadPricing() {
  if (pricingCache.loaded) {
    console.log('[Pricing] Using cached pricing data');
    return true;
  }

  try {
    const db = window.__firebase.db;

    // Load economy_operations (generateScene, extractCanon, analyzeScene)
    const operations = ['generateScene', 'extractCanon', 'analyzeScene'];
    const operationPromises = operations.map(op =>
      db.collection('economy_operations').doc(op).get()
    );

    // Load economy_config/global (globalMarginMultiplier)
    const globalPromise = db.collection('economy_config').doc('global').get();

    // Fetch all in parallel
    const [opDocs, globalDoc] = await Promise.all([
      Promise.all(operationPromises),
      globalPromise
    ]);

    // Parse operation data
    opDocs.forEach((doc, idx) => {
      if (doc.exists) {
        pricingCache.data.operations[operations[idx]] = doc.data();
      }
    });

    // Parse global margin
    if (globalDoc.exists) {
      pricingCache.data.global = globalDoc.data();
    }

    pricingCache.loaded = true;
    pricingCache.timestamp = Date.now();

    console.log('[Pricing] Loaded from Firestore:', {
      operations: Object.keys(pricingCache.data.operations),
      globalMarginMultiplier: pricingCache.data.global?.globalMarginMultiplier
    });

    return true;
  } catch (error) {
    console.error('[Pricing] Failed to load:', error);
    return false;
  }
}

// ============================================================================
// PRICING CALCULATIONS
// ============================================================================

/**
 * Calculate user token cost with margin (Phase 6.1: cost-based formula)
 * @param {number} estApiCostUSD - Estimated API cost in USD
 * @param {number} tokenToUSD - Token to USD conversion rate (e.g. 0.01 = 1 token = 1 cent)
 * @param {number} marginMultiplier - Operation-specific margin (from economy_operations)
 * @param {number} globalMarginMultiplier - Global margin lever (from economy_config/global)
 * @returns {number} Final user token cost (rounded UP)
 */
function calculateUserTokens(estApiCostUSD, tokenToUSD, marginMultiplier, globalMarginMultiplier) {
  // Validate inputs (fallback to safe defaults, matching backend)
  const validCost = (typeof estApiCostUSD === 'number' && estApiCostUSD >= 0 && !isNaN(estApiCostUSD))
    ? estApiCostUSD
    : 0;

  const validTokenToUSD = (typeof tokenToUSD === 'number' && tokenToUSD > 0 && !isNaN(tokenToUSD))
    ? tokenToUSD
    : 0.01;

  const validMargin = (typeof marginMultiplier === 'number' && marginMultiplier > 0 && !isNaN(marginMultiplier))
    ? marginMultiplier
    : 1.0;

  const validGlobal = (typeof globalMarginMultiplier === 'number' && globalMarginMultiplier > 0 && !isNaN(globalMarginMultiplier))
    ? globalMarginMultiplier
    : 1.0;

  // NEW FORMULA (Phase 6.1): userTokens = ceil( (estCost / tokenToUSD) × margin × global )
  // Ceil ONLY at the end, not intermediate steps (to preserve granularity)
  // MUST match backend functions/token-service.js
  const userTokens = Math.ceil(
    (validCost / validTokenToUSD) * validMargin * validGlobal
  );

  return userTokens;
}

/**
 * Get provider for user plan (matches backend logic)
 * @param {string} plan - User plan (seed, storyteller, worldforge)
 * @returns {string} Provider name ('gemini' or 'claude')
 */
function getProviderForPlan(plan) {
  // worldforge uses Claude, others use Gemini
  return (plan === 'worldforge') ? 'claude' : 'gemini';
}

/**
 * Calculate estimated API cost from word count (cost-based pricing)
 * @param {number} targetWords - Target word count
 * @param {number} estimatedCostPer700Words - Estimated API cost per 700 words (from economy_operations)
 * @returns {number} Estimated API cost in USD
 */
function estimateAPICost(targetWords, estimatedCostPer700Words) {
  return (targetWords / 700) * estimatedCostPer700Words;
}

/**
 * Estimate token cost for Auto Mode generation (Phase 6.1: cost-based)
 * @param {number} episodes - Number of episodes (from slider)
 * @param {string} userPlan - User plan (seed, storyteller, worldforge)
 * @param {number} targetWords - Target words per scene (from length slider)
 * @returns {object} { sceneCost, extractionCost, totalCost, provider, estimated: true }
 */
function estimateAutoModeCost(episodes, userPlan, targetWords = 700) {
  if (!pricingCache.loaded) {
    console.warn('[Pricing] Pricing not loaded, using fallback');
    // Fallback to conservative estimates
    const provider = getProviderForPlan(userPlan);
    const sceneCost = provider === 'claude' ? 300 : 20;
    const extractionCost = 15;
    return {
      sceneCost: sceneCost * episodes,
      extractionCost: extractionCost * episodes,
      totalCost: (sceneCost + extractionCost) * episodes,
      provider,
      estimated: true,
      error: 'Pricing not loaded'
    };
  }

  const provider = getProviderForPlan(userPlan);
  const tokenToUSD = pricingCache.data.global?.tokenToUSD || 0.01;
  const globalMargin = pricingCache.data.global?.globalMarginMultiplier || 1.0;

  // Get generateScene pricing
  const sceneOp = pricingCache.data.operations.generateScene;
  const sceneProvider = sceneOp?.providers?.[provider];
  const estimatedCostPer700Words = sceneProvider?.estimatedCostPer700Words;
  const sceneMargin = sceneProvider?.marginMultiplier || 1.0;

  // Calculate estimated API cost → user tokens (cost-based pricing)
  let sceneCostPerScene;
  if (estimatedCostPer700Words != null && estimatedCostPer700Words > 0) {
    const estApiCostUSD = estimateAPICost(targetWords, estimatedCostPer700Words);
    sceneCostPerScene = calculateUserTokens(estApiCostUSD, tokenToUSD, sceneMargin, globalMargin);
  } else {
    // Fallback to word-based or fixed pricing (backwards compat)
    const tokensPer100Words = sceneProvider?.tokensPer100Words;
    if (tokensPer100Words > 0) {
      const estApiCostUSD = (targetWords / 100) * tokensPer100Words * tokenToUSD;
      sceneCostPerScene = calculateUserTokens(estApiCostUSD, tokenToUSD, sceneMargin, globalMargin);
    } else {
      const baseTokens = sceneProvider?.baseTokens || sceneProvider?.cost || 0;
      const estApiCostUSD = baseTokens * tokenToUSD;
      sceneCostPerScene = calculateUserTokens(estApiCostUSD, tokenToUSD, sceneMargin, globalMargin);
    }
  }

  // Get extractCanon pricing (always claude)
  const extractOp = pricingCache.data.operations.extractCanon;
  const extractProvider = extractOp?.providers?.claude;
  const extractEstCost = extractProvider?.estimatedCostPer700Words || (extractProvider?.baseTokens || extractProvider?.cost || 0) * tokenToUSD;
  const extractMargin = extractProvider?.marginMultiplier || 1.0;
  const extractCostPerScene = calculateUserTokens(extractEstCost, tokenToUSD, extractMargin, globalMargin);

  // Total cost = episodes × (scene + extraction)
  const sceneCost = sceneCostPerScene * episodes;
  const extractionCost = extractCostPerScene * episodes;
  const totalCost = sceneCost + extractionCost;

  return {
    sceneCost,
    extractionCost,
    totalCost,
    provider,
    estimated: true,
    breakdown: {
      sceneCostPerScene,
      extractCostPerScene,
      episodes,
      globalMargin,
      tokenToUSD
    }
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

window.__firebasePricing = {
  loadPricing,
  calculateUserTokens,
  estimateAPICost,
  getProviderForPlan,
  estimateAutoModeCost,
  // Expose cache for debugging
  get cache() { return pricingCache; }
};

console.log('Firebase pricing module loaded');
