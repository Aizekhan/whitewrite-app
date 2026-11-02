// The game's visual style — the AI check of one picture against the style (Game Bible «Візуальний стиль», style-guide.js).
// POST { worldId, gameId, cardId, fileId, image: <base64 JPEG/PNG/WebP>, mediaType?, refs?: [{ data, mediaType }], language? }
// with the author's ID token. The browser sends a downscaled copy of the picture and up to 3 style references; the server
// reads the style cards itself, asks Claude, and keeps the result on the card: cards/{cardId}.styleAi[fileId].
// Called by the ✦ button, «✦ Перевірити всі» and automatically after a picture is uploaded (when the game has a style).
// MCP check_style (mcp.js) runs the same check on a screenshot from Unity and returns it without storing.
// Access: allowGameDev (Worldbuilder), an active subscription; reserve → Claude → charge the real cost (paid-features.js styleCheck).
const { onRequest, admin, db, cors, charge, getBalance, reserve, refund, getPlanBudget, claudeApiKey } = require('./common');
const { payerFor } = require('./team')._team; // Команда: an admin's ✦ is paid by the world's owner
const { featureCost, byOp } = require('../paid-features.js');
const { modelFor, claudeText } = require('./claude');
const S = require('../style-guide.js');

const LANGUAGES = { uk: 'Ukrainian', en: 'English' };
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE = 5 * 1024 * 1024; // the API's limit per picture
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) {
    const m = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI повернув не JSON');
    return JSON.parse(m[1] || m[0]);
  }
}
// base64 (optionally a data: URL) → an image block, or null when it is not a usable picture
function imageBlock(data, mediaType) {
  let b64 = String(data || ''), type = mediaType;
  const m = b64.match(/^data:([^;]+);base64,(.*)$/);
  if (m) { type = m[1]; b64 = m[2]; }
  if (!TYPES.includes(type) || !/^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0, 200))) return null;
  if (Math.floor(b64.length * 3 / 4) > MAX_IMAGE) return null;
  return { type: 'image', source: { type: 'base64', media_type: type, data: b64.replace(/\s/g, '') } };
}
class CheckError extends Error { constructor(status, body) { super(body.error); this.status = status; this.body = body; } }

