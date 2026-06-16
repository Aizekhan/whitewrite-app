# WhiteWrite — Фінальне ціноутворення з урахуванням всіх фіч

## 🎯 Ключові диференціатори (чому можемо просити premium)

### 1. **Universe Reconstruction** — моat! 🔥
**Ніхто інший не робить:**
- Зміна канону → автоматична реконструкція всієї історії
- 6 типів змін з різними стратегіями
- Транзитивний імпакт-аналіз через граф
- Diff + human-in-the-loop

**Це killer feature**, якої немає у Sudowrite/NovelAI/Jasper.

### 2. **Canon-Aware Generation**
- AI читає граф сутностей перед генерацією
- Консистентність гарантована
- 6 типів canon entities (characters/locations/events/factions/artifacts/world)

### 3. **Три стовпи (Book → Universe → Director)**
- Книга — пишеш
- Всесвіт — керуєш каноном
- Режисер — візуалізуєш (storyboard, LoRA training)

### 4. **Hidden Canon + Twists**
- Прихований канон (trueVersion vs surfacedVersion)
- Setup→Payoff ребра
- AI-driven twist generation

### 5. **Українська мова + типографіка**
- Правильні лапки «текст»
- Довге тире —
- Неразривні пробіли

---

## 💰 Фінальна модель ціноутворення

### Tier-based на основі **Value Ladder**

| Tier | Ціна | Target User | Value Proposition |
|------|------|-------------|-------------------|
| **Free** | $0 | Curious Explorer | Спробувати магію WhiteWrite |
| **Storyteller** | $15/міс | Hobby Writer | Писати регулярно з базовими інструментами |
| **Novelist** | $39/міс | Serious Author | Повний canon control + reconstruction |
| **Worldbuilder** | $99/міс | Professional | Claude AI + priority + API |

---

## 📦 Детальний розподіл фіч

### **FREE Tier** ($0/міс)

**AI Generation:**
- ✅ 15 сцен/міс (Gemini 2.5 Flash)
- ✅ 7 Scene Intents (conflict/character/action/romance/worldbuilding/surprise/custom)
- ✅ Canon-aware генерація
- ❌ Без Claude

**Canon Management:**
- ✅ 1 проєкт
- ✅ Всі 6 типів сутностей (characters/locations/events/factions/artifacts/world)
- ✅ Canon graph view (read-only)
- ❌ Редагування канону через UI (можна через сцени)

**Universe Reconstruction:**
- ✅ **Preview** impact аналізу (бачить, що зміниться)
- ❌ Не може запустити реконструкцію

**Book Interface:**
- ✅ Фотографічна книга (reading view)
- ✅ Магічні закладки (related entities)
- ✅ Scene Intent picker
- ❌ Експорт

**Director:**
- ✅ Storyboard view (read-only)
- ❌ Shot generation
- ❌ LoRA training

**Limits:**
- 15 сцен Gemini/міс (~$0.0075 витрат)
- 1 проєкт
- Без експорту
- Без version history

**Мета:** Hook користувача на унікальність, показати reconstruction preview.

---

### **STORYTELLER Tier** ($15/міс)

**AI Generation:**
- ✅ **150 сцен/міс** (Gemini 2.5 Flash)
- ✅ 10 Claude credits/міс (спробувати якість)
- ✅ Всі Scene Intents

**Canon Management:**
- ✅ **5 проєктів**
- ✅ Canon editing через UI
- ✅ Inline entity promotion (виділив текст → сутність)

**Universe Reconstruction:**
- ✅ **Базова реконструкція** (тільки Rename + Property changes)
- ✅ До 50 items per reconstruction
- ❌ Складні типи (Relationship/Remove/Rewrite)

**Book Interface:**
- ✅ **Експорт DOCX/PDF**
- ✅ Version history (30 днів, до 10 snapshots)
- ✅ Inline editing з Keeper Detection

**Director:**
- ✅ Storyboard створення (manual)
- ❌ AI shot generation
- ❌ LoRA training

**Limits:**
- 150 Gemini + 10 Claude/міс (~$0.075 Gemini + $0.25 Claude = $0.325/міс витрат)
- 5 проєктів
- 30 днів version history
- Базова реконструкція

**ROI:** $15 - $0.33 = **$14.67 прибуток (98% маржа)**

**Мета:** Monetize хоббістів, дати експорт (book = product).

---

### **NOVELIST Tier** ($39/міс) ⭐ RECOMMENDED

**AI Generation:**
- ✅ **500 сцен/міс Gemini** АБО **100 сцен Claude**
- ✅ Гібридний вибір: користувач обирає AI per scene
- ✅ Auto Mode (генерація цілих розділів)

**Canon Management:**
- ✅ **20 проєктів**
- ✅ Повне редагування канону
- ✅ Canon branching (what-if версії)
- ✅ Continuity checker (суперечності)

**Universe Reconstruction:** 🔥
- ✅ **ПОВНА реконструкція** (всі 6 типів змін)
- ✅ Diff + human-in-the-loop
- ✅ Необмежена кількість items
- ✅ Impact heatmap
- ✅ Orphan detection

