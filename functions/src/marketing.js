// Mini-Marketing (Game Bible «Маркетинг»): posts about the game's development, drafted by AI ONLY from development-log
// entries the author marked «Для маркетингу» (games/{g}/activity/{s}/entries, privacy = marketing_approved).
// Like the Cosmograph: Worldbuilder (allowGameDev), switched on per game for paid-features.js `marketing` tokens per 30 days;
// each AI draft is charged separately (`marketingDraft`, the real cost). Nothing is published without the author's approval.
//
// Server-only state (firestore.rules: not in the client-writable list; the owner reads):
//   games/{g}/marketing/state  { enabled, paidUntil, paidAt, claudeMdConfirmedAt, settings{ tone, language, audience, hashtags, signature } }
//   games/{g}/channels/{id}    { platform: telegram|discord|mastodon|bluesky, title, ok, …public bits }
//   games/{g}/posts/{id}       { platform, status: draft|approved|rejected|scheduled|publishing|published|failed, text, title?, poll?, sources[], at?, channelId?, url?, messageId?, error? }
//   marketingSecrets/{w}__{g}__{channelId} { webhook | token | appPassword } — never sent to the client
//   marketingQueue/{w}__{g}__{postId} { path, at } — marketingPublisher publishes due posts every 5 minutes
// Telegram: ONE platform bot (secret TELEGRAM_BOT_TOKEN); the author adds it as an admin with «Post messages» to their channel.
// X and Reddit have no API publishing here: the client offers copy + the platforms' own share links.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { onRequest, admin, db, cors, charge, getBalance, reserve, refund, getPlanBudget, claudeApiKey } = require('./common');
const ledger = require('./ledger'); // users/{uid}/ledger — «Історія токенів»
const { featureCost, byOp } = require('../paid-features.js');
const { modelFor, claudeText } = require('./claude');

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN');
const MARKETING_COST = featureCost(byOp('marketing'));
const PERIOD_MS = 30 * 24 * 3600 * 1000;
const PLATFORMS = { // text limits the AI writes for; api = published by the server
  telegram: { limit: 4000, api: true }, discord: { limit: 1900, api: true }, mastodon: { limit: 480, api: true }, bluesky: { limit: 290, api: true },
  x: { limit: 270, api: false }, reddit: { limit: 6000, api: false, title: true },
};
const TONES = ['friendly', 'epic', 'humorous', 'dev-diary', 'short-news'];
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const now = () => Date.now();
const millis = (t) => (t && t.toMillis ? t.toMillis() : typeof t === 'number' ? t : 0);
const fail = (status, error, extra) => Object.assign(new Error(error), { status, extra });

