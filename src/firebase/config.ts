import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA-ka-oivhbGgHMSKHf4b7oE0rCgxfYu_g",
  authDomain: "whitewrite-app.firebaseapp.com",
  projectId: "whitewrite-app",
  storageBucket: "whitewrite-app.firebasestorage.app",
  messagingSenderId: "954187059234",
  appId: "1:954187059234:web:1e9d3d1a336856cb5c3a7b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
