// MCP server: the executor channel between WhiteWrite (the brain) and Claude Code (the hands) working in the Unity repo.
// Transport: MCP Streamable HTTP, stateless — every POST carries one JSON-RPC message (or a batch), answered as JSON.
// Claude Code connects with:
//   claude mcp add --transport http whitewrite https://us-central1-whitewrite-app.cloudfunctions.net/mcp --header "Authorization: Bearer wwk_..."
// The key (made in the Game Bible) is scoped to ONE game; only its sha256 is stored (mcpKeys/{sha256}).
// The executor reads the game and its tasks, claims the next ready task, reports progress / blockers / results and
// proposes change requests. It never edits the bible or the canon: the author reviews every result in the Game Bible.
const crypto = require('crypto');
const { onRequest, admin, db, getPlanBudget } = require('./common');
const { telemetrySchema, intentText } = require('./experience')._experience;
const NV = require('../narrative-validate.js');

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
  // World generation & experience (spec «World Generation & Game Experience Intelligence»): approved requirements live in the Bible
  { name: 'get_world_generation_spec', description: 'The approved world-generation spec of this game: the «Генерація світу» section by kind (biomes, route / environment / gameplay modules, atmospheric scenarios, generation rules) with contracts, rules and design intent, plus the world\'s sky/calendar. Read it before building generators.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'get_biome_profile', description: 'One biome profile by name or ref: allowed modules, weights and neighbour rules, atmosphere / audio / lighting, design intent.',
    inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string', description: 'Biome card title or ref "c:<id>"' } } } },
  { name: 'get_module_contract', description: 'The contract of one world module (route / environment / gameplay): anchors & ports, bounds, tags, dependencies & version, validation rules, prefab files.',
    inputSchema: { type: 'object', required: ['name'], properties: { name: { type: 'string', description: 'Module card title or ref "c:<id>"' } } } },
  { name: 'get_environmental_profile', description: 'Weather, time of day, lighting, wind, phenomena and audio requirements: the atmospheric scenarios and each biome\'s atmosphere, plus the world sky (day length, suns, moons, calendar) from the Cosmograph.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'get_telemetry_schema', description: 'How the game reports play: ingest endpoint and key rules, the event envelope, standard + custom events, which events are meaningful, the id map (zone / level / mechanic ids = Bible card ids, with design intent), running A/B experiments and active playtest surveys, privacy rules.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'get_experience_issue', description: 'Player-experience issues found from telemetry: evidence (metric, value), hypothesis, alternative explanations, confidence, suggested actions, validation plan and past validations. Without an id — the list of open ones.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } } } },
  { name: 'submit_validation_result', description: 'After implementing a change for an experience issue (or its task): report how it was validated — automated test, a playtest run, metrics — and the outcome. Success is the validation result, not the finished task.',
    inputSchema: { type: 'object', required: ['issue_id', 'summary', 'outcome'], properties: {
      issue_id: { type: 'string' }, task_id: { type: 'string' }, summary: { type: 'string' }, build: { type: 'string' },
      outcome: { type: 'string', enum: ['improved', 'no_change', 'worse', 'inconclusive'] }, evidence: { type: 'string' } } } },
  // Quests & dialogues of the world (World Bible «Квести» / «Діалоги»): only the ones the author approved
  { name: 'get_quest_context', description: 'A quest of the world, approved by the author: type, giver, characters / locations / factions / artifacts (canon refs with descriptions), objectives, stages with branches and conditions (the first stage is the start; end / fail stages finish it), rewards, prerequisites, repetition, its dialogues and the graph check. Without an id — the list of approved quests.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Quest id or title' } } } },
  { name: 'get_dialogue_context', description: 'A dialogue of the world, approved by the author: type, participants, location, quest + stage, trigger, lines (speaker, text, localisation key, condition, effects, next) and player choices (text, target line, condition); the first line is the start. Without an id — the list of approved dialogues.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Dialogue id or title' } } } },
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

