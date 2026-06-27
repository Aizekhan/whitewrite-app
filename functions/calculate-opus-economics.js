// Calculate Opus economics for worldbuilder plan
// Claude Opus pricing: https://www.anthropic.com/pricing

const CLAUDE_PRICING = {
  opus: {
    input: 15.00,   // $15 per 1M input tokens
    output: 75.00   // $75 per 1M output tokens
  },
  sonnet: {
    input: 3.00,    // $3 per 1M input tokens
    output: 15.00   // $15 per 1M output tokens
  }
};

const WORLDBUILDER_PLAN = {
  price: 69,           // $69/month
  tokensMonthly: 180000 // 180K WhiteWrite tokens
};

// WhiteWrite token → API token conversion
// Assumption: 1 scene = 300 WW tokens, ~700 words output, ~1500 output tokens
const SCENE_COST_WW_TOKENS = 300;
const SCENE_OUTPUT_API_TOKENS = 1500; // ~700 words Ukrainian text
const SCENE_INPUT_API_TOKENS = 500;   // Canon context + prompt

// Calculate max scenes per month
const maxScenes = Math.floor(WORLDBUILDER_PLAN.tokensMonthly / SCENE_COST_WW_TOKENS);

console.log('=== WorldBuilder Plan Economics ===\n');
console.log('Plan price: $' + WORLDBUILDER_PLAN.price + '/month');
console.log('WhiteWrite tokens: ' + WORLDBUILDER_PLAN.tokensMonthly.toLocaleString());
console.log('Max scenes/month: ' + maxScenes + ' scenes\n');

// Scenario 1: User generates MAX scenes (600 scenes/month)
console.log('--- Scenario 1: Heavy User (max scenes) ---');
const totalInputTokens = maxScenes * SCENE_INPUT_API_TOKENS;
const totalOutputTokens = maxScenes * SCENE_OUTPUT_API_TOKENS;

const opusCostInput = (totalInputTokens / 1_000_000) * CLAUDE_PRICING.opus.input;
const opusCostOutput = (totalOutputTokens / 1_000_000) * CLAUDE_PRICING.opus.output;
const opusCostTotal = opusCostInput + opusCostOutput;

console.log('Input tokens: ' + totalInputTokens.toLocaleString() + ' → $' + opusCostInput.toFixed(2));
console.log('Output tokens: ' + totalOutputTokens.toLocaleString() + ' → $' + opusCostOutput.toFixed(2));
console.log('Total API cost (Opus): $' + opusCostTotal.toFixed(2));
console.log('Revenue: $' + WORLDBUILDER_PLAN.price);
console.log('Margin: $' + (WORLDBUILDER_PLAN.price - opusCostTotal).toFixed(2) + ' (' + ((1 - opusCostTotal / WORLDBUILDER_PLAN.price) * 100).toFixed(1) + '%)\n');

// Scenario 2: Typical user (50% usage)
console.log('--- Scenario 2: Typical User (50% usage) ---');
const typicalScenes = Math.floor(maxScenes * 0.5);
const typicalInputTokens = typicalScenes * SCENE_INPUT_API_TOKENS;
const typicalOutputTokens = typicalScenes * SCENE_OUTPUT_API_TOKENS;

const typicalOpusCostInput = (typicalInputTokens / 1_000_000) * CLAUDE_PRICING.opus.input;
const typicalOpusCostOutput = (typicalOutputTokens / 1_000_000) * CLAUDE_PRICING.opus.output;
const typicalOpusCostTotal = typicalOpusCostInput + typicalOpusCostOutput;

console.log('Scenes: ' + typicalScenes);
console.log('Total API cost (Opus): $' + typicalOpusCostTotal.toFixed(2));
console.log('Margin: $' + (WORLDBUILDER_PLAN.price - typicalOpusCostTotal).toFixed(2) + ' (' + ((1 - typicalOpusCostTotal / WORLDBUILDER_PLAN.price) * 100).toFixed(1) + '%)\n');

// Scenario 3: Compare with Sonnet
console.log('--- Scenario 3: Sonnet vs Opus (max usage) ---');
const sonnetCostInput = (totalInputTokens / 1_000_000) * CLAUDE_PRICING.sonnet.input;
const sonnetCostOutput = (totalOutputTokens / 1_000_000) * CLAUDE_PRICING.sonnet.output;
const sonnetCostTotal = sonnetCostInput + sonnetCostOutput;

console.log('Sonnet cost: $' + sonnetCostTotal.toFixed(2) + ' → margin $' + (WORLDBUILDER_PLAN.price - sonnetCostTotal).toFixed(2) + ' (' + ((1 - sonnetCostTotal / WORLDBUILDER_PLAN.price) * 100).toFixed(1) + '%)');
console.log('Opus cost: $' + opusCostTotal.toFixed(2) + ' → margin $' + (WORLDBUILDER_PLAN.price - opusCostTotal).toFixed(2) + ' (' + ((1 - opusCostTotal / WORLDBUILDER_PLAN.price) * 100).toFixed(1) + '%)');
console.log('Delta: $' + (opusCostTotal - sonnetCostTotal).toFixed(2) + ' more expensive\n');

// Risk assessment
console.log('=== Risk Assessment ===');
if (opusCostTotal > WORLDBUILDER_PLAN.price) {
  console.log('🔴 LOSS: Heavy users will cost more than revenue!');
} else if ((WORLDBUILDER_PLAN.price - opusCostTotal) / WORLDBUILDER_PLAN.price < 0.3) {
  console.log('⚠️  LOW MARGIN: <30% margin on heavy users');
} else {
  console.log('✅ SAFE: Positive margin even on heavy users');
}
