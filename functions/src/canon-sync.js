// Canon sync / scene analysis / backfill
const {
  onRequest,
  admin,
  db,
  cors,
  Anthropic,
  AI_MODELS,
  charge,
  getBalance,
  getPlanBudget,
  loadCanon,
  claudeApiKey,
  verifyAuth,
  buildCanonContext,
} = require('./common');
const { extractCanonFromScene } = require('./canon-extract');


/**
 * Cloud Function: Sync Canon from Project (Bulk Extraction)
 * Phase 3.1d: For old projects that don't have canon extracted yet
 *
 * Input: { projectId }
 * Output: { success: true, scenesProcessed: 10, totalCost: 150 }
 *
 * Extracts canon from ALL scenes in project sequentially
 */
exports.syncCanonFromProject = onRequest({
  secrets: [claudeApiKey],
  cors: true,
  timeoutSeconds: 540,  // 9 minutes (max for 2nd gen functions)
  memory: '1GiB'
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Auth check
      // uid ONLY from verified ID token (never from body)
      let uid = null;
      try {
        uid = await verifyAuth(req.headers.authorization);
      } catch (e) {
        uid = null;
      }
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.body;

      if (!projectId) {
        return res.status(400).json({ error: 'Missing projectId' });
      }

      // Get user plan
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const userPlan = userData.plan || 'free';
      const planConfig = getPlanBudget(userPlan);

      // Check if canon sync is allowed
      if (!planConfig.allowCanonExtraction) {
        return res.status(403).json({
          error: 'Canon sync не доступний на вашому плані. Upgrade до Storyteller або вище.'
        });
      }

      // Load project
      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = projectDoc.data();

      // Check ownership
      if (project.owner !== uid) {
        return res.status(403).json({ error: 'Forbidden: not project owner' });
      }

      const { worldId, canon } = await loadCanon(db, projectId, project, uid);

      // Get all scenes from project.scenes array
      const scenes = project.scenes || [];

      if (scenes.length === 0) {
        return res.status(400).json({ error: 'Проєкт не має сцен для синхронізації' });
      }

      // Phase 5.1: Read cost from economy_operations
      const economyDoc = await db.collection('economy_operations').doc('extractCanon').get();
      if (!economyDoc.exists) {
        return res.status(500).json({ error: 'economy_operations/extractCanon not found' });
      }
      const extractionCostPerScene = economyDoc.data().providers.claude.cost;
      const totalCost = scenes.length * extractionCostPerScene;

      // Check token budget
      const tokensRemaining = getBalance(userData).available;

      if (tokensRemaining < totalCost) {
        return res.status(402).json({
          error: `Недостатньо токенів. Потрібно: ${totalCost} (${scenes.length} сцен × ${extractionCostPerScene}), є: ${tokensRemaining}`
        });
      }

      console.log(`[Sync] Starting bulk extraction for ${scenes.length} scenes (cost: ${totalCost} tokens)`);

      let successCount = 0;
      let failedCount = 0;

      // Process scenes sequentially (avoid rate limits)
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneText = scene.text || scene.content;

        if (!sceneText || sceneText.length < 100) {
          console.warn(`[Sync] Skipping scene ${i} — too short or empty`);
          continue;
        }

        try {
          const sceneId = scene.id || `scene_${Date.now()}_${i}`;
          const result = await extractCanonFromScene(projectId, worldId, sceneText, canon, uid, sceneId);

          console.log(`[Sync] ✅ Scene ${i + 1}/${scenes.length} — ${result.suggestions.length} suggestions`);
          successCount++;

          // Small delay to avoid rate limits
          if (i < scenes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`[Sync] ❌ Scene ${i + 1} failed:`, error.message);
          failedCount++;
        }
      }

      console.log(`[Sync] Complete: ${successCount} success, ${failedCount} failed`);

      res.status(200).json({
        success: true,
        scenesProcessed: successCount,
        scenesFailed: failedCount,
        totalScenes: scenes.length,
        tokensConsumed: successCount * extractionCostPerScene,
        tokensRemaining: tokensRemaining - (successCount * extractionCostPerScene)
      });

    } catch (error) {
      console.error('[Sync] Error:', error);
      res.status(500).json({ error: `Помилка sync: ${error.message}` });
    }
  });
});

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
    try {
      // Auth check
      // uid ONLY from verified ID token (never from body)
      let uid = null;
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

      // Check token budget
      const tokensRemaining = getBalance(userData).available;

      // Phase 5.1: Read cost from economy_operations (no hardcode)
      const economyDoc = await db.collection('economy_operations').doc('analyzeScene').get();
      if (!economyDoc.exists) {
        return res.status(500).json({ error: 'economy_operations/analyzeScene not found' });
      }
      const analyzeCost = economyDoc.data().providers.claude.cost;

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

      const anthropic = new Anthropic({
        apiKey: claudeApiKey.value()
      });

      const message = await anthropic.messages.create({
        model: AI_MODELS.claude.sonnet,
        max_tokens: 4096,
        temperature: 0.2,  // Low temperature for analytical accuracy
        system: systemInstruction,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;

      // Parse JSON
      let analysis;
      try {
        analysis = JSON.parse(responseText);
      } catch (parseError) {
        // Try to extract JSON from markdown
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } else {
          throw new Error('Failed to parse JSON response');
        }
      }

      // Phase 5.1: Charge via token-service (reads economy_operations, logs usage_logs)
      const { userCost, apiCostUSD } = await charge(
        db,
        uid,
        'analyzeScene',
        message.model || AI_MODELS.claude.sonnet,
        message.usage || { input_tokens: 0, output_tokens: 0 },
        projectId,
        { provider: 'claude' }
      );

      console.log(`[Analyze] ✅ Advice ready (-${userCost} tokens, $${apiCostUSD.toFixed(4)})`);

      res.status(200).json({
        success: true,
        analysis,
        tokensConsumed: userCost,
        tokensRemaining: tokensRemaining - userCost
      });

    } catch (error) {
      console.error('[Analyze] Error:', error);
      res.status(500).json({ error: `Помилка analysis: ${error.message}` });
    }
  });
});

