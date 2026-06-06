const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();
const db = admin.firestore();

// Define secret for Gemini API key
const geminiApiKey = defineSecret('GEMINI_API_KEY');

/**
 * Cloud Function: Generate Scene
 *
 * Generates a story scene based on project canon and scene intent.
 * Canon-aware generation using Gemini API.
 *
 * Input:
 *  - projectId: string
 *  - sceneIntent: 'conflict' | 'character' | 'action' | 'romance' | 'worldbuilding' | 'surprise' | 'custom'
 *  - customIntent?: string (if sceneIntent === 'custom')
 *  - previousScenes?: Array<{title: string, text: string}> (for continuity)
 *
 * Output:
 *  - scene: { title: string, text: string, entities: string[] }
 */
exports.generateScene = onCall({
  region: 'us-central1',
  secrets: [geminiApiKey]
}, async (request) => {
  const { projectId, sceneIntent, customIntent, previousScenes = [] } = request.data;
  const uid = request.auth?.uid;

  // Auth check
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Потрібна автентифікація');
  }

  // Validate input
  if (!projectId || !sceneIntent) {
    throw new HttpsError('invalid-argument', 'projectId та sceneIntent обов\'язкові');
  }

  try {
    // Load project from Firestore
    const projectDoc = await db.collection('projects').doc(projectId).get();

    if (!projectDoc.exists) {
      throw new HttpsError('not-found', 'Проєкт не знайдено');
    }

    const project = projectDoc.data();

    // Check ownership
    if (project.owner !== uid) {
      throw new HttpsError('permission-denied', 'Ви не є власником цього проєкту');
    }

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
      canonContext,
      intentDescription,
      previousScenes
    });

    // Call Gemini API
    const genAI = new GoogleGenerativeAI(geminiApiKey.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
      }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const sceneText = response.text();

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

    return {
      success: true,
      scene: {
        title: sceneTitle,
        text: sceneContent,
        entities,
        intent: sceneIntent,
        generatedAt: admin.firestore.FieldValue.serverTimestamp()
      }
    };

  } catch (error) {
    console.error('generateScene error:', error);

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', `Помилка генерації: ${error.message}`);
  }
});

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
function buildScenePrompt({ title, desc, genres, scope, canonContext, intentDescription, previousScenes }) {
  let prompt = `Ти — AI-письменник для WhiteWrite, інструменту canon-aware наративної генерації.

**Проєкт:** ${title}
**Опис:** ${desc}
**Жанри:** ${genres.join(', ') || 'не вказано'}
**Масштаб:** ${scope}

**Canon (авторитетна база знань про світ):**
${canonContext}

`;

  if (previousScenes.length > 0) {
    prompt += `**Попередні сцени (для контексту):**
${previousScenes.map((s, i) => `${i + 1}. ${s.title}\n${s.text.substring(0, 200)}...`).join('\n\n')}

`;
  }

  prompt += `**Scene Intent (напрям сцени):**
${intentDescription}

**Інструкції:**
1. Генеруй наступну сцену, яка СТРОГО ДОТРИМУЄТЬСЯ канону (не додавай нових персонажів/локацій якщо їх немає в каноні, ЯКЩО ТІЛЬКИ це не є частиною сюрпризу)
2. Сцена має бути canon-consistent — використовуй лише факти з канону
3. Якщо канон порожній — створюй світ і персонажів, але будь послідовним
4. Пиши українською, у стилі жанру проєкту
5. Довжина: 300-500 слів (одна сцена, не розділ)
6. Формат: ## Назва сцени (перший рядок), далі текст
7. Дотримуйся Scene Intent — це ключовий напрям сцени

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
