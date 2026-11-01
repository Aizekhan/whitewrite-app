// ============================================================================
// Quests & dialogues — graph checks. SINGLE SOURCE for the Game Bible (window.__NARRATIVE, copy in
// app/firebase/ made by scripts/build-app.mjs) and the MCP server (require). Edit THIS file.
// ============================================================================
// Quests and dialogues are a game-design decision: they live in the GAME and link to the game's cards ("c:<cardId>")
// and to canon entities (their plain id) — characters, locations, factions, artifacts and canon events.
// Quest     worlds/{w}/games/{g}/quests/{id}    { title, type, approval, giver, characters[], locations[], factions[], artifacts[], events[],
//                                       prereqs[questId], repeat {mode once|repeatable|daily, cooldown}, stages[] }
//   stage   { id, title, objective, next: [{ to, cond }], end, fail }
// Dialogue  worlds/{w}/games/{g}/dialogues/{id} { title, type, approval, participants[], questId, stageId, location, trigger, nodes[] }
//   node    { id, speaker, text, locKey, cond, effects, choices: [{ text, to, cond }], next, end }
// The first stage / node is the start. Issues: { level: 'error' | 'warn', code, ...params } — the UI words them.

const REF_FIELDS = ['giver', 'characters', 'locations', 'factions', 'artifacts', 'events'];
// game card sections that can take part in a quest, and the role they play (enemies are characters, levels are places…)
const CARD_ROLES = { characters: 'characters', enemies: 'characters', locations: 'locations', levels: 'locations', factions: 'factions', items: 'artifacts', gear: 'artifacts' };

// Everything a quest or dialogue may link to: confirmed canon entities (id) + the game's own cards (c:<id>) in the role sections.
// Canon entities seen in the game are cards with canonRef — they are linked by the entity id, so they are not repeated.
function refPool(entities, cards) {
  const out = (entities || []).map((e) => ({ id: e.id, kind: e.kind, name: e.name || e.title || '', desc: e.desc || e.description || '' }));
  (cards || []).forEach((c) => {
    const kind = !c.canonRef && CARD_ROLES[c.section];
    if (kind) out.push({ id: 'c:' + c.id, kind, card: true, section: c.section, name: c.title || '', desc: Object.values(c.fields || {}).filter((v) => typeof v === 'string').join(' · ') });
  });
  return out;
}
const SPEAKERS = ['', 'player', 'narrator'];

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const has = (list, id) => list.some((x) => x && x.id === id);

// Shared walk of a stage / node graph from its first item: broken links, duplicates, unreachable items,
// dead ends (no way on and not marked as an end) and loops with no way out.
function graphIssues(items, edgesOf, isEnd, kind) {
  const out = [], ids = {}, byId = {};
  items.forEach((n) => { if (ids[n.id]) out.push({ level: 'error', code: 'dupId', kind, id: n.id }); ids[n.id] = 1; byId[n.id] = n; });
  const edges = {};
  items.forEach((n) => {
    edges[n.id] = edgesOf(n).filter((to) => {
      if (byId[to]) return true;
      out.push({ level: 'error', code: 'badLink', kind, from: n.id, to });
      return false;
    });
  });
  if (!items.length) return out;
  const seen = {}, queue = [items[0].id];
  seen[items[0].id] = 1;
  while (queue.length) edges[queue.shift()].forEach((to) => { if (!seen[to]) { seen[to] = 1; queue.push(to); } });
  // a terminal stops the walk: marked as an end, or nowhere to go; the rest must be able to reach one
  const terminal = (n) => isEnd(n) || !edges[n.id].length, back = {};
  items.forEach((n) => edges[n.id].forEach((to) => { (back[to] = back[to] || []).push(n.id); }));
  const exits = {}, stack = items.filter(terminal).map((n) => n.id);
  stack.forEach((id) => { exits[id] = 1; });
  while (stack.length) (back[stack.pop()] || []).forEach((from) => { if (!exits[from]) { exits[from] = 1; stack.push(from); } });
  items.forEach((n) => {
    if (!seen[n.id]) out.push({ level: 'warn', code: 'unreachable', kind, id: n.id });
    else if (!exits[n.id]) out.push({ level: 'error', code: 'loop', kind, id: n.id });
    else if (!isEnd(n) && !edges[n.id].length) out.push({ level: 'warn', code: 'deadEnd', kind, id: n.id });
  });
  return out;
}

function refIssues(doc, fields, entities) {
  const out = [];
  fields.forEach((f) => arr(doc[f]).forEach((id) => { if (!has(entities, id)) out.push({ level: 'error', code: 'missingRef', field: f, id }); }));
  return out;
}

