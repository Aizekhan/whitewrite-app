# EDIT → CANON — спека інлайн-редагування (Narrative → Canon bridge)

> Handoff для Claude Code. Це **зворотний** напрям до `deriveMemory`: коли юзер
> редагує ТЕКСТ, система має дзеркально оновити КАНОН — але тільки з його згоди.
> Референс-реалізація прототипу: `book-edit.jsx` (SceneEditor).

## Інваріант (не порушувати)
**Текст ніколи не стає тихо новим джерелом правди.** Правка тексту = *пропозиція
змінити канон*, не автоматична зміна. Канон лишається source of truth; memory
лишається View. Юзер свідомо вирішує: правка **локальна** (лише формулювання сцени)
чи **канонічна** (промоція в канон → reconstruction).

## Конвеєр
```
Правка тексту сцени
   ↓  extractFromEdit(text, sceneId)        // зворотна екстракція (≈ EXTRACT_CANON на абзаці)
{ newEntities[], conflicts[] }
   ↓
newEntities  → INFERRED canon (confirmed:false) → черга підтвердження (CanonConfirmationQueue)
conflicts    → continuity-warning з impact-оцінкою (wImpact)
   ↓  юзер: Підтвердити / Відхилити / «це нова правда»
Підтверджено → canon оновлено (через useCanonManagement.addXToCanon)
   ↓
deriveMemory(canon)  +  (за потреби) reconstruction залежних сцен
```

## API, який треба додати (поряд із наявним useCanonManagement)
```ts
// Зворотна екстракція: те саме, що EXTRACT_CANON, але на одному відредагованому абзаці.
// Усе виведене = inferred (confirmed:false). Реюз Gemini-пайплайну.
function extractFromEdit(text: string, sceneId: CanonId): {
  newEntities: InferredCanon[];   // нові згадки, яких нема в каноні
  conflicts: { id: CanonId; kind: "dead-speaks"|"renamed"|"removed"; impact: Affected }[];
}

// Промоція inferred → explicit (юзер натиснув «Додати у світ»). Уже є аналог:
//   useCanonManagement.addCharacterToCanon / addLocationToCanon / addEventToCanon
// Треба лише викликати їх з вибраним type (Персонаж/Локація/Подія) і прив'язати sceneId.
function promoteToCanon(entity: InferredCanon, type: CanonType, sceneId: CanonId): void
```

## Поведінкові правила (з прототипу)
1. **Тригер** — на blur/debounce абзацу (не на кожну літеру).
2. **Класифікація токена**: відоме explicit → нічого; невідоме (capitalized, не стоп-слово) → `newEntity`; відоме з `dead/removed` станом → `conflict`.
3. **Тип сутності обирає юзер** (Персонаж / Локація / Подія) перед підтвердженням — НЕ лише персонажі.
4. **Continuity-конфлікт** показує impact («торкнеться 2 сцен, 1 арки») через наявний `wImpact`, і дає 3 шляхи: *оновити канон* (→ reconstruction) · *відкотити правку* · *лишити локально*.
5. **Людська мова** в проміптах (не «канон»/«арка», а «додати у твій світ», «AI памʼятатиме»). Онбординг — одноразова коуч-підказка (localStorage-флаг).

## Де живе в коді
- Хук: розширити `useCanonManagement` методом `extractFromEdit` + промоція з sceneId.
- AI-режим: новий `EXTRACT_FROM_EDIT` (мінімальний варіант `EXTRACT_CANON` на абзаці) у `AIEngine.ts`.
- UI: редагований абзац сцени (contentEditable / editor) + reuse `CanonConfirmationQueue.tsx` для пропозицій, inline-варіант для one-off.
- Прив'язка: підтверджена сутність отримує лінк на `sceneId` (для майбутнього impact-графа).

---

## Відповіді на 4 питання Claude Code
1. **Reconstruction vs full write redirect** → спершу **full write redirect** (усі записи memory → useCanonManagement). Без нього canon неповний, і reconstruction працюватиме по дірявих даних. Phase 5 (recon) — після.
2. **UI черги підтвердження** → так, є готова візуальна спека: `spec/Canon Confirmation Queue.html` (естетика, стани, контракт). Бери звідти вигляд для `CanonConfirmationQueue.tsx`.
3. **storyMap** → деривувати зі **scene-level canon links** (scene.characters/locations/events), не 1:1 з усіх сутностей — так граф відображає реальні зв'язки наративу, а не повний словник.
4. **Міграція прод-проєктів** → за фіче-флагом, по одному: прогнати `EXTRACT_CANON` → усе inferred → юзер підтверджує в черзі → коли `validateMigration` каже SAFE (deriveMemory == oldMemory), вмикати `canonAware`. Не масово, не авто-confirm.

> Інваріант редагування: правка тексту → пропозиція (inferred) → підтвердження → canon → deriveMemory/reconstruction. Ніколи навпаки.
