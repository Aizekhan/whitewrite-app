// Бекап у GitHub: once a day the world's TEXT snapshot (src/snapshot.js — canon, lore, games, stories; no files, keys or logs)
// goes into a PRIVATE repository on the owner's GitHub account, as world.json + README.md (git keeps the history).
// Paid like the Космограф: BACKUP_COST tokens per world per 30 days (paid-features.js `githubBackup`), renewed by the
// daily run from the owner's balance; no tokens → the backup pauses (lastError) until the owner turns it on again.
//   backupTokens/{worldId}  { token, login } — server only (firestore.rules)
//   worlds/{w}.backup       { repo, login, enabled, paidUntil, lastAt, lastStatus, lastError, lastCommit } — written only here
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest, admin, db, cors, getBalance, reserve, getPlanBudget } = require('./common');
const ledger = require('./ledger');
const { savedGithub, rememberGithub, forgetGithub } = require('./github-token');
const { buildSnapshot } = require('./snapshot');
const { featureCost, byOp } = require('../paid-features.js');
// outbound calls time out: a hanging remote must not hold the function until its own timeout
const fetch = (url, o = {}) => globalThis.fetch(url, { signal: AbortSignal.timeout(20000), ...o });

const BACKUP_COST = featureCost(byOp('githubBackup'));
const PERIOD_MS = 30 * 24 * 3600 * 1000, MANUAL_GAP_MS = 10 * 60 * 1000;
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const fail = (status, error, extra) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra || {}) });
const slug = (t) => String(t || 'world').toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'world';

async function gh(token, method, path, body) {
  const r = await fetch('https://api.github.com' + path, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'WhiteWrite-Backup', ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

// One file in the repo: create or replace (the contents API needs the current sha)
async function putFile(token, repo, path, text, message) {
  const cur = await gh(token, 'GET', `/repos/${repo}/contents/${path}`);
  const r = await gh(token, 'PUT', `/repos/${repo}/contents/${path}`, { message, content: Buffer.from(text, 'utf8').toString('base64'), ...(cur.ok && cur.j.sha ? { sha: cur.j.sha } : {}) });
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${r.j.message || 'не вдалося записати ' + path}`);
  return r.j.commit && r.j.commit.sha;
}

async function runBackup(worldId) {
  const wref = db.collection('worlds').doc(worldId);
  const [w, t] = await Promise.all([wref.get(), db.collection('backupTokens').doc(worldId).get()]);
  if (!w.exists || !t.exists || !(w.data().backup || {}).repo) throw new Error('Бекап не підключено');
  const s = await buildSnapshot(worldId, w.data().owner, 'whitewrite.backup/1');
  const snap = s.snap, date = new Date().toISOString();
  const readme = `# ${w.data().title || 'World'}\n\nБекап світу з WhiteWrite (whitewrite.com) — ${date.slice(0, 10)}.\n\n` +
    `- Сутностей канону: ${snap.entities.length}\n- Записів культури: ${snap.lore.length}\n- Ігор: ${snap.games.length} (карток: ${snap.games.reduce((n, g) => n + g.cards.length, 0)})\n` +
    `- Історій: ${snap.stories.length} (сцен: ${snap.stories.reduce((n, p) => n + p.scenes.length, 0)})\n\n` +
    'Лише текст: картинки, моделі й інші файли в бекап не входять. Відновлення — Біблія → Налаштування → «Відновити з JSON» (формат `whitewrite.backup/1`).\n';
  const { token } = t.data(), repo = w.data().backup.repo;
  await putFile(token, repo, 'world.json', JSON.stringify(snap, null, 2), `Backup ${date}`);
  const commit = await putFile(token, repo, 'README.md', readme, `Backup ${date} (readme)`);
  await wref.update({ 'backup.lastAt': ts(), 'backup.lastStatus': 'ok', 'backup.lastError': admin.firestore.FieldValue.delete(), 'backup.lastCommit': commit || null });
}

// Pay the next 30 days from the owner's balance (enable, or the daily run's renewal)
async function pay(worldId, uid) {
  const u = await db.collection('users').doc(uid).get(), ud = u.exists ? u.data() : {};
  if (!getPlanBudget(ud.plan || 'free').allowBackup) throw fail(403, 'Бекап у GitHub — від тарифу Storyteller', { code: 'PLAN_REQUIRED' });
  const balance = getBalance(ud);
  if (balance.available < BACKUP_COST) throw fail(403, 'Недостатньо токенів', { tokensRemaining: balance.available, tokensNeeded: BACKUP_COST, code: 'OUT_OF_TOKENS' });
  let r;
  try { r = await reserve(db, uid, BACKUP_COST); } catch (e) {
    if (e.code !== 'OUT_OF_TOKENS') throw e;
    throw fail(403, 'Недостатньо токенів', { tokensRemaining: e.available, tokensNeeded: BACKUP_COST, code: 'OUT_OF_TOKENS' });
  }
  const until = admin.firestore.Timestamp.fromMillis(Date.now() + PERIOD_MS);
  await db.collection('worlds').doc(worldId).update({ 'backup.enabled': true, 'backup.paidUntil': until });
  ledger.record(db, uid, { type: 'spend', op: 'github_backup_month', amount: -BACKUP_COST, balance: r.available, ref: { worldId } });
  await db.collection('usage_logs').add({ uid, operation: 'github_backup_month', worldId, userTokensCharged: BACKUP_COST, realApiCostUSD: 0, timestamp: ts() }).catch(() => {});
  return until.toMillis();
}

async function handle(op, b, uid) {
  if (op === 'forgetGithub') { await forgetGithub(uid); return { forgotten: true }; } // the author's saved token, not a world's
  const worldId = str(b.worldId, 120), wref = db.collection('worlds').doc(worldId), w = await wref.get();
  if (!w.exists || w.data().owner !== uid) throw fail(403, 'Світ не знайдено або немає доступу');
  const cur = w.data().backup || {};
  if (op === 'connect') { // a GitHub token (fine-grained: «Administration» + «Contents» read/write, or classic `repo`) → a private repo
    const pasted = str(b.token, 300), token = pasted || await savedGithub(uid); // one GitHub connection per author (github-token.js)
    if (!token) throw fail(400, 'Потрібен токен GitHub');
    const me = await gh(token, 'GET', '/user');
    if (!me.ok) throw fail(400, 'GitHub не прийняв токен');
    const name = `whitewrite-${slug(w.data().title)}-${worldId.slice(-6).toLowerCase()}`;
    let repo = await gh(token, 'POST', '/user/repos', { name, private: true, auto_init: true, description: `WhiteWrite: бекап світу «${str(w.data().title, 100)}»` });
    if (!repo.ok && repo.status === 422) repo = await gh(token, 'GET', `/repos/${me.j.login}/${name}`); // already there
    if (!repo.ok) throw fail(400, `GitHub не дав створити репозиторій (${repo.j.message || repo.status}). Токену потрібні права на створення репозиторіїв і запис вмісту.`);
    if (!repo.j.private) throw fail(400, `Репозиторій ${repo.j.full_name} публічний — бекап пишеться лише в приватний`);
    await db.collection('backupTokens').doc(worldId).set({ token, login: me.j.login, at: ts() });
    if (pasted) await rememberGithub(uid, pasted, me.j.login);
    await wref.update({ backup: { repo: repo.j.full_name, login: me.j.login, enabled: false, paidUntil: cur.paidUntil || null, connectedAt: ts() } });
    return { repo: repo.j.full_name };
  }
  if (!cur.repo) throw fail(400, 'Спершу підключи GitHub');
  if (op === 'enable') {
    const paid = cur.paidUntil && cur.paidUntil.toMillis() > Date.now();
    const until = paid ? cur.paidUntil.toMillis() : await pay(worldId, uid);
    if (paid) await wref.update({ 'backup.enabled': true });
    await runBackup(worldId).catch((e) => wref.update({ 'backup.lastStatus': 'error', 'backup.lastError': str(e.message, 300) }));
    return { enabled: true, paidUntil: until, tokensConsumed: paid ? 0 : BACKUP_COST };
  }
  if (op === 'disable') { await wref.update({ 'backup.enabled': false }); return { enabled: false }; } // the paid month stays paid
  if (op === 'now') {
    if (!cur.enabled) throw fail(400, 'Спершу увімкни щоденний бекап');
    if (cur.lastAt && Date.now() - cur.lastAt.toMillis() < MANUAL_GAP_MS) throw fail(429, 'Бекап щойно був — спробуй за 10 хвилин');
    await runBackup(worldId);
    return { done: true };
  }
  if (op === 'disconnect') {
    await db.collection('backupTokens').doc(worldId).delete();
    await wref.update({ backup: admin.firestore.FieldValue.delete() });
    return { disconnected: true };
  }
  throw fail(400, 'Unknown op');
}

exports.backup = onRequest({ region: 'us-central1', timeoutSeconds: 300, memory: '1GiB' }, async (req, res) => {
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
      if (e.status) return res.status(e.status).json(e.body || { error: e.message });
      console.error('backup error:', e);
      return res.status(500).json({ error: `Помилка бекапу: ${e.message}` });
    }
  });
});

