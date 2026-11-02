// Feature flags from Firestore
// Single source of truth for enabling/disabling features without redeploy

// Default values (used if Firestore not available or document doesn't exist)
const DEFAULT_FEATURES = {
  universe: false    // Universe (WorldTree) full access
};

// Load feature flags from Firestore
async function loadFeatureFlags() {
  try {
    const db = window.__firebase?.db;
    if (!db) {
      console.warn('[Features] Firebase not initialized, using defaults');
      return DEFAULT_FEATURES;
    }

    const doc = await db.collection('config').doc('features').get();
    if (!doc.exists) {
      console.warn('[Features] No features document in Firestore, using defaults');
      return DEFAULT_FEATURES;
    }

    const data = doc.data();
    console.log('[Features] Loaded from Firestore:', data);
    return { ...DEFAULT_FEATURES, ...data };
  } catch (error) {
    console.error('[Features] Error loading feature flags:', error);
    return DEFAULT_FEATURES;
  }
}

// Global access to features (loaded on page load)
window.__features = DEFAULT_FEATURES;

// Load features when Firebase is ready
if (window.__firebase) {
  loadFeatureFlags().then(features => {
    window.__features = features;
    console.log('[Features] Feature flags loaded:', features);
    // Dispatch event so components can react
    window.dispatchEvent(new CustomEvent('ww-features-loaded', { detail: features }));
  });
} else {
  // Wait for Firebase to initialize
  const interval = setInterval(() => {
    if (window.__firebase) {
      clearInterval(interval);
      loadFeatureFlags().then(features => {
        window.__features = features;
        console.log('[Features] Feature flags loaded:', features);
        window.dispatchEvent(new CustomEvent('ww-features-loaded', { detail: features }));
      });
    }
  }, 100);
}
