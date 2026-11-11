// Starting skies of the Космограф. A world stores its own copy in worlds/{w}.cosmos (normalize() fills the gaps).
// Earth: real values; t = 0 is midnight of 1 January at longitude 0 (the Sun's phase puts it just past the winter solstice).
// "Three suns" follows MorraSimulator's starting calibration (src/world/MorraConfig.ts) — any number of suns and moons works.
import { calendarOf } from "./calendar.js";

export const EARTH_MAP = "preset:earth"; // resolved to ./earth-blue-marble.jpg (NASA Blue Marble, public domain)

const UK_MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function preset(id, lang) {
  const en = lang === "en";
  if (id === "suns3") return {
    preset: "suns3",
    planet: { name: en ? "Three-sun world" : "Світ трьох сонць", radiusKm: 69911, tilt: 25, dayHours: 30, map: "" },
    calendar: { year: "sun:s1", yearDays: 365, months: "none", monthNames: [], monthDays: [], startYear: 1, era: "" },
    stars: [
      { id: "s1", name: en ? "Great sun" : "Велике сонце", color: "#ffcc88", radiusKm: 5500, distanceKm: 600000, periodDays: 365, inclination: 25, node: 0, phase: 0, eccentricity: 0, power: 1, reverse: false },
      { id: "s2", name: en ? "Middle sun" : "Середнє сонце", color: "#ffaa55", radiusKm: 7500, distanceKm: 440000, periodDays: 180, inclination: 0, node: 0, phase: 120, eccentricity: 0, power: 1, reverse: false },
      { id: "s3", name: en ? "Small sun" : "Мале сонце", color: "#ffffcc", radiusKm: 11000, distanceKm: 1000000, periodDays: 600, inclination: 90, node: 0, phase: 240, eccentricity: 0, power: 0.25, heat: 2, reverse: false },
    ],
    moons: [
      { id: "m1", name: en ? "North moon" : "Північна луна", color: "#cccccc", radiusKm: 5000, distanceKm: 200000, periodDays: 40, inclination: 90, node: 0, phase: 0, eccentricity: 0, reverse: false },
      { id: "m2", name: en ? "Equator moon" : "Екваторіальна луна", color: "#888888", radiusKm: 8000, distanceKm: 320000, periodDays: 67, inclination: 90, node: 90, phase: 0, eccentricity: 0, reverse: false },
    ],
  };
  if (id === "binary") return { // two suns close together on one orbit (a binary seen from the planet): double shadows, double sunsets
    preset: "binary",
    planet: { name: en ? "Twin-sun world" : "Світ двох сонць", radiusKm: 7200, tilt: 18, dayHours: 26, map: "" },
    calendar: { year: "sun:s1", yearDays: 410, months: "moon:m1", monthNames: [], monthDays: [], startYear: 1, era: "" },
    stars: [
      { id: "s1", name: en ? "Elder sun" : "Старше сонце", color: "#ffe2b0", radiusKm: 700000, distanceKm: 160000000, periodDays: 410, inclination: 0, node: 0, phase: 0, eccentricity: 0.03, power: 0.8, heat: 1, reverse: false },
      { id: "s2", name: en ? "Red companion" : "Червоний супутник", color: "#ff8a5c", radiusKm: 380000, distanceKm: 175000000, periodDays: 410, inclination: 2, node: 40, phase: 6, eccentricity: 0.03, power: 0.35, heat: 1.4, reverse: false },
    ],
    moons: [{ id: "m1", name: en ? "Pale moon" : "Бліда луна", color: "#d9d6e8", radiusKm: 2100, distanceKm: 410000, periodDays: 31, inclination: 4, node: 0, phase: 140, eccentricity: 0.04, albedo: 0.14, reverse: false }],
  };
  return {
    preset: "earth",
    planet: { name: en ? "Earth" : "Земля", radiusKm: 6371, tilt: 23.44, dayHours: 24, map: EARTH_MAP },
    calendar: { year: "days", yearDays: 365, months: "list", monthNames: en ? EN_MONTHS : UK_MONTHS, monthDays: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], startYear: 2026, era: "" },
    stars: [{ id: "s1", name: en ? "Sun" : "Сонце", color: "#fff4e2", radiusKm: 696000, distanceKm: 149600000, periodDays: 365.2422, inclination: 0, node: 0, phase: 100.8, eccentricity: 0.0167, power: 1, heat: 1, reverse: false }],
    moons: [{ id: "m1", name: en ? "Moon" : "Місяць", color: "#d4d1cb", radiusKm: 1737, distanceKm: 384400, periodDays: 27.3217, inclination: 5.14, node: 0, phase: 0, eccentricity: 0.0549, albedo: 0.12, reverse: false }],
  };
}