function botToken() { // the secret holds "unset" until the owner creates the bot (@BotFather)
  try { const t = (telegramBotToken.value() || '').trim(); return /^\d+:[\w-]{30,}$/.test(t) ? t : ''; } catch (e) { return ''; }
}
async function tg(method, body) {
  const t = botToken(); if (!t) throw fail(503, 'Telegram-бот платформи ще не налаштований');
  const r = await fetch(`https://api.telegram.org/bot${t}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw fail(400, 'Telegram: ' + (j.description || 'HTTP ' + r.status));
  return j.result;
}
// «this channel is mine»: an HMAC of game + chat keyed by the bot token — the same code on every try, unguessable for others
const tgCode = (key, chatId) => 'ww-' + require('crypto').createHmac('sha256', botToken()).update(key + ':' + chatId).digest('hex').slice(0, 10);
let botMe = null;
async function bot() { if (!botToken()) return null; if (!botMe) botMe = await tg('getMe', {}).catch(() => null); return botMe; }

// ---------- publishing adapters: post + channel (+ its secret) → { messageId, url } ----------
async function publishTo(ch, secret, post) {
  const text = post.platform === 'reddit' && post.title ? post.title + '\n\n' + post.text : post.text;
  if (ch.platform === 'telegram') {
    if (post.poll && post.poll.question && (post.poll.options || []).length >= 2) {
      if (post.text) await tg('sendMessage', { chat_id: ch.chatId, text: post.text.slice(0, 4096) });
      const m = await tg('sendPoll', { chat_id: ch.chatId, question: post.poll.question.slice(0, 300), options: post.poll.options.slice(0, 10).map((o) => ({ text: String(o).slice(0, 100) })), is_anonymous: true });
      return { messageId: String(m.message_id), url: ch.username ? `https://t.me/${ch.username}/${m.message_id}` : '' };
    }
    const m = await tg('sendMessage', { chat_id: ch.chatId, text: text.slice(0, 4096) });
    return { messageId: String(m.message_id), url: ch.username ? `https://t.me/${ch.username}/${m.message_id}` : '' };
  }
  if (ch.platform === 'discord') {
    const r = await fetch(secret.webhook + (secret.webhook.includes('?') ? '&' : '?') + 'wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text.slice(0, 2000) }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(400, 'Discord: ' + (j.message || 'HTTP ' + r.status));
    return { messageId: String(j.id || ''), url: '' };
  }
  if (ch.platform === 'mastodon') {
    const r = await fetch(`https://${ch.instance}/api/v1/statuses`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret.token, 'Idempotency-Key': post.id },
      body: JSON.stringify({ status: text.slice(0, 500) }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(400, 'Mastodon: ' + (j.error || 'HTTP ' + r.status));
    return { messageId: String(j.id || ''), url: j.url || '' };
  }
  if (ch.platform === 'bluesky') {
    const s = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: ch.handle, password: secret.appPassword }) });
    const sj = await s.json().catch(() => ({})); if (!s.ok) throw fail(400, 'Bluesky: ' + (sj.message || 'HTTP ' + s.status));
    const r = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sj.accessJwt },
      body: JSON.stringify({ repo: sj.did, collection: 'app.bsky.feed.post', record: { $type: 'app.bsky.feed.post', text: [...text].slice(0, 300).join(''), createdAt: new Date().toISOString() } }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(400, 'Bluesky: ' + (j.message || 'HTTP ' + r.status));
    const rkey = String(j.uri || '').split('/').pop();
    return { messageId: rkey, url: rkey ? `https://bsky.app/profile/${ch.handle}/post/${rkey}` : '' };
  }
  throw fail(400, 'Ця платформа публікується вручну (копіювання)');
}

// ---------- channels ----------
async function connect(gref, key, b) {
  const platform = str(b.platform, 20), col = gref.collection('channels');
  if (platform === 'telegram') {
    const me = await bot(); if (!me) throw fail(503, 'Telegram-бот платформи ще не налаштований');
    let chat = str(b.chat, 200).replace(/^https?:\/\/t\.me\//, '');
    if (!chat) throw fail(400, 'Вкажи @канал або його id');
    if (!/^-?\d+$/.test(chat) && !chat.startsWith('@')) chat = '@' + chat;
    const c = await tg('getChat', { chat_id: chat });
    const m = await tg('getChatMember', { chat_id: c.id, user_id: me.id });
    const can = c.type === 'channel' ? m.status === 'administrator' && !!m.can_post_messages : ['administrator', 'member'].includes(m.status);
    if (!can) throw fail(400, `Додай @${me.username} адміністратором каналу з правом «Публікувати повідомлення» і спробуй ще раз`);
    // the bot being there proves nothing about WHO connects: another author could name a channel they don't run.
    // Proof: a code (stable for this game + chat, nothing stored) in the channel's description — only its admins can write it.
    const code = tgCode(key, c.id);
    if (!String(c.description || '').includes(code)) {
      throw fail(409, `Підтверди, що канал твій: додай в опис каналу код ${code} і натисни «Підключити» ще раз. Після підключення код можна прибрати.`, { code: 'TG_VERIFY', verifyCode: code });
    }
    const id = 'tg_' + String(c.id).replace('-', 'm');
    await col.doc(id).set({ platform, chatId: c.id, title: c.title || c.username || String(c.id), username: c.username || '', type: c.type, ok: true, checkedAt: ts(), createdAt: ts() }, { merge: true });
    return { channelId: id };
  }
  const id = platform.slice(0, 2) + '_' + Math.random().toString(36).slice(2, 10);
  if (platform === 'discord') {
    const webhook = str(b.webhook, 400);
    if (!/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(webhook)) throw fail(400, 'Потрібне посилання вебхука Discord (Налаштування каналу → Інтеграції → Вебхуки)');
    const r = await fetch(webhook); const j = await r.json().catch(() => ({}));
    if (!r.ok) throw fail(400, 'Discord не прийняв вебхук');
    await db.collection('marketingSecrets').doc(key + '__' + id).set({ webhook });
    await col.doc(id).set({ platform, title: j.name || 'Discord', ok: true, checkedAt: ts(), createdAt: ts() });
    return { channelId: id };
  }
  if (platform === 'mastodon') {
    const instance = str(b.instance, 120).replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase(), token = str(b.token, 200);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(instance) || !token) throw fail(400, 'Потрібні сервер Mastodon і токен доступу (Налаштування → Розробка → Новий застосунок, право write:statuses)');
    const r = await fetch(`https://${instance}/api/v1/accounts/verify_credentials`, { headers: { Authorization: 'Bearer ' + token } }); const j = await r.json().catch(() => ({}));
    if (!r.ok) throw fail(400, 'Mastodon не прийняв токен');
    await db.collection('marketingSecrets').doc(key + '__' + id).set({ token });
    await col.doc(id).set({ platform, instance, title: '@' + j.acct + '@' + instance, ok: true, checkedAt: ts(), createdAt: ts() });
    return { channelId: id };
  }
  if (platform === 'bluesky') {
    const handle = str(b.handle, 120).replace(/^@/, ''), appPassword = str(b.appPassword, 80);
    if (!handle || !appPassword) throw fail(400, 'Потрібні handle і пароль застосунку (Bluesky → Налаштування → Паролі застосунків)');
    const s = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: handle, password: appPassword }) });
    if (!s.ok) throw fail(400, 'Bluesky не прийняв handle або пароль застосунку');
    await db.collection('marketingSecrets').doc(key + '__' + id).set({ appPassword });
    await col.doc(id).set({ platform, handle, title: '@' + handle, ok: true, checkedAt: ts(), createdAt: ts() });
    return { channelId: id };
  }
  throw fail(400, 'Невідома платформа');
}

