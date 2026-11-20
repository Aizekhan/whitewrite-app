// v2.150 🛎 agents that stop without asking the author: the Stop hook a project gets (setup-guides.js STOP_HOOK_JS, run for real on fake
// transcripts) and the server's silent-stop watch (agent-chat.js watchOp / silenceCfg / silenceDue, wiring in mcp.js and agents.js).
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const G = require('../functions/setup-guides.js'), AC = require('../functions/agent-chat.js');
let fails = 0; const check = (got, want, m) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS ' : 'FAIL ') + m + (ok ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)); if (!ok) fails++; };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ww-hook-')), hook = path.join(dir, 'whitewrite-stop-check.js');
fs.writeFileSync(hook, G.STOP_HOOK_JS);
const user = (t) => ({ type: 'user', message: { role: 'user', content: t } });
const result = () => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] } });
const say = (t) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: t }] } });
const tool = (name, input) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x', name, input }] } });
let n = 0;
function run(lines, extra) {
  const tp = path.join(dir, 't' + (n++) + '.jsonl');
  fs.writeFileSync(tp, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ session_id: 's', transcript_path: tp, hook_event_name: 'Stop', stop_hook_active: false, ...(extra || {}) }), encoding: 'utf8' });
  if (r.status !== 0) return 'exit ' + r.status + ' ' + r.stderr;
  return r.stdout.trim() ? JSON.parse(r.stdout).decision : 'stop';
}
const P = 'mcp__whitewrite__';
check(run([user('зроби M5'), tool(P + 'save_card', {}), result(), say('Готово. Чекаю на ваше рішення щодо балансу.')]), 'block', 'waits for the author, nothing posted → block');
check(run([user('зроби M5'), tool(P + 'post_agent_message', { type: 'question', text: '?' }), result(), say('Питання в WhiteWrite. Чекаю.')]), 'stop', 'a question posted this turn → may stop');
check(run([user('go'), tool(P + 'post_agent_message', { type: 'approval_request', text: '?' }), result(), say('Waiting for the author.')]), 'stop', 'an approval_request posted → may stop');
check(run([user('go'), tool(P + 'post_agent_message', { type: 'note', text: 'fyi' }), result(), say('Очікую рішення автора.')]), 'block', 'a note is not a question → block');
check(run([user('go'), tool(P + 'report_blocker', { task_id: 't1', reason: 'r' }), result(), say('Чекаю.')]), 'stop', 'report_blocker → may stop');
check(run([user('go'), tool(P + 'submit_task_result', { open_questions: [] }), result(), say('Чекаю.')]), 'block', 'submit_task_result without open_questions → block');
check(run([user('go'), tool(P + 'submit_task_result', { open_questions: ['Q?'] }), result(), say('Чекаю.')]), 'stop', 'submit_task_result with open_questions → may stop');
check(run([user('go'), say('Готово, M5 закомічено.')]), 'stop', 'no waiting words → may stop');
check(run([user('go'), say('Працював, чекаючи на збірку.')]), 'stop', 'whole words only («чекаючи» ≠ «чекаю»)');
check(run([user('go'), say('Чекаю відповіді.')], { stop_hook_active: true }), 'stop', 'the second stop in a row passes');
check(run([user('a'), tool(P + 'post_agent_message', { type: 'question' }), result(), say('Чекаю.'), user('b'), say('Знову чекаю на ваше рішення.')]), 'block', 'a question of an earlier turn does not count');
check(run([user('a'), say('Чекаю.')], { last_assistant_message: 'Готово.' }), 'stop', 'last_assistant_message (when given) is the answer checked');
check(spawnSync(process.execPath, [hook], { input: '{}', encoding: 'utf8' }).status + '|' + spawnSync(process.execPath, [hook], { input: '{}', encoding: 'utf8' }).stdout, '0|', 'no transcript → exit 0, silent');
check(/wwk_|Bearer|https?:\/\//.test(G.STOP_HOOK_JS), false, 'the hook holds no keys and calls nothing');
fs.rmSync(dir, { recursive: true, force: true });

// the guides hand it out
const sh = G.guide('stop_hook');
check(sh.schema_version === 'whitewrite.stophook/1' && sh.markdown.indexOf(G.STOP_HOOK_JS.trim().split('\n')[1]) > 0 && /only ADD the entry to `hooks.Stop`/.test(sh.markdown) && sh.markdown.indexOf('$CLAUDE_PROJECT_DIR/.claude/hooks/whitewrite-stop-check.js') > 0, true, 'get_guide stop_hook: the file, the settings entry, append only');
check(['rpg-framework', 'roblox', 'generic'].every((e) => /topic:"stop_hook"/.test(G.guide('setup', e).markdown)) && /topic:"stop_hook"/.test(G.guide('agents').markdown) && /stop_hook/.test(G.SESSION_RULE), true, 'setup (every engine), agents and the session rule point at it');

// the server's watch
check(['save_card', 'get_next_task', 'report_blocker', 'submit_task_result', 'submit_development_activity', 'get_agent_inbox', 'resolve_approval'].map((t) => AC.watchOp(t, {})), ['arm', 'arm', 'report', 'report', 'report', 'quiet', 'quiet'], 'watchOp: work arms, a report disarms, reading answers is quiet');
check(['question', 'approval_request', 'handoff', 'note', 'feedback'].map((t) => AC.watchOp('post_agent_message', { type: t })), ['report', 'report', 'report', 'quiet', 'quiet'], 'watchOp: question / approval_request / handoff are reports');
check([AC.silenceCfg({}), AC.silenceCfg({ agentSilence: { on: false, min: 1 } }), AC.silenceCfg({ agentSilence: { min: 500 } })], [{ on: true, min: 10 }, { on: false, min: 2 }, { on: true, min: 120 }], 'silenceCfg: on, 10 by default, clamped 2–120');
const T0 = 1e12;
check([AC.silenceDue(T0, 10, T0 + 9 * 60000), AC.silenceDue(T0, 10, T0 + 10 * 60000), AC.silenceDue(T0, 10, T0 + 71 * 60000)], ['', 'due', 'stale'], 'silenceDue: quiet N min → due; far too old → stale (no message)');
const mcp = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8'), ag = fs.readFileSync(path.join(__dirname, '../functions/src/agents.js'), 'utf8');
check(/watchKey\(key, params\.name/.test(mcp) && /key\.via === 'oauth' \|\| key\.inPath \|\| AC\.roleOf\(key\) === 'readonly'/.test(mcp), true, 'mcp: every tool call goes through watchKey; claude.ai chats and read-only keys are not watched');
check(/exports\.agentSilenceWatch = onSchedule\(\{ schedule: 'every 2 minutes'/.test(ag) && /x\.watchLast !== k\.watchLast/.test(ag) && /type: 'silent_stop'/.test(ag) && /tellAuthor\(G\.gref/.test(ag), true, 'agents: the sweep claims once per session, writes «silent_stop» and tells Telegram');
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