// ctx: { entities: refPool(…), quests: [{ id, prereqs, stages }] }
function validateQuest(q, ctx) {
  const out = [], quests = (ctx && ctx.quests) || [], stages = arr(q.stages);
  if (!String(q.title || '').trim()) out.push({ level: 'warn', code: 'noTitle' });
  if (!q.giver) out.push({ level: 'warn', code: 'noGiver' });
  out.push(...refIssues(q, REF_FIELDS, (ctx && ctx.entities) || []));
  arr(q.prereqs).forEach((id) => { if (!has(quests, id)) out.push({ level: 'error', code: 'missingQuest', id }); });
  // a prerequisite chain that comes back to this quest can never start
  const byId = {}; quests.forEach((x) => { byId[x.id] = x; }); byId[q.id] = q;
  const path = [], done = {};
  const walk = (id) => {
    if (id === q.id && path.length) return true;
    if (done[id] || !byId[id]) return false;
    done[id] = 1; path.push(id);
    if (arr(byId[id].prereqs).some(walk)) return true;
    path.pop(); return false;
  };
  if (walk(q.id)) out.push({ level: 'error', code: 'prereqCycle', path: path.concat(q.id) });
  if (q.repeat && q.repeat.mode === 'repeatable' && !String(q.repeat.cooldown || '').trim()) out.push({ level: 'warn', code: 'noCooldown' });
  if (!stages.length) { out.push({ level: 'error', code: 'noStages' }); return out; }
  if (!stages.some((s) => s.end && !s.fail)) out.push({ level: 'error', code: 'noEnd' });
  out.push(...graphIssues(stages, (s) => arr(s.next).map((x) => x && x.to).filter(Boolean), (s) => !!(s.end || s.fail), 'stage'));
  return out;
}

// ctx: { entities: [{ id }], quests: [{ id, stages }] }
function validateDialogue(d, ctx) {
  const out = [], nodes = arr(d.nodes), parts = arr(d.participants);
  if (!String(d.title || '').trim()) out.push({ level: 'warn', code: 'noTitle' });
  if (!parts.length) out.push({ level: 'warn', code: 'noParticipants' });
  out.push(...refIssues(d, ['participants', 'location'], (ctx && ctx.entities) || []));
  if (d.questId) {
    const q = ((ctx && ctx.quests) || []).find((x) => x.id === d.questId);
    if (!q) out.push({ level: 'error', code: 'missingQuest', id: d.questId });
    else if (d.stageId && !has(arr(q.stages), d.stageId)) out.push({ level: 'error', code: 'missingStage', id: d.stageId });
  }
  if (!nodes.length) { out.push({ level: 'error', code: 'noNodes' }); return out; }
  nodes.forEach((n) => {
    if (!String(n.text || '').trim()) out.push({ level: 'warn', code: 'emptyText', id: n.id });
    if (SPEAKERS.indexOf(n.speaker || '') < 0 && parts.indexOf(n.speaker) < 0) out.push({ level: 'warn', code: 'speakerNotIn', id: n.id, speaker: n.speaker });
  });
  out.push(...graphIssues(nodes, (n) => arr(n.choices).map((c) => c && c.to).filter(Boolean).concat(n.next ? [n.next] : []), (n) => !!n.end, 'node'));
  return out;
}

const worst = (issues) => (issues.some((x) => x.level === 'error') ? 'error' : issues.length ? 'warn' : '');

// ---------- export to RPG Framework (≥ 0.32.0) content import: format "rpgframework.content/1" ----------
// Unity: -executeMethod RPGFramework.ContentImport.Editor.ContentAssetImport.ImportFromCommandLine -contentFile <file>
// (exit 0 imported · 1 errors, nothing written · 2 failed). Refs (c:<card> / canon ids) travel as opaque strings.
const CONTENT_FORMAT = 'rpgframework.content/1';
const UNIT_SEC = { s: 1, sec: 1, с: 1, m: 60, min: 60, хв: 60, h: 3600, hr: 3600, hour: 3600, hours: 3600, год: 3600, d: 86400, day: 86400, days: 86400, дн: 86400, дні: 86400, днів: 86400, доба: 86400 };
// "24 h" / "30 хв" / "2 дні" → seconds; unknown text → 0
function cooldownSeconds(t) {
  const m = String(t || '').trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*([\p{L}]*)/u);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(',', '.')), u = m[2] || 'h', k = Object.keys(UNIT_SEC).find((x) => u === x || (u.length > 1 && x.startsWith(u)) || u.startsWith(x));
  return k ? Math.round(n * UNIT_SEC[k]) : 0;
}
const EFFECT_KINDS = { give_item: 'giveItem', take_item: 'takeItem', give_currency: 'giveCurrency', take_currency: 'takeCurrency', give_gold: 'giveCurrency', take_gold: 'takeCurrency',
  start_quest: 'acceptQuest', accept_quest: 'acceptQuest', complete_quest: 'completeQuest', signal_quest: 'signalQuest', set_flag: 'setVariable', set_var: 'setVariable',
  skill_points: 'grantSkillPoints', reputation: 'changeReputation', event: 'raiseEvent' };
