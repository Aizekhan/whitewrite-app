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

const admin = require('./admin.js'); // firebase-admin v14: the namespaced facade
const { MODEL_PRICING } = require('./ai-models.js');
const { tokensForUsd, USD_PER_TOKEN, setPriceIndex, SCENE_COST } = require('./paid-features.js');
const { getPlanBudget } = require('./plans.js');
const ledger = require('./src/ledger.js'); // users/{uid}/ledger — what the user sees in «Історія токенів»

// The API answers with a dated id (claude-sonnet-4-5-20250929); price it by the configured alias it starts with.
// Prices of models switched in by modelWatch live in config/ai_models.pricing (read in charge(), cached 5 min).
let livePricing = {}, livePricingAt = 0;
async function loadLivePricing(db) {
  if (Date.now() - livePricingAt < 5 * 60 * 1000) return;
  try {
    const conf = (await db.collection('config').doc('ai_models').get()).data() || {};
    livePricing = conf.pricing || {};
    setPriceIndex(conf.priceIndex); // the live price index: every featureCost reserve on this instance follows it (paid-features.js)
  } catch (e) { livePricing = {}; }
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
//   tokensUsed   — spent from the monthly allowance in the current period (never above the monthly allowance)
//   periodStart  — Timestamp; allowance renews 1 month after (lazy reset on next debit)
//   bonusTokens  — purchased top-ups; persist across periods, spent after the allowance. NEGATIVE = debt: a post-hoc charge
//                  (the API already paid) beyond the balance goes here, so it survives the period renewal and is paid back
//                  from the next allowance / top-up (audit 2026-11-19: the overdraft used to vanish with tokensUsed at renewal)

// The plan the balance follows: a cancelled subscription whose paid period is over (subscriptionEndsAt) counts as free
// even before subscription_expired arrives (lemon.js)
function effectivePlan(userData, now = new Date()) {
  const plan = userData.plan || 'free';
  const end = userData.cancelAtPeriodEnd && userData.subscriptionEndsAt && userData.subscriptionEndsAt.toMillis ? userData.subscriptionEndsAt.toMillis() : 0;
  return end && end <= now.getTime() ? 'free' : plan;
}

function getBalance(userData, now = new Date()) {
  const plan = effectivePlan(userData, now);
  const monthly = getPlanBudget(plan).monthly;
  const periodStart = userData.periodStart?.toDate ? userData.periodStart.toDate() : null;
  let expired = !periodStart;
  if (periodStart) {
    const renewAt = new Date(periodStart);
    renewAt.setMonth(renewAt.getMonth() + 1);
    expired = renewAt <= now;
  }
  // past_due: LS is still retrying the renewal payment — no new allowance until it is paid (the old period's balance stays;
  // the period opens on the next debit after subscription_updated → active)
  if (expired && periodStart && userData.subscriptionStatus === 'past_due' && plan !== 'free') expired = false;
  const rawBonus = userData.bonusTokens || 0;
  // a debt is paid from the allowance first (a new period, an upgrade): this view is normalized, so every writer that
  // stores tokensUsed from it stores bonusTokens = bonusRaw too (applyDebit / applyCredit here, lemon.js)
  const used0 = expired ? 0 : Math.min(monthly, userData.tokensUsed || 0);
  const pay = Math.min(Math.max(0, -rawBonus), monthly - used0);
  const used = used0 + pay, bonusRaw = rawBonus + pay;
  const bonus = Math.max(0, bonusRaw), debt = Math.max(0, -bonusRaw);
  const monthlyLeft = Math.max(0, monthly - used);
  return { plan, monthly, used, bonus, debt, bonusRaw, monthlyLeft, available: Math.max(0, monthlyLeft + bonus - debt), expired };
}

// Debit inside a transaction: monthly allowance first, then bonus.
// allowOverdraft: post-hoc charges (API already paid) may exceed the balance — the rest becomes debt (negative bonusTokens).
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
    tokensUsed: b.used + fromMonthly,
    bonusTokens: b.bonusRaw - fromBonus - overflow
  };
  if (b.expired) {
    updates.periodStart = admin.firestore.Timestamp.now();
    ledger.txRecord(tx, ref.firestore, ref.id, { type: 'grant', op: 'monthly', amount: b.monthly, balance: b.available, ref: { plan: b.plan } }); // a new period opened
  }
  tx.update(ref, updates);
  return { fromMonthly, fromBonus: fromBonus + overflow, available: b.available - amount };
}

