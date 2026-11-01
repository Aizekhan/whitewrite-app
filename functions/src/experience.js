// AI Game Experience Intelligence — the platform side (spec «World Generation & Game Experience Intelligence», part II).
// The game (Unity, RPG Framework telemetry SDK) sends batches of events to telemetryIngest with a write-only key `wwi_…`
// (one per game, only its sha256 is stored: ingestKeys/{sha256}). Raw events live 30 days, daily aggregates 400 days —
// Firestore TTL on `expireAt` deletes them by itself (policies on collection groups `telemetry` and `telemetryDaily`).
// The `experience` function (the author, signed in) computes metrics on demand (free), writes AI reports of potential issues
// (paid: evidence, hypothesis, alternatives, confidence — never «the player is bored»), playtest plans (paid), and re-checks an
// issue after a change against its baseline (free).
// ⚠ SCALE: raw events in Firestore suit playtests and an early launch. When a game passes SCALE_EVENTS_PER_DAY the game doc
// gets `telemetryStats.scaleAlert` (shown in «Досвід гравців») — that is the moment to move raw events to BigQuery
// (ARCHITECTURE.md §Experience → «Scale»), keeping Firestore for aggregates, issues and playtests.
const crypto = require('crypto');
const { onRequest, admin, db, cors, Anthropic, AI_MODELS, charge, getBalance, reserve, refund, getPlanBudget, claudeApiKey } = require('./common');

const RAW_DAYS = 30;
const DAILY_DAYS = 400;
const SCALE_EVENTS_PER_DAY = 150000;
const MAX_BATCH = 500;
const MAX_READ = 60000; // events read for one metrics run (newest first)
const DAY = 86400000;
const LANGUAGES = { uk: 'Ukrainian', en: 'English' };

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const list = (a, n, f) => (Array.isArray(a) ? a : []).map(f).filter((x) => x != null && x !== '').slice(0, n);
const oneOf = (v, opts, d) => (opts.includes(v) ? v : d);
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const expire = (days) => admin.firestore.Timestamp.fromMillis(Date.now() + days * DAY);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const safeKey = (s) => str(s, 60).replace(/[^\w-]/g, '_') || '_';

// ---------- the event standard (§12) ----------
const ENVELOPE = {
  event_id: 'string, unique (UUID) — the server deduplicates by it',
  event_name: 'string, PascalCase, e.g. ZoneEntered',
  schema_version: 'integer, version of this event\'s properties',
  build_id: 'string, the build (e.g. 0.4.2-dev)',
  session_id: 'string, pseudonymous, new per session',
  player_id: 'string, pseudonymous (a salted hash) — never an email or a name',
  timestamp: 'number, Unix ms (real time)',
  game_time: 'number, optional in-game time',
  level_id: 'string, optional — a card id from the ID map',
  zone_id: 'string, optional — a card id from the ID map (zone, biome, room)',
  entity_id: 'string, optional', mechanic_id: 'string, optional — a mechanics card id', quest_id: 'string, optional',
  position: '[x, y, z], optional, rounded by the server to 0.5 m; sample movement (≤ 1 per 5 s), never per frame',
  context: '{ platform?, mode?, cohort?, variant? } — variant = the A/B variant this player is in',
  properties: 'object, ≤ 20 keys, values string|number|boolean',
};
const STANDARD_EVENTS = {
  Session: ['SessionStarted', 'SessionPaused', 'SessionResumed', 'SessionEnded'],
  Movement: ['ZoneEntered', 'ZoneExited', 'RouteSegmentEntered', 'CheckpointReached', 'PositionSample'],
  Combat: ['CombatStarted', 'EnemyEngaged', 'EnemyKilled', 'PlayerDamaged', 'PlayerDied', 'EncounterCompleted'],
  Interaction: ['ObjectViewed', 'ObjectInteracted', 'MechanicUsed', 'MechanicFailed'],
  Progression: ['QuestStarted', 'QuestStepCompleted', 'QuestCompleted', 'QuestAbandoned', 'LevelCompleted'],
  Exploration: ['LocationDiscovered', 'SecretFound', 'OptionalAreaEntered', 'CollectibleFound'],
  Economy: ['ItemAcquired', 'ItemSpent', 'RewardReceived', 'ResourceDepleted'],
  'UI/UX': ['MenuOpened', 'MenuClosed', 'TutorialShown', 'TutorialSkipped', 'HintRequested'],
  'Social/Co-op': ['PlayerJoined', 'PlayerLeft', 'ReviveRequested', 'ReviveCompleted', 'TeamObjectiveCompleted'],
  Playtest: ['SurveyAnswered'],
};
const DEFAULT_MEANINGFUL = ['CombatStarted', 'EncounterCompleted', 'CheckpointReached', 'QuestStepCompleted', 'QuestCompleted', 'LevelCompleted',
  'LocationDiscovered', 'SecretFound', 'CollectibleFound', 'RewardReceived', 'ItemAcquired', 'ObjectInteracted', 'TeamObjectiveCompleted'];
const INTENT_TAGS = ['tension', 'exploration', 'rest', 'learning', 'reward', 'social'];

// A card's design intent (§14) → one line for the model
function intentText(it) {
  if (!it) return '';
  const p = [];
  if ((it.tags || []).length) p.push('intended experience: ' + it.tags.join(', '));
  if (it.expected) p.push('expected events: ' + str(it.expected, 600));
  if (it.pacingMin || it.pacingMax) p.push(`pacing intent: ${it.pacingMin || '?'}–${it.pacingMax || '?'} min in this segment`);
  if (it.critical) p.push('critical mechanics: ' + str(it.critical, 400));
  if (it.success) p.push('success criteria / allowed variance: ' + str(it.success, 600));
  return p.join('; ');
}

