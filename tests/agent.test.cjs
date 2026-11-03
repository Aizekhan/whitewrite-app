// Агент White (functions/src/agent.js + app/agent-white.js): the conversation the server accepts, every server tool has a page
// handler, the step price is a bounded «не більше N», the rules of «what goes where» are in the prompt. Run: npm test
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '../functions');
const Module = require('module');
const orig = Module._load; // agent.js pulls Firebase through common.js — the pure parts are tested without it
Module._load = function (req, parent, isMain) {
  if (/[\\/]common$/.test(req) || req === './common') return { onRequest: () => () => {}, claudeApiKey: {} };
  if (req === './team') return { _team: {} };
  if (req === './claude') return {};
  return orig.apply(this, arguments);
};
const { _agent } = require(path.join(F, 'src', 'agent.js'));
Module._load = orig;
const P = require(path.join(F, 'paid-features.js'));
const page = fs.readFileSync(path.join(__dirname, '../app/agent-white.js'), 'utf8');

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const C = _agent.cleanMessages;

check(!!C([{ role: 'user', content: 'hi' }]), 'a plain first message is accepted');
check(!!C([{ role: 'user', content: 'hi' }, { role: 'assistant', content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 't', name: 'kb_search', input: {} }] },
  { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: 'x' }] }]), 'thinking, tool_use and tool_result blocks pass unchanged');
check(!C([{ role: 'assistant', content: 'x' }]), 'the first message must be the author’s');
check(!C([{ role: 'system', content: 'x' }]), 'no system role from the page');
check(!C([{ role: 'user', content: [{ type: 'image', source: {} }] }]), 'no other block types (images, documents)');
check(!C([]) && !C(null) && !C(Array(121).fill({ role: 'user', content: 'x' })), 'empty / too many messages are refused');

_agent.TOOLS.forEach((t) => check(page.indexOf('"' + t.name + '"') >= 0, `the page runs the tool ${t.name}`));
check(_agent.TOOLS.every((t) => t.input_schema && t.input_schema.type === 'object'), 'every tool has an object schema');

const f = P.byOp('agentWhite');
const small = P.quoteChars(f, 20000, 'sonnet'), big = P.quoteChars(f, 400000, 'sonnet');
check(small > 0 && big > small, `the step price grows with the conversation (${small} → ${big})`);
check(P.quoteChars(f, 20000, 'haiku') < small && P.quoteChars(f, 20000, 'opus') > small, 'Haiku < Sonnet < Opus');
check(P.planBudget('free').allowAgent === false && P.planBudget('storyteller').allowAgent === true, 'from Storyteller');

const sys = _agent.systemText('uk');
check(sys.indexOf('whitewrite.fill/1') >= 0 && sys.indexOf('NOT a faction') >= 0, 'the prompt carries the fill template and the «what goes where» rules');
check(/Ukrainian/.test(sys) && /English/.test(_agent.systemText('en')), 'answers in the author’s language');
check(_agent.systemText('uk') === _agent.systemText('uk') && !/\d{4}-\d{2}-\d{2}/.test(sys), 'the system prompt is stable (cached prefix, no dates)');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