// Daily: every enabled backup; an unpaid month renews from the owner's tokens, or the backup pauses
// Runs every 6 hours, but each world is backed up once a day: worlds backed up in the last 20 h are skipped, 5 run at a time,
// and no new world starts in the last minutes of the run — the rest go next run, before they are charged again
exports.backupDaily = onSchedule({ schedule: 'every 6 hours', timeoutSeconds: 540, memory: '1GiB' }, async () => {
  const started = Date.now(), DAY_GAP = 20 * 3600 * 1000, STOP_AFTER = 420 * 1000;
  const q = await db.collection('worlds').where('backup.enabled', '==', true).get();
  const due = q.docs.filter((d) => { const l = (d.data().backup || {}).lastAt; return !(l && l.toMillis && Date.now() - l.toMillis() < DAY_GAP); });
  for (let i = 0; i < due.length && Date.now() - started < STOP_AFTER; i += 5) await Promise.all(due.slice(i, i + 5).map(backupOne));
});
async function backupOne(d) {
  const b = d.data().backup || {};
  try {
    if (!b.paidUntil || b.paidUntil.toMillis() < Date.now()) await pay(d.id, d.data().owner);
    await runBackup(d.id);
  } catch (e) {
    console.warn('[backup]', d.id, e.message);
    await d.ref.update({ 'backup.lastStatus': 'error', 'backup.lastError': str(e.message, 300), ...(e.body && e.body.code ? { 'backup.enabled': false } : {}) }).catch(() => {});
  }
}

exports._backup = { slug, runBackup };
