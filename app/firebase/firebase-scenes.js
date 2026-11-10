// Firestore CRUD for scenes (subcollection)
// Scenes live in projects/{projectId}/scenes/{sceneId}

// generateScene's `entities` ([{ kind, type, id }] — or the older { characters: [ids], … }) → canonRefs { characters: [ids], … }
var SCENE_REF_KINDS = ['characters', 'locations', 'events', 'factions', 'artifacts'];
var SCENE_REF_TYPE = { character: 'characters', location: 'locations', event: 'events', faction: 'factions', artifact: 'artifacts' };
function refsFromEntities(ents) {
  if (!ents) return null;
  var out = {}, any = false;
  SCENE_REF_KINDS.forEach(function (k) { out[k] = []; });
  var add = function (k, id) { if (out[k] && typeof id === 'string' && id && out[k].indexOf(id) < 0) { out[k].push(id); any = true; } };
  if (Array.isArray(ents)) ents.forEach(function (e) { if (e) add(e.kind || SCENE_REF_TYPE[e.type], e.id); });
  else SCENE_REF_KINDS.forEach(function (k) { (Array.isArray(ents[k]) ? ents[k] : []).forEach(function (id) { add(k, id); }); });
  return any ? out : null;
}

window.__firebaseScenes = {
  // Get current user ID
  get uid() {
    const user = firebase.auth().currentUser;
    return user ? user.uid : null;
  },

  // Get all scenes for a project (ordered by n)
  async getScenes(projectId) {
    if (!projectId) {
      throw new Error('Project ID required');
    }

    const snapshot = await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .collection('scenes')
      .orderBy('n', 'asc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  // Get single scene
  async getScene(projectId, sceneId) {
    if (!projectId || !sceneId) {
      throw new Error('Project ID and Scene ID required');
    }

    const doc = await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .collection('scenes')
      .doc(sceneId)
      .get();

    if (!doc.exists) {
      throw new Error('Scene not found');
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  },

  // Add new scene to project
  async addScene(projectId, sceneData) {
    if (!projectId) {
      throw new Error('Project ID required');
    }

    const uid = this.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }

    // Verify user owns the project
    const projectDoc = await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .get();

    if (!projectDoc.exists || projectDoc.data().owner !== uid) {
      throw new Error('Project not found or access denied');
    }

    // Get next scene number
    const scenesSnapshot = await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .collection('scenes')
      .orderBy('n', 'desc')
      .limit(1)
      .get();

    const nextN = scenesSnapshot.empty ? 1 : scenesSnapshot.docs[0].data().n + 1;

    // Use provided ID or create new one
    const sceneId = sceneData.id || ('scene_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9));

    // Prepare scene document
    const scene = {
      id: sceneId,
      n: sceneData.n !== undefined ? sceneData.n : nextN,
      title: sceneData.title || `Сцена ${nextN}`,
      text: sceneData.text || '',
      act: sceneData.act || 1,
      arc: sceneData.arc || null,
      pov: sceneData.pov || null,
      intent: sceneData.intent || null,
      customIntent: sceneData.customIntent || null,
      status: sceneData.status || 'draft',
      generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      // Canon references (canonRefs.<kind> → entity ids): the canon entities generateScene found named in the text
      // (`entities`, ids of the world's confirmed canon — nothing new is invented, nothing is written to the canon;
      // auto-canon is off). The book's bookmarks and the Bible's dossier «Історії» read them. Explicit canonRefs win.
      ...(sceneData.canonRefs ? { canonRefs: sceneData.canonRefs } : (refsFromEntities(sceneData.entities) ? { canonRefs: refsFromEntities(sceneData.entities) } : {})),
      reconstruction: {
        mode: sceneData.reconstruction?.mode || 'review',
        affectedBy: sceneData.reconstruction?.affectedBy || [],
        lastReconstructionAt: null
      }
    };

    // Write scene to subcollection
    await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .collection('scenes')
      .doc(sceneId)
      .set(scene, { merge: true });

    // Update project.written count and updatedAt
    await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .update({
        written: firebase.firestore.FieldValue.increment(1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    return scene;
  },

  // Update existing scene
  async updateScene(projectId, sceneId, updates) {
    if (!projectId || !sceneId) {
      throw new Error('Project ID and Scene ID required');
    }

    const uid = this.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }

    // Verify user owns the project
    const projectDoc = await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .get();

    if (!projectDoc.exists || projectDoc.data().owner !== uid) {
      throw new Error('Project not found or access denied');
    }

    // Update scene
    await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .collection('scenes')
      .doc(sceneId)
      .update({
        ...updates,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

    // Update project.updatedAt
    await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .update({
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  },

  // Delete scene
  async deleteScene(projectId, sceneId) {
    if (!projectId || !sceneId) {
      throw new Error('Project ID and Scene ID required');
    }

    const uid = this.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }

    // Verify user owns the project
    const projectDoc = await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .get();

    if (!projectDoc.exists || projectDoc.data().owner !== uid) {
      throw new Error('Project not found or access denied');
    }

    // Delete scene
    await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .collection('scenes')
      .doc(sceneId)
      .delete();

    // Update project.written count
    await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .update({
        written: firebase.firestore.FieldValue.increment(-1),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  },

  // Get scenes count for project
  async getScenesCount(projectId) {
    if (!projectId) {
      throw new Error('Project ID required');
    }

    const snapshot = await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .collection('scenes')
      .get();

    return snapshot.size;
  }
};

// Reconstruction (stage 3): ask the server for a canon-consistent rewrite of one
// scene. Returns a proposal only — nothing is saved until applyReconstruction().
// Resolves to { success, unchanged, proposedText, tokensConsumed } or { success:false, error, code }.
window.__firebaseScenes.reconstructScene = async function(projectId, sceneId, entityType, entityId, changeType, changeNote) {
  const user = firebase.auth().currentUser;
  if (!user) return { success: false, error: 'Користувач не автентифікований' };
  const token = await user.getIdToken();
  try {
    const response = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/reconstructScene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ projectId, sceneId, entityType, entityId, changeType, changeNote: changeNote || '' })
    });
    const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    if (!response.ok) return { success: false, error: data.error || `HTTP ${response.status}`, code: data.code };
    return data;
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Accept a reconstruction proposal: write the new text, keep the old one for rollback.
window.__firebaseScenes.applyReconstruction = async function(projectId, sceneId, newText, previousText, cause) {
  await this.updateScene(projectId, sceneId, {
    text: newText,
    'reconstruction.previousText': previousText,
    'reconstruction.lastReconstructionAt': firebase.firestore.FieldValue.serverTimestamp(),
    'reconstruction.lastCause': cause || null
  });
};

