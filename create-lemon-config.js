// Admin script to create Lemon Squeezy config in Firestore
// Run with: node create-lemon-config.js

const admin = require('firebase-admin');
const serviceAccount = require('./whitewrite-app-firebase-adminsdk.json'); // ← потрібен service account key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createLemonConfig() {
  try {
    await db.collection('config').doc('lemon_squeezy').set({
      storeId: '419955',

      variants: {
        storyteller: '1849926',
        novelist: '1849976',
        worldbuilder: '1849991',
        tokens_500: '1850008'
      },

      topups: {
        '500': {
          variantId: '1850008',
          tokens: 500,
          price: 5
        }
      },

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Lemon Squeezy config created!');
    console.log('');
    console.log('Config:');
    console.log('  Store ID: 419955');
    console.log('  Storyteller variant: 1849926');
    console.log('  Novelist variant: 1849976');
    console.log('  Worldbuilder variant: 1849991');
    console.log('  500 Tokens variant: 1850008');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createLemonConfig();
