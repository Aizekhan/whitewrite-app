# Налаштування Stripe для WhiteWrite

**Підхід:** Використовуємо офіційне Firebase Extension **firestore-stripe-payments** від Invertase (раніше підтримувалось Stripe, тепер Invertase).

## Що робить розширення

✅ Автоматична синхронізація підписок у Firestore
✅ Custom claims у Firebase Auth (рольовий доступ)
✅ Автоматична обробка webhook'ів
✅ Customer Portal для керування підписками
✅ Створення checkout-сесій через Firestore

---

## Крок 1: Увімкнути Test Mode в Stripe

1. Відкрийте [Stripe Dashboard](https://dashboard.stripe.com)
2. **Перемкніть на Test mode** (перемикач угорі справа)
3. Усі налаштування робимо в тестовому режимі
4. На Live перейдете, коли все працюватиме

---

## Крок 2: Створити Products і Prices

1. Відкрийте [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products)
2. Натисніть **"+ Add product"**

### Product 1: Storyweaver
- **Name:** WhiteWrite Storyweaver
- **Description:** 2500 токенів на місяць, 10 всесвітів, Gemini API
- **Pricing:**
  - **Price:** $12.00 USD
  - **Billing period:** Monthly
  - **Payment type:** Recurring
- Натисніть **"Save product"**
- **Скопіюйте Price ID** (формат: `price_xxxxx`) — знадобиться для UI

### Product 2: Worldforge
- **Name:** WhiteWrite Worldforge
- **Description:** 8000 токенів на місяць, необмежено всесвітів, Claude API
- **Pricing:**
  - **Price:** $29.00 USD
  - **Billing period:** Monthly
  - **Payment type:** Recurring
- Натисніть **"Save product"**
- **Скопіюйте Price ID** (формат: `price_xxxxx`)

---

## Крок 3: Створити Restricted API Key

Розширення потребує **restricted key** (не секретний повний ключ).

1. Відкрийте [Stripe Dashboard → API Keys](https://dashboard.stripe.com/test/apikeys)
2. Натисніть **"Create restricted key"**
3. **Назва:** `WhiteWrite Firebase Extension`
4. **Permissions:**
   - **Customers:** Write
   - **Checkout Sessions:** Write
   - **Customer portal:** Write
   - **Subscriptions:** Read
   - **Prices:** Read
5. Натисніть **"Create key"**
6. **Скопіюйте ключ** (формат: `rk_test_...`) — знадобиться для extension

---

## Крок 4: Встановити Firebase Extension

1. Відкрийте [Firebase Console → Extensions](https://console.firebase.google.com/project/whitewrite-app/extensions)
2. Натисніть **"Install extension"**
3. Знайдіть **"Run Payments with Stripe"** від **Invertase**
4. Натисніть **"Install in console"**

### Конфігурація extension:

- **Stripe API key with restricted access:** вставте `rk_test_...` (зі Stripe Dashboard)
- **Products and pricing plans collection:** `products` (default)
- **Customer details and subscriptions collection:** `customers` (default)
- **Sync new users to Stripe customers and Cloud Firestore:** `Sync` (default)
- **Automatically delete Stripe customer objects:** `Auto delete` (default)
- **Delete customer data from Cloud Firestore:** `Auto delete` (default)
- **Cloud Functions deployment location:** `us-central1` (ваш регіон)

5. Натисніть **"Install extension"**
6. Дочекайтеся завершення установки (2-3 хвилини)

---

## Крок 5: Налаштувати Webhook в Stripe

Після установки extension створить webhook endpoint URL. Його потрібно додати в Stripe.

1. Відкрийте Firebase Console → Extensions → **Run Payments with Stripe**
2. Перейдіть на вкладку **"How this extension works"**
3. Знайдіть секцію **"Stripe webhook"** і скопіюйте **webhook URL**
   (формат: `https://extensions-firestore-stripe-payments-handlewebhookevents-xxxxx.cloudfunctions.net`)
4. Відкрийте [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/test/webhooks)
5. Натисніть **"+ Add endpoint"**
6. **Endpoint URL:** вставте скопійований URL
7. **Events to send:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
8. Натисніть **"Add endpoint"**
9. **Скопіюйте Webhook signing secret** (формат: `whsec_...`)
10. Поверніться в Firebase Console → Extensions → **Configure**
11. Додайте **Stripe webhook secret:** вставте `whsec_...`
12. Збережіть

---

## Крок 6: Додати Products в Firestore

Extension читає продукти з колекції `products`. Треба вручну додати Price IDs.

1. Відкрийте [Firestore Console](https://console.firebase.google.com/project/whitewrite-app/firestore)
2. Створіть колекцію **`products`** (якщо немає)
3. Додайте два документи:

### Документ 1: `storyweaver`
```
id: storyweaver
name: WhiteWrite Storyweaver
description: 2500 токенів на місяць, 10 всесвітів, Gemini API
active: true
metadata:
  tokensMonthly: 2500
  maxProjects: 10
  plan: storyweaver
```

Підколекція **`prices`**:
```
id: price_xxxxx (ваш Price ID зі Stripe)
active: true
currency: usd
interval: month
type: recurring
unit_amount: 1200 (центів, тобто $12.00)
```

### Документ 2: `worldforge`
```
id: worldforge
name: WhiteWrite Worldforge
description: 8000 токенів на місяць, необмежено всесвітів, Claude API
active: true
metadata:
  tokensMonthly: 8000
  maxProjects: 999
  plan: worldforge
```

Підколекція **`prices`**:
```
id: price_xxxxx (ваш Price ID зі Stripe)
active: true
currency: usd
interval: month
type: recurring
unit_amount: 2900 (центів, тобто $29.00)
```

---

## Крок 7: Оновити UI для Checkout

Extension створює checkout-сесії через Firestore. Потрібно оновити план-кнопки.

Відкрийте `app/White.html` і замініть обробник кнопок (~1242 рядок):

```javascript
// План-кнопки
[].forEach.call(document.querySelectorAll(".plan__btn"), function (b) {
  b.onclick = async function () {
    var targetPlan = b.dataset.plan;

    if (targetPlan === 'seed') {
      alert('Повернення на безкоштовний план поки недоступне. Зв\'яжіться з підтримкою.');
      return;
    }

    var u = window.__wwUser;
    if (!u.uid) {
      alert('Спочатку увійдіть в акаунт');
      return;
    }

    // Price IDs зі Stripe Dashboard
    var priceIds = {
      storyweaver: 'price_xxxxx', // TODO: Replace with real Price ID
      worldforge: 'price_xxxxx'   // TODO: Replace with real Price ID
    };

    var priceId = priceIds[targetPlan];
    if (!priceId) {
      alert('План не знайдено');
      return;
    }

    try {
      // Створити checkout session через Firestore
      const db = window.__firebase.db;
      const checkoutRef = await db.collection('customers')
        .doc(u.uid)
        .collection('checkout_sessions')
        .add({
          price: priceId,
          success_url: 'https://whitewrite.com?payment=success',
          cancel_url: 'https://whitewrite.com?payment=canceled',
          metadata: {
            plan: targetPlan
          }
        });

      // Слухати створення сесії
      checkoutRef.onSnapshot((snap) => {
        const data = snap.data();
        if (data && data.url) {
          // Перенаправити на Stripe Checkout
          window.location.href = data.url;
        }
        if (data && data.error) {
          alert('Помилка: ' + data.error.message);
        }
      });
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Помилка створення сесії: ' + error.message);
    }
  };
});
```

---

## Крок 8: Оновити AI Routing

Extension пише підписки в `customers/{uid}/subscriptions`. Треба читати звідти.

Відкрийте `functions/index.js` і оновіть перевірку плану в `generateScene`:

```javascript
// Load user data to check plan
const userDoc = await db.collection('users').doc(uid).get();
const userData = userDoc.exists ? userDoc.data() : {};

// Check active subscription via extension
const subscriptionsSnapshot = await db.collection('customers')
  .doc(uid)
  .collection('subscriptions')
  .where('status', '==', 'active')
  .limit(1)
  .get();

let userPlan = 'seed'; // default
let userTokens = userData.tokens || 300;

if (!subscriptionsSnapshot.empty) {
  const subscription = subscriptionsSnapshot.docs[0].data();
  const priceId = subscription.items?.[0]?.price?.id;

  // Map price ID to plan
  const pricePlans = {
    'price_xxxxx': 'storyweaver', // TODO: Replace with real Price IDs
    'price_xxxxx': 'worldforge'
  };

  userPlan = pricePlans[priceId] || 'seed';

  // Update user plan in users collection (for caching)
  if (userData.plan !== userPlan) {
    const planLimits = {
      storyweaver: { tokensMonthly: 2500, maxProjects: 10 },
      worldforge: { tokensMonthly: 8000, maxProjects: 999 }
    };
    const limits = planLimits[userPlan];

    await userDoc.ref.update({
      plan: userPlan,
      tokens: limits.tokensMonthly,
      tokensMonthly: limits.tokensMonthly,
      maxProjects: limits.maxProjects
    });

    userTokens = limits.tokensMonthly;
  }
}

// Determine which AI to use
const useClaudeAPI = userPlan === 'worldforge';
console.log(`User plan: ${userPlan}, tokens: ${userTokens}, using ${useClaudeAPI ? 'Claude' : 'Gemini'}`);
```

---

## Крок 9: Тестування

1. Відкрийте `https://whitewrite.com` → Акаунт
2. Натисніть **"Обрати"** на плані worldforge
3. Ви будете перенаправлені на Stripe Checkout
4. Використайте тестову картку:
   - **Card number:** `4242 4242 4242 4242`
   - **Expiry:** будь-яка майбутня дата (12/34)
   - **CVC:** будь-які 3 цифри (123)
   - **ZIP:** будь-які 5 цифр
5. Після оплати → перенаправлення на `whitewrite.com?payment=success`
6. Перевірте Firestore:
   - `customers/{uid}/subscriptions` — має бути активна підписка
   - `users/{uid}` — plan: `worldforge`, tokens: `8000`
7. Спробуйте згенерувати сцену → має використовувати Claude API

---

## Крок 10: Customer Portal (керування підписками)

Extension автоматично створює Customer Portal для користувачів.

Додайте кнопку "Керувати підпискою" в акаунті:

```javascript
// У White.html, в модалці акаунту
var manageBtn = document.createElement('button');
manageBtn.textContent = 'Керувати підпискою';
manageBtn.onclick = async function () {
  var u = window.__wwUser;
  const db = window.__firebase.db;

  const portalRef = await db.collection('customers')
    .doc(u.uid)
    .collection('checkout_sessions')
    .add({
      portal_url: true,
      return_url: 'https://whitewrite.com'
    });

  portalRef.onSnapshot((snap) => {
    const data = snap.data();
    if (data && data.url) {
      window.location.href = data.url;
    }
  });
};
```

---

## Продакшн (Live Mode)

Коли готові до реальних платежів:

1. Переключіть Stripe на **Live mode**
2. Створіть ті ж продукти та ціни в Live mode
3. Створіть новий **restricted API key** (Live)
4. Оновіть Firebase Extension з Live ключем
5. Налаштуйте webhook в Live mode
6. Оновіть Price IDs в коді (Live price IDs)
7. Заповніть дані бізнесу в Stripe для активації акаунта
8. Деплой

---

## Troubleshooting

**Checkout session не створюється:**
- Перевірте Firestore Rules — чи дозволено запис у `customers/{uid}/checkout_sessions`
- Перевірте Price ID — чи правильний формат `price_xxxxx`

**Підписка не активується після оплати:**
- Перевірте Stripe Logs → Events
- Перевірте Firebase Functions Logs
- Перевірте webhook secret — чи правильний

**AI не використовує Claude після підписки:**
- Перевірте `customers/{uid}/subscriptions` — чи є активна підписка
- Перевірте маппінг Price ID → plan в коді
- Перевірте Cloud Functions logs

---

## Структура даних Firestore

```
customers (collection)
  └── {uid} (document)
      ├── email: string
      ├── stripeId: string (автоматично створюється extension)
      └── subscriptions (subcollection)
          └── {subscriptionId} (document)
              ├── status: 'active' | 'canceled' | 'past_due'
              ├── created: timestamp
              ├── current_period_end: timestamp
              ├── items: array
              │   └── [{ price: { id: 'price_xxxxx' } }]
              └── metadata: object

users (collection)
  └── {uid} (document)
      ├── plan: 'seed' | 'storyweaver' | 'worldforge'
      ├── tokens: number
      ├── tokensMonthly: number
      └── maxProjects: number
```

---

## Переваги extension над кастомним webhook:

✅ Автоматична синхронізація — не треба писати код
✅ Custom claims — рольовий доступ через Firebase Auth
✅ Customer Portal — користувачі керують підписками самі
✅ Підтримка Invertase — офіційна, активна
✅ PCI compliant — платежі не торкаються нашого сервера
✅ Firestore Security Rules — контроль доступу до даних

---

**Готово!** Extension бере на себе всю важку роботу з Stripe.
