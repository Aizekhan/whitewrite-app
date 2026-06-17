const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true }); // Enable CORS for all origins
const Anthropic = require('@anthropic-ai/sdk');

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

      // Calculate scene cost based on AI provider (CRITICAL: Claude costs 15x more than Gemini!)
      const sceneCost = useClaudeAPI ? 300 : 20;

      console.log(`User plan: ${userPlan}, tokens: ${tokensRemaining}/${tokensBudget}, AI: ${useClaudeAPI ? 'Claude Opus 4' : 'Gemini 2.5 Flash'}, cost: ${sceneCost} tokens`);

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

      // Generate scene using Claude or Gemini based on plan
      if (useClaudeAPI) {
        // CLAUDE API (Worldforge plan)
        try {
          console.log('Using Claude API (claude-opus-4-8)');

          const anthropic = new Anthropic({
            apiKey: claudeApiKey.value()
          });

          const message = await anthropic.messages.create({
            model: 'claude-opus-4-8',
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: prompt
            }]
          });

          sceneText = message.content[0].text;

          // Validate minimum length
          if (sceneText.length < 500) {
            throw new Error(`Scene too short (${sceneText.length} chars) - likely incomplete`);
          }

          console.log(`✓ Claude succeeded (${sceneText.length} chars, stop_reason: ${message.stop_reason})`);
        } catch (error) {
          console.error('✗ Claude failed:', error.message);
          lastError = error;
        }
      } else {
        // GEMINI API (Seed / Storyweaver plans)
        const apiKey = geminiApiKey.value();

        // Try models with fallback (REST API v1, 2026 models)
        // NOTE: gemini-3.5-flash removed - has lower token limits and unreliable output
        const modelNames = [
          'gemini-2.5-flash',   // Stable, tested (4096 tokens works)
          'gemini-2.0-flash'    // Legacy fallback
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

      // Deduct tokens from user's budget (server-side, authoritative)
      await db.collection('users').doc(uid).update({
        tokensUsed: admin.firestore.FieldValue.increment(sceneCost)
      });

      console.log(`✅ Tokens deducted: -${sceneCost} (${tokensRemaining - sceneCost} remaining)`);

      // Phase 3.1b: Auto-extraction (for paid users only)
      if (planConfig.allowCanonExtraction) {
        try {
          console.log('[Auto-Extract] Starting canon extraction...');

          const extractionCost = 15; // canonExtractPerScene
          const tokensAfterScene = tokensRemaining - sceneCost;

          if (tokensAfterScene >= extractionCost) {
            // Call extraction in background (async, don't await)
            extractCanonFromScene(projectId, sceneContent, canon, uid, extractionCost)
              .then(suggestions => {
                console.log(`[Auto-Extract] ✅ Extracted ${suggestions.length} suggestions`);
              })
              .catch(error => {
                console.error('[Auto-Extract] ❌ Failed (non-critical):', error.message);
                // Don't fail scene generation if extraction fails
              });
          } else {
            console.warn(`[Auto-Extract] ⚠️ Skipped — insufficient tokens (${tokensAfterScene} < ${extractionCost})`);
          }
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
 * Helper: Extract canon from scene (Phase 3.1b)
 * Called asynchronously after scene generation
 */
async function extractCanonFromScene(projectId, sceneText, canon, uid, extractionCost) {
  try {
    // Build extraction prompt
    const systemInstruction = `You are a narrative analysis expert. Extract structured canon information from the provided scene text.

CRITICAL RULES:
1. Extract ONLY significant new facts (characters, locations, events, factions, artifacts)
2. Avoid duplicates — compare with existing canon
3. For characters: extract name, role, trait, status, location, goal, relationships
4. For locations: extract name, description, type
5. For events: extract name, description, when, participants
6. Return ONLY valid JSON, no markdown wrapping

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
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      temperature: 0.2,
      system: systemInstruction,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

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

    // Generate scene ID (timestamp-based)
    const sceneId = `scene_${Date.now()}`;

    // Store in inferredCanon queue
    await db.collection('projects').doc(projectId).update({
      [`inferredCanon.${sceneId}`]: {
        suggestions,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    // Deduct extraction tokens
    await db.collection('users').doc(uid).update({
      tokensUsed: admin.firestore.FieldValue.increment(extractionCost)
    });

    console.log(`[Auto-Extract] ✅ Stored ${suggestions.length} suggestions in inferredCanon.${sceneId}`);

    return suggestions;
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
function buildScenePrompt({ title, desc, genres, scope, ending, endingNote, length, dialogue, canonContext, intentDescription, previousScenes }) {
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
4. Пиши українською, у стилі жанру проєкту
5. Формат: ## Назва сцени (перший рядок), далі текст
6. Дотримуйся Scene Intent — це ключовий напрям сцени
7. ВАЖЛИВО: дотримуйся вказаної довжини (~${length} слів) та стилю діалогів (${dialogue}% діалогів)
8. **Типографіка:** Використовуй українські лапки «текст», довге тире —, неразривні пробіли (в місті, з нами)
9. **КРИТИЧНО:** Виводь ТІЛЬКИ текст сцени. БЕЗ метакоментарів, БЕЗ "(Proceed to output...)", БЕЗ пояснень — лише чиста художня проза українською мовою.

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
 * Cloud Function: Extract Memory Suggestions from Scene
 * Phase 3.1a: Canon auto-extraction (inspired by White-Tree)
 *
 * Input: { projectId, sceneId, sceneText }
 * Output: { success: true, suggestions: [...], tokensConsumed: 15 }
 *
 * Uses Claude Haiku (cheap, fast) with JSON mode
 */
exports.extractMemorySuggestions = onRequest({
  secrets: [claudeApiKey],
  cors: true
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Auth check
      const uid = req.body.uid || (req.headers.authorization ? await verifyAuth(req.headers.authorization) : null);
      if (!uid) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId, sceneId, sceneText } = req.body;

      if (!projectId || !sceneId || !sceneText) {
        return res.status(400).json({ error: 'Missing required fields: projectId, sceneId, sceneText' });
      }

      // Get user plan
      const userDoc = await db.collection('users').doc(uid).get();
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const userPlan = userData.plan || 'free';
      const planConfig = getPlanBudget(userPlan);

      // Check if canon extraction is allowed
      if (!planConfig.allowCanonExtraction) {
        return res.status(403).json({
          error: 'Canon extraction не доступний на вашому плані. Upgrade до Storyteller або вище.'
        });
      }

      // Check token budget
      const tokensBudget = userData.tokensMonthly || planConfig.monthly;
      const tokensUsed = userData.tokensUsed || 0;
      const tokensRemaining = tokensBudget - tokensUsed;
      const extractionCost = 15; // canonExtractPerScene

      if (tokensRemaining < extractionCost) {
        return res.status(402).json({
          error: `Недостатньо токенів. Потрібно: ${extractionCost}, є: ${tokensRemaining}`
        });
      }

      // Load current canon
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

      // Build extraction prompt (inspired by White-Tree)
      const systemInstruction = `You are a narrative analysis expert. Extract structured canon information from the provided scene text.

CRITICAL RULES:
1. Extract ONLY significant new facts (characters, locations, events, factions, artifacts)
2. Avoid duplicates — compare with existing canon
3. For characters: extract name, role, trait, status, location, goal, relationships
4. For locations: extract name, description, type
5. For events: extract name, description, when, participants
6. Return ONLY valid JSON, no markdown wrapping

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

      // Call Claude Haiku (cheap & fast)
      console.log('[Extract] Using Claude Haiku for canon extraction');

      const anthropic = new Anthropic({
        apiKey: claudeApiKey.value()
      });

      const message = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',  // Cheapest model
        max_tokens: 2048,
        temperature: 0.2,  // Low temperature for accuracy
        system: systemInstruction,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const responseText = message.content[0].text;

      // Parse JSON
      let suggestions = [];
      try {
        const parsed = JSON.parse(responseText);
        suggestions = parsed.memorySuggestions || [];
      } catch (parseError) {
        console.error('[Extract] JSON parse failed:', parseError);
        // Try to extract JSON from markdown
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          suggestions = parsed.memorySuggestions || [];
        } else {
          throw new Error('Failed to parse JSON response');
        }
      }

      console.log(`[Extract] ✅ Extracted ${suggestions.length} suggestions`);

      // Deduct tokens
      await db.collection('users').doc(uid).update({
        tokensUsed: admin.firestore.FieldValue.increment(extractionCost)
      });

      res.status(200).json({
        success: true,
        suggestions,
        tokensConsumed: extractionCost,
        tokensRemaining: tokensRemaining - extractionCost
      });

    } catch (error) {
      console.error('[Extract] Error:', error);
      res.status(500).json({ error: `Помилка extraction: ${error.message}` });
    }
  });
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

      // Calculate cost
      const extractionCostPerScene = 15;
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
          const sceneId = `scene_${Date.now()}_${i}`;
          const suggestions = await extractCanonFromScene(projectId, sceneText, canon, uid, extractionCostPerScene);

          console.log(`[Sync] ✅ Scene ${i + 1}/${scenes.length} — ${suggestions.length} suggestions`);
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

