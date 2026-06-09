// Firebase initialization for White.html
// Uses Firebase v9 SDK via CDN

const firebaseConfig = {
  apiKey: "AIzaSyA-ka-oivhbGgHMSKHf4b7oE0rCgxfYu_g",
  authDomain: "whitewrite-app.firebaseapp.com",
  projectId: "whitewrite-app",
  storageBucket: "whitewrite-app.firebasestorage.app",
  messagingSenderId: "954187059234",
  appId: "1:954187059234:web:1e9d3d1a336856cb5c3a7b"
};

// Initialize Firebase (uses global firebase from CDN)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.app().functions('us-central1'); // Set region for compat SDK

// Global access
window.__firebase = { app, auth, db, functions };
console.log('Firebase initialized');
