// ============================================================================
// AI Models Configuration — SINGLE SOURCE OF TRUTH
// ============================================================================
// All AI model IDs + PRICING are defined HERE and ONLY here.
// Backend (Cloud Functions) imports this file via require().
// Frontend uses window.__AI_MODELS.

// WhiteWrite uses ONLY Claude (Anthropic). These are the DEFAULT ids per tier; functions/src/model-watch.js
// may switch a tier to a newer version at runtime (config/ai_models.active + .pricing) after its checks.
const AI_MODELS = {
  claude: {
    opus: 'claude-opus-5-5',          // Highest quality, ~2× Sonnet per scene
    sonnet: 'claude-sonnet-5-5',      // Balanced quality/cost — the paid default
    haiku: 'claude-haiku-5-5'         // Fast, cheapest — Free default, extraction
  }
};

// Phase 4.1: API Pricing (per million tokens) — SINGLE SOURCE OF TRUTH
const MODEL_PRICING = {
  'claude-opus-5-5': { input: 4.00, output: 20.00, cacheWrite: 5.00, cacheRead: 0.20 },
  'claude-sonnet-5-5': { input: 2.00, output: 10.00, cacheWrite: 2.50, cacheRead: 0.10 },
  // Haiku 5.5 is tiered: a prompt over 100 000 tokens is billed at the `over` rates
  'claude-haiku-5-5': { input: 0.10, output: 0.50, cacheWrite: 0.125, cacheRead: 0.01,
    over: { tokens: 100000, input: 0.50, output: 2.50, cacheWrite: 0.625, cacheRead: 0.05 } },
  // older ids — kept so past usage logs and in-flight calls still price correctly
  'claude-opus-4-8': {
    input: 5.00,
    output: 25.00,
    cacheWrite: 6.25,   // Cache creation (25% more expensive)
    cacheRead: 0.50     // Cache read (90% cheaper)
  },
  'claude-opus-4-20250514': {
    input: 15.00,
    output: 75.00,
    cacheWrite: 18.75,
    cacheRead: 1.50
  },
  'claude-sonnet-4-5': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,
    cacheRead: 0.30
  },
  'claude-haiku-4-5': {
    input: 1.00,
    output: 5.00,
    cacheWrite: 1.25,
    cacheRead: 0.10
  },
  'claude-haiku-4-5-20251001': {
    input: 1.00,
    output: 5.00,
    cacheWrite: 1.25,
    cacheRead: 0.10
  }
};

// Export for Node.js (Cloud Functions)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AI_MODELS, MODEL_PRICING };
}

// Export for browser (Frontend)
if (typeof window !== 'undefined') {
  window.__AI_MODELS = AI_MODELS;
  window.__MODEL_PRICING = MODEL_PRICING;
}
