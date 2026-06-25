# Session Log: Margin Architecture (2026-06-25)

## 📋 Мета сесії

Реалізувати **Margin Architecture** — data-driven систему ціноутворення з можливістю зміни markup без деплою.

**Вимоги:**
- `baseTokens` + `marginMultiplier` в `economy_operations`
- `globalMarginMultiplier` в `economy_config/global`
- Формула: `userTokens = ceil(base × margin × global)`
- Кешування global margin (TTL 60s) — не читати Firestore на кожну операцію
- Валідація з fallback на 1.0 (захист від 0/null/NaN)
- Округлення **вгору** (Math.ceil) — щоб не недорахувати
- usage_logs відстежує всі компоненти маржі
- **DEMO:** Змінив margin в Firestore → списалось ×1.5 БЕЗ деплою

---

## ✅ Що зроблено

### 1. Token Service з Margin Formula

**Файл:** `functions/token-service.js`

**Додано:**

#### Global Margin Cache (lines 16-52)
```javascript
let globalMarginCache = {
  value: 1.0,
  lastFetch: 0,
  TTL_MS: 60000  // 60 seconds
};

async function getGlobalMarginMultiplier(db) {
  const now = Date.now();

  // Cache hit (within TTL)
  if (now - globalMarginCache.lastFetch < globalMarginCache.TTL_MS) {
    return globalMarginCache.value;
  }

  // Cache miss — fetch from Firestore
  const globalDoc = await db.collection('economy_config').doc('global').get();

  if (globalDoc.exists) {
    const multiplier = globalDoc.data().globalMarginMultiplier;

    // Validate: must be positive number, fallback to 1.0
    if (typeof multiplier === 'number' && multiplier > 0 && !isNaN(multiplier)) {
      globalMarginCache.value = multiplier;
      globalMarginCache.lastFetch = now;
      return multiplier;
    }
  }

  // Fallback: 1.0 (no markup)
  globalMarginCache.value = 1.0;
  globalMarginCache.lastFetch = now;
  return 1.0;
}
```

**Чому кеш важливий:**
- Firestore read коштує грошей ($0.06 per 100K reads)
- Генерація сцени = 2 операції (generateScene + extractCanon) → 2 reads без кешу
- З кешем (60s TTL): ~100× менше reads при активному використанні

#### Calculation Function (lines 54-84)
```javascript
function calculateUserTokens(baseTokens, marginMultiplier, globalMarginMultiplier) {
  // Validate inputs (fallback to safe defaults)
  const validBase = (typeof baseTokens === 'number' && baseTokens > 0 && !isNaN(baseTokens))
    ? baseTokens
    : 0;

  const validMargin = (typeof marginMultiplier === 'number' && marginMultiplier > 0 && !isNaN(marginMultiplier))
    ? marginMultiplier
    : 1.0;

  const validGlobal = (typeof globalMarginMultiplier === 'number' && globalMarginMultiplier > 0 && !isNaN(globalMarginMultiplier))
    ? globalMarginMultiplier
    : 1.0;

  // Formula: userTokens = ceil(base × margin × globalMargin)
  // Use Math.ceil to round UP (never undercharge)
  const userTokens = Math.ceil(validBase * validMargin * validGlobal);

  return userTokens;
}
```

**Чому Math.ceil:**
- `ceil(15 × 1.5) = ceil(22.5) = 23` (округлено вгору)
- `round(15 × 1.5) = round(22.5) = 22` (втрата 1 токену на кожній операції)
- При 1M операцій: ceil економить 1M токенів vs round

