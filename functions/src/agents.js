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
  // v2.149.5: where it went, on the message itself — «✈ надіслано в Telegram» in «💬 Агенти» (owner: «не знаю, чи дійшло»)
  const mark = (v) => gref.collection('agentMessages').doc(m.id).set({ tg: { ...v, at: Date.now() } }, { merge: true }).catch(() => {});
  if (!AC.URGENT.includes(m.type)) {
    await mark({ status: 'digest' });
    await db.collection('agentDigestQueue').doc(owner).set({ games: { [gameKey(worldId, gameId)]: { title: str(game.title, 80), n: admin.firestore.FieldValue.increment(1) } }, updatedAt: ts() }, { merge: true });
    return false;
  }
  if (!botToken()) { await mark({ status: 'off' }); return false; }
  const d = await dest(worldId, gameId, owner);
  if (!d.chatId) { await mark({ status: 'off' }); return false; }
  const where = d.chat && d.chat.chatId ? { kind: str(d.chat.kind, 20) || 'group', chat: str(d.chat.title, 80) } : { kind: 'private', chat: '' };
  const who = `${m.from.label || 'Агент'} (${ROLE_UK[m.from.role] || m.from.role || ''})`;
  let text = `🎮 ${clip(game.title, 60)}\n💬 ${who} ${TYPE_UK[m.type] || m.type}:\n«${clip(m.text, 300)}»`;
  const kb = [[{ text: '💬 Відповісти в WhiteWrite', url: bibleUrl(worldId, gameId) }]];
  let aid = '', base = '';
  if (m.type === 'approval_request' && !d.ownerTg) { await mark({ status: 'off' }); return false; } // nobody could press: the author approves in the Bible
  if (d.ownerTg) { // a code for Claude on every question and approval request (v2.151: the author may answer a question through Claude too)
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    aid = approvalId(worldId, gameId, m.id);
    await db.collection('agentApprovals').doc(aid).set({ worldId, gameId, msgId: m.id, kind: m.type === 'question' ? 'question' : 'approval', uid: owner, codeHash: sha(aid + ':' + code), exp: Date.now() + AC.CODE_TTL, used: false, tries: 0, createdAt: ts(),
      expireAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) });
    base = text;
    // 🤖 v2.151 (owner): Claude opens with the question prefilled (claude.ai/new?q=…); the code makes the answer the author's
    const ask = `Перевір «💬 Агенти» у WhiteWrite (гра «${clip(game.title, 60)}»): ${m.type === 'question' ? 'питання' : 'запит на дозвіл'} #${m.id} від ${m.from.label || 'агента'}. Код: ${code}. Моя відповідь: `;
    kb[0].push({ text: '🤖 Відповісти через Claude', url: 'https://claude.ai/new?q=' + encodeURIComponent(ask) });
    if (m.type === 'approval_request') {
      // the button is the way; the code is only for approving in words in a chat with Claude (owner: «що це означає, якщо мені ще й приходиться код писати»)
      text += `\n\nСхвали кнопкою — або скажи цей код Claude у чаті. Досить одного.\nКод: ${code} (діє 24 год)`;
      kb.unshift([{ text: '✔ Схвалити', callback_data: `ap:${aid}:y` }, { text: '✖ Відхилити', callback_data: `ap:${aid}:n` }]);
    } else {
      // v2.151 (owner: «відповідь реплаєм … кнопки варіантів»): a reply to this message, an option button or Claude with the code
      const opts = AC.cleanOptions(m.options);
      kb.unshift(...opts.map((o, i) => [{ text: o, callback_data: `qa:${aid}:${i}` }])); // the options in their order, the links last
      text += `\n\nВідповідь: реплаєм на це повідомлення${opts.length ? ', кнопкою варіанту' : ''} або через Claude.\nКод для Claude: ${code} (діє 24 год)`;
    }
  }
  let sent;
  try { sent = await tg('sendMessage', { chat_id: d.chatId, text, reply_markup: { inline_keyboard: kb }, disable_web_page_preview: true }); }
  catch (e) { await mark({ status: 'failed', ...where, error: str(e.message, 200) }); throw e; }
  await mark({ status: 'sent', ...where });
  if (aid) await db.collection('agentApprovals').doc(aid).set({ tg: { chat: d.chatId, mid: sent.message_id, text: base } }, { merge: true });
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