// A return. The allowance part of a reservation made in a period that has since renewed is gone with that period (the new
// period opens full) — what came from bonus / debt always goes back there, and the new period is opened with its ledger grant.
function applyCredit(tx, ref, userData, split) {
  const b = getBalance(userData);
  const updates = {
    tokensUsed: Math.max(0, b.used - (b.expired ? 0 : (split.fromMonthly || 0))),
    bonusTokens: b.bonusRaw + (split.fromBonus || 0)
  };
  if (b.expired) {
    updates.periodStart = admin.firestore.Timestamp.now();
    ledger.txRecord(tx, ref.firestore, ref.id, { type: 'grant', op: 'monthly', amount: b.monthly, balance: b.available, ref: { plan: b.plan } });
  }
  tx.update(ref, updates);
}

// opts.hold (an AI call, settled later by charge()/refund()): the reservation is also written to users/{uid}/reservations/{id}
// and settling deletes it. A function killed by its timeout never reaches its catch — reservationSweep (cost-watch.js)
// settles what is still held after HOLD_MS: the calls already paid to the API (notePaid → paidUsd on the hold) are charged,
// only the rest goes back. Fixed fees (Космограф, бекап, слот…) are final at reserve and never held.
const HOLD_MS = 2 * 60 * 60 * 1000; // > the longest AI function timeout (gamedevPlan, 3600 s)

/**
 * Atomically reserve tokens BEFORE an AI call (prevents parallel overspend).
 * Throws err.code === 'OUT_OF_TOKENS' if balance is insufficient.
 * opts.hold — an AI call (see above); opts.cap — the quoted «не більше N» (kept on the hold: the sweep never charges above it);
 * opts.upTo — the worst case of an uncapped long call (gamedevPlan plan / analyze): the reserve is `amount` (the registry price
 * the page shows — the run is never refused above it) raised to as much of `upTo` as the balance holds, so the real cost
 * (often 5–10× the registry price on Opus) is mostly covered up front; what goes beyond the balance becomes debt (getBalance).
 * @returns {Promise<{fromMonthly:number, fromBonus:number, available:number, hold?:string}>}
 */
async function reserve(db, uid, amount, opts = {}) {
  loadLivePricing(db).catch(() => {}); // warms the price index for the next reserve on this instance
  const ref = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref), data = snap.exists ? snap.data() : {};
    const amt = opts.upTo > amount ? Math.max(amount, Math.min(opts.upTo, getBalance(data).available)) : amount;
    const split = applyDebit(tx, ref, data, amt, false);
    if (opts.hold) {
      const h = ref.collection('reservations').doc();
      tx.set(h, Object.assign({ fromMonthly: split.fromMonthly, fromBonus: split.fromBonus, at: admin.firestore.Timestamp.now() }, opts.cap > 0 ? { cap: opts.cap } : {}));
      split.hold = h.id;
    }
    return split;
  });
}

// Return a reservation (AI call failed). A held one already returned by the sweep is not returned twice.
async function refund(db, uid, split) {
  const ref = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const h = split && split.hold ? ref.collection('reservations').doc(split.hold) : null;
    if (h && !(await tx.get(h)).exists) return;
    if (snap.exists) applyCredit(tx, ref, snap.data(), split);
    if (h) tx.delete(h);
  });
}

// usage_logs TTL — every frequent writer (charge, KB helper, voice) sets it
const logExpireAt = () => admin.firestore.Timestamp.fromMillis(Date.now() + 400 * 86400000);

// The API cost in $ of one usage (MODEL_PRICING + config/ai_models.pricing, the long-prompt tier)
function apiUsd(model, usage) {
  let pricing = pricingFor(model);
  const u = usage || {}, inT = u.input_tokens || 0, cw = u.cache_creation_input_tokens || 0, cr = u.cache_read_input_tokens || 0;
  if (pricing && pricing.over && inT + cw + cr > pricing.over.tokens) pricing = pricing.over;
  if (!pricing) return 0;
  return (inT * pricing.input + (u.output_tokens || 0) * pricing.output + cw * (pricing.cacheWrite || pricing.input) + cr * (pricing.cacheRead || pricing.input)) / 1e6;
}

// A call of a held reservation reached the API: its cost is added to the hold (one increment per call — parallel calls
// don't race), so a function killed by its timeout before charge() is still billed by the sweep. Never throws.
async function notePaid(db, uid, reservation, model, usage) {
  if (!reservation || !reservation.hold) return;
  try {
    await loadLivePricing(db);
    const usd = apiUsd(model, usage); if (!(usd > 0)) return;
    // update, not set: a hold already settled (deleted) is not brought back by a call that finished late
    await db.collection('users').doc(uid).collection('reservations').doc(reservation.hold)
      .update({ paidUsd: admin.firestore.FieldValue.increment(usd), model });
  } catch (e) { console.error('[notePaid]', uid, e.message); }
}

