const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true }); // Enable CORS for all origins
const Anthropic = require('@anthropic-ai/sdk');
const { AI_MODELS, MODEL_PRICING } = require('./ai-models.js');
const { charge } = require('./token-service.js');

admin.initializeApp();
const db = admin.firestore();

// Define secrets
const geminiApiKey = defineSecret('GEMINI_API_KEY');
const claudeApiKey = defineSecret('CLAUDE_API_KEY');
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

// Phase 1.1 + 3.0: Token Budget System (synced with app/firebase/token-budget.js)
const PLAN_BUDGETS = {
  free: {
    monthly: 200,
    allowClaude: false,
    allowCanonExtraction: false,
    allowAnalyze: false,
    allowImprove: false
  },
  storyteller: {
    monthly: 2400,
    allowClaude: false,
    allowCanonExtraction: true,  // ✅ Auto-extraction enabled
    allowAnalyze: false,
    allowImprove: false
  },
  novelist: {
    monthly: 32000,
    allowClaude: true,
    allowCanonExtraction: true,
    allowAnalyze: true,   // ✅ ANALYZE mode
    allowImprove: true    // ✅ IMPROVE mode
  },
  worldbuilder: {
    monthly: 180000,
    allowClaude: true,
    allowCanonExtraction: true,
    allowAnalyze: true,
    allowImprove: true
  },
  worldforge: {
    monthly: 180000,
    allowClaude: true,
    allowCanonExtraction: true,
    allowAnalyze: true,
    allowImprove: true
  } // dev/testing plan
};

function getPlanBudget(plan) {
  return PLAN_BUDGETS[plan] || PLAN_BUDGETS.free;
}

// Helper: Verify Firebase ID token
async function verifyAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  const idToken = authHeader.split('Bearer ')[1];
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid;
}

/**
 * Cloud Function: Generate Scene
 *
 * Generates a story scene based on project canon and scene intent.
 * Canon-aware generation using Gemini API.
 *
 * Input (POST JSON body):
 *  - projectId: string
 *  - sceneIntent: 'conflict' | 'character' | 'action' | 'romance' | 'worldbuilding' | 'surprise' | 'custom'
 *  - customIntent?: string (if sceneIntent === 'custom')
 *  - previousScenes?: Array<{title: string, text: string}> (for continuity)
 *
 * Output:
 *  - scene: { title: string, text: string, entities: string[] }
 */
