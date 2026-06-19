// Test: Check scenes in Firestore for user's project
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../whitewrite-app-firebase-adminsdk-fbsvc-4a613380f4.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testScenes() {
  console.log('🔍 Checking scenes in Firestore...\n');

  // Your UID from users.json
  const uid = 'D72FcLAn2xQritZkO6xYD5lxLDL2';

  try {
    // 1. Get user's projects
    const projectsSnapshot = await db.collection('projects')
      .where('owner', '==', uid)
      .limit(10)
      .get();

    if (projectsSnapshot.empty) {
      console.log('❌ No projects found for user:', uid);
      return;
    }

    console.log(`✅ Found ${projectsSnapshot.size} projects\n`);

    // 2. Check each project for scenes
    for (const projectDoc of projectsSnapshot.docs) {
      const projectData = projectDoc.data();
      console.log(`📦 Project: ${projectDoc.id}`);
      console.log(`   Title: ${projectData.title || 'Untitled'}`);
      console.log(`   Created: ${projectData.createdAt?.toDate()}`);

      // Check scenes subcollection
      const scenesSnapshot = await db.collection('projects')
        .doc(projectDoc.id)
        .collection('scenes')
        .orderBy('n', 'asc')
        .get();

      console.log(`   Scenes (subcollection): ${scenesSnapshot.size}`);

      if (scenesSnapshot.size > 0) {
        scenesSnapshot.docs.slice(0, 3).forEach(sceneDoc => {
          const scene = sceneDoc.data();
          console.log(`     - Scene ${scene.n}: "${scene.title}" (canonRefs: ${JSON.stringify(scene.canonRefs || 'none')})`);
        });
        if (scenesSnapshot.size > 3) {
          console.log(`     ... and ${scenesSnapshot.size - 3} more`);
        }
      }

      // Check old format (scenes array in project doc)
      if (projectData.scenes && Array.isArray(projectData.scenes)) {
        console.log(`   Scenes (old array): ${projectData.scenes.length}`);
      }

      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testScenes();
