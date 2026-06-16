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

  // Create new project
  async createProject(data) {
    const uid = this.uid;
    if (!uid) {
      throw new Error('User not authenticated');
    }

    const projectId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    await window.__firebase.db.collection('projects').doc(projectId).set({
      owner: uid,
      visibility: 'private', // Future: 'shared' | 'public'
      title: data.title || 'Без назви',
      desc: data.desc || '',
      meta: data.meta || '',
      cover: data.cover || null,
      scope: data.scope || 'novella',
      ending: data.ending || 'open',
      genres: data.genres || [],
      written: data.written || 0,
      active: data.active !== undefined ? data.active : false,
      badge: data.badge || 'draft',
      c1: data.c1 || '#2a1c16',
      c2: data.c2 || '#10131a',
      canonAware: true,
      canon: {
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
        artifacts: {},
        inferred: {},      // AI-suggested entities (not facts yet)
        hiddenCanon: {}    // For plot twists
      },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return projectId;
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

// Helper: Create test project (for development)
window.__createTestProject = async function() {
  try {
    const projectId = await window.__firebaseProjects.createProject({
      title: "Червоний сигнал",
      desc: "Колонії Марса вмовкли. Тиша поширюється швидше за світло — і ще один сигнал кличе крізь неї.",
      meta: "Hard SF · Сезон",
      scope: "season",
      ending: "open",
      genres: ["Hard SF", "Космоопера"],
      written: 9,
      active: true,
      badge: "active",
      c1: "#c2542a",
      c2: "#2a1c16"
    });
    console.log('Test project created:', projectId);
    return projectId;
  } catch (err) {
    console.error('Failed to create test project:', err);
  }
};

// Log that firebase-projects is loaded
console.log('Firebase projects module loaded, uid:', window.__firebaseProjects.uid);
