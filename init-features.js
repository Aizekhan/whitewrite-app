// One-time script to initialize feature flags in Firestore
// Run with: node init-features.js

const admin = require('firebase-admin');
const serviceAccount = require('./whitewrite-app-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initFeatures() {
  try {
    const featuresRef = db.collection('config').doc('features');

    await featuresRef.set({
      universe: false,  // WorldTree full access (disabled by default)
      director: false,  // Director full access (disabled by default)
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Feature flags initialized in Firestore:');
    console.log('   - universe: false (preview mode)');
    console.log('   - director: false (preview mode)');
    console.log('');
    console.log('To enable features, update the document in Firebase Console:');
    console.log('   https://console.firebase.google.com/project/whitewrite-app/firestore/data/~2Fconfig~2Ffeatures');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing features:', error);
    process.exit(1);
  }
}

initFeatures();
