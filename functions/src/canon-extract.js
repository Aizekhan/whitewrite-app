// Canon extraction from scene text (shared by scenes + canon-sync)
const {
  db,
  Anthropic,
  AI_MODELS,
  charge,
  mergeSuggestions,
  claudeApiKey,
} = require('./common');


/**
 * Helper: Extract canon from scene (Phase 3.1b + canonRefs linking)
 * Called asynchronously after scene generation
 * @param sceneId - Scene document ID to update with canonRefs
 */
async function extractCanonFromScene(projectId, worldId, sceneText, canon, uid, sceneId, language = 'uk') {
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

Current Canon (for duplicate detection; use the exact "id" as targetId for updates):
${JSON.stringify(Object.fromEntries(
  ['characters', 'locations', 'events', 'factions', 'artifacts'].map(kind => [
    kind,
    Object.entries(canon[kind] || {}).map(([id, e]) => ({ id, name: e.name || e.title || '' }))
  ])
), null, 2)}`;

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
      "targetId": "existing entity id (for update) or null (for add)",
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

    // Auto-merge into the world (no review queue; provenance recorded as inferred)
    const mergedEntities = await mergeSuggestions(db, worldId, canon, suggestions);

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

module.exports = { extractCanonFromScene };