// The schema the game implements (MCP get_telemetry_schema and the «Досвід гравців» connect tab show the same thing)
function telemetrySchema(game, cards, entities, experiments, playtests) {
  const named = (c) => { const labels = Object.fromEntries((c.defs || []).map((d) => [d.key, d.label])); return Object.fromEntries(Object.entries(c.fields || {}).filter(([, v]) => str(v, 1)).map(([k, v]) => [labels[k] || k, v])); };
  const custom = cards.filter((c) => c.section === 'telemetry' && !c.hidden).map((c) => ({ ref: 'c:' + c.id, title: c.title || '', ...named(c) }));
  const idOf = (c) => (c.canonRef ? c.canonRef : c.id);
  const titleOf = (c) => (c.canonRef ? ((entities.find((e) => e.id === c.canonRef) || {}).name || '') : (c.title || ''));
  const idMap = {};
  ['locations', 'levels', 'worldgen', 'mechanics', 'enemies', 'gear', 'items'].forEach((s) => {
    const l = cards.filter((c) => c.section === s && !c.hidden).map((c) => ({ id: idOf(c), title: titleOf(c), ...(c.intent ? { intent: c.intent } : {}) }));
    if (l.length) idMap[s] = l;
  });
  if (!game.canonOptIn) entities.filter((e) => e.kind === 'locations' && !cards.some((c) => c.canonRef === e.id)).forEach((e) => (idMap.locations = idMap.locations || []).push({ id: e.id, title: e.name || '' }));
  return {
    endpoint: 'https://us-central1-whitewrite-app.cloudfunctions.net/telemetryIngest',
    auth: 'Header «Authorization: Bearer wwi_…» — the write-only ingest key made in the Game Bible → «Досвід гравців» → Підключення. It can only add events to this game, so it may ship inside the build.',
    batch: `POST JSON { "events": [ …up to ${MAX_BATCH} envelopes… ] }. Queue locally, send every 30–60 s and on SessionEnded/pause, retry with backoff; the answer is { accepted, duplicates?, rejected:[{ i, reason }] }. Never block the game thread.`,
    envelope: ENVELOPE,
    standard_events: STANDARD_EVENTS,
    meaningful_events: (custom.some((c) => /так|yes|true/i.test(Object.values(c).join(' '))) ? 'standard defaults + the custom events marked meaningful: ' : 'standard defaults: ') + DEFAULT_MEANINGFUL.join(', '),
    custom_events: custom,
    id_map: idMap,
    experiments: experiments.filter((x) => x.status === 'running').map((x) => ({ id: x.id, hypothesis: x.hypothesis, variants: x.variants, success_event: x.metricEvent,
      assign: 'variant = variants[hash(player_id + experiment id) % variants.length], stable per player; send it in context.variant' })),
    playtests: playtests.filter((p) => p.status === 'active').map((p) => ({ id: p.id, title: p.title, questions: p.questions,
      answer_event: 'SurveyAnswered { properties: { playtest, question, answer } } — ask after the moment the plan names, never mid-combat' })),
    privacy: 'Analytics is opt-in: send nothing until the player agrees; offer opt-out in settings. Pseudonymous ids only (salted hash), no names/emails/IP in properties. Raw events are deleted after ' + RAW_DAYS + ' days.',
  };
}

// ---------- ingest ----------
const keyCache = new Map(); // sha → { key, owner plan ok, until }
async function resolveKey(token) {
  const h = sha(token), hit = keyCache.get(h);
  if (hit && hit.until > Date.now()) return hit.key;
  const d = await db.collection('ingestKeys').doc(h).get();
  let key = null;
  if (d.exists && !d.data().revoked) {
    const k = d.data(), u = await db.collection('users').doc(k.uid).get();
    if (getPlanBudget((u.exists && u.data().plan) || 'free').allowGameDev) key = { ...k, hash: h };
  }
  keyCache.set(h, { key, until: Date.now() + 5 * 60000 });
  return key;
}
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : undefined);
function cleanEvent(e, now) {
  if (!e || typeof e !== 'object') return 'not an object';
  const id = str(e.event_id, 80), name = str(e.event_name, 64);
  if (!/^[\w.:-]{6,80}$/.test(id)) return 'event_id';
  if (!/^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(name)) return 'event_name';
  const t = typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : Number(e.timestamp);
  if (!isFinite(t) || t < now - 7 * DAY || t > now + DAY) return 'timestamp';
  const p = str(e.player_id, 64), s = str(e.session_id, 64);
  if (!p || !s) return 'player_id/session_id';
  if (/@/.test(p)) return 'player_id must be pseudonymous';
  const out = { n: name, v: Math.max(1, parseInt(e.schema_version, 10) || 1), b: str(e.build_id, 40), s, p, t };
  const gt = num(e.game_time); if (gt !== undefined) out.gt = gt;
  [['level_id', 'l'], ['zone_id', 'z'], ['entity_id', 'en'], ['mechanic_id', 'm'], ['quest_id', 'q']].forEach(([k, short]) => { const v = str(e[k], 80); if (v) out[short] = v; });
  const pos = Array.isArray(e.position) ? e.position : e.position && typeof e.position === 'object' ? [e.position.x, e.position.y, e.position.z] : null;
  if (pos && pos.every((x) => typeof x === 'number' && isFinite(x))) out.pos = pos.slice(0, 3).map((x) => Math.round(x * 2) / 2);
  const c = e.context && typeof e.context === 'object' ? e.context : {};
  const ctx = {}; ['platform', 'mode', 'cohort', 'variant'].forEach((k) => { const v = str(c[k], 40); if (v) ctx[k] = v; });
  if (Object.keys(ctx).length) out.ctx = ctx;
  const pr = {};
  Object.entries(e.properties && typeof e.properties === 'object' ? e.properties : {}).slice(0, 20).forEach(([k, v]) => {
    const kk = str(k, 40).replace(/[^\w]/g, '_');
    if (!kk) return;
    if (typeof v === 'number' && isFinite(v)) pr[kk] = v; else if (typeof v === 'boolean') pr[kk] = v; else if (typeof v === 'string') pr[kk] = v.slice(0, 200);
  });
  if (Object.keys(pr).length) out.pr = pr;
  return { id: id.replace(/[/.]/g, '_'), ev: out };
}

