// Sky events of one year (the simulator only flagged eclipses live; here they are found ahead): eclipses by moons, a sun passing
// in front of a sun, lunar eclipses, equinoxes and solstices of the year sun. Sampled, then each start refined by bisection.
import { snapshot, eclipsesNow, subLat } from "./astro.js";

const MAX = 300;
export function scanEvents(cfg, t0, t1) {
  const H = cfg.planet.dayHours, out = [];
  if (!cfg.stars.length) return out;
  // a step short enough to catch the shortest passage: the fastest pair crosses its window (≈ 2·(sizes)) in at least 4 steps
  let step = H / 6;
  const snap0 = snapshot(cfg, t0);
  snap0.moons.concat(snap0.suns).forEach((o) => {
    const P = o.b.periodDays * H, win = 2 * Math.max(0.002, o.ang + Math.max(...snap0.suns.map((s) => s.ang)));
    step = Math.min(step, (P * win) / (2 * Math.PI) / 4);
  });
  step = Math.max(step, (t1 - t0) / 40000); // a hard cap on the work
  const key = (e) => e.kind + ":" + e.sun.b.id + ":" + e.by.b.id;
  const at = (t) => { const s = snapshot(cfg, t); return { s, ev: eclipsesNow(cfg, s).filter((e) => e.mag > 0.002) }; };
  let open = new Map(), prev = at(t0), prevT = t0;
  prev.ev.forEach((e) => open.set(key(e), { t: t0, end: t0, kind: e.kind, sun: e.sun.b.name, by: e.by.b.name, mag: e.mag, peak: t0 }));
  const yearSun = cfg.stars[0]; let decPrev = subLat(prev.s.suns[0]), dDec = 0;
  for (let t = t0 + step; t <= t1 && out.length < MAX; t += step) {
    const cur = at(t), now = new Map();
    cur.ev.forEach((e) => now.set(key(e), e));
    now.forEach((e, k) => {
      const o = open.get(k);
      if (o) { o.end = t; if (e.mag > o.mag) { o.mag = e.mag; o.peak = t; } }
      else { // refine the start between the two samples
        let lo = prevT, hi = t;
        for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (at(mid).ev.some((x) => key(x) === k)) hi = mid; else lo = mid; }
        open.set(k, { t: hi, end: t, kind: e.kind, sun: e.sun.b.name, by: e.by.b.name, mag: e.mag, peak: t });
      }
    });
    open.forEach((o, k) => { if (!now.has(k)) { out.push(o); open.delete(k); } });
    // equinox: the year sun crosses the equator; solstice: it turns back (only when it really moves north and south)
    const dec = subLat(cur.s.suns[0]), d = dec - decPrev;
    if (Math.sign(dec) !== Math.sign(decPrev) && decPrev !== 0) out.push({ t, kind: "equinox", sun: yearSun.name, north: dec > 0 });
    if (dDec && Math.sign(d) !== Math.sign(dDec) && Math.abs(dec) > 1) out.push({ t, kind: "solstice", sun: yearSun.name, north: dec > 0, lat: dec });
    if (d) dDec = d; decPrev = dec; prev = cur; prevT = t;
  }
  open.forEach((o) => out.push(o));
  return out.sort((a, b) => a.t - b.t).slice(0, MAX);
}
