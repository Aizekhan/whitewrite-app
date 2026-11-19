// Спільнота: authors open a showcase of their world or game to everyone (any plan, even Free).
// The author's Bible builds a snapshot of the sections they chose (gamebible.js communitySnapshot); the server checks
// ownership, trims it and stores it. Plan, tasks, keys, logs, telemetry and notes never leave the Bible.
//
// Server-only (firestore.rules: anyone reads what is not hidden, nobody writes):
//   community/{pubId}           pubId = worldId (a world) or `${worldId}__${gameId}` (a game)
//     { kind: world|game, worldId, gameId, owner, author, title, tagline, summary, cover, facts[], rules[], sections[{id,label,n}],
//       likes, score, reports, hidden, promotedUntil?, publishedAt, updatedAt, activeAt }
//   community/{pubId}/items/{i} { sec, group, title, blocks[{l,t}], imgs[] }
//   community/{pubId}/likes/{uid} { at } — one ♥ per signed-in user; the owner reads their own
//   community/{pubId}/followers/{uid} { at } — «стежити» (v2.44): one per signed-in user, counter `followers`; the follower reads their own
//   + on a game showcase: withWorld, worldTagline, worldSummary (v2.47) — the author ticked the world too: it has no card of its own and
//     opens inside every ticked game (its sections ride along, labelled 🌍; facts / rules are the world's)
//   + on a game showcase: releases[{kind, url}] + hasRelease — links to the released game (Спільнота → «🎮 Готові ігри», a future feature)
//   community_reports/{pubId}__{uid} { pubId, uid, title, reason, at, resolved } — admins read
//   community_blocked/{pubId}   { at } — an admin hid it: unpublish + publish again does not bring it back (server only)
//   community_home/current      { top[], pool[], at } — the home page cards (public read)
//   + on the showcase: discord (an invite link), lookingForTeam, teamNote — «🤝 Шукає команду»
//   collab/{uid}_{offer|seek}   «Співтворці» (unpaid co-creation): written by the owner through firestore.rules;
//                               here only reports (`report` with col: 'collab') and admin `hide`
// Rating: ♥ that fade with age (half weight after 30 days), so the top never freezes. communityRotate (hourly) ranks the
// showcases: the best one of each author → top 20 (paid promotion, `promotedUntil` set by an admin, goes first);
// the rest whose author was active in the last 7 days → the pool for the «random author» card.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, admin, db, cors, publicMessage } = require('./common');

