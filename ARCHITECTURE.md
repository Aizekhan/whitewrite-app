# WhiteWrite Architecture Map

**Version:** 2.9.0 (2026-11-02)
**Status:** Canonical Reference (Single Source of Truth)

---

## 🎯 Purpose

This document is the **canonical architecture map** of WhiteWrite. All code, features, and decisions reference this document as the single source of truth.

**Philosophy:**
- **Canon-Aware Narrative Generation** — AI generates stories that respect world consistency
- **Two spaces** — Book (write) and World Bible (canon — the home of a world, its stories and games). The Universe tree (WorldTree) and the Director (Workspace: a storyboard/LoRA mock-up with no backend) are retired; real image generation, when it comes, belongs in the Bible's dossiers and the book's scenes.
- **Single Canon** — All pillars read from one source (`WORLD`)
- **Reconstruction Engine** — Canon changes cascade through narrative automatically
- **World-first** — a World (canon) is the root; stories (projects) and games hang off it: **one canon → many stories, many games**
- **Game production** — Game Bible + production plan → tasks → Claude Code executes them over **MCP**, the author reviews

> **Rule (CLAUDE.md):** this file is updated with every change to architecture, data model, functions, rules or integrations — big or small.

---

## 📂 File Structure

```
E:\WhiteWrite/
├─ app/                          # Production (deployed to whitewrite.com)
│  ├─ White.html                 # Shell (navigation, auth, account)
│  ├─ WhiteWrite.html            # Book pillar (narrative generation)
│  ├─ WhiteWrite GameBible.html  # World Bible (world-scoped): canon, stories, games — cards, files, plan, tasks
│  ├─ gamebible.js               # Game Bible logic (plain JS, no JSX)
│  ├─ gb-3d.js                   # three.js viewer (GLB/GLTF/FBX/OBJ/STL) for card files
│  │
│  ├─ app.jsx                    # App root (stages: start/form/book)
│  ├─ flow.jsx                   # StoryForm (create project modal)
│  ├─ pages.jsx                  # Book page (scene intent, generation)
│  ├─ book.jsx                   # Book component (measured pagination, reading, ritual)
│  ├─ book-edit.jsx              # SceneSheet — free writing / pasting a scene (autosave)
│  │
│  ├─ firebase/
│  │  ├─ firebase-init.js        # Firebase SDK initialization
│  │  ├─ firebase-auth.js        # Auth + user plan loading
│  │  ├─ firebase-projects.js    # Project CRUD
│  │  ├─ firebase-scenes.js      # Scene CRUD
│  │  ├─ firebase-ai.js          # AI generation (Gemini)
│  │  ├─ firebase-canon.js       # Canon CRUD (worlds/{w}/entities), createWorld/listWorlds/applyGenesis
│  │  ├─ ai-models.js            # AI_MODELS — single source of truth for model ids (front + back)
│  │  └─ token-budget.js         # Token system + plan budgets
│  │
│  ├─ wt-world.jsx, wt-impact.jsx # WORLD + impact engine (no UI; the tree UI was removed)
│  └─ assets/                    # Images, fonts, icons
│
├─ functions/
│  ├─ index.js                   # only assembles functions/src/*
│  ├─ canon-store.js             # loadCanon / mergeSuggestions / ensureWorld (lazy migration)
│  ├─ token-service.js           # token accounting, pricingFor(model) by alias prefix
│  └─ src/
│     ├─ common.js               # shared admin/db, auth helpers
│     ├─ scenes.js               # generateScene (+ buildCanonContext)
│     ├─ canon-extract.js        # canon extraction from scenes
│     ├─ canon-sync.js           # bulk sync / analyze
│     ├─ genesis.js              # genesisWorld — world seeds
│     ├─ gamedev.js              # gamedevPlan: import (.md) / analyze (GDD) / plan (+ scaffold, writes tasks)
│     ├─ mcp.js                  # mcp — MCP server for Claude Code (Task Engine executor API)
│     ├─ users.js, stripe.js, lemon.js, economy-admin.js
│
├─ scripts/build-app.mjs         # app/ → dist/ (precompiled JSX, prod React, ?v=hash cache-busting)
├─ dist/                         # BUILD OUTPUT served by Hosting — never edit or commit
│
├─ handoff/                      # Documentation & session logs
│  ├─ TODO.md
│  ├─ REFACTOR_PLAN.md
│  └─ *_SESSION_*.md
│
└─ public/                       # DEPRECATED (old files, ignore)
```

---

## 🏗 System Architecture

### **Frontend Architecture**

