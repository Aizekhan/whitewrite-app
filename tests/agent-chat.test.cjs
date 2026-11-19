// 💬 Агенти (v2.148): key roles (functions/agent-chat.js), the agents' messages over MCP (mcp.js agentPost / agentInbox / agentResolve on an
// in-memory Firestore), and the wiring — roles filter tools/list and tools/call, only «Програміст» claims a task, the author alone approves
// (agents.js), the channel is server-written (firestore.rules). Run: npm test
const fs = require('fs'), path = require('path');
const AC = require('../functions/agent-chat.js');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const agents = fs.readFileSync(path.join(__dirname, '../functions/src/agents.js'), 'utf8');
const rules = fs.readFileSync(path.join(__dirname, '../firestore.rules'), 'utf8');

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

// ---- roles
check(AC.roleOf({}), 'programmer', 'an old key without a role is «Програміст»');
check(AC.roleOf({ role: 'designer' }), 'designer', 'a designer key');
check(AC.roleOf({ role: 'admin' }), 'programmer', 'an unknown role falls back to «Програміст»');
check(['get_card', 'find_cards', 'get_next_task', 'get_agent_inbox'].every((t) => AC.toolAllowed('readonly', t)), true, 'read only: reads (and the inbox)');
check(['save_card', 'post_agent_message', 'report_bug', 'submit_task_result'].some((t) => AC.toolAllowed('readonly', t)), false, 'read only: writes nothing');
check(['save_card', 'save_mechanic', 'link_cards', 'post_agent_message', 'reply_agent_message', 'submit_change_request'].every((t) => AC.toolAllowed('designer', t)), true, 'designer: the GDD and the messages');
check(['report_task_progress', 'submit_task_result', 'report_blocker', 'report_bug', 'submit_development_activity', 'submit_project_knowledge'].some((t) => AC.toolAllowed('designer', t)), false, 'designer: no tasks, bugs, log or knowledge');
check(['submit_task_result', 'report_bug', 'save_card', 'post_agent_message'].every((t) => AC.toolAllowed('programmer', t)), true, 'programmer: everything');
check(AC.claimFor('programmer', undefined) && !AC.claimFor('programmer', false) && !AC.claimFor('designer', true) && !AC.claimFor('readonly', true), true, 'only «Програміст» takes a task');

// ---- secrets, refs, the thread limit
check(['wwk_abcdEFGH1234', 'ghp_' + 'a'.repeat(30), 'github_pat_' + 'b'.repeat(30), 'sk-ant-api03-xxxxxxxxxxxx', '123456789:' + 'A'.repeat(35), '-----BEGIN RSA PRIVATE KEY-----'].every(AC.hasSecret), true, 'keys and tokens are caught');
check(AC.hasSecret('Changed the dash to 0.3 s, see c:dash and commit:abc1234'), false, 'a normal message passes');
check(AC.cleanRefs(['c:dash', 'e:hero', 't:G1.2', 'commit:ABC1234', 'c:dash', 'http://x', 'c:../../x']).join(), 'c:dash,e:hero,t:G1.2,commit:abc1234', 'refs: cards, canon, tasks, commits — unique, nothing else');
const ag = (at) => ({ at, from: { kind: 'agent' } }), au = (at) => ({ at, from: { kind: 'author' } });
check(AC.threadWaits([ag(1), ag(2)]), false, 'two agent messages: the thread goes on');
check(AC.threadWaits([ag(1), ag(2), ag(3)]), true, 'three in a row: the thread waits for a person');
check(AC.threadWaits([ag(1), ag(2), au(3), ag(4)]), false, 'the author\'s message resets the count');
check(AC.threadWaits([ag(3), ag(1), au(2)]), false, 'counted in time order');

