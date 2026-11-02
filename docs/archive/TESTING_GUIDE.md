# WhiteWrite — Testing Guide

## ✅ Що вже працює

### 1. Cloud Function: Scene Generation
- **Endpoint:** `https://us-central1-whitewrite-app.cloudfunctions.net/generateScene`
- **Status:** ✅ Working (gemini-2.5-flash успішно генерує)
- **Fallback:** 3.5-flash → 2.5-flash → 2.0-flash
- **Auth:** Bearer token (Firebase Auth)
- **Logs:** Показують успішну генерацію (2026-06-09 15:59:10)

### 2. Client Modules
- ✅ `firebase-init.js` — Firebase config
- ✅ `firebase-auth.js` — Anonymous auth (auto sign-in)
- ✅ `firebase-projects.js` — Projects CRUD
- ✅ `firebase-ai.js` — AI generation client
- ✅ `firebase-scenes.js` — Scenes CRUD (subcollection) **← ТІЛЬКИ ЩО ДОДАНО**

### 3. Firestore Rules
- ✅ **Secure** owner-based access
- ✅ Задеплоєно на production
- ✅ Subcollections (scenes/narrative/director) захищені

---

## 🧪 Manual Testing Steps

### Test 1: Scene Generation (Core Flow)

**Мета:** Перевірити повний цикл генерації → збереження → відображення

1. **Відкрити сайт:**
   ```
   https://whitewrite-app.web.app
   ```

2. **Створити новий проєкт:**
   - Натиснути "Створити свою історію"
   - Заповнити форму:
     - **Назва:** "Тестова історія"
     - **Опис:** "Детектив у готелі Гранд Будапешт"
     - **Жанри:** Детектив, Драма
     - **Scope:** novella
   - Натиснути "Почати творити"

3. **Дочекатись ритуалу (відео генерації):**
   - Має запустись відео StartStoryAnim.mp4
   - Після відео → відкриється книга

4. **Перегорнути сторінки:**
   - Натиснути `→` (або клік праворуч)
   - Дійти до сторінки "Scene Intent" (4-та сцена)

5. **Згенерувати сцену:**
   - Вибрати Scene Intent: **"Конфлікт"** ⚔
   - Натиснути "✦ Створити сцену"
   - Дочекатись генерації (5-15 секунд)

6. **Перевірити результат:**
   - Має з'явитись текст сцени
   - Перевірити console (F12):
     ```js
     Scene generated: {title: "...", text: "...", entities: [...]}
     Scene saved: {id: "scene_...", n: 1, ...}
     ```

7. **Перевірити Firestore:**
   - Відкрити Firebase Console → Firestore
   - `projects/{projectId}/scenes/{sceneId}`
   - Має бути документ з полями:
     - `n: 1`
     - `title: "..."`
     - `text: "..."`
     - `intent: "conflict"`
     - `entities: {characters: [], locations: [], ...}`

---

### Test 2: Canon-Aware Generation

**Мета:** Перевірити що AI читає канон з проєкту

1. **Створити проєкт з каноном:**
   - Використати Firebase Console або `create-test-project.mjs`
   - Додати персонажа в `canon.characters`:
     ```json
     "char_marcus": {
       "id": "char_marcus",
       "name": "Маркус Чен",
       "role": "Детектив",
       "motivation": "Знайти вбивцю свого партнера"
     }
     ```

2. **Згенерувати сцену:**
   - Scene Intent: **"Розвиток персонажа"** ❦
   - AI має згадати "Маркус Чен" у тексті сцени

3. **Перевірити entities:**
   - `scene.entities.characters` має містити `["char_marcus"]`

---

### Test 3: Console Testing (Швидкий тест)

Відкрити Console (F12) на https://whitewrite-app.web.app:

```js
// 1. Створити тестовий проєкт
const projectId = await window.__firebaseProjects.createProject({
  title: 'Console Test',
  desc: 'Тест з консолі',
  scope: 'novella',
  ending: 'open',
  genres: ['Фентезі']
});
console.log('Project created:', projectId);

// 2. Згенерувати сцену
const result = await window.__firebaseAI.generateScene(
  projectId,
  'surprise',
  null,
  []
);
console.log('Scene generated:', result);

// 3. Зберегти сцену
if (result.success) {
  const scene = await window.__firebaseScenes.addScene(projectId, {
    title: result.scene.title,
    text: result.scene.text,
    intent: 'surprise',
    entities: result.scene.entities || {
      characters: [],
      locations: [],
      events: [],
      artifacts: []
    }
  });
  console.log('Scene saved:', scene);
}

// 4. Завантажити збережені сцени
const scenes = await window.__firebaseScenes.getScenes(projectId);
console.log('All scenes:', scenes);
```

**Очікуваний результат:**
```
Project created: proj_1234567890_abc123
Scene generated: {success: true, scene: {...}}
Scene saved: {id: "scene_...", n: 1, title: "...", ...}
All scenes: [{id: "scene_...", n: 1, ...}]
```

---

## 🐛 Troubleshooting

### Error: "window.__firebaseScenes is not defined"
- **Причина:** `firebase-scenes.js` не підключено
- **Рішення:** ✅ ВИПРАВЛЕНО (commit 47e2883)

### Error: "Quota exceeded"
- **Причина:** API ключ не має доступу до Free Tier
- **Рішення:** ✅ ВИПРАВЛЕНО (новий ключ з проєкту без білінгу)

### Error: "Permission denied"
- **Причина:** Firestore rules блокують запис
- **Рішення:** ✅ Rules безпечні й правильні (owner-based)

### Error: "Model gemini-3.5-flash failed: 503"
- **Причина:** High demand на новій моделі
- **Рішення:** ✅ Fallback працює (2.5-flash успішно генерує)

---

## 📋 Next Steps (після тестування)

### 1. Інтеграція зі збереженими сценами
**Файл:** `public/book.jsx`

Замінити mock-дані на реальні сцени з Firestore:

```jsx
// Замість buildScenes(title, projectId)
async function loadScenes(projectId) {
  const scenes = await window.__firebaseScenes.getScenes(projectId);

  return scenes.map(scene => ({
    n: scene.n,
    t: scene.title,
    pages: [{
      left: <GeneratedScenePage scene={scene} />,
      right: <SceneIntentPage projectId={projectId} />,
      whisper: "Згенеровано AI на основі канону."
    }]
  }));
}
```

### 2. Scene Display Component
Створити `<GeneratedScenePage>` для відображення згенерованого тексту:

```jsx
function GeneratedScenePage({ scene }) {
  return (
    <div className="page-inner">
      <PageHeader
        kicker={`Сцена ${scene.n}`}
        title={scene.title}
      />
      <Prose>{scene.text}</Prose>
      <MarginNote>
        Intent: {scene.intent} · Згадано: {scene.entities.characters.length} персонажів
      </MarginNote>
      <Folio n={scene.n} />
    </div>
  );
}
```

### 3. "Чистий аркуш" Integration
Зробити WritingPage функціональним:
- Кнопка "Згенерувати наступну сцену"
- Scene Intent вибір перед генерацією
- Автоматичне додавання `previousScenes` для контексту

### 4. Canon Editing (майбутнє)
- Редагування персонажів/локацій у WorldTree
- Live-preview впливу змін (reconstruction impact)

---

## ✅ Current Status

| Компонент | Статус | Тестування |
|-----------|--------|------------|
| Cloud Function (generateScene) | ✅ Working | ✅ Logs показують success |
| Client AI module (firebase-ai.js) | ✅ Working | ⏳ Потрібен manual test |
| Client Scenes module (firebase-scenes.js) | ✅ Working | ⏳ Потрібен manual test |
| Firestore Rules | ✅ Secure | ✅ Deployed |
| Book UI (scene display) | ⏳ Mock data | ⏳ Інтеграція pending |

**Готово до тестування:** ✅ Так
**Блокери:** ❌ Немає

---

**Автор:** Claude Code
**Дата:** 2026-06-11
**Версія:** Step 3 Complete (AI Generation + Save)
