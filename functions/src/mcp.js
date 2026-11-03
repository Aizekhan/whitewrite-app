// MCP server: the executor channel between WhiteWrite (the brain) and Claude Code (the hands) working in the Unity repo.
// Transport: MCP Streamable HTTP, stateless — every POST carries one JSON-RPC message (or a batch), answered as JSON.
// Claude Code connects with:
//   claude mcp add --transport http whitewrite https://us-central1-whitewrite-app.cloudfunctions.net/mcp --header "Authorization: Bearer wwk_..."
// The key (made in the Game Bible) is scoped to ONE game; only its sha256 is stored (mcpKeys/{sha256}).
// The executor reads the game and its tasks, claims the next ready task, reports progress / blockers / results and
// proposes change requests. It never edits the bible or the canon: the author reviews every result in the Game Bible.
const crypto = require('crypto');
const { onRequest, admin, db, getPlanBudget, claudeApiKey } = require('./common');
const SG = require('../style-guide.js');
const { telemetrySchema, intentText } = require('./experience')._experience;
const NV = require('../narrative-validate.js');
const MECH = require('../mechanics.js');
const FORGE = require('../forge.js');
const REFS = require('../card-refs.js');
const GUIDES = require('../setup-guides.js');
const STYLE = require('./style')._style;

const PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const OPEN = ['todo', 'rework'];
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const list = (a, n, f) => (Array.isArray(a) ? a : []).map(f).filter((x) => x != null && x !== '').slice(0, n);

