# WhiteWrite System Registry

**Version:** 1.0.0 (2026-06-23)
**Status:** Canonical Reference (Single Sources of Truth)

---

## 🎯 Purpose

This document is a **table of all single sources of truth** in WhiteWrite. When you need to know "where is X defined?", look here first.

**Rule:** Never duplicate these definitions. Always reference the canonical source.

---

## 📊 Single Sources of Truth

### **1. AI Models**

| What | Source | Type | Why |
|------|--------|------|-----|
| AI model names & versions | `app/firebase/ai-models.js` | `window.__AI_MODELS` | Frontend & Backend use same file (require/import) |
| Model selection logic | `functions/index.js` (line ~140) | Function | `getPlanBudget(plan).allowClaude` determines Claude vs Gemini |

**Example:**
```javascript
// CORRECT: Use window.__AI_MODELS
const model = window.__AI_MODELS.claude.sonnet;

// WRONG: Hardcode model name
const model = 'claude-3-5-sonnet-20240620';
```

---

### **2. Token Economy**

| What | Source | Type | Why |
|------|--------|------|-----|
| Plan budgets (monthly tokens) | `app/firebase/token-budget.js` | `window.__PLAN_BUDGETS` | Frontend reads for UI, backend for validation |
| Token costs per operation | `app/firebase/token-budget.js` | `window.__TOKEN_COSTS` | sceneGemini: 20, sceneClaude: 100, etc. |
| User token balance | Firestore `users/{uid}` | Database | Server-side source of truth, frontend syncs |
| Token consumption logic | `functions/index.js` (generateScene) | Function | Cloud Function deducts, frontend syncs from response |

**Invariant:** Tokens are **always** deducted server-side. Frontend displays but never modifies.

---

### **3. Project State**

| What | Source | Type | Why |
|------|--------|------|-----|
| Current projectId | `window.__currentProjectId` | Global variable | Set by Book/WorldTree/Workspace, used by PillarSwitch |
| Project data | Firestore `projects/{projectId}` | Database | Title, desc, language, scope, canon, etc. |
| Project ownership | Firestore `projects/{projectId}.owner` | Database | UID of project owner |

**Flow:**
1. User selects project → `window.__currentProjectId = projectId`
2. Pillar loads → reads `window.__currentProjectId`
3. Pillar fetches project from Firestore

**Problem (current):** Multiple places set `window.__currentProjectId`:
- `app/app.jsx` (line 182)
- `app/White.html` (openNarrative)
- Possibly others

**Fix (Phase 3):** Unify to single setter function.

---

### **4. Canon System**

| What | Source | Type | Why |
|------|--------|------|-----|
| Canon data | `projects/{projectId}.canon` | Firestore field | Single source: characters, locations, events, factions, artifacts, world |
| Canon in WorldTree | `wt-world.jsx` | `window.WORLD` | Loaded from Firestore, **VIEW** over canon (not a copy) |
| Canon in Workspace | `ws-data.jsx` | `window.DATA` | **Projection** over WORLD (DATA.characters === WORLD.characters) |
| Memory suggestions | `projects/{projectId}.memorySuggestions` | Firestore array | Inferred canon (pending approval) |

**Invariant:**
- `WORLD` = canon (loaded from Firestore)
- `DATA` = view/projection (no duplication)
- Never write directly to `WORLD` — always write to Firestore, then reload

---

### **5. User Authentication**

| What | Source | Type | Why |
|------|--------|------|-----|
| User auth state | `window.__wwUser` | Global object | Set by `firebase-auth.js`, read everywhere |
| User plan | Firestore `users/{uid}.plan` | Database | Loaded into `window.__wwUser.plan` |
| User tokens | Firestore `users/{uid}` | Database | tokensUsed, tokensMonthly, tokensRemaining |

**Flow:**
1. Firebase Auth triggers `onAuthStateChanged`
2. `firebase-auth.js` loads user doc from Firestore
3. Sets `window.__wwUser = { uid, email, plan, tokensUsed, tokensRemaining, ... }`
4. All code reads from `window.__wwUser`

---

### **6. Pricing & Economy**

| What | Source | Type | Why |
|------|--------|------|-----|
| Claude API pricing | `functions/index.js` (planned) | `CLAUDE_PRICING` constant | Input/output token costs ($/1M tokens) |
| Gemini API pricing | `functions/index.js` (planned) | `GEMINI_PRICING` constant | Currently free tier |
| Firebase costs | `functions/index.js` (planned) | `FIREBASE_COSTS` constant | Firestore write, Cloud Function invocation, storage |
| Operation pricing | Firestore `economy_operations/{id}` (planned) | Database | tokenCost, displayName per operation |
| Usage logs | Firestore `usage_logs/{logId}` (planned) | Database | Real cost breakdown per operation |

**Future state (Phase 4):** All pricing as data in Firestore, not hardcoded.

---

### **7. UI/UX Constants**

