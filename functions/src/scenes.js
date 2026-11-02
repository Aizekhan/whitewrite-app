// Scene generation (canon-aware) + prompt helpers
const {
  onRequest,
  admin,
  db,
  cors,
  charge,
  getBalance,
  reserve,
  refund,
  getPlanBudget,
  loadCanon,
  claudeApiKey,
  buildCanonContext,
} = require('./common');
const { modelFor, claudeText } = require('./claude');
const { featureCost, byOp } = require('../paid-features.js');


/**
 * Cloud Function: Generate Scene
 *
 * Generates a story scene based on project canon and scene intent.
 * Canon-aware generation — Claude only (the author's model, functions/src/claude.js).
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
  secrets: [claudeApiKey],
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

      // Claude only: the author's model (Account → «Модель Claude») if the plan allows it, else the plan default
      const { tier, model: claudeModel } = await modelFor(db, userData, userPlan);

      // Reserve = economy_operations/generateScene providers.claude.cost (the Sonnet scene) × the tier scale
      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const economyData = economyDoc.exists ? economyDoc.data() : null;
      const claudeEconomy = economyData && economyData.providers && economyData.providers.claude;
      const sceneCost = featureCost(byOp('scenes'), claudeEconomy && claudeEconomy.cost, tier);
      const providerModel = claudeModel;

      console.log(`User plan: ${userPlan}, tokens: ${tokensRemaining}/${tokensBudget}, AI: Claude ${tier} (${providerModel}), cost: ${sceneCost} tokens`);

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
      const { worldId, canon } = await loadCanon(db, projectId, project, uid, { write: true });

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

      try {
        console.log(`Using Claude API (${claudeModel})`);
        // effort low: prose needs little thinking; thinking counts toward max_tokens, hence the headroom
        const out = await claudeText(claudeApiKey.value(), { model: claudeModel, prompt, maxTokens: 8000, effort: 'low' });
        sceneText = out.text;
        apiUsage = out.usage; // { input_tokens, output_tokens, cache_* }
        actualModel = out.model;
        if (out.stopReason === 'max_tokens') throw new Error('Сцена обрізана — задовга');
        if (sceneText.length < 500) throw new Error(`Scene too short (${sceneText.length} chars) - likely incomplete`);
        console.log(`✓ Claude succeeded (${sceneText.length} chars, stop_reason: ${out.stopReason}, usage:`, JSON.stringify(apiUsage));
      } catch (error) {
        console.error('✗ Claude failed:', error.message);
        lastError = error;
      }

      if (!sceneText) {
        throw new Error(`Claude API недоступна. Остання помилка: ${lastError?.message}`);
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
        { provider: 'claude', tier, targetWords, estimatedInputTokens, reserved: reservation }
      );
      reservation = null; // settled

      console.log(`✅ Scene generated: -${userCost} tokens, $${apiCostUSD.toFixed(4)} API cost`);

      // Auto-canon is OFF (owner decision 2026-11-02): a scene never writes to the canon by itself —
      // new names reach the canon only through the Keeper's «так» or the Bible.

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

      const provider = 'claude';
      const { tier, model: claudeModel } = await modelFor(db, userData, userPlan);
      const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
      const providerEconomy = economyDoc.exists ? (economyDoc.data().providers || {}).claude : null;
      const reserveCost = featureCost(byOp('reconcile'), providerEconomy && providerEconomy.cost, tier);
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

      const { canon } = await loadCanon(db, projectId, project, uid, { write: true });
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

      const out = await claudeText(claudeApiKey.value(), { model: claudeModel, prompt, maxTokens: 12000, effort: 'low' });
      if (out.stopReason === 'max_tokens') throw new Error('Відповідь обрізана — сцена задовга');
      outText = out.text;
      apiUsage = out.usage;
      model = out.model;

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
