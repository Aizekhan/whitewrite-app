// ============================================================================
// AI Models Configuration — SINGLE SOURCE OF TRUTH
// ============================================================================
// All AI model IDs are defined HERE and ONLY here.
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

// Export for Node.js (Cloud Functions)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AI_MODELS };
}

// Export for browser (Frontend)
if (typeof window !== 'undefined') {
  window.__AI_MODELS = AI_MODELS;
}
