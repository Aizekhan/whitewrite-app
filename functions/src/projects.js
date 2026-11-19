// Projects (stories) are created ONLY here, so the plan's maxProjects holds (firestore.rules deny client creates).
// Over the limit the author may buy a permanent extra slot for tokens (paid-features.js «projectSlot»).
const { onRequest, admin, db, cors, getPlanBudget, getBalance, reserve, refund, verifyAuth, publicMessage } = require('./common');
const ledger = require('./ledger'); // users/{uid}/ledger — «Історія токенів»
const { byOp, featureCost } = require('../paid-features.js');

const SLOT_COST = featureCost(byOp('projectSlot')); // tokens per extra project slot
const DEMO = require('../demo-game.js'); // 🎓 the demo game «Ліхтарник» (createGame { demo } / { template: 'demo' })

// the demo's content into a new game: cards, quests, dialogues, the plan and its tasks (admin SDK — a Free author gets the plan too)
async function writeDemo(gref, lang) {
  const d = DEMO.build(lang), now = admin.firestore.FieldValue.serverTimestamp(), ops = [];
  d.cards.forEach((c) => ops.push([gref.collection('cards').doc(c.id), { ...c.data, createdAt: now, updatedAt: now }]));
  d.quests.forEach((q) => ops.push([gref.collection('quests').doc(q.id), { ...q.data, createdAt: now, updatedAt: now }]));
  d.dialogues.forEach((q) => ops.push([gref.collection('dialogues').doc(q.id), { ...q.data, createdAt: now, updatedAt: now }]));
  d.tasks.forEach((t) => ops.push([gref.collection('tasks').doc(t.id.replace(/[\/\s]/g, '_')), { ...t, createdAt: now, updatedAt: now }]));
  ops.push([gref.collection('plan').doc('current'), { plan: d.plan, plannedAt: now, updatedAt: now }]);
  const b = db.batch(); ops.forEach(([ref, data]) => b.set(ref, data)); await b.commit(); // < 500 writes
  return d;
}

// The fields a story may be created with (the rest are set here)
const str = (v, max, d) => (typeof v === 'string' ? v.slice(0, max) : d);
const strList = (v, n) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, n).map((x) => x.slice(0, 120)) : []);
const num = (v, lo, hi, d) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

function projectDoc(uid, d) {
  return {
    owner: uid,
    ...(typeof d.worldId === 'string' && d.worldId ? { worldId: d.worldId } : {}),
    visibility: 'private',
    title: str(d.title, 200, '') || 'Без назви',
    desc: str(d.desc, 5000, ''),
    meta: str(d.meta, 200, ''),
    cover: str(d.cover, 2000, null),
    language: str(d.language, 8, 'uk'),
    scope: str(d.scope, 20, 'novella'),
    ending: str(d.ending, 20, 'open'),
    endingNote: str(d.endingNote, 2000, ''),
    genres: strList(d.genres, 8),
    creation: ['guided', 'auto', 'free'].includes(d.creation) ? d.creation : 'guided',
    subjects: strList(d.subjects, 200),
    reveal: ['open', 'later', 'internal'].includes(d.reveal) ? d.reveal : 'open',
    revealNote: str(d.revealNote, 2000, ''),
    length: num(d.length, 200, 2000, 700),
    dialogue: num(d.dialogue, 0, 100, 50),
    episodes: d.episodes == null ? null : num(d.episodes, 1, 200, null),
    written: 0,
    active: d.active === true,
    badge: str(d.badge, 20, 'draft'),
    c1: str(d.c1, 20, '#2a1c16'),
    c2: str(d.c2, 20, '#10131a'),
    canonAware: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

// count-then-create is not atomic: a short per-user lock (users/{uid}.creating, server-only) serializes creates, so
// parallel requests cannot pass maxProjects / maxGames together
async function lockCreate(uid, kind) {
  const ref = db.collection('users').doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    // no user doc yet (the page creates it after sign-in): create it here with the lock — returning true without one let
    // parallel creates all pass the limit. The same default the page writes (firebase-auth.js): plan free.
    if (!snap.exists) { tx.set(ref, { plan: 'free', createdAt: admin.firestore.Timestamp.now(), creating: { [kind]: admin.firestore.Timestamp.now() } }); return true; }
    const t = (snap.data().creating || {})[kind], at = t && t.toMillis ? t.toMillis() : 0;
    if (Date.now() - at < 10000) return false;
    tx.update(ref, { ['creating.' + kind]: admin.firestore.Timestamp.now() });
    return true;
  });
}
const unlockCreate = (uid, kind) => db.collection('users').doc(uid).update({ ['creating.' + kind]: admin.firestore.FieldValue.delete() }).catch(() => {});
const BUSY = { code: 'BUSY', error: 'Зачекай — попереднє створення ще триває' };

