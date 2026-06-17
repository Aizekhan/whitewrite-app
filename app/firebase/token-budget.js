// Token Budget System for WhiteWrite
// Universal metering for all AI operations (scenes, images, canon, etc.)

// ============================================================================
// TOKEN COSTS — How much each operation consumes
// ============================================================================
// Base unit: 1 token ≈ $0.000015 (inspired by OpenAI pricing psychology)
// This makes numbers human-readable: "5,000 tokens" feels better than "0.075 credits"

window.__TOKEN_COSTS = {
  // ===== SCENES =====
  sceneGemini: 20,           // ~$0.0003 per scene (Gemini Flash)
  sceneClaude: 300,          // ~$0.0135 per scene (Claude Sonnet)

  // ===== IMAGES =====
  imageGenerate: 3500,       // ~$0.05 per image (DALL-E 3 / Midjourney)
  imageVariant: 2000,        // ~$0.03 per variant (cheaper, reuse base)

  // ===== CANON (cheap operations) =====
  canonSuggestion: 10,       // Extract entities from scene (legacy)
  canonExtractPerScene: 15,  // Auto-extraction after scene generation (Haiku)
  canonSyncProject: null,    // Dynamic: scenesCount × canonExtractPerScene
  characterCard: 15,         // Generate character profile
  locationCard: 15,          // Generate location profile
  eventCard: 15,             // Generate event profile

  // ===== DIRECTOR (storyboard) =====
  storyboardBreakdown: 5,    // Break scene into shots (cheap)
  shotImageGen: 3500,        // Generate shot image (same as imageGenerate)
  loraTraining: 50000,       // ~$0.75 per LoRA model (expensive, rare)

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
    monthly: 200,              // 10 Gemini scenes (10 × 20 = 200)

    // Feature gates
    allowClaude: false,
    allowImages: false,
    allowReconstruction: false,
    allowExport: false,
    allowAPI: false,
    allowWorldTree: false,          // ❌ NO WorldTree access
    allowCanonExtraction: false,    // ❌ NO auto-extraction
    allowCanonSync: false,          // ❌ NO sync button
    allowAnalyze: false,            // ❌ NO ANALYZE mode
    allowImprove: false,            // ❌ NO IMPROVE mode

    // Soft limits (UI guidance, not hard blocks)
    maxProjects: 1,

    description: "10 сцен Gemini на місяць"
  },

  storyteller: {
    name: "Storyteller",
    price: 12,
    monthly: 2400,             // 120 Gemini scenes (120 × 20 = 2400)

    allowClaude: false,
    allowImages: false,
    allowReconstruction: false,
    allowExport: true,         // ← Unlock DOCX/PDF export
    allowAPI: false,
    allowWorldTree: true,           // ✅ WorldTree access
    allowCanonExtraction: true,     // ✅ Auto-extraction (15 tokens/scene)
    allowCanonSync: true,           // ✅ "Синхронізувати" button
    allowAnalyze: false,            // ❌ ANALYZE mode (too expensive for this tier)
    allowImprove: false,            // ❌ IMPROVE mode (too expensive for this tier)

    maxProjects: 5,

    description: "120 сцен Gemini, експорт книг, WorldTree + Canon"
  },

  novelist: {
    name: "Novelist",
    price: 29,
    monthly: 32000,            // Flexible: 400 Gemini (8000) OR 80 Claude (24000) + 100 images (350000)
                               // Reality: most will use hybrid (200 Gemini + 40 Claude + 50 images ≈ 29000)

    allowClaude: true,         // ← Unlock Claude Sonnet
    allowImages: true,         // ← Unlock image generation
    allowReconstruction: true, // ← Unlock Universe Reconstruction (moat!)
    allowExport: true,
    allowAPI: false,
    allowLoRA: true,           // ← Unlock LoRA training
    allowWorldTree: true,           // ✅ WorldTree access
    allowCanonExtraction: true,     // ✅ Auto-extraction
    allowCanonSync: true,           // ✅ Canon sync
    allowAnalyze: true,             // ✅ ANALYZE mode (50 tokens)
    allowImprove: true,             // ✅ IMPROVE mode (80 tokens)

    maxProjects: Infinity,
    imageCreditsGuideline: 100, // Soft limit (UI shows "100 images recommended")
    loraSlots: 3,              // 3 LoRA models per project (one-time training)

    description: "32K токенів: ~400 Gemini / 80 Claude + 100 зображень + 3 LoRA + Reconstruction + ANALYZE/IMPROVE"
  },

  worldbuilder: {
    name: "Worldbuilder",
    price: 69,
    monthly: 180000,           // 300 Claude (90000) + 500 images (175000) OR mix

    allowClaude: true,
    allowImages: true,
    allowReconstruction: true,
    allowExport: true,
    allowAPI: true,            // ← Unlock API access
    allowLoRA: true,
    priority: true,            // Priority queue for generation
    allowWorldTree: true,
    allowCanonExtraction: true,
    allowCanonSync: true,
    allowAnalyze: true,
    allowImprove: true,

    maxProjects: Infinity,
    imageCreditsGuideline: 500,
    loraSlots: 10,             // 10 LoRA models per project

    description: "180K токенів: ~300 Claude / ∞ Gemini + 500 зображень + 10 LoRA + API + ANALYZE/IMPROVE"
  },

  // Dev/testing plan (legacy)
  worldforge: {
    name: "Worldforge",
    price: 0,
    monthly: 180000,           // Same as worldbuilder for testing

    allowClaude: true,
    allowImages: true,
    allowReconstruction: true,
    allowExport: true,
    allowAPI: true,
    priority: true,
    allowWorldTree: true,
    allowCanonExtraction: true,
    allowCanonSync: true,
    allowAnalyze: true,
    allowImprove: true,

    maxProjects: Infinity,
    imageCreditsGuideline: 500,
    loraCreditsGuideline: 3,

    description: "180,000 токенів (dev plan)"
  }
};

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
    geminiScenes: Math.floor(tokensRemaining / window.__TOKEN_COSTS.sceneGemini),
    claudeScenes: Math.floor(tokensRemaining / window.__TOKEN_COSTS.sceneClaude),
    images: Math.floor(tokensRemaining / window.__TOKEN_COSTS.imageGenerate),
    // Show most relevant capacity in UI
    primary: Math.floor(tokensRemaining / window.__TOKEN_COSTS.sceneGemini) + ' Gemini сцен'
  };
};

console.log('Token Budget System loaded:', Object.keys(window.__TOKEN_COSTS).length, 'operations');
