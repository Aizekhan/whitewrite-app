// Canon → NarrativeMemory (View)
// Single derivation point. Call after ANY canon write:
//   canon = applyToCanon(...);  memory = deriveMemory(canon);
// Never write `memory` directly anywhere else.

import type { NarrativeMemory, ProjectCanon, CanonBase, CanonId } from './types';

// Only EXPLICIT or user-CONFIRMED canon is authoritative; inferred-unconfirmed
// never reaches AI context.
const authoritative = <T extends CanonBase>(arr: T[] = []): T[] =>
  arr.filter((e) => e.origin?.source === "explicit" || e.origin?.confirmed === true);

const nameOf = (canon: ProjectCanon, id: CanonId): string => {
  for (const k of ["characters", "locations", "events", "factions", "artifacts"] as const) {
    const hit = (canon[k] as CanonBase[] | undefined)?.find((e) => e.id === id);
    if (hit) return hit.name;
  }
  return id; // fallback to id if the target was filtered out / missing
};

/**
 * Derives NarrativeMemory from ProjectCanon.
 * This is the ONLY way to get memory — never write memory directly.
 *
 * Invariant: Canon = Source of Truth, Memory = View
 */
export function deriveMemory(canon: ProjectCanon): NarrativeMemory {
  const chars = authoritative(canon.characters);
  const events = authoritative(canon.events);

  return {
    characters: chars.map((c) => ({
      name: c.name,
      role: c.role,
      trait: c.trait,
      goals: c.goal, // NarrativeMemory uses `goals` (string); canon uses `goal`
      relationships: (c.relations ?? [])
        .map((r) => `${nameOf(canon, r.id)}: ${r.kind}`)
        .join("; "),
      developmentArc: c.developmentArc,
    })),
    locations: authoritative(canon.locations).map((l) => l.name),
    timeline: events.map((e) => (e.when ? `${e.when}: ${e.name}` : e.name)),
    worldRules: canon.world?.rules ?? [],
    plotEvents: events.map((e) => e.name),
  };
}
