// The TEXT snapshot of a world: the canon, lore, games (cards, plan, tasks, quests, dialogues) and the owner's stories.
// Media (files, covers, title images), keys, integrations, the team and every server-side log never go in.
// Used by the Маркет (licence review, what a buyer gets — market.js) and the daily GitHub backup (backup.js).
const crypto = require('crypto');
const { db } = require('./common');

const DROP = new Set(['files', 'styleAi', 'cover', 'titleArt', 'image', 'images', 'imageUrl', 'thumb', 'launch', 'repo', 'cosmograph', 'freeze', 'owner',
  'licence', 'team', 'teamUids', 'backup']);
const GAME_SUBS = ['cards', 'plan', 'tasks', 'quests', 'dialogues']; // everything else under a game (telemetry, logs, keys…) stays out
const WORLD_SUBS = ['entities', 'lore', 'games'];
function clean(o) {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') {
    if (typeof o.toDate === 'function') return o.toDate().toISOString();
    const out = {};
    for (const [k, v] of Object.entries(o)) if (!DROP.has(k) && v !== undefined) out[k] = clean(v);
    return out;
  }
  return o;
}
const docs = (snap) => snap.docs.map((d) => Object.assign({ id: d.id }, clean(d.data())));

// uid must own the world (null when it does not); schema names what the snapshot is for
async function buildSnapshot(worldId, uid, schema) {
  const wref = db.collection('worlds').doc(worldId);
  const [w, ents, lore, games, projects] = await Promise.all([wref.get(), wref.collection('entities').get(), wref.collection('lore').get(),
    wref.collection('games').get(), db.collection('projects').where('worldId', '==', worldId).get()]);
  if (!w.exists || w.data().owner !== uid) return null;
  const snap = { schema: schema || 'whitewrite.licence/1', worldId, world: clean(w.data()),
    entities: docs(ents).filter((e) => !(e.origin && e.origin.confirmed === false)), lore: docs(lore), games: [], stories: [] };
  for (const g of games.docs) {
    const [cards, plan, tasks, quests, dialogues] = await Promise.all(GAME_SUBS.map((s) => g.ref.collection(s).get()));
    snap.games.push(Object.assign({ id: g.id }, clean(g.data()), { cards: docs(cards), plan: docs(plan)[0] || null, tasks: docs(tasks), quests: docs(quests), dialogues: docs(dialogues) }));
  }
  for (const p of projects.docs.filter((d) => d.data().owner === uid)) {
    const scenes = await p.ref.collection('scenes').get();
    snap.stories.push(Object.assign({ id: p.id }, clean(p.data()), { scenes: docs(scenes) }));
  }
  const json = JSON.stringify(snap);
  return { snap, json, chars: json.length, hash: crypto.createHash('sha256').update(json).digest('hex') };
}

module.exports = { buildSnapshot, clean, DROP, GAME_SUBS, WORLD_SUBS };
