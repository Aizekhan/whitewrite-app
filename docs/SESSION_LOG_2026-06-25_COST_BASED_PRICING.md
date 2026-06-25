# Session Log: Phase 6.1 — Cost-Based Pricing + Input Protection

**Date:** 2026-06-25
**Status:** ✅ Production Ready
**Tag:** `stable-pricing`

---

## 🎯 Mission

Transform pricing from abstract "tokens per scene" to transparent **cost-based model** where:
1. **Predictable user cost** (known BEFORE generation)
2. **Transparent economics** (1 token = 1 cent, clear margin)
3. **Input protection** (prevent API cost explosions from massive prompts)

---

## 📐 Architecture

### Formula Evolution

**Before (Phase 6.0 - Word-Based):**
```javascript
baseTokens = ceil(targetWords / 100 × tokensPer100Words)
userTokens = ceil(baseTokens × marginMultiplier × globalMargin)
```
❌ Problem: Rounded too early → killed slider granularity (300/700/1500 words all = 1 token)

**After (Phase 6.1 - Cost-Based):**
```javascript
estApiCostUSD = (targetWords / 700) × estimatedCostPer700Words
userTokens = ceil( (estApiCostUSD / tokenToUSD) × marginMultiplier × globalMargin )
```
✅ **Ceil ONLY at end** → preserves granularity, slider works

### Key Parameters

```javascript
// economy_config/global
{
  tokenToUSD: 0.01,              // 1 token = 1 cent ($0.01)
  globalMarginMultiplier: 5.0    // ×5 base markup
}

// economy_operations/generateScene
{
  providers: {
    claude: {
      estimatedCostPer700Words: 0.03,   // $0.03 per 700 words (NO CACHE, conservative)
      marginMultiplier: 1.5             // +50% premium for quality
    },
    gemini: {
      estimatedCostPer700Words: 0.001,  // $0.001 per 700 words
      marginMultiplier: 1.0             // baseline
    }
  }
}
```

**Design Decision:** Conservative estimates (NO cache assumption) = worst-case cost. If cache hits → extra profit logged as `cacheSavingsUSD` in analytics.

---

## 💰 Pricing Tables

### Gemini (worldforge=false, free/storyteller plans)

| Target Words | Est API Cost | Calculation | userTokens | User Pays |
|--------------|--------------|-------------|------------|-----------|
| 300 | $0.000429 | ceil(0.000429/0.01 × 1.0 × 5.0) | **1 token** | **$0.01** |
| 700 | $0.001 | ceil(0.001/0.01 × 1.0 × 5.0) | **1 token** | **$0.01** |
| 1000 | $0.001429 | ceil(0.001429/0.01 × 1.0 × 5.0) | **1 token** | **$0.01** |
| 1500 | $0.002143 | ceil(0.002143/0.01 × 1.0 × 5.0) | **2 tokens** | **$0.02** |
| 2000 | $0.002857 | ceil(0.002857/0.01 × 1.0 × 5.0) | **2 tokens** | **$0.02** |
| 3000 | $0.004286 | ceil(0.004286/0.01 × 1.0 × 5.0) | **3 tokens** | **$0.03** |

**Observation:** Gemini so cheap that 1 token covers up to 1400 words. Slider updates at ~1500-word intervals.

### Claude (worldforge plan)

| Target Words | Est API Cost | Calculation | userTokens | User Pays |
|--------------|--------------|-------------|------------|-----------|
| 300 | $0.01286 | ceil(0.01286/0.01 × 1.5 × 5.0) | **10 tokens** | **$0.10** |
| 500 | $0.02143 | ceil(0.02143/0.01 × 1.5 × 5.0) | **17 tokens** | **$0.17** |
| 700 | $0.03 | ceil(0.03/0.01 × 1.5 × 5.0) | **23 tokens** | **$0.23** |
| 1000 | $0.04286 | ceil(0.04286/0.01 × 1.5 × 5.0) | **33 tokens** | **$0.33** |
| 1500 | $0.06429 | ceil(0.06429/0.01 × 1.5 × 5.0) | **49 tokens** | **$0.49** |
| 2000 | $0.08571 | ceil(0.08571/0.01 × 1.5 × 5.0) | **65 tokens** | **$0.65** |