// ---------- AI draft: only from approved development-log entries ----------
async function approvedEntries(gref, picks) {
  const want = (Array.isArray(picks) ? picks : []).slice(0, 40).map((p) => String(p).split(':')).filter((p) => p.length === 2 && p[0] && p[1]);
  const docs = want.length ? await db.getAll(...want.map(([s, e]) => gref.collection('activity').doc(s.slice(0, 80)).collection('entries').doc(e.slice(0, 80)))) : [];
  return docs.filter((d) => d.exists && d.data().privacy === 'marketing_approved')
    .map((d) => ({ ref: d.ref.parent.parent.id + ':' + d.id, ...d.data() }));
}
function draftPrompt(game, entries, b, settings, lang) {
  const pf = PLATFORMS[b.platform];
  const facts = entries.map((e, i) => `${i + 1}. [${e.change}/${e.category}/${e.status}] ${e.text}${e.playerImpact ? ' — for players: ' + e.playerImpact : ''}${e.hints ? ' (hint: ' + e.hints + ')' : ''}${e.limits ? ' (limits: ' + e.limits + ')' : ''}`).join('\n');
  return {
    system: `You write short social posts for an indie game's development updates. You only state facts from the APPROVED NOTES; never invent features, dates, prices or platforms.
Unfinished work ("partial", "experimental") is described as work in progress. No spoilers, no internal tech jargon unless the tone is dev-diary. Write in ${lang}.`,
    prompt: `GAME: ${str(game.title, 120)}${settings.audience ? '\nAUDIENCE: ' + str(settings.audience, 300) : ''}
TONE: ${TONES.includes(settings.tone) ? settings.tone : 'friendly'}${settings.hashtags ? '\nHASHTAGS to use (if they fit): ' + str(settings.hashtags, 200) : ''}${settings.signature ? '\nEND WITH: ' + str(settings.signature, 200) : ''}
PLATFORM: ${b.platform} — at most ${pf.limit} characters${b.platform === 'telegram' ? '; plain text, short paragraphs, emojis are fine' : ''}${b.platform === 'reddit' ? '; a title (≤ 250 characters) and a body; no hashtags; honest dev-log style' : ''}
${b.wish ? 'THE AUTHOR WANTS: ' + str(b.wish, 1000) + '\n' : ''}APPROVED NOTES:
${facts}

Return ONLY JSON: { ${pf.title ? '"title": "", ' : ''}"text": ""${b.poll ? ', "poll": { "question": "<≤ 250 chars>", "options": ["2–6 short options"] }' : ''} }`,
  };
}
function parseJson(text) {
  try { return JSON.parse(text); } catch (e) { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('AI повернув не JSON'); return JSON.parse(m[0]); }
}
function cleanDraft(p, platform, wantPoll) {
  const pf = PLATFORMS[platform];
  const out = { text: str(p.text, pf.limit + 200) };
  if (pf.title) out.title = str(p.title, 300);
  const opts = p.poll && Array.isArray(p.poll.options) ? p.poll.options.map((o) => str(o, 100)).filter(Boolean).slice(0, 10) : [];
  if (wantPoll && platform === 'telegram' && p.poll && str(p.poll.question, 300) && opts.length >= 2) out.poll = { question: str(p.poll.question, 300), options: opts };
  return out;
}