exports.createProject = onRequest({ cors: true, timeoutSeconds: 30 }, async (req, res) => {
  return cors(req, res, async () => {
    let uid = null;
    try { uid = await verifyAuth(req.headers.authorization); } catch (e) { uid = null; }
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const data = (req.body && req.body.project) || {};
    const buySlot = !!(req.body && req.body.buySlot);
    let reservation = null, locked = false;
    try {
      if (data.worldId) {
        const w = await db.collection('worlds').doc(String(data.worldId)).get();
        if (!w.exists || w.data().owner !== uid) return res.status(403).json({ error: 'Not your world' });
      }
      if (!(locked = await lockCreate(uid, 'project'))) return res.status(429).json(BUSY);
      const userRef = db.collection('users').doc(uid);
      const user = (await userRef.get()).data() || {};
      const plan = user.plan || 'free';
      const limit = (getPlanBudget(plan).maxProjects || 1) + Math.max(0, user.extraProjects || 0);
      const count = (await db.collection('projects').where('owner', '==', uid).count().get()).data().count;

      if (count >= limit) {
        if (!buySlot) {
          return res.status(403).json({ code: 'PROJECT_LIMIT', error: 'Ліміт проєктів тарифу', limit, count, plan,
            slotCost: SLOT_COST, tokensRemaining: getBalance(user).available });
        }
        try { reservation = await reserve(db, uid, SLOT_COST); } catch (e) {
          if (e.code !== 'OUT_OF_TOKENS') throw e;
          return res.status(403).json({ code: 'OUT_OF_TOKENS', error: 'Недостатньо токенів для слота', tokensRemaining: e.available, tokensNeeded: SLOT_COST });
        }
        await userRef.update({ extraProjects: admin.firestore.FieldValue.increment(1) });
        reservation.granted = true;
        ledger.record(db, uid, { type: 'spend', op: 'project_slot', amount: -SLOT_COST, balance: reservation.available });
        await db.collection('usage_logs').add({ uid, operation: 'project_slot', userTokensCharged: SLOT_COST, realApiCostUSD: 0,
          billing: 'fixed', timestamp: admin.firestore.FieldValue.serverTimestamp() });
      }

      const projectId = 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
      await db.collection('projects').doc(projectId).set(projectDoc(uid, data));
      res.json({ projectId, slotBought: !!reservation, tokensCharged: reservation ? SLOT_COST : 0 });
    } catch (error) {
      console.error('[createProject]', error);
      // the slot is already granted once extraProjects moved; refund only if the increment never happened
      if (reservation && !reservation.granted) await refund(db, uid, reservation).catch(() => {});
      res.status(500).json({ error: publicMessage(error) });
    } finally {
      if (locked) await unlockCreate(uid, 'project');
    }
  });
});

// Games are created ONLY here too, so the plan's maxGames holds (firestore.rules deny client creates of worlds/{w}/games):
// game design is open on every plan (paid-features.js «gamedesign», allowGameDesign) — one game below Worldbuilder,
// counted over all the author's worlds. The game doc gets its first fields; the Bible fills the rest (a restore merges its own).
exports.createGame = onRequest({ cors: true, timeoutSeconds: 30 }, async (req, res) => {
  return cors(req, res, async () => {
    let uid = null;
    try { uid = await verifyAuth(req.headers.authorization); } catch (e) { uid = null; }
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const b = req.body || {};
    let locked = false;
    try {
      const wref = db.collection('worlds').doc(String(b.worldId || '-'));
      const w = await wref.get();
      if (!w.exists || w.data().owner !== uid) return res.status(403).json({ error: 'Not your world' });
      if (w.data().freeze) return res.status(403).json({ error: 'Світ заморожено', code: 'FROZEN' });
      if (!(locked = await lockCreate(uid, 'game'))) return res.status(429).json(BUSY);
      const user = (await db.collection('users').doc(uid).get()).data() || {};
      const budget = getPlanBudget(user.plan || 'free');
      if (!budget.allowGameDesign) return res.status(403).json({ error: 'Ігри недоступні на цьому тарифі', code: 'PLAN_REQUIRED' });
      const worlds = await db.collection('worlds').where('owner', '==', uid).get();
      const counts = await Promise.all(worlds.docs.map((d) => d.ref.collection('games').count().get()));
      // 🎓 the demo game (games/{g}.demo, server-only) is outside the plan's limit — one per author over all worlds
      const demos = await Promise.all(worlds.docs.map((d) => d.ref.collection('games').where('demo', '==', true).count().get()));
      const demoN = demos.reduce((n, c) => n + c.data().count, 0);
      const count = counts.reduce((n, c) => n + c.data().count, 0) - demoN;
      const limit = budget.maxGames || 1, demo = b.demo === true, lang = b.lang === 'en' ? 'en' : 'uk';
      if (demo && demoN) return res.status(409).json({ code: 'DEMO_EXISTS', error: 'Демо-гра вже є' });
      if (!demo && count >= limit) return res.status(403).json({ code: 'GAME_LIMIT', error: 'Ліміт ігор тарифу', limit, count, plan: user.plan || 'free' });
      const fromDemo = demo || b.template === 'demo';
      const gameId = 'game_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await wref.collection('games').doc(gameId).set({
        ...(demo ? { demo: true } : {}),
        title: fromDemo ? (str(b.title, 200, '') || DEMO.TITLE[lang === 'en' ? 1 : 0]) : (str(b.title, 200, '') || 'Без назви'),
        engine: { profile: /^[a-z0-9-]{1,40}$/.test(b.engine || '') ? b.engine : 'generic' }, // the Bible's ENGINES ids
        sections: [], canonOptIn: true,
        guide: { on: true, stage: 0 }, // 🧭 Гід: the menu opens stage by stage (the Bible's GUIDE)
        hiddenSections: ['experience', 'telemetry', ...(fromDemo ? [] : ['tech']), 'knowledge', 'marketing'], // owner: off until the author turns them on (⚙ → «Розділи гри в меню»); the demo shows «Технічне» (stage 10 is filled)
        createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      if (fromDemo) {
        try { await writeDemo(wref.collection('games').doc(gameId), lang); }
        catch (e) { await db.recursiveDelete(wref.collection('games').doc(gameId)).catch(() => {}); throw e; } // no half-built demo left behind
      }
      res.json({ gameId, limit, count: demo ? count : count + 1, demo });
    } catch (error) {
      console.error('[createGame]', error);
      res.status(500).json({ error: publicMessage(error) });
    } finally {
      if (locked) await unlockCreate(uid, 'game');
    }
  });
});
exports._projects = { lockCreate }; // tests only (tests/billing.test.cjs)
