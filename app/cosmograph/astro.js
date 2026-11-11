// Astronomy of the Космограф shared by the picture, the point inspector, the sky events and the tests — the shader does the same per pixel.
// Every body orbits the planet (planet-centred equatorial frame, km, y = north). Light falls off with the square of the distance
// against the body's mean distance (MorraSimulator RadiationEngine: (R/d)² — here normalised so a sun at its mean distance gives its power),
// a disc covers a disc by their angular sizes (MorraSimulator circleOverlap, the same approximation as the shader), moons reflect the suns.
import * as THREE from "three";
import { position, dirToLatLon } from "./orbit.js";

const D = THREE.MathUtils.radToDeg, Y = new THREE.Vector3(0, 1, 0);
export const angR = (r, d) => Math.asin(Math.min(1, r / Math.max(d, 1e-9)));
// how much of a disc of angular radius as is covered by a disc of ao at separation sep (0..1)
export function cover(as, ao, sep) {
  if (sep >= as + ao) return 0;
  const o = Math.min(1, Math.max(0, (as + ao - sep) / (2 * Math.min(as, ao))));
  return o * Math.min(1, (ao * ao) / (as * as));
}
const sepOf = (a, b) => a.angleTo(b);

// The drawn orbit never dips into the planet: the closest point stays beyond both radii + 2% (the saved value stays as typed).
export function truePos(cfg, b, t) {
  const Rp = cfg.planet.radiusKm;
  return position({ distance: Math.max(b.distanceKm, ((Rp + b.radiusKm) * 1.02) / (1 - b.eccentricity)), eccentricity: b.eccentricity, periodDays: b.periodDays,
    inclination: b.inclination, node: b.node, periapsis: b.periapsis, lift: b.lift, phase: b.phase, reverse: b.reverse }, t, cfg.planet.dayHours, cfg.planet.tilt);
}
export const meanDist = (cfg, b) => Math.max(b.distanceKm, ((cfg.planet.radiusKm + b.radiusKm) * 1.02) / (1 - b.eccentricity));
// a sun's light here and now against its mean distance: an eccentric orbit gives brighter and darker seasons
export const flux = (cfg, b, d) => Math.min(4, b.power * Math.pow(meanDist(cfg, b) / d, 2));
export const spinAngle = (cfg, spin, t) => THREE.MathUtils.degToRad(spin.l0 + spin.rate * t);

// The planet turns so that the solar day of the first sun lasts exactly dayHours, and t = 0 is midnight at longitude 0.
export function spinOf(cfg) {
  const H = cfg.planet.dayHours, s = cfg.stars[0];
  if (!s) return { l0: 0, rate: 360 / H };
  const lon = (v) => dirToLatLon(v).lon, s0 = truePos(cfg, s, 0), s1 = truePos(cfg, s, H / 50);
  let dl = lon(s1) - lon(s0); if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
  return { l0: lon(s0) - 180, rate: 360 / H + Math.sign(dl || 1) * 360 / (s.periodDays * H) };
}

// Positions of everything at t (km), with angular radii seen from the planet's centre.
export function snapshot(cfg, t) {
  const one = (b, kind) => { const p = truePos(cfg, b, t), d = p.length(); return { b, kind, p, d, dir: p.clone().divideScalar(d), ang: angR(b.radiusKm, d) }; };
  return { suns: cfg.stars.map((b) => one(b, "s")), moons: cfg.moons.map((b) => one(b, "m")) };
}

// A moon's lit share as seen from the planet (1 — full) and the planet's shadow on it for each sun (0..1, a lunar eclipse).
export function moonState(cfg, snap, m) {
  let lit = 0, w = 0, inShadow = 0;
  const toPlanet = m.p.clone().negate().normalize(), Rp = cfg.planet.radiusKm;
  snap.suns.forEach((s) => {
    const toSun = s.p.clone().sub(m.p), ds = toSun.length(); toSun.divideScalar(ds);
    const shade = cover(angR(s.b.radiusKm, ds), angR(Rp, m.d), sepOf(toSun, toPlanet)); // the planet in front of the sun, seen from the moon
    const f = flux(cfg, s.b, ds) * (1 - shade), phase = (1 + toSun.dot(toPlanet)) / 2;
    lit += f * phase; w += flux(cfg, s.b, ds); inShadow = Math.max(inShadow, shade);
  });
  return { lit: w ? lit / w : 0, light: lit, shadow: inShadow };
}
// how strong a moon's light is on the night side (display scale: Earth's full Moon ≈ 1)
export function moonGlow(cfg, snap, m, st) {
  st = st || moonState(cfg, snap, m);
  return Math.min(3, st.light * ((m.b.albedo == null ? 0.12 : m.b.albedo) / 0.12) * Math.pow(m.ang / 0.0045, 2));
}