// ---------- the endpoint ----------
exports.marketing = onRequest({ region: 'us-central1', secrets: [claudeApiKey, telegramBotToken], timeoutSeconds: 120 }, async (req, res) => {
  return cors(req, res, async () => {
    let uid, reservation = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      try { uid = (await admin.auth().verifyIdToken(auth.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const b = req.body || {};
      const worldId = str(b.worldId, 120), gameId = str(b.gameId, 120), op = str(b.op, 30);
      if (!worldId || !gameId || !op) return res.status(400).json({ error: 'Missing worldId/gameId/op' });
      const wref = db.collection('worlds').doc(worldId), gref = wref.collection('games').doc(gameId), sref = gref.collection('marketing').doc('state');
      const [w, g, u, st] = await Promise.all([wref.get(), gref.get(), db.collection('users').doc(uid).get(), sref.get()]);
      if (!w.exists || w.data().owner !== uid || !g.exists) return res.status(403).json({ error: 'Гру не знайдено або немає доступу' });
      const userData = u.exists ? u.data() : {}, state = st.exists ? st.data() : {}, key = worldId + '__' + gameId;
      const me = await bot().catch(() => null);
      const telegram = { configured: !!me, bot: me ? me.username : '' };

      if (op === 'status') return res.status(200).json({ success: true, telegram });
      if (op === 'deactivate') { await sref.set({ enabled: false }, { merge: true }); return res.status(200).json({ success: true }); }
      if (op === 'purge') { // the author deletes the game: everything marketing, including secrets and the queue
        for (const sub of ['posts', 'channels', 'marketing']) { const s = await gref.collection(sub).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); }
        const [sec, q] = await Promise.all([db.collection('marketingSecrets').where(admin.firestore.FieldPath.documentId(), '>=', key + '__').where(admin.firestore.FieldPath.documentId(), '<', key + '__~').get(),
          db.collection('marketingQueue').where(admin.firestore.FieldPath.documentId(), '>=', key + '__').where(admin.firestore.FieldPath.documentId(), '<', key + '__~').get()]);
        await Promise.all(sec.docs.concat(q.docs).map((d) => d.ref.delete()));
        return res.status(200).json({ success: true });
      }
      if (!getPlanBudget(userData.plan || 'free').allowGameDev) return res.status(403).json({ error: 'Маркетинг доступний на тарифі Worldbuilder', code: 'PLAN_REQUIRED' });
      if (userData.subscriptionStatus !== 'active') return res.status(403).json({ error: 'Активна підписка необхідна', requiresSubscription: true });

      if (op === 'activate') {
        if (millis(state.paidUntil) > now()) { await sref.set({ enabled: true }, { merge: true }); return res.status(200).json({ success: true, tokensConsumed: 0, paidUntil: millis(state.paidUntil) }); }
        const balance = getBalance(userData);
        if (balance.available < MARKETING_COST) return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: MARKETING_COST, code: 'OUT_OF_TOKENS' });
        try { reservation = await reserve(db, uid, MARKETING_COST); } catch (e) { if (e.code !== 'OUT_OF_TOKENS') throw e; return res.status(403).json({ error: 'Недостатньо токенів', code: 'OUT_OF_TOKENS' }); }
        const until = admin.firestore.Timestamp.fromMillis(now() + PERIOD_MS);
        await sref.set({ enabled: true, paidUntil: until, paidAt: ts() }, { merge: true });
        ledger.record(db, uid, { type: 'spend', op: 'marketing_month', amount: -MARKETING_COST, balance: reservation.available, ref: { worldId, gameId } });
        reservation = null;
        await db.collection('usage_logs').add({ uid, operation: 'marketing_month', worldId, gameId, userTokensCharged: MARKETING_COST, realApiCostUSD: 0, timestamp: ts() }).catch(() => {});
        return res.status(200).json({ success: true, tokensConsumed: MARKETING_COST, paidUntil: until.toMillis() });
      }
      if (!state.enabled || millis(state.paidUntil) <= now()) return res.status(403).json({ error: 'Маркетинг вимкнено — увімкни його для цієї гри', code: 'MARKETING_OFF' });

      if (op === 'confirmClaudeMd') { await sref.set({ claudeMdConfirmedAt: ts() }, { merge: true }); return res.status(200).json({ success: true }); }
      if (op === 'settings') {
        const s = b.settings || {};
        await sref.set({ settings: { tone: TONES.includes(s.tone) ? s.tone : 'friendly', language: s.language === 'en' ? 'en' : 'uk', audience: str(s.audience, 300), hashtags: str(s.hashtags, 200), signature: str(s.signature, 200) } }, { merge: true });
        return res.status(200).json({ success: true });
      }
      if (op === 'connect') return res.status(200).json({ success: true, ...(await connect(gref, key, b)) });
      if (op === 'disconnect') {
        const id = str(b.channelId, 60);
        await Promise.all([gref.collection('channels').doc(id).delete(), db.collection('marketingSecrets').doc(key + '__' + id).delete()]);
        return res.status(200).json({ success: true });
      }

      if (op === 'draft') {
        const platform = PLATFORMS[b.platform] ? b.platform : 'telegram';
        const entries = await approvedEntries(gref, b.entries);
        if (!entries.length) return res.status(400).json({ error: 'Обери записи журналу з позначкою «Для маркетингу»' });
        const { tier, model } = await modelFor(db, userData, userData.plan || 'free');
        const econ = await db.collection('economy_operations').doc('generateScene').get();
        const cost = featureCost(byOp('marketingDraft'), econ.exists ? ((econ.data().providers || {}).claude || {}).cost : null, tier);
        const balance = getBalance(userData);
        if (balance.available < cost) return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: cost, code: 'OUT_OF_TOKENS' });
        try { reservation = await reserve(db, uid, cost); } catch (e) { if (e.code !== 'OUT_OF_TOKENS') throw e; return res.status(403).json({ error: 'Недостатньо токенів', code: 'OUT_OF_TOKENS' }); }
        const settings = state.settings || {};
        const { system, prompt } = draftPrompt(g.data(), entries, { ...b, platform }, settings, (settings.language || b.language) === 'en' ? 'English' : 'Ukrainian');
        const msg = await claudeText(claudeApiKey.value(), { model, system, prompt, maxTokens: 3000, effort: 'low' });
        const draft = cleanDraft(parseJson(msg.text) || {}, platform, !!b.poll);
        if (!draft.text && !draft.poll) throw new Error('AI повернув порожній пост');
        const usage = { input_tokens: msg.usage.input_tokens || 0, output_tokens: msg.usage.output_tokens || 0 };
        const { userCost } = await charge(db, uid, 'generateScene', msg.model, usage, null, { provider: 'claude', targetWords: Math.round(usage.output_tokens * 0.75),
          estimatedInputTokens: Math.ceil((system.length + prompt.length) / 4), reserved: reservation, logAs: 'marketing_draft' });
        reservation = null;
        const ref = gref.collection('posts').doc();
        await ref.set({ platform, status: 'draft', ...draft, sources: entries.map((e) => e.ref), createdAt: ts(), updatedAt: ts(), history: [{ s: 'draft', at: now() }] });
        return res.status(200).json({ success: true, postId: ref.id, tokensConsumed: userCost, tokensRemaining: Math.max(0, balance.available - userCost) });
      }

      // ---------- the author's decisions on a post ----------
      const pref = gref.collection('posts').doc(str(b.postId, 60)), ps = await pref.get();
      if (!ps.exists) return res.status(404).json({ error: 'Пост не знайдено' });
      const post = { id: ps.id, ...ps.data() }, hist = admin.firestore.FieldValue.arrayUnion;
      const qref = db.collection('marketingQueue').doc(key + '__' + post.id);
      const setStatus = (s, extra) => pref.set({ status: s, updatedAt: ts(), history: hist({ s, at: now() }), ...(extra || {}) }, { merge: true });
      if (['published', 'publishing'].includes(post.status) && op !== 'delete') return res.status(409).json({ error: 'Пост уже опубліковано' });
      if (op === 'edit') {
        const pf = PLATFORMS[post.platform] || PLATFORMS.telegram;
        const upd = { text: str(b.text, pf.limit + 200) };
        if (pf.title) upd.title = str(b.title, 300);
        if (post.status === 'scheduled') await qref.delete();
        await setStatus('draft', upd); // an edited post needs approval again
        return res.status(200).json({ success: true });
      }
      if (op === 'approve') { await setStatus('approved', { approvedAt: ts() }); return res.status(200).json({ success: true }); }
      if (op === 'reject') { if (post.status === 'scheduled') await qref.delete(); await setStatus('rejected'); return res.status(200).json({ success: true }); }
      if (op === 'delete') { if (post.status === 'publishing') return res.status(409).json({ error: 'Пост публікується' }); await Promise.all([qref.delete(), pref.delete()]); return res.status(200).json({ success: true }); }
      if (op === 'cancel') { await qref.delete(); await setStatus('approved', { at: admin.firestore.FieldValue.delete() }); return res.status(200).json({ success: true }); }
      if (op === 'schedule' || op === 'publish') {
        if (!['approved', 'scheduled', 'failed'].includes(post.status)) return res.status(409).json({ error: 'Спершу схвали пост' });
        const ch = await gref.collection('channels').doc(str(b.channelId, 60)).get();
        if (!ch.exists) return res.status(400).json({ error: 'Обери підключений канал' });
        if (op === 'schedule') {
          const at = Number(b.at);
          if (!(at > now() + 60000 && at < now() + 90 * 24 * 3600 * 1000)) return res.status(400).json({ error: 'Час — щонайменше за хвилину і не далі ніж за 90 днів' });
          await qref.set({ path: pref.path, at: admin.firestore.Timestamp.fromMillis(at) });
          await setStatus('scheduled', { channelId: ch.id, at });
          return res.status(200).json({ success: true });
        }
        await setStatus('publishing', { channelId: ch.id, leaseAt: now() });
        try {
          const sec = await db.collection('marketingSecrets').doc(key + '__' + ch.id).get();
          const out = await publishTo(ch.data(), sec.exists ? sec.data() : {}, post);
          await qref.delete();
          await setStatus('published', { ...out, publishedAt: ts(), error: admin.firestore.FieldValue.delete() });
          return res.status(200).json({ success: true, ...out });
        } catch (e) { await setStatus('failed', { error: str(e.message, 500) }); throw e; }
      }
      return res.status(400).json({ error: 'Невідома дія' });
    } catch (error) {
      if (reservation) await refund(db, uid, reservation).catch((e) => console.error('[marketing] refund failed:', e));
      if (error.status) return res.status(error.status).json({ error: error.message, ...(error.extra || {}) });
      console.error('marketing error:', error);
      return res.status(500).json({ error: `Помилка маркетингу: ${error.message}` });
    }
  });
});

