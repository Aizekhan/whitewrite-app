# WhiteWrite — Architecture Audit (Дублювання коду)

## 🔍 Виявлені проблеми

### ❌ P0: index.html — гібрид без React App

**Проблема:**
- `index.html` (87KB) — величезний файл з **dual personality**
- Містить старий Shell код (White.html стиль): список проєктів, модалки, навігація
- **НЕ містить React App** (app.jsx, book.jsx, flow.jsx)
- Кнопка "Відкрити всесвіт" робить redirect на `/?projectId=xxx`
- Але `/` === index.html, яка **не рендерить React!**

**Наслідок:**
- Redirect на `/?projectId=xxx` відкриває index.html
- index.html не має `<div id="root">` та React scripts
- app.jsx **не завантажується** → користувач бачить пустий екран або старий Shell

**Файли:**
```
public/
  index.html (87KB)           ← Shell (список проєктів) БЕЗ React
  app.jsx (5KB)               ← React App (StartScreen → Form → Book)
  book.jsx (20KB)             ← Book component
  flow.jsx (15KB)             ← StoryForm component
  pages.jsx (12KB)            ← Page components
```

**Що має бути:**
- index.html має бути **OR** Shell **OR** React App, НЕ обидва
- Зараз це **ні те ні се** — Shell без React

---

### 🟡 P1: Дублювання HTML файлів (4 окремі додатки)

**Файли:**
```
public/
  index.html (87KB)                    ← Shell + (мала бути) React App
  whitewrite.html (66KB)               ← Прототип "Книга" (старий)
  WhiteWrite WorldTree.html (48KB)    ← Canon editor (World Tree)
  WhiteWrite Workspace.html (39KB)    ← Director (storyboards/shots)
  404.html (1.8KB)                     ← Error page
  index.old.html (359B)                ← Застарілий redirect
```

**Дублювання:**
- `whitewrite.html` vs `index.html` — обидва мають Shell код (навігація, проєкти)
- `whitewrite.html` — старий прототип, який **більше не потрібен** (замінений на index.html + app.jsx)

**Рекомендації:**
- ✅ Залишити: `index.html`, `WorldTree.html`, `Workspace.html`, `404.html`
- ❌ Видалити: `whitewrite.html` (застарілий), `index.old.html` (redirect)

---

### 🟡 P1: Дублювання Firebase модулів

**Файли:**
```
public/
  firebase-init.js (744B)      ← Ініціалізація Firebase
  firebase-auth.js (4.9KB)     ← Auth + Anonymous sign-in
  firebase-projects.js (3.9KB) ← Projects CRUD
  firebase-scenes.js (6.7KB)   ← Scenes CRUD
  firebase-ai.js (4.3KB)       ← AI generation client
```

**Статус:** ✅ Немає дублювання (кожен модуль окремий)

---

### 🟡 P1: Дублювання React компонентів

**App entry points:**
```
public/
  app.jsx (5KB)         ← Main app (index.html) — Shell → Form → Book
  wt-app.jsx (8KB)      ← World Tree app (WorldTree.html)
  ws-app.jsx (5KB)      ← Workspace app (Workspace.html)
```

**Компоненти:**
```
public/
  book.jsx (20KB)           ← Book reader (main)
  book-edit.jsx (10KB)      ← Book editor (unused?)
  book-related.jsx (8KB)    ← Related entities panel

  flow.jsx (15KB)           ← StartScreen + StoryForm
  pages.jsx (12KB)          ← Page components (TitlePage, SceneIntentPage, etc.)
  atmosphere.jsx (4KB)      ← Particles background

  wt-world.jsx (37KB)       ← World Tree data (MOCK для прототипу)
  wt-tree.jsx (2.4KB)       ← World Tree UI
  wt-impact.jsx (9KB)       ← Reconstruction engine
  wt-reconstruct.jsx (10KB) ← Reconstruction UI
  wt-workspace.jsx (21KB)   ← Workspace utilities
  wt-adapters.jsx (7.9KB)   ← Data adapters

  ws-director.jsx (14KB)    ← Director UI
  ws-vizref.jsx (11KB)      ← Visual references (LoRA)
  ws-data.jsx (3.9KB)       ← Workspace data
```

**Дублювання:**
- `wt-world.jsx` (37KB) — **MOCK дані** для прототипу
  - Містить hardcoded персонажі, локації, сцени ("Попіл Орелії")
  - Використовується у WorldTree.html
  - **НЕ використовується** в production (index.html + Firestore)

**Рекомендації:**
- Перемістити прототипні файли (`wt-*`, `ws-*`) в `/prototype/` папку
- Або видалити якщо більше не потрібні

---

### 🟡 P2: Великі утилітарні файли

```
public/
  kb.js (33KB)          ← Knowledge Base utilities (що це?)
  image-slot.js (31KB)  ← Image upload/handling (для Director?)
```

**Потребує огляду:**
- Чи використовуються ці файли в production?
- Чи можна їх розбити на модулі?

---

## 📊 Статистика файлів

