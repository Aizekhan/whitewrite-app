// User bootstrap: plans, project → world binding
const {
  onRequest,
  admin,
  db,
  cors,
  getPlanBudget,
  loadCanon,
  verifyAuth,
} = require('./common');


/**
 * Cloud Function: Initialize or Update User
 *
 * Creates or updates user document with plan and tokens.
 * Called on first login or when upgrading plan.
 */
exports.initializeUser = onRequest({
  region: 'us-central1'
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      // Get auth token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const token = authHeader.split('Bearer ')[1];
      let uid;
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        uid = decodedToken.uid;
      } catch (error) {
        res.status(401).json({ error: 'Invalid auth token' });
        return;
      }

      const { email, displayName } = req.body;

      // Paid plans are granted ONLY by payment webhooks — this endpoint never sets a paid plan.
      if (req.body.plan && req.body.plan !== 'free') {
        res.status(403).json({
          error: 'Зміна плану можлива лише через оплату',
          requiresSubscription: true
        });
        return;
      }

      const freePlan = getPlanBudget('free');
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        // Create new user (always free)
        await userRef.set({
          email: email || '',
          displayName: displayName || 'User',
          plan: 'free',
          tokensUsed: 0,
          bonusTokens: 0,
          periodStart: admin.firestore.Timestamp.now(),
          maxProjects: freePlan.maxProjects,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ User ${uid} initialized with plan: free`);
      }

      const userData = (await userRef.get()).data();
      res.status(200).json({ success: true, user: userData });

    } catch (error) {
      console.error('initializeUser error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * Cloud Function: Ensure Project World
 * Returns the project's worldId, migrating legacy project.canon on first call.
 * Input: { projectId }  Output: { worldId }
 */
exports.ensureProjectWorld = onRequest({
  region: 'us-central1',
  invoker: 'public' // auth is checked in code (Firebase ID token)
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      let uid;
      try {
        uid = await verifyAuth(req.headers.authorization);
      } catch (e) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { projectId } = req.body || {};
      if (!projectId) {
        return res.status(400).json({ error: 'Missing projectId' });
      }

      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (!projectDoc.exists || projectDoc.data().owner !== uid) {
        return res.status(403).json({ error: 'Project not found or access denied' });
      }

      // loadCanon also verifies world ownership (project.worldId may be client-set)
      const { worldId } = await loadCanon(db, projectId, projectDoc.data(), uid);
      res.status(200).json({ worldId });
    } catch (error) {
      console.error('[ensureProjectWorld] Error:', error);
      res.status(error.status || 500).json({ error: error.message });
    }
  });
});
