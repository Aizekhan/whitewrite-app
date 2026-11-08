// Server-side cleanup after the author deletes a game or a world. The page deletes the content itself (gamebible.js
// removeGame / deleteWorld, the rules check ownership), but what it can't reach — or leaves behind when the tab closes
// halfway — goes here, once the doc is gone: GitHub tokens, MCP / ingest / integration keys, marketing secrets and the
// queue, Community showcases, every file under the path in Storage, and any subcollection still left.
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { admin, db } = require('./common');

const docId = admin.firestore.FieldPath.documentId;
const byPrefix = (col, prefix) => db.collection(col).where(docId(), '>=', prefix).where(docId(), '<', prefix + '~').get();
async function removeAll(snaps) {
  const bw = db.bulkWriter();
  snaps.forEach((s) => s.docs.forEach((d) => bw.delete(d.ref)));
  await bw.close();
}
async function removeShowcases(ids) {
  for (const id of ids) {
    const ref = db.collection('community').doc(id);
    if ((await ref.get()).exists) await db.recursiveDelete(ref); // + its likes and reports
  }
}
const removeFiles = (prefix) => admin.storage().bucket().deleteFiles({ prefix }).catch((e) => console.warn('[cleanup] files:', prefix, e.message));

async function cleanGame(w, g) {
  const key = w + '__' + g;
  await removeAll(await Promise.all([
    db.collection('mcpKeys').where('worldId', '==', w).where('gameId', '==', g).get(),
    db.collection('ingestKeys').where('worldId', '==', w).where('gameId', '==', g).get(),
    byPrefix('marketingSecrets', key + '__'), byPrefix('marketingQueue', key + '__')])); // {w}__{g}__{id}: «__» ends the game id
  await Promise.all([db.collection('repoTokens').doc(key).delete(), db.collection('integrationKeys').doc(key).delete()]);
  await removeShowcases([key]);
  await removeFiles(`worlds/${w}/games/${g}/`);
  await db.recursiveDelete(db.collection('worlds').doc(w).collection('games').doc(g)); // subcollections the page didn't reach
}

async function cleanWorld(w) {
  await removeAll(await Promise.all([
    db.collection('mcpKeys').where('worldId', '==', w).get(),
    db.collection('ingestKeys').where('worldId', '==', w).get(),
    db.collection('integrationKeys').where('worldId', '==', w).get(),
    byPrefix('repoTokens', w + '__'), byPrefix('marketingSecrets', w + '__'), byPrefix('marketingQueue', w + '__')]));
  await db.collection('backupTokens').doc(w).delete();
  await removeShowcases([w].concat((await byPrefix('community', w + '__')).docs.map((d) => d.id)));
  await removeFiles(`worlds/${w}/`);
  await db.collection('storageUsage').doc(w).delete(); // its quota bytes (storage-quota.js; later delete events find no doc)
  await db.recursiveDelete(db.collection('worlds').doc(w));
}

exports.gameDeleted = onDocumentDeleted({ document: 'worlds/{worldId}/games/{gameId}', region: 'us-central1', timeoutSeconds: 540 },
  (event) => cleanGame(event.params.worldId, event.params.gameId));
exports.worldDeleted = onDocumentDeleted({ document: 'worlds/{worldId}', region: 'us-central1', timeoutSeconds: 540 },
  (event) => cleanWorld(event.params.worldId));
exports._cleanup = { cleanGame, cleanWorld }; // tests only