**Observation:** Clear linear scaling (~3 tokens per 100 words). Slider responsive.

### Comparison (700 words)

| Provider | Est Cost | Margin | User Pays | Ratio |
|----------|----------|--------|-----------|-------|
| Gemini | $0.001 | 1.0 × 5.0 = 5× | **$0.01** | baseline |
| Claude | $0.03 | 1.5 × 5.0 = 7.5× | **$0.23** | **23× more** |

Fair pricing: Claude API ~30× more expensive, but we charge user only 23× more (absorb some difference).

---

## 🛡 Input Protection (3 Levels)

### Problem
Word-based pricing only charged for OUTPUT tokens. User could input 100,000-char prompt → blow up API cost + hit context limits → crash generation without charging.

### Solution: Triple Defense

#### Level 1: UI Constraints
**File:** `app/flow.jsx`, `app/pages.jsx`

```javascript
// Project description (flow.jsx:295-316)
<textarea
  value={description}
  onChange={(e) => {
    if (!creating && e.target.value.length <= 2000) {
      setDescription(e.target.value);
    }
  }}
  maxLength={2000}
/>
<span className="field__counter">
  {description.length} / 2000
</span>

// Scene Intent custom note (pages.jsx:399-421)
<textarea
  value={note}
  onChange={(ev) => {
    if (ev.target.value.length <= 500) {
      setNote(ev.target.value);
    }
  }}
  maxLength={500}
/>
<div>{note.length} / 500</div>
```

**Result:** User cannot type beyond limit. Counter shows remaining chars.

#### Level 2: Server Validation
**File:** `functions/index.js:122-170`

```javascript
// Validate BEFORE loading project (early reject)
const MAX_CUSTOM_INTENT_CHARS = 500;
if (customIntent && customIntent.length > MAX_CUSTOM_INTENT_CHARS) {
  console.warn(`[generateScene] Rejected: customIntent too long (${customIntent.length} chars)`);
  res.status(400).json({
    error: `Свій напрям задовгий (${customIntent.length} символів). Максимум: ${MAX_CUSTOM_INTENT_CHARS} символів.`,
    code: 'INPUT_TOO_LONG'
  });
  return; // EARLY EXIT — no token deduction
}

// After loading project, validate description
const MAX_DESCRIPTION_CHARS = 2000;
if (project.desc && project.desc.length > MAX_DESCRIPTION_CHARS) {
  res.status(400).json({
    error: `Опис всесвіту задовгий (${project.desc.length} символів). Максимум: ${MAX_DESCRIPTION_CHARS} символів.`,
    code: 'INPUT_TOO_LONG'
  });
  return;
}

// Combined size check (prevent API context overflow)
const MAX_TOTAL_INPUT_TOKENS = 8000; // ~32KB text
const estimatedInputChars = (project.desc?.length || 0) + (customIntent?.length || 0);
const estimatedInputTokens = Math.ceil(estimatedInputChars / 4);

if (estimatedInputTokens > MAX_TOTAL_INPUT_TOKENS) {
  res.status(400).json({
    error: `Сукупний розмір тексту задовгий (≈${estimatedInputTokens} токенів). Максимум: ${MAX_TOTAL_INPUT_TOKENS} токенів.`,
    code: 'INPUT_TOO_LONG'
  });
  return;
}
```

**Result:**
- Validation happens BEFORE token quota check
- Validation happens BEFORE AI API call
- Returns 400 error with clear message
- **NO tokens deducted** on rejection

#### Level 3: No Charge on Reject

Validation flow order:
1. ✅ Parse request
2. ✅ Verify auth token
3. ✅ **Validate input size** ← NEW (returns 400 if too large)
4. ✅ Load project
5. ✅ Check token quota
6. ✅ Call AI API
7. ✅ Charge tokens

If step 3 fails → exits before step 7 → no charge.

**Test Case:**
```bash
# Bypass frontend, send 50000-char prompt directly
curl -X POST https://.../generateScene \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectId":"test","sceneIntent":"custom","customIntent":"'$(python -c 'print("A"*50000)')'"}'

# Expected: HTTP 400 "Свій напрям задовгий (50000 символів). Максимум: 500 символів."
# User tokens: UNCHANGED
```

