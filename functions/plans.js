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

// A paid subscription that opens the ✦ gates: active, or past_due — Lemon Squeezy is still retrying the card (its grace
// period; the plan is kept, lemon.js). paused / unpaid already moved the plan to free; cancelled-but-paid stays 'active'.
const LIVE_SUBSCRIPTION = ['active', 'past_due'];
function subscriptionActive(user) {
  return LIVE_SUBSCRIPTION.includes((user || {}).subscriptionStatus);
}

module.exports = { PLAN_BUDGETS, getPlanBudget, subscriptionActive, LIVE_SUBSCRIPTION };
