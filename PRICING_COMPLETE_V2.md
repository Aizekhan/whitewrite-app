# WhiteWrite — Повна модель ціноутворення v2
## (з урахуванням Director, LoRA, Image Gen та всіх пропущених фіч)

---

## 🎯 ТРИ СТОВПИ ПРОДУКТУ

### 📖 BOOK (Narrative)
- Scene generation (Gemini/Claude)
- Scene Intent навігація (Guided Mode)
- Auto Mode (генерація розділів)
- Continuity checking
- Експорт DOCX/PDF/EPUB

### 🌳 UNIVERSE (Canon)
- 6 типів сутностей
- **Universe Reconstruction** 🔥 (моat!)
- Hidden Canon (twists)
- Canon branching

### 🎬 DIRECTOR (Preproduction) — **ПРОПУЩЕНО В V1!**
- **Storyboard breakdown** (AI розбивка сцен на кадри)
- **Shot generation** (3-5 image variants per shot)
- **LoRA training** (custom models для персонажів)
- Visual Canon management
- Dialogue-in-frame timing
- Video export (майбутнє)

**Критично:** Director = найдорожчий AI, але найсильніша платна фіча!

---

## 💸 РЕАЛЬНІ ВИТРАТИ AI

### Текст (дешево):
- Gemini 2.5: $0.0005/сцена
- Claude 3.5: $0.025/сцена

### Візуал (ДОРОГО!):
- **Image generation: $0.05/image** (Midjourney/DALL-E)
- **LoRA training: $0.75/model**
- Storyboard text: $0.0003-0.0135/storyboard

### Проблема:
1 повністю візуалізована сцена (7 shots × 4 варіанти) = **28 images × $0.05 = $1.40**

**Без лімітів користувач може витратити $70+/міс на зображення!**

---

## 📊 ДВІ МЕТРИКИ (обов'язково!)

### 1. **Scenes/month** — для тексту
Зрозуміло, дешево, легко контролювати

### 2. **Image Credits/month** — для візуалу
**КРИТИЧНО!** Без цього маржа падає до 20%.

### 3. **LoRA Slots** — one-time per project
Навчання моделі = разовий cost, не щомісяця

---

## 💰 ФІНАЛЬНА МОДЕЛЬ (4 TIERS)

---

## **FREE** — $0/міс

### Мета: Hook на магію WhiteWrite

**📖 BOOK:**
- ✅ 15 сцен/міс (Gemini)
- ✅ Scene Intent guided navigation (7 типів)
- ✅ Canon-aware generation
- ✅ Continuity checking (read-only warnings)
- ❌ Auto Mode
- ❌ Експорт

**🌳 UNIVERSE:**
- ✅ 1 проєкт
- ✅ Всі 6 типів canon entities
- ✅ Canon graph view (read-only)
- ✅ **Universe Reconstruction PREVIEW** 🔥
  - Бачить імпакт-аналіз
  - Показує, що зміниться
  - **НЕ може запустити** реконструкцію
- ❌ Canon editing
- ❌ Hidden Canon

**🎬 DIRECTOR:**
- ✅ Storyboard view (read-only)
- ✅ Shot list preview
- ❌ AI storyboard generation
- ❌ Image generation (0 credits)
- ❌ LoRA training (0 slots)

**Limits:**
- 15 Gemini scenes/міс
- 0 image credits
- 0 LoRA slots
- 1 проєкт

**Витрати:** 15 × $0.0005 = $0.0075/user

---

## **STORYTELLER** — $15/міс

### Мета: Hobby writers, експорт книги як товару

**📖 BOOK:**
- ✅ **150 сцен/міс** (Gemini)
- ✅ 10 Claude credits (спробувати якість)
- ✅ Auto Mode (до 30 сцен за раз)
- ✅ **Експорт DOCX/PDF**
- ✅ Version history (30 днів, 10 snapshots)
- ✅ Inline entity promotion

**🌳 UNIVERSE:**
- ✅ **5 проєктів**
- ✅ Canon editing через UI
- ✅ **Базова Universe Reconstruction:**
  - ✅ Rename changes (легкі)
  - ✅ Property changes (середні)
  - ❌ Relationship/Remove/Rewrite (складні)
  - Ліміт: 50 items per reconstruction
- ❌ Hidden Canon
- ❌ Canon branching

