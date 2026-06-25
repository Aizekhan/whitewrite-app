// Migration script: Add margin architecture to economy_operations
// Run via Cloud Function: firebase deploy --only functions:migrateMargin
// Then call: https://<region>-<project>.cloudfunctions.net/migrateMargin

const admin = require('firebase-admin');

// Initialize Firebase Admin (use default credentials in Cloud Functions)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrateMargin() {
  console.log('=== Margin Architecture Migration ===\n');

  // 1. Migrate economy_operations
  const operations = ['generateScene', 'extractCanon', 'analyzeScene'];

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
  return { success: true, message: 'Margin architecture migrated successfully' };
}

// Export as Cloud Function (for one-time deployment)
exports.migrateMargin = async (req, res) => {
  try {
    const result = await migrateMargin();
    res.json(result);
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
