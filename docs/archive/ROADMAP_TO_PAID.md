# WhiteWrite — Roadmap до платних планів

**Принцип:** Кожен тір бере гроші лише за фічі, що **реально працюють**. Спочатку механізм планів, потім цінність, оплата — остання.

---

## 🚧 ФАЗА 0: Блокери (P0)

**Мета:** Базова якість — без цього нічого не рахується.

### 0a. ✅ Одна робоча папка
- **Проблема:** Firebase деплоїть `app/`, але є legacy `public/` — плутанина.
- **Рішення:** Прибрати `public/` або перенести все в `app/`.
- **Готово коли:** `firebase.json` вказує на одну папку, legacy видалено.

### 0b. ✅ Пагінація книги
- **Проблема:** Текст переповнює сторінки, непередбачувана кількість символів на сторінку.
- **Рішення:** Height-based пагінація (DOM measurement) + масштаб шрифту.
- **Готово коли:**
  - Сторінки заповнені рівномірно (як Microsoft Word)
  - Текст не виходить за межі `.page` внизу
  - Масштаб шрифту працює (S/M/L/XL)
  - Пагінація адаптується до зміни шрифту

**Статус:** ✅ READY (character-based 1400/1800, працює)
**TODO:** Height-based для адаптації до масштабу шрифту

---

## 📊 ФАЗА 1: Механізм планів

**Мета:** Інфраструктура для всіх тірів — лічильник, gating, провайдер за планом.

**Фінальні плани (з PRICING_ANALYSIS.md):**
- **Free** ($0): 10 сцен Gemini, 1 проєкт
- **Storyteller** ($12): 120 сцен Gemini, 5 проєктів, експорт
- **Novelist** ($29): 400 Gemini АБО 80 Claude, ∞ проєктів, Universe Reconstruction
- **Worldbuilder** ($69): 300 Claude, ∞ проєктів, API, пріоритет

### 1.1 ✅ Token Budget System (universal metering)
- **Firestore schema:**
  ```javascript
  users/{uid}
    - plan: "free" | "storyteller" | "novelist" | "worldbuilder"
    - tokensUsed: number       // consumed this month
    - usage: {                 // breakdown for analytics
        sceneGemini: { count: 10, tokens: 200 },
        sceneClaude: { count: 2, tokens: 600 },
        imageGenerate: { count: 5, tokens: 17500 }
      }
    - resetDate: timestamp     // start of billing cycle
  ```
- **Token Costs:** (`app/firebase/token-budget.js`)
  - Gemini scene: 20 tokens (~$0.0003)
  - Claude scene: 300 tokens (~$0.0135)
  - Image: 3500 tokens (~$0.05)
  - Canon suggestion: 10 tokens, storyboard: 5, etc.
- **Plan Budgets:**
  - Free: 200/міс (10 Gemini)
  - Storyteller: 2,400/міс (120 Gemini)
  - Novelist: 32,000/міс (гнучко: 400 Gemini АБО 80 Claude + images)
  - Worldbuilder: 180,000/міс (300 Claude + 500 images)
- **Логіка:** `consumeTokens(operation, cost)` після кожної генерації.
- **UI:** `"5.4K / 32K токенів"` замість `"10/120 сцен"`
- **✅ ГОТОВО:** Деплоїться, лишається міграція user data

### 1.2 Gating по ліміту
- **UI:** Коли `scenesGenerated >= scenesLimit`:
  - Scene Intent Page показує: "Ви використали 120/120 сцен цього місяця"
  - Кнопка "Генерувати" → "Підвищити план" (поки без оплати, просто alert)
- **М'який стоп:** Не блокує читання/редагування, лише генерацію.
- **Готово коли:**
  - Free (10 сцен) → стоп після 10
  - Storyteller (120) → стоп після 120
  - Novelist (400 Gemini або 80 Claude) → подвійний лічильник
  - Worldbuilder (300 Claude) → стоп після 300

### 1.3 Claude-провайдер за планом
- **Логіка:**
  - Free / Storyteller → Gemini (завжди)
  - Novelist → Gemini за замовчуванням, але є **Claude credits** (80/міс)
  - Worldbuilder → Claude за замовчуванням (300 сцен)
- **UI:** Scene Intent Page — вибір провайдера (якщо план дозволяє)
- **Лічильники:**
  - Novelist: `geminiScenes` (max 400) + `claudeScenes` (max 80)
  - Worldbuilder: `claudeScenes` (max 300)
- **Готово коли:**
  - `generateScene()` приймає `provider: "gemini" | "claude"`
  - Cloud Function маршрутизує на правильний API
  - Витрата credits відслідковується окремо

**Готово коли (вся фаза 1):**
- Лічильник працює в Firestore
- Gating блокує генерацію на ліміті
- Claude доступний на Novelist/Worldbuilder
- План перемикається вручно в Firestore (поле `plan`)

---

## 🌳 ФАЗА 2: Universe (Canon) — ядро Novelist ($39)

