// Lemon Squeezy checkout + webhook
const {
  onRequest,
  admin,
  db,
  cors,
  lemonSqueezyApiKey,
  lemonSqueezyWebhookSecret,
  getPlanBudget,
  getBalance,
  verifyAuth,
} = require('./common');
const ledger = require('./ledger'); // users/{uid}/ledger — «Історія токенів»
const { PLAN_ORDER, PLANS, planRank, upgradeQuote } = require('../paid-features.js');
// outbound calls time out: a hanging remote must not hold the function until its own timeout
const fetch = (url, o = {}) => globalThis.fetch(url, { signal: AbortSignal.timeout(20000), ...o });

const LS_API = 'https://api.lemonsqueezy.com/v1/subscriptions/';
const lsHeaders = () => ({ 'Accept': 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', 'Authorization': `Bearer ${lemonSqueezyApiKey.value()}` });
const MONTH_MS = 30 * 24 * 3600 * 1000;
const millis = (t) => (t && t.toMillis ? t.toMillis() : 0);

// Checkout custom data carries the uid AND its HMAC (keyed by the webhook secret). LS hosted checkout links accept
// checkout[custom][user_id]=… from anyone, so an unsigned uid is trusted only when the buyer's email is that user's.
const uidSig = (uid) => require('crypto').createHmac('sha256', lemonSqueezyWebhookSecret.value()).update('uid:' + uid).digest('hex').slice(0, 32);
async function trustedUid(custom, email) {
  const uid = custom && typeof custom.user_id === 'string' ? custom.user_id : '';
  if (!uid) return '';
  if (custom.sig) {
    const a = Buffer.from(String(custom.sig)), b = Buffer.from(uidSig(uid));
    if (a.length === b.length && require('crypto').timingSafeEqual(a, b)) return uid;
  }
  const u = await admin.auth().getUser(uid).catch(() => null);
  if (u && u.email && email && u.email.toLowerCase() === String(email).trim().toLowerCase()) return uid;
  console.error('[LemonSqueezy] Untrusted custom user_id (no valid signature, email differs):', uid);
  return '';
}

/**
 * Change an ACTIVE subscription's plan (owner decision 2026-11-02):
 *  - up:   now — LS PATCH variant + invoice_immediately (prorated difference charged at once);
 *          tokens: the budget difference opens prorated to the days left, minus the switch fee (paid-features upgradeQuote)
 *  - down: from the next billing month — LS PATCH variant + disable_prorations (new price at renewal, no credit);
 *          the plan stays until renews_at (users.pendingPlan / pendingFrom; the webhook applies it after that date)
 *  - free: cancel at the period end (LS cancelled: true; the webhook keeps the plan until ends_at)
 * Body: { op: 'quote'|'change'|'cancelPending', plan }
 */
exports.changeSubscription = onRequest({ secrets: [lemonSqueezyApiKey], cors: true, timeoutSeconds: 60 }, async (req, res) => {
  return cors(req, res, async () => {
    let uid = null;
    try { uid = await verifyAuth(req.headers.authorization); } catch (e) { uid = null; }
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { op = 'quote', plan: target } = req.body || {};
      const userRef = db.collection('users').doc(uid);
      const user = (await userRef.get()).data() || {};
      const subId = user.lemonSqueezySubscriptionId;
      if (!subId || user.subscriptionStatus !== 'active') return res.status(409).json({ code: 'NO_SUBSCRIPTION', error: 'No active subscription — use checkout' });
      const lsConfig = (await db.collection('config').doc('lemon_squeezy').get()).data() || {};
      const variants = lsConfig.variants || {};
      const cur = user.plan || 'free';

      const sr = await fetch(LS_API + subId, { headers: lsHeaders() });
      const sub = (await sr.json()).data;
      if (!sr.ok || !sub) return res.status(502).json({ error: 'Lemon Squeezy: subscription not found' });
      const A = sub.attributes;
      if (A.payment_processor === 'paypal') return res.json({ portal: A.urls && A.urls.customer_portal_update_subscription }); // LS can't PATCH PayPal
      const renewsAt = Date.parse(A.renews_at || '') || (Date.now() + MONTH_MS);
      const left = Math.min(1, Math.max(0, (renewsAt - Date.now()) / MONTH_MS));
      const patch = (attributes) => fetch(LS_API + subId, { method: 'PATCH', headers: lsHeaders(),
        body: JSON.stringify({ data: { type: 'subscriptions', id: String(subId), attributes } }) })
        .then(async (r) => { if (!r.ok) throw new Error('Lemon Squeezy: ' + JSON.stringify((await r.json().catch(() => ({}))).errors || r.status)); });

      if (op === 'cancelPending') {
        if (!user.pendingPlan) return res.json({ ok: true });
        if (user.pendingPlan === 'free') await patch({ cancelled: false });
        else await patch({ variant_id: Number(variants[cur]), disable_prorations: true });
        await userRef.update({ pendingPlan: null, pendingFrom: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ ok: true });
      }

      if (!PLAN_ORDER.includes(target) || target === cur) return res.status(400).json({ error: 'Unknown or current plan' });
      if (target !== 'free' && !variants[target]) return res.status(400).json({ error: 'No variant for plan' });
      const kind = planRank(target) > planRank(cur) ? 'up' : 'down';
      const quote = kind === 'up' ? upgradeQuote(cur, target, left) : null;
      if (op === 'quote') return res.json({ kind, from: cur, to: target, renewsAt: new Date(renewsAt).toISOString(), left, quote });
      if (op !== 'change') return res.status(400).json({ error: 'Unknown op' });

      if (kind === 'up') {
        // the webhook's subscription_updated can arrive before we finish: `upgrading` tells it the tokens are prorated here
        await userRef.update({ upgrading: { to: target, at: admin.firestore.Timestamp.now() } });
        try { await patch({ variant_id: Number(variants[target]), invoice_immediately: true }); }
        catch (e) { await userRef.update({ upgrading: null }); throw e; }
        // tokens for the rest of the period: the old plan's unused part stays, the new plan adds its difference × left; the fee is taken
        const b = getBalance(user);
        const newMonthly = getPlanBudget(target).monthly;
        const used = Math.max(0, newMonthly - (b.monthlyLeft + quote.tokens - quote.fee));
        const upd = { plan: target, tokensUsed: used, pendingPlan: null, pendingFrom: null, upgrading: null, lastUpgrade: { from: cur, to: target, fee: quote.fee, usd: quote.usd, at: admin.firestore.Timestamp.now() },
          updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        if (b.expired) upd.periodStart = admin.firestore.Timestamp.now();
        await userRef.update(upd);
        ledger.record(db, uid, { type: 'grant', op: 'plan_upgrade', amount: Math.max(0, quote.tokens), ref: { plan: target }, note: cur + ' → ' + target });
        ledger.record(db, uid, { type: 'spend', op: 'plan_upgrade_fee', amount: -quote.fee, ref: { plan: target } });
        await db.collection('usage_logs').add({ uid, operation: 'plan_upgrade_fee', userTokensCharged: quote.fee, realApiCostUSD: 0, billing: 'fixed',
          from: cur, to: target, timestamp: admin.firestore.FieldValue.serverTimestamp() });
        return res.json({ ok: true, kind, plan: target, quote });
      }
      // pendingPlan BEFORE the PATCH: LS's subscription_updated may arrive before we return, and must see the downgrade is scheduled
      await userRef.update({ pendingPlan: target, pendingFrom: admin.firestore.Timestamp.fromMillis(renewsAt), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      try {
        if (target === 'free') await patch({ cancelled: true });
        else await patch({ variant_id: Number(variants[target]), disable_prorations: true });
      } catch (e) {
        await userRef.update({ pendingPlan: user.pendingPlan || null, pendingFrom: user.pendingFrom || null });
        throw e;
      }
      return res.json({ ok: true, kind, plan: cur, pendingPlan: target, pendingFrom: new Date(renewsAt).toISOString() });
    } catch (error) {
      console.error('[changeSubscription]', error);
      res.status(500).json({ error: error.message });
    }
  });
});


/**
 * Create Lemon Squeezy Checkout
 * Generates checkout URL via Lemon Squeezy API
 */
exports.createLemonSqueezyCheckout = onRequest({
  secrets: [lemonSqueezyApiKey, lemonSqueezyWebhookSecret],
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
      // a second subscription would bill twice and fight the first one over users/{uid}: plan changes go through changeSubscription
      if (!topup) {
        const u = (await db.collection('users').doc(userId).get()).data() || {};
        if (u.lemonSqueezySubscriptionId && u.subscriptionStatus === 'active') return res.status(409).json({ code: 'HAS_SUBSCRIPTION', error: 'You already have a subscription — change the plan instead' });
        // a paused / unpaid / past-due subscription is resumed or paid in the LS portal, not doubled by a second one
        if (u.lemonSqueezySubscriptionId && ['paused', 'unpaid', 'past_due'].includes(u.subscriptionStatus)) return res.status(409).json({ code: 'SUBSCRIPTION_ON_HOLD', error: 'Your subscription is paused or unpaid — resume it or update the payment in the billing portal' });
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
                  user_id: userId,  // plan/tokens are derived from variant_id in the webhook
                  sig: uidSig(userId) // the webhook trusts user_id only with this (trustedUid)
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
    paidPlan: admin.firestore.FieldValue.delete(),
    pendingPlan: null,
    pendingFrom: null,
    lemonSqueezySubscriptionId: null,
    subscriptionStatus: 'canceled',
    cancelAtPeriodEnd: false,
    subscriptionEndsAt: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

// a refund: bought tokens (bonus) and / or this period's allowance (monthly) go back, once per refund id
async function takeBack(userRef, refundId, { bonus = 0, monthly = 0 }, op, note) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef), d = snap.data() || {};
    if ((d.processedRefunds || []).includes(refundId)) return;
    const b = getBalance(d), fromBonus = Math.min(bonus, b.bonus), fromMonthly = Math.min(monthly, b.monthlyLeft);
    const upd = { processedRefunds: admin.firestore.FieldValue.arrayUnion(refundId), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (fromBonus) upd.bonusTokens = b.bonus - fromBonus;
    if (fromMonthly) upd.tokensUsed = b.used + fromMonthly;
    tx.update(userRef, upd);
    ledger.txRecord(tx, db, userRef.id, { type: 'spend', op, amount: -(fromBonus + fromMonthly), balance: b.available - fromBonus - fromMonthly, ref: { refundId },
      note: 'Lemon Squeezy refund' + (note ? ' · ' + note : '') + ((bonus - fromBonus) + (monthly - fromMonthly) > 0 ? ` (already spent: ${(bonus - fromBonus) + (monthly - fromMonthly)})` : '') });
  });
  console.log(`[LemonSqueezy] Refund ${refundId}: took back bonus ${bonus}, monthly ${monthly} from ${userRef.id}`);
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
        const uid = await trustedUid(customData, subscription.attributes.user_email);
        const plan = planByVariant[String(subscription.attributes.variant_id)];

        if (!uid || !plan) {
          console.error('[LemonSqueezy] Missing uid or unknown variant in subscription:', subscription.id, subscription.attributes.variant_id);
          break;
        }

        console.log(`[LemonSqueezy] Subscription created: ${uid} → ${plan}`);

        // Update user plan in Firestore (new billing period starts now). Idempotent: a redelivered event (LS retry,
        // «Resend» in the dashboard) must not open a fresh month again.
        const subRef = db.collection('users').doc(uid);
        const fresh = await db.runTransaction(async (tx) => {
          const cur = await tx.get(subRef);
          if (!cur.exists || String(cur.data().lemonSqueezySubscriptionId || '') === String(subscription.id)) return false;
          tx.update(subRef, {
            plan: plan,
            tokensUsed: 0,
            periodStart: admin.firestore.Timestamp.now(),
            lemonSqueezyCustomerId: subscription.attributes.customer_id,
            lemonSqueezySubscriptionId: subscription.id,
            subscriptionStatus: 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          return true;
        });
        if (!fresh) { console.log(`[LemonSqueezy] Subscription ${subscription.id} already applied (or no user), skipping`); break; }

        ledger.record(db, uid, { type: 'grant', op: 'monthly', amount: getPlanBudget(plan).monthly, ref: { plan }, note: 'subscription' });
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
        const u = userDoc.data(), pendingFrom = u.pendingFrom && u.pendingFrom.toMillis ? u.pendingFrom.toMillis() : 0;
        // paused, or unpaid after LS gave up retrying: nothing is paid → every plan gate closes (plan free); the paid plan is
        // remembered and comes back when the subscription is active again. past_due (LS still retrying) keeps the plan.
        if (status === 'paused' || status === 'unpaid') {
          if ((u.plan || 'free') !== 'free') { updates.plan = 'free'; updates.paidPlan = u.plan; }
        } else if (status === 'active' && variantPlan && u.paidPlan) { // resumed: the plan returns as it was, no upgrade proration
          updates.plan = variantPlan; updates.paidPlan = admin.firestore.FieldValue.delete();
        } else if (status === 'active' && variantPlan) {
          // a scheduled downgrade (changeSubscription) only takes effect from the next billing month
          const waiting = u.pendingPlan === variantPlan && pendingFrom > Date.now(); // keep the paid plan until pendingFrom
          if (!waiting) { updates.plan = variantPlan; if (u.pendingPlan === variantPlan) { updates.pendingPlan = null; updates.pendingFrom = null; } }
          // a higher plan chosen OUTSIDE the app (LS customer portal — PayPal subscriptions are sent there): open the new
          // budget prorated to the days left minus the switch fee, exactly like changeSubscription — not the whole month at once
          const cur = u.plan || 'free';
          const inApp = u.upgrading && u.upgrading.to === variantPlan && Date.now() - millis(u.upgrading.at) < 15 * 60 * 1000; // changeSubscription prorates itself
          if (!waiting && !inApp && planRank(variantPlan) > planRank(cur)) {
            const renewsAt = Date.parse(subscription.attributes.renews_at || '') || (Date.now() + MONTH_MS);
            const left = Math.min(1, Math.max(0, (renewsAt - Date.now()) / MONTH_MS));
            const quote = upgradeQuote(cur, variantPlan, left), b = getBalance(u);
            updates.tokensUsed = Math.max(0, getPlanBudget(variantPlan).monthly - (b.monthlyLeft + quote.tokens - quote.fee));
            if (b.expired) updates.periodStart = admin.firestore.Timestamp.now();
            updates.lastUpgrade = { from: cur, to: variantPlan, fee: quote.fee, usd: quote.usd, at: admin.firestore.Timestamp.now(), via: 'portal' };
            ledger.record(db, uid, { type: 'grant', op: 'plan_upgrade', amount: Math.max(0, quote.tokens), ref: { plan: variantPlan }, note: cur + ' → ' + variantPlan + ' (portal)' });
            ledger.record(db, uid, { type: 'spend', op: 'plan_upgrade_fee', amount: -quote.fee, ref: { plan: variantPlan } });
          }
        }
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

      case 'subscription_payment_success': { // renewal paid: a scheduled downgrade becomes the plan
        const subscriptionId = String(event.data.attributes.subscription_id || '');
        const snap = await db.collection('users').where('lemonSqueezySubscriptionId', '==', subscriptionId).limit(1).get();
        if (snap.empty) break;
        const u = snap.docs[0].data(), from = u.pendingFrom && u.pendingFrom.toMillis ? u.pendingFrom.toMillis() : 0;
        if (u.pendingPlan && u.pendingPlan !== 'free' && from <= Date.now() + 3600 * 1000) {
          await snap.docs[0].ref.update({ plan: u.pendingPlan, pendingPlan: null, pendingFrom: null, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          console.log(`[LemonSqueezy] Scheduled downgrade applied for ${snap.docs[0].id} → ${u.pendingPlan}`);
        }
        break;
      }

      case 'order_created': {
        const order = event.data;
        const customData = event.meta?.custom_data || order.attributes.first_order_item?.meta?.custom_data || {};
        const uid = await trustedUid(customData, order.attributes.user_email);
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
          ledger.txRecord(tx, db, uid, { type: 'topup', op: 'topup', amount: tokens, balance: getBalance(userDoc.data()).available + tokens, ref: { orderId: String(orderId) },
            note: order.attributes && order.attributes.total_formatted ? 'Lemon Squeezy · ' + order.attributes.total_formatted : 'Lemon Squeezy' });
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

      // Refunds (issued by the store owner in LS) take back what the money bought — proportionally for a partial refund;
      // once per refund id (processedRefunds). Bought tokens already spent cannot go below zero.
      case 'order_refunded': { // a token top-up
        const order = event.data, orderId = order.id, A = order.attributes || {};
        const tokens = tokensByVariant[String(A.first_order_item?.variant_id)] || 0;
        if (!tokens) break; // a subscription's order: subscription_payment_refunded handles it
        const snap = await db.collection('users').where('processedOrders', 'array-contains', orderId).limit(1).get();
        if (snap.empty) { console.error('[LemonSqueezy] Refund for an unknown top-up order:', orderId); break; }
        const part = A.total > 0 ? Math.min(1, (A.refunded_amount || A.total) / A.total) : 1;
        await takeBack(snap.docs[0].ref, 'order_' + orderId, { bonus: Math.round(tokens * part) }, 'topup_refund', A.refunded_amount_formatted || '');
        break;
      }
      case 'subscription_payment_refunded': { // a subscription invoice (first month, renewal or an upgrade's difference)
        const inv = event.data, A = inv.attributes || {};
        const snap = await db.collection('users').where('lemonSqueezySubscriptionId', '==', String(A.subscription_id || '')).limit(1).get();
        if (snap.empty) { console.error('[LemonSqueezy] Refund for an unknown subscription:', A.subscription_id); break; }
        const plan = snap.docs[0].data().plan || 'free', price = (PLANS[plan] || {}).price || 0;
        const refunded = (A.refunded_amount || A.total || 0) / 100; // cents → $
        const monthly = getPlanBudget(plan).monthly;
        await takeBack(snap.docs[0].ref, 'inv_' + inv.id, { monthly: price > 0 ? Math.min(monthly, Math.round(monthly * refunded / price)) : 0 }, 'subscription_refund', A.refunded_amount_formatted || '');
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
