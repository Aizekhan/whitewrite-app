// Firestore CRUD for projects
// Replaces PROJECTS array in White.html

window.__firebaseProjects = {
  // TEMPORARY: Use demo user for Step 1 (no auth required with open rules)
  // Will be replaced with real auth in Step 2
  uid: 'demo_user',

  // Get all projects for current user
  async getProjects() {
    // TEMPORARY: In Step 1, uid is set to 'demo_user'
    // In Step 2, will use real auth uid
    const uid = this.uid || 'demo_user';

    // TEMPORARY: Remove orderBy until index is fully built
    // Will add back sorting once index is ready
    const snapshot = await window.__firebase.db
      .collection('projects')
      .where('owner', '==', uid)
      .get();

    // Sort manually for now
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by createdAt descending (newest first)
    projects.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA;
    });

    return projects;
  },

  // Create new project
  async createProject(data) {
    const uid = this.uid || 'demo_user';
    const projectId = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    await window.__firebase.db.collection('projects').doc(projectId).set({
      owner: uid,
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
        characters: {},
        locations: {},
        events: {},
        factions: {},
        artifacts: {},
        world: {}
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