// ---- agentPost / agentInbox / agentResolve on an in-memory Firestore
const pick = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));
const store = {}; let seq = 0;
const merge = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && v.__union ? Array.from(new Set((o[k] || []).concat(v.__union))) : v; return o; };
const docRef = (id) => ({ id, get: async () => ({ exists: !!store[id], id, data: () => store[id] }), set: async (d, o) => { store[id] = o && o.merge ? merge(store[id] || {}, d) : { ...d }; } });
const all = () => Object.keys(store).map((id) => ({ id, data: () => store[id] }));
const col = { doc: (id) => docRef(id || 'm' + (++seq)), where: (f, op, v) => ({ get: async () => ({ docs: all().filter((d) => d.data()[f] === v) }) }),
  orderBy: () => ({ limit: () => ({ get: async () => ({ docs: all().sort((a, b) => b.data().at - a.data().at) }) }) }) };
const admin = { firestore: { FieldValue: { serverTimestamp: () => 'TS', arrayUnion: (...x) => ({ __union: x }) } } };
const db = { batch: () => { const ops = []; return { set: (r, d, o) => ops.push(() => r.set(d, o)), commit: async () => { for (const f of ops) await f(); } }; } };
let approved = null, notified = [];
const AGENTS = { notify: async (g, w, gm, m) => { notified.push(m.type); return false; }, checkCode: async (g, id, code) => code === '123456', applyApproval: async (g, id, o) => { approved = { id, ...o }; store[id].approval = { status: o.approve ? 'approved' : 'rejected', via: o.via }; store[id].readBy = []; } };
const M = new Function('admin', 'db', 'AC', 'AGENTS', 'require',
  "const ts = () => 'TS'; const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);\nfunction rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }\nasync function logExecution() {}\n" +
  pick('const ROLE_NAME =', '// ---------- JSON-RPC') + '\nreturn { agentPost, agentInbox, agentResolve, agentUnread, agentIntro };')(admin, db, AC, AGENTS, require);