// Occlusion of one sun from a point p (km) by the moons and the nearer suns (0..1) and who covers it.
function covered(snap, p, s) {
  const l = s.p.clone().sub(p), ds = l.length(); l.divideScalar(ds);
  const as = angR(s.b.radiusKm, ds); let best = 0, by = null;
  snap.moons.concat(snap.suns).forEach((o) => {
    if (o === s) return;
    const v = o.p.clone().sub(p), dv = v.length(); if (dv >= ds) return; v.divideScalar(dv);
    const c = cover(as, angR(o.b.radiusKm, dv), sepOf(l, v)); if (c > best) { best = c; by = o; }
  });
  return { c: best, by, dir: l, d: ds };
}

// The sky above a point of the surface (lat/lon on the map) at t: every body's elevation, azimuth, light, heat, phase.
export function skyAt(cfg, snap, spinRad, lat, lon) {
  const a = THREE.MathUtils.degToRad(lat), o = THREE.MathUtils.degToRad(lon), c = Math.cos(a);
  const n = new THREE.Vector3(c * Math.cos(o), Math.sin(a), -c * Math.sin(o)).applyAxisAngle(Y, spinRad), p = n.clone().multiplyScalar(cfg.planet.radiusKm);
  let east = Y.clone().cross(n); if (east.lengthSq() < 1e-8) east.set(1, 0, 0); east.normalize();
  const north = n.clone().cross(east);
  const where = (dir) => ({ el: D(Math.asin(Math.max(-1, Math.min(1, dir.dot(n))))), az: (D(Math.atan2(dir.dot(east), dir.dot(north))) + 360) % 360 });
  const out = { light: 0, heat: 0, suns: [], moons: [] };
  snap.suns.forEach((s) => {
    const k = covered(snap, p, s), w = where(k.dir), inc = Math.max(0, k.dir.dot(n)), f = flux(cfg, s.b, k.d);
    const light = f * inc * (1 - k.c), heat = (s.b.heat == null ? 1 : s.b.heat) * light;
    out.light += light; out.heat += heat;
    out.suns.push({ name: s.b.name, color: s.b.color, el: w.el, az: w.az, light, heat, eclipse: inc > 0 ? k.c : 0, by: k.by && k.c > 0.001 && inc > 0 ? k.by.b.name : "", ang: s.ang });
  });
  snap.moons.forEach((m) => {
    const v = m.p.clone().sub(p).normalize(), w = where(v), st = moonState(cfg, snap, m);
    out.moons.push({ name: m.b.name, color: m.b.color, el: w.el, az: w.az, phase: st.lit, shadow: st.shadow, glow: w.el > 0 ? moonGlow(cfg, snap, m, st) * Math.sin(THREE.MathUtils.degToRad(w.el)) : 0, ang: m.ang });
  });
  return out;
}

// Where a sun stands overhead right now (its declination is the latitude).
export const subLat = (b) => D(Math.asin(Math.max(-1, Math.min(1, b.dir.y))));

// Eclipses seen from the planet as a whole (MorraSimulator AstronomicalEventSystem, plus parallax: visible somewhere on the surface).
export function eclipsesNow(cfg, snap) {
  const out = [], Rp = cfg.planet.radiusKm;
  snap.suns.forEach((s) => {
    snap.moons.concat(snap.suns).forEach((o) => {
      if (o === s || o.d >= s.d) return;
      const sep = sepOf(s.dir, o.dir), par = angR(Rp, o.d) - angR(Rp, s.d);
      if (sep < s.ang + o.ang + par) out.push({ kind: o.kind === "m" ? "solar" : "transit", sun: s, by: o, mag: cover(s.ang, o.ang, Math.max(0, sep - par)) });
    });
    snap.moons.forEach((m) => { // the moon in the planet's shadow
      const sep = sepOf(m.dir, s.dir.clone().negate()), pen = angR(Rp, m.d) + s.ang;
      if (sep < pen + m.ang) out.push({ kind: "lunar", sun: s, by: m, mag: moonState(cfg, snap, m).shadow });
    });
  });
  return out;
}
