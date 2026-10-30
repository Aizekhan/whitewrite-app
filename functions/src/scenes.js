// Scene generation (canon-aware) + prompt helpers
const {
  onRequest,
  admin,
  db,
  cors,
  Anthropic,
  AI_MODELS,
  charge,
  getBalance,
  reserve,
  refund,
  getPlanBudget,
  loadCanon,
  geminiApiKey,
  claudeApiKey,
} = require('./common');
const { extractCanonFromScene } = require('./canon-extract');


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
    let uid;
    let reservation = null; // token reservation (refunded if generation fails)
    try {
      // Only allow POST
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const { projectId, sceneIntent, customIntent } = req.body;

      // Cap client-supplied history (fixed price ⇒ bounded prompt): last 10 scenes, 8000 chars each
      const MAX_PREV_SCENES = 10;
      const MAX_PREV_SCENE_CHARS = 8000;
      const previousScenes = (Array.isArray(req.body.previousScenes) ? req.body.previousScenes : [])
        .slice(-MAX_PREV_SCENES)
        .map(s => ({
          title: String(s?.title || '').slice(0, 200),
          text: String(s?.text || '').slice(0, MAX_PREV_SCENE_CHARS)
        }));

      // Get auth token from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Потрібна автентифікація' });
        return;
      }

      // Verify Firebase auth token
      const token = authHeader.split('Bearer ')[1];
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
      const estimatedBasicInputTokens = Math.ceil(estimatedInputChars / 4); // ~4 chars per token

      if (estimatedBasicInputTokens > MAX_TOTAL_INPUT_TOKENS) {
        console.warn(`[generateScene] Rejected: combined input too large (est. ${estimatedBasicInputTokens} tokens)`);
        res.status(400).json({
          error: `Сукупний розмір тексту задовгий (≈${estimatedBasicInputTokens} токенів). Максимум: ${MAX_TOTAL_INPUT_TOKENS} токенів. Скоротіть опис всесвіту або свій напрям.`,
          code: 'INPUT_TOO_LONG'
        });
        return;
      }

      // Load user data to check plan (Phase 1.1: Token Budget System)
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userPlan = userData.plan || 'free'; // default: free tier
      const planConfig = getPlanBudget(userPlan);
      const balance = getBalance(userData);
      const tokensBudget = balance.monthly;
      const tokensRemaining = balance.available;

      // Determine which AI to use (Phase 1.3: Feature Gates)
      const useClaudeAPI = planConfig.allowClaude;

      // Phase 4: Read token cost from economy_operations (data-driven pricing)
      // SIMPLE MODEL: providers.{provider}.cost = FINAL user token price (no formula)
      // Change price without deploy: update Firestore economy_operations/generateScene
      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const economyData = economyDoc.exists ? economyDoc.data() : null;

      let sceneCost = 20; // fallback (if Firestore unavailable)
      let providerModel = 'gemini-2.5-flash'; // fallback

      if (economyData && economyData.providers) {
        if (useClaudeAPI && economyData.providers.claude) {
          sceneCost = economyData.providers.claude.cost;  // ← SINGLE SOURCE OF TRUTH (e.g. 300)
          providerModel = economyData.providers.claude.model;
        } else if (economyData.providers.gemini) {
          sceneCost = economyData.providers.gemini.cost;  // ← SINGLE SOURCE OF TRUTH (e.g. 20)
          providerModel = economyData.providers.gemini.model;
        }
      }

      console.log(`User plan: ${userPlan}, tokens: ${tokensRemaining}/${tokensBudget}, AI: ${useClaudeAPI ? 'Claude' : 'Gemini'} (${providerModel}), cost: ${sceneCost} tokens`);

      // HARD STOP: Block generation at 0 tokens (no overdraft, no fallback to paid API key)
      if (tokensRemaining <= 0) {
        console.warn(`[generateScene] HARD STOP: User ${uid} has 0 tokens (plan: ${userPlan})`);
        res.status(403).json({
          error: 'Токени закінчились. Оновіть план або дочекайтесь наступного місяця.',
          tokensRemaining: 0,
          tokensNeeded: sceneCost,
          plan: userPlan,
          code: 'OUT_OF_TOKENS'
        });
        return;
      }

      // Check if user can afford this specific operation
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
      if (userPlan !== 'free' && userPlan !== 'seed' && userData.subscriptionStatus !== 'active') {
        res.status(403).json({
          error: 'Активна підписка необхідна для генерації',
          requiresSubscription: true,
          plan: userPlan
        });
        return;
      }

      // Atomically reserve tokens before the AI call (settled in charge(), refunded on failure)
      try {
        reservation = await reserve(db, uid, sceneCost);
      } catch (error) {
        if (error.code !== 'OUT_OF_TOKENS') throw error;
        res.status(403).json({
          error: 'Недостатньо токенів для генерації',
          tokensRemaining: error.available,
          tokensNeeded: sceneCost,
          plan: userPlan,
          code: 'OUT_OF_TOKENS'
        });
        return;
      }

      // Load canon from the project's world (lazy-migrates legacy project.canon)
      const { worldId, canon } = await loadCanon(db, projectId, project, uid);

      // Build canon context for prompt
      const canonContext = buildCanonContext(canon);

      // Map scene intent to DIRECTIVE instructions (command, not description)
      const intentMap = {
        conflict: 'КОНФЛІКТ: Створи напругу між персонажами або силами. Покажи протистояння, суперечності, загострення. Хтось має чогось хотіти, а щось/хтось цьому заважає.',
        character: 'РОЗВИТОК ПЕРСОНАЖА: Покажи внутрішні зміни героя. Він приймає рішення, змінює думку, розкриває нові грані особистості, долає внутрішні суперечності.',
        action: 'ЕКШН: Сцена має бути динамічною. Персонажі рухаються, діють, борються, тікають, переслідують. Мінімум роздумів — максимум фізичної дії.',
        romance: 'РОМАНТИКА: Покажи емоційну близькість між персонажами. Хімія, напруга, зв\'язок. Момент, коли відносини поглиблюються або змінюються.',
        world: 'СВІТОБУДОВА: Розкрий деталі всесвіту. Покажи як працює магія/технологія, культуру, історію, географію. Читач має дізнатись щось нове про світ.',
        worldbuilding: 'СВІТОБУДОВА: Розкрий деталі всесвіту. Покажи як працює магія/технологія, культуру, історію, географію. Читач має дізнатись щось нове про світ.',
        twist: 'ПОВОРОТ: Зроби несподіваний поворот в історії. Розкрий щось несподіване про персонажа або ситуацію. Підірви очікування читача раптовим твістом.',
        surprise: 'СЮРПРИЗ ВІД AI: Обери несподіваний напрям на свій розсуд. Здивуй і автора, і читача. Твіст, несподівана дія, або зміна тону — що завгодно цікаве.',
        parallel: 'ПАРАЛЕЛЬНА СЮЖЕТНА ЛІНІЯ: Переключись на іншого персонажа або іншу локацію. Покажи що відбувається в цей же час в іншому місці. POV switch — інша точка зору на події.',
        'new-character': 'НОВИЙ ПЕРСОНАЖ: Введи нового персонажа в історію. Дай йому яскраву появу, мотивацію, конфлікт з існуючими героями. Персонаж має бути memorable.',
        custom: customIntent || 'Вільний напрям — діяти за власним розсудом'
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
        previousScenes,
        sceneIntent,
        customIntent
      });

      // Phase 6.2: Estimate input tokens for pricing (prompt size affects cost)
      // ~4 chars per token (conservative estimate)
      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      console.log(`[generateScene] Estimated input: ${prompt.length} chars ≈ ${estimatedInputTokens} tokens`);

      let sceneText = null;
      let lastError = null;
      let apiUsage = null; // Phase 4.1: Track real API usage
      let actualModel = null; // Phase 4.1: Track actual model used

      // Generate scene using Claude or Gemini based on plan
      if (useClaudeAPI) {
        // CLAUDE API - all Claude plans use Sonnet (worldbuilder differentiated by budget + features)
        const claudeModel = AI_MODELS.claude.sonnet;

        try {
          console.log(`Using Claude API (${claudeModel})`);

          const anthropic = new Anthropic({
            apiKey: claudeApiKey.value()
          });

          const message = await anthropic.messages.create({
            model: claudeModel,
            max_tokens: 4096,
            messages: [{
              role: 'user',
              content: prompt
            }]
          });

          sceneText = message.content[0].text;

          // Phase 4.1: Capture real API usage + model
          apiUsage = message.usage; // { input_tokens, output_tokens, cache_* }
          actualModel = message.model || claudeModel; // Claude returns model in response

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

      // Phase 6.2: Charge via token-service (includes input + output cost)
      const targetWords = project.length || 700; // From project settings
      const { userCost, apiCostUSD } = await charge(
        db,
        uid,
        'generateScene',
        actualModel || providerModel,
        apiUsage || { input_tokens: 0, output_tokens: 0 },
        projectId,
        { provider: useClaudeAPI ? 'claude' : 'gemini', targetWords, estimatedInputTokens, reserved: reservation }
      );
      reservation = null; // settled

      console.log(`✅ Scene generated: -${userCost} tokens, $${apiCostUSD.toFixed(4)} API cost`);

      // Phase 3.1b: Auto-extraction (for paid users only)
      if (planConfig.allowCanonExtraction) {
        try {
          console.log('[Auto-Extract] Starting canon extraction...');

          // NOTE: Token check happens inside extractCanonFromScene via token-service
          const sceneId = req.body.sceneId;
          const projectLanguage = project.language || 'uk'; // Default to Ukrainian

          extractCanonFromScene(projectId, worldId, sceneContent, canon, uid, sceneId, projectLanguage)
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
        tokensConsumed: userCost,
        tokensRemaining: tokensRemaining - userCost
      });

    } catch (error) {
      console.error('generateScene error:', error);
      if (reservation) {
        await refund(db, uid, reservation).catch(e => console.error('[generateScene] Refund failed:', e));
      }
      res.status(500).json({ error: `Помилка генерації: ${error.message}` });
    }
  });
});


