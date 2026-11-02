// ============================================================================
// Canon Store — worlds/{worldId} + worlds/{worldId}/entities/{entityId}
// ============================================================================
// A World is the canon (source of truth). A project (story) references it via
// project.worldId; several stories can share one world.
//
// worlds/{worldId}:            owner, title, tagline, summary, facts, rules, palette
// worlds/{worldId}/entities/:  { id, kind, name, slug, origin, ...entity fields }
//   kind   — 'characters' | 'locations' | 'events' | 'factions' | 'artifacts'
//            (NOT `type`: that field is the entity's own subtype, e.g. location type)
//   origin — { source: 'explicit'|'inferred', confidence, confirmed, createdBy }
//
// Legacy projects keep `project.canon` (untouched, for rollback) and are migrated
// lazily on first access by ensureWorld(). Ids are preserved (scenes' canonRefs).

const crypto = require('crypto');
const admin = require('firebase-admin');

const CANON_KINDS = ['characters', 'locations', 'events', 'factions', 'artifacts'];
const ID_PREFIX = { characters: 'char', locations: 'loc', events: 'evt', factions: 'fac', artifacts: 'art' };
const SINGULAR_TO_KIND = { character: 'characters', location: 'locations', event: 'events', faction: 'factions', artifact: 'artifacts' };
const WORLD_FIELDS = ['tagline', 'summary', 'facts', 'rules', 'palette'];

function toKind(type) {
  if (CANON_KINDS.includes(type)) return type;
  return SINGULAR_TO_KIND[type] || null;
}

// Opaque stable id, e.g. "char_8f3k2a"
function newEntityId(kind) {
  return `${ID_PREFIX[kind]}_${crypto.randomBytes(3).toString('hex')}`;
}