const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const DAY = 24 * 3600 * 1000;
const HALF_LIFE = 30 * DAY, ACTIVE = 7 * DAY, TOP = 20;
const LIMITS = { items: 1000, blocks: 30, block: 12000, imgs: 8, sections: 60, facts: 40, rules: 60 };
// only files of our own Storage bucket are shown (download URLs with a token)
// a Discord server invite: discord.gg/<code> or discord.com/invite/<code>
const okDiscord = (u) => typeof u === 'string' && /^https:\/\/(discord\.gg|(www\.)?discord\.com\/invite)\/[A-Za-z0-9-]{2,40}\/?$/.test(u.trim());
// a released game: a store page or a web build (https only)
const RELEASE_KINDS = ['steam', 'itch', 'googleplay', 'appstore', 'epic', 'gog', 'web', 'other'];
// no double quotes, angle brackets, backslashes or whitespace: the URL is shown inside HTML attributes and CSS url('…')
const okRelease = (r) => r && RELEASE_KINDS.indexOf(r.kind) >= 0 && typeof r.url === 'string' && /^https:\/\/[^\s"<>\\`]{4,500}$/.test(r.url.trim());
const okImg = (u) => typeof u === 'string' && /^https:\/\/firebasestorage\.googleapis\.com\/[^\s"<>\\`]+$/.test(u) && u.length < 2000;

function cleanItem(it, secIds) {
  const sec = str(it && it.sec, 80);
  if (!sec || secIds.indexOf(sec) < 0) return null;
  const blocks = (Array.isArray(it.blocks) ? it.blocks : []).slice(0, LIMITS.blocks)
    .map((b) => ({ l: str(b && b.l, 120), t: str(b && b.t, LIMITS.block) })).filter((b) => b.t);
  const imgs = (Array.isArray(it.imgs) ? it.imgs : []).filter(okImg).slice(0, LIMITS.imgs);
  const title = str(it.title, 200);
  if (!title && !blocks.length && !imgs.length) return null;
  return { sec, group: str(it.group, 120), title, blocks, imgs };
}

async function deleteSub(ref, sub) {
  const snap = await ref.collection(sub).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const b = db.batch(); snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
  }
}

// the latest edit of the author's world or game: the doc, its entities / cards
async function lastActivity(d) {
  const w = db.collection('worlds').doc(d.worldId);
  const ms = (x) => (x && x.toMillis ? x.toMillis() : 0);
  const newest = async (col) => { try { const s = await col.orderBy('updatedAt', 'desc').limit(1).get(); return s.empty ? 0 : ms(s.docs[0].get('updatedAt')); } catch (e) { return 0; } };
  const ws = await w.get();
  if (!ws.exists) return null; // the world is gone
  const at = [ms(ws.get('updatedAt')), await newest(w.collection('entities'))];
  if (d.kind === 'game' && d.gameId) {
    const g = w.collection('games').doc(d.gameId), gs = await g.get();
    if (!gs.exists) return null;
    at.push(ms(gs.get('updatedAt')), await newest(g.collection('cards')));
  }
  return Math.max(...at);
}

// ♥ with ageing, kept incrementally: heat = Σ 2^((like.at − EPOCH) / HALF_LIFE), changed by each like / unlike, so
// score(now) = heat · 2^(−(now − EPOCH) / HALF_LIFE) — no showcase's likes are re-read each hour (a doc without heat
// gets it once from its likes). The activity check (2–4 reads) runs at most every ACT_EVERY per showcase.
const EPOCH = Date.UTC(2026, 0, 1), ACT_EVERY = 6 * 3600 * 1000;
const heatOf = (ms) => Math.pow(2, (ms - EPOCH) / HALF_LIFE);
const scoreAt = (heat, now) => (heat || 0) / heatOf(now);
const homeCard = (id, d) => ({ id, kind: d.kind, title: d.title || '', tagline: d.tagline || '', cover: d.cover || '', author: d.author || '', likes: d.likes || 0, followers: d.followers || 0, worldTitle: d.worldTitle || '', team: !!d.lookingForTeam });

// rank the showcases and rebuild the home page cards
// the best-scored showcases first (index community hidden ↑ score ↓, firestore.indexes.json), so the 2000 read are the ones that can rank;
// while the index builds — unsorted, as before
async function rankedShowcases(n) {
  const q = db.collection('community').where('hidden', '==', false);
  try { return await q.orderBy('score', 'desc').limit(n).get(); } catch (e) { if (e.code !== 9 && !/index/i.test(e.message || '')) throw e; return q.limit(n).get(); }
}
// at most `n` at a time (each showcase may read its world, game, cards and likes)
async function inPool(list, n, fn) {
  const out = new Array(list.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k]); } }));
  return out;
}
async function rebuildHome() {
  const now = Date.now();
  const snap = await rankedShowcases(2000);
  const rows = (await inPool(snap.docs, 10, async (doc) => {
    const d = doc.data(), upd = {}, ms = (x) => (x && x.toMillis ? x.toMillis() : 0);
    let activeAt = ms(d.activeAt);
    if (now - ms(d.activeCheckedAt) > ACT_EVERY) {
      const act = await lastActivity(d);
      if (act === null) { await deleteSub(doc.ref, 'items'); await deleteSub(doc.ref, 'likes'); await deleteSub(doc.ref, 'followers'); await doc.ref.delete(); return null; } // world or game deleted
      if (act > activeAt) { activeAt = act; upd.activeAt = admin.firestore.Timestamp.fromMillis(act); }
      upd.activeCheckedAt = admin.firestore.Timestamp.fromMillis(now);
    }
    let heat = d.heat;
    if (typeof heat !== 'number') { // once: from the likes it already has
      const likes = await doc.ref.collection('likes').get();
      heat = likes.docs.reduce((n, l) => n + heatOf(ms(l.get('at'))), 0);
      upd.heat = heat;
    }
    const score = scoreAt(heat, now);
    // the stored score (the page sorts the Community list by it) is rewritten when it moved > 2% — not every hour
    if (Math.abs((d.score || 0) - score) > 0.02 * Math.max(score, 1e-9) || ((d.score || 0) > 0) !== (score > 1e-9)) upd.score = score;
    if (Object.keys(upd).length) await doc.ref.update(upd);
    return { id: doc.id, d, score, activeAt };
  })).filter(Boolean);
  rows.sort((a, b) => b.score - a.score || (b.d.likes || 0) - (a.d.likes || 0) || b.activeAt - a.activeAt);
  const promoted = rows.filter((r) => r.d.promotedUntil && r.d.promotedUntil.toMillis() > now);
  const authors = {}, top = [];
  promoted.concat(rows).forEach((r) => { // one showcase per author
    if (authors[r.d.owner] || top.length >= Math.max(TOP, promoted.length)) return;
    authors[r.d.owner] = 1; top.push(r);
  });
  const pool = rows.filter((r) => !authors[r.d.owner] && now - r.activeAt <= ACTIVE).slice(0, 200);
  await db.collection('community_home').doc('current').set({
    top: top.map((r) => homeCard(r.id, r.d)), pool: pool.map((r) => homeCard(r.id, r.d)), at: ts(),
  });
  return { top: top.length, pool: pool.length };
}

