# WhiteWrite Architecture — Responsibility Map

**Мета:** Чітка карта "де що живе" — один файл = одна відповідальність.

---

## 🏛 Високорівнева структура

```
Shell (White.html)
  ├─ Pillar: Book (WhiteWrite.html)
  ├─ Pillar: WorldTree (WhiteWrite WorldTree.html)
  └─ Pillar: Director (WhiteWrite Workspace.html)
```

- **Shell** = навігація, projectId management, iframe lifecycle
- **Pillars** = iframe-додатки (book/universe/director), читають projectId з Context

---

## 📂 Файлова структура

### Shell (White.html)
**Відповідальність:** Єдина точка входу, навігація, projectId SSOT

| Функціонал | Де живе | Коментар |
|---|---|---|
| Auth UI | `White.html` (userdock + modals) | Login/logout/plan switcher |
| Navigation | `showView()`, `showPillar()` | Tabs + pillar routing |
| ProjectId SSOT | `window.__setCurrentProject()` | Shell writes, iframes read via postMessage |
| Iframe lifecycle | `ensureFrame()`, `loaded{}` | Lazy load iframes |
| Projects list | `fillHome()`, `loadProjects()` | In-shell view (not iframe) |

### Book Pillar (WhiteWrite.html)
**Відповідальність:** Narrative generation, scene editing, reading

| Функціонал | Де живе | Коментар |
|---|---|---|
| Scene generation | `app.jsx` → `firebase-ai.js` | Guided/Auto modes |
| Scene Intent UI | `app.jsx` (modal) | Conflict/character/action/etc |
| Canon extraction | Auto-triggers after generation | Background, auto-approve |
| Project creation | `app.jsx` → `firebase-projects.js` | New project form |
| Reading mode | `app.jsx` (render spread) | Parchment UI |

### WorldTree Pillar (WhiteWrite WorldTree.html)
**Відповідальність:** Canon management, entity graph

| Функціонал | Де живе | Коментар |
|---|---|---|
| Entity tree | `wt-app.jsx` (sidebar) | Characters/locations/events/etc |
| Entity detail | `wt-app.jsx` (main panel) | Edit entity fields |
| Relationship graph | `wt-graph.jsx` | D3 force graph |
| Canon CRUD | `firebase-canon.js` | Load/save canon to Firestore |

### Director Pillar (WhiteWrite Workspace.html)
**Відповідальність:** Storyboard, visual production

| Функціонал | Де живе | Коментар |
|---|---|---|
| Shot breakdown | `ws-director.jsx` | Scene → shots (manual/AI) |
| Visual canon | `ws-vizref.jsx` | Character/location LoRA refs |
| Scene picker | `ws-app.jsx` (dropdown) | Switch active scene |

---

## 🔥 Firebase Backend (Cloud Functions)

| Функціонал | Файл | Відповідальність |
|---|---|---|
| Scene generation | `functions/index.js` → `generateScene` | Claude/Gemini API, canon-aware prompts |
| Canon extraction | `functions/index.js` → `extractCanonFromScene` | Haiku extracts entities from scene text |
| Scene analysis | `functions/index.js` → `analyzeScene` | ANALYZE mode (narrative critique) |
| User init | `functions/index.js` → `initializeUser` | Plan setup (seed/storyteller/worldforge) |
| Stripe webhook | `functions/index.js` → `stripeWebhook` | Subscription lifecycle |
| Seed economy | `functions/index.js` → `seedEconomy` | One-time: populate economy_operations |
| AI models config | `functions/ai-models.js` | MODEL_PRICING, AI_MODELS (SSOT) |

---

## 📦 Shared Modules (app/firebase/)

| Модуль | Відповідальність |
|---|---|
| `firebase-init.js` | Firebase SDK init (auth, db, storage) |
| `firebase-auth.js` | Auth state, user plan, consumeTokens |
| `firebase-projects.js` | Project CRUD (getUserProjects, createProject, updateProject) |
| `firebase-scenes.js` | Scene CRUD + generation (generateScene call) |
| `firebase-canon.js` | Canon CRUD (getCanon, updateCanon) |
| `firebase-ai.js` | AI operations (generateScene wrapper, analyzeScene) |
| `token-budget.js` | Token costs, feature gates (read-only, mirrors backend) |

---

## 🗂 Data Layer (Firestore)

| Колекція | Відповідальність | SSOT |
|---|---|---|
| `users/{uid}` | User plan, tokens, subscriptions | Backend writes, frontend reads |
| `projects/{id}` | Project metadata + canon | Owner writes |
| `projects/{id}/scenes/{id}` | Scene text, canonRefs | Owner writes |
| `economy_operations/{op}` | Token pricing (data-driven) | Backend seed, all read |
| `usage_logs/{id}` | API cost tracking | Backend writes (append-only) |

---

## 🔑 Key Principles

1. **Single Source of Truth:**
   - ProjectId: Shell (`window.__setCurrentProject`)
   - AI Models: `ai-models.js` (backend + frontend)
   - Pricing: `economy_operations` (Firestore)

2. **Unidirectional Data Flow:**
   - Shell → iframes (postMessage)
   - Backend → Frontend (Firestore snapshots)
   - Never: iframe → shell writes

3. **Separation of Concerns:**
   - UI = pillars (React)
   - Business logic = Cloud Functions
   - Data = Firestore

4. **One File = One Responsibility:**
   - `firebase-auth.js` НЕ робить scene generation
   - `app.jsx` НЕ робить direct Firestore writes (через modules)

---

## 🚫 Anti-patterns (що НЕ робити)

❌ Дублювати логіку токенів у frontend + backend
✅ Backend = authoritative, frontend = read-only mirror

❌ Хардкодити ціни моделей у кількох файлах
✅ `ai-models.js` = єдине джерело

❌ Писати canon напряму з UI
✅ Через `firebase-canon.js` модуль

❌ Два джерела projectId (URL + global)
✅ Shell = writer, Context = reader

---

**Створено:** 2026-06-24 (Phase 1, REFACTOR_PLAN.md)
