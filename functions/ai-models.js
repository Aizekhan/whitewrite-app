// ============================================================================
// AI Models Configuration — SINGLE SOURCE OF TRUTH
// ============================================================================
// All AI model IDs + PRICING are defined HERE and ONLY here.
// Backend (Cloud Functions) imports this file via require().
// Frontend uses window.__AI_MODELS.

const AI_MODELS = {
  // Claude models (Anthropic API)
  claude: {
    opus: 'claude-opus-4-8',          // Highest quality, expensive
    sonnet: 'claude-sonnet-4-5',      // Balanced quality/cost
    haiku: 'claude-haiku-4-5'         // Fast, cheap (extraction, analysis)
  },

  // Gemini models (Google API)
  gemini: {
    pro: 'gemini-2.0-flash-exp'       // Free tier model
  }
};

// Phase 4.1: API Pricing (per million tokens) — SINGLE SOURCE OF TRUTH
const MODEL_PRICING = {
  'claude-opus-4-8': {
    input: 15.00,
    output: 75.00,
    cacheWrite: 18.75,  // Cache creation (25% more expensive)
    cacheRead: 1.50     // Cache read (90% cheaper)
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
    input: 0.80,
    output: 4.00,
    cacheWrite: 1.00,
    cacheRead: 0.08
  },
  'claude-haiku-4-5-20251001': {
    input: 0.80,
    output: 4.00,
    cacheWrite: 1.00,
    cacheRead: 0.08
  },
  'gemini-2.0-flash-exp': { input: 0, output: 0 } // Free tier
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
