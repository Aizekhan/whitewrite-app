# WhiteWrite Architecture Map

**Version:** 2.0.0 (2026-11-01)
**Status:** Canonical Reference (Single Source of Truth)

---

## 🎯 Purpose

This document is the **canonical architecture map** of WhiteWrite. All code, features, and decisions reference this document as the single source of truth.

**Philosophy:**
- **Canon-Aware Narrative Generation** — AI generates stories that respect world consistency
- **Three Pillars** — Book (write), WorldTree (canon), Workspace (visualize)
- **Single Canon** — All pillars read from one source (`WORLD`)
- **Reconstruction Engine** — Canon changes cascade through narrative automatically
- **World-first** — a World (canon) is the root; stories (projects) and games hang off it: **one canon → many stories, many games**
- **Game production** — Game Bible + production plan → tasks → Claude Code executes them over **MCP**, the author reviews

> **Rule (CLAUDE.md):** this file is updated with every change to architecture, data model, functions, rules or integrations — big or small.

---

## 📂 File Structure

```
E:\WhiteWrite/
├─ app/                          # Production (deployed to whitewrite.com)
│  ├─ White.html                 # Shell (navigation, auth, account)
│  ├─ WhiteWrite.html            # Book pillar (narrative generation)
│  ├─ WhiteWrite WorldTree.html  # WorldTree pillar (canon management)
│  ├─ WhiteWrite Workspace.html  # Workspace pillar (storyboard/LoRA)
│  ├─ WhiteWrite GameBible.html  # Game Bible (world-scoped): sections, cards, files, plan, tasks
│  ├─ gamebible.js               # Game Bible logic (plain JS, no JSX)
│  ├─ gb-3d.js                   # three.js viewer (GLB/GLTF/FBX/OBJ/STL) for card files
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
│  │  ├─ firebase-canon.js       # Canon CRUD (worlds/{w}/entities), createWorld/listWorlds/applyGenesis
│  │  ├─ ai-models.js            # AI_MODELS — single source of truth for model ids (front + back)
│  │  └─ token-budget.js         # Token system + plan budgets
│  │
│  ├─ wt-*.jsx                   # WorldTree components
│  ├─ ws-*.jsx                   # Workspace components
│  └─ assets/                    # Images, fonts, icons
│
├─ functions/
│  ├─ index.js                   # only assembles functions/src/*
│  ├─ canon-store.js             # loadCanon / mergeSuggestions / ensureWorld (lazy migration)
│  ├─ token-service.js           # token accounting, pricingFor(model) by alias prefix
│  └─ src/
│     ├─ common.js               # shared admin/db, auth helpers
│     ├─ scenes.js               # generateScene (+ buildCanonContext)
│     ├─ canon-extract.js        # canon extraction from scenes
│     ├─ canon-sync.js           # bulk sync / analyze
│     ├─ genesis.js              # genesisWorld — world seeds
│     ├─ gamedev.js              # gamedevPlan: import (.md) / analyze (GDD) / plan (+ scaffold, writes tasks)
│     ├─ mcp.js                  # mcp — MCP server for Claude Code (Task Engine executor API)
│     ├─ users.js, stripe.js, lemon.js, economy-admin.js
│
├─ scripts/build-app.mjs         # app/ → dist/ (precompiled JSX, prod React, ?v=hash cache-busting)
├─ dist/                         # BUILD OUTPUT served by Hosting — never edit or commit
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
    ├─ Home: «Створи свій світ» / «Обери свій світ» → Worlds → World hub (stories, Tree, Game Bible)
    ├─ Auth (Firebase Auth)
    ├─ Account view (Profile, Subscription, Tokens, Integrations · MCP / API)
    └─ Pillar iframes:
        ├─ WhiteWrite.html?projectId=X (Book)
        ├─ WhiteWrite WorldTree.html?projectId=X (WorldTree)
        ├─ WhiteWrite Workspace.html?projectId=X (Workspace)
        └─ WhiteWrite GameBible.html?worldId=W (Game Bible, world-scoped)
```

External executor:
```
Claude Code (author's machine)  ──MCP Streamable HTTP + Bearer wwk_…──▶  functions:mcp  ──▶  Firestore (tasks, executions, …)
```

