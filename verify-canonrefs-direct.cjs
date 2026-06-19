// Direct Firestore verification (no browser needed)
// Uses Firebase Admin SDK to check canonRefs in production

const admin = require('firebase-admin');
const serviceAccount = require('./whitewrite-app-firebase-adminsdk-fbsvc-4a613380f4.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyCanonRefs() {
  console.log('🔍 Verifying Scene ↔ Canon Links in Production...\n');

  try {
    // Get all projects
    const projectsSnapshot = await db.collection('projects').limit(5).get();

    if (projectsSnapshot.empty) {
      console.log('❌ No projects found');
      return;
    }

    console.log(`Found ${projectsSnapshot.size} projects\n`);

    for (const projectDoc of projectsSnapshot.docs) {
      const project = projectDoc.data();
      const projectId = projectDoc.id;

      console.log(`\n📦 Project: ${project.title || projectId}`);
      console.log(`   Owner: ${project.owner}`);
      console.log(`   Scenes: ${project.written || 0}`);

      // Get scenes for this project
      const scenesSnapshot = await db.collection('projects')
        .doc(projectId)
        .collection('scenes')
        .orderBy('n', 'asc')
        .limit(3)
        .get();

      if (scenesSnapshot.empty) {
        console.log('   ⚠️  No scenes found\n');
        continue;
      }

      console.log(`\n   📝 Checking ${scenesSnapshot.size} scenes:\n`);

      scenesSnapshot.docs.forEach((sceneDoc) => {
        const scene = sceneDoc.data();
        const canonRefs = scene.canonRefs;

        console.log(`   🎬 Scene ${scene.n}: "${scene.title}"`);

        if (!canonRefs) {
          console.log(`      ❌ canonRefs MISSING!\n`);
          return;
        }

        const chars = canonRefs.characters?.length || 0;
        const locs = canonRefs.locations?.length || 0;
        const events = canonRefs.events?.length || 0;

        console.log(`      ✅ canonRefs present:`);
        console.log(`         - characters: ${chars}`);
        console.log(`         - locations: ${locs}`);
        console.log(`         - events: ${events}`);

        if (chars > 0 || locs > 0 || events > 0) {
          console.log(`      ✅ LINKED! (${chars + locs + events} total refs)`);
        } else {
          console.log(`      ⚠️  Empty refs (may be old scene before linking)`);
        }
        console.log('');
      });
    }

    console.log('\n✅ Verification complete!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

verifyCanonRefs();
