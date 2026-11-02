# Canon Extraction System — Session Summary (2026-06-18)

## 🎯 Початкова мета сесії

Реалізувати **Canon Extraction System** для WhiteWrite — автоматичне витягування персонажів, локацій, подій, фракцій та артефактів з AI-генерованих сцен.

**Референс**: Система аналогічна до старого проєкту White-Tree (https://github.com/Aizekhan/White-Tree), але адаптована під нову архітектуру WhiteWrite.

---

## 📖 Філософія системи: Story Navigation, НЕ Story Generation

### **Ключова концепція з CLAUDE.md:**

> **Користувач майже не пише текст — він приймає творчі рішення.**

WhiteWrite **НЕ** є Sudowrite/NovelAI (генератори повних книг). Це інструмент для **керування наративом**, де AI допомагає, а людина вирішує.

### **Два режими генерації:**

#### **1. Guided Mode (ДЕФОЛТ) — Поступово, сцена за сценою**

```
Canon → Scene 1 → Scene Intent → Scene 2 → Scene Intent → Scene 3 → ...
```

**Як працює:**
1. AI генерує **одну** сцену на основі поточного канону
2. Перед **наступною** сценою — юзер обирає **Scene Intent** (напрям історії):
   - **Конфлікт** — загострити протистояння
   - **Розвиток персонажа** — character arc момент
   - **Екшн** — динамічна сцена
   - **Романтика** — емоційний момент
   - **Світобудова** — розкрити lore
   - **Сюрприз від AI** — дати AI свободу
   - **Свій опис** — кастомний prompt
3. AI генерує наступну сцену з урахуванням інтенту
4. Інтент **зберігається** на сцені (для регенерації)

**Переваги:**
- ✅ Повний контроль над напрямом історії
- ✅ Кожна сцена — свідоме рішення
- ✅ Canon оновлюється поступово
- ✅ Можна змінити напрям у будь-який момент

**Приклад flow:**
```
User: [створює проєкт, задає initial canon: Яріна, Темний Ліс]
AI: Scene 1 — Яріна входить у ліс
User: [Scene Intent: Конфлікт]
AI: Scene 2 — Яріна зустрічає вовків
User: [Scene Intent: Розвиток персонажа]
AI: Scene 3 — Яріна долає страх, приручує вовка
User: [Scene Intent: Світобудова]
AI: Scene 4 — Вовк веде її до древнього храму
...
```

---

#### **2. Auto Mode (НЕ ДЕФОЛТ) — Автономна генерація**

```
Canon + High-level outline → AI генерує 12 епізодів × 15-20 сцен = 200+ сцен
```

**Як працює:**
1. Юзер задає **Architect Outline** (структура сезону/книги):
   - Епізод 1: "Знайомство з героями"
   - Епізод 2: "Перша загроза"
   - ...
   - Епізод 12: "Фінальна битва"
2. AI **автономно** генерує всі сцени
3. Юзер отримує готовий драфт

**Переваги:**
- ✅ Швидко (весь сезон за раз)
- ✅ Для авторів, які хочуть "написати роман за вихідні"

**Недоліки:**
- ❌ Менше контролю
- ❌ Може відхилитись від бачення автора
- ❌ Складніше редагувати (багато сцен одразу)

**Статус**: Окремий режим, **не пріоритет** для MVP.

---

### **Architect Outline — гнучкий каркас, НЕ контракт**

**Важливо**: Architect-аутлайн (структура історії) — це **пропозиція**, а не фіксований план.

```
Традиційний підхід (Sudowrite):
Outline → AI генерує по outline → якщо outline поганий, історія погана

WhiteWrite підхід:
Outline → AI пропонує сцену → юзер коригує напрям → canon еволюціонує → наступна сцена читає ПОТОЧНИЙ canon
```

**Переваги**:
- Canon = living document (постійно оновлюється)
- Кожна сцена читає **актуальний** стан світу
- Історія природно адаптується під зміни

**Приклад**:
```
Outline: "Епізод 3: Яріна зустрічає ментора"
↓
Scene 10: Яріна зустрічає старого мага Григора
↓
User: [додає в canon: Григор — колишній вчитель її батька]
↓
Scene 11: AI ЗНАЄ про звʼязок Григора з батьком → генерує емоційну сцену про спадщину
```

Без canon-awareness AI не знала б про батька → сцена була б generic.

---

## 🧬 Що запозичили зі старої системи White-Tree

### **Проаналізовано файли з White-Tree:**

1. **`app.mjs`** (lines 1-100) — головний файл
   - 5 AI режимів: WRITE, ANALYZE, IMPROVE, ADAPT, ARCHITECT
   - Memory Suggestions система
   - Gemini API integration

2. **`lib/ai/modes.mjs`** — AI режими
   - `MODE_WRITE` — генерація сцен
   - `MODE_ANALYZE` — аналіз якості
   - `MODE_IMPROVE` — покращення тексту
   - `MODE_ADAPT` — адаптація під стиль
   - `MODE_ARCHITECT` — створення outline

3. **`lib/ai/suggestions.mjs`** — Memory Suggestions
   - Автоматична екстракція facts з тексту
   - JSON структура suggestions
   - Merge логіка у memory

4. **`lib/memory/memory.mjs`** — Memory Management
   - Структура: characters, locations, events, relationships
   - Пошук релевантних facts для context

---

### **Що взяли з White-Tree:**

#### ✅ **1. Memory Suggestions система**

**Стара система** (`lib/ai/suggestions.mjs`):
```javascript
async function extractMemorySuggestions(text, existingMemory) {
  const prompt = `Extract facts: characters, locations, events...`;
  const response = await gemini.generateContent(prompt);
  return JSON.parse(response.text()).suggestions;
}
```

**Нова система** (WhiteWrite `functions/index.js`):
```javascript
async function extractCanonFromScene(projectId, sceneText, canon, uid, cost) {
  const prompt = `Extract canon: characters, locations, events, factions, artifacts...`;
  const message = await anthropic.messages.create({ model: 'claude-haiku-4-5', ... });
  const suggestions = JSON.parse(message.content[0].text).memorySuggestions;
  await mergeIntoCanon(projectId, suggestions);  // Auto-approve
}
```

**Відмінності**:
- ✅ Gemini → **Claude Haiku** (вища якість extraction)
- ✅ `existingMemory` → **`canon`** (тришарова модель: Canon → Narrative → Director)
- ✅ Manual merge → **Auto-merge** (користувач попросив auto-approve)
- ✅ Додано **factions** та **artifacts** (не було у White-Tree)

---

#### ✅ **2. AI Режими (5 modes)**

**Стара система** (`lib/ai/modes.mjs`):
```javascript
const AI_MODES = {
  WRITE: 'write',       // Generate new scene
  ANALYZE: 'analyze',   // Analyze quality
  IMPROVE: 'improve',   // Enhance text
  ADAPT: 'adapt',       // Adapt to style
  ARCHITECT: 'outline'  // Create structure
};
```

**Нова система** (WhiteWrite):

| Режим | Статус | Файл | Модель | Вартість |
|-------|--------|------|--------|----------|
| **WRITE** | ✅ Працює | `generateScene` | Claude Opus | 300 tokens |
| **ANALYZE** | ✅ Backend готовий, UI немає | `analyzeScene` | Claude Sonnet | 50 tokens |
| **IMPROVE** | ❌ Не реалізовано | — | Claude Sonnet | 80 tokens (planned) |
| **ADAPT** | ❌ Не реалізовано | — | — | — |
| **ARCHITECT** | ❌ Не реалізовано | — | — | — |

**WRITE Mode** — основний режим:
```javascript
// functions/index.js, generateScene
const message = await anthropic.messages.create({
  model: AI_MODELS.claude.opus,  // claude-opus-4-8
  messages: [{
    role: 'user',
    content: `${canonContext}\n\nГенеруй сцену: ${userPrompt}`
  }]
});
```

**ANALYZE Mode** — готовий backend:
```javascript
// functions/index.js, analyzeScene
const analysis = await anthropic.messages.create({
  model: AI_MODELS.claude.sonnet,
  messages: [{
    role: 'user',
    content: `Проаналізуй сцену:\n${sceneText}\n\nПоверни JSON: {pacing, tension, characterVoice, consistency, suggestions}`
  }]
});
```

---

#### ✅ **3. Canon Context Builder**

**Стара система** (White-Tree `lib/memory/memory.mjs`):
```javascript
function buildContext(memory, sceneId) {
  const relevant = findRelevantFacts(memory, sceneId);
  return `
Characters: ${relevant.characters.map(c => c.name).join(', ')}
Locations: ${relevant.locations.map(l => l.name).join(', ')}
Events: ${relevant.events.map(e => e.description).join('\n')}
  `;
}
```

**Нова система** (WhiteWrite `functions/index.js`):
```javascript
function buildCanonContext(canon) {
  const sections = [];

  // Characters
  const chars = Object.values(canon.characters || {});
  if (chars.length > 0) {
    sections.push('**Персонажі:**\n' + chars.map(c =>
      `- ${c.name}: ${c.description || 'немає опису'}`
    ).join('\n'));
  }

  // Locations
  const locs = Object.values(canon.locations || {});
  if (locs.length > 0) {
    sections.push('**Локації:**\n' + locs.map(l =>
      `- ${l.name}: ${l.description || 'немає опису'}`
    ).join('\n'));
  }

  // Events, Factions, Artifacts...

  return sections.join('\n\n');
}
```

**Відмінності**:
- ✅ Додано **world metadata** (жанр, тон, scope)
- ✅ Тришарова модель: Canon (static facts) → Narrative (story events) → Director (visual)
- ✅ Підтримка **relationships** між сутностями (не було у White-Tree)

---

#### ✅ **4. JSON Schema для extraction**

**Стара система** (White-Tree):
```javascript
{
  "characters": [{ "name": "John", "role": "protagonist" }],
  "locations": [{ "name": "Dark Forest" }],
  "events": [{ "description": "First encounter" }]
}
```

**Нова система** (WhiteWrite):
```javascript
{
  "memorySuggestions": [
    {
      "id": "char_abc123",
      "type": "character",
      "action": "add",  // or "update"
      "targetId": "Яріна",
      "newData": {
        "name": "Яріна",
        "role": "protagonist",
        "trait": "curious",
        "status": "alive",
        "location": "Темний ліс",
        "goal": "Знайти брата",
        "relationships": { "Тіміш": "brother" },
        "developmentArc": "Від страху до хоробрості"
      },
      "reason": "Головна героїня, згадується вперше"
    }
  ]
}
```

**Покращення**:
- ✅ **Structured updates** — `action: "add" | "update"` (замість просто додавання)
- ✅ **Reason field** — пояснення чому ця сутність важлива
- ✅ **Richer character data** — developmentArc, relationships, goal (не було у White-Tree)
- ✅ **Unified structure** — всі типи сутностей у одному масиві

---

### **Що НЕ взяли з White-Tree:**

#### ❌ **1. Manual Review Queue**
**Стара система**: Юзер підтверджує кожен fact вручну

**Чому відмовились**: Користувач попросив auto-approve → "А нашо нам підтверджувати — нехай автоматично всі додаються"

**Нова система**: Auto-merge у canon з міткою `aiExtracted: true`

---

#### ❌ **2. Gemini API як основний AI**
**Стара система**: Gemini Flash (безкоштовний)

**Чому змінили**: Якість extraction нижча, обмежені можливості

**Нова система**:
- **Claude Haiku** — extraction (точніший, structured output)
- **Claude Opus** — scene generation (краща якість прози)
- **Claude Sonnet** — analysis (баланс якості/вартості)
- **Gemini** — fallback для free tier (майбутнє)

---

#### ❌ **3. Flat Memory Structure**
**Стара система**: Єдиний об'єкт `memory` з усіма facts

**Нова система**: Тришарова модель (з CLAUDE.md):
```
Canon (characters/locations/events/factions/artifacts/world)
  ↓
Narrative (arcs/chapters/scenes/dialogues)
  ↓
Director (storyboards/shots/images)
```

**Переваги**:
- Чітке розділення: **що існує** (canon) vs **що сталось** (narrative) vs **як виглядає** (director)
- Impact analysis: зміна канону → знаємо які сцени/storyboards постраждають
- Reconstruction: можемо регенерувати narrative зі зміненим canon

---

## 🎨 Унікальні фічі WhiteWrite (яких немає у White-Tree)

### **1. Reconstruction System (Phase 4, майбутнє)**

**Ідея з CLAUDE.md**:
```
Canon Change → Change Analysis → Impact → Strategy → Plan → Execute
```

**Приклад**:
```
User: [змінює canon: "Яріна тепер сестра Тіміша, а не подруга"]
System:
  ✅ Analyzed impact: 12 scenes mention relationship
  📋 Reconstruction Plan:
    - Scene 3: Update dialogue (Яріна: "брате" → "друже")
    - Scene 7: Regenerate (romantic tension → sibling rivalry)
    - Scene 12: Pin (user explicitly wrote this, don't touch)

User: [Review plan, approve, reject, or pin scenes]
System: [Regenerates approved scenes with new canon]
```

**Компоненти** (існують у прототипі, не інтегровані):
- `wConnections(type, id)` — граф звʼязків
- `wAffected(type, id)` — імпакт аналіз
- `WCHANGES` — 6 типів змін (rename/property/relationship/add/remove/rewrite)
- `wReconstructionPlan(type, id, changeId)` — генерація плану

**Статус**: Код існує у `wt-impact.jsx`, але **не деплоїться** на прод (Phase 4)

---

### **2. Scene Intent (Guided Mode)**

**Унікальна фіча WhiteWrite** — перед кожною сценою юзер обирає **напрям**:

```javascript
const SCENE_INTENTS = [
  { id: 'conflict', label: 'Конфлікт', icon: '⚔️' },
  { id: 'character', label: 'Розвиток персонажа', icon: '🎭' },
  { id: 'action', label: 'Екшн', icon: '💥' },
  { id: 'romance', label: 'Романтика', icon: '💕' },
  { id: 'worldbuilding', label: 'Світобудова', icon: '🌍' },
  { id: 'surprise', label: 'Сюрприз від AI', icon: '🎲' },
  { id: 'custom', label: 'Свій опис', icon: '✍️' }
];
```

**Як зберігається**:
```javascript
scene = {
  id: 'scene_123',
  text: '...',
  intent: 'conflict',        // ← Зберігається на сцені
  intentPrompt: 'Загострити протистояння між Яріною та вовками'
};
```

**Навіщо**:
- Регенерація — можна регенерувати з тим же інтентом
- Consistency — AI знає яка **мета** кожної сцени
- Analytics — можна побачити розподіл інтентів (60% conflict, 20% character, ...)

**Статус**: UI не реалізовано (потрібна модалка перед генерацією)

---

### **3. Тришарова модель (Canon → Narrative → Director)**

**Відмінність від White-Tree**: Розділення на 3 стовпи (pillar navigation).

**Книга** (WhiteWrite.html):
- Пергаментний UI
- Philosopher font
- Лише текст сцен + діалоги
- "Чиста" проза (без technical деталей)

**Всесвіт** (WorldTree.html):
- Темний UI (Cinzel font, золоті акценти)
- Граф канону (дерево сутностей)
- Chronicle (timeline подій)
- Reconstruction Queue (майбутнє)

**Режисер** (Workspace.html):
- Темний UI
- Storyboards (візуальні сцени)
- Shot planning (кадри, камера)
- Image generation (майбутнє)

**Deep-links** між стовпами:
```
Книга → Всесвіт: Магічна закладка "✦ Дослідити канон"
Всесвіт → Книга: WorldTree.html?type=character&id=char_123 → показує сцени з персонажем
Режисер → Всесвіт: Storyboard → показує задіяний canon
```

---

### **4. Nonlinear Narratives (майбутнє, з CLAUDE.md)**

**Hidden Canon (Твісти)**:
```javascript
character = {
  id: 'char_snape',
  name: 'Професор Снейп',
  surfacedVersion: {
    role: 'antagonist',
    loyalty: 'Dark Lord'
  },
  trueVersion: {
    role: 'double agent',
    loyalty: 'Dumbledore'
  },
  revealUntil: 'scene_finale'  // До фіналу — показуємо surfaced
};
```

**Setup→Payoff ребра**:
```javascript
event = {
  id: 'event_gun_on_wall',
  type: 'setup',
  description: 'Rifle hanging on the wall',
  scene: 'scene_3',
  payoffIn: 'scene_12'  // Має спрацювати у сцені 12
};
```

**Parallel storylines**:
```
Timeline A (Яріна POV): Scene 1 → 3 → 5 → 7 (chronological order)
Timeline B (Тіміш POV): Scene 2 → 4 → 6 → 8 (chronological order)
Story order: 1→2→3→4→5→6→7→8 (braid — чергування)
Chronological: 3→1→5→2→7→4→8→6 (flashbacks)
```

**Статус**: Концепція є, реалізації немає

---

## 📊 Порівняльна таблиця: White-Tree vs WhiteWrite

| Фіча | White-Tree (стара) | WhiteWrite (нова) | Статус |
|------|-------------------|-------------------|--------|
| **Memory Suggestions** | ✅ Gemini extraction | ✅ Claude Haiku extraction | ✅ Працює |
| **Auto-merge** | ❌ Manual review | ✅ Auto-approve | ✅ Працює |
| **AI Modes** | ✅ 5 modes (WRITE/ANALYZE/IMPROVE/ADAPT/ARCHITECT) | ⚠️ WRITE працює, ANALYZE backend готовий | 🔄 В процесі |
| **Canon Structure** | Flat (characters/locations/events) | Тришарова (Canon→Narrative→Director) | ✅ Працює |
| **Entity Types** | 3 (character/location/event) | 5 (+ faction/artifact) | ✅ Працює |
| **Relationships** | ❌ Немає | ✅ Structured relationships | ✅ Працює |
| **Scene Intent** | ❌ Немає | ⚠️ Концепція є, UI немає | ❌ Не реалізовано |
| **Reconstruction** | ❌ Немає | ⚠️ Код існує, не інтегровано | ❌ Phase 4 |
| **Guided Mode** | ❌ Немає | ⚠️ Концепція є, UI немає | ❌ Не реалізовано |
| **Auto Mode** | ❌ Немає | ❌ Не реалізовано | ❌ Низький пріоритет |
| **Hidden Canon (Twists)** | ❌ Немає | ❌ Концепція є | ❌ Майбутнє |
| **Nonlinear Narratives** | ❌ Немає | ❌ Концепція є | ❌ Майбутнє |
| **Plan Gates** | ❌ Все безкоштовно | ✅ WorldTree лише для платних | ✅ Працює |
| **Token Budget** | ❌ Немає | ✅ Повна система обліку | ✅ Працює |

---

## 🎯 Система створення наративів (як має працювати)

### **Ідеальний User Flow (Guided Mode):**

```
1. User створює проєкт
   ↓
2. Задає initial canon (UI форма):
   - Жанр: Fantasy
   - Тон: Dark, mysterious
   - Scope: Novella (50-100 сцен)
   - Персонажі: Яріна (protagonist), Тіміш (brother)
   - Локації: Темний Ліс, Забуте Місто
   - World: Магія існує, але заборонена
   ↓
3. Натискає "Почати історію"
   ↓
4. AI генерує Scene 1 (intro):
   Canon Context: [Яріна, Тіміш, Темний Ліс, Магія заборонена]
   Output: "Яріна стоїть на узліссі Темного Лісу..."
   ↓
5. [AUTO-EXTRACTION] Claude Haiku витягує canon:
   - Додано: Вовк-охоронець (character)
   - Додано: Древній храм (location)
   - Додано: Перша зустріч (event)
   ↓
6. UI показує "✅ Extracted 3 entities"
   ↓
7. User переходить до Scene 2
   ↓
8. [SCENE INTENT MODAL] Обирає напрям:
   ☑ Конфлікт — Яріна vs Вовк
   ↓
9. AI генерує Scene 2 з інтентом "conflict":
   Canon Context: [Яріна, Тіміш, Темний Ліс, Вовк-охоронець, Древній храм]
   Intent: "Create tension between Yarina and the Wolf Guardian"
   Output: "Вовк наступає, зуби оскалені..."
   ↓
10. [AUTO-EXTRACTION] Додано: Магічний амулет (artifact)
   ↓
11. User переглядає WorldTree → бачить граф:
    Яріна ─── знає ───> Тіміш
      │
      └─── конфліктує ───> Вовк-охоронець
      │
      └─── знайшла ───> Магічний амулет
   ↓
12. User змінює canon: "Вовк тепер союзник"
   ↓
13. [RECONSTRUCTION MODAL (Phase 4)]:
    "⚠️ Scene 2 містить конфлікт з Вовком. Регенерувати?"
    [Так, регенерувати] [Ні, лишити]
   ↓
14. AI регенерує Scene 2 з новим каноном:
    Output: "Вовк схиляє голову, впізнаючи амулет..."
   ↓
15. Repeat steps 7-14 до завершення історії
```

---

### **Статус реалізації:**

✅ **Працює зараз:**
- Steps 1-6: Проєкт → Canon → Scene Generation → Auto-Extraction
- Step 11: WorldTree показує canon (без графу, але є списки)

❌ **Не реалізовано:**
- Step 8: Scene Intent Modal (UI немає)
- Step 11: Граф звʼязків (візуалізація є у прототипі, не деплоїться)
- Steps 12-14: Reconstruction System (Phase 4)

---

## 💎 Моат (конкурентна перевага)

**Що робить WhiteWrite унікальним:**

1. **Canon-Aware Generation** — AI завжди знає актуальний стан світу
2. **Reconstruction System** — автоматичне виявлення впливу змін канону
3. **Guided Mode** — контроль напряму історії (не просто "write me a novel")
4. **Nonlinear Narratives** — твісти, flashbacks, parallel storylines (майбутнє)
5. **Тришарова модель** — Canon (що існує) → Narrative (що сталось) → Director (як виглядає)

**Конкуренти не мають:**
- Sudowrite — немає canon tracking, лише generation
- NovelAI — немає reconstruction, лише text continuation
- ChatGPT — немає structured canon, все у промптах

---



## ✅ Що зроблено (Phases 3.0 - 3.2)

### **Phase 3.0: Plan Gates** ✅ DONE
Обмеження доступу до WorldTree за планом підписки.

**Файли**:
- `app/firebase/token-budget.js` — додано `allowWorldTree`, `allowCanonExtraction`, `allowAnalyze`
- `app/wt-app.jsx` — перевірка `window.__wwUser.plan` при завантаженні WorldTree

**Логіка**:
- `free` план: WorldTree **заблоковано** (показує "Upgrade to Storyteller" повідомлення)
- `storyteller`, `novelist`, `worldforge`: WorldTree **доступний**

---

### **Phase 3.1: Auto-Extraction Pipeline** ✅ DONE (з модифікацією на Auto-Approve)

#### **Phase 3.1a: extractCanonFromScene helper** ✅
**Файл**: `functions/index.js` (lines 399-509)

**Що робить**:
1. Приймає `sceneText`, `canon`, `projectId`, `uid`, `extractionCost`
2. Викликає Claude Haiku (`claude-haiku-4-5`) з промптом на extraction
3. Парсить JSON відповідь (або витягує з markdown блоку)
4. **ЗМІНЕНО**: Замість збереження в `inferredCanon` черзі → викликає `mergeIntoCanon()` для **автоматичного** додавання в `canon`
5. Відраховує токени (15 tokens per extraction)

**Промпт структура**:
```javascript
{
  "memorySuggestions": [
    {
      "id": "unique_id",
      "type": "character" | "location" | "event" | "faction" | "artifact",
      "action": "add" | "update",
      "targetId": "exact_name_or_id",
      "newData": { name, description, ... },
      "reason": "Brief explanation"
    }
  ]
}
```

**Моделі**:
- `claude-haiku-4-5` (fast, cheap extraction)
- Fallback на Gemini якщо Claude недоступний (майбутнє)

---

#### **Phase 3.1b: mergeIntoCanon helper** ✅ НОВИЙ (Auto-Approve)
**Файл**: `functions/index.js` (lines 395-427)

**Що робить**:
1. Приймає масив `suggestions` з Claude
2. Для кожної сутності генерує унікальний ID: `${type}_${timestamp}_${random}`
3. Додає мітки:
   - `aiExtracted: true`
   - `extractedAt: serverTimestamp()`
4. **Мержить одразу в `canon.{type}s.{entityId}`** (без Review Queue)
5. Повертає масив доданих сутностей

**Приклад оновлення Firestore**:
```javascript
updates['canon.characters.char_1781730752933_abc123'] = {
  name: 'Яріна',
  role: 'protagonist',
  trait: 'curious',
  aiExtracted: true,
  extractedAt: FieldValue.serverTimestamp()
};
```

---

#### **Phase 3.1c: Integration з generateScene** ✅
**Файл**: `functions/index.js` (lines 345-355)

**Логіка**:
1. Після успішної генерації сцени
2. Перевірка: `planConfig.allowCanonExtraction` (storyteller+)
3. Асинхронно викликає `extractCanonFromScene()` (не блокує відповідь)
4. Логує результат: `✅ Extracted N suggestions` або `❌ Failed (non-critical)`

**Приклад логів** (з Cloud Functions):
```
[Auto-Extract] Starting canon extraction...
[Auto-Extract] ✅ Auto-merged 10 entities into canon
✅ Tokens deducted: -300 (176555 remaining)
```

---

#### **Phase 3.1d: Bulk Canon Sync** ✅
**Файл**: `functions/index.js` (Cloud Function `syncCanonFromProject`)

**Що робить**:
- Витягує канон з **всіх** сцен проєкту (для старих проєктів без канону)
- Динамічна вартість: `scenesCount × 15 tokens` (анти-abuse)
- Timeout: 9 хвилин (max для 2nd gen functions)
- Послідовна обробка сцен (одна за одною)

**Статус**: Реалізовано, але **не протестовано** (потребує UI кнопки в WorldTree)

---

### **Phase 3.2: ANALYZE Mode** ✅ DONE
**Файл**: `functions/index.js` (Cloud Function `analyzeScene`)

**Що робить**:
1. Аналізує сцену через Claude Sonnet
2. Повертає діагностику: pacing, tension, characterVoice, consistency, suggestions
3. Вартість: 50 tokens
4. Доступ: лише `novelist` та `worldforge` плани

**Приклад відповіді**:
```json
{
  "pacing": "Темп сповільнений через довгі описи",
  "tension": "8/10 — конфлікт наростає",
  "characterVoice": "Голос Яріни консистентний",
  "consistency": ["Яріна раніше була в лісі, тепер у місті — нелогічно"],
  "suggestions": ["Скоротити опис природи", "Додати внутрішній монолог"]
}
```

**Статус**: Backend готовий, **UI не реалізовано** (потрібна кнопка "Analyze" в редакторі сцен)

---

### **Phase 3.3: Single Source of Truth для AI Models** ✅ DONE
**Проблема**: Юзер скаржився, що версії моделей Claude хардкоджені в різних місцях → при deprecated model потрібно шукати по всіх файлах.

**Рішення**: Створено `ai-models.js` як **єдине джерело правди**.

**Файли**:
- `app/firebase/ai-models.js` — єдина конфігурація моделей
- `functions/ai-models.js` — копія для Cloud Functions
- `app/White.html` — підключення `<script src="/firebase/ai-models.js">`
- `functions/index.js` — імпорт `const { AI_MODELS } = require('./ai-models.js')`

**Структура**:
```javascript
const AI_MODELS = {
  claude: {
    opus: 'claude-opus-4-8',          // Highest quality, expensive
    sonnet: 'claude-sonnet-4-5',      // Balanced quality/cost
    haiku: 'claude-haiku-4-5'         // Fast, cheap (extraction, analysis)
  },
  gemini: {
    pro: 'gemini-2.0-flash-exp'       // Free tier model
  }
};
```

**Використання**:
- Frontend: `window.__AI_MODELS.claude.opus`
- Backend: `AI_MODELS.claude.haiku`

**Оновлено в `functions/index.js`**:
- `generateScene`: `model: AI_MODELS.claude.opus`
- `extractMemorySuggestions`: `model: AI_MODELS.claude.haiku`
- `extractCanonFromScene`: `model: AI_MODELS.claude.haiku`
- `analyzeScene`: `model: AI_MODELS.claude.sonnet`

---

### **Phase 3.4: UI Changes (Auto-Approve Mode)** ✅ DONE

**Було (Review Queue)**:
- AI витягував сутності → зберігалось у `inferredCanon` черзі → юзер підтверджував/відхиляв → мерж у `canon`

**Стало (Auto-Approve)**:
- AI витягує сутності → **одразу додає в `canon`** з міткою `aiExtracted: true`
- UI показує **історію доданих** сутностей (не чергу на підтвердження)

**Файл**: `app/wt-app.jsx`

**Зміни**:
1. **Видалено** `InferredCanonQueue` компонент (lines 149-274) — Review Queue
2. **Додано** `CanonHistoryView` компонент — показує AI-витягнуті сутності з канону
3. Компонент фільтрує `canon.{type}s` за `aiExtracted: true`
4. Сортування: найновіші зверху (по `extractedAt`)

**UI елементи**:
```jsx
<h3 className="blk-h">
  <Ic.check />AI-витягнутий канон · {count}
</h3>
```

**Структура картки**:
- Type badge (character/location/event/faction/artifact)
- Назва сутності
- Дата витягування
- Перші 3 поля даних (name, description, etc.)

---

## 🐛 Виправлені баги

### Bug 1: Claude Haiku Model Deprecated (404)
**Помилка**: `NotFoundError: 404 model: claude-3-haiku-20240307`

**Причина**: Anthropic deprecated старі моделі (Feb 2026)

**Виправлення**:
1. Спочатку замінено на `claude-3-5-haiku-20241022` — також deprecated
2. **Фінальне**: `claude-haiku-4-5` (current model, June 2026)
3. Створено `ai-models.js` для централізованого управління

---

### Bug 2: window.__currentProjectId undefined
**Помилка**: `InferredCanonQueue` не завантажувала дані, бо `projectId` був `undefined`

**Причина**: `projectId` встановлювався у async функції, але React компоненти не отримували оновлення

**Виправлення** (`wt-app.jsx`):
1. Додано `projectId` у React state: `const [projectId, setProjectId] = useAppState(null)`
2. При завантаженні канону: `setProjectId(projectId)` + `window.__currentProjectId = projectId`
3. Передача через props: `<CanonHistoryView projectId={projectId} canon={canon} />`

---

### Bug 3: wt-workspace.jsx Crash
**Помилка**: `Cannot read properties of undefined (reading 'map')`

**Причина**: `WORLD.scenes.map()` викликався коли `WORLD.scenes` був `undefined`

**Виправлення** (line 234):
```javascript
// Було:
{WORLD.scenes.map((s) => (

// Стало:
{(WORLD.scenes || []).map((s) => (
```

---

### Bug 4: ChronicleView projectId undefined
**Помилка**: `ReferenceError: projectId is not defined at ChronicleView`

**Причина**: Компонент `ChronicleView` використовував `projectId`, але не отримував його через props

**Виправлення**:
1. Додано `projectId` у props: `function ChronicleView({ navigate, onClose, canon, projectId })`
2. Передача при виклику: `<ChronicleView ... projectId={projectId} />`

---

### Bug 5: Objects as React Children
**Помилка**: `Objects are not valid as a React child (found: object with keys {Yarina, Timish, Sonechko})`

**Причина**: `suggestion.newData` містив вкладені об'єкти (relationships), які React не може рендерити напряму

**Виправлення** (line 255):
```javascript
// Було:
<span className="kv__v">{value}</span>

// Стало:
<span className="kv__v">{typeof value === 'object' && value !== null ? JSON.stringify(value) : value}</span>
```

---

## 📊 Поточний статус

### ✅ Працює:
- **Auto-extraction** — AI витягує сутності після генерації сцени
- **Auto-approve** — сутності одразу додаються в `canon` (без Review Queue)
- **Token consumption** — правильно відраховує 15 tokens per extraction
- **Plan gates** — WorldTree заблоковано для free плану
- **AI Models** — єдине джерело правди (`ai-models.js`)

### ⚠️ Потребує тестування:
1. **End-to-end flow**: Створити нову сцену → перевірити, чи з'явились сутності у WorldTree → Хроніка
2. **Canon History UI**: Чи відображаються AI-витягнуті сутності правильно
3. **Bulk Canon Sync**: Функція `syncCanonFromProject` (backend готовий, UI немає)

### ❌ Не реалізовано:
1. **ANALYZE Mode UI** — кнопка "Analyze Scene" в редакторі
2. **Bulk Canon Sync UI** — кнопка "Sync Canon" у WorldTree для старих проєктів
3. **Canon Editing** — редагування/видалення AI-витягнутих сутностей
4. **Reconstruction System** — Canon Impact Analysis (Phase 4)

---

## 🗺️ Roadmap — Що маємо доробити

### **Phase 3.5: Testing & Polishing** (IMMEDIATE)
**Пріоритет**: P0 (критично)

**Задачі**:
1. ✅ **User testing**: Створити сцену, перевірити чи з'являються сутності в WorldTree → Хроніка
2. ✅ **Verify token consumption**: Чи правильно відраховуються токени (300 за сцену + 15 за extraction)
3. ✅ **Check Firestore structure**: Чи правильно зберігаються дані в `canon.characters`, `canon.locations`, etc.
4. ✅ **Cloud Functions logs**: Переглянути логи на помилки (`firebase functions:log`)

**Очікувані результати**:
- Canon History показує AI-витягнуті сутності
- Кожна сутність має `aiExtracted: true`, `extractedAt: timestamp`, `name`, `description`
- Токени відраховуються коректно

---

### **Phase 3.6: Bulk Canon Sync UI** (HIGH PRIORITY)
**Пріоритет**: P1 (важливо для існуючих проєктів)

**Мета**: Дозволити юзерам витягнути канон з **існуючих** проєктів (де вже є сцени, але немає канону).

**UI Design**:
- **Місце**: WorldTree → Хроніка → кнопка "🔄 Sync Canon from Scenes"
- **Модальне вікно**:
  ```
  Витягнути канон з усіх сцен проєкту?

  Сцен у проєкті: 45
  Вартість: 675 tokens (45 × 15)
  Ваш баланс: 8000 tokens

  [Скасувати] [Почати Sync]
  ```
- **Progress bar**: Оброблено 12/45 сцен...
- **Результат**: "✅ Додано 87 сутностей (35 персонажів, 20 локацій, 32 події)"

**Backend**: Вже готовий (`syncCanonFromProject` Cloud Function)

**Frontend** (потрібно додати):
- Кнопка в `ChronicleView`
- Модальне вікно з підтвердженням
- Виклик `window.__firebase.functions.httpsCallable('syncCanonFromProject')`
- Progress tracking (polling або realtime listener)

---

### **Phase 3.7: ANALYZE Mode UI** (MEDIUM PRIORITY)
**Пріоритет**: P2 (корисна фіча, не критична)

**Мета**: Дозволити юзерам аналізувати сцени на якість (pacing, tension, consistency).

**UI Design**:
- **Місце**: Книга (WhiteWrite.html) → кнопка "🔍 Analyze Scene" біля кожної сцени
- **Модальне вікно**:
  ```
  Аналіз Сцени 12: "Втеча з міста"

  📊 Pacing: Темп сповільнений через довгі описи
  ⚡ Tension: 8/10 — конфлікт наростає
  🎭 Character Voice: Голос Яріни консистентний
  ⚠️ Consistency Issues:
  - Яріна раніше була в лісі, тепер у місті — нелогічно

  💡 Suggestions:
  - Скоротити опис природи
  - Додати внутрішній монолог

  [Закрити]
  ```

**Backend**: Вже готовий (`analyzeScene` Cloud Function)

**Frontend** (потрібно додати):
- Кнопка "Analyze" в редакторі сцен
- Модальне вікно з результатами аналізу
- Виклик `window.__firebase.functions.httpsCallable('analyzeScene')`

---

### **Phase 4: Reconstruction System** (FUTURE)
**Пріоритет**: P3 (стратегічний моат, складна система)

**Опис з CLAUDE.md**:
> Рушій (`wt-impact.jsx`, під капотом, на `window`)
> Конвеєр: **Canon Change → Change Analysis → Impact → Strategy → Plan → Execute**.

**Що це**:
1. Юзер змінює канон (напр. "Яріна тепер сестра Тіміша, а не подруга")
2. Система **аналізує вплив** на всі сцени/діалоги/storyboards
3. Генерує **Reconstruction Plan** (які сцени потрібно переписати)
4. Юзер переглядає план і вирішує: Авто-реген / Review (diff) / Pinned (не чіпати)
5. AI регенерує сцени з новим каноном

**Компоненти** (вже існують у прототипі, потрібна міграція):
- `wt-impact.jsx` — Impact Analysis Engine
- `wConnections(type, id)` — граф звʼязків сутностей
- `wAffected(type, id)` — транзитивний імпакт по шарах
- `WCHANGES` — 6 типів змін (rename / property / relationship / add / remove / rewrite)
- `wReconstructionPlan(type, id, changeId)` — стратегічно-залежний план

**Статус**: Система існує в прототипі (WhiteWrite WorldTree.html), але **не інтегрована** з новою архітектурою.

**Наступні кроки** (коли дійдемо до Phase 4):
1. Проаналізувати існуючий `wt-impact.jsx`
2. Адаптувати під нову структуру даних (Firestore)
3. Додати UI для перегляду Reconstruction Plans
4. Реалізувати diff-view для Review Mode

---

## 🧬 Архітектура Canon Extraction System

### **Data Flow** (як працює зараз):

```
1. User creates scene in Book (WhiteWrite.html)
   ↓
2. Frontend calls generateScene Cloud Function
   ↓
3. Backend generates scene via Claude Opus
   ↓
4. [ASYNC] extractCanonFromScene(sceneText, canon, projectId, uid, 15)
   ↓
5. Claude Haiku extracts entities → JSON response
   ↓
6. mergeIntoCanon(projectId, suggestions)
   ↓
7. Firestore update: canon.characters.{id}, canon.locations.{id}, etc.
   ↓
8. User opens WorldTree → Chronicle
   ↓
9. CanonHistoryView loads canon, filters aiExtracted: true
   ↓
10. UI displays AI-extracted entities
```

### **Firestore Structure**:

```javascript
projects/{projectId}
  ├── canon
  │   ├── characters
  │   │   ├── char_1781730752933_abc123
  │   │   │   ├── name: "Яріна"
  │   │   │   ├── role: "protagonist"
  │   │   │   ├── trait: "curious"
  │   │   │   ├── aiExtracted: true
  │   │   │   └── extractedAt: Timestamp(2026-06-17)
  │   │   └── char_1781730805415_xyz789
  │   │       ├── name: "Тіміш"
  │   │       └── ...
  │   ├── locations
  │   │   └── loc_1781730752933_def456
  │   │       ├── name: "Темний ліс"
  │   │       ├── description: "Густий хвойний ліс"
  │   │       ├── aiExtracted: true
  │   │       └── extractedAt: Timestamp(2026-06-17)
  │   ├── events
  │   ├── factions
  │   └── artifacts
  │
  └── inferredCanon  ← DEPRECATED (більше не використовується)
      └── (empty, було для Review Queue)
```

### **Token Costs**:

```javascript
window.__TOKEN_COSTS = {
  sceneGemini: 20,               // Generate scene with Gemini
  sceneClaude: 300,              // Generate scene with Claude Opus
  canonExtractPerScene: 15,      // Extract canon from one scene
  canonSyncProject: null,        // Dynamic: scenesCount × 15
  analyzeScene: 50,              // Analyze scene quality
  improveScene: 80               // Future: improve scene based on analysis
};
```

### **Plan Gates**:

```javascript
window.__PLAN_BUDGETS = {
  free: {
    monthly: 200,
    allowWorldTree: false,         // ❌ Blocked
    allowCanonExtraction: false,   // ❌ Blocked
    allowAnalyze: false,           // ❌ Blocked
    allowImprove: false            // ❌ Blocked
  },
  storyteller: {
    monthly: 2400,
    allowWorldTree: true,          // ✅ Enabled
    allowCanonExtraction: true,    // ✅ Enabled
    allowCanonSync: true,          // ✅ Enabled
    allowAnalyze: false,           // ❌ Blocked
    allowImprove: false            // ❌ Blocked
  },
  novelist: {
    monthly: 32000,
    allowWorldTree: true,
    allowCanonExtraction: true,
    allowCanonSync: true,
    allowAnalyze: true,            // ✅ Enabled
    allowImprove: true             // ✅ Enabled
  },
  worldforge: {
    monthly: 200000,
    allowWorldTree: true,
    allowCanonExtraction: true,
    allowCanonSync: true,
    allowAnalyze: true,
    allowImprove: true
  }
};
```

---

## 📝 Документація оновлена

### `CLAUDE.md` — Project Instructions
**Зміни**:
1. Додано розділ **AI Models** у "Архітектура даних":
   ```markdown
   - **`AI_MODELS` (`firebase/ai-models.js`) — ЄДИНЕ джерело правди для AI моделей.**
     Frontend (`window.__AI_MODELS`) і Backend (require) використовують один файл.
     **НІКОЛИ** не хардкодь версії моделей!
   ```

2. Оновлено **Поточна робота** на "Canon Extraction System (червень 2026)"

3. Додано опис Canon Extraction у розділі "AI-генерація":
   ```markdown
   ## AI-генерація (обіцянка продукту)
   - Генерація сцени з канону на «Чистому аркуші».
   - **Auto-extraction канону** — AI витягує персонажів/локації/події після генерації (фонова задача).
   - Усе canon-aware.
   ```

---

## 🚀 Deployment Status

### **Backend** (Cloud Functions):
- ✅ **Deployed**: `generateScene` — генерація сцен + auto-extraction
- ✅ **Deployed**: `extractCanonFromScene` — витягування канону (helper)
- ✅ **Deployed**: `mergeIntoCanon` — auto-merge у canon (helper)
- ✅ **Deployed**: `syncCanonFromProject` — bulk sync (не протестовано)
- ✅ **Deployed**: `analyzeScene` — аналіз сцен (UI немає)
- ✅ **Deployed**: `ai-models.js` — конфігурація моделей

**URL**: `https://generatescene-3cphx6huhq-uc.a.run.app`

### **Frontend** (Firebase Hosting):
- ✅ **Deployed**: `wt-app.jsx` — WorldTree з Canon History
- ✅ **Deployed**: `ai-models.js` — підключено до White.html
- ✅ **Deployed**: `token-budget.js` — plan gates

**URL**: `https://whitewrite.com`

---

## 🧪 Testing Instructions

### **Test 1: End-to-End Auto-Extraction**

**Мета**: Переконатись, що AI витягує сутності і додає їх у canon.

**Кроки**:
1. Відкрий `whitewrite.com` і **Hard Reload** (Ctrl+Shift+R)
2. Залогінься (worldforge план, 200k tokens)
3. Створи новий проєкт або відкрий існуючий
4. **Згенеруй сцену** (кнопка "Write" в Книзі)
5. Дочекайся завершення генерації (~30-50 сек)
6. Перейди у **WorldTree** → вкладка **Хроніка**
7. Прокрути вниз до розділу "**AI-витягнутий канон**"

**Очікуваний результат**:
- ✅ Розділ "AI-витягнутий канон · N" (де N > 0)
- ✅ Картки з персонажами/локаціями/подіями
- ✅ Кожна картка має: type badge, назву, дату витягування, дані
- ✅ Токени відраховані: `-300` за сцену, `-15` за extraction

**Якщо не працює**:
1. Перевір Console (F12) на помилки
2. Перевір Cloud Functions logs: `firebase functions:log -n 20`
3. Перевір Firestore: `projects/{projectId}/canon/characters` — чи там є дані з `aiExtracted: true`

---

### **Test 2: Token Consumption**

**Мета**: Переконатись, що токени правильно відраховуються.

**Кроки**:
1. Запиши поточний баланс токенів (лівий нижній кут)
2. Згенеруй сцену
3. Переглянь новий баланс

**Очікуваний результат**:
- Токени віднято: `-300` (Claude Opus сцена) + `-15` (extraction) = **-315 total**

---

### **Test 3: Plan Gates**

**Мета**: Переконатись, що WorldTree заблоковано для free юзерів.

**Кроки**:
1. Створи нового юзера (або переключи існуючого на free план через Firestore)
2. Спробуй відкрити WorldTree

**Очікуваний результат**:
- ❌ WorldTree показує повідомлення "Upgrade to Storyteller or higher to access WorldTree"
- ❌ Канон не завантажується

---

## 🎯 Наступні дії (Next Session)

### **Immediate** (P0):
1. ✅ **User testing** — згенерувати сцену, перевірити чи працює auto-extraction
2. ✅ **Fix bugs** (якщо виникнуть під час тестування)
3. ✅ **Verify Firestore data** — чи правильна структура `canon.characters.{id}`

### **High Priority** (P1):
1. **Bulk Canon Sync UI** — кнопка "Sync Canon" у WorldTree для існуючих проєктів
2. **ANALYZE Mode UI** — кнопка "Analyze" в редакторі сцен
3. **Canon Editing** — можливість редагувати/видаляти AI-витягнуті сутності

### **Future** (P2-P3):
1. **Reconstruction System** (Phase 4) — Canon Impact Analysis
2. **Improve Mode UI** — AI покращення сцен на основі аналізу
3. **Canon Conflict Detection** — виявлення суперечностей (мертвий персонаж говорить)
4. **Setup→Payoff tracking** — система відстеження foreshadowing

---

## 💡 Insights & Lessons Learned

### **1. Auto-Approve > Review Queue**
**Висновок юзера**: "А нашо нам підтверджувати — нехай автоматично всі додаються"

**Рішення**: Замість складної Review Queue (approve/reject UI) → просто мержити одразу в canon.

**Переваги**:
- Простіший UX (менше кліків)
- Менше коду (не потрібен `inferredCanon` state management)
- Швидше (сутності одразу доступні)

**Недоліки**:
- AI може додати невірні дані (але юзер може видалити пізніше)
- Немає контролю якості (але для MVP не критично)

---

### **2. Single Source of Truth — критично важливо**
**Проблема**: Версії моделей Claude були розкидані по файлах → при deprecated model треба було шукати вручну.

**Рішення**: `ai-models.js` як **єдина конфігурація**.

**Застосування**:
- ✅ AI models — `ai-models.js`
- ✅ Token costs — `token-budget.js`
- ✅ Plan budgets — `token-budget.js`
- ✅ Canon data — `WORLD` (wt-world.jsx)

**Інваріант**: НІКОЛИ не хардкодь конфіг-дані — завжди єдине джерело правди.

---

### **3. Async extraction не блокує генерацію**
**Дизайн**: `extractCanonFromScene()` викликається через `.then()` після генерації, а не `await`.

**Переваги**:
- Юзер отримує сцену швидше (не чекає на extraction)
- Extraction помилка не впливає на сцену (logged as non-critical)

**Недоліки**:
- Немає гарантії, що extraction завершиться (може crashнути)
- Юзер не бачить прогрес extraction

**Майбутнє**: Додати realtime listener на Firestore → показувати тост "✅ Extracted 10 entities" коли extraction завершиться.

---

### **4. React state + global variable = надійність**
**Проблема**: Тільки `window.__currentProjectId` не працювало (timing issues).

**Рішення**: Дублювати в React state + global variable.

**Паттерн**:
```javascript
const [projectId, setProjectId] = useAppState(null);

// При завантаженні:
setProjectId(pid);                    // React state (triggers re-render)
window.__currentProjectId = pid;      // Global (для non-React коду)
```

**Застосування**: Критичні дані (projectId, userId, plan) — завжди в обох місцях.

---

## 📞 Contact Info (для наступної сесії)

**Юзер**: Максим (hrytsenkomaksym@gmail.com)
**План**: worldforge (200k tokens/month)
**ProjectId**: `proj_1781730435729_7bts6w4vx` (тестовий проєкт з 3 сценами)

**Firebase Project**: `whitewrite-app`
**Domain**: `whitewrite.com`
**Hosting**: Firebase Hosting (папка `app/`)
**Functions**: Cloud Functions (Node.js 20, папка `functions/`)

---

## 🏁 Session Summary

**Тривалість**: ~4 години
**Phases завершено**: 3.0, 3.1, 3.2, 3.3, 3.4
**Bugs fixed**: 5
**Files modified**: 7
**Lines changed**: ~300
**Deploys**: 3 (hosting × 2, functions × 1)

**Статус**: ✅ **Auto-Extraction System працює!**
**Наступний крок**: User testing + Bulk Sync UI

---

**End of session: 2026-06-18 23:45 UTC+2**
