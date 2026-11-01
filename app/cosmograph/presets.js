// Starting skies of the Космограф. A world stores its own copy in worlds/{w}.cosmos (normalize() fills the gaps).
// Earth: real values; t = 0 is midnight of 1 January at longitude 0 (the Sun's phase puts it just past the winter solstice).
// "Three suns" follows MorraSimulator's starting calibration (src/world/MorraConfig.ts) — any number of suns and moons works.
export const EARTH_MAP = "preset:earth"; // resolved to ./earth-blue-marble.jpg (NASA Blue Marble, public domain)

const UK_MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function preset(id, lang) {
  const en = lang === "en";
  if (id === "suns3") return {
    preset: "suns3",
    planet: { name: en ? "Three-sun world" : "Світ трьох сонць", radiusKm: 69911, tilt: 25, dayHours: 30, map: "" },
    calendar: { monthNames: [], monthDays: Array(12).fill(40), startYear: 1, era: "" },
    stars: [
      { id: "s1", name: en ? "Great sun" : "Велике сонце", color: "#ffcc88", radiusKm: 5500, distanceKm: 600000, periodDays: 365, inclination: 25, node: 0, phase: 0, eccentricity: 0, power: 1, reverse: false },
      { id: "s2", name: en ? "Middle sun" : "Середнє сонце", color: "#ffaa55", radiusKm: 7500, distanceKm: 440000, periodDays: 180, inclination: 0, node: 0, phase: 120, eccentricity: 0, power: 1, reverse: false },
      { id: "s3", name: en ? "Small sun" : "Мале сонце", color: "#ffffcc", radiusKm: 11000, distanceKm: 1000000, periodDays: 600, inclination: 90, node: 0, phase: 240, eccentricity: 0, power: 0.25, reverse: false },
    ],
    moons: [
      { id: "m1", name: en ? "North moon" : "Північна луна", color: "#cccccc", radiusKm: 5000, distanceKm: 200000, periodDays: 40, inclination: 90, node: 0, phase: 0, eccentricity: 0, reverse: false },
      { id: "m2", name: en ? "Equator moon" : "Екваторіальна луна", color: "#888888", radiusKm: 8000, distanceKm: 320000, periodDays: 67, inclination: 90, node: 90, phase: 0, eccentricity: 0, reverse: false },
    ],
  };
  return {
    preset: "earth",
    planet: { name: en ? "Earth" : "Земля", radiusKm: 6371, tilt: 23.44, dayHours: 24, map: EARTH_MAP },
    calendar: { monthNames: en ? EN_MONTHS : UK_MONTHS, monthDays: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], startYear: 2026, era: "" },
    stars: [{ id: "s1", name: en ? "Sun" : "Сонце", color: "#fff4e2", radiusKm: 696000, distanceKm: 149600000, periodDays: 365.2422, inclination: 0, node: 0, phase: 100.8, eccentricity: 0.0167, power: 1, reverse: false }],
    moons: [{ id: "m1", name: en ? "Moon" : "Місяць", color: "#d4d1cb", radiusKm: 1737, distanceKm: 384400, periodDays: 27.3217, inclination: 5.14, node: 0, phase: 0, eccentricity: 0.0549, reverse: false }],
  };
}

const n = (v, d, lo, hi) => { v = parseFloat(v); if (!isFinite(v)) v = d; if (lo !== undefined) v = Math.max(lo, v); if (hi !== undefined) v = Math.min(hi, v); return v; };
const body = (b, i, kind) => ({
  id: String(b.id || kind + (i + 1)), name: String(b.name || ""), color: /^#[0-9a-f]{6}$/i.test(b.color || "") ? b.color : (kind === "s" ? "#fff4e2" : "#cccccc"),
  radiusKm: n(b.radiusKm, 1000, 1), distanceKm: n(b.distanceKm, 100000, 1), periodDays: n(b.periodDays, 30, 0.01),
  inclination: n(b.inclination, 0, -180, 180), node: n(b.node, 0, -360, 360), phase: n(b.phase, 0, -360, 360), eccentricity: n(b.eccentricity, 0, 0, 0.95),
  power: n(b.power, 1, 0, 10), reverse: !!b.reverse,
});
export const MAX_BODIES = 4; // per kind: the planet shader takes up to 4 suns and 4 moons

export function normalize(c, lang) {
  if (!c || !c.planet) return preset("earth", lang);
  const p = c.planet, cal = c.calendar || {};
  const days = (Array.isArray(cal.monthDays) && cal.monthDays.length ? cal.monthDays : [30]).map((d) => Math.round(n(d, 30, 1, 1000)));
  return {
    preset: c.preset || "",
    planet: { name: String(p.name || ""), radiusKm: n(p.radiusKm, 6371, 1), tilt: n(p.tilt, 0, -90, 90), dayHours: n(p.dayHours, 24, 0.1), map: String(p.map || "") },
    calendar: { monthNames: (cal.monthNames || []).map(String).slice(0, days.length), monthDays: days, startYear: Math.round(n(cal.startYear, 1)), era: String(cal.era || "") },
    stars: (c.stars || []).slice(0, MAX_BODIES).map((b, i) => body(b, i, "s")),
    moons: (c.moons || []).slice(0, MAX_BODIES).map((b, i) => body(b, i, "m")),
  };
}
