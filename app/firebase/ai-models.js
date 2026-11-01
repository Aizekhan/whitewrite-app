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
    pro: 'gemini-2.5-flash'           // Stable GA model (free tier); gemini-2.0-flash-exp was retired (404)
  }
};

// Phase 4.1: API Pricing (per million tokens) — SINGLE SOURCE OF TRUTH
const MODEL_PRICING = {
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
  },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 } // paid-tier price (thinking tokens bill as output) — billed so even on the free key
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
