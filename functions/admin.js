// firebase-admin v14 removed the namespaced API (admin.firestore(), admin.auth(), admin.firestore.FieldValue, admin.credential…).
// This facade keeps that shape on the modular entry points, so every module keeps `admin.firestore.FieldValue.…`,
// `admin.auth().…`, `admin.storage().…` unchanged. Require it instead of 'firebase-admin'.
const app = require('firebase-admin/app');
const fsMod = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');

const firestore = Object.assign((a) => fsMod.getFirestore(a), { FieldValue: fsMod.FieldValue, Timestamp: fsMod.Timestamp, FieldPath: fsMod.FieldPath });

module.exports = {
  initializeApp: (...args) => app.initializeApp(...args),
  get apps() { return app.getApps(); },
  credential: { cert: app.cert, applicationDefault: app.applicationDefault },
  firestore,
  auth: (a) => getAuth(a),
  storage: (a) => getStorage(a),
};