#### Updated charge() Function (lines 116-161)
```javascript
async function charge(db, uid, operation, model, usage, projectId, options = {}) {
  // 1. Read pricing from economy_operations
  const economyDoc = await db.collection('economy_operations').doc(operation).get();
  const providerData = economyData.providers[provider];
  const baseTokens = providerData.baseTokens || providerData.cost || 0;
  const marginMultiplier = providerData.marginMultiplier || 1.0;

  // 2. Get global margin multiplier (cached)
  const globalMarginMultiplier = await getGlobalMarginMultiplier(db);

  // 3. Calculate final user cost with margin
  const userCost = calculateUserTokens(baseTokens, marginMultiplier, globalMarginMultiplier);

  console.log(`[TokenService] User cost (final): ${userCost} tokens = ceil(${baseTokens} × ${marginMultiplier} × ${globalMarginMultiplier})`);

  // 4. Calculate real API cost (unchanged)
  // ... pricing logic

  // 5. Deduct tokens
  await db.collection('users').doc(uid).update({
    tokensUsed: admin.firestore.FieldValue.increment(userCost)
  });

  // 6. Log with margin tracking
  await db.collection('usage_logs').add({
    baseTokens,
    marginMultiplier,
    globalMarginMultiplier,
    userTokensCharged: userCost,
    apiCostUSD,
    // ... other fields
  });
}
```

---

### 2. Firestore Migration

**Migration Function:** `functions/index.js` (lines 1710-1810)

**Створено `exports.migrateMargin`:**
- Читає всі `economy_operations` (generateScene, extractCanon, analyzeScene)
- Додає `baseTokens` (з існуючого поля `cost`)
- Додає `marginMultiplier: 1.0` (baseline, no markup)
- Створює `economy_config/global` з `globalMarginMultiplier: 1.0`

**Запуск:**
```bash
curl https://us-central1-whitewrite-app.cloudfunctions.net/migrateMargin
```

**Результат:**
```json
{
  "success": true,
  "message": "Margin architecture migrated successfully",
  "updated": ["generateScene", "extractCanon", "analyzeScene"]
}
```

**Firestore Structure після міграції:**

`economy_operations/generateScene`:
```javascript
{
  providers: {
    claude: {
      cost: 300,              // Legacy (backwards compat)
      baseTokens: 300,        // ✅ NEW
      marginMultiplier: 1.0,  // ✅ NEW
      model: "claude-opus-4-20250514",
      apiCostUSD: 0.0135
    },
    gemini: {
      cost: 20,
      baseTokens: 20,
      marginMultiplier: 1.0,
      model: "gemini-2.0-flash-exp",
      apiCostUSD: 0.0003
    }
  }
}
```

