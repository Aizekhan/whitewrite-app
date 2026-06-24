# WhiteWrite System Registry — Single Sources of Truth

**Мета:** Таблиця всіх SSOT (Single Source of Truth) у системі. Якщо дві частини коду читають одне й те саме — тут вказано, звідки.

---

## 🎯 Глобальні ідентифікатори

| Система | Source of Truth | Локація | Writer | Readers |
|---|---|---|---|---|
| **Current Project** | `window.__currentProjectId` | Shell (`White.html`) | `__setCurrentProject()` (Shell) | Pillars (via ProjectContext + postMessage) |
| **User Auth** | Firebase Auth state | `firebase-auth.js` | Firebase SDK | All modules via `window.__firebaseAuth.user` |
| **User Plan** | `users/{uid}.plan` | Firestore | Backend (initializeUser, stripeWebhook) | Frontend (`firebase-auth.js` → `window.__wwUser.plan`) |
| **Token Balance** | `users/{uid}.tokens` | Firestore | Backend (consumeTokens, initializeUser) | Frontend (`firebase-auth.js` → `window.__wwUser.tokens`) |

---

## 🤖 AI Models & Pricing

| Система | Source of Truth | Локація | Не читати з |
|---|---|---|---|
| **AI Model IDs** | `AI_MODELS` object | `functions/ai-models.js` | ❌ Hardcoded strings у промптах |
| **API Pricing** | `MODEL_PRICING` object | `functions/ai-models.js` | ❌ Hardcoded числа |
| **User Operation Costs** | `economy_operations/{op}` | Firestore | ❌ Hardcoded costs у frontend |

**Exports:**
- Backend: `const { AI_MODELS, MODEL_PRICING } = require('./ai-models.js')`
- Frontend: `window.__AI_MODELS`, `window.__MODEL_PRICING` (auto-set)

**Приклад читання ціни:**
```javascript
// ✅ ПРАВИЛЬНО (backend)
const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
const sceneCost = economyDoc.data().providers.claude.cost;

// ❌ НЕПРАВИЛЬНО
const sceneCost = 300; // Hardcode = баг при зміні цін
```

---

## 📊 Дані проєкту

| Сутність | Source of Truth | Локація | Структура |
|---|---|---|---|
| **Project Metadata** | `projects/{id}` | Firestore | `{ title, ending, scope, genres, canon, owner }` |
| **Canon** | `projects/{id}.canon` | Firestore (поле в project) | `{ characters, locations, events, ... }` |
| **Scenes** | `projects/{id}/scenes/{sceneId}` | Firestore (subcollection) | `{ text, sceneIntent, canonRefs, timestamp }` |
| **Usage Logs** | `usage_logs/{logId}` | Firestore | `{ uid, operation, model, tokens, apiCostUSD }` |

**Не дублювати:**
- ❌ Canon НЕ в окремій колекції (лише як поле в project)
- ❌ Scenes НЕ в WORLD/DATA (лише Firestore → render)

---

## 🏗 Frontend State Management

| Стан | SSOT | Локація | Sync Method |
|---|---|---|---|
| **WORLD** (Canon) | `wt-world.jsx` | WorldTree pillar | `loadCanon()` → Firestore → WORLD mutation |
| **DATA** (Director) | Projection over WORLD | `ws-data.jsx` | `DATA.characters = WORLD.characters` (reference, NOT copy) |
| **Scenes** | In-memory array | Book pillar (`app.jsx`) | `loadScenes()` → Firestore → state |

**Правило:** WORLD — єдине джерело канону у frontend. DATA — проєкція (не копія).

```javascript
// ✅ ПРАВИЛЬНО
DATA.characters = WORLD.characters; // Reference

// ❌ НЕПРАВИЛЬНО
DATA.characters = [...WORLD.characters]; // Copy = два джерела правди
```

---

## 🔐 Economy & Billing

| Операція | Cost SSOT | Real Cost Tracking | Deduction |
|---|---|---|---|
| **generateScene** | `economy_operations/generateScene` | `usage_logs` (apiCostUSD, tokens) | Backend (`consumeTokens` in Cloud Function) |
| **extractCanon** | `economy_operations/extractCanon` | `usage_logs` | Backend |
| **analyzeScene** | `economy_operations/analyzeScene` | `usage_logs` | Backend |

**Pricing Model:**
- User charge = **FIXED** (Claude 300 tokens, Gemini 20 tokens, незалежно від довжини)
- Real cost = **VARIABLE** (logged in `usage_logs` для margin analysis)

**Flow:**
1. Backend читає `economy_operations/{op}.providers.{provider}.cost`
2. Backend викликає AI API, отримує `usage` (input/output/cache tokens)
3. Backend розраховує `apiCostUSD` з `MODEL_PRICING`
4. Backend списує user tokens (fixed cost)
5. Backend логує `usage_logs` (fixed user charge + real API cost)

---

## 🚫 Anti-Patterns

### ❌ Два джерела projectId
```javascript
// BAD: URL + global
const projectId = new URLSearchParams(location.search).get('id') || window.__currentProjectId;
```

**✅ Правильно:** Лише `window.__currentProjectId` (Shell = writer, Pillars = readers)

### ❌ Hardcoded model versions
```javascript
// BAD
const message = await anthropic.messages.create({
  model: 'claude-opus-4-20250514', // Версія застаріє
  ...
});
```

**✅ Правильно:**
```javascript
const { AI_MODELS } = require('./ai-models.js');
const message = await anthropic.messages.create({
  model: AI_MODELS.claude.opus,
  ...
});
```

### ❌ Hardcoded pricing
```javascript
// BAD
const cost = useClaudeAPI ? 300 : 20;
```

**✅ Правильно:** Читати з `economy_operations`

### ❌ Canon у двох місцях
```javascript
// BAD: Окрема колекція canon/{id}
await db.collection('canon').doc(projectId).set(canon);
```

**✅ Правильно:** Поле в project
```javascript
await db.collection('projects').doc(projectId).update({ canon });
```

---

## 🔍 Verification Checklist

Перед комітом перевір:

- [ ] `grep -r "claude-opus" functions/` → лише в `ai-models.js`
- [ ] `grep -r "sceneCost = " functions/` → читання з Firestore, NOT hardcode
- [ ] `grep -r "300" functions/` → NOT в контексті token costs
- [ ] Firestore: `economy_operations` існує з документами generateScene/extractCanon/analyzeScene
- [ ] Frontend: `window.__AI_MODELS` доступний у консолі
- [ ] Backend: `const { AI_MODELS } = require('./ai-models')` працює

---

**Створено:** 2026-06-24 (Phase 5 prep, REFACTOR_PLAN.md)
