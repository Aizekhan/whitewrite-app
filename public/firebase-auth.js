// Firebase Auth integration for White.html
// Replaces localStorage-based auth with real Firebase Auth

window.__firebaseAuth = {
  // Initialize auth state listener
  init() {
    const auth = window.__firebase.auth;

    // Listen to auth state changes
    auth.onAuthStateChanged((user) => {
      if (user) {
        // User signed in
        window.__wwAuth = true;
        window.__wwUser = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || 'Майстер всесвітів',
          avatar: user.photoURL || null,
          plan: 'seed' // Default plan
        };

        // Update firebase-projects uid
        if (window.__firebaseProjects) {
          window.__firebaseProjects.uid = user.uid;
        }

        // Persist to localStorage (for quick reload)
        try {
          localStorage.setItem('ww_auth', '1');
          localStorage.setItem('ww_user', JSON.stringify(window.__wwUser));
        } catch (e) {}

        console.log('Auth state: signed in', user.email);
      } else {
        // User signed out
        window.__wwAuth = false;
        window.__wwUser = null;

        // Reset to demo user
        if (window.__firebaseProjects) {
          window.__firebaseProjects.uid = 'demo_user';
        }

        try {
          localStorage.removeItem('ww_auth');
          localStorage.removeItem('ww_user');
        } catch (e) {}

        console.log('Auth state: signed out');
      }

      // Sync UI (if function exists)
      if (typeof window.__syncDockAuth === 'function') {
        window.__syncDockAuth();
      }

      // Reload projects with new uid
      if (typeof window.__reloadProjects === 'function') {
        window.__reloadProjects();
      }
    });
  },

  // Email/Password Sign In
  async signIn(email, password) {
    try {
      const auth = window.__firebase.auth;
      const result = await auth.signInWithEmailAndPassword(email, password);
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: this._getErrorMessage(error) };
    }
  },

  // Email/Password Sign Up
  async signUp(email, password, displayName) {
    try {
      const auth = window.__firebase.auth;
      const result = await auth.createUserWithEmailAndPassword(email, password);

      // Update profile with display name
      if (displayName) {
        await result.user.updateProfile({ displayName: displayName });
      }

      return { success: true, user: result.user };
    } catch (error) {
      console.error('Sign up error:', error);
      return { success: false, error: this._getErrorMessage(error) };
    }
  },

  // Google Sign In
  async signInWithGoogle() {
    try {
      const auth = window.__firebase.auth;
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Google sign in error:', error);
      return { success: false, error: this._getErrorMessage(error) };
    }
  },

  // Sign Out
  async signOut() {
    try {
      const auth = window.__firebase.auth;
      await auth.signOut();
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: this._getErrorMessage(error) };
    }
  },

  // Get user-friendly error messages
  _getErrorMessage(error) {
    const code = error.code || '';

    if (code === 'auth/user-not-found') return 'Користувача не знайдено';
    if (code === 'auth/wrong-password') return 'Неправильний пароль';
    if (code === 'auth/email-already-in-use') return 'Ця пошта вже використовується';
    if (code === 'auth/weak-password') return 'Пароль занадто слабкий (мінімум 6 символів)';
    if (code === 'auth/invalid-email') return 'Невірний формат email';
    if (code === 'auth/popup-closed-by-user') return 'Вхід скасовано';
    if (code === 'auth/network-request-failed') return 'Помилка мережі';

    return error.message || 'Невідома помилка';
  }
};

// Initialize on load
console.log('Firebase auth module loaded');
