// ============================================================================
// Quests & dialogues — graph checks. SINGLE SOURCE for the World Bible (window.__NARRATIVE, copy in
// app/firebase/ made by scripts/build-app.mjs) and the MCP server (require). Edit THIS file.
// ============================================================================
// Quest     worlds/{w}/quests/{id}    { title, type, approval, giver, characters[], locations[], factions[], artifacts[],
//                                       prereqs[questId], repeat {mode once|repeatable|daily, cooldown}, stages[] }
//   stage   { id, title, objective, next: [{ to, cond }], end, fail }
// Dialogue  worlds/{w}/dialogues/{id} { title, type, approval, participants[], questId, stageId, location, trigger, nodes[] }
//   node    { id, speaker, text, locKey, cond, effects, choices: [{ text, to, cond }], next, end }
// The first stage / node is the start. Issues: { level: 'error' | 'warn', code, ...params } — the UI words them.

const REF_FIELDS = ['giver', 'characters', 'locations', 'factions', 'artifacts'];
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

// ctx: { entities: [{ id }], quests: [{ id, prereqs, stages }] }
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

const NARRATIVE = { validateQuest, validateDialogue, graphIssues, worst };
if (typeof module !== 'undefined' && module.exports) module.exports = NARRATIVE;
if (typeof window !== 'undefined') window.__NARRATIVE = NARRATIVE;
