# TODO - Наступна сесія

## ✅ Що зробили сьогодні (Steps 0-2 готові, Step 3 частково)

### Step 0: Vite + Prototype ✅
- Vite dev server запущено
- Prototype скопійовано в `public/`
- White.html доступний на localhost:5177/White.html

### Step 1: Firestore CRUD ✅
- `firebase-init.js` - ініціалізація Firebase
- `firebase-projects.js` - CRUD операції для проєктів
- Firestore колекція `projects/{id}` з полем `owner`
- Canon structure готова: `canonAware:true` + `canon.{characters,locations,events,...}`
- Composite index: (owner ASC, createdAt DESC)
- Manual sorting (уникнути index requirement)
- Протестовано: create, read, update, delete

### Step 2: Firebase Auth ✅
- `firebase-auth.js` - Email/Password + Google Sign-In
- `onAuthStateChanged` listener
- User dock показує email/avatar
- Firestore rules: owner-based access (`request.auth.uid == resource.data.owner`)
- Auth timing виправлено: `loadProjects()` викликається ПІСЛЯ `onAuthStateChanged`

### Step 3: AI Cloud Functions (частково) ⏳
**Готово:**
- ✅ Cloud Function `generateScene` задеплоєна (Node.js 20, us-central1)
- ✅ Gemini 1.5 Flash інтегрований (@google/generative-ai SDK)
- ✅ GEMINI_API_KEY налаштований як Firebase Secret
- ✅ Canon-aware генерація (екстрагує characters/locations/events з проєкту)
- ✅ Scene Intent mapping (conflict/character/action/romance/worldbuilding/surprise/custom)
- ✅ `firebase-ai.js` клієнтський модуль + `__testGenerateScene()` helper
- ✅ Firebase Blaze plan увімкнений

**НЕ готово (треба наступної сесії):**
- ❌ UI для створення нового проєкту ("Новий всесвіт" button → modal форма)
- ❌ UI для вибору Scene Intent в процесі написання
- ❌ Інтеграція з WhiteWrite.html (книжковий інтерфейс)
- ❌ Loading states + результати генерації в UI

---

## 🎯 План на наступну сесію

### 1️⃣ КРИТИЧНО: UI для створення проєкту

**Проблема:** Кнопка "Новий всесвіт" зараз не працює (відкриває `openNarrative()` замість форми створення).

**Що треба:**
- Створити modal форму для нового проєкту (як `proj-edit`, але для create)
- Поля: title, desc, genres (multi-select chips), scope (short/novella/novel/series), ending (open/closed)
- Кнопка "Створити" → викликає `__firebaseProjects.createProject(data)`
- Після створення → перенаправлення на WhiteWrite.html з projectId

**Файл:** `public/White.html` (додати modal + JS handler)

**Код для підключення:**
```javascript
// White.html line ~988 - замінити openNarrative на openNewProject
var nn = views.narr.querySelector("#new-narr");
if (nn) nn.addEventListener("click", openNewProject); // NOT openNarrative

function openNewProject() {
  // Show modal with create form
  document.getElementById("new-project-modal").classList.add("is-on");
}

async function createNewProject() {
  var form = document.getElementById("new-project-form");
  var title = form.querySelector("#np-title").value;
  var desc = form.querySelector("#np-desc").value;
  // ... collect genres, scope, ending

  var projectId = await window.__firebaseProjects.createProject({
    title: title,
    desc: desc,
    genres: selectedGenres,
    scope: scope,
    ending: ending
  });

  // Redirect to book with new project
  window.location.href = 'WhiteWrite.html?project=' + projectId;
}
```

---

### 2️⃣ Scene Intent UI в книзі

**Мета:** Коли користувач закінчив сцену → показати Scene Intent вибір → згенерувати наступну сцену.

**Де:** `public/book.jsx` - компонент `SceneIntentPage` (line 53)

