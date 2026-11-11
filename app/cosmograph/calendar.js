// The calendar of the Космограф: comes from the sky, not from comma lists.
//   calendar.year:   "sun:<id>" — a year is one orbit of that sun · "days" — calendar.yearDays planet days
//   calendar.months: "none" · "moon:<id>" — months follow that moon's phases (synodic month) · "list" — own months (monthNames[i], monthDays[i]; the year is their sum)
// calendar.yearDays is always written (derived) — the server (gamedev.js, mcp.js) reads it without knowing the sky.
export function synodic(moonDays, yearDays) { // a moon's phase cycle against the year sun (days); a moon slower than the year — its own period
  return yearDays > moonDays ? 1 / (1 / moonDays - 1 / yearDays) : moonDays;
}
export function calendarOf(cfg) {
  const c = cfg.calendar, find = (list, ref, p) => (typeof ref === "string" && ref.indexOf(p) === 0 ? list.find((b) => b.id === ref.slice(p.length)) : null);
  if (c.months === "list") {
    const months = c.monthDays.map((d, i) => ({ name: c.monthNames[i] || "", days: d }));
    return { yearDays: months.reduce((a, m) => a + m.days, 0), months };
  }
  const sun = find(cfg.stars, c.year, "sun:");
  const yearDays = sun ? sun.periodDays : c.yearDays;
  const moon = find(cfg.moons, c.months, "moon:");
  if (!moon) return { yearDays, months: [] };
  const syn = synodic(moon.periodDays, yearDays), N = Math.max(1, Math.min(100, Math.round(yearDays / syn)));
  return { yearDays, months: Array.from({ length: N }, (_, i) => ({ name: c.monthNames[i] || "", days: yearDays / N })), syn };
}
// date at simulation hour t
export function dateAt(cfg, cal, t) {
  const H = cfg.planet.dayHours, Yd = Math.max(1e-6, cal.yearDays), all = t / H, yi = Math.floor(all / Yd), dy = all - yi * Yd;
  let m = -1, acc = 0, day = Math.floor(dy) + 1;
  for (let i = 0; i < cal.months.length; i++) { if (dy < acc + cal.months[i].days || i === cal.months.length - 1) { m = i; day = Math.floor(dy - acc) + 1; break; } acc += cal.months[i].days; }
  const hr = ((t % H) + H) % H, hh = Math.floor(hr);
  return { year: cfg.calendar.startYear + yi, yi, month: m, day, doy: Math.floor(dy) + 1, hh, mm: Math.floor((hr - hh) * 60), frac: dy / Yd };
}
