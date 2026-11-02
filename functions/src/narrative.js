// Quests & dialogues of a GAME (Game Bible «Квести й діалоги»): AI drafts from a source — a story, a canon entity, a culture entry or a game card.
// POST { worldId, gameId, op: questDraft | dialogueDraft, source?: { type, id }, draft?, wish?, language? } with the author's ID token.
// Returns a PROPOSAL only — nothing is written: the author accepts, edits or rejects every field in the editor (spec 2.2).
// Links are kept only when the id exists — a canon entity (its id) or a game card (c:<id>, narrative-validate.js refPool);
// anything new the AI invents is returned as `ideas`, never as canon. Access: allowGameDev (Worldbuilder), an active subscription; reserve → Claude → charge the real cost (paid-features.js questDraft / dialogueDraft).
const { onRequest, admin, db, cors, charge, getBalance, reserve, refund, getPlanBudget, claudeApiKey, buildCanonContext } = require('./common');
const { payerFor } = require('./team')._team; // Команда: an admin's ✦ is paid by the world's owner
const { emptyCanon, CANON_KINDS } = require('../canon-store.js');
const { featureCost, byOp } = require('../paid-features.js');
const { refPool } = require('../narrative-validate.js');
const { modelFor, claudeText } = require('./claude');

const LANGUAGES = { uk: 'Ukrainian', en: 'English' };
const QUEST_TYPES = ['main', 'side', 'faction', 'companion', 'contract', 'event', 'tutorial'];
const DIALOGUE_TYPES = ['narrative', 'quest', 'ambient', 'trader', 'event', 'tutorial', 'social'];
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const list = (a, n, f) => (Array.isArray(a) ? a : []).slice(0, n * 2).map(f).filter((x) => x != null && x !== '').slice(0, n);
const oneOf = (v, all, def) => (all.includes(v) ? v : def);

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) {
    const m = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI повернув не JSON');
    return JSON.parse(m[1] || m[0]);
  }
}

// The AI refers to stages / lines by their position (1-based) — the server turns them into stable ids s1… / n1…
function cleanQuest(p, ents) {
  const ok = (kind) => (id) => (ents.some((e) => e.id === id && (!kind || e.kind === kind)) ? id : null);
  const stages = list(p.stages, 12, (s) => (s && (str(s.title, 160) || str(s.objective, 400)) ? s : null));
  const sid = (i) => (Number.isInteger(i) && i >= 1 && i <= stages.length ? 's' + i : null);
  return {
    title: str(p.title, 160), type: oneOf(p.type, QUEST_TYPES, 'side'), summary: str(p.summary, 3000),
    giver: ok('characters')(str(p.giver, 80)) || '',
    characters: list(p.characters, 20, ok('characters')), locations: list(p.locations, 20, ok('locations')),
    factions: list(p.factions, 20, ok('factions')), artifacts: list(p.artifacts, 20, ok('artifacts')), events: list(p.events, 20, ok('events')),
    objectives: list(p.objectives, 10, (o) => str(o, 300) || null).join('\n'),
    stages: stages.map((s, i) => ({ id: 's' + (i + 1), title: str(s.title, 160), objective: str(s.objective, 400),
      next: list(s.next, 4, (b) => (b && sid(+b.to) && sid(+b.to) !== 's' + (i + 1) ? { to: sid(+b.to), cond: str(b.cond, 200) } : null)),
      end: !!s.end && !s.fail, fail: !!s.fail })),
    rewards: str(p.rewards, 1000), hooks: str(p.hooks, 1000),
    repeat: { mode: oneOf(p.repeat && p.repeat.mode, ['once', 'repeatable', 'daily'], 'once'), cooldown: str(p.repeat && p.repeat.cooldown, 40) },
    ideas: list(p.ideas, 8, (x) => str(x, 300) || null),
  };
}
function cleanDialogue(p, ents) {
  const chars = ents.filter((e) => e.kind === 'characters').map((e) => e.id);
  const participants = list(p.participants, 8, (id) => (chars.includes(str(id, 80)) ? str(id, 80) : null));
  const nodes = list(p.nodes, 40, (n) => (n && str(n.text, 1000) ? n : null));
  const nid = (i) => (Number.isInteger(i) && i >= 1 && i <= nodes.length ? 'n' + i : '');
  return {
    title: str(p.title, 160), type: oneOf(p.type, DIALOGUE_TYPES, 'narrative'), trigger: str(p.trigger, 300),
    participants, location: (ents.find((e) => e.id === str(p.location, 80) && e.kind === 'locations') || {}).id || '',
    nodes: nodes.map((n, i) => {
      const sp = str(n.speaker, 80);
      const choices = list(n.choices, 4, (c) => (c && str(c.text, 200) ? { text: str(c.text, 200), to: nid(+c.to), cond: str(c.cond, 200) } : null));
      const next = choices.length ? '' : nid(+n.next);
      return { id: 'n' + (i + 1), speaker: sp === 'player' || sp === 'narrator' || participants.includes(sp) ? sp : '', text: str(n.text, 1000), locKey: '',
        cond: str(n.cond, 200), effects: str(n.effects, 200), choices, next, end: !!n.end || (!next && !choices.length) };
    }),
    ideas: list(p.ideas, 8, (x) => str(x, 300) || null),
  };
}

