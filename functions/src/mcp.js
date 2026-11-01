// MCP server: the executor channel between WhiteWrite (the brain) and Claude Code (the hands) working in the Unity repo.
// Transport: MCP Streamable HTTP, stateless — every POST carries one JSON-RPC message (or a batch), answered as JSON.
// Claude Code connects with:
//   claude mcp add --transport http whitewrite https://us-central1-whitewrite-app.cloudfunctions.net/mcp --header "Authorization: Bearer wwk_..."
// The key (made in the Game Bible) is scoped to ONE game; only its sha256 is stored (mcpKeys/{sha256}).
// The executor reads the game and its tasks, claims the next ready task, reports progress / blockers / results and
// proposes change requests. It never edits the bible or the canon: the author reviews every result in the Game Bible.
const crypto = require('crypto');
const { onRequest, admin, db, getPlanBudget } = require('./common');

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const OPEN = ['todo', 'rework'];
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const list = (a, n, f) => (Array.isArray(a) ? a : []).map(f).filter((x) => x != null && x !== '').slice(0, n);

// ---------- tools ----------
const TOOLS = [
  { name: 'get_project_overview', description: 'The game this key belongs to: world canon and laws, GDD summary, decisions, engine profile, sections, roadmap progress and the task in progress. Call this first in a session.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'list_tasks', description: 'The roadmap: every task with id, milestone, status (todo | in_progress | review | rework | blocked | done), deps and whether it is ready.',
    inputSchema: { type: 'object', properties: { status: { type: 'string', description: 'Only tasks with this status' } } } },
  { name: 'get_next_task', description: 'The task to work on now with its full context (cards, files, acceptance criteria, history). Resumes a task already in progress or returned for rework; otherwise claims the first ready task (all deps done) and marks it in_progress.',
    inputSchema: { type: 'object', properties: { claim: { type: 'boolean', description: 'Mark the returned task in_progress (default true)' } } } },
  { name: 'get_task_details', description: 'Full context of one task by id (e.g. "M2.3"): goal, detail, acceptance criteria, tests, related cards with fields and file URLs, deps, review history.',
    inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'get_design_section', description: 'All cards of one Game Bible section (e.g. mechanics, assets, materials, audio, ui, tech, characters, locations): fields, status and files.',
    inputSchema: { type: 'object', properties: { section: { type: 'string' } }, required: ['section'] } },
  { name: 'get_card', description: 'One card by ref: "c:<cardId>" (game card) or "e:<entityId>" (canon entity seen through this game). Files carry download URLs (models, textures, images).',
    inputSchema: { type: 'object', properties: { ref: { type: 'string' } }, required: ['ref'] } },
  { name: 'report_task_progress', description: 'A short progress note on the task you are working on (shown live to the author).',
    inputSchema: { type: 'object', properties: { task_id: { type: 'string' }, message: { type: 'string' } }, required: ['task_id', 'message'] } },
  { name: 'report_blocker', description: 'The task cannot go on without the author (missing asset, contradiction, framework gap…). Marks it blocked.',
    inputSchema: { type: 'object', properties: { task_id: { type: 'string' }, problem: { type: 'string' }, needs: { type: 'string', description: 'What exactly would unblock it' } }, required: ['task_id', 'problem'] } },
  { name: 'submit_task_result', description: 'Hand in a finished task for the author\'s review: what was done, files changed, tests run, and each acceptance criterion with evidence. The task goes to review; the author accepts it or returns it with comments.',
    inputSchema: { type: 'object', required: ['task_id', 'summary'], properties: {
      task_id: { type: 'string' }, summary: { type: 'string' },
      changes: { type: 'array', items: { type: 'string' }, description: 'Changed files / assets' },
      commit: { type: 'string', description: 'Git commit or branch' },
      tests: { type: 'object', properties: { ran: { type: 'boolean' }, passed: { type: 'integer' }, failed: { type: 'integer' }, output: { type: 'string' } } },
      criteria: { type: 'array', items: { type: 'object', properties: { criterion: { type: 'string' }, met: { type: 'boolean' }, evidence: { type: 'string' } } } },
    } } },
  { name: 'submit_change_request', description: 'Propose a change to an approved decision (GDD, a card, the plan, the architecture). Never change those yourself — the author decides.',
    inputSchema: { type: 'object', required: ['what', 'why'], properties: {
      task_id: { type: 'string' }, what: { type: 'string' }, why: { type: 'string' }, proposal: { type: 'string' }, impact: { type: 'string' } } } },
];

