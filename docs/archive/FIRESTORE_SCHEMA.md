# WhiteWrite — Production Firestore Schema

## 🎯 Принципи архітектури

1. **Canon = джерело правди** — зберігається в документі проєкту
2. **Narrative & Director** — зберігаються як subcollections для масштабованості
3. **User-scoped** — кожен користувач має свої дані
4. **Versioning & Autosave** — через saveQueue + snapshots
5. **Firestore limits**:
   - Document max: 1MB
   - Subcollection: необмежена
   - Max 20,000 writes/day на free tier (billing enabled = unlimited)

---

## 📊 Схема колекцій

```
users (collection)
  └── {userId} (document)
       ├── email: string
       ├── displayName: string
       ├── photoURL: string
       ├── tokens: number (AI generation tokens залишок)
       ├── plan: "gemini" | "claude" (вибір AI-моделі, НЕ білінг)
       ├── createdAt: timestamp
       ├── lastActiveAt: timestamp
       └── settings: {
            └── autoSave: boolean
            └── theme: "light" | "dark"
            └── language: "uk" | "en"
       }

projects (collection)
  └── {projectId} (document)
       ├── owner: string (userId)
       ├── visibility: "private" (дефолт; майбутнє: "shared" | "public")
       ├── title: string
       ├── desc: string
       ├── meta: string
       ├── cover: string | null
       ├── scope: "short" | "novella" | "novel" | "season"
       ├── ending: "open" | "closed"
       ├── genres: string[]
       ├── written: number (sцен написано)
       ├── active: boolean
       ├── badge: "draft" | "active" | "done"
       ├── c1: string (hex color)
       ├── c2: string (hex color)
       ├── canonAware: boolean
       ├── createdAt: timestamp
       ├── updatedAt: timestamp
       │
       ├── canon: {
       │    └── world: {
       │         └── tagline: string
       │         └── summary: string
       │         └── facts: [{k: string, v: string}]
       │         └── rules: string[]
       │         └── palette: string[]
       │    }
       │    └── characters: {
       │         └── {charId}: {
       │              ├── id: string
       │              ├── name: string
       │              ├── slug: string
       │              ├── role: string
       │              ├── roleType: "lead" | "support" | "anta"
       │              ├── status: string
       │              ├── motivation: string
       │              ├── arc: string
       │              ├── prog: number (0-100)
       │              ├── scenes: number[] (scene IDs where appears)
       │              ├── locations: string[] (location IDs)
       │              ├── factions: string[] (faction IDs)
       │              ├── artifacts: string[] (artifact IDs)
       │              ├── events: string[] (event IDs)
       │              └── relations: [{id: string, kind: string, tone: string}]
       │         }
       │    }
       │    └── locations: {
       │         └── {locId}: {
       │              ├── id: string
       │              ├── name: string
       │              ├── slug: string
       │              ├── type: string
       │              ├── cur: boolean (current location)
       │              ├── atmos: string[]
       │              ├── cond: string (current condition)
       │              ├── desc: string
       │              ├── palette: string[]
       │              ├── scenes: number[]
       │              ├── events: string[]
       │              └── factions: string[]
       │         }
       │    }
       │    └── events: {
       │         └── {eventId}: {
       │              ├── id: string
       │              ├── title: string
       │              ├── slug: string
       │              ├── when: string
       │              ├── act: number
       │              ├── type: string
       │              ├── tone: string
       │              ├── desc: string
       │              ├── characters: string[]
       │              ├── locations: string[]
       │              ├── factions: string[]
       │              └── artifacts: string[]
       │         }
       │    }
       │    └── factions: {
       │         └── {factionId}: {
       │              ├── id: string
       │              ├── name: string
       │              ├── slug: string
       │              ├── motto: string
       │              ├── align: string
       │              ├── tone: string
       │              ├── power: number (0-100)
       │              ├── members: number
       │              ├── desc: string
       │              ├── characters: string[]
       │              ├── locations: string[]
       │              ├── events: string[]
       │              └── artifacts: string[]
       │         }
       │    }
       │    └── artifacts: {
       │         └── {artifactId}: {
       │              ├── id: string
       │              ├── name: string
       │              ├── slug: string
       │              ├── type: string
       │              ├── rarity: string
       │              ├── tone: string
       │              ├── owner: string (character ID)
       │              ├── location: string (location ID)
       │              ├── faction: string (faction ID)
       │              ├── scene: number
       │              ├── desc: string
       │              ├── events: string[]
       │              └── characters: string[]
       │         }
       │    }
       │    └── inferred: {
       │         └── {entityId}: {
       │              ├── type: "character" | "location" | "event" | ...
       │              ├── data: {...} (same structure as explicit)
       │              ├── confidence: number (0-100)
       │              ├── source: "scene_id" | "ai_suggestion"
       │              ├── status: "pending" | "approved" | "rejected"
       │              └── createdAt: timestamp
       │         }
       │    }
       │    └── hiddenCanon: {
       │         └── {entityId}: {
       │              ├── trueVersion: {...}
       │              ├── surfacedVersion: {...}
       │              ├── revealUntil: string (scene ID)
       │              └── revealed: boolean
       │         }
       │    }
       │}
       │
       └── scenes (subcollection) ← ВАЖЛИВО: subcollection для масштабованості
            └── {sceneId} (document)
                 ├── id: string
                 ├── n: number (порядковий номер сцени)
                 ├── title: string
                 ├── text: string (повний текст сцени)
                 ├── act: number (1, 2, 3)
                 ├── arc: string (arc ID)
                 ├── pov: string (character ID)
                 ├── intent: "conflict" | "character" | "action" | ...
                 ├── customIntent: string | null
                 ├── status: "draft" | "review" | "done" | "pinned"
                 ├── generatedAt: timestamp
                 ├── updatedAt: timestamp
                 ├── entities: {
                 │    └── characters: string[] (IDs згаданих персонажів)
                 │    └── locations: string[] (IDs локацій)
                 │    └── events: string[] (IDs подій)
                 │    └── artifacts: string[] (IDs артефактів)
                 │}
                 └── reconstruction: {
                      └── mode: "auto" | "review" | "pinned"
                      └── affectedBy: string[] (canon entity IDs)
                      └── lastReconstructionAt: timestamp | null
                 }

       └── narrative (subcollection)
            ├── arcs (document)
            │    └── data: {
            │         └── {arcId}: {
            │              ├── id: string
            │              ├── title: string
            │              ├── span: string
            │              ├── desc: string
            │              ├── characters: string[]
            │              ├── scenes: number[]
            │              ├── events: string[]
            │              └── artifacts: string[]
            │         }
            │    }
            │
            ├── chapters (document)
            │    └── data: {
            │         └── {chapterId}: {
            │              ├── id: string
            │              ├── title: string
            │              ├── act: number
            │              └── scenes: number[]
            │         }
            │    }
            │
            └── dialogues (document)
                 └── data: {
                      └── {dialogueId}: {
                           ├── id: string
                           ├── scene: number
                           ├── title: string
                           ├── line: string
                           ├── characters: string[]
                           ├── locations: string[]
                           └── artifacts: string[]
                      }
                 }

       └── director (subcollection)
            ├── storyboards (document)
            │    └── data: {
            │         └── {storyboardId}: {
            │              ├── id: string
            │              ├── scene: number
            │              └── title: string
            │         }
            │    }
            │
            └── shots (document)
                 └── data: {
                      └── {shotId}: {
                           ├── id: string
                           ├── scene: number
                           ├── title: string
                           ├── camera: string
                           ├── type: string
                           ├── dur: string
                           ├── angle: string
                           ├── subject: string
                           ├── light: string
                           ├── moods: string[]
                           ├── generated: boolean
                           ├── prompt: string
                           ├── imageUrl: string | null
                           ├── characters: string[]
                           ├── locations: string[]
                           └── artifacts: string[]
                      }
                 }

snapshots (subcollection) ← для versioning
  └── {snapshotId} (document)
       ├── projectId: string
       ├── userId: string
       ├── timestamp: timestamp
       ├── type: "auto" | "manual"
       └── data: {...} (повна копія проєкту)

reconstructionQueue (subcollection) ← черга реконструкції
  └── {queueId} (document)
       ├── projectId: string
       ├── userId: string
       ├── changeType: "rename" | "property" | "relationship" | "add" | "remove" | "rewrite"
       ├── entityType: string
       ├── entityId: string
       ├── affectedScenes: number[]
       ├── status: "pending" | "processing" | "done" | "failed"
       ├── createdAt: timestamp
       └── completedAt: timestamp | null
```