**🎬 DIRECTOR:**
- ✅ **Manual storyboard створення** (UI tools)
- ✅ Shot list editing
- ✅ Dialogue-in-frame timing
- ❌ AI storyboard generation
- ❌ Image generation (0 credits)
- ❌ LoRA training (0 slots)

**Limits:**
- 150 Gemini + 10 Claude scenes/міс
- **0 image credits** (text-only tier)
- 0 LoRA slots
- 5 проєктів
- 30 днів version history

**Витрати:**
- Scenes: (150 × $0.0005) + (10 × $0.025) = $0.075 + $0.25 = **$0.325/user**

**Маржа:** $15 - $0.325 = **$14.675 (98% маржа)**

**Обґрунтування 0 image credits:**
- Це tier для письменників, не візуалістів
- Manual storyboard = планування, не production
- Знижує витрати, максимізує маржу
- Візуал = upgrade мотивація на $39

---

## **NOVELIST** — $39/міс ⭐

### Мета: Core monetization, serious authors + візуалісти

**📖 BOOK:**
- ✅ **500 Gemini сцен** АБО **100 Claude сцен** (вибір per scene)
- ✅ Auto Mode (до 100 сцен за раз)
- ✅ Експорт DOCX/PDF/EPUB
- ✅ Version history (90 днів, 50 snapshots)
- ✅ Advanced editing (multi-scene ops)
- ✅ Keeper Whisper annotations

**🌳 UNIVERSE:**
- ✅ **20 проєктів**
- ✅ **ПОВНА Universe Reconstruction** 🔥🔥🔥
  - ✅ Всі 6 типів змін
  - ✅ Diff + human-in-the-loop
  - ✅ Необмежено items
  - ✅ Impact heatmap
  - ✅ Orphan detection
- ✅ **Hidden Canon** (true vs surface versions)
- ✅ **Setup→Payoff edges**
- ✅ Canon branching (what-if versions)
- ✅ Continuity checker (auto-fix пропозиції)

**🎬 DIRECTOR:** 🎬 **ПОВНИЙ ПРЕПРОДАКШН**
- ✅ **AI Storyboard generation** (Gemini)
  - Авто-розбивка сцени на кадри
  - Camera angles, lighting, duration
- ✅ **Image generation: 100 credits/міс**
  - 3-5 варіантів per shot
  - ~14 повністю візуалізованих сцен (7 shots × 2 image avg)
- ✅ **LoRA training: 3 slots per project**
  - Custom models для головних персонажів
  - 20-50 reference images
  - One-time training, reuse unlimited
- ✅ Visual Canon management
- ✅ Shot variant picker
- ✅ Dialogue sync

**Limits:**
- 500 Gemini АБО 100 Claude scenes/міс
- **100 image credits/міс**
- **3 LoRA slots/project** (one-time)
- 20 проєктів
- 90 днів version history

**Витрати (realistic mix):**
- 70% текст-тільки (28 users): 28 × 280 Gemini × $0.0005 = $3.92
- 30% візуал (12 users):
  - Сцени: 12 × 80 Claude × $0.025 = $24
  - Images: 12 × 100 × $0.05 = $60
  - LoRA: 12 × 3 × $0.75 = $27
- **Разом на 40 users: $114.92**
- **Per user avg: $2.87**

**Маржа:** $39 - $2.87 = **$36.13 (93% маржа)**

**Killer features tier:**
- Universe Reconstruction (ПОВНА)
- Hidden Canon + twists
- Director візуалізація
- LoRA персонажів

---

## **WORLDBUILDER** — $99/міс

### Мета: Professionals, studios, serious визуал production

**📖 BOOK:**
- ✅ **500 Claude сцен/міс** (топова якість)
- ✅ **∞ Gemini сцен** (для чернеток)
- ✅ **Priority queue** (0 wait time)
- ✅ Architect Mode (генерація структури книги)
- ✅ Експорт у всі формати + custom templates
- ✅ Version history (180 днів, ∞ snapshots)

**🌳 UNIVERSE:**
- ✅ **∞ проєктів**
- ✅ Всі фічі з Novelist
- ✅ **Agent Mode** (AI сам пропонує reconstruction)
- ✅ Batch operations (масові зміни канону)
- ✅ Advanced graph analytics