// the author's free text "give_item:key; set_flag:met; give_currency:gold:50" → [{ kind, target, amount }]
function parseEffects(t) {
  return String(t || '').split(/[;\n]/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const p = x.split(':').map((s) => s.trim()), key = p[0].toLowerCase().replace(/[\s-]+/g, '_');
    const e = { kind: EFFECT_KINDS[key] || p[0], target: p[1] || '' };
    const amt = parseFloat(p[2]);
    if (!isNaN(amt)) e.amount = amt; else if (key === 'set_flag') e.amount = 1;
    return e;
  });
}
const cond = (t) => (String(t || '').trim() ? { type: 'custom', id: String(t).trim() } : undefined);
function questToContent(q) {
  const mode = (q.repeat && q.repeat.mode) || 'once', stages = arr(q.stages);
  const out = { id: q.id, title: q.title || '', type: q.type || '', description: q.summary || '', prerequisites: arr(q.prereqs),
    repeatable: mode !== 'once',
    objectives: String(q.objectives || '').split('\n').map((x) => x.trim()).filter(Boolean).map((d, i) => ({ id: 'o' + (i + 1), type: 'custom', description: d })),
    rewards: String(q.rewards || '').trim() ? [{ type: 'custom', id: String(q.rewards).trim() }] : [],
    start: (stages[0] || {}).id || '',
    stages: stages.map((s) => ({ id: s.id, title: s.title || '', description: s.objective || '', objectives: [],
      next: arr(s.next).filter((b) => b && b.to).map((b) => ({ to: b.to, condition: b.cond || '' })), outcome: s.fail ? 'failure' : s.end ? 'success' : 'none' })),
    refs: { giver: q.giver || '', characters: arr(q.characters), locations: arr(q.locations), factions: arr(q.factions), artifacts: arr(q.artifacts), events: arr(q.events) } };
  const cd = mode === 'daily' ? 86400 : mode === 'repeatable' ? cooldownSeconds(q.repeat.cooldown) : 0;
  if (cd) out.cooldownSeconds = cd;
  return out;
}
function dialogueToContent(d) {
  const nodes = arr(d.nodes);
  const out = { id: d.id, title: d.title || '', type: d.type || '', start: (nodes[0] || {}).id || '', participants: arr(d.participants),
    nodes: nodes.map((n) => {
      // the framework refuses a start node of type "end" (startIsEnd): a one-line talk goes as a plain line with no next (ends it too)
      const x = { id: n.id, type: n.end && n !== nodes[0] ? 'end' : '', speaker: n.speaker || '', text: n.text || '', key: n.locKey || '', next: n.next ? [n.next] : [],
        choices: arr(n.choices).map((c, j) => ({ id: 'c' + (j + 1), text: c.text || '', to: c.to || '', ...(cond(c.cond) ? { condition: cond(c.cond) } : {}) })),
        effects: parseEffects(n.effects) };
      if (cond(n.cond)) x.condition = cond(n.cond);
      return x;
    }) };
  if (d.questId) { out.quest = d.questId; if (d.stageId) out.stage = d.stageId; }
  if (d.location) out.location = d.location;
  return out;
}
// only what the author approved goes to the game; meta tells where it came from
function toFrameworkContent(quests, dialogues, meta) {
  const ok = (x) => x && x.approval === 'approved';
  return { schema: CONTENT_FORMAT, source: Object.assign({ tool: 'WhiteWrite' }, meta || {}),
    quests: arr(quests).filter(ok).map(questToContent), dialogues: arr(dialogues).filter(ok).map(dialogueToContent) };
}

const NARRATIVE = { validateQuest, validateDialogue, graphIssues, worst, refPool, CARD_ROLES, toFrameworkContent, parseEffects, cooldownSeconds, CONTENT_FORMAT };
if (typeof module !== 'undefined' && module.exports) module.exports = NARRATIVE;
if (typeof window !== 'undefined') window.__NARRATIVE = NARRATIVE;