// A gated plan (production pipeline): a milestone opens once the author approved the gate of the milestone before it
// in the same track; expansion and extra open after the last MVP gate. Older plans (no plan.gated) are not gated.
function lockedBy(ctx, t) {
  const plan = ctx.plan.plan || {}, gates = ctx.plan.gates || {};
  if (!plan.gated) return null;
  const ms = plan.milestones || [], m = ms.find((x) => x.id === t.milestone);
  if (!m || !m.track) return null;
  const ok = (x) => (gates[x.id] || {}).status === 'approved';
  const mvp = ms.filter((x) => x.track === 'mvp');
  const before = m.track === 'mvp' ? mvp.slice(0, mvp.indexOf(m)) : mvp.concat(ms.filter((x) => x.track === m.track && ms.indexOf(x) < ms.indexOf(m)));
  const open = before.find((x) => !ok(x));
  return open ? open.id : null;
}
const isReady = (ctx, t) => !lockedBy(ctx, t) && (t.deps || []).every((d) => { const x = ctx.tasks.find((y) => y.id === d); return !x || x.status === 'done'; });

function taskView(ctx, t) {
  const ms = ((ctx.plan.plan || {}).milestones || []).find((m) => m.id === t.milestone) || {};
  return {
    id: t.id, title: t.title, status: t.status, owner: t.owner, size: t.size,
    milestone: { id: t.milestone, track: ms.track || '', name: ms.name || '', goal: ms.goal || '', gate: ms.gate || '', gate_checks: ms.accept || [], budgets: ms.budgets || '' },
    priority: t.priority || '', asset_state: t.assetState || '', card_roles: t.roles || {},
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

// ---------- world generation & experience ----------
const WG_KINDS = [ // the «Генерація світу» subsections, in both languages (gamebible.js GAME worldgen.groups)
  ['biomes', 'Біоми', 'Biomes'], ['route', 'Модулі маршрутів', 'Route modules'], ['environment', 'Модулі оточення', 'Environment modules'],
  ['gameplay', 'Ігрові модулі', 'Gameplay modules'], ['atmosphere', 'Атмосферні сценарії', 'Atmospheric scenarios'], ['rules', 'Правила генерації', 'Generation rules']];
const wgKind = (c) => { const g = str((c.fields || {}).group, 80).toLowerCase(); const k = WG_KINDS.find((x) => x[1].toLowerCase() === g || x[2].toLowerCase() === g); return k ? k[0] : 'other'; };
const wgCards = (ctx) => ctx.cards.filter((c) => c.section === 'worldgen' && !c.hidden);
const wgView = (ctx, c) => ({ ...cardView(ctx, 'c:' + c.id), kind: wgKind(c), ...(c.intent ? { design_intent: intentText(c.intent) } : {}) });
function findWg(ctx, name, kinds) {
  const n = str(name, 160).toLowerCase().replace(/^c:/, '');
  const l = wgCards(ctx).filter((c) => !kinds || kinds.includes(wgKind(c)));
  const c = l.find((x) => x.id.toLowerCase() === n) || l.find((x) => str(x.title, 160).toLowerCase() === n) || l.find((x) => str(x.title, 160).toLowerCase().includes(n));
  if (!c) throw rpcError(-32602, `Not found: ${name}. Known: ${l.map((x) => x.title).join(', ') || 'none — the author has not written the «Генерація світу» section yet'}`);
  return c;
}
const sky = (world) => { const s = world.cosmos; if (!s || !s.planet) return null;
  return { planet: s.planet.name || '', dayHours: s.planet.dayHours, axialTilt: s.planet.tilt, yearDays: ((s.calendar && s.calendar.monthDays) || []).reduce((a, b) => a + b, 0),
    suns: (s.stars || []).map((x) => ({ name: x.name, periodDays: x.periodDays })), moons: (s.moons || []).map((x) => ({ name: x.name, periodDays: x.periodDays })) }; };
const issueView = (x) => ({ id: x.id, title: x.title, category: x.category, priority: x.priority, status: x.status, scope: x.scope, evidence: x.evidence, sample: x.sample,
  hypothesis: x.hypothesis, alternatives: x.alternatives, confidence: x.confidence, confidence_basis: x.confidenceWhy, player_impact: x.impact, suggested_actions: x.actions,
  validation_plan: x.validation, baseline: x.baseline, validations: (x.validations || []).slice(-5), related: x.related, task: x.taskId || '' });

// ---------- quests & dialogues (worlds/{w}/quests, /dialogues; checks: functions/narrative-validate.js) ----------
async function narrative(ctx) {
  if (!ctx.narr) {
    const [q, d] = await Promise.all([ctx.wref.collection('quests').get(), ctx.wref.collection('dialogues').get()]);
    const rows = (s) => s.docs.map((x) => ({ id: x.id, ...x.data() }));
    ctx.narr = { quests: rows(q), dialogues: rows(d) };
  }
  return ctx.narr;
}
const entRef = (ctx, id) => {
  const e = ctx.entities.find((x) => x.id === id);
  return e ? { ref: 'e:' + e.id, kind: e.kind, name: e.name || e.title || '', description: str(e.desc || e.description, 600) } : { ref: 'e:' + id, missing: true };
};
const refs = (ctx, ids) => list(ids, 50, (id) => entRef(ctx, id));
function findApproved(items, id, what) {
  const n = str(id, 160).toLowerCase();
  const x = items.find((y) => y.id.toLowerCase() === n) || items.find((y) => str(y.title, 160).toLowerCase() === n);
  if (!x) throw rpcError(-32602, `${what} not found: ${id}. Call without an id for the approved list.`);
  if (x.approval !== 'approved') throw rpcError(-32602, `${what} «${x.title || x.id}» is not approved yet (${x.approval || 'draft'}). Ask the author to approve it in the World Bible.`);
  return x;
}
function questView(ctx, n, q) {
  const checkCtx = { entities: ctx.entities, quests: n.quests };
  return { id: q.id, title: q.title || '', type: q.type || '', status: q.status || 'idea', summary: q.summary || '',
    giver: q.giver ? entRef(ctx, q.giver) : null, characters: refs(ctx, q.characters), locations: refs(ctx, q.locations),
    factions: refs(ctx, q.factions), artifacts: refs(ctx, q.artifacts),
    objectives: String(q.objectives || '').split('\n').map((x) => x.trim()).filter(Boolean),
    start: ((q.stages || [])[0] || {}).id || '',
    stages: (q.stages || []).map((s) => ({ id: s.id, title: s.title || '', objective: s.objective || '', end: !!s.end, fail: !!s.fail,
      next: (s.next || []).filter((b) => b && b.to).map((b) => ({ to: b.to, condition: b.cond || '' })) })),
    rewards: q.rewards || '', repeat: q.repeat || { mode: 'once' },
    prerequisites: (q.prereqs || []).map((id) => { const p = n.quests.find((x) => x.id === id); return { id, title: p ? p.title || '' : '', approval: p ? p.approval || 'draft' : 'missing' }; }),
    dialogues: n.dialogues.filter((d) => d.questId === q.id).map((d) => ({ id: d.id, title: d.title || '', stage: d.stageId || '', approval: d.approval || 'draft' })),
    hooks: q.hooks || '', notes: q.notes || '', checks: NV.validateQuest(q, checkCtx),
    rules: 'Implement the quest as approved: stage ids and branch conditions are the contract. A change to the design goes through submit_change_request.' };
}
function dialogueView(ctx, n, d) {
  const q = n.quests.find((x) => x.id === d.questId);
  const who = (id) => (id === 'player' || id === 'narrator' || !id ? id || '' : (entRef(ctx, id).name || id));
  return { id: d.id, title: d.title || '', type: d.type || '', status: d.status || 'idea', participants: refs(ctx, d.participants),
    location: d.location ? entRef(ctx, d.location) : null, quest: q ? { id: q.id, title: q.title || '', stage: d.stageId || '' } : null, trigger: d.trigger || '',
    start: ((d.nodes || [])[0] || {}).id || '',
    nodes: (d.nodes || []).map((x) => ({ id: x.id, speaker: x.speaker || '', speaker_name: who(x.speaker), text: x.text || '', loc_key: x.locKey || '',
      condition: x.cond || '', effects: x.effects || '', next: x.next || '', end: !!x.end,
      choices: (x.choices || []).map((c) => ({ text: c.text || '', to: c.to || '', condition: c.cond || '' })) })),
    notes: d.notes || '', checks: NV.validateDialogue(d, { entities: ctx.entities, quests: n.quests }),
    rules: 'Node ids and localisation keys are the contract between the dialogue data and the game. A change to the lines goes through submit_change_request.' };
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
      .map((t) => ({ id: t.id, milestone: t.milestone, title: t.title, status: t.status, owner: t.owner, deps: t.deps || [], ready: OPEN.includes(t.status) && isReady(ctx, t), locked_by_gate: lockedBy(ctx, t) }));
    case 'get_next_task': {
      if (!ctx.tasks.length) return { task: null, message: 'No roadmap yet: the author has to generate the production plan in the Game Bible first.' };
      const mine = ctx.tasks.find((t) => t.status === 'in_progress') || ctx.tasks.find((t) => t.status === 'rework' && isReady(ctx, t));
      const t = mine || ctx.tasks.find((x) => x.status === 'todo' && isReady(ctx, x));
      if (!t) {
        const waiting = ctx.tasks.filter((x) => ['review', 'blocked'].includes(x.status)).map((x) => `${x.id} (${x.status})`);
        const gate = ctx.tasks.filter((x) => x.status === 'todo').map((x) => lockedBy(ctx, x)).find(Boolean);
        if (gate) waiting.push(`the gate ${gate} — the author approves it in the Production plan`);
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
      const kind = { characters: 'characters', locations: 'locations', factions: 'factions', items: 'artifacts' }[s];
      if (kind && !ctx.game.canonOptIn) { // older games see the whole canon; newer ones only what they picked (cards above)
        ctx.entities.filter((e) => e.kind === kind && !ctx.cards.some((c) => c.canonRef === e.id)).forEach((e) => out.push(cardView(ctx, 'e:' + e.id)));
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
    case 'get_world_generation_spec': {
      const byKind = {};
      wgCards(ctx).forEach((c) => { const k = wgKind(c); (byKind[k] = byKind[k] || []).push(wgView(ctx, c)); });
      const tech = ctx.cards.filter((c) => c.section === 'tech' && !c.hidden).map((c) => cardView(ctx, 'c:' + c.id));
      return { spec: byKind, sky: sky(ctx.world), tech_decisions: tech,
        principles: 'Road, Environment, Gameplay and Atmosphere are conceptual layers, not four monolith classes. One generator works with biome profiles; spline is one tool among others. Deterministic by seed + versions; designer overrides; validators for connections, collisions, navigation, gameplay, biome, performance. Audit the framework first — never duplicate a service or invent an API.',
        missing: WG_KINDS.filter((k) => !byKind[k[0]]).map((k) => k[1] + ' / ' + k[2]) };
    }
    case 'get_biome_profile': {
      const c = findWg(ctx, args.name, ['biomes']);
      const t = str(c.title, 160).toLowerCase();
      const mentions = wgCards(ctx).filter((x) => x.id !== c.id && t && JSON.stringify(x.fields || {}).toLowerCase().includes(t)).map((x) => ({ ref: 'c:' + x.id, title: x.title, kind: wgKind(x) }));
      return { biome: wgView(ctx, c), mentioned_by: mentions };
    }
    case 'get_module_contract': return wgView(ctx, findWg(ctx, args.name, ['route', 'environment', 'gameplay', 'other']));
    case 'get_environmental_profile': {
      const scenarios = wgCards(ctx).filter((c) => wgKind(c) === 'atmosphere').map((c) => wgView(ctx, c));
      const biomes = wgCards(ctx).filter((c) => wgKind(c) === 'biomes').map((c) => ({ ref: 'c:' + c.id, title: c.title, atmosphere: (c.fields || {}).atmosphere || '' }));
      const audio = ctx.cards.filter((c) => c.section === 'audio' && !c.hidden && /амбієнт|ambien/i.test(str((c.fields || {}).group, 60))).map((c) => cardView(ctx, 'c:' + c.id));
      return { scenarios, biomes, ambience: audio, sky: sky(ctx.world),
        rules: 'Weather and lighting interact but are not one switch: fog independent of rain, wind of precipitation, a magic zone may relight a cave without touching global weather. Explicit priorities (global weather < biome < local zone < story scenario < gameplay override) and smooth interpolation. In co-op the host owns seed, time and weather; sync compact state, render cosmetics locally.' };
    }
    case 'get_telemetry_schema': {
      const [ex, pt] = await Promise.all([ctx.gref.collection('experiments').get(), ctx.gref.collection('playtests').get()]);
      return telemetrySchema(ctx.game, ctx.cards, ctx.entities, ex.docs.map((d) => ({ id: d.id, ...d.data() })), pt.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    case 'get_experience_issue': {
      if (args.id) {
        const d = await ctx.gref.collection('experienceIssues').doc(str(args.id, 80)).get();
        if (!d.exists) throw rpcError(-32602, `Issue ${args.id} not found`);
        return issueView({ id: d.id, ...d.data() });
      }
      const all = await ctx.gref.collection('experienceIssues').get();
      return { issues: all.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => ['open', 'planned', 'validating'].includes(x.status))
        .map((x) => ({ id: x.id, title: x.title, priority: x.priority, status: x.status, confidence: x.confidence, task: x.taskId || '' })) };
    }
    case 'submit_validation_result': {
      const ref = ctx.gref.collection('experienceIssues').doc(str(args.issue_id, 80));
      const d = await ref.get();
      if (!d.exists) throw rpcError(-32602, `Issue ${args.issue_id} not found. Call get_experience_issue.`);
      const v = { at: Date.now(), by: 'claude-code', taskId: str(args.task_id, 32), build: str(args.build, 40), summary: str(args.summary, 4000),
        verdict: ['improved', 'no_change', 'worse', 'inconclusive'].includes(args.outcome) ? args.outcome : 'inconclusive', evidence: str(args.evidence, 4000) };
      await ref.set({ validations: admin.firestore.FieldValue.arrayUnion(v), status: d.data().status === 'resolved' ? 'resolved' : 'validating', updatedAt: ts() }, { merge: true });
      await logExecution(ctx, key, 'validation', v.taskId, { issue: d.id, verdict: v.verdict });
      return { ok: true, status: 'validating', message: 'Recorded. The author confirms it against the metrics of a new playtest (baseline vs after) in «Досвід гравців».' };
    }
    case 'get_quest_context': {
      const n = await narrative(ctx);
      if (!args.id) return { quests: n.quests.filter((q) => q.approval === 'approved').map((q) => ({ id: q.id, title: q.title || '', type: q.type || '', status: q.status || 'idea' })),
        drafts: n.quests.filter((q) => q.approval !== 'approved').length };
      return questView(ctx, n, findApproved(n.quests, args.id, 'Quest'));
    }
    case 'get_dialogue_context': {
      const n = await narrative(ctx);
      if (!args.id) return { dialogues: n.dialogues.filter((d) => d.approval === 'approved').map((d) => ({ id: d.id, title: d.title || '', type: d.type || '', quest: d.questId || '' })),
        drafts: n.dialogues.filter((d) => d.approval !== 'approved').length };
      return dialogueView(ctx, n, findApproved(n.dialogues, args.id, 'Dialogue'));
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
