const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true }); // Enable CORS for all origins

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
  secrets: [geminiApiKey]
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

      // Call Gemini API directly via REST (SDK застарілий, використовує v1beta)
      const apiKey = geminiApiKey.value();

      // Try models with fallback (REST API v1, 2026 models)
      const modelNames = [
        'gemini-3.5-flash',   // Latest (2026)
        'gemini-2.5-flash',   // Stable fallback
        'gemini-2.0-flash'    // Legacy (може бути вимкнена)
      ];

      let sceneText = null;
      let lastError = null;

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
                maxOutputTokens: 2048
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
          console.log(`✓ Model ${modelName} succeeded`);
          break; // Success
        } catch (error) {
          console.warn(`✗ Model ${modelName} failed:`, error.message);
          lastError = error;
        }
      }

      if (!sceneText) {
        throw new Error(`Усі моделі Gemini недоступні. Остання помилка: ${lastError?.message}`);
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

      res.status(200).json({
        success: true,
        scene: {
          title: sceneTitle,
          text: sceneContent,
          entities,
          intent: sceneIntent,
          generatedAt: admin.firestore.FieldValue.serverTimestamp()
        }
      });

    } catch (error) {
      console.error('generateScene error:', error);
      res.status(500).json({ error: `Помилка генерації: ${error.message}` });
    }
  });
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