// ---------- game context ----------
async function loadGame(key) {
  const wref = db.collection('worlds').doc(key.worldId), gref = wref.collection('games').doc(key.gameId);
  const [w, g, ents, cards, plan, tasks] = await Promise.all([wref.get(), gref.get(), wref.collection('entities').get(),
    gref.collection('cards').get(), gref.collection('plan').doc('current').get(), gref.collection('tasks').get()]);
  if (!w.exists || w.data().owner !== key.uid || !g.exists) throw rpcError(-32001, 'Game not found or no access');
  return {
    wref, gref, world: w.data(), game: g.data(), plan: plan.exists ? plan.data() : {},
    entities: ents.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => !(e.origin && e.origin.confirmed === false)),
    cards: cards.docs.map((d) => ({ id: d.id, ...d.data() })),
    tasks: tasks.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)),
  };
}

const named = (c) => {
  const labels = Object.fromEntries((c.defs || []).map((d) => [d.key, d.label]));
  return Object.fromEntries(Object.entries(c.fields || {}).filter(([, v]) => str(v, 1)).map(([k, v]) => [labels[k] || k, v]));
};
const files = (c) => {
  const labels = Object.fromEntries((c.defs || []).map((d) => [d.key, d.label]));
  return (c.files || []).map((f) => ({ name: f.name, url: f.url, size: f.size, type: f.type, ...(f.field ? { field: labels[f.field] || f.field } : {}) }));
};

function cardView(ctx, ref) {
  if (ref.startsWith('e:')) {
    const e = ctx.entities.find((x) => x.id === ref.slice(2)); if (!e) return null;
    const c = ctx.cards.find((x) => x.canonRef === e.id) || {};
    return { ref, canon: e.kind, title: e.name || '', description: e.desc || e.description || '', status: c.status || 'idea',
      section: c.section || e.kind, fields: named(c), note: c.note || '', files: files(c) };
  }
  const c = ctx.cards.find((x) => x.id === ref.replace(/^c:/, '') && !x.canonRef);
  if (!c) return null;
  return { ref: 'c:' + c.id, title: c.title || '', status: c.status || 'idea', section: c.section, fields: named(c), note: c.note || '', files: files(c), planTask: c.planTask || '' };
}

function taskCards(ctx, t) {
  const refs = new Set();
  (t.cards || []).forEach((r) => {
    if (r.startsWith('new:')) {
      const c = ctx.cards.find((x) => !x.canonRef && str(x.title, 200).toLowerCase() === r.slice(4).toLowerCase());
      if (c) refs.add('c:' + c.id);
    } else refs.add(r);
  });
  ctx.cards.filter((c) => c.planTask === t.id && !c.canonRef).forEach((c) => refs.add('c:' + c.id));
  return [...refs].map((r) => cardView(ctx, r)).filter(Boolean);
}

const isReady = (ctx, t) => (t.deps || []).every((d) => { const x = ctx.tasks.find((y) => y.id === d); return !x || x.status === 'done'; });

function taskView(ctx, t) {
  const ms = ((ctx.plan.plan || {}).milestones || []).find((m) => m.id === t.milestone) || {};
  return {
    id: t.id, title: t.title, status: t.status, owner: t.owner, size: t.size,
    milestone: { id: t.milestone, name: ms.name || '', goal: ms.goal || '', gate: ms.gate || '' },
    detail: t.detail || '', instructions: t.prompt || '',
    acceptance_criteria: t.accept || [], tests: t.tests || [],
    deps: (t.deps || []).map((d) => ({ id: d, status: (ctx.tasks.find((x) => x.id === d) || {}).status || 'unknown' })),
    cards: taskCards(ctx, t),
    history: (t.history || []).slice(-10),
    rules: 'Work inside the approved design. Technical choices are yours; changing the GDD, a card, the plan or the architecture is not — use submit_change_request. ' +
      'When done, call submit_task_result with every acceptance criterion and its evidence. If you cannot go on, call report_blocker.',
  };
}

function overview(ctx) {
  const count = {};
  ctx.tasks.forEach((t) => { count[t.status] = (count[t.status] || 0) + 1; });
  const sections = {};
  ctx.cards.forEach((c) => { sections[c.section] = (sections[c.section] || 0) + 1; });
  const answers = ctx.plan.answers || {};
  return {
    game: ctx.game.title || '', engine: (ctx.game.engine && ctx.game.engine.profile) || 'generic',
    world: { title: ctx.world.title || '', tagline: ctx.world.tagline || '', summary: ctx.world.summary || '', laws: ctx.world.rules || [] },
    gdd: ctx.plan.gdd || null,
    decisions: (ctx.plan.asked || []).filter((q) => answers[q.id]).map((q) => ({ question: q.question, answer: answers[q.id] })),
    canon: ctx.entities.map((e) => ({ ref: 'e:' + e.id, kind: e.kind, name: e.name || '' })),
    sections,
    roadmap: { overview: (ctx.plan.plan || {}).overview || '', total: ctx.tasks.length, byStatus: count,
      inProgress: ctx.tasks.filter((t) => t.status === 'in_progress').map((t) => t.id) },
  };
}