**🎬 DIRECTOR:** 🎬🎬 **PREMIUM ВІЗУАЛ**
- ✅ **AI Storyboard generation (Claude)** (вища якість)
- ✅ **Image generation: 500 credits/міс**
  - ~71 повністю візуалізованих сцен
  - Або mix: більше варіантів per shot
- ✅ **LoRA training: 10 slots per project**
  - Весь головний cast
  - Advanced training (50 refs)
  - Auto-retraining при змінах canon
- ✅ **Priority image generation** (faster queue)
- ✅ Video storyboard export (beta)
- ✅ Midjourney prompt optimization

**API ACCESS:**
- ✅ REST API для автоматизації
- ✅ Webhooks
- ✅ CLI tool

**SUPPORT:**
- ✅ Пріоритетна підтримка
- ✅ Ранній доступ до beta
- ✅ 1-on-1 консультації (2/міс)

**Limits:**
- 500 Claude + ∞ Gemini scenes/міс
- **500 image credits/міс**
- **10 LoRA slots/project**
- ∞ проєктів
- 180 днів version history
- Priority everything

**Витрати (10 users, всі active візуал):**
- Сцени: 10 × 300 Claude × $0.025 = $75
- Images: 10 × 500 × $0.05 = $250
- LoRA: 10 × 10 × $0.75 = $75
- **Разом: $400**
- **Per user: $40**

**Маржа:** $99 - $40 = **$59 (60% маржа)**

**Обґрунтування вищої ціни:**
- LoRA training дорогий ($7.50/user)
- Image gen зʼїдає маржу ($25/user)
- Але $59 profit/user = чудово для premium tier
- 60% маржа прийнятна для high-touch product

---

## 📊 SUMMARY TABLE

| Tier | Ціна | Scenes | Images | LoRA | Projects | Reconstruction | Director |
|------|------|--------|--------|------|----------|----------------|----------|
| **Free** | $0 | 15 Gemini | 0 | 0 | 1 | Preview | Read-only |
| **Storyteller** | $15 | 150 Gemini + 10 Claude | 0 | 0 | 5 | Basic | Manual |
| **Novelist** | $39 | 500 Gemini OR 100 Claude | **100** | **3/proj** | 20 | **FULL** 🔥 | AI (Gemini) |
| **Worldbuilder** | $99 | 500 Claude + ∞ Gemini | **500** | **10/proj** | ∞ | Full + Agent | AI (Claude) + Priority |

---

## 🧮 UNIT ECONOMICS (REALISTIC)

### 100 платних користувачів + 500 free

| Tier | Users | MRR | AI Cost | Profit | Маржа |
|------|-------|-----|---------|--------|-------|
| Free | 500 | $0 | $3.75 | -$3.75 | - |
| Storyteller | 50 | $750 | $16.25 | $733.75 | 98% |
| Novelist | 40 | $1,560 | $114.92 | $1,445.08 | 93% |
| Worldbuilder | 10 | $990 | $400 | $590 | 60% |

**РАЗОМ:**
- **MRR: $3,300**
- **AI витрати: $534.92**
- **Firebase/Stripe: $150**
- **Profit: $2,615.08**
- **Маржа: 79%** (не 91%, але **реалістично і чудово!**)

---

## 💎 ДОДАТКОВА МОНЕТИЗАЦІЯ

### 1. Image Credits Top-Up
- $5 = 100 extra images
- $10 = 250 extra images
- $25 = 750 extra images

**Прогноз:**
- 20% users купують extra
- Середній чек $10
- **+$200 MRR**

### 2. LoRA Training Add-On
- $3 per extra LoRA slot

### 3. Друк книги ("Замовити книгу")
**Окреме джерело доходу!**

**Модель:**
- Інтеграція з PrintBook або Lulu
- Користувач натискає "Замовити книгу"
- Авто-експорт → друк → доставка
- **Markup: 30-40% на друк**

**Приклад:**
- Вартість друку 200-сторінкової книги: $8
- Продаж юзеру: $15
- **Прибуток: $7 per book**

**Прогноз:**
- 10% платних users замовляють книгу/рік
- 10 users × $7 = $70 one-time
- Recurring: 1 book/3 міс = **+$23/міс**

**Критично:** Це НЕ підписка, це product revenue!

---

## 🎨 FEATURE GATES (імплементація)

### Storyteller → Novelist upgrade triggers:
1. **Hit image limit:** "У вас 0 image credits. Upgrade на Novelist для 100 credits/міс"
2. **Try complex reconstruction:** "Relationship changes доступні на Novelist+"
3. **LoRA training:** "Навчання моделей персонажів — Novelist+"

