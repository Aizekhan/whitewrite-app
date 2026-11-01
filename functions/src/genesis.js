// Genesis / World Intent — the world is born from the author's choice, not from the first scene
const {
  onRequest,
  admin,
  db,
  cors,
  charge,
  getBalance,
  reserve,
  refund,
  claudeApiKey,
} = require('./common');
const { modelFor, claudeText } = require('./claude');
const { featureCost, byOp } = require('../paid-features.js');

const GENESIS_LANGUAGES = {
  uk: 'Ukrainian', en: 'English', pl: 'Polish', ru: 'Russian', de: 'German', es: 'Spanish',
  fr: 'French', it: 'Italian', pt: 'Portuguese', ja: 'Japanese', zh: 'Chinese'
};
const MAX_PREMISE_CHARS = 2000;

// Model output is untrusted: keep only the expected shape, trimmed and capped.
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
function cleanSeed(s) {
  if (!s || typeof s !== 'object') return null;
  const list = (a, n, f) => (Array.isArray(a) ? a : []).map(f).filter(Boolean).slice(0, n);
  const ent = (e) => (e && str(e.name, 80) ? { name: str(e.name, 80), role: str(e.role, 80), description: str(e.description, 400) } : null);
  const seed = {
    name: str(s.name, 80),
    tagline: str(s.tagline, 160),
    summary: str(s.summary, 900),
    facts: list(s.facts, 6, (f) => (f && str(f.k, 40) && str(f.v, 120) ? { k: str(f.k, 40), v: str(f.v, 120) } : null)),
    rules: list(s.rules, 6, (r) => str(r, 240) || null),
    characters: list(s.characters, 4, ent),
    locations: list(s.locations, 4, ent),
    factions: list(s.factions, 3, ent),
  };
  return seed.name && seed.summary && seed.rules.length ? seed : null;
}

/**
 * Cloud Function: Genesis World
 *
 * From the author's premise, proposes 3 DISTINCT world seeds (summary, facts,
 * laws, key characters/locations/factions). Nothing is saved: the author picks
 * one (or asks again) and the client writes it to the world as explicit canon.
 *
 * Input (POST JSON): { title?, premise, genres?, language? }
 * Output: { success, seeds: [seed×3], tokensConsumed, tokensRemaining }
 */
exports.genesisWorld = onRequest({
  region: 'us-central1',
  secrets: [claudeApiKey],
  timeoutSeconds: 300,
  memory: '512MiB'
}, async (req, res) => {
  return cors(req, res, async () => {
    let uid;
    let reservation = null;
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Потрібна автентифікація' });
        return;
      }
      try {
        uid = (await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1])).uid;
      } catch (error) {
        res.status(401).json({ error: 'Невірний токен автентифікації' });
        return;
      }

      const body = req.body || {};
      const premise = str(body.premise, MAX_PREMISE_CHARS + 1);
      if (!premise) {
        res.status(400).json({ error: 'Опишіть задум історії' });
        return;
      }
      if (premise.length > MAX_PREMISE_CHARS) {
        res.status(400).json({ error: `Задум задовгий. Максимум: ${MAX_PREMISE_CHARS} символів.`, code: 'INPUT_TOO_LONG' });
        return;
      }
      const title = str(body.title, 200);
      const genres = (Array.isArray(body.genres) ? body.genres : []).map((g) => str(g, 40)).filter(Boolean).slice(0, 8);
      const languageName = GENESIS_LANGUAGES[body.language] || GENESIS_LANGUAGES.uk;

      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userPlan = userData.plan || 'free';
      if (userPlan !== 'free' && userPlan !== 'seed' && userData.subscriptionStatus !== 'active') {
        res.status(403).json({ error: 'Активна підписка необхідна для генерації', requiresSubscription: true, plan: userPlan });
        return;
      }

      // Priced like one generated scene (same economy entry), logged as genesisWorld
      const provider = 'claude';
      const { tier, model: claudeModel } = await modelFor(db, userData, userPlan);
      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {}).claude : null;
      const reserveCost = featureCost(byOp('genesis'), providerEconomy && providerEconomy.cost, tier);
      const balance = getBalance(userData);
      if (balance.available < reserveCost) {
        res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: balance.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
        return;
      }
      try {
        reservation = await reserve(db, uid, reserveCost);
      } catch (error) {
        if (error.code !== 'OUT_OF_TOKENS') throw error;
        res.status(403).json({ error: 'Недостатньо токенів', tokensRemaining: error.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
        return;
      }

      const prompt = `You are the world architect of WhiteWrite. The author gave a premise; propose 3 DISTINCT seeds for the world this story lives in. The author will CHOOSE one — so make them genuinely different (tone, source of conflict, nature of magic/technology, scale), yet each must honour the premise.

Premise${title ? ` («${title}»)` : ''}:
${premise}
${genres.length ? `Genres: ${genres.join(', ')}\n` : ''}
For every seed:
- name: the world's name
- tagline: one evocative line
- summary: 2-3 sentences — what this world is and what is at stake
- facts: 4-6 {"k","v"} pairs (era/year, setting, magic or technology, tone, central conflict)
- rules: 3-5 LAWS of the world — concrete physics/magic/social constraints that create dramatic limits (what is impossible, what costs something)
- characters: 2-4 key characters {"name","role","description"} (description: who they are + what they want)
- locations: 2-3 {"name","description"}
- factions: 0-2 {"name","description"}

Write ALL text in ${languageName}. Return ONLY valid JSON, no markdown:
{"seeds":[{...},{...},{...}]}`;

      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      let outText;
      let apiUsage = { input_tokens: 0, output_tokens: 0 };
      let model;
      const out = await claudeText(claudeApiKey.value(), { model: claudeModel, prompt, maxTokens: 12000, effort: 'low' });
      if (out.stopReason === 'max_tokens') throw new Error('Відповідь AI обірвалась');
      outText = out.text;
      apiUsage = out.usage;
      model = out.model;

      let parsed;
      try {
        parsed = JSON.parse(outText);
      } catch (e) {
        const m = outText.match(/```json\s*([\s\S]*?)\s*```/) || outText.match(/\{[\s\S]*\}/);
        if (!m) throw new Error('AI повернув не JSON');
        parsed = JSON.parse(m[1] || m[0]);
      }
      const seeds = (Array.isArray(parsed.seeds) ? parsed.seeds : []).map(cleanSeed).filter(Boolean).slice(0, 3);
      if (!seeds.length) throw new Error('AI не запропонував жодного придатного світу');

      const { userCost } = await charge(db, uid, 'generateScene', model, apiUsage, null, {
        provider,
        targetWords: 900,
        estimatedInputTokens,
        reserved: reservation,
        logAs: 'genesisWorld'
      });
      reservation = null;

      res.status(200).json({
        success: true,
        seeds,
        tokensConsumed: userCost,
        tokensRemaining: Math.max(0, balance.available - userCost)
      });
    } catch (error) {
      console.error('genesisWorld error:', error);
      if (reservation) {
        await refund(db, uid, reservation).catch(e => console.error('[genesisWorld] Refund failed:', e));
      }
      res.status(500).json({ error: `Помилка Genesis: ${error.message}` });
    }
  });
});
