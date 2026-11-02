// Друзі й Команда. Friends are made by e-mail (Account → «Друзі»); a world's owner adds accepted friends to the world's team
// (world hub → «Команда») with a role. Everything here is written ONLY by the server (firestore.rules):
//   users/{uid}/friends/{fuid}  { uid, name, email, status: pending (I asked) | incoming (they asked) | accepted, at } — the owner reads
//   worlds/{w}.team.{uid}       { role, view[], edit[], viewKinds[], editKinds[], name, email, at }
//   worlds/{w}.teamUids         [uid…] — the shell lists «shared with me» worlds by array-contains
// Roles: admin  — everything, and ✦ AI actions on the OWNER's tokens (payerFor);
//        editor — everything except ✦ (no token spending);
//        viewer — reads everything, changes nothing;
//        custom — reads the `view` sections and edits the `edit` sections (menu ids of the World / Game Bible).
// firestore.rules / storage.rules enforce it; the Bible shows only what the member may see.
const { onRequest, admin, db, cors } = require('./common');

const ROLES = ['admin', 'editor', 'viewer', 'custom'];
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const del = () => admin.firestore.FieldValue.delete();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const fail = (status, error) => Object.assign(new Error(error), { status });
const SEC = /^[\w-]{1,40}$/;
const KIND_OF = { 'w-characters': 'characters', 'w-locations': 'locations', 'w-factions': 'factions', 'w-items': 'artifacts', chronicle: 'events' }; // canon menu → entity kind
const fref = (a, b) => db.collection('users').doc(a).collection('friends').doc(b);

// The uid whose tokens an AI action spends: the owner when an admin of the team acts, else the caller
async function payerFor(uid, worldId) {
  if (!worldId) return uid;
  const w = await db.collection('worlds').doc(String(worldId).slice(0, 120)).get();
  if (!w.exists) return uid;
  const d = w.data(), m = (d.team || {})[uid];
  return d.owner !== uid && m && m.role === 'admin' ? d.owner : uid;
}

async function who(uid) {
  const [u, a] = await Promise.all([db.collection('users').doc(uid).get(), admin.auth().getUser(uid).catch(() => null)]);
  return { name: str((u.exists && u.data().name) || (a && a.displayName) || '', 120), email: (a && a.email) || '' };
}

// sections: valid ids, unique, at most 80; custom → the read list includes the edit list
function member(body, prev) {
  const role = ROLES.includes(body.role) ? body.role : 'viewer';
  const list = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => str(x, 40)).filter((x) => SEC.test(x)))].slice(0, 80);
  const edit = role === 'custom' ? list(body.edit) : [];
  const view = role === 'custom' ? [...new Set(list(body.view).concat(edit))] : [];
  const kinds = (l) => l.map((s) => KIND_OF[s]).filter(Boolean);
  return { role, view, edit, viewKinds: kinds(view), editKinds: kinds(edit), name: prev.name, email: prev.email, at: Date.now() };
}

async function handle(op, b, uid) {
  if (op === 'invite') {
    const email = str(b.email, 200).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail(400, 'Потрібна пошта друга');
    const other = await admin.auth().getUserByEmail(email).catch(() => null);
    if (!other) throw fail(404, 'Користувача з такою поштою в WhiteWrite немає — запроси його зареєструватись');
    if (other.uid === uid) throw fail(400, 'Це твоя пошта');
    const [mine, theirs] = await Promise.all([fref(uid, other.uid).get(), fref(other.uid, uid).get()]);
    if (mine.exists && mine.data().status === 'accepted') return { status: 'accepted' };
    const [me, them] = await Promise.all([who(uid), who(other.uid)]);
    const accept = mine.exists && mine.data().status === 'incoming'; // they asked first: we are friends now
    const status = accept ? 'accepted' : 'pending';
    await Promise.all([
      fref(uid, other.uid).set({ uid: other.uid, name: them.name, email: them.email, status, at: ts() }),
      fref(other.uid, uid).set({ uid, name: me.name, email: me.email, status: accept ? 'accepted' : 'incoming', at: theirs.exists ? theirs.data().at || ts() : ts() }),
    ]);
    return { status };
  }
  if (op === 'accept') {
    const f = str(b.uid, 128), mine = await fref(uid, f).get();
    if (!mine.exists || mine.data().status !== 'incoming') throw fail(404, 'Запрошення не знайдено');
    await Promise.all([fref(uid, f).update({ status: 'accepted', at: ts() }), fref(f, uid).set({ status: 'accepted', at: ts() }, { merge: true })]);
    return { status: 'accepted' };
  }
  if (op === 'unfriend') { // also leaves each other's teams
    const f = str(b.uid, 128);
    await Promise.all([fref(uid, f).delete(), fref(f, uid).delete()]);
    const [a, c] = await Promise.all([db.collection('worlds').where('owner', '==', uid).where('teamUids', 'array-contains', f).get(),
      db.collection('worlds').where('owner', '==', f).where('teamUids', 'array-contains', uid).get()]);
    await Promise.all(a.docs.map((d) => d.ref.update({ ['team.' + f]: del(), teamUids: admin.firestore.FieldValue.arrayRemove(f) }))
      .concat(c.docs.map((d) => d.ref.update({ ['team.' + uid]: del(), teamUids: admin.firestore.FieldValue.arrayRemove(uid) }))));
    return { removed: true };
  }
  const wref = db.collection('worlds').doc(str(b.worldId, 120)), w = await wref.get();
  if (!w.exists) throw fail(404, 'Світ не знайдено');
  const f = str(b.uid, 128);
  if (op === 'set') {
    if (w.data().owner !== uid) throw fail(403, 'Команду змінює лише власник світу');
    const fr = await fref(uid, f).get();
    if (!fr.exists || fr.data().status !== 'accepted') throw fail(403, 'Спершу додай людину в друзі (Акаунт → Друзі)');
    const m = member(b, fr.data());
    await wref.update({ ['team.' + f]: m, teamUids: admin.firestore.FieldValue.arrayUnion(f), updatedAt: ts() });
    return { member: m };
  }
  if (op === 'remove') { // the owner removes a member, or a member leaves
    if (w.data().owner !== uid && f !== uid) throw fail(403, 'Немає доступу');
    await wref.update({ ['team.' + f]: del(), teamUids: admin.firestore.FieldValue.arrayRemove(f) });
    return { removed: true };
  }
  throw fail(400, 'Unknown op');
}

exports.team = onRequest({ region: 'us-central1' }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const h = req.headers.authorization || '';
      if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      let uid;
      try { uid = (await admin.auth().verifyIdToken(h.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const b = req.body || {};
      return res.status(200).json(Object.assign({ success: true }, await handle(str(b.op, 20), b, uid)));
    } catch (e) {
      if (e.status) return res.status(e.status).json({ error: e.message });
      console.error('team error:', e);
      return res.status(500).json({ error: `Помилка: ${e.message}` });
    }
  });
});

exports._team = { payerFor, member, ROLES, KIND_OF };