async function sourceText(uid, worldId, gref, src, ents, lore) {
  const type = str(src && src.type, 20), id = str(src && src.id, 120);
  if (!type || !id) return '';
  if (type === 'story') {
    const p = await db.collection('projects').doc(id).get();
    if (!p.exists || p.data().owner !== uid || p.data().worldId !== worldId) return '';
    const scenes = await p.ref.collection('scenes').get();
    const text = scenes.docs.map((d) => d.data()).sort((a, b) => (a.n || 0) - (b.n || 0))
      .map((s) => `[scene ${s.n || ''}] ${str(s.text || s.content, 4000)}`).join('\n').slice(0, 24000);
    return `A STORY of this world — "${str(p.data().title, 200)}": ${str(p.data().desc, 1500)}\n${text}`;
  }
  if (type === 'quest') { // a dialogue for a quest: the quest is its source
    const q = await gref.collection('quests').doc(id).get();
    if (!q.exists) return '';
    const d = q.data();
    return `The QUEST this dialogue belongs to — "${str(d.title, 200)}": ${str(d.summary, 2000)}
Giver: ${d.giver || '-'}
Stages: ` +
      (d.stages || []).map((s) => `[${s.id}] ${str(s.title, 160)} — ${str(s.objective, 300)}`).join('; ');
  }
  if (type === 'lore') {
    const l = lore.find((x) => x.id === id); if (!l) return '';
    return `A CULTURE entry (${l.group || ''}) "${str(l.name, 200)}": ${str(l.desc, 3000)} ${Object.values(l.fields || {}).map((v) => str(v, 1000)).join(' · ')}`;
  }
  if (type === 'card') { // a game card: the game's own design
    const c = ents.find((x) => x.id === 'c:' + id); if (!c) return '';
    return `A GAME CARD (${c.section}) [${c.id}] "${c.name}": ${str(c.desc, 3000)}`;
  }
  const e = ents.find((x) => x.id === id && !x.card); if (!e) return '';
  return `A CANON ${e.kind} [${e.id}] "${e.name || e.title || ''}": ${str(e.desc || e.description, 3000)} ${Object.values(e.dossier || {}).map((v) => str(v, 1500)).join(' · ')}`;
}