**Мета:** Редагування канону — головна цінність продукту.

### 2.1 Canon у Firestore
- **Schema:**
  ```javascript
  projects/{projectId}
    - canon: {
        characters: { [id]: { name, type, slug, traits, ... } },
        locations: { [id]: { name, type, slug, description, ... } },
        events: { [id]: { name, type, slug, when, impact, ... } },
        factions: { ... },
        artifacts: { ... },
        world: { ... }
      }
  ```
- **Збереження:** Кнопка "Зберегти" у WorldTree → `updateProject(projectId, { canon })`

### 2.2 Universe редагування (стовп Всесвіт)
- **UI:** WorldTree.html — форми для створення/редагування сутностей
- **Функції:**
  - Створити персонажа/локацію/подію
  - Редагувати властивості (name, traits, relationships)
  - Видалити сутність
- **Готово коли:**
  - Можна створити персонажа з формою (ім'я, type, traits)
  - Зміни зберігаються в Firestore
  - UI показує актуальний стан канону

### 2.3 Canon-aware генерація (читання)
- **Логіка:** При генерації сцени — передати `project.canon` у промпт
- **Промпт:** "Characters: [Alice: brave warrior], Locations: [Orelia: ruined city], ..."
- **Готово коли:**
  - AI згадує персонажів/локації з канону
  - Нові згадки (capitalized entities) не додаються в канон автоматично

**Готово коли (вся фаза 2):**
- Canon редагується у WorldTree
- Зміни зберігаються в Firestore
- Генерація сцен враховує канон
- Доступно на Novelist ($39) і вище

---

## 🔄 ФАЗА 3: Universe Reconstruction — moat

**Мета:** Зміна канону → автоматична реконструкція сцен. **Це killer feature.**

### 3.1 Impact Analysis
- **Логіка:** `wImpact(type, id)` — знайти всі сцени, що згадують сутність
- **UI:** При зміні персонажа → показати "Вплине на 7 сцен"

### 3.2 Reconstruction Plan
- **Логіка:** `wReconstructionPlan(type, id, changeType)` → список сцен до оновлення
- **Change types:** rename / property / relationship / add / remove / rewrite

### 3.3 Diff + Human-in-the-loop (⭐ топ-вибір)
- **UI:**
  - Overlay з diff: "Було → Стане"
  - Кожен елемент: ✓ Прийняти / ✗ Відхилити
  - Кнопка "▶ Регенерувати" (uses AI)
- **Логіка:** AI перегенеровує сцену з новим каноном, показує diff
- **Готово коли:**
  - Зміна канону → показує overlay з планом
  - Можна прийняти/відхилити кожну зміну
  - ▶ викликає AI для реальної регенерації

### 3.4 Continuity Checker
- **Логіка:** Виявлення суперечностей (мертвий персонаж говорить)
- **UI:** Попередження у Scene Editor: "⚠ Маркус загинув у сцені 3"
- **Готово коли:**
  - Автоматичне виявлення суперечностей
  - Попередження у редакторі

**Готово коли (вся фаза 3):**
- Impact analysis працює
- Diff + human-in-the-loop UI реалізовано
- ▶ регенерує сцени через AI
- Continuity checker виявляє суперечності
- Доступно на Novelist ($39) і вище

---

## 📄 ФАЗА 4: Експорт — розблокування Storyteller ($15)

**Мета:** Книга = продукт. Експорт у DOCX/PDF.

### 4.1 DOCX Export
- **Бібліотека:** `docx` (npm) або `html-docx-js`
- **Функціонал:**
  - Експорт усіх сцен проєкту
  - Правильне форматування (Cinzel заголовки, Spectral текст)
  - Титульна сторінка, розділи
- **UI:** Кнопка "Експорт DOCX" у меню книги

### 4.2 PDF Export
- **Бібліотека:** `jsPDF` або server-side (Puppeteer у Cloud Function)
- **Функціонал:** Експорт з типографікою книги (шрифти, розвороти)
- **UI:** Кнопка "Експорт PDF"

**Готово коли (вся фаза 4):**
- DOCX експорт працює
- PDF експорт працює
- Доступно на Storyteller ($15) і вище

---

## 🎨 ФАЗА 5: Image Credits — візуал на Novelist ($39)

**Мета:** Обмежена генерація зображень (100 credits/міс на Novelist).

### 5.1 Image Credits лічильник
- **Firestore:**
  ```javascript
  users/{uid}
    - imageCredits: number     // current month
    - imageCreditsLimit: number // based on plan
  ```
- **Логіка:** Free/Storyteller → 0, Novelist → 100, Worldbuilder → 500

### 5.2 Image Generation API
- **Provider:** Midjourney API / DALL-E 3 / Stable Diffusion
- **Cost:** ~$0.05 per image
- **UI:** Director → кнопка "Generate Image" (якщо є credits)

### 5.3 Gating
- **UI:** "Використано 100/100 image credits" → кнопка неактивна
- **Готово коли:**
  - Лічильник credits працює
  - Генерація витрачає credits
  - Gating блокує після ліміту

**Готово коли (вся фаза 5):**
- Image credits лічильник працює
- Генерація зображень витрачає credits
- Доступно на Novelist (100) і Worldbuilder (500)

---

## 🎬 ФАЗА 6: Director (Storyboard) — розблокування Worldbuilder ($99)

**Мета:** Візуалізація сцен — storyboard, shots, images.

### 6.1 Storyboard Generation (AI Shot Breakdown)
- **Логіка:** Сцена → розбивка на 5-10 кадрів (shots)
- **Output:** `{ shots: [{ angle, lighting, subject, mood, duration }] }`
- **Cost:** Gemini ~$0.0003/storyboard, Claude ~$0.0135

### 6.2 Shot Image Generation
- **Логіка:** 1 shot → 3-5 варіантів зображення (через Image API)
- **Cost:** ~$0.05 per image × 4 = $0.20/shot
- **UI:** Галерея варіантів, вибір найкращого

### 6.3 LoRA Training
- **Логіка:** Навчання персоналізованої моделі для персонажа/локації
- **Provider:** Replicate / RunPod
- **Cost:** ~$0.75 per LoRA
- **Limit:** Novelist → 3 LoRA/проєкт, Worldbuilder → 10

**Готово коли (вся фаза 6):**
- Storyboard generation працює
- Shot image generation з варіантами
- LoRA training доступне
- Image credits витрачаються правильно
- Доступно на Novelist (обмежено) і Worldbuilder (повна)

---

## 📡 ФАЗА 7: API Access — Worldbuilder ($99)

**Мета:** Програмний доступ до генерації для pro-користувачів.

### 7.1 API Endpoints
- `POST /api/generateScene` (з auth token)
- `GET /api/projects/:id/scenes`
- `POST /api/canon/update`

### 7.2 API Keys
- **Firestore:** `users/{uid}/apiKeys`
- **UI:** Генерація ключів у Account

### 7.3 Rate Limiting
- **Логіка:** Worldbuilder → 1000 req/день

**Готово коли (вся фаза 7):**
- API endpoints працюють
- API keys генеруються
- Rate limiting працює
- Доступно на Worldbuilder ($99)

---

## 💳 ФАЗА 8: Stripe Integration — ОСТАННЯ

**Мета:** Оплата лише **вмикає** те, що вже працює.

### 8.1 Stripe Products
- **Products:**
  - Free (default)
  - Storyteller ($15/міс)
  - Novelist ($39/міс)
  - Worldbuilder ($99/міс)

### 8.2 Checkout Flow
- **UI:** Account → "Підвищити план" → Stripe Checkout
- **Webhook:** `stripe.checkout.session.completed` → оновити `users/{uid}.plan`

### 8.3 Subscription Management
- **UI:** Account → "Керувати підпискою" (Stripe Customer Portal)
- **Webhook:** `customer.subscription.updated` / `deleted`

**Готово коли (вся фаза 8):**
- Stripe Checkout працює
- Webhooks оновлюють план у Firestore
- Customer Portal для керування підпискою
- Усі фічі тірів реально працюють (фази 1-7)

---

## 🎯 Пріоритети по фазах

```
ФАЗА 0 (блокери) → ФАЗА 1 (механізм) → ФАЗА 3 (Claude) →
ФАЗА 2 (Universe) → ФАЗА 3 (Reconstruction) → ФАЗА 4 (експорт) →
ФАЗА 5+6 (візуал) → ФАЗА 7 (API) → ФАЗА 8 (Stripe)
```

**Логіка порядку:**
1. Блокери (якість)
2. Механізм (інфраструктура тірів)
3. Claude (тестування якості для $99)
4. Ядро цінності ($39: Universe + Reconstruction)
5. Базова цінність ($15: експорт)
6. Преміум ($99: візуал + API)
7. Оплата (остання — бо платити нема за що, поки фічі не живі)

---

## 📋 Чеклист готовності до запуску

Перед увімкненням Stripe:

- [ ] Фаза 0: Пагінація + масштаб працюють
- [ ] Фаза 1: Лічильник сцен + gating + Claude-провайдер
- [ ] Фаза 2: Universe редагування працює
- [ ] Фаза 3: Reconstruction diff + ▶ регенерація
- [ ] Фаза 4: DOCX/PDF експорт
- [ ] Фаза 5: Image credits лічильник
- [ ] Фаза 6: Storyboard + shots (базово)
- [ ] Unit economics підтверджено (84% маржа з AI_COSTS_COMPLETE.md)
- [ ] Legal: Terms of Service, Privacy Policy
- [ ] Support: email / Discord

**Тільки тоді Stripe.**

---

## 🚀 Наступний крок

**Фаза 1.1:** Лічильник сцен на користувача (Firestore schema + increment logic).

Даю Claude Code: "Імплементуй Фазу 1.1 — лічильник сцен."
