// handoff/extractCanonPrompt.ts — new AIEngine mode EXTRACT_CANON.
// One-time migration backfill: existing (memory + architecture + text) → Canon*.
// Everything it returns is INFERRED (confirmed:false) → goes to a confirm queue,
// never straight into authoritative canon. Reuses the existing Gemini pipeline.
import type { NarrativeMemory, StoryArchitecture } from "../types";

export const EXTRACT_CANON_SYSTEM = `
You extract a NORMALIZED CANON GRAPH from an existing story project.
You DO NOT invent facts. Only surface entities/links explicitly supported by the
provided Narrative Memory, Architecture and Text. If unsure, lower the confidence.

For every entity output: a stable opaque id ("char_xxxx", "loc_xxxx", "evt_xxxx",
"fac_xxxx", "art_xxxx"), a url slug, a display name, and cross-links to other
entities BY THEIR id. Links are typed by target type (characters/locations/events/
factions/artifacts). Relationships between characters carry a short "kind".

CRITICAL:
- Output is treated as INFERRED (proposals), not truth.
- Give each entity & link a confidence 0..1.
- Reuse the SAME id when the same entity recurs.
- Keep names in the project's language. Do not translate.
- Do not duplicate entities that already exist (match by name, case-insensitive).
`.trim();

// JSON schema for the backend's responseProperties (Gemini structured output).
export const EXTRACT_CANON_RESPONSE_PROPERTIES = {
  type: "object",
  properties: {
    canon: {
      type: "object",
      properties: {
        characters: { type: "array", items: { type: "object", properties: {
          id: { type: "string" }, slug: { type: "string" }, name: { type: "string" },
          role: { type: "string" }, trait: { type: "string" }, goal: { type: "string" },
          developmentArc: { type: "string" },
          relations: { type: "array", items: { type: "object", properties: {
            id: { type: "string" }, kind: { type: "string" }, confidence: { type: "number" },
          }, required: ["id", "kind"] } },
          locations: { type: "array", items: { type: "string" } },
          factions: { type: "array", items: { type: "string" } },
          artifacts: { type: "array", items: { type: "string" } },
          events: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        }, required: ["id", "name", "role", "confidence"] } },
        locations: { type: "array", items: { type: "object", properties: {
          id: { type: "string" }, slug: { type: "string" }, name: { type: "string" },
          desc: { type: "string" }, confidence: { type: "number" },
        }, required: ["id", "name", "confidence"] } },
        events: { type: "array", items: { type: "object", properties: {
          id: { type: "string" }, slug: { type: "string" }, name: { type: "string" },
          when: { type: "string" }, act: { type: "number" },
          characters: { type: "array", items: { type: "string" } },
          locations: { type: "array", items: { type: "string" } },
          confidence: { type: "number" },
        }, required: ["id", "name", "confidence"] } },
        factions: { type: "array", items: { type: "object", properties: {
          id: { type: "string" }, slug: { type: "string" }, name: { type: "string" },
          align: { type: "string" }, desc: { type: "string" }, confidence: { type: "number" },
        }, required: ["id", "name", "confidence"] } },
        artifacts: { type: "array", items: { type: "object", properties: {
          id: { type: "string" }, slug: { type: "string" }, name: { type: "string" },
          owner: { type: "string" }, desc: { type: "string" }, confidence: { type: "number" },
        }, required: ["id", "name", "confidence"] } },
        world: { type: "object", properties: { rules: { type: "array", items: { type: "string" } } } },
      },
    },
  },
  required: ["canon"],
};

// Builds the user prompt from existing project data.
export function buildExtractCanonInput(opts: {
  memory: NarrativeMemory; architecture?: StoryArchitecture; text?: string;
}): string {
  const { memory, architecture, text } = opts;
  return [
    "=== NARRATIVE MEMORY ===",
    JSON.stringify(memory, null, 2),
    architecture ? "=== ARCHITECTURE ===\n" + JSON.stringify(architecture, null, 2) : "",
    text ? "=== CURRENT TEXT (excerpt) ===\n" + text.slice(0, 6000) : "",
    "",
    "Extract the canon graph. Mark every item with a confidence. Reuse ids for recurring entities.",
  ].filter(Boolean).join("\n\n");
}

// Post-process: stamp Origin so nothing becomes authoritative on import.
export function asInferredCanon(raw: any) {
  const stamp = (e: any) => ({
    ...e,
    slug: e.slug || slugify(e.name),
    origin: { source: "inferred", confidence: e.confidence ?? 0.5, confirmed: false, createdBy: "migration", updatedAt: Date.now() },
  });
  const c = raw.canon || {};
  return {
    characters: (c.characters || []).map(stamp),
    locations: (c.locations || []).map(stamp),
    events: (c.events || []).map(stamp),
    factions: (c.factions || []).map(stamp),
    artifacts: (c.artifacts || []).map(stamp),
    world: c.world || { rules: [] },
  };
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[«»"']/g, "").replace(/[^a-z0-9а-яіїєґ]+/gi, "-").replace(/^-+|-+$/g, "");