function questPrompt(lang) {
  return `Return ONLY JSON:
{ "title": "", "type": "${QUEST_TYPES.join('|')}", "summary": "<premise, motivation, the quest's role in the world — 2-5 sentences>",
  "giver": "<character id or empty>", "characters": ["<ids>"], "locations": ["<ids>"], "factions": ["<ids>"], "artifacts": ["<ids>"], "events": ["<canon event ids the quest builds on>"],
  "objectives": ["<what the player does>"],
  "stages": [ { "title": "", "objective": "", "next": [ { "to": <stage number, 1-based>, "cond": "<condition or empty>" } ], "end": false, "fail": false } ],
  "rewards": "<rewards, no fixed economy numbers unless the canon gives them>", "hooks": "<how the player learns about it>",
  "repeat": { "mode": "once|repeatable|daily", "cooldown": "" },
  "ideas": ["<anything NEW you would add to the world — characters, places, items — as short notes; these are not canon>"] }
Rules: the first stage is the start; at least one stage has "end": true; every other stage leads somewhere; 3–7 stages; branches only where they matter.
Use ONLY ids from the list below for links (game cards "c:…" and canon ids); never invent ids. Write in ${lang}.`;
}
function dialoguePrompt(lang) {
  return `Return ONLY JSON:
{ "title": "", "type": "${DIALOGUE_TYPES.join('|')}", "trigger": "<when it starts>", "participants": ["<character ids>"], "location": "<location id or empty>",
  "nodes": [ { "speaker": "<a participant id | player | narrator>", "text": "", "cond": "", "effects": "", "next": <line number, 1-based, or null>,
               "choices": [ { "text": "<player choice>", "to": <line number>, "cond": "" } ], "end": false } ],
  "ideas": ["<anything NEW as short notes; not canon>"] }
Rules: the first line is the start; a line has either "next" or "choices"; the conversation reaches an end ("end": true); 4–16 lines; voices true to the canon.
Use ONLY ids from the list below (game cards "c:…" and canon ids); never invent ids. Write in ${lang}.`;
}