**Book Interface:**
- ✅ Експорт DOCX/PDF/EPUB
- ✅ Version history (90 днів, до 50 snapshots)
- ✅ Advanced editing (multi-scene operations)
- ✅ Keeper Whisper annotations

**Director:**
- ✅ **AI Storyboard generation** (Gemini)
- ✅ Shot breakdown з AI
- ✅ Базовий LoRA training (до 20 refs/entity)

**Hidden Canon:**
- ✅ **True vs Surface versions**
- ✅ Reveal timing (twist management)
- ✅ Setup→Payoff edges

**Limits:**
- 500 Gemini АБО 100 Claude/міс
- 20 проєктів
- 90 днів history
- Повна реконструкція

**ROI (worst case - всі беруть Claude):**
- $39 - $2.50 (100 Claude) = **$36.50 прибуток (94% маржа)**

**ROI (realistic - 80% Gemini):**
- $39 - $0.25 (500 Gemini) = **$38.75 прибуток (99% маржа)**

**Мета:** Core monetization tier. Universe Reconstruction = must-have для serious authors.

---

### **WORLDBUILDER Tier** ($99/міс)

**AI Generation:**
- ✅ **500 сцен Claude/міс** (топова якість)
- ✅ **Необмежено Gemini** (для чернеток)
- ✅ Priority queue (0 wait time)
- ✅ Architect Mode (генерація структури всієї книги)

**Canon Management:**
- ✅ **Необмежено проєктів**
- ✅ Всі фічі з Novelist
- ✅ Agent Mode (автоматичний аналіз→імпакт→reconstruction)
- ✅ Advanced graph analytics

**Universe Reconstruction:**
- ✅ Всі фічі з Novelist
- ✅ **Агентний режим** (AI сам пропонує реконструкцію)
- ✅ Batch operations (масові зміни канону)

**Book Interface:**
- ✅ Експорт у всі формати
- ✅ Version history (180 днів, необмежено snapshots)
- ✅ Collaboration (майбутнє)
- ✅ Custom templates

**Director:**
- ✅ **AI Shot generation (Claude)** - висока якість
- ✅ **Повний LoRA training** (до 50 refs, автотренування)
- ✅ Image generation з Midjourney/DALL-E integration
- ✅ Video storyboard export

**API Access:**
- ✅ REST API для автоматизації
- ✅ Webhooks
- ✅ CLI tool

**Support:**
- ✅ Пріоритетна підтримка
- ✅ Ранній доступ до beta features
- ✅ 1-on-1 консультації (2/місяць)

**Limits:**
- 500 Claude + ∞ Gemini/міс
- ∞ проєктів
- 180 днів history
- Priority everything

**ROI:**
- $99 - $12.50 (500 Claude) = **$86.50 прибуток (87% маржа)**

**Мета:** Premium tier для професіоналів + early adopters tech features.

---

## 🧮 Unit Economics (консервативний прогноз)

### 100 платних користувачів:

| Tier | Users | MRR | AI Cost | Маржа |
|------|-------|-----|---------|-------|
| Free | 500 | $0 | ~$3.75 (500×15×$0.0005) | -$3.75 |
| Storyteller | 50 | $750 | $16.25 (50×$0.325) | $733.75 |
| Novelist | 40 | $1,560 | $10 (реалістично 80% Gemini) | $1,550 |
| Worldbuilder | 10 | $990 | $125 (10×500×$0.025) | $865 |

**Разом:**
- **MRR: $3,300**
- **AI витрати: $155**
- **Firebase/Stripe: ~$150**
- **Profit: $2,995 (~91% маржа)**

### Песимістичний (багато Claude users на Novelist):

- Якщо 100% Novelist беруть Claude:
  - 40 × $2.50 = $100 замість $10
- **AI витрати: $245**
- **Profit: $2,905 (~88% маржа)**

Все одно супер! 🚀

---

## 🎨 Диференціація по фічах (summary table)

| Фіча | Free | Storyteller ($15) | Novelist ($39) | Worldbuilder ($99) |
|------|------|-------------------|----------------|--------------------|
| **Сцени Gemini/міс** | 15 | 150 | 500 | ∞ |
| **Сцени Claude/міс** | 0 | 10 | 100 | 500 |
| **Проєкти** | 1 | 5 | 20 | ∞ |
| **Scene Intents** | 7 | 7 | 7 + Auto Mode | 7 + Architect |
| **Canon Editing** | ❌ | ✅ | ✅ | ✅ + Agent |
| **Reconstruction** | Preview | Basic | **FULL** 🔥 | Full + Agent |
| **Continuity Check** | ❌ | ❌ | ✅ | ✅ |
| **Hidden Canon** | ❌ | ❌ | ✅ | ✅ |
| **Експорт** | ❌ | DOCX/PDF | DOCX/PDF/EPUB | All + templates |
| **Version History** | ❌ | 30 днів | 90 днів | 180 днів |
| **Storyboard** | Read | Manual | AI (Gemini) | AI (Claude) |
| **LoRA Training** | ❌ | ❌ | Basic (20 refs) | Full (50 refs) |
| **Priority Queue** | ❌ | ❌ | ❌ | ✅ |
| **API Access** | ❌ | ❌ | ❌ | ✅ |
| **Support** | Community | Email | Email | Priority + 1-on-1 |

