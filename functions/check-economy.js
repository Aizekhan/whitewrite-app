// Check economy_operations collection for Claude model versions
const admin = require('firebase-admin');
const serviceAccount = require('../whitewrite-app-firebase-adminsdk-fbsvc-4a613380f4.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkEconomy() {
  console.log('\n🔍 Checking economy_operations collection...\n');

  const operations = ['generateScene', 'extractCanon', 'analyzeScene'];

  for (const op of operations) {
    const doc = await db.collection('economy_operations').doc(op).get();
    if (doc.exists) {
      const data = doc.data();
      console.log(`\n=== ${op} ===`);
      console.log('Model:', data.model || 'NOT SET');
      console.log('Cost per token:', data.costPerToken || data.cost || 'NOT SET');
      console.log('Full data:', JSON.stringify(data, null, 2));
    } else {
      console.log(`\n❌ ${op} — NOT FOUND`);
    }
  }

  console.log('\n✅ Done\n');
  process.exit(0);
}

checkEconomy().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
