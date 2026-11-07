// 🎙 «Надиктуй — ШІ розкладе по полях» and ✦ «Варіанти» of the 🧠 personality constructor (World Bible / Game Bible).
// POST { worldId, op: voiceFill | personaIdeas, language?, … } with the author's ID token.
//   voiceFill    { text, target: { kind: card | dossier | persona, name, section, fields: [{ key, label, type, value }] } }
//                → { relevant, reason, fields: { key: new full value }, ignored } — text that is not about the open card is
//                  left out (reason / ignored say so); nothing is written: the author ticks what to take (gamebible.js).
//   personaIdeas { entityId, question, answers?, traits? } → { ideas: [3 short answers] } for one constructor question (persona.js).
// Any plan (paid plans need an active subscription, as genesisWorld); reserve featureCost(voiceFill | personaIdeas) →
// Claude (the author's model) → charge the real cost. A team admin acts on the owner's tokens (payerFor).
const { onRequest, admin, db, cors, charge, getBalance, reserve, cutOff, settle, claudeApiKey } = require('./common');
const { payerFor } = require('./team')._team;
const { featureCost, byOp } = require('../paid-features.js');
const P = require('../persona.js');
const { modelFor, claudeText } = require('./claude');

const LANGUAGES = { uk: 'Ukrainian', en: 'English' };
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const MAX_TEXT = 8000;

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) {
    const m = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('AI повернув не JSON');
    return JSON.parse(m[1] || m[0]);
  }
}

// the fields the AI may fill: text and tables (Markdown) only — files, pictures, palettes and mock-ups are not dictated
function cleanFields(list) {
  return (Array.isArray(list) ? list : []).slice(0, 40).map((f) => ({ key: str(f && f.key, 80), label: str(f && f.label, 160), type: f && f.type === 'table' ? 'table' : 'text', value: str(f && f.value, 3000) }))
    .filter((f) => f.key && f.label);
}
function cleanFill(p, fields) {
  const out = {};
  const got = p && p.fields && typeof p.fields === 'object' ? p.fields : {};
  fields.forEach((f) => { const v = got[f.key]; if (typeof v === 'string' && v.trim() && v.trim() !== f.value) out[f.key] = v.trim().slice(0, 6000); });
  return { relevant: !!(p && p.relevant !== false && Object.keys(out).length), reason: str(p && p.reason, 600), ignored: str(p && p.ignored, 1500), fields: out };
}

function fillPrompt(target, fields, text, lang) {
  const what = target.kind === 'persona' ? `the personality constructor of the character "${target.name}"` : target.kind === 'dossier' ? `the world dossier of "${target.name}" (${target.section})` : `the game card "${target.name}" (section: ${target.section})`;
  return `The author DICTATED this by voice (speech recognition — expect misheard words, no punctuation, filler words):
"""
${text}
"""

It is meant for ${what}. Its fields now:
${fields.map((f) => `- ${f.key} = "${f.label}"${f.type === 'table' ? ' (a Markdown table — keep its columns)' : ''}: ${f.value ? JSON.stringify(f.value) : '(empty)'}`).join('\n')}

Distribute what the author said into these fields.
- Only what was SAID: never invent, never add your own ideas. Clean up the speech: punctuation, misheard words, no filler.
- A field that already has text: return its FULL new value — keep what is there, add the new facts; replace only what the author explicitly corrects.
- A table field: return the whole Markdown table with the same header row; add or update rows ("HP 120" → | HP | 120 |).
- Leave out fields the speech says nothing about.
- If the speech (or part of it) is about something else — another character, another topic, a request to you — do not put it anywhere: say so in "reason" / "ignored".
- Write in ${lang}.

Return ONLY JSON: {"relevant": true|false, "reason": "one sentence when nothing or not everything fits this card", "ignored": "what was left out, briefly", "fields": {"<key>": "new full value"}}`;
}

async function personaContext(wref, entityId) {
  const [eSnap, all] = await Promise.all([wref.collection('entities').doc(entityId).get(), wref.collection('entities').where('kind', '==', 'characters').limit(60).get()]);
  if (!eSnap.exists || eSnap.data().kind !== 'characters') return null;
  const e = eSnap.data(), d = e.dossier || {};
  const others = all.docs.filter((x) => x.id !== entityId).map((x) => `${x.data().name || ''}${x.data().desc ? ' — ' + str(x.data().desc, 160) : ''}`).join('; ');
  return { e, text: `CHARACTER "${e.name || ''}": ${str(e.desc || e.description, 2000)}${d.story ? '\nBiography: ' + str(d.story, 3000) : ''}${d.look ? '\nLook: ' + str(d.look, 1000) : ''}${others ? '\nOther characters of the world: ' + str(others, 2500) : ''}` };
}