exports.telemetryIngest = onRequest({ region: 'us-central1', memory: '256MiB', timeoutSeconds: 60 }, async (req, res) => {
  // game builds call from anywhere (native, WebGL): no cookies, the key is the only credential
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
    const auth = String(req.headers.authorization || '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!/^wwi_[\w-]{20,}$/.test(token)) return res.status(401).json({ error: 'Missing or malformed ingest key' });
    const key = await resolveKey(token);
    if (!key) return res.status(401).json({ error: 'Unknown, revoked or out-of-plan ingest key' });
    const events = Array.isArray(req.body && req.body.events) ? req.body.events : [];
    if (!events.length) return res.status(400).json({ error: 'No events' });
    if (events.length > MAX_BATCH) return res.status(413).json({ error: `At most ${MAX_BATCH} events per batch` });
    const now = Date.now(), ok = [], rejected = [];
    events.forEach((e, i) => { const r = cleanEvent(e, now); if (typeof r === 'string') { if (rejected.length < 20) rejected.push({ i, reason: r }); } else ok.push(r); });
    const gref = db.collection('worlds').doc(key.worldId).collection('games').doc(key.gameId);
    const exp = expire(RAW_DAYS);
    for (let i = 0; i < ok.length; i += 450) {
      const b = db.batch();
      ok.slice(i, i + 450).forEach((x) => b.set(gref.collection('telemetry').doc(x.id), { ...x.ev, expireAt: exp })); // same event_id → same doc: retries deduplicate
      await b.commit();
    }
    if (ok.length) {
      const day = new Date(now).toISOString().slice(0, 10), inc = admin.firestore.FieldValue.increment;
      const daily = { day, total: inc(ok.length), expireAt: expire(DAILY_DAYS), events: {}, builds: {} };
      ok.forEach((x) => { daily.events[x.ev.n] = (daily.events[x.ev.n] || 0) + 1; const bk = safeKey(x.ev.b || '-'); daily.builds[bk] = (daily.builds[bk] || 0) + 1; });
      Object.keys(daily.events).forEach((k) => { daily.events[k] = inc(daily.events[k]); });
      Object.keys(daily.builds).forEach((k) => { daily.builds[k] = inc(daily.builds[k]); });
      await gref.collection('telemetryDaily').doc(day).set(daily, { merge: true });
      const g = await gref.get(), st = (g.data() || {}).telemetryStats || {};
      const count = (st.day === day ? st.count || 0 : 0) + ok.length;
      const stats = { day, count, lastAt: ts() };
      if (count > SCALE_EVENTS_PER_DAY) stats.scaleAlert = { day, count };
      else if (st.scaleAlert) stats.scaleAlert = st.scaleAlert; // keeps the reminder until someone acts on it
      await gref.set({ telemetryStats: stats }, { merge: true });
    }
    res.status(200).json({ accepted: ok.length, rejected });
  } catch (error) {
    console.error('telemetryIngest error:', error);
    res.status(500).json({ error: 'Ingest failed' });
  }
});

// ---------- metrics engine (§13) — descriptive, with the sample size everywhere ----------
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, q) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const share = (a, b) => (b ? Math.round((a / b) * 1000) / 1000 : null);
function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }

function computeMetrics(evs, opt) {
  opt = opt || {};
  const meaningful = new Set([...DEFAULT_MEANINGFUL, ...(opt.meaningful || [])]);
  const thresholdOf = (z) => ((opt.pacing || {})[z] || 3) * 60; // a gap longer than the segment's pacing intent (default 3 min) is downtime
  evs.sort((a, b) => a.t - b.t);
  const players = new Set(), sessions = new Map(), builds = {};
  evs.forEach((e) => { players.add(e.p); builds[e.b || '-'] = (builds[e.b || '-'] || 0) + 1; if (!sessions.has(e.s)) sessions.set(e.s, []); sessions.get(e.s).push(e); });
  const P = players.size;
  const durs = [...sessions.values()].map((l) => (l[l.length - 1].t - l[0].t) / 1000);
  const zoneOf = (e) => e.z || e.l || '';
  const Z = {}, zone = (z) => (Z[z] = Z[z] || { players: new Set(), deaths: 0, deathBy: {}, hints: 0, menus: 0, gaps: [], downtime: 0, stays: [], exits: 0, sessions: new Set(), downSessions: new Set(), meaningful: 0 });
  const Q = {}, quest = (q) => (Q[q] = Q[q] || { started: new Set(), completed: new Set(), abandoned: new Set(), steps: 0 });
  const M = {}, mech = (m) => (M[m] = M[m] || { users: new Set(), uses: 0, fails: 0 });
  const L = {}, level = (l) => (L[l] = L[l] || { players: new Set(), completed: new Set() });
  const explore = { secret: new Set(), optional: new Set(), discovered: new Set() };
  const surveys = {}, menusPerSession = [];
  for (const [sid, l] of sessions) {
    const last = {}, entered = {};
    let menus = 0;
    for (const e of l) {
      const z = zoneOf(e);
      if (z) { const zz = zone(z); zz.players.add(e.p); zz.sessions.add(sid); }
      if (e.l) level(e.l).players.add(e.p);
      switch (e.n) {
        case 'PlayerDied': if (z) { zone(z).deaths++; zone(z).deathBy[e.p] = (zone(z).deathBy[e.p] || 0) + 1; } break;
        case 'HintRequested': if (z) zone(z).hints++; break;
        case 'MenuOpened': menus++; if (z) zone(z).menus++; break;
        case 'QuestStarted': if (e.q) quest(e.q).started.add(e.p); break;
        case 'QuestStepCompleted': if (e.q) quest(e.q).steps++; break;
        case 'QuestCompleted': if (e.q) quest(e.q).completed.add(e.p); break;
        case 'QuestAbandoned': if (e.q) quest(e.q).abandoned.add(e.p); break;
        case 'LevelCompleted': if (e.l) level(e.l).completed.add(e.p); break;
        case 'MechanicUsed': if (e.m) { mech(e.m).users.add(e.p); mech(e.m).uses++; } break;
        case 'MechanicFailed': if (e.m) mech(e.m).fails++; break;
        case 'SecretFound': explore.secret.add(e.p); break;
        case 'OptionalAreaEntered': explore.optional.add(e.p); break;
        case 'LocationDiscovered': explore.discovered.add(e.p); break;
        case 'SurveyAnswered': {
          const pr = e.pr || {}, q = str(pr.question, 80) || '?', a = str(pr.answer, 60);
          const s = (surveys[q] = surveys[q] || { playtest: str(pr.playtest, 60), n: 0, answers: {} });
          s.n++; if (a) s.answers[a] = (s.answers[a] || 0) + 1;
          break;
        }
        default:
      }
      if (!z) continue;
      if (e.n === 'ZoneEntered') { entered[z] = e.t; last[z] = e.t; continue; }
      if (meaningful.has(e.n)) {
        zone(z).meaningful++;
        if (last[z] != null) { const g = (e.t - last[z]) / 1000; zone(z).gaps.push(g); if (g > thresholdOf(z)) { zone(z).downtime++; zone(z).downSessions.add(sid); } }
        last[z] = e.t;
      }
      if (e.n === 'ZoneExited') {
        if (last[z] != null) { const g = (e.t - last[z]) / 1000; zone(z).gaps.push(g); if (g > thresholdOf(z)) { zone(z).downtime++; zone(z).downSessions.add(sid); } }
        if (entered[z] != null) zone(z).stays.push((e.t - entered[z]) / 1000);
        delete last[z]; delete entered[z];
      }
    }
    menusPerSession.push(menus);
    const tail = l[l.length - 1], tz = zoneOf(tail);
    if (tz && tail.n !== 'LevelCompleted' && tail.n !== 'QuestCompleted') zone(tz).exits++;
  }
  const zones = {};
  Object.entries(Z).forEach(([z, v]) => {
    const deathCounts = Object.values(v.deathBy);
    zones[z] = { players: v.players.size, sessions: v.sessions.size, deaths: v.deaths, deathsPerPlayer: r1(v.players.size ? v.deaths / v.players.size : 0),
      stuckShare: share(deathCounts.filter((n) => n >= 3).length, v.players.size), hints: v.hints, menus: v.menus,
      meaningfulEvents: v.meaningful, gapMedianSec: r1(median(v.gaps)), gapP90Sec: r1(pct(v.gaps, 0.9)), downtimeGaps: v.downtime,
      downtimeSessionShare: share(v.downSessions.size, v.sessions.size), stayMedianSec: r1(median(v.stays)), exitsHere: v.exits, exitShare: share(v.exits, sessions.size) };
  });
  const quests = {};
  Object.entries(Q).forEach(([q, v]) => { quests[q] = { started: v.started.size, completed: v.completed.size, abandoned: v.abandoned.size,
    completionRate: share(v.completed.size, v.started.size), abandonRate: share(v.abandoned.size, v.started.size), steps: v.steps }; });
  const levels = {};
  Object.entries(L).forEach(([l, v]) => { levels[l] = { players: v.players.size, completed: v.completed.size, completionRate: share(v.completed.size, v.players.size) }; });
  const totalUses = Object.values(M).reduce((a, v) => a + v.uses, 0);
  const mechanics = {};
  Object.entries(M).forEach(([m, v]) => { mechanics[m] = { users: v.users.size, adoption: share(v.users.size, P), uses: v.uses, fails: v.fails, failRate: share(v.fails, v.uses + v.fails), useShare: share(v.uses, totalUses) }; });
  const dominant = Object.entries(mechanics).sort((a, b) => b[1].uses - a[1].uses)[0];
  // heatmaps (§15): per zone, 24×24 cells over x/z, four layers; positions only — never a person's path
  const layerOf = (n) => (n === 'PlayerDied' ? 'death' : ['ObjectInteracted', 'MechanicUsed', 'ObjectViewed'].includes(n) ? 'interact'
    : ['LocationDiscovered', 'SecretFound', 'OptionalAreaEntered', 'CollectibleFound'].includes(n) ? 'explore' : 'move');
  const H = {};
  evs.forEach((e) => { if (!e.pos) return; const z = zoneOf(e) || 'world'; (H[z] = H[z] || []).push(e); });
  const heatmaps = Object.entries(H).sort((a, b) => b[1].length - a[1].length).slice(0, 12).map(([z, l]) => {
    const xs = l.map((e) => e.pos[0]), zs = l.map((e) => e.pos[2] != null ? e.pos[2] : e.pos[1]);
    const b = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)], N = 24;
    const layers = { move: {}, death: {}, interact: {}, explore: {} };
    l.forEach((e, i) => {
      const cx = Math.min(N - 1, Math.floor(((xs[i] - b[0]) / ((b[2] - b[0]) || 1)) * N)), cz = Math.min(N - 1, Math.floor(((zs[i] - b[1]) / ((b[3] - b[1]) || 1)) * N));
      const k = cz * N + cx, ly = layers[layerOf(e.n)]; ly[k] = (ly[k] || 0) + 1;
    });
    return { zone: z, n: l.length, size: N, bounds: b, layers };
  });
  // A/B (§17): conversion to the success event per variant; two-proportion z-test of the first two
  const experiments = (opt.experiments || []).map((x) => {
    const per = {};
    (x.variants || []).forEach((v) => { per[v] = { players: new Set(), converted: new Set() }; });
    evs.forEach((e) => { const v = e.ctx && e.ctx.variant; if (!per[v]) return; per[v].players.add(e.p); if (e.n === x.metricEvent) per[v].converted.add(e.p); });
    const out = { id: x.id, metricEvent: x.metricEvent, variants: {} };
    Object.entries(per).forEach(([v, s]) => { out.variants[v] = { players: s.players.size, converted: s.converted.size, rate: share(s.converted.size, s.players.size) }; });
    const [a, b] = Object.values(out.variants);
    if (a && b && a.players >= 2 && b.players >= 2) {
      const p = (a.converted + b.converted) / (a.players + b.players), se = Math.sqrt(p * (1 - p) * (1 / a.players + 1 / b.players));
      const zv = se ? (b.rate - a.rate) / se : 0;
      out.zScore = r1(zv); out.pValue = Math.round((1 - erf(Math.abs(zv) / Math.SQRT2)) * 1000) / 1000;
      out.enough = a.players >= 30 && b.players >= 30;
    }
    return out;
  });
  const t0 = evs.length ? evs[0].t : null, t1 = evs.length ? evs[evs.length - 1].t : null;
  return {
    sample: { events: evs.length, players: P, sessions: sessions.size, from: t0, to: t1, builds, truncated: !!opt.truncated },
    session: { count: sessions.size, medianSec: r1(median(durs)), p90Sec: r1(pct(durs, 0.9)), perPlayer: r1(P ? sessions.size / P : 0), menusPerSessionMedian: median(menusPerSession) },
    zones, quests, levels, mechanics,
    variety: { mechanicsUsed: Object.keys(mechanics).length, dominant: dominant ? { mechanic: dominant[0], useShare: dominant[1].useShare } : null },
    exploration: { secretShare: share(explore.secret.size, P), optionalShare: share(explore.optional.size, P), discoveredShare: share(explore.discovered.size, P) },
    surveys, experiments, heatmaps,
  };
}