exports._heat = { heatOf, scoreAt, EPOCH }; // tests only
exports.community = onRequest({ region: 'us-central1', timeoutSeconds: 120, memory: '512MiB' }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      let tok;
      try { tok = await admin.auth().verifyIdToken(auth.slice(7)); } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const uid = tok.uid, isAdmin = tok.admin === true;
      const body = req.body || {};
      const action = str(body.action, 20);

      if (action === 'publish') {
        const worldId = str(body.worldId, 120), gameId = str(body.gameId, 120);
        if (!worldId) return res.status(400).json({ error: 'Missing worldId' });
        const wSnap = await db.collection('worlds').doc(worldId).get();
        if (!wSnap.exists || wSnap.get('owner') !== uid) return res.status(403).json({ error: 'Світ не знайдено або немає доступу' });
        let gSnap = null;
        if (gameId) {
          gSnap = await db.collection('worlds').doc(worldId).collection('games').doc(gameId).get();
          if (!gSnap.exists) return res.status(404).json({ error: 'Гру не знайдено' });
        }
        const sections = (Array.isArray(body.sections) ? body.sections : []).slice(0, LIMITS.sections)
          .map((s) => ({ id: str(s && s.id, 80), label: str(s && s.label, 120) })).filter((s) => s.id);
        const secIds = sections.map((s) => s.id);
        const items = (Array.isArray(body.items) ? body.items : []).slice(0, LIMITS.items).map((it) => cleanItem(it, secIds)).filter(Boolean);
        sections.forEach((s) => { s.n = items.filter((it) => it.sec === s.id).length; });
        const userSnap = await db.collection('users').doc(uid).get();
        const pubId = gameId ? worldId + '__' + gameId : worldId;
        const ref = db.collection('community').doc(pubId);
        const prev = await ref.get();
        const doc = {
          kind: gameId ? 'game' : 'world', worldId, gameId: gameId || '', owner: uid,
          author: str(body.author || (userSnap.exists && userSnap.get('displayName')) || tok.name, 80) || 'Автор',
          title: str(gameId ? gSnap.get('title') : wSnap.get('title'), 160) || '…', worldTitle: str(wSnap.get('title'), 160),
          tagline: str(body.tagline, 240), summary: str(body.summary, 4000), cover: okImg(body.cover) ? body.cover : '',
          facts: (Array.isArray(body.facts) ? body.facts : []).slice(0, LIMITS.facts).map((f) => ({ k: str(f && f.k, 120), v: str(f && f.v, 600) })).filter((f) => f.v),
          rules: (Array.isArray(body.rules) ? body.rules : []).slice(0, LIMITS.rules).map((r) => str(r, 600)).filter(Boolean),
          discord: okDiscord(body.discord) ? body.discord.trim() : '',
          lookingForTeam: body.lookingForTeam === true, teamNote: body.lookingForTeam === true ? str(body.teamNote, 600) : '',
          withWorld: !!gameId && body.withWorld === true,
          worldTagline: gameId && body.withWorld === true ? str(body.worldTagline, 240) : '', worldSummary: gameId && body.withWorld === true ? str(body.worldSummary, 4000) : '',
          releases: gameId ? (Array.isArray(body.releases) ? body.releases : []).filter(okRelease).slice(0, 6).map((r) => ({ kind: r.kind, url: r.url.trim() })) : [],
          sections, updatedAt: ts(), activeAt: ts(),
        };
        doc.hasRelease = doc.releases.length > 0;
        if (!prev.exists) Object.assign(doc, { likes: 0, followers: 0, score: 0, heat: 0, reports: 0, publishedAt: ts(),
          hidden: (await db.collection('community_blocked').doc(pubId).get()).exists }); // hidden by an admin before: stays hidden
        await deleteSub(ref, 'items');
        await ref.set(doc, { merge: true });
        for (let i = 0; i < items.length; i += 400) {
          const b = db.batch();
          items.slice(i, i + 400).forEach((it, j) => b.set(ref.collection('items').doc('i' + String(i + j).padStart(4, '0')), it));
          await b.commit();
        }
        await markStale();
        return res.status(200).json({ success: true, pubId, items: items.length });
      }

      const pubId = str(body.pubId, 260);
      if (!pubId || pubId.includes('/')) return res.status(400).json({ error: 'Missing pubId' }); // '/' would address a sub-document
      const col = body.col === 'collab' ? 'collab' : 'community'; // reports and moderation also cover «Співтворці» posts
      if (col === 'collab' && action !== 'report' && action !== 'hide') return res.status(400).json({ error: 'Unknown action' });
      const ref = db.collection(col).doc(pubId);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Публікацію не знайдено' });
      const d = snap.data();

      if (action === 'unpublish') {
        if (d.owner !== uid && !isAdmin) return res.status(403).json({ error: 'Немає доступу' });
        await deleteSub(ref, 'items'); await deleteSub(ref, 'likes'); await deleteSub(ref, 'followers'); await ref.delete();
        await markStale();
        return res.status(200).json({ success: true });
      }
      if (RATE[action] && !(await rateOk(uid, action))) {
        res.set('Retry-After', '3600');
        return res.status(429).json({ error: 'Забагато дій за добу — спробуй завтра', code: 'RATE_LIMIT' });
      }
      if (action === 'like') {
        if (d.hidden) return res.status(404).json({ error: 'Публікацію не знайдено' });
        if (d.owner === uid) return res.status(400).json({ error: 'Своє не вподобати', code: 'OWN' });
        const on = body.on !== false, likeRef = ref.collection('likes').doc(uid);
        const likes = await db.runTransaction(async (t) => {
          const [l, cur] = await Promise.all([t.get(likeRef), t.get(ref)]);
          let n = cur.get('likes') || 0;
          const upd = {}, inc = admin.firestore.FieldValue.increment;
          if (on && !l.exists) { t.set(likeRef, { at: admin.firestore.Timestamp.now() }); n++; if (typeof cur.get('heat') === 'number') upd.heat = inc(heatOf(Date.now())); }
          if (!on && l.exists) { t.delete(likeRef); n = Math.max(0, n - 1); const at = l.get('at'); if (typeof cur.get('heat') === 'number' && at) upd.heat = inc(-heatOf(at.toMillis())); }
          t.update(ref, Object.assign(upd, { likes: n })); // no heat yet → rebuildHome computes it from the likes
          return n;
        });
        return res.status(200).json({ success: true, likes, liked: on });
      }
      if (action === 'follow') { // «стежити» за світом чи грою — the followers count on cards, the world hub and the Bible
        if (d.hidden) return res.status(404).json({ error: 'Публікацію не знайдено' });
        if (d.owner === uid) return res.status(400).json({ error: 'За своїм не стежать', code: 'OWN' });
        const on = body.on !== false, fRef = ref.collection('followers').doc(uid);
        const followers = await db.runTransaction(async (t) => {
          const [f, cur] = await Promise.all([t.get(fRef), t.get(ref)]);
          let n = cur.get('followers') || 0;
          if (on && !f.exists) { t.set(fRef, { at: admin.firestore.Timestamp.now() }); n++; }
          if (!on && f.exists) { t.delete(fRef); n = Math.max(0, n - 1); }
          t.update(ref, { followers: n });
          return n;
        });
        return res.status(200).json({ success: true, followers, following: on });
      }
      if (action === 'report') {
        const reason = str(body.reason, 1000);
        if (!reason) return res.status(400).json({ error: 'Опиши причину' });
        const rRef = db.collection('community_reports').doc(pubId + '__' + uid);
        const had = (await rRef.get()).exists;
        await rRef.set({ pubId, col, uid, title: d.title || '', owner: d.owner, reason, at: ts(), resolved: false });
        if (!had) await ref.update({ reports: admin.firestore.FieldValue.increment(1) });
        return res.status(200).json({ success: true });
      }
      if (action === 'hide') {
        if (!isAdmin) return res.status(403).json({ error: 'Admin only' });
        const hidden = body.hidden !== false;
        await ref.update({ hidden });
        const blk = db.collection('community_blocked').doc(pubId);
        if (col === 'community') await (hidden ? blk.set({ at: ts() }) : blk.delete());
        const reps = await db.collection('community_reports').where('pubId', '==', pubId).get();
        const b = db.batch(); reps.docs.forEach((r) => b.update(r.ref, { resolved: true })); await b.commit();
        if (col === 'community') await markStale();
        return res.status(200).json({ success: true, hidden });
      }
      return res.status(400).json({ error: 'Unknown action' });
    } catch (e) {
      console.error('[community]', e);
      return res.status(500).json({ error: publicMessage(e) });
    }
  });
});

