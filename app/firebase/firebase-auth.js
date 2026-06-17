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

            // Token Budget System (Phase 1.1 refactor)
            const planConfig = window.__getPlanConfig ? window.__getPlanConfig(window.__wwUser.plan) : { monthly: 200 };

            window.__wwUser.tokensBudget = planConfig.monthly;
            window.__wwUser.tokensUsed = userData.tokensUsed || 0;
            window.__wwUser.tokensRemaining = window.__wwUser.tokensBudget - window.__wwUser.tokensUsed;
            window.__wwUser.resetDate = userData.resetDate?.toDate() || new Date();

            // Feature gates (from plan config)
            window.__wwUser.allowClaude = planConfig.allowClaude || false;
            window.__wwUser.allowImages = planConfig.allowImages || false;
            window.__wwUser.allowReconstruction = planConfig.allowReconstruction || false;
            window.__wwUser.allowExport = planConfig.allowExport || false;
            window.__wwUser.allowAPI = planConfig.allowAPI || false;

            // Usage breakdown (for analytics)
            window.__wwUser.usage = userData.usage || {};

            console.log('User plan loaded:', window.__wwUser.plan,
              `(${window.__wwUser.tokensUsed}/${window.__wwUser.tokensBudget} tokens,`,
              `${window.__wwUser.tokensRemaining} remaining)`);

            // Update dock with real data
            if (typeof window.__syncDockAvatar === 'function') {
              window.__syncDockAvatar();
            }

            // Fill Account modal with real data (initial render after auth)
            if (typeof window.__fillAccount === 'function') {
              window.__fillAccount();
            }
          } else {
            console.log('No user document found, creating default: free plan');
            // Create default user document
            await window.__firebase.db.collection('users').doc(user.uid).set({
              plan: 'free',
              tokensUsed: 0,
              usage: {},
              resetDate: new Date(),
              createdAt: new Date()
            });
            window.__wwUser.plan = 'free';
            window.__wwUser.tokensUsed = 0;
            window.__wwUser.tokensBudget = 200; // free plan
            window.__wwUser.tokensRemaining = 200;
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

      // Reload account modal if open
      if (typeof window.__reloadAccount === 'function') {
        window.__reloadAccount();
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

  // Consume tokens for any operation (Phase 1.1 refactor - Token Budget System)
  async consumeTokens(operation, customCost = null) {
    if (!window.__wwUser || !window.__wwUser.uid) {
      console.error('Cannot consume tokens: no user');
      return { success: false, error: 'No user' };
    }

    // Get cost from TOKEN_COSTS or use custom
    const cost = customCost !== null ? customCost : (window.__TOKEN_COSTS && window.__TOKEN_COSTS[operation]);
    if (!cost) {
      console.error(`Unknown operation or missing cost: ${operation}`);
      return { success: false, error: 'Invalid operation' };
    }

    // Check if user can afford
    if (window.__wwUser.tokensRemaining < cost) {
      console.warn(`Insufficient tokens: need ${cost}, have ${window.__wwUser.tokensRemaining}`);

      // Show upgrade modal (if function exists)
      if (typeof window.__openPricingModal === 'function') {
        setTimeout(() => {
          const planName = window.__getPlanConfig ? window.__getPlanConfig(window.__wwUser.plan).name : 'free';
          const message = `Недостатньо токенів!\n\nПотрібно: ${cost} токенів\nДоступно: ${window.__wwUser.tokensRemaining} токенів\n\nВаш поточний план: ${planName}\n\nОберіть більший план для продовження генерації.`;

          if (confirm(message + '\n\nПереглянути тарифи?')) {
            window.__openPricingModal();
          }
        }, 100);
      }

      return { success: false, error: 'Insufficient tokens', needed: cost, available: window.__wwUser.tokensRemaining };
    }

    try {
      const uid = window.__wwUser.uid;
      const userRef = window.__firebase.db.collection('users').doc(uid);

      // Increment tokensUsed
      const increment = firebase.firestore.FieldValue.increment(cost);
      const updates = {
        tokensUsed: increment
      };

      // Track usage breakdown (for analytics)
      const usageKey = `usage.${operation}`;
      updates[`${usageKey}.count`] = firebase.firestore.FieldValue.increment(1);
      updates[`${usageKey}.tokens`] = firebase.firestore.FieldValue.increment(cost);

      await userRef.update(updates);

      // Update local state
      window.__wwUser.tokensUsed = (window.__wwUser.tokensUsed || 0) + cost;
      window.__wwUser.tokensRemaining = window.__wwUser.tokensBudget - window.__wwUser.tokensUsed;

      // Update usage breakdown locally
      if (!window.__wwUser.usage) window.__wwUser.usage = {};
      if (!window.__wwUser.usage[operation]) window.__wwUser.usage[operation] = { count: 0, tokens: 0 };
      window.__wwUser.usage[operation].count += 1;
      window.__wwUser.usage[operation].tokens += cost;

      console.log(`Tokens consumed: ${operation} (-${cost}) → ${window.__wwUser.tokensUsed}/${window.__wwUser.tokensBudget} (${window.__wwUser.tokensRemaining} left)`);

      // Refresh UI to show new balance
      if (typeof window.__syncDockAvatar === 'function') {
        window.__syncDockAvatar();
      }

      // Reload account modal if open
      if (typeof window.__reloadAccount === 'function') {
        window.__reloadAccount();
      }

      return { success: true, cost, remaining: window.__wwUser.tokensRemaining };
    } catch (error) {
      console.error('Failed to consume tokens:', error);
      return { success: false, error: error.message };
    }
  },

  // Legacy wrapper for backward compatibility (deprecated, use consumeTokens)
  async incrementSceneCounter(provider = 'gemini') {
    const operation = provider === 'claude' ? 'sceneClaude' : 'sceneGemini';
    return await this.consumeTokens(operation);
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
