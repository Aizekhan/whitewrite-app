// Storage quota: every file under worlds/{w}/ counts toward the world owner's plan (paid-features.js PLANS.storageGB,
// all their worlds together), and so do the author's avatars (users/{u}/avatar/ → storageUsage/u_{u}) and story covers
// (projects/{p}/cover/ → storageUsage/p_{p}) — the rules cap their size, not their number. storageUsage/{id} { owner, bytes }
// (server only) is kept by these two triggers; a new file that would pass the quota is deleted right after the upload (the
// rules can't sum sizes). The check and the increment are one transaction, serialized per owner by storageLocks/{owner}
// (server only): parallel uploads can't all pass the same free room. The page checks the same sum before an upload
// (gamebible.js) so the author is told first; this is the guarantee.
const { onObjectFinalized, onObjectDeleted } = require('firebase-functions/v2/storage');
const { admin, db, getPlanBudget } = require('./common');

const GB = 1024 * 1024 * 1024;
const BUCKET = 'whitewrite-app.firebasestorage.app'; // the default bucket (app/firebase config storageBucket)
const worldOf = (name) => { const m = /^worlds\/([^/]+)\//.exec(name || ''); return m ? m[1] : null; };
// the storageUsage doc of a file and its owner: a world's owner, the avatar's user, the story's owner (null: not counted)
async function ownerOf(name) {
  const w = worldOf(name);
  if (w) { const d = await db.collection('worlds').doc(w).get(); return d.exists ? { id: w, owner: d.data().owner } : null; } // a world being deleted: cleanup removes its files
  let m = /^users\/([^/]+)\/avatar\//.exec(name || '');
  if (m) return { id: 'u_' + m[1], owner: m[1] };
  m = /^projects\/([^/]+)\/cover\//.exec(name || '');
  if (m) { const p = await db.collection('projects').doc(m[1]).get(); return p.exists && p.data().owner ? { id: 'p_' + m[1], owner: p.data().owner } : null; }
  return null;
}
const usageIdOf = (name) => { const w = worldOf(name); if (w) return w; const m = /^(users|projects)\/([^/]+)\/(avatar|cover)\//.exec(name || ''); return m ? m[1][0] + '_' + m[2] : null; };

// The owner's bytes over all their worlds, and the quota of their plan
async function usage(uid) {
  const [u, rows] = await Promise.all([db.collection('users').doc(uid).get(), db.collection('storageUsage').where('owner', '==', uid).get()]);
  const bytes = rows.docs.reduce((n, d) => n + Math.max(0, d.get('bytes') || 0), 0);
  return { bytes, quota: getPlanBudget((u.exists && u.data().plan) || 'free').storageGB * GB };
}

async function onUpload(obj) {
  const size = Number(obj.size) || 0;
  const who = size ? await ownerOf(obj.name) : null;
  if (!who) return { counted: false };
  const owner = who.owner;
  const u = await db.runTransaction(async (tx) => {
    const lock = db.collection('storageLocks').doc(owner);
    const [user, rows] = await Promise.all([tx.get(db.collection('users').doc(owner)), tx.get(db.collection('storageUsage').where('owner', '==', owner)), tx.get(lock)]);
    const bytes = rows.docs.reduce((n, d) => n + Math.max(0, d.get('bytes') || 0), 0);
    const quota = getPlanBudget((user.exists && user.data().plan) || 'free').storageGB * GB;
    if (bytes + size > quota) return { bytes, quota };
    tx.set(db.collection('storageUsage').doc(who.id), { owner, bytes: admin.firestore.FieldValue.increment(size), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.set(lock, { at: admin.firestore.FieldValue.serverTimestamp() });
    return null;
  });
  if (u) {
    const f = admin.storage().bucket(obj.bucket).file(obj.name);
    await f.setMetadata({ metadata: { wwUncounted: '1' } }).catch(() => {}); // onRemove must not take off bytes never counted
    await f.delete().catch(() => {});
    console.warn('[storage-quota] over quota, deleted', obj.name, u.bytes + size, '>', u.quota);
    return { counted: false, deleted: true };
  }
  return { counted: true };
}

// A file removed or overwritten (the old generation): its bytes come off. Files from before the quota were never counted —
// the sum may dip below 0 for a while; usage() clamps every world at 0.
async function onRemove(obj) {
  const w = usageIdOf(obj.name), size = Number(obj.size) || 0;
  if (!w || !size || (obj.metadata && obj.metadata.wwUncounted)) return;
  await db.collection('storageUsage').doc(w).update({ bytes: admin.firestore.FieldValue.increment(-size) }).catch(() => {}); // gone with its world
}

exports.storageUploaded = onObjectFinalized({ region: 'us-central1', bucket: BUCKET }, (event) => onUpload(event.data));
exports.storageRemoved = onObjectDeleted({ region: 'us-central1', bucket: BUCKET }, (event) => onRemove(event.data));
exports._quota = { onUpload, onRemove, usage, worldOf, usageIdOf, GB }; // tests only
