// Stripe checkout + webhook
const {
  onRequest,
  admin,
  db,
  cors,
  stripeSecretKey,
  stripeWebhookSecret,
} = require('./common');


// ============================================================================
// Phase 2: Stripe Integration
// ============================================================================

const STRIPE_PRICE_IDS = {
  storyteller: 'price_1Tj4eVK1XPrHbpbZrmiMvCwh',
  novelist: 'price_1Tj4fBK1XPrHbpbZyhlAANxB',
  worldbuilder: 'price_1Tj5PZK1XPrHbpbZJ8LpKik0'
};

/**
 * Create Stripe Checkout Session
 * Called from UI when user clicks "Обрати" plan button
 */
exports.createCheckoutSession = onRequest({ secrets: [stripeSecretKey] }, async (req, res) => {
  cors(req, res, async () => {
    try {
      const stripe = require('stripe')(stripeSecretKey.value());
      const { plan, uid, email } = req.body;

      if (!plan || !uid || !email) {
        res.status(400).json({ error: 'Missing required fields: plan, uid, email' });
        return;
      }

      const priceId = STRIPE_PRICE_IDS[plan];
      if (!priceId) {
        res.status(400).json({ error: 'Invalid plan: ' + plan });
        return;
      }

      console.log(`Creating checkout session for ${email}, plan: ${plan}`);

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1
        }],
        customer_email: email,
        client_reference_id: uid, // Link to Firebase user
        metadata: {
          plan: plan,
          uid: uid
        },
        success_url: 'https://whitewrite-app.web.app/#account?success=1',
        cancel_url: 'https://whitewrite-app.web.app/#account?canceled=1',
        allow_promotion_codes: true,
        billing_address_collection: 'required'
      });

      console.log('Checkout session created:', session.id);
      res.status(200).json({ url: session.url });

    } catch (error) {
      console.error('createCheckoutSession error:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

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
