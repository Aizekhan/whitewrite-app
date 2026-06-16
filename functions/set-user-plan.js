const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function setUserPlan() {
  const uid = 'D72FcLAn2xQritZkO6xYD5lxLDL2';
  
  await db.collection('users').doc(uid).set({
    email: 'hrytsenkomaksym@gmail.com',
    displayName: 'Максим Гриценко',
    plan: 'worldforge',
    tokens: 8000,
    tokensMonthly: 8000,
    maxProjects: 999,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  
  console.log('✓ User plan set to worldforge (Claude API enabled)');
  process.exit(0);
}

setUserPlan().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