```
whitewrite.com
    ↓
White.html (Shell)
    ├─ Home: «Створи свій світ» / «Обери свій світ» → Worlds → World hub (stories, World Bible)
    ├─ Auth (Firebase Auth)
    ├─ Account view (Profile, Subscription, Tokens, Integrations · MCP / API)
    └─ Pillar iframes:
        ├─ WhiteWrite.html?projectId=X (Book)
        └─ WhiteWrite GameBible.html?worldId=W (World Bible, world-scoped)
    Canon links (book bookmarks «✦ Дослідити канон», old `WhiteWrite WorldTree.html?type=&id=` links) go through
    `wwGo` / `ww-nav` as pillar `canon` → shell `openCanon(query)`: world of `projectId` (or the current world) → `showBible()` →
    `ww-bible-focus {ent}` (the Bible keeps it pending until its canon has loaded). Hosting 301-redirects `/WhiteWrite WorldTree.html` and `/WhiteWrite Workspace.html` → `/`.
```

External executor:
```
Claude Code (author's machine)  ──MCP Streamable HTTP + Bearer wwk_…──▶  functions:mcp  ──▶  Firestore (tasks, executions, …)
```

**Communication:**
- Shell → Iframe: `window.postMessage({ type: "ww-mode", mode: "work" })`
- Iframe → Shell: `window.parent.postMessage(...)`

---

### **Data Flow**

```
User Action
    ↓
Frontend (React; in-browser Babel locally, precompiled in dist/ on prod)
    ↓
Firebase SDK (app/firebase/*.js)
    ↓
Cloud Functions (functions/src/*, gen2, us-central1)
    ↓
External APIs (Claude, Gemini, Firebase)
    ↓
Firestore (database)
    ↓
Frontend (re-render)
```

---

## 🗄 Firestore Schema

### **Collections**

#### **`users/{uid}`**
```javascript
{
  email: "user@example.com",
  plan: "worldforge",           // free | storyteller | novelist | worldbuilder | worldforge
  tokensUsed: 12550,
  tokensMonthly: 180000,
  tokensRemaining: 167450,
  resetDate: Timestamp,
  role: "admin"                 // Optional: admin role
}
```

