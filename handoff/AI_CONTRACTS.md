# AI CONTRACTS — генерація наративу (canon-aware) для Claude Code

> Базується на ІСНУЮЧІЙ системі генерації (AIEngine: режими Write / Analyze /
> Improve / Adapt / Architect, Gemini REST, NarrativeMemory, filtered context,
> memorySuggestions) і покращує її під нові можливості WhiteWrite.
> Беремо ПОВЕРХ — наявні режими не ламаємо, додаємо canon-контекст і нові виклики.

## Наскрізний інваріант
Будь-яка генерація отримує **canon-контекст** через `deriveMemory(canon)` (готова
функція). Усе, що модель «вигадала» нового про світ → повертається як
**memorySuggestions = inferred canon (confirmed:false)**, НЕ як факт. Факт — лише
після підтвердження користувачем. Це вже закладено у фазах 1-4.

---

## 1. Генерація сцени — GUIDED (дефолт, по одній сцені)
Розширення наявного `Write`-режиму. Викликається на «✦ Наступна сцена» після Scene Intent.

**Вхід:**
```
{ mode:"WRITE_SCENE",
  memory: deriveMemory(canon),          // canon-контекст (персонажі/локації/події/закони)
  architecture,                          // акти/глави (як є)
  prevScene,                             // текст попередньої сцени (для зв'язності)
  intent: { direction, note },           // Scene Intent (нижче §3)
  controls: { length, dialogue, genres } // довжина(слів), щільність діалогу 0..100, жанри
}
```
**System (доповнення до наявного Write):**
- «Пиши ОДНУ наступну сцену. Спирайся ВИКЛЮЧНО на наданий canon — не вигадуй фактів, що йому суперечать.»
- «Дотримуй напрям intent.direction. Щільність діалогу ≈ dialogue% (0 = майже сама розповідь, 100 = сцена тримається на репліках).»
- «Жоден мертвий/відсутній персонаж не діє. Поважай закони світу.»
**Вихід (structured):**
```
{ sceneText, dialogueLines:[{speaker,line,emotion}], memorySuggestions:[InferredCanon] }
```
`dialogueLines` виділяються одразу (для Режисера й хронометражу). `memorySuggestions` → чергу підтвердження.

## 2. Генерація — AUTO (весь обсяг одразу)
Той самий контракт, але ітеративно по аутлайну Architect: для кожної сцени викликати §1
з `prevScene` = попередня згенерована, `intent` = авто (із аутлайну акту). Між сценами
**canon НЕ ре-деривується з непідтверджених** — лише з наявного підтвердженого + Explicit.
Після прогону всі memorySuggestions збираються в одну чергу.

## 3. Scene Intent — напрям наступної сцени
Не окремий AI-виклик; це **параметр** до §1. Значення:
```
direction ∈ { conflict, character, action, romance, worldbuilding, twist, surprise, custom }
note?: string   // для custom або уточнення
```
`twist` (Поворот): system отримує «свідомо підірви очікування, спираючись на canon
(приховані звʼязки, setup→payoff), а не випадково». `surprise`: модель сама обирає напрям.

## 4. Continuity / Impact на справжніх даних
Перед показом згенерованого — прогнати через наявні consistency-checks + `wAffected`
(готовий рушій). Якщо нова сцена згадує сутність у стані dead/removed → continuity-warning
(не блок). Усе виведене нове → inferred.

## 5. Adapt → Режисер (розкадровка + діалоги)
Розширення наявного `Adapt` (SCREENPLAY/VIDEO_CARDS).
**Вхід:** `{ mode:"ADAPT_SHOTS", sceneText, dialogueLines, memory }`
**Вихід:** `[{ type, camera, angle, subject, light, moods, prompt, dialogue:[{speaker,line,emotion}] }]`
- Кадр успадковує репліки сцени; тривалість кадру = сума оцінок озвучки реплік.
- `prompt` — для image-gen (нижче §6).

## 6. Малювання кадру (image-gen) — нове
**Вхід:** `{ mode:"DRAW_SHOT", prompt, refs:[LoRA/reference ids], aspect:"16:9", variants:3..5 }`
**Вихід:** `[{ url }]` варіанти; користувач обирає 1. Якщо персонаж кадру має навчену LoRA —
підмішати її для сталого образу.

## 7. LoRA / візуальний канон — нове
- **Генерація референсів:** `{ mode:"GEN_REFS", entity, count:8 }` → масив зображень → у
  **чергу підтвердження** (як inferred), стають набором лише після «Підтвердити».
- **Тренування:** `{ mode:"TRAIN_LORA", entity, refs:[≥3] }` → `loraId`. Пороги: <3 не можна,
  3-14 чернетковий, ≥15 якісний (UI вже це показує).

## 8. Промоція з тексту (EDIT → CANON)
Уже описано в `EDIT_TO_CANON.md` (§extractFromEdit). Це окремий легкий виклик на абзац.

---

## Що змінюється в наявному коді (мінімально)
- `AIEngine`: додати режими `WRITE_SCENE`, `ADAPT_SHOTS`, `DRAW_SHOT`, `GEN_REFS`, `TRAIN_LORA`,
  `EXTRACT_CANON`, `EXTRACT_FROM_EDIT`. Наявні Write/Analyze/Improve/Adapt/Architect — не чіпати.
- Кожен новий режим бере `memory = deriveMemory(canon)` у контекст (одна зміна точки збірки контексту).
- Провайдер: за планом підписки — Gemini (Зерно/Storyweaver) / Claude (Worldforge). Свап усередині
  `callModel(provider, …)` — решта контрактів однакова.

## Порядок увімкнення (щоб UI не чекав)
1. UI-кнопки спершу як у прототипі (симуляція + `// TODO real AI`).
2. Підключати по одному: `WRITE_SCENE` (Guided) → Scene Intent → `ADAPT_SHOTS` → `DRAW_SHOT` →
   `GEN_REFS`/`TRAIN_LORA` → AUTO.
3. Кожен — за фіче-флагом, з фолбеком на симуляцію.

> Інваріант (повтор): генерація читає canon; нове від AI = inferred → підтвердження → canon → deriveMemory. Ніколи навпаки.