**Communication:**
- Shell → Iframe: `window.postMessage({ type: "ww-mode", mode: "work" })`
- Iframe → Shell: `window.parent.postMessage(...)`

---

### **Data Flow**

```
User Action
    ↓
Frontend (React; in-browser Babel locally, precompiled in dist/ on prod)
    ↓
Firebase SDK (app/firebase/*.js)
    ↓
Cloud Functions (functions/src/*, gen2, us-central1)
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

  worldId: "w_...",              // the World this story belongs to (canon lives there)
  canon: { ... },                // LEGACY — kept for rollback, no longer read

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

#### **`worlds/{worldId}`** — the canon root
```javascript
{ owner: "uid", name, desc, tone, laws: [...], facts: [...], createdAt, updatedAt }
```
- `worlds/{w}/entities/{id}` — canon entities: `{ kind: "character|location|event|faction|artifact", type, name, slug, desc, ..., mapPos, inferred?, confidence? }`
- Several projects can share one world (`project.worldId`).

#### **`worlds/{w}/games/{g}`** — Game Bible (one canon → many games)
```javascript
{ title, engine: { profile }, sections: [...custom], createdAt }
```
- `cards/{cardId}` — game cards: `{ section, title, status: idea|work|agreed|ingame, fields: {..., group}, note, files: [{id,name,url,path,size}], canonRef?, planTask? }`.
  Game fields of a canon entity live here (`canonRef`), **not** on the entity.
- `plan/current` — `{ analysis (GDD + questions), plan: { milestones: [{ id, title, gate, tasks: [...] }] }, scaffold, running }`
- `tasks/{taskId}` — **Task Engine**: `{ id, milestone, title, detail, deps, owner, size, cards, accept[], tests[], prompt, order,
  status: todo|in_progress|review|done|rework|blocked, progress, blocker, report: { summary, commit, changes, tests, criteria, check }, history[] }`
- `executions/{id}` — log of every MCP tool call `{ tool, taskId, at, ... }`
- `changeRequests/{id}` — executor asks to change the design `{ what, why, taskId, status: open|accepted|rejected }`
- Files: Firebase Storage `worlds/{w}/games/{g}/files/**`

#### **`mcpKeys/{sha256(key)}`** — executor keys
```javascript
{ uid, worldId, gameId, label, prefix, createdAt, lastUsedAt, revoked? }
```
The key `wwk_…` is shown once; only its sha256 is stored. Created per game in Game Bible → Production plan; listed/revoked in Account → Integrations.

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

**Storage (since 2026-10-31):** canon lives in `worlds/{w}` + `entities/{id}` (see schema), not in `project.canon`.
Backend: `functions/canon-store.js`; frontend: `app/firebase/firebase-canon.js`.

**Canon Extraction:**
- After scene generation → `extractCanonFromScene()` (Claude Haiku)
- Extracts entities → stores in `memorySuggestions` (inferred canon)
- User reviews → approves → moves to `canon`

---

### **3. AI Generation**

**Models:** only from `app/firebase/ai-models.js` (`AI_MODELS`, shared by front and back) — never hardcode ids.
- Gemini — default for lower plans
- Claude — for plans with `allowClaude`

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

### **4. Game Bible & Production Plan**

**Files:** `app/WhiteWrite GameBible.html`, `app/gamebible.js`, `app/gb-3d.js`, `functions/src/gamedev.js`
**Access:** plans with `allowGameDev` (worldbuilder, worldforge); reading stays with the owner.

- **Standard 14 sections:** overview, lore, mechanics, progression, levels, enemies, gear, assets, materials, animation, audio, ui, refs, tech (+ custom) and the Production plan.
- Cards have subheadings (`fields.group` / `category`): each section has **standard subheadings** (`groups` in `GAME[]`, e.g. Mechanics: Рух, Бій, Здібності, Взаємодія, Камера й керування, Смерть і відродження, Перемога й поразка) + the author's own («＋ Створити підзаголовок» opens a styled dialog). Standard ones go first in menus and on the page and are sent to AI (`shelves[].groups`) for import and scaffold.
- Real files (Storage) and a 3D viewer (corner «🧊 3D» on the card). Saving a card closes its panel.
- Embedded in the shell, the section title and its actions sit on the logo strip (`#topline`, filled by a MutationObserver after each render); the shell's `.rail` lets clicks through (`pointer-events:none`, buttons `auto`).
- `gamedevPlan` ops: `import` (.md notes → proposal, chunked + streaming), `analyze` (GDD + questions), `plan` (milestones with gates + tasks with `accept`/`tests`/`cards`/`prompt` + `scaffold` of missing sections/cards).
- Applying the scaffold creates ticked cards with status `work`.
- `plan` also writes the **Task Engine** docs (`writeTasks`): open `todo`/`rework` tasks are replaced, taken/done ones are kept.

### **5. Task Engine + MCP executor (Claude Code)**

**Files:** `functions/src/mcp.js` (server), `app/gamebible.js` (execution UI), `app/White.html` (Account → Integrations)
**Endpoint:** `https://us-central1-whitewrite-app.cloudfunctions.net/mcp` — MCP Streamable HTTP, stateless JSON-RPC (`initialize`, `tools/list`, `tools/call`, `ping`; notifications → 202; GET → 405).
**Auth:** `Authorization: Bearer wwk_…` → sha256 → `mcpKeys` (not revoked) → owner's plan must have `allowGameDev`. The key is scoped to one game.

**Connect:**
```bash
claude mcp add --transport http whitewrite https://us-central1-whitewrite-app.cloudfunctions.net/mcp --header "Authorization: Bearer wwk_..."
```

**Tools:** `get_project_overview`, `list_tasks`, `get_next_task` (resumes in_progress/rework, else claims first ready todo — ready = all deps done),
`get_task_details`, `get_design_section`, `get_card` (`c:id` / `e:id`), `report_task_progress`, `report_blocker`, `submit_task_result` (→ review, server `check`), `submit_change_request`.

**Cycle:**
```
plan → tasks(todo) → Claude Code: get_next_task (in_progress) → report_task_progress → submit_task_result (review)
     → author: Прийняти (done, linked cards → ingame) | Повернути (rework + comment)
     blocked → author answers → todo;   change request → author accepts/rejects
```
Every tool call is logged in `executions` (activity feed in the Game Bible).

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
- Firebase Auth, Firestore, Hosting, Storage
- MCP (Model Context Protocol) — WhiteWrite is an MCP **server** for Claude Code
- three.js (CDN, import map) — 3D viewer in the Game Bible

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
- `npm run build:app` → `scripts/build-app.mjs`: `app/` → `dist/` (JSX precompiled, prod React, local scripts get `?v=<content hash>`)
- Runs automatically as hosting predeploy; Hosting serves `dist/`
- HTML is served `Cache-Control: no-cache` (embedded pillars pick up new versions); scripts are cache-busted by hash

---

## 🧩 Key Invariants

1. **Canon = Source of Truth** — Memory is derived, not duplicated
2. **Canon lives in the World** — `worlds/{w}/entities/{id}`; projects reference it via `worldId` (legacy `project.canon` not read)
3. **Stable IDs** — `char_id123` (opaque) + `slug` + `name` (rename doesn't break links)
4. **projectId propagation** — `window.__currentProjectId` set globally
5. **Token consumption** — Always server-side (Cloud Functions deduct, frontend syncs)
6. **Inferred canon is not fact** — needs confirmation before it feeds generation or reconstruction
7. **Game fields are not canon** — they live in `games/{g}/cards` with `canonRef`
8. **Models only from `ai-models.js`**

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
- Worlds/entities: owner only; `games/**` write requires `allowGameDev` plan (`hasGameDev()`)
- `mcpKeys`: owner reads/deletes; create only for own world + gamedev plan, fixed field set; no client updates
- Billing fields on `users/{uid}` are server-only
- MCP: key hashed (sha256), per-game scope, revocable, plan re-checked on every call; function is public-invoker, auth is in code
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

**Last updated:** 2026-11-01
**Maintained by:** WhiteWrite Team