// metrics → "path: value" lines (no heatmaps) — what the model may cite and what validation re-reads
function flatten(o, pre, out) {
  out = out || {};
  Object.entries(o || {}).forEach(([k, v]) => {
    if (k === 'heatmaps' || k === 'builds' || k === 'answers') return;
    const p = pre ? pre + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, p, out); else if (typeof v === 'number') out[p] = v;
  });
  return out;
}

// ---------- the author's endpoint ----------
const cleanIssue = (x, i, flat) => (x && str(x.title, 200) ? {
  id: 'ex_' + Date.now().toString(36) + '_' + i,
  title: str(x.title, 200),
  category: oneOf(x.category, ['pacing', 'boredom', 'engagement', 'difficulty', 'variety', 'ux', 'exploration', 'economy', 'social', 'other'], 'other'),
  priority: oneOf(x.priority, ['high', 'medium', 'low'], 'medium'),
  scope: { zone: str(x.scope && x.scope.zone, 80), quest: str(x.scope && x.scope.quest, 80), mechanic: str(x.scope && x.scope.mechanic, 80), ref: str(x.scope && x.scope.ref, 80), build: str(x.scope && x.scope.build, 40) },
  evidence: list(x.evidence, 8, (ev) => (ev && str(ev.metric, 160) ? { metric: str(ev.metric, 160), value: flat[str(ev.metric, 160)] != null ? flat[str(ev.metric, 160)] : null, note: str(ev.note, 300) } : null)),
  hypothesis: str(x.hypothesis, 800),
  alternatives: list(x.alternatives, 5, (a) => str(a, 400) || null),
  confidence: oneOf(x.confidence, ['low', 'medium', 'high'], 'low'),
  confidenceWhy: str(x.confidenceWhy, 400),
  impact: str(x.impact, 400),
  actions: list(x.actions, 4, (a) => (a && str(a.change, 400) ? { change: str(a.change, 400), risk: str(a.risk, 300) } : null)),
  validation: { plan: str(x.validation && x.validation.plan, 600),
    target: list(x.validation && x.validation.target, 4, (t) => (t && flat[str(t.metric, 160)] != null ? { metric: str(t.metric, 160), direction: t.direction === 'up' ? 'up' : 'down' } : null)) },
  related: list(x.related, 8, (r) => str(r, 80) || null),
} : null);

