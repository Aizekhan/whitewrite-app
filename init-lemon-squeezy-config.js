// Run this in browser console on whitewrite.com (after login)
// to create the Lemon Squeezy config in Firestore

firebase.firestore().collection('config').doc('lemon_squeezy').set({
  storeId: '419955',

  // Subscription variant IDs
  variants: {
    storyteller: '1849926',
    novelist: '1849976',
    worldbuilder: '1849991',
    tokens_500: '1850008'
  },

  // Token top-up products
  topups: {
    '500': {
      variantId: '1850008',
      tokens: 500,
      price: 5  // USD
    }
  },

  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
})
.then(() => {
  console.log('✅ Lemon Squeezy config created!');
  console.log('');
  console.log('Config:');
  console.log('  Store ID: 419955');
  console.log('  Storyteller variant: 1849926');
  console.log('  Novelist variant: 1849976');
  console.log('  Worldbuilder variant: 1849991');
  console.log('  500 Tokens variant: 1850008');
})
.catch(err => console.error('❌ Error:', err));