/**
 * Build canon context string for prompt
 */
function buildCanonContext(canon) {
  const sections = [];
  const world = canon.world || {};
  // Entities come from two writers: AI extraction (name/description/trait…) and
  // the WorldTree editor (title/desc/motivation…) — read both.
  const nameOf = (x) => x.name || x.title || 'без назви';
  const descOf = (x) => x.description || x.desc || x.motivation ||
    [x.role, x.trait, x.goal].filter(Boolean).join('; ') || 'немає опису';
  // Current state = state at the end of the latest scene (continuity)
  const stateOf = (x) => {
    const parts = [x.status && `статус: ${x.status}`, x.location && `де: ${x.location}`].filter(Boolean);
    return parts.length ? ` [зараз — ${parts.join('; ')}]` : '';
  };

  // World — summary, facts, and laws first: they frame everything below
  const worldText = world.summary || world.description;
  if (worldText) {
    sections.push('**Всесвіт:**\n' + worldText);
  }
  const facts = (world.facts || []).filter(f => f && f.k && f.v);
  if (facts.length > 0) {
    sections.push('**Факти світу:**\n' + facts.map(f => `- ${f.k}: ${f.v}`).join('\n'));
  }
  const rules = (world.rules || []).map(r => String(r).trim()).filter(Boolean);
  if (rules.length > 0) {
    sections.push('**ЗАКОНИ СВІТУ (непорушні — фізика цього всесвіту):**\n' + rules.map((r, i) => `${i + 1}. ${r}`).join('\n'));
  }

  // Characters
  const chars = Object.values(canon.characters || {});
  if (chars.length > 0) {
    sections.push('**Персонажі:**\n' + chars.map(c =>
      `- ${nameOf(c)}: ${descOf(c)}${stateOf(c)}`
    ).join('\n'));
  }

  // Locations
  const locs = Object.values(canon.locations || {});
  if (locs.length > 0) {
    sections.push('**Локації:**\n' + locs.map(l =>
      `- ${nameOf(l)}: ${descOf(l)}`
    ).join('\n'));
  }

  // Events
  const events = Object.values(canon.events || {});
  if (events.length > 0) {
    sections.push('**Події:**\n' + events.map(e =>
      `- ${nameOf(e)}: ${descOf(e)}`
    ).join('\n'));
  }

  // Factions
  const factions = Object.values(canon.factions || {});
  if (factions.length > 0) {
    sections.push('**Фракції:**\n' + factions.map(f =>
      `- ${nameOf(f)}: ${descOf(f)}`
    ).join('\n'));
  }

  // Artifacts
  const artifacts = Object.values(canon.artifacts || {});
  if (artifacts.length > 0) {
    sections.push('**Артефакти:**\n' + artifacts.map(a =>
      `- ${nameOf(a)}: ${descOf(a)}${a.owner ? ` [власник: ${a.owner}]` : ''}`
    ).join('\n'));
  }

  return sections.length > 0 ? sections.join('\n\n') : 'Канон порожній — ти створюєш світ з нуля.';
}

