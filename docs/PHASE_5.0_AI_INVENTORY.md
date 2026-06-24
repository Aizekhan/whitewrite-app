# Phase 5.0: AI Operations Inventory

**Мета:** Повна інвентаризація ВСІХ платних AI-викликів у системі. Без коду — лише аналіз.

**Дата:** 2026-06-24

---

## 🤖 Таблиця AI-операцій

| # | Operation | Cloud Function | Model | Lines | Trigger | Charges User Tokens? | Logs usage_logs? | Cost (tokens) | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | **Scene Generation (Claude)** | `generateScene` | `claude.opus` | 253-280 | User click "Generate Scene" | ✅ YES (sceneCost from economy_operations) | ✅ YES | 300 | Main narrative generation |
| 2 | **Scene Generation (Gemini)** | `generateScene` | `gemini.pro` | 288-347 | User click "Generate Scene" (free plan) | ✅ YES (sceneCost from economy_operations) | ✅ YES | 20 | Fallback for free/storyweaver plans |
| 3 | **Canon Auto-Extraction** | `extractCanonFromScene` (internal) | `claude.haiku` | 583-592 | Auto-trigger after scene generation | ✅ YES (extractionCost = 15) | ❌ NO | 15 | Background, auto-approve |
| 4 | **Canon Manual Extraction** | `extractMemorySuggestions` | `claude.haiku` | 1272-1281 | User click "Extract Canon" button | ✅ YES (extractionCost = 15) | ❌ NO | 15 | Explicit user request |
| 5 | **Scene Analysis** | `analyzeScene` | `claude.sonnet` | 1603-1612 | User click "Analyze" button | ✅ YES (analyzeCost from economy_operations) | ❌ NO | 50 | Narrative critique (UI not built yet) |

---

## 📊 Детальний Розбір

### 1. Scene Generation (generateScene)
**File:** `functions/index.js`
**Lines:** 85-449 (full function)

**AI Calls:**
- **Claude path:** Line 253 (`anthropic.messages.create`, model: `AI_MODELS.claude.opus`)
- **Gemini path:** Line 291 (`generateContent`, model: `gemini-2.0-flash-exp`)

**Token Flow:**
1. Read cost from `economy_operations/generateScene` (lines 156-170)
2. Check user balance (lines 175-183)
3. Call AI API
4. **Deduct tokens** (lines 361-363): `tokensUsed: increment(sceneCost)`
5. **Log usage** (lines 398-413): `usage_logs` collection with `apiCostUSD`, `inputTokens`, `outputTokens`, `cacheCreationTokens`, `cacheReadTokens`

**Current Status:**
- ✅ Reads pricing from Firestore (`economy_operations`)
- ✅ Charges user tokens
- ✅ Logs real API cost to `usage_logs`
- ✅ Phase 4.1 complete (cache tokens tracked)

---

### 2. Canon Auto-Extraction (extractCanonFromScene, internal function)
**File:** `functions/index.js`
**Lines:** 514-621 (function definition), 428-436 (call site in generateScene)

**AI Call:**
- **Line 583:** `anthropic.messages.create` (model: `AI_MODELS.claude.haiku`)

**Token Flow:**
1. Called from `generateScene` AFTER scene is generated (line 428)
2. Runs in **background** (async, not awaited) — doesn't block scene response
3. **Deducts tokens** inside function (line 620): `tokensUsed: increment(extractionCost)`
4. ❌ **NO usage_logs** entry

**Current Status:**
- ✅ Charges user 15 tokens (hardcoded `extractionCost = 15` at call site, line 422)
- ❌ NOT reading from `economy_operations/extractCanon`
- ❌ NOT logging to `usage_logs` (no apiCostUSD tracking)
- ⚠️ **Hidden cost:** User doesn't see this in UI (auto-background)

**Issues:**
1. Hardcoded `extractionCost = 15` (line 422 in generateScene, line 620 in extractCanonFromScene) — should read from `economy_operations`
2. No usage tracking (margin unknown)
3. Duplicate logic — also exists as `extractMemorySuggestions` Cloud Function (lines 1158-1325)

---

### 3. Canon Manual Extraction (extractMemorySuggestions)
**File:** `functions/index.js`
**Lines:** 1158-1325 (Cloud Function export)

**AI Call:**
- **Line 1272:** `anthropic.messages.create` (model: `AI_MODELS.claude.haiku`)

**Token Flow:**
1. User explicitly calls from UI (button "Extract Canon")
2. Check user balance (lines 1194-1203)
3. Call Claude Haiku
4. **Deduct tokens** (lines 1305-1307): `tokensUsed: increment(extractionCost)`
5. ❌ **NO usage_logs** entry

**Current Status:**
- ✅ Charges user 15 tokens (hardcoded `extractionCost = 15`, line 1197)
- ❌ NOT reading from `economy_operations/extractCanon`
- ❌ NOT logging to `usage_logs`

