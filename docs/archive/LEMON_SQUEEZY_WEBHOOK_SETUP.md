# Lemon Squeezy Webhook Setup

## ✅ Step 1: Create Webhook in Lemon Squeezy Dashboard

1. **Open:** https://app.lemonsqueezy.com/settings/webhooks

2. **Click:** "Create webhook"

3. **Fill in form:**

   **Callback URL:**
   ```
   https://us-central1-whitewrite-app.cloudfunctions.net/lemonSqueezyWebhook
   ```

   **Events to subscribe** (select these 4):
   - ✅ `subscription_created`
   - ✅ `subscription_updated`
   - ✅ `subscription_cancelled`
   - ✅ `order_created`

4. **Save webhook**

5. **Copy Signing Secret:**
   - Click "Reveal" next to "Signing secret"
   - Copy the secret (long random string)

---

## ✅ Step 2: Update Firebase Secret

Run this command with the signing secret you copied:

```bash
firebase functions:secrets:set LEMON_SQUEEZY_WEBHOOK_SECRET
```

Paste the signing secret when prompted, then press Enter.

---

## ✅ Step 3: Redeploy Function

```bash
firebase deploy --only functions:lemonSqueezyWebhook
```

This updates the function with the real webhook secret.

---

## ✅ Step 4: Create Firestore Config

Open https://whitewrite.com, login, then run this in DevTools Console:

```javascript
firebase.firestore().collection('config').doc('lemon_squeezy').set({
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

  createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  updatedAt: firebase.firestore.FieldValue.serverTimestamp()
})
.then(() => console.log('✅ Lemon Squeezy config created!'))
.catch(err => console.error('❌ Error:', err));
```

---

## 🧪 Testing Checklist

### Subscriptions:
- [ ] Test Storyteller subscription → plan updates to `storyteller`
- [ ] Test Novelist subscription → plan updates to `novelist`
- [ ] Test Worldbuilder subscription → plan updates to `worldbuilder`
- [ ] Cancel subscription → plan downgrades to `free`

### Token Top-Up:
- [ ] Buy 500 tokens → balance increases by 500
- [ ] Order ID saved in `processedOrders` array
- [ ] Repeat same order → should NOT add tokens twice

### UI:
- [ ] Token balance updates without page reload
- [ ] Plan badge shows correct current plan
- [ ] "Обрати" buttons redirect to Lemon Squeezy checkout

---

## 🔍 Debugging

**Check webhook logs:**
```bash
firebase functions:log --only lemonSqueezyWebhook
```

**Check Firestore user doc:**
```
users/{uid}:
  - plan: "storyteller"
  - subscriptionStatus: "active"
  - lemonSqueezyCustomerId: "..."
  - lemonSqueezySubscriptionId: "..."
  - tokensRemaining: 2900
  - processedOrders: ["order_123", "order_456"]
```

**Test webhook manually:**
Lemon Squeezy Dashboard → Webhooks → your webhook → "Test webhook" button
