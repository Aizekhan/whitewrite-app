# WhiteWrite — Refactoring Plan (Реорганізація структури)

## 🎯 Мета

Створити **чітку структуру проєкту**, де кожен розробник (або наступна сесія) одразу розуміє:
- Які файли для production, які legacy
- Де знаходиться кожен додаток (Main App, Canon Editor, Director)
- Які файли shared (Firebase, utilities)

---

## 📂 Нова структура

```
public/
  ├── index.html                    ← Entry point (Shell → redirects to apps)
  ├── 404.html                      ← Error page
  ├── styles.css                    ← Shared styles (extracted from index.html)
  │
  ├── main-app/                     ← PRODUCTION: Main React App
  │   ├── app.html                  ← Entry point (Form → Book flow)
  │   ├── app.jsx                   ← App router
  │   ├── flow.jsx                  ← StartScreen + StoryForm
  │   ├── book.jsx                  ← Book reader
  │   ├── pages.jsx                 ← Page components
  │   ├── book-edit.jsx             ← Book editor (якщо використовується)
  │   ├── book-related.jsx          ← Related entities panel
  │   └── atmosphere.jsx            ← Particles background
  │
  ├── canon-editor/                 ← PRODUCTION: World Tree (Canon Editor)
  │   ├── worldtree.html            ← Entry point (renamed from WorldTree.html)
  │   ├── wt-app.jsx                ← World Tree app
  │   ├── wt-tree.jsx               ← Tree UI
  │   ├── wt-impact.jsx             ← Reconstruction engine
  │   ├── wt-reconstruct.jsx        ← Reconstruction UI
  │   ├── wt-workspace.jsx          ← Workspace utilities
  │   ├── wt-adapters.jsx           ← Data adapters
  │   └── wt-icons.jsx              ← Icons
  │
  ├── director-workspace/           ← PRODUCTION: Director (Storyboards/Shots)
  │   ├── workspace.html            ← Entry point (renamed from Workspace.html)
  │   ├── ws-app.jsx                ← Workspace app
  │   ├── ws-director.jsx           ← Director UI
  │   ├── ws-vizref.jsx             ← Visual references (LoRA)
  │   ├── ws-data.jsx               ← Workspace data
  │   ├── ws-icons.jsx              ← Icons
  │   └── image-slot.js             ← Image upload/handling
  │
  ├── shared/                       ← SHARED: Firebase, utilities, components
  │   ├── firebase/
  │   │   ├── firebase-init.js
  │   │   ├── firebase-auth.js
  │   │   ├── firebase-projects.js
  │   │   ├── firebase-scenes.js
  │   │   └── firebase-ai.js
  │   ├── kb.js                     ← Knowledge Base utilities
  │   └── ww-embed.js               ← Embed utilities
  │
  ├── legacy/                       ← LEGACY: Старі файли (не для production)
  │   ├── whitewrite.html           ← Старий прототип книги
  │   └── index.old.html            ← Старий redirect
  │
  ├── prototype/                    ← PROTOTYPE: Mock дані, демо
  │   └── wt-world.jsx              ← Mock дані "Попіл Орелії"
  │
  └── assets/                       ← Images, fonts, etc.
      ├── StartBack.jpg
      ├── OpenedBook.jpg
      └── ...
```

---

## 🔄 План переміщення файлів

### Step 1: Main App
```bash
# Create app.html (new entry point for React App)
# Move React components
mv public/app.jsx public/main-app/
mv public/flow.jsx public/main-app/
mv public/book.jsx public/main-app/
mv public/pages.jsx public/main-app/
mv public/book-edit.jsx public/main-app/
mv public/book-related.jsx public/main-app/
mv public/atmosphere.jsx public/main-app/
```

### Step 2: Canon Editor
```bash
# Rename + move
mv "public/WhiteWrite WorldTree.html" public/canon-editor/worldtree.html
mv public/wt-*.jsx public/canon-editor/
```

### Step 3: Director Workspace
```bash
# Rename + move
mv "public/WhiteWrite Workspace.html" public/director-workspace/workspace.html
mv public/ws-*.jsx public/director-workspace/
mv public/image-slot.js public/director-workspace/
```

### Step 4: Shared modules
```bash
# Create shared/firebase/ folder
mkdir -p public/shared/firebase
mv public/firebase-*.js public/shared/firebase/

# Move utilities
mv public/kb.js public/shared/
mv public/ww-embed.js public/shared/
```

