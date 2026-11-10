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
    if (!window.__firebase.auth?.currentUser) return null; // config/* is readable only after sign-in (firestore.rules) — no console error for guests

    const doc = await db.collection('config').doc('lemon_squeezy').get();
    if (!doc.exists) {
      console.error('[LemonSqueezy] No config document in Firestore');
      return null;
    }

    const config = doc.data();
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) throw checkoutError(response, data);

  return data.url;
}

// the server's refusal reaches the author: 409 HAS_SUBSCRIPTION / SUBSCRIPTION_ON_HOLD → its own words (i18n), else the server's message
function checkoutError(response, data) {
  const t = window.__i18n ? window.__i18n.t : (k) => k;
  const key = { HAS_SUBSCRIPTION: 'alert.hasSubscription', SUBSCRIPTION_ON_HOLD: 'alert.subscriptionOnHold' }[data.code];
  const msg = key && t(key) !== key ? t(key) : (data.error || ('HTTP ' + response.status));
  const e = new Error(msg); e.code = data.code || null; e.status = response.status;
  return e;
}

// Акаунт → «Керувати оплатою»: the LS customer portal (card, invoices, resume), signed fresh by changeSubscription {op:'portal'}
async function openPortal() {
  const idToken = await window.__firebase.auth.currentUser.getIdToken();
  const response = await fetch('https://us-central1-whitewrite-app.cloudfunctions.net/changeSubscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify({ op: 'portal' })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.portal) throw new Error(data.error || ('HTTP ' + response.status));
  return data.portal;
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.error) throw checkoutError(response, data);

  return data.url;
}

// Change an active subscription (changeSubscription): op 'quote' | 'change' | 'cancelPending' (op 'portal' — openPortal)
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
  createSubscriptionCheckout,
  createTokenTopUpCheckout,
  changePlan,
  openPortal
};
