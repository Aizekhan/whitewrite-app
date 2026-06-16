// Set user plan via Firestore REST API (requires no auth for this endpoint)
const uid = 'D72FcLAn2xQritZkO6xYD5lxLDL2';

const userData = {
  fields: {
    email: { stringValue: 'hrytsenkomaksym@gmail.com' },
    displayName: { stringValue: 'Максим Гриценко' },
    plan: { stringValue: 'worldforge' },
    tokens: { integerValue: '8000' },
    tokensMonthly: { integerValue: '8000' },
    maxProjects: { integerValue: '999' },
    updatedAt: { timestampValue: new Date().toISOString() }
  }
};

const url = `https://firestore.googleapis.com/v1/projects/whitewrite-app/databases/(default)/documents/users/${uid}`;

console.log('Setting plan to worldforge for user:', uid);

const response = await fetch(url, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(userData)
});

const result = await response.json();

if (response.ok) {
  console.log('✅ User plan set to worldforge successfully!');
  console.log('Plan:', result.fields.plan.stringValue);
  console.log('Tokens:', result.fields.tokens.integerValue);
  console.log('\n🎩 Claude API is now enabled for this user!');
} else {
  console.error('❌ Failed:', result);
}
