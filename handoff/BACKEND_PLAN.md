# BACKEND PLAN — WhiteWrite greenfield (для Claude Code)

> Чистий старт: нова папка, новий репозиторій. Без legacy, без оплати, без
> міграції користувачів. Canon = джерело правди з першого дня.
> Читати разом із: CANON_SCHEMA.md, AI_CONTRACTS.md, EDIT_TO_CANON.md, CLAUDE_invariants.md.

## 0. Старт
- Нова папка + новий repo (`whitewrite-app`). Прототип `White (1)` поряд як візуальний еталон.
- Моно-репо: `/web` (фронт, порт із прототипу) + `/functions` (бекенд) АБО один Vite-проєкт + Firebase. Обирай простіше.

## 1. Стек (мінімальний, під твій акаунт)
- **Фронт:** Vite + React + TS + React Router (Claude Code вже почав).
- **Бекенд/БД:** Firebase — Auth + Firestore + Cloud Functions (твій акаунт).
- **AI:** Cloud Function-проксі до Gemini/Claude (ключі на сервері, не в браузері).
- **Хостинг:** Firebase Hosting (заміна старої версії на тому ж акаунті).

## 2. Модель даних (Firestore) — canon з першого дня
```
users/{uid}                     // профіль, план(gemini|claude), tokens
projects/{projectId}            // ВЕСЬ всесвіт = один документ
  ├─ meta: {title, cover, scope, episodes, ending, genres, dialogueDensity}
  ├─ canon: ProjectCanon        // ← джерело правди (CANON_SCHEMA.md)
  ├─ architecture: {acts,chapters,scenes[]}   // scene має id+intent+canon-links
  ├─ shots[] / storyboards      // Режисер
  └─ memory: NarrativeMemory    // КЕШ = deriveMemory(canon), НЕ пишеться напряму
projects/{projectId}/lora/{entityId}   // референси + loraId (підколекція — важкі дані)
```
- **Інваріант:** memory ніколи не пишеться прямо; будь-яка зміна → canon → `deriveMemory` → кеш.
- `owner: uid` + Firestore rules: читати/писати лише власник.

## 3. Auth (просто)
- Email+пароль і Google (Firebase Auth). Модалка входу/реєстрації з прототипу.
- Гейт: без входу — лендінг працює, «Проекти»/«Створити» → модалка входу.

## 4. Cloud Functions (єдина точка AI + запис canon)
```
POST /ai/generate-scene   → AI_CONTRACTS §1/§2 (WRITE_SCENE; Guided/Auto)
POST /ai/scene-intent     → параметр до generate-scene (§3)
POST /ai/adapt-shots      → §5 (розкадровка + діалоги)
POST /ai/draw-shot        → §6 (image-gen, 3-5 варіантів)
POST /ai/gen-refs         → §7 (референси LoRA → inferred-черга)
POST /ai/train-lora       → §7 (тренування)
POST /ai/extract-canon    → міграція/витяг (inferred)
POST /ai/extract-from-edit→ EDIT_TO_CANON (промоція з тексту)
```
- Усі читають `project.canon` у контекст. Усе нове від AI → `inferred (confirmed:false)`.
- Провайдер за `user.plan`: gemini (дешевий) / claude (дорогий). Свап у `callModel()`.
- Токени: списувати після успішного виклику, лічильник у `users/{uid}`.

## 5. Порядок збірки (щоб фронт не чекав)
1. **Firebase init** + Auth + порожній Firestore + rules.
2. **Типи** `Canon*` (CANON_SCHEMA) + `deriveMemory.ts` (готовий) у спільний `/shared`.
3. **CRUD проєктів** (create/list/edit/delete) — оживити «Проекти» з прототипу на реальних даних.
4. **generate-scene** (Guided) — перша жива AI-дія; решта AI спершу як симуляція з `// TODO`.
5. Далі по одному: scene-intent → adapt-shots → draw-shot → lora → auto.
6. Reconstruction (рушій уже є в прототипі — `wt-impact.jsx`) поверх реального canon.

## 6. Що НЕ робимо (свідомо)
- Білінг/оплата — лише вибір плану в UI, без платіжного провайдера.
- Міграція юзерів — починаємо з чистої бази.
- Legacy memory-as-source — canon від початку єдине джерело.

## Критерій готовності бекенду
Зареєструвався → створив проєкт → canon у Firestore → згенерував сцену (читає canon) →
нове від AI впало в чергу підтвердження → підтвердив → memory ре-деривувалась. Без legacy.
