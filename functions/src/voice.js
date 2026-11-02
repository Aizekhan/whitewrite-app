// Voice-over of the game's dialogues (Game Bible → a dialogue → «🎙 Озвучка»): Google Cloud Text-to-Speech.
// POST { op, worldId, gameId, … } with the author's ID token. Access: allowGameDev (Worldbuilder) and an active subscription.
//   voices     { lang }                          → the Google voices of a language (free)
//   preview    { text ≤ 300, voice, lang, rate, pitch } → { audio: base64 mp3 } — a paid try of one voice
//   synthesize { dialogueId, nodeIds[] }          → every line in its speaker's voice (games/{g}.voices[speaker], service 'google'):
//              the mp3 goes to Storage worlds/{w}/games/{g}/files/{cardId}/…, a new Audio library card («Звук і музика» → «Озвучка»,
//              title = the line's localisation key) holds it, the line gets voice: [cardId], vstatus: 'tts' → { done: { nodeId: cardId } }
// Price: paid-features.js ttsCost (chars × the voice class price × margin), reserved before the calls; unused characters come back.
// The provider is one function (googleSpeak) — ElevenLabs etc. plug in beside it (service in the cast).
const crypto = require('crypto');
const { onRequest, admin, db, cors, getBalance, reserve, refund, getPlanBudget } = require('./common');
const { payerFor } = require('./team')._team;
const { byOp, ttsCost, ttsUsd, TTS, USD_PER_TOKEN } = require('../paid-features.js');
const ledger = require('./ledger');

const API = 'https://texttospeech.googleapis.com/v1';
const LANG_RE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z0-9]+)?$/;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

class VoiceError extends Error { constructor(status, body) { super(body.error); this.status = status; this.body = body; } }

let cred = null;
async function googleToken() { // the function's own service account (Cloud Text-to-Speech API is enabled on the project)
  cred = cred || admin.credential.applicationDefault();
  return (await cred.getAccessToken()).access_token;
}
async function googleCall(path, body) {
  const r = await fetch(API + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + await googleToken(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || 'Google TTS HTTP ' + r.status);
  return d;
}
// one provider: text → mp3 bytes
async function googleSpeak(text, cast) {
  const name = str(cast.voice, 80), lang = LANG_RE.test(cast.lang || '') ? cast.lang : name.split('-').slice(0, 2).join('-') || 'uk-UA';
  const audioConfig = { audioEncoding: 'MP3' };
  const rate = +cast.rate, pitch = +cast.pitch;
  if (rate && rate !== 1) audioConfig.speakingRate = Math.min(2, Math.max(0.5, rate));
  if (pitch && !/chirp|journey|studio/i.test(name)) audioConfig.pitch = Math.min(10, Math.max(-10, pitch)); // these classes refuse pitch
  const d = await googleCall('/text:synthesize', { input: { text }, voice: name ? { languageCode: lang, name } : { languageCode: lang }, audioConfig });
  return Buffer.from(d.audioContent || '', 'base64');
}

async function access(req, body) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) throw new VoiceError(401, { error: 'Потрібна автентифікація' });
  let uid;
  try { uid = (await admin.auth().verifyIdToken(auth.slice(7))).uid; } catch (e) { throw new VoiceError(401, { error: 'Невірний токен автентифікації' }); }
  uid = await payerFor(uid, body.worldId); // a team admin voices on the owner's tokens (team.js)
  const worldId = str(body.worldId, 120), gameId = str(body.gameId, 120);
  if (!worldId || !gameId) throw new VoiceError(400, { error: 'Missing worldId/gameId' });
  const wref = db.collection('worlds').doc(worldId), gref = wref.collection('games').doc(gameId);
  const [w, g, u] = await Promise.all([wref.get(), gref.get(), db.collection('users').doc(uid).get()]);
  if (!w.exists || w.data().owner !== uid || !g.exists) throw new VoiceError(403, { error: 'Гру не знайдено або немає доступу' });
  if (w.data().freeze) throw new VoiceError(423, { error: 'Світ заморожено (Маркет): зміни недоступні', code: 'FROZEN' });
  const userData = u.exists ? u.data() : {};
  const feature = byOp('voiceTts');
  if (!getPlanBudget(userData.plan || 'free')[feature.flag]) throw new VoiceError(403, { error: 'Озвучка ШІ — у тарифі Worldbuilder', code: 'PLAN_REQUIRED' });
  if (userData.subscriptionStatus !== 'active') throw new VoiceError(403, { error: 'Активна підписка необхідна для ШІ', requiresSubscription: true });
  return { uid, worldId, gameId, gref, game: g.data(), userData };
}

