// Import Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyD6XsOpzOSfWfBZdl30wPVFMOdXpq_uujI",
  authDomain: "whitewrite-app.firebaseapp.com",
  projectId: "whitewrite-app",
  storageBucket: "whitewrite-app.firebasestorage.app",
  messagingSenderId: "954187059234",
  appId: "1:954187059234:web:e8e3c84b64d86e3b5a2e0f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const uid = 'D72FcLAn2xQritZkO6xYD5lxLDL2';

console.log('Setting worldforge plan for user:', uid);

await setDoc(doc(db, 'users', uid), {
  email: 'hrytsenkomaksym@gmail.com',
  displayName: 'Максим Гриценко',
  plan: 'worldforge',
  tokens: 8000,
  tokensMonthly: 8000,
  maxProjects: 999,
  updatedAt: serverTimestamp()
}, { merge: true });

console.log('✅ User plan set to worldforge!');
console.log('🎩 Claude API enabled');
console.log('\nRefresh the app and create a new project to test!');
