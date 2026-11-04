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
          name: user.displayName || user.email?.split('@')[0] || 'Майстер світів',
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

            // Mirrors functions/token-service.js getBalance(): allowance renews 1 month after periodStart
            const periodStart = userData.periodStart?.toDate ? userData.periodStart.toDate() : null;
            const renewAt = periodStart ? new Date(periodStart) : null;
            if (renewAt) renewAt.setMonth(renewAt.getMonth() + 1);
            const periodExpired = !renewAt || renewAt <= new Date();
            window.__wwUser.tokensBudget = planConfig.monthly;
            window.__wwUser.tokensUsed = periodExpired ? 0 : (userData.tokensUsed || 0);
            window.__wwUser.bonusTokens = Math.max(0, userData.bonusTokens || 0);
            window.__wwUser.tokensRemaining = Math.max(0, window.__wwUser.tokensBudget - window.__wwUser.tokensUsed) + window.__wwUser.bonusTokens;
            window.__wwUser.resetDate = userData.resetDate?.toDate() || new Date();

            // Feature gates (from plan config)
            // Claude only — the model the author picked (Account), if the plan opens it, else the plan default
            const PF = window.__PAID_FEATURES;
            window.__wwUser.aiModel = PF ? PF.modelTier(window.__wwUser.plan, (userData.settings || {}).aiModel) : 'sonnet';
            if (window.__wwApplyModel) window.__wwApplyModel();
            window.__wwUser.allowReconstruction = planConfig.allowReconstruction || false;
            window.__wwUser.allowExport = planConfig.allowExport || false;
            window.__wwUser.allowAPI = planConfig.allowAPI || false;

            // Subscription status (for UI display)
            window.__wwUser.subscriptionStatus = userData.subscriptionStatus || null;
            window.__wwUser.paidPlan = userData.paidPlan || null; // the paid plan while the subscription is paused / unpaid (plan is free)
            window.__wwUser.pendingPlan = userData.pendingPlan || null; // a downgrade scheduled for the next billing month
            window.__wwUser.pendingFrom = userData.pendingFrom && userData.pendingFrom.toDate ? userData.pendingFrom.toDate() : null;

            // Usage breakdown (for analytics)
            window.__wwUser.usage = userData.usage || {};

            // Update dock with real data
            if (typeof window.__syncDockAvatar === 'function') {
              window.__syncDockAvatar();
            }

            // Fill Account modal with real data (initial render after auth)
            if (typeof window.__fillAccount === 'function') {
              window.__fillAccount();
            }
          } else {
            // Create default user document
            // Billing fields (tokensUsed, periodStart, ...) are server-only (see firestore.rules)
            await window.__firebase.db.collection('users').doc(user.uid).set({
              plan: 'free',
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

      } else {
        // No user — not signed in
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
      return { success: false, code: error.code || "", error: this._getErrorMessage(error) };
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
      return { success: false, code: error.code || "", error: this._getErrorMessage(error) };
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
      return { success: false, code: error.code || "", error: this._getErrorMessage(error) };
    }
  },

  // Password reset — Firebase emails a reset link to the address (the sign-in modal's «Забули пароль?»)
  async resetPassword(email) {
    try {
      const auth = window.__firebase.auth;
      try { auth.languageCode = window.__i18n ? window.__i18n.getLanguage() : "uk"; } catch (e) {}
      await auth.sendPasswordResetEmail(email);
      return { success: true };
    } catch (error) {
      console.error("Password reset error:", error);
      return { success: false, code: error.code || "", error: this._getErrorMessage(error) };
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
      return { success: false, code: error.code || "", error: this._getErrorMessage(error) };
    }
  },

  // Token consumption is server-side only (Cloud Functions charge via token-service.js)

  // User-friendly error messages — i18n keys auth.err.<code> (uk + en in app/i18n.js); the modal shows them inline
  _getErrorMessage(error) {
    const code = String(error.code || '').replace(/^auth\//, '');
    const t = window.__i18n ? window.__i18n.t : null;
    if (!t) return error.message || code || 'error';
    const key = 'auth.err.' + code;
    const msg = code ? t(key) : key;
    return msg === key ? t('auth.err.unknown') : msg;
  }
};
