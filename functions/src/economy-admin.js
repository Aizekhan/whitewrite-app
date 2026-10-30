// Economy & margin admin endpoints
const {
  onRequest,
  admin,
  db,
  cors,
  AI_MODELS,
  requireAdmin,
} = require('./common');


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
      if (!(await requireAdmin(req, res))) return;

      const operations = {
        generateScene: {
          name: 'Scene Generation',
          providers: {
            gemini: { cost: 20, model: AI_MODELS.gemini.pro },
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
      if (!(await requireAdmin(req, res))) return;

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
      if (!(await requireAdmin(req, res))) return;

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
      if (!(await requireAdmin(req, res))) return;

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
      if (!(await requireAdmin(req, res))) return;

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
      if (!(await requireAdmin(req, res))) return;

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