// ---------- writes ----------
async function logExecution(ctx, key, type, taskId, data) {
  await ctx.gref.collection('executions').add({ type, taskId: taskId || '', data: data || {}, keyPrefix: key.prefix || '', at: ts() });
}
async function setTask(ctx, t, patch, event) {
  const upd = { ...patch, updatedAt: ts() };
  if (event) upd.history = admin.firestore.FieldValue.arrayUnion({ ...event, at: Date.now() });
  await ctx.gref.collection('tasks').doc(t.id).set(upd, { merge: true });
}
function findTask(ctx, id) {
  const t = ctx.tasks.find((x) => x.id === str(id, 32));
  if (!t) throw rpcError(-32602, `Task ${id} not found. Call list_tasks.`);
  return t;
}

async function callTool(name, args, key) {
  const ctx = await loadGame(key);
  switch (name) {
    case 'get_project_overview': return overview(ctx);
    case 'list_tasks': return ctx.tasks.filter((t) => !args.status || t.status === args.status)
      .map((t) => ({ id: t.id, milestone: t.milestone, title: t.title, status: t.status, owner: t.owner, deps: t.deps || [], ready: OPEN.includes(t.status) && isReady(ctx, t) }));
    case 'get_next_task': {
      if (!ctx.tasks.length) return { task: null, message: 'No roadmap yet: the author has to generate the production plan in the Game Bible first.' };
      const mine = ctx.tasks.find((t) => t.status === 'in_progress') || ctx.tasks.find((t) => t.status === 'rework' && isReady(ctx, t));
      const t = mine || ctx.tasks.find((x) => x.status === 'todo' && isReady(ctx, x));
      if (!t) {
        const waiting = ctx.tasks.filter((x) => ['review', 'blocked'].includes(x.status)).map((x) => `${x.id} (${x.status})`);
        return { task: null, message: ctx.tasks.every((x) => x.status === 'done') ? 'All tasks are done.' : `Nothing is ready. Waiting for the author: ${waiting.join(', ') || 'deps not done'}.` };
      }
      if (args.claim !== false && t.status !== 'in_progress') {
        await setTask(ctx, t, { status: 'in_progress', startedAt: ts() }, { type: 'claimed', by: 'claude-code' });
        await logExecution(ctx, key, 'claimed', t.id);
        t.status = 'in_progress';
      }
      return { task: taskView(ctx, t) };
    }
    case 'get_task_details': return taskView(ctx, findTask(ctx, args.task_id));
    case 'get_design_section': {
      const s = str(args.section, 60);
      const out = ctx.cards.filter((c) => c.section === s && !c.hidden).map((c) => cardView(ctx, c.canonRef ? 'e:' + c.canonRef : 'c:' + c.id)).filter(Boolean);
      if (['characters', 'locations', 'factions', 'artifacts'].includes(s)) {
        ctx.entities.filter((e) => e.kind === s && !ctx.cards.some((c) => c.canonRef === e.id)).forEach((e) => out.push(cardView(ctx, 'e:' + e.id)));
      }
      return { section: s, cards: out };
    }
    case 'get_card': {
      const c = cardView(ctx, str(args.ref, 120));
      if (!c) throw rpcError(-32602, `Card ${args.ref} not found`);
      return c;
    }
    case 'report_task_progress': {
      const t = findTask(ctx, args.task_id);
      const message = str(args.message, 2000);
      await setTask(ctx, t, { lastProgress: message }, { type: 'progress', message });
      await logExecution(ctx, key, 'progress', t.id, { message });
      return { ok: true };
    }
    case 'report_blocker': {
      const t = findTask(ctx, args.task_id);
      const blocker = { problem: str(args.problem, 3000), needs: str(args.needs, 2000) };
      await setTask(ctx, t, { status: 'blocked', blocker }, { type: 'blocked', ...blocker });
      await logExecution(ctx, key, 'blocked', t.id, blocker);
      return { ok: true, status: 'blocked', message: 'The author sees the blocker in the Game Bible. Take another task with get_next_task meanwhile.' };
    }
    case 'submit_task_result': {
      const t = findTask(ctx, args.task_id);
      if (!['in_progress', 'rework', 'blocked'].includes(t.status)) throw rpcError(-32602, `Task ${t.id} is ${t.status}; only a task in progress can be submitted`);
      const tests = args.tests && typeof args.tests === 'object' ? args.tests : {};
      const report = {
        summary: str(args.summary, 6000), commit: str(args.commit, 200),
        changes: list(args.changes, 100, (c) => str(c, 300)),
        tests: { ran: !!tests.ran, passed: Math.max(0, parseInt(tests.passed, 10) || 0), failed: Math.max(0, parseInt(tests.failed, 10) || 0), output: str(tests.output, 6000) },
        criteria: list(args.criteria, 30, (c) => (c && str(c.criterion, 500) ? { criterion: str(c.criterion, 500), met: !!c.met, evidence: str(c.evidence, 1500) } : null)),
        at: Date.now(),
      };
      // the server's own check before the author looks: every acceptance criterion answered and met, tests green
      const unmet = (t.accept || []).filter((a) => !report.criteria.some((c) => c.met && c.criterion.toLowerCase().includes(a.toLowerCase().slice(0, 40))));
      report.check = { allCriteriaMet: !unmet.length && report.criteria.every((c) => c.met), unmet, testsGreen: !report.tests.ran || report.tests.failed === 0 };
      await setTask(ctx, t, { status: 'review', report, blocker: admin.firestore.FieldValue.delete() }, { type: 'submitted', summary: report.summary.slice(0, 300) });
      await logExecution(ctx, key, 'submitted', t.id, { summary: report.summary.slice(0, 300) });
      return { ok: true, status: 'review', check: report.check, message: 'Handed in for the author\'s review. Call get_next_task for the next one.' };
    }
    case 'submit_change_request': {
      const cr = { taskId: str(args.task_id, 32), what: str(args.what, 2000), why: str(args.why, 2000), proposal: str(args.proposal, 4000),
        impact: str(args.impact, 2000), status: 'open', createdAt: ts() };
      const ref = await ctx.gref.collection('changeRequests').add(cr);
      await logExecution(ctx, key, 'change_request', cr.taskId, { what: cr.what });
      return { ok: true, id: ref.id, status: 'open', message: 'The author decides in the Game Bible. Keep working within the current design until then.' };
    }
    default: throw rpcError(-32602, `Unknown tool: ${name}`);
  }
}

