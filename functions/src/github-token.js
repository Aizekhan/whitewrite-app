// One GitHub connection per author (v2.56): the token pasted last — for a game's repository or the world backup — is kept in
// githubTokens/{uid} (server only, firestore.rules) and reused by the next connection, so the author pastes it once.
// users/{uid}.github { login } tells the pages a token is saved (never the token itself).
// The connections keep their own copies (repoTokens/{w}__{g}, backupTokens/{w}): forgetting the saved token does not cut them off.
const { admin, db } = require('./common');

async function savedGithub(uid) {
  const d = await db.collection('githubTokens').doc(uid).get();
  return d.exists ? String(d.data().token || '') : '';
}

async function rememberGithub(uid, token, login) {
  const at = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('githubTokens').doc(uid).set({ token, login: login || '', at });
  await db.collection('users').doc(uid).set({ github: { login: login || '', at } }, { merge: true });
}

async function forgetGithub(uid) {
  await db.collection('githubTokens').doc(uid).delete();
  await db.collection('users').doc(uid).set({ github: admin.firestore.FieldValue.delete() }, { merge: true });
}

// the login behind a token (or '' — a fine-grained token without the user scope still works for repositories)
async function loginOf(token) {
  try {
    const r = await fetch('https://api.github.com/user', { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'WhiteWrite' } });
    return r.ok ? String((await r.json()).login || '') : '';
  } catch (e) { return ''; }
}

module.exports = { savedGithub, rememberGithub, forgetGithub, loginOf };
