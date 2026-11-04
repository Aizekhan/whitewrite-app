// Project → world binding (the user document is created by the client as free — firestore.rules)
const {
  onRequest,
  db,
  cors,
  loadCanon,
  verifyAuth,
} = require('./common');


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
