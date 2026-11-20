// 💬 Агенти (owner, v2.148): the agents of one game talk through WhiteWrite — «Геймдизайнер» (Claude in the browser / on the phone)
// and «Програміст» (Claude Code on the PC), each with its own MCP key (mcpKeys/{sha}.role), the author sees the whole talk and alone
// approves. Pure rules shared by functions/src/mcp.js (the agents' tools) and functions/src/agents.js (the author, Telegram, digest);
// the data: worlds/{w}/games/{g}/agentMessages/{id} — written by the server only (firestore.rules).

// key roles: what each key may call over MCP. A key without a role is the old one-per-game key → «Програміст» (as before)
const ROLES = ['designer', 'programmer', 'readonly'];
const roleOf = (key) => (ROLES.includes(key && key.role) ? key.role : 'programmer');
const READ = /^(get_|list_|search_|find_)/;
// «Геймдизайнер» keeps the GDD (cards, mechanics, quests, dialogues, links, files, style checks, change requests) and talks;
// it takes no tasks, reports no bugs, writes no development log, knowledge or environment
const DESIGNER_WRITE = ['save_card', 'save_mechanic', 'save_quest', 'save_dialogue', 'link_cards', 'archive_card', 'card_image_upload', 'card_file_upload',
  'card_file_confirm', 'check_style', 'submit_change_request', 'post_agent_message', 'reply_agent_message', 'resolve_approval'];
function toolAllowed(role, name) {
  if (role === 'programmer') return true;
  if (READ.test(name)) return true; // get_next_task too — without claiming (claimFor)
  return role === 'designer' && DESIGNER_WRITE.includes(name);
}
const claimFor = (role, claim) => role === 'programmer' && claim !== false; // only «Програміст» takes a task

// message types: the agents' five, the author's decision (→ the game's decision log)
const AGENT_TYPES = ['note', 'question', 'feedback', 'approval_request', 'handoff'];
const AUTHOR_TYPES = ['note', 'question', 'feedback', 'decision'];
const URGENT = ['question', 'approval_request']; // Telegram at once; the rest — the daily digest
const TEXT_MAX = 4000, REFS_MAX = 20, THREAD_AGENT_MAX = 3, CODE_TTL = 24 * 3600 * 1000;

// never a key or a token in the channel: the other agent, the team and Telegram would all see it
const SECRET = [/\bww[kiu]_[A-Za-z0-9_-]{8,}/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /\bgithub_pat_[A-Za-z0-9_]{20,}/, /\bsk-ant-[A-Za-z0-9_-]{10,}/, /\bsk-[A-Za-z0-9]{32,}/,
  /\bAKIA[0-9A-Z]{16}\b/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bxox[abpr]-[A-Za-z0-9-]{10,}/, /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/, /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\b(msy|tsk|r8)_[A-Za-z0-9]{20,}/];
const hasSecret = (s) => SECRET.some((re) => re.test(String(s || '')));

// refs: cards «c:<id>», canon «e:<id>», tasks «t:<id>», commits «commit:<sha>» (card refs → functions/card-refs.js KIND agentMessages)
function cleanRefs(a) {
  const out = [];
  (Array.isArray(a) ? a : []).forEach((x) => {
    const s = String(x == null ? '' : x).trim().slice(0, 160);
    const m = /^(c|e|t):([A-Za-z0-9_.\-]{1,120})$/.exec(s) || /^(commit):([0-9a-f]{7,40})$/i.exec(s);
    if (m && !out.includes(s)) out.push(m[1] === 'commit' ? 'commit:' + m[2].toLowerCase() : s);
  });
  return out.slice(0, REFS_MAX);
}

// a thread waits for a person after THREAD_AGENT_MAX agent messages in a row (the author's message resets it)
function threadWaits(msgs) {
  let n = 0;
  (msgs || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((m) => { n = m.from && m.from.kind === 'author' ? 0 : n + 1; });
  return n >= THREAD_AGENT_MAX;
}
// v2.149.3 (owner audit: «Чи не губляться повідомлення через ліміт трьох»): a question / approval_request still gets through a waiting thread —
// it is what the author must see — but one per agent key until the author answers in the thread (no flood)
function urgentFree(msgs, keyPrefix) {
  let free = true;
  (msgs || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((m) => {
    if (m.from && m.from.kind === 'author') free = true;
    else if (m.from && m.from.key === keyPrefix && URGENT.includes(m.type)) free = false;
  });
  return free;
}

// one message as an agent sees it (no codes, no uids)
function view(m) {
  return { id: m.id, type: m.type, text: m.text || '', from: m.from ? { kind: m.from.kind, name: m.from.label || '', role: m.from.role || '' } : null,
    thread: m.thread || m.id, reply_to: m.parent || null, refs: m.refs || [], status: m.status || 'new',
    ...(m.type === 'approval_request' ? { approval: m.approval ? { status: m.approval.status, via: m.approval.via || '', comment: m.approval.comment || '' } : { status: 'pending' } } : {}),
    at: m.at ? new Date(m.at).toISOString() : null };
}

module.exports = { ROLES, roleOf, toolAllowed, claimFor, AGENT_TYPES, AUTHOR_TYPES, URGENT, TEXT_MAX, REFS_MAX, THREAD_AGENT_MAX, CODE_TTL, hasSecret, cleanRefs, threadWaits, urgentFree, view };
