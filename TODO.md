# WhiteWrite — TODO для наступної сесії

## ✅ Завершено у цій сесії

1. ✅ Виправлено головну кнопку лендінгу (StartScreen)
2. ✅ WhiteWrite.html → index.html (головна сторінка)
3. ✅ Виправлено 301 редірект у firebase.json
4. ✅ Створено 404.html
5. ✅ Увімкнено Anonymous Authentication у Firebase Console
6. ✅ Переписано Cloud Function з `onCall` → `onRequest` + CORS
7. ✅ Замінено застарілий Gemini SDK на пряме REST API v1
8. ✅ Оновлено назви моделей для 2026 року (gemini-3.5-flash, gemini-2.5-flash)
9. ✅ Додано fallback mechanism для моделей
10. ✅ Оновлено клієнтський код (fetch замість httpsCallable)

---

## ⚠️ БЛОКЕР: Gemini API Quota

**Проблема:** API ключ не має доступу до Free Tier (quota limit: 0)

**Причина:** Ключ створений у проєкті з білінгом (навіть якщо кредити закінчились)

**Рішення для наступної сесії:**

1. **Створити новий Google Cloud проєкт БЕЗ білінгу:**
   - https://console.cloud.google.com/projectcreate
   - Name: `WhiteWrite-Free` (або будь-яка назва)
   - **НЕ додавати billing account!**

2. **Створити API ключ у новому проєкті:**
   - https://aistudio.google.com/apikey
   - Create API key → Select project: `WhiteWrite-Free`
   - Скопіювати новий ключ

3. **Оновити секрет у Firebase:**
   ```bash
   firebase functions:secrets:set GEMINI_API_KEY
   ```
   (вставити новий ключ)

4. **Задеплоїти функцію:**
   ```bash
   firebase deploy --only functions
   ```

5. **Перевірити генерацію:**
   - https://whitewrite.com → створити історію → Scene Intent → генерувати

---

## 📋 Наступні кроки (після вирішення quota)

### Step 3 (продовження): AI Integration

- [ ] **Протестувати генерацію сцени** (після оновлення API ключа)
- [ ] **Додати збереження згенерованих сцен у Firestore:**
  - Додати поле `scenes: []` у проєкт
  - Зберігати результат генерації у `project.scenes`
  - Показувати згенеровані сцени в UI

### Step 4: Інтеграція з прототипом

- [ ] Підключити згенеровані сцени до book.jsx (замість mock-сцен)
- [ ] Зробити "Чистий аркуш" функціональним (генерація нової сцени)
- [ ] Додати можливість регенерації сцени
- [ ] Зберігати позицію читання (localStorage) — ✅ вже є в book.jsx

### Step 5: Фінальне полірування

- [ ] Відновити безпечні Firestore rules (після тестування)
- [ ] Додати favicon.ico (зараз 404)
- [ ] Прекомпіляція JSX для production (зараз Babel in-browser)
- [ ] Оптимізація bundle size

---

## 🔧 Технічні деталі

### Cloud Function: generateScene

**Локація:** `functions/index.js`
**Тип:** `onRequest` (HTTP endpoint з CORS)
**Region:** `us-central1`
**URL:** https://us-central1-whitewrite-app.cloudfunctions.net/generateScene

**Метод:** POST
**Auth:** Bearer token (Firebase Auth)
**Body:**
```json
{
  "projectId": "proj_xxx",
  "sceneIntent": "action" | "character" | "conflict" | ...,
  "customIntent": "string (optional)",
  "previousScenes": []
}
```

**Response:**
```json
{
  "success": true,
  "scene": {
    "title": "Назва сцени",
    "text": "Текст сцени...",
    "entities": [{type: "character", id: "...", name: "..."}],
    "intent": "action",
    "generatedAt": "timestamp"
  }
}
```

**Моделі (fallback):**
1. `gemini-3.5-flash` (найновіша, 2026)
2. `gemini-2.5-flash` (стабільна)
3. `gemini-2.0-flash` (legacy, може бути вимкнена)

**API:** Пряме REST API v1
`https://generativelanguage.googleapis.com/v1/models/{model}:generateContent`

---

## 📝 Файли змінено у цій сесії

- `public/index.html` (renamed from WhiteWrite.html)
- `public/404.html` (new)
- `public/flow.jsx` (button fix, createProject integration)
- `public/app.jsx` (projectId state)
- `public/book.jsx` (projectId prop)
- `public/pages.jsx` (SceneIntentPage real AI call)
- `public/firebase-init.js` (functions region)
- `public/firebase-auth.js` (anonymous auto-signin)
- `public/firebase-ai.js` (fetch замість httpsCallable)
- `functions/index.js` (onRequest + REST API + fallback)
- `firebase.json` (redirect WhiteWrite.html → /)
- `firestore.rules` (TEMPORARY open: `allow read, write: if true`)

---

## ⚡ Швидкий старт наступної сесії

1. Створити новий проєкт без білінгу
2. Створити API ключ у новому проєкті
3. `firebase functions:secrets:set GEMINI_API_KEY` (новий ключ)
4. `firebase deploy --only functions`
5. Тестувати на https://whitewrite.com
6. Якщо працює → додати збереження сцен у Firestore

---

**Статус:** Технічно все готово, чекаємо на валідний API ключ з Free Tier.