// Held reservations older than HOLD_MS: their function died without settling — the calls it noted as paid are charged
// (never above the hold's quoted cap), the rest of the hold goes back (reservationSweep)
async function sweepHeld(db, now = Date.now()) {
  const old = await db.collectionGroup('reservations').where('at', '<', admin.firestore.Timestamp.fromMillis(now - HOLD_MS)).limit(500).get();
  let n = 0;
  for (const d of old.docs) {
    const uid = d.ref.parent.parent.id, r = d.data();
    try {
      if (r.paidUsd > 0) await chargeHeld(db, uid, d.id, r, Math.min(tokensForUsd(r.paidUsd), r.cap > 0 ? r.cap : Infinity), 'ai_timeout');
      else await refund(db, uid, { fromMonthly: r.fromMonthly || 0, fromBonus: r.fromBonus || 0, hold: d.id });
      n++;
    } catch (e) { console.error('[sweepHeld]', uid, d.id, e.message); }
  }
  return n;
}
// A hold settled at `cost` without a usage to charge: the sweep (the noted paid calls) and a run stopped by its own deadline
async function chargeHeld(db, uid, holdId, r, cost, op) {
  const ref = db.collection('users').doc(uid), h = ref.collection('reservations').doc(holdId);
  const done = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!(await tx.get(h)).exists) return false; // settled meanwhile
    const data = snap.exists ? snap.data() : {}, held = (r.fromMonthly || 0) + (r.fromBonus || 0), delta = cost - held;
    if (delta > 0) applyDebit(tx, ref, data, delta, true);
    else if (delta < 0) { const back = -delta, fromBonus = Math.min(back, r.fromBonus || 0); applyCredit(tx, ref, data, { fromMonthly: back - fromBonus, fromBonus }); }
    tx.delete(h);
    ledger.txRecord(tx, db, uid, { type: 'spend', op, amount: -cost, ref: { model: r.model || null }, note: 'AI run cut off by the time limit' });
    return true;
  });
  if (!done) return;
  try {
    await db.collection('usage_logs').add({ uid, expireAt: logExpireAt(), operation: op, model: r.model || null, timestamp: admin.firestore.FieldValue.serverTimestamp(),
      billing: 'swept', usdPerToken: USD_PER_TOKEN, userTokensCharged: cost, userPaidUSD: +(cost * USD_PER_TOKEN).toFixed(4), realApiCostUSD: +(r.paidUsd || 0).toFixed(4) });
  } catch (e) { console.error('[sweepHeld] usage_logs:', e.message); }
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
  // The call is already paid to the API: a missing / broken economy entry must never make it free — the registry default
  // (paid-features SCENE_COST) stands in; the charge itself is the real API cost anyway (below)
  const provider = options.provider || 'claude'; // economy_operations/{op}.providers key (Claude only)
  let providerData = null;
  try {
    const economyDoc = await db.collection('economy_operations').doc(operation).get();
    providerData = economyDoc.exists ? ((economyDoc.data().providers || {})[provider] || null) : null;
  } catch (e) { console.error(`[TokenService] economy_operations/${operation}:`, e.message); }
  if (!providerData) {
    console.error(`[TokenService] economy_operations/${operation} (${provider}) missing — charging with the registry defaults`);
    providerData = { marginMultiplier: 1, baseTokens: SCENE_COST.claude, cost: SCENE_COST.claude };
  }
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
  if (options.floor > userCost) userCost = options.floor; // a run stopped by its deadline: calls still in flight are paid with no usage yet (settle)
  if (options.cap > 0 && userCost > options.cap) userCost = options.cap; // «не більше N»: the quoted ceiling the author agreed to (paid-features quoteChars)
  console.log(`[TokenService] Billing (${billing}): ${userCost} tokens for $${apiCostUSD.toFixed(4)} API`);

  // 5. Deduct user tokens (transactional; settles against a prior reserve() if given)
  const userRef = db.collection('users').doc(uid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const userData = snap.exists ? snap.data() : {};
    // a held reservation the sweep already returned counts as none: the call is charged in full
    const hold = options.reserved && options.reserved.hold ? userRef.collection('reservations').doc(options.reserved.hold) : null;
    const held = hold ? (await tx.get(hold)).exists : true;
    const reserved = held ? options.reserved : null;
    if (hold && held) tx.delete(hold);
    let delta = userCost;
    if (reserved) {
      const reservedTotal = (reserved.fromMonthly || 0) + (reserved.fromBonus || 0);
      delta = userCost - reservedTotal;
      if (delta > 0) applyDebit(tx, userRef, userData, delta, true);
      else if (delta < 0) { // back where it came from: bonus (bought, kept across periods) first, the rest to the allowance
        const back = -delta, fromBonus = Math.min(back, reserved.fromBonus || 0);
        applyCredit(tx, userRef, userData, { fromMonthly: back - fromBonus, fromBonus });
      }
    } else {
      applyDebit(tx, userRef, userData, userCost, true);
    }
    const b = getBalance(userData);
    ledger.txRecord(tx, db, uid, { type: 'spend', op: options.logAs || operation, amount: -userCost, balance: (b.expired ? b.monthly + b.bonus : b.available) - delta,
      ref: { projectId: projectId || null, model } });
  });

  console.log(`[TokenService] ✅ Deducted ${userCost} tokens from user ${uid}`);

  // 6. Log to usage_logs with cost-based pricing + real margin tracking
  // what the user paid in $ = tokens × USD_PER_TOKEN (paid-features.js) — not the legacy tokenToUSD (0.01), which overstated it ~67×
  const userPaidUSD = userCost * USD_PER_TOKEN;
  const realMarginRatio = apiCostUSD > 0 ? userPaidUSD / apiCostUSD : 0;
  const profitUSD = userPaidUSD - apiCostUSD;
  const cacheSavingsUSD = estApiCostUSD - apiCostUSD; // If positive, cache saved money

  const logEntry = {
    uid,
    expireAt: logExpireAt(), // TTL (firestore.indexes.json): the cost analytics keep 400 days, the user's own history is the ledger
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
    userPaidUSD: parseFloat(userPaidUSD.toFixed(4)),  // What user paid in $

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

  // the tokens are already settled: a failed log must not make the caller refund the reservation again
  try { await db.collection('usage_logs').add(logEntry); } catch (e) { console.error('[TokenService] usage_logs write failed:', e.message); }

  console.log(`[TokenService] ✅ Logged usage_logs entry (apiCostUSD: $${apiCostUSD.toFixed(4)}, margin tracked)`);

  return { userCost, apiCostUSD, marginMultiplier, globalMarginMultiplier };
}