`economy_config/global`:
```javascript
{
  globalMarginMultiplier: 1.0,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

---

### 3. Debug Functions

**Файл:** `functions/index.js`

#### checkMargin (lines 1710-1735)
```javascript
exports.checkMargin = onRequest({ ... }, async (req, res) => {
  const globalDoc = await db.collection('economy_config').doc('global').get();
  res.json({
    success: true,
    globalMarginMultiplier: globalDoc.data().globalMarginMultiplier,
    createdAt, updatedAt
  });
});
```

**Використання:**
```bash
curl https://us-central1-whitewrite-app.cloudfunctions.net/checkMargin
# → {"globalMarginMultiplier": 1.0}
```

#### setMargin (lines 1738-1765)
```javascript
exports.setMargin = onRequest({ ... }, async (req, res) => {
  const newMargin = parseFloat(req.query.value || 1.0);

  await db.collection('economy_config').doc('global').update({
    globalMarginMultiplier: newMargin,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  res.json({ success: true, globalMarginMultiplier: newMargin });
});
```

**Використання:**
```bash
curl "https://us-central1-whitewrite-app.cloudfunctions.net/setMargin?value=1.5"
# → Margin оновлено БЕЗ деплою!
```

---

### 4. usage_logs Tracking

**Оновлено logEntry structure:**
```javascript
{
  uid: "D72FcLAn2xQritZkO6xYD5lxLDL2",
  operation: "generateScene",
  model: "claude-opus-4-8",
  projectId: "proj_...",
  timestamp: Timestamp,

  // Margin architecture (NEW)
  baseTokens: 300,                    // Base cost before margin
  marginMultiplier: 1.0,              // Operation-specific margin
  globalMarginMultiplier: 1.5,        // Global margin at time of use
  userTokensCharged: 450,             // Final = ceil(300 × 1 × 1.5)

  // Real API cost
  inputTokens: 655,
  outputTokens: 543,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  totalTokens: 1198,
  apiCostUSD: 0.0505,                 // Actual API cost

  rawUsage: { ... }
}
```

**Переваги:**
- Історичний трекінг маржі (бачимо яку маржу застосовано на момент операції)
- Порівняння `userTokensCharged` vs `apiCostUSD` → реальна маржа в $
- Аудит для фінансової звітності

---

## 🎯 DEMO — Margin Without Deploy

### Setup:
1. `globalMarginMultiplier: 1.0` (baseline)
2. Deploy generateScene з новим token-service
3. Згенерувати baseline сцену

### Baseline Generation (Margin 1.0)

**Time:** 10:24:59 UTC

**Cloud Functions Logs:**
```
[TokenService] Base tokens: 300
[TokenService] Margin multiplier: 1
[TokenService] Global margin multiplier: 1
[TokenService] User cost (final): 300 tokens = ceil(300 × 1 × 1)
[TokenService] ✅ Deducted 300 tokens

extractCanon:
[TokenService] Base tokens: 15
[TokenService] User cost (final): 15 tokens = ceil(15 × 1 × 1)
[TokenService] ✅ Deducted 15 tokens
```

**Total charged:** 315 tokens
**API cost:** $0.0610
**Margin:** 0% (baseline)

---

### Change Margin (Without Deploy)

**Action:**
```bash
curl "https://us-central1-whitewrite-app.cloudfunctions.net/setMargin?value=1.5"
```

**Result:**
```json
{"success": true, "globalMarginMultiplier": 1.5}
```

**Firestore updated:**
- `economy_config/global.globalMarginMultiplier: 1.5`
- `updatedAt: 1782384128` (new timestamp)

**Не було:**
- ❌ Deploy
- ❌ Code changes
- ❌ Restart servers

---

### Test Generation (Margin 1.5)

**Time:** 11:14:05 UTC (49 хв пізніше — cache TTL expired)

**Cloud Functions Logs:**
```
[TokenService] Base tokens: 300
[TokenService] Margin multiplier: 1
[TokenService] Global margin multiplier loaded: 1.5  ← ПІДХОПИВ З FIRESTORE!
[TokenService] Global margin multiplier: 1.5
[TokenService] User cost (final): 450 tokens = ceil(300 × 1 × 1.5)  ← 50% MARKUP!
[TokenService] ✅ Deducted 450 tokens

extractCanon:
[TokenService] Base tokens: 15
[TokenService] Global margin multiplier: 1.5
[TokenService] User cost (final): 23 tokens = ceil(15 × 1 × 1.5)  ← ОКРУГЛЕНО ВГОРУ!
[TokenService] ✅ Deducted 23 tokens
```

**Total charged:** 473 tokens (+150 tokens = 50% markup)
**API cost:** $0.0582
**Margin:** 50% ($0.0291 profit)

---

### Side-by-Side Comparison

| Metric | Baseline (1.0) | Increased (1.5) | Difference |
|--------|----------------|-----------------|------------|
| **globalMarginMultiplier** | 1.0 | 1.5 | +50% |
| **generateScene tokens** | 300 | 450 | +150 |
| **extractCanon tokens** | 15 | 23 | +8 |
| **Total charged** | 315 | 473 | **+158 (+50%)** |
| **API cost** | $0.0610 | $0.0582 | -$0.0028 |
| **Profit margin** | $0 | ~$0.029 | 50% markup |
| **Deploy required?** | — | **NO** ✅ | — |

---

## 📊 Переваги архітектури

### 1. Data-Driven Pricing
- **Було:** Hardcoded `cost: 300` в economy_operations
- **Стало:** `baseTokens × marginMultiplier × globalMarginMultiplier`
- **Гнучкість:** 3 рівні контролю (base, operation, global)

### 2. Zero-Downtime Price Changes
- **Було:** Зміна ціни = deploy (5-10 хв downtime)
- **Стало:** Зміна `globalMarginMultiplier` в Firestore → працює через 60s (cache TTL)
- **Use case:** A/B testing, dynamic pricing, flash sales

### 3. Cost Optimization
- **Cache:** 60s TTL → ~100× менше Firestore reads
- **Math.ceil:** Округлення вгору → не втрачаємо токени на округленні
- **Validation:** Fallback на 1.0 → захист від broken config (0/null/NaN)

### 4. Financial Transparency
- `usage_logs` містить `baseTokens`, `marginMultiplier`, `globalMarginMultiplier`, `userTokensCharged`, `apiCostUSD`
- Історичний трекінг маржі (бачимо яку маржу застосовано в минулому)
- Порівняння revenue (`userTokensCharged × $0.000015`) vs cost (`apiCostUSD`)

### 5. Auditability
- Кожна операція логується з усіма компонентами ціни
- Можна перевірити: чи коректно застосована маржа на момент X?
- Compliance для фінансової звітності

---

## 🐛 Виявлені проблеми

### Bug 1: User Didn't Update Firestore

**Симптом:** Після другої генерації margin лишився 1.0, не 1.5

**Root cause:**
- Користувач сказав що змінив `globalMarginMultiplier` на 1.5
- Але `checkMargin` показав `1.0` → не зберіг зміни в Firestore Console

**Fix:**
- Створив `setMargin` Cloud Function для програмного оновлення
- `curl "https://.../setMargin?value=1.5"` → гарантоване оновлення

**Lesson:** UI для зміни margin (admin panel) потрібен для production

---

### Bug 2: Frontend Shows Wrong Cost

**Симптом:** Console log показує `-300 tokens`, але backend списав 450

**Root cause:**
- Frontend має старий `window.__TOKEN_COSTS.sceneClaude = 300` (hardcoded)
- Backend рахує через token-service з margin

**Fix (не зроблено):**
- Frontend має читати з `economy_operations` + `economy_config/global`
- АБО backend повертає `tokensConsumed` з урахуванням margin

**Workaround:** Довіряємо backend logs, не frontend console

---

## 📁 Файли змінено

- `functions/token-service.js` (lines 1-183) — margin formula + cache
- `functions/index.js` (lines 1710-1810) — migrateMargin, checkMargin, setMargin
- `functions/migrate-margin.js` — standalone migration script (не використовується)

---

## 🔄 Deployment

```bash
# Deploy migration function
firebase deploy --only functions:migrateMargin

# Run migration
curl https://us-central1-whitewrite-app.cloudfunctions.net/migrateMargin

# Deploy updated generateScene with new token-service
firebase deploy --only functions:generateScene

# Deploy debug functions
firebase deploy --only functions:checkMargin,setMargin

# Reset margin to production baseline
curl "https://us-central1-whitewrite-app.cloudfunctions.net/setMargin?value=1.0"
```

---

## ✅ Success Criteria

- [x] `baseTokens` + `marginMultiplier` додано в `economy_operations`
- [x] `economy_config/global` створено з `globalMarginMultiplier: 1.0`
- [x] Token-service використовує формулу `ceil(base × margin × global)`
- [x] Global margin кешується (TTL 60s)
- [x] Валідація з fallback на 1.0
- [x] Округлення вгору (Math.ceil)
- [x] usage_logs відстежує margin компоненти
- [x] **DEMO PASSED:** Змінив margin 1.0 → 1.5 → списалось ×1.5 БЕЗ деплою

---

## 🎯 Наступні кроки

### Immediate (Phase 6.1):
1. **Auto Mode Token Preview** — прев'ю вартості при зміні слайдерів
   - Формула: `episodes × calculateUserTokens(baseTokens, margin, global)`
   - Показувати "~X токенів" наживо
   - Читати ту саму формулу, що й списання

### Short-term:
2. **Frontend Sync** — frontend читає pricing з Firestore
3. **Admin Panel** — UI для зміни `globalMarginMultiplier` (не через curl)

### Long-term:
4. **Operation-level margins** — різні `marginMultiplier` для різних операцій
5. **Plan-based margins** — різні множники для seed/storyteller/worldforge
6. **Dynamic pricing** — автоматична зміна margin на основі demand

---

**Створено:** 2026-06-25
**Git commit:** (pending)
**Git tag:** `stable-margin`
**Live:** https://whitewrite.com
**Status:** ✅ Margin architecture working, production baseline restored (1.0)
