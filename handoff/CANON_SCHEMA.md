# Canon Graph Schema — спека для міграції White-Tree у Canon-Aware

> Handoff для Claude Code (виконавець у репо `Aizekhan/White-Tree`).
> Архітектор: цей чат. Інваріанти — у `CLAUDE.md`. **Не заміна, а шар поверх.**
> Узгоджено з реальним `src/types.ts` (а не з доком).

## Інваріант №1 — Memory = View
Canon — єдине джерело правди. `NarrativeMemory` (наявний тип) стає **похідним view**:
```
Canon  ──deriveMemory()──▶  NarrativeMemory (та сама форма)  ──▶  AIEngine (без змін)
```
Форма `NarrativeMemory` НЕ змінюється → `AIEngine.ts`, промпти, filtered-context — не чіпаємо.

## Інваріант №2 — canon як поле `project`, не колекція
Додаємо `canon` у документ `projects/{id}` поруч із `text/memory/architecture/result`. save-queue/versioning/autosave працюють як є.

---

## 1. Canon-сутність (базовий тип)
```ts
// Стабільний непрозорий id ≠ slug ≠ display name.
// Перейменування міняє name/slug — id (а отже граф) НЕ ламається.
export type CanonId = string;            // напр. "char_8f3k2a"
export type CanonType = "characters" | "locations" | "events" | "factions" | "artifacts";

export type Provenance = "explicit" | "inferred";
export interface Origin {
  source: Provenance;                    // explicit = створив юзер; inferred = припустив AI
  confidence?: number;                   // 0..1, лише для inferred
  confirmed: boolean;                    // inferred стає каноном лише після true
  createdBy: "user" | "ai" | "migration";
  updatedAt: number;
}

export interface CanonBase {
  id: CanonId;
  slug: string;                          // "marcus-chen" (для URL/посилань)
  name: string;                          // display: "Король Маркус"
  type: CanonType;
  origin: Origin;
  // Крос-лінки названі за ТИПОМ ЦІЛІ (множина). Реверс деривується.
  characters?: CanonId[];
  locations?: CanonId[];
  events?: CanonId[];
  factions?: CanonId[];
  artifacts?: CanonId[];
}
```

### Сутності (розширюють CanonBase) — поля з реального `Character` збережені
```ts
export interface CanonCharacter extends CanonBase {
  type: "characters";
  role: string;                          // ↔ Character.role
  trait: string;                         // ↔ Character.trait
  goal: string;                          // ↔ Character.goals
  developmentArc: string;                // ↔ Character.developmentArc
  status?: string;                       // опц. (нема в типі, але є в memory-доку)
  // relationships: типізовано, замість рядка Character.relationships
  relations?: { id: CanonId; kind: string; tone?: string }[];
}
export interface CanonLocation extends CanonBase { type: "locations"; atmos?: string[]; desc?: string; }
export interface CanonEvent    extends CanonBase { type: "events"; when?: string; act?: number; desc?: string; }
export interface CanonFaction  extends CanonBase { type: "factions"; motto?: string; align?: string; desc?: string; }
export interface CanonArtifact extends CanonBase { type: "artifacts"; rarity?: string; owner?: CanonId; desc?: string; }
```

## 2. Наративний шар (canon-aware, з підтримкою Story Navigation)
```ts
// Architect-аутлайн лишається, але scene отримує id + intent + лінки на canon.
export interface CanonScene {
  id: CanonId;                           // "scene_..."
  slug: string;
  title: string;
  description: string;
  characterGoals: string[];              // ↔ ArchitectScene.characterGoals
  conflicts: string[];                   // ↔ ArchitectScene.conflicts
  status?: "Planned"|"Drafted"|"Analyzed"|"Improved"|"Adapted"; // як зараз
  // ── Story Navigation ──
  intent?: SceneIntent;                  // обраний користувачем напрям (нижче)
  writtenText?: string;                  // проза (коли згенеровано)
  recon?: "auto" | "review" | "pinned";  // per-item стратегія (заміна True History Lock); дефолт "review" для written
  // ── canon-лінки (для Impact) ──
  characters?: CanonId[]; locations?: CanonId[]; events?: CanonId[]; factions?: CanonId[]; artifacts?: CanonId[];
}
export interface SceneIntent {
  direction: "conflict"|"character"|"action"|"romance"|"worldbuilding"|"surprise"|"custom";
  note?: string;                         // для custom / уточнення
}
// chapters/arcs/dialogues — аналогічно: id + slug + canon-лінки.
```

