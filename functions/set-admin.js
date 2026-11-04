// Grant admin custom claim (required for admin-only actions: modelWatchRun, admin panels in the Account).
// Usage: node set-admin.js <uid>   (then sign out/in to refresh the ID token)
const admin = require('./admin.js'); // firebase-admin v14: the namespaced facade
admin.initializeApp();

const uid = process.argv[2];
if (!uid) {
  console.error('Usage: node set-admin.js <uid>');
  process.exit(1);
}

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✓ ${uid} is now admin`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
