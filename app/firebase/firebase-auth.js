// Firebase Auth integration for White.html
// Replaces localStorage-based auth with real Firebase Auth

window.__firebaseAuth = {
  // Initialize auth state listener
  init() {
    const auth = window.__firebase.auth;

    // Listen to auth state changes
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        // User signed in
        window.__wwAuth = true;
        window.__wwUser = {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email?.split('@')[0] || 'Майстер всесвітів',
          avatar: user.photoURL || null,
          plan: 'seed', // Default plan (will be updated from Firestore)
          isAnonymous: user.isAnonymous
        };

        // Load user plan + scene counters from Firestore
        try {
          const userDoc = await window.__firebase.db.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();

            // Plan info
            window.__wwUser.plan = userData.plan || 'free';
            window.__wwUser.tokens = userData.tokens || 0; // legacy, deprecated
            window.__wwUser.tokensMonthly = userData.tokensMonthly || 0; // legacy

            // Scene counters (Phase 1.1)
            window.__wwUser.scenesGenerated = userData.scenesGenerated || 0;
            window.__wwUser.geminiScenes = userData.geminiScenes || 0;
            window.__wwUser.claudeScenes = userData.claudeScenes || 0;
            window.__wwUser.resetDate = userData.resetDate?.toDate() || new Date();

            // Limits based on plan
            const limits = {
              free: { scenes: 10, claude: 0 },
              storyteller: { scenes: 120, claude: 0 },
              novelist: { scenes: 400, claude: 80 },
              worldbuilder: { scenes: 300, claude: 300 }
            };
            const planLimits = limits[window.__wwUser.plan] || limits.free;
            window.__wwUser.scenesLimit = planLimits.scenes;
            window.__wwUser.claudeLimit = planLimits.claude;

            console.log('User plan loaded:', window.__wwUser.plan,
              `(${window.__wwUser.scenesGenerated}/${window.__wwUser.scenesLimit} scenes,`,
              `${window.__wwUser.claudeScenes}/${window.__wwUser.claudeLimit} Claude)`);

            // Update dock with real data
            if (typeof window.__syncDockAvatar === 'function') {
              window.__syncDockAvatar();
            }
          } else {
            console.log('No user document found, creating default: free plan');
            // Create default user document
            await window.__firebase.db.collection('users').doc(user.uid).set({
              plan: 'free',
              scenesGenerated: 0,
              geminiScenes: 0,
              claudeScenes: 0,
              resetDate: new Date(),
              createdAt: new Date()
            });
            window.__wwUser.plan = 'free';
            window.__wwUser.scenesGenerated = 0;
            window.__wwUser.scenesLimit = 10;
          }
        } catch (error) {
          console.error('Failed to load user plan:', error);
        }

        // Update firebase-projects uid
        if (window.__firebaseProjects) {
          window.__firebaseProjects.uid = user.uid;
        }

        // Persist to localStorage (for quick reload)
        try {
          localStorage.setItem('ww_auth', '1');
          localStorage.setItem('ww_user', JSON.stringify(window.__wwUser));
        } catch (e) {}

        console.log('Auth state: signed in', user.isAnonymous ? '(anonymous)' : user.email);
      } else {
        // No user — not signed in
        console.log('No user detected');
        window.__wwAuth = false;
        window.__wwUser = null;

        if (window.__firebaseProjects) {
          window.__firebaseProjects.uid = null;
        }

        try {
          localStorage.removeItem('ww_auth');
          localStorage.removeItem('ww_user');
        } catch (e) {}
      }

      // Sync UI (if function exists)
      if (typeof window.__syncDockAuth === 'function') {
        window.__syncDockAuth();
      }

      // Re-render rail menu (so "Проекти" appears after auth)
      if (typeof window.__reloadRail === 'function') {
        window.__reloadRail();
      }

      // Reload projects with new uid
      if (typeof window.__reloadProjects === 'function') {
        window.__reloadProjects();
      }

      // Check if auth modal should open (for first-time visitors)
      if (typeof window.__checkAuthModal === 'function') {
        window.__checkAuthModal();
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

  // Increment scene counter after generation (Phase 1.1)
  async incrementSceneCounter(provider = 'gemini') {
    if (!window.__wwUser || !window.__wwUser.uid) {
      console.error('Cannot increment: no user');
      return { success: false, error: 'No user' };
    }

    try {
      const uid = window.__wwUser.uid;
      const userRef = window.__firebase.db.collection('users').doc(uid);

      // Increment counters
      const increment = firebase.firestore.FieldValue.increment(1);
      const updates = {
        scenesGenerated: increment
      };

      if (provider === 'claude') {
        updates.claudeScenes = increment;
      } else {
        updates.geminiScenes = increment;
      }

      await userRef.update(updates);

      // Update local state
      window.__wwUser.scenesGenerated = (window.__wwUser.scenesGenerated || 0) + 1;
      if (provider === 'claude') {
        window.__wwUser.claudeScenes = (window.__wwUser.claudeScenes || 0) + 1;
      } else {
        window.__wwUser.geminiScenes = (window.__wwUser.geminiScenes || 0) + 1;
      }

      console.log(`Scene counter incremented: ${window.__wwUser.scenesGenerated}/${window.__wwUser.scenesLimit} (${provider})`);
      return { success: true };
    } catch (error) {
      console.error('Failed to increment scene counter:', error);
      return { success: false, error: error.message };
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
