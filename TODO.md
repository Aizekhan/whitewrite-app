# WhiteWrite — TODO для наступної сесії

## ✅ Завершено: Рефакторинг структури (2026-06-11)

**Проблема:** Файли були змішані — складно зрозуміти де production, legacy, prototypes.

**Рішення:** Створено чітку структуру папок:

```
public/
  ├── index.html                    ← Shell (список проєктів)
  ├── main-app/                     ← React App (/app) — PRODUCTION
  │   ├── app.html                  ← Entry point
  │   └── app.jsx, flow.jsx, book.jsx, pages.jsx, atmosphere.jsx
  ├── canon-editor/                 ← World Tree (/canon) — PRODUCTION
  │   ├── worldtree.html            ← Entry point
  │   └── wt-*.jsx
  ├── director-workspace/           ← Director (/director) — PRODUCTION
  │   ├── workspace.html            ← Entry point
  │   └── ws-*.jsx
  ├── shared/                       ← Firebase + utilities
  │   └── firebase/ (firebase-*.js)
  ├── legacy/                       ← Old files (НЕ production)
  │   ├── whitewrite.html
  │   └── index.old.html
  └── prototype/                    ← Mock data
      └── wt-world.jsx              ← "Попіл Орелії" hardcoded
```

**Документація:**
- `ARCHITECTURE_AUDIT.md` — виявлені проблеми (87KB index.html hybrid)
- `REFACTORING_PLAN.md` — план реорганізації
- `public/README.md` — гайд для розробників (3 додатки, папки, flows, schema)

**Коміт:** `8a6778e` — "Refactor: Clean project structure"
**Deployment:** ✅ https://whitewrite-app.web.app

---

## ✅ Завершено попередні сесії

### Step 3: AI Integration + Firestore Scenes ✅

- ✅ **Gemini 2.5-flash працює** (Free Tier ключ)
- ✅ **Генерація сцен:** Cloud Function `generateScene` (onRequest + CORS)
- ✅ **Збереження у Firestore:** `projects/{id}/scenes/{sceneId}`
- ✅ **Відображення в book.jsx:** `<GeneratedScenePage>`, real-time refresh (5s)
- ✅ **Project opening flow:** Shell → Form (pre-filled) → Book
- ✅ **Blank page для нових проєктів** (замість mock "Попіл Орелії")

### Повний цикл генерації працює:

1. Користувач створює проєкт (форма) → Firestore `projects/{id}`
2. Обирає Scene Intent (conflict/character/action/romance/worldbuilding/surprise/custom)
3. Cloud Function викликає Gemini 2.5-flash з canon + previous scenes
4. AI генерує сцену (title, text, entities)
5. Firestore зберігає → `projects/{id}/scenes/{sceneId}`
6. Book завантажує з Firestore → `<GeneratedScenePage>`
7. Real-time refresh кожні 5 секунд

---

## 📋 Наступні завдання (пріоритетні)

### 🧪 Тестування після рефакторингу

**Перевірити вручну:**

1. **Main App Flow:**
   - Відкрити `/` → клікнути "Створити свою історію" → має redirect на `/app`
   - Заповнити форму → створити проєкт → має redirect на `/app?projectId=xxx`
   - Має показати книгу (Title + Blank page)

2. **Open Existing Project:**
   - Відкрити `/` → клікнути "Відкрити всесвіт" → має redirect на `/app?projectId=xxx`
   - Має показати форму (pre-filled) → клікнути "Почати творити" → книга зі сценами

3. **Canon Editor:**
   - Відкрити `/canon` → має показати World Tree

4. **Director:**
   - Відкрити `/director` → має показати Workspace

5. **Firebase Modules:**
   - Console → no errors
   - Auth працює (sign in/out)
   - Projects/Scenes CRUD працює

### 🎨 Scene Intent UI (покращення)

**Зараз:** Прості кнопки на `<SceneIntentPage>`

**Можливі покращення:**

- Візуальні картки замість кнопок (з іконками)
- Приклади для кожного Intent ("Конфлікт — персонаж стикається з перешкодою...")
- Custom Intent textarea (зараз є, але можна зробити візуальніше)
- Preview попередніх сцен (щоб користувач бачив контекст)

### 🔄 Reconstruction Engine (інтеграція)

**Зараз:** Рушій існує (`wt-impact.jsx`), але не інтегрований з генерацією.

**Завдання:**

1. **Canon Change Detection:**
   - При редагуванні канону (World Tree) → виявити affected scenes
   - Показати список сцен для реконструкції

2. **Reconstruction UI:**
   - Diff UI ("було → стане")
   - Кнопки: Прийняти / Відхилити / Pin (не чіпати)

3. **AI Reconstruction:**
   - Перегенерувати affected scenes з новим каноном
   - Зберегти `reconstruction.affectedBy` metadata

### 📦 Optimize Bundle

**Зараз:** Babel in-browser compilation (НЕ production-ready)

**Можливі покращення:**

1. **Extract CSS:**
   - Винести CSS з index.html → `styles.css` (зменшити index.html з 87KB)

2. **Build Step:**
   - Vite/Webpack замість Babel in-browser
   - Pre-compile JSX → `.js` files
   - Code splitting

3. **Firebase SDK:**
   - Зараз: compat SDK (legacy, великий bundle)
   - Можна: modular SDK (менший bundle)

### 🌟 Canon Promotion (з книги → канон)

**Ідея:** Виділив у тексті → зробити сутністю (персонаж/локація/подія)

**Завдання:**

1. **Text Selection UI:**
   - Виділити текст у book → popup "Зробити персонажем / локацією / подією"

2. **Entity Creation:**
   - Створити сутність у canon
   - Зв'язати з поточною сценою

3. **AI Inference:**
   - Auto-suggest entities з тексту через AI
   - Додати в `canon.inferred` (з confidence %)

---

## 🔧 Tech Debt (низький пріоритет)

- [ ] Favicon.ico (зараз 404)
- [ ] Firestore rules — зараз TEMPORARY open (`allow read, write: if true`)
- [ ] previousScenes контекст (continuity між сценами) — зараз НЕ передається

---

## 📚 Документація (для розробників)

**Обов'язково прочитати перед роботою:**

1. `CLAUDE.md` — інваріанти, філософія, конвенції
2. `public/README.md` — структура проєкту (3 додатки, папки, flows)
3. `FIRESTORE_SCHEMA.md` — схема даних
4. `ARCHITECTURE_AUDIT.md` — виявлені проблеми структури
5. `REFACTORING_PLAN.md` — план реорганізації

**Entry points (URLs):**
- `/` — Shell (список проєктів)
- `/app` — Main App (Form → Book)
- `/canon` — Canon Editor (World Tree)
- `/director` — Director (Storyboards/Shots)

---

## ⚡ Швидкий старт наступної сесії

### Якщо продовжуєш з попередньої сесії:

1. Прочитати `SESSION_REPORT.md` — що було зроблено
2. Прочитати цей TODO.md — що далі
3. Обрати завдання з розділу "Наступні завдання"

### Якщо новий розробник:

1. Прочитати `public/README.md` — структура проєкту
2. Прочитати `CLAUDE.md` — інваріанти, філософія
3. Запустити локально: `firebase serve`
4. Протестувати вручну (MANUAL_TEST_CHECKLIST.md)

---

**Останнє оновлення:** 2026-06-11
**Коміт:** 8a6778e
**Статус:** ✅ Refactoring complete, ready for next features

