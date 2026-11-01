// Projects (stories) are created ONLY here, so the plan's maxProjects holds (firestore.rules deny client creates).
// Over the limit the author may buy a permanent extra slot for tokens (paid-features.js «projectSlot»).
const { onRequest, admin, db, cors, getPlanBudget, getBalance, reserve, refund, verifyAuth } = require('./common');
const { byOp, featureCost } = require('../paid-features.js');

const SLOT_COST = featureCost(byOp('projectSlot')); // tokens per extra project slot

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

exports.createProject = onRequest({ cors: true, timeoutSeconds: 30 }, async (req, res) => {
  return cors(req, res, async () => {
    let uid = null;
    try { uid = await verifyAuth(req.headers.authorization); } catch (e) { uid = null; }
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const data = (req.body && req.body.project) || {};
    const buySlot = !!(req.body && req.body.buySlot);
    let reservation = null;
    try {
      if (data.worldId) {
        const w = await db.collection('worlds').doc(String(data.worldId)).get();
        if (!w.exists || w.data().owner !== uid) return res.status(403).json({ error: 'Not your world' });
      }
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
      res.status(500).json({ error: error.message });
    }
  });
});
