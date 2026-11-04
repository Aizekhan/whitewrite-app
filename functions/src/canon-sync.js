// «✦ Порадити» on the writing sheet: analyzeScene
const {
  onRequest,
  db,
  cors,
  charge,
  getBalance,
  reserve,
  cutOff, settle,
  getPlanBudget,
  loadCanon,
  claudeApiKey,
  verifyAuth,
  buildCanonContext,
} = require('./common');
const { modelFor, claudeText } = require('./claude');
const { featureCost, byOp } = require('../paid-features.js');


/**
 * Cloud Function: Analyze Scene (Narrative Diagnostics)
 * Phase 3.2: Deep analysis with scoring, consistency check, tension analysis
 *
 * Input: { projectId, sceneText }
 * Output: { score, detailedScores, strengths, weaknesses, suggestions, consistencyIssues, tensionAnalysis, ... }
 *
 * Uses Claude Opus (expensive but high-quality analysis)
 */
exports.analyzeScene = onRequest({
  secrets: [claudeApiKey],
  cors: true,
  timeoutSeconds: 120
}, async (req, res) => {
  return cors(req, res, async () => {
    let reservation = null, uid = null;
    try {
      // Auth check
      // uid ONLY from verified ID token (never from body)
      try {
        uid = await verifyAuth(req.headers.authorization);
      } catch (e) {
        uid = null;
      }
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId, sceneText } = req.body; // + title, lang

      if (!projectId || !sceneText) {
        return res.status(400).json({ error: 'Missing projectId or sceneText' });
      }

      // Get user plan
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const userPlan = userData.plan || 'free';
      const planConfig = getPlanBudget(userPlan);

      // Check if ANALYZE is allowed
      if (!planConfig.allowAnalyze) {
        return res.status(403).json({
          error: 'ANALYZE mode не доступний на вашому плані. Upgrade до Novelist або вище.'
        });
      }
      if (userData.subscriptionStatus !== 'active') {
        return res.status(403).json({ error: 'Активна підписка необхідна для генерації', requiresSubscription: true });
      }

      // Check token budget
      const tokensRemaining = getBalance(userData).available;

      // the reserve is the registry price of «✦ Порадити» (paid-features.js `advise`, the same the sheet shows); charge() bills the real cost
      const analyzeCost = featureCost(byOp('advise'));

      if (tokensRemaining < analyzeCost) {
        return res.status(402).json({
          error: `Недостатньо токенів. Потрібно: ${analyzeCost}, є: ${tokensRemaining}`
        });
      }

      // Load project canon
      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      if (projectDoc.data().owner !== uid) {
        return res.status(403).json({ error: 'Forbidden: not project owner' });
      }
      // Atomically reserve before the AI call (settled in charge(), refunded on failure) — parallel runs can't overspend
      try {
        reservation = await reserve(db, uid, analyzeCost);
      } catch (error) {
        if (error.code === 'OUT_OF_TOKENS') return res.status(402).json({ error: `Недостатньо токенів. Потрібно: ${analyzeCost}`, code: 'OUT_OF_TOKENS' });
        throw error;
      }
      const project = projectDoc.data();
      const { canon } = await loadCanon(db, projectId, project, uid);
      const replyIn = (req.body.lang === 'en') ? 'English' : 'Ukrainian';
      const reveal = { open: 'open to the reader', later: 'a secret the reader learns later' + (project.revealNote ? ` (${project.revealNote})` : ''), internal: 'internal canon — for the author only, not for readers' }[project.reveal || 'open'];

      // The author's advisor (the writing sheet «✦ Порадити»): what to improve, what contradicts the canon, what is unclear.
      const systemInstruction = `You are a careful literary editor and keeper of a fictional world's canon. The author wrote this scene themselves; you advise, you never rewrite it whole.
Judge the scene against the canon below: the world's laws are unbreakable, facts and the entities' descriptions and current states are true.
Be concrete: quote the exact words from the scene you are talking about (short quotes, verbatim). No praise padding. If a list has nothing real, return it empty.
Reply in ${replyIn}. Return ONLY valid JSON, no markdown.

The story: "${project.title || ''}" — ${reveal}.

CANON:
${buildCanonContext(canon)}`;

      const prompt = `Scene${req.body.title ? ` "${String(req.body.title).slice(0, 200)}"` : ''}:

${String(sceneText).slice(0, 60000)}

Return JSON:
{
  "summary": "<one or two sentences: the main thing to work on>",
  "improve": [ { "what": "<what to improve>", "why": "<why it matters>", "quote": "<verbatim words from the scene, or empty>" } ],
  "canon": [ { "quote": "<verbatim words from the scene>", "conflict": "<what in the canon it contradicts>", "fact": "<the canon law/fact/description it breaks>" } ],
  "unclear": [ { "quote": "<verbatim words from the scene>", "question": "<what a reader would not understand>" } ],
  "fixes": [ { "original": "<verbatim snippet>", "suggested": "<replacement>", "reason": "<why>" } ]
}
At most 5 items per list.`;

      console.log('[Analyze] Advising on a scene');

      // the author's Claude model (Account); analysis → effort medium, headroom for thinking
      const { model: claudeModel } = await modelFor(db, userData, userPlan);
      const message = await claudeText(claudeApiKey.value(), { model: claudeModel, system: systemInstruction, prompt, maxTokens: 8000, effort: 'medium' });
      if (message.stopReason === 'max_tokens') throw cutOff('Відповідь AI обірвалась', message.model, message.usage);
      const responseText = message.text;

      // Parse JSON
      let analysis;
      try {
        analysis = JSON.parse(responseText);
      } catch (parseError) {
        // Try to extract JSON from markdown
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
        try { analysis = JSON.parse(jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : ''); }
        catch (e) { throw cutOff('Failed to parse JSON response', message.model, message.usage); } // the answer is paid to the API — settle() charges it
      }

      // Phase 5.1: Charge via token-service (reads economy_operations, logs usage_logs)
      const { userCost, apiCostUSD } = await charge(
        db,
        uid,
        'analyzeScene',
        message.model,
        message.usage || { input_tokens: 0, output_tokens: 0 },
        projectId,
        { provider: 'claude', reserved: reservation }
      );
      reservation = null;

      console.log(`[Analyze] ✅ Advice ready (-${userCost} tokens, $${apiCostUSD.toFixed(4)})`);

      res.status(200).json({
        success: true,
        analysis,
        tokensConsumed: userCost,
        tokensRemaining: tokensRemaining - userCost
      });

    } catch (error) {
      if (reservation) await settle(db, uid, reservation, error, 'advise').catch((e) => console.error('[Analyze] Refund failed:', e));
      console.error('[Analyze] Error:', error);
      res.status(500).json({ error: `Помилка analysis: ${error.message}` });
    }
  });
});
