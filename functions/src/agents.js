// 💬 Агенти (owner, v2.148): the author's side of the agents' channel — functions/agent-chat.js holds the rules, mcp.js the agents' tools.
//   agents          — the Bible: post (the author's note / question / feedback / decision, a reply), resolve (✔ / ✖ an approval_request —
//                     the OWNER alone), close, Telegram: tgStatus / tgLink { mode: me | chat } / tgUnlink
//   agentTelegram   — the platform bot's webhook (@WhiteWriteServiceBot, secret TELEGRAM_BOT_TOKEN): /start <token> links the author's
//                     own Telegram (tgLinks/{uid}) or the game's group / channel (agentTg/{w}__{g}); ✔ / ✖ buttons count only from the
//                     owner's linked Telegram ID, once, for 24 h
//   agentDigest     — once a day: note / handoff / feedback of the day in one short message (agentDigestQueue/{uid})
// Server-only collections: tgLinks, tgLinkTokens, agentTg, agentApprovals, agentDigestQueue (firestore.rules: no client access).
// Telegram gets only the gist and a link — no code, no keys, no GDD text beyond the message's first lines.
const crypto = require('crypto');
const { onRequest, admin, db, cors, getPlanBudget } = require('./common');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const AC = require('../agent-chat.js');
const { teamAccess } = require('./team')._team;

const telegramBotToken = defineSecret('TELEGRAM_BOT_TOKEN'); // the same platform bot as Mini-Marketing (marketing.js)
const HOOK = 'https://us-central1-whitewrite-app.cloudfunctions.net/agentTelegram';
const SITE = 'https://whitewrite.com/WhiteWrite%20GameBible.html';
const LINK_TTL = 15 * 60 * 1000, TRIES = 5;
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const fail = (status, error, code) => Object.assign(new Error(error), { status, code });
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const ROLE_UK = { designer: 'Геймдизайнер', programmer: 'Програміст', readonly: 'Лише читання' };
const TYPE_UK = { note: 'до відома', question: 'питання', feedback: 'відгук', approval_request: 'просить дозволу', handoff: 'передає роботу', decision: 'рішення автора' };