---

## 🔐 Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && isOwner(userId);
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isAuthenticated() && isOwner(userId);
      allow delete: if false; // users can't delete themselves via client
    }

    // Projects collection
    match /projects/{projectId} {
      allow read: if isAuthenticated() &&
                     resource.data.owner == request.auth.uid;
      allow create: if isAuthenticated() &&
                       request.resource.data.owner == request.auth.uid;
      allow update: if isAuthenticated() &&
                       resource.data.owner == request.auth.uid;
      allow delete: if isAuthenticated() &&
                       resource.data.owner == request.auth.uid;

      // Scenes subcollection
      match /scenes/{sceneId} {
        allow read: if isAuthenticated() &&
                       get(/databases/$(database)/documents/projects/$(projectId)).data.owner == request.auth.uid;
        allow write: if isAuthenticated() &&
                        get(/databases/$(database)/documents/projects/$(projectId)).data.owner == request.auth.uid;
      }

      // Narrative subcollection
      match /narrative/{docId} {
        allow read: if isAuthenticated() &&
                       get(/databases/$(database)/documents/projects/$(projectId)).data.owner == request.auth.uid;
        allow write: if isAuthenticated() &&
                        get(/databases/$(database)/documents/projects/$(projectId)).data.owner == request.auth.uid;
      }

      // Director subcollection
      match /director/{docId} {
        allow read: if isAuthenticated() &&
                       get(/databases/$(database)/documents/projects/$(projectId)).data.owner == request.auth.uid;
        allow write: if isAuthenticated() &&
                        get(/databases/$(database)/documents/projects/$(projectId)).data.owner == request.auth.uid;
      }

      // Snapshots subcollection
      match /snapshots/{snapshotId} {
        allow read: if isAuthenticated() &&
                       resource.data.userId == request.auth.uid;
        allow create: if isAuthenticated() &&
                         request.resource.data.userId == request.auth.uid;
        allow delete: if false; // snapshots are immutable
      }
    }

    // Reconstruction queue (global, but user-scoped)
    match /reconstructionQueue/{queueId} {
      allow read: if isAuthenticated() &&
                     resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated() &&
                       request.resource.data.userId == request.auth.uid;
      allow update: if isAuthenticated() &&
                       resource.data.userId == request.auth.uid;
      allow delete: if isAuthenticated() &&
                       resource.data.userId == request.auth.uid;
    }
  }
}
```

---

## 📈 Indexes (потрібні для queries)

```javascript
// projects collection
{
  collectionGroup: "projects",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "owner", order: "ASCENDING" },
    { fieldPath: "updatedAt", order: "DESCENDING" }
  ]
}

