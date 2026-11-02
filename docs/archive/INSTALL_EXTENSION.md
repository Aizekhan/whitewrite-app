# Швидкий старт: Встановлення firestore-stripe-payments extension

**Це для тебе, щоб встановити прямо зараз.**

---

## Крок 1: Stripe — Створити Products та отримати Price IDs

1. Відкрий https://dashboard.stripe.com
2. **Переключись на Test mode** (вгорі справа)
3. Іди в **Products** → https://dashboard.stripe.com/test/products
4. **Create product:**

**Product 1:**
- Name: `WhiteWrite Storyweaver`
- Description: `2500 токенів на місяць, 10 всесвітів, Gemini API`
- Add pricing:
  - Model: Recurring
  - Price: `12` USD
  - Billing period: Monthly
- Save product
- **СКОПІЮЙ Price ID** (price_xxxxx) — збережи десь

**Product 2:**
- Name: `WhiteWrite Worldforge`
- Description: `8000 токенів на місяць, необмежено всесвітів, Claude API`
- Add pricing:
  - Model: Recurring
  - Price: `29` USD
  - Billing period: Monthly
- Save product
- **СКОПІЮЙ Price ID** (price_xxxxx)

---

## Крок 2: Stripe — Створити Restricted API Key

1. Іди в **Developers → API keys** → https://dashboard.stripe.com/test/apikeys
2. Click **"Create restricted key"**
3. Name: `WhiteWrite Firebase Extension`
4. Permissions:
   - **Customers:** Write
   - **Checkout Sessions:** Write
   - **Customer portal:** Write
   - **Subscriptions:** Read
   - **Prices:** Read
5. **Create key**
6. **СКОПІЮЙ ключ** (rk_test_...) — збережи

---

## Крок 3: Firebase — Встановити Extension

1. Відкрий https://console.firebase.google.com/project/whitewrite-app/extensions
2. Click **"Install extension"**
3. Пошук: `Run Payments with Stripe`
4. Автор: **Invertase** (не Stripe!)
5. Click **"Install in console"**
6. **Configuration:**
   - Stripe API key: `rk_test_...` (вставити зі Stripe)
   - Products collection: `products` (default)
   - Customer collection: `customers` (default)
   - Sync users: `Sync` (default)
   - Auto delete: `Auto delete` (default)
   - Location: `us-central1`
7. Click **"Install extension"**
8. Зачекай 2-3 хвилини

---

## Крок 4: Firebase Extension — Отримати Webhook URL

1. Після установки іди в Extensions → **Run Payments with Stripe**
2. Вкладка **"How this extension works"**
3. Scroll до секції **"Stripe webhook"**
4. **СКОПІЮЙ URL** (https://extensions-firestore-stripe-payments-handlewebhookevents-xxxxx.cloudfunctions.net)

---

## Крок 5: Stripe — Налаштувати Webhook

1. Іди в **Developers → Webhooks** → https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: вставити URL з Firebase Extension
4. Events to send:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. **Add endpoint**
6. **СКОПІЮЙ Signing secret** (whsec_...)

---

## Крок 6: Firebase Extension — Додати Webhook Secret

1. Firebase Console → Extensions → **Run Payments with Stripe**
2. Click **"Configure"** (вгорі)
3. Знайди **"Stripe webhook secret"**
4. Вставити `whsec_...` зі Stripe
5. **Save**

---

## Крок 7: Firestore — Додати Products

1. Відкрий https://console.firebase.google.com/project/whitewrite-app/firestore
2. Створити колекцію `products`
3. **Document 1: `storyweaver`**
   - id: `storyweaver`
   - name: `WhiteWrite Storyweaver`
   - description: `2500 токенів на місяць, 10 всесвітів, Gemini API`
   - active: `true`
   - metadata (map):
     - tokensMonthly: `2500`
     - maxProjects: `10`
     - plan: `storyweaver`

   **Subcollection: `prices`**
   - Document ID: `price_xxxxx` (твій Price ID зі Stripe для Storyweaver)
     - active: `true`
     - currency: `usd`
     - interval: `month`
     - type: `recurring`
     - unit_amount: `1200` (центів)

4. **Document 2: `worldforge`**
   - id: `worldforge`
   - name: `WhiteWrite Worldforge`
   - description: `8000 токенів на місяць, необмежено всесвітів, Claude API`
   - active: `true`
   - metadata (map):
     - tokensMonthly: `8000`
     - maxProjects: `999`
     - plan: `worldforge`

   **Subcollection: `prices`**
   - Document ID: `price_xxxxx` (твій Price ID зі Stripe для Worldforge)
     - active: `true`
     - currency: `usd`
     - interval: `month`
     - type: `recurring`
     - unit_amount: `2900` (центів)

---

## Крок 8: Firestore Security Rules — Дозволити Checkout

Extension потребує доступу до `customers/{uid}/checkout_sessions`.

Відкрий https://console.firebase.google.com/project/whitewrite-app/firestore/rules

Додай:

```
match /customers/{uid} {
  allow read, write: if request.auth.uid == uid;

  match /checkout_sessions/{id} {
    allow read, write: if request.auth.uid == uid;
  }

  match /subscriptions/{id} {
    allow read: if request.auth.uid == uid;
  }
}
```

**Publish rules**.

---

## Все готово для коду!

Тепер можна оновлювати код:
- Price IDs → UI (White.html)
- Subscription читання → AI routing (functions/index.js)

Див. STRIPE_SETUP.md для деталей.
