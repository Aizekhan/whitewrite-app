// Firebase Canon integration for World Tree
// Read-only access to project.canon from Firestore (this iteration: NO editing)

window.__firebaseCanon = {
  /**
   * Get canon for a project
   * @param {string} projectId - Firestore project ID
   * @returns {Promise<Object>} Canon object with characters, locations, events, factions, artifacts, world
   */
  async getCanon(projectId) {
    if (!window.__firebase?.db) {
      console.error('Firebase not initialized');
      return this._emptyCanon();
    }

    if (!projectId) {
      console.error('No projectId provided');
      return this._emptyCanon();
    }

    try {
      const projectDoc = await window.__firebase.db.collection('projects').doc(projectId).get();

      if (!projectDoc.exists) {
        console.error('Project not found:', projectId);
        return this._emptyCanon();
      }

      const project = projectDoc.data();
      const canon = project.canon || this._emptyCanon();

      console.log('Canon loaded for project:', projectId, canon);
      return canon;
    } catch (error) {
      console.error('Failed to load canon:', error);
      return this._emptyCanon();
    }
  },

  /**
   * Empty canon structure (for new projects)
   */
  _emptyCanon() {
    return {
      world: {
        tagline: '',
        summary: '',
        facts: [],
        rules: [],
        palette: []
      },
      characters: {},
      locations: {},
      events: {},
      factions: {},
      artifacts: {}
    };
  },

  /**
   * Convert canon from object format to array format (for UI compatibility)
   * Canon in Firestore: { characters: { id1: {...}, id2: {...} } }
   * Canon for UI: { characters: [{id: 'id1', ...}, {id: 'id2', ...}] }
   */
  canonToArrays(canon) {
    const result = {
      world: canon.world || this._emptyCanon().world,
      characters: Object.entries(canon.characters || {}).map(([id, data]) => ({ id, ...data })),
      locations: Object.entries(canon.locations || {}).map(([id, data]) => ({ id, ...data })),
      events: Object.entries(canon.events || {}).map(([id, data]) => ({ id, ...data })),
      factions: Object.entries(canon.factions || {}).map(([id, data]) => ({ id, ...data })),
      artifacts: Object.entries(canon.artifacts || {}).map(([id, data]) => ({ id, ...data }))
    };

    return result;
  }
};

console.log('Firebase canon module loaded');
