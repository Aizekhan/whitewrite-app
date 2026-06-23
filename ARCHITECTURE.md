# WhiteWrite Architecture Map

**Version:** 1.0.0 (2026-06-23)
**Status:** Canonical Reference (Single Source of Truth)

---

## 🎯 Purpose

This document is the **canonical architecture map** of WhiteWrite. All code, features, and decisions reference this document as the single source of truth.

**Philosophy:**
- **Canon-Aware Narrative Generation** — AI generates stories that respect world consistency
- **Three Pillars** — Book (write), WorldTree (canon), Workspace (visualize)
- **Single Canon** — All pillars read from one source (`WORLD`)
- **Reconstruction Engine** — Canon changes cascade through narrative automatically

---

## 📂 File Structure

```
E:\WhiteWrite/
├─ app/                          # Production (deployed to whitewrite.com)
│  ├─ White.html                 # Shell (navigation, auth, account)
│  ├─ WhiteWrite.html            # Book pillar (narrative generation)
│  ├─ WhiteWrite WorldTree.html  # WorldTree pillar (canon management)
│  ├─ WhiteWrite Workspace.html  # Workspace pillar (storyboard/LoRA)
│  │
│  ├─ app.jsx                    # App root (stages: start/form/book)
│  ├─ flow.jsx                   # StoryForm (create project modal)
│  ├─ pages.jsx                  # Book page (scene intent, generation)
│  ├─ book.jsx                   # Book component (pagination, rendering)
│  │
│  ├─ firebase/
│  │  ├─ firebase-init.js        # Firebase SDK initialization
│  │  ├─ firebase-auth.js        # Auth + user plan loading
│  │  ├─ firebase-projects.js    # Project CRUD
│  │  ├─ firebase-scenes.js      # Scene CRUD
│  │  ├─ firebase-ai.js          # AI generation (Gemini)
│  │  ├─ firebase-canon.js       # Canon CRUD
│  │  └─ token-budget.js         # Token system + plan budgets
│  │
│  ├─ wt-*.jsx                   # WorldTree components
│  ├─ ws-*.jsx                   # Workspace components
│  └─ assets/                    # Images, fonts, icons
│
├─ functions/
│  └─ index.js                   # Cloud Functions (generateScene, etc.)
│
├─ handoff/                      # Documentation & session logs
│  ├─ TODO.md
│  ├─ REFACTOR_PLAN.md
│  └─ *_SESSION_*.md
│
└─ public/                       # DEPRECATED (old files, ignore)
```

---

## 🏗 System Architecture

### **Frontend Architecture**

```
whitewrite.com
    ↓
White.html (Shell)
    ├─ Navigation (Проекти, База знань, Маркетплейс)
    ├─ Auth (Firebase Auth)
    ├─ Account modal (Profile, Subscription, Tokens)
    └─ Pillar iframes:
        ├─ WhiteWrite.html?projectId=X (Book)
        ├─ WhiteWrite WorldTree.html?projectId=X (WorldTree)
        └─ WhiteWrite Workspace.html?projectId=X (Workspace)
```

**Communication:**
- Shell → Iframe: `window.postMessage({ type: "ww-mode", mode: "work" })`
- Iframe → Shell: `window.parent.postMessage(...)`

---

### **Data Flow**

```
User Action
    ↓
Frontend (React/Babel in-browser)
    ↓
Firebase SDK (app/firebase/*.js)
    ↓
Cloud Functions (functions/index.js)
    ↓
External APIs (Claude, Gemini, Firebase)
    ↓
Firestore (database)
    ↓
Frontend (re-render)
```

---

## 🗄 Firestore Schema

### **Collections**

#### **`users/{uid}`**
```javascript
{
  email: "user@example.com",
  plan: "worldforge",           // free | storyteller | novelist | worldbuilder | worldforge
  tokensUsed: 12550,
  tokensMonthly: 180000,
  tokensRemaining: 167450,
  resetDate: Timestamp,
  role: "admin"                 // Optional: admin role
}
```