function botToken() { try { const t = (telegramBotToken.value() || '').trim(); return /^\d+:[\w-]{30,}$/.test(t) ? t : ''; } catch (e) { return ''; } }
async function tg(method, body) {
  const t = botToken(); if (!t) throw fail(503, 'Telegram-бот платформи ще не налаштований');
  const r = await fetch(`https://api.telegram.org/bot${t}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw fail(400, 'Telegram: ' + (j.description || 'HTTP ' + r.status));
  return j.result;
}
const hookSecret = () => crypto.createHmac('sha256', botToken()).update('agentTelegram').digest('hex').slice(0, 48);
let botMe = null, hookOk = false;
async function bot() { if (!botToken()) return null; if (!botMe) botMe = await tg('getMe', {}).catch(() => null); return botMe; }
async function ensureWebhook() { // the bot had no webhook (Mini-Marketing only sends); set once per instance
  if (hookOk) return;
  const info = await tg('getWebhookInfo', {});
  if (info.url !== HOOK) await tg('setWebhook', { url: HOOK, secret_token: hookSecret(), allowed_updates: ['message', 'channel_post', 'callback_query'] });
  hookOk = true;
}
const gameKey = (w, g) => w + '__' + g;
const bibleUrl = (w, g) => `${SITE}?worldId=${encodeURIComponent(w)}&gameId=${encodeURIComponent(g)}&sec=agents`;
const approvalId = (w, g, msgId) => sha(`${w}/${g}/${msgId}`).slice(0, 16); // callback_data stays short: «ap:<16 hex>:y»

// where the game's Telegram messages go: its own chat (group / channel) if linked, else the owner's private chat; owner = the only approver
async function dest(worldId, gameId, ownerUid) {
  const [c, l] = await Promise.all([db.collection('agentTg').doc(gameKey(worldId, gameId)).get(), db.collection('tgLinks').doc(ownerUid).get()]);
  const link = l.exists ? l.data() : null, chat = c.exists ? c.data() : null;
  return { chatId: (chat && chat.chatId) || (link && link.tgId) || null, ownerTg: link ? link.tgId : null, chat, link };
}
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// an agent's message → Telegram at once (question / approval_request) or the daily digest (note / handoff / feedback). true = sent now.
async function notify(gref, world, game, m) {
  const worldId = gref.parent.parent.id, gameId = gref.id, owner = world.owner;
  if (!AC.URGENT.includes(m.type)) {
    await db.collection('agentDigestQueue').doc(owner).set({ games: { [gameKey(worldId, gameId)]: { title: str(game.title, 80), n: admin.firestore.FieldValue.increment(1) } }, updatedAt: ts() }, { merge: true });
    return false;
  }
  if (!botToken()) return false;
  const d = await dest(worldId, gameId, owner);
  if (!d.chatId) return false;
  const who = `${m.from.label || 'Агент'} (${ROLE_UK[m.from.role] || m.from.role || ''})`;
  let text = `🎮 ${clip(game.title, 60)}\n💬 ${who} ${TYPE_UK[m.type] || m.type}:\n«${clip(m.text, 300)}»`;
  const kb = [[{ text: '💬 Відповісти в WhiteWrite', url: bibleUrl(worldId, gameId) }]];
  let aid = '';
  if (m.type === 'approval_request') {
    if (!d.ownerTg) return false; // nobody could press: the author approves in the Bible
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    aid = approvalId(worldId, gameId, m.id);
    await db.collection('agentApprovals').doc(aid).set({ worldId, gameId, msgId: m.id, uid: owner, codeHash: sha(aid + ':' + code), exp: Date.now() + AC.CODE_TTL, used: false, tries: 0, createdAt: ts(),
      expireAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) });
    text += `\n\nКод для Claude: ${code} (діє 24 год) — скажи «так, код ${code}», якщо схвалюєш через Claude.`;
    kb.unshift([{ text: '✔ Схвалити', callback_data: `ap:${aid}:y` }, { text: '✖ Відхилити', callback_data: `ap:${aid}:n` }]);
  }
  const sent = await tg('sendMessage', { chat_id: d.chatId, text, reply_markup: { inline_keyboard: kb }, disable_web_page_preview: true });
  if (aid) await db.collection('agentApprovals').doc(aid).set({ tg: { chat: d.chatId, mid: sent.message_id } }, { merge: true });
  return true;
}

// the 6 digits the author got in Telegram (MCP resolve_approval through Claude): one use, 24 h, at most TRIES wrong tries
async function checkCode(gref, msgId, code) {
  const aid = approvalId(gref.parent.parent.id, gref.id, msgId), ref = db.collection('agentApprovals').doc(aid);
  return db.runTransaction(async (tx) => {
    const d = await tx.get(ref), a = d.exists ? d.data() : null;
    if (!a || a.used || a.exp < Date.now() || a.tries >= TRIES) return false;
    if (sha(aid + ':' + code) !== a.codeHash) { tx.update(ref, { tries: a.tries + 1 }); return false; }
    tx.update(ref, { used: true });
    return true;
  });
}

// the decision on an approval_request: once (pending → approved / rejected); the asking agent sees it again in get_agent_inbox (readBy reset)
async function applyApproval(gref, msgId, o) {
  const ref = gref.collection('agentMessages').doc(msgId);
  const done = await db.runTransaction(async (tx) => {
    const d = await tx.get(ref), m = d.exists ? d.data() : null;
    if (!m || m.type !== 'approval_request') throw fail(404, 'Запит не знайдено');
    if (m.approval && m.approval.status !== 'pending') return false;
    tx.update(ref, { approval: { status: o.approve ? 'approved' : 'rejected', via: o.via, by: str(o.by, 80), ...(o.words ? { words: str(o.words, 300) } : {}), comment: str(o.comment, 1000), at: Date.now() },
      status: 'answered', readBy: [], updatedAt: ts() });
    return true;
  });
  if (!done) throw fail(409, 'Цей запит уже вирішено');
  const aref = db.collection('agentApprovals').doc(approvalId(gref.parent.parent.id, gref.id, msgId)), a = await aref.get().catch(() => null);
  if (a && a.exists) {
    await aref.set({ used: true }, { merge: true });
    const t = a.data().tg; // the buttons go: the request is decided wherever it was
    if (t && botToken()) await tg('editMessageReplyMarkup', { chat_id: t.chat, message_id: t.mid, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    if (t && botToken() && o.via !== 'telegram') await tg('sendMessage', { chat_id: t.chat, reply_to_message_id: t.mid, text: (o.approve ? '✔ Схвалено' : '✖ Відхилено') + (o.via === 'claude' ? ' через Claude' : ' у WhiteWrite') }).catch(() => {});
  }
  return true;
}

// ---------- the Bible: the author's posts and decisions ----------
exports.agents = onRequest({ region: 'us-central1', secrets: [telegramBotToken], timeoutSeconds: 60 }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      let uid;
      try { uid = (await admin.auth().verifyIdToken(auth.replace(/^Bearer /, ''))).uid; } catch (e) { return res.status(401).json({ error: 'Потрібна автентифікація' }); }
      const b = req.body || {}, worldId = str(b.worldId, 120), gameId = str(b.gameId, 120), op = str(b.op, 20);
      if (!worldId || !gameId || !op) return res.status(400).json({ error: 'Missing worldId/gameId/op' });
      const wref = db.collection('worlds').doc(worldId), gref = wref.collection('games').doc(gameId);
      const [w, g] = await Promise.all([wref.get(), gref.get()]);
      const acc = w.exists && g.exists ? teamAccess(w.data(), uid, 'agents') : null;
      if (!acc) return res.status(403).json({ error: 'Гру не знайдено або немає доступу' });
      const world = w.data(), game = g.data();
      if (game.demo) return res.status(423).json({ error: 'Демо-гра — лише для читання' });
      const owner = await db.collection('users').doc(world.owner).get();
      if (!getPlanBudget((owner.exists && owner.data().plan) || 'free').allowAPI) return res.status(403).json({ error: '«💬 Агенти» — частина Worldbuilder (MCP)', code: 'PLAN_REQUIRED' });
      const onlyOwner = () => { if (!acc.owner) throw fail(403, 'Це може лише власник гри', 'OWNER_ONLY'); };
      const msgs = gref.collection('agentMessages');

      if (op === 'post') {
        const type = str(b.type, 30), text = str(b.text, AC.TEXT_MAX);
        if (!AC.AUTHOR_TYPES.includes(type)) throw fail(400, 'Невідомий тип повідомлення');
        if (type === 'decision' && !acc.ai) throw fail(403, 'Рішення приймає власник або адмін команди', 'TEAM_ROLE');
        if (!text) throw fail(400, 'Порожнє повідомлення');
        if (AC.hasSecret(text)) throw fail(400, 'Схоже, у повідомленні ключ або токен — його побачать агенти, команда й Telegram. Прибери й надішли ще раз.', 'SECRET');
        let thread = '', parent = null;
        if (b.replyTo) {
          const pd = await msgs.doc(str(b.replyTo, 60)).get();
          if (!pd.exists) throw fail(404, 'Повідомлення не знайдено');
          parent = { id: pd.id, ...pd.data() }; thread = parent.thread || parent.id;
        }
        const u = await db.collection('users').doc(uid).get(), ref = msgs.doc();
        await ref.set({ type, text, refs: AC.cleanRefs(b.refs), thread: thread || ref.id, parent: parent ? parent.id : '',
          from: { kind: 'author', uid, label: str((u.exists && u.data().name) || (acc.owner ? 'Автор' : 'Учасник команди'), 80), role: acc.owner ? 'owner' : 'member' },
          status: 'new', readBy: [], at: Date.now(), createdAt: ts(), updatedAt: ts() });
        if (parent && parent.status !== 'closed') await msgs.doc(parent.id).set({ status: 'answered', updatedAt: ts() }, { merge: true });
        return res.status(200).json({ success: true, id: ref.id });
      }
      if (op === 'resolve') {
        onlyOwner();
        await applyApproval(gref, str(b.id, 60), { approve: b.approve !== false, via: 'whitewrite', by: 'Автор', comment: str(b.comment, 1000) });
        return res.status(200).json({ success: true });
      }
      if (op === 'close' || op === 'reopen') {
        const ref = msgs.doc(str(b.id, 60)), d = await ref.get();
        if (!d.exists) throw fail(404, 'Повідомлення не знайдено');
        await ref.set({ status: op === 'close' ? 'closed' : 'answered', updatedAt: ts() }, { merge: true });
        return res.status(200).json({ success: true });
      }
      // Telegram — the owner's own
      if (op === 'tgStatus') {
        onlyOwner();
        const me = await bot().catch(() => null), d = await dest(worldId, gameId, world.owner);
        return res.status(200).json({ success: true, configured: !!me, bot: me ? me.username : '', me: d.link ? { username: d.link.username || '', name: d.link.name || '' } : null,
          chat: d.chat ? { title: d.chat.title || '', kind: d.chat.kind || '' } : null });
      }
      if (op === 'tgLink') {
        onlyOwner();
        const me = await bot();
        if (!me) throw fail(503, 'Telegram-бот платформи ще не налаштований');
        await ensureWebhook();
        const mode = b.mode === 'chat' ? 'chat' : 'me', token = crypto.randomBytes(12).toString('hex');
        await db.collection('tgLinkTokens').doc(token).set({ uid, worldId, gameId, mode, exp: Date.now() + LINK_TTL, expireAt: new Date(Date.now() + 24 * 3600 * 1000) });
        return res.status(200).json({ success: true, bot: me.username, code: 'wwa-' + token, expiresInMin: 15,
          url: mode === 'me' ? `https://t.me/${me.username}?start=${token}` : `https://t.me/${me.username}?startgroup=${token}` });
      }
      if (op === 'tgUnlink') {
        onlyOwner();
        if (b.what === 'me') await db.collection('tgLinks').doc(uid).delete();
        else await db.collection('agentTg').doc(gameKey(worldId, gameId)).delete();
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ error: 'Unknown op' });
    } catch (e) {
      if (!e.status) console.error('[agents]', e);
      return res.status(e.status || 500).json({ error: e.status ? e.message : 'Помилка сервера', ...(e.code ? { code: e.code } : {}) });
    }
  });
});

