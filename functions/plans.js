// ============================================================================
// Plans — SINGLE SOURCE OF TRUTH for plan budgets & feature gates (server)
// ============================================================================
// Frontend mirror (display only): app/firebase/token-budget.js
// Plan changes happen ONLY via payment webhooks — never from the client.

const PLAN_BUDGETS = {
  free: {
    monthly: 200,
    maxProjects: 1,
    allowClaude: false,
    allowCanonExtraction: false,
    allowAnalyze: false,
    allowReconstruction: false,
    allowImprove: false,
    allowGameDev: false
  },
  storyteller: {
    monthly: 2400,
    maxProjects: 5,
    allowClaude: false,
    allowCanonExtraction: true,  // ✅ Auto-extraction enabled
    allowAnalyze: false,
    allowReconstruction: false,
    allowImprove: false,
    allowGameDev: false
  },
  novelist: {
    monthly: 32000,
    maxProjects: 999,
    allowClaude: true,
    allowCanonExtraction: true,
    allowAnalyze: true,   // ✅ ANALYZE mode
    allowReconstruction: true,
    allowImprove: true,   // ✅ IMPROVE mode
    allowGameDev: false
  },
  worldbuilder: {
    monthly: 180000,
    maxProjects: 999,
    allowClaude: true,
    allowCanonExtraction: true,
    allowAnalyze: true,
    allowReconstruction: true,
    allowImprove: true,
    allowGameDev: true // Game Bible + Production Plan
  },
  worldforge: {
    monthly: 180000,
    maxProjects: 999,
    allowClaude: true,
    allowCanonExtraction: true,
    allowAnalyze: true,
    allowReconstruction: true,
    allowImprove: true,
    allowGameDev: true // Game Bible + Production Plan
  } // dev/testing plan
};

function getPlanBudget(plan) {
  return PLAN_BUDGETS[plan] || PLAN_BUDGETS.free;
}

module.exports = { PLAN_BUDGETS, getPlanBudget };