### Step 5: Legacy
```bash
mv public/whitewrite.html public/legacy/
mv public/index.old.html public/legacy/
```

### Step 6: Prototype
```bash
mv public/wt-world.jsx public/prototype/
```

---

## 🔧 Оновлення конфігурації

### firebase.json (rewrites для routing)
```json
{
  "hosting": {
    "public": "public",
    "rewrites": [
      {
        "source": "/",
        "destination": "/index.html"
      },
      {
        "source": "/app",
        "destination": "/main-app/app.html"
      },
      {
        "source": "/canon",
        "destination": "/canon-editor/worldtree.html"
      },
      {
        "source": "/director",
        "destination": "/director-workspace/workspace.html"
      }
    ]
  }
}
```

### index.html (Shell — список проєктів)
```javascript
// Updated redirect
function openNarrative(projectId) {
  if (projectId) {
    window.location.href = '/app?projectId=' + projectId;
  } else {
    window.location.href = '/app';
  }
}
```

### main-app/app.html (новий entry point)
```html
<!DOCTYPE html>
<html lang="uk">
<head>
  <title>WhiteWrite — Книга</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="root"></div>

  <!-- React + Babel -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>

  <!-- Firebase -->
  <script src="/shared/firebase/firebase-init.js"></script>
  <script src="/shared/firebase/firebase-auth.js"></script>
  <script src="/shared/firebase/firebase-projects.js"></script>
  <script src="/shared/firebase/firebase-scenes.js"></script>
  <script src="/shared/firebase/firebase-ai.js"></script>

  <!-- React App -->
  <script type="text/babel" src="app.jsx"></script>
  <script type="text/babel" src="flow.jsx"></script>
  <script type="text/babel" src="book.jsx"></script>
  <script type="text/babel" src="pages.jsx"></script>
  <script type="text/babel" src="atmosphere.jsx"></script>
</body>
</html>
```

---

## 📝 Оновлення імпортів

Після переміщення оновити шляхи:

### firebase-init.js, firebase-auth.js тощо
Залишаються як є (абсолютні шляхи)

### app.jsx, flow.jsx, book.jsx
Залишаються як є (відносні шляхи в межах main-app/)

### canon-editor/worldtree.html
```html
<!-- OLD -->
<script src="wt-app.jsx"></script>

<!-- NEW (якщо потрібен shared Firebase) -->
<script src="/shared/firebase/firebase-init.js"></script>
<script src="wt-app.jsx"></script>
```

---

## 🚀 Тестування після рефакторингу

1. **Main App:**
   - Відкрити `/app` → має показати StartScreen/Form/Book
   - Клікнути проєкт на `/` → redirect на `/app?projectId=xxx` → Form → Book

2. **Canon Editor:**
   - Відкрити `/canon` → має показати World Tree

3. **Director:**
   - Відкрити `/director` → має показати Workspace

4. **Shell:**
   - Відкрити `/` → має показати список проєктів
   - Кнопка "Відкрити" → redirect на `/app?projectId=xxx`

---

## ✅ Переваги нової структури

1. **Clarity:** Одразу зрозуміло де що знаходиться
2. **Separation:** Main App / Canon / Director / Shared / Legacy
3. **No confusion:** Неможливо переплутати прототип з production
4. **Easy onboarding:** Новий розробник одразу розуміє структуру
5. **Clean URLs:** `/app`, `/canon`, `/director` замість довгих назв файлів

---

## 📚 Документація

Після рефакторингу створити:

### public/README.md
```markdown
# WhiteWrite — File Structure

## Production Apps

- `/app` → Main App (Book reader, scene generation)
- `/canon` → Canon Editor (World Tree)
- `/director` → Director Workspace (Storyboards, shots)

## Folders

- `main-app/` — Main React app (Form → Book)
- `canon-editor/` — Canon editor (World Tree)
- `director-workspace/` — Director (storyboards/shots)
- `shared/` — Firebase modules, utilities
- `legacy/` — Old files (not used in production)
- `prototype/` — Mock data, demos

## Entry points

- `index.html` — Shell (project list)
- `main-app/app.html` — React App
- `canon-editor/worldtree.html` — World Tree
- `director-workspace/workspace.html` — Director
```

---

**Автор:** Claude Code
**Дата:** 2026-06-11
**Статус:** Plan ready, ready to execute
