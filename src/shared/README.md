# Shared Types & Utilities

## Canon System

**Invariant: Canon = Source of Truth, Memory = View**

### Usage

```ts
import { ProjectCanon, deriveMemory } from '@shared';

// 1. Write to canon (never to memory directly)
const canon: ProjectCanon = {
  characters: [{
    id: 'char_abc123',
    slug: 'marcus-chen',
    name: 'King Marcus',
    type: 'characters',
    role: 'Protagonist',
    trait: 'Brave, conflicted',
    goal: 'Unite the kingdom',
    developmentArc: 'From soldier to king',
    origin: {
      source: 'explicit',
      confirmed: true,
      createdBy: 'user',
      updatedAt: Date.now()
    }
  }],
  locations: [],
  events: [],
  factions: [],
  artifacts: [],
  world: {
    rules: ['Magic requires sacrifice', 'No resurrection']
  }
};

// 2. Derive memory (this is a VIEW, not a copy)
const memory = deriveMemory(canon);

// 3. Use memory for AI context (existing AIEngine unchanged)
// memory.characters[0].name === 'King Marcus'
// memory.worldRules === ['Magic requires sacrifice', 'No resurrection']
```

### Key Types

- **`ProjectCanon`** - Source of truth (in Firestore `projects/{id}.canon`)
- **`NarrativeMemory`** - Derived view (cached in `projects/{id}.memory`)
- **`CanonEntity`** - Character | Location | Event | Faction | Artifact
- **Provenance**: `explicit` (user created) vs `inferred` (AI suggested, needs confirmation)

### Rules

1. **Never write `memory` directly** - always write to `canon`, then `memory = deriveMemory(canon)`
2. **Only confirmed canon goes to AI** - `inferred` entities must be confirmed by user first
3. **ID is stable** - rename changes `name`/`slug`, but `id` stays same (graph doesn't break)
