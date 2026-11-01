// Lemon Squeezy Integration
// Single source of truth for Lemon Squeezy checkout and config

// Load Lemon Squeezy config from Firestore
async function loadLemonSqueezyConfig() {
  try {
    const db = window.__firebase?.db;
    if (!db) {
      console.error('[LemonSqueezy] Firebase not initialized');
      return null;
    }

    const doc = await db.collection('config').doc('lemon_squeezy').get();
    if (!doc.exists) {
      console.error('[LemonSqueezy] No config document in Firestore');
      return null;
    }

    const config = doc.data();
    console.log('[LemonSqueezy] Config loaded:', config);
    return config;
  } catch (error) {
    console.error('[LemonSqueezy] Error loading config:', error);
    return null;
  }
}

// Create Lemon Squeezy checkout URL for subscription
async function createSubscriptionCheckout(plan, userEmail) {
  const config = await loadLemonSqueezyConfig();
  if (!config) {
    throw new Error('Lemon Squeezy config not found');
  }

  const variantId = config.variants[plan];
  if (!variantId) {
    throw new Error(`No variant ID for plan: ${plan}`);
  }

  // Call Cloud Function to create checkout via LS API (variant resolved server-side)
  const idToken = await window.__firebase.auth.currentUser.getIdToken();
  const response = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/createLemonSqueezyCheckout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ plan: plan, userEmail: userEmail })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Failed to create checkout');
  }

  return data.url;
}

// Create Lemon Squeezy checkout URL for token top-up
async function createTokenTopUpCheckout(userEmail) {
  const config = await loadLemonSqueezyConfig();
  if (!config) {
    throw new Error('Lemon Squeezy config not found');
  }

  const variantId = config.variants.tokens_500;
  if (!variantId) {
    throw new Error('No variant ID for 500 tokens');
  }

  // Call Cloud Function to create checkout via LS API (tokens resolved server-side)
  const idToken = await window.__firebase.auth.currentUser.getIdToken();
  const response = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/createLemonSqueezyCheckout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ topup: '500', userEmail: userEmail })
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    throw new Error(data.error || 'Failed to create checkout');
  }

  return data.url;
}

// Change an active subscription (changeSubscription): op 'quote' | 'change' | 'cancelPending'
async function changePlan(op, plan) {
  const idToken = await window.__firebase.auth.currentUser.getIdToken();
  const response = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/changeSubscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ op, plan })
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 409) return { noSubscription: true };
  if (!response.ok) throw new Error(data.error || ('HTTP ' + response.status));
  return data;
}

// Export to window
window.__lemonSqueezy = {
  loadConfig: loadLemonSqueezyConfig,
  createSubscriptionCheckout,
  createTokenTopUpCheckout,
  changePlan
};

// Load config on init
if (window.__firebase) {
  loadLemonSqueezyConfig().then(config => {
    window.__lemonSqueezyConfig = config;
  });
} else {
  // Wait for Firebase
  const interval = setInterval(() => {
    if (window.__firebase) {
      clearInterval(interval);
      loadLemonSqueezyConfig().then(config => {
        window.__lemonSqueezyConfig = config;
      });
    }
  }, 100);
}
