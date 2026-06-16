const admin = require('firebase-admin');
const serviceAccount = require('./whitewrite-app-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteAllProjects() {
  const snapshot = await db.collection('projects').get();
  console.log(`Found ${snapshot.size} projects`);
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log('All projects deleted');
}

deleteAllProjects().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
