// Canon Graph Schema — типи для Canon-Aware системи
// Based on handoff/CANON_SCHEMA.md

// ============================================================================
// CANON TYPES (Source of Truth)
// ============================================================================

export type CanonId = string; // opaque id, e.g. "char_8f3k2a"
export type CanonType = "characters" | "locations" | "events" | "factions" | "artifacts";

export type Provenance = "explicit" | "inferred";

export interface Origin {
  source: Provenance; // explicit = user created; inferred = AI suggested
  confidence?: number; // 0..1, only for inferred
  confirmed: boolean; // inferred becomes canon only after true
  createdBy: "user" | "ai" | "migration";
  updatedAt: number; // timestamp
}

export interface CanonBase {
  id: CanonId;
  slug: string; // "marcus-chen" for URLs/links
  name: string; // display name: "King Marcus"
  type: CanonType;
  origin: Origin;
  // Cross-links named by TARGET type (plural). Reverse is derived.
  characters?: CanonId[];
  locations?: CanonId[];
  events?: CanonId[];
  factions?: CanonId[];
  artifacts?: CanonId[];
}

// ── Canon Entities (extend CanonBase) ──

export interface CanonCharacter extends CanonBase {
  type: "characters";
  role: string; // ↔ Character.role
  trait: string; // ↔ Character.trait
  goal: string; // ↔ Character.goals
  developmentArc: string; // ↔ Character.developmentArc
  status?: string; // optional (alive/dead/missing)
  // relationships: typed, instead of string Character.relationships
  relations?: { id: CanonId; kind: string; tone?: string }[];
}

export interface CanonLocation extends CanonBase {
  type: "locations";
  atmos?: string[]; // atmosphere tags
  desc?: string; // description
}

export interface CanonEvent extends CanonBase {
  type: "events";
  when?: string; // timeline position
  act?: number; // story act
  desc?: string; // description
}

export interface CanonFaction extends CanonBase {
  type: "factions";
  motto?: string;
  align?: string; // alignment
  desc?: string;
}

export interface CanonArtifact extends CanonBase {
  type: "artifacts";
  rarity?: string;
  owner?: CanonId; // who owns it
  desc?: string;
}

export type CanonEntity =
  | CanonCharacter
  | CanonLocation
  | CanonEvent
  | CanonFaction
  | CanonArtifact;

// ── Narrative Layer (canon-aware, supports Story Navigation) ──

export interface SceneIntent {
  direction:
    | "conflict"
    | "character"
    | "action"
    | "romance"
    | "worldbuilding"
    | "twist"
    | "surprise"
    | "custom";
  note?: string; // for custom / clarification
}

export type SceneStatus = "Planned" | "Drafted" | "Analyzed" | "Improved" | "Adapted";
export type ReconStrategy = "auto" | "review" | "pinned";

export interface CanonScene {
  id: CanonId; // "scene_..."
  slug: string;
  title: string;
  description: string;
  characterGoals: string[]; // ↔ ArchitectScene.characterGoals
  conflicts: string[]; // ↔ ArchitectScene.conflicts
  status?: SceneStatus;
  // ── Story Navigation ──
  intent?: SceneIntent; // user-chosen direction
  writtenText?: string; // prose (when generated)
  recon?: ReconStrategy; // per-item strategy (replaces True History Lock); default "review" for written
  // ── canon links (for Impact) ──
  characters?: CanonId[];
  locations?: CanonId[];
  events?: CanonId[];
  factions?: CanonId[];
  artifacts?: CanonId[];
}

// ── Project Canon (root structure) ──

export interface ProjectCanon {
  characters: CanonCharacter[];
  locations: CanonLocation[];
  events: CanonEvent[];
  factions: CanonFaction[];
  artifacts: CanonArtifact[];
  world?: {
    facts?: { k: string; v: string }[];
    rules?: string[]; // worldRules → here
  };
  // narrative layer can stay in architecture, but scenes get id+intent+links
}

// ============================================================================
// NARRATIVE MEMORY (Derived View)
// ============================================================================

// This is the EXISTING shape that AIEngine / prompts / filtered-context expect.
// Canon → deriveMemory() → NarrativeMemory (same form, no code change needed).

export interface NarrativeMemory {
  characters: {
    name: string;
    role: string;
    trait: string;
    goals: string; // single string (canon uses `goal`)
    relationships: string; // semicolon-joined: "Marcus: ally; Elena: rival"
    developmentArc: string;
  }[];
  locations: string[]; // just names
  timeline: string[]; // "Act 1: Hero meets mentor", etc.
  worldRules: string[]; // laws of physics, magic system, etc.
  plotEvents: string[]; // major events
}

// ============================================================================
// PROJECT MODEL (Firestore document)
// ============================================================================

export interface Project {
  id: string;
  owner: string; // uid
  title: string;
  cover?: string; // URL
  scope?: string; // short/feature/series
  episodes?: number;
  ending?: string;
  genres?: string[];
  dialogueDensity?: number; // 0..100
  // ── Canon-Aware fields ──
  canon?: ProjectCanon; // ← source of truth
  canonAware?: boolean; // feature flag
  // ── Derived / cached ──
  memory?: NarrativeMemory; // CACHE = deriveMemory(canon), never written directly
  // ── Architecture (scenes with canon-links) ──
  architecture?: {
    acts?: { title: string; scenes: CanonScene[] }[];
    chapters?: { title: string; scenes: CanonScene[] }[];
    scenes?: CanonScene[];
  };
  // ── Director ──
  shots?: Shot[];
  storyboards?: Storyboard[];
  // ── Meta ──
  createdAt?: number;
  updatedAt?: number;
}

// ── Director types (placeholder) ──

export interface Shot {
  id: string;
  type: string;
  camera?: string;
  angle?: string;
  subject?: string;
  light?: string;
  moods?: string[];
  prompt?: string; // for image-gen
  dialogue?: DialogueLine[];
}

export interface DialogueLine {
  speaker: string;
  line: string;
  emotion?: string;
}

export interface Storyboard {
  id: string;
  title: string;
  shots: Shot[];
}

// ============================================================================
// USER MODEL
// ============================================================================

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  plan?: "gemini" | "claude"; // Gemini (cheap) / Claude (expensive)
  tokens?: number; // token counter
  createdAt: number;
  updatedAt: number;
}
