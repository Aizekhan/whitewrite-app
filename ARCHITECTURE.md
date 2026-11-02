# WhiteWrite Architecture Map

**Version:** 2.43 (2026-11-02)
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
│  └─ assets/                    # Images, fonts, icons (logo: LogoG.png in the top bar — it carries the name, no text beside it; LogoG-icon.png = favicon)
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
    ├─ Home: «Створи свій світ» / «Обери свій світ» → Worlds → World hub (stories, World Bible);
    │        hero (flow.jsx, i18n `hero.*`): «Твій світ чекає» — one world's canon → books and games; game card
    │        «Від задуму — до гри» / «🤖 Від чистого ПК до Гри» (posts `ww-agent-guide`) → Knowledge base on the «agent» category
    ├─ Knowledge base (`kb.js` → `window.WW_KB`, rendered by `fillKb` / `openArticle`; «?» fab): categories start · agent ·
    │        book · world · game · framework · account, uk + en; blocks p/h/ul/tip/warn/prompt («prompt» = a ready request
    │        for Claude Code with a «Копіювати» button), plans/prices (rendered from the paid-features registry);
    │        in-text links `<a class="art__link" data-art="id">` open another article; the Bible opens one with
    │        postMessage `{type:'ww-kb-article', id}`. The «agent» category is drawn as a road (`fillKb`: articles with
    │        `step`/`stage`, stage labels `WW_KB.stages`; a dashed line with numbered nodes; the rest under «Довідка»):
    │        overview → stage pc: 1 with/without RPG Framework (what it is) · 2 PC (Git, Unity Hub, Unity CLI, Unity 6, Claude Code) →
    │        stage game (= ⚙ Project settings → «Claude Code»): 3 folder + launch · 4 MCP key · 5 design → plan (.md import) ·
    │        6 first session (new game: START-NEW-GAME / no-framework prompt; existing project: `get_guide setup`) ·
    │        7 development log (CLAUDE.md) → stage daily: 8 task loop · 9 GitHub; reference: agent-env, agent-knowledge.
    │        «framework» adds fw-access (token) and fw-files.
    │        Every service change updates its article in the same commit.
    ├─ Auth (Firebase Auth)
    ├─ Account view (Profile, Subscription, Tokens, Integrations · MCP / API)
    └─ Pillar iframes:
        ├─ WhiteWrite.html?projectId=X (Book; ⤓ export DOCX / PDF — `book-export.js`, in the browser: a STORE-zip
        │   WordprocessingML package, or print of a book-styled frame; `allowExport`, Storyteller+)
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
- Book → Shell: `ww-mode` `work` (inside a story) | `home` (the cover) | `create` (a story / world form — the shell keeps the rail and, for a story form opened with a `worldId`, shows «Біблія світу» back; `storyFormWorld`)
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
External APIs (Claude — the only AI, Firebase)
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
- **Cover** (v2.37): `cover: { url, path, type: image|video }` — set in the shell (✎ on a world card in «Світи» and on the hub's «Біблія світу» card, `openWorldEdit` in `White.html`, also renames and edits `tagline`); file in Storage `worlds/{w}/cover/{ts}_{name}` (storage.rules: the owner, any plan, image ≤ 10 MB or `video/mp4|webm` ≤ 50 MB); the replaced file is deleted; world deletion deletes it. World cards and the hub's Bible card are 16:9 (`aspect-ratio`); `cover.frame` `{x, y, fit cover|contain}` = the author's «⌖ Кадр». No cover → `app/assets/ph-world.jpg` (the default; stories fall back to `assets/ph-project.png`). Videos play `muted autoplay loop playsinline`; CSP `media-src` allows `firebasestorage.googleapis.com`.
- `worlds/{w}/entities/{id}` — canon entities: `{ kind: "character|location|event|faction|artifact", type, name, slug, desc, ..., mapPos, inferred?, confidence? }`
- **World dossier** (on the entity itself, no game statuses): `dossier: { story, look | outcome }` (two writing tabs per kind — characters Біографія/Зовнішність, locations Історія місця/Вигляд, factions Історія й мета/Символіка, artifacts Походження/Вигляд, events Перебіг/**Наслідки** (`outcome`, events have no look)), `group` (the subsection it was added in), `lifeNotes: [{ id, at, text }]` (characters' «Хронологія життя», ordered by the first number in `at`), `files: [...]` — world-level images/models in Storage `worlds/{w}/files/{entityId}/**`.
- `worlds/{w}/lore/{id}` — culture entries (World Bible «Культура»); `worlds/{w}.timeUnit` — the chronicle's time unit.
- `worlds/{w}/games/{g}/quests/{id}` (v2.30, was `worlds/{w}/quests` — no data existed, nothing migrated) — quests `{ title, type, approval draft|review|approved|archived, status (STATUSES), summary, stories[projectId], source { type: card|story|characters|locations|factions|artifacts|events|lore, id, title }, giver, characters[], locations[], factions[], artifacts[], events[canon event ids], objectives, stages[{ id, title, objective, next[{ to, cond }], end, fail }], rewards, prereqs[questId], repeat { mode once|repeatable|daily, cooldown }, hooks, notes }` — the first stage is the start.
- `worlds/{w}/games/{g}/dialogues/{id}` — dialogues `{ title, type, approval, status, participants[], location, questId, stageId, trigger, nodes[{ id, speaker (ref | player | narrator), text, locKey, cond, effects, choices[{ text, to, cond }], next, end }], notes }` — the first node is the start. Refs in both: a game card `c:<cardId>` (role sections `CARD_ROLES` in `functions/narrative-validate.js`: characters/enemies → characters, locations/levels → locations, factions, items/gear → artifacts) or a canon entity id; `refPool(entities, cards)` is the shared list for the UI check, `narrativeDraft` and MCP. Both are client-writable game subcollections (`hasGameDev()` = Worldbuilder; `allowQuests`/`hasQuests()` removed).
- `worlds/{w}.cosmos` — the Космограф sky `{ planet, calendar, stars[], moons[] }`; `worlds/{w}.cosmograph` — paid access (server-only).
- Several projects can share one world (`project.worldId`).

#### **`worlds/{w}/games/{g}`** — Game Bible (one canon → many games)
```javascript
{ title, engine: { profile }, sections: [...custom], createdAt,
  launch?: { dir, model: 'opus'|'sonnet'|'', skip } } // «Запуск Claude Code» in the game's settings → PowerShell lines `cd "dir"` + `claude [--model m] [--dangerously-skip-permissions]`
```
- `cards/{cardId}` — game cards: `{ section, title, status: idea|work|agreed|ingame, fields: {..., group}, note, files: [{id,name,url,path,size}], canonRef?, planTask? }`.
  Game fields of a canon entity live here (`canonRef`), **not** on the entity.
- `plan/current` — `{ analysis (GDD + questions), plan: { milestones: [{ id, title, gate, tasks: [...] }] }, scaffold, running }`
- `tasks/{taskId}` — **Task Engine**: `{ id, milestone, title, detail, deps, owner, size, cards, accept[], tests[], prompt, order,
  status: todo|in_progress|review|done|rework|blocked, progress, blocker, report: { summary, commit, changes, tests, criteria, check }, history[] }`
- `executions/{id}` — log of every MCP tool call `{ tool, taskId, at, ... }`
- `marketing/state` `{ enabled, paidUntil, paidAt, claudeMdConfirmedAt, settings{ tone, language, audience, hashtags, signature } }`; `channels/{id}` `{ platform: telegram|discord|mastodon|bluesky, title, chatId?, username?, instance?, handle?, ok }`; `posts/{id}` `{ platform: telegram|discord|mastodon|bluesky|x|reddit, status: draft|approved|rejected|scheduled|publishing|published|failed, text, title?, poll?{question, options}, sources["session:entry"], channelId?, at?, url?, messageId?, error?, history[] }` — all server-only (v2.29); top-level `marketingSecrets/{w}__{g}__{channelId}` (webhook / token / appPassword) and `marketingQueue/{w}__{g}__{postId}` `{ path, at }` — no client access
- `users/{uid}/ledger/{id}` (v2.42, `functions/src/ledger.js`) — the token ledger: `{ type grant|topup|spend|refund|adjust, op, amount (signed), balance (after), ref {worldId, gameId, projectId, orderId, plan, licenceId, model}, note, at }`. Written only by the server (rules: owner read, no client write): `token-service.js` `charge()` logs the final real cost inside its transaction and `applyDebit` logs the monthly `grant` when a new period opens; fixed prices (Космограф, Маркетинг, project slot, plan-switch fee / prorated grant) via `ledger.record`; Lemon top-ups inside the crediting transaction; `subscription_created` → `grant`. Internal costs stay in `usage_logs`. Account → «Історія токенів» (last 100) with a printable receipt per entry (🧾 → print / PDF; money receipts remain Lemon Squeezy's).
- `users/{uid}/friends/{otherUid}` (v2.43, `functions/src/team.js`) — `{ status pending|incoming|accepted, name, email, at }`, a mirrored pair; server-only (owner reads).
- `worlds/{w}.team.{uid}` + `worlds/{w}.teamUids[]` (v2.43, `team.js` only) — `{ role admin|editor|viewer|custom, view[], edit[], viewKinds[], editKinds[], name, email, at }`; `view`/`edit` are Bible menu ids, `*Kinds` the entity kinds of those canon sections (`KIND_OF`).
- `worlds/{w}.freeze` (v2.43, `market.js` only) — `{ reason 'licence', applicationId, at }`: while set, the world, its entities / lore / games / cards / stories / Storage files are read-only for everybody (rules `worldOpen` / `storyOpen` + server writers, see §5b).
- `worlds/{w}.backup` (v2.43, `backup.js` only) — `{ repo, login, enabled, paidUntil, lastAt, lastStatus, lastError, lastCommit }`; `backupTokens/{w}` `{ token, login }` — no client access.
- `licenceApplications/{id}` (v2.43) — `{ uid, worldId, title, pitch, declaration, priceCents, chars, fee, snapshotPath, snapshotHash, status review|moderation|licensed|rejected|withdrawn, aiReview, legal, aiError, … }`; the applicant reads. `marketLots/{appId}` — the listed lot `{ seller, sellerName, worldId, title, pitch, level, priceCents, report, metrics, contract, snapshotHash, status listed|reserved|sold|unlisted, licensedAt }`; public while listed, the seller reads always. `marketDeals/{id}` — `{ lotId, seller, buyer, amount, fee, contract, status, at, stripe… }`; seller / buyer read. `sellers/{uid}` — the Stripe Connect account `{ accountId, chargesEnabled, payoutsEnabled }`; owner reads. All server-written.
- `games/{g}.subPalettes { [sectionId]: { [group]: "#hex — name\n…" } }` — the main colours of a «Референси» / «Сцени» group (v2.28)
- `env/current` — the Unity environment check from Claude Code (`report_unity_environment`): `{ os, editor, cli, project, checks[{id, ok, detail, exitCode}], ok, reportedAt }` (server-only)
- `knowledge/{snapshotId}` — a Project Knowledge snapshot `{ schema: whitewrite.knowledge/1, scope: full|partial, manifest, status: uploading|imported, counts{added,updated,skipped,relations,rejected,tombstoned}, framework, overview, report, unresolved }`; `kAssets/{guid | p_<sha1(path)>}` — one asset/scene/prefab/script/visual `{ kind, guid, path (project-relative), type, name, description, labels, deps, details, hash, lastSnap, missingSince? }`; `kRelations/{sha1}` — `{ from, to, rel, evidence, confirmed }`; `games/{g}.knowledge { lastSnap, at }` (all server-only)
- `activity/{sessionId}` — development log session `{ branch, commit, summary, verify: commit_found|commit_missing|unverified, receivedAt, entryCount }` + `entries/{entryId}` `{ change, category, text, status, playerImpact, evidence, media, limits, hints, privacy, taskId, at, reviewedAt? }` — written by the MCP server, never overwritten; the owner may change only `privacy`/`reviewedAt`
- `changeRequests/{id}` — executor asks to change the design `{ what, why, taskId, status: open|accepted|rejected }`
- **Card faces** (v2.39): the first image of a card / dossier is its 16:9 face; a file's `frame {x, y, fit}` (⌖ next to every image in the card's and the dossier's file lists, `pickFrame` → the whole `files` array rewritten) sets `object-position` / `object-fit`. The picker is **`app/frame-pick.js`** (`window.wwFrame.pick / style`), shared by the shell and the Bible.
- Files: Firebase Storage `worlds/{w}/games/{g}/files/**` (game), `worlds/{w}/files/{entityId}/**` (world dossiers) and `worlds/{w}/cover/*` (the world card); world deletion removes them all

- `games/{g}.repo` — the game's GitHub repository `{ full, branch, private, connectedAt, syncedAt, sha }` (written by `gamedevPlan` only)

#### **`repoTokens/{worldId}__{gameId}`** — GitHub tokens
```javascript
{ uid, token, updatedAt }   // read-only fine-grained token for a private repo; no client access at all
```
`gamedevPlan` op `repoConnect` checks the repo (+ branch, default = the repo's main one) with GitHub, stores the token here and `repo` on the game; `repoDisconnect` removes both. op `repoSync` (the author's button «Звірити з репо» in the game settings, priced like import, nothing is reserved if GitHub fails): reads the branch head — the files changed since `repo.sha` (compare API), an inventory of asset/code paths (.prefab .unity .asset .fbx .glb .cs .uasset .tscn …, build/cache folders skipped), up to 80 000 chars of .md/.txt (README/GAME/GDD → Docs/ → root → the rest) — and compares it with the Bible (`repoPrompt`). The answer is an import-shaped proposal (`cleanImport`): what the repo has and the Bible lacks (canon / laws / cards) + contradictions «repo: path · bible: card» + questions, shown in the import view; ticked items are written by the client like an import, ticked contradictions go to `plan/current.contradictions` (= «Неузгоджене»). `repo.syncedAt` / `sha` are updated.

#### **`mcpKeys/{sha256(key)}`** — executor keys
```javascript
{ uid, worldId, gameId, label, prefix, createdAt, lastUsedAt, revoked? }
```
The key `wwk_…` is shown once; only its sha256 is stored. Created per game in Game Bible → Production plan; listed/revoked in Account → Integrations.

#### **`community/{pubId}`** + `items/` + `likes/` · `community_home/current` · `community_reports/{pubId}__{uid}` (live, v2.36)
Спільнота — public showcases (`functions/src/community.js`). `pubId` = `worldId` (a world) or `${worldId}__${gameId}` (a game).
Doc: `{ kind world|game, worldId, gameId, owner, author, title, worldTitle, tagline, summary, cover, discord, lookingForTeam, teamNote, facts[{k,v}], rules[], sections[{id,label,n}], likes, score, reports, hidden, promotedUntil?, publishedAt, updatedAt, activeAt }`; `items/{i0000…}` `{ sec, group, title, blocks[{l,t}], imgs[] }` (Storage download URLs only); `likes/{uid}` `{ at }`. **Rules:** anyone (even signed out) reads a doc / its items unless `hidden` (owner and admins still read it; a missing doc reads as «not published»); a user reads only their own like; `community_home` is public; reports — admins; **all writes are server-only**.

#### **`economy_operations/{operationId}`** (live)
Reserves read by the servers: `providers.{claude|gemini}.cost` (the reserve per scene; 300 / 40 by default; `analyzeScene` 200). Since v2.15 `charge()` bills the REAL API cost (see §1), so the margin multipliers, `estimatedCostPer700Words` and `economy_config/global` (`tokenToUSD`, global multiplier) only price a call whose model has no `MODEL_PRICING` entry or that returned no usage. Edited in the admin economy panel (`economy-admin.js`).

#### **`usage_logs/{logId}`** (live)
One row per charge: `uid, projectId, operation (logAs), model, inputTokens/outputTokens/cache…, realApiCostUSD, billing ('actual'|'estimate'), usdPerToken, userTokensCharged, timestamp` (+ the legacy estimate fields).

---

## 🔧 Core Systems

### **1. Paid features registry, plans and tokens**

**Single source of truth:** `functions/paid-features.js` (v2.13). `app/firebase/paid-features.js` is a copy made by `scripts/build-app.mjs` (the same step copies `functions/ai-models.js`, `functions/narrative-validate.js` and `functions/setup-guides.js` → `app/firebase/`, so the two never drift again) — edit only the `functions/` file.
- `PLAN_ORDER` free → storyteller → novelist → worldbuilder; `PLANS {name, price, monthly, maxProjects, popular?}`; `worldforge` is a hidden dev plan `as: 'worldbuilder'`.
- `FEATURES[]`: `{ id, kind: gate|ai|free, flag, alias?, minPlan, price?: {scene}|{factor}|{fixed, per?}, op?, uk/en {name, desc}, where, server, planned? }`. A feature is on from `minPlan` upward; `planBudget(plan)` derives the old `{monthly, maxProjects, allow…}` shape; `featureCost(feature, claudeCost)` = the tokens reserved before a run (`factor` × the economy Claude scene price, or `fixed`); `byOp(op)`.
- `soon: true` features are announced on the plan cards and in the KB but not live: `framework` (`allowFramework`, Storyteller) — a personal RPG Framework access token tied to the account, blocked on foreign use, renewed while the subscription is active (issuing not built yet).
- Flags: `allowExport`, `allowWorldTree` (Bible canon editing), `allowFramework` (soon) — Storyteller; `allowCanonExtraction` / `allowCanonSync` are gone (auto-canon cancelled, v2.15); `allowClaude`, `allowAnalyze`, `allowReconstruction`, `allowImprove` (planned) — Novelist; `allowGameDev`, `allowAPI` (MCP) — Worldbuilder.
- Readers: `functions/plans.js` (`PLAN_BUDGETS` / `getPlanBudget` for every server gate), `gamedevPlan` / `experience` / `cosmographAccess` reserves (`featureCost(byOp(op))`), `token-budget.js` (overwrites `window.__PLAN_BUDGETS` flags/budgets/prices), the Account plan cards (`planCards` in `White.html`: tokens, ≈ scenes, projects, «Усе з X +» and the features new at that plan), the Bible `costOf` / `costMark` (✦ price on the button and in the confirm), and the knowledge base blocks `["plans"]` / `["prices"]` (`kbRegistry` in `White.html`).
- Reserve → charge → refund: the server reserves `featureCost`, `charge()` settles the real usage (the difference is debited — overdraft allowed — or returned), a failed run refunds. `analyzeScene` reserves too (v2.13).
- **Margin (v2.15):** `charge()` = `tokensForUsd(realApiCostUSD)` = ceil(API $ / `USD_PER_TOKEN`), `USD_PER_TOKEN = 0.00015` in the registry. API $ = usage × `MODEL_PRICING` (`ai-models.js`, real list prices: Opus 4.8 $5/$25, Sonnet 4.5 $3/$15, Haiku 4.5 $1/$5, Gemini 2.5 Flash $0.30/$2.50 incl. thinking tokens — Gemini usage is now captured in generateScene). A full budget therefore costs in API: Worldbuilder $27 of $69, Novelist $4.80 of $29, Storyteller $0.36 of $12. Typical (v2.20, Claude 5.5): Haiku scene ≈ 10, Sonnet ≈ 160, Opus ≈ 320, .md import chunk ≈ 570, Opus game plan ≈ 3000. `SCENE_TYPICAL {gemini 30, claude 150}` feeds the plan cards and the KB; reserves `SCENE_COST {gemini 40, claude 300}`, advise 200, game plan ×12. The UI shows prices as «≈ N».

**Subscriptions (Lemon Squeezy, `functions/src/lemon.js`):** `subscription_created` → plan + new period; `subscription_updated` → status / plan, `cancelled` with a future `ends_at` stays `active` with `cancelAtPeriodEnd` + `subscriptionEndsAt`, `expired` → free; `subscription_cancelled` (future `ends_at`) only marks `cancelAtPeriodEnd`; `subscription_expired` → free. Server AI gates require `subscriptionStatus === 'active'` (generateScene, genesisWorld, reconstructScene, analyzeScene, gamedevPlan AI ops, experience AI ops, cosmographAccess). Legacy Stripe `createCheckoutSession` takes uid/email only from the ID token.

**Webhook signatures (v2.19.1):** `lemonSqueezyWebhook` checks `X-Signature` = hex HMAC-SHA256 of `req.rawBody` with `LEMON_SQUEEZY_WEBHOOK_SECRET` (`timingSafeEqual`). Every delivery used to fail with 401 because the secrets in Secret Manager had been saved with a Windows `
` at the end; they were re-added clean, and `common.js` trims every `defineSecret` value on read. **Secrets must be added without a trailing newline** (`--data-file` from a trimmed source).

**Plan change (v2.18, `changeSubscription` in `functions/src/lemon.js`):** body `{op:'quote'|'change'|'cancelPending', plan}`, needs an active LS subscription (else 409 → the client falls back to checkout; PayPal → `{portal}` = LS `customer_portal_update_subscription`). It reads the LS subscription (`renews_at`); `left` = days to renewal / 30. **Up** → LS `PATCH /v1/subscriptions/{id} {variant_id, invoice_immediately:true}` (LS charges the prorated difference now), then `users.plan = target` and `tokensUsed` set so that available = old monthly left + `upgradeQuote().tokens` (budget difference × left) − `fee` (`UPGRADE_FEE` 3% of the new monthly), logged `usage_logs {operation:'plan_upgrade_fee'}`, `lastUpgrade`. **Down** → `PATCH {variant_id, disable_prorations:true}` (the new price at renewal, no credit) + `users.pendingPlan / pendingFrom = renews_at`; **free** → `PATCH {cancelled:true}` + pending. `cancelPending` reverts (variant back / `cancelled:false`). Webhook: `subscription_updated` keeps the plan while `pendingPlan === variant plan && pendingFrom > now`, applies it after; `subscription_payment_success` (renewal) applies a due pending plan. UI: plan cards (`planCard` in White.html) show «З дати» + «Скасувати перехід» on the pending plan; `.plan__btn` quotes then confirms (`plan.upAsk/downAsk/freeAsk`). `__wwUser.pendingPlan/pendingFrom` from `firebase-auth.js`.

**Story creation (v2.17):** Bible dossier «＋ Історія» asks *how*: `mode:'ai'` → the shell opens `WhiteWrite.html?new=1&worldId&title&about&reveal&revealNote` → `StoryForm` prefilled (`initial`, keeps `subjects/reveal/revealNote`); `mode:'self'` adds `free=1` → the sheet. `enterBook` waits up to 10 s for `__wwUser`/`__firebaseProjects` before creating (the race used to skip creation and open the demo «Попіл Орелії»); a failure never falls into the demo. The last «Що далі?» spread (`SceneIntentRight actions`) also offers write on / edit the last scene / save the story (`updateProject` stamp + postMessage `ww-story-saved` → the shell reopens the world's stories). `token-budget.js` takes `__TOKEN_COSTS.sceneGemini/sceneClaude/analyzeScene` from the registry.

**Project limit (v2.16):** stories are created ONLY by the `createProject` Cloud Function (`functions/src/projects.js`; `firestore.rules` → `projects` `allow create: if false`). It counts `projects where owner == uid` against `planBudget(plan).maxProjects + users/{uid}.extraProjects`; over the limit it answers 403 `{code:'PROJECT_LIMIT', limit, count, plan, slotCost, tokensRemaining}`, and with `buySlot: true` reserves the registry price of `projectSlot` (500 tokens, fixed), increments `extraProjects` (a permanent slot, survives plan changes) and logs `usage_logs {operation:'project_slot'}`. The server whitelists and caps the story fields; `worldId` must be the caller's world. Client: `__firebaseProjects.createProject(data, buySlot?)` — confirm «купити слот» (i18n `project.limitAsk`) or open the plans; `OUT_OF_TOKENS` → alert `project.slotNoTokens`; both throw `err.silent` so `app.jsx` shows no second alert.

**Known gaps (audit 2026-11-02):** the Cosmograph sky runs in the browser (`paidUntil` is an honour gate); (Margin fixed in v2.15; plan changes in place since v2.18.)

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

**Canon Extraction — auto-canon CANCELLED (v2.15, owner decision 2026-11-02):**
- `generateScene` no longer calls `extractCanonFromScene()`; `syncCanonFromProject` answers 410. A scene never writes to the canon by itself.
- New names reach the canon only through the Keeper (`book-edit.jsx`: local detection + the author's «так») or the Bible. `canon-extract.js` stays in the code (unused by scenes) for a possible on-demand tool.
- Consequence: `scene.stateChanges` / scene canonRefs are no longer filled automatically for new scenes («Стан у часі» shows what earlier scenes recorded).

---

### **3. AI Generation**

**Models (v2.20): ONLY Claude.** Gemini is gone (code paths, secret binding, UI texts). Default ids per tier in `functions/ai-models.js` (`claude-haiku-5-5` / `claude-sonnet-5-5` / `claude-opus-5-5`, real prices incl. Haiku's >100k-prompt tier `over`), never hardcoded elsewhere.
- **One door — `functions/src/claude.js`:** `modelFor(db, user, plan)` → `{tier, model}` = `users.settings.aiModel` if the plan opens it (`paid-features.js MODEL_TIERS` + `modelTier`: Haiku from Free, Sonnet from Storyteller, Opus from Novelist; default Sonnet, Free → Haiku), the id from `activeModels(db)` = `AI_MODELS.claude` overridden by `config/ai_models.active` (cached 5 min). `claudeText(apiKey, {model, prompt, system, maxTokens, effort, stream})` sends the current-model request shape: no `temperature`, `output_config.effort` (prose `low`, analysis `medium`), `max_tokens` with room for thinking; reads text **by block type** (Claude 5.x replies can start with a `thinking` block); `stop_reason: refusal` → error. Used by generateScene, reconstructScene, genesisWorld, analyzeScene, canon extraction (active Haiku), experience; gamedevPlan keeps its parallel streams with the same shape.
- **Reserves scale with the tier:** `featureCost(feature, claudeCost, tier)` × `MODEL_TIERS.scale` (Haiku 0.1, Sonnet 1, Opus 2) for scene/`factor` features; fixed prices don't scale. Measured 2026-11-02 (700-word scene, effort low): Haiku ≈ 6–10, Sonnet ≈ 160, Opus ≈ 315 tokens → `MODEL_TIERS.typical` 10/160/320 (plan cards, KB, `__TOKEN_COSTS.scene` via `__wwApplyModel`).
- **Account → «Модель Claude»** (White.html `modelHtml/bindModel`): three options, the closed ones show «від {plan}»; writes `users.settings.aiModel` (client-writable `settings`); the server re-checks the plan. The live version label comes from `config/ai_models.snapshot`.
- **Model watch v2.22 — cadence & early warning:** the schedule fires daily 06:00 Kyiv, but `runWatch` does a full check only in `config/ai_models.mode = 'daily'` or when `fullAt` is ≥ 14 days old (`modelWatchRun` = `force`). `mode` becomes `'daily'` while anything is in flight — `held` (waits for the admin), `upcoming` (a newer version of the tier is in the docs — price table or deprecations table — but not in our Models API yet; pre-analysis notice once: price ratio vs the threshold), `deprecated` (the active id is «Deprecated» on `platform.claude.com/docs/en/about-claude/model-deprecations.md`; notice with the retirement date and the recommended replacement; within `RETIRE_SOON` = 14 days of the date a priced newer version is forced in), `broken` — and returns to `'watch'` when all four are empty. The doc is written whole (no merge) so settled keys disappear. Users stay on the current id until a switch.
- **Call-time fallback — `claude.js withFallback(model, fn)`** (used by `claudeText` and gamedevPlan's parallel streams): a 404 / `not_found_error` retries at once on the same tier (the `ai-models.js` default, then the newest in `snapshot`), else one tier DOWN (Opus → Sonnet → Haiku; never up — the reserve would not cover it); the swap is stored in `config/ai_models.broken[deadId] = {to, at}` (`activeModels` maps it, so later calls go straight there), `mode = 'daily'`, a critical admin notice; the charge uses the model that answered. The watch clears a `broken` entry once its tier moved on, or when the model is listed again and answers a test call. The watch's own test calls pass `noFallback`. Notices live in `functions/src/admin-notice.js` (`notify`).
- **Model watch — `functions/src/model-watch.js`:** `modelWatch` (schedule, see cadence above) / `modelWatchRun` (admin HTTP, forces a check). Lists models (Models API) + parses the official price table (`platform.claude.com/docs/en/about-claude/pricing.md`). Per tier: a newer version switches in automatically only if its price is known, a typical call (1.5k in / 2k out) costs ≤ ×1.25 of the current, it keeps context ≥ 200k / output ≥ 48k / `effort` / adaptive thinking, and a real smoke call in our shape returns text; else it is **held** (`config/ai_models.held`, announced once). The active model's own price change updates `config/ai_models.pricing` (read by `token-service.js` `loadLivePricing`, so the real-cost charge follows) and a rise > 10% raises a critical notice. A retired active model forces the switch. Notices: `admin_notices/{id}` {severity info|critical, tier, from, to, title, body, resolved} (rules: admin read / mark `resolved` only) + a Markdown file `admin/notices/<date>-<tier>-<id>.md` in Storage; admins (custom claim `admin`) see them in the Account. Rollback: set `config/ai_models.active.<tier>`.

**Scene Generation Flow:**
1. User selects Scene Intent (conflict, world, character, etc.)
2. Frontend calls `window.__firebaseAI.generateScene(projectId, intent, customIntent, previousScenes)`
3. Cloud Function `generateScene()`:
   - Loads project + canon
   - Builds context (previous 3 scenes + canon)
   - Calls Claude (the author's model, `functions/src/claude.js`)
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

**Licence & rights of prefabs** (asset files: models, .prefab/.unitypackage/.uasset/.blend/…, archives): `file.license { id, source: file|author, text, by, url }`; ids `cc0 royalty unity` = 🟢 full licence, `ccby ccbysa ccbynd revcap` = 🟡 with conditions (credit, same licence, unchanged, up to a revenue threshold), `ccbync editorial personal` = 🔴 strict / not commercial, `own unknown` = 🔵 unknown or the author's own (unchecked) — a card shows the worst by red → blue → yellow → green. Detected automatically: a glTF's `asset.copyright` / `asset.extras` / `KHR_xmp_json_ld` (`gb-3d.js modelInfo`), or a licence/readme/credits .txt/.md on the same card (`licenseFound { id, text }`) — at upload from the local file, older files in the background with the polygon count. A card shows its least permissive asset as a coloured chip; by each file the chip is an ⓘ button: what the licence allows, where it was found, the quoted text, and the author's override (licence, attribution, source link) written into the doc's `files[]`. Same in world dossiers (`entities/{id}.files`). The standard «Модель / префаб» / «Модель / іконка» fields are **file** fields (`F(key, uk, en, "file")`); a card that stored its own `defs` earlier takes a missing type from its section, and text already written there stays shown above the files.
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

- **Game menu (v2.19, navigation only):** `NAV_GROUPS` in `gamebible.js` folds the game shelves into menu items — Огляд і лор [overview, lore, refs] · Персонажі й вороги [characters, factions, enemies] · Світ і рівні [locations, levels, worldgen, scenes] · Механіки · Прогресія й предмети [progression, gear, items] · Арт і аудіо [assets, materials, animation, audio, ui] · Технічне · (author's own sections) · Продакшн-план [plan, issues] · Досвід гравців [experience, telemetry]; ⚙ settings in the menu foot. **Menu tree (v2.21):** a group is `.nav-item.nav-grp[data-group][aria-expanded]` with an arrow — it folds/unfolds (`navOpen`, localStorage `ww-bible-navopen`; the active group unfolds by default), sums the counts, and unfolding a group you are not in opens its last section (`lastSub`); members are `.nav-item.nav-sub` (short names `NAV_SHORT`: plan → «План», experience → «Метрики й проблеми»). **Only one level folds** (v2.22.2): a section's subsections are not listed in the menu — they stay as `.subsec` blocks on its canvas. The former `#subtabs` bar is gone. **Shelf ids and card `section` values are unchanged** (MCP, `experience.js`, the import read them), so there is no data migration; hidden sections drop out of their group, a one-member group renders as a plain item.
- **Production pipeline (v2.23):** `gamedevPlan op=plan` (`planPrompt` + `cleanPlan` in `functions/src/gamedev.js`) writes `plan/current.plan` `{gated:true, dod[], estimateWeeks, cutLine, health[{issue,fix,cards}], milestones[{id, track: mvp|expansion|extra, name, goal, entry, deliverables[], gate, accept[], budgets, estimateDays, tasks[{…, priority must|should|could, assetState greybox|standin|styled|final, estimate, cards[] (plain refs, MCP-compatible), roles {ref: implements|uses-asset|in-level|follows-style|constrained-by}}]}]}`; MVP = gates G0 setup → G1 greybox → G2 first playable → G3 feature-complete → G4 release candidate; expansion X…, extra F… ranked with `cutLine`. Tasks docs carry `track`. **Gates:** the author approves/returns in the plan → `plan/current.gates[msId] = {status: approved|returned, at, by, comment}`; `mcp.js lockedBy` (mirrored by `gamebible.js msLock`) keeps a milestone closed until the previous gate of its track is approved (expansion/extra after the whole MVP) — `get_next_task` then reports the gate it waits for, `list_tasks` shows `locked_by_gate`; plans without `gated` (older ones, EXP fixes) are not gated. **UI** (`planHtml`): DoD box, gate path, Bible readiness (`healthHtml`: 🔴/unknown licences, >100k-poly models, levels without `assetState`, + `plan.health`), tracks (expansion/extra folded, cut line), card chips by role (`cardChip` → `openCard`), tab «Матриця ассетів» (`matrixHtml`: asset-like cards × `card.assetState` select, worst licence, max polygons, plan tasks using them). `cards/{id}.assetState` is the asset state ladder (canon cards: written with `section`+`canonRef`).

- **Canon ↔ game split:** the world block = Огляд світу (`special: world`), Закони (`special: laws`), dossier sections `w-characters / w-locations / w-factions / w-items` (`dossier: kind`, read entities directly, no statuses), Неузгоджене. Each game has its own Персонажі/Локації/Фракції/Артефакти (ids `characters/locations/factions/items`, `canon: kind`) — the canon seen through the game: status, game fields, its own look/prefab in the game card; the card thumbnail falls back to the world dossier image.
  **A game takes only the canon it picked** (`games/{g}.canonOptIn: true`): an entity is in the game when it has a game card (`canonRef`, not `hidden`). «＋ Додати з канону» opens a picker of entities not in the game yet (multi-select) + «＋ Новий у каноні» (born in the canon and picked at once); «Прибрати з цієї гри» = `hidden: true`, it returns to the picker. Import writes a card for each accepted canon entity. Older games (no flag) are migrated once on open: cards for everything they showed, hidden stays hidden. `gamedevPlan` and MCP `get_design_section` follow the same rule (legacy games without the flag still see the whole canon).
- **Dossier panel** (`#dos`): name, world files, description (canon), life timeline (characters: a gold line with notes hanging above/below), tabs at the bottom: story · Звʼязки (derived both ways like `wConnections`) · look · Поява в історіях та іграх (game cards per game + story scenes via `projects/{p}/scenes where canonRefs.{kind} array-contains id`). `gamedevPlan` feeds dossier story/look/life notes to the AI.
- **Історії і хроніка** (`special: chronicle`, world block; en «Stories & chronicle»): events (`kind: events`) as comets over a time line — `at` (start, a number), `dur` (duration; 0/none = a star), `when` (label), `characters` (participants, round avatars in an arc above the head); lanes stack so comets never overlap; tick step auto (1/2/5×10ⁿ); unit `worlds/{w}.timeUnit`. Undated events wait below the line; a comet's head (with a finger-sized hit area) or its name opens the event. ✎ on a subsection of canon entities (chronicle time lines, dossier groups) renames it: `subsections` + every entity's `group` in one go (`renameSubsection`). The stories of the world (`projects.worldId`) sit on the same page, each with tags written from the Bible (the owner may update projects): `projects.scope` `world` (default) | `local`, `projects.games: [gameId]` — the world's games as toggles; «Відкрити» posts `ww-open-story` → the shell opens the book. Events open in the dossier panel with start/duration/label/participants.
- **Маркетинг** (v2.29, `special: marketing`, own menu item `g-mkt`): `renderMarketing` — off: description + «Увімкнути на 30 днів» (`confirmCost("marketing")`, `MK.costText`); on: paid-until + «Вимкнути»; 1) the `activity_log` guide block + «Я вставив блок у CLAUDE.md» (`confirmClaudeMd`); 2) channels list + connect form (Telegram via the platform bot — `status` returns its username; Discord webhook; Mastodon instance+token; Bluesky handle+app password); 3) voice settings; 4) ✦ new post from development-log entries with privacy `marketing_approved` only (`mkApproved` over the loaded sessions), platform, Telegram poll, wish; 5) posts by status with edit / approve / reject / publish now / schedule (datetime-local) / cancel / retry / copy / delete, X and Reddit share links (`twitter.com/intent/tweet`, `reddit.com/submit`). Live listeners on `marketing/state`, `channels`, `posts`; `mkRender` skips re-rendering while a field has focus. Every change goes through `mkCall` → `marketing`.
- **Сцени · палітри · гами референсів** (v2.28): game section `scenes` (under «Світ і рівні» since v2.35.3; groups Ключові сцени / Катсцени / Ігрові моменти / Бої / Екрани й меню; fields what, location, mood, `palette`, `board`, camera, refs images). Two new card field types (`FTYPES`): `palette` — `palEditor` (colour + name rows, «Вставити коди» parses any #hex / coolors link, «🎨 З картинок» = `extractColors`, a coarse histogram of the card's images via canvas) stored as text `#hex — name` per line; `scene` — `sceneEditor`, a 16:9 stage with draggable elements (label, colour from the card palette, width, z-order, background) stored as text `bg: #hex` + `- label @ x% y% · w% · #hex` per element (`parseScene`/`sceneText`); `mountFieldEditors` mounts both after `renderFields`. Card tiles: palette strip (`swatches`) and the mock-up thumbnail (`sceneThumb`) when there is no image; the excerpt skips these fields. **Group palettes** (`PAL_SECS = refs, scenes`): 🎨 at each subheading → `groupPalDialog` → `games/{g}.subPalettes[sectionId][group]` (same text; «З картинок» takes the group's images); shown in the heading and on the group's cards; a new subsection there opens the dialog. MCP: `get_card` adds `group_palette`, `get_design_section` adds `group_palettes`.
- **Візуальний стиль** (v2.40, `gamebible.js`, registry `paid-features.js` → `artStyle`, gate `allowGameDev`): game section `artstyle` — first member of «Арт і аудіо»; groups Загальний стиль / Біоми й локації; fields manifesto, `palette`, `avoid` (palette), light, materials, shapes, budget, rules, `places` (biome locations, one per line), refs images — ordinary cards in `games/{g}/cards`, so MCP reads them as is. `styleFor(card)`: the overall style = first card of «Загальний стиль» (or no group); a biome applies when the card's title, subsection or `location` field equals a `places` line; palette = biome's if set else overall; avoid = union. `styleScore(url, style)` — browser only, no tokens: image → 48 px canvas → Lab ΔE to the nearest style colour (< 20 full, fading to 40), near-black/white skipped, minus 1.5 × the share near an avoid colour (ΔE < 18) → 0…100 (≥ 70 у стилі, 40–69 частково, < 40 вибивається, null — unreadable). `styleMark(url, card)` renders `<span class="smark" data-ss=sig data-lv>` «🖌 NN» (square tag, ring colour; not round like licence chips) on card tiles, file rows and image fields; a `MutationObserver` fills pending marks; scores cached by style signature + url in memory and `localStorage["ww-style-scores"]` (≤ 600). Style cards themselves and world dossiers carry no mark. Since v2.41 the resolver lives in **`functions/style-guide.js`** (SINGLE SOURCE; copy `app/firebase/style-guide.js` by `build-app.mjs`, `window.__STYLE`): `resolveStyle(styleCards, names)` → `{overall, biome}`, `palettes`, `styleName`, `styleSig` (hash of the brief fields + style reference image ids — the AI staleness key), `styleBrief` (text for the prompt / MCP), `cleanVerdict`.
- **AI style check** (v2.41, `functions/src/style.js` → HTTP `styleCheck`, registry `styleCheck` kind ai factor 0.25 ≈ 75 tokens on Sonnet, charge = real cost): POST `{worldId, gameId, cardId, fileId, image (base64 JPEG ≤ 1024 px, made in the browser), refs[≤3] (style reference images ≤ 512 px), names[subsection, location], language}` + ID token → owner/plan/subscription → style cards read server-side → Claude (user's model tier, effort low, vision) → `cards/{cardId}.styleAi[fileId] = {score, verdict fits|partly|off, summary, issues[], fixes[], sig, style, at}` (server write; files[] untouched). `runCheck` is shared with MCP. Bible: a fresh result (`sig` = current `styleSig`) shows «🖌 NN ✦» and `.snote` (issues/fixes) under the file row; a stale one falls back to the colour score with a dashed ring. Triggers: automatic after every image upload to a game card when a style palette exists (`uploadFiles` → `styleCheckAi`), «✦ Перевірити всі» in the `artstyle` section header (all pictures without a fresh score, confirm with count × price; the only button — per the owner). 3D viewer (`gb-3d.js view3d(..., onShot)`): «📷 Знімок для стилю» in an open card saves the current view as `<model>.view.png` on the card → badge + automatic check. MCP (v2.41, `mcp` now has the Claude secret): `get_style_guide {location? | card_ref?}` (overall + biome fields, palette, avoid, reference URLs, biome list, brief), `check_style {image_base64, media_type, location?, what?}` (a Unity screenshot → verdict, not stored, author's tokens); `get_card` / `get_design_section` files carry `style_check`.
- **Знання проєкту · Журнал розробки · Unity-середовище** (v2.27): game sections `knowledge` (menu group «Технічне і знання» with `tech`) and `activity` (group «Продакшн-план»). `renderKnowledge`: latest snapshot (status, counts, coverage, framework, overview/report/unresolved), asset search over `kAssets` loaded on opening (`knList`, details with deps and relations), snapshot history. `renderActivity`: sessions (newest 20) with entries loaded per session, filters by category/privacy, per-entry privacy select (`update` of `privacy`+`reviewedAt`), the CLAUDE.md block (`activity_log` guide) with Copy. Settings → `envHtml`: `env/current` checks + the `unity_env` and `setup` guides (`guideHtml`: the one-line ask + the full agent text, both copyable). Exported with the game (`environment`, `knowledge{snapshots,assets,relations}`, `activity[]+entries`) and deleted with it.
- **Квести · Діалоги** (`special: quests | dialogues`, v2.30 — a game-design decision: game sections in the menu item `g-narr` «Квести й діалоги», after «Сцени»; `canQuest = canGame`, Worldbuilder; listeners on `gref()` in `selectGame`); types are the subsections (`QD.qtypes` / `QD.dtypes`, own ones in `games/{g}.subsections`). Pickers (`pickOf(kind)`): the game's own cards in role sections first (marked «гра», stored as `c:<id>`), then canon entities; «Події канону» (`events[]`) — canon events. A game card in a role section (and a canon card in the game) shows its quests/dialogues and a 💡 under its fields (`renderFields` → `qdLinksHtml`, `bulbHtml("card"|"e")`); 💡 in canon dossiers / culture / stories creates the quest in the open game (hidden without a game or Worldbuilder). Edited on the canvas (`renderQD` → `renderQEditor`; the draft `qed` survives live snapshots while focused); the graph check runs on every keystroke from `functions/narrative-validate.js` (copy `app/firebase/narrative-validate.js` by `build-app.mjs`, `window.__NARRATIVE`): broken links, duplicate ids, unreachable stages/lines, dead ends, loops without exit, no success ending, prerequisite cycles, missing canon refs, speakers outside the participants, a missing quest/stage. Links are stored on the quest/dialogue only; a dossier's «Звʼязки» tab derives its quests and dialogues (`qdLinksHtml`, incl. quests whose `source.id` is the entity). **💡 «Створити квест на основі цього»** (`bulbHtml`/`questFrom`): dossiers, culture entries, Chronicle story cards → a new quest with `source { type: story|characters|locations|factions|artifacts|events|lore, id, title }` and the obvious links prefilled; «Джерело» select for manual choice; story cards list the quests born from them. **✦ AI draft**: `narrativeDraft` (`functions/src/narrative.js`, ID token, `allowQuests` + active subscription, reserve `featureCost(questDraft|dialogueDraft)` → Claude (author's model) → charge real cost) returns a proposal only — `cleanQuest`/`cleanDialogue` keep canon ids that exist, map stage/line numbers to `s1…`/`n1…`, new things go to `ideas` (never canon); the editor shows it above the form (`qprop`), each field Accept/Reject/Accept all; nothing is written until «Зберегти». Exported/restored with the game (`quests`, `dialogues` in `whitewrite.game/1`), deleted with it (`removeGame`). `narrativeDraft` takes `gameId`, checks `allowGameDev`, loads the game cards with the canon (ids list marks «game card» / «canon»), reads a `quest` source from the game and a `card` source from its cards; `cleanQuest` also keeps `events` (canon events only).
- **Культура** (`special: culture`, world block): `worlds/{w}/lore/{id}` `{ group: peoples|languages|beliefs|customs, name, desc, fields, files }` — not entity kinds (the Universe tree, extraction and scene generation know exactly five). Groups have their own fields (`LORE[].defs`), entries open in the dossier panel without tabs and can be deleted there (canon entities cannot: that is the tree's job). Exported/restored with the world, deleted with it, and fed to `gamedevPlan` prompts as «Culture of the world».
- **Космологія / Космограф** (`special: cosmology`, world block; `app/cosmograph/` ES modules, three.js via the import map, loaded on demand): a generalised port of MorraSimulator (`D:\MorraSimulator\morra-simulator`) — orbit math (Kepler, inclination, node), lat/lon conventions (lon 0 = map centre, east = right), "light on the map" — for any planet with up to 4 suns + 4 moons. Sky model: every body orbits the planet; orbits are tilted by the axial tilt (seasons); the planet turns so the first sun's solar day lasts exactly `dayHours`, t = 0 is midnight at lon 0. The planet shader sums the suns' light per pixel and darkens eclipses by the true angular sizes of moon and sun as seen from that point. Distances are log-compressed for display only. Presets: «Земля» (NASA Blue Marble map `app/cosmograph/earth-blue-marble.jpg`, public domain; calendar from 1 January 2026) and «Три сонця» (MorraSimulator's starting calibration). Editor: planet (name, radius, tilt, day, map upload → Storage `worlds/{w}/files/cosmos/…`), calendar (month names/days, first year, era), suns/moons. Saved to `worlds/{w}.cosmos` (fed to `gamedevPlan` as a «Sky:» line). Morra-only physics (magic, radiation roles, magosphere) is not ported.
  **Access:** off by default; turned on in project settings via `cosmographAccess` (`functions/src/cosmograph.js`): 2000 tokens per world per 30 days (`worlds/{w}.cosmograph { enabled, paidUntil, paidAt }`, written only by the server — firestore.rules keep the field read-only for clients; turning it off keeps the paid month, turning it back on within it is free; nothing renews by itself). The running sky survives re-renders and stops when the author leaves the section. `window.__COSMOGRAPH__` exposes `config`, `setTime(h)`, `sample(lat, lon)` (light per sun) for checks.
- **Language:** every label is built for one language at load (`LANG` from the shell's `__i18n` / `localStorage ww-lang`); the account switch (`i18n.setLanguage`) dispatches `ww-language-change` into the frame → the Bible reloads in place on the same section (`sessionStorage ww-bible-sec-{w}`), after an open card/dossier is closed. The game-status chips are hidden on canon pages. Shell: `i18n.js` loads before the shell script; on a switch the shell re-renders rail, dock, news, world hub, worlds list, Спільнота, KB.
- **Біблія ↔ книга (the Bible is the home of a world):** a canon dossier has a block **«Історії»** — the stories about it (`projects.subjects` contains the entity id; live listener on `projects where owner, worldId`) with their reveal mark, «Відкрити», and **«＋ Історія»**: a dialog (title from the entity, reveal mark, «коли розкриється» for *later*) → `ww-write-story` → the shell opens `WhiteWrite.html?new=1&free=1&worldId&title&about&reveal&revealNote` → the book creates the story at once (`creation: free`, no form), the mage ritual opens it («Книга відкривається…»), then the writing sheet. Opening a story from the Bible (`ww-open-story`) also plays the ritual (`ritual=1`).
  **Reveal marks** (`projects.reveal`): `open` «Відкрита читачеві» · `later` «Розкриється згодом» (+ `revealNote`) · `internal` «Внутрішній канон» (author only). Shown as chips; changeable on the chronicle's story cards (which also show who the story is about).
  **Shell chrome (`White.html renderRail` → `body.at-home` / `body.in-work`):** the user dock (avatar, balance, Account) shows on the home page only, desktop and phone. Phones (≤ 820 px), off home and outside a story: no top rail, views start at `top:0`, the Bible frame drops its 118 px offset (its own ≤ 820 px rules), and `#home-fab` (logo) in the dock's place leads home; a story keeps the rail (Bible ↔ Book switch, paged layout). History: `goBack()` never re-records the screen it leaves (`_back` in `histPush`) and skips entries equal to the current screen — the Account ✕ used to loop back into the Account.
  **Back:** in a story the shell rail starts with **«Біблія світу»** (`CURRENT_WORLD` from the story's `worldId`) → `showBible()` keeps the frame, so the same dossier is still open; `ww-bible-focus {ent}` opens a given entity. Frames crossfade (`.frame` opacity .5 s).
- **Menu (World Bible):** head «Біблія світу» + world title; world block (canon sections) folds with an arrow (`localStorage ww-bible-fold`); then «Гра:» picker; game sections; «+ Свій розділ»; **«⚙ Налаштування проєкту»** last (special section `settings`).
- **Project settings:** top to bottom — **«Claude Code»** (`agentRoadHtml`, only with a game): the KB road's once-per-game steps with the same numbers, each ticked from live data — 3 folder + launch (`games/{g}.launch.dir`), 4 MCP key (a live `mcpKeys` doc; «Створити ключ» = `createKey`, the key + `claude mcp add` shown once), 5 design → plan (`.md` import button, → Продакшн-план; `plan/current.plan`), 6 first session (`get_guide setup`; `env/current` status + «Перевірити середовище ще раз» = `get_guide unity_env`), 7 development log (`get_guide activity_log` block for CLAUDE.md, a copy button; any `activity` session), 9 GitHub repo (optional; `games/{g}.repo`); «Докладніше» opens the KB step (`ww-kb-article`), `data-gosec` jumps to a section. The key/activity/env listeners re-render the settings unless the author is typing (`settingsIdle`). Then the game (rename, engine profile, sections shown, custom sections, JSON export `whitewrite.game/1`) → the world (rename — notifies the shell `ww-worlds-changed`; JSON export `whitewrite.world/1` / restore) → Космограф → danger zone (delete game, world).
  Safe deletion = type the exact name. Game delete removes cards (+ Storage files), plan, tasks, executions, changeRequests, quests, dialogues, its `mcpKeys`, then the game doc. World delete is refused while stories (`projects.worldId`) exist; else games → entities → world doc (last, rules check ownership through it), then the shell reloads and shows the worlds list.
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
Quests & dialogues of the game (v2.30: `ctx.gref` quests/dialogues; approved only, the `narrative-validate.js` check attached; refs resolved through `refPool` — `c:<id>` game cards with their fields, `e:<id>` canon, + `events`): `get_quest_context`, `get_dialogue_context` (no id → the approved list). `get_content_export` (v2.31) → `{ content, counts, how }`: the approved quests/dialogues in RPG Framework's import format `rpgframework.content/1` (framework ≥ 0.32.1 — in 0.32.0 a last line without next did not end the conversation; `ContentAssetImport.ImportFromCommandLine -contentFile`, exit 0/1/2) built by `NV.toFrameworkContent` in `functions/narrative-validate.js` — summary → description, objectives/rewards text → `custom`, repeat → `repeatable` + `cooldownSeconds` (`cooldownSeconds("24 год")`), end/fail → stage `outcome` success/failure, top-level `schema` (the importer's `badSchema` check), node `end` → `type:"end"` except the start node (`startIsEnd` would fail the file — a one-line talk is a plain line with no next), `locKey` → `key`, choices `c1…`, conditions → `{type:"custom", id}`, effects text → `parseEffects` (`give_item`→`giveItem`, `set_flag`→`setVariable` 1, `start_quest`→`acceptQuest`…), refs as opaque strings under `quest.refs`. The Game Bible «Квести» has the same as a download («⤓ JSON для RPG Framework», `exportFramework`).
`get_project_overview` → `integrations { marketing { enabled, claude_md_confirmed, instruction }, repo, knowledge }` (v2.29) — the agent keeps the development log when marketing is on.
Setup & project knowledge (v2.27, texts in `functions/setup-guides.js`): `get_guide {topic: setup|unity_env|knowledge|activity_log}`, `report_unity_environment` (→ `env/current`), `submit_project_knowledge` (parts `begin` manifest → `records` ≤500 per call → `end` reports; idempotent: unchanged records skipped by hash; absolute / `../` paths and unconfirmed `maps_to_card` rejected; a full scan marks unseen assets `missingSince`, never deletes), `get_project_knowledge_status`, `search_project_knowledge {q, guid, type, path_prefix, related_to}`, `submit_development_activity` (`session_id` idempotent; existing entries never overwritten; commit verified against the connected GitHub repo).
World generation & experience (§6): `get_world_generation_spec`, `get_biome_profile`, `get_module_contract`, `get_environmental_profile`, `get_telemetry_schema`, `get_experience_issue`, `submit_validation_result`.

**Cycle:**
```
plan → tasks(todo) → Claude Code: get_next_task (in_progress) → report_task_progress → submit_task_result (review)
     → author: Прийняти (done, linked cards → ingame) | Повернути (rework + comment)
     blocked → author answers → todo;   change request → author accepts/rejects
```
Every tool call is logged in `executions` (activity feed in the Game Bible).

### **5a. Спільнота — public showcases (v2.36)**
- **Publish** (any plan, even Free): the world hub → side tab «🌍 Спільнота» (v2.43; was Bible → ⚙ Project settings → «Спільнота») (`communityHtml` / `bindCommunity` in `gamebible.js`), one block for the world and one for the open game. The **client builds the snapshot** from what the author sees (`commItems`: dossier entities with description + dossier tabs + images, culture entries, chronicle events; for a game `allCards()` of ordinary shelves — canon description + text fields, **never** the card note, image/file fields, plan, tasks, keys, log, telemetry); the world overview (tagline, summary, facts) always, laws as `rules` when «Закони» is ticked. Defaults: canon `COMM_CANON`, game `COMM_GAME`. Cover = one of the images of the open sections.
- **`community`** (HTTP, Bearer ID token): `publish {worldId, gameId?, tagline, summary, cover, facts, rules, sections, items}` → checks world ownership, trims (≤600 items, ≤30 blocks × 12k chars, ≤8 images, Storage URLs only), replaces `items/`, keeps likes · `unpublish {pubId}` (owner or admin; deletes items + likes) · `like {pubId, on}` (transaction; not your own) · `report {pubId, reason}` (one per user per showcase) · `hide {pubId, hidden}` (admin claim; resolves its reports). Publish / unpublish / hide rebuild the home cards at once.
- **`communityRotate`** (hourly) = `rebuildHome`: score = Σ ♥ × 0.5^(age / 30 days); drops showcases whose world/game is gone; `activeAt` = latest `updatedAt` of the world doc, its entities, the game doc and its cards. **Top** = the best showcase of each author, 20 authors (showcases with `promotedUntil` > now — future paid promotion, set by an admin — go first). **Pool** = the rest whose author was active in 7 days (≤200). Written to `community_home/current { top[], pool[] }` (card fields only).
- **Home** (`flow.jsx` `HomeCommunity`, left-centre; hidden on phones — the rail's compass instead): «Вибір спільноти» = `top[floor(time of day / (24h / N)) % N]` (re-checked every minute), «Відкрий нового автора» = a random `pool` card per visit, «✦ Спільнота — усі світи й ігри»; clicks post `{type:'ww-community', pubId?}` to the shell.
- **Discord + team** (v2.38): the settings block has a Discord invite (`discord`, only `https://discord.gg/<code>` or `discord.com/invite/<code>`, checked on both sides) → «Приєднатися в Discord» on the page; «🤝 Шукаю команду» (`lookingForTeam`, `teamNote`) → a green badge over the cover in the list, on the page and on the home cards (`community_home` cards carry `team`).
- **«Співтворці»** (v2.38, unpaid co-creation): `collab/{uid}_{offer|seek}` `{ owner, type, author, title, roles[], text, contact, pubId, hidden, reports, createdAt, updatedAt }` — one post of each kind per user, **written by its owner** (firestore.rules `validCollab`: exact keys, sizes, id = uid_type; `hidden`/`reports` only on the server); public read unless hidden. Reports / admin hide go through `community` with `col: 'collab'`. Shell tab «🤝 Співтворці» in the `market` view: posts + showcases with `lookingForTeam` (as «Шукає людей»), filters by kind and role (`CB_ROLES`), the form `collabForm` (seek may link one of my showcases).
- **Shell view `market`** (rail «Спільнота», `nav.marketplace`; replaced the old mock): list (`where hidden == false`, ≤300, sorted in the browser — Popular = score, New = publishedAt; World/Game filter) → showcase page (cover hero, ♥, «Поскаржитися», admins «Приховати», summary, facts, section tabs with items by group). `openCommunity(pubId)` also serves the Bible's «Відкрити у спільноті». Scale note: past a few hundred showcases switch the list to an indexed `orderBy` query with paging.

### **5b. World hub panel · Команда · Бекап · Маркет (v2.43)**
- **Hub panel**: the world hub (`fillHome` in `White.html`) is `.whub` — the «Біблія світу» card + an iframe `WhiteWrite GameBible.html?embed=1&panel=1&worldId=…` (owner only). `?panel=1` (`PANEL`, class `ww-panel`) makes the Bible render only `renderHubPanel()`: side mini-tabs 🌍 Спільнота (the old settings block) · 🤝 Команда · ⚖ Маркет · ⛁ Бекап (`ww-hubtab-<w>` in sessionStorage). It posts `ww-panel-h` (height, ResizeObserver), `ww-account {tab:'friends'}`, `ww-market {lotId?}`, `ww-kb-article` to the shell.
- **Friends / team** (`functions/src/team.js`, endpoint `team`): `invite {email}` (auto-accept when mutual), `accept`, `unfriend` (also leaves each other's teams), `set {worldId, uid, role, view, edit}` (owner; accepted friends only), `remove` (owner or the member). Account → tabs «Профіль» / «Друзі». `listWorlds()` adds `where teamUids array-contains uid` (`shared: true` → 🤝 badge, no ✎, no panel, a note). In the Bible a member gets `ME` (`mayRead` / `mayEdit`, nav and listeners filtered; custom roles query one section / kind per listener so the rules can prove access), no game creation, owner-only settings / env / executions / MCP keys. ✦ AI: only the owner and an **admin**, paid by the owner (`team.payerFor(uid, worldId)` in gamedev / narrative / style); members use the owner's plan for game writes (rules `ownerGameDev`). Stories stay owner-only.
- **Backup** (`functions/src/backup.js`, `backup` + `backupDaily` every 24 h): `connect {token}` (GitHub `/user`, creates the private repo `whitewrite-<slug>-<id6>`), `enable` (pays `githubBackup` for 30 days, then backs up), `disable`, `now` (≥ 10 min apart), `disconnect`. Writes `world.json` (`snapshot.js` schema `whitewrite.backup/1`) + `README.md` via the contents API. The daily run renews from the owner's balance or pauses with `lastError`.
- **Snapshot** (`functions/src/snapshot.js`): `buildSnapshot(worldId, uid, schema)` → `{ snap, json, chars, hash }` — world doc, entities, lore, games (cards, plan, tasks, quests, dialogues), the owner's stories with scenes; drops files, images, keys, team, backup, freeze, launch, repo, cosmograph. Shared by backup and the market.
- **Market** (`functions/src/market.js`, `MARKETPLACE_SPEC.md`; legal texts `functions/legal/` + `docs/legal/`): `market` ops `quote` · `apply` (Worldbuilder + active subscription; fee by snapshot size `paid-features.js LICENCE` / `licenceReview`; uploads `licences/{id}/snapshot.json` + sha256; **freezes the world** in a transaction; ledger `licence_review`) · `status` · `withdraw` · `connect` / `connectStatus` (Stripe Connect Standard) · `checkout` (direct charge on the seller's account, `application_fee_amount` 12%, the lot reserved 31 min) · `deals`; admin `queue` · `decide {approve, level, note}` (→ `marketLots/{appId}` listed with report, metrics and the filled contract; reject → unfreeze) · `unlist`. **`licenceReview`** (`onDocumentCreated`, 540 s): metrics + two Opus passes (review JSON; lawyer with `legal/ai-lawyer-prompt.md`) → `moderation`, admin notice. **`marketWebhook`** (secret `STRIPE_CONNECT_WEBHOOK_SECRET`): `checkout.session.completed` (`kind: ww_market`) → `completeDeal` (refund when the lot is no longer for sale) → `transferWorld` (Storage under `worlds/{w}/` deleted, unsold subcollections dropped, the seller's projects move to the buyer, keys / repo tokens / marketing / community / backup removed, `owner` = buyer, team cleared, `boughtFrom`, `licence`); also `checkout.session.expired`, `account.updated`, `charge.dispute.*`. Shell: Спільнота → «⚖ Маркет» (lots, lot page with the contract and agreement, «Мої угоди», admin «Модерація»); `?market=bought|lot|<worldId>` on the return from Stripe.
- **Freeze enforcement**: firestore.rules `worldOpen` / `storyOpen`, storage.rules `worldOpen`, server writers (style, narrative, gamedev, `canon-store loadCanon(…, {write:true})` for scenes), MCP write tools (`report_* / submit_* / get_next_task / check_style`).
- **Tokenomics**: `TOKENOMICS.md` — cost per feature, ≥ 100% margin per plan, open owner decisions (telemetry / Storage quotas, top-up prices).

### **6. World Generation spec & Player Experience Intelligence**

Source: `World_Generation_and_Game_Experience_Intelligence_Spec_UA.docx` (root). The Unity side (generator, validators, atmosphere runtime, telemetry SDK, editor tools) belongs to RPG Framework (`D:\RPG-Framework`, a separate agent); WhiteWrite is the platform: approved requirements, analytics, plans, reports.

**Approved requirements in the Game Bible**
- Section `worldgen` «Генерація світу» (groups Біоми · Модулі маршрутів · Модулі оточення · Ігрові модулі · Атмосферні сценарії · Правила генерації; fields: contract (anchors/ports/bounds/tags), rules, atmosphere, triggers, deps & version, validation, model file). MCP maps a card's group (uk or en) to a kind: biomes / route / environment / gameplay / atmosphere / rules.
- Section `telemetry` «Телеметрія»: the event catalogue (event, meaningful yes/no, properties, link, schema version); «＋ Стандартні події» seeds the spec's standard events (`TL_STD` = `STANDARD_EVENTS`).
- **Design intent** (`card.intent` on game cards of `levels`, `locations` (on the canon card's game view), `mechanics`, `worldgen`): `{ tags: [tension|exploration|rest|learning|reward|social], expected, pacingMin, pacingMax (minutes), critical, success }` — shown in every AI pass over the Bible (`bibleText`), in metrics (pacing threshold) and in reports.

**Telemetry pipeline** (`functions/src/experience.js`)
- `telemetryIngest` (public, CORS *): `Authorization: Bearer wwi_…` → sha256 → `ingestKeys/{sha256}` `{ uid, worldId, gameId, label, prefix, revoked }` (owner plan must have `allowGameDev`; 5-min cache). `POST { events: [≤500 envelopes] }`. Envelope: `event_id, event_name, schema_version, build_id, session_id, player_id (pseudonymous, no "@"), timestamp (±7d/+1d), level_id, zone_id, entity_id, mechanic_id, quest_id, position (rounded 0.5 m), context {platform, mode, cohort, variant}, properties (≤20 primitives)`. Stored compact in `games/{g}/telemetry/{event_id}` (`n v b s p t gt l z en m q pos ctx pr expireAt`) — the same event_id overwrites itself (retries dedupe). Daily totals `games/{g}/telemetryDaily/{YYYY-MM-DD}` (`total`, `events.{name}`, `builds.{b}` increments — they count accepted deliveries, retries included; metrics always read the deduplicated raw events). `games/{g}.telemetryStats { day, count, lastAt, scaleAlert? }`.
- **Retention (automatic):** Firestore TTL policies on `expireAt` for collection groups `telemetry` (30 days) and `telemetryDaily` (400 days) — `firestore.indexes.json` fieldOverrides, enabled with `gcloud firestore fields ttls update expireAt --collection-group=…`. Game deletion calls `experience {op: purge}` (recursive delete of telemetry, daily, experience, issues, playtests, experiments + its ingest keys).
- **Scale:** raw events in Firestore suit playtests / early launch. Past `SCALE_EVENTS_PER_DAY` (150 000) the game gets `telemetryStats.scaleAlert`, and «Досвід гравців» shows a banner. ⚠ Then: stream raw events to **BigQuery** (ingest writes to BigQuery instead of `telemetry/`, metrics computed by SQL), keep Firestore for daily totals, metrics, issues, playtests. Also revisit the single `telemetryDaily` doc per day (≈1 write/s sustained limit).
- **Abuse limits** (the ingest key ships inside builds): a game accepts at most `DAILY_CAP` (2 × 150 000) events a day — then 429 `DAILY_CAP`; one address may send `IP_PER_MIN` (120) batches a minute per instance — then 429. Raise `DAILY_CAP` together with the BigQuery move.
- `experience` (signed-in owner, `allowGameDev`): `keyCreate {label}` → `wwi_` key once (+ `games/{g}.ingestKeys[] {hash(16), prefix, label, at}`), `keyRevoke {hash}`; `metrics {days ≤30, build?}` (free) → reads ≤60 000 newest events, `computeMetrics` → `games/{g}/experience/metrics` `{ sample, session, zones{gapMedianSec, gapP90Sec, downtimeSessionShare, stayMedianSec, deathsPerPlayer, stuckShare, exitShare, hints…}, quests, levels, mechanics, variety, exploration, surveys, experiments (conversion, z, p), heatmaps[≤12 zones × 24×24 × move/death/interact/explore] }`; `report` (AI, ×2 economy) → `games/{g}/experienceIssues/{id}` `{ title, category, priority, scope, evidence[{metric,value,note}], hypothesis, alternatives, confidence, confidenceWhy, impact, actions[{change,risk}], validation{plan,target[{metric,direction}]}, baseline, sample, status open|planned|validating|resolved|dismissed, taskId?, validations[] }` — evidence only by metric keys of `flatten(metrics)`, «Boredom Risk», never claims about people; `playtest {focus}` (AI) → `games/{g}/playtests/{id}` `{ title, goal, build, cohort, tasks, questions[{id,text,type,options,when}], status draft|active|done }`; `validate {issueId}` (free) → re-measures `validation.target` vs `baseline` (±10%) → verdict improved|mixed|not_improved|inconclusive, `improved` resolves.
- A/B: `games/{g}/experiments/{id}` `{ hypothesis, variants, metricEvent, status running|done }` (client-written); the game puts the variant in `context.variant`.
- Survey answers: event `SurveyAnswered {playtest, question, answer}`.

**Improvement loop** (§18): issue → «В план для Claude Code» writes task `EX.n` (milestone `EXP` appended to `plan/current.plan.milestones`, `issueId`), issue `planned`; task done → the issue shows «зроблено — перевір»; a new playtest → «Перевірити зміну»; Claude Code may add `submit_validation_result`. Success = the validation, not the task.

**UI:** game tab `experience` «Досвід гравців» (after the plan): Огляд · Теплові карти · Проблеми · Плейтести · Експерименти · Підключення.

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
- Firebase Cloud Functions (Node.js 22)
- Anthropic SDK (`@anthropic-ai/sdk`)
- Google AI SDK (`@google/generative-ai`)

### **APIs**
- Claude API — the only AI (Haiku / Sonnet / Opus 5.5 by default; Models API for the model watch)
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
- Worlds/entities: owner only; game doc write requires `allowGameDev` plan (`hasGameDev()`)
- **Game subcollections (v2.24):** client-writable ONLY `cards`, `plan`, `tasks`, `changeRequests`, `experienceIssues`, `experiments`, `playtests`, `quests`, `dialogues` (v2.30) (what the Game Bible page edits); `executions`, `knowledge`, `kAssets`, `kRelations`, `activity`, `env`, `posts`, `channels`, `marketing` — the owner may only delete (game deletion); `marketingSecrets`, `marketingQueue` — no client access (v2.29); `activity/{s}/entries/{e}` — the owner may update only `privacy` (one of the five values) and `reviewedAt` (v2.27); everything else under a game (`telemetry`, `telemetryDaily`, `experience`, and future server records: activity log, project knowledge, marketing posts…) is server-only, owner read. Deeper nesting: read only
- `mcpKeys`: owner reads/deletes; create only for own world + gamedev plan, fixed field set; no client updates
- `repoTokens`: no client read or write (only the `gamedevPlan` function)
- `ingestKeys`: no client read or write (only `experience` / `telemetryIngest`); the ingest key is write-only and per game, so it may ship inside a build; analytics is opt-in, pseudonymous ids, positions rounded
- Billing fields on `users/{uid}` are server-only
- MCP: key hashed (sha256), per-game scope, revocable, plan re-checked on every call; function is public-invoker, auth is in code
- Canon extraction logs: owner-only read
- Admin stats: role-based access

**Tests (v2.24):** `npm test` (`tests/run.mjs`) runs every `tests/*.test.*`: `rules.test.mjs` — `firestore.rules` in Google's Rules Test API (`firebaserules.googleapis.com/v1/projects/whitewrite-app:test`, gcloud token, `get()` mocked; no emulator/Java), `model-watch.test.cjs` / `claude-fallback.test.cjs` (stubbed Firestore/fetch), `plan-gates.test.cjs` (`mcp.js lockedBy`), `narrative-validate.test.cjs` (quest/dialogue graph checks), `narrative-draft.test.cjs` (AI proposal cleaning), `mcp-quests.test.cjs` (MCP quest/dialogue views, approved only, game-card and canon-event refs), `mcp-knowledge.test.cjs` (Project Knowledge parts/idempotency/tombstones/search and the activity log against an in-memory Firestore), `marketing.test.cjs` (drafts only from approved entries, platform limits, polls, the bot-token check), `content-export.test.cjs` (v2.31, the `rpgframework.content/1` mapping). `npm run test:rules` — only the rules. UI flows: Playwright E2E with a mocked Firebase (kept outside the repo).

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

**Last updated:** 2026-11-02 (v2.43 world hub panel (`?panel=1`: Спільнота · Команда · Маркет · Бекап beside the Bible card), friends + world team with roles (`team.js`, rules by section / kind, admin ✦ on the owner's tokens), daily GitHub backup (`backup.js`, `githubBackup`), Market phase 1 (`market.js`: licence review with freeze, AI review + AI lawyer, moderation, Stripe Connect 12% buyout, `transferWorld`; legal templates; `TOKENOMICS.md`); shell views start at the top (no 118 px band); Bible game menu is an accordion (one group open); v2.42.1 Bible: «Огляд світу» bar shows the world NAME (Cinzel, centred) or `worlds/{w}.titleArt { url, path, h }` (Storage `worlds/{w}/cover/title_*`, height slider), ✎ for the owner on hover; an opened card / dossier focuses the panel, not the title (new ones only); files upload into a new card (it saves itself first, `save(true)`); «Референси» cards: «Картинки» image field first (added to older cards too), note / general files hidden until used; v2.42 token ledger `users/{uid}/ledger` (`functions/src/ledger.js`; server-only, owner reads) — grants, top-ups, every spend, plan switch; Account «Історія токенів» + printable receipts; v2.41.3 Bible «Огляд світу» opens with the world cover (`worldCoverHtml`: `worlds/{w}.cover` image / video with its ⌖ frame, default `ph-world.jpg`, 16:9) above the tagline and description; v2.41.2 Спільнота view: one sticky top bar `.cm-top` with every control (tabs, filters, «＋» posts, role `<select>`, an open showcase's sections / ♥ / Discord / report) and ✕ → `showHome()`; the rail no longer has «Спільнота» — it opens from the home page only; v2.41.1 KB: «🌍 Спільнота: просування, однодумці й команда — безкоштовно» (why: home-page promotion, free team search, Discord) + a «🌍 І ти не сам» block in «Що таке WhiteWrite»; v2.41 AI style check (`styleCheck`, `style-guide.js`): automatic on picture upload, «✦ Перевірити всі» in the style tab, stale scores, 3D «📷 Знімок для стилю», MCP `get_style_guide` / `check_style`; KB: framework multiplayer = co-op + PvP up to 8, no MMO; v2.40 «Візуальний стиль» game section (overall + biomes) and the free colour badge «🖌 NN» on every game picture; v2.39 «⌖ Кадр» (`frame-pick.js`): world covers 16:9 with a frame, card / dossier faces framed or shown whole; v2.38 Спільнота: Discord invite and «🤝 Шукаю команду» on showcases, «Співтворці» posts (`collab/`); v2.37 world covers (image / looping video, ✎ on world cards, default `ph-world.jpg`), the hub's «Біблія світу» is a full-size card; v2.36 Спільнота: public showcases of worlds/games (`community.js`, ♥ with decay, reports + admin hide), home cards «Вибір спільноти» (top 20 through the day) / «Відкрий нового автора»; v2.35.3 game menu: «Сцени» under «Світ і рівні», UI/UX under «Арт і аудіо»; v2.35.2 hero «Від задуму — до гри» on one line (nowrap); v2.35.1 KB road: step 1 = choose the path (RPG Framework explained), step 2 = prepare the PC; v2.35 KB: «Світи на головній» (ready frame, fill from your materials), new «Біблія гри — живий гейм-диздок»; hero button «Від чистого ПК до Гри»; v2.34 «Історії і хроніка»: story tags scope/games, subsection rename, clickable event names; story form keeps «Біблія світу» (`ww-mode: create`); v2.33 home copy (world-first), KB agent road, Project settings «Claude Code» steps with ticks; v2.32 shell chrome: avatar on home only, phones drop the top rail off home, Back no longer loops; v2.31 RPG Framework 0.32 content export + validation exit codes; v2.30 quests & dialogues moved into the game; v2.29 Mini-Marketing; v2.28 Scenes, palettes, reference group colours; v2.27 Project Knowledge, development log, Unity environment)
**Maintained by:** WhiteWrite Team
