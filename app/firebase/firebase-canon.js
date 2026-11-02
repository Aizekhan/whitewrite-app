// Firebase Canon integration for World Tree
// Canon lives in worlds/{worldId} + worlds/{worldId}/entities (see functions/canon-store.js).
// A project (story) references its world via project.worldId.

const CANON_KINDS = ['characters', 'locations', 'events', 'factions', 'artifacts'];
const CANON_ID_PREFIX = { characters: 'char', locations: 'loc', events: 'evt', factions: 'fac', artifacts: 'art' };
// Derived/UI-only fields never persisted (reverse links are derived, invariant: "реверс деривується")
const CANON_TRANSIENT = ['_draft', 'scenes'];

window.__firebaseCanon = {
  worldId: null, // world of the currently loaded project
  projectId: null, // project (story) whose canon is loaded

  /**
   * Get canon for a project (from its world; legacy projects are migrated server-side)
   * @param {string} projectId - Firestore project ID
   * @returns {Promise<Object>} Canon object with characters, locations, events, factions, artifacts, world
   */
  async getCanon(projectId) {
    this.worldId = null;
    this.projectId = null;

    if (!window.__firebase?.db) {
      console.error('Firebase not initialized');
      return this._emptyCanon();
    }

    if (!projectId) {
      console.error('No projectId provided');
      return this._emptyCanon();
    }

    try {
      const db = window.__firebase.db;
      const projectDoc = await db.collection('projects').doc(projectId).get();

      if (!projectDoc.exists) {
        console.error('Project not found:', projectId);
        return this._emptyCanon();
      }

      const worldId = projectDoc.data().worldId || await this._ensureWorld(projectId);
      const worldRef = db.collection('worlds').doc(worldId);
      const [worldDoc, entitiesSnap] = await Promise.all([worldRef.get(), worldRef.collection('entities').get()]);

      const canon = this._emptyCanon();
      const world = worldDoc.exists ? worldDoc.data() : {};
      Object.keys(canon.world).forEach((f) => { if (world[f] !== undefined) canon.world[f] = world[f]; });
      entitiesSnap.forEach((doc) => {
        const data = doc.data();
        if (!CANON_KINDS.includes(data.kind)) return;
        if (data.origin && data.origin.confirmed === false) return; // inferred, not yet fact
        canon[data.kind][doc.id] = data;
      });

      this.worldId = worldId;
      this.projectId = projectId;
      console.log('Canon loaded for project:', projectId, 'world:', worldId);
      return canon;
    } catch (error) {
      console.error('Failed to load canon:', error);
      return this._emptyCanon();
    }
  },

  // Legacy project without worldId → server migrates project.canon into a world
  async _ensureWorld(projectId) {
    const idToken = await window.__firebase.auth.currentUser.getIdToken();
    const response = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/ensureProjectWorld', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ projectId })
    });
    const data = await response.json();
    if (!response.ok || !data.worldId) throw new Error(data.error || 'ensureProjectWorld failed');
    return data.worldId;
  },

  // Opaque stable id, e.g. "char_8f3k2a" (invariant #4)
  newEntityId(kind) {
    const bytes = crypto.getRandomValues(new Uint8Array(3));
    return CANON_ID_PREFIX[kind] + '_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  },

  slugify(name) {
    return String(name || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  },

  /**
   * Create an explicit (user-authored) entity in the current world.
   * @param {string} kind - 'characters' | 'locations' | ...
   * @param {Object} entity - entity incl. id (from newEntityId)
   */
  async createEntity(kind, entity) {
    if (!this.worldId) throw new Error('No world loaded');
    const data = {};
    Object.keys(entity).forEach((k) => { if (!CANON_TRANSIENT.includes(k)) data[k] = entity[k]; });
    const name = data.name || data.title || '';
    await window.__firebase.db.collection('worlds').doc(this.worldId).collection('entities').doc(entity.id).set({
      ...data,
      kind,
      name,
      slug: this.slugify(name),
      origin: { source: 'explicit', confidence: null, confirmed: true, createdBy: 'user' },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  /**
   * Patch fields of an entity (merge; never replaces the whole entity).
   */
  async updateEntity(entityId, patch) {
    if (!this.worldId) throw new Error('No world loaded');
    const data = { ...patch, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (patch.name !== undefined || patch.title !== undefined) {
      data.name = patch.name !== undefined ? patch.name : patch.title;
      data.slug = this.slugify(data.name);
    }
    await window.__firebase.db.collection('worlds').doc(this.worldId).collection('entities').doc(entityId)
      .set(data, { merge: true });
  },

  /**
   * Patch world-level canon (tagline, summary, rules, facts, palette).
   */
  async updateWorld(patch) {
    if (!this.worldId) throw new Error('No world loaded');
    await window.__firebase.db.collection('worlds').doc(this.worldId)
      .set({ ...patch, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  },

  /**
   * Worlds of the current user, newest first. Legacy stories without a world
   * are migrated first (server-side), so every story appears under its world.
   * @returns {Promise<Array>} [{ id, title, tagline, summary, ... }]
   */
  async listWorlds() {
    const uid = firebase.auth().currentUser?.uid;
    if (!uid) return [];
    const db = window.__firebase.db;
    const projects = await db.collection('projects').where('owner', '==', uid).get();
    const legacy = projects.docs.filter((d) => !d.data().worldId);
    await Promise.all(legacy.map((d) => this._ensureWorld(d.id).catch((e) => console.error('[Worlds] migrate', d.id, e))));
    const [snap, shared] = await Promise.all([db.collection('worlds').where('owner', '==', uid).get(),
      db.collection('worlds').where('teamUids', 'array-contains', uid).get().catch(() => ({ docs: [] }))]); // Команда: worlds of friends who added you
    const ts = (w) => (w.updatedAt && w.updatedAt.toMillis ? w.updatedAt.toMillis() : 0);
    const stats = {}; // 👤 followers · ★ ♥ of the owner's showcases (community/{pubId}), summed per world
    await db.collection('community').where('owner', '==', uid).get().then((cs) => cs.docs.forEach((d) => {
      const w = stats[d.get('worldId')] || (stats[d.get('worldId')] = { f: 0, l: 0 });
      w.f += d.get('followers') || 0; w.l += d.get('likes') || 0;
    })).catch(() => {});
    return snap.docs.map((d) => ({ id: d.id, ...d.data(), stats: stats[d.id] || { f: 0, l: 0 } })).sort((a, b) => ts(b) - ts(a))
      .concat(shared.docs.map((d) => ({ id: d.id, ...d.data(), shared: true })).sort((a, b) => ts(b) - ts(a)));
  },

  /**
   * Genesis: create a world from the seed the author chose (or an empty one).
   * The author picked it, so it is explicit canon (not inferred).
   * @returns {Promise<string>} worldId
   */
  async createWorld(seed) {
    const uid = firebase.auth().currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const worldId = 'world_' + Date.now().toString(36) + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    await window.__firebase.db.collection('worlds').doc(worldId).set({
      owner: uid,
      title: seed.name || '',
      tagline: seed.tagline || '',
      summary: seed.summary || '',
      facts: seed.facts || [],
      rules: seed.rules || [],
      palette: [],
      schemaVersion: 1,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    this.worldId = worldId;
    this.projectId = null;
    for (const kind of ['characters', 'locations', 'factions']) {
      for (const e of seed[kind] || []) {
        const entity = { id: this.newEntityId(kind), name: e.name, desc: e.description || '' };
        if (kind === 'characters' && e.role) entity.role = e.role;
        await this.createEntity(kind, entity);
      }
    }
    return worldId;
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
   *
   * IMPORTANT: Maps AI-extracted field names to UI-expected field names
   */
  canonToArrays(canon) {
    // Helper: Migrate legacy text values to enum codes
    const migrateEnum = (value) => {
      if (!value || !window.__canonEnums) return value;
      return window.__canonEnums.normalizeEnumValue(value);
    };

    // Helper: Normalize AI-extracted entity to UI-expected format
    const normalizeCharacter = (data) => ({
      ...data,
      motivation: data.motivation || data.goal || data.trait || '',
      roleType: migrateEnum(data.roleType || (data.role?.includes('головн') ? 'lead' : 'support')),
      status: migrateEnum(data.status),
      prog: data.prog || 0,
      arc: data.arc || data.developmentArc || ''
    });

    const normalizeLocation = (data) => ({
      ...data,
      desc: data.desc || data.description || '',
      type: migrateEnum(data.type)
    });

    const normalizeEvent = (data) => ({
      ...data,
      title: data.title || data.name || '',
      desc: data.desc || data.description || '',
      act: data.act || 1,
      type: migrateEnum(data.type || 'other'),
      tone: data.tone || 'done'
    });

    const normalizeFaction = (data) => ({
      ...data,
      desc: data.desc || data.description || '',
      align: migrateEnum(data.align || 'neutral'),
      power: data.power || 5
    });

    const normalizeArtifact = (data) => ({
      ...data,
      desc: data.desc || data.description || '',
      type: migrateEnum(data.type || 'other'),
      rarity: migrateEnum(data.rarity || 'common')
    });

    const result = {
      world: canon.world || this._emptyCanon().world,
      characters: Object.entries(canon.characters || {}).map(([id, data]) => normalizeCharacter({ id, ...data })),
      locations: Object.entries(canon.locations || {}).map(([id, data]) => normalizeLocation({ id, ...data })),
      events: Object.entries(canon.events || {}).map(([id, data]) => normalizeEvent({ id, ...data })),
      factions: Object.entries(canon.factions || {}).map(([id, data]) => normalizeFaction({ id, ...data })),
      artifacts: Object.entries(canon.artifacts || {}).map(([id, data]) => normalizeArtifact({ id, ...data }))
    };

    return result;
  }
};

console.log('Firebase canon module loaded');