// A cut-off answer (stop_reason max_tokens) is already paid to the API. The caller throws cutOff(…) and its catch calls
// settle(…) instead of refund(): the real cost is charged against the reservation — otherwise an oversized input would
// make every call free (the whole reservation refunded while the platform pays Anthropic).
function cutOff(message, model, usage) { return Object.assign(new Error(message), { paid: { model, usage } }); }
// opts.cap — the quoted «не більше N» (import, folder sort, world folder): a failure is never charged above it either
// A run stopped by its own deadline (beforeTimeout, error.deadline): its finished calls are charged and at least the reservation
// is kept for the calls still in flight (paid to the API, usage unknown) — never refunded.
async function settle(db, uid, reservation, error, logAs, opts = {}) {
  if (!reservation) return;
  const held = (reservation.fromMonthly || 0) + (reservation.fromBonus || 0);
  if (error && error.paid && error.paid.usage) {
    return charge(db, uid, 'generateScene', error.paid.model, error.paid.usage, null, { provider: 'claude', reserved: reservation, logAs: (logAs || 'ai') + '_cutoff',
      targetWords: Math.round((error.paid.usage.output_tokens || 0) * 0.75), cap: opts.cap || 0, floor: error.deadline ? held : 0 });
  }
  if (error && error.deadline) {
    if (reservation.hold) await chargeHeld(db, uid, reservation.hold, reservation, held, (logAs || 'ai') + '_deadline');
    return; // a reservation without a hold is already debited: kept as it is
  }
  return refund(db, uid, reservation);
}

// An internal deadline below the function timeout: the run fails with error.deadline while there is still time to settle
// (a function killed by the platform settles nothing — the sweep only knows the calls noted with notePaid)
function beforeTimeout(promise, ms) {
  let t;
  const timer = new Promise((_, reject) => { t = setTimeout(() => reject(Object.assign(new Error('ШІ не встиг за відведений час — спробуй менший обсяг'), { deadline: true })), Math.max(1000, ms)); });
  return Promise.race([promise, timer]).finally(() => clearTimeout(t));
}

module.exports = { charge, getBalance, effectivePlan, reserve, refund, cutOff, settle, notePaid, apiUsd, beforeTimeout, sweepHeld, HOLD_MS, logExpireAt };
