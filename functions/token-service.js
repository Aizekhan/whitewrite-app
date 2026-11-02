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
const { tokensForUsd, USD_PER_TOKEN } = require('./paid-features.js');
const { getPlanBudget } = require('./plans.js');
const ledger = require('./src/ledger.js'); // users/{uid}/ledger — what the user sees in «Історія токенів»

// The API answers with a dated id (claude-sonnet-4-5-20250929); price it by the configured alias it starts with.
// Prices of models switched in by modelWatch live in config/ai_models.pricing (read in charge(), cached 5 min).
let livePricing = {}, livePricingAt = 0;
async function loadLivePricing(db) {
  if (Date.now() - livePricingAt < 5 * 60 * 1000) return;
  try { livePricing = ((await db.collection('config').doc('ai_models').get()).data() || {}).pricing || {}; } catch (e) { livePricing = {}; }
  livePricingAt = Date.now();
}
function pricingFor(model) {
  const all = Object.assign({}, MODEL_PRICING, livePricing);
  if (all[model]) return all[model];
  const alias = Object.keys(all).filter((k) => String(model || '').startsWith(k + '-')).sort((x, y) => y.length - x.length)[0];
  return alias ? all[alias] : null;
}

// ============================================================================
// BALANCE (server-side only — client never writes token fields)
// ============================================================================
// users/{uid} fields:
//   tokensUsed   — spent from the monthly allowance in the current period
//   periodStart  — Timestamp; allowance renews 1 month after (lazy reset on next debit)
//   bonusTokens  — purchased top-ups; persist across periods, spent after the allowance

function getBalance(userData, now = new Date()) {
  const plan = userData.plan || 'free';
  const monthly = getPlanBudget(plan).monthly;
  const periodStart = userData.periodStart?.toDate ? userData.periodStart.toDate() : null;
  let expired = !periodStart;
  if (periodStart) {
    const renewAt = new Date(periodStart);
    renewAt.setMonth(renewAt.getMonth() + 1);
    expired = renewAt <= now;
  }
  const used = expired ? 0 : (userData.tokensUsed || 0);
  const bonus = Math.max(0, userData.bonusTokens || 0);
  const monthlyLeft = Math.max(0, monthly - used);
  return { plan, monthly, used, bonus, monthlyLeft, available: monthlyLeft + bonus, expired };
}

// Debit inside a transaction: monthly allowance first, then bonus.
// allowOverdraft: post-hoc charges (API already paid) may exceed the balance.
function applyDebit(tx, ref, userData, amount, allowOverdraft) {
  const b = getBalance(userData);
  if (!allowOverdraft && b.available < amount) {
    const err = new Error('Insufficient tokens');
    err.code = 'OUT_OF_TOKENS';
    err.available = b.available;
    throw err;
  }
  const fromMonthly = Math.min(amount, b.monthlyLeft);
  const fromBonus = Math.min(amount - fromMonthly, b.bonus);
  const overflow = amount - fromMonthly - fromBonus;
  const updates = {
    tokensUsed: b.used + fromMonthly + overflow,
    bonusTokens: b.bonus - fromBonus
  };
  if (b.expired) {
    updates.periodStart = admin.firestore.Timestamp.now();
    ledger.txRecord(tx, ref.firestore, ref.id, { type: 'grant', op: 'monthly', amount: b.monthly, balance: b.available, ref: { plan: b.plan } }); // a new period opened
  }
  tx.update(ref, updates);
  return { fromMonthly: fromMonthly + overflow, fromBonus, available: b.available - amount };
}

function applyCredit(tx, ref, userData, split) {
  const b = getBalance(userData);
  const updates = {
    tokensUsed: Math.max(0, b.used - (split.fromMonthly || 0)),
    bonusTokens: b.bonus + (split.fromBonus || 0)
  };
  if (b.expired) updates.periodStart = admin.firestore.Timestamp.now();
  tx.update(ref, updates);
}

/**
 * Atomically reserve tokens BEFORE an AI call (prevents parallel overspend).
 * Throws err.code === 'OUT_OF_TOKENS' if balance is insufficient.
 * @returns {Promise<{fromMonthly:number, fromBonus:number, available:number}>}
 */
async function reserve(db, uid, amount) {
  const ref = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    return applyDebit(tx, ref, snap.exists ? snap.data() : {}, amount, false);
  });
}