#### **`projects/{projectId}`**
```javascript
{
  owner: "uid",
  title: "Попіл Орелії",
  desc: "Місто, де згасають зорі...",
  language: "uk",                // uk | en | pl | ru | de | es | fr | ...
  scope: "novella",              // shot | novella | season | endless
  ending: "open",                // open | closed | custom
  genres: ["Містика", "Драма"],
  creation: "guided",            // guided | auto
  length: 700,                   // Scene length (words)
  dialogue: 50,                  // Dialogue density (0-100%)
  episodes: 12,                  // For season scope
  endingNote: "...",

  canon: {                       // Canon data (WorldTree)
    characters: { ... },
    locations: { ... },
    events: { ... },
    factions: { ... },
    artifacts: { ... },
    world: { ... }
  },

  memorySuggestions: [ ... ],    // Inferred canon (pending approval)

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### **`projects/{projectId}/scenes/{sceneId}`**
```javascript
{
  n: 1,                          // Scene number (sequential)
  title: "Тиша над колонією",
  text: "Коли впала остання зоря...",
  intent: "world",               // Scene intent used for generation
  customIntent: "...",           // User-provided intent (if custom)

  canonRefs: {                   // Linked canon entities
    characters: ["char_id1", "char_id2"],
    locations: ["loc_id1"],
    events: [],
    artifacts: [],
    factions: []
  },

  createdAt: Timestamp
}
```

#### **`economy_operations/{operationId}`** (planned)
```javascript
{
  "generateScene": {
    tokenCost: 100,
    displayName: "Створення сцени",
    category: "generation"
  }
}
```

#### **`usage_logs/{logId}`** (planned)
```javascript
{
  uid: "...",
  projectId: "...",
  operation: "generateScene",
  costs: {
    claude: 0.0230,
    gemini: 0.0000,
    storage: 0.0001,
    firebase: 0.00001
  },
  totalCostUSD: 0.02311,
  userTokens: 100,
  timestamp: Timestamp
}
```

---

## 🔧 Core Systems

### **1. Token Budget System**

**File:** `app/firebase/token-budget.js`

**Plans:**
```javascript
free:         200 tokens/month    (10 Gemini scenes)
storyteller:  2400 tokens/month   (120 Gemini scenes)
novelist:     32000 tokens/month  (400 Gemini OR 80 Claude + images)
worldbuilder: 180000 tokens/month (300 Claude + 500 images)
worldforge:   180000 tokens/month (dev/testing, same as worldbuilder)
```

**Token Costs:**
- `sceneGemini`: 20 tokens
- `sceneClaude`: 100 tokens
- `canonExtractPerScene`: 15 tokens
- `analyzeScene`: 50 tokens
- `improveScene`: 80 tokens

**Flow:**
1. User action → Frontend checks `window.__canAfford(operation)`
2. Frontend calls Cloud Function
3. Cloud Function deducts tokens from Firestore
4. Frontend syncs `window.__wwUser.tokensRemaining`

---

### **2. Canon System**

**Philosophy:** Canon = Single Source of Truth for world consistency

**Data Model:**
```javascript
canon: {
  characters: {
    "char_id": {
      name: "Елена Кор",
      role: "Провідниця зорепаду",
      trait: "Упевненість",
      status: "alive",
      location: "Орелія",
      goal: "Врятувати місто",
      relationships: [
        { type: "знає", target: "char_id2" }
      ]
    }
  },
  locations: { ... },
  events: { ... },
  factions: { ... },
  artifacts: { ... },
  world: {
    name: "Попіл Орелії",
    tone: "Містична постапокаліпсис",
    rules: ["Зорі падають одна за одною"]
  }
}
```

**Canon Extraction:**
- After scene generation → `extractCanonFromScene()` (Claude Haiku)
- Extracts entities → stores in `memorySuggestions` (inferred canon)
- User reviews → approves → moves to `canon`

---

### **3. AI Generation**

**Models:**
- **Gemini 2.0 Flash** (default, free tier)
- **Claude 3.5 Sonnet** (worldforge plan only)

**Scene Generation Flow:**
1. User selects Scene Intent (conflict, world, character, etc.)
2. Frontend calls `window.__firebaseAI.generateScene(projectId, intent, customIntent, previousScenes)`
3. Cloud Function `generateScene()`:
   - Loads project + canon
   - Builds context (previous 3 scenes + canon)
   - Calls Claude/Gemini API
   - Saves scene to Firestore
   - Triggers canon extraction (async)
   - Deducts tokens
4. Frontend re-renders with new scene

**Context Building:**
```javascript
System: You are a canon-aware narrative AI.
Canon: { characters, locations, events, world }
Previous scenes: [scene1, scene2, scene3]
Intent: "conflict"
User: Generate next scene following canon.
```

---

## 🎨 UI/UX Patterns

### **Gilded Aesthetic**
- Color palette: `#d4af70` (gold), `#0a0705` (dark), `#1a1410` (bg)
- Font: `Philosopher` (book), `Cinzel` (WorldTree headers)
- Animations: Subtle fades, pulses (e.g., generation progress star)

