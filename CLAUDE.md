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

# Конвенції
- Стиль коду — як у наявних файлах. JSX через babel; глобали на `window` (увага до колізій імен; **ніколи** `const styles`).
- Скриншотер (html-to-image) НЕ знімає web-компоненти й fixed-overlay — перевіряти через DOM (eval), а не скриншот. У реальному браузері все рендериться.
- **НІКОЛИ не переписуй весь файл** — використовуй `Edit` tool для точкових змін (git diff style). Якщо Read повернув 50 lines, а ти змінюєш 2 — Write з усіма 50 lines ЗАБОРОНЕНО. Лише Edit з old_string → new_string.


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