/**
 * Build scene generation prompt
 */
function buildScenePrompt({ title, desc, language, genres, scope, ending, endingNote, length, dialogue, canonContext, intentDescription, previousScenes, sceneIntent, customIntent }) {
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

  // Convert dialogue percentage to IMPERATIVE style instruction (strong signal)
  let dialogueStyle;
  if (dialogue <= 15) {
    dialogueStyle = 'Напиши сцену БЕЗ діалогів. Лише оповідь, опис, внутрішні думки. Жодної прямої мови.';
  } else if (dialogue <= 38) {
    dialogueStyle = 'Діалоги рідкісні — максимум 1-2 короткі репліки на весь текст. Основа — наратив і опис.';
  } else if (dialogue <= 62) {
    dialogueStyle = 'Рівно чергуй діалоги й оповідь — 3-4 абзаці опису, потім розмова, потім знову опис.';
  } else if (dialogue <= 82) {
    dialogueStyle = 'Діалоги ведуть дію — персонажі говорять часто, між репліками короткі описи (1-2 речення).';
  } else {
    dialogueStyle = 'Сцена МАЄ майже цілком складатися з діалогів — персонажі говорять, мінімум опису між репліками.';
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

  const hasWorldLaws = canonContext.includes('ЗАКОНИ СВІТУ');
  const hasEntityState = canonContext.includes('[зараз —');

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

  prompt += `**SCENE INTENT (ОБОВ'ЯЗКОВО ДОТРИМУЙСЯ):**
${intentDescription}

**Стиль письма:**
- Довжина сцени: ~${length} слів (≈ ${Math.round(length / 100)} абзаців)
- Діалоги: ${dialogueStyle}

**Інструкції:**
1. **НАЙВАЖЛИВІШЕ: ДОТРИМУЙСЯ SCENE INTENT ВИЩЕ.** Сцена має БУКВАЛЬНО виконати те, що вказав користувач. Якщо Scene Intent описує конкретну подію (наприклад "персонаж А робить Б"), ця подія МАЄ статися в сцені. Не інтерпретуй, не пом'якшуй — виконуй точно.
2. ${sceneIntent === 'custom' ? 'Scene Intent користувача МАЄ ПРІОРИТЕТ над каноном. Якщо Scene Intent суперечить канону — слідуй Scene Intent, оновлюй реальність історії.' : 'Генеруй наступну сцену, яка дотримується канону (не додавай нових персонажів/локацій якщо їх немає в каноні, ЯКЩО ТІЛЬКИ це не є частиною сюрпризу)'}
3. Сцена має бути послідовною з попередніми сценами, але Scene Intent важливіший за continuity
4. Якщо канон порожній — створюй світ і персонажів, але будь послідовним
5. **LANGUAGE:** Write in ${lang.name}, in the style of the project's genre
6. Format: ## Scene Title (first line), then text
7. **Typography:** Use proper quotation marks ${lang.quotes} and dash ${lang.dash}
8. **CRITICAL:** Output ONLY the scene text. NO meta-comments, NO "(Proceed to output...)", NO explanations — pure literary prose in ${lang.name}.${hasWorldLaws ? `
9. **ЗАКОНИ СВІТУ — це фізика всесвіту, а не факти сюжету.** Жодна подія сцени не може їх порушити. Scene Intent виконуй У МЕЖАХ цих законів (знайди спосіб, що їм не суперечить). Порушити закон можна лише якщо Scene Intent прямо й явно цього вимагає — тоді це свідомий твіст, і він має бути помітним у тексті, а не випадковим.` : ''}${hasEntityState ? `
10. **CONTINUITY:** позначка «[зараз — …]» у каноні — стан сутності на кінець останньої сцени. Сцена починається з цього стану: мертвий персонаж не діє і не говорить (хіба що це явний флешбек, видіння чи свідомий твіст зі Scene Intent), персонаж перебуває там, де вказано, доки сцена не покаже, як він перемістився.` : ''}

**ОСТАННЯ КОМАНДА (дотримуйся строго):**
- **SCENE INTENT (CRITICAL):** ${intentDescription}${sceneIntent === 'custom' ? '\n  ↳ ВИКОНАЙ ЦЕ БУКВАЛЬНО. Якщо написано "персонаж стає Х" — він МАЄ стати Х в цій сцені. Не символічно, не метафорично — буквально.' : ''}
- Довжина: ~${length} слів (≈ ${Math.round(length / 100)} абзаців). Не більше ${length + 200} слів.
- ${dialogueStyle}${hasWorldLaws ? '\n- Закони світу не порушуються (див. «ЗАКОНИ СВІТУ»).' : ''}

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
    if (char.name && textLower.includes(char.name.toLowerCase())) {
      mentioned.push({ type: 'character', id, name: char.name });
    }
  });

  // Check locations
  Object.entries(canon.locations || {}).forEach(([id, loc]) => {
    if (loc.name && textLower.includes(loc.name.toLowerCase())) {
      mentioned.push({ type: 'location', id, name: loc.name });
    }
  });

  // Check factions
  Object.entries(canon.factions || {}).forEach(([id, faction]) => {
    if (faction.name && textLower.includes(faction.name.toLowerCase())) {
      mentioned.push({ type: 'faction', id, name: faction.name });
    }
  });

  return mentioned;
}

/**
 * Cloud Function: Reconstruct Scene (stage 3 — real reconstruction with diff)
 *
 * After a canon change, rewrites ONE dependent scene so it is consistent with
 * the CURRENT canon, with minimal edits. Returns a proposal only — nothing is
 * saved here; the author accepts/rejects it in the reconstruction overlay
 * (human-in-the-loop, invariant #5: Review is the default).
 *
 * Input (POST JSON): { projectId, sceneId, entityType, entityId, changeType, changeNote? }
 * Output: { success, unchanged, proposedText, tokensConsumed, tokensRemaining }
 */
const RECON_CHANGE_TYPES = {
  rename: 'Сутність перейменовано. Заміни в тексті всі згадки її старої назви на поточну (з урахуванням відмінків). Більше нічого не змінюй.',
  property: 'Змінились властивості сутності (опис, вигляд, характер, статус). Виправ лише ті місця сцени, що суперечать її поточному опису в каноні.',
  relationship: 'Змінились зв\'язки сутності з іншими. Перепиши взаємодії та репліки, що суперечать поточним зв\'язкам; сюжет сцени збережи.',
  remove: 'Сутність ВИДАЛЕНО з канону. Перебудуй сцену без неї: її дії та репліки передай іншим доречним персонажам/елементам канону або прибери, зберігши сюжетну функцію сцени.',
  rewrite: 'Канон сутності суттєво переписано. Перепиши сцену глибше, щоб вона повністю відповідала поточному канону, але збережи ключові події, якщо вони йому не суперечать.',
};
const RECON_UNCHANGED = 'БЕЗ ЗМІН';
const MAX_RECON_SCENE_CHARS = 20000;
const MAX_CHANGE_NOTE_CHARS = 500;
const RECON_HIDDEN_FIELDS = ['id', 'kind', 'slug', 'origin', 'confirmed', 'createdAt', 'updatedAt', 'sourceScenes'];

exports.reconstructScene = onRequest({
  region: 'us-central1',
  secrets: [geminiApiKey, claudeApiKey],
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

      const { projectId, sceneId, entityType, entityId, changeType } = req.body || {};
      const changeNote = String(req.body?.changeNote || '').slice(0, MAX_CHANGE_NOTE_CHARS).trim();
      if (!projectId || !sceneId || !entityType || !entityId || !RECON_CHANGE_TYPES[changeType]) {
        res.status(400).json({ error: 'projectId, sceneId, entityType, entityId та коректний changeType обов\'язкові' });
        return;
      }

      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) {
        res.status(404).json({ error: 'Проєкт не знайдено' });
        return;
      }
      const project = projectDoc.data();
      if (project.owner !== uid) {
        res.status(403).json({ error: 'Ви не є власником цього проєкту' });
        return;
      }

      // Scene text comes from Firestore, never from the client
      const sceneDoc = await db.collection('projects').doc(projectId).collection('scenes').doc(sceneId).get();
      if (!sceneDoc.exists) {
        res.status(404).json({ error: 'Сцену не знайдено' });
        return;
      }
      const scene = sceneDoc.data();
      const sceneText = String(scene.text || '');
      if (!sceneText.trim()) {
        res.status(200).json({ success: true, unchanged: true, proposedText: sceneText, tokensConsumed: 0 });
        return;
      }
      if (sceneText.length > MAX_RECON_SCENE_CHARS) {
        res.status(400).json({ error: `Сцена задовга для реконструкції (${sceneText.length} символів).`, code: 'INPUT_TOO_LONG' });
        return;
      }

      // Plan gate + tokens (priced like generateScene: rewriting a scene ≈ writing one)
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      const userPlan = userData.plan || 'free';
      const planConfig = getPlanBudget(userPlan);
      if (!planConfig.allowReconstruction) {
        res.status(403).json({ error: 'Реконструкція доступна з плану Novelist', code: 'PLAN_REQUIRED', plan: userPlan });
        return;
      }
      if (userData.subscriptionStatus !== 'active') {
        res.status(403).json({ error: 'Активна підписка необхідна для реконструкції', requiresSubscription: true, plan: userPlan });
        return;
      }

      const useClaudeAPI = planConfig.allowClaude;
      const provider = useClaudeAPI ? 'claude' : 'gemini';
      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {})[provider] : null;
      const reserveCost = (providerEconomy && providerEconomy.cost) || (useClaudeAPI ? 300 : 20);
      const balance = getBalance(userData);
      if (balance.available < reserveCost) {
        res.status(403).json({ error: 'Недостатньо токенів для реконструкції', tokensRemaining: balance.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
        return;
      }
      try {
        reservation = await reserve(db, uid, reserveCost);
      } catch (error) {
        if (error.code !== 'OUT_OF_TOKENS') throw error;
        res.status(403).json({ error: 'Недостатньо токенів для реконструкції', tokensRemaining: error.available, tokensNeeded: reserveCost, code: 'OUT_OF_TOKENS' });
        return;
      }

      const { canon } = await loadCanon(db, projectId, project, uid);
      const entity = (canon[entityType] || {})[entityId];
      const entityBlock = entity
        ? JSON.stringify(Object.fromEntries(Object.entries(entity).filter(([k, v]) =>
            !RECON_HIDDEN_FIELDS.includes(k) && v !== null && v !== '' && (typeof v !== 'object' || Array.isArray(v))
          )), null, 2).slice(0, 3000)
        : '(сутності більше немає в каноні)';

      const prompt = `Ти — редактор WhiteWrite. У каноні світу відбулась зміна, і цю сцену треба узгодити з ПОТОЧНИМ каноном.

**Поточний канон (авторитетний):**
${buildCanonContext(canon)}

**Змінена сутність (${entityType}):**
${entityBlock}

**Тип зміни:** ${RECON_CHANGE_TYPES[changeType]}${changeNote ? `\n**Що змінилось (зі слів автора):** ${changeNote}` : ''}

**Сцена «${scene.title || 'Без назви'}» (поточний текст):**
<scene>
${sceneText}
</scene>

**Правила:**
1. Мінімальні правки: змінюй лише те, що суперечить поточному канону або стосується зміненої сутності. Решту тексту лиши дослівно — стиль, ритм, абзаци.
2. Закони світу непорушні.
3. Пиши тією ж мовою і з тією ж типографікою, що й оригінал.
4. Якщо сцена вже повністю відповідає поточному канону — виведи рівно «${RECON_UNCHANGED}» і нічого більше.
5. Інакше виведи ЛИШЕ повний виправлений текст сцени, без назви, без коментарів і без тегів.`;

      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      let outText = null;
      let apiUsage = { input_tokens: 0, output_tokens: 0 };
      let model;

      if (useClaudeAPI) {
        model = AI_MODELS.claude.sonnet;
        const anthropic = new Anthropic({ apiKey: claudeApiKey.value() });
        const message = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          messages: [{ role: 'user', content: prompt }]
        });
        if (message.stop_reason === 'max_tokens') throw new Error('Відповідь обрізана — сцена задовга');
        outText = message.content[0].text;
        apiUsage = message.usage;
        model = message.model || model;
      } else {
        model = AI_MODELS.gemini.pro;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiApiKey.value()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
          })
        });
        if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${await response.text()}`);
        const data = await response.json();
        const cand = data.candidates && data.candidates[0];
        if (!cand?.content?.parts?.[0]?.text) throw new Error('Gemini: invalid response structure');
        if (cand.finishReason === 'MAX_TOKENS') throw new Error('Відповідь обрізана — сцена задовга');
        outText = cand.content.parts[0].text;
        if (data.usageMetadata) {
          apiUsage = { input_tokens: data.usageMetadata.promptTokenCount || 0, output_tokens: data.usageMetadata.candidatesTokenCount || 0 };
        }
      }

      outText = outText.trim().replace(/^<scene>\s*/, '').replace(/\s*<\/scene>$/, '');
      const unchanged = outText === RECON_UNCHANGED || outText === sceneText.trim();
      if (!unchanged && outText.length < Math.min(200, sceneText.length / 4)) {
        throw new Error('AI повернув підозріло короткий текст — пропозицію відхилено');
      }

      const { userCost } = await charge(db, uid, 'generateScene', model, apiUsage, projectId, {
        provider,
        targetWords: Math.max(100, sceneText.split(/\s+/).length),
        estimatedInputTokens,
        reserved: reservation,
        logAs: 'reconstructScene',
        sceneId
      });
      reservation = null;

      res.status(200).json({
        success: true,
        unchanged,
        proposedText: unchanged ? sceneText : outText,
        tokensConsumed: userCost,
        tokensRemaining: Math.max(0, balance.available - userCost)
      });
    } catch (error) {
      console.error('reconstructScene error:', error);
      if (reservation) {
        await refund(db, uid, reservation).catch(e => console.error('[reconstructScene] Refund failed:', e));
      }
      res.status(500).json({ error: `Помилка реконструкції: ${error.message}` });
    }
  });
});
