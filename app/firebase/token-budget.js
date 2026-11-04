// Token Budget System for WhiteWrite
// Universal metering for all AI operations (scenes, canon, analysis, games, etc.)

// ============================================================================
// TOKEN COSTS — How much each operation consumes
// ============================================================================
// Fallbacks only: the paid-features registry sets the real prices below

window.__TOKEN_COSTS = {
  scene: 160,                // a typical 700-word scene on the author's Claude model (set from MODEL_TIERS below)
  analyzeScene: 50           // «✦ Порадити» (set from the registry below)
};

// ============================================================================
// PLAN BUDGETS — Monthly token allocation per tier
// ============================================================================

window.__PLAN_BUDGETS = {
  free: {
    name: "Free",
    price: 0,
    monthly: 200,              // fallback only — paid-features.js overrides

    // Feature gates
    allowReconstruction: false,
    allowExport: false,
    allowAPI: false,
    allowWorldTree: false,          // ❌ NO WorldTree access
    allowAnalyze: false,            // ❌ NO ANALYZE mode
    allowImprove: false,            // ❌ NO IMPROVE mode
    allowGameDev: false,

    // Soft limits (UI guidance, not hard blocks)
    maxProjects: 1,

    description: "Claude Haiku"
  },

  storyteller: {
    name: "Storyteller",
    price: 12,
    monthly: 2400,

    allowReconstruction: false,
    allowExport: true,         // ← Unlock DOCX/PDF export
    allowAPI: false,
    allowWorldTree: true,           // ✅ WorldTree access
    allowAnalyze: false,            // ❌ ANALYZE mode (too expensive for this tier)
    allowImprove: false,            // ❌ IMPROVE mode (too expensive for this tier)
    allowGameDev: false,

    maxProjects: 5,

    description: "Claude Haiku · Sonnet, експорт книг, Біблія світу + канон"
  },

  novelist: {
    name: "Novelist",
    price: 29,
    monthly: 32000,

    allowReconstruction: true, // ← Unlock Universe Reconstruction (moat!)
    allowExport: true,
    allowAPI: false,
    allowWorldTree: true,           // ✅ WorldTree access
    allowAnalyze: true,             // ✅ ANALYZE mode (50 tokens)
    allowImprove: true,             // ✅ IMPROVE mode (80 tokens)
    allowGameDev: false,

    maxProjects: Infinity,

    description: "Claude Haiku · Sonnet · Opus + узгодження сцен + ANALYZE"
  },

  worldbuilder: {
    name: "Worldbuilder",
    price: 69,
    monthly: 180000,           // 300 Claude (90000) OR mix

    allowReconstruction: true,
    allowExport: true,
    allowAPI: true,            // ← Unlock API access
    priority: true,            // Priority queue for generation
    allowWorldTree: true,
    allowAnalyze: true,
    allowImprove: true,
    allowGameDev: true,           // ✅ Game Bible + Production Plan

    maxProjects: Infinity,

    description: "Claude Haiku · Sonnet · Opus + Біблія гри + API"
  },

  // Dev/testing plan (legacy)
  worldforge: {
    name: "Worldforge",
    price: 0,
    monthly: 180000,           // Same as worldbuilder for testing

    allowReconstruction: true,
    allowExport: true,
    allowAPI: true,
    priority: true,
    allowWorldTree: true,
    allowAnalyze: true,
    allowImprove: true,
    allowGameDev: true,           // ✅ Game Bible + Production Plan

    maxProjects: Infinity,

    description: "180,000 токенів (dev plan)"
  }
};

// Prices, budgets and gates come from the paid-features registry (functions/paid-features.js) when loaded
(function () {
  var PF = window.__PAID_FEATURES;
  if (!PF) return;
  Object.keys(PF.PLANS).forEach(function (id) {
    var p = PF.PLANS[id], b = PF.planBudget(id), cur = window.__PLAN_BUDGETS[id] || (window.__PLAN_BUDGETS[id] = {});
    Object.keys(b).forEach(function (k) { cur[k] = b[k]; });
    cur.name = p.name; cur.price = p.price;
    if (cur.maxProjects >= 999) cur.maxProjects = Infinity;
  });
  // display / pre-check prices follow the registry too (typical scene, ✦ Порадити)
  var C = window.__TOKEN_COSTS;
  C.analyzeScene = PF.featureCost(PF.byOp('advise'));
  // the scene price follows the author's Claude model (__wwUser.aiModel, set at sign-in and in the Account)
  window.__wwApplyModel = function () { C.scene = PF.tierInfo((window.__wwUser || {}).aiModel || 'sonnet').typical; };
  window.__wwApplyModel();
})();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Get plan configuration
window.__getPlanConfig = function(planName) {
  return window.__PLAN_BUDGETS[planName] || window.__PLAN_BUDGETS.free;
};