// scenes subcollection
{
  collectionGroup: "scenes",
  queryScope: "COLLECTION_GROUP",
  fields: [
    { fieldPath: "n", order: "ASCENDING" }
  ]
}

// reconstructionQueue
{
  collectionGroup: "reconstructionQueue",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "userId", order: "ASCENDING" },
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" }
  ]
}
```

---

## ⚠️ ВАЖЛИВІ ІНВАРІАНТИ

### Memory НЕ зберігається в Firestore
**Memory = View (SQL View)**, деривується на льоту з Canon:
```javascript
// ✅ ПРАВИЛЬНО:
const memory = deriveMemory(project.canon, sceneId);
// Memory live in RAM, passed to AI, never written to DB

// ❌ НЕПРАВИЛЬНО:
await db.collection('memory').add(memory); // НІ! Це створює друге джерело правди
```

**Canon → Memory View → AI Context**. Ніколи не персистити memory як окрему колекцію.

### reconstructionQueue — тимчасові завдання, НЕ дублікат канону
Queue зберігає **ШО треба зробити**, а не копію даних:
```javascript
// ✅ Queue item (task):
{
  changeType: "rename",        // Що сталося
  entityId: "marcus",          // З ким
  affectedScenes: [1, 3, 5],   // Що треба переписати
  status: "pending"            // Статус завдання
}
// Після виконання → deleted. Canon лишається єдиним джерелом.
```

**НЕ зберігати** старий/новий стан у queue — лише посилання на entity в Canon.

---

## 💾 Чому така структура?

### ✅ Canon у документі проєкту
- **Pros:** Атомарні updates, один read для всього канону, простота
- **Cons:** Обмеження 1MB (достатньо для ~200 персонажів + локацій)
- **Вердикт:** Оптимально для більшості проєктів

### ✅ Scenes як subcollection
- **Pros:** Необмежена кількість сцен, pagination, незалежні updates
- **Cons:** Окремі reads (але можна cache)
- **Вердикт:** Критично для масштабованості (100+ сцен)

### ✅ Narrative/Director як nested documents
- **Pros:** Групування логічних одиниць, менше reads
- **Cons:** Менш гнучко для великих масивів
- **Вердикт:** Arcs/Chapters/Dialogues рідко > 50 елементів

### ✅ Snapshots як subcollection
- **Pros:** Versioning, rollback, undo
- **Cons:** Збільшує storage
- **Вердикт:** Критично для production (autosave + manual snapshots)

---

## 🚀 Міграція з поточної структури

1. Лишити `scenes: []` в документі проєкту як deprecated
2. Створити subcollection `scenes` для нових сцен
3. Додати `users` collection для профілів
4. Додати `snapshots` для versioning
5. Оновити rules на production-ready

---

## 📊 Приклад документа проєкту

```json
{
  "id": "proj_xxx",
  "owner": "user_abc",
  "title": "Червоний сигнал",
  "desc": "Колонії Марса вмовкли...",
  "canon": {
    "world": { ... },
    "characters": {
      "marcus": { ... },
      "elena": { ... }
    },
    "locations": { ... },
    "events": { ... },
    "factions": { ... },
    "artifacts": { ... }
  },
  "createdAt": "2026-06-09T10:00:00Z",
  "updatedAt": "2026-06-09T12:30:00Z"
}
```

Scenes живуть у `projects/{projectId}/scenes/{sceneId}`.

---

**Готово для production?** Так, ця схема масштабується до тисяч проєктів і сотень тисяч сцен.
