// Stripe checkout + webhook
const {
  onRequest,
  admin,
  db,
  stripeSecretKey,
  stripeWebhookSecret,
} = require('./common');


// ============================================================================
// Phase 2: Stripe Integration
// ============================================================================

// Legacy: subscriptions are sold through Lemon Squeezy (lemon.js). Stripe Checkout (createCheckoutSession) was removed in
// the 2026-11-03 audit — nothing calls it and it opened real subscriptions without the token period logic. The webhook
// stays so cancellations of any old Stripe subscription still downgrade the account.

/**
 * Stripe Webhook Handler
 * Listens to subscription events and updates user plan in Firestore
 */
exports.stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const stripe = require('stripe')(stripeSecretKey.value());
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      stripeWebhookSecret.value()
    );

    console.log('Webhook event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.client_reference_id || session.metadata?.uid;
        const plan = session.metadata?.plan;

        if (!uid || !plan) {
          console.error('Missing uid or plan in checkout session:', session.id);
          break;
        }

        console.log(`Checkout completed: ${uid} → ${plan}`);

        // Update user plan in Firestore
        await db.collection('users').doc(uid).update({
          plan: plan,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          subscriptionStatus: 'active',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`User ${uid} upgraded to ${plan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by stripeCustomerId
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (userSnapshot.empty) {
          console.error('No user found for customer:', customerId);
          break;
        }

        const userDoc = userSnapshot.docs[0];
        const uid = userDoc.id;

        // Update subscription status
        await db.collection('users').doc(uid).update({
          subscriptionStatus: subscription.status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Subscription ${subscription.status} for ${uid}`);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        // Find user by stripeCustomerId
        const userSnapshot = await db.collection('users')
          .where('stripeCustomerId', '==', customerId)
          .limit(1)
          .get();

        if (userSnapshot.empty) {
          console.error('No user found for customer:', customerId);
          break;
        }

        const userDoc = userSnapshot.docs[0];
        const uid = userDoc.id;

        console.log(`Subscription canceled for ${uid}, downgrading to free`);

        // Downgrade to free plan
        await db.collection('users').doc(uid).update({
          plan: 'free',
          stripeSubscriptionId: null,
          subscriptionStatus: 'canceled',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});
