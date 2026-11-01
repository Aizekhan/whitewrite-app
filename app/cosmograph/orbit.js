// Orbit math of the Космограф — ported from MorraSimulator (src/astronomy/OrbitMath.ts, src/world/MorraContinents.ts),
// generalised: every body orbits the planet (the sky as seen from it), the orbital plane is the ecliptic, tilted
// against the planet's equator by its axial tilt — that tilt is what makes seasons.
import * as THREE from "three";

const deg = THREE.MathUtils.degToRad;

// Orbit basis in the XZ (equatorial) plane, turned by the ascending node, then inclined.
export function basis(inclination, node) {
  const n = deg(node || 0), base = { primary: new THREE.Vector3(1, 0, 0), secondary: new THREE.Vector3(0, 0, 1), normal: new THREE.Vector3(0, 1, 0) };
  const primary = base.primary.clone().multiplyScalar(Math.cos(n)).add(base.secondary.clone().multiplyScalar(Math.sin(n))).normalize();
  const secondary = primary.clone().cross(base.normal).normalize().applyAxisAngle(primary, deg(inclination || 0));
  return { primary, secondary, normal: primary.clone().cross(secondary).normalize() };
}

// Kepler's equation M = E − e·sin E (Newton with a bisection fallback, as in the simulator).
export function eccentricAnomaly(mean, e) {
  e = THREE.MathUtils.clamp(e || 0, 0, 0.999999);
  let m = mean % (Math.PI * 2);
  if (m > Math.PI) m -= Math.PI * 2;
  if (m < -Math.PI) m += Math.PI * 2;
  if (e < 1e-12) return m;
  let E = e < 0.8 ? m : Math.sign(m || 1) * Math.PI, ok = false;
  for (let i = 0; i < 32; i++) {
    const f = E - e * Math.sin(E) - m, d = 1 - e * Math.cos(E);
    if (Math.abs(d) < 1e-8) break;
    const c = THREE.MathUtils.clamp(f / d, -Math.PI / 2, Math.PI / 2);
    E -= c;
    if (Math.abs(c) < 1e-11) { ok = true; break; }
  }
  if (!ok) {
    let lo = -Math.PI, hi = Math.PI;
    for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (mid - e * Math.sin(mid) - m > 0) hi = mid; else lo = mid; }
    E = (lo + hi) / 2;
  }
  return E;
}

// Position (km, planet-centred) of a body at simulation hour t.
// body: { distance, eccentricity, periodDays, inclination, node, phase, reverse }; tiltDeg — the planet's axial tilt.
export function position(body, t, hoursInDay, tiltDeg) {
  const periodH = Math.max(1e-6, (body.periodDays || 1) * hoursInDay);
  const mean = deg(body.phase || 0) + (body.reverse ? -1 : 1) * (Math.PI * 2) * (t / periodH);
  const e = THREE.MathUtils.clamp(body.eccentricity || 0, 0, 0.99), a = Math.max(0, body.distance || 0), E = eccentricAnomaly(mean, e);
  const b = basis(body.inclination, body.node);
  const p = b.primary.multiplyScalar(a * (Math.cos(E) - e)).add(b.secondary.multiplyScalar(a * Math.sqrt(1 - e * e) * Math.sin(E)));
  return p.applyAxisAngle(new THREE.Vector3(1, 0, 0), deg(tiltDeg || 0)); // ecliptic → equatorial frame
}

// Longitude 0 at the map centre, positive to the east (right on the map), latitude +90 at the top.
export function latLonToDir(lat, lon) {
  const a = deg(lat), o = deg(lon), c = Math.cos(a);
  return new THREE.Vector3(c * Math.cos(o), Math.sin(a), -c * Math.sin(o));
}
export function dirToLatLon(v) {
  const n = v.clone().normalize();
  return { lat: THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(n.y, -1, 1))), lon: THREE.MathUtils.radToDeg(Math.atan2(-n.z, n.x)) };
}