// ---------- JSON-RPC ----------
function rpcError(code, message) { const e = new Error(message); e.rpcCode = code; return e; }

async function handle(msg, key) {
  const { id, method, params = {} } = msg || {};
  const isNote = id === undefined || id === null;
  try {
    let result;
    if (method === 'initialize') {
      result = { protocolVersion: PROTOCOLS.includes(params.protocolVersion) ? params.protocolVersion : PROTOCOLS[0],
        capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'whitewrite', version: '1.0.0' },
        instructions: 'WhiteWrite is the game\'s single source of truth and producer. Start with get_project_overview, then get_next_task. ' +
          'Do the task in the Unity repo, then submit_task_result. Never change approved design yourself — submit_change_request.' };
    } else if (method === 'ping') result = {};
    else if (method === 'tools/list') result = { tools: TOOLS };
    else if (method === 'tools/call') {
      try {
        const out = await callTool(params.name, params.arguments || {}, key);
        result = { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
      } catch (e) {
        if (e.rpcCode === -32001) throw e;
        result = { content: [{ type: 'text', text: e.message }], isError: true }; // tool errors go back to the model
      }
    } else if (isNote) return null; // notifications/initialized etc.
    else throw rpcError(-32601, `Method not found: ${method}`);
    return isNote ? null : { jsonrpc: '2.0', id, result };
  } catch (e) {
    if (!e.rpcCode) console.error('[mcp]', method, e);
    return isNote ? null : { jsonrpc: '2.0', id, error: { code: e.rpcCode || -32603, message: e.rpcCode ? e.message : 'Internal error' } };
  }
}

async function authKey(req) {
  const h = req.headers.authorization || '';
  const raw = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!raw.startsWith('wwk_')) return null;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const snap = await db.collection('mcpKeys').doc(hash).get();
  if (!snap.exists || snap.data().revoked) return null;
  const key = { id: hash, ...snap.data() };
  const user = await db.collection('users').doc(key.uid).get();
  if (!getPlanBudget((user.exists && user.data().plan) || 'free').allowGameDev) return null;
  db.collection('mcpKeys').doc(hash).set({ lastUsedAt: ts() }, { merge: true }).catch(() => {});
  return key;
}

exports.mcp = onRequest({ region: 'us-central1', timeoutSeconds: 60, memory: '256MiB', invoker: 'public' }, async (req, res) => {
  if (req.method === 'GET' || req.method === 'DELETE') return res.status(405).set('Allow', 'POST').send(''); // stateless: no SSE stream, no sessions
  if (req.method !== 'POST') return res.status(405).send('');
  const key = await authKey(req).catch((e) => { console.error('[mcp] auth', e); return null; });
  if (!key) {
    return res.status(401).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Invalid or revoked WhiteWrite key (Game Bible → Production plan → Claude Code), or the plan has no Game Dev access' } });
  }
  const body = req.body;
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handle(m, key)))).filter(Boolean);
    return out.length ? res.status(200).json(out) : res.status(202).send('');
  }
  const out = await handle(body, key);
  return out ? res.status(200).json(out) : res.status(202).send('');
});
