# SESSION DIGEST — контекст із дизайн-сесії (для Claude Code)

> Це стислий переказ рішень із чату «Claude Design ↔ Aizekhan». Читати разом із
> `CANON_SCHEMA.md` (спека) і `CLAUDE_invariants.md` (інваріанти).

## Що ми вирішили (суть)
Еволюціонуємо **наявний White-Tree** у **Canon-Aware** систему. **НЕ заміна** —
шар поверх. Лишаємо: auth, Firestore, save-queue, billing, AI-режими
(Write/Analyze/Improve/Adapt/Architect), memorySuggestions, autosave.

## 5 інваріантів (не порушувати)
1. **Canon = джерело правди. Memory = View** (`deriveMemory(canon)`, форма
   `NarrativeMemory` не змінюється → AIEngine не чіпаємо).
2. **canon — поле в `project`-документі**, не окрема колекція.
3. **Explicit vs Inferred** (+confidence, confirmed). Inferred не йде в генерацію й
   не тригерить reconstruction, доки не підтверджено. Міграція = усе inferred.
4. **opaque id + slug + name** (`char_8f3k2a` / `marcus-chen` / «Король Маркус»).
   Перейменування не ламає граф.
5. **recon (auto/review/pinned)** замість True History Lock; дефолт written-сцен — review (diff).

## Продуктовий принцип (впливає на Narrative Layer)
**Story Navigation, не Story Generation.** Дефолт — Guided Mode: по одній сцені, перед
кожною — **Scene Intent** (напрям, не промпт). Auto Mode (сезон одразу) — окремий.
Користувач **не пише текст — приймає творчі рішення.**

## План міграції (фазами)
- **Ф1 фундамент (темний деплой):** Canon* типи → `canon?`+`canonAware?` + rules → `deriveMemory()`.
- **Ф2 наповнення:** `EXTRACT_CANON` → backfill (inferred/confirmed:false) → UI черги підтвердження.
- **Ф3 фліп джерела (за флагом, ризик):** записи memory→canon→deriveMemory.
  **Правило де-ризику:** не вмикати флаг, поки `deepEqual(deriveMemory(canon), oldMemory)` для мігрованого проєкту.
- **Ф4 похідні:** `storyMap` з canon-графа; `SceneIntent` + canon-лінки на сценах.

## Гочі
- Міграція ідемпотентна (стабільні id, dedupe по name).
- `memory` лишаємо персистувати як кешований derived-знімок, але **писати — лише canon**.
- `applyMemorySuggestion` → новий хук `src/canon/useCanonManagement.ts` (зараз це placeholder);
  «Approve» у MemorySuggestionsPanel = підтвердження (→ explicit/confirmed).

## Готові файли в цій теці
- `CANON_SCHEMA.md` — повна схема + TS-інтерфейси + бридж + чек-ліст.
- `deriveMemory.ts` — Canon → NarrativeMemory (готова функція).
- `extractCanonPrompt.ts` — режим EXTRACT_CANON (systemInstruction + responseProperties + backfill helpers).
- `CLAUDE_invariants.md` — 2 розділи для додавання в кінець репо-`CLAUDE.md`.

## Поділ ролей
Claude **Design** (окрема сесія) = архітектура + дизайн + готові артефакти/специфікації.
Claude **Code** (цей термінал) = реалізація в репо, тести, пуш, деплой.
Передача — через ці файли. Візуальний трек (UI як у прототипі) — окремий handoff, за запитом.