function reportPrompt(metrics, flat, intents, schemaIds, open, languageName) {
  return `You are the AI Game Experience Analyst of WhiteWrite. Below: descriptive telemetry metrics of a game (with the sample), the design intent the author wrote on cards (GDD-aware), the id map (telemetry ids → Bible cards), and issues already open.
Find POTENTIAL experience issues: pacing (long segments without meaningful events vs the pacing intent), boredom RISK signals, engagement drops, difficulty/frustration spikes, low variety / a dominant strategy, UX confusion (menus, hints), missed exploration, intent mismatches (expected events / critical mechanics not seen).
Rules (non-negotiable):
- Telemetry does not measure boredom. Call it «Boredom Risk» / «Potential Engagement Issue», never «players are bored». No psychological claims about people.
- Every issue cites evidence ONLY by exact metric keys from the METRIC LIST, states the sample, gives alternative explanations (e.g. an intended quiet atmospheric pause, a bug, natural end of content) and a confidence low|medium|high with its basis. Small samples (< 20 players) → low confidence.
- Compare with the design intent: a quiet segment tagged "rest" or "exploration" is not a problem by itself.
- Suggested actions are options with risks; the author decides. Never optimise for time-in-game or compulsion.
- validation.target: 1–3 metric keys from the list and the direction that would mean the change helped (up|down).
- Do not repeat open issues. Max 10 issues, most important first.

SAMPLE: ${JSON.stringify(metrics.sample)}
METRIC LIST:
${Object.entries(flat).slice(0, 1500).map(([k, v]) => `${k}: ${v}`).join('\n')}
SURVEYS: ${JSON.stringify(metrics.surveys).slice(0, 4000)}
DESIGN INTENT:
${intents || '(none written yet — say where intent is missing)'}
ID MAP: ${JSON.stringify(schemaIds).slice(0, 8000)}
OPEN ISSUES: ${open.map((x) => '- ' + x.title).join('\n') || '(none)'}

Write ALL text in ${languageName}. Return ONLY valid JSON, no markdown fence:
{"issues":[{"title":"","category":"pacing","priority":"medium","scope":{"zone":"","quest":"","mechanic":"","ref":"","build":""},"evidence":[{"metric":"","note":""}],"hypothesis":"","alternatives":[""],"confidence":"low","confidenceWhy":"","impact":"","actions":[{"change":"","risk":""}],"validation":{"plan":"","target":[{"metric":"","direction":"down"}]},"related":["c:..."]}]}`;
}

function playtestPrompt(bible, issues, focus, languageName) {
  return `You are the AI Playtest Director of WhiteWrite. Plan ONE focused playtest for this game: what testers do, who, which build, and a short survey that does not interrupt play.
Base it on the Game Bible (design intent, critical mechanics) and the open experience issues; the author's focus: ${focus || '(none — pick the riskiest open questions)'}.
Questions: 3–7, after a milestone or the session (when = "after <moment>"), types scale (1–5) | choice | text; include the most / least interesting moment, clarity of the goal, fairness of difficulty, wish to continue. Each question has a short stable id (snake_case).

OPEN ISSUES:
${issues.map((x) => `- ${x.title}: ${x.hypothesis}`).join('\n') || '(none)'}

BIBLE:
${bible.slice(0, 60000)}

Write ALL text in ${languageName}. Return ONLY valid JSON:
{"title":"","goal":"","build":"","cohort":"","tasks":[{"goal":"","success":""}],"questions":[{"id":"","text":"","type":"scale","options":[""],"when":""}],"notes":""}`;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) {
    const m = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI повернув не JSON');
    return JSON.parse(m[1] || m[0]);
  }
}

async function loadEvents(gref, days, build) {
  const since = Date.now() - Math.min(RAW_DAYS, Math.max(1, days || RAW_DAYS)) * DAY;
  const snap = await gref.collection('telemetry').where('t', '>=', since).orderBy('t', 'desc').limit(MAX_READ).get();
  const evs = snap.docs.map((d) => d.data()).filter((e) => !build || e.b === build);
  return { evs, truncated: snap.size >= MAX_READ };
}
function optsFrom(cards, experiments) {
  const meaningful = [], pacing = {};
  cards.forEach((c) => {
    if (c.section === 'telemetry') {
      const f = Object.values(c.fields || {}).join(' ');
      const name = str(c.fields && (c.fields.event || ''), 64) || str(c.title, 64);
      if (/так|yes|true/i.test(String((c.fields || {}).meaningful || '')) && name) meaningful.push(name);
      else if (/meaningful|значущ/i.test(f) && name) meaningful.push(name);
    }
    if (c.intent && c.intent.pacingMax) pacing[c.canonRef || c.id] = Number(c.intent.pacingMax) || undefined;
  });
  return { meaningful, pacing, experiments: experiments.filter((x) => x.status === 'running') };
}
function intentsText(cards, entities) {
  return cards.filter((c) => c.intent && intentText(c.intent)).map((c) => {
    const id = c.canonRef || c.id, title = c.canonRef ? ((entities.find((e) => e.id === c.canonRef) || {}).name || '') : (c.title || '');
    return `- [${id}] ${title} (${c.section}): ${intentText(c.intent)}`;
  }).join('\n');
}

