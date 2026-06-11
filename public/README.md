# WhiteWrite — Public Folder Structure

## 🎯 Огляд

WhiteWrite складається з **3 окремих додатків** + shared модулі:

1. **Main App** (`/app`) — Головний додаток (Form → Book)
2. **Canon Editor** (`/canon`) — Редактор канону (World Tree)
3. **Director Workspace** (`/director`) — Режисерський простір (Storyboards, Shots)

---

## 📂 Структура папок

```
public/
  ├── index.html                ← Shell (список проєктів, навігація)
  ├── 404.html                  ← Error page
  │
  ├── main-app/                 ← Main React App
  │   ├── app.html              ← Entry point
  │   ├── app.jsx               ← Router
  │   ├── flow.jsx              ← Form (StartScreen + StoryForm)
  │   ├── book.jsx              ← Book reader
  │   └── pages.jsx             ← Page components
  │
  ├── canon-editor/             ← Canon Editor (World Tree)
  │   ├── worldtree.html        ← Entry point
  │   ├── wt-app.jsx            ← App
  │   ├── wt-tree.jsx           ← Tree UI
  │   └── wt-impact.jsx         ← Reconstruction engine
  │
  ├── director-workspace/       ← Director
  │   ├── workspace.html        ← Entry point
  │   ├── ws-app.jsx            ← App
  │   └── ws-director.jsx       ← Director UI
  │
  ├── shared/                   ← Shared modules
  │   └── firebase/             ← Firebase CRUD
  │       ├── firebase-init.js
  │       ├── firebase-auth.js
  │       ├── firebase-projects.js
  │       ├── firebase-scenes.js
  │       └── firebase-ai.js
  │
  ├── legacy/                   ← Old files (DO NOT USE)
  └── prototype/                ← Mock data, demos
```

---

## 🚀 Entry Points (URLs)

| URL | File | Description |
|-----|------|-------------|
| `/` | `index.html` | Shell (список проєктів) |
| `/app` | `main-app/app.html` | Main App (Form → Book) |
| `/canon` | `canon-editor/worldtree.html` | Canon Editor |
| `/director` | `director-workspace/workspace.html` | Director |

---

## 🔄 User Flow

### 1. Create New Project
```
/                           (Shell: список проєктів)
  ↓ Click "Створити свою історію"
/app                        (React App: StartScreen)
  ↓ Fill form
/app                        (StoryForm з даними)
  ↓ Click "Почати творити"
/app?projectId=xxx          (Book: Title + Blank page)
  ↓ Navigate to Scene Intent
/app?projectId=xxx          (Scene Intent page)
  ↓ Generate scene
/app?projectId=xxx          (Book: Title + Scene 1)
```

### 2. Open Existing Project
```
/                           (Shell: список проєктів)
  ↓ Click "Відкрити всесвіт" on project card
/app?projectId=xxx          (StoryForm з передзаповненими даними)
  ↓ Click "Почати творити"
/app?projectId=xxx          (Book: shows generated scenes)
```

### 3. Edit Canon
```
/                           (Shell)
  ↓ Click "Canon" in navigation
/canon                      (World Tree)
  ↓ Edit characters, locations, etc.
```

### 4. Create Storyboards
```
/                           (Shell)
  ↓ Click "Director" in navigation
/director                   (Workspace)
  ↓ Create storyboards, shots
```

---

## 📦 Firebase Modules

Located in `shared/firebase/`:

### firebase-init.js
Ініціалізація Firebase SDK.

### firebase-auth.js
- Anonymous sign-in (auto)
- Google OAuth
- Email/Password auth

### firebase-projects.js
CRUD для проєктів:
- `getProjects()` — список проєктів користувача
- `getProject(id)` — один проєкт
- `createProject(data)` — створити
- `updateProject(id, data)` — оновити
- `deleteProject(id)` — видалити

### firebase-scenes.js
CRUD для сцен (subcollection):
- `getScenes(projectId)` — список сцен проєкту
- `getScene(projectId, sceneId)` — одна сцена
- `addScene(projectId, data)` — додати сцену
- `updateScene(projectId, sceneId, data)` — оновити
- `deleteScene(projectId, sceneId)` — видалити