function slugify(name) {
  return String(name || '').toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function emptyCanon() {
  return {
    world: { tagline: '', summary: '', facts: [], rules: [], palette: [] },
    characters: {}, locations: {}, events: {}, factions: {}, artifacts: {}
  };
}

function worldIdForProject(projectId) {
  // Deterministic ⇒ concurrent lazy migrations converge on the same world
  return `world_${String(projectId).replace(/^proj_/, '')}`;
}

/**
 * Ensure the project has a world; migrates legacy project.canon on first call.
 * @returns {Promise<string>} worldId
 */
async function ensureWorld(db, projectId, project) {
  if (project.worldId) return project.worldId;

  const worldId = worldIdForProject(projectId);
  const worldRef = db.collection('worlds').doc(worldId);
  const legacy = project.canon || {};
  const legacyWorld = legacy.world || {};

  const ops = [];
  const worldDoc = {
    owner: project.owner,
    title: project.title || '',
    migratedFrom: projectId,
    schemaVersion: 1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  for (const f of WORLD_FIELDS) {
    worldDoc[f] = legacyWorld[f] !== undefined ? legacyWorld[f] : emptyCanon().world[f];
  }
  ops.push([worldRef, worldDoc]);

  for (const kind of CANON_KINDS) {
    for (const [id, data] of Object.entries(legacy[kind] || {})) {
      const name = data.name || data.title || '';
      ops.push([worldRef.collection('entities').doc(id), {
        ...data,
        id,
        kind,
        name,
        slug: data.slug || slugify(name),
        origin: data.origin || (data.aiExtracted
          ? { source: 'inferred', confidence: null, confirmed: true, createdBy: 'ai' }   // auto-approved before migration
          : { source: 'explicit', confidence: null, confirmed: true, createdBy: 'user' })
      }]);
    }
  }

  // Firestore batch limit: 500 writes
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    for (const [ref, data] of ops.slice(i, i + 450)) batch.set(ref, data, { merge: true });
    await batch.commit();
  }

  await db.collection('projects').doc(projectId).update({ worldId });
  console.log(`[CanonStore] Migrated project ${projectId} → ${worldId} (${ops.length - 1} entities)`);
  return worldId;
}

/**
 * Load the canon of a project's world, in the legacy shape
 * { world, characters: {id: data}, ... } so prompt builders stay unchanged.
 * Only CONFIRMED entities are returned (unconfirmed inferred canon is not fact).
 * Throws err.status = 403 if the world isn't owned by uid.
 */
async function loadCanon(db, projectId, project, uid, opts = {}) {
  const worldId = await ensureWorld(db, projectId, project);
  const worldRef = db.collection('worlds').doc(worldId);
  const [worldSnap, entitiesSnap] = await Promise.all([worldRef.get(), worldRef.collection('entities').get()]);

  if (!worldSnap.exists || worldSnap.data().owner !== uid) {
    const err = new Error('Forbidden: world not owned by user');
    err.status = 403;
    throw err;
  }
  if (opts.write && worldSnap.data().freeze) { // Маркет: under licence review / on sale — no new scenes (reading goes on)
    const err = new Error('Світ заморожено (Маркет): зміни недоступні');
    err.status = 423;
    throw err;
  }

  const canon = emptyCanon();
  const world = worldSnap.data();
  for (const f of WORLD_FIELDS) if (world[f] !== undefined) canon.world[f] = world[f];

  entitiesSnap.forEach(doc => {
    const data = doc.data();
    if (!CANON_KINDS.includes(data.kind)) return;
    if (data.origin && data.origin.confirmed === false) return;
    canon[data.kind][doc.id] = data;
  });

  return { worldId, canon };
}

/**
 * Merge AI memorySuggestions into the world (auto-approve policy: confirmed=true,
 * provenance recorded as inferred). Existing entities are matched by id OR name
 * and updated field-wise (merge), never replaced. Mutates `canon` so subsequent
 * calls in the same run deduplicate.
 * @returns {Promise<Array<{type, id, name}>>}
 */
async function mergeSuggestions(db, worldId, canon, suggestions) {
  const entitiesRef = db.collection('worlds').doc(worldId).collection('entities');
  const byName = {};
  for (const kind of CANON_KINDS) {
    byName[kind] = {};
    for (const [id, e] of Object.entries(canon[kind] || {})) {
      const n = (e.name || e.title || '').toLowerCase().trim();
      if (n) byName[kind][n] = id;
    }
  }

  const batch = db.batch();
  const merged = [];
  const now = admin.firestore.FieldValue.serverTimestamp();

  for (const s of suggestions) {
    const kind = toKind(s.type);
    if (!kind) continue;
    const newData = { ...(s.newData || {}) };
    delete newData.id;
    delete newData.kind;
    delete newData.origin;
    const name = newData.name || newData.title || '';

    let id = null;
    if (s.targetId && canon[kind][s.targetId]) id = s.targetId;
    else if (s.targetId && byName[kind][String(s.targetId).toLowerCase().trim()]) id = byName[kind][String(s.targetId).toLowerCase().trim()];
    else if (name && byName[kind][name.toLowerCase().trim()]) id = byName[kind][name.toLowerCase().trim()];

    if (id) {
      batch.set(entitiesRef.doc(id), { ...newData, extractedAt: now }, { merge: true });
      canon[kind][id] = { ...canon[kind][id], ...newData };
    } else {
      if (!name) continue;
      id = newEntityId(kind);
      const entity = {
        ...newData,
        id,
        kind,
        name,
        slug: slugify(name),
        origin: {
          source: 'inferred',
          confidence: typeof s.confidence === 'number' ? s.confidence : null,
          confirmed: true, // auto-approve policy (review queue: set false here)
          createdBy: 'ai'
        },
        aiExtracted: true,
        extractedAt: now
      };
      batch.set(entitiesRef.doc(id), entity);
      canon[kind][id] = entity;
      byName[kind][name.toLowerCase().trim()] = id;
    }
    merged.push({ type: kind, id, name });
  }

  if (merged.length > 0) {
    batch.set(db.collection('worlds').doc(worldId), { updatedAt: now }, { merge: true });
    await batch.commit();
  }
  return merged;
}

module.exports = {
  CANON_KINDS, toKind, newEntityId, slugify, emptyCanon, worldIdForProject,
  ensureWorld, loadCanon, mergeSuggestions
};