// ---------- tools ----------
const TOOLS = [
  { name: 'get_project_overview', description: 'The game this key belongs to: world canon and laws, GDD summary, decisions, engine profile, sections, roadmap progress and the task in progress. Call this first in a session.',
    inputSchema: { type: 'object', properties: {} } },
  { name: 'list_tasks', description: 'The roadmap: every task with id, milestone, status (todo | in_progress | review | rework | blocked | done), deps, whether it is ready and the person it is assigned to (null = anyone).',
    inputSchema: { type: 'object', properties: { status: { type: 'string', description: 'Only tasks with this status' } } } },
  { name: 'get_next_task', description: 'The task to work on now with its full context (cards, files, acceptance criteria, history). Resumes a task already in progress or returned for rework; otherwise claims the first ready task (all deps done) and marks it in_progress. Tasks the author assigned to another team member are left to them.',
    inputSchema: { type: 'object', properties: { claim: { type: 'boolean', description: 'Mark the returned task in_progress (default true)' } } } },
  { name: 'get_task_details', description: 'Full context of one task by id (e.g. "M2.3"): goal, detail, acceptance criteria, tests, related cards with fields and file URLs, deps, review history.',
    inputSchema: { type: 'object', properties: { task_id: { type: 'string' } }, required: ['task_id'] } },
  { name: 'get_design_section', description: 'All cards of one Game Bible section (e.g. mechanics, scenes, refs, assets, materials, audio, ui, tech, characters, locations): fields, status and files. Palette fields are "#hex — name" per line; a scene mock-up is "bg: #hex" + "- label @ x% y% · width% · #hex" per element (centre position); group_palettes = the main colours of each subsection (refs, scenes).',
    inputSchema: { type: 'object', properties: { section: { type: 'string' } }, required: ['section'] } },
  { name: 'get_card', description: 'One card by ref: "c:<cardId>" (game card) or "e:<entityId>" (canon entity seen through this game). Files carry download URLs (models, textures, images). used_by lists what points at the card (quests, dialogues, tasks, mechanics, sound slots, Forge, style) — check them before changing it.',
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
  // Quests & dialogues of the game (Game Bible «Квести й діалоги»): only the ones the author approved
  { name: 'get_quest_context', description: 'A quest of this game, approved by the author: type, giver, characters / locations / factions / artifacts (game cards "c:…" and canon entities "e:…", with descriptions), canon events it builds on, objectives, stages with branches and conditions (the first stage is the start; end / fail stages finish it), rewards, prerequisites, repetition, its dialogues and the graph check. Without an id — the list of approved quests.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Quest id or title' } } } },
  { name: 'get_dialogue_context', description: 'A dialogue of this game, approved by the author: type, participants, location, quest + stage, trigger, lines (speaker, text, localisation key, condition, effects, next) and player choices (text, target line, condition); the first line is the start. Without an id — the list of approved dialogues.',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Dialogue id or title' } } } },
  { name: 'get_content_export', description: 'The approved quests and dialogues of this game in the RPG Framework (≥ 0.32.1) import format "rpgframework.content/1", plus how to import them. Write `content` to a JSON file in the project and run the importer; refs (c:<card> / canon ids) are opaque strings.',
    inputSchema: { type: 'object', properties: {} } },
  // Setup, Unity environment, Project Knowledge, development activity log (functions/setup-guides.js holds the instructions)
  { name: 'get_guide', description: 'Instructions from WhiteWrite: setup (first run and connection rules), unity_env (environment checks with confirmed Unity CLI / Editor commands), knowledge (how to index the Unity project read-only and send it), activity_log (how and when to report development sessions).',
    inputSchema: { type: 'object', required: ['topic'], properties: { topic: { type: 'string', enum: ['setup', 'unity_env', 'knowledge', 'activity_log'] } } } },
  { name: 'report_unity_environment', description: 'Send the result of the Unity environment check (get_guide unity_env): OS, Editor and CLI versions, project discovery and each check with its exit code. Replaces the previous report.',
    inputSchema: { type: 'object', required: ['checks'], properties: {
      os: { type: 'string' }, editor: { type: 'object', properties: { version: { type: 'string' }, path_hint: { type: 'string' } } },
      cli: { type: 'object', properties: { name: { type: 'string' }, version: { type: 'string' } } },
      project: { type: 'object', properties: { found: { type: 'boolean' }, unity_version: { type: 'string' }, packages_ok: { type: 'boolean' } } },
      checks: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, ok: { type: 'boolean' }, detail: { type: 'string' }, exit_code: { type: 'integer' } } } } } } },
  { name: 'submit_project_knowledge', description: 'Send the Project Knowledge index of the Unity project in parts (schema whitewrite.knowledge/1, see get_guide knowledge): part "begin" with the manifest, then "records" (≤500 per call), then "end" with the Markdown reports. Idempotent per snapshot_id; unchanged records are skipped.',
    inputSchema: { type: 'object', required: ['snapshot_id', 'part'], properties: {
      snapshot_id: { type: 'string' }, part: { type: 'string', enum: ['begin', 'records', 'end'] }, manifest: { type: 'object' },
      records: { type: 'array', items: { type: 'object' } }, overview_md: { type: 'string' }, unresolved_md: { type: 'string' }, report_md: { type: 'string' } } } },
  { name: 'get_project_knowledge_status', description: 'The Project Knowledge import: the latest snapshot (or one by id) with status, counts, coverage and the report.',
    inputSchema: { type: 'object', properties: { snapshot_id: { type: 'string' } } } },
  { name: 'search_project_knowledge', description: 'Search the indexed Unity project: by text (name / path / label), GUID, type, path prefix, or everything related to a GUID. Returns assets with their dependencies and relations.',
    inputSchema: { type: 'object', properties: { q: { type: 'string' }, guid: { type: 'string' }, type: { type: 'string' }, path_prefix: { type: 'string' }, related_to: { type: 'string' }, limit: { type: 'integer' } } } },
  { name: 'submit_development_activity', description: 'Report one working session to the development activity log (see get_guide activity_log): session_id (uuid, idempotent), branch, commit, summary and entries with change, category, status, player impact, evidence and privacy. Call at the end of each session and after large changes.',
    inputSchema: { type: 'object', required: ['session_id', 'summary', 'entries'], properties: {
      session_id: { type: 'string' }, schema_version: { type: 'string' }, started_at: { type: 'string' }, ended_at: { type: 'string' },
      branch: { type: 'string' }, commit: { type: 'string' }, summary: { type: 'string' },
      entries: { type: 'array', items: { type: 'object', required: ['entry_id', 'text'], properties: {
        entry_id: { type: 'string' }, change: { type: 'string', enum: ['added', 'changed', 'removed', 'fixed'] }, category: { type: 'string' }, text: { type: 'string' },
        status: { type: 'string', enum: ['completed', 'partial', 'experimental', 'planned'] }, player_impact: { type: 'string' },
        evidence: { type: 'object' }, media: { type: 'array', items: { type: 'string' } }, limits: { type: 'string' }, hints: { type: 'string' },
        privacy: { type: 'string', enum: ['internal', 'confidential', 'spoiler', 'excluded', 'marketing_approved'] }, task_id: { type: 'string' } } } } } } },
  { name: 'get_style_guide', description: 'The game\'s visual style (Game Bible «Візуальний стиль»): the overall style and the biome for a location — manifesto, palette and colours to avoid ("#hex — name" per line), light & mood, materials, shapes & silhouette, polygon & texture budget, do / don\'t, style reference URLs; plus every biome with its locations. Read it before making or placing art, materials, lighting or a scene.',
    inputSchema: { type: 'object', properties: { location: { type: 'string', description: 'A location / level / card name — picks its biome; empty = the overall style' }, card_ref: { type: 'string', description: '"c:<cardId>" — the style that applies to that card' } } } },
  { name: 'check_style', description: 'Ask the art director (Claude, on the author\'s tokens) whether a picture fits the game\'s visual style: a Unity screenshot of a scene, a render of a prefab or a texture. Send a PNG/JPEG/WebP as base64, ≤ 1568 px on the long side and ≤ 5 MB. Returns score 0-100 (70+ fits, 40-69 partly, below 40 off-style), summary, issues and fixes. Nothing is stored; use it after visual work and before submit_task_result.',
    inputSchema: { type: 'object', required: ['image_base64'], properties: { image_base64: { type: 'string' }, media_type: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp'] },
      location: { type: 'string', description: 'The location / level shown — picks its biome' }, what: { type: 'string', description: 'What the picture is (scene, prefab, texture…)' } } } },
  { name: 'get_mechanics', description: 'The game mechanics from the Game Bible constructor: each with category, template (e.g. UMCF — Universal Melee Combat Framework), stage, purpose, completeness % and the count of open problems. Then read one with get_mechanic. section "audio" lists the Sound factory instead: adaptive music (music states, layers, transitions on game events, leitmotifs, mix), ambience, UI sounds, music prompts — plus the plain sound cards.',
    inputSchema: { type: 'object', properties: { section: { type: 'string', enum: ['mechanics', 'audio'], description: 'mechanics (default) or audio — the Sound factory' },
      category: { type: 'string', description: 'A category id — mechanics: movement, combat, stats, progression, abilities, gear, status, ai, world, narrative, economy, camera, death, winlose; audio: music, sfx, voice, ambience, uisound; empty = all' } } } },
  { name: 'get_mechanic', description: 'One mechanic (or a Sound factory card) in full: purpose, rules, every section with typed fields (unit, required) and table rows (links between rows resolved to { id, name }), what RPG Framework already has for each part (framework: exists | partial | missing + the classes), and the constructor checks. Adaptive-music state rows carry generator_prompt; transitions say from → to, the game event, when to switch (beat / bar / loop end / stinger), crossfade and hold — build the music system from them. Numbers are the author design — implement them; a change goes through submit_change_request.',
    inputSchema: { type: 'object', required: ['ref'], properties: { ref: { type: 'string', description: '"c:<cardId>" or the title' } } } },
  { name: 'get_audio_library', description: 'The game\'s Audio library (Аудіотека, «Звук і музика»): every sound / track card with its files (name, url to download, type, duration s; several files = variations, play one at random), where each plays (Sound factory card · section · row · slot), the slots that still have no sound, and the unused sounds. Sound slots in get_mechanic carry the same files.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Filter by title / subsection / file name; empty = all' } } } },
  { name: 'get_character_forge', description: 'The Character Forge (Кузня персонажів): every character / enemy with its type (hero, npc, enemy, boss), production stages (brief → concept → base mesh → rig → equipment → integration → animation → export) and which are approved. With ref — one character\'s manifest (schema whitewrite.character/1): the brief, rig and body profiles, each stage with its APPROVED version\'s files (download URLs — use these, not newer unapproved uploads), animation clips, the bound equipment with its technical passport (slot, skinned | rigid, rig / body profile, body mask, attachment points, format, units, maps, LOD, polygon target, validation status and issues) and loadouts.',
    inputSchema: { type: 'object', properties: { ref: { type: 'string', description: '"c:<cardId>", "e:<entityId>" or the name; empty = the list' } } } },
  { name: 'report_framework_capabilities', description: 'Send RPG Framework\'s capabilities.json from the game\'s Unity project (framework ≥ 0.40.0: Library/PackageCache/com.aizekhan.rpg-framework@*/capabilities.json, or Packages/com.aizekhan.rpg-framework/capabilities.json when embedded) — WhiteWrite then checks the game\'s mechanics against the framework version the game really uses. Send it again after updating the framework. See get_guide unity_env.',
    inputSchema: { type: 'object', required: ['manifest'], properties: { manifest: { type: 'object', description: 'The whole capabilities.json as it is (format rpgframework.capabilities/1)' } } } },
  { name: 'report_forge_check', description: 'Report what you checked in Unity or Blender for a Character Forge equipment item — the platform cannot see clipping, deformation or skeleton compatibility itself. check: skeleton | clipping | deformation | materials | lod | polycount | scale; result: passed | warning | failed. The latest report per check replaces the previous one; a failed one blocks the integration stage until fixed, a warning needs the author\'s manual approval.',
    inputSchema: { type: 'object', required: ['item', 'check', 'result'], properties: { item: { type: 'string', description: '"c:<cardId>" of the item or its name' },
      check: { type: 'string', enum: ['skeleton', 'clipping', 'deformation', 'materials', 'lod', 'polycount', 'scale'] }, result: { type: 'string', enum: ['passed', 'warning', 'failed'] },
      details: { type: 'string', description: 'What exactly you saw (bone, region, numbers)' }, source: { type: 'string', description: 'Unity | Blender | another DCC' } } } },
  { name: 'submit_change_request', description: 'Propose a change to an approved decision (GDD, a card, the plan, the architecture). Never change those yourself — the author decides.',
    inputSchema: { type: 'object', required: ['what', 'why'], properties: {
      task_id: { type: 'string' }, what: { type: 'string' }, why: { type: 'string' }, proposal: { type: 'string' }, impact: { type: 'string' } } } },
];

