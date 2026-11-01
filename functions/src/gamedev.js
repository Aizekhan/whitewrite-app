// Game Bible → Production Plan, for one GAME built on a world's canon (one canon → many games).
//   op "import":  the author's .md notes → a PROPOSAL sorted onto the shelves (nothing is written:
//                 the author ticks what goes in, the client writes it — AI guesses never become canon on their own)
//   op "analyze": a living GDD summary + the open questions that block production
//   op "plan":    after the author's answers, a precise development plan
//   op "canonAudit": contradictions inside the WORLD canon (no game needed) → worlds/{w}.audit; the author resolves them
//   op "repoConnect" / "repoDisconnect": link the game's GitHub repository (free; the token lives only in repoTokens/{w}__{g})
//   op "repoSync":   on the author's button — the repo's docs + file inventory vs the Bible → a PROPOSAL like import:
//                    what the repo has and the Bible lacks, and where they disagree (ticked ones go to «Неузгоджене»)
// analyze/plan results live in worlds/{w}/games/{g}/plan/current (answers are written there by the client).
const {
  onRequest,
  admin,
  db,
  cors,
  Anthropic,
  charge,
  getBalance,
  reserve,
  refund,
  getPlanBudget,
  claudeApiKey,
} = require('./common');
const { intentText } = require('./experience')._experience;
const { featureCost, byOp } = require('../paid-features.js');
const { modelFor, withFallback } = require('./claude');

const LANGUAGES = { uk: 'Ukrainian', en: 'English' };
const MAX_BIBLE_CHARS = 120000;
const MAX_IMPORT_CHARS = 100000;
const CANON_KINDS = ['characters', 'locations', 'factions', 'artifacts'];

const ENGINE_PROFILES = {
  generic: 'Engine-agnostic. Use standard game production practice (prototype → vertical slice → content → polish). ' +
    'Where the engine matters, name the choice as a decision for the developer instead of assuming one.',
  'rpg-framework': 'Unity game built on RPG Framework (UPM package com.aizekhan.rpg-framework, v0.22.0). The developer builds the game ' +
    'together with Claude Code in the game repository; this service does not run Unity. The framework is organised around genre kits ' +
    '(e.g. ActionRpg, TurnBased, or a Custom host) and runtime modules (e.g. combat, progression, quests, items, loot, dialogue); designer ' +
    'content is ScriptableObject assets; multiplayer is host-authoritative co-op. The framework capabilities catalog is NOT connected yet: ' +
    'never state that a module exists for certain — mark every framework dependency "verify in catalog", and list likely framework gaps ' +
    '(need, what is missing, desired API, workaround). Game repo docs: GAME.md, FRAMEWORK-GAPS.md, Docs/GDD.md, Docs/ASSETS.md, Docs/TASKS.md.',
};

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const list = (a, n, f) => (Array.isArray(a) ? a : []).map(f).filter(Boolean).slice(0, n);
const oneOf = (v, opts, d) => (opts.includes(v) ? v : d);
const labelMap = (o, n, max) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {})
  .map(([k, v]) => [str(k, 80), str(v, max)]).filter(([k, v]) => k && v).slice(0, n));

// Canon + this game as compact text; every card carries a ref the model can point questions at.
function bibleText(world, entities, cards, game, shelves, lore) {
  const own = (game.sections || []).map((s) => ({ id: s.id, name: s.name })).concat((shelves || []).map((s) => ({ id: s.id, name: s.name })));
  const lines = [`# World canon: ${world.title || ''}`, world.tagline || '', world.summary || ''];
  if ((world.rules || []).length) lines.push('Laws of the world:', ...world.rules.map((r) => `- ${r}`));
  const sky = world.cosmos; // World Bible «Космологія» (Космограф)
  if (sky && sky.planet) {
    const yd = (sky.calendar && sky.calendar.monthDays || []).reduce((a, b) => a + b, 0);
    lines.push(`Sky: planet ${sky.planet.name || ''} (radius ${sky.planet.radiusKm} km, axial tilt ${sky.planet.tilt}°, day ${sky.planet.dayHours} h, year ${yd} days); ` +
      `suns: ${(sky.stars || []).map((s) => `${s.name} (period ${s.periodDays} d)`).join(', ') || 'none'}; moons: ${(sky.moons || []).map((m) => `${m.name} (period ${m.periodDays} d)`).join(', ') || 'none'}.`);
  }
  if ((lore || []).length) { // World Bible «Культура»: peoples, languages, faith, customs
    lines.push('\n# Culture of the world');
    for (const x of lore) {
      const f = Object.values(x.fields || {}).map((v) => str(v, 400)).filter(Boolean).join(' · ');
      lines.push(`- [${x.group || 'customs'}] ${x.name || ''}: ${str(x.desc, 500)}${f ? ' — ' + f : ''}`);
    }
  }
  if (game.title) lines.push(`\n# Game: ${game.title}`);
  const card = (ref, section, title, status, fields, note, files, intent) => {
    lines.push(`\n## [${ref}] ${title} (section: ${section}, status: ${status || 'idea'})`);
    for (const [k, v] of Object.entries(fields)) if (str(v, 1)) lines.push(`${k}: ${str(v, 800)}`);
    if ((files || []).length) lines.push(`Files: ${files.map((f) => f.name).join(', ')}`);
    if (note) lines.push(`Author's note: ${str(note, 600)}`);
    if (intent && intentText(intent)) lines.push(`Design intent: ${intentText(intent)}`);
  };
  const named = (c) => {
    const labels = Object.fromEntries((c.defs || []).map((d) => [d.key, d.label]));
    return Object.fromEntries(Object.entries(c.fields || {}).map(([k, v]) => [labels[k] || k, v]));
  };
  for (const e of entities) {
    if (!CANON_KINDS.includes(e.kind)) continue;
    const c = cards.find((x) => x.canonRef === e.id) || {};
    if (c.hidden || (game.canonOptIn && !c.canonRef)) continue; // a game takes only the canon it picked
    const d = e.dossier || {}, life = (e.lifeNotes || []).map((n) => `${n.at || ''}: ${n.text || ''}`).join('; ');
    card(`e:${e.id}`, `canon ${e.kind}`, e.name || '', c.status, { description: e.desc || e.description || '',
      ...(d.story ? { 'world dossier: story': d.story } : {}), ...(d.look ? { 'world dossier: look': d.look } : {}), ...(d.outcome ? { 'world dossier: consequences': d.outcome } : {}), ...(life ? { 'life timeline': life } : {}), ...named(c) }, c.note, c.files, c.intent);
  }
  for (const c of cards) {
    if (c.canonRef) continue;
    card(`c:${c.id}`, `${c.section} — ${(own.find((s) => s.id === c.section) || {}).name || ''}`, c.title || '', c.status, named(c), c.note, c.files, c.intent);
  }
  return lines.join('\n').slice(0, MAX_BIBLE_CHARS);
}

