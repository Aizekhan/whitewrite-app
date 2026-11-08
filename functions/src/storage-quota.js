// Storage quota: every file under worlds/{w}/ counts toward the world owner's plan (paid-features.js PLANS.storageGB,
// all their worlds together). storageUsage/{w} { owner, bytes } (server only) is kept by these two triggers; a new file
// that would pass the quota is deleted right after the upload (the rules can't sum sizes). The page checks the same
// sum before an upload (gamebible.js) so the author is told first; this is the guarantee.
const { onObjectFinalized, onObjectDeleted } = require('firebase-functions/v2/storage');
const { admin, db, getPlanBudget } = require('./common');

const GB = 1024 * 1024 * 1024;
const BUCKET = 'whitewrite-app.firebasestorage.app'; // the default bucket (app/firebase config storageBucket)
const worldOf = (name) => { const m = /^worlds\/([^/]+)\//.exec(name || ''); return m ? m[1] : null; };

// The owner's bytes over all their worlds, and the quota of their plan
async function usage(uid) {
  const [u, rows] = await Promise.all([db.collection('users').doc(uid).get(), db.collection('storageUsage').where('owner', '==', uid).get()]);
  const bytes = rows.docs.reduce((n, d) => n + Math.max(0, d.get('bytes') || 0), 0);
  return { bytes, quota: getPlanBudget((u.exists && u.data().plan) || 'free').storageGB * GB };
}

async function onUpload(obj) {
  const w = worldOf(obj.name), size = Number(obj.size) || 0;
  if (!w || !size) return { counted: false };
  const world = await db.collection('worlds').doc(w).get();
  if (!world.exists) return { counted: false }; // a world being deleted: cleanup removes its files
  const owner = world.data().owner, u = await usage(owner);
  if (u.bytes + size > u.quota) {
    const f = admin.storage().bucket(obj.bucket).file(obj.name);
    await f.setMetadata({ metadata: { wwUncounted: '1' } }).catch(() => {}); // onRemove must not take off bytes never counted
    await f.delete().catch(() => {});
    console.warn('[storage-quota] over quota, deleted', obj.name, u.bytes + size, '>', u.quota);
    return { counted: false, deleted: true };
  }
  await db.collection('storageUsage').doc(w).set({ owner, bytes: admin.firestore.FieldValue.increment(size), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { counted: true };
}

// A file removed or overwritten (the old generation): its bytes come off. Files from before the quota were never counted —
// the sum may dip below 0 for a while; usage() clamps every world at 0.
async function onRemove(obj) {
  const w = worldOf(obj.name), size = Number(obj.size) || 0;
  if (!w || !size || (obj.metadata && obj.metadata.wwUncounted)) return;
  await db.collection('storageUsage').doc(w).update({ bytes: admin.firestore.FieldValue.increment(-size) }).catch(() => {}); // gone with its world
}

exports.storageUploaded = onObjectFinalized({ region: 'us-central1', bucket: BUCKET }, (event) => onUpload(event.data));
exports.storageRemoved = onObjectDeleted({ region: 'us-central1', bucket: BUCKET }, (event) => onRemove(event.data));
exports._quota = { onUpload, onRemove, usage, worldOf, GB }; // tests only