## 3. `canon` у документі project
```ts
export interface ProjectCanon {
  characters: CanonCharacter[];
  locations:  CanonLocation[];
  events:     CanonEvent[];
  factions:   CanonFaction[];
  artifacts:  CanonArtifact[];
  world?: { facts?: {k:string;v:string}[]; rules?: string[] }; // worldRules → сюди
  // наративний шар може лишатись у architecture, але scenes отримують id+intent+links
}
// Project doc:  { ...існуюче, canon?: ProjectCanon, canonAware?: boolean }
```

---

## 4. Бридж — Memory = View (НАЙВАЖЛИВІШЕ)
```ts
// Canon → наявна форма NarrativeMemory. Лише ПІДТВЕРДЖЕНИЙ канон.
export function deriveMemory(canon: ProjectCanon): NarrativeMemory {
  const conf = <T extends CanonBase>(a:T[]) => a.filter(e => e.origin.source==="explicit" || e.origin.confirmed);
  return {
    characters: conf(canon.characters).map(c => ({
      name: c.name, role: c.role, trait: c.trait,
      goals: c.goal, relationships: (c.relations||[]).map(r=>`${nameOf(canon,r.id)}: ${r.kind}`).join("; "),
      developmentArc: c.developmentArc,
    })),
    locations: conf(canon.locations).map(l => l.name),
    timeline:  conf(canon.events).map(e => e.when ? `${e.when}: ${e.name}` : e.name),
    worldRules: canon.world?.rules ?? [],
    plotEvents: conf(canon.events).map(e => e.name),
  };
}
```
**Правило записів:** усе, що РАНІШЕ писало в `memory` (apply memorySuggestions у `useStoryStore`/`App.tsx`), тепер пише в `canon`, потім `memory = deriveMemory(canon)`. memory ніколи не записується напряму.

**memorySuggestions → canon:**
- `action:"add"` від AI → нова сутність `origin:{source:"inferred", confidence, confirmed:false}` → у чергу підтвердження (НЕ йде в deriveMemory, доки `confirmed`).
- `action:"update"` на explicit-сутність → застосовується; на inferred — лишається inferred.
- Юзер у Memory/Canon UI робить confirm → `confirmed:true` (або одразу explicit).

## 5. Міграція наявних проєктів (бекфіл)
1. **Новий режим `EXTRACT_CANON`** (поруч із ARCHITECT/ANALYZE; reuse Gemini-пайплайн): з `memory + architecture + text` витягти сутності та звʼязки.
2. Детермінований **мінт id**: `char_<rand>`, slug з імені (`slugify(name)`).
3. Усе виведене AI → `origin.source:"inferred"`, `confirmed:false`. **Міграція НЕ створює підтверджених фактів.**
4. Юзер проходить чергу підтвердження → канон наповнюється авторитетним.
5. `canonAware:true` за фіче-флагом; стара генерація працює, поки канон не готовий.

## 6. Бонус: storyMap стає похідним
`result.storyMap` більше не треба генерувати AI щоразу — рендериться з canon-графа (`nodes` = сутності, `links` = крос-лінки). Менше токенів, завжди актуальний.

## 7. Impact / Reconstruction (потім, але вже лягає)
Поверх `canon`: `wAffected(type,id)` транзитивно по scenes→shots/images; `wReconstructionPlan(type,id,changeType)` зі стратегією (rename/property/relationship/add/remove/rewrite). Reconstruction = вибірковий повторний виклик наявних AI-режимів (Write/Improve/Adapt) лише для зачепленого, з per-scene `recon` (auto/review/pinned). Референс-реалізація — `wt-impact.jsx` у прототипі.

---

## Чек-ліст для Claude Code
- [ ] Додати типи `Canon*` у `src/types.ts`.
- [ ] `deriveMemory(canon)` + перенаправити всі записи memory → canon → re-derive.
- [ ] `canon?` + `canonAware?` у документ project (+ firestore.rules, save snapshot).
- [ ] Режим `EXTRACT_CANON` у `AIEngine.ts` (промпт + парсинг у Canon*).
- [ ] Міграційний скрипт (бекфіл, inferred+confirmed:false, мінт id).
- [ ] Черга підтвердження inferred у Memory-панелі.
- [ ] (Пізніше) Impact/Reconstruction поверх canon.

> Інваріанти (НЕ порушувати): Memory=View · canon=поле project · Explicit/Inferred · opaque-id+slug+name · recon замість True-History-lock · Story Navigation (дефолт — по сцені з Scene Intent).