/**
 * Cloud Function: Backfill Scene canonRefs
 *
 * Deterministic matching: scan scene text for confirmed canon entity names (word boundaries).
 * Processes in batches with rate limiting. Returns progress info.
 */
exports.backfillSceneCanonRefs = onRequest({
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '512MiB'
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      // Get auth token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const token = authHeader.split('Bearer ')[1];
      let uid;
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        uid = decodedToken.uid;
      } catch (error) {
        res.status(401).json({ error: 'Invalid auth token' });
        return;
      }

      const { projectId } = req.body;

      if (!projectId) {
        res.status(400).json({ error: 'Missing projectId' });
        return;
      }

      console.log(`[Backfill] Starting for project ${projectId}...`);

      // Verify user owns the project
      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (!projectDoc.exists || projectDoc.data().owner !== uid) {
        res.status(403).json({ error: 'Project not found or access denied' });
        return;
      }

      const { canon } = await loadCanon(db, projectId, projectDoc.data(), uid);

      // Build lookup maps: name → id (only CONFIRMED entities)
      const lookups = {
        characters: {},
        locations: {},
        events: {},
        factions: {},
        artifacts: {}
      };

      Object.keys(canon).forEach(type => {
        if (!lookups[type]) return;

        Object.keys(canon[type]).forEach(id => {
          const entity = canon[type][id];
          // Skip inferred entities (only match confirmed)
          if (entity.inferred) return;

          const name = entity.name || entity.title || '';
          if (name) {
            lookups[type][name.toLowerCase()] = id;
          }
        });
      });

      console.log(`[Backfill] Canon lookups built:`, Object.keys(lookups).map(t => `${t}: ${Object.keys(lookups[t]).length}`).join(', '));

      // Get all scenes
      const scenesSnapshot = await db.collection('projects')
        .doc(projectId)
        .collection('scenes')
        .orderBy('n', 'asc')
        .get();

      const scenes = scenesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`[Backfill] Processing ${scenes.length} scenes...`);

      let updated = 0;
      let skipped = 0;
      const BATCH_SIZE = 100;
      const BATCH_DELAY = 500; // ms

      // Process in batches
      for (let i = 0; i < scenes.length; i += BATCH_SIZE) {
        const batch = scenes.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(scenes.length / BATCH_SIZE);

        console.log(`[Backfill] Batch ${batchNum}/${totalBatches} (scenes ${i + 1}-${Math.min(i + BATCH_SIZE, scenes.length)})...`);

        // Process each scene in batch
        const batchPromises = batch.map(async (scene) => {
          // Skip if already has canonRefs
          if (scene.canonRefs && Object.keys(scene.canonRefs).length > 0) {
            const hasRefs = Object.values(scene.canonRefs).some(arr => arr && arr.length > 0);
            if (hasRefs) {
              skipped++;
              return null;
            }
          }

          const text = scene.text || '';
          if (!text) {
            skipped++;
            return null;
          }

          // Deterministic matching with word boundaries
          const canonRefs = {
            characters: [],
            locations: [],
            events: [],
            factions: [],
            artifacts: []
          };

          Object.keys(lookups).forEach(type => {
            Object.keys(lookups[type]).forEach(name => {
              // Word boundary regex (case-insensitive)
              const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
              if (regex.test(text)) {
                const id = lookups[type][name];
                if (!canonRefs[type].includes(id)) {
                  canonRefs[type].push(id);
                }
              }
            });
          });

          // Only update if we found references
          const hasMatches = Object.values(canonRefs).some(arr => arr.length > 0);
          if (!hasMatches) {
            skipped++;
            return null;
          }

          // Update scene
          await db.collection('projects')
            .doc(projectId)
            .collection('scenes')
            .doc(scene.id)
            .update({ canonRefs });

          updated++;
          return scene.id;
        });

        await Promise.all(batchPromises);

        // Rate limiting between batches
        if (i + BATCH_SIZE < scenes.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }

      console.log(`[Backfill] ✅ Complete! Updated: ${updated}, Skipped: ${skipped}, Total: ${scenes.length}`);

      res.status(200).json({
        success: true,
        total: scenes.length,
        updated,
        skipped
      });

    } catch (error) {
      console.error('[Backfill] Error:', error);
      res.status(500).json({ error: `Backfill error: ${error.message}` });
    }
  });
});
