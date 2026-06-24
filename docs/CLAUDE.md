# CLAUDE.md — Протокол роботи з AI-асистентом

**Мета:** Усунути баги через невідповідність між mental model AI та реальною архітектурою. Обов'язковий протокол для кожної сесії.

---

## 🚨 СТАРТ КОЖНОЇ СЕСІЇ

**ПЕРШ НІЖ писати код, ОБОВ'ЯЗКОВО:**

1. **Прочитати фундамент:**
   ```
   Read: docs/ARCHITECTURE.md
   Read: docs/SYSTEM_REGISTRY.md
   Read: docs/CLAUDE.md (цей файл)
   ```

2. **Переказати структуру:**
   - Де живе projectId? (Shell = writer, Pillars = readers)
   - Де живе pricing? (ai-models.js + economy_operations)
   - Де живе canon? (projects/{id}.canon field, NOT separate collection)
   - Які pillars існують? (Book/WorldTree/Director)
   - Робоча папка? (`app/`, НЕ `public/` чи `prototype/`)

3. **Тільки ПІСЛЯ переказу** — приступити до задачі.

**Чому:** AI не має persistent memory. Без читання документів кожна сесія починається з нуля → hardcode, дублювання, порушення SSOT.

---

## 📋 ФОРМАТ ЗАДАЧ

Кожна задача MUST мати чітку структуру:

### **МЕТА**
Що саме робимо (1 речення). Приклад: "Перенести всі AI-виклики через token-service для уніфікованого тарифікування."

### **ФАЙЛИ**
Список файлів, які ТОРКАЄМОСЯ:
- `functions/index.js` (lines 163-175: economy read logic)
- `functions/token-service.js` (new file)

### **НЕ ЧІПАЙ**
Explicit список того, що НЕ змінювати:
- ❌ UI (White.html, CSS)
- ❌ Existing generateScene logic (additive only)
- ❌ Mock data (already removed)

### **ГОТОВО КОЛИ**
Критерії успіху (verifiable):
- [ ] Smoke test: згенерувати сцену → -300 tokens → usage_log створено
- [ ] `grep "sceneCost = " functions/` → лише читання з Firestore
- [ ] Console: no errors, scene appears in Book

---

## 🔄 РОБОЧИЙ ЦИКЛ

### Один крок → димовий тест → коміт

```
1. Зміни (Edit/Write)
2. Deploy: firebase deploy --only functions
3. Прод-тест на whitewrite.com (screenshot Console + UI)
4. Коміт з доказом
5. СТОП — чекати GO для наступного кроку
```

**НІКОЛИ:**
- ❌ Batch changes (5 файлів одночасно)
- ❌ "Це тривіально, можна скіпнути тест"
- ❌ Коміт без screenshot/log proof

**Phase-based робота:**
- Кожна фаза = окрема гілка (якщо великі зміни)
- Additive changes (не ламати існуюче)
- Прод працює після кожної фази

---

## 📂 СТРУКТУРА ПРОЄКТУ

### Робоча папка: `app/` (НЕ `public/` чи `prototype/`)

```
app/
  ├─ White.html                  # Shell (navigation, projectId SSOT)
  ├─ WhiteWrite.html             # Book pillar (narrative generation)
  ├─ WhiteWrite WorldTree.html   # WorldTree pillar (canon management)
  ├─ WhiteWrite Workspace.html   # Director pillar (storyboard)
  ├─ firebase/
  │   ├─ firebase-init.js        # Firebase SDK init
  │   ├─ firebase-auth.js        # Auth + user plan
  │   ├─ firebase-projects.js    # Project CRUD
  │   ├─ firebase-scenes.js      # Scene generation wrapper
  │   └─ firebase-ai.js          # AI operations
  ├─ app.jsx                     # Book React app
  ├─ wt-app.jsx                  # WorldTree React app
  └─ ws-app.jsx                  # Director React app

functions/
  ├─ index.js                    # Cloud Functions (generateScene, etc.)
  └─ ai-models.js                # AI_MODELS + MODEL_PRICING (SSOT)

docs/
  ├─ ARCHITECTURE.md             # Responsibility map
  ├─ SYSTEM_REGISTRY.md          # Single sources of truth
  ├─ CLAUDE.md                   # Цей файл
  └─ REFACTOR_PLAN.md            # Phase-by-phase plan
```

### Деплой
- **Hosting:** `firebase deploy --only hosting` (деплоїть `app/`)
- **Functions:** `firebase deploy --only functions`
- **Live URL:** https://whitewrite.com

---

## 🚫 ЗАБОРОНИ

### ❌ НЕ "спрощувати" код
```javascript
// Існуючий код (навіть якщо здається надмірним):
if (economyDoc.exists && economyDoc.data() && economyDoc.data().providers) {
  ...
}

// ❌ НЕ "спрощувати" до:
const sceneCost = economyDoc.data()?.providers?.claude?.cost || 300;
// ^ fallback 300 = hardcode = баг
```

**Правило:** Якщо код працює — не чіпай. Refactor ТІЛЬКИ якщо юзер попросив.

### ❌ НЕ вигадувати UI
```
User: "Додай usage_logs"
AI: ✅ Додаю backend logging
AI: ❌ "А ще зробимо дашборд з графіками витрат!" — НІ, не просили
```

**Правило:** Робити ЛИШЕ те, що попросили. Zero unsolicited features.

### ❌ НЕ hardcode
```javascript
// ❌ BAD
const model = 'claude-opus-4-20250514';
const cost = 300;

// ✅ GOOD
const { AI_MODELS } = require('./ai-models.js');
const model = AI_MODELS.claude.opus;
const economyDoc = await db.collection('economy_operations').doc('generateScene').get();
const cost = economyDoc.data().providers.claude.cost;
```

### ❌ НЕ два джерела правди
```javascript
// ❌ BAD: Canon у двох місцях
await db.collection('canon').doc(projectId).set(canon); // Окрема колекція
await db.collection('projects').doc(projectId).update({ canon }); // І в project

// ✅ GOOD: Лише в project
await db.collection('projects').doc(projectId).update({ canon });
```

### ❌ НЕ копіювати state
```javascript
// ❌ BAD: DATA = копія WORLD
DATA.characters = [...WORLD.characters];

// ✅ GOOD: DATA = проєкція (reference)
DATA.characters = WORLD.characters;
```

---

## 🎯 SINGLE SOURCE OF TRUTH (SSOT)

**Перед додаванням нової змінної/поля — питання:**
1. Чи існує вже це десь? (grep по кодбазі)
2. Якщо існує — чому не використовуємо?
3. Якщо не існує — це буде SSOT (все інше читатиме звідси)?

**Приклади SSOT** (див. SYSTEM_REGISTRY.md):
- ProjectId → `window.__currentProjectId` (Shell)
- AI Models → `AI_MODELS` (ai-models.js)
- Pricing → `MODEL_PRICING` (ai-models.js) + `economy_operations` (Firestore)
- Canon → `projects/{id}.canon` (Firestore field)

**Верифікація:**
```bash
# Перевірити, що pricing не hardcoded:
grep -r "300" functions/ | grep -v "ai-models.js" | grep -v "economy"
# Має бути порожньо (або лише коментарі)

# Перевірити, що model versions не hardcoded:
grep -r "claude-opus-4" functions/ | grep -v "ai-models.js"
# Має бути порожньо
```

---

## 📝 КІНЕЦЬ СЕСІЇ

**Перед завершенням:**

1. **Оновити документацію** (якщо архітектура змінилась):
   - `ARCHITECTURE.md` — нові модулі/відповідальності
   - `SYSTEM_REGISTRY.md` — нові SSOT
   - `CLAUDE.md` — нові anti-patterns

2. **Створити SESSION_LOG:**
   ```
   docs/SESSION_LOG_2026-06-24.md:

   # Session: Phase 4 Economy Layer

   ## Що зроблено:
   - economy_operations Firestore collection
   - generateScene reads pricing from Firestore
   - Bug fix: Claude 20→300 tokens
   - usage_logs tracking

   ## Файли змінено:
   - functions/index.js (lines 163-175, 370-420)
   - functions/ai-models.js (new: MODEL_PRICING)

   ## Smoke test:
   - Screenshot: Console shows -300 tokens
   - Screenshot: usage_logs/{id} created

   ## Коміт:
   - git commit -m "Phase 4: Economy Layer + API cost tracking"

   ## Наступний крок:
   - Phase 5.0: Інвентаризація AI-операцій
   ```

3. **Git status:**
   ```bash
   git status        # Чи є uncommitted changes?
   git log -1        # Останній коміт (перевірка)
   ```

---

## 🔍 DEBUGGING PROTOCOL

### Коли щось не працює:

1. **Console logs FIRST:**
   ```
   User: "Не списуються токени"
   AI: "Дай screenshot Console (F12 → Console tab)"
   ```

2. **Firestore SECOND:**
   ```
   AI: "Перевір Firestore Console → users/{uid} → поле tokens"
   ```

3. **Cloud Functions logs THIRD:**
   ```bash
   firebase functions:log --limit 50
   ```

4. **Reproduction:**
   ```
   AI: "Спробуй згенерувати сцену ще раз (з відкритою консоллю)"
   User: *screenshot*
   AI: *analysis*
   ```

**НІКОЛИ:**
- ❌ "Це має працювати" (без перевірки)
- ❌ "Можливо, кеш браузера" (без evidence)
- ❌ Пропонувати fixes без розуміння root cause

---

## 📊 PHASE-BASED WORK

### Приклад: Phase 5 — Token Service

**Phase 5.0:** Інвентаризація (БЕЗ коду)
- Grep functions/ для всіх AI-викликів
- Таблиця: Operation | File | Model | Charges? | Logs?
- **СТОП** — чекати GO

**Phase 5.1:** Token Service Module
- Створити `functions/token-service.js`
- Міграція generateScene → через token-service
- Smoke test
- Коміт

**Phase 5.2:** Міграція інших операцій
- extractCanon → token-service
- analyzeScene → token-service
- Smoke test (всі три операції)
- Коміт

**Phase 5 DONE:** Верифікація
- Grep: всі AI-виклики через token-service
- usage_logs: всі операції логуються
- Final commit

**Правило:** Не йти до 5.1, поки 5.0 не approved. Не йти до 5.2, поки 5.1 не протестовано.

---

## ⚠️ TYPICAL BUGS & HOW TO AVOID

### Bug 1: Hardcoded values
**Root cause:** Не прочитав SYSTEM_REGISTRY.md → не знав про SSOT
**Fix:** Завжди grep перед додаванням константи
```bash
grep -r "sceneCost" functions/  # Перевірити, чи існує
```

### Bug 2: Два джерела projectId
**Root cause:** Iframe читає з URL + з global
**Fix:** ARCHITECTURE.md § "Unidirectional Data Flow" — Shell writes, iframes read

### Bug 3: Mock data bleeding
**Root cause:** WORLD ініціалізовано з прототипними даними
**Fix:** Видалити ВСІ моки (characters: [], locations: [], etc.)

### Bug 4: Projects tab flicker
**Root cause:** Два виклики fillHome() (один з порожнім PROJECTS)
**Fix:** Surgical change — видалити перший виклик, лишити тільки в loadProjects()

### Bug 5: apiCostUSD = $0.0000
**Root cause:** Model name mismatch (economy_operations vs MODEL_PRICING)
**Fix:** ai-models.js = SSOT для pricing, підтримувати обидві версії моделі

---

## 🎓 LEARNING FROM HISTORY

### Phase 3: Single Source of Truth (projectId)
- **Lesson:** Iframe boundaries = асинхронні. postMessage + React Context.
- **Anti-pattern:** URL params як SSOT (race conditions).

### Phase 4: Economy Layer
- **Lesson:** Hardcoded costs = revenue leak. Data-driven pricing ОБОВ'ЯЗКОВО.
- **Anti-pattern:** Magic numbers у коді.

### Phase 4.1: API Cost Tracking
- **Lesson:** Model versions змінюються. Pricing MUST бути в окремому файлі.
- **Anti-pattern:** `'claude-opus-4-20250514'` у 5 місцях коду.

---

## ✅ SUCCESS CRITERIA

**Сесія вважається успішною, якщо:**

1. ✅ Прочитано ARCHITECTURE.md + SYSTEM_REGISTRY.md на старті
2. ✅ Кожна зміна = Edit (surgical), НЕ Write (rewrite)
3. ✅ Кожна фаза протестована на whitewrite.com (screenshot)
4. ✅ Кожен коміт з доказом (console log / Firestore screenshot)
5. ✅ Жодного hardcoded model version / pricing
6. ✅ Жодних unsolicited features
7. ✅ SESSION_LOG створено з описом змін

---

## 🔗 RELATED DOCS

- `ARCHITECTURE.md` — Responsibility map (хто за що відповідає)
- `SYSTEM_REGISTRY.md` — Таблиця SSOT (де що живе)
- `REFACTOR_PLAN.md` — Phase-by-phase план (що робимо далі)
- `PHASE_4_REPORT.md` — Приклад session log

---

**Створено:** 2026-06-24 (Phase 5 prep, перед інвентаризацією AI-операцій)

**Останнє оновлення:** 2026-06-24

---

# Appendix: Quick Reference

## Команди перед початком роботи
```bash
# 1. Читання фундаменту
Read: docs/ARCHITECTURE.md
Read: docs/SYSTEM_REGISTRY.md
Read: docs/CLAUDE.md

# 2. Git status
git status
git log -3 --oneline

# 3. Grep для розуміння поточного стану
grep -r "generateScene" functions/
grep -r "AI_MODELS" app/
```

## Команди перед комітом
```bash
# Верифікація SSOT
grep -r "claude-opus" functions/ | grep -v "ai-models.js"  # Має бути порожньо
grep -r "sceneCost = [0-9]" functions/                      # Не hardcode
grep -r "300" functions/ | grep -v comment                  # Не magic numbers

# Deploy + test
firebase deploy --only functions
# → Відкрити whitewrite.com → Console (F12) → згенерувати сцену → screenshot

# Commit
git add .
git commit -m "Phase X.Y: [короткий опис]

- Зміна 1
- Зміна 2

Smoke test: [опис]
Screenshot: [посилання або у commit message]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

## Firestore Collections (SSOT)
```
users/{uid}                     → plan, tokens, tokensMonthly
projects/{id}                   → title, canon, owner
projects/{id}/scenes/{sceneId}  → text, sceneIntent, canonRefs
economy_operations/{op}         → providers.{claude|gemini}.cost
usage_logs/{logId}              → uid, operation, tokens, apiCostUSD
```

## AI Models (SSOT)
```javascript
// Backend
const { AI_MODELS, MODEL_PRICING } = require('./ai-models.js');
const model = AI_MODELS.claude.opus;
const pricing = MODEL_PRICING[model];

// Frontend
const model = window.__AI_MODELS.claude.opus;
const pricing = window.__MODEL_PRICING[model];
```