// ---------- game context ----------
// one read of the game per request: a JSON-RPC batch shares it (key is per request — authKey)
function loadGame(key) {
  if (!key._ctx) key._ctx = readGame(key).catch((e) => { key._ctx = null; throw e; });
  return key._ctx;
}
async function readGame(key) {
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
  const ai = c.styleAi || {};
  return (c.files || []).map((f) => ({ name: f.name, url: f.url, size: f.size, type: f.type, ...(f.field ? { field: labels[f.field] || f.field } : {}),
    ...(ai[f.id] ? { style_check: { score: ai[f.id].score, verdict: ai[f.id].verdict, issues: ai[f.id].issues || [], fixes: ai[f.id].fixes || [], style: ai[f.id].style || '' } } : {}) }));
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
  const gp = groupPalette(ctx, c);
  return { ref: 'c:' + c.id, title: c.title || '', status: c.status || 'idea', section: c.section, fields: named(c), note: c.note || '', files: files(c), planTask: c.planTask || '',
    ...(gp ? { group_palette: gp } : {}) };
}
// «Референси» / «Сцени»: a subsection may carry the group's colour palette (games/{g}.subPalettes[section][group], "#hex — name" per line)
function groupPalette(ctx, c) {
  const f = c.fields || {}, g = f.group || f.category;
  return (g && ((ctx.game.subPalettes || {})[c.section] || {})[g]) || '';
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
    id: t.id, title: t.title, status: t.status, owner: t.owner, size: t.size, assignee: (t.assignee && t.assignee.name) || null,
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
    framework: ctx.game.framework ? { version: ctx.game.framework.version, source: 'project' } : { version: MECH.FW_BUILTIN.version, source: 'builtin — send capabilities.json with report_framework_capabilities' },
    sections,
    roadmap: { overview: (ctx.plan.plan || {}).overview || '', total: ctx.tasks.length, byStatus: count,
      inProgress: ctx.tasks.filter((t) => t.status === 'in_progress').map((t) => t.id) },
  };
}