exports.cardFill = onRequest({ region: 'us-central1', secrets: [claudeApiKey], timeoutSeconds: 120 }, async (req, res) => {
  return cors(req, res, async () => {
    let uid, reservation = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Потрібна автентифікація' });
      try { uid = (await admin.auth().verifyIdToken(auth.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const body = req.body || {};
      uid = await payerFor(uid, body.worldId);
      const op = body.op === 'personaIdeas' ? 'personaIdeas' : body.op === 'voiceFill' ? 'voiceFill' : '';
      const worldId = str(body.worldId, 120);
      if (!op || !worldId) return res.status(400).json({ error: 'Missing op/worldId' });
      const lang = LANGUAGES[body.language] || LANGUAGES.uk;
      const wref = db.collection('worlds').doc(worldId);
      const [w, userDoc] = await Promise.all([wref.get(), db.collection('users').doc(uid).get()]);
      if (!w.exists || w.data().owner !== uid) return res.status(403).json({ error: 'Світ не знайдено або немає доступу' });
      if (w.data().freeze) return res.status(423).json({ error: 'Світ заморожено (Маркет): зміни недоступні', code: 'FROZEN' });
      const userData = userDoc.exists ? userDoc.data() : {}, plan = userData.plan || 'free';
      if (plan !== 'free' && userData.subscriptionStatus !== 'active') return res.status(403).json({ error: 'Активна підписка необхідна для генерації', requiresSubscription: true });

      let system, prompt, fields = null, ctx = null, q = null;
      if (op === 'voiceFill') {
        const text = str(body.text, MAX_TEXT + 1), target = body.target || {};
        if (!text) return res.status(400).json({ error: 'Немає тексту' });
        if (text.length > MAX_TEXT) return res.status(400).json({ error: `Задовго: максимум ${MAX_TEXT} символів`, code: 'INPUT_TOO_LONG' });
        fields = cleanFields(target.fields);
        if (!fields.length) return res.status(400).json({ error: 'У картці немає текстових полів' });
        system = 'You are a careful editor\'s assistant in a worldbuilding tool. You file what an author dictated into the fields of the card they have open. You never invent content.';
        prompt = fillPrompt({ kind: ['card', 'dossier', 'persona'].includes(target.kind) ? target.kind : 'card', name: str(target.name, 160) || '—', section: str(target.section, 80) }, fields, text, lang);
      } else {
        q = P.question(str(body.question, 40));
        if (!q) return res.status(400).json({ error: 'Невідоме питання' });
        ctx = await personaContext(wref, str(body.entityId, 120));
        if (!ctx) return res.status(404).json({ error: 'Персонажа не знайдено' });
        const world = w.data(), sofar = P.personaText(P.cleanPersona({ answers: body.answers, traits: body.traits }), body.language === 'en' ? 'en' : 'uk');
        system = `You help an author develop a character of their world. The world's laws and facts are true; never contradict them.
WORLD: ${str(world.summary || world.tagline, 3000)}${(world.rules || []).length ? '\nLAWS: ' + world.rules.map((r) => str(r, 300)).join('; ') : ''}`;
        prompt = `${ctx.text}${sofar ? '\nWhat the author already decided about the personality:\n' + sofar : ''}

Question of the personality constructor: "${q.en}"${q.hint ? ' (' + q.hint.en + ')' : ''}
Offer 3 DIFFERENT answers that fit this character and the world — each 1–2 sentences, concrete, not generic, consistent with what is already decided. The author picks or edits one.
Write in ${lang}. Return ONLY JSON: {"ideas": ["…", "…", "…"]}`;
      }

      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {}).claude : null;
      const { tier, model } = await modelFor(db, userData, plan);
      const feature = op === 'personaIdeas' ? byOp('personaIdeas') : byOp('voiceFill');
      const reserveCost = featureCost(feature, providerEconomy && providerEconomy.cost, tier); // gamebible.js shows the same price
      const balance = getBalance(userData);
      if (balance.available < reserveCost) return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      try { reservation = await reserve(db, uid, reserveCost); } catch (e) {
        if (e.code !== 'OUT_OF_TOKENS') throw e;
        return res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: e.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
      }

      const msg = await claudeText(claudeApiKey.value(), { model, system, prompt, maxTokens: 6000, effort: 'low' });
      if (msg.stopReason === 'max_tokens') throw cutOff('Відповідь AI обірвалась', msg.model, msg.usage);
      const parsed = parseJson(msg.text) || {};
      const result = op === 'voiceFill' ? cleanFill(parsed, fields)
        : { ideas: (Array.isArray(parsed.ideas) ? parsed.ideas : []).map((x) => str(x, 600)).filter(Boolean).slice(0, 3) };
      const usage = { input_tokens: msg.usage.input_tokens || 0, output_tokens: msg.usage.output_tokens || 0 };
      const { userCost } = await charge(db, uid, 'generateScene', msg.model, usage, null, { provider: 'claude', targetWords: Math.round(usage.output_tokens * 0.75),
        estimatedInputTokens: Math.ceil((system.length + prompt.length) / 4), reserved: reservation, logAs: op });
      reservation = null;
      return res.status(200).json({ success: true, ...result, tokensConsumed: userCost, tokensRemaining: Math.max(0, balance.available - userCost) });
    } catch (error) {
      console.error('cardFill error:', error);
      if (reservation) await settle(db, uid, reservation, error, 'cardFill').catch((e) => console.error('[cardFill] Refund failed:', e));
      return res.status(500).json({ error: `Помилка: ${error.message}` });
    }
  });
});

exports._cardFill = { cleanFields, cleanFill, fillPrompt };
