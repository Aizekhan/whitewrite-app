// Firestore CRUD for scenes (subcollection)
// Scenes live in projects/{projectId}/scenes/{sceneId}

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
      // Canon references — ID links to entities (5 types)
      canonRefs: sceneData.canonRefs || {
        characters: [],  // Character IDs that appear/speak in scene
        locations: [],   // Location IDs where scene takes place
        events: [],      // Event IDs that happen/are mentioned
        factions: [],    // Faction IDs involved
        artifacts: []    // Artifact IDs that appear
      },
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
      .set(scene);

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

// Helper: Test scene creation (for development)
window.__createTestScene = async function(projectId) {
  try {
    const scene = await window.__firebaseScenes.addScene(projectId, {
      title: "Тиша над колонією",
      text: "Коли впала остання зоря над Орелією, місто не закричало. Воно затихло — так затихає людина, що нарешті почула власне ім'я з вуст того, кого давно вважала мертвим.",
      act: 1,
      intent: "conflict",
      entities: {
        characters: ["marcus", "elena"],
        locations: ["beta7"],
        events: ["silence"],
        artifacts: []
      }
    });
    console.log('Test scene created:', scene);
    return scene;
  } catch (err) {
    console.error('Failed to create test scene:', err);
  }
};

// Validate canonRefs structure (helper for quality checks)
window.__firebaseScenes.validateCanonRefs = function(canonRefs) {
  if (!canonRefs || typeof canonRefs !== 'object') {
    return {valid: false, error: 'canonRefs must be an object'};
  }

  const requiredTypes = ['characters', 'locations', 'events', 'factions', 'artifacts'];

  for (const type of requiredTypes) {
    if (!Array.isArray(canonRefs[type])) {
      return {valid: false, error: `canonRefs.${type} must be an array`};
    }

    // Check all IDs are strings
    for (const id of canonRefs[type]) {
      if (typeof id !== 'string' || !id) {
        return {valid: false, error: `Invalid ID in canonRefs.${type}: ${id}`};
      }
    }
  }

  return {valid: true};
};

// Create empty canonRefs (helper for initialization)
window.__firebaseScenes.emptyCanonRefs = function() {
  return {
    characters: [],
    locations: [],
    events: [],
    factions: [],
    artifacts: []
  };
};

console.log('Firebase scenes module loaded');
