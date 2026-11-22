// Setup guides per engine (functions/setup-guides.js): the default profile (generic, or none given) gets an engine-neutral setup;
// the Unity setup and the Unity checks (unity_env, knowledge) only for a Unity profile (rpg-framework, unity); Roblox has its own.
// Run: npm test
const G = require('../functions/setup-guides.js');

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const UNITY = /Unity\.CLI|Unity 6|unity auth login|get_guide \{topic:"unity_env"\}|get_guide \{topic:"knowledge"\}/;

const gen = G.guide('setup').markdown, gen2 = G.guide('setup', 'generic').markdown;
check(gen, gen2, 'no engine = generic');
check(UNITY.test(gen), false, 'the generic setup has no Unity CLI / Unity 6 / unity_env / knowledge steps');
check(gen.indexOf(G.SESSION_RULE) >= 0 && /submit_change_request/.test(gen) && /activity_log/.test(gen) && /get_next_task/.test(gen), true, 'the generic setup keeps the session rule, the log, the rules and the first task');
check(UNITY.test(G.guide('setup', 'rpg-framework').markdown) && UNITY.test(G.guide('setup', 'unity').markdown), true, 'a Unity profile keeps the Unity setup');
check(UNITY.test(G.guide('setup', 'roblox').markdown), false, 'Roblox: no Unity steps');
check(G.guide('setup', 'some-new-engine').markdown, gen, 'an unknown profile gets the generic setup');
['unity_env', 'knowledge'].forEach((t) => {
  [undefined, 'generic', 'roblox', 'godot'].forEach((e) => check(/do not apply/.test(G.guide(t, e).markdown), true, `${t} is refused for ${e || 'no engine'}`));
  ['rpg-framework', 'unity'].forEach((e) => check(/do not apply/.test(G.guide(t, e).markdown), false, `${t} is given to ${e}`));
});
check(G.guide('knowledge', 'rpg-framework').schema_version, G.KNOWLEDGE_SCHEMA, 'knowledge keeps its schema version');
check(!!G.guide('activity_log') && !!G.guide('activity_log', 'roblox'), true, 'the activity log is for every engine');
// 💬 v2.148.3: the agents' CLAUDE.md block — every engine, its own marker, asked for by the session rule and the setups
const agb = G.guide('agents', 'roblox');
check(!!agb && agb.schema_version === 'whitewrite.agents/7' && agb.markdown.indexOf('whitewrite.agents/7') > 0 && /get_agent_inbox/.test(agb.markdown) && /approval_request/.test(agb.markdown) && /resolve_approval/.test(agb.markdown), true, 'the agents block: every engine, marker, inbox, approvals');
check(G.SESSION_RULE.indexOf('whitewrite.agents/7') >= 0 && ['rpg-framework', 'roblox', 'generic'].every((e) => G.guide('setup', e).markdown.indexOf('topic:"agents"') >= 0), true, 'the session rule and every setup ask for the agents block');
check(G.guide('setupGeneric') === null && G.guide('setupRoblox') === null && G.guide('nope') === null, true, 'the per-engine setups are not topics of their own');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