### firebase-ai.js
AI генерація:
- `generateScene(projectId, sceneIntent, customIntent, previousScenes)` — згенерувати сцену через Gemini API

---

## 🗂 Main App Components

### app.jsx
Router для Main App:
- StartScreen → StoryForm → Book
- Читає `?projectId=xxx` з URL
- Завантажує проєкт з Firestore

### flow.jsx
- `StartScreen` — лендінг з кнопкою "Створити свою історію"
- `StoryForm` — форма створення/відкриття проєкту

### book.jsx
- `Book` — головний компонент читання
- `GeneratedScenePage` — відображення згенерованої сцени
- `buildScenesFromFirestore()` — будує книгу з Firestore даних

### pages.jsx
- `TitlePage` — обкладинка книги
- `SceneIntentPage` — вибір напряму наступної сцени
- `ColophonPage` — колофон
- `CharactersLeft/Right` — персонажі (placeholder)

---

## 🌳 Canon Editor Components

### wt-app.jsx
World Tree app router.

### wt-tree.jsx
Візуальне дерево канону (персонажі, локації, події, фракції, артефакти).

### wt-impact.jsx
Reconstruction engine — аналізує вплив змін канону на сцени.

### wt-reconstruct.jsx
UI для реконструкції сцен після змін канону.

---

## 🎬 Director Components

### ws-app.jsx
Director app router.

### ws-director.jsx
UI для створення storyboards та shots.

### ws-vizref.jsx
Visual references (LoRA training references).

---

## 🚫 Legacy Files (DO NOT USE)

### legacy/whitewrite.html
Старий прототип книги. **Замінений на main-app/**.

### legacy/index.old.html
Старий redirect. **Не використовується**.

---

## 🧪 Prototype Files (FOR DEMO ONLY)

### prototype/wt-world.jsx
Mock дані "Попіл Орелії" (hardcoded персонажі, сцени).
**Використовується лише в демо**, НЕ в production.

---

## 🔒 Firestore Schema

```
projects/{projectId}
  ├── owner: string (userId)
  ├── title: string
  ├── desc: string
  ├── scope: "short" | "novella" | "novel" | "season"
  ├── genres: string[]
  ├── written: number (scenes count)
  ├── canonAware: boolean
  ├── canon: {
  │    └── characters: {...}
  │    └── locations: {...}
  │    └── events: {...}
  │    └── factions: {...}
  │    └── artifacts: {...}
  │    └── world: {...}
  │}
  └── scenes (subcollection)
       └── {sceneId}
            ├── n: number (порядковий номер)
            ├── title: string
            ├── text: string
            ├── intent: "conflict" | "character" | "action" | ...
            ├── entities: {characters, locations, events, artifacts}
            └── reconstruction: {mode, affectedBy, lastReconstructionAt}
```

---

## 🛠 Development

### Local server
```bash
firebase serve
# Open http://localhost:5000
```

### Deploy
```bash
firebase deploy --only hosting
```

### Test flows
1. Create project → Generate scene → Verify in Firestore
2. Open existing project → See pre-filled form
3. Navigate /canon → Edit canon
4. Navigate /director → Create storyboards

---

## 📚 Documentation

- `../CLAUDE.md` — Project instructions (must read!)
- `../FIRESTORE_SCHEMA.md` — Complete Firestore schema
- `../ARCHITECTURE_AUDIT.md` — Architecture analysis
- `../REFACTORING_PLAN.md` — Refactoring plan (if executed)
- `../SESSION_REPORT.md` — Latest session report
- `../MANUAL_TEST_CHECKLIST.md` — Testing guide

---

## ⚠️ Important Notes

1. **React in-browser compilation:** Uses Babel standalone (not production-ready, consider Vite/Webpack)
2. **Firebase rules:** Owner-based access (secure)
3. **API keys:** Stored in Cloud Functions secrets (`GEMINI_API_KEY`)
4. **Real-time refresh:** Book auto-refreshes scenes every 5 seconds

---

**Last updated:** 2026-06-11
**Maintainer:** Claude Code