// Return a reservation (AI call failed).
async function refund(db, uid, split) {
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) applyCredit(tx, ref, snap.data(), split);
  });
}

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
 * @param {object} options - Optional params { sceneId?, provider?, logAs? }
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

  // 3. Calculate estimated API cost (cost-based pricing, Phase 6.2: includes INPUT)
  const targetWords = options.targetWords || 700;
  const estimatedInputTokens = options.estimatedInputTokens || 0; // NEW: input tokens estimate
  const estimatedCostPer700Words = providerData.estimatedCostPer700Words;

  // Calculate OUTPUT cost
  let estOutputCostUSD = 0;
  if (estimatedCostPer700Words != null && estimatedCostPer700Words > 0) {
    // Cost-based pricing: estOutputCostUSD = (targetWords / 700) × estimatedCostPer700Words
    estOutputCostUSD = (targetWords / 700) * estimatedCostPer700Words;
    console.log(`[TokenService] Output cost: ${targetWords} words × $${estimatedCostPer700Words}/700 = $${estOutputCostUSD.toFixed(4)}`);
  } else {
    // Fallback: word-based or fixed pricing (backwards compat)
    const tokensPer100Words = providerData.tokensPer100Words;
    if (tokensPer100Words > 0) {
      const baseTokens = Math.ceil((targetWords / 100) * tokensPer100Words);
      estOutputCostUSD = baseTokens * tokenToUSD;
      console.log(`[TokenService] Word-based fallback: ${baseTokens} tokens × $${tokenToUSD} = $${estOutputCostUSD.toFixed(4)}`);
    } else {
      const baseTokens = providerData.baseTokens || providerData.cost || 0;
      estOutputCostUSD = baseTokens * tokenToUSD;
      console.log(`[TokenService] Fixed pricing fallback: ${baseTokens} tokens × $${tokenToUSD} = $${estOutputCostUSD.toFixed(4)}`);
    }
  }

  // Calculate INPUT cost (Phase 6.2: charge for prompt size)
  let estInputCostUSD = 0;
  if (estimatedInputTokens > 0) {
    const pricing = pricingFor(model);
    if (pricing) {
      estInputCostUSD = estimatedInputTokens * pricing.input / 1000000;
      console.log(`[TokenService] Input cost: ${estimatedInputTokens} tokens × $${pricing.input}/M = $${estInputCostUSD.toFixed(4)}`);
    }
  }

  // Total estimated cost = output + input
  const estApiCostUSD = estOutputCostUSD + estInputCostUSD;
  console.log(`[TokenService] Total estimated cost: $${estOutputCostUSD.toFixed(4)} (output) + $${estInputCostUSD.toFixed(4)} (input) = $${estApiCostUSD.toFixed(4)}`);

  console.log(`[TokenService] Margin multiplier: ${marginMultiplier}`);

  // 4. Estimate-based cost — used only when the real API cost is unknown (unpriced model / no usage)
  // userTokens = ceil( (estApiCostUSD / tokenToUSD) × marginMultiplier × globalMargin )
  let userCost = Math.ceil(
    (estApiCostUSD / tokenToUSD) * marginMultiplier * globalMarginMultiplier
  );

  console.log(`[TokenService] User cost (final): ${userCost} tokens = ceil(($${estApiCostUSD.toFixed(4)} / $${tokenToUSD}) × ${marginMultiplier} × ${globalMarginMultiplier})`);

  // 4. Calculate real API cost from usage
  let apiCostUSD = 0;
  let inputTokens = usage.input_tokens || 0;
  let outputTokens = usage.output_tokens || 0;
  let cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  let cacheReadTokens = usage.cache_read_input_tokens || 0;

  await loadLivePricing(db);
  let pricing = pricingFor(model);
  if (pricing && pricing.over && inputTokens + cacheCreationTokens + cacheReadTokens > pricing.over.tokens) pricing = pricing.over; // long-prompt tier
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

  // MARGIN: the charge is the REAL API cost in tokens (paid-features.js USD_PER_TOKEN); the estimate is a fallback
  const billing = apiCostUSD > 0 ? 'actual' : 'estimate';
  if (billing === 'actual') userCost = tokensForUsd(apiCostUSD);
  console.log(`[TokenService] Billing (${billing}): ${userCost} tokens for $${apiCostUSD.toFixed(4)} API`);

  // 5. Deduct user tokens (transactional; settles against a prior reserve() if given)
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const userData = snap.exists ? snap.data() : {};
    let delta = userCost;
    if (options.reserved) {
      const reservedTotal = (options.reserved.fromMonthly || 0) + (options.reserved.fromBonus || 0);
      delta = userCost - reservedTotal;
      if (delta > 0) applyDebit(tx, userRef, userData, delta, true);
      else if (delta < 0) applyCredit(tx, userRef, userData, { fromMonthly: -delta, fromBonus: 0 });
    } else {
      applyDebit(tx, userRef, userData, userCost, true);
    }
    const b = getBalance(userData);
    ledger.txRecord(tx, db, uid, { type: 'spend', op: options.logAs || operation, amount: -userCost, balance: (b.expired ? b.monthly + b.bonus : b.available) - delta,
      ref: { projectId: projectId || null, model } });
  });

  console.log(`[TokenService] ✅ Deducted ${userCost} tokens from user ${uid}`);

  // 6. Log to usage_logs with cost-based pricing + real margin tracking
  const realMarginRatio = apiCostUSD > 0 ? (userCost * tokenToUSD) / apiCostUSD : 0;
  const profitUSD = (userCost * tokenToUSD) - apiCostUSD;
  const cacheSavingsUSD = estApiCostUSD - apiCostUSD; // If positive, cache saved money

  const logEntry = {
    uid,
    operation: options.logAs || operation, // logAs: priced as `operation`, logged under its own name
    model,
    projectId,
    sceneId: options.sceneId || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),

    // Cost-based pricing (Phase 6.2 - with input cost)
    targetWords,                          // Target word count
    estimatedInputTokens,                 // Estimated input tokens (prompt size)
    estimatedOutputCostUSD: parseFloat(estOutputCostUSD.toFixed(4)), // Output cost estimate
    estimatedInputCostUSD: parseFloat(estInputCostUSD.toFixed(4)),   // Input cost estimate
    estimatedApiCostUSD: parseFloat(estApiCostUSD.toFixed(4)),  // Total estimated cost
    tokenToUSD,                           // Conversion rate at time of use
    marginMultiplier,                     // Operation-specific margin
    globalMarginMultiplier,               // Global margin at time of use
    billing,                              // 'actual' = ceil(realApiCostUSD / usdPerToken) · 'estimate' = old formula
    usdPerToken: USD_PER_TOKEN,
    userTokensCharged: userCost,
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

module.exports = { charge, getBalance, reserve, refund };
