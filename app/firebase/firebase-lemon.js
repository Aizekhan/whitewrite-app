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

  // Lemon Squeezy checkout URL (hosted)
  // https://docs.lemonsqueezy.com/help/checkout/passing-custom-data
  const checkoutUrl = new URL(`https://whitewrite.lemonsqueezy.com/checkout/buy/${variantId}`);

  // Pass user data as custom fields
  checkoutUrl.searchParams.set('checkout[email]', userEmail);
  checkoutUrl.searchParams.set('checkout[custom][user_id]', window.__wwUser?.uid || '');
  checkoutUrl.searchParams.set('checkout[custom][plan]', plan);

  return checkoutUrl.toString();
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

  const checkoutUrl = new URL(`https://whitewrite.lemonsqueezy.com/checkout/buy/${variantId}`);

  checkoutUrl.searchParams.set('checkout[email]', userEmail);
  checkoutUrl.searchParams.set('checkout[custom][user_id]', window.__wwUser?.uid || '');
  checkoutUrl.searchParams.set('checkout[custom][type]', 'token_topup');
  checkoutUrl.searchParams.set('checkout[custom][tokens]', '500');

  return checkoutUrl.toString();
}

// Export to window
window.__lemonSqueezy = {
  loadConfig: loadLemonSqueezyConfig,
  createSubscriptionCheckout,
  createTokenTopUpCheckout
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
