// 🔌 Інтеграції: the author's own API keys for outside generation services — a 3D model generator (Meshy, Tripo…) and an
// image generator (OpenAI, Google, Stability, Replicate, fal, Leonardo…). One set per world and one per game; a game
// without its own key uses the world's (getIntegrationKey). The key itself is never sent back to a browser:
//   integrationKeys/{worldId} | integrationKeys/{worldId}__{gameId}   { worldId, gameId, <kind>: { key, provider, name } } — server only
//   worlds/{w}.integrations.<kind> | games/{g}.integrations.<kind>   { provider, name, tail, check: ok|unverified, at } — written only here
const { onRequest, admin, db, cors } = require('./common');
// outbound calls time out: a hanging provider must not hold the function
const fetch = (url, o = {}) => globalThis.fetch(url, { signal: AbortSignal.timeout(15000), ...o });

const bearer = (k) => ({ Authorization: 'Bearer ' + k });
// the check is a read-only request: 2xx = accepted, 401/403 = refused, anything else = saved as «not checked»
const PROVIDERS = {
  model3d: {
    meshy: { url: () => 'https://api.meshy.ai/openapi/v1/balance', headers: bearer },
    tripo: { url: () => 'https://api.tripo3d.ai/v2/openapi/user/balance', headers: bearer },
    other: null,
  },
  image: {
    openai: { url: () => 'https://api.openai.com/v1/models', headers: bearer },
    google: { url: (k) => 'https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(k), headers: () => ({}) },
    stability: { url: () => 'https://api.stability.ai/v1/user/account', headers: bearer },
    replicate: { url: () => 'https://api.replicate.com/v1/account', headers: bearer },
    leonardo: { url: () => 'https://cloud.leonardo.ai/api/rest/v1/me', headers: bearer },
    fal: null, bfl: null, recraft: null, ideogram: null, // no read-only endpoint to try a key on
    other: null,
  },
};
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const del = () => admin.firestore.FieldValue.delete();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const fail = (status, error, extra) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra || {}) });
const keyDoc = (worldId, gameId) => db.collection('integrationKeys').doc(gameId ? worldId + '__' + gameId : worldId);

async function check(kind, provider, key) {
  const p = PROVIDERS[kind][provider];
  if (!p) return 'unverified';
  try {
    const r = await fetch(p.url(key), { headers: p.headers(key) });
    if (r.status === 401 || r.status === 403) throw fail(400, 'Сервіс не прийняв ключ — перевір, що він скопійований повністю і ще діє', { code: 'KEY_REJECTED' });
    return r.ok ? 'ok' : 'unverified';
  } catch (e) {
    if (e.status) throw e;
    return 'unverified'; // the provider is down or slow — the key is kept, the author sees «не перевірено»
  }
}

// For the server code that generates with the author's key (3D / images): the game's own key, else the world's
async function getIntegrationKey(worldId, gameId, kind) {
  const [g, w] = await Promise.all([gameId ? keyDoc(worldId, gameId).get() : null, keyDoc(worldId).get()]);
  const pick = (d) => d && d.exists && d.data()[kind] && d.data()[kind].key ? Object.assign({ from: d.id === worldId ? 'world' : 'game' }, d.data()[kind]) : null;
  return pick(g) || pick(w);
}

// Deleting a game / world: its keys go too (the docs are server only, the page cannot delete them)
async function purge(worldId, gameId) {
  if (gameId) return keyDoc(worldId, gameId).delete();
  const q = await db.collection('integrationKeys').where('worldId', '==', worldId).get();
  await Promise.all(q.docs.map((d) => d.ref.delete()));
}

async function handle(b, uid) {
  const op = str(b.op, 20), worldId = str(b.worldId, 120), gameId = str(b.gameId, 120);
  const w = await db.collection('worlds').doc(worldId).get();
  if (!worldId || !w.exists || w.data().owner !== uid) throw fail(403, 'Світ не знайдено або немає доступу'); // keys are the owner's only
  if (w.data().freeze) throw fail(409, 'Світ заморожено на час сертифікації чи продажу', { code: 'FROZEN' });
  const target = gameId ? w.ref.collection('games').doc(gameId) : w.ref;
  if (gameId && !(await target.get()).exists) throw fail(404, 'Гру не знайдено');
  if (op === 'purge') { await purge(worldId, gameId); return { purged: true }; }
  const kind = str(b.kind, 20);
  if (!PROVIDERS[kind]) throw fail(400, 'Unknown kind');
  if (op === 'set') {
    const provider = str(b.provider, 20), key = str(b.key, 500), name = provider === 'other' ? str(b.name, 60) : '';
    if (!(provider in PROVIDERS[kind])) throw fail(400, 'Unknown provider');
    if (key.length < 8 || /\s/.test(key)) throw fail(400, 'Схоже, це не ключ — встав його повністю, без пробілів');
    const state = await check(kind, provider, key);
    await keyDoc(worldId, gameId).set({ worldId, gameId: gameId || null, [kind]: { key, provider, name }, updatedAt: ts() }, { merge: true });
    const pub = { provider, name, tail: key.slice(-4), check: state, at: admin.firestore.Timestamp.now() };
    await target.update({ ['integrations.' + kind]: pub });
    return { kind, provider, tail: pub.tail, check: state };
  }
  if (op === 'remove') {
    await keyDoc(worldId, gameId).set({ [kind]: del() }, { merge: true });
    await target.update({ ['integrations.' + kind]: del() });
    return { removed: true };
  }
  throw fail(400, 'Unknown op');
}

exports.integrations = onRequest({ region: 'us-central1', timeoutSeconds: 60 }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const h = req.headers.authorization || '';
      if (!h.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      let uid;
      try { uid = (await admin.auth().verifyIdToken(h.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      return res.status(200).json(Object.assign({ success: true }, await handle(req.body || {}, uid)));
    } catch (e) {
      if (e.status) return res.status(e.status).json(e.body || { error: e.message });
      console.error('integrations error:', e);
      return res.status(500).json({ error: `Помилка інтеграцій: ${e.message}` });
    }
  });
});

exports._integrations = { PROVIDERS, getIntegrationKey, purge, handle };