**Issues:**
1. Hardcoded cost (should read from `economy_operations`)
2. No usage tracking
3. **Duplicate of #2** — same logic as `extractCanonFromScene`, but as HTTP endpoint

---

### 4. Scene Analysis (analyzeScene)
**File:** `functions/index.js`
**Lines:** 1472-1661 (Cloud Function export)

**AI Call:**
- **Line 1603:** `anthropic.messages.create` (model: `AI_MODELS.claude.sonnet`)

**Token Flow:**
1. User clicks "Analyze" button (UI NOT implemented yet)
2. Check user balance (lines 1516-1525)
3. Call Claude Sonnet (expensive, high-quality)
4. **Deduct tokens** (lines 1631-1633): `tokensUsed: increment(analyzeCost)`
5. ❌ **NO usage_logs** entry

**Current Status:**
- ✅ Charges user 50 tokens (hardcoded `analyzeCost = 50`, line 1516)
- ❌ NOT reading from `economy_operations/analyzeScene`
- ❌ NOT logging to `usage_logs`
- ⚠️ **UI не існує** — backend готовий, але фронтенд не викликає

**Issues:**
1. Hardcoded cost
2. No usage tracking
3. Unused feature (backend exists, UI doesn't)

---

## 🚨 Проблеми

### P0: Hardcoded Costs (порушення SSOT)
```javascript
// ❌ BAD (3 місця в коді):
const extractionCost = 15;  // Line 422, 620, 1197
const analyzeCost = 50;     // Line 1516
```

**Fix:** Читати з `economy_operations` (як у generateScene, lines 156-170)

### P1: No usage_logs (невідома собівартість)
- `extractCanonFromScene` (auto) — НЕ логує
- `extractMemorySuggestions` (manual) — НЕ логує
- `analyzeScene` — НЕ логує

**Impact:** Не знаємо реальну margin на extraction/analysis (лише на generation)

### P2: Дублювання коду
- `extractCanonFromScene` (internal) vs `extractMemorySuggestions` (HTTP endpoint)
- Одна логіка в двох місцях → баг-prone

**Fix:** Уніфікувати через token-service (Phase 5.1)

---

## 💰 Economy Operations Coverage

| Operation | economy_operations doc | Used by | Status |
|---|---|---|---|
| **generateScene** | ✅ Exists | generateScene CF (lines 156-170) | ✅ IMPLEMENTED |
| **extractCanon** | ✅ Exists (seeded in Phase 4) | ❌ UNUSED | ⚠️ NOT READING |
| **analyzeScene** | ✅ Exists (seeded in Phase 4) | ❌ UNUSED | ⚠️ NOT READING |

**Firestore Data (від seedEconomy):**
```javascript
economy_operations/generateScene: {
  name: 'Scene Generation',
  providers: {
    gemini: { cost: 20, model: 'gemini-2.0-flash-exp' },
    claude: { cost: 300, model: 'claude-opus-4-20250514' }
  }
}

economy_operations/extractCanon: {
  name: 'Canon Extraction',
  providers: { gemini: { cost: 15, model: 'gemini-2.0-flash-exp' } }
}

economy_operations/analyzeScene: {
  name: 'Scene Analysis',
  providers: { gemini: { cost: 50, model: 'gemini-2.0-flash-exp' } }
}
```

**Issue:** `extractCanon` та `analyzeScene` документи існують, але ніде не читаються (hardcoded costs у коді).

---

## 🔍 Additional AI Operations (Not Found)

Grep для інших можливих AI-викликів:

```bash
grep -r "draw-shot\|lora\|image" functions/
```

**Result:** Немає інших AI-операцій (image generation, LoRA, storyboard auto-generation — ще не імплементовано).

---

## 📝 Висновки Phase 5.0

### Що маємо:
- **5 AI-операцій** (2 для generation, 2 для extraction, 1 для analysis)
- **1 операція** з повним tracking (generateScene)
- **4 операції** без usage_logs (hidden costs)
- **3 hardcoded costs** (порушення SSOT)

### Що треба виправити (Phase 5.1):
1. **Уніфікувати всі AI-виклики через token-service:**
   - Читати ціни з `economy_operations`
   - Логувати в `usage_logs`
   - Один entry point для всіх операцій

2. **Видалити дублювання:**
   - `extractCanonFromScene` + `extractMemorySuggestions` → одна функція

3. **Додати usage tracking:**
   - extractCanon: log `apiCostUSD` (input/output tokens)
   - analyzeScene: log `apiCostUSD`

### Success Criteria Phase 5:
- [ ] ВСІ AI-виклики через `token-service.charge(operation, model, usage)`
- [ ] ВСІ ціни з `economy_operations` (zero hardcoded costs)
- [ ] ВСІ операції логуються в `usage_logs`
- [ ] Grep `extractionCost|analyzeCost` → порожньо (все через token-service)

---

**Phase 5.0 COMPLETE — СТОП, чекаємо GO для Phase 5.1** ✋
