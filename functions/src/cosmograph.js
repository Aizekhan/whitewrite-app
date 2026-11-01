// Космограф (World Bible «Космологія»): the world's sky — planet, suns, moons, calendar — simulated in the browser.
// Off by default; the author turns it on per world in the project settings. It costs COSMOGRAPH_COST tokens
// once per 30 days for that world. worlds/{w}.cosmograph { enabled, paidUntil, paidAt } is written only here
// (firestore.rules keep it read-only for clients); the sky itself lives in worlds/{w}.cosmos (client-written).
const { onRequest, admin, db, cors, getBalance, reserve, refund, getPlanBudget } = require('./common');

const COSMOGRAPH_COST = 2000; // app/gamebible.js COSMO_COST mirrors this
const PERIOD_MS = 30 * 24 * 3600 * 1000;

exports.cosmographAccess = onRequest({ region: 'us-central1' }, async (req, res) => {
  return cors(req, res, async () => {
    let uid, reservation = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      try { uid = (await admin.auth().verifyIdToken(auth.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }

      const body = req.body || {};
      const worldId = String(body.worldId || '').slice(0, 120);
      const op = ['enable', 'disable'].includes(body.op) ? body.op : 'enable';
      if (!worldId) return res.status(400).json({ error: 'Missing worldId' });
      const worldRef = db.collection('worlds').doc(worldId);
      const [worldSnap, userSnap] = await Promise.all([worldRef.get(), db.collection('users').doc(uid).get()]);
      if (!worldSnap.exists || worldSnap.data().owner !== uid) return res.status(403).json({ error: 'Світ не знайдено або немає доступу' });
      const userData = userSnap.exists ? userSnap.data() : {};
      const cur = worldSnap.data().cosmograph || {};

      if (op === 'disable') { // no refund: the month already paid stays paid if it is turned on again
        await worldRef.set({ cosmograph: { ...cur, enabled: false } }, { merge: true });
        return res.status(200).json({ success: true, enabled: false, paidUntil: cur.paidUntil ? cur.paidUntil.toMillis() : 0 });
      }

      if (!getPlanBudget(userData.plan || 'free').allowGameDev) {
        return res.status(403).json({ error: 'Біблія світу доступна на тарифі Worldbuilder', code: 'PLAN_REQUIRED' });
      }
      const now = Date.now();
      const paidUntil = cur.paidUntil && cur.paidUntil.toMillis ? cur.paidUntil.toMillis() : 0;
      if (paidUntil > now) { // this month is paid: just turn it on
        await worldRef.set({ cosmograph: { ...cur, enabled: true } }, { merge: true });
        return res.status(200).json({ success: true, enabled: true, paidUntil, tokensConsumed: 0 });
      }

      const balance = getBalance(userData);
      if (balance.available < COSMOGRAPH_COST) {
        return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: COSMOGRAPH_COST, code: 'OUT_OF_TOKENS' });
      }
      try {
        reservation = await reserve(db, uid, COSMOGRAPH_COST);
      } catch (e) {
        if (e.code !== 'OUT_OF_TOKENS') throw e;
        return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: e.available, tokensNeeded: COSMOGRAPH_COST, code: 'OUT_OF_TOKENS' });
      }
      const until = admin.firestore.Timestamp.fromMillis(now + PERIOD_MS);
      await worldRef.set({ cosmograph: { enabled: true, paidUntil: until, paidAt: admin.firestore.FieldValue.serverTimestamp() } }, { merge: true });
      reservation = null;
      await db.collection('usage_logs').add({ uid, operation: 'cosmograph_month', worldId, userTokensCharged: COSMOGRAPH_COST,
        realApiCostUSD: 0, timestamp: admin.firestore.FieldValue.serverTimestamp() }).catch((e) => console.error('[cosmograph] log failed:', e));
      return res.status(200).json({ success: true, enabled: true, paidUntil: until.toMillis(), tokensConsumed: COSMOGRAPH_COST,
        tokensRemaining: Math.max(0, balance.available - COSMOGRAPH_COST) });
    } catch (error) {
      console.error('cosmographAccess error:', error);
      if (reservation) await refund(db, uid, reservation).catch((e) => console.error('[cosmograph] refund failed:', e));
      return res.status(500).json({ error: `Помилка Космографа: ${error.message}` });
    }
  });
});