// What is switched on for this game: the agent keeps the development log when Mini-Marketing is on (get_guide activity_log)
async function integrations(ctx) {
  const m = await ctx.gref.collection('marketing').doc('state').get().catch(() => null);
  const s = m && m.exists ? m.data() : {}, until = s.paidUntil && s.paidUntil.toMillis ? s.paidUntil.toMillis() : 0;
  const on = !!s.enabled && until > Date.now();
  return {
    marketing: { enabled: on, claude_md_confirmed: !!s.claudeMdConfirmedAt,
      ...(on ? { instruction: 'Report every working session with submit_development_activity (get_guide {topic:"activity_log"}); only entries the author approves are used for posts.' } : {}) },
    repo: ctx.game.repo && ctx.game.repo.full ? { full: ctx.game.repo.full, branch: ctx.game.repo.branch || '' } : null,
    knowledge: ctx.game.knowledge ? { last_snapshot: ctx.game.knowledge.lastSnap || '' } : null,
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

// ---------- quests & dialogues (games/{g}/quests, /dialogues; checks: functions/narrative-validate.js) ----------
// They link to game cards (c:<id>) and canon entities (plain id) — NV.refPool is the list of both.
async function narrative(ctx) {
  if (!ctx.narr) {
    const [q, d] = await Promise.all([ctx.gref.collection('quests').get(), ctx.gref.collection('dialogues').get()]);
    const rows = (s) => s.docs.map((x) => ({ id: x.id, ...x.data() }));
    ctx.narr = { quests: rows(q), dialogues: rows(d) };
  }
  return ctx.narr;
}
const pool = (ctx) => ctx.refPool || (ctx.refPool = NV.refPool(ctx.entities, ctx.cards));
const entRef = (ctx, id) => {
  const e = pool(ctx).find((x) => x.id === id), ref = String(id).startsWith('c:') ? id : 'e:' + id;
  return e ? { ref, kind: e.kind, name: e.name, description: str(e.desc, 600) } : { ref, missing: true };
};
const refs = (ctx, ids) => list(ids, 50, (id) => entRef(ctx, id));
function findApproved(items, id, what) {
  const n = str(id, 160).toLowerCase();
  const x = items.find((y) => y.id.toLowerCase() === n) || items.find((y) => str(y.title, 160).toLowerCase() === n);
  if (!x) throw rpcError(-32602, `${what} not found: ${id}. Call without an id for the approved list.`);
  if (x.approval !== 'approved') throw rpcError(-32602, `${what} «${x.title || x.id}» is not approved yet (${x.approval || 'draft'}). Ask the author to approve it in the Game Bible.`);
  return x;
}
function questView(ctx, n, q) {
  const checkCtx = { entities: pool(ctx), quests: n.quests };
  return { id: q.id, title: q.title || '', type: q.type || '', status: q.status || 'idea', summary: q.summary || '',
    giver: q.giver ? entRef(ctx, q.giver) : null, characters: refs(ctx, q.characters), locations: refs(ctx, q.locations),
    factions: refs(ctx, q.factions), artifacts: refs(ctx, q.artifacts), events: refs(ctx, q.events),
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
// 🎙 a line's voice-over: Audio library cards (node.voice) → their audio files; status tts (Google) | rec (recorded)
function voiceFiles(ctx, x) {
  const ids = Array.isArray(x.voice) ? x.voice : [];
  if (!ids.length) return null;
  return { status: x.vstatus || '', files: ids.map((id) => ctx.cards.find((c) => c.id === id)).filter(Boolean)
    .flatMap((c) => (c.files || []).filter((f) => /^audio\//.test(f.type || '') || /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(f.name || ''))
      .map((f) => ({ card: c.id, name: f.name || '', url: f.url || '', type: f.type || '', duration: f.duration || null }))) };
}
function dialogueView(ctx, n, d) {
  const q = n.quests.find((x) => x.id === d.questId);
  const who = (id) => (id === 'player' || id === 'narrator' || !id ? id || '' : (entRef(ctx, id).name || id));
  return { id: d.id, title: d.title || '', type: d.type || '', status: d.status || 'idea', participants: refs(ctx, d.participants),
    location: d.location ? entRef(ctx, d.location) : null, quest: q ? { id: q.id, title: q.title || '', stage: d.stageId || '' } : null, trigger: d.trigger || '',
    start: ((d.nodes || [])[0] || {}).id || '',
    nodes: (d.nodes || []).map((x) => ({ id: x.id, speaker: x.speaker || '', speaker_name: who(x.speaker), text: x.text || '', loc_key: x.locKey || '',
      condition: x.cond || '', effects: x.effects || '', next: x.next || '', end: !!x.end,
      choices: (x.choices || []).map((c) => ({ text: c.text || '', to: c.to || '', condition: c.cond || '' })),
      voice: voiceFiles(ctx, x) })),
    notes: d.notes || '', checks: NV.validateDialogue(d, { entities: pool(ctx), quests: n.quests }),
    rules: 'Node ids and localisation keys are the contract between the dialogue data and the game. A change to the lines goes through submit_change_request.' };
}

// ---------- Project Knowledge (games/{g}/knowledge/{snap}, kAssets/{key}, kRelations/{sha1}) ----------
const sha1 = (x) => crypto.createHash('sha1').update(String(x)).digest('hex');
const KINDS = ['asset', 'scene', 'prefab', 'script', 'visual'];
const assetKey = (r) => (/^[0-9a-f]{32}$/i.test(String(r.guid || '')) ? String(r.guid).toLowerCase() : 'p_' + sha1(str(r.path, 500)));
const clip = (v, depth = 0) => { // keeps detail objects small: strings ≤ 400, arrays ≤ 40, 3 levels
  if (typeof v === 'string') return v.slice(0, 400);
  if (Array.isArray(v)) return depth > 2 ? [] : v.slice(0, 40).map((x) => clip(x, depth + 1));
  if (v && typeof v === 'object') return depth > 2 ? {} : Object.fromEntries(Object.entries(v).slice(0, 30).map(([k, x]) => [k.slice(0, 60), clip(x, depth + 1)]));
  return typeof v === 'number' || typeof v === 'boolean' ? v : null;
};
function normAsset(r) {
  if (!r || !KINDS.includes(r.kind) || (!r.guid && !r.path)) return null;
  const path = str(r.path, 500).replace(/\\/g, '/');
  if (/^([a-z]:)?\//i.test(path) || path.includes('..')) return null; // project-relative paths only
  const base = { kind: r.kind, guid: /^[0-9a-f]{32}$/i.test(String(r.guid || '')) ? String(r.guid).toLowerCase() : '', path, name: str(r.name, 200) || path.split('/').pop(),
    type: str(r.type, 80) || r.kind, description: str(r.description || r.responsibility || r.purpose, 1500), labels: list(r.labels, 20, (x) => str(x, 60)),
    deps: list(r.deps, 200, (x) => str(x, 80)), confidence: ['confirmed', 'inferred', 'unknown'].includes(r.confidence) ? r.confidence : 'inferred' };
  const skip = new Set(['kind', 'guid', 'path', 'name', 'type', 'description', 'responsibility', 'purpose', 'labels', 'deps', 'confidence']);
  const details = clip(Object.fromEntries(Object.entries(r).filter(([k]) => !skip.has(k))));
  return { ...base, details, hash: sha1(JSON.stringify([base, details])) };
}
function normRelation(r) {
  if (!r || r.kind !== 'relation' || !r.from || !r.to) return null;
  const rel = ['uses', 'contains', 'references', 'implements', 'maps_to_card'].includes(r.rel) ? r.rel : 'references';
  if (rel === 'maps_to_card' && r.confirmed !== true) return null; // unconfirmed card links belong in unresolved_md
  return { from: str(r.from, 200), to: str(r.to, 200), rel, evidence: str(r.evidence, 400), confirmed: !!r.confirmed };
}
async function knowledgeSubmit(ctx, args) {
  const snapId = str(args.snapshot_id, 80).replace(/[^\w-]/g, '');
  if (!snapId) throw rpcError(-32602, 'snapshot_id is required');
  const kref = ctx.gref.collection('knowledge').doc(snapId), snap = await kref.get(), cur = snap.exists ? snap.data() : null;
  if (args.part === 'begin') {
    const m = args.manifest || {};
    if (m.schema && m.schema !== GUIDES.KNOWLEDGE_SCHEMA) throw rpcError(-32602, `Unsupported schema ${m.schema}; use ${GUIDES.KNOWLEDGE_SCHEMA} (get_guide knowledge)`);
    if (cur && cur.status === 'imported') return { status: 'duplicate', snapshot_id: snapId, message: 'This snapshot was already imported.' };
    await kref.set({ schema: GUIDES.KNOWLEDGE_SCHEMA, scope: m.scope === 'partial' ? 'partial' : 'full', manifest: clip(m), status: 'uploading',
      counts: { added: 0, updated: 0, skipped: 0, relations: 0, rejected: 0, tombstoned: 0 }, startedAt: ts() }, { merge: true });
    return { ok: true, snapshot_id: snapId, next: 'records (≤500 per call), then end' };
  }
  if (!cur) throw rpcError(-32602, 'Call part "begin" first');
  if (args.part === 'records') {
    const recs = Array.isArray(args.records) ? args.records.slice(0, 500) : [];
    const assets = [], rels = []; let rejected = 0;
    recs.forEach((r) => {
      if (r && r.kind === 'framework') { assets.push({ framework: clip(r) }); return; }
      const a = r && r.kind === 'relation' ? null : normAsset(r), l = a ? null : normRelation(r);
      if (a) assets.push(a); else if (l) rels.push(l); else rejected++;
    });
    const fw = assets.filter((a) => a.framework), list2 = assets.filter((a) => !a.framework);
    const refs = list2.map((a) => ctx.gref.collection('kAssets').doc(assetKey(a)));
    const old = refs.length ? await db.getAll(...refs) : [];
    const counts = { added: 0, updated: 0, skipped: 0 }, bw = db.bulkWriter();
    list2.forEach((a, i) => {
      const prev = old[i].exists ? old[i].data() : null;
      if (prev && prev.hash === a.hash) { counts.skipped++; bw.set(refs[i], { lastSnap: snapId, missingSince: admin.firestore.FieldValue.delete() }, { merge: true }); return; }
      counts[prev ? 'updated' : 'added']++;
      bw.set(refs[i], { ...a, lastSnap: snapId, seenAt: ts(), missingSince: admin.firestore.FieldValue.delete() }, { merge: true });
    });
    rels.forEach((l) => bw.set(ctx.gref.collection('kRelations').doc(sha1(l.from + '|' + l.to + '|' + l.rel)), { ...l, lastSnap: snapId }, { merge: true }));
    await bw.close();
    const inc = admin.firestore.FieldValue.increment;
    await kref.set({ counts: { added: inc(counts.added), updated: inc(counts.updated), skipped: inc(counts.skipped), relations: inc(rels.length), rejected: inc(rejected) },
      ...(fw.length ? { framework: fw[fw.length - 1].framework } : {}), updatedAt: ts() }, { merge: true });
    return { ok: true, ...counts, relations: rels.length, rejected, note: rejected ? 'Rejected records: unknown kind, no guid/path, absolute or ../ path, or an unconfirmed maps_to_card.' : '' };
  }
  if (args.part === 'end') {
    let tomb = 0;
    if (cur.scope === 'full') { // a full scan: what was not seen is marked missing (the author confirms removal), never deleted
      const all = await ctx.gref.collection('kAssets').select('lastSnap', 'missingSince').get();
      const bw = db.bulkWriter();
      all.docs.forEach((d) => { if (d.data().lastSnap !== snapId && !d.data().missingSince) { tomb++; bw.set(d.ref, { missingSince: snapId }, { merge: true }); } });
      await bw.close();
    }
    await kref.set({ status: 'imported', endedAt: ts(), 'counts.tombstoned': tomb, overview: str(args.overview_md, 150000), unresolved: str(args.unresolved_md, 150000),
      report: str(args.report_md, 150000) }, { merge: true });
    await ctx.gref.set({ knowledge: { lastSnap: snapId, at: ts() } }, { merge: true });
    return { ok: true, status: 'imported', tombstoned: tomb };
  }
  throw rpcError(-32602, 'part must be begin, records or end');
}
async function knowledgeStatus(ctx, args) {
  let d;
  if (args.snapshot_id) d = await ctx.gref.collection('knowledge').doc(str(args.snapshot_id, 80)).get();
  else { const q = await ctx.gref.collection('knowledge').orderBy('startedAt', 'desc').limit(1).get(); d = q.docs[0]; }
  if (!d || !d.exists) return { status: 'none', message: 'No Project Knowledge yet. Call get_guide {topic:"knowledge"}.' };
  const x = d.data();
  return { snapshot_id: d.id, status: x.status, scope: x.scope, counts: x.counts, coverage: (x.manifest || {}).coverage || null, framework: x.framework || (x.manifest || {}).framework || null,
    report_md: x.report || '', unresolved_md: x.unresolved || '' };
}
const KNOWLEDGE_SCAN = 5000;
async function knowledgeSearch(ctx, args) {
  const lim = Math.max(1, Math.min(100, parseInt(args.limit, 10) || 30)), col = ctx.gref.collection('kAssets');
  let docs;
  if (args.guid) { const d = await col.doc(str(args.guid, 40).toLowerCase()).get(); docs = d.exists ? [d] : []; }
  else docs = (await col.limit(KNOWLEDGE_SCAN).get()).docs; // bounded: a big Unity project has tens of thousands of assets
  let items = docs.map((d) => ({ key: d.id, ...d.data() }));
  const q = str(args.q, 120).toLowerCase(), type = str(args.type, 80).toLowerCase(), pre = str(args.path_prefix, 300).replace(/\\/g, '/');
  if (q) items = items.filter((a) => [a.name, a.path, a.type, a.description, (a.labels || []).join(' ')].join(' ').toLowerCase().includes(q));
  if (type) items = items.filter((a) => String(a.type || '').toLowerCase() === type || a.kind === type);
  if (pre) items = items.filter((a) => String(a.path || '').startsWith(pre));
  let relations = [];
  if (args.related_to) {
    const g = str(args.related_to, 80).toLowerCase(), node = 'guid:' + g;
    const [a, b] = await Promise.all([ctx.gref.collection('kRelations').where('from', '==', node).get(), ctx.gref.collection('kRelations').where('to', '==', node).get()]);
    relations = a.docs.concat(b.docs).map((d) => d.data()).map((r) => ({ from: r.from, to: r.to, rel: r.rel, evidence: r.evidence }));
    const near = new Set(relations.flatMap((r) => [r.from, r.to]).filter((x) => x.startsWith('guid:')).map((x) => x.slice(5)));
    items.filter((x) => x.guid === g).forEach((x) => (x.deps || []).forEach((d) => near.add(d)));
    items = items.filter((x) => x.guid === g || near.has(x.guid) || (x.deps || []).includes(g));
  }
  return { total: items.length, assets: items.slice(0, lim).map((a) => ({ guid: a.guid, path: a.path, kind: a.kind, type: a.type, name: a.name, description: a.description,
    labels: a.labels, deps: a.deps, confidence: a.confidence, missing: !!a.missingSince, details: a.details })), relations };
}

// ---------- development activity log (games/{g}/activity/{session}, entries/{entry}) ----------
const ENTRY_CATS = ['mechanic', 'level', 'character', 'item', 'ui', 'audio', 'art', 'performance', 'fix', 'tooling', 'release', 'other'];
async function verifyCommit(ctx, key, commit) { // the game's connected GitHub repo (gamedev.js repoConnect); a public repo needs no token
  const full = ctx.game.repo && ctx.game.repo.full;
  if (!full || !/^[0-9a-f]{7,40}$/i.test(commit || '')) return 'unverified';
  const tok = await db.collection('repoTokens').doc(key.worldId + '__' + key.gameId).get();
  const token = tok.exists ? tok.data().token : '';
  try {
    const r = await fetch(`https://api.github.com/repos/${full}/commits/${commit}`, { headers: Object.assign({ Accept: 'application/vnd.github+json', 'User-Agent': 'WhiteWrite' }, token ? { Authorization: 'Bearer ' + token } : {}) });
    return r.ok ? 'commit_found' : r.status === 404 || r.status === 422 ? 'commit_missing' : 'unverified';
  } catch (e) { return 'unverified'; }
}
async function activitySubmit(ctx, key, args) {
  const sid = str(args.session_id, 80).replace(/[^\w-]/g, '');
  if (!sid) throw rpcError(-32602, 'session_id is required (one uuid per session)');
  const entries = list(args.entries, 200, (e) => {
    const id = str(e && e.entry_id, 80).replace(/[^\w-]/g, ''); if (!id || !str(e.text, 1)) return null;
    const ev = e.evidence || {};
    return { id, change: ['added', 'changed', 'removed', 'fixed'].includes(e.change) ? e.change : 'changed', category: ENTRY_CATS.includes(e.category) ? e.category : 'other',
      text: str(e.text, 2000), status: ['completed', 'partial', 'experimental', 'planned'].includes(e.status) ? e.status : 'completed', playerImpact: str(e.player_impact, 1000),
      evidence: { files: list(ev.files, 50, (f) => str(f, 300)), commit: str(ev.commit, 60), pr: str(ev.pr, 200), tests: clip(ev.tests || null) },
      media: list(e.media, 20, (m) => str(m, 300)), limits: str(e.limits, 800), hints: str(e.hints, 800),
      privacy: ['internal', 'confidential', 'spoiler', 'excluded', 'marketing_approved'].includes(e.privacy) ? e.privacy : 'internal', taskId: str(e.task_id, 32) };
  });
  const aref = ctx.gref.collection('activity').doc(sid);
  const refs = entries.map((e) => aref.collection('entries').doc(e.id));
  const old = refs.length ? await db.getAll(...refs) : [];
  const commit = str(args.commit, 60);
  const verify = await verifyCommit(ctx, key, commit);
  const batch = db.batch();
  batch.set(aref, { sessionId: sid, schemaVersion: str(args.schema_version, 40) || GUIDES.ACTIVITY_SCHEMA, branch: str(args.branch, 120), commit, summary: str(args.summary, 2000),
    startedAt: str(args.started_at, 40), endedAt: str(args.ended_at, 40), keyPrefix: key.prefix || '', source: 'mcp', verify, receivedAt: ts(), entryCount: entries.length }, { merge: true });
  let added = 0;
  entries.forEach((e, i) => { if (old[i].exists) return; added++; const { id, ...rest } = e; batch.set(refs[i], { ...rest, at: ts() }); }); // an entry once received is not overwritten (the author may have re-marked its privacy)
  await batch.commit();
  return { ok: true, session_id: sid, accepted: added, duplicates: entries.length - added, verify,
    note: verify === 'commit_missing' ? 'The commit was not found in the connected repository — push it, or the entries stay unverified.' : '' };
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
    case 'get_project_overview': return { ...overview(ctx), integrations: await integrations(ctx) };
    case 'list_tasks': return ctx.tasks.filter((t) => !args.status || t.status === args.status)
      .map((t) => ({ id: t.id, milestone: t.milestone, title: t.title, status: t.status, owner: t.owner, assignee: (t.assignee && t.assignee.name) || null, deps: t.deps || [], ready: OPEN.includes(t.status) && isReady(ctx, t), locked_by_gate: lockedBy(ctx, t) }));
    case 'get_next_task': {
      if (!ctx.tasks.length) return { task: null, message: 'No roadmap yet: the author has to generate the production plan in the Game Bible first.' };
      const ours = (x) => !x.assignee || x.assignee.uid === key.uid; // the key is the owner's: a task given to a team member is theirs
      const mine = ctx.tasks.find((t) => t.status === 'in_progress' && ours(t)) || ctx.tasks.find((t) => t.status === 'rework' && ours(t) && isReady(ctx, t));
      const t = mine || ctx.tasks.find((x) => x.status === 'todo' && ours(x) && isReady(ctx, x));
      if (!t) {
        const waiting = ctx.tasks.filter((x) => ['review', 'blocked'].includes(x.status)).map((x) => `${x.id} (${x.status})`)
          .concat(ctx.tasks.filter((x) => OPEN.includes(x.status) && !ours(x)).map((x) => `${x.id} (assigned to ${x.assignee.name || 'a team member'})`));
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
      const pals = (ctx.game.subPalettes || {})[s];
      return { section: s, cards: out, ...(pals && Object.keys(pals).length ? { group_palettes: pals } : {}) };
    }
    case 'get_style_guide': {
      const styleCards = ctx.cards.filter((c) => c.section === 'artstyle' && !c.hidden);
      if (!styleCards.length) return { style: null, message: 'The author has not described the visual style yet (Game Bible → Art → Visual style).' };
      let names = [str(args.location, 160)];
      const ref = str(args.card_ref, 120);
      if (ref) { const c = ctx.cards.find((x) => x.id === ref.replace(/^c:/, '')); if (c) names = [c.title, (c.fields || {}).group, (c.fields || {}).category, (c.fields || {}).location]; }
      const r = SG.resolveStyle(styleCards, names), pp = SG.palettes(r);
      const view = (c) => (c ? { ref: 'c:' + c.id, title: c.title || '', fields: named(c), references: (c.files || []).filter(SG.isPic).map((f) => f.url) } : null);
      return { applies: r.biome ? 'biome' : 'overall', overall: view(r.overall), biome: view(r.biome),
        palette: pp.palette.map((x) => x.hex + (x.name ? ' — ' + x.name : '')), avoid: pp.avoid.map((x) => x.hex + (x.name ? ' — ' + x.name : '')),
        biomes: styleCards.filter((c) => c !== r.overall && str((c.fields || {}).places, 1)).map((c) => ({ title: c.title || '', locations: String(c.fields.places).split('\n').map((l) => l.replace(/^[\s\-*•·]+/, '').trim()).filter(Boolean) })),
        brief: SG.styleBrief(r) };
    }
    case 'check_style': {
      const image = STYLE.imageBlock(args.image_base64, args.media_type || 'image/png');
      if (!image) throw new Error('image_base64 is not a PNG/JPEG/WebP picture ≤ 5 MB');
      const styleCards = ctx.cards.filter((c) => c.section === 'artstyle' && !c.hidden);
      const r = SG.resolveStyle(styleCards, [str(args.location, 160)]);
      const user = await db.collection('users').doc(key.uid).get();
      try {
        const out = await STYLE.runCheck({ uid: key.uid, userData: user.exists ? user.data() : {}, game: ctx.game, style: r, image, refs: [],
          lang: 'English', what: str(args.what, 200) || 'a screenshot from the Unity project', logAs: 'style_check_mcp' });
        return { style: SG.styleName(r), applies: r.biome ? 'biome' : 'overall', ...out.result, tokens_spent: out.tokensConsumed };
      } catch (e) { if (e instanceof STYLE.CheckError) throw new Error(e.body.error + (e.body.code ? ' (' + e.body.code + ')' : '')); throw e; }
    }
    case 'get_mechanics': {
      const cat = str(args.category, 40), sec = args.section === 'audio' ? 'audio' : 'mechanics';
      const list = ctx.cards.filter((c) => c.section === sec && !c.canonRef && !c.hidden && (!cat || (c.mech && c.mech.cat === cat)));
      return { section: sec, mechanics: list.map((c) => {
        if (!c.mech) return { ref: 'c:' + c.id, title: c.title || '', group: (c.fields || {}).group || '', constructor: false, fields: named(c) };
        const r = MECH.check(c.mech), t = MECH.template(c.mech.tpl);
        return { ref: 'c:' + c.id, title: c.title || '', category: c.mech.cat, template: t ? MECH.lbl(t.name, 'en') : null, stage: c.mech.stage, status: c.status || 'idea',
          purpose: c.mech.purpose || '', completeness: r.pct, problems: r.issues.filter((i) => i.level !== 'tip').length };
      }) };
    }
    case 'get_mechanic': {
      const r = str(args.ref, 200), id = r.replace(/^c:/, '');
      const c = ctx.cards.find((x) => (x.section === 'mechanics' || x.section === 'audio') && !x.canonRef && (x.id === id || str(x.title, 200).toLowerCase() === r.toLowerCase()));
      if (!c) throw rpcError(-32602, `Mechanic ${r} not found`);
      if (!c.mech) return { ref: 'c:' + c.id, title: c.title || '', constructor: false, fields: named(c), message: 'An older card, not yet opened in the constructor: only its text fields.' };
      const man = ctx.game.framework || null; // the game's own capabilities.json (report_framework_capabilities), else the built-in snapshot
      return { ref: 'c:' + c.id, status: c.status || 'idea', ...MECH.exportMech(c, 'en', MECH.audioLibrary(ctx.cards, 'en').assets, man || MECH.FW_BUILTIN),
        framework_version: (man || MECH.FW_BUILTIN).version, framework_source: man ? 'project' : 'builtin' };
    }
    case 'get_audio_library': {
      const lib = MECH.audioLibrary(ctx.cards, 'en'), q = str(args.query, 200).toLowerCase();
      const where = (w) => ({ mechanic: 'c:' + w.card, title: w.title, section: w.secTitle, row: w.rowName || null, slot: w.label });
      const sounds = lib.assets.filter((a) => !q || (a.title + ' ' + a.group + ' ' + a.files.map((f) => f.name).join(' ')).toLowerCase().includes(q)).map((a) => ({
        ref: 'c:' + a.id, title: a.title, subsection: a.group, files: a.files.map((f) => ({ name: f.name, url: f.url, type: f.type || '', size: f.size || 0, duration: f.duration || null })),
        plays_in: (lib.used[a.id] || []).map(where) }));
      return { sounds, missing: lib.missing.map(where), unused: lib.unused.map((id) => 'c:' + id) };
    }
    case 'get_character_forge': {
      const nameOf = (c) => c.title || (ctx.entities.find((e) => e.id === c.canonRef) || {}).name || '';
      const chars = ctx.cards.filter((c) => (c.section === 'characters' || c.section === 'enemies') && !c.hidden)
        .map((c) => ({ id: c.id, canon: !!c.canonRef, section: c.section, title: nameOf(c), fields: c.fields || {}, files: c.files || [], forge: { ...(c.forge || {}), type: FORGE.typeOf(c) } }));
      const items = ctx.cards.filter((c) => c.section === 'gear' && !c.canonRef).map((c) => ({ id: c.id, title: c.title || '', files: c.files || [], forge: c.forge || {} }));
      const r = str(args.ref, 200);
      if (!r) return { characters: chars.map((c) => { const p = FORGE.progress(c);
        return { ref: (c.canon ? 'e:' : 'c:') + c.id, name: c.title, type: c.forge.type, approved: p.done + '/' + p.all, next_stage: p.next,
          stages: FORGE.pipeline(c.forge).map((s) => ({ id: s.id, approved: FORGE.isApproved(c.forge, s.id) })) }; }),
        items: items.length, providers: FORGE.PROVIDERS.map((p) => ({ id: p.id, live: p.live })) };
      const id = r.replace(/^[ce]:/, ''), c = chars.find((x) => x.id === id || str(x.title, 200).toLowerCase() === r.toLowerCase());
      if (!c) throw rpcError(-32602, `Character ${r} not found`);
      return FORGE.manifest(c, items, ctx.game, 'en');
    }
    case 'report_framework_capabilities': {
      const man = MECH.parseCaps(args.manifest);
      if (typeof man === 'string') throw rpcError(-32602, `capabilities.json: ${man}`);
      if (JSON.stringify(man).length > 200000) throw rpcError(-32602, 'capabilities.json is too big');
      const framework = { ...man, source: 'project', reportedAt: Date.now() };
      await ctx.gref.update({ framework }); // replaces the whole map — capabilities that left the framework do not linger
      ctx.game.framework = framework;
      await logExecution(ctx, key, 'framework', '', { version: man.version });
      const gaps = ctx.cards.filter((c) => c.mech && !c.canonRef && !c.hidden).reduce((n, c) => n + MECH.frameworkGaps(c.mech, framework).length, 0);
      return { ok: true, version: man.version, capabilities: Object.keys(man.caps).length, missing: Object.keys(man.missing).length, mechanic_gaps: gaps };
    }
    case 'report_forge_check': {
      const r = str(args.item, 200), id = r.replace(/^c:/, '');
      const c = ctx.cards.find((x) => x.section === 'gear' && !x.canonRef && (x.id === id || str(x.title, 200).toLowerCase() === r.toLowerCase()));
      if (!c) throw rpcError(-32602, `Item ${r} not found`);
      const check = FORGE.EXTERNAL.includes(args.check) ? args.check : null, result = ['passed', 'warning', 'failed'].includes(args.result) ? args.result : null;
      if (!check || !result) throw rpcError(-32602, 'check and result are required');
      const rep = { check, result, details: str(args.details, 1500), source: str(args.source, 40) || 'Unity', at: Date.now() };
      const external = ((c.forge || {}).external || []).filter((x) => x.check !== check).concat([rep]).slice(-20);
      await ctx.gref.collection('cards').doc(c.id).set({ forge: { external }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { ok: true, item: 'c:' + c.id, validation: FORGE.validation({ ...c, forge: { ...(c.forge || {}), external } }, null, ctx.game).status };
    }
    case 'get_card': {
      const c = cardView(ctx, str(args.ref, 120));
      if (!c) throw rpcError(-32602, `Card ${args.ref} not found`);
      const n = await narrative(ctx); // what points at it (functions/card-refs.js) — check these before changing the card
      const used = REFS.usedBy({ cards: ctx.cards, entities: ctx.entities, quests: n.quests, dialogues: n.dialogues, tasks: ctx.tasks, plan: ctx.plan.plan }, c.ref, 'en');
      return { ...c, used_by: used.map((r) => ({ kind: r.kind, what: r.label, ...(r.from.type === 'card' ? { ref: r.from.key } : { [r.from.type]: r.from.id }), title: r.from.title || '',
        ...(r.from.status ? { status: r.from.status } : {}), ...(r.extra ? { detail: r.extra } : {}) })) };
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
    case 'get_content_export': {
      const n = await narrative(ctx);
      const content = NV.toFrameworkContent(n.quests, n.dialogues, { game: ctx.game.title || '', exportedAt: new Date().toISOString() });
      return { content, counts: { quests: content.quests.length, dialogues: content.dialogues.length },
        how: 'Needs RPG Framework 0.32.1 or newer (in 0.32.0 a last line without next leaves the conversation open) — update the package first if older. Save `content` as Assets/Content/WhiteWrite/content.json (or where the author keeps content), then run ' +
          '`Unity.exe -batchmode -quit -projectPath "<project>" -executeMethod RPGFramework.ContentImport.Editor.ContentAssetImport.ImportFromCommandLine -contentFile <file> [-contentFolder Assets/Content] -logFile -`. ' +
          'Exit 0 = imported (Quest / Dialogue assets created or updated by id), 1 = the file has errors and nothing was written (read the problem codes in the log), 2 = the import failed. ' +
          'Dialogue effects are not stored in the assets: a kit game keeps them by listing the JSON in Game Setup > Content Files. Then run ValidateFromCommandLine (exit 0 = clean). ' +
          'Free-text conditions arrive as {type:"custom", id:text} and unknown effect kinds are reported and skipped — wire them in game code, do not edit the design; a design change goes through submit_change_request.' };
    }
    case 'get_guide': {
      const g = GUIDES.guide(str(args.topic, 20));
      if (!g) throw rpcError(-32602, 'topic must be setup, unity_env, knowledge or activity_log');
      return g;
    }
    case 'report_unity_environment': {
      const checks = list(args.checks, 20, (c) => (c && str(c.id, 40) ? { id: str(c.id, 40), ok: !!c.ok, detail: str(c.detail, 400), exitCode: Number.isInteger(c.exit_code) ? c.exit_code : null } : null));
      await ctx.gref.collection('env').doc('current').set({ os: str(args.os, 80), editor: clip(args.editor || {}), cli: clip(args.cli || {}), project: clip(args.project || {}), checks,
        ok: checks.length > 0 && checks.every((c) => c.ok), reportedAt: ts(), keyPrefix: key.prefix || '' });
      await logExecution(ctx, key, 'unity_env', '', { ok: checks.every((c) => c.ok) });
      return { ok: true, checks: checks.length, all_ok: checks.every((c) => c.ok) };
    }
    case 'submit_project_knowledge': {
      const out = await knowledgeSubmit(ctx, args);
      if (args.part === 'end') await logExecution(ctx, key, 'knowledge', '', { snapshot: str(args.snapshot_id, 80) });
      return out;
    }
    case 'get_project_knowledge_status': return knowledgeStatus(ctx, args);
    case 'search_project_knowledge': return knowledgeSearch(ctx, args);
    case 'submit_development_activity': {
      const out = await activitySubmit(ctx, key, args);
      await logExecution(ctx, key, 'activity', '', { session: out.session_id, accepted: out.accepted });
      return out;
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
        // Маркет: a world under licence review / on sale is frozen — reads go on, nothing is written (market.js)
        if (/^(report_|submit_|get_next_task|check_style)/.test(params.name || '') &&
            ((await db.collection('worlds').doc(key.worldId).get()).data() || {}).freeze) throw new Error('The world is frozen: it is under licence review or on sale in the WhiteWrite Market — nothing can be changed or claimed until the author withdraws it.');
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
  if (!getPlanBudget((user.exists && user.data().plan) || 'free').allowAPI) return null; // paid-features `mcp`
  db.collection('mcpKeys').doc(hash).set({ lastUsedAt: ts() }, { merge: true }).catch(() => {});
  return key;
}

const MAX_BATCH = 20; // each call may read the whole game: an unbounded batch would cost reads and memory
exports.mcp = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB', invoker: 'public', secrets: [claudeApiKey] }, async (req, res) => {
  if (req.method === 'GET' || req.method === 'DELETE') return res.status(405).set('Allow', 'POST').send(''); // stateless: no SSE stream, no sessions
  if (req.method !== 'POST') return res.status(405).send('');
  const key = await authKey(req).catch((e) => { console.error('[mcp] auth', e); return null; });
  if (!key) {
    return res.status(401).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Invalid or revoked WhiteWrite key (Game Bible → Production plan → Claude Code), or the plan has no Game Dev access' } });
  }
  const body = req.body;
  if (Array.isArray(body)) {
    if (body.length > MAX_BATCH) return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'At most ' + MAX_BATCH + ' requests in a batch' } });
    const out = (await Promise.all(body.map((m) => handle(m, key)))).filter(Boolean);
    return out.length ? res.status(200).json(out) : res.status(202).send('');
  }
  const out = await handle(body, key);
  return out ? res.status(200).json(out) : res.status(202).send('');
});

exports._mcp = { knowledgeSubmit, knowledgeStatus, knowledgeSearch, activitySubmit, normAsset }; // tests only (tests/mcp-knowledge.test.cjs)