---

## 📊 Конкурентний аналіз (оновлено)

### Sudowrite ($10-100/міс)
- ✅ Story editing tools
- ✅ Character builder
- ❌ Немає Universe Reconstruction
- ❌ Немає canon-aware generation
- ❌ Немає storyboard/director

### NovelAI ($10-25/міс)
- ✅ AI writing
- ✅ Image generation
- ❌ Немає structured canon
- ❌ Немає reconstruction
- ❌ Немає Ukrainian support

### Jasper ($39-99/міс)
- ✅ General AI writing
- ❌ Не для fiction
- ❌ Немає story-specific features

**WhiteWrite унікальність:**
1. **Universe Reconstruction** — моat 🔥
2. **Canon-aware** tri-pillar approach
3. **Hidden canon + twists**
4. **Director/LoRA** для візуалізації
5. **Українська** з правильною типографікою

**Можемо просити $39-99 за унікальність.**

---

## 🚀 Стратегія запуску

### Phase 1: MVP (зараз)
**Запустити:**
- Free + Storyteller ($15)
- Базова реконструкція
- Gemini генерація
- Експорт DOCX/PDF

**Metrics:**
- 100 free users → 10 paid (10% conversion)
- MRR: $150

### Phase 2: Reconstruction (3 місяці)
**Додати:**
- Novelist ($39)
- Повна Universe Reconstruction 🔥
- Claude credits
- Hidden canon

**Metrics:**
- 500 free → 50 Storyteller + 20 Novelist
- MRR: $1,530

### Phase 3: Premium (6 місяців)
**Додати:**
- Worldbuilder ($99)
- API access
- Агентний режим
- LoRA full training

**Metrics:**
- 1000 free → 100 Storyteller + 50 Novelist + 10 Worldbuilder
- MRR: $4,440

---

## 🎯 Рекомендація до впровадження

### Обрати модель: **4-Tier Quality Ladder**

**Ціни:**
- **Free:** $0 (hook)
- **Storyteller:** $15 (hobby tier)
- **Novelist:** $39 (core monetization) ⭐
- **Worldbuilder:** $99 (premium/professional)

**Метрика:** **Scenes/month** (зрозуміліше ніж tokens)

**Диференціація:**
1. AI quality (Gemini → Claude)
2. **Universe Reconstruction** (none → preview → basic → FULL)
3. Features (експорт, version history, LoRA)
4. Support level

**Killer feature:** Universe Reconstruction на tier $39+

**Психологія:**
- Free = спроба + hook
- $15 = доступно для хоббі
- **$39 = sweet spot** (serious authors готові платити за reconstruction)
- $99 = shows premium exists (anchoring effect)

---

## ✅ Наступні кроки (технічні)

1. **Оновити плани в коді:**
   - `functions/index.js` — нові ліміти
   - `app/White.html` — UI планів
   - Firestore schema — додати `scenesMonthly`, `claudeCredits`

2. **Stripe products:**
   - 3 продукти (Storyteller/Novelist/Worldbuilder)
   - Price IDs в коді

3. **Метрика сцен:**
   - Лічильник `scenesGenerated` (reset щомісяця)
   - Окремий лічильник `claudeCredits`
   - UI показує "50/150 сцен" замість "2480 токенів"

4. **Feature gates:**
   - Reconstruction тип по плану
   - Експорт по плану
   - Claude credits enforcement

5. **Stripe Extension:**
   - Встановити як описано в INSTALL_EXTENSION.md
   - Синхронізація підписок

---

## 📝 Альтернативні моделі (якщо передумаємо)

### Опція B: Pay-per-scene (no subscription)
- $0.10 за сцену Gemini
- $0.30 за сцену Claude
- + Credits packages ($5 = 50 сцен Gemini)

**Проблема:** Непередбачуваний дохід.

### Опція C: Tiered + Add-ons
- Базові плани як вище
- + Buy extra Claude credits ($10 = 50 credits)
- + Buy extra projects ($5/project)

**Перевага:** Гнучкість для power users.

---

## 🎉 Підсумок

**Рекомендую:** Quality Tiers ($0/$15/$39/$99)

**Ключові рішення:**
1. ✅ Метрика **scenes** замість tokens
2. ✅ **Reconstruction** як killer feature на $39+
3. ✅ Гібрид Gemini/Claude на всіх tier (крім Free)
4. ✅ 4 рівні замість 3 (показує growth path)
5. ✅ 91% маржа навіть при песимістичному прогнозі

**Єдиний ризик:** Power users на Worldbuilder можуть коштувати >$15/міс AI.
**Рішення:** Soft cap на 500 Claude + $0.05/сцена після ліміту.

**Готово до впровадження!** 🚀