// v2.149.3: a plain notice to the author at once (a Change Request — decided in the Bible, not by buttons); true = sent
async function tellAuthor(gref, world, game, text, sec) {
  if (!botToken()) return false;
  const worldId = gref.parent.parent.id, gameId = gref.id, d = await dest(worldId, gameId, world.owner);
  if (!d.chatId) return false;
  const url = bibleUrl(worldId, gameId).replace('sec=agents', 'sec=' + encodeURIComponent(sec || 'agents'));
  await tg('sendMessage', { chat_id: d.chatId, text: `🎮 ${clip(game.title, 60)}\n${clip(text, 600)}`, reply_markup: { inline_keyboard: [[{ text: 'Відкрити в WhiteWrite', url }]] }, disable_web_page_preview: true });
  return true;
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
    const t = a.data().tg; // the buttons and the code go: the request is decided wherever it was, the message says how
    const verdict = (o.approve ? '✅ Схвалено' : '❌ Відхилено') + (o.via === 'claude' ? ' через Claude' : o.via === 'telegram' ? '' : ' у WhiteWrite');
    if (t && botToken()) await (t.text ? tg('editMessageText', { chat_id: t.chat, message_id: t.mid, text: t.text + '\n\n' + verdict, reply_markup: { inline_keyboard: [] }, disable_web_page_preview: true })
      : tg('editMessageReplyMarkup', { chat_id: t.chat, message_id: t.mid, reply_markup: { inline_keyboard: [] } })).catch(() => {});
    if (t && !t.text && botToken() && o.via !== 'telegram') await tg('sendMessage', { chat_id: t.chat, reply_to_message_id: t.mid, text: verdict }).catch(() => {});
  }
  return true;
}