async function pay(uid, amount) {
  try { return await reserve(db, uid, amount); } catch (e) {
    if (e.code !== 'OUT_OF_TOKENS') throw e;
    throw new VoiceError(403, { error: 'Недостатньо токенів', tokensRemaining: e.available, tokensNeeded: amount, code: 'OUT_OF_TOKENS' });
  }
}
// give back the part of a reservation that was not used
function unusedPart(res, keep) {
  let back = Math.max(0, (res.fromMonthly + res.fromBonus) - keep);
  const fromBonus = Math.min(back, res.fromBonus); back -= fromBonus;
  return { fromMonthly: Math.min(back, res.fromMonthly), fromBonus };
}
async function logCost(uid, op, usd, tokens, extra) {
  await db.collection('usage_logs').add({ uid, operation: op, provider: 'google-tts', timestamp: admin.firestore.FieldValue.serverTimestamp(),
    realApiCostUSD: Math.round(usd * 1e6) / 1e6, userTokensCharged: tokens, userPaidUSD: Math.round(tokens * USD_PER_TOKEN * 1e6) / 1e6, ...extra }).catch((e) => console.error('[voice] log:', e.message));
}

async function saveMp3(ctx, cardId, name, bytes) {
  const id = 'file_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
  const path = `worlds/${ctx.worldId}/games/${ctx.gameId}/files/${cardId}/${id}-${name.replace(/[\/\\#?\[\]*]/g, '_')}`;
  const token = crypto.randomUUID(), bucket = admin.storage().bucket();
  await bucket.file(path).save(bytes, { contentType: 'audio/mpeg', resumable: false, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return { id, name, path, url, size: bytes.length, type: 'audio/mpeg', uploadedAt: Date.now(), field: 'sound' };
}

exports.voice = onRequest({ region: 'us-central1', timeoutSeconds: 300, memory: '512MiB' }, async (req, res) => {
  return cors(req, res, async () => {
    let ctx, reservation = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const body = req.body || {}, op = body.op;
      ctx = await access(req, body);

      if (op === 'voices') {
        const lang = LANG_RE.test(body.lang || '') ? body.lang : 'uk-UA';
        const d = await googleCall('/voices?languageCode=' + encodeURIComponent(lang));
        const voices = (d.voices || []).filter((v) => (v.languageCodes || []).includes(lang)).map((v) => ({ name: v.name, gender: v.ssmlGender || '', price: ttsCost(1000, v.name) }))
          .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
        return res.status(200).json({ success: true, voices });
      }

      if (op === 'preview') {
        const text = str(body.text, 300), cast = { voice: str(body.voice, 80), lang: str(body.lang, 20), rate: body.rate, pitch: body.pitch };
        if (!text) return res.status(400).json({ error: 'Порожній текст' });
        const cost = ttsCost(text.length, cast.voice);
        if (getBalance(ctx.userData).available < cost) return res.status(403).json({ error: 'Недостатньо токенів', tokensNeeded: cost, code: 'OUT_OF_TOKENS' });
        reservation = await pay(ctx.uid, cost);
        const mp3 = await googleSpeak(text, cast);
        await logCost(ctx.uid, 'voiceTts', ttsUsd(text.length, cast.voice), cost, { chars: text.length, voice: cast.voice });
        ledger.record(db, ctx.uid, { type: 'spend', op: 'voice_preview', amount: -cost, balance: reservation.available, ref: { worldId: ctx.worldId, gameId: ctx.gameId } });
        reservation = null;
        return res.status(200).json({ success: true, audio: mp3.toString('base64'), tokensConsumed: cost });
      }

      if (op === 'synthesize') {
        const dref = ctx.gref.collection('dialogues').doc(str(body.dialogueId, 120));
        const ds = await dref.get();
        if (!ds.exists) return res.status(404).json({ error: 'Діалог не знайдено' });
        const dlg = ds.data(), cast = (ctx.game.voices || {}), want = new Set((Array.isArray(body.nodeIds) ? body.nodeIds : []).map((x) => str(x, 40)));
        const jobs = (dlg.nodes || []).filter((n) => want.has(n.id) && str(n.text, TTS.maxChars) && n.speaker && cast[n.speaker] && cast[n.speaker].service === 'google')
          .map((n) => ({ n, text: str(n.text, TTS.maxChars), cast: cast[n.speaker] }));
        if (!jobs.length) return res.status(400).json({ error: 'Немає реплік для озвучки: потрібні текст і голос Google у того, хто говорить', code: 'NOTHING_TO_VOICE' });
        const total = jobs.reduce((s, j) => s + ttsCost(j.text.length, j.cast.voice), 0);
        if (getBalance(ctx.userData).available < total) return res.status(403).json({ error: 'Недостатньо токенів', tokensNeeded: total, code: 'OUT_OF_TOKENS' });
        reservation = await pay(ctx.uid, total);
        const lang = body.language === 'en' ? 'en' : 'uk', group = lang === 'en' ? 'Voice' : 'Озвучка';
        const done = {}, cardsCol = ctx.gref.collection('cards'), slug = str(dlg.title, 60).toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '') || 'dlg';
        let spent = 0, usd = 0, chars = 0, failed = '';
        for (const j of jobs) {
          try {
            const mp3 = await googleSpeak(j.text, j.cast);
            const key = str(j.n.locKey, 120) || `dlg.${slug}.${j.n.id}`;
            const cardId = 'card_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
            const meta = await saveMp3(ctx, cardId, key + '.mp3', mp3);
            meta.tts = { service: 'google', voice: str(j.cast.voice, 80) };
            await cardsCol.doc(cardId).set({ section: 'audio', title: key, status: 'idea', note: j.text.slice(0, 500), fields: { group, mood: '', where: (dlg.title || '') + ' · ' + j.n.id },
              files: [meta], order: Date.now(), createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(), tts: true });
            done[j.n.id] = cardId; spent += ttsCost(j.text.length, j.cast.voice); usd += ttsUsd(j.text.length, j.cast.voice); chars += j.text.length;
          } catch (e) { failed = e.message; console.error('[voice] line', j.n.id, e.message); break; }
        }
        // the lines point at their new sounds (the editor applies the same mapping to its draft)
        if (Object.keys(done).length) await db.runTransaction(async (tx) => {
          const cur = await tx.get(dref); if (!cur.exists) return;
          const nodes = (cur.data().nodes || []).map((n) => (done[n.id] ? { ...n, voice: [done[n.id]], vstatus: 'tts' } : n));
          tx.update(dref, { nodes, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        const back = unusedPart(reservation, spent);
        if (back.fromMonthly + back.fromBonus > 0) await refund(db, ctx.uid, back);
        if (spent) {
          await logCost(ctx.uid, 'voiceTts', usd, spent, { chars, lines: Object.keys(done).length });
          ledger.record(db, ctx.uid, { type: 'spend', op: 'voice_tts', amount: -spent, balance: reservation.available + (back.fromMonthly + back.fromBonus), ref: { worldId: ctx.worldId, gameId: ctx.gameId, dialogueId: ds.id } });
        }
        reservation = null;
        if (!spent && failed) return res.status(502).json({ error: 'Google TTS: ' + failed });
        return res.status(200).json({ success: true, done, tokensConsumed: spent, failed: failed || undefined });
      }
      return res.status(400).json({ error: 'Unknown op' });
    } catch (e) {
      if (e instanceof VoiceError) return res.status(e.status).json(e.body);
      console.error('voice error:', e);
      return res.status(500).json({ error: 'Помилка озвучки: ' + e.message });
    } finally {
      if (reservation && ctx) await refund(db, ctx.uid, reservation).catch((er) => console.error('[voice] refund failed:', er.message));
    }
  });
});

exports._voice = { unusedPart, googleSpeak };