exports.narrativeDraft = onRequest({ region: 'us-central1', secrets: [claudeApiKey], timeoutSeconds: 300 }, async (req, res) => {
  return cors(req, res, async () => {
    let uid, reservation = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      try { uid = (await admin.auth().verifyIdToken(auth.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const body = req.body || {};
      uid = await payerFor(uid, body.worldId); // a team admin acts on the owner's tokens (team.js)
      const op = oneOf(body.op, ['questDraft', 'dialogueDraft'], '');
      const worldId = str(body.worldId, 120), gameId = str(body.gameId, 120);
      if (!op || !worldId || !gameId) return res.status(400).json({ error: 'Missing op/worldId/gameId' });
      const lang = LANGUAGES[body.language] || LANGUAGES.uk;
      const wref = db.collection('worlds').doc(worldId), gref = wref.collection('games').doc(gameId);
      const [w, g, userDoc] = await Promise.all([wref.get(), gref.get(), db.collection('users').doc(uid).get()]);
      if (!w.exists || w.data().owner !== uid || !g.exists) return res.status(403).json({ error: 'Гру не знайдено або немає доступу' });
      if (w.data().freeze) return res.status(423).json({ error: 'Світ заморожено (Маркет): зміни недоступні', code: 'FROZEN' });
      const userData = userDoc.exists ? userDoc.data() : {};
      if (!getPlanBudget(userData.plan || 'free').allowGameDev) return res.status(403).json({ error: 'Квести й діалоги — у тарифі Worldbuilder', code: 'PLAN_REQUIRED' });
      if (userData.subscriptionStatus !== 'active') return res.status(403).json({ error: 'Активна підписка необхідна для генерації', requiresSubscription: true });

      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {}).claude : null;
      const { tier, model } = await modelFor(db, userData, userData.plan || 'free');
      const reserveCost = featureCost(byOp(op), providerEconomy && providerEconomy.cost, tier); // gamebible.js shows the same price
      const balance = getBalance(userData);
      if (balance.available < reserveCost) return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      try { reservation = await reserve(db, uid, reserveCost); } catch (e) {
        if (e.code !== 'OUT_OF_TOKENS') throw e;
        return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: e.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      }

      const [entSnap, loreSnap, qSnap, cardSnap] = await Promise.all([wref.collection('entities').get(), wref.collection('lore').get(), gref.collection('quests').get(), gref.collection('cards').get()]);
      const canonEnts = entSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => CANON_KINDS.includes(e.kind) && !(e.origin && e.origin.confirmed === false));
      const ents = refPool(canonEnts, cardSnap.docs.map((d) => ({ id: d.id, ...d.data() }))); // canon + the game's own cards
      const lore = loreSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const canon = emptyCanon(), world = w.data();
      ['tagline', 'summary', 'facts', 'rules'].forEach((f) => { if (world[f] !== undefined) canon.world[f] = world[f]; });
      canonEnts.forEach((e) => { canon[e.kind][e.id] = e; });
      const ids = ents.map((e) => `${e.id} = ${e.card ? 'game card, ' + e.section : 'canon ' + e.kind.slice(0, -1)} "${e.name}"`).join('\n');
      const quests = qSnap.docs.map((d) => `"${str(d.data().title, 120)}" (${d.data().type || ''})`).join('; ');
      const src = await sourceText(uid, worldId, gref, body.source, ents, lore);
      const isQ = op === 'questDraft';
      const draft = body.draft && typeof body.draft === 'object' ? JSON.stringify(body.draft).slice(0, 6000) : '';
      const system = `You are a game narrative designer for the game "${str(g.data().title, 160)}", built inside an established world. The world's laws are unbreakable; facts and entity descriptions are true.
Quests and dialogues are design decisions of THIS game: prefer its own cards (ids "c:…"), lean on canon characters and events where they fit.
You PROPOSE drafts; the author decides. Never contradict the canon.

CANON:
${buildCanonContext(canon)}

IDS (use exactly these for links):
${ids || '(none yet)'}
${lore.length ? '\nCULTURE: ' + lore.map((l) => `${l.name} — ${str(l.desc, 300)}`).join('; ') : ''}`;
      const prompt = `${isQ ? 'Draft a QUEST' : 'Draft a DIALOGUE'} for this world.
${src ? 'Base it on this SOURCE:\n' + src + '\n' : ''}${body.wish ? 'The author wants: ' + str(body.wish, 1500) + '\n' : ''}${draft ? 'What the author already filled in (keep it, build on it): ' + draft + '\n' : ''}${isQ && quests ? 'Quests that already exist (do not repeat them): ' + quests + '\n' : ''}
${isQ ? questPrompt(lang) : dialoguePrompt(lang)}`;
      const msg = await claudeText(claudeApiKey.value(), { model, system, prompt, maxTokens: 12000, effort: 'medium', stream: true });
      if (msg.stopReason === 'max_tokens') throw new Error('Відповідь AI обірвалась');
      const parsed = parseJson(msg.text) || {};
      const proposal = isQ ? cleanQuest(parsed, ents) : cleanDialogue(parsed, ents);
      const usage = { input_tokens: msg.usage.input_tokens || 0, output_tokens: msg.usage.output_tokens || 0 };
      const { userCost } = await charge(db, uid, 'generateScene', msg.model, usage, null, { provider: 'claude', targetWords: Math.round(usage.output_tokens * 0.75),
        estimatedInputTokens: Math.ceil((system.length + prompt.length) / 4), reserved: reservation, logAs: 'narrative_' + op });
      reservation = null;
      return res.status(200).json({ success: true, proposal, tokensConsumed: userCost, tokensRemaining: Math.max(0, balance.available - userCost) });
    } catch (error) {
      console.error('narrativeDraft error:', error);
      if (reservation) await refund(db, uid, reservation).catch((e) => console.error('[narrative] Refund failed:', e));
      return res.status(500).json({ error: `Помилка чернетки: ${error.message}` });
    }
  });
});

exports._narrative = { cleanQuest, cleanDialogue };