const ctx = { gref: { collection: () => col }, world: { owner: 'u1' }, game: { title: 'Morra' } };
const designer = { prefix: 'wwk_designer', label: 'Claude у браузері', role: 'designer' }, coder = { prefix: 'wwk_coder01', label: 'Claude Code на ПК' };
(async () => {
  const q = await M.agentPost(ctx, designer, { type: 'question', text: 'Dash 0.3 s or 0.4 s?', refs: ['c:dash'] });
  check(store[q.id].from.role + '|' + store[q.id].from.label + '|' + store[q.id].thread, 'designer|Claude у браузері|' + q.id, 'a message carries its key\'s name and role and opens its thread');
  check(notified.join(), 'question', 'a question goes to the author\'s Telegram');
  check(await M.agentUnread(ctx, designer), 0, 'one\'s own message is not news');
  let inbox = await M.agentInbox(ctx, coder, {});
  check(inbox.unread + '|' + inbox.messages[0].text + '|' + inbox.messages[0].from.role, '1|Dash 0.3 s or 0.4 s?|designer', 'the other agent sees it');
  check(store[q.id].status, 'read', 'read by the other agent');
  check((await M.agentInbox(ctx, coder, {})).unread, 0, 'read once: not unread again');
  let err = '';
  try { await M.agentPost(ctx, coder, { type: 'decision', text: 'x' }); } catch (e) { err = e.message; }
  check(/author's alone/.test(err), true, 'an agent cannot post a decision');
  try { await M.agentPost(ctx, coder, { type: 'note', text: 'my key wwk_abcdefgh123' }); } catch (e) { err = e.message; }
  check(/key or a token/.test(err), true, 'a message with a key is refused');
  await M.agentPost(ctx, coder, { type: 'note', text: '0.3 s' }, q.id);
  check(store[q.id].status, 'answered', 'a reply marks the question answered');
  await M.agentPost(ctx, designer, { type: 'note', text: 'ok' }, q.id);
  err = '';
  try { await M.agentPost(ctx, coder, { type: 'note', text: 'one more' }, q.id); } catch (e) { err = e.message; }
  check(/waits for the author/.test(err), true, 'the 4th agent message in a row is refused — the thread waits for a person');
  store['a1'] = { type: 'note', text: 'Go with 0.3', thread: q.id, parent: '', from: { kind: 'author', label: 'Автор', role: 'owner' }, status: 'new', readBy: [], at: Date.now() + 10 };
  await M.agentPost(ctx, coder, { type: 'note', text: 'done' }, q.id);
  check(true, true, 'after the author\'s message the agents may write again');
  // approval
  const ap = await M.agentPost(ctx, coder, { type: 'approval_request', text: 'Delete the old combat system?' });
  check(store[ap.id].approval.status, 'pending', 'an approval request starts pending');
  check((await M.agentInbox(ctx, coder, {})).waiting_for_author[0].id, ap.id, 'the asker sees it waiting for the author');
  err = '';
  try { await M.agentResolve(ctx, designer, { message_id: ap.id, approve: true, author_words: 'так' }); } catch (e) { err = e.message; }
  check(/Only the author approves/.test(err) && !approved, true, 'no code — no approval');
  try { await M.agentResolve(ctx, designer, { message_id: ap.id, approve: true, code: '000000', author_words: 'так' }); } catch (e) { err = e.message; }
  check(/does not match/.test(err) && !approved, true, 'a wrong code — no approval');
  await M.agentResolve(ctx, designer, { message_id: ap.id, approve: true, code: '123456', author_words: 'так, код 123456' });
  check(approved && approved.via + '|' + approved.words, 'claude|так, код 123456', 'the author\'s code and words: approved «through Claude»');
  inbox = await M.agentInbox(ctx, coder, {});
  check(inbox.messages.some((m) => m.id === ap.id && m.approval.status === 'approved'), true, 'the asker gets the decision in its inbox');
  check(/role designer/.test(M.agentIntro(designer)) && /get_agent_inbox/.test(M.agentIntro(coder)) && /role programmer/.test(M.agentIntro(coder)), true, 'initialize tells the key its role and the inbox rule');

  // ---- wiring
  ['get_agent_inbox', 'post_agent_message', 'reply_agent_message', 'resolve_approval'].forEach((t) => check(new RegExp("^  \\{ name: '" + t + "'", 'm').test(src) && src.includes("case '" + t + "'"), true, `MCP tool ${t}`));
  check(/TOOLS\.filter\(\(t\) => AC\.toolAllowed\(role, t\.name\)/.test(src), true, 'tools/list shows a key only its role\'s tools');
  check(/if \(!AC\.toolAllowed\(role, params\.name/.test(src), true, 'tools/call refuses a tool outside the role');
  check(/AC\.claimFor\(AC\.roleOf\(key\), args\.claim\)/.test(src), true, 'get_next_task claims only for «Програміст»');
  check(/x\.agentKey === key\.prefix/.test(src), true, 'get_updates hides only this key\'s own writes (another agent\'s are news)');
  check(/op === 'resolve'\) \{\s*onlyOwner\(\);/.test(agents), true, 'in the Bible only the owner approves');
  check(/l\.data\(\)\.tgId !== cq\.from\.id/.test(agents) && /ad\.used \|\| ad\.exp < Date\.now\(\)/.test(agents), true, 'a Telegram button counts only from the owner\'s Telegram, once, within 24 h');
  check(/X-Telegram-Bot-Api-Secret-Token/.test(agents), true, 'the webhook checks Telegram\'s secret header');
  check(/AC\.hasSecret\(text\)/.test(agents), true, 'the author\'s messages are checked for keys too');
  check(/sub == 'agentMessages' \? 'agents'/.test(rules) && !/sub in \[[^\]]*'agentMessages'[^\]]*\] && ownerGameDev/.test(rules), true, 'agentMessages: read by the section «agents», written by the server only');
  ['tgLinks', 'tgLinkTokens', 'agentTg', 'agentApprovals', 'agentDigestQueue'].forEach((c) => check(new RegExp('match /' + c + '/\\{id\\} \\{ allow read, write: if false; \\}').test(rules), true, `${c} is server only`));
  check(/'role'\]\) &&\s*\/\/[^\n]*\n\s*request\.resource\.data\.get\('role', 'programmer'\) in \['designer', 'programmer', 'readonly'\]/.test(rules), true, 'a key\'s role is one of three');

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