### Novelist → Worldbuilder upgrade triggers:
1. **Hit 100 images:** "Використано 100/100 credits. +$10 за 250 extra або upgrade на Worldbuilder (500/міс)"
2. **Slow queue:** "6 users в черзі. Worldbuilder = priority (0 wait)"
3. **API access:** "Автоматизація через API — Worldbuilder only"

---

## ✅ ВИПРАВЛЕНІ ПОМИЛКИ З V1

### ❌ Що було пропущено в PRICING_FINAL.md:

1. ✅ **Director/Storyboard** — тепер повністю розписано по tiers
2. ✅ **Image generation** — окрема метрика, реальні витрати
3. ✅ **LoRA training** — slots per project, витрати враховано
4. ✅ **Auto Mode** — ліміт по tiers (не все одразу)
5. ✅ **Continuity** — згадано як feature
6. ✅ **Scene Intent** — додано як value prop
7. ✅ **Друк книги** — окреме джерело доходу
8. ✅ **Маржа перерахована** — 79% замість нереалістичних 91%

### ✅ Додано дві метрики:
- **Scenes/month** (текст)
- **Image Credits/month** (візуал) — КРИТИЧНО!

---

## 🚀 ПЛАН ВПРОВАДЖЕННЯ

### Phase 1: Text-Only MVP (зараз)
**Запустити:**
- Free + Storyteller ($15)
- Тільки текст (Gemini генерація)
- Базова reconstruction
- Експорт DOCX/PDF

**Мета:** Validate text monetization, 10% conversion

**Timeline:** 1-2 місяці

---

### Phase 2: Full Reconstruction (3 міс)
**Додати:**
- Novelist ($39)
- ПОВНА Universe Reconstruction 🔥
- Hidden Canon
- Claude credits (100/міс)

**Мета:** Hook serious authors на reconstruction moat

**Timeline:** 3-4 місяці

---

### Phase 3: Director Visual (6 міс)
**Додати:**
- Image generation (100-500 credits)
- LoRA training (3-10 slots)
- AI Storyboard (Gemini/Claude)

**Мета:** Enable визуальний workflow

**Timeline:** 6-9 місяців

---

### Phase 4: Premium Tier (9 міс)
**Додати:**
- Worldbuilder ($99)
- API access
- Agent Mode
- Priority queue

**Мета:** Premium monetization + B2B potential

**Timeline:** 9-12 місяців

---

## 🎯 ФІНАЛЬНА РЕКОМЕНДАЦІЯ

### Обрати модель: **4-Tier Quality Ladder**

**Ціни:**
- Free: $0 (hook на reconstruction preview)
- Storyteller: $15 (хоббі, text-only, експорт)
- **Novelist: $39** ⭐ (core: FULL reconstruction + візуал)
- Worldbuilder: $99 (premium: Claude + heavy візуал + API)

**Метрики:**
- **Scenes/month** (текст)
- **Image Credits/month** (візуал) ← КРИТИЧНО!
- **LoRA Slots/project** (one-time)

**Диференціація:**
1. Universe Reconstruction (Preview → Basic → FULL)
2. Візуал (None → Manual → AI Basic → AI Premium)
3. AI якість (Gemini → Gemini+Claude → Claude)
4. Підтримка (Community → Email → Priority)

**Killer feature:** Universe Reconstruction на $39

**Реалістична маржа:** 79% (не 91%, але чудово!)

**Фокус на Phase 1-2:** Спочатку текст + reconstruction, візуал потім.

---

## 📝 НАСТУПНІ КРОКИ (технічні)

1. ✅ Stripe Extension setup (INSTALL_EXTENSION.md)
2. Додати в Firestore schema:
   - `scenesGenerated` (monthly counter)
   - `imageCredits` (monthly counter)
   - `loraSlots` (per-project array)
3. Cloud Functions:
   - `generateScene` — перевірка scenes quota
   - `generateImage` — перевірка image credits
   - `trainLoRA` — перевірка slots
   - Monthly reset job (scenes + images)
4. UI:
   - Показати "50/150 scenes" + "20/100 images"
   - Upgrade prompts при лімітах
   - LoRA training UI

**Готовий до впровадження?** Це ПОВНА реалістична модель! 🚀
