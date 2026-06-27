// One-time migration: seed→free, storyweaver→storyteller, worldforge→worldbuilder
const admin = require('firebase-admin');

const LEGACY_MAP = {
  'seed': 'free',
  'storyweaver': 'storyteller',
  'worldforge': 'worldbuilder'
};

async function migrateLegacyPlans(db) {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  let migrated = 0;
  const batch = db.batch();

  snapshot.forEach(doc => {
    const plan = doc.data().plan;
    if (LEGACY_MAP[plan]) {
      console.log(`Migrating user ${doc.id}: ${plan} → ${LEGACY_MAP[plan]}`);
      batch.update(doc.ref, { plan: LEGACY_MAP[plan] });
      migrated++;
    }
  });

  if (migrated > 0) {
    await batch.commit();
    console.log(`✓ Migrated ${migrated} users`);
  } else {
    console.log('✓ No legacy plans found');
  }

  return { total: snapshot.size, migrated };
}

module.exports = { migrateLegacyPlans, LEGACY_MAP };