/**
 * Cloud Function: experience
 * POST { worldId, gameId, op, language?, ... }
 *   keyCreate {label} → { key }          keyRevoke {hash}
 *   metrics {days?, build?}               → writes games/{g}/experience/metrics
 *   report                                → AI, writes games/{g}/experienceIssues/{id} (paid)
 *   playtest {focus?}                     → AI, writes games/{g}/playtests/{id} (paid)
 *   validate {issueId, build?}            → re-measures the issue's target metrics vs its baseline
 *   purge                                 → deletes the game's telemetry and experience data (game deletion)
 */
exports.experience = onRequest({ region: 'us-central1', secrets: [claudeApiKey], timeoutSeconds: 540, memory: '1GiB' }, async (req, res) => {
  return cors(req, res, async () => {
    let uid, reservation = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      try { uid = (await admin.auth().verifyIdToken(authHeader.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const body = req.body || {};
      const op = oneOf(body.op, ['keyCreate', 'keyRevoke', 'metrics', 'report', 'playtest', 'validate', 'purge'], '');
      const worldId = str(body.worldId, 120), gameId = str(body.gameId, 120);
      if (!op || !worldId || !gameId) return res.status(400).json({ error: 'Missing op/worldId/gameId' });
      const languageName = LANGUAGES[body.language] || LANGUAGES.uk;
      const wref = db.collection('worlds').doc(worldId), gref = wref.collection('games').doc(gameId);
      const [w, g, userDoc] = await Promise.all([wref.get(), gref.get(), db.collection('users').doc(uid).get()]);
      if (!w.exists || w.data().owner !== uid) return res.status(403).json({ error: 'Гру не знайдено або немає доступу' });

      if (op === 'purge') { // the game is being deleted: its telemetry and experience go with it
        for (const c of ['telemetry', 'telemetryDaily', 'experience', 'experienceIssues', 'playtests', 'experiments']) await db.recursiveDelete(gref.collection(c));
        const keys = await db.collection('ingestKeys').where('gameId', '==', gameId).where('worldId', '==', worldId).get();
        await Promise.all(keys.docs.map((d) => d.ref.delete()));
        return res.status(200).json({ success: true });
      }
      if (!g.exists) return res.status(403).json({ error: 'Гру не знайдено або немає доступу' });
      const userData = userDoc.exists ? userDoc.data() : {};
      if (!getPlanBudget(userData.plan || 'free').allowGameDev) return res.status(403).json({ error: 'Досвід гравців доступний на тарифі Worldbuilder', code: 'PLAN_REQUIRED' });

      if (op === 'keyCreate') {
        const key = 'wwi_' + crypto.randomBytes(24).toString('base64url');
        const h = sha(key), prefix = key.slice(0, 10);
        await db.collection('ingestKeys').doc(h).set({ uid, worldId, gameId, label: str(body.label, 80), prefix, createdAt: ts(), revoked: false });
        await gref.set({ ingestKeys: admin.firestore.FieldValue.arrayUnion({ hash: h.slice(0, 16), prefix, label: str(body.label, 80), at: Date.now() }) }, { merge: true });
        return res.status(200).json({ success: true, key });
      }
      if (op === 'keyRevoke') {
        const short = str(body.hash, 16);
        const all = (g.data().ingestKeys || []), k = all.find((x) => x.hash === short);
        if (!k) return res.status(404).json({ error: 'Ключ не знайдено' });
        const docs = await db.collection('ingestKeys').where('gameId', '==', gameId).where('worldId', '==', worldId).get();
        await Promise.all(docs.docs.filter((d) => d.id.startsWith(short)).map((d) => d.ref.set({ revoked: true, revokedAt: ts() }, { merge: true })));
        keyCache.clear();
        await gref.set({ ingestKeys: all.filter((x) => x.hash !== short) }, { merge: true });
        return res.status(200).json({ success: true });
      }

      const [cardsSnap, entSnap, expSnap, issuesSnap] = await Promise.all([gref.collection('cards').get(), wref.collection('entities').get(),
        gref.collection('experiments').get(), gref.collection('experienceIssues').get()]);
      const cards = cardsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const entities = entSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const experiments = expSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const issues = issuesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (op === 'metrics' || op === 'validate') {
        const days = Math.max(1, Math.min(RAW_DAYS, parseInt(body.days, 10) || RAW_DAYS));
        const build = str(body.build, 40);
        const { evs, truncated } = await loadEvents(gref, days, build);
        const m = computeMetrics(evs, { ...optsFrom(cards, experiments), truncated });
        if (op === 'metrics') {
          await gref.collection('experience').doc('metrics').set({ ...m, days, build, at: ts() });
          return res.status(200).json({ success: true, sample: m.sample });
        }
        const issue = issues.find((x) => x.id === str(body.issueId, 80));
        if (!issue) return res.status(404).json({ error: 'Проблему не знайдено' });
        const flat = flatten(m), base = issue.baseline || {};
        const checks = (issue.validation && issue.validation.target || []).map((t) => {
          const before = base[t.metric], after = flat[t.metric];
          const moved = before != null && after != null && before !== 0 ? (after - before) / Math.abs(before) : null;
          const ok = moved == null ? null : t.direction === 'up' ? moved > 0.1 : moved < -0.1;
          return { metric: t.metric, direction: t.direction, before: before == null ? null : before, after: after == null ? null : after, change: moved == null ? null : Math.round(moved * 1000) / 10, ok };
        });
        const known = checks.filter((c) => c.ok !== null);
        const verdict = !known.length || m.sample.players < 5 ? 'inconclusive' : known.every((c) => c.ok) ? 'improved' : known.some((c) => c.ok) ? 'mixed' : 'not_improved';
        const result = { at: Date.now(), by: 'metrics', build, sample: m.sample.players, checks, verdict };
        await gref.collection('experienceIssues').doc(issue.id).set({ validations: admin.firestore.FieldValue.arrayUnion(result),
          status: verdict === 'improved' ? 'resolved' : issue.status, updatedAt: ts() }, { merge: true });
        return res.status(200).json({ success: true, result });
      }

      // ---- AI ops: priced like the game analysis (the client shows the price first) ----
      if (userData.subscriptionStatus !== 'active') return res.status(403).json({ error: 'Активна підписка необхідна для генерації', requiresSubscription: true });
      const metricsDoc = op === 'report' ? await gref.collection('experience').doc('metrics').get() : null;
      if (op === 'report' && (!metricsDoc.exists || !(metricsDoc.data().sample || {}).events)) return res.status(400).json({ error: 'Спершу зберіть події й порахуйте метрики', code: 'NO_METRICS' });
      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {}).claude : null;
      const reserveCost = ((providerEconomy && providerEconomy.cost) || 300) * 2; // gamebible.js costOf mirrors this
      const balance = getBalance(userData);
      if (balance.available < reserveCost) return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      try { reservation = await reserve(db, uid, reserveCost); } catch (error) {
        if (error.code !== 'OUT_OF_TOKENS') throw error;
        return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: error.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      }
      const openIssues = issues.filter((x) => ['open', 'planned', 'validating'].includes(x.status));
      let prompt;
      let flat = {};
      if (op === 'report') {
        const m = metricsDoc.data(); flat = flatten(m);
        const schema = telemetrySchema(g.data(), cards, entities, experiments, []);
        prompt = reportPrompt(m, flat, intentsText(cards, entities), schema.id_map, openIssues, languageName);
      } else {
        const bible = cards.filter((c) => !c.hidden).map((c) => `[${c.canonRef ? 'e:' + c.canonRef : 'c:' + c.id}] ${c.title || (entities.find((e) => e.id === c.canonRef) || {}).name || ''} (${c.section})` +
          (c.intent ? ' — ' + intentText(c.intent) : '') + ': ' + Object.values(c.fields || {}).map((v) => str(v, 300)).filter(Boolean).join(' · ')).join('\n');
        prompt = playtestPrompt(bible, openIssues, str(body.focus, 600), languageName);
      }
      const model = AI_MODELS.claude.sonnet;
      const anthropic = new Anthropic({ apiKey: claudeApiKey.value() });
      const msg = await anthropic.messages.stream({ model, max_tokens: 12000, messages: [{ role: 'user', content: prompt }] }).finalMessage();
      if (msg.stop_reason === 'max_tokens') throw new Error('Відповідь AI обірвалась');
      const parsed = parseJson(msg.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
      let out = {};
      if (op === 'report') {
        const fresh = list(parsed && parsed.issues, 10, (x, i) => cleanIssue(x, i, flat));
        const batch = db.batch();
        fresh.forEach((x) => {
          const baseline = {}; (x.validation.target || []).concat(x.evidence).forEach((t) => { if (flat[t.metric] != null) baseline[t.metric] = flat[t.metric]; });
          batch.set(gref.collection('experienceIssues').doc(x.id), { ...x, status: 'open', baseline, sample: metricsDoc.data().sample, createdAt: ts(), updatedAt: ts() });
        });
        batch.set(gref.collection('experience').doc('metrics'), { reportedAt: ts() }, { merge: true });
        await batch.commit();
        out = { issues: fresh.length };
      } else {
        const p = parsed || {};
        const plan = { title: str(p.title, 160) || 'Playtest', goal: str(p.goal, 800), build: str(p.build, 60), cohort: str(p.cohort, 300),
          tasks: list(p.tasks, 10, (t) => (t && str(t.goal, 300) ? { goal: str(t.goal, 300), success: str(t.success, 300) } : null)),
          questions: list(p.questions, 8, (q, i) => (q && str(q.text, 300) ? { id: str(q.id, 40).replace(/[^\w]/g, '_') || 'q' + (i + 1), text: str(q.text, 300),
            type: oneOf(q.type, ['scale', 'choice', 'text'], 'text'), options: list(q.options, 6, (o) => str(o, 80) || null), when: str(q.when, 160) } : null)),
          notes: str(p.notes, 1500), status: 'draft', focus: str(body.focus, 600), createdAt: ts() };
        const ref = await gref.collection('playtests').add(plan);
        out = { playtestId: ref.id };
      }
      const usage = { input_tokens: msg.usage.input_tokens || 0, output_tokens: msg.usage.output_tokens || 0 };
      const { userCost } = await charge(db, uid, 'generateScene', model, usage, null, { provider: 'claude', targetWords: Math.round(usage.output_tokens * 0.75),
        estimatedInputTokens: Math.ceil(prompt.length / 4), reserved: reservation, logAs: 'experience_' + op });
      reservation = null;
      res.status(200).json({ success: true, ...out, tokensConsumed: userCost, tokensRemaining: Math.max(0, balance.available - userCost) });
    } catch (error) {
      console.error('experience error:', error);
      if (reservation) await refund(db, uid, reservation).catch((e) => console.error('[experience] Refund failed:', e));
      res.status(500).json({ error: `Помилка аналітики досвіду: ${error.message}` });
    }
  });
});

exports._experience = { computeMetrics, flatten, telemetrySchema, intentText, cleanEvent, STANDARD_EVENTS, DEFAULT_MEANINGFUL, INTENT_TAGS, ENVELOPE };
