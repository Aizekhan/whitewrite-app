const admin = require('firebase-admin');

// Initialize без service account — використає default credentials
admin.initializeApp();

const db = admin.firestore();
const uid = 'D72FcLAn2xQritZkO6xYD5lxLDL2';

async function setWorldforgePlan() {
  console.log('Setting worldforge plan for user:', uid);

  await db.collection('users').doc(uid).set({
    email: 'hrytsenkomaksym@gmail.com',
    displayName: 'Максим Гриценко',
    plan: 'worldforge',
    tokens: 8000,
    tokensMonthly: 8000,
    maxProjects: 999,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log('✅ User plan set to worldforge!');
  console.log('🎩 Claude API enabled');
  console.log('\nNow refresh the app and create a new project!');
  process.exit(0);
}

setWorldforgePlan().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
