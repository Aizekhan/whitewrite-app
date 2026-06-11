# WhiteWrite — Manual Testing Checklist

## 🎯 Мета тестування
Перевірити повний цикл: **Генерація → Збереження → Відображення**

---

## ✅ Pre-flight Checklist

### 1. Перевірити що сайт доступний
- [ ] Відкрити https://whitewrite-app.web.app
- [ ] Сайт завантажується без помилок
- [ ] Кнопка "Створити свою історію" видима

### 2. Перевірити Console (F12)
- [ ] Відкрити Developer Tools → Console
- [ ] Немає червоних помилок при завантаженні
- [ ] Перевірити наявність Firebase модулів:
```js
console.log('Firebase modules:', {
  auth: !!window.__firebaseAuth,
  projects: !!window.__firebaseProjects,
  ai: !!window.__firebaseAI,
  scenes: !!window.__firebaseScenes  // ← ВАЖЛИВО!
});
// Expected: всі true
```

---

## 🧪 Test 1: Create Project + Generate Scene

### Крок 1: Створити проєкт
1. [ ] Натиснути **"Створити свою історію"**
2. [ ] Заповнити форму:
   - **Назва:** "Детектив у Києві"
   - **Опис всесвіту:** "Молодий детектив Олексій розслідує серію таємничих зникнень у старому районі Києва"
   - **Жанри:** Детектив, Трилер (вибрати 2-3)
   - **Масштаб:** novella
3. [ ] Натиснути **"Почати творити"**
4. [ ] Дочекатись відео ритуалу (5-10 секунд)
5. [ ] Книга відкривається ✅

**Expected result:** Відкривається книга з Title page

### Крок 2: Навігація до Scene Intent
1. [ ] Натиснути `→` (стрілка вправо) або клікнути праву сторону книги
2. [ ] Перегорнути 2-3 сторінки
3. [ ] Дійти до сторінки **"Що далі?"** (Scene Intent)

**Expected result:** Сторінка з вибором Intent (Конфлікт, Розвиток персонажа, etc.)

### Крок 3: Згенерувати сцену
1. [ ] Вибрати Intent: **Конфлікт** ⚔
2. [ ] Натиснути **"✦ Створити сцену"**
3. [ ] Дочекатись відповіді (5-20 секунд)
4. [ ] Перевірити Console:
```js
// Expected logs:
Generating scene... {projectId: "proj_...", sceneIntent: "conflict"}
Scene generated: {title: "...", text: "...", entities: [...]}
Scene saved to Firestore: {id: "scene_...", n: 1, ...}
Loaded scenes from Firestore: [{...}]
Scenes rebuilt: 3 scenes  // ← Title + Generated + Intent
```

**Expected result:**
- ✅ "Scene generated:" в console
- ✅ "Scene saved to Firestore:" в console
- ✅ Текст сцени з'являється на сторінці

### Крок 4: Перевірити відображення
1. [ ] Після генерації сцена має з'явитись на екрані
2. [ ] Якщо не з'явилась — дочекатись 5 секунд (auto-refresh)
3. [ ] Натиснути `←` (стрілка вліво) щоб перегорнути назад
4. [ ] Має бути видима згенерована сцена з:
   - ✅ Заголовком (наприклад "Сцена 1")
   - ✅ Назвою сцени
   - ✅ Текстом сцени (300-500 слів)
   - ✅ Drop-cap на першому символі
   - ✅ Margin note з metadata (Intent: conflict, ...)

**Expected result:** Згенерована сцена відображається правильно

---

## 🧪 Test 2: Verify Firestore (Firebase Console)

### Крок 1: Відкрити Firebase Console
1. [ ] Відкрити https://console.firebase.google.com/project/whitewrite-app/firestore
2. [ ] Увійти (якщо потрібно)
3. [ ] Вибрати **Firestore Database**

### Крок 2: Знайти проєкт
1. [ ] Відкрити колекцію **`projects`**
2. [ ] Знайти свій проєкт (за назвою "Детектив у Києві")
3. [ ] Відкрити документ проєкту