const cleanQuestion = (q, i) => (q && str(q.question, 600) ? {
  id: 'q_' + Date.now().toString(36) + '_' + i,
  topic: str(q.topic, 80),
  question: str(q.question, 600),
  why: str(q.why, 400),
  options: list(q.options, 5, (o) => str(o, 200) || null),
  priority: oneOf(q.priority, ['blocker', 'important', 'nice'], 'important'),
  target: q.target && str(q.target.card, 80) ? { card: str(q.target.card, 80), field: str(q.target.field, 80) } : null,
} : null);
// A contradiction is resolved by the author like a question: options to tick or their own words; the id is stable
// for the same text, so a resolved one is recognised when the next audit finds it again.
const textId = (s) => 'x_' + require('crypto').createHash('sha1').update(String(s)).digest('hex').slice(0, 10);
// older contradictions have no id: the same djb2 fallback as gamebible.js cid()
const djb2 = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
const cid = (c) => c.id || 't_' + djb2(c.what || '');
const cleanContradiction = (c) => (c && str(c.what, 500) ? { id: textId(str(c.what, 500)), what: str(c.what, 500), where: str(c.where, 200),
  options: list(c.options, 4, (o) => str(o, 200) || null),
  target: c.target && str(c.target.card, 80) ? { card: str(c.target.card, 80), field: str(c.target.field, 80) } : null } : null);
// Resolved contradictions are kept (with the answer) and fed back as decisions; fresh ones replace the open ones.
const mergeContradictions = (prev, answers, fresh) => {
  const kept = (prev || []).filter((c) => str(answers[cid(c)], 1));
  return kept.concat(fresh.filter((c) => !kept.some((k) => cid(k) === c.id)));
};
const decided = (contras, answers) => (contras || []).filter((c) => str(answers[cid(c)], 1)).map((c) => ({ q: 'Contradiction: ' + c.what, a: str(answers[cid(c)], 2000) }));

function cleanAnalysis(p) {
  const gdd = p && p.gdd ? p.gdd : {};
  return {
    gdd: {
      summary: str(gdd.summary, 1500),
      readiness: Math.max(0, Math.min(100, Math.round(Number(gdd.readiness) || 0))),
      sections: list(gdd.sections, 20, (s) => (s && str(s.title, 80) ? { title: str(s.title, 80), status: oneOf(s.status, ['solid', 'partial', 'missing'], 'partial'), notes: str(s.notes, 600) } : null)),
    },
    questions: list(p && p.questions, 25, cleanQuestion),
    contradictions: list(p && p.contradictions, 12, cleanContradiction),
  };
}

// A production pipeline (owner decision 2026-11-02): track mvp = gates G0 setup → G1 core loop greybox → G2 first playable
// (styled slice) → G3 MVP feature-complete → G4 release candidate; then 'expansion' (more of proven systems) and 'extra'
// (new systems, each behind its own prototype gate, ranked, cut below plan.cutLine). gated: a milestone's tasks open only
// after the author approved the previous gate of its track (plan/current.gates, see mcp.js isReady).
const TRACKS = ['mvp', 'expansion', 'extra'];
const CARD_ROLES = ['implements', 'uses-asset', 'in-level', 'follows-style', 'constrained-by'];
const ASSET_STATES = ['greybox', 'standin', 'styled', 'final'];
function cleanPlan(p) {
  const plan = p && p.plan ? p.plan : {};
  return {
    gated: true,
    overview: str(plan.overview, 2000),
    dod: list(plan.dod, 8, (d) => str(d, 300) || null),
    estimateWeeks: Math.max(0, Math.min(104, Math.round(+plan.estimateWeeks || 0))),
    engineNotes: str(plan.engineNotes, 2000),
    cutLine: Math.max(0, Math.min(12, Math.round(+plan.cutLine || 0))),
    health: list(plan.health, 12, (h) => (h && str(h.issue, 300) ? { issue: str(h.issue, 300), fix: str(h.fix, 400), cards: list(h.cards, 8, (c) => str(c, 200) || null) } : null)),
    milestones: list(plan.milestones, 14, (m) => (m && str(m.name, 120) ? {
      id: str(m.id, 12), track: oneOf(m.track, TRACKS, 'mvp'), name: str(m.name, 120), goal: str(m.goal, 600), gate: str(m.gate, 600),
      entry: str(m.entry, 400), deliverables: list(m.deliverables, 10, (d) => str(d, 300) || null),
      accept: list(m.accept, 10, (a) => str(a, 300) || null), budgets: str(m.budgets, 600),
      estimateDays: Math.max(0, Math.min(120, Math.round(+m.estimateDays || 0))),
      tasks: list(m.tasks, 30, (t) => {
        if (!t || !str(t.title, 160)) return null;
        // cards come as "c:…" or {ref, role}; kept as plain refs (MCP, older plans) + a role per ref
        const roles = {};
        const cards = list(t.cards, 20, (c) => {
          const ref = str(c && typeof c === 'object' ? c.ref : c, 200);
          if (ref && c && typeof c === 'object' && CARD_ROLES.includes(c.role)) roles[ref] = c.role;
          return ref || null;
        });
        return {
          id: str(t.id, 16), title: str(t.title, 160), detail: str(t.detail, 1200),
          deps: list(t.deps, 8, (d) => str(d, 16) || null),
          size: oneOf(t.size, ['S', 'M', 'L'], 'M'),
          owner: oneOf(t.owner, ['design', 'dev', 'art', 'audio', 'qa'], 'dev'),
          priority: oneOf(t.priority, ['must', 'should', 'could'], m.track === 'extra' ? 'could' : m.track === 'expansion' ? 'should' : 'must'),
          assetState: ASSET_STATES.includes(t.assetState) ? t.assetState : '',
          estimate: Math.max(0, Math.min(30, +t.estimate || 0)),
          prompt: str(t.prompt, 3000),
          cards, roles,
          accept: list(t.accept, 8, (a) => str(a, 300) || null),
          tests: list(t.tests, 6, (a) => str(a, 300) || null),
        };
      }),
    } : null)),
    parallel: list(plan.parallel, 8, (s) => str(s, 300) || null),
    risks: list(plan.risks, 10, (r) => (r && str(r.risk, 300) ? { risk: str(r.risk, 300), mitigation: str(r.mitigation, 400) } : null)),
    gaps: list(plan.gaps, 15, (g) => (g && str(g.need, 300) ? { need: str(g.need, 300), missing: str(g.missing, 300), desiredApi: str(g.desiredApi, 500), workaround: str(g.workaround, 300) } : null)),
  };
}