#### **`projects/{projectId}`**
```javascript
{
  owner: "uid",
  title: "Попіл Орелії",
  desc: "Місто, де згасають зорі...",
  language: "uk",                // uk | en | pl | ru | de | es | fr | ...
  scope: "novella",              // shot | novella | season | endless
  ending: "open",                // open | closed | custom
  genres: ["Містика", "Драма"],
  creation: "guided",            // guided | auto | free (the author writes)
  subjects: ["char_…"],          // canon entities the story is about (World Bible «Історії»)
  reveal: "open",                // open | later | internal — what the reader may see (+ revealNote)
  length: 700,                   // Scene length (words)
  dialogue: 50,                  // Dialogue density (0-100%)
  episodes: 12,                  // For season scope
  endingNote: "...",

  worldId: "w_...",              // the World this story belongs to (canon lives there)
  canon: { ... },                // LEGACY — kept for rollback, no longer read

  memorySuggestions: [ ... ],    // Inferred canon (pending approval)

  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### **`projects/{projectId}/scenes/{sceneId}`**
```javascript
{
  n: 1,                          // Scene number (sequential)
  title: "Тиша над колонією",
  text: "Коли впала остання зоря...",
  intent: "world",               // Scene intent used for generation
  customIntent: "...",           // User-provided intent (if custom)

  canonRefs: {                   // Linked canon entities
    characters: ["char_id1", "char_id2"],
    locations: ["loc_id1"],
    events: [],
    artifacts: [],
    factions: []
  },

  createdAt: Timestamp
}
```

#### **`worlds/{worldId}`** — the canon root
```javascript
{ owner: "uid", name, desc, tone, laws: [...], facts: [...], createdAt, updatedAt }
```
- `worlds/{w}/entities/{id}` — canon entities: `{ kind: "character|location|event|faction|artifact", type, name, slug, desc, ..., mapPos, inferred?, confidence? }`
- **World dossier** (on the entity itself, no game statuses): `dossier: { story, look | outcome }` (two writing tabs per kind — characters Біографія/Зовнішність, locations Історія місця/Вигляд, factions Історія й мета/Символіка, artifacts Походження/Вигляд, events Перебіг/**Наслідки** (`outcome`, events have no look)), `group` (the subsection it was added in), `lifeNotes: [{ id, at, text }]` (characters' «Хронологія життя», ordered by the first number in `at`), `files: [...]` — world-level images/models in Storage `worlds/{w}/files/{entityId}/**`.
- `worlds/{w}/lore/{id}` — culture entries (World Bible «Культура»); `worlds/{w}.timeUnit` — the chronicle's time unit.
- `worlds/{w}.cosmos` — the Космограф sky `{ planet, calendar, stars[], moons[] }`; `worlds/{w}.cosmograph` — paid access (server-only).
- Several projects can share one world (`project.worldId`).

#### **`worlds/{w}/games/{g}`** — Game Bible (one canon → many games)
```javascript
{ title, engine: { profile }, sections: [...custom], createdAt }
```
- `cards/{cardId}` — game cards: `{ section, title, status: idea|work|agreed|ingame, fields: {..., group}, note, files: [{id,name,url,path,size}], canonRef?, planTask? }`.
  Game fields of a canon entity live here (`canonRef`), **not** on the entity.
- `plan/current` — `{ analysis (GDD + questions), plan: { milestones: [{ id, title, gate, tasks: [...] }] }, scaffold, running }`
- `tasks/{taskId}` — **Task Engine**: `{ id, milestone, title, detail, deps, owner, size, cards, accept[], tests[], prompt, order,
  status: todo|in_progress|review|done|rework|blocked, progress, blocker, report: { summary, commit, changes, tests, criteria, check }, history[] }`
- `executions/{id}` — log of every MCP tool call `{ tool, taskId, at, ... }`
- `changeRequests/{id}` — executor asks to change the design `{ what, why, taskId, status: open|accepted|rejected }`
- Files: Firebase Storage `worlds/{w}/games/{g}/files/**` (game) and `worlds/{w}/files/{entityId}/**` (world dossiers); world deletion removes both

#### **`mcpKeys/{sha256(key)}`** — executor keys
```javascript
{ uid, worldId, gameId, label, prefix, createdAt, lastUsedAt, revoked? }
```
The key `wwk_…` is shown once; only its sha256 is stored. Created per game in Game Bible → Production plan; listed/revoked in Account → Integrations.

#### **`economy_operations/{operationId}`** (planned)
```javascript
{
  "generateScene": {
    tokenCost: 100,
    displayName: "Створення сцени",
    category: "generation"
  }
}
```

#### **`usage_logs/{logId}`** (planned)
```javascript
{
  uid: "...",
  projectId: "...",
  operation: "generateScene",
  costs: {
    claude: 0.0230,
    gemini: 0.0000,
    storage: 0.0001,
    firebase: 0.00001
  },
  totalCostUSD: 0.02311,
  userTokens: 100,
  timestamp: Timestamp
}
```

---

## 🔧 Core Systems

### **1. Token Budget System**

**File:** `app/firebase/token-budget.js`

**Plans:**
```javascript
free:         200 tokens/month    (10 Gemini scenes)
storyteller:  2400 tokens/month   (120 Gemini scenes)
novelist:     32000 tokens/month  (400 Gemini OR 80 Claude + images)
worldbuilder: 180000 tokens/month (300 Claude + 500 images)
worldforge:   180000 tokens/month (dev/testing, same as worldbuilder)
```

**Token Costs:**
- `sceneGemini`: 20 tokens
- `sceneClaude`: 100 tokens
- `canonExtractPerScene`: 15 tokens
- `analyzeScene`: 50 tokens
- `improveScene`: 80 tokens

**Flow:**
1. User action → Frontend checks `window.__canAfford(operation)`
2. Frontend calls Cloud Function
3. Cloud Function deducts tokens from Firestore
4. Frontend syncs `window.__wwUser.tokensRemaining`

---

### **2. Canon System**

**Philosophy:** Canon = Single Source of Truth for world consistency

**Data Model:**
```javascript
canon: {
  characters: {
    "char_id": {
      name: "Елена Кор",
      role: "Провідниця зорепаду",
      trait: "Упевненість",
      status: "alive",
      location: "Орелія",
      goal: "Врятувати місто",
      relationships: [
        { type: "знає", target: "char_id2" }
      ]
    }
  },
  locations: { ... },
  events: { ... },
  factions: { ... },
  artifacts: { ... },
  world: {
    name: "Попіл Орелії",
    tone: "Містична постапокаліпсис",
    rules: ["Зорі падають одна за одною"]
  }
}
```

**Storage (since 2026-10-31):** canon lives in `worlds/{w}` + `entities/{id}` (see schema), not in `project.canon`.
Backend: `functions/canon-store.js`; frontend: `app/firebase/firebase-canon.js`.

**Canon Extraction:**
- After scene generation → `extractCanonFromScene()` (Claude Haiku)
- Extracts entities → stores in `memorySuggestions` (inferred canon)
- User reviews → approves → moves to `canon`

---

### **3. AI Generation**

**Models:** only from `app/firebase/ai-models.js` (`AI_MODELS`, shared by front and back) — never hardcode ids.
- Gemini — default for lower plans
- Claude — for plans with `allowClaude`

**Scene Generation Flow:**
1. User selects Scene Intent (conflict, world, character, etc.)
2. Frontend calls `window.__firebaseAI.generateScene(projectId, intent, customIntent, previousScenes)`
3. Cloud Function `generateScene()`:
   - Loads project + canon
   - Builds context (previous 3 scenes + canon)
   - Calls Claude/Gemini API
   - Saves scene to Firestore
   - Triggers canon extraction (async)
   - Deducts tokens
4. Frontend re-renders with new scene

**The book (reading & writing, `app/book.jsx`, `app/book-edit.jsx`):**
- **Pages are measured, not counted:** `paginateScene` lays each scene into the real page boxes using a hidden probe (`makeProbe`: same `.photobook__pages` size, `cqw`, font and `--book-size`), paragraph by paragraph, splitting the last paragraph by words (binary search); a continued paragraph has no indent (`.prose--cont`), the split one justifies its last line (`.prose--split`). Re-run on resize, font/size (`ww-book-typo` event from the «Aa» bookmark → `localStorage ww-book-typo`) and after `document.fonts.ready`. Phones (≤820px) read one parchment sheet per scene. State keeps the raw scenes (`raw`), spreads are derived.
- **Free writing:** the story form has a third mode **«Пишу сам»** (`project.creation: "free"`, title is enough) — no generation; the mage ritual (`StartStoryAnim.mp4`) opens the book with «Книга відкривається…», then the writing sheet. **Sheet** (`SceneSheet`): ✎ (this scene) / ＋ (new scene via `addScene`) — title + plain-text area (typing or pasting; a line = a paragraph), autosave 0.9 s → `updateScene({title,text})`, Ctrl+S, Esc/«Готово» closes and re-opens the book on that scene; an untouched new scene is deleted.
- **«✦ Порадити» (AI advice, paid):** a button in the sheet footer shows the price (`__TOKEN_COSTS.analyzeScene`, server cost from `economy_operations/analyzeScene`); a confirm step first (or a plan note if `allowAnalyze` is off — Novelist and up), then `POST analyzeScene {projectId, sceneText, title, lang}`. The function (`functions/src/canon-sync.js`) reads the world canon via `buildCanonContext` (now in `functions/src/common.js`, shared with `generateScene`) and the story's `reveal` mark, and returns `{summary, improve[{what,why,quote}], canon[{quote,conflict,fact}], unclear[{quote,question}], fixes[{original,suggested,reason}]}`. The advice column sits beside the sheet; «Застосувати» replaces `original` with `suggested` in the text and autosaves. Balance syncs from `tokensConsumed/tokensRemaining`.

**World Bible = the home of a world (the Universe tree retired, 2026-11-02):** what only the tree could do now lives in `app/gamebible.js`:
- **Огляд світу / Закони** are edited in place → `worlds/{w}.{tagline, summary, facts[{k,v}|string], rules[]}`; the draft survives live re-renders until saved or the section is left.
- **Локації → «🗺 Карта»** (`localStorage ww-locview`): SVG map, drag → `entity.mapPos {x,y}` (1000×620); who is where from a character's canon `location` / `locations[0]`; dashed routes from `scene.stateChanges` (aspect `location`) of all world stories, per story.
- **Dossier → «Поява в історіях та іграх»**: + «Стан у часі» (`scene.stateChanges` for this entity, grouped by story) + «Вплив змін»: scenes with `canonRefs[kind] ∋ id` → «✦ Узгодити сцени» dialog: change kind (property/rename/relationship/rewrite) + note → `reconstructScene` per picked scene (pinned scenes skipped; price ≈ `economy_operations/generateScene` per scene), word diff «було → стане», «Прийняти» writes `text` + `reconstruction.{previousText, lastReconstructionAt, lastCause}`.
- **Plans:** the canon part opens for `allowWorldTree` plans (Storyteller and up, as the tree did); games (Біблія гри, plan, MCP) stay `allowGameDev` — otherwise «🔒 Ігри світу» with the upgrade.
- Not ported (legacy, dead): CanonSyncBanner (read the old `project.scenes` array), CanonHistoryView, the scene lens. `wt-impact.jsx` stays as the documented engine but no page loads it now.

**Polygon budget (game card files):** 3D files carry `tris` (triangles, counted by `gb-3d.js polyCount`): from the local file before upload (cards and dossiers), and for older uploads in the background, one at a time (≤100 MB, result or `trisFailed` written back to `games/{g}/cards/{id}.files[]`). Over **100 000** → a small red «!» among the card tags and by the file, with the count.

**Licence & rights of prefabs** (asset files: models, .prefab/.unitypackage/.uasset/.blend/…, archives): `file.license { id, source: file|author, text, by, url }`; ids `own cc0 royalty unity` = 🟢 commercial OK, `ccby ccbysa ccbynd` = 🟡 with conditions, `ccbync editorial personal unknown` = 🔴 not allowed / not established. Detected automatically: a glTF's `asset.copyright` / `asset.extras` / `KHR_xmp_json_ld` (`gb-3d.js modelInfo`), or a licence/readme/credits .txt/.md on the same card (`licenseFound { id, text }`) — at upload from the local file, older files in the background with the polygon count. A card shows its least permissive asset as a coloured chip; by each file the chip is an ⓘ button: what the licence allows, where it was found, the quoted text, and the author's override (licence, attribution, source link) written into the doc's `files[]`. Same in world dossiers (`entities/{id}.files`). The standard «Модель / префаб» / «Модель / іконка» fields are **file** fields (`F(key, uk, en, "file")`); a card that stored its own `defs` earlier takes a missing type from its section, and text already written there stays shown above the files.
- An empty story shows «Порожня книга» (+ the «what next?» spread for AI), never the demo; the demo (`buildScenes`) only without a projectId. `?scene=N` opens scene N. `addScene` no longer writes empty `canonRefs` (it raced with server extraction).

**Context Building:**
```javascript
System: You are a canon-aware narrative AI.
Canon: { characters, locations, events, world }
Previous scenes: [scene1, scene2, scene3]
Intent: "conflict"
User: Generate next scene following canon.
```

---

### **4. World Bible (Game Bible) & Production Plan**

**Files:** `app/WhiteWrite GameBible.html`, `app/gamebible.js`, `app/gb-3d.js`, `functions/src/gamedev.js`
**Access:** plans with `allowGameDev` (worldbuilder, worldforge); reading stays with the owner.

- **Canon ↔ game split:** the world block = Огляд світу (`special: world`), Закони (`special: laws`), dossier sections `w-characters / w-locations / w-factions / w-items` (`dossier: kind`, read entities directly, no statuses), Неузгоджене. Each game has its own Персонажі/Локації/Фракції/Артефакти (ids `characters/locations/factions/items`, `canon: kind`) — the canon seen through the game: status, game fields, its own look/prefab in the game card; the card thumbnail falls back to the world dossier image.
  **A game takes only the canon it picked** (`games/{g}.canonOptIn: true`): an entity is in the game when it has a game card (`canonRef`, not `hidden`). «＋ Додати з канону» opens a picker of entities not in the game yet (multi-select) + «＋ Новий у каноні» (born in the canon and picked at once); «Прибрати з цієї гри» = `hidden: true`, it returns to the picker. Import writes a card for each accepted canon entity. Older games (no flag) are migrated once on open: cards for everything they showed, hidden stays hidden. `gamedevPlan` and MCP `get_design_section` follow the same rule (legacy games without the flag still see the whole canon).
- **Dossier panel** (`#dos`): name, world files, description (canon), life timeline (characters: a gold line with notes hanging above/below), tabs at the bottom: story · Звʼязки (derived both ways like `wConnections`) · look · Поява в історіях та іграх (game cards per game + story scenes via `projects/{p}/scenes where canonRefs.{kind} array-contains id`). `gamedevPlan` feeds dossier story/look/life notes to the AI.
- **Історія і хроніка** (`special: chronicle`, world block): events (`kind: events`) as comets over a time line — `at` (start, a number), `dur` (duration; 0/none = a star), `when` (label), `characters` (participants, round avatars in an arc above the head); lanes stack so comets never overlap; tick step auto (1/2/5×10ⁿ); unit `worlds/{w}.timeUnit`. Undated events wait below the line. The stories of the world (`projects.worldId`) sit on the same page; «Відкрити» posts `ww-open-story` → the shell opens the book. Events open in the dossier panel with start/duration/label/participants.
- **Культура** (`special: culture`, world block): `worlds/{w}/lore/{id}` `{ group: peoples|languages|beliefs|customs, name, desc, fields, files }` — not entity kinds (the Universe tree, extraction and scene generation know exactly five). Groups have their own fields (`LORE[].defs`), entries open in the dossier panel without tabs and can be deleted there (canon entities cannot: that is the tree's job). Exported/restored with the world, deleted with it, and fed to `gamedevPlan` prompts as «Culture of the world».
- **Космологія / Космограф** (`special: cosmology`, world block; `app/cosmograph/` ES modules, three.js via the import map, loaded on demand): a generalised port of MorraSimulator (`D:\MorraSimulator\morra-simulator`) — orbit math (Kepler, inclination, node), lat/lon conventions (lon 0 = map centre, east = right), "light on the map" — for any planet with up to 4 suns + 4 moons. Sky model: every body orbits the planet; orbits are tilted by the axial tilt (seasons); the planet turns so the first sun's solar day lasts exactly `dayHours`, t = 0 is midnight at lon 0. The planet shader sums the suns' light per pixel and darkens eclipses by the true angular sizes of moon and sun as seen from that point. Distances are log-compressed for display only. Presets: «Земля» (NASA Blue Marble map `app/cosmograph/earth-blue-marble.jpg`, public domain; calendar from 1 January 2026) and «Три сонця» (MorraSimulator's starting calibration). Editor: planet (name, radius, tilt, day, map upload → Storage `worlds/{w}/files/cosmos/…`), calendar (month names/days, first year, era), suns/moons. Saved to `worlds/{w}.cosmos` (fed to `gamedevPlan` as a «Sky:» line). Morra-only physics (magic, radiation roles, magosphere) is not ported.
  **Access:** off by default; turned on in project settings via `cosmographAccess` (`functions/src/cosmograph.js`): 2000 tokens per world per 30 days (`worlds/{w}.cosmograph { enabled, paidUntil, paidAt }`, written only by the server — firestore.rules keep the field read-only for clients; turning it off keeps the paid month, turning it back on within it is free; nothing renews by itself). The running sky survives re-renders and stops when the author leaves the section. `window.__COSMOGRAPH__` exposes `config`, `setTime(h)`, `sample(lat, lon)` (light per sun) for checks.
- **Language:** every label is built for one language at load (`LANG` from the shell's `__i18n` / `localStorage ww-lang`); the account switch (`i18n.setLanguage`) dispatches `ww-language-change` into the frame → the Bible reloads in place on the same section (`sessionStorage ww-bible-sec-{w}`), after an open card/dossier is closed. The game-status chips are hidden on canon pages. Shell: `i18n.js` loads before the shell script; on a switch the shell re-renders rail, dock, news, world hub, worlds list, marketplace, KB.
- **Біблія ↔ книга (the Bible is the home of a world):** a canon dossier has a block **«Історії»** — the stories about it (`projects.subjects` contains the entity id; live listener on `projects where owner, worldId`) with their reveal mark, «Відкрити», and **«＋ Історія»**: a dialog (title from the entity, reveal mark, «коли розкриється» for *later*) → `ww-write-story` → the shell opens `WhiteWrite.html?new=1&free=1&worldId&title&about&reveal&revealNote` → the book creates the story at once (`creation: free`, no form), the mage ritual opens it («Книга відкривається…»), then the writing sheet. Opening a story from the Bible (`ww-open-story`) also plays the ritual (`ritual=1`).
  **Reveal marks** (`projects.reveal`): `open` «Відкрита читачеві» · `later` «Розкриється згодом» (+ `revealNote`) · `internal` «Внутрішній канон» (author only). Shown as chips; changeable on the chronicle's story cards (which also show who the story is about).
  **Back:** in a story the shell rail starts with **«Біблія світу»** (`CURRENT_WORLD` from the story's `worldId`) → `showBible()` keeps the frame, so the same dossier is still open; `ww-bible-focus {ent}` opens a given entity. Frames crossfade (`.frame` opacity .5 s).
- **Menu (World Bible):** head «Біблія світу» + world title; world block (canon sections) folds with an arrow (`localStorage ww-bible-fold`); then «Гра:» picker; game sections; «+ Свій розділ»; **«⚙ Налаштування проєкту»** last (special section `settings`).
- **Project settings:** rename world (notifies the shell `ww-worlds-changed`) / game, engine profile, `.md` import, JSON export of world (`whitewrite.world/1`) and game (`whitewrite.game/1`), delete custom sections, game, world.
  Safe deletion = type the exact name. Game delete removes cards (+ Storage files), plan, tasks, executions, changeRequests, its `mcpKeys`, then the game doc. World delete is refused while stories (`projects.worldId`) exist; else games → entities → world doc (last, rules check ownership through it), then the shell reloads and shows the worlds list.
- **Неузгоджене** (inconsistencies): a game tab before the Production plan (`special: issues`) lists `plan/current.contradictions` not yet in `plan/current.resolved` + open questions; the world block has its own tab (`special: canonIssues`) fed by op `canonAudit` → `worlds/{w}.audit.contradictions`, answers in `worlds/{w}.auditAnswers`.
  Contradictions carry `id` (sha1 of the text; older ones fall back to djb2 `t_…` on both sides), `options`, `target {card, field}`. Resolving writes the decision into the target card (game) or appends it to the entity description (canon, explicit). Resolved ones are kept and fed back to the next audit as decisions.
- **AI cost marks:** every paid AI action (analyze/audit, plan, import, canon audit) carries a small ✦ with the approximate price and asks for confirmation first (`costOf` mirrors gamedevPlan's reservation: `economy_operations/generateScene.providers.claude.cost` × 2 analyze/audit, × 4 plan/import).
- **Settings extras:** hide standard sections per game (`games/{g}.hiddenSections`), restore from an export JSON (a game file → new game in this world; a world file → new world; never overwrites).
- **Standard 14 sections:** overview, lore, mechanics, progression, levels, enemies, gear, assets, materials, animation, audio, ui, refs, tech (+ custom) and the Production plan.
- **Subsections (one pattern for every card page, the Культура pattern):** each subheading carries «＋ Додати» (a card / dossier / event / culture entry born in that subsection); the top bar always has «＋ Підрозділ» (styled dialog); an empty subsection can be removed (✕). A card belongs where it was added (`fields.group` / `category` for game cards, `group` on entities and lore entries; a canon pick writes it into the game card) and can be moved: the subsection menu in the card (`#e-sub`) / dossier (`#d-sub`) header (shown with ≥2 subsections and write access, saved at once), or a pointer drag (mouse/pen; touch uses the menu) — onto a card puts it before/after it, onto a subsection block (`.subsec[data-sub]`) appends it there; the page autoscrolls near the edges. A drop rewrites `order` (0…n) for the whole target subsection and the moved card's group in one batch; lists sort by `order`, then by name (cards without `order` go last).
  Order and the author's own subsections: `games/{g}.subsections[sectionId]` (game sections) / `worlds/{w}.subsections[sectionId]` (canon: dossiers, chronicle, culture); absent → the standard ones (`groups` in `GAME[]`, e.g. Mechanics: Рух, Бій, Здібності…, `LORE` for culture). Standard names are matched in both languages and shown in the current one. A page without subsections shows one block «Загальне» («Лінія часу» in the chronicle); cards outside the list fall into «Інше». In the chronicle every subsection is its own time line; «＋ Нова історія» posts `ww-new-story` → the shell opens the new-story form in this world. Standard subheadings are sent to AI (`shelves[].groups`) for import and scaffold.
- Real files (Storage) and a 3D viewer (corner «🧊 3D» on the card). Saving a card closes its panel.
- **Field editing mode** (pencil in the card's top-left; gold = off, red pulsing = on): rename fields (`defs[].label`, key stays), change type, delete (✕), add typed fields.
  Types (`defs[].type`): `text` (default), `table` (stored as a Markdown table in `fields[key]` — AI/MCP read it as text), `image` / `file` (Storage files with `files[].field = key`; card-level files have no `field`).
  Structure changes are written immediately (`saveStructure`), so closing or reloading keeps them; the mode itself always resets to off. A canon card whose layout was edited stores the full list with `defsFull: true` on its game card.
- Embedded in the shell, the section title and its actions sit on the logo strip (`#topline`, filled by a MutationObserver after each render); the shell's `.rail` lets clicks through (`pointer-events:none`, buttons `auto`).
- `gamedevPlan` ops: `import` (.md notes → proposal, chunked + streaming), `analyze` (GDD + questions), `plan` (milestones with gates + tasks with `accept`/`tests`/`cards`/`prompt` + `scaffold` of missing sections/cards).
- Applying the scaffold creates ticked cards with status `work`.
- `plan` also writes the **Task Engine** docs (`writeTasks`): open `todo`/`rework` tasks are replaced, taken/done ones are kept.

### **5. Task Engine + MCP executor (Claude Code)**

**Files:** `functions/src/mcp.js` (server), `app/gamebible.js` (execution UI), `app/White.html` (Account → Integrations)
**Endpoint:** `https://us-central1-whitewrite-app.cloudfunctions.net/mcp` — MCP Streamable HTTP, stateless JSON-RPC (`initialize`, `tools/list`, `tools/call`, `ping`; notifications → 202; GET → 405).
**Auth:** `Authorization: Bearer wwk_…` → sha256 → `mcpKeys` (not revoked) → owner's plan must have `allowGameDev`. The key is scoped to one game.

**Connect:**
```bash
claude mcp add --transport http whitewrite https://us-central1-whitewrite-app.cloudfunctions.net/mcp --header "Authorization: Bearer wwk_..."
```

**Tools:** `get_project_overview`, `list_tasks`, `get_next_task` (resumes in_progress/rework, else claims first ready todo — ready = all deps done),
`get_task_details`, `get_design_section`, `get_card` (`c:id` / `e:id`), `report_task_progress`, `report_blocker`, `submit_task_result` (→ review, server `check`), `submit_change_request`.

**Cycle:**
```
plan → tasks(todo) → Claude Code: get_next_task (in_progress) → report_task_progress → submit_task_result (review)
     → author: Прийняти (done, linked cards → ingame) | Повернути (rework + comment)
     blocked → author answers → todo;   change request → author accepts/rejects
```
Every tool call is logged in `executions` (activity feed in the Game Bible).

---

## 🎨 UI/UX Patterns

### **Gilded Aesthetic**
- Color palette: `#d4af70` (gold), `#0a0705` (dark), `#1a1410` (bg)
- Font: `Philosopher` (book), `Cinzel` (WorldTree headers)
- Animations: Subtle fades, pulses (e.g., generation progress star)

### **Three Pillars Navigation**
```
.pillswitch (fixed top)
  ├─ Книга (book icon)
  └─ Біблія світу (`nav.universe`, tree icon) → the story's World Bible
```

### **Modals & Overlays**
- Account modal (profile, subscription, tokens)
- Generation progress overlay (animated star + "Генерується сцена X/Y")
- Scene Intent modal (10 intent options)

---

## 🔌 External Dependencies

### **Frontend**
- React 18.3.1 (UMD, in-browser)
- React DOM 18.3.1
- Babel Standalone 7.29.0 (in-browser JSX compilation)
- Firebase SDK 9.22.1 (compat mode)

### **Backend**
- Firebase Cloud Functions (Node.js 20)
- Anthropic SDK (`@anthropic-ai/sdk`)
- Google AI SDK (`@google/generative-ai`)

### **APIs**
- Claude API (Sonnet, Haiku)
- Gemini API (2.0 Flash)
- Firebase Auth, Firestore, Hosting, Storage
- MCP (Model Context Protocol) — WhiteWrite is an MCP **server** for Claude Code
- three.js (CDN, import map) — 3D viewer in the Game Bible

---

## 🚀 Deployment

**Production:** https://whitewrite.com (custom domain)
**Firebase Hosting:** https://whitewrite-app.web.app

**Deploy commands:**
```bash
firebase deploy --only hosting    # Deploy frontend
firebase deploy --only functions  # Deploy Cloud Functions
firebase deploy                   # Deploy everything
```

**Build process:**
- `npm run build:app` → `scripts/build-app.mjs`: `app/` → `dist/` (JSX precompiled, prod React, local scripts get `?v=<content hash>`)
- Runs automatically as hosting predeploy; Hosting serves `dist/`
- HTML is served `Cache-Control: no-cache` (embedded pillars pick up new versions); scripts are cache-busted by hash

---

## 🧩 Key Invariants

1. **Canon = Source of Truth** — Memory is derived, not duplicated
2. **Canon lives in the World** — `worlds/{w}/entities/{id}`; projects reference it via `worldId` (legacy `project.canon` not read)
3. **Stable IDs** — `char_id123` (opaque) + `slug` + `name` (rename doesn't break links)
4. **projectId propagation** — `window.__currentProjectId` set globally
5. **Token consumption** — Always server-side (Cloud Functions deduct, frontend syncs)
6. **Inferred canon is not fact** — needs confirmation before it feeds generation or reconstruction
7. **Game fields are not canon** — they live in `games/{g}/cards` with `canonRef`
8. **Models only from `ai-models.js`**

---

## 📊 Performance Considerations

- **Pagination:** Character-based (520/580 chars per page) to prevent overflow
- **Canon extraction:** Async (doesn't block scene generation)
- **Firestore caching:** Client SDK caches reads
- **Iframe communication:** Minimal postMessage usage

---

## 🔒 Security

**Firestore Rules:**
- Users can only read/write their own projects
- Worlds/entities: owner only; `games/**` write requires `allowGameDev` plan (`hasGameDev()`)
- `mcpKeys`: owner reads/deletes; create only for own world + gamedev plan, fixed field set; no client updates
- Billing fields on `users/{uid}` are server-only
- MCP: key hashed (sha256), per-game scope, revocable, plan re-checked on every call; function is public-invoker, auth is in code
- Canon extraction logs: owner-only read
- Admin stats: role-based access

**Authentication:**
- Firebase Auth (Email/Password, Google)
- Server-side token validation in Cloud Functions

---

## 📝 Notes

- **DEPRECATED:** `public/` folder (old files, ignore)
- **Active development:** `app/` folder
- **Documentation:** `handoff/` folder
- **Game dev platform concept v3:** `docs/AI_GAME_DEV_PLATFORM_v3.md` (concept v2 mapped onto this architecture; MCP spec, Task Engine, next phases)
- **Session logs:** Track major changes (e.g., `PAGINATION_SESSION_2026-06-21.md`)

---

**Last updated:** 2026-11-02
**Maintained by:** WhiteWrite Team