// Scheduled posts: every 5 minutes, publish what is due. A post is claimed (scheduled → publishing) in a transaction,
// so two runs never send it twice; a failure stays visible on the post («Повторити» in the Bible).
exports.marketingPublisher = onSchedule({ schedule: 'every 5 minutes', secrets: [telegramBotToken], timeoutSeconds: 240 }, async () => {
  const due = await db.collection('marketingQueue').where('at', '<=', admin.firestore.Timestamp.now()).limit(25).get();
  for (const q of due.docs) {
    const pref = db.doc(q.data().path);
    const claimed = await db.runTransaction(async (t) => {
      const p = await t.get(pref);
      if (!p.exists || p.data().status !== 'scheduled') return null;
      t.set(pref, { status: 'publishing', leaseAt: now(), updatedAt: ts() }, { merge: true });
      return { id: p.id, ...p.data() };
    });
    await q.ref.delete();
    if (!claimed) continue;
    const gref = pref.parent.parent, key = gref.parent.parent.id + '__' + gref.id;
    const hist = (s) => admin.firestore.FieldValue.arrayUnion({ s, at: now() });
    try {
      const [ch, sec] = await Promise.all([gref.collection('channels').doc(claimed.channelId || '-').get(), db.collection('marketingSecrets').doc(key + '__' + claimed.channelId).get()]);
      if (!ch.exists) throw new Error('Канал відключено');
      const out = await publishTo(ch.data(), sec.exists ? sec.data() : {}, claimed);
      await pref.set({ status: 'published', ...out, publishedAt: ts(), updatedAt: ts(), history: hist('published') }, { merge: true });
    } catch (e) {
      console.error('[marketingPublisher]', pref.path, e.message);
      await pref.set({ status: 'failed', error: str(e.message, 500), updatedAt: ts(), history: hist('failed') }, { merge: true });
    }
  }
});

exports._marketing = { cleanDraft, draftPrompt, approvedEntries, PLATFORMS, botToken, connect, tgCode }; // tests only