// ---------- the bot's webhook ----------
const say = (chat, text) => tg('sendMessage', { chat_id: chat, text, disable_web_page_preview: true }).catch(() => {});
async function onLink(msg, token) {
  const tref = db.collection('tgLinkTokens').doc(token), td = await tref.get(), t = td.exists ? td.data() : null;
  if (!t || t.exp < Date.now()) return say(msg.chat.id, 'Код застарів або вже використаний. Візьми новий у WhiteWrite: Налаштування гри → Інтеграції → Telegram для агентів.');
  const priv = msg.chat.type === 'private';
  if (t.mode === 'me') {
    if (!priv) return say(msg.chat.id, 'Цей код — для особистого чату з ботом.');
    await tref.delete();
    await db.collection('tgLinks').doc(t.uid).set({ tgId: msg.from.id, username: str(msg.from.username, 64), name: str([msg.from.first_name, msg.from.last_name].filter(Boolean).join(' '), 80), at: ts() });
    return say(msg.chat.id, '✔ Готово: WhiteWrite надсилатиме сюди питання й запити на схвалення твоїх агентів. Схвалювати кнопками можеш лише ти.');
  }
  if (priv) return say(msg.chat.id, 'Цей код — для групи чи каналу гри: додай бота туди за посиланням із WhiteWrite (або опублікуй код у каналі, де бот — адмін).');
  const l = await db.collection('tgLinks').doc(t.uid).get(), link = l.exists ? l.data() : null;
  if (!link) return say(msg.chat.id, 'Спершу підключи свій Telegram у WhiteWrite (крок 1), потім — цей чат.');
  if (msg.from && msg.from.id !== link.tgId) return say(msg.chat.id, 'Підключити чат гри може лише її автор.');
  await tref.delete();
  await db.collection('agentTg').doc(gameKey(t.worldId, t.gameId)).set({ chatId: msg.chat.id, title: str(msg.chat.title, 120), kind: msg.chat.type, uid: t.uid, at: ts() });
  return say(msg.chat.id, '✔ Цей чат підключено до «💬 Агенти» гри: сюди йтимуть питання й запити агентів. Кнопки ✔ / ✖ діють лише для автора гри.');
}
async function onButton(cq) {
  const m = /^ap:([a-f0-9]{16}):([yn])$/.exec(String(cq.data || ''));
  const answer = (text) => tg('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert: true }).catch(() => {});
  if (!m) return answer('Невідома кнопка');
  const a = await db.collection('agentApprovals').doc(m[1]).get(), ad = a.exists ? a.data() : null;
  if (!ad) return answer('Запит не знайдено — відкрий WhiteWrite');
  const l = await db.collection('tgLinks').doc(ad.uid).get();
  if (!l.exists || l.data().tgId !== cq.from.id) return answer('Схвалювати може лише автор гри');
  if (ad.used || ad.exp < Date.now()) return answer('Кнопка вже не діє (одноразова, 24 год) — запит чекає в WhiteWrite');
  const gref = db.collection('worlds').doc(ad.worldId).collection('games').doc(ad.gameId), yes = m[2] === 'y';
  try { await applyApproval(gref, ad.msgId, { approve: yes, via: 'telegram', by: str(cq.from.username || cq.from.first_name, 80) }); } catch (e) { return answer(e.status ? e.message : 'Не вдалося'); }
  if (cq.message) await tg('sendMessage', { chat_id: cq.message.chat.id, reply_to_message_id: cq.message.message_id, text: yes ? '✔ Схвалено' : '✖ Відхилено' }).catch(() => {});
  return answer(yes ? '✔ Схвалено' : '✖ Відхилено');
}
exports.agentTelegram = onRequest({ region: 'us-central1', secrets: [telegramBotToken], invoker: 'public', timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== 'POST' || !botToken() || req.get('X-Telegram-Bot-Api-Secret-Token') !== hookSecret()) return res.status(403).send('');
  const u = req.body || {};
  try {
    const msg = u.message || u.channel_post;
    if (msg && typeof msg.text === 'string' && msg.chat) {
      const t = /^\/start(?:@\w+)?\s+([a-f0-9]{24})\s*$/.exec(msg.text.trim()) || /\bwwa-([a-f0-9]{24})\b/.exec(msg.text);
      if (t) await onLink(msg, t[1]);
      else if (msg.chat.type === 'private') await say(msg.chat.id, 'Це бот WhiteWrite. Підключити його до своєї гри: Біблія гри → Налаштування → Інтеграції → Telegram для агентів.');
    }
    if (u.callback_query) await onButton(u.callback_query);
  } catch (e) { console.error('[agentTelegram]', e); }
  return res.status(200).send('ok'); // Telegram retries anything else
});

// ---------- once a day: what the agents left «до відома» ----------
exports.agentDigest = onSchedule({ schedule: '0 19 * * *', timeZone: 'Europe/Kyiv', secrets: [telegramBotToken], timeoutSeconds: 300 }, async () => {
  const q = await db.collection('agentDigestQueue').limit(500).get();
  for (const d of q.docs) {
    const games = d.get('games') || {};
    for (const [k, v] of Object.entries(games)) {
      const [worldId, gameId] = k.split('__'), n = (v && v.n) || 0;
      if (!n || !botToken()) continue;
      const to = await dest(worldId, gameId, d.id).catch(() => ({}));
      if (to.chatId) await say(to.chatId, `🎮 ${clip(v.title, 60)}: агенти лишили ${n} повідомл. до відома (передача роботи, відгуки, нотатки) у «💬 Агенти».\n${bibleUrl(worldId, gameId)}`);
    }
    await d.ref.delete();
  }
});

exports._agents = { notify, checkCode, applyApproval, approvalId, telegramBotToken, hookSecret };