// One check: the plan, the reserve, Claude, the charge. style = resolveStyle(…); image / refs = image blocks.
async function runCheck({ uid, userData, game, style, image, refs, lang, what, logAs }) {
  if (!getPlanBudget(userData.plan || 'free').allowGameDev) throw new CheckError(403, { error: 'Візуальний стиль — у тарифі Worldbuilder', code: 'PLAN_REQUIRED' });
  if (userData.subscriptionStatus !== 'active') throw new CheckError(403, { error: 'Активна підписка необхідна для ШІ-перевірки', requiresSubscription: true });
  const brief = S.styleBrief(style);
  if (!brief) throw new CheckError(400, { error: 'У гри ще немає візуального стилю', code: 'NO_STYLE' });

  const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
  const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {}).claude : null;
  const { tier, model } = await modelFor(db, userData, userData.plan || 'free');
  const reserveCost = featureCost(byOp('styleCheck'), providerEconomy && providerEconomy.cost, tier); // gamebible.js shows the same price
  const balance = getBalance(userData);
  if (balance.available < reserveCost) throw new CheckError(403, { error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
  let reservation;
  try { reservation = await reserve(db, uid, reserveCost); } catch (e) {
    if (e.code !== 'OUT_OF_TOKENS') throw e;
    throw new CheckError(403, { error: 'Недостатньо токенів', tokensRemaining: e.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
  }
  try {
    const system = `You are the art director of the game "${str(game.title, 160)}". You judge whether a picture fits the game's visual style:
palette and colour balance, light and mood, materials and textures, shapes and silhouette, the do / don't rules. Be concrete and fair:
a concept sketch is judged by its intent, not its finish. Never invent rules the style does not state.

THE STYLE:
${brief}`;
    const content = [];
    if (refs.length) { content.push({ type: 'text', text: 'STYLE REFERENCES (what the style looks like):' }); refs.forEach((r) => content.push(r)); }
    content.push({ type: 'text', text: `THE PICTURE TO CHECK${what ? ' — ' + what : ''}:` }, image);
    content.push({ type: 'text', text: `Return ONLY JSON:
{ "score": <0-100: 70+ fits the style, 40-69 partly, below 40 off-style>, "summary": "<one sentence>",
  "issues": ["<what breaks the style, most important first; empty if none>"], "fixes": ["<concrete changes that bring it into the style>"] }
At most 4 issues and 4 fixes, short. Write in ${lang}.` });
    const msg = await claudeText(claudeApiKey.value(), { model, system, prompt: content, maxTokens: 3000, effort: 'low' });
    if (msg.stopReason === 'max_tokens') throw new Error('Відповідь AI обірвалась');
    const result = S.cleanVerdict(parseJson(msg.text));
    if (result.score == null) throw new Error('AI не дав оцінку');
    const usage = { input_tokens: msg.usage.input_tokens || 0, output_tokens: msg.usage.output_tokens || 0 };
    const { userCost } = await charge(db, uid, 'generateScene', msg.model, usage, null, { provider: 'claude', targetWords: Math.round(usage.output_tokens * 0.75),
      estimatedInputTokens: Math.ceil((system.length + brief.length) / 4) + 1600 * (1 + refs.length), reserved: reservation, logAs: logAs || 'style_check' });
    reservation = null;
    return { result, tokensConsumed: userCost, tokensRemaining: Math.max(0, balance.available - userCost) };
  } finally {
    if (reservation) await refund(db, uid, reservation).catch((e) => console.error('[style] Refund failed:', e));
  }
}

exports.styleCheck = onRequest({ region: 'us-central1', secrets: [claudeApiKey], timeoutSeconds: 120 }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      let uid;
      try { uid = (await admin.auth().verifyIdToken(auth.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const body = req.body || {};
      uid = await payerFor(uid, body.worldId); // a team admin acts on the owner's tokens (team.js)
      const worldId = str(body.worldId, 120), gameId = str(body.gameId, 120), cardId = str(body.cardId, 160), fileId = str(body.fileId, 120);
      if (!worldId || !gameId || !cardId || !fileId) return res.status(400).json({ error: 'Missing worldId/gameId/cardId/fileId' });
      const image = imageBlock(body.image, body.mediaType || 'image/jpeg');
      if (!image) return res.status(400).json({ error: 'Картинку не вдалося прочитати' });
      const refs = (Array.isArray(body.refs) ? body.refs : []).slice(0, 3).map((r) => imageBlock(r && r.data, (r && r.mediaType) || 'image/jpeg')).filter(Boolean);
      const wref = db.collection('worlds').doc(worldId), gref = wref.collection('games').doc(gameId);
      const [w, g, userDoc, cardDoc, styleSnap] = await Promise.all([wref.get(), gref.get(), db.collection('users').doc(uid).get(),
        gref.collection('cards').doc(cardId).get(), gref.collection('cards').where('section', '==', 'artstyle').get()]);
      if (!w.exists || w.data().owner !== uid || !g.exists) return res.status(403).json({ error: 'Гру не знайдено або немає доступу' });
      if (w.data().freeze) return res.status(423).json({ error: 'Світ заморожено (Маркет): зміни недоступні', code: 'FROZEN' });
      const card = cardDoc.exists ? cardDoc.data() : null;
      const file = card && (card.files || []).find((f) => f.id === fileId);
      if (!file || card.section === 'artstyle') return res.status(404).json({ error: 'Картинку не знайдено на картці' });
      let title = card.title || '';
      if (card.canonRef && !title) { const e = await wref.collection('entities').doc(card.canonRef).get(); title = e.exists ? (e.data().name || e.data().title || '') : ''; }
      const names = [title].concat(Array.isArray(body.names) ? body.names.slice(0, 3).map((x) => str(x, 160)) : []); // + subsection, location (the Bible knows the section's group field)
      const style = S.resolveStyle(styleSnap.docs.map((d) => ({ id: d.id, ...d.data() })), names);
      const out = await runCheck({ uid, userData: userDoc.exists ? userDoc.data() : {}, game: g.data(), style, image, refs,
        lang: LANGUAGES[body.language] || LANGUAGES.uk, what: `"${str(title, 160)}" (${card.section}), file ${str(file.name, 160)}` });
      const saved = Object.assign({}, out.result, { sig: S.styleSig(style), style: S.styleName(style), at: Date.now() });
      await cardDoc.ref.update({ ['styleAi.' + fileId]: saved });
      return res.status(200).json({ success: true, styleAi: saved, tokensConsumed: out.tokensConsumed, tokensRemaining: out.tokensRemaining });
    } catch (error) {
      if (error instanceof CheckError) return res.status(error.status).json(error.body);
      console.error('styleCheck error:', error);
      return res.status(500).json({ error: `Помилка перевірки стилю: ${error.message}` });
    }
  });
});

// «✦ Стиль із референсів»: up to 6 reference pictures (downscaled in the browser) → a proposal for the overall style card
// { manifesto, palette, avoid, light, materials, shapes, rules } — the author ticks the fields to take (nothing is written here).
// POST { worldId, gameId, images: [{ data, mediaType }], language? }; Worldbuilder, active subscription; priced styleFromRefs.
const PROPOSAL_FIELDS = ['manifesto', 'palette', 'avoid', 'light', 'materials', 'shapes', 'rules'];
exports.styleFromRefs = onRequest({ region: 'us-central1', secrets: [claudeApiKey], timeoutSeconds: 180 }, async (req, res) => {
  return cors(req, res, async () => {
    let uid, reservation = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      try { uid = (await admin.auth().verifyIdToken(auth.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const body = req.body || {};
      uid = await payerFor(uid, body.worldId); // a team admin acts on the owner's tokens (team.js)
      const worldId = str(body.worldId, 120), gameId = str(body.gameId, 120);
      if (!worldId || !gameId) return res.status(400).json({ error: 'Missing worldId/gameId' });
      const images = (Array.isArray(body.images) ? body.images : []).slice(0, 6).map((r) => imageBlock(r && r.data, (r && r.mediaType) || 'image/jpeg')).filter(Boolean);
      if (!images.length) return res.status(400).json({ error: 'Додай картинки в «Референси» гри', code: 'NO_REFS' });
      const wref = db.collection('worlds').doc(worldId), gref = wref.collection('games').doc(gameId);
      const [w, g, userDoc] = await Promise.all([wref.get(), gref.get(), db.collection('users').doc(uid).get()]);
      if (!w.exists || w.data().owner !== uid || !g.exists) return res.status(403).json({ error: 'Гру не знайдено або немає доступу' });
      if (w.data().freeze) return res.status(423).json({ error: 'Світ заморожено (Маркет): зміни недоступні', code: 'FROZEN' });
      const userData = userDoc.exists ? userDoc.data() : {};
      if (!getPlanBudget(userData.plan || 'free').allowGameDev) return res.status(403).json({ error: 'Візуальний стиль з ШІ — у тарифі Worldbuilder', code: 'PLAN_REQUIRED' });
      if (userData.subscriptionStatus !== 'active') return res.status(403).json({ error: 'Активна підписка необхідна для ШІ', requiresSubscription: true });

      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {}).claude : null;
      const { tier, model } = await modelFor(db, userData, userData.plan || 'free');
      const reserveCost = featureCost(byOp('styleFromRefs'), providerEconomy && providerEconomy.cost, tier); // gamebible.js shows the same price
      const balance = getBalance(userData);
      if (balance.available < reserveCost) return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      try { reservation = await reserve(db, uid, reserveCost); } catch (e) {
        if (e.code !== 'OUT_OF_TOKENS') throw e;
        return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: e.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      }
      const lang = LANGUAGES[body.language] || LANGUAGES.uk, game = g.data();
      const system = `You are the art director of the game "${str(game.title, 160)}". From the author's reference pictures, write the game's overall visual style guide —
what the pictures share, stated so an artist and an AI can check any new picture against it. Describe the common ground, not each picture.`;
      const content = [{ type: 'text', text: 'REFERENCE PICTURES:' }].concat(images, [{ type: 'text', text: `Return ONLY JSON:
{ "manifesto": "<2-4 sentences: the feel of the style>",
  "palette": "<5-8 lines, each '#rrggbb — name / role' (base, accents, shadows), taken from the pictures>",
  "avoid": "<2-4 lines '#rrggbb — why' of colours that would break it>",
  "light": "<light and mood>", "materials": "<materials and textures>", "shapes": "<shapes, proportions, silhouette>",
  "rules": "<4-8 lines 'Так: …' / 'Ні: …' (in English 'Do: …' / 'Don't: …')>" }
Short, concrete, no invented lore. Write in ${lang}.` }]);
      const msg = await claudeText(claudeApiKey.value(), { model, system, prompt: content, maxTokens: 4000, effort: 'low' });
      if (msg.stopReason === 'max_tokens') throw new Error('Відповідь AI обірвалась');
      const p = parseJson(msg.text), proposal = {};
      PROPOSAL_FIELDS.forEach((k) => { const v = str(p && p[k], 3000); if (v) proposal[k] = v; });
      if (!Object.keys(proposal).length) throw new Error('AI не дав стилю');
      const usage = { input_tokens: msg.usage.input_tokens || 0, output_tokens: msg.usage.output_tokens || 0 };
      const { userCost } = await charge(db, uid, 'generateScene', msg.model, usage, null, { provider: 'claude', targetWords: Math.round(usage.output_tokens * 0.75),
        estimatedInputTokens: Math.ceil(system.length / 4) + 1600 * images.length, reserved: reservation, logAs: 'style_from_refs' });
      reservation = null;
      return res.status(200).json({ success: true, proposal, tokensConsumed: userCost, tokensRemaining: Math.max(0, balance.available - userCost) });
    } catch (error) {
      console.error('styleFromRefs error:', error);
      return res.status(500).json({ error: `Помилка стилю з референсів: ${error.message}` });
    } finally {
      if (reservation) await refund(db, uid, reservation).catch((e) => console.error('[styleFromRefs] Refund failed:', e));
    }
  });
});

exports._style = { runCheck, imageBlock, CheckError };
