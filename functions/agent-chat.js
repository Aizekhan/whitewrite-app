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
  'card_file_confirm', 'check_style', 'submit_change_request', 'post_agent_message', 'reply_agent_message', 'resolve_approval', 'record_author_decision', 'resolve_divergence', 'review_task', 'answer_plan_question'];
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
  return { id: m.id, type: m.type, text: m.text || '', from: m.from ? { kind: m.from.kind, name: m.from.label || '', role: m.from.role || '', ...(m.from.via ? { via: m.from.via } : {}) } : null,
    ...(m.options && m.options.length ? { options: m.options } : {}),
    thread: m.thread || m.id, reply_to: m.parent || null, refs: m.refs || [], status: m.status || 'new',
    ...(m.type === 'approval_request' ? { approval: m.approval ? { status: m.approval.status, via: m.approval.via || '', comment: m.approval.comment || '' } : { status: 'pending' } } : {}),
    at: m.at ? new Date(m.at).toISOString() : null };
}

// v2.150 the silent-stop watch (owner: «зупинки агентів без питання до автора ловив сам WhiteWrite, а не лише інструкція»):
// a key's tool call arms it; a report to the author disarms it; agentSilenceWatch (agents.js) tells the author after N quiet minutes.
const SILENCE = { DEF: 10, MIN: 2, MAX: 120, STALE: 60, GRACE: 30 }; // GRACE (v2.156): the work right after a report is the wrap-up, not a stop // minutes; past N + STALE the session is too old to report (the watch was down)
const REPORT_TYPES = ['question', 'approval_request', 'handoff'];
// 'report' — the author was told (disarms) · 'quiet' — reading the answers / deciding, it neither arms nor disarms · 'arm' — work
function watchOp(name, args) {
  args = args || {};
  // v2.156 (the game-designer agent: «хибні тривоги 5–6 за день, хоча звіти були»): an answer in «💬 Агенти», the author's instruction / decision
  // recorded (the author is right there in the terminal) and a checked task are reports too
  if (['report_blocker', 'submit_development_activity', 'submit_task_result', 'reply_agent_message', 'record_author_instruction', 'record_author_decision', 'verify_task'].includes(name)) return 'report';
  if (name === 'post_agent_message') return REPORT_TYPES.includes(args.type) ? 'report' : 'quiet';
  if (name === 'get_agent_inbox' || name === 'resolve_approval') return 'quiet';
  return 'arm';
}
// games/{g}.agentSilence = { on, min }: on by default, N clamped
function silenceCfg(game) {
  const c = (game && game.agentSilence) || {}, n = Math.round(Number(c.min));
  return { on: c.on !== false, min: Number.isFinite(n) && n > 0 ? Math.min(SILENCE.MAX, Math.max(SILENCE.MIN, n)) : SILENCE.DEF };
}
// due = quiet long enough and not too old; stale = clear without a word
function silenceDue(lastMs, min, now, reportAt) {
  const quiet = now - (lastMs || 0);
  if (quiet < min * 60000) return '';
  if (reportAt && (lastMs || 0) - reportAt < SILENCE.GRACE * 60000) return 'stale'; // it reported shortly before going quiet: no alarm
  return quiet >= (min + SILENCE.STALE) * 60000 ? 'stale' : 'due';
}

// v2.151 (owner): answer options a question may carry → Telegram buttons (callback_data stays short, the text is read from the message)
const OPT_MAX = 4, OPT_LEN = 40;
function cleanOptions(a) { return (Array.isArray(a) ? a : []).map((x) => String(x == null ? '' : x).replace(/\s+/g, ' ').trim().slice(0, OPT_LEN)).filter(Boolean).slice(0, OPT_MAX); }
// a repeated question (owner: «те саме питання прийшло двічі»): the words of 4+ letters, Jaccard; the KrumaTD pair 04:05 / 04:13 = 0.53
const DUP_MIN = 0.45, DUP_HOURS = 24;
const words = (t) => new Set(String(t || '').toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []);
function similar(a, b) { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let i = 0; A.forEach((x) => { if (B.has(x)) i++; }); return i / (A.size + B.size - i); }
// the agent's own unanswered question / approval request of the same type, asked within DUP_HOURS, that says nearly the same
function duplicateOf(msgs, type, text, keyPrefix, now) {
  return (msgs || []).filter((m) => m.type === type && m.from && m.from.key === keyPrefix && ['new', 'read'].includes(m.status || 'new') && (now - (m.at || 0)) < DUP_HOURS * 3600000 &&
    (type !== 'approval_request' || !m.approval || m.approval.status === 'pending') && similar(m.text, text) >= DUP_MIN).sort((x, y) => (y.at || 0) - (x.at || 0))[0] || null;
}

module.exports = { OPT_MAX, OPT_LEN, cleanOptions, DUP_MIN, similar, duplicateOf, SILENCE, watchOp, silenceCfg, silenceDue, ROLES, roleOf, toolAllowed, claimFor, AGENT_TYPES, AUTHOR_TYPES, URGENT, TEXT_MAX, REFS_MAX, THREAD_AGENT_MAX, CODE_TTL, hasSecret, cleanRefs, threadWaits, urgentFree, view };