// v2.151 a question answered (a reply / an option in Telegram, Claude with the code, the Bible): its Telegram message loses the code and the
// buttons and shows the answer — the same message, no new one (like an approval)
async function closeTgQuestion(gref, msgId, answer, via) {
  const aref = db.collection('agentApprovals').doc(approvalId(gref.parent.parent.id, gref.id, msgId)), a = await aref.get().catch(() => null);
  if (!a || !a.exists || a.data().kind !== 'question') return;
  const first = !a.data().used;
  await aref.set({ used: true }, { merge: true });
  const t = a.data().tg;
  if (first && t && t.text && botToken()) await tg('editMessageText', { chat_id: t.chat, message_id: t.mid, text: t.text + `\n\n✅ Відповідь${via === 'claude' ? ' через Claude' : via === 'whitewrite' ? ' у WhiteWrite' : ''}: «${clip(answer, 300)}»`, reply_markup: { inline_keyboard: [] }, disable_web_page_preview: true }).catch(() => {});
}
// the author's answer from outside the Bible (Telegram, Claude with the code): a reply in the thread, from the author, with how it came
async function authorAnswer(gref, msgId, o) {
  const msgs = gref.collection('agentMessages'), pd = await msgs.doc(msgId).get();
  if (!pd.exists) throw fail(404, 'Повідомлення не знайдено');
  const p = pd.data(), world = (await gref.parent.parent.get()).data() || {}, u = await db.collection('users').doc(world.owner).get(), ref = msgs.doc();
  await ref.set({ type: 'note', text: str(o.text, AC.TEXT_MAX), refs: [], thread: p.thread || pd.id, parent: pd.id,
    from: { kind: 'author', uid: world.owner, label: str((u.exists && u.data().name) || 'Автор', 80), role: 'owner', via: o.via, ...(o.by ? { by: str(o.by, 80) } : {}) },
    ...(o.words ? { words: str(o.words, 300) } : {}), status: 'new', readBy: [], at: Date.now(), createdAt: ts(), updatedAt: ts() });
  if (p.status !== 'closed') await msgs.doc(pd.id).set({ status: 'answered', updatedAt: ts() }, { merge: true });
  if (p.type === 'question') await closeTgQuestion(gref, pd.id, o.text, o.via);
  return ref.id;
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
        if (parent && parent.type === 'question' && acc.owner) await closeTgQuestion(gref, parent.id, text, 'whitewrite');
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
// v2.151 (owner: «відповідь реплаєм на повідомлення бота») — the author's reply to an agent's Telegram message → the author's answer in the thread
async function onReply(msg) {
  const r = msg.reply_to_message, back = (text) => tg('sendMessage', { chat_id: msg.chat.id, reply_to_message_id: msg.message_id, text }).catch(() => {});
  const q = await db.collection('agentApprovals').where('tg.chat', '==', msg.chat.id).where('tg.mid', '==', r.message_id).limit(1).get();
  if (q.empty) return msg.chat.type === 'private' ? back('Реплаєм можна відповісти на питання агента — на це повідомлення відповісти не вийде.') : null;
  const ad = q.docs[0].data(), l = await db.collection('tgLinks').doc(ad.uid).get();
  if (!l.exists || l.data().tgId !== msg.from.id) return back('Відповідати агентам може лише автор гри.');
  if (AC.hasSecret(msg.text)) return back('Схоже, у відповіді ключ або токен — її побачать агенти. Не надіслано.');
  const gref = db.collection('worlds').doc(ad.worldId).collection('games').doc(ad.gameId);
  try { await authorAnswer(gref, ad.msgId, { text: msg.text, via: 'telegram', by: str(msg.from.username || msg.from.first_name, 80) }); } catch (e) { return back(e.status ? e.message : 'Не вдалося передати відповідь.'); }
  return back('✔ Передано агенту' + (ad.kind === 'approval' ? ' як коментар (схвалити чи відхилити — кнопками ✔ / ✖)' : '') + '.');
}
async function onButton(cq) {
  const m = /^(ap|qa):([a-f0-9]{16}):([yn]|\d)$/.exec(String(cq.data || ''));
  const answer = (text) => tg('answerCallbackQuery', { callback_query_id: cq.id, text, show_alert: true }).catch(() => {});
  if (!m) return answer('Невідома кнопка');
  const a = await db.collection('agentApprovals').doc(m[2]).get(), ad = a.exists ? a.data() : null;
  if (!ad) return answer('Запит не знайдено — відкрий WhiteWrite');
  const l = await db.collection('tgLinks').doc(ad.uid).get();
  if (!l.exists || l.data().tgId !== cq.from.id) return answer(m[1] === 'qa' ? 'Відповідати може лише автор гри' : 'Схвалювати може лише автор гри');
  if (ad.used || ad.exp < Date.now()) return answer('Кнопка вже не діє (одноразова, 24 год) — запит чекає в WhiteWrite');
  const gref = db.collection('worlds').doc(ad.worldId).collection('games').doc(ad.gameId), yes = m[3] === 'y';
  if (m[1] === 'qa') { // an option the agent offered → the author's answer
    const q = await gref.collection('agentMessages').doc(ad.msgId).get(), opt = q.exists ? AC.cleanOptions(q.data().options)[Number(m[3])] : '';
    if (!opt) return answer('Варіант не знайдено — відповідай у WhiteWrite');
    try { await authorAnswer(gref, ad.msgId, { text: opt, via: 'telegram', by: str(cq.from.username || cq.from.first_name, 80) }); } catch (e) { return answer(e.status ? e.message : 'Не вдалося'); }
    return answer(`✔ Передано агенту: «${opt}»`);
  }
  try { await applyApproval(gref, ad.msgId, { approve: yes, via: 'telegram', by: str(cq.from.username || cq.from.first_name, 80) }); } catch (e) { return answer(e.status ? e.message : 'Не вдалося'); }
  // applyApproval already rewrote the message (no code, no buttons, «✔ Схвалено у Telegram»); the agent sees the decision in get_agent_inbox
  return answer((yes ? '✅ Схвалено' : '❌ Відхилено') + '. Агент побачить це сам — більше нічого робити не треба.');
}
exports.agentTelegram = onRequest({ region: 'us-central1', secrets: [telegramBotToken], invoker: 'public', timeoutSeconds: 30 }, async (req, res) => {
  if (req.method !== 'POST' || !botToken() || req.get('X-Telegram-Bot-Api-Secret-Token') !== hookSecret()) return res.status(403).send('');
  const u = req.body || {};
  try {
    const msg = u.message || u.channel_post;
    if (msg && typeof msg.text === 'string' && msg.chat && msg.from && msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.is_bot && msg.text[0] !== '/') await onReply(msg);
    else if (msg && typeof msg.text === 'string' && msg.chat) {
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

// ---------- 🛎 v2.150 the silent-stop watch (owner: «щоб зупинки агентів без питання до автора ловив сам WhiteWrite») ----------
// mcp.js watchKey arms mcpKeys.{watchPending, watchLast} on a terminal agent's call and clears it on a report to the author (question,
// approval_request, handoff, report_blocker, submit_task_result, submit_development_activity). Every 2 min: a key armed and quiet for the
// game's N minutes (games/{g}.agentSilence, on, 10 by default) → one «зупинився без звіту» in «💬 Агенти» + Telegram; the next call re-arms.
async function silenceSweep(now) {
  now = now || Date.now();
  const q = await db.collection('mcpKeys').where('watchPending', '==', true).limit(300).get();
  const games = {}, out = [];
  for (const d of q.docs) {
    const k = d.data();
    const gk = gameKey(k.worldId, k.gameId);
    if (!(gk in games)) {
      const [w, g] = await Promise.all([db.collection('worlds').doc(k.worldId).get(), db.collection('worlds').doc(k.worldId).collection('games').doc(k.gameId).get()]);
      games[gk] = w.exists && g.exists ? { world: w.data(), game: g.data(), gref: g.ref } : null;
    }
    const G = games[gk], cfg = AC.silenceCfg(G && G.game);
    const due = !G || k.revoked || !cfg.on ? 'stale' : AC.silenceDue(k.watchLast, cfg.min, now);
    if (!due) continue;
    // claim: once per session, and only if the agent did not move meanwhile
    const won = await db.runTransaction(async (tx) => {
      const x = (await tx.get(d.ref)).data() || {};
      if (!x.watchPending || x.watchLast !== k.watchLast) return false;
      tx.update(d.ref, { watchPending: false, ...(due === 'due' ? { watchNotifiedAt: now } : {}) });
      return true;
    });
    if (!won || due !== 'due') continue;
    const label = str(k.label, 80) || 'Агент', ref = G.gref.collection('agentMessages').doc();
    const text = `Агент «${label}» зупинився без звіту: ${cfg.min} хв тиші після роботи, а питання, запиту на дозвіл чи передачі роботи немає. Можливо, він чекає твого рішення в терміналі.`;
    let sent = false, err = '';
    try { sent = await tellAuthor(G.gref, G.world, G.game, `🛎 Агент «${label}» зупинився без звіту (${cfg.min} хв тиші, питання немає). Можливо, він чекає твого рішення в терміналі.`, 'agents'); }
    catch (e) { err = str(e.message, 200); }
    // one write with its delivery mark (Telegram first): the feed never shows it without «✈ …»
    await ref.set({ type: 'silent_stop', text, refs: [], thread: ref.id, parent: '', from: { kind: 'system', key: k.prefix || '', label: 'WhiteWrite', role: '' },
      status: 'new', readBy: [], at: now, createdAt: ts(), updatedAt: ts(), tg: { status: sent ? 'sent' : err ? 'failed' : 'off', ...(err ? { error: err } : {}), at: Date.now() } });
    out.push({ key: k.prefix, game: gk, sent });
  }
  return out;
}
exports.agentSilenceWatch = onSchedule({ schedule: 'every 2 minutes', secrets: [telegramBotToken], timeoutSeconds: 120 }, async () => { await silenceSweep(); });

exports._agents = { silenceSweep, authorAnswer, closeTgQuestion, notify, tellAuthor, checkCode, applyApproval, approvalId, telegramBotToken, hookSecret };
