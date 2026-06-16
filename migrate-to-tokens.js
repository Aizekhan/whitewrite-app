// Migration script: scenesGenerated → tokensUsed
// Run once to convert existing user data to Token Budget System

// HOW TO RUN:
// 1. Install firebase-admin: npm install firebase-admin
// 2. Download service account key from Firebase Console
// 3. Set GOOGLE_APPLICATION_CREDENTIALS env variable
// 4. Run: node migrate-to-tokens.js

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'whitewrite-app'
});

const db = admin.firestore();

// Token costs (must match token-budget.js)
const TOKEN_COSTS = {
  sceneGemini: 20,
  sceneClaude: 300
};

async function migrateUsers() {
  console.log('🔄 Starting migration: scenesGenerated → tokensUsed\n');

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const data = doc.data();

    // Skip if already migrated (has tokensUsed field)
    if (data.tokensUsed !== undefined) {
      console.log(`⏭  ${uid}: Already migrated (tokensUsed exists)`);
      skipped++;
      continue;
    }

    try {
      // Calculate tokensUsed from old counters
      const geminiScenes = data.geminiScenes || 0;
      const claudeScenes = data.claudeScenes || 0;
      const tokensUsed = (geminiScenes * TOKEN_COSTS.sceneGemini) + (claudeScenes * TOKEN_COSTS.sceneClaude);

      // Preserve old fields for rollback
      const updates = {
        tokensUsed: tokensUsed,
        usage: {
          sceneGemini: {
            count: geminiScenes,
            tokens: geminiScenes * TOKEN_COSTS.sceneGemini
          },
          sceneClaude: {
            count: claudeScenes,
            tokens: claudeScenes * TOKEN_COSTS.sceneClaude
          }
        },
        // Keep old fields for rollback safety
        _migrated: admin.firestore.FieldValue.serverTimestamp(),
        _oldSceneCounters: {
          scenesGenerated: data.scenesGenerated || 0,
          geminiScenes: geminiScenes,
          claudeScenes: claudeScenes
        }
      };

      await usersRef.doc(uid).update(updates);

      console.log(`✅ ${uid}: Migrated (${geminiScenes} Gemini + ${claudeScenes} Claude → ${tokensUsed} tokens)`);
      migrated++;
    } catch (error) {
      console.error(`❌ ${uid}: Error -`, error.message);
      errors++;
    }
  }

  console.log('\n📊 Migration complete:');
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📦 Total users: ${snapshot.size}`);
}

// Run migration
migrateUsers()
  .then(() => {
    console.log('\n✨ Migration finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });
