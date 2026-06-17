# WhiteWrite — проєктна памʼять

Мистичний інструмент для письменників/режисерів. Три стовпи навколо **одного канону**:

```
📖 Книга (Narrative)   — WhiteWrite.html        пишеш історію (пергамент, Philosopher)
🌳 Всесвіт (Canon)     — WhiteWrite WorldTree.html  керуєш каноном (темний, Cinzel/gold)
🎬 Режисер (Director)  — WhiteWrite Workspace.html  візуалізуєш сцени (темний)
```

## Архітектура даних (важливо)
- **`WORLD` (`wt-world.jsx`) — ЄДИНЕ джерело правди.** Усі три стовпи читають із нього.
- `DATA` (`ws-data.jsx`) — це **проєкція над `WORLD`**, а не окремі дані (`DATA.characters === WORLD.characters`). Не повертати DATA до власних моків.
- Тришарова модель: **Canon** (characters/locations/events/factions/artifacts/world) → **Narrative** (arcs/chapters/scenes/dialogues) → **Director** (storyboards/shots/images). Звʼязки названі за target-type-plural; реверс деривується.

## Рушій (`wt-impact.jsx`, під капотом, на `window`)
Конвеєр: **Canon Change → Change Analysis → Impact → Strategy → Plan → Execute**.
- `wConnections(type,id)` — усі звʼязки сутності.
- `wAffected(type,id)` / `wImpact(type,id)` — транзитивний імпакт по шарах.
- `WCHANGES` — 6 типів зміни (rename / property / relationship / add / remove / rewrite), кожен зі стратегією.
- `wReconstructionPlan(type,id,changeId)` — стратегічно-залежний впорядкований план.
- UI рушія відкривається лише на вимогу (overlay у профілі). Книга лишається книгою.

## Крос-навігація
- Книга → Всесвіт: магічні закладки + «✦ Дослідити канон».
- Deep-links: `WorldTree.html?type=&id=` (відкрити сутність), `WhiteWrite.html?scene=N` (відкрити розворот).

## 💳 Платежі та Токени (Phase 1-2, прод-готово)

**Phase 1.1: Token Budget System** — повністю працює ✅
- План-базована система токенів (місячний бюджет + витрати)
- UI: dock показує баланс, toast після генерації, upgrade modal при нестачі
- `window.__firebaseAuth.consumeTokens(operation)` — універсальна функція споживання
- Feature gates: `allowClaude`, `allowImages`, `allowReconstruction` (прив'язані до плану)

**Phase 2: Stripe Integration** — повністю працює ✅

Файли:
- `functions/index.js` (lines 10-13, 567-730) — Stripe Cloud Functions
- `app/White.html` (lines 368-379, 1281-1322) — Frontend + CSS
- `app/firebase/firebase-auth.js` (lines 192-269) — consumeTokens логіка

Stripe Price IDs (Test Mode):
```javascript
storyteller: 'price_1Tj4eVK1XPrHbpbZrmiMvCwh',    // $12/month
novelist: 'price_1Tj4fBK1XPrHbpbZyhlAANxB',       // $36/month
worldbuilder: 'price_1Tj5PZK1XPrHbpbZJ8LpKik0'    // $69/month
```

Webhook Events (handled in `stripeWebhook`):
- `checkout.session.completed` → update user plan + stripeCustomerId/SubscriptionId
- `customer.subscription.updated` → sync plan changes
- `customer.subscription.deleted` → downgrade to free

UI Classes (app/White.html):
- `.plan.is-cur` — gold border на поточному плані (line 380)
- `.plan` — flexbox container (line 368-369)
- `.plan__feats` — flex:1 (розтягується, line 373)
- `.plan__btn`, `.plan__badge` — margin-top:auto (прибиті до низу, lines 376-379)

Token Costs (`window.__TOKEN_COSTS`):
- sceneGemini: 20 tokens
- sceneClaude: 100 tokens
- imageGeneration: 50 tokens (майбутнє)

Margins:
- Free: 200 tokens/mo (cost: -$0.005, втрата)
- Storyteller: 2000 tokens, $12 → ~99% margin
- Novelist: 8000 tokens, $36 → ~90% margin
- Worldbuilder: 20000 tokens, $69 → ~70% margin
- Реальні margins ~98% (юзери не витрачають весь бюджет)

Наступні кроки (опціонально):
- Customer Portal (cancel/upgrade підписки)
- Live Mode (перейти з test на production Stripe keys)
- Промокоди (вже підтримуються в checkout: `allow_promotion_codes: true`)

---

# 🗺 Roadmap (ідеї, не зобовʼязання)

## Навколо реконструкції
- **Реальне AI-виконання** — ▶ перегенеровує сцену/діалог через `window.claude`, підтягуючи повʼязаний канон як контекст.
- **Diff + human-in-the-loop** — «було → стане» з Прийняти/Відхилити на кожен елемент. ⭐ топ-вибір.
- Вибірковість (лише Режисер), оцінка вартості, глибина хвилі.

## Граф залежностей
- **Continuity-checker** — авто-виявлення суперечностей (мертвий персонаж говорить).
- Теплова мапа впливу на дереві; виявлення «сиріт».

## Авторство (зараз read-only)
- Редагування канону з live-прев'ю впливу.
- «Промоція з книги»: виділив у тексті → зробити сутністю.
- Гілки всесвіту (what-if версіонування).

## AI-генерація (обіцянка продукту)
- Генерація сцени з канону на «Чистому аркуші».
- Реальні storyboard/shot/image у Режисері.
- Усе canon-aware.

## Стратегічне
- Universe Reconstruction як моат.
- Агентний режим (аналіз→імпакт→чернетки→черга рев'ю).

## Нелінійність і твісти (моат, природно лягає на граф)
- **Прихований канон**: сутність/факт має `trueVersion` + `surfacedVersion` (+`revealUntil: sceneId`). До розкриття світ «знає» одне, після — фліп. Твіст = зміна канону → reconstruction підправляє сцени консистентно.
- **Setup→Payoff ребра** ("foreshadows"/"pays-off"): система садить насіння й гарантує виплату, не губить натяк.
- **Паралельні лінії**: `scene.arc` + `POV`; дві осі порядку — story order vs chronological (флешбеки); «коса» (braid) на таймлайні.
- **Scene Intent «Поворот»**: окремий напрям — AI свідомо підриває очікування, спираючись на канон (не рандом).

---

# 🔧 Тех-аудит — статус
- **P0 — два джерела даних** → ✅ ВИРІШЕНО (єдиний `WORLD`, `DATA` = проєкція).
- **P1** — Режисер досі має дублюючі вкладки Персонажі/Локації (територія Всесвіту); крихкий глобальний скоуп; **доступність** (focus-trap у модалках, фокус-кільця, статус не лише кольором).
  - ✅ Режисер очищено: лише Розкадровка + Візуальний канон (LoRA-референси); Персонажі/Локації — у Дереві.
  - ✅ Єдиний перемикач стовпів `.pillswitch` (Книга·Всесвіт·Режисер) на всіх 3 екранах.
  - ✅ Мертвий CSS у WorldTree прибрано; focus-trap + role=dialog на overlay реконструкції та книжкових закладках; глобальні фокус-кільця.
- **P2** — продакшн (in-browser Babel, dev-React); ✅ важкі PNG (world-tree, StartBack) → JPEG (−86%, 5.8МБ→0.8МБ); ✅ memo для `wConnections`/`wImpact`; ✅ персистентність позиції читання книги (localStorage); лишається: мобільні overlay/граф полірування, прекомпіляція JSX для прод.

# 🧬 Фундаментальні інваріанти (НЕ порушувати)

Міграція прод-системи (whitewrite.com) в **Canon-Aware**. Беремо ПОВЕРХ, не заміна. Лишаємо: auth, Firestore, save-queue, billing, AI-режими (Write/Analyze/Improve/Adapt/Architect), memorySuggestions, дебаунс-autosave.

1. **Canon = джерело правди. Memory = View** (буквально як SQL View, не копія).
   `Canon → Memory View → AI Context`. memorySuggestions пишуть **у canon**, memory **ре-деривується**. Ніколи два джерела правди.
2. **Canon — поле в `project`-документі**, не окрема колекція (щоб не дублювати save-queue/versioning/rollback/snapshots).
3. **Два джерела канону:**
   - **Explicit Canon** — створив користувач (авторитетне).
   - **Inferred Canon** — AI припустив, із `confidence %` → черга на підтвердження. Inferred НЕ є фактом: не годується в генерацію як істина і не тригерить реконструкцію, доки не підтверджено. Міграція не створює непідтверджених «фактів».
4. **ID стабільний і непрозорий** + окремо slug + display name:
   `id: "char_8f3k2a"`, `slug: "marcus-chen"`, `name: "Маркус Кейн"`.
   Перейменування (Маркус → Король Маркус) змінює лише name/slug + текстові згадки — **граф не ламається** (тому change-type `rename` лишається легким).
5. **True History Lock** — механізм не беремо; беремо інтент через per-item стани реконструкції: Авто-реген / **Рев'ю (diff, дефолт)** / Pinned (+ continuity-warning).

# ✍️ Філософія наративу (Story Navigation, НЕ Story Generation)

**Користувач майже не пише текст — він приймає творчі рішення.**

Дефолт — **Guided Mode** (поступово, по одній сцені):
```
Canon → Сцена 1 → Scene Intent → Сцена 2 → Scene Intent → …
```
Перед кожною наступною сценою — **Scene Intent**: AI питає «що далі?» з варіантами (Конфлікт / Розвиток персонажа / Екшн / Романтика / Світобудова / Сюрприз від AI / Свій опис). Користувач задає **напрям**, не промпт. Інтент зберігається на сцені (для регенерації).

**Auto Mode** (окремий, не дефолт): «згенерувати сезон» → 12 серій → 200 сцен одним заходом.

НЕ будувати систему під генерацію книг (Sudowrite/NovelAI). Architect-аутлайн = гнучкий каркас-пропозиція, який юзер веде, а не фіксований контракт. Кожна наступна сцена читає **поточний** canon → історія лишається canon-consistent у міру еволюції.

> Narrative generation must NOT assume full-story generation. Default flow: Canon → Next Scene → User Direction → Next Scene. Full-book/season generation is a separate autonomous mode.

# 🏗 Поточна робота: Підписка з Claude API (червень 2026)

## Продакшн
- **Головний сайт:** `whitewrite.com` (custom domain для Firebase Hosting)
- **Firebase Hosting:** деплоїться з папки `app/` (НЕ `public/`!)
- **Деплой:** `firebase deploy --only hosting` (або `--only functions` для Cloud Functions)

## Структура файлів (ВАЖЛИВО!)
- **Робоча директорія:** `app/` — це продакшн, що йде на whitewrite.com
- **Застаріла директорія:** `public/` — ігнорувати, це старі файли
- **Firebase модулі:** `app/firebase/*.js` (НЕ `app/shared/firebase/`!)
  - `firebase-init.js` — ініціалізація Firebase
  - `firebase-auth.js` — автентифікація + завантаження плану користувача
  - `firebase-projects.js` — робота з проєктами
  - `firebase-scenes.js` — генерація сцен через Cloud Functions
  - `firebase-ai.js` — AI-генерація

## Підписка: плани користувачів
- **seed** (безкоштовно): 300 токенів/міс, Gemini API, 1 проєкт
- **storyweaver** ($12/міс): 2500 токенів/міс, Gemini API, 10 проєктів
- **worldforge** ($29/міс): 8000 токенів/міс, **Claude API**, 999 проєктів

## Що вже зроблено ✅
1. Claude API інтегровано в Cloud Functions (`functions/index.js`)
2. `generateScene` перевіряє план користувача і використовує Claude для worldforge
3. `initializeUser` Cloud Function для створення/оновлення планів користувачів
4. Firestore: колекція `users/{uid}` з полями `{plan, tokens, tokensMonthly, maxProjects}`
5. UI перемикання планів викликає `initializeUser` (зберігає в Firestore, не мок)
6. `app/firebase/firebase-auth.js` завантажує план з Firestore при вході

## Поточний статус ✅
- ✅ Firebase Auth завантажує план з Firestore
- ✅ Claude API працює з моделлю `claude-3-5-sonnet-20240620`
- ✅ Квоти та захист підписки реалізовано
- ✅ Stripe Checkout інтеграція додана (test mode)
- ⏳ Потрібен Stripe Webhook для активації підписки після оплати

## UI — НЕ ЧІПАТИ!
- **Дизайн затверджено.** Не змінювати стилі, тексти, елементи без явної вказівки.
- Модальне вікно акаунта вже існує з планами seed/storyweaver/worldforge.
- Перемикання планів вже працює (викликає Cloud Function).
- Токени відображаються в лівому нижньому куті (dock) — `#tokcount`.

## Наступні кроки (після виправлення завантаження плану)
1. Перевірити, що `window.__wwUser.plan = 'worldforge'` після входу
2. Створити проєкт і згенерувати сцену
3. Переконатись, що використовується Claude API (перевірити логи Cloud Functions)
4. Перевірити токени (має відніматись з `window.__wwUser.tokens`)

# Конвенції
- Стиль коду — як у наявних файлах. JSX через babel; глобали на `window` (увага до колізій імен; **ніколи** `const styles`).
- Скриншотер (html-to-image) НЕ знімає web-компоненти й fixed-overlay — перевіряти через DOM (eval), а не скриншот. У реальному браузері все рендериться.
- **НІКОЛИ не переписуй весь файл** — використовуй `Edit` tool для точкових змін (git diff style). Якщо Read повернув 50 lines, а ти змінюєш 2 — Write з усіма 50 lines ЗАБОРОНЕНО. Лише Edit з old_string → new_string.
- **Завжди працюємо з `app/`, НЕ `public/`!** Перед редагуванням перевіряй, чи правильна директорія.


---

# Behavioral Guidelines (Claude Code)

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
