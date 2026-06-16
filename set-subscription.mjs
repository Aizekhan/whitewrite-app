// Set subscription status to active for test user
const uid = 'D72FcLAn2xQritZkO6xYD5lxLDL2';

const userData = {
  fields: {
    subscriptionStatus: { stringValue: 'active' },
    updatedAt: { timestampValue: new Date().toISOString() }
  }
};

const url = `https://firestore.googleapis.com/v1/projects/whitewrite-app/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=subscriptionStatus&updateMask.fieldPaths=updatedAt`;

console.log('Setting subscriptionStatus to active for user:', uid);

const response = await fetch(url, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(userData)
});

const result = await response.json();

if (response.ok) {
  console.log('✅ Subscription status set to active!');
  console.log('User can now use worldforge plan with Claude API');
} else {
  console.error('❌ Failed:', result);
}