### **Three Pillars Navigation**
```
.pillswitch (fixed top)
  ├─ Книга (book icon)
  ├─ Всесвіт (tree icon)
  └─ Режисер (clapper icon)
```

### **Modals & Overlays**
- Account modal (profile, subscription, tokens)
- Generation progress overlay (animated star + "Генерується сцена X/Y")
- Scene Intent modal (10 intent options)

---

## 🔌 External Dependencies

### **Frontend**
- React 18.3.1 (UMD, in-browser)
- React DOM 18.3.1
- Babel Standalone 7.29.0 (in-browser JSX compilation)
- Firebase SDK 9.22.1 (compat mode)

### **Backend**
- Firebase Cloud Functions (Node.js 20)
- Anthropic SDK (`@anthropic-ai/sdk`)
- Google AI SDK (`@google/generative-ai`)

### **APIs**
- Claude API (Sonnet, Haiku)
- Gemini API (2.0 Flash)
- Firebase Auth, Firestore, Hosting

---

## 🚀 Deployment

**Production:** https://whitewrite.com (custom domain)
**Firebase Hosting:** https://whitewrite-app.web.app

**Deploy commands:**
```bash
firebase deploy --only hosting    # Deploy frontend
firebase deploy --only functions  # Deploy Cloud Functions
firebase deploy                   # Deploy everything
```

**Build process:**
- No build step (Babel compiles JSX in-browser)
- Deploy `app/` folder directly

---

## 🧩 Key Invariants

1. **Canon = Source of Truth** — Memory is derived, not duplicated
2. **Canon in project doc** — Not separate collection (unified save/versioning)
3. **Stable IDs** — `char_id123` (opaque) + `slug` + `name` (rename doesn't break links)
4. **projectId propagation** — `window.__currentProjectId` set globally
5. **Token consumption** — Always server-side (Cloud Functions deduct, frontend syncs)

---

## 📊 Performance Considerations

- **Pagination:** Character-based (520/580 chars per page) to prevent overflow
- **Canon extraction:** Async (doesn't block scene generation)
- **Firestore caching:** Client SDK caches reads
- **Iframe communication:** Minimal postMessage usage

---

## 🔒 Security

**Firestore Rules:**
- Users can only read/write their own projects
- Canon extraction logs: owner-only read
- Admin stats: role-based access

**Authentication:**
- Firebase Auth (Email/Password, Google)
- Server-side token validation in Cloud Functions

---

## 📝 Notes

- **DEPRECATED:** `public/` folder (old files, ignore)
- **Active development:** `app/` folder
- **Documentation:** `handoff/` folder
- **Session logs:** Track major changes (e.g., `PAGINATION_SESSION_2026-06-21.md`)

---

**Last updated:** 2026-06-23
**Maintained by:** WhiteWrite Team