| What | Source | Type | Why |
|------|--------|------|-----|
| Page geometry | `app/WhiteWrite.html` (lines 15-23) | CSS variables | --page-top, --page-bottom, --page-left, etc. |
| Pagination limits | `app/book.jsx` (lines 109-112) | Constants | CHARS_PER_PAGE_FIRST: 520, CHARS_PER_PAGE: 580 |
| Scene intents | `app/app.jsx` (getSceneIntent function) | Function | conflict, world, character, action, twist, etc. |
| Scope labels | `app/White.html` | `SCOPE_LBL` object | shot: "Оповідання", novella: "Новела", etc. |
| Language list | `app/flow.jsx` (lines 97-150) | `LANGUAGES` array | 52 languages (en, uk, es, zh, ...) |

---

### **8. Firebase Configuration**

| What | Source | Type | Why |
|------|--------|------|-----|
| Firebase config | `app/firebase/firebase-init.js` | JavaScript object | API keys, project ID, etc. |
| Firestore rules | `firestore.rules` | Security rules | Who can read/write what |
| Cloud Functions secrets | Secret Manager | Environment variables | ANTHROPIC_API_KEY, GEMINI_API_KEY, STRIPE_SECRET_KEY |

---

### **9. Feature Gates**

| What | Source | Type | Why |
|------|--------|------|-----|
| Plan features | `app/firebase/token-budget.js` | `PLAN_BUDGETS[plan]` object | allowClaude, allowImages, allowReconstruction, etc. |
| Feature checks | Throughout codebase | `window.__wwUser.allowClaude`, etc. | Read from plan config |

**Example:**
```javascript
// Check if user can use Claude
if (window.__wwUser && window.__wwUser.allowClaude) {
  // Use Claude
} else {
  // Use Gemini
}
```

---

### **10. Navigation & Routing**

| What | Source | Type | Why |
|------|--------|------|-----|
| Pillar definitions | `app/White.html` (line 608) | `PILLARS` object | book, universe, director sources & labels |
| Section definitions | `app/White.html` (line 614) | `SECTIONS` object | narr, kb, market labels & icons |
| Current mode | `app/White.html` | `mode` variable | "home" | "work" | "narr" | "account" | etc. |
| URL routing | `app/White.html` (hashchange listener) | Event handler | Parses `#work/book?projectId=X` |

---

### **11. Generation Context**

| What | Source | Type | Why |
|------|--------|------|-----|
| Previous scenes (continuity) | `functions/index.js` (generateScene) | Loaded from Firestore | Last 3 scenes passed to AI |
| Canon context | `functions/index.js` (generateScene) | Loaded from project.canon | Characters, locations, world rules |
| Language mapping | `functions/index.js` (lines 635-688) | `languageMap` object | Quotes & dashes per language |

**Context building:**
```
System instruction: Canon-aware narrative AI
Canon: { characters, locations, events, world }
Previous scenes: [scene1, scene2, scene3]
Language: Ukrainian (use « », —)
Intent: "conflict"
```

---

## 🚨 Common Duplication Problems

### **Problem 1: projectId scattered**

**Current state:**
- Set in `app/app.jsx` (line 182)
- Set in `app/White.html` (openNarrative)
- Read in Book, WorldTree, Workspace
- Passed via URL params

**Solution (Phase 3):**
```javascript
// Single setter
window.__setCurrentProject = function(projectId) {
  window.__currentProjectId = projectId;
  // Update URL, notify iframes, etc.
};

// Usage everywhere
window.__setCurrentProject('proj_123');
```

---

### **Problem 2: Token costs in multiple places**

**Current state:**
- `app/firebase/token-budget.js`: `TOKEN_COSTS`
- `functions/index.js`: Hardcoded `sceneCost = 20` or `100`

**Solution (Phase 4):**
- Move to Firestore `economy_operations/{id}.tokenCost`
- Backend & frontend read from database
- Change pricing without deploy

---

### **Problem 3: Model names hardcoded**

**Current state:**
- Some places use `window.__AI_MODELS.claude.sonnet`
- Some places hardcode `'claude-3-5-sonnet-20240620'`

**Solution:**
- **ALWAYS** use `window.__AI_MODELS`
- Backend: `require('./app/firebase/ai-models.js')`
- Frontend: `window.__AI_MODELS`

---

## ✅ Verification Checklist

Before adding a new feature, check:

- [ ] Is this data already defined somewhere? (Check this registry)
- [ ] Am I duplicating a constant? (Use existing source)
- [ ] Am I setting `window.__currentProjectId`? (Use unified setter in Phase 3+)
- [ ] Am I hardcoding a model name? (Use `window.__AI_MODELS`)
- [ ] Am I hardcoding token costs? (Use `TOKEN_COSTS` or `economy_operations`)
- [ ] Am I modifying `WORLD` directly? (Write to Firestore, then reload)

---

## 📝 Maintenance

**When adding a new single source of truth:**
1. Add it to this registry
2. Document its location & type
3. Explain why it's canonical
4. Update ARCHITECTURE.md if needed

**When refactoring:**
1. Check this registry first
2. Don't break existing sources
3. Update registry if sources move

---

**Last updated:** 2026-06-23
**Maintained by:** WhiteWrite Team