exports.generateScene = onRequest({
  region: 'us-central1',
  secrets: [geminiApiKey, claudeApiKey],
  timeoutSeconds: 540,  // 9 minutes - Claude Opus 4 can be slow
  memory: '512MiB'
}, async (req, res) => {
  // Handle CORS
  return cors(req, res, async () => {
    try {
      // Only allow POST
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const { projectId, sceneIntent, customIntent, previousScenes = [] } = req.body;

      // Get auth token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Потрібна автентифікація' });
        return;
      }

      // Verify Firebase auth token
      const token = authHeader.split('Bearer ')[1];
      let uid;
      try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        uid = decodedToken.uid;
      } catch (error) {
        console.error('Auth verification failed:', error);
        res.status(401).json({ error: 'Невірний токен автентифікації' });
        return;
      }

      // Validate input
      if (!projectId || !sceneIntent) {
        res.status(400).json({ error: 'projectId та sceneIntent обов\'язкові' });
        return;
      }

      // SERVER-SIDE INPUT VALIDATION: Prevent massive prompts (protect against frontend bypass)
      // Max token limits (conservative, ~4 chars per token):
      // - Project description: 2000 chars (≈500 tokens)
      // - Custom intent: 500 chars (≈125 tokens)
      // - Combined input: 8000 tokens max (≈32000 chars)

      const MAX_CUSTOM_INTENT_CHARS = 500;

      if (customIntent && customIntent.length > MAX_CUSTOM_INTENT_CHARS) {
        console.warn(`[generateScene] Rejected: customIntent too long (${customIntent.length} chars)`);
        res.status(400).json({
          error: `Свій напрям задовгий (${customIntent.length} символів). Максимум: ${MAX_CUSTOM_INTENT_CHARS} символів.`,
          code: 'INPUT_TOO_LONG'
        });
        return;
      }

      // Load project from Firestore
      const projectDoc = await db.collection('projects').doc(projectId).get();

      if (!projectDoc.exists) {
        res.status(404).json({ error: 'Проєкт не знайдено' });
        return;
      }

      const project = projectDoc.data();

      // Check ownership
      if (project.owner !== uid) {
        res.status(403).json({ error: 'Ви не є власником цього проєкту' });
        return;
      }

      // SERVER-SIDE VALIDATION: Project description length
      const MAX_DESCRIPTION_CHARS = 2000;
      if (project.desc && project.desc.length > MAX_DESCRIPTION_CHARS) {
        console.warn(`[generateScene] Rejected: project description too long (${project.desc.length} chars)`);
        res.status(400).json({
          error: `Опис всесвіту задовгий (${project.desc.length} символів). Максимум: ${MAX_DESCRIPTION_CHARS} символів.`,
          code: 'INPUT_TOO_LONG'
        });
        return;
      }

      // Combined input size check (prevent API context overflow)
      const MAX_TOTAL_INPUT_TOKENS = 8000; // Conservative limit (~32KB text)
      const estimatedInputChars = (project.desc?.length || 0) + (customIntent?.length || 0);
      const estimatedInputTokens = Math.ceil(estimatedInputChars / 4); // ~4 chars per token

      if (estimatedInputTokens > MAX_TOTAL_INPUT_TOKENS) {
        console.warn(`[generateScene] Rejected: combined input too large (est. ${estimatedInputTokens} tokens)`);
        res.status(400).json({
          error: `Сукупний розмір тексту задовгий (≈${estimatedInputTokens} токенів). Максимум: ${MAX_TOTAL_INPUT_TOKENS} токенів. Скоротіть опис всесвіту або свій напрям.`,
          code: 'INPUT_TOO_LONG'
        });
        return;
      }

      // Load user data to check plan (Phase 1.1: Token Budget System)
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userPlan = userData.plan || 'free'; // default: free tier
      const planConfig = getPlanBudget(userPlan);
      const tokensUsed = userData.tokensUsed || 0;
      const tokensBudget = planConfig.monthly;
      const tokensRemaining = tokensBudget - tokensUsed;

      // Determine which AI to use (Phase 1.3: Feature Gates)
      const useClaudeAPI = planConfig.allowClaude;

      // Phase 4: Read token cost from economy_operations (data-driven pricing)
      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const economyData = economyDoc.exists ? economyDoc.data() : null;

      let sceneCost = 20; // fallback
      let providerModel = 'gemini-2.0-flash-exp';

      if (economyData && economyData.providers) {
        if (useClaudeAPI && economyData.providers.claude) {
          sceneCost = economyData.providers.claude.cost;
          providerModel = economyData.providers.claude.model;
        } else if (economyData.providers.gemini) {
          sceneCost = economyData.providers.gemini.cost;
          providerModel = economyData.providers.gemini.model;
        }
      }

      console.log(`User plan: ${userPlan}, tokens: ${tokensRemaining}/${tokensBudget}, AI: ${useClaudeAPI ? 'Claude' : 'Gemini'} (${providerModel}), cost: ${sceneCost} tokens`);

      // Check token quota (client already checked, but double-check server-side)
      if (tokensRemaining < sceneCost) {
        res.status(403).json({
          error: 'Недостатньо токенів для генерації',
          tokensRemaining: tokensRemaining,
          tokensNeeded: sceneCost,
          plan: userPlan
        });
        return;
      }

      // Check subscription status for paid plans
      // TODO: Re-enable when Stripe is fully configured
      // if (userPlan !== 'seed' && userData.subscriptionStatus !== 'active') {
      //   res.status(403).json({
      //     error: 'Активна підписка необхідна для генерації',
      //     requiresSubscription: true,
      //     plan: userPlan
      //   });
      //   return;
      // }

      // Extract canon
      const canon = project.canon || {
        characters: {},
        locations: {},
        events: {},
        factions: {},
        artifacts: {},
        world: {}
      };

      // Build canon context for prompt
      const canonContext = buildCanonContext(canon);

      // Map scene intent to Ukrainian description
      const intentMap = {
        conflict: 'Конфлікт — протистояння, напруга, загострення',
        character: 'Розвиток персонажа — внутрішні зміни, рішення, розкриття',
        action: 'Екшн — динаміка, рух, фізична дія',
        romance: 'Романтика — емоційна близькість, зв\'язок між персонажами',
        worldbuilding: 'Світобудова — розкриття всесвіту, деталі світу',
        surprise: 'Сюрприз від AI — несподіваний поворот, який змінює очікування',
        custom: customIntent || 'Вільний напрям'
      };

      const intentDescription = intentMap[sceneIntent] || intentMap.custom;

      // Build prompt
      const prompt = buildScenePrompt({
        title: project.title,
        desc: project.desc,
        language: project.language || 'uk',
        genres: project.genres || [],
        scope: project.scope,
        ending: project.ending || 'open',
        endingNote: project.endingNote || '',
        length: project.length || 700,
        dialogue: project.dialogue != null ? project.dialogue : 50,
        canonContext,
        intentDescription,
        previousScenes
      });

      let sceneText = null;
      let lastError = null;
      let apiUsage = null; // Phase 4.1: Track real API usage
      let actualModel = null; // Phase 4.1: Track actual model used

      // Generate scene using Claude or Gemini based on plan
      if (useClaudeAPI) {
        // CLAUDE API (Worldforge plan)
        try {
          console.log(`Using Claude API (${AI_MODELS.claude.opus})`);

          const anthropic = new Anthropic({
            apiKey: claudeApiKey.value()
          });

          const message = await anthropic.messages.create({
            model: AI_MODELS.claude.opus,
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: prompt
            }]
          });

          sceneText = message.content[0].text;

          // Phase 4.1: Capture real API usage + model
          apiUsage = message.usage; // { input_tokens, output_tokens, cache_* }
          actualModel = message.model || AI_MODELS.claude.opus; // Claude returns model in response

          // Validate minimum length
          if (sceneText.length < 500) {
            throw new Error(`Scene too short (${sceneText.length} chars) - likely incomplete`);
          }

          console.log(`✓ Claude succeeded (${sceneText.length} chars, stop_reason: ${message.stop_reason}, usage:`, JSON.stringify(apiUsage));
        } catch (error) {
          console.error('✗ Claude failed:', error.message);
          lastError = error;
        }
      } else {
        // GEMINI API (Seed / Storyweaver plans)
        const apiKey = geminiApiKey.value();

        // Try models with fallback (REST API v1, 2026 models)
        const modelNames = [
          AI_MODELS.gemini.pro  // Current Gemini model
        ];

        for (const modelName of modelNames) {
        try {
          console.log(`Trying model: ${modelName}`);

          const apiUrl = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`;

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{ text: prompt }]
              }],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 4096,  // Increased for longer scenes (Ukrainian text needs more tokens)
                stopSequences: []
              }
            })
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`HTTP ${response.status}: ${error}`);
          }

          const data = await response.json();

          if (!data.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response structure');
          }

          sceneText = data.candidates[0].content.parts[0].text;

          // Check if text was truncated
          const finishReason = data.candidates[0].finishReason;
          if (finishReason === 'MAX_TOKENS') {
            console.warn(`⚠ Model ${modelName} hit token limit - text may be truncated`);
            throw new Error('Model hit token limit - scene incomplete');
          }

          // Validate minimum length (scene should be at least ~500 chars for 700 words)
          if (sceneText.length < 500) {
            console.warn(`⚠ Model ${modelName} returned too short text (${sceneText.length} chars)`);
            throw new Error(`Scene too short (${sceneText.length} chars) - likely incomplete`);
          }

          console.log(`✓ Model ${modelName} succeeded (${sceneText.length} chars, reason: ${finishReason})`);
          break; // Success
        } catch (error) {
          console.warn(`✗ Model ${modelName} failed:`, error.message);
          lastError = error;
        }
        }
      }

      if (!sceneText) {
        const aiName = useClaudeAPI ? 'Claude' : 'Gemini';
        throw new Error(`${aiName} API недоступна. Остання помилка: ${lastError?.message}`);
      }

      // Parse scene (extract title from first line if present)
      const lines = sceneText.trim().split('\n');
      let sceneTitle = `Сцена ${previousScenes.length + 1}`;
      let sceneContent = sceneText;

      // If first line looks like a title (## Title or # Title), extract it
      if (lines[0].startsWith('#')) {
        sceneTitle = lines[0].replace(/^#+\s*/, '').trim();
        sceneContent = lines.slice(1).join('\n').trim();
      }

      // Extract mentioned entities (simple keyword matching from canon)
      const entities = extractMentionedEntities(sceneContent, canon);

      // Phase 6.1: Charge via token-service (word-based pricing)
      const targetWords = project.length || 700; // From project settings
      const { userCost, apiCostUSD } = await charge(
        db,
        uid,
        'generateScene',
        actualModel || providerModel,
        apiUsage || { input_tokens: 0, output_tokens: 0 },
        projectId,
        { provider: useClaudeAPI ? 'claude' : 'gemini', targetWords }
      );

      console.log(`✅ Scene generated: -${userCost} tokens, $${apiCostUSD.toFixed(4)} API cost`);

      // Phase 3.1b: Auto-extraction (for paid users only)
      if (planConfig.allowCanonExtraction) {
        try {
          console.log('[Auto-Extract] Starting canon extraction...');

          // NOTE: Token check happens inside extractCanonFromScene via token-service
          const sceneId = req.body.sceneId;
          const projectLanguage = project.language || 'uk'; // Default to Ukrainian

          extractCanonFromScene(projectId, sceneContent, canon, uid, sceneId, projectLanguage)
              .then(result => {
                console.log(`[Auto-Extract] ✅ Extracted ${result.suggestions.length} suggestions, linked to scene ${sceneId}`);
              })
              .catch(error => {
                console.error('[Auto-Extract] ❌ Failed (non-critical):', error.message);
                // Don't fail scene generation if extraction fails
              });
        } catch (error) {
          console.error('[Auto-Extract] Error (non-critical):', error);
          // Don't fail scene generation
        }
      }

      res.status(200).json({
        success: true,
        scene: {
          title: sceneTitle,
          text: sceneContent,
          entities,
          intent: sceneIntent,
          generatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        tokensConsumed: sceneCost,
        tokensRemaining: tokensRemaining - sceneCost
      });

    } catch (error) {
      console.error('generateScene error:', error);
      res.status(500).json({ error: `Помилка генерації: ${error.message}` });
    }
  });
});

/**
 * Helper: Merge extracted suggestions into canon
 * Auto-approve mode: immediately add entities to canon
 */
async function mergeIntoCanon(projectId, suggestions) {
  const updates = {};
  const mergedEntities = [];

  // Pluralize type (character → characters, location → locations, etc.)
  const pluralize = (type) => {
    if (type.endsWith('y')) return type.slice(0, -1) + 'ies'; // factory → factories
    return type + 's'; // character → characters
  };

  for (const suggestion of suggestions) {
    const { type, action, targetId, newData } = suggestion;

    // Generate unique ID if adding new entity
    const entityId = action === 'add'
      ? `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      : targetId;

    // Add AI-extracted flag and timestamp
    const entityData = {
      ...newData,
      id: entityId,
      aiExtracted: true,
      extractedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update path in Firestore (pluralize type: character → characters)
    const pluralType = pluralize(type);
    updates[`canon.${pluralType}.${entityId}`] = entityData;
    mergedEntities.push({ type: pluralType, id: entityId, name: newData.name });
  }

  // Batch update
  if (Object.keys(updates).length > 0) {
    await db.collection('projects').doc(projectId).update(updates);
  }

  return mergedEntities; // [{type: 'characters', id: 'char_123', name: 'Marcus'}, ...]
}

/**
 * Helper: Extract canon from scene (Phase 3.1b + canonRefs linking)
 * Called asynchronously after scene generation
 * @param sceneId - Scene document ID to update with canonRefs
 */
async function extractCanonFromScene(projectId, sceneText, canon, uid, sceneId, language = 'uk') {
  try {
    // Language names mapping
    const languageNames = {
      'uk': 'Ukrainian',
      'en': 'English',
      'pl': 'Polish',
      'ru': 'Russian',
      'de': 'German',
      'es': 'Spanish',
      'fr': 'French',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ja': 'Japanese',
      'zh': 'Chinese'
    };
    const languageName = languageNames[language] || languageNames['uk'];

    // Build extraction prompt
    const systemInstruction = `You are a narrative analysis expert. Extract structured canon information from the provided scene text.

CRITICAL RULES:
1. Extract ONLY significant new facts (characters, locations, events, factions, artifacts)
2. Avoid duplicates — compare with existing canon
3. For characters: extract name, role, trait, status, location, goal, relationships
4. For locations: extract name, description, type
5. For events: extract name, description, when, participants
6. **LANGUAGE: Extract ALL entity names and descriptions in ${languageName} language.**
7. Return ONLY valid JSON, no markdown wrapping

Current Canon (for duplicate detection):
${JSON.stringify({
  characters: Object.keys(canon.characters || {}),
  locations: Object.keys(canon.locations || {}),
  events: Object.keys(canon.events || {}),
  factions: Object.keys(canon.factions || {}),
  artifacts: Object.keys(canon.artifacts || {})
}, null, 2)}`;

    const prompt = `Analyze this scene and extract canon entities:

Scene Text:
${sceneText}

Return JSON with memorySuggestions array:
{
  "memorySuggestions": [
    {
      "id": "unique_id",
      "type": "character" | "location" | "event" | "faction" | "artifact",
      "action": "add" | "update",
      "targetId": "exact_name_or_id",
      "newData": {
        // For character: name, role, trait, status, location, goal, relationships, developmentArc
        // For location: name, description, type
        // For event: name, description, when, participants
        // For faction: name, description, members
        // For artifact: name, description, owner
      },
      "reason": "Brief explanation why this is significant"
    }
  ]
}`;

    // Call Claude Haiku
    const anthropic = new Anthropic({
      apiKey: claudeApiKey.value()
    });

    const message = await anthropic.messages.create({
      model: AI_MODELS.claude.haiku,
      max_tokens: 2048,
      temperature: 0.2,
      system: systemInstruction,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    // Debug: log usage
    console.log(`[Auto-Extract] API usage:`, JSON.stringify(message.usage));
    console.log(`[Auto-Extract] Model:`, message.model);

    const responseText = message.content[0].text;

    // Parse JSON
    let suggestions = [];
    try {
      const parsed = JSON.parse(responseText);
      suggestions = parsed.memorySuggestions || [];
    } catch (parseError) {
      // Try to extract JSON from markdown
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        suggestions = parsed.memorySuggestions || [];
      } else {
        throw new Error('Failed to parse JSON response');
      }
    }

    if (suggestions.length === 0) {
      console.log('[Auto-Extract] No new entities found');
      return [];
    }

    // Auto-merge into canon (no review queue)
    const mergedEntities = await mergeIntoCanon(projectId, suggestions);

    // Phase 5.1: Charge via token-service (reads economy_operations, logs usage_logs)
    const { userCost, apiCostUSD } = await charge(
      db,
      uid,
      'extractCanon',
      message.model || AI_MODELS.claude.haiku,
      message.usage || { input_tokens: 0, output_tokens: 0 },
      projectId,
      { sceneId, provider: 'claude' }
    );

    console.log(`[Auto-Extract] ✅ Auto-merged ${mergedEntities.length} entities (-${userCost} tokens, $${apiCostUSD.toFixed(4)})`);

    // Build canonRefs from merged entities
    const canonRefs = {
      characters: [],
      locations: [],
      events: [],
      factions: [],
      artifacts: []
    };

    mergedEntities.forEach(entity => {
      if (canonRefs[entity.type]) {
        canonRefs[entity.type].push(entity.id);
      }
    });

    console.log(`[Auto-Extract] Canon refs:`, canonRefs);

    // Update scene with canonRefs (if sceneId provided)
    if (sceneId) {
      try {
        // Use set with merge to avoid race condition (client may not have created doc yet)
        await db.collection('projects')
          .doc(projectId)
          .collection('scenes')
          .doc(sceneId)
          .set({ canonRefs }, { merge: true });

        console.log(`[Auto-Extract] ✅ Updated scene ${sceneId} with canonRefs`);
      } catch (updateError) {
        console.error(`[Auto-Extract] ⚠️ Failed to update scene canonRefs:`, updateError);
        // Non-critical — extraction succeeded, linking failed
      }
    }

    return { suggestions, canonRefs };
  } catch (error) {
    console.error('[Auto-Extract] Error:', error);
    throw error;
  }
}

/**
 * Build canon context string for prompt
 */
function buildCanonContext(canon) {
  const sections = [];

  // Characters
  const chars = Object.values(canon.characters || {});
  if (chars.length > 0) {
    sections.push('**Персонажі:**\n' + chars.map(c =>
      `- ${c.name}: ${c.description || 'немає опису'}`
    ).join('\n'));
  }

  // Locations
  const locs = Object.values(canon.locations || {});
  if (locs.length > 0) {
    sections.push('**Локації:**\n' + locs.map(l =>
      `- ${l.name}: ${l.description || 'немає опису'}`
    ).join('\n'));
  }

  // Events
  const events = Object.values(canon.events || {});
  if (events.length > 0) {
    sections.push('**Події:**\n' + events.map(e =>
      `- ${e.name}: ${e.description || 'немає опису'}`
    ).join('\n'));
  }

  // Factions
  const factions = Object.values(canon.factions || {});
  if (factions.length > 0) {
    sections.push('**Фракції:**\n' + factions.map(f =>
      `- ${f.name}: ${f.description || 'немає опису'}`
    ).join('\n'));
  }

  // World
  const world = canon.world || {};
  if (Object.keys(world).length > 0 && world.description) {
    sections.push('**Всесвіт:**\n' + world.description);
  }

  return sections.length > 0 ? sections.join('\n\n') : 'Канон порожній — ти створюєш світ з нуля.';
}

/**
 * Build scene generation prompt
 */
function buildScenePrompt({ title, desc, language, genres, scope, ending, endingNote, length, dialogue, canonContext, intentDescription, previousScenes }) {
  // Map language code to full name and typography rules
  // Single source of truth for language configuration across the project
  const languageMap = {
    en: { name: 'English', quotes: '"text"', dash: '—' },
    es: { name: 'Español', quotes: '«texto»', dash: '—' },
    zh: { name: '中文', quotes: '"文本"', dash: '——' },
    hi: { name: 'हिन्दी', quotes: '"पाठ"', dash: '—' },
    ar: { name: 'العربية', quotes: '«نص»', dash: '—' },
    pt: { name: 'Português', quotes: '"texto"', dash: '—' },
    bn: { name: 'বাংলা', quotes: '"পাঠ্য"', dash: '—' },
    ru: { name: 'Русском', quotes: '«текст»', dash: '—' },
    ja: { name: '日本語', quotes: '「テキスト」', dash: '—' },
    pa: { name: 'ਪੰਜਾਬੀ', quotes: '"ਟੈਕਸਟ"', dash: '—' },
    de: { name: 'Deutsch', quotes: '„Text"', dash: '—' },
    jv: { name: 'Basa Jawa', quotes: '"teks"', dash: '—' },
    ko: { name: '한국어', quotes: '"텍스트"', dash: '—' },
    fr: { name: 'Français', quotes: '« texte »', dash: '—' },
    te: { name: 'తెలుగు', quotes: '"పాఠ్యం"', dash: '—' },
    mr: { name: 'मराठी', quotes: '"मजकूर"', dash: '—' },
    tr: { name: 'Türkçe', quotes: '"metin"', dash: '—' },
    ta: { name: 'தமிழ்', quotes: '"உரை"', dash: '—' },
    vi: { name: 'Tiếng Việt', quotes: '"văn bản"', dash: '—' },
    ur: { name: 'اردو', quotes: '«متن»', dash: '—' },
    it: { name: 'Italiano', quotes: '«testo»', dash: '—' },
    th: { name: 'ไทย', quotes: '"ข้อความ"', dash: '—' },
    gu: { name: 'ગુજરાતી', quotes: '"ટેક્સ્ટ"', dash: '—' },
    pl: { name: 'Polski', quotes: '„tekst"', dash: '–' },
    uk: { name: 'Українською', quotes: '«текст»', dash: '—' },
    fa: { name: 'فارسی', quotes: '«متن»', dash: '—' },
    ml: { name: 'മലയാളം', quotes: '"വാചകം"', dash: '—' },
    kn: { name: 'ಕನ್ನಡ', quotes: '"ಪಠ್ಯ"', dash: '—' },
    or: { name: 'ଓଡ଼ିଆ', quotes: '"ପାଠ୍ୟ"', dash: '—' },
    my: { name: 'မြန်မာ', quotes: '"စာသား"', dash: '—' },
    nl: { name: 'Nederlands', quotes: '"tekst"', dash: '—' },
    sv: { name: 'Svenska', quotes: '"text"', dash: '—' },
    he: { name: 'עברית', quotes: '«טקסט»', dash: '—' },
    el: { name: 'Ελληνικά', quotes: '«κείμενο»', dash: '—' },
    cs: { name: 'Čeština', quotes: '„text"', dash: '—' },
    ro: { name: 'Română', quotes: '„text"', dash: '—' },
    hu: { name: 'Magyar', quotes: '„szöveg"', dash: '—' },
    da: { name: 'Dansk', quotes: '»tekst«', dash: '—' },
    fi: { name: 'Suomi', quotes: '"teksti"', dash: '—' },
    no: { name: 'Norsk', quotes: '«tekst»', dash: '—' },
    sk: { name: 'Slovenčina', quotes: '„text"', dash: '—' },
    bg: { name: 'Български', quotes: '„текст"', dash: '—' },
    hr: { name: 'Hrvatski', quotes: '„tekst"', dash: '—' },
    sr: { name: 'Српски', quotes: '„текст"', dash: '—' },
    lt: { name: 'Lietuvių', quotes: '„tekstas"', dash: '—' },
    sl: { name: 'Slovenščina', quotes: '„besedilo"', dash: '—' },
    lv: { name: 'Latviešu', quotes: '„teksts"', dash: '—' },
    et: { name: 'Eesti', quotes: '„tekst"', dash: '—' },
    is: { name: 'Íslenska', quotes: '„texti"', dash: '—' },
    ga: { name: 'Gaeilge', quotes: '"téacs"', dash: '—' },
    cy: { name: 'Cymraeg', quotes: '"testun"', dash: '—' },
    mt: { name: 'Malti', quotes: '"test"', dash: '—' }
  };

  const lang = languageMap[language] || languageMap.en;

  // Convert dialogue percentage to style instruction
  let dialogueStyle;
  if (dialogue <= 15) {
    dialogueStyle = 'Майже без діалогів — фокус на розповіді, описах, внутрішніх переживаннях';
  } else if (dialogue <= 38) {
    dialogueStyle = 'Більше розповіді — діалоги лише де потрібно, основа — наратив';
  } else if (dialogue <= 62) {
    dialogueStyle = 'Збалансовано — міксуй діалоги з розповіддю природно';
  } else if (dialogue <= 82) {
    dialogueStyle = 'Більше діалогів — персонажі розмовляють часто, через репліки розкривай дії';
  } else {
    dialogueStyle = 'Діалоги ведуть сцену — майже вся сцена тримається на розмовах персонажів';
  }

  // Convert ending type to narrative direction
  let endingDirection = '';
  if (ending === 'closed') {
    endingDirection = '\n**Напрям фіналу:** Історія йде до завершеного фіналу — всі лінії мають розв\'язатися.';
  } else if (ending === 'open') {
    endingDirection = '\n**Напрям фіналу:** Відкритий фінал — історія може залишати питання, інтригу.';
  } else if (ending === 'custom' && endingNote) {
    endingDirection = `\n**Напрям фіналу:** ${endingNote}`;
  }

  let prompt = `Ти — AI-письменник для WhiteWrite, інструменту canon-aware наративної генерації.

**Проєкт:** ${title}
**Опис:** ${desc}
**Жанри:** ${genres.join(', ') || 'не вказано'}
**Масштаб:** ${scope}${endingDirection}

**Canon (авторитетна база знань про світ):**
${canonContext}

`;

  if (previousScenes.length > 0) {
    prompt += `**Попередні сцени (для continuity — дотримуйся послідовності подій і персонажів):**
${previousScenes.map((s, i) => {
      // For last 2 scenes, show full text; for earlier, show summary (500 chars)
      const isRecent = i >= previousScenes.length - 2;
      const text = isRecent ? s.text : s.text.substring(0, 500) + '...';
      return `${i + 1}. ${s.title}\n${text}`;
    }).join('\n\n')}

`;
  }

  prompt += `**Scene Intent (напрям сцени):**
${intentDescription}

**Стиль письма:**
- Довжина сцени: ~${length} слів (одна сцена, не розділ)
- Діалоги: ${dialogueStyle}

**Інструкції:**
1. Генеруй наступну сцену, яка СТРОГО ДОТРИМУЄТЬСЯ канону (не додавай нових персонажів/локацій якщо їх немає в каноні, ЯКЩО ТІЛЬКИ це не є частиною сюрпризу)
2. Сцена має бути canon-consistent — використовуй лише факти з канону
3. Якщо канон порожній — створюй світ і персонажів, але будь послідовним
4. **LANGUAGE:** Write in ${lang.name}, in the style of the project's genre
5. Format: ## Scene Title (first line), then text
6. Follow Scene Intent — this is the key direction for the scene
7. IMPORTANT: Follow the specified length (~${length} words) and dialogue style (${dialogue}% dialogue density)
8. **Typography:** Use proper quotation marks ${lang.quotes} and dash ${lang.dash}
9. **CRITICAL:** Output ONLY the scene text. NO meta-comments, NO "(Proceed to output...)", NO explanations — pure literary prose in ${lang.name}.

Згенеруй сцену:`;

  return prompt;
}

/**
 * Extract entities mentioned in scene text
 */
function extractMentionedEntities(text, canon) {
  const mentioned = [];
  const textLower = text.toLowerCase();

  // Check characters
  Object.entries(canon.characters || {}).forEach(([id, char]) => {
    if (textLower.includes(char.name.toLowerCase())) {
      mentioned.push({ type: 'character', id, name: char.name });
    }
  });

  // Check locations
  Object.entries(canon.locations || {}).forEach(([id, loc]) => {
    if (textLower.includes(loc.name.toLowerCase())) {
      mentioned.push({ type: 'location', id, name: loc.name });
    }
  });

  // Check factions
  Object.entries(canon.factions || {}).forEach(([id, faction]) => {
    if (textLower.includes(faction.name.toLowerCase())) {
      mentioned.push({ type: 'faction', id, name: faction.name });
    }
  });

  return mentioned;
}

/**
 * Cloud Function: Initialize or Update User
 *
 * Creates or updates user document with plan and tokens.
 * Called on first login or when upgrading plan.
 */
exports.initializeUser = onRequest({
  region: 'us-central1'
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

      const { plan, email, displayName } = req.body;

      // Plan limits
      const planLimits = {
        seed: { tokensMonthly: 300, maxProjects: 1 },
        storyweaver: { tokensMonthly: 2500, maxProjects: 10 },
        worldforge: { tokensMonthly: 8000, maxProjects: 999 }
      };

      const userPlan = plan || 'seed';
      const limits = planLimits[userPlan] || planLimits.seed;

      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        // Create new user
        await userRef.set({
          email: email || '',
          displayName: displayName || 'User',
          plan: userPlan,
          tokens: limits.tokensMonthly,
          tokensMonthly: limits.tokensMonthly,
          maxProjects: limits.maxProjects,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✓ User ${uid} initialized with plan: ${userPlan}`);
      } else {
        // Update existing user (plan change)
        if (plan) {
          const userData = userDoc.data();

          // Protect paid plans - require active subscription
          // TODO: Re-enable when Stripe is fully configured
          // if (userPlan !== 'seed' && userData.subscriptionStatus !== 'active') {
          //   res.status(403).json({
          //     error: 'Активна підписка необхідна для зміни плану',
          //     requiresSubscription: true
          //   });
          //   return;
          // }

          await userRef.update({
            plan: userPlan,
            tokensMonthly: limits.tokensMonthly,
            maxProjects: limits.maxProjects,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✓ User ${uid} plan updated to: ${userPlan}`);
        }
      }

      const userData = (await userRef.get()).data();
      res.status(200).json({ success: true, user: userData });

    } catch (error) {
      console.error('initializeUser error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// ============================================================================
// Phase 2: Stripe Integration
// ============================================================================

const STRIPE_PRICE_IDS = {
  storyteller: 'price_1Tj4eVK1XPrHbpbZrmiMvCwh',
  novelist: 'price_1Tj4fBK1XPrHbpbZyhlAANxB',
  worldbuilder: 'price_1Tj5PZK1XPrHbpbZJ8LpKik0'
};

/**
 * Create Stripe Checkout Session
 * Called from UI when user clicks "Обрати" plan button
 */
exports.createCheckoutSession = onRequest({ secrets: [stripeSecretKey] }, async (req, res) => {
  cors(req, res, async () => {
    try {
      const stripe = require('stripe')(stripeSecretKey.value());
      const { plan, uid, email } = req.body;

      if (!plan || !uid || !email) {
        res.status(400).json({ error: 'Missing required fields: plan, uid, email' });
        return;
      }

      const priceId = STRIPE_PRICE_IDS[plan];
      if (!priceId) {
        res.status(400).json({ error: 'Invalid plan: ' + plan });
        return;
      }

      console.log(`Creating checkout session for ${email}, plan: ${plan}`);

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1
        }],
        customer_email: email,
        client_reference_id: uid, // Link to Firebase user
        metadata: {
          plan: plan,
          uid: uid
        },
        success_url: 'https://whitewrite-app.web.app/#account?success=1',
        cancel_url: 'https://whitewrite-app.web.app/#account?canceled=1',
        allow_promotion_codes: true,
        billing_address_collection: 'required'
      });

      console.log('Checkout session created:', session.id);
      res.status(200).json({ url: session.url });

    } catch (error) {
      console.error('createCheckoutSession error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * Stripe Webhook Handler
 * Listens to subscription events and updates user plan in Firestore
 */
exports.stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const stripe = require('stripe')(stripeSecretKey.value());
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      stripeWebhookSecret.value()
    );

    console.log('Webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.client_reference_id || session.metadata?.uid;
        const plan = session.metadata?.plan;

        if (!uid || !plan) {
          console.error('Missing uid or plan in checkout session:', session.id);
          break;
        }

        console.log(`Checkout completed: ${uid} → ${plan}`);

        // Update user plan in Firestore
        await db.collection('users').doc(uid).update({
          plan: plan,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`User ${uid} upgraded to ${plan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by stripeCustomerId
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (userSnapshot.empty) {
          console.error('No user found for customer:', customerId);
          break;
        }

        const userDoc = userSnapshot.docs[0];
        const uid = userDoc.id;

        // Check subscription status
        if (subscription.status === 'active') {
          console.log(`Subscription updated for ${uid}: ${subscription.id}`);
        } else {
          console.log(`Subscription ${subscription.status} for ${uid}`);
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by stripeCustomerId
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (userSnapshot.empty) {
          console.error('No user found for customer:', customerId);
          break;
        }

        const userDoc = userSnapshot.docs[0];
        const uid = userDoc.id;

        console.log(`Subscription canceled for ${uid}, downgrading to free`);

        // Downgrade to free plan
        await db.collection('users').doc(uid).update({
          plan: 'free',
          stripeSubscriptionId: null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

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
      const uid = req.body.uid || (req.headers.authorization ? await verifyAuth(req.headers.authorization) : null);
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

      const canon = project.canon || {
        characters: {},
        locations: {},
        events: {},
        factions: {},
        artifacts: {},
        world: {}
      };

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
      const tokensBudget = userData.tokensMonthly || planConfig.monthly;
      const tokensUsed = userData.tokensUsed || 0;
      const tokensRemaining = tokensBudget - tokensUsed;

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
          const result = await extractCanonFromScene(projectId, sceneText, canon, uid, sceneId);

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
      const uid = req.body.uid || (req.headers.authorization ? await verifyAuth(req.headers.authorization) : null);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId, sceneText } = req.body;

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
      const tokensBudget = userData.tokensMonthly || planConfig.monthly;
      const tokensUsed = userData.tokensUsed || 0;
      const tokensRemaining = tokensBudget - tokensUsed;

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

      const canon = projectDoc.data().canon || {
        characters: {},
        locations: {},
        events: {},
        factions: {},
        artifacts: {},
        world: {}
      };

      // Build analysis prompt (inspired by White-Tree)
      const systemInstruction = `You are a narrative analysis expert. Perform a complete diagnostic of the provided scene text.

CRITICAL ANALYSIS TASKS:
1. Consistency Check: Compare text against canon. Identify contradictions.
2. Narrative Diagnostic: Provide scores (0-10), strengths, weaknesses, suggestions.
3. Tension Analysis: Break down narrative into 6-8 segments and evaluate tension (0-10) for each.
4. Quick Fixes: Suggest specific inline improvements (original → suggested).

SCORING GUIDELINES (0-10):
- 0-3: Critical issues. 4-6: Functional but lacking. 7-8: Good. 9-10: Exceptional.

Return ONLY valid JSON, no markdown wrapping.

Canon Context:
- Characters: ${Object.keys(canon.characters || {}).join(', ') || 'None'}
- Locations: ${Object.keys(canon.locations || {}).join(', ') || 'None'}
- Events: ${Object.keys(canon.events || {}).join(', ') || 'None'}`;

      const prompt = `Analyze this scene:

${sceneText}

Return JSON:
{
  "score": <number 0-10>,
  "detailedScores": {
    "plot": <number 0-10>,
    "characters": <number 0-10>,
    "conflict": <number 0-10>,
    "atmosphere": <number 0-10>,
    "dialogue": <number 0-10>,
    "style": <number 0-10>
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"],
  "consistencyIssues": [
    {
      "type": "character" | "timeline" | "location" | "event" | "logic",
      "description": "Issue description",
      "contradiction": "What contradicts what"
    }
  ],
  "tensionAnalysis": [
    {
      "segment": "Brief segment description",
      "level": <number 0-10>,
      "pacing": "slow" | "moderate" | "fast",
      "note": "Why this tension level"
    }
  ],
  "quickFixes": [
    {
      "original": "Original text snippet",
      "suggested": "Suggested replacement",
      "reason": "Why this improves the text"
    }
  ]
}`;

      // Call Claude Opus (expensive, high quality)
      console.log('[Analyze] Using Claude Opus for narrative analysis');

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

      console.log(`[Analyze] ✅ Analysis complete (score: ${analysis.score}/10, -${userCost} tokens, $${apiCostUSD.toFixed(4)})`);

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

      const canon = projectDoc.data().canon || {
        characters: {},
        locations: {},
        events: {},
        factions: {},
        artifacts: {}
      };

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

/**
 * Phase 4: Seed Economy Operations
 *
 * One-time setup to populate economy_operations collection with token costs.
 * Makes prices data-driven instead of magic numbers.
 *
 * Usage: Call once via Firebase Console or curl
 */
exports.seedEconomy = onRequest({
  region: 'us-central1',
  timeoutSeconds: 60
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      const operations = {
        generateScene: {
          name: 'Scene Generation',
          providers: {
            gemini: { cost: 20, model: 'gemini-2.0-flash-exp' },
            claude: { cost: 300, model: 'claude-opus-4-20250514' }
          }
        },
        extractCanon: {
          name: 'Canon Extraction',
          providers: {
            claude: { cost: 15, model: AI_MODELS.claude.haiku }
          }
        },
        analyzeScene: {
          name: 'Scene Analysis',
          providers: {
            claude: { cost: 50, model: AI_MODELS.claude.sonnet }
          }
        }
      };

      const batch = db.batch();
      Object.entries(operations).forEach(([opId, opData]) => {
        const ref = db.collection('economy_operations').doc(opId);
        batch.set(ref, opData);
      });

      await batch.commit();

      console.log('[seedEconomy] ✅ Seeded economy_operations');

      res.status(200).json({
        success: true,
        seeded: Object.keys(operations)
      });

    } catch (error) {
      console.error('[seedEconomy] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// ============================================================================
// MIGRATION: Add margin architecture to economy_operations
// ============================================================================
// One-time migration function: adds baseTokens + marginMultiplier to economy_operations
// Also creates economy_config/global with globalMarginMultiplier
// Call once via: https://us-central1-whitewrite-app.cloudfunctions.net/migrateMargin

// Debug function: Check current globalMarginMultiplier
exports.checkMargin = onRequest({
  region: 'us-central1',
  timeoutSeconds: 10
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      const globalDoc = await db.collection('economy_config').doc('global').get();

      if (!globalDoc.exists) {
        return res.json({ error: 'economy_config/global not found' });
      }

      const data = globalDoc.data();

      res.json({
        success: true,
        globalMarginMultiplier: data.globalMarginMultiplier,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        allData: data
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Migration: Add word-based pricing (tokensPer100Words)
exports.migrateWordPricing = onRequest({
  region: 'us-central1',
  timeoutSeconds: 60
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      console.log('=== Word-Based Pricing Migration ===\n');

      // Update generateScene with tokensPer100Words
      const sceneDoc = await db.collection('economy_operations').doc('generateScene').get();

      if (!sceneDoc.exists) {
        return res.status(404).json({ error: 'generateScene operation not found' });
      }

      const data = sceneDoc.data();

      // Add tokensPer100Words for each provider
      if (data.providers.claude) {
        data.providers.claude.tokensPer100Words = 150; // ~150 tokens per 100 words output
        console.log('  ✓ claude.tokensPer100Words = 150');
      }

      if (data.providers.gemini) {
        data.providers.gemini.tokensPer100Words = 20; // ~20 tokens per 100 words (cheaper)
        console.log('  ✓ gemini.tokensPer100Words = 20');
      }

      await sceneDoc.ref.update({ providers: data.providers });

      console.log('  ✅ generateScene updated with word-based pricing\n');

      res.json({
        success: true,
        message: 'Word-based pricing migrated',
        providers: {
          claude: { tokensPer100Words: data.providers.claude.tokensPer100Words },
          gemini: { tokensPer100Words: data.providers.gemini.tokensPer100Words }
        }
      });
    } catch (error) {
      console.error('Migration failed:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Migration: Add cost-based pricing (tokenToUSD + estimatedCostPer700Words)
// Phase 6.1: Transition from word-based to cost-based pricing
exports.migrateCostPricing = onRequest({
  region: 'us-central1',
  timeoutSeconds: 60
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // 1. Add tokenToUSD to economy_config/global
      await db.collection('economy_config').doc('global').update({
        tokenToUSD: 0.01,  // 1 token = 1 cent ($0.01)
        globalMarginMultiplier: 5.0,  // ×5 markup
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 2. Add estimatedCostPer700Words to economy_operations/generateScene
      const sceneDoc = await db.collection('economy_operations').doc('generateScene').get();
      if (!sceneDoc.exists) {
        throw new Error('generateScene operation not found');
      }

      const data = sceneDoc.data();

      // Add estimatedCostPer700Words (conservative, NO CACHE)
      data.providers.claude.estimatedCostPer700Words = 0.03;  // $0.03 per 700 words (no cache)
      data.providers.gemini.estimatedCostPer700Words = 0.001; // $0.001 per 700 words

      // Update marginMultipliers
      data.providers.claude.marginMultiplier = 1.5;  // +50% for quality
      data.providers.gemini.marginMultiplier = 1.0;  // baseline

      await sceneDoc.ref.update({ providers: data.providers });

      // 3. Same for extractCanon (always Claude)
      const extractDoc = await db.collection('economy_operations').doc('extractCanon').get();
      if (extractDoc.exists) {
        const extractData = extractDoc.data();
        extractData.providers.claude.estimatedCostPer700Words = 0.01;  // $0.01 per extraction
        extractData.providers.claude.marginMultiplier = 1.0;  // baseline
        await extractDoc.ref.update({ providers: extractData.providers });
      }

      res.json({
        success: true,
        message: 'Cost-based pricing migrated',
        config: {
          tokenToUSD: 0.01,
          globalMarginMultiplier: 5.0,
          generateScene: {
            claude: {
              estimatedCostPer700Words: 0.03,
              marginMultiplier: 1.5
            },
            gemini: {
              estimatedCostPer700Words: 0.001,
              marginMultiplier: 1.0
            }
          }
        }
      });
    } catch (error) {
      console.error('Migration failed:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// Set globalMarginMultiplier (for demo)
exports.setMargin = onRequest({
  region: 'us-central1',
  timeoutSeconds: 10
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      const newMargin = parseFloat(req.query.value || req.body?.value || 1.0);

      if (isNaN(newMargin) || newMargin <= 0) {
        return res.status(400).json({ error: 'Invalid margin value (must be positive number)' });
      }

      await db.collection('economy_config').doc('global').update({
        globalMarginMultiplier: newMargin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`✅ globalMarginMultiplier updated: ${newMargin}`);

      res.json({
        success: true,
        globalMarginMultiplier: newMargin,
        message: `Margin updated to ${newMargin}`
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

exports.migrateMargin = onRequest({
  region: 'us-central1',
  timeoutSeconds: 60
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      console.log('=== Margin Architecture Migration ===\n');

      // 1. Migrate economy_operations
      const operations = ['generateScene', 'extractCanon', 'analyzeScene'];
      const updates = [];

      for (const operation of operations) {
        console.log(`Migrating ${operation}...`);

        const opDoc = await db.collection('economy_operations').doc(operation).get();

        if (!opDoc.exists) {
          console.warn(`  ⚠️ ${operation} not found, skipping`);
          continue;
        }

        const data = opDoc.data();
        let updated = false;

        // Update each provider (claude, gemini)
        for (const provider of ['claude', 'gemini']) {
          if (data.providers && data.providers[provider]) {
            const providerData = data.providers[provider];

            // Add baseTokens (from existing 'cost' field)
            if (!providerData.baseTokens && providerData.cost) {
              providerData.baseTokens = providerData.cost;
              updated = true;
              console.log(`  ✓ ${provider}.baseTokens = ${providerData.cost} (from cost)`);
            }

            // Add marginMultiplier (default 1.0)
            if (!providerData.marginMultiplier) {
              providerData.marginMultiplier = 1.0;
              updated = true;
              console.log(`  ✓ ${provider}.marginMultiplier = 1.0`);
            }
          }
        }

        if (updated) {
          await opDoc.ref.update({ providers: data.providers });
          console.log(`  ✅ ${operation} migrated\n`);
          updates.push(operation);
        } else {
          console.log(`  → ${operation} already has margin fields\n`);
        }
      }

      // 2. Create economy_config/global
      console.log('Creating economy_config/global...');

      const globalDoc = await db.collection('economy_config').doc('global').get();

      if (!globalDoc.exists) {
        await db.collection('economy_config').doc('global').set({
          globalMarginMultiplier: 1.0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('  ✅ economy_config/global created (globalMarginMultiplier: 1.0)\n');
      } else {
        const globalData = globalDoc.data();
        if (!globalData.globalMarginMultiplier) {
          await globalDoc.ref.update({
            globalMarginMultiplier: 1.0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log('  ✅ globalMarginMultiplier added (1.0)\n');
        } else {
          console.log(`  → economy_config/global already exists (globalMarginMultiplier: ${globalData.globalMarginMultiplier})\n`);
        }
      }

      console.log('=== Migration Complete ===');

      res.status(200).json({
        success: true,
        message: 'Margin architecture migrated successfully',
        updated: updates
      });

    } catch (error) {
      console.error('Migration failed:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
});

