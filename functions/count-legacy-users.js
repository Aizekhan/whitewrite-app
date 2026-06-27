// Count users with legacy plan IDs (seed, storyweaver, worldforge)
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function countLegacyUsers() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  const legacyPlans = { seed: 0, storyweaver: 0, worldforge: 0 };
  const newPlans = { free: 0, storyteller: 0, novelist: 0, worldbuilder: 0 };
  const other = [];

  snapshot.forEach(doc => {
    const plan = doc.data().plan;
    if (legacyPlans.hasOwnProperty(plan)) {
      legacyPlans[plan]++;
    } else if (newPlans.hasOwnProperty(plan)) {
      newPlans[plan]++;
    } else {
      other.push(plan);
    }
  });

  console.log('\n=== Legacy Plan IDs ===');
  console.log('seed:', legacyPlans.seed);
  console.log('storyweaver:', legacyPlans.storyweaver);
  console.log('worldforge:', legacyPlans.worldforge);
  console.log('TOTAL LEGACY:', Object.values(legacyPlans).reduce((a, b) => a + b, 0));

  console.log('\n=== New Plan IDs ===');
  console.log('free:', newPlans.free);
  console.log('storyteller:', newPlans.storyteller);
  console.log('novelist:', newPlans.novelist);
  console.log('worldbuilder:', newPlans.worldbuilder);
  console.log('TOTAL NEW:', Object.values(newPlans).reduce((a, b) => a + b, 0));

  if (other.length > 0) {
    console.log('\n=== Unknown Plans ===');
    console.log(other);
  }

  console.log('\n=== Total Users ===', snapshot.size);

  process.exit(0);
}

countLegacyUsers().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
