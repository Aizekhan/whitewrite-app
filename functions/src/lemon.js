// Lemon Squeezy checkout + webhook
const {
  onRequest,
  admin,
  db,
  cors,
  lemonSqueezyApiKey,
  lemonSqueezyWebhookSecret,
  requireAdmin,
} = require('./common');


/**
 * Create Lemon Squeezy Checkout
 * Generates checkout URL via Lemon Squeezy API
 */
exports.createLemonSqueezyCheckout = onRequest({
  secrets: [lemonSqueezyApiKey],
  cors: true
}, async (req, res) => {
  return cors(req, res, async () => {
    try {
      // Identity ONLY from verified ID token
      let decoded;
      try {
        decoded = await admin.auth().verifyIdToken((req.headers.authorization || '').split('Bearer ')[1] || '');
      } catch (e) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const userId = decoded.uid;
      const userEmail = decoded.email || req.body.userEmail || '';

      // Variant resolved server-side from config/lemon_squeezy (client only names the product)
      const { plan, topup } = req.body;
      const lsConfig = (await db.collection('config').doc('lemon_squeezy').get()).data() || {};
      let variantId = null;
      if (plan && plan !== 'free' && lsConfig.variants?.[plan] && !String(plan).startsWith('tokens_')) {
        variantId = lsConfig.variants[plan];
      } else if (topup && lsConfig.topups?.[topup]) {
        variantId = lsConfig.topups[topup].variantId;
      }
      if (!variantId) {
        return res.status(400).json({ error: 'Unknown plan or top-up' });
      }

      console.log(`[LS Checkout] Creating checkout for variant ${variantId}, user ${userId}`);

      // Call Lemon Squeezy API to create checkout
      const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
          'Authorization': `Bearer ${lemonSqueezyApiKey.value()}`
        },
        body: JSON.stringify({
          data: {
            type: 'checkouts',
            attributes: {
              checkout_data: {
                email: userEmail,
                custom: {
                  user_id: userId  // plan/tokens are derived from variant_id in the webhook
                }
              }
            },
            relationships: {
              store: {
                data: {
                  type: 'stores',
                  id: '419955'
                }
              },
              variant: {
                data: {
                  type: 'variants',
                  id: variantId.toString()
                }
              }
            }
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[LS Checkout] API error:', data);
        return res.status(response.status).json({ error: data.errors || 'Failed to create checkout' });
      }

      const checkoutUrl = data.data.attributes.url;
      console.log('[LS Checkout] Created:', checkoutUrl);

      res.status(200).json({ url: checkoutUrl });

    } catch (error) {
      console.error('[LS Checkout] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

/**
 * Initialize Lemon Squeezy Config (one-time setup)
 * Creates config/lemon_squeezy document in Firestore
 */
exports.initLemonSqueezyConfig = onRequest({}, async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    await db.collection('config').doc('lemon_squeezy').set({
      storeId: '419955',

      variants: {
        storyteller: '1849926',
        novelist: '1849976',
        worldbuilder: '1849991',
        tokens_500: '1850008'
      },

      topups: {
        '500': {
          variantId: '1850008',
          tokens: 500,
          price: 5
        }
      },

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('[LemonSqueezy] Config created successfully');

    res.status(200).json({
      success: true,
      message: 'Lemon Squeezy config created',
      config: {
        storeId: '419955',
        variants: {
          storyteller: '1849926',
          novelist: '1849976',
          worldbuilder: '1849991',
          tokens_500: '1850008'
        }
      }
    });
  } catch (error) {
    console.error('[LemonSqueezy] Config creation failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Lemon Squeezy Webhook Handler
 * Listens to subscription and order events, updates user plan/tokens in Firestore
 *
 * Events handled:
 * - subscription_created → activate subscription, update plan
 * - subscription_updated → sync subscription status
 * - subscription_cancelled → plan stays until ends_at (cancelAtPeriodEnd); subscription_expired / status expired → free
 * - order_created → add tokens for one-time purchases (token top-ups)
 */
async function downgradeToFree(uid) {
  await db.collection('users').doc(uid).update({
    plan: 'free',
    lemonSqueezySubscriptionId: null,
    subscriptionStatus: 'canceled',
    cancelAtPeriodEnd: false,
    subscriptionEndsAt: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

exports.lemonSqueezyWebhook = onRequest({
  secrets: [lemonSqueezyWebhookSecret]
}, async (req, res) => {
  const crypto = require('crypto');

  try {
    // Verify webhook signature
    const signature = req.headers['x-signature'];
    const secret = lemonSqueezyWebhookSecret.value();

    if (!signature) {
      console.error('Missing X-Signature header');
      return res.status(401).send('Missing signature');
    }

    // Lemon Squeezy uses HMAC SHA256 over the RAW request body
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(req.rawBody);
    const digest = Buffer.from(hmac.digest('hex'), 'utf8');
    const received = Buffer.from(String(signature), 'utf8');

    if (received.length !== digest.length || !crypto.timingSafeEqual(received, digest)) {
      console.error('Invalid signature');
      return res.status(401).send('Invalid signature');
    }

    const event = req.body;

    // Plans / top-ups are derived from variant_id via config/lemon_squeezy (never from custom_data)
    const lsConfig = (await db.collection('config').doc('lemon_squeezy').get()).data() || {};
    const planByVariant = {};
    for (const [planName, variant] of Object.entries(lsConfig.variants || {})) {
      if (!planName.startsWith('tokens_')) planByVariant[String(variant)] = planName;
    }
    const tokensByVariant = {};
    for (const t of Object.values(lsConfig.topups || {})) {
      tokensByVariant[String(t.variantId)] = t.tokens;
    }
    console.log('[LemonSqueezy] Webhook event:', event.meta?.event_name);

    switch (event.meta?.event_name) {
      case 'subscription_created': {
        const subscription = event.data;
        // LS sends checkout custom data in the event's meta.custom_data
        const customData = event.meta?.custom_data || subscription.attributes.first_subscription_item?.meta?.custom_data || {};
        const uid = customData.user_id;
        const plan = planByVariant[String(subscription.attributes.variant_id)];

        if (!uid || !plan) {
          console.error('[LemonSqueezy] Missing uid or unknown variant in subscription:', subscription.id, subscription.attributes.variant_id);
          break;
        }

        console.log(`[LemonSqueezy] Subscription created: ${uid} → ${plan}`);

        // Update user plan in Firestore (new billing period starts now)
        await db.collection('users').doc(uid).update({
          plan: plan,
          tokensUsed: 0,
          periodStart: admin.firestore.Timestamp.now(),
          lemonSqueezyCustomerId: subscription.attributes.customer_id,
          lemonSqueezySubscriptionId: subscription.id,
          subscriptionStatus: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[LemonSqueezy] User ${uid} upgraded to ${plan}`);
        break;
      }

      case 'subscription_updated': {
        const subscription = event.data;
        const subscriptionId = subscription.id;

        // Find user by lemonSqueezySubscriptionId
        const userSnapshot = await db.collection('users')
          .where('lemonSqueezySubscriptionId', '==', subscriptionId)
          .limit(1)
          .get();

        if (userSnapshot.empty) {
          console.error('[LemonSqueezy] No user found for subscription:', subscriptionId);
          break;
        }

        const userDoc = userSnapshot.docs[0];
        const uid = userDoc.id;

        // Update subscription status (+ plan, if the variant changed on upgrade/downgrade)
        const status = subscription.attributes.status; // active, on_trial, past_due, cancelled (paid until ends_at), expired…
        if (status === 'expired') { await downgradeToFree(uid); console.log(`[LemonSqueezy] Subscription expired for ${uid}`); break; }
        const graceUntil = status === 'cancelled' ? Date.parse(subscription.attributes.ends_at || '') : NaN;
        const inGrace = graceUntil > Date.now(); // cancelled, but the paid period hasn't ended: keep the plan working
        const updates = {
          subscriptionStatus: inGrace ? 'active' : status,
          cancelAtPeriodEnd: inGrace,
          subscriptionEndsAt: inGrace ? admin.firestore.Timestamp.fromMillis(graceUntil) : null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const variantPlan = planByVariant[String(subscription.attributes.variant_id)];
        if (status === 'active' && variantPlan) updates.plan = variantPlan;
        await db.collection('users').doc(uid).update(updates);

        console.log(`[LemonSqueezy] Subscription ${status} for ${uid}`);
        break;
      }

      case 'subscription_expired':
      case 'subscription_cancelled': {
        const subscription = event.data;
        const subscriptionId = subscription.id;

        // Find user by lemonSqueezySubscriptionId
        const userSnapshot = await db.collection('users')
          .where('lemonSqueezySubscriptionId', '==', subscriptionId)
          .limit(1)
          .get();

        if (userSnapshot.empty) {
          console.error('[LemonSqueezy] No user found for subscription:', subscriptionId);
          break;
        }

        const userDoc = userSnapshot.docs[0];
        const uid = userDoc.id;

        // Cancelled = paid until ends_at (Lemon Squeezy keeps it until then); expired = it's over
        const endsAt = Date.parse(subscription.attributes.ends_at || '');
        if (event.meta.event_name === 'subscription_cancelled' && endsAt > Date.now()) {
          console.log(`[LemonSqueezy] Subscription cancelled for ${uid}, plan stays until ${subscription.attributes.ends_at}`);
          await db.collection('users').doc(uid).update({
            cancelAtPeriodEnd: true,
            subscriptionEndsAt: admin.firestore.Timestamp.fromMillis(endsAt),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          break;
        }
        console.log(`[LemonSqueezy] Subscription over for ${uid}, downgrading to free`);
        await downgradeToFree(uid);
        break;
      }

      case 'order_created': {
        const order = event.data;
        const customData = event.meta?.custom_data || order.attributes.first_order_item?.meta?.custom_data || {};
        const uid = customData.user_id;
        const tokens = tokensByVariant[String(order.attributes.first_order_item?.variant_id)] || 0;
        const orderId = order.id;

        if (!uid || !tokens) {
          console.log('[LemonSqueezy] Order created, but not a token top-up:', orderId);
          break;
        }

        console.log(`[LemonSqueezy] Token top-up order: ${uid} → +${tokens} tokens (order: ${orderId})`);

        // Idempotent credit (transaction): purchased tokens go to bonusTokens (persist across periods)
        const userRef = db.collection('users').doc(uid);
        const credited = await db.runTransaction(async (tx) => {
          const userDoc = await tx.get(userRef);
          if (!userDoc.exists) {
            console.error('[LemonSqueezy] User not found:', uid);
            return false;
          }
          const processedOrders = userDoc.data().processedOrders || [];
          if (processedOrders.includes(orderId)) {
            console.log(`[LemonSqueezy] Order ${orderId} already processed, skipping`);
            return false;
          }
          tx.update(userRef, {
            bonusTokens: admin.firestore.FieldValue.increment(tokens),
            processedOrders: admin.firestore.FieldValue.arrayUnion(orderId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return true;
        });
        if (!credited) break;

        console.log(`[LemonSqueezy] Added ${tokens} tokens to user ${uid}`);
        break;
      }

      default:
        console.log(`[LemonSqueezy] Unhandled event type: ${event.meta?.event_name}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('[LemonSqueezy] Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});