**Expected fields:**
```
owner: "D72FcL..." (ваш UID)
title: "Детектив у Києві"
desc: "Молодий детектив Олексій..."
scope: "novella"
genres: ["Детектив", "Трилер"]
written: 1  ← ВАЖЛИВО!
canonAware: true
canon: {
  characters: {}
  locations: {}
  ...
}
```

### Крок 3: Перевірити сцени (subcollection)
1. [ ] У документі проєкту знайти **`scenes`** (subcollection)
2. [ ] Відкрити subcollection
3. [ ] Має бути 1 документ (scene_...)

**Expected fields в сцені:**
```
id: "scene_1781..."
n: 1  ← порядковий номер
title: "Зникнення на Подолі" (або щось схоже)
text: "Олексій стояв перед старим будинком..." (300-500 слів)
intent: "conflict"
customIntent: null
status: "draft"
generatedAt: timestamp
updatedAt: timestamp
entities: {
  characters: []  (може бути порожньо, якщо AI не витягнув)
  locations: []
  events: []
  artifacts: []
}
reconstruction: {
  mode: "review"
  affectedBy: []
  lastReconstructionAt: null
}
```

**Expected result:** ✅ Сцена збережена в Firestore з правильною структурою

---

## 🧪 Test 3: Generate Second Scene (Continuity)

### Крок 1: Перегорнути до Scene Intent
1. [ ] У книзі натиснути `→` до останньої сторінки (Scene Intent)
2. [ ] Має бути надпис **"Що далі?"**

### Крок 2: Згенерувати другу сцену
1. [ ] Вибрати Intent: **Розвиток персонажа** ❦
2. [ ] Натиснути **"✦ Створити сцену"**
3. [ ] Дочекатись генерації (5-20 секунд)
4. [ ] Перевірити Console:
```js
// Expected:
Scene generated: {title: "...", text: "...", entities: [...]}
Scene saved: {n: 2, ...}  ← ВАЖЛИВО: n=2!
Loaded scenes from Firestore: [{n:1, ...}, {n:2, ...}]
Scenes rebuilt: 4 scenes  // Title + Scene1 + Scene2 + Intent
```

### Крок 3: Перевірити continuity
1. [ ] Натиснути `←` щоб перегорнути до другої сцени
2. [ ] Прочитати текст другої сцени
3. [ ] Перевірити чи продовжує першу сцену (логічно)

**Expected result:**
- ✅ Друга сцена згенерована
- ✅ n=2 (порядковий номер коректний)
- ✅ Текст логічно продовжує першу сцену (continuity)

### Крок 4: Перевірити Firestore
1. [ ] Відкрити Firebase Console → projects/{id}/scenes
2. [ ] Має бути **2 документи** (scene_1, scene_2)
3. [ ] Перевірити поле `written` в проєкті: **має бути 2**

**Expected result:** ✅ Обидві сцени в Firestore, `written=2`

---

## 🧪 Test 4: Real-time Refresh

### Крок 1: Відкрити книгу в 2 вкладках
1. [ ] Відкрити https://whitewrite-app.web.app у **2 вкладках браузера**
2. [ ] У вкладці 1: відкрити проєкт "Детектив у Києві"
3. [ ] У вкладці 2: відкрити той самий проєкт

### Крок 2: Згенерувати сцену у вкладці 1
1. [ ] Вкладка 1: перегорнути до Scene Intent
2. [ ] Вибрати Intent: **Екшн** ✦
3. [ ] Згенерувати сцену
4. [ ] Дочекатись збереження

### Крок 3: Перевірити вкладку 2
1. [ ] **Не перезавантажувати** вкладку 2
2. [ ] Дочекатись 5-10 секунд (auto-refresh)
3. [ ] Перегорнути сторінки у вкладці 2

**Expected result:** ✅ Нова сцена з'явиться у вкладці 2 автоматично (real-time sync)

---

## 🧪 Test 5: Canon-Aware Generation (Advanced)