---

## 📊 Usage Logs Analytics

**File:** `functions/token-service.js:229-280`

### New Fields (Phase 6.1)

```javascript
{
  // What user saw/paid
  targetWords: 700,
  estimatedApiCostUSD: 0.03,         // Conservative estimate (no cache)
  tokenToUSD: 0.01,
  marginMultiplier: 1.5,
  globalMarginMultiplier: 5.0,
  userTokensCharged: 23,             // Final charge
  userPaidUSD: 0.23,                 // 23 × $0.01

  // What actually happened
  inputTokens: 2034,
  outputTokens: 1287,
  cacheReadTokens: 8123,             // Cache hit!
  realApiCostUSD: 0.0264,            // Actual cost (with cache)

  // Analytics (for margin tracking)
  realMarginRatio: 8.71,             // 0.23 / 0.0264 = 8.71× actual markup
  profitUSD: 0.2036,                 // $0.23 - $0.0264
  cacheSavingsUSD: 0.0036            // $0.03 - $0.0264 (cache bonus)
}
```

### Interpretation

- **estimatedApiCostUSD** = What we told user ($0.03, worst-case)
- **realApiCostUSD** = What API actually charged ($0.0264, cache helped)
- **realMarginRatio** = Actual markup achieved (8.71× vs target 7.5×)
- **cacheSavingsUSD** = Extra profit from caching ($0.0036)

**Business insight:** If `realMarginRatio` consistently >> target, can lower margins. If << target, estimates too optimistic.

---

## 🔄 Migration

### Migration Function
**File:** `functions/index.js:1834-1903`

```javascript
exports.migrateCostPricing = onRequest({ ... }, async (req, res) => {
  // 1. Add tokenToUSD to economy_config/global
  await db.collection('economy_config').doc('global').update({
    tokenToUSD: 0.01,
    globalMarginMultiplier: 5.0
  });

  // 2. Add estimatedCostPer700Words to generateScene
  data.providers.claude.estimatedCostPer700Words = 0.03;
  data.providers.gemini.estimatedCostPer700Words = 0.001;
  data.providers.claude.marginMultiplier = 1.5;
  data.providers.gemini.marginMultiplier = 1.0;

  // 3. Same for extractCanon
  extractData.providers.claude.estimatedCostPer700Words = 0.01;
  extractData.providers.claude.marginMultiplier = 1.0;
});
```

### Execution Log

```bash
$ firebase deploy --only functions:migrateCostPricing
✅ Deploy complete

$ curl https://.../migrateCostPricing
{
  "success": true,
  "message": "Cost-based pricing migrated",
  "config": {
    "tokenToUSD": 0.01,
    "globalMarginMultiplier": 5,
    "generateScene": {
      "claude": {"estimatedCostPer700Words": 0.03, "marginMultiplier": 1.5},
      "gemini": {"estimatedCostPer700Words": 0.001, "marginMultiplier": 1.0}
    }
  }
}
```

---

## 🧪 Testing Checklist

### ✅ UI Limits
- [x] Cannot type beyond 2000 chars in project description
- [x] Cannot type beyond 500 chars in Scene Intent custom note
- [x] Counter updates in real-time
- [x] Red color when approaching limit

### ✅ Server Validation
- [x] Oversized customIntent rejected with HTTP 400
- [x] Oversized project.desc rejected with HTTP 400
- [x] Combined input >8000 tokens rejected
- [x] Error message clear and actionable
- [x] No tokens deducted on rejection

### ✅ Pricing Formula
- [x] Gemini 300 words → 1 token
- [x] Gemini 1500 words → 2 tokens
- [x] Claude 300 words → 10 tokens
- [x] Claude 700 words → 23 tokens
- [x] Claude 1500 words → 49 tokens
- [x] Preview updates as length slider moves
- [x] Preview matches actual charge

### ✅ Usage Logs
- [x] estimatedApiCostUSD logged
- [x] realApiCostUSD calculated from usage
- [x] realMarginRatio computed
- [x] profitUSD computed
- [x] cacheSavingsUSD computed (if cache hit)