// What the plan needs but the bible lacks: new sections + empty cards ("in progress") for the author to fill
function cleanScaffold(p, shelves) {
  const sc = p && p.scaffold ? p.scaffold : {};
  const gameShelves = shelves.filter((s) => s.kind === 'game' && s.id !== 'plan');
  const sections = list(sc.sections, 6, (x) => (x && str(x.name, 80) && !gameShelves.some((s) => s.name.toLowerCase() === str(x.name, 80).toLowerCase())
    ? { name: str(x.name, 80), about: str(x.about, 300), why: str(x.why, 300) } : null));
  const target = (v) => {
    const t = str(v, 80);
    const shelf = gameShelves.find((s) => s.id === t || s.name.toLowerCase() === t.toLowerCase());
    if (shelf) return shelf.id;
    const sec = sections.find((s) => s.name.toLowerCase() === t.toLowerCase());
    return sec ? 'new:' + sec.name : '';
  };
  return {
    sections,
    cards: list(sc.cards, 80, (c) => (c && str(c.title, 160) && target(c.section) ? {
      section: target(c.section), title: str(c.title, 160), group: str(c.group, 80), need: str(c.need, 800), task: str(c.task, 16),
    } : null)),
  };
}

// Task Engine: the plan's tasks become worlds/{w}/games/{g}/tasks/{taskId} with a status the executor (Claude Code via MCP)
// and the author's review move along: todo → in_progress → review → done (or rework / blocked).
// A new plan replaces open tasks; tasks already taken, handed in or done are kept.
async function writeTasks(gameRef, plan) {
  const old = await gameRef.collection('tasks').get();
  const kept = new Set();
  const batch = db.batch();
  old.docs.forEach((d) => { if (['todo', 'rework'].includes(d.data().status)) batch.delete(d.ref); else kept.add(d.id); });
  let order = 0;
  for (const m of plan.milestones) {
    for (const t of m.tasks) {
      order++;
      const id = t.id.replace(/[\/\s]/g, '_');
      if (!id || kept.has(id)) continue;
      batch.set(gameRef.collection('tasks').doc(id), { ...t, id, milestone: m.id, track: m.track, status: 'todo', order, history: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  }
  await batch.commit();
}

function cleanImport(p, shelves, entities, world) {
  const gameShelves = shelves.filter((s) => s.kind === 'game').map((s) => s.id);
  const ids = new Set(entities.map((e) => e.id));
  const laws = new Set((world.rules || []).map((r) => String(r).trim().toLowerCase()));
  return {
    laws: list(p && p.laws, 10, (l) => { const v = str(l, 240); return v && !laws.has(v.toLowerCase()) ? v : null; }),
    canon: list(p && p.canon, 60, (e) => (e && CANON_KINDS.includes(e.kind) && str(e.name, 80) ? {
      kind: e.kind, name: str(e.name, 80), description: str(e.description, 1500),
      match: ids.has(str(e.match, 80)) ? str(e.match, 80) : '',
      gameFields: labelMap(e.gameFields, 12, 3000),
    } : null)),
    cards: list(p && p.cards, 120, (c) => (c && str(c.title, 160) ? {
      section: gameShelves.includes(c.section) ? c.section : 'overview', title: str(c.title, 160), fields: labelMap(c.fields, 15, 4000),
    } : null)),
    contradictions: list(p && p.contradictions, 15, cleanContradiction),
    questions: list(p && p.questions, 20, cleanQuestion).map((q) => ({ ...q, target: null })), // their cards don't exist yet
  };
}

const answeredText = (answered) => (answered.length ? `\nAlready decided by the author:\n${answered.map((a) => `- Q: ${a.q}\n  A: ${a.a}`).join('\n')}\n` : '');

function importPrompt(markdown, shelves, entities, world, languageName, cards) {
  const shelfText = shelves.map((s) => `- ${s.id} (${s.kind === 'canon' ? `CANON ${s.canonKind}` : 'game'}): ${s.name}${s.fields.length ? ` — fields: ${s.fields.join(' | ')}` : ''}${s.groups.length ? ` — subheadings (put the fitting one into the first field): ${s.groups.join(' | ')}` : ''}`).join('\n');
  const known = entities.filter((e) => CANON_KINDS.includes(e.kind)).map((e) => `- ${e.id} [${e.kind}] ${e.name || ''}`).join('\n');
  return `You are the librarian of WhiteWrite. The author uploaded their notes about a world and a game. Sort EVERYTHING useful onto the shelves below — do not invent content that is not in the notes, do not drop details (numbers, names, prompts, references).

SHELVES:
${shelfText}

Rules:
- CANON is the world shared by all stories and games: characters, locations, factions, artifacts. Put each canon entity in "canon" with kind (characters|locations|factions|artifacts), name, description (who/what it is in the world). If it is already in the canon list below, set "match" to its id. Game-only information about it (role in the game, numbers, abilities, model/prefab, level design) goes to gameFields as {"<field label>": "value"} — prefer the shelf's field labels.
- New laws of the world (hard rules of magic/physics/society) go to "laws" — only ones not already listed.
- Everything about the GAME (overview, pillars, loop, mechanics, enemies, bosses, assets, prefabs, materials, sound, UI…) goes to "cards" with section = a game shelf id, title, and fields {"<field label>": "value"}. Use the shelf's field labels when they fit; otherwise a short new label. Keep markdown (tables, lists) inside values.
- contradictions: places where the notes contradict themselves or the canon (what, where).
- questions: decisions the notes leave open that block making the game (topic, question, why, options, priority blocker|important|nice).

World canon now: ${world.title || ''}. ${world.summary || ''}
Laws: ${(world.rules || []).join(' | ')}
Known canon entities:
${known || '(none)'}
Existing game cards (to add to one, reuse its exact title and section):
${cards.filter((c) => !c.canonRef).map((c) => `- [${c.section}] ${c.title || ''}`).join('\n') || '(none)'}

AUTHOR'S NOTES:
${markdown}

Write ALL text in ${languageName} unless quoting the notes. Return ONLY valid JSON, no markdown fence:
{"laws":[""],"canon":[{"kind":"characters","name":"","description":"","match":"","gameFields":{}}],"cards":[{"section":"mechanics","title":"","fields":{}}],"contradictions":[{"what":"","where":""}],"questions":[{"topic":"","question":"","why":"","options":[""],"priority":"important"}]}`;
}

function analyzePrompt(bible, engine, answered, languageName) {
  return `You are the lead game designer and producer of WhiteWrite. Below is the world canon and the Game Bible of one game built on it: structured cards written by the author. Canon cards ([e:...]) are shared with the world's stories and other games; their game fields belong to this game only.

Your job: turn it into an interactive game design document. Read everything, then:
1. gdd.summary — 2-4 sentences: what this game is, for whom, what makes it itself.
2. gdd.readiness — 0-100: how ready the design is to start production.
3. gdd.sections — for each area of a GDD (vision & pillars, core loop, mechanics, progression, characters, enemies, levels, economy/items, UI/UX, audio, art direction, multiplayer, tech/engine, monetization if relevant): status solid|partial|missing + one-line notes.
4. questions — the UNRESOLVED decisions that block or weaken production, most important first (max 15). Concrete, answerable questions. For each: topic, question, why (what in production depends on it), 2-4 options when sensible, priority blocker|important|nice, and target — the card ref it belongs to ("c:..." / "e:..." from the bible, or "") and the field it would fill (an existing field name, or a short new field label).
5. contradictions — places where cards contradict each other or the world laws: what, where, 2-4 options how to resolve it, target (the card ref and field the resolution belongs in). Do NOT repeat contradictions the author already resolved.
Do NOT ask what the bible already answers. Do NOT re-ask what the author already decided.

Engine profile: ${ENGINE_PROFILES[engine] || ENGINE_PROFILES.generic}
${answeredText(answered)}
BIBLE:
${bible}

Write ALL text in ${languageName}. Return ONLY valid JSON, no markdown:
{"gdd":{"summary":"","readiness":0,"sections":[{"title":"","status":"partial","notes":""}]},"questions":[{"topic":"","question":"","why":"","options":[""],"priority":"blocker","target":{"card":"","field":""}}],"contradictions":[{"what":"","where":"","options":[""],"target":{"card":"","field":""}}]}`;
}

function canonAuditPrompt(canon, answered, languageName) {
  return `You are the continuity editor of a fictional world in WhiteWrite. Below is the world canon: its laws and every entity (characters, locations, factions, artifacts). Stories and games are built on it, so it must not contradict itself.

Find the contradictions and inconsistencies INSIDE the canon (max 15, most serious first): entities that contradict the laws or each other (dates, places, relations, abilities, status), duplicated entities under different names, facts that cannot both be true. Do not invent problems; do not judge style. For each: what (the conflict, concretely), where (the entities/laws involved), options (2-4 ways to resolve it), target (card = the entity ref like "e:char_ab12cd" the fix belongs in, field = "description").
${answeredText(answered)}
CANON:
${canon}

Write ALL text in ${languageName}. Return ONLY valid JSON, no markdown:
{"contradictions":[{"what":"","where":"","options":[""],"target":{"card":"","field":"description"}}]}`;
}

function planPrompt(bible, engine, answered, gdd, languageName, shelves) {
  return `You are the producer of this game — a solo author working with an AI coding agent (Claude Code) and bought/ready prefabs. Using the Game Bible, the GDD analysis and the author's decisions below, write a PRODUCTION PLAN the way real studios run production, cut down for one person: its one goal is to reach a real, playable MVP in the shortest time, step by step, and only then grow it.

Pipeline (keep this structure, adapt the content to the game):
- Track "mvp" — five milestones with GATES, ids G0…G4, in this order:
  G0 Setup — repository, engine project, folder & naming conventions (SM_/M_/T_/A_ prefixes…), MCP connection, a headless build that succeeds. Gate: the empty project builds and runs.
  G1 Core loop in greybox — the 3Cs (character, camera, controls), the core mechanic, win/lose, ONE greybox level from primitives — no final art. Gate: the author plays 5 minutes and it is fun; tests pass.
  G2 First playable (vertical slice) — that same level styled: prefabs/models unified to the art direction, materials, light & post, UI skin, key SFX & music, performance budgets met. Gate: screenshot-quality, frame rate on the minimum spec, every used asset has a commercial-OK or with-conditions licence.
  G3 MVP feature-complete — every MUST system, progression, save/load, menus, all MVP levels. Gate: a stranger plays from start to finish without help.
  G4 Release candidate — bug fixing, credits & attribution, store page assets, the release build. Gate: the release checklist is green.
- Track "expansion" — 1-3 milestones (ids X1…): MORE content of systems already proven in the MVP (levels, enemies, items, quests). No new systems here.
- Track "extra" — 0-6 milestones (ids F1…), ONE new feature/system each, RANKED by value for the player ÷ cost. Each starts with its own small greybox prototype gate. Set cutLine = how many of them are worth doing at all; the rest are "below the line" (kept, not planned).
- Rule: a MUST card or system → MVP; more of a proven type → expansion; a new system → extra. Never plan styled/final art for a level before its greybox gate. Prefer ready prefabs (stand-ins) over making assets from scratch in the MVP.
- Every milestone: id, track, name, goal, entry (what must be true to start), deliverables (concrete list), gate (one sentence), accept (2-6 pass/fail checks with the kind of evidence: test, screenshot, video, build, playtest), budgets (performance / polygon / texture / memory budgets that apply, from the bible or sensible for the engine and platform), estimateDays (solo + AI + bought assets).
- Tasks inside each milestone: id like "G1.3" / "X1.2" / "F2.1", title, detail (what exactly, with the numbers/content from the bible — max 4 sentences), deps (task ids), size S|M|L, estimate (days), owner design|dev|art|audio|qa, priority must|should|could, assetState — for art/asset tasks the state the assets must reach in this milestone (greybox | standin = a ready prefab placed as is | styled = unified to the art direction | final), accept — 2-5 acceptance criteria the author can check (concrete and observable: "the wolf prefab spawns on track 2 with HP 60"), tests — how to verify (EditMode/PlayMode test or a manual check), cards — the bible cards this task touches, each {"ref": "c:..." | "e:..." | "new:<title>", "role": implements | uses-asset | in-level | follows-style | constrained-by} (follows-style = the art-direction / style card it must match, constrained-by = a law, budget or technical card it must respect), and prompt — a short ready-to-paste instruction for Claude Code working in the game repo (for dev tasks; for art/audio tasks — the generation or sourcing brief), max 6 lines. Group similar content into one task (e.g. "the 12 forest props" with their refs) instead of one task per card. 3-8 tasks per milestone.
- The bible must reach down to the details the art needs: art direction (palette, proportions, silhouettes, character style), texel density, materials (stone, grass, wood… surfaces), lighting mood, audio mood. health — what the bible still lacks for the MVP (issue, fix = what the author should add, cards = related refs); scaffold the missing cards below.
- dod — the MVP definition of done in 3-6 checkable lines; estimateWeeks — the whole MVP (G0…G4).
- parallel: which streams can run at the same time.
- risks with mitigation.
- gaps: things the engine/framework likely does not provide (need, missing, desiredApi, workaround). Empty for a generic engine unless obvious.
- Ground everything in the bible; where the bible is silent, choose the simplest option and say so in the task detail.
- scaffold — what the plan needs but the bible does NOT have yet, so the author can fill it in: cards (section = one of the game sections below by id, title, group = a subheading inside the section when it fits, need = what exactly must be made or decided, task = the task id that needs it) for missing prefabs, models, textures, animations, sounds, UI screens, references, mechanics, levels, items… Never duplicate a card that already exists (check titles; a card whose files include a model is already made). Add a new section only when no game section fits (name, about, why); then use its name as the card's section. Max 60 cards.

GAME SECTIONS (id — name):
${(shelves || []).filter((s) => s.kind === 'game').map((s) => `- ${s.id} — ${s.name}${s.groups.length ? ` (subheadings: ${s.groups.join(' | ')})` : ''}`).join('\n')}

Engine profile: ${ENGINE_PROFILES[engine] || ENGINE_PROFILES.generic}

GDD analysis: ${JSON.stringify(gdd)}
${answeredText(answered)}
BIBLE:
${bible}

Write ALL text in ${languageName}. Return ONLY valid JSON, no markdown:
{"plan":{"overview":"","dod":[""],"estimateWeeks":10,"engineNotes":"","cutLine":2,"health":[{"issue":"","fix":"","cards":["c:..."]}],"milestones":[{"id":"G0","track":"mvp","name":"","goal":"","entry":"","deliverables":[""],"gate":"","accept":[""],"budgets":"","estimateDays":2,"tasks":[{"id":"G0.1","title":"","detail":"","deps":[],"size":"M","estimate":1,"owner":"dev","priority":"must","assetState":"","accept":[""],"tests":[""],"cards":[{"ref":"c:...","role":"implements"}],"prompt":""}]}],"parallel":[""],"risks":[{"risk":"","mitigation":""}],"gaps":[{"need":"","missing":"","desiredApi":"","workaround":""}]},"scaffold":{"sections":[{"name":"","about":"","why":""}],"cards":[{"section":"assets","title":"","group":"","need":"","task":"G2.1"}]}}`;
}

// ---------- GitHub: the game's repository, read only on the author's button ----------
// games/{g}.repo { full, branch, private, connectedAt, syncedAt, sha } — visible to the owner; the token: repoTokens/{w}__{g} (no client access).
const MAX_REPO_DOC_CHARS = 80000;
const REPO_SKIP = /(^|\/)(node_modules|Library|Temp|Logs|obj|bin|Builds?|\.git|\.vs|\.idea|\.vscode|vendor|dist)\//;
const REPO_DOC = /\.(md|markdown|txt)$/i;
const REPO_ASSET = /\.(prefab|unity|asset|fbx|glb|gltf|obj|blend|cs|uasset|umap|tscn|tres|gd|shader|shadergraph|controller|anim)$/i;
const docRank = (p) => (/^(readme|game|gdd|design)[^/]*$/i.test(p) ? 0 : /^docs?\//i.test(p) ? 1 : !p.includes('/') ? 2 : 3);
const repoError = (status, message) => Object.assign(new Error(message), { httpStatus: status });
function parseRepo(v) {
  const s = String(v || '').trim().replace(/\.git$/, '');
  const m = s.match(/github\.com[/:]([\w.-]+)\/([\w.-]+)/) || s.match(/^([\w.-]+)\/([\w.-]+)\/?$/);
  return m ? m[1] + '/' + m[2] : '';
}
async function gh(path, token, raw) {
  const r = await fetch('https://api.github.com' + path, { headers: Object.assign({ Accept: raw ? 'application/vnd.github.raw' : 'application/vnd.github+json',
    'User-Agent': 'WhiteWrite', 'X-GitHub-Api-Version': '2022-11-28' }, token ? { Authorization: 'Bearer ' + token } : {}) });
  if (!r.ok) {
    throw repoError(400, r.status === 404 ? 'Репозиторій чи гілку не знайдено, або токен не має до них доступу'
      : r.status === 401 ? 'GitHub не прийняв токен' : r.status === 403 || r.status === 429 ? 'GitHub обмежив запити — додай токен або спробуй пізніше' : 'GitHub: HTTP ' + r.status);
  }
  return raw ? r.text() : r.json();
}
// The repo as text for the model: what changed since the last check, the asset/code inventory, then the docs (README/GDD/Docs first)
async function readRepo(full, branch, token, prevSha) {
  const enc = encodeURIComponent;
  const sha = (await gh(`/repos/${full}/commits/${enc(branch)}`, token)).sha;
  const tree = await gh(`/repos/${full}/git/trees/${sha}?recursive=1`, token);
  const files = (tree.tree || []).filter((t) => t.type === 'blob' && !REPO_SKIP.test(t.path));
  const docs = files.filter((f) => REPO_DOC.test(f.path) && (f.size || 0) < 300000).sort((a, b) => docRank(a.path) - docRank(b.path) || a.path.length - b.path.length);
  const parts = [];
  let budget = MAX_REPO_DOC_CHARS;
  for (const f of docs.slice(0, 40)) {
    if (budget < 500) break;
    const t = String(await gh(`/repos/${full}/contents/${f.path.split('/').map(enc).join('/')}?ref=${sha}`, token, true)).slice(0, budget);
    budget -= t.length;
    parts.push(`## FILE ${f.path}\n${t}`);
  }
  const assets = files.filter((f) => REPO_ASSET.test(f.path)).map((f) => f.path);
  const other = {};
  files.forEach((f) => { if (!REPO_DOC.test(f.path) && !REPO_ASSET.test(f.path)) { const x = (f.path.match(/\.([^./]+)$/) || [0, '-'])[1].toLowerCase(); other[x] = (other[x] || 0) + 1; } });
  let changed = [];
  if (prevSha && prevSha !== sha) {
    try { changed = ((await gh(`/repos/${full}/compare/${prevSha}...${sha}`, token)).files || []).map((f) => `${f.status} ${f.filename}`).slice(0, 150); } catch (e) { /* history rewritten — compare everything */ }
  }
  return { sha, text: [`# Repository ${full} @ ${branch} (${sha.slice(0, 7)})`,
    changed.length ? `## Changed since the last check (${prevSha.slice(0, 7)}):\n${changed.join('\n')}` : '',
    `## Asset & code inventory (${assets.length} files)\n${assets.join('\n').slice(0, 20000)}`,
    `Other files by type: ${Object.entries(other).map(([k, v]) => k + ' ' + v).join(', ') || '-'}`,
    tree.truncated ? '(GitHub truncated the file list)' : '', '# Documents', ...parts].filter(Boolean).join('\n\n') };
}
// Connect / disconnect: no AI, no tokens — only the owner of the world
async function repoLink(op, uid, worldId, gameId, body) {
  const worldRef = db.collection('worlds').doc(worldId), gameRef = worldRef.collection('games').doc(gameId);
  const [w, g] = await Promise.all([worldRef.get(), gameRef.get()]);
  if (!w.exists || w.data().owner !== uid || !g.exists) throw repoError(403, 'Гру не знайдено або немає доступу');
  const tokRef = db.collection('repoTokens').doc(worldId + '__' + gameId);
  if (op === 'repoDisconnect') {
    await tokRef.delete();
    await gameRef.update({ repo: admin.firestore.FieldValue.delete() });
    return { success: true };
  }
  const full = parseRepo(body.repo);
  if (!full) throw repoError(400, 'Вкажи репозиторій як owner/назва або посилання на GitHub');
  const token = str(body.token, 400);
  const info = await gh(`/repos/${full}`, token);
  const branch = str(body.branch, 120) || info.default_branch;
  await gh(`/repos/${info.full_name}/branches/${encodeURIComponent(branch)}`, token);
  if (token) await tokRef.set({ uid, token, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  else await tokRef.delete();
  const repo = { full: info.full_name, branch, private: !!info.private, connectedAt: admin.firestore.FieldValue.serverTimestamp() };
  await gameRef.update({ repo }); // replaces the whole field: a new repo starts without the old sha
  return { success: true, repo: { full: repo.full, branch, private: repo.private } };
}

function repoPrompt(repoText, bible, shelves, languageName, cards) {
  const shelfText = shelves.map((s) => `- ${s.id} (${s.kind === 'canon' ? `CANON ${s.canonKind}` : 'game'}): ${s.name}${s.fields.length ? ` — fields: ${s.fields.join(' | ')}` : ''}${s.groups.length ? ` — subheadings (put the fitting one into the first field): ${s.groups.join(' | ')}` : ''}`).join('\n');
  return `You are the librarian of WhiteWrite. Below is the Game Bible of one game (the design, written by the author on the world's canon) and the game's code repository (its documents and file inventory). Compare them.

1. What the REPOSITORY has and the BIBLE lacks — mechanics, systems, enemies, bosses, levels, items, prefabs/models, characters, places, laws of the world… Propose it the way a notes import does: canon entities in "canon" (kind characters|locations|factions|artifacts, name, description, "match" = the id of an entity the Bible already has, game-only details in gameFields), hard rules of the world in "laws", everything about the game in "cards" (section = a game shelf id, title, fields {"<field label>": "value"}; reuse an existing card's exact title and section to add to it). Only what is really in the repository — its documents, or assets/scripts whose names leave no doubt; never invent. Do not propose what the Bible already says.
2. Where the repository and the Bible DISAGREE — a number, a name, a mechanic done differently in code, a feature the Bible plans that the code dropped, an asset a card names that the repository does not have, a document that contradicts the canon → "contradictions": what (both sides, short), where ("repo: <path> · bible: <card title>"), 2-4 options how to resolve it, target — the Bible card ref ("c:..." / "e:...") and the field the decision belongs in.
3. "questions" — decisions the differences leave open (topic, question, why, options, priority blocker|important|nice).
If "Changed since the last check" is listed, look at those files first.

SHELVES:
${shelfText}
Existing game cards:
${cards.filter((c) => !c.canonRef).map((c) => `- [${c.section}] ${c.title || ''}`).join('\n') || '(none)'}

BIBLE:
${bible}

REPOSITORY:
${repoText}

Write ALL text in ${languageName} unless quoting the repository. Return ONLY valid JSON, no markdown fence:
{"laws":[""],"canon":[{"kind":"characters","name":"","description":"","match":"","gameFields":{}}],"cards":[{"section":"mechanics","title":"","fields":{}}],"contradictions":[{"what":"","where":"","options":[""],"target":{"card":"","field":""}}],"questions":[{"topic":"","question":"","why":"","options":[""],"priority":"important"}]}`;
}

// Split notes at headings into parts of at most IMPORT_PART_CHARS
const IMPORT_PART_CHARS = 20000;
function splitMarkdown(md) {
  const parts = [];
  let cur = '';
  md.split(/\n(?=#{1,3} )/).forEach((block) => {
    for (let i = 0; i < block.length; i += IMPORT_PART_CHARS) {
      const piece = block.slice(i, i + IMPORT_PART_CHARS);
      if (cur && cur.length + piece.length + 1 > IMPORT_PART_CHARS) { parts.push(cur); cur = ''; }
      cur += (cur ? '\n' : '') + piece;
    }
  });
  if (cur.trim()) parts.push(cur);
  return parts;
}

// Proposals of the parts → one: the same entity / card from two parts is merged
function mergeImports(results) {
  const key = (...a) => a.map((v) => String(v || '').trim().toLowerCase()).join('|');
  const out = { laws: [], canon: [], cards: [], contradictions: [], questions: [] };
  const canon = new Map(), cards = new Map(), laws = new Set();
  results.forEach((r) => {
    (Array.isArray(r && r.laws) ? r.laws : []).forEach((l) => { const k = key(l); if (!laws.has(k)) { laws.add(k); out.laws.push(l); } });
    (Array.isArray(r && r.canon) ? r.canon : []).forEach((e) => {
      if (!e) return;
      const k = key(e.kind, e.name), prev = canon.get(k);
      if (!prev) { canon.set(k, e); out.canon.push(e); return; }
      if (e.description && !String(prev.description || '').includes(e.description)) prev.description = [prev.description, e.description].filter(Boolean).join('\n\n');
      prev.match = prev.match || e.match;
      prev.gameFields = Object.assign({}, e.gameFields, prev.gameFields);
    });
    (Array.isArray(r && r.cards) ? r.cards : []).forEach((c) => {
      if (!c) return;
      const k = key(c.section, c.title), prev = cards.get(k);
      if (!prev) { cards.set(k, c); out.cards.push(c); return; }
      Object.entries(c.fields || {}).forEach(([f, v]) => { prev.fields = prev.fields || {}; prev.fields[f] = prev.fields[f] ? prev.fields[f] + '\n\n' + v : v; });
    });
    out.contradictions.push(...(Array.isArray(r && r.contradictions) ? r.contradictions : []));
    out.questions.push(...(Array.isArray(r && r.questions) ? r.questions : []));
  });
  return out;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) {
    const m = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI повернув не JSON');
    return JSON.parse(m[1] || m[0]);
  }
}

// Shelves the client sent (its sections with field labels in the author's language) — prompt input only.
function cleanShelves(a) {
  return list(a, 40, (s) => (s && str(s.id, 60) && str(s.name, 80) ? {
    id: str(s.id, 60), name: str(s.name, 80), kind: s.kind === 'canon' ? 'canon' : 'game',
    canonKind: CANON_KINDS.includes(s.canonKind) ? s.canonKind : '', fields: list(s.fields, 15, (f) => str(f, 60) || null),
    groups: list(s.groups, 30, (g) => str(g, 60) || null),
  } : null));
}

/**
 * Cloud Function: gamedevPlan
 * Input (POST JSON): { worldId, gameId, op: 'import' | 'analyze' | 'plan' | 'canonAudit' | 'repoConnect' | 'repoDisconnect' | 'repoSync', language?, markdown?, shelves?, repo?, branch?, token? }
 * Output: { success, tokensConsumed, tokensRemaining, proposal? } — analyze/plan write worlds/{w}/games/{g}/plan/current
 */
exports.gamedevPlan = onRequest({
  region: 'us-central1',
  secrets: [claudeApiKey],
  timeoutSeconds: 1800, // a plan for a big bible is a long generation
  memory: '512MiB'
}, async (req, res) => {
  return cors(req, res, async () => {
    let uid;
    let reservation = null;
    let gameRefForError = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      try {
        uid = (await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1])).uid;
      } catch (error) {
        return res.status(401).json({ error: 'Невірний токен автентифікації' });
      }

      const body = req.body || {};
      const op = oneOf(body.op, ['import', 'analyze', 'plan', 'canonAudit', 'repoConnect', 'repoDisconnect', 'repoSync'], 'analyze');
      const isCanon = op === 'canonAudit'; // the world alone: no game
      const worldId = str(body.worldId, 120);
      const gameId = str(body.gameId, 120);
      const languageName = LANGUAGES[body.language] || LANGUAGES.uk;
      if (!worldId || (!isCanon && !gameId)) return res.status(400).json({ error: 'Missing worldId/gameId' });
      const markdown = String(body.markdown || '');
      if (op === 'import' && !markdown.trim()) return res.status(400).json({ error: 'Порожній файл' });
      if (markdown.length > MAX_IMPORT_CHARS) return res.status(400).json({ error: `Файл завеликий. Максимум: ${MAX_IMPORT_CHARS} символів.`, code: 'INPUT_TOO_LONG' });

      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userPlan = userData.plan || 'free';
      if (!getPlanBudget(userPlan).allowGameDev) {
        return res.status(403).json({ error: 'Біблія гри доступна на тарифі Worldbuilder', code: 'PLAN_REQUIRED', plan: userPlan });
      }
      if (op === 'repoConnect' || op === 'repoDisconnect') {
        try { return res.status(200).json(await repoLink(op, uid, worldId, gameId, body)); }
        catch (e) { if (!e.httpStatus) throw e; return res.status(e.httpStatus).json({ error: e.message }); }
      }
      if (userData.subscriptionStatus !== 'active') {
        return res.status(403).json({ error: 'Активна підписка необхідна для генерації', requiresSubscription: true, plan: userPlan });
      }

      const worldRef = db.collection('worlds').doc(worldId);
      const gameRef = isCanon ? null : worldRef.collection('games').doc(gameId);
      gameRefForError = gameRef;
      const none = { exists: false, docs: [] };
      const [worldSnap, gameSnap, entitiesSnap, cardsSnap, planSnap, loreSnap] = await Promise.all([
        worldRef.get(), isCanon ? none : gameRef.get(), worldRef.collection('entities').get(),
        isCanon ? none : gameRef.collection('cards').get(), isCanon ? none : gameRef.collection('plan').doc('current').get(), worldRef.collection('lore').get()]);
      if (!worldSnap.exists || worldSnap.data().owner !== uid || (!isCanon && !gameSnap.exists)) return res.status(403).json({ error: 'Гру не знайдено або немає доступу' });

      const world = worldSnap.data(), game = isCanon ? {} : gameSnap.data(), prev = planSnap.exists ? planSnap.data() : {};
      const entities = entitiesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => !(e.origin && e.origin.confirmed === false));
      const lore = loreSnap.docs.map((d) => d.data());
      const cards = cardsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const engine = (game.engine && game.engine.profile) || 'generic';
      const answers = prev.answers || {};
      const answered = (prev.asked || []).filter((q) => str(answers[q.id], 1)).map((q) => ({ q: q.question, a: str(answers[q.id], 2000) }))
        .concat(decided(prev.contradictions, prev.resolved || {}));
      const audit = world.audit || {}, auditAnswers = world.auditAnswers || {};
      if (op === 'plan' && !prev.gdd) return res.status(400).json({ error: 'Спершу проаналізуй біблію', code: 'ANALYZE_FIRST' });
      const shelves = cleanShelves(body.shelves);
      let repoData = null; // read before any token is reserved: a GitHub error costs nothing
      if (op === 'repoSync') {
        if (!game.repo || !game.repo.full) return res.status(400).json({ error: 'Спершу підключи репозиторій', code: 'NO_REPO' });
        const tok = await db.collection('repoTokens').doc(worldId + '__' + gameId).get();
        try { repoData = await readRepo(game.repo.full, game.repo.branch, tok.exists ? tok.data().token : '', game.repo.sha); }
        catch (e) { if (!e.httpStatus) throw e; return res.status(e.httpStatus).json({ error: e.message }); }
      }

      // Priced by real output (scene economy entry), logged separately
      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {}).claude : null;
      const { tier, model } = await modelFor(db, userData, userData.plan || 'free'); // the author's Claude model (Account)
      const reserveCost = featureCost(byOp(isCanon ? 'canonAudit' : op), providerEconomy && providerEconomy.cost, tier); // paid-features.js — gamebible.js costOf reads the same
      const balance = getBalance(userData);
      if (balance.available < reserveCost) {
        return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      }
      try {
        reservation = await reserve(db, uid, reserveCost);
      } catch (error) {
        if (error.code !== 'OUT_OF_TOKENS') throw error;
        return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: error.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      }

      // A big import is split into parts sorted in parallel (one long call ran past the function timeout)
      const prompts = isCanon ? [canonAuditPrompt(bibleText(world, entities, [], {}, [], lore), decided(audit.contradictions, auditAnswers), languageName)]
        : op === 'import' ? splitMarkdown(markdown).map((part) => importPrompt(part, shelves, entities, world, languageName, cards))
        : op === 'repoSync' ? [repoPrompt(repoData.text, bibleText(world, entities, cards, game, shelves, lore), shelves, languageName, cards)]
        : [op === 'plan' ? planPrompt(bibleText(world, entities, cards, game, shelves, lore), engine, answered, prev.gdd, languageName, shelves)
          : analyzePrompt(bibleText(world, entities, cards, game, shelves, lore), engine, answered, languageName)];
      const prompt = prompts.join('');
      const anthropic = new Anthropic({ apiKey: claudeApiKey.value() });
      // the page shows "AI is working" from this marker even after a reload
      if (isCanon) await worldRef.set({ auditRunning: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      else if (op !== 'import' && op !== 'repoSync') await gameRef.collection('plan').doc('current').set({ running: { op, at: admin.firestore.FieldValue.serverTimestamp() } }, { merge: true });
      // a model that vanished mid-flight → the whole batch retries on a working one (claude.js withFallback)
      const messages = await withFallback(model, (m) => Promise.all(prompts.map((content) => anthropic.messages.stream({
        model: m,
        max_tokens: op === 'plan' ? 48000 : 24000, // thinking counts toward max_tokens
        messages: [{ role: 'user', content }],
        output_config: { effort: 'medium' }
      }).finalMessage())));
      if (messages.some((m) => m.stop_reason === 'refusal')) throw new Error('Claude відмовився виконати запит');
      if (messages.some((m) => m.stop_reason === 'max_tokens')) throw new Error('Відповідь AI обірвалась — забагато матеріалу для одного проходу');
      const results = messages.map((m) => parseJson(m.content.filter((b) => b.type === 'text').map((b) => b.text).join('')));
      const usage = messages.reduce((u, m) => ({ input_tokens: u.input_tokens + (m.usage.input_tokens || 0), output_tokens: u.output_tokens + (m.usage.output_tokens || 0) }), { input_tokens: 0, output_tokens: 0 });
      const parsed = results[0];

      let proposal = null;
      if (isCanon) {
        const fresh = list(parsed && parsed.contradictions, 15, cleanContradiction);
        await worldRef.set({ audit: { contradictions: mergeContradictions(audit.contradictions, auditAnswers, fresh), at: admin.firestore.FieldValue.serverTimestamp() },
          auditRunning: admin.firestore.FieldValue.delete() }, { merge: true });
      } else if (op === 'import') {
        proposal = cleanImport(mergeImports(results), shelves, entities, world);
      } else if (op === 'repoSync') {
        proposal = cleanImport(parsed, shelves, entities, world);
        await gameRef.set({ repo: { syncedAt: admin.firestore.FieldValue.serverTimestamp(), sha: repoData.sha } }, { merge: true });
      } else {
        const update = { updatedAt: admin.firestore.FieldValue.serverTimestamp(), engine, running: admin.firestore.FieldValue.delete() };
        if (op === 'analyze') {
          const a = cleanAnalysis(parsed);
          // keep answered questions; open ones are replaced by the fresh analysis
          const kept = (prev.asked || []).filter((q) => str(answers[q.id], 1));
          Object.assign(update, { gdd: a.gdd, contradictions: mergeContradictions(prev.contradictions, prev.resolved || {}, a.contradictions),
            asked: kept.concat(a.questions), analyzedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else {
          Object.assign(update, { plan: cleanPlan(parsed), scaffold: cleanScaffold(parsed, shelves), plannedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        await gameRef.collection('plan').doc('current').set(update, { merge: true });
        if (op === 'plan') await writeTasks(gameRef, update.plan);
      }

      const { userCost } = await charge(db, uid, 'generateScene', messages[0].model || model, usage, null, {
        provider: 'claude',
        targetWords: Math.round(usage.output_tokens * 0.75),
        estimatedInputTokens: Math.ceil(prompt.length / 4),
        reserved: reservation,
        logAs: 'gamedev_' + op
      });
      reservation = null;

      res.status(200).json({ success: true, proposal, tokensConsumed: userCost, tokensRemaining: Math.max(0, balance.available - userCost) });
    } catch (error) {
      console.error('gamedevPlan error:', error);
      if (gameRefForError) await gameRefForError.collection('plan').doc('current').set({ running: admin.firestore.FieldValue.delete() }, { merge: true }).catch(() => {});
      else if (req.body && req.body.op === 'canonAudit' && req.body.worldId) {
        await db.collection('worlds').doc(String(req.body.worldId)).set({ auditRunning: admin.firestore.FieldValue.delete() }, { merge: true }).catch(() => {});
      }
      if (reservation) await refund(db, uid, reservation).catch((e) => console.error('[gamedevPlan] Refund failed:', e));
      res.status(500).json({ error: `Помилка біблії гри: ${error.message}` });
    }
  });
});