### HTML (4 окремі додатки):
```
index.html           87KB   ← Shell (БЕЗ React!)
whitewrite.html      66KB   ← Старий прототип
WorldTree.html       48KB   ← Canon editor
Workspace.html       39KB   ← Director
404.html             1.8KB  ← Error page
index.old.html       359B   ← Застарілий
```

### React Components:
```
Main App (index.html):
  app.jsx              5KB
  book.jsx            20KB
  flow.jsx            15KB
  pages.jsx           12KB
  atmosphere.jsx       4KB

World Tree (WorldTree.html):
  wt-app.jsx           8KB
  wt-world.jsx        37KB  ← MOCK дані
  wt-tree.jsx          2KB
  wt-impact.jsx        9KB
  wt-reconstruct.jsx  10KB
  wt-workspace.jsx    21KB

Workspace (Workspace.html):
  ws-app.jsx           5KB
  ws-director.jsx     14KB
  ws-vizref.jsx       11KB
```

### Firebase Modules:
```
firebase-init.js      744B
firebase-auth.js     4.9KB
firebase-projects.js 3.9KB
firebase-scenes.js   6.7KB
firebase-ai.js       4.3KB
```

---

## 🔧 Критична проблема: index.html БЕЗ React

### Поточна структура index.html:

```html
<!DOCTYPE html>
<html>
<head>
  <title>WhiteWrite</title>
  <style>
    /* 2000+ lines CSS для Shell */
  </style>
</head>
<body>
  <!-- Shell UI: навігація, список проєктів, модалки -->
  <div id="rail">...</div>
  <div id="views">...</div>
  <div id="auth-modal">...</div>

  <!-- ❌ НЕМАЄ <div id="root"></div> для React! -->

  <script>
    /* 1500+ lines JavaScript для Shell */
    function openNarrative(projectId) {
      window.location.href = '/?projectId=' + projectId; // ← Redirect сюди
    }
  </script>

  <!-- Firebase SDK -->
  <script src="firebase-init.js"></script>
  <script src="firebase-projects.js"></script>

  <!-- ❌ НЕМАЄ React/Babel! -->
  <!-- ❌ НЕМАЄ app.jsx! -->
</body>
</html>
```

### Що має бути (2 варіанти):

#### Варіант A: Роздільні сторінки
```
/                   → index.html (Shell: список проєктів)
/book?projectId=xxx → book.html (React App: Form → Book)
/worldtree          → WorldTree.html
/workspace          → Workspace.html
```

#### Варіант B: Єдина SPA (recommended)
```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>WhiteWrite</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="root"></div>

  <!-- React + Babel -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <!-- Firebase -->
  <script src="firebase-init.js"></script>
  <script src="firebase-auth.js"></script>
  <script src="firebase-projects.js"></script>
  <script src="firebase-scenes.js"></script>
  <script src="firebase-ai.js"></script>

  <!-- React App -->
  <script type="text/babel" src="app.jsx"></script>
  <script type="text/babel" src="flow.jsx"></script>
  <script type="text/babel" src="book.jsx"></script>
  <script type="text/babel" src="pages.jsx"></script>
  <script type="text/babel" src="atmosphere.jsx"></script>
</body>
</html>
```

**CSS винести в окремий файл:**
```
public/
  index.html (мінімальний)
  styles.css (CSS з index.html)
  app.jsx
  ...
```

---

## ✅ Рекомендації

### Immediate (P0):

1. **Виправити index.html — додати React:**
   - Додати `<div id="root"></div>`
   - Підключити React/ReactDOM/Babel
   - Підключити app.jsx, flow.jsx, book.jsx, pages.jsx
   - Винести CSS в окремий файл

2. **Видалити Shell код з index.html:**
   - Перемістити в окремий файл `shell.html` (якщо потрібен)
   - Або інтегрувати в React App (як окремий route)

### Short-term (P1):

3. **Видалити застарілі файли:**
   - `whitewrite.html` (замінений на index.html + app.jsx)
   - `index.old.html` (redirect)

4. **Організувати прототипні файли:**
   - Перемістити `wt-*`, `ws-*` в `/prototype/` або `/legacy/`
   - Або видалити якщо більше не потрібні

### Medium-term (P2):

5. **Оптимізувати bundle:**
   - Винести CSS в окремі файли
   - Розглянути build step (Vite/Webpack замість Babel in-browser)
   - Code splitting для великих компонентів

---

## 📁 Рекомендована структура

```
public/
  # Main App
  index.html (10KB)           ← Мінімальний HTML + React scripts
  styles.css (30KB)           ← CSS з index.html
  app.jsx                     ← Main app router

  # Components
  components/
    book.jsx
    flow.jsx
    pages.jsx
    atmosphere.jsx

  # Firebase
  firebase/
    firebase-init.js
    firebase-auth.js
    firebase-projects.js
    firebase-scenes.js
    firebase-ai.js

  # Separate Apps
  worldtree.html              ← World Tree (окрема сторінка)
  workspace.html              ← Director (окрема сторінка)

  # Legacy/Prototype (optional)
  legacy/
    whitewrite.html           ← Старий прототип
    wt-world.jsx              ← Mock дані
    ...
```

---

**Автор:** Claude Code
**Дата:** 2026-06-11
**Статус:** Critical — index.html не працює з React App
