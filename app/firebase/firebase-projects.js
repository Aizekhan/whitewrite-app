// Firestore CRUD for projects
// Production-ready schema with Canon + Scenes subcollection

window.__firebaseProjects = {
  // Get current user ID (from Firebase Auth)
  get uid() {
    const user = firebase.auth().currentUser;
    return user ? user.uid : null;
  },

  // Get all projects for current user
  async getProjects() {
    const uid = this.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }

    const snapshot = await window.__firebase.db
      .collection('projects')
      .where('owner', '==', uid)
      .orderBy('updatedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  // Get all projects for specific user (for stats)
  async getUserProjects(uid) {
    if (!uid) {
      throw new Error('User ID required');
    }

    const snapshot = await window.__firebase.db
      .collection('projects')
      .where('owner', '==', uid)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  },

  // Get single project by ID
  async getProject(projectId) {
    const uid = this.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }

    const doc = await window.__firebase.db
      .collection('projects')
      .doc(projectId)
      .get();

    if (!doc.exists) {
      throw new Error('Project not found');
    }

    const data = doc.data();

    // Verify ownership
    if (data.owner !== uid) {
      throw new Error('Access denied: not project owner');
    }

    return {
      id: doc.id,
      ...data
    };
  },

  // Create new project — through the createProject Cloud Function, which holds the plan's project limit.
  // Over the limit the author may buy a permanent extra slot for tokens, or open the plans.
  async createProject(data, buySlot) {
    const user = firebase.auth().currentUser;
    if (!user) {
      throw new Error('User not authenticated');
    }
    const token = await user.getIdToken();
    const r = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/createProject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ project: data, buySlot: !!buySlot })
    });
    const out = await r.json().catch(() => ({}));
    if (r.ok && out.projectId) {
      if (out.tokensCharged && window.__wwUser) {
        window.__wwUser.tokensRemaining = Math.max(0, (window.__wwUser.tokensRemaining || 0) - out.tokensCharged);
        if (typeof window.__syncDockAvatar === 'function') window.__syncDockAvatar();
      }
      return out.projectId;
    }
    const t = window.__i18n ? window.__i18n.t : (k) => k;
    const fill = (k, o) => Object.keys(o).reduce((m, x) => m.split('{' + x + '}').join(o[x]), t(k));
    const openPlans = () => { const w = window.parent && window.parent.__openAccount ? window.parent : window; if (w.__openAccount) w.__openAccount(); };
    const silent = (msg) => { const e = new Error(msg); e.silent = true; return e; };
    if (out.code === 'PROJECT_LIMIT') {
      const plan = window.__getPlanConfig ? window.__getPlanConfig(out.plan).name : out.plan;
      if (confirm(fill('project.limitAsk', { plan, limit: out.limit, cost: out.slotCost, have: out.tokensRemaining }))) {
        return this.createProject(data, true);
      }
      openPlans();
      throw silent('PROJECT_LIMIT');
    }
    if (out.code === 'OUT_OF_TOKENS') {
      alert(fill('project.slotNoTokens', { cost: out.tokensNeeded, have: out.tokensRemaining }));
      openPlans();
      throw silent('OUT_OF_TOKENS');
    }
    throw new Error(out.error || ('HTTP ' + r.status));
  },

  // Update project
  async updateProject(projectId, data) {
    await window.__firebase.db.collection('projects').doc(projectId).update({
      ...data,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  // Delete project
  async deleteProject(projectId) {
    await window.__firebase.db.collection('projects').doc(projectId).delete();
  }
};
