// Run this in browser console on whitewrite.com (after login)
// to create the feature flags document in Firestore

firebase.firestore().collection('config').doc('features').set({
  universe: false,   // WorldTree in preview mode
  director: false,   // Workspace in preview mode
  marketplace: false, // Hidden completely
  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
})
.then(() => {
  console.log('✅ Feature flags created!');
  console.log('');
  console.log('Current state:');
  console.log('  universe: false   → Preview mode (browse only)');
  console.log('  director: false   → Preview mode (browse only)');
  console.log('  marketplace: false → Hidden');
  console.log('');
  console.log('To enable features, edit in Firebase Console:');
  console.log('https://console.firebase.google.com/project/whitewrite-app/firestore/data/~2Fconfig~2Ffeatures');
})
.catch(err => console.error('❌ Error:', err));