const n = (v, d, lo, hi) => { v = parseFloat(v); if (!isFinite(v)) v = d; if (lo !== undefined) v = Math.max(lo, v); if (hi !== undefined) v = Math.min(hi, v); return v; };
const body = (b, i, kind) => ({
  id: String(b.id || kind + (i + 1)), name: String(b.name || ""), color: /^#[0-9a-f]{6}$/i.test(b.color || "") ? b.color : (kind === "s" ? "#fff4e2" : "#cccccc"),
  radiusKm: n(b.radiusKm, 1000, 1), distanceKm: n(b.distanceKm, 100000, 1), periodDays: n(b.periodDays, 30, 0.01),
  inclination: n(b.inclination, 0, -180, 180), node: n(b.node, 0, -360, 360), phase: n(b.phase, 0, -360, 360), eccentricity: n(b.eccentricity, 0, 0, 0.95),
  periapsis: n(b.periapsis, 0, -360, 360), lift: n(b.lift, 0, -80, 80), reverse: !!b.reverse,
  ...(kind === "s" ? { power: n(b.power, 1, 0, 10), heat: n(b.heat, 1, 0, 10) } // light and heat of a sun (MorraSimulator radiation profiles: light · heat)
    : { map: pic(b.map), albedo: n(b.albedo, 0.12, 0, 1) }), // a moon's picture (equirectangular, like the planet map; "" — the colour only) and how much light it gives back
});
// A picture reference: a preset id or an uploaded https URL; anything else (empty, a typo, javascript:…) — none.
const pic = (m) => (typeof m === "string" && (/^https:\/\//.test(m) || m === EARTH_MAP) ? m : "");
export const MAX_BODIES = 4; // per kind: the planet shader takes up to 4 suns and 4 moons

export function normalize(c, lang) {
  if (!c || !c.planet) return normalize(preset("earth", lang), lang);
  const p = c.planet, cal = c.calendar || {}, atm = p.atmosphere || {};
  const stars = (c.stars || []).slice(0, MAX_BODIES).map((b, i) => body(b, i, "s")), moons = (c.moons || []).slice(0, MAX_BODIES).map((b, i) => body(b, i, "m"));
  const has = (list, ref, pre) => typeof ref === "string" && ref.indexOf(pre) === 0 && list.some((b) => b.id === ref.slice(pre.length));
  // a sky saved before the calendar came from the bodies (v2.121): its comma lists become «own months»
  const legacy = !cal.months, list = legacy ? (Array.isArray(cal.monthDays) && cal.monthDays.length ? cal.monthDays : [30]) : (cal.monthDays || []);
  let months = legacy ? "list" : cal.months === "list" || cal.months === "none" || has(moons, cal.months, "moon:") ? cal.months : "none";
  const days = list.map((d) => Math.round(n(d, 30, 1, 1000))).slice(0, 100);
  if (months === "list" && !days.length) months = "none";
  const out = {
    preset: c.preset || "",
    planet: { name: String(p.name || ""), radiusKm: n(p.radiusKm, 6371, 1), tilt: n(p.tilt, 0, -90, 90), dayHours: n(p.dayHours, 24, 0.1), map: pic(p.map),
      night: n(p.night, 0.07, 0, 0.4), atmosphere: { on: atm.on !== false, color: /^#[0-9a-f]{6}$/i.test(atm.color || "") ? atm.color : "#5999ff" } },
    calendar: { year: has(stars, cal.year, "sun:") ? cal.year : "days", yearDays: n(cal.yearDays, days.reduce((a, b) => a + b, 0) || 365, 0.1, 100000), months,
      monthNames: (cal.monthNames || []).map((x) => String(x).slice(0, 40)).slice(0, 100), monthDays: months === "list" ? days : [],
      startYear: Math.round(n(cal.startYear, 1)), era: String(cal.era || "") },
    stars, moons,
  };
  out.calendar.yearDays = +calendarOf(out).yearDays.toFixed(4); // derived, for the server and the agent
  if (months === "list") out.calendar.monthNames = out.calendar.monthNames.slice(0, days.length);
  return out;
}
