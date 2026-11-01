// ============================================================================
// Plans — budgets & feature gates (server), derived from paid-features.js
// ============================================================================
// paid-features.js is the single source of truth (plans, prices, which plan unlocks what).
// Plan changes happen ONLY via payment webhooks — never from the client.

const { PLANS, planBudget } = require('./paid-features.js');

const PLAN_BUDGETS = Object.fromEntries(Object.keys(PLANS).map((id) => [id, planBudget(id)]));

function getPlanBudget(plan) {
  return PLAN_BUDGETS[plan] || PLAN_BUDGETS.free;
}

module.exports = { PLAN_BUDGETS, getPlanBudget };