**Що треба:**
- Використати `window.__firebaseAI.sceneIntents` (conflict/character/action/...)
- Кнопки з іконками (⚔️ Конфлікт, 🎭 Розвиток персонажа, etc.)
- При виборі → викликати `window.__firebaseAI.generateScene(projectId, intent)`
- Показати loading state (⏳ AI генерує сцену...)
- Результат → додати як нову сцену в SCENES

---

### 3️⃣ Тестування повного flow

**Сценарій:**
1. Користувач заходить на White.html (авторизований)
2. Клікає "Новий всесвіт" → форма → створює проєкт
3. Перенаправлення на WhiteWrite.html
4. Читає книгу → досягає SceneIntentPage
5. Вибирає intent (напр. "Конфлікт")
6. Gemini генерує сцену (~3-5 сек)
7. Нова сцена з'являється в книзі

**Перевірити:**
- Canon consistency (чи використовує Gemini дані з `project.canon`)
- Error handling (що якщо Gemini API зафейлив?)
- Entity extraction (чи правильно виявляє згадки персонажів/локацій?)

---

### 4️⃣ Step 4: localStorage → account (якщо залишиться час)

**Мета:** Зберігати user preferences в Firestore замість localStorage.

**Що треба перенести:**
- Reading position (`ww_book_sc` → `users/{uid}/preferences/readingPosition`)
- Font settings, theme preferences
- Favorites, bookmarks

**Файл:** `public/White.html`, створити `firebase-user-prefs.js`

---

## 📦 Корисні команди

**Перезапустити Vite dev server:**
```bash
npm run dev
```

**Задеплоїти Cloud Functions:**
```bash
firebase deploy --only functions
```

**Задеплоїти Firestore rules:**
```bash
firebase deploy --only firestore:rules
```

**Тестування AI генерації (консоль браузера):**
```javascript
// Отримати проєкти
const projects = await __firebaseProjects.getProjects()
const projectId = projects[0].id

// Тест генерації
await __testGenerateScene(projectId)
```

**Створити тестовий проєкт:**
```javascript
await __createTestProject()
```

---

## 🐛 Відомі проблеми

1. **functions/node_modules не в .gitignore** - додати `functions/node_modules/` в `.gitignore`
2. **Node.js version warning** - Node 20 deprecated 2026-10-30, але працює нормально зараз
3. **In-browser Babel transformer** - для production треба прекомпіляція JSX

---

## 💰 Витрати (орієнтовно)

**Gemini 1.5 Flash:**
- Input: $0.075 / 1M tokens
- Output: $0.30 / 1M tokens
- 1 сцена (~500 слів) = ~1000 input + ~700 output tokens
- **Вартість 1 сцени: ~$0.0003** (майже безкоштовно!)
- $300 бонусу = ~1 мільйон сцен 🎉

**Firebase Blaze:**
- Cloud Functions: 2M викликів/місяць безкоштовно
- Firestore: 50k reads/day безкоштовно
- **Очікувана вартість: $0-2/місяць** на старті

---

## 📝 Git commits

```
757da7d - Clean slate: Vite + prototype in public/
a04d742 - Step 1 complete: Firestore CRUD for projects
8ce5392 - Step 2 complete: Firebase Authentication
bafa914 - Step 3 partial: Cloud Functions + Gemini AI integration
```

**Наступний коміт буде:** "Step 3 complete: AI scene generation UI"

---

## ⏭️ Пріоритети наступної сесії

**HIGH (зробити обов'язково):**
1. UI для створення проєкту ("Новий всесвіт" button)
2. Тест повного flow (створити проєкт через UI)

**MEDIUM (якщо залишиться час):**
3. Scene Intent UI в книзі
4. Loading states для AI генерації

**LOW (можна відкласти):**
5. Step 4: localStorage → Firestore preferences
6. Cleanup + optimization (Babel precompilation, bundle size)

---

Успіхів! 🚀