// ♥ / «стежити» / скарга per user per day (audit 2026-11-19: each one is a transaction on the showcase): communityRate/{uid}_{day}
// { like, follow, report } — server only (no rule matches it); expireAt for a TTL policy on the collection
const RATE = { like: 300, follow: 200, report: 20 };
async function rateOk(uid, action) {
  const day = new Date().toISOString().slice(0, 10), ref = db.collection('communityRate').doc(uid + '_' + day);
  return db.runTransaction(async (t) => {
    const d = await t.get(ref), n = (d.exists && d.get(action)) || 0;
    if (n >= RATE[action]) return false;
    t.set(ref, { [action]: n + 1, expireAt: new Date(Date.now() + 2 * DAY) }, { merge: true });
    return true;
  });
}

// publish / unpublish / hide no longer rebuild the home inline (it walks every showcase — anyone could make it run again and
// again): they mark it stale (one write a minute per instance at most); communityRotate rebuilds a stale home at most every
// STALE_EVERY (a stream of publishes cannot make it walk every showcase every 10 minutes), and every hour anyway (♥ ageing)
const STALE_EVERY = 30 * 60 * 1000, HOURLY = 55 * 60 * 1000;
let staleAt = 0;
const markStale = () => {
  if (Date.now() - staleAt < 60000) return Promise.resolve();
  staleAt = Date.now();
  return db.collection('community_home').doc('current').set({ stale: true }, { merge: true }).catch((e) => console.error('[community] mark stale failed:', e));
};
const rebuildDue = (cur, now) => { const age = cur.at && cur.at.toMillis ? now - cur.at.toMillis() : Infinity; return age >= HOURLY || (!!cur.stale && age >= STALE_EVERY); };
exports.communityRotate = onSchedule({ schedule: 'every 10 minutes', timeoutSeconds: 300 }, async () => {
  const cur = (await db.collection('community_home').doc('current').get()).data() || {};
  if (!rebuildDue(cur, Date.now())) return;
  const r = await rebuildHome();
  console.log('[community] home rebuilt', r);
});

exports._community = { cleanItem, okImg, okDiscord, okRelease, rebuildHome, rateOk, RATE, rebuildDue, inPool };