### Крок 1: Додати персонажа через Console
```js
// Відкрити Console (F12) на сторінці проєкту

// Отримати projectId (з URL або console)
const projectId = "proj_...";  // ваш ID

// Додати персонажа в canon
await window.__firebase.db.collection('projects').doc(projectId).update({
  'canon.characters.char_oleksiy': {
    id: 'char_oleksiy',
    name: 'Олексій Коваленко',
    slug: 'oleksiy-kovalenko',
    role: 'Молодий детектив',
    roleType: 'lead',
    motivation: 'Розкрити серію зникнень',
    status: 'Активний',
    arc: 'Від новачка до досвідченого детектива',
    scenes: [],
    locations: [],
    factions: [],
    artifacts: [],
    events: [],
    relations: []
  }
});

console.log('✅ Character added to canon');
```

### Крок 2: Згенерувати сцену з каноном
1. [ ] Перегорнути до Scene Intent
2. [ ] Вибрати Intent: **Розвиток персонажа** ❦
3. [ ] Згенерувати сцену
4. [ ] Прочитати згенеровану сцену

**Expected result:**
- ✅ AI згадує **"Олексій Коваленко"** в тексті
- ✅ `scene.entities.characters` містить `["char_oleksiy"]`

---

## 📊 Expected Final State

### Firestore Structure
```
projects/
  └── proj_xxx/
       ├── title: "Детектив у Києві"
       ├── written: 3-4  (кількість сцен)
       ├── canon: {
       │    └── characters: {
       │         └── char_oleksiy: {...}
       │    }
       │}
       └── scenes/  (subcollection)
            ├── scene_1: {n:1, title:"...", intent:"conflict", ...}
            ├── scene_2: {n:2, title:"...", intent:"character", ...}
            └── scene_3: {n:3, title:"...", intent:"action", ...}
```

### Book Display
- Title page
- Scene 1 (Conflict)
- Scene 2 (Character)
- Scene 3 (Action)
- Scene Intent page (для генерації Scene 4)

### Console Logs (Expected)
```
Firebase modules: {auth: true, projects: true, ai: true, scenes: true}
Loaded scenes from Firestore: [...]
Scenes rebuilt: 5 scenes
Scene generated: {...}
Scene saved to Firestore: {n: 4, ...}
```

---

## ❌ Known Issues / Troubleshooting

### Issue 1: "window.__firebaseScenes is not defined"
**Причина:** firebase-scenes.js не завантажився
**Рішення:** Hard refresh (Ctrl+Shift+R)

### Issue 2: Сцена не з'являється після генерації
**Причина:** Real-time refresh ще не спрацював
**Рішення:** Дочекатись 5 секунд або hard refresh

### Issue 3: "Permission denied" в Firestore
**Причина:** Firestore rules блокують доступ
**Рішення:** ✅ Це нормально — правила працюють коректно (owner-based)

### Issue 4: Генерація падає з "503 High demand"
**Причина:** gemini-3.5-flash перевантажена
**Рішення:** ✅ Fallback автоматично пробує 2.5-flash (має працювати)

### Issue 5: Генерація падає з "429 Quota exceeded"
**Причина:** API ключ досяг ліміту Free Tier
**Рішення:** Дочекатись reset (щоденний ліміт) або перейти на платний план

---

## ✅ Success Criteria

Тестування вважається успішним якщо:

- [x] Сайт завантажується без помилок
- [x] `window.__firebaseScenes` існує
- [x] Проєкт створюється
- [x] Сцени генеруються (5-20 секунд)
- [x] Сцени зберігаються в Firestore (`projects/{id}/scenes`)
- [x] Сцени відображаються в книзі (<GeneratedScenePage>)
- [x] Real-time refresh працює (5 секунд)
- [x] Continuity працює (сцени логічно продовжують одна одну)
- [x] Canon-aware генерація працює (AI читає персонажів)

**Якщо всі пункти ✅ — цикл працює повністю!**

---

**Автор:** Claude Code
**Дата:** 2026-06-11
**Версія:** Production Testing Guide