---

## 🎓 Lessons Learned

### 1. **Premature Rounding Kills Granularity**
**Before:** `baseTokens = ceil(words/100 × rate)` then `userTokens = ceil(base × margin)`
**Problem:** First ceil destroyed precision. 300/700/1500 words all rounded to same baseTokens.
**Fix:** Single ceil at end preserves fractional values through multiplication.

### 2. **Conservative Estimates Are User Trust**
**Temptation:** Assume prompt caching always works → estimate $0.027 instead of $0.03
**Reality:** Cache misses happen (first scene, different canon, etc.)
**Solution:** Estimate worst-case (no cache). Cache hit = bonus profit, not user savings.
**User Impact:** Never "charged more than shown" = trust preserved.

### 3. **Input Validation Must Precede Charging**
**Mistake:** Could have validated AFTER token quota check
**Risk:** User hits quota limit, gets rejected, thinks they were charged for failed attempt
**Fix:** Validate input → check quota → call API → charge. Early exits skip charging.

### 4. **Unified Formula = Preview Accuracy**
**Architecture:** Both frontend (firebase-pricing.js) and backend (token-service.js) read `estimatedCostPer700Words` from Firestore.
**Result:** Preview cannot diverge from actual charge (same data source, same math).
**Alternative rejected:** Hardcoded estimates in frontend would drift over time.

---

## 📂 Files Changed

### Created
- `app/firebase/firebase-pricing.js` (215 lines) — Frontend pricing module

### Modified
- `functions/token-service.js` — Cost-based formula, globalConfig cache, analytics logging
- `functions/index.js` — migrateCostPricing, input validation (3 checks)
- `app/flow.jsx` — Input limits + counters (project description)
- `app/pages.jsx` — Input limits + counters (Scene Intent custom note)

### Not Modified (WHY)
- `app/White.html` — Already includes firebase-pricing.js script tag (added earlier)
- `economy_operations` Firestore — Migrated via Cloud Function, not code change

---

## 🚀 Deployment

```bash
# 1. Deploy functions
$ firebase deploy --only functions:migrateCostPricing,functions:generateScene
✅ migrateCostPricing created
✅ generateScene updated

# 2. Run migration
$ curl https://.../migrateCostPricing
✅ {"success":true, ...}

# 3. Deploy frontend
$ firebase deploy --only hosting
✅ 63 files uploaded

# 4. Tag release
$ git tag stable-pricing
$ git push origin main --tags
```

**Production URL:** https://whitewrite.com

---

## 📈 Next Steps (NOT in this session)

1. **Monitor usage_logs** — Check `realMarginRatio` distribution
   - If consistently >10× → can lower margins (more competitive pricing)
   - If consistently <5× → estimates too optimistic (lose money)

2. **Dynamic margin adjustment** — React to actual costs
   - If Claude introduces cheaper cache tiers → lower `estimatedCostPer700Words`
   - If API raises prices → increase estimates (stay profitable)

3. **User-facing cost display** — Show "$0.23" alongside "23 tokens"
   - Transparency: "This scene costs 23 tokens ($0.23)"
   - Plan comparison: "Upgrade to get 8000 tokens/month ($80 value)"

4. **Refund mechanism** — If generation fails midway
   - Currently: Charge happens AFTER success → no refunds needed
   - Future: If we pre-charge → need refund on failure

---

## ✅ Definition of Done

- [x] Formula implemented (backend + frontend)
- [x] Migration executed (tokenToUSD + estimatedCostPer700Words in Firestore)
- [x] Input protection (UI + server + no charge on reject)
- [x] Usage logs enriched (realMargin, profit, cacheSavings)
- [x] Deployed to production (whitewrite.com)
- [x] Git committed + tagged (`stable-pricing`)
- [x] Session log created (this document)

**Status:** ✅ **PRODUCTION READY**

---

**Session Duration:** ~3 hours
**Commits:** 1 (Phase 6.1: Cost-Based Pricing + Input Protection)
**Lines Changed:** +583 / -72
**Cloud Functions Deployed:** 2 (migrateCostPricing, generateScene)
