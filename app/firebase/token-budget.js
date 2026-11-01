// Token Budget System for WhiteWrite
// Universal metering for all AI operations (scenes, canon, analysis, games, etc.)

// ============================================================================
// TOKEN COSTS — How much each operation consumes
// ============================================================================
// Base unit: 1 token ≈ $0.000015 (inspired by OpenAI pricing psychology)
// This makes numbers human-readable: "5,000 tokens" feels better than "0.075 credits"

window.__TOKEN_COSTS = {
  // ===== SCENES =====
  scene: 160,                // a typical 700-word scene on the author's Claude model (set from MODEL_TIERS below)


  // ===== CANON (cheap operations) =====
  canonSuggestion: 10,       // Extract entities from scene (legacy)
  canonExtractPerScene: 15,  // Auto-extraction after scene generation (Haiku)
  canonSyncProject: null,    // Dynamic: scenesCount × canonExtractPerScene
  characterCard: 15,         // Generate character profile
  locationCard: 15,          // Generate location profile
  eventCard: 15,             // Generate event profile


  // ===== RECONSTRUCTION =====
  sceneReconstruct: 30,      // Regenerate scene with new canon (slightly > new scene)
  impactAnalysis: 5,         // Analyze which scenes affected by canon change

  // ===== NARRATIVE TOOLS =====
  architectOutline: 25,      // Generate story outline
  memorySuggestions: 8,      // Suggest canon additions (very cheap, legacy)
  continuityCheck: 5,        // Check for contradictions
  analyzeScene: 50,          // ANALYZE mode (Claude Opus for quality)
  improveScene: 80           // IMPROVE mode (Claude Opus for rewriting)
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
    allowCanonExtraction: false,    // ❌ NO auto-extraction
    allowCanonSync: false,          // ❌ NO sync button
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
    allowCanonExtraction: false,     // ✅ Auto-extraction (15 tokens/scene)
    allowCanonSync: false,           // ✅ "Синхронізувати" button
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
    allowCanonExtraction: false,     // ✅ Auto-extraction
    allowCanonSync: false,           // ✅ Canon sync
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
    allowCanonExtraction: false,
    allowCanonSync: false,
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
    allowCanonExtraction: false,
    allowCanonSync: false,
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

// Check if user can afford operation
window.__canAfford = function(operation, userTokensRemaining) {
  const cost = window.__TOKEN_COSTS[operation];
  if (!cost) {
    console.error(`Unknown operation: ${operation}`);
    return false;
  }
  return userTokensRemaining >= cost;
};

// Get human-readable cost
window.__formatTokens = function(tokens) {
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }
  return tokens.toString();
};

// Estimate what user can do with remaining budget
window.__estimateCapacity = function(tokensRemaining) {
  return {
    scenes: Math.floor(tokensRemaining / window.__TOKEN_COSTS.scene),
    primary: Math.floor(tokensRemaining / window.__TOKEN_COSTS.scene) + ' сцен Claude'
  };
};

console.log('Token Budget System loaded:', Object.keys(window.__TOKEN_COSTS).length, 'operations');
