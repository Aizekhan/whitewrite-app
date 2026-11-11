// Космограф — the sky of a world: a planet with its map, any suns and moons (up to 4 + 4), a calendar that comes from the sky, time.
// Light by distance, eclipses (moons, suns, the planet's shadow on the moons), moonlight, map layers, the sky above a point, the year's events (astro.js, calendar.js, events.js).
// A generalised port of MorraSimulator (D:\MorraSimulator\morra-simulator): orbit math, map conventions and the
// "light on the map" idea come from there; Morra's own physics (magic, radiation roles, magosphere) stays in Morra.
// ES module loaded on demand by gamebible.js: import("./cosmograph/cosmograph.js").then(m => m.mountCosmograph(el, opts)).
//   opts: { config, lang, S (strings), canEdit, onSave(config) → Promise, onUploadMap(file) → Promise<url>, confirm(text) → Promise<bool> }
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { dirToLatLon } from "./orbit.js";
import { preset, normalize, EARTH_MAP, MAX_BODIES } from "./presets.js";
import { truePos, snapshot, spinOf, skyAt, moonState, moonGlow, eclipsesNow, subLat, flux, angR, cover } from "./astro.js";
import { calendarOf, dateAt } from "./calendar.js";
import { scanEvents } from "./events.js";

const UK = {
  dayW: "День", monthW: "місяць", play: "Пуск", pause: "Пауза", speed: "Швидкість", year: "Рік", day: "день", edit: "Налаштувати небо", close: "Закрити", save: "Зберегти небо",
  saved: "Небо збережено.", planet: "Планета", name: "Назва", radius: "Радіус, км", tilt: "Нахил осі, °", dayH: "Доба, годин", map: "Карта поверхні",
  mapUpload: "Завантажити карту (рівнокутна 2:1)", mapEarth: "Карта Землі", mapNone: "Без карти", calendar: "Календар",
  yearIs: "Рік триває", yearSun: "один оберт «{n}» ({d} дн)", yearOwn: "свою кількість днів", yearDays: "Днів у році", monthsAre: "Місяці",
  mNone: "без місяців", mMoon: "за фазами «{n}»", mList: "свої — назви й дні", mName: "Місяць {i}", mDays: "днів", addMonth: "＋ Місяць",
  calSum: "Рік {y} дн · доба {h} год · {m}", monthsN: "місяців: {n} по {d} дн", noMonths: "без місяців", listYear: "Рік — сума днів місяців.",
  startYear: "Перший рік", era: "Ера (підпис)", stars: "Сонця", moons: "Супутники", addStar: "＋ Сонце", addMoon: "＋ Супутник", color: "Колір",
  dist: "Відстань, км", period: "Період, діб", incl: "Нахил орбіти, °", node: "Вузол, °", periapsis: "Перицентр, °", lift: "Зсув площини, °",
  phase: "Де на старті, °", ecc: "Ексцентриситет", power: "Світло", heat: "Тепло", albedo: "Відбиває світла (0–1)", reverse: "Назустріч", remove: "Прибрати",
  adv: "Орбіта детальніше", presets: "Почати з пресету", pEarth: "Земля", pSuns: "Три сонця", pBinary: "Два сонця", presetQ: "Замінити поточне небо пресетом?",
  look: "Вигляд планети", night: "Яскравість нічного боку", atmo: "Атмосфера", atmoCol: "Колір атмосфери",
  tipIncl: "Кут між орбітою й площиною руху головного сонця", tipNode: "Куди повернута лінія, де орбіта перетинає цю площину",
  tipPeri: "Де на орбіті тіло найближче (коли ексцентриситет більший за 0)", tipLift: "Тримає тіло завжди над північчю (+) чи півднем (−)",
  tipPhase: "Де на орбіті тіло стоїть у момент 0", tipEcc: "0 — коло; ближче до 1 — витягнутий еліпс: світло й розмір змінюються за оберт",
  tipPower: "1 — як Сонце над Землею на середній відстані; ближче — яскравіше, далі — тьмяніше", tipHeat: "Відносне тепло на поверхні (без інерції клімату)",
  tipAlbedo: "Скільки сонячного світла супутник повертає на нічний бік (Місяць — 0,12)", tipRev: "Рух у зворотний бік",
  point: "Точка", lat: "Шир.", lon: "Довг.", local: "Місцевий час", none: "нікого — ніч",
  hint: "Клікни на планету — побачиш місцевий час, світло й небо над точкою. Клікни на сонце чи супутник — побачиш його.",
  maxBodies: "Не більше 4", uploading: "Завантажую картинку…",
  speeds: [["1 год/с", 1], ["1 доба/с", "d"], ["1 тиждень/с", "w"], ["1 місяць/с", "m"], ["1 рік/с", "y"], ["10 років/с", "10y"]],
  moonPic: "⤒ Картинка супутника", colourOnly: "Лише колір", mapNow: "Зараз", mapOwn: "своя карта", mapGen: "згенерована за назвою", picOwn: "своя картинка", picNone: "лише колір",
  unsaved: "● Є незбережені зміни", notImage: "Це не картинка — потрібен JPG, PNG або WebP.", picFailed: "Не вдалося відкрити картинку — показую запасну.",
  view: "Вигляд", orbits: "Орбіти", labels: "Підписи", axis: "Вісь і екватор", layer: "Шар",
  layers: ["Звичайний", "Світло", "Тепло", "Тіні затемнень", "Скільки сонць"],
  legend: ["", "темно → яскраво", "холодно → жарко (відносно)", "червоне — тінь затемнення", "сонць над горизонтом: 0 · 1 · 2 · 3 · 4"],
  camHome: "⌂ Планета", camTop: "З півночі", camAll: "Уся система", prevDay: "−1 доба", nextDay: "+1 доба",
  events: "Події року", evTitle: "Події неба · {y}", evNone: "Цього року нічого особливого.", evPrev: "‹ рік", evNext: "рік ›", evCounting: "Рахую…",
  evSolar: "«{b}» закриває «{s}»", evTransit: "«{b}» проходить перед «{s}»", evLunar: "«{b}» у тіні планети", evEquinox: "Рівнодення «{s}»",
  evSolstice: "Сонцестояння «{s}» — над {lat}", evMax: "до {p}%", evDur: "{h} год", evHint: "Клікни подію — небо перейде до неї.",
  ecSolar: "☀ «{b}» закриває «{s}» · {p}%", ecLunar: "● «{b}» у тіні планети · {p}%", ecTransit: "☀ «{b}» перед «{s}» · {p}%",
  light: "Світло", heatW: "Тепло", elev: "висота {e}°", below: "під горизонтом", phaseW: "фаза {p}%", inShadow: "у тіні планети {p}%",
  eclipsed: "закрите на {p}% («{b}»)", moonlight: "місячне світло", overhead: "у зеніті над {lat}", distNow: "Зараз: {d} км", angSize: "видно {a}°",
  north: "пн. ш.", south: "пд. ш.", dayS: "день", nightS: "ніч", twilight: "сутінки", compass: ["Пн", "Сх", "Пд", "Зх"], sun: "Сонце", moon: "Супутник",
  equator: "екватором",
};
const EN = {
  dayW: "Day", monthW: "month", play: "Play", pause: "Pause", speed: "Speed", year: "Year", day: "day", edit: "Set up the sky", close: "Close", save: "Save the sky",
  saved: "Sky saved.", planet: "Planet", name: "Name", radius: "Radius, km", tilt: "Axial tilt, °", dayH: "Day, hours", map: "Surface map",
  mapUpload: "Upload a map (equirectangular 2:1)", mapEarth: "Earth map", mapNone: "No map", calendar: "Calendar",
  yearIs: "A year lasts", yearSun: "one orbit of «{n}» ({d} d)", yearOwn: "its own number of days", yearDays: "Days in a year", monthsAre: "Months",
  mNone: "no months", mMoon: "by the phases of «{n}»", mList: "own — names and days", mName: "Month {i}", mDays: "days", addMonth: "＋ Month",
  calSum: "Year {y} d · day {h} h · {m}", monthsN: "{n} months of {d} d", noMonths: "no months", listYear: "The year is the sum of the months.",
  startYear: "First year", era: "Era (label)", stars: "Suns", moons: "Moons", addStar: "＋ Sun", addMoon: "＋ Moon", color: "Colour",
  dist: "Distance, km", period: "Period, days", incl: "Orbit inclination, °", node: "Node, °", periapsis: "Periapsis, °", lift: "Plane shift, °",
  phase: "Where at start, °", ecc: "Eccentricity", power: "Light", heat: "Heat", albedo: "Reflects light (0–1)", reverse: "Retrograde", remove: "Remove",
  adv: "Orbit in detail", presets: "Start from a preset", pEarth: "Earth", pSuns: "Three suns", pBinary: "Two suns", presetQ: "Replace the current sky with a preset?",
  look: "Planet look", night: "Night side brightness", atmo: "Atmosphere", atmoCol: "Atmosphere colour",
  tipIncl: "Angle between the orbit and the main sun's plane", tipNode: "Where the line the orbit crosses that plane points",
  tipPeri: "Where on the orbit the body is closest (eccentricity above 0)", tipLift: "Keeps the body always over the north (+) or the south (−)",
  tipPhase: "Where on the orbit the body stands at time 0", tipEcc: "0 — a circle; towards 1 — a long ellipse: light and size change along the orbit",
  tipPower: "1 — like the Sun over Earth at its mean distance; nearer is brighter, farther dimmer", tipHeat: "Relative heat on the surface (no climate inertia)",
  tipAlbedo: "How much sunlight the moon gives back to the night side (the Moon — 0.12)", tipRev: "Moves the other way",
  point: "Point", lat: "Lat", lon: "Lon", local: "Local time", none: "nobody — night",
  hint: "Click the planet to see the local time, the light and the sky above that point. Click a sun or a moon to see it.",
  maxBodies: "At most 4", uploading: "Uploading the picture…",
  speeds: [["1 h/s", 1], ["1 day/s", "d"], ["1 week/s", "w"], ["1 month/s", "m"], ["1 year/s", "y"], ["10 years/s", "10y"]],
  moonPic: "⤒ Moon picture", colourOnly: "Colour only", mapNow: "Now", mapOwn: "own map", mapGen: "generated from the name", picOwn: "own picture", picNone: "colour only",
  unsaved: "● Unsaved changes", notImage: "This is not a picture — use JPG, PNG or WebP.", picFailed: "Could not open the picture — showing a fallback.",
  view: "View", orbits: "Orbits", labels: "Labels", axis: "Axis and equator", layer: "Layer",
  layers: ["Normal", "Light", "Heat", "Eclipse shadows", "How many suns"],
  legend: ["", "dark → bright", "cold → hot (relative)", "red — an eclipse shadow", "suns above the horizon: 0 · 1 · 2 · 3 · 4"],
  camHome: "⌂ Planet", camTop: "From the north", camAll: "Whole system", prevDay: "−1 day", nextDay: "+1 day",
  events: "Events of the year", evTitle: "Sky events · {y}", evNone: "Nothing special this year.", evPrev: "‹ year", evNext: "year ›", evCounting: "Counting…",
  evSolar: "«{b}» covers «{s}»", evTransit: "«{b}» passes in front of «{s}»", evLunar: "«{b}» in the planet's shadow", evEquinox: "Equinox of «{s}»",
  evSolstice: "Solstice of «{s}» — over {lat}", evMax: "up to {p}%", evDur: "{h} h", evHint: "Click an event — the sky jumps to it.",
  ecSolar: "☀ «{b}» covers «{s}» · {p}%", ecLunar: "● «{b}» in the planet's shadow · {p}%", ecTransit: "☀ «{b}» in front of «{s}» · {p}%",
  light: "Light", heatW: "Heat", elev: "altitude {e}°", below: "below the horizon", phaseW: "phase {p}%", inShadow: "in the planet's shadow {p}%",
  eclipsed: "covered {p}% («{b}»)", moonlight: "moonlight", overhead: "overhead at {lat}", distNow: "Now: {d} km", angSize: "seen {a}°",
  north: "N", south: "S", dayS: "day", nightS: "night", twilight: "twilight", compass: ["N", "E", "S", "W"], sun: "Sun", moon: "Moon",
  equator: "the equator",
};

const CSS = `
.cg{ position:relative; height:100%; min-height:420px; border-radius:14px; overflow:hidden; background:#020205; border:1px solid rgba(255,255,255,.08); }
.cg canvas{ display:block; width:100%; height:100%; cursor:grab; }
.cg-hud{ position:absolute; left:14px; top:12px; display:grid; gap:6px; pointer-events:none; }
.cg-date{ font:600 20px "Cinzel",serif; color:#f6cf7e; text-shadow:0 1px 6px #000; }
.cg-time{ font:500 13px "Inter",sans-serif; color:#c7c2bb; text-shadow:0 1px 4px #000; }
.cg-bar{ position:absolute; left:12px; right:12px; bottom:12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.cg-bar button,.cg-bar select,.cg-panel button,.cg-panel select{ background:#16161ae6; color:#f3efe7; border:1px solid rgba(255,255,255,.14); border-radius:8px; padding:6px 11px; font:500 13px "Inter",sans-serif; cursor:pointer; }
.cg-bar button:hover,.cg-panel button:hover{ border-color:#f0a93b; }
.cg-bar input[type=range]{ flex:1; min-width:160px; accent-color:#d97706; }
.cg-bar .cg-yl{ font:12px "Inter",sans-serif; color:#8a857e; }
.cg-info{ position:absolute; right:12px; top:12px; max-width:260px; padding:9px 12px; border-radius:10px; background:#101012e6; border:1px solid rgba(255,255,255,.1); font:13px/1.45 "Inter",sans-serif; color:#c7c2bb; }
.cg-info b{ color:#f6cf7e; font-weight:600; }
.cg-panel{ position:absolute; top:0; right:0; bottom:58px; width:min(380px,92%); overflow-y:auto; padding:14px 16px 18px; background:#0e0e11f5; border-left:1px solid rgba(255,255,255,.12); display:grid; gap:10px; align-content:start; z-index:2; font:13px "Inter",sans-serif; color:#c7c2bb; }
.cg-panel[hidden]{ display:none; }
.cg-panel h4{ margin:8px 0 0; font:600 11.5px "Inter",sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#f0a93b; display:flex; align-items:center; gap:8px; }
.cg-panel label{ display:grid; gap:3px; font-size:11.5px; color:#8a857e; }
.cg-panel input{ background:#16161a; border:1px solid rgba(255,255,255,.12); border-radius:7px; padding:6px 8px; color:#f3efe7; font:13px "Inter",sans-serif; min-width:0; }
.cg-panel input[type=color]{ padding:1px; height:30px; }
.cg-panel input[type=checkbox]{ justify-self:start; }
.cg-g2{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.cg-body{ border:1px solid rgba(255,255,255,.08); border-radius:10px; padding:9px; display:grid; gap:8px; background:#121215; }
.cg-body .cg-bh{ display:flex; gap:8px; align-items:center; }
.cg-body .cg-bh input[type=text]{ flex:1; }
.cg-row{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.cg-msg{ color:#7fc48a; min-height:1em; }
.cg-dirty{ font:12px "Inter",sans-serif; color:#f0a93b; text-shadow:0 1px 4px #000; }
.cg-dirty[hidden]{ display:none; }
.cg-now{ font-size:11.5px; color:#8a857e; }
.cg-save{ background:linear-gradient(180deg,#f6cf7e,#d97706) !important; color:#1a1206 !important; border:none !important; font-weight:600 !important; }
.cg-ec{ font:500 12.5px "Inter",sans-serif; color:#ffc9a8; text-shadow:0 1px 4px #000; max-width:min(520px,60vw); }
.cg-ec:empty{ display:none; }
.cg-yr{ position:relative; flex:1; min-width:160px; display:flex; }
.cg-yr input{ flex:1; min-width:0; }
.cg-tick{ position:absolute; top:-6px; width:2px; height:7px; border-radius:1px; background:#f6cf7e; pointer-events:none; transform:translateX(-1px); }
.cg-tick.is-lunar{ background:#a9bccf; } .cg-tick.is-season{ background:#7fc48a; height:5px; top:-5px; }
.cg-labels{ position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.cg-lbl{ position:absolute; transform:translate(-50%,-150%); font:500 11.5px "Inter",sans-serif; color:#ece7dd; text-shadow:0 1px 3px #000,0 0 6px #000; white-space:nowrap; }
.cg-menu{ position:absolute; right:12px; bottom:58px; z-index:3; width:250px; padding:10px 12px; border-radius:10px; background:#101012f5; border:1px solid rgba(255,255,255,.12); display:grid; gap:8px; font:13px "Inter",sans-serif; color:#c7c2bb; }
.cg-menu[hidden]{ display:none; }
.cg-menu label{ display:flex; gap:8px; align-items:center; }
.cg-menu select{ flex:1; }
.cg-menu button,.cg-menu select{ background:#16161ae6; color:#f3efe7; border:1px solid rgba(255,255,255,.14); border-radius:8px; padding:5px 9px; font:500 12.5px "Inter",sans-serif; cursor:pointer; }
.cg-legend{ position:absolute; left:14px; bottom:58px; font:12px "Inter",sans-serif; color:#d8d3ca; text-shadow:0 1px 4px #000; background:#0e0e11b8; padding:4px 9px; border-radius:6px; pointer-events:none; }
.cg-legend:empty, .cg-info[hidden]{ display:none; }
.cg-info{ max-height:calc(100% - 96px); overflow-y:auto; }
.cg-info .cg-sec + .cg-sec{ border-top:1px solid rgba(255,255,255,.1); margin-top:8px; padding-top:8px; }
.cg-info svg{ display:block; margin:6px auto 4px; }
.cg-info .cg-x{ float:right; background:none; border:0; color:#8a857e; cursor:pointer; font-size:14px; padding:0 0 0 6px; }
.cg-info .cg-x:hover{ color:#f3efe7; }
.cg-info .cg-li{ display:flex; gap:6px; align-items:baseline; } .cg-info .cg-li i{ flex:none; width:9px; height:9px; border-radius:50%; font-style:normal; transform:translateY(1px); }
.cg-info small{ color:#8a857e; }
.cg-ev{ display:grid !important; gap:2px; text-align:left; width:100%; } .cg-ev small{ color:#8a857e; font-weight:400; }
.cg-body details summary{ cursor:pointer; color:#8a857e; font-size:12px; } .cg-body details[open] summary{ margin-bottom:8px; }
.cg-mrow{ display:grid; grid-template-columns:minmax(0,1fr) 76px auto; gap:6px; align-items:center; }
.cg-mrow.is-moon{ grid-template-columns:minmax(0,1fr) auto; } .cg-mrow small{ color:#8a857e; white-space:nowrap; }
.cg-panel select{ width:100%; }
.cg-sum{ font-size:12px; color:#8a857e; }
.cg-panel input[type=range]{ padding:0; accent-color:#d97706; }
@media (max-width:620px){ .cg-info{ left:12px; right:12px; max-width:none; top:auto; bottom:110px; max-height:42%; } .cg-panel{ width:100%; } .cg-menu{ left:12px; right:12px; width:auto; } }
`;

const VERT = `varying vec3 vN; varying vec2 vUv;
void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;
// Light of every sun on the map (as MorraSimulator's surface field, here per pixel): falls off with distance (sCol, sFlux), a soft terminator,
// eclipses — a moon or a nearer sun covers a sun by their true angular sizes as seen from that point; the night side lit by the moons.
// mode: 0 the picture · 1 light · 2 heat · 3 eclipse shadows · 4 how many suns are up.
const FRAG = `uniform sampler2D map; uniform int nS; uniform vec3 sPos[4]; uniform vec3 sCol[4]; uniform float sRad[4]; uniform float sFlux[4]; uniform float sHeat[4];
uniform int nM; uniform vec3 mPos[4]; uniform float mRad[4]; uniform vec3 mGlow[4]; uniform float night; uniform int mode;
varying vec3 vN; varying vec2 vUv;
float cover(vec3 p, int i){
  vec3 s = sPos[i] - p; float ds = length(s); s /= ds; float as = asin(min(1.0, sRad[i] / ds)); float sh = 0.0;
  for (int j = 0; j < 8; j++) {
    vec3 o; float r;
    if (j < 4) { if (j >= nM) continue; o = mPos[j]; r = mRad[j]; }
    else { int k = j - 4; if (k >= nS || k == i) continue; o = sPos[k]; r = sRad[k]; }
    vec3 d = o - p; float dist = length(d); if (dist >= ds) continue; d /= dist;
    float c = dot(d, s); if (c <= 0.0) continue;
    float ao = asin(min(1.0, r / dist)); float sep = acos(clamp(c, -1.0, 1.0));
    if (sep >= as + ao) continue;
    float ov = clamp((as + ao - sep) / (2.0 * min(as, ao)), 0.0, 1.0);
    sh = max(sh, ov * min(1.0, (ao * ao) / (as * as)));
  }
  return sh;
}
vec3 lightRamp(float x){ x = clamp(x, 0.0, 1.0); return mix(mix(vec3(0.02, 0.02, 0.09), vec3(0.8, 0.36, 0.05), smoothstep(0.0, 0.5, x)), vec3(1.0, 0.96, 0.72), smoothstep(0.5, 1.0, x)); }
vec3 heatRamp(float x){ x = clamp(x, 0.0, 1.0);
  if (x < 0.33) return mix(vec3(0.08, 0.16, 0.55), vec3(0.1, 0.65, 0.75), x / 0.33);
  if (x < 0.66) return mix(vec3(0.1, 0.65, 0.75), vec3(0.95, 0.85, 0.2), (x - 0.33) / 0.33);
  return mix(vec3(0.95, 0.85, 0.2), vec3(0.9, 0.12, 0.08), (x - 0.66) / 0.34); }
vec3 upCol(int u){ if (u == 0) return vec3(0.04, 0.06, 0.2); if (u == 1) return vec3(0.95, 0.8, 0.3); if (u == 2) return vec3(0.95, 0.48, 0.12); if (u == 3) return vec3(0.85, 0.15, 0.15); return vec3(1.0); }
void main(){
  vec3 n = normalize(vN); vec3 albedo = texture2D(map, vUv).rgb; vec3 L = vec3(0.0); float phys = 0.0; float heat = 0.0; float shade = 0.0; int up = 0;
  for (int i = 0; i < 4; i++) {
    if (i >= nS) break;
    vec3 l = normalize(sPos[i] - n); float c = dot(n, l);
    float k = smoothstep(-0.04, 0.35, c) * max(c * 0.65 + 0.35, 0.0);
    float sh = k > 0.0 ? cover(n, i) : 0.0;
    if (c > 0.0) { up++; shade = max(shade, sh); }
    L += sCol[i] * k * (1.0 - sh);
    float e = sFlux[i] * max(c, 0.0) * (1.0 - sh); phys += e; heat += e * sHeat[i];
  }
  vec3 moon = vec3(0.0);
  for (int j = 0; j < 4; j++) { if (j >= nM) break; moon += mGlow[j] * max(dot(n, normalize(mPos[j] - n)), 0.0); }
  vec3 lit = vec3(1.0) - exp(-L * 1.8), nl = night * (vec3(1.0) + moon * 2.5);
  vec3 col = albedo * (nl + lit * (vec3(1.0) - nl)), grey = vec3(dot(albedo, vec3(0.3333))) * 0.45;
  if (mode == 1) col = mix(grey, lightRamp(phys / 1.2), 0.78);
  else if (mode == 2) col = mix(grey, heatRamp(heat / 1.6), 0.78);
  else if (mode == 3) col = mix(col * 0.8, vec3(1.0, 0.16, 0.1), smoothstep(0.0, 0.03, shade) * (0.3 + 0.6 * shade));
  else if (mode == 4) col = mix(grey, upCol(up), 0.7);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
// A moon lit by every sun, in the planet's shadow during a lunar eclipse (sCol already carries the shadow), its picture or colour.
const MOON_F = `uniform sampler2D map; uniform float useMap; uniform vec3 col; uniform int nS; uniform vec3 sDir[4]; uniform vec3 sCol[4];
varying vec3 vN; varying vec2 vUv;
void main(){ vec3 n = normalize(vN); vec3 a = useMap > 0.5 ? texture2D(map, vUv).rgb : col; vec3 L = vec3(0.015);
  for (int i = 0; i < 4; i++) { if (i >= nS) break; L += sCol[i] * max(dot(n, sDir[i]), 0.0); }
  gl_FragColor = vec4(a * (vec3(1.0) - exp(-L * 2.2)), 1.0);
  #include <colorspace_fragment>
}`;
const ATMO_V = `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(normalMatrix * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ATMO_F = `uniform vec3 sunDir; uniform vec3 tint; varying vec3 vN; varying vec3 vW;
void main(){ float rim = pow(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.0); float day = smoothstep(-0.3, 0.4, dot(normalize(vW), sunDir));
  gl_FragColor = vec4(tint * rim * (0.25 + day), 1.0); }`;

function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.18, "rgba(255,255,255,.75)"); r.addColorStop(0.45, "rgba(255,255,255,.18)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
// A world without a map yet: quiet ocean with seeded continents (same seed → same planet).
function blankMap(seed) {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 512;
  const g = c.getContext("2d"); let s = seed || 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const sea = g.createLinearGradient(0, 0, 0, 512); sea.addColorStop(0, "#c9d6df"); sea.addColorStop(0.12, "#24476a"); sea.addColorStop(0.5, "#1d3f63"); sea.addColorStop(0.88, "#24476a"); sea.addColorStop(1, "#d6e0e6");
  g.fillStyle = sea; g.fillRect(0, 0, 1024, 512);
  for (let k = 0; k < 9; k++) {
    const cx = rnd() * 1024, cy = 110 + rnd() * 290, R = 40 + rnd() * 90;
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * R;
      g.fillStyle = ["#5d6b3a", "#6f7a43", "#8a7d52", "#4f6136"][Math.floor(rnd() * 4)];
      g.beginPath(); g.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 14 + rnd() * 34, 10 + rnd() * 22, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const compress = (r) => (r <= 3 ? r : 3 + 5 * Math.log(1 + (r - 3) / 6)); // planet radii → scene units: the whole sky fits on screen
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] == null ? "" : o[k]));

export function mountCosmograph(host, opts) {
  const S = Object.assign({}, opts.lang === "en" ? EN : UK, opts.S || {}), LOC = opts.lang === "en" ? "en-GB" : "uk-UA";
  const fmt = (x, d) => Number(x).toLocaleString(LOC, { maximumFractionDigits: d == null ? 1 : d });
  let cfg = normalize(opts.config, opts.lang), cal = calendarOf(cfg);
  if (!document.getElementById("cg-css")) { const st = document.createElement("style"); st.id = "cg-css"; st.textContent = CSS; document.head.appendChild(st); }
  // what is shown (not part of the world's sky): orbits, labels, axis, the map layer — remembered in this browser
  const view = Object.assign({ orbits: true, labels: true, axis: false, mode: 0 }, (() => { try { return JSON.parse(localStorage.getItem("ww.cg.view") || "{}"); } catch (e) { return {}; } })());
  const keepView = () => { try { localStorage.setItem("ww.cg.view", JSON.stringify(view)); } catch (e) {} };
  host.innerHTML = `<div class="cg"><canvas></canvas><div class="cg-labels"></div><div class="cg-hud"><div class="cg-date"></div><div class="cg-time"></div><div class="cg-ec"></div></div>
    <div class="cg-info">${esc(S.hint)}</div><div class="cg-legend"></div>
    <div class="cg-bar"><button data-cg="play"></button><button data-cg="back" title="${esc(S.prevDay)}" aria-label="${esc(S.prevDay)}">⏪</button><button data-cg="fwd" title="${esc(S.nextDay)}" aria-label="${esc(S.nextDay)}">⏩</button>
      <select data-cg="speed" aria-label="${esc(S.speed)}">${S.speeds.map((x, i) => `<option value="${i}">${esc(x[0])}</option>`).join("")}</select>
      <span class="cg-yl"></span><span class="cg-yr"><input type="range" min="0" max="1000" data-cg="year" aria-label="${esc(S.year)}"><span class="cg-ticks"></span></span>
      <button data-cg="events">◷ ${esc(S.events)}</button><button data-cg="view">◐ ${esc(S.view)}</button>
      ${opts.canEdit ? `<span class="cg-dirty" hidden>${esc(S.unsaved)}</span><button data-cg="edit">${esc(S.edit)}</button>` : ""}</div>
    <div class="cg-menu" hidden></div><aside class="cg-panel cg-evp" hidden></aside><aside class="cg-panel cg-edp" hidden></aside></div>`;
  const root = host.querySelector(".cg"), canvas = root.querySelector("canvas"), panel = root.querySelector(".cg-edp"), evp = root.querySelector(".cg-evp"), menu = root.querySelector(".cg-menu");
  const infoEl = root.querySelector(".cg-info"), lblEl = root.querySelector(".cg-labels");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);
  camera.position.set(0, 1.6, 5.2);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.minDistance = 1.3; controls.maxDistance = 160;

  // starfield
  const sp = new Float32Array(3000 * 3);
  for (let i = 0; i < 3000; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(900); sp.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfc6d6, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.7 })));

  const V4 = () => [0, 1, 2, 3].map(() => new THREE.Vector3());
  const uni = {
    map: { value: null }, nS: { value: 0 }, sPos: { value: V4() }, sCol: { value: V4() }, sRad: { value: [0, 0, 0, 0] }, sFlux: { value: [0, 0, 0, 0] }, sHeat: { value: [1, 1, 1, 1] },
    nM: { value: 0 }, mPos: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(0, 99, 0)) }, mRad: { value: [0, 0, 0, 0] }, mGlow: { value: V4() }, night: { value: 0.07 }, mode: { value: 0 },
  };
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG }));
  scene.add(planet);
  const atmoU = { sunDir: { value: new THREE.Vector3(1, 0, 0) }, tint: { value: new THREE.Vector3(0.35, 0.6, 1) } };
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.03, 64, 32), new THREE.ShaderMaterial({ uniforms: atmoU, vertexShader: ATMO_V, fragmentShader: ATMO_F,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
  scene.add(atmo);
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf6cf7e }));
  marker.visible = false; planet.add(marker);
  // the axis and the equator (the axis is the frame's y: the tilt turns the orbits, not the planet)
  const guide = new THREE.Group(), gm = new THREE.LineBasicMaterial({ color: 0xf6cf7e, transparent: true, opacity: 0.55 });
  guide.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -1.5, 0), new THREE.Vector3(0, 1.5, 0)]), gm));
  guide.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 128 }, (_, i) => new THREE.Vector3(Math.cos(i / 128 * Math.PI * 2) * 1.006, 0, Math.sin(i / 128 * Math.PI * 2) * 1.006))), gm));
  scene.add(guide);

  const glow = glowTexture(), loader = new THREE.TextureLoader();
  let bodies = new THREE.Group(); scene.add(bodies);
  let stars = [], moons = [], spin = { l0: 0, rate: 0 }, snap = { suns: [], moons: [] };

  loader.setCrossOrigin("anonymous");
  const srcOf = (m) => (m === EARTH_MAP ? new URL("./earth-blue-marble.jpg", import.meta.url).href : m);
  let note = () => {}; // the editor's message line (set below)
  // The planet map: reloaded only when the map (or, for a generated one, the name) changes; a late load of a replaced map is dropped.
  let mapKey = null, mapTok = 0, mapNow = "";
  function setMap() {
    const m = cfg.planet.map, key = m || "gen:" + cfg.planet.name;
    if (key === mapKey) return;
    mapKey = key; const tok = ++mapTok;
    const done = (t, src) => { if (tok !== mapTok) return t.dispose(); if (uni.map.value) uni.map.value.dispose(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; uni.map.value = t; mapNow = src; };
    if (!m) return done(blankMap(cfg.planet.name.length * 7919 + 13), "");
    loader.load(srcOf(m), (t) => done(t, m), undefined, () => { if (tok === mapTok) note(S.picFailed); done(blankMap(11), ""); });
  }
  // Moon pictures: one texture per URL, shared by the moons that use it, disposed when no moon does.
  const texs = new Map(); // url → { tex, mats: Set<material> }
  function useTex(url, mat) {
    let e = texs.get(url);
    if (!e) {
      e = { tex: null, mats: new Set() }; texs.set(url, e); const mine = e;
      loader.load(srcOf(url), (tx) => { if (texs.get(url) !== mine) return tx.dispose(); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; mine.tex = tx; mine.mats.forEach((m) => paint(m, tx)); },
        undefined, () => { if (texs.get(url) === mine) note(S.picFailed); });
    }
    e.mats.add(mat); if (e.tex) paint(mat, e.tex);
  }
  const paint = (m, tx) => { m.uniforms.map.value = tx; m.uniforms.useMap.value = 1; };
  const H = () => cfg.planet.dayHours, Rp = () => cfg.planet.radiusKm;

  function build() {
    texs.forEach((e) => e.mats.clear());
    scene.remove(bodies); bodies.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    bodies = new THREE.Group(); scene.add(bodies); lblEl.innerHTML = "";
    const mk = (b, kind) => {
      const col = new THREE.Color(b.color), g = new THREE.Group(), r = Rp();
      let mesh;
      if (kind === "s") {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: col }));
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
        spr.scale.setScalar(6); mesh.add(spr); g.userData.spr = spr; // the glow follows the light the planet gets from it
      } else {
        const mat = new THREE.ShaderMaterial({ uniforms: { map: { value: null }, useMap: { value: 0 }, col: { value: new THREE.Vector3(col.r, col.g, col.b) }, nS: { value: 0 }, sDir: { value: V4() }, sCol: { value: V4() } },
          vertexShader: VERT, fragmentShader: MOON_F });
        if (b.map) useTex(b.map, mat); // the picture replaces the colour once it has loaded
        mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
      }
      g.add(mesh); g.userData.mesh = mesh; g.userData.body = b; g.userData.col = col; mesh.userData.pick = { kind, id: b.id };
      // the orbit drawn through one full period, compressed like the bodies
      const pts = [];
      for (let i = 0; i <= 256; i++) { const p = truePos(cfg, b, (i / 256) * b.periodDays * H()); const d = p.length() / r; pts.push(p.normalize().multiplyScalar(compress(d))); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: kind === "s" ? 0.28 : 0.4 }));
      line.userData.orbit = true; line.visible = view.orbits;
      bodies.add(line); bodies.add(g);
      const lb = document.createElement("div"); lb.className = "cg-lbl"; lb.textContent = b.name; lblEl.appendChild(lb); g.userData.lbl = lb;
      return g;
    };
    stars = cfg.stars.map((b) => mk(b, "s")); moons = cfg.moons.map((b) => mk(b, "m"));
    uni.nS.value = stars.length; uni.nM.value = moons.length;
    texs.forEach((e, u) => { if (!e.mats.size) { if (e.tex) e.tex.dispose(); texs.delete(u); } }); // pictures no moon uses any more
    spin = spinOf(cfg);
    const a = cfg.planet.atmosphere, ac = new THREE.Color(a.color);
    atmo.visible = a.on && stars.length > 0; atmoU.tint.value.set(ac.r, ac.g, ac.b);
    uni.night.value = cfg.planet.night;
  }
  let t = 0, playing = true, speedIdx = 0, picked = null, sel = null;
  const speedOf = () => { const v = S.speeds[speedIdx][1], Y = cal.yearDays; return v === "d" ? H() : v === "w" ? 7 * H() : v === "m" ? (Y / (cal.months.length || 12)) * H() : v === "y" ? Y * H() : v === "10y" ? 10 * Y * H() : v; };

  const pad = (x) => String(x).padStart(2, "0");
  function dateText(tt) {
    const d = dateAt(cfg, cal, tt), era = cfg.calendar.era ? " " + cfg.calendar.era : "", m = d.month >= 0 ? cal.months[d.month] : null;
    if (m && m.name) return `${d.day} ${m.name}, ${d.year}${era}`;
    if (m) return `${S.dayW} ${d.day} · ${S.monthW} ${d.month + 1} · ${S.year.toLowerCase()} ${d.year}${era}`;
    return `${S.dayW} ${d.doy} · ${S.year.toLowerCase()} ${d.year}${era}`;
  }
  function hud() {
    const d = dateAt(cfg, cal, t);
    root.querySelector(".cg-date").textContent = dateText(t);
    root.querySelector(".cg-time").textContent = `${pad(d.hh)}:${pad(d.mm)} · ${cfg.planet.name}`;
    root.querySelector(".cg-yl").textContent = `${S.year} ${d.year}`;
    root.querySelector(".cg-ec").textContent = eclipsesNow(cfg, snap).filter((e) => e.mag > 0.002).map((e) =>
      fill(e.kind === "lunar" ? S.ecLunar : e.kind === "transit" ? S.ecTransit : S.ecSolar, { b: e.by.b.name, s: e.sun.b.name, p: Math.round(e.mag * 100) })).join(" · ");
    const yr = root.querySelector('[data-cg="year"]'); if (document.activeElement !== yr) yr.value = Math.round(d.frac * 1000);
    root.querySelector('[data-cg="play"]').textContent = playing ? "❚❚ " + S.pause : "▶ " + S.play;
    if (picked || sel) info();
    if (!evp.hidden || ticksFor !== d.yi) events(d.yi);
  }
  const v3 = new THREE.Vector3();
  function place() {
    const r = Rp();
    planet.rotation.y = THREE.MathUtils.degToRad(spin.l0 + spin.rate * t);
    snap = snapshot(cfg, t);
    snap.suns.forEach((s, i) => {
      const g = stars[i]; if (!g) return;
      const dd = compress(s.d / r), f = flux(cfg, s.b, s.d), c = g.userData.col;
      g.userData.mesh.position.copy(s.dir).multiplyScalar(dd);
      g.userData.mesh.scale.setScalar(Math.max(0.3, Math.min(2.2, (s.b.radiusKm / s.d) * dd * 3)));
      g.userData.spr.material.opacity = Math.min(1, 0.15 + 0.85 * f);
      uni.sPos.value[i].copy(s.p).multiplyScalar(1 / r); uni.sRad.value[i] = s.b.radiusKm / r; uni.sFlux.value[i] = f; uni.sHeat.value[i] = s.b.heat;
      uni.sCol.value[i].set(c.r, c.g, c.b).multiplyScalar(f);
      if (i === 0) atmoU.sunDir.value.copy(s.dir);
    });
    snap.moons.forEach((m, j) => {
      const g = moons[j]; if (!g) return;
      const mesh = g.userData.mesh, mu = mesh.material.uniforms, c = g.userData.col;
      mesh.position.copy(m.dir).multiplyScalar(compress(m.d / r));
      mesh.scale.setScalar(Math.max(0.06, Math.min(1.2, m.b.radiusKm / r)));
      mesh.lookAt(0, 0, 0); // tidally locked: always the same face to the planet
      uni.mPos.value[j].copy(m.p).multiplyScalar(1 / r); uni.mRad.value[j] = m.b.radiusKm / r;
      const gl = moonGlow(cfg, snap, m); uni.mGlow.value[j].set(c.r, c.g, c.b).multiplyScalar(gl);
      mu.nS.value = snap.suns.length; mu.col.value.set(c.r, c.g, c.b);
      snap.suns.forEach((s, i) => { // the sun seen from the moon, dimmed by the planet in front of it (a lunar eclipse)
        v3.copy(s.p).sub(m.p); const ds = v3.length(); v3.divideScalar(ds); mu.sDir.value[i].copy(v3);
        const shade = cover(angR(s.b.radiusKm, ds), angR(r, m.d), v3.angleTo(m.dir.clone().negate())), sc = stars[i].userData.col;
        mu.sCol.value[i].set(sc.r, sc.g, sc.b).multiplyScalar(flux(cfg, s.b, ds) * (1 - shade));
      });
    });
    labels();
  }
  const pv = new THREE.Vector3();
  function labels() {
    lblEl.hidden = !view.labels; if (!view.labels) return;
    const w = root.clientWidth, h = root.clientHeight;
    stars.concat(moons).forEach((g) => {
      pv.copy(g.userData.mesh.position).project(camera); const lb = g.userData.lbl;
      if (pv.z > 1 || Math.abs(pv.x) > 1.1 || Math.abs(pv.y) > 1.1) { lb.style.display = "none"; return; }
      lb.style.display = ""; lb.style.left = ((pv.x + 1) / 2) * w + "px"; lb.style.top = ((1 - pv.y) / 2) * h + "px";
    });
  }
  const latTxt = (lat) => Math.abs(lat) < 0.5 ? S.equator : fmt(Math.abs(lat), 0) + "° " + (lat > 0 ? S.north : S.south);
  // the sky over the point as a compass chart: the horizon is the circle, the zenith its centre, north up
  function chart(sky) {
    const R = 64, C = 74, dot = (o, rr, fillc, ring) => { if (o.el <= 0) return ""; const q = ((90 - o.el) / 90) * R, a = THREE.MathUtils.degToRad(o.az);
      return `<circle cx="${(C + q * Math.sin(a)).toFixed(1)}" cy="${(C - q * Math.cos(a)).toFixed(1)}" r="${rr}" fill="${fillc}"${ring ? ` stroke="${ring}" stroke-width="1.2"` : ""}><title>${esc(o.name)}</title></circle>`; };
    const day = sky.suns.some((s) => s.el > 0);
    return `<svg width="148" height="148" viewBox="0 0 148 148" aria-hidden="true"><circle cx="${C}" cy="${C}" r="${R}" fill="${day ? "#1d3550" : "#0a0d18"}" stroke="rgba(255,255,255,.25)"/>
      <circle cx="${C}" cy="${C}" r="${R * 2 / 3}" fill="none" stroke="rgba(255,255,255,.08)"/><circle cx="${C}" cy="${C}" r="${R / 3}" fill="none" stroke="rgba(255,255,255,.08)"/>
      ${S.compass.map((c, i) => `<text x="${C + [0, R + 6, 0, -R - 6][i]}" y="${C + [-R - 3, 4, R + 11, 4][i]}" fill="#8a857e" font-size="9" text-anchor="middle">${esc(c)}</text>`).join("")}
      ${sky.moons.map((m) => dot(m, 4, m.color, m.shadow > 0.01 ? "#b35b4d" : "")).join("")}${sky.suns.map((s) => dot(s, 6, s.color, s.eclipse > 0.01 ? "#000" : "")).join("")}</svg>`;
  }
  function info() {
    const parts = [];
    if (sel) {
      const o = (sel.kind === "s" ? snap.suns : snap.moons).find((x) => x.b.id === sel.id);
      if (!o) sel = null;
      else {
        let x = `<b>${esc(o.b.name)}</b> <small>${esc(sel.kind === "s" ? S.sun : S.moon)}</small><button class="cg-x" data-cgx="sel" aria-label="${esc(S.close)}">✕</button><br>${esc(fill(S.distNow, { d: fmt(o.d, 0) }))} · ${esc(fill(S.angSize, { a: fmt(THREE.MathUtils.radToDeg(o.ang * 2), 2) }))}`;
        if (sel.kind === "s") x += `<br>${esc(fill(S.overhead, { lat: latTxt(subLat(o)) }))} · ${esc(S.light)} ${Math.round(flux(cfg, o.b, o.d) * 100)}%`;
        else { const st = moonState(cfg, snap, o); x += `<br>${esc(fill(S.phaseW, { p: Math.round(st.lit * 100) }))}${st.shadow > 0.01 ? " · " + esc(fill(S.inShadow, { p: Math.round(st.shadow * 100) })) : ""}`; }
        parts.push(x);
      }
    }
    if (picked) {
      const ll = dirToLatLon(picked), sky = skyAt(cfg, snap, planet.rotation.y, ll.lat, ll.lon);
      let x = `<b>${esc(S.point)}</b> ${esc(S.lat)} ${ll.lat.toFixed(1)}°, ${esc(S.lon)} ${ll.lon.toFixed(1)}°<button class="cg-x" data-cgx="pt" aria-label="${esc(S.close)}">✕</button>`;
      if (cfg.stars.length) {
        const s = truePos(cfg, cfg.stars[0], t), sl = dirToLatLon(s).lon - THREE.MathUtils.radToDeg(planet.rotation.y);
        const h = ((((ll.lon - sl) / 360) * H() + H() / 2) % H() + H()) % H(), hh = Math.floor(h), top = Math.max(...sky.suns.map((q) => q.el));
        x += `<br>${esc(S.local)}: <b>${pad(hh)}:${pad(Math.floor((h - hh) * 60))}</b> · ${esc(top > 0 ? S.dayS : top > -6 ? S.twilight : S.nightS)}`;
        x += `<br>${esc(S.light)} <b>${Math.round(sky.light * 100)}%</b> · ${esc(S.heatW)} <b>${Math.round(sky.heat * 100)}%</b>`;
      }
      x += chart(sky);
      sky.suns.forEach((q) => { x += `<div class="cg-li"><i style="background:${esc(q.color)}"></i><span>${esc(q.name)} — ${q.el > 0 ? esc(fill(S.elev, { e: fmt(q.el, 0) })) + ` · ${Math.round(q.light * 100)}%` +
        (q.eclipse > 0.01 ? ` · ${esc(fill(S.eclipsed, { p: Math.round(q.eclipse * 100), b: q.by }))}` : "") : `<small>${esc(S.below)}</small>`}</span></div>`; });
      sky.moons.forEach((q) => { x += `<div class="cg-li"><i style="background:${esc(q.color)};opacity:.75"></i><span>${esc(q.name)} — ${q.el > 0 ? esc(fill(S.elev, { e: fmt(q.el, 0) })) : `<small>${esc(S.below)}</small>`} · ${esc(fill(S.phaseW, { p: Math.round(q.phase * 100) }))}` +
        (q.shadow > 0.01 ? ` · ${esc(fill(S.inShadow, { p: Math.round(q.shadow * 100) }))}` : "") + `</span></div>`; });
      parts.push(x);
    }
    infoEl.innerHTML = parts.length ? parts.map((p) => `<div class="cg-sec">${p}</div>`).join("") : esc(S.hint);
  }
  infoEl.addEventListener("pointerdown", (e) => { // pointerdown: the panel is redrawn several times a second
    const x = e.target.closest("[data-cgx]"); if (!x) return;
    if (x.dataset.cgx === "pt") { picked = null; marker.visible = false; } else sel = null;
    info();
  });

  // ---------- sky events of a year: found ahead, marked on the year slider, a click jumps there ----------
  const evCache = new Map(); let ticksFor = null, evYear = null, evTimer = 0, evKey = "";
  function evOf(yi) {
    const k = JSON.stringify(cfg) + "|" + yi;
    if (k !== evKey) { evCache.clear(); evKey = k; }
    if (!evCache.has(yi)) { const Y = cal.yearDays * H(); evCache.set(yi, scanEvents(cfg, yi * Y, (yi + 1) * Y)); }
    return evCache.get(yi);
  }
  function events(yi) {
    if (playing && speedOf() >= cal.yearDays * H() && ticksFor != null) return; // a year a second or faster: the marks would only flicker
    const want = evp.hidden ? yi : evYear == null ? yi : evYear;
    if (ticksFor === yi && (evp.hidden || evp.dataset.y === String(want))) return;
    clearTimeout(evTimer);
    evTimer = setTimeout(() => {
      const list = evOf(yi), Y = cal.yearDays * H(), t0 = yi * Y;
      root.querySelector(".cg-ticks").innerHTML = list.map((e) => `<span class="cg-tick${e.kind === "lunar" ? " is-lunar" : e.kind === "equinox" || e.kind === "solstice" ? " is-season" : ""}" style="left:${(((e.peak || e.t) - t0) / Y * 100).toFixed(2)}%"></span>`).join("");
      ticksFor = yi;
      if (!evp.hidden) evList(want);
    }, 60);
  }
  function evList(yi) {
    const list = evOf(yi), Y = cal.yearDays * H(), year = cfg.calendar.startYear + yi;
    evp.dataset.y = String(yi);
    const name = (e) => e.kind === "solar" ? fill(S.evSolar, { b: e.by, s: e.sun }) : e.kind === "transit" ? fill(S.evTransit, { b: e.by, s: e.sun }) : e.kind === "lunar" ? fill(S.evLunar, { b: e.by })
      : e.kind === "equinox" ? fill(S.evEquinox, { s: e.sun }) : fill(S.evSolstice, { s: e.sun, lat: latTxt(e.lat) });
    evp.innerHTML = `<div class="cg-row"><b style="flex:1;color:#f3efe7">${esc(fill(S.evTitle, { y: year + (cfg.calendar.era ? " " + cfg.calendar.era : "") }))}</b><button data-act="close">${esc(S.close)}</button></div>
      <div class="cg-row"><button data-evy="${yi - 1}">${esc(S.evPrev)}</button><button data-evy="${yi + 1}">${esc(S.evNext)}</button></div><span class="cg-now">${esc(S.evHint)}</span>
      ${list.length ? list.map((e) => `<button class="cg-ev" data-evt="${e.peak || e.t}">${esc(name(e))}<small>${esc(dateText(e.peak || e.t))}${e.end ? " · " + esc(fill(S.evDur, { h: fmt((e.end - e.t), 1) })) : ""}${e.mag ? " · " + esc(fill(S.evMax, { p: Math.round(e.mag * 100) })) : ""}</small></button>`).join("") : `<p>${esc(S.evNone)}</p>`}`;
    void Y;
  }
  evp.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.act === "close") { evp.hidden = true; evYear = null; return; }
    if (b.dataset.evy) { evYear = +b.dataset.evy; evp.innerHTML = `<p>${esc(S.evCounting)}</p>`; setTimeout(() => evList(evYear), 30); return; }
    if (b.dataset.evt) { t = +b.dataset.evt; playing = false; place(); hud(); }
  });

  // ---------- view: orbits, labels, axis, the map layer, the camera ----------
  function menuHtml() {
    menu.innerHTML = `<label><input type="checkbox" data-vw="orbits"${view.orbits ? " checked" : ""}>${esc(S.orbits)}</label>
      <label><input type="checkbox" data-vw="labels"${view.labels ? " checked" : ""}>${esc(S.labels)}</label>
      <label><input type="checkbox" data-vw="axis"${view.axis ? " checked" : ""}>${esc(S.axis)}</label>
      <label>${esc(S.layer)}<select data-vw="mode">${S.layers.map((x, i) => `<option value="${i}"${+view.mode === i ? " selected" : ""}>${esc(x)}</option>`).join("")}</select></label>
      <div class="cg-row"><button data-cam="home">${esc(S.camHome)}</button><button data-cam="top">${esc(S.camTop)}</button><button data-cam="all">${esc(S.camAll)}</button></div>`;
  }
  function applyView() {
    bodies.children.forEach((o) => { if (o.userData.orbit) o.visible = view.orbits; });
    guide.visible = view.axis; uni.mode.value = +view.mode || 0;
    const md = +view.mode || 0, sw = (c) => `<i style="display:inline-block;width:10px;height:10px;border-radius:2px;margin:0 3px -1px 6px;background:${c}"></i>`;
    const bar = (g) => `<i style="display:inline-block;width:70px;height:8px;border-radius:4px;margin:0 6px -1px;background:linear-gradient(90deg,${g})"></i>`;
    root.querySelector(".cg-legend").innerHTML = md === 1 ? bar("#050516,#cc5c0d,#fff5b8") + esc(S.legend[1]) : md === 2 ? bar("#142a8c,#1aa6bf,#f2d933,#e61f14") + esc(S.legend[2])
      : md === 3 ? sw("#ff2a1a") + esc(S.legend[3]) : md === 4 ? esc(S.legend[4].split(":")[0]) + ":" + ["#0a0f33", "#f2cc4d", "#f27a1f", "#d92626", "#ffffff"].map((c, i) => sw(c) + i).join("") : "";
    labels();
  }
  menu.addEventListener("change", (e) => {
    const k = e.target.dataset.vw; if (!k) return;
    view[k] = e.target.type === "checkbox" ? e.target.checked : +e.target.value; keepView(); applyView();
  });
  function camTo(kind) {
    const d = camera.position.length();
    if (kind === "top") camera.position.set(0, Math.max(3, d), 0.001);
    else if (kind === "all") { let far = 3; stars.concat(moons).forEach((g) => { far = Math.max(far, g.userData.mesh.position.length()); }); camera.position.normalize().multiplyScalar(Math.min(150, far * 1.9)); }
    else { camera.position.set(0, 1.6, 5.2); dayView(); }
    controls.target.set(0, 0, 0); controls.update();
  }
  menu.addEventListener("click", (e) => { const b = e.target.closest("[data-cam]"); if (b) camTo(b.dataset.cam); });
  function dayView() { // open on the day side, a little off the sun, so the terminator is in view
    if (!stars.length) return;
    const d = snap.suns[0].dir.clone().setY(0);
    if (d.lengthSq() > 1e-6) { d.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.7); camera.position.set(d.x * 4.9, 1.6, d.z * 4.9); } // a sun over the pole: keep the default view
  }

  // ---------- interaction ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld(); ray.setFromCamera(ptr, camera); // a view button may have moved the camera since the last frame
    const hit = ray.intersectObjects([planet].concat(stars.concat(moons).map((g) => g.userData.mesh)), false)[0]; if (!hit) return;
    if (hit.object === planet) { picked = planet.worldToLocal(hit.point.clone()).normalize(); marker.position.copy(picked).multiplyScalar(1.004); marker.visible = true; }
    else sel = hit.object.userData.pick;
    info();
  });
  const side = () => { infoEl.hidden = !panel.hidden || !evp.hidden; }; // the point / body card hides under an open side panel
  new MutationObserver(side).observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(side).observe(evp, { attributes: true, attributeFilter: ["hidden"] });
  root.querySelector(".cg-bar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cg]"); if (!b) return;
    const c = b.dataset.cg;
    if (c === "play") { playing = !playing; hud(); }
    if (c === "back" || c === "fwd") { t += (c === "fwd" ? 1 : -1) * H(); place(); hud(); }
    if (c === "edit") { panel.hidden = !panel.hidden; if (!panel.hidden) { evp.hidden = true; menu.hidden = true; form(); } }
    if (c === "events") { evp.hidden = !evp.hidden; evYear = null; if (!evp.hidden) { panel.hidden = true; menu.hidden = true; evp.innerHTML = `<p>${esc(S.evCounting)}</p>`; ticksFor = null; events(dateAt(cfg, cal, t).yi); } }
    if (c === "view") { menu.hidden = !menu.hidden; if (!menu.hidden) menuHtml(); }
  });
  root.querySelector('[data-cg="speed"]').addEventListener("change", (e) => { speedIdx = +e.target.value; });
  root.querySelector('[data-cg="year"]').addEventListener("input", (e) => {
    const d = dateAt(cfg, cal, t), Y = cal.yearDays; t = (d.yi * Y + (+e.target.value / 1000) * Y) * H() + (((t % H()) + H()) % H()); place(); hud();
  });

  // ---------- editor ----------
  const num = (k, label, v, step, tip) => `<label${tip ? ` title="${esc(tip)}"` : ""}>${esc(label)}<input type="number" step="${step || "any"}" data-k="${k}" value="${esc(v)}"></label>`;
  const upBtn = (target, label) => `<label class="cg-up" style="display:inline-block"><input type="file" accept="image/*" data-up="${target}" hidden><span class="btnlike" style="cursor:pointer;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 11px;color:#f3efe7">${esc(label)}</span></label>`;
  const advOpen = new Set(); // «Орбіта детальніше» stays open through redraws
  const bodyForm = (b, kind, i) => `<div class="cg-body"><div class="cg-bh"><input type="color" data-k="${kind}.${i}.color" value="${esc(b.color)}" aria-label="${esc(S.color)}">
      <input type="text" data-k="${kind}.${i}.name" value="${esc(b.name)}" aria-label="${esc(S.name)}"><button data-rm="${kind}.${i}" aria-label="${esc(S.remove)}" title="${esc(S.remove)}">✕</button></div>
    <div class="cg-g2">${num(`${kind}.${i}.radiusKm`, S.radius, b.radiusKm)}${num(`${kind}.${i}.distanceKm`, S.dist, b.distanceKm)}${num(`${kind}.${i}.periodDays`, S.period, b.periodDays)}
      ${kind === "stars" ? num(`${kind}.${i}.power`, S.power, b.power, "0.05", S.tipPower) + num(`${kind}.${i}.heat`, S.heat, b.heat, "0.05", S.tipHeat) : num(`${kind}.${i}.albedo`, S.albedo, b.albedo, "0.01", S.tipAlbedo)}
      <label title="${esc(S.tipRev)}">${esc(S.reverse)}<input type="checkbox" data-k="${kind}.${i}.reverse"${b.reverse ? " checked" : ""}></label></div>
    <details data-adv="${esc(b.id)}"${advOpen.has(b.id) ? " open" : ""}><summary>${esc(S.adv)}</summary><div class="cg-g2">
      ${num(`${kind}.${i}.inclination`, S.incl, b.inclination, "any", S.tipIncl)}${num(`${kind}.${i}.node`, S.node, b.node, "any", S.tipNode)}
      ${num(`${kind}.${i}.eccentricity`, S.ecc, b.eccentricity, "0.01", S.tipEcc)}${num(`${kind}.${i}.periapsis`, S.periapsis, b.periapsis, "any", S.tipPeri)}
      ${num(`${kind}.${i}.lift`, S.lift, b.lift, "any", S.tipLift)}${num(`${kind}.${i}.phase`, S.phase, b.phase, "any", S.tipPhase)}</div></details>
    ${kind === "moons" ? `<div class="cg-row">${upBtn(`moons.${i}`, S.moonPic)}${b.map ? `<button data-mmap="${i}">${esc(S.colourOnly)}</button>` : ""}<span class="cg-now">${esc(S.mapNow)}: ${esc(b.map ? S.picOwn : S.picNone)}</span></div>` : ""}</div>`;
  const calSum = () => fill(S.calSum, { y: fmt(cal.yearDays, 2), h: fmt(H(), 2), m: cal.months.length ? fill(S.monthsN, { n: cal.months.length, d: fmt(cal.yearDays / cal.months.length, 1) }) : S.noMonths });
  function calForm() {
    const c = cfg.calendar, list = c.months === "list";
    const sel = (k, v, opts2) => `<select data-k="${k}">${opts2.map(([val, l]) => `<option value="${esc(val)}"${val === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    let h = `<h4>${esc(S.calendar)}</h4><span class="cg-sum">${esc(calSum())}</span>`;
    if (!list) h += `<label>${esc(S.yearIs)}${sel("cal.year", c.year, [["days", S.yearOwn]].concat(cfg.stars.map((s) => ["sun:" + s.id, fill(S.yearSun, { n: s.name, d: fmt(s.periodDays, 2) })])))}</label>` +
      (c.year === "days" ? num("cal.yearDays", S.yearDays, c.yearDays) : "");
    h += `<label>${esc(S.monthsAre)}${sel("cal.months", c.months, [["none", S.mNone]].concat(cfg.moons.map((m) => ["moon:" + m.id, fill(S.mMoon, { n: m.name })]), [["list", S.mList]]))}</label>`;
    if (list) h += c.monthDays.map((d, i) => `<div class="cg-mrow"><input type="text" data-k="cal.mn.${i}" value="${esc(c.monthNames[i] || "")}" placeholder="${esc(fill(S.mName, { i: i + 1 }))}" aria-label="${esc(fill(S.mName, { i: i + 1 }))}">
      <input type="number" min="1" step="1" data-k="cal.md.${i}" value="${d}" aria-label="${esc(S.mDays)}"><button data-mrm="${i}" aria-label="${esc(S.remove)}" title="${esc(S.remove)}"${c.monthDays.length < 2 ? " disabled" : ""}>✕</button></div>`).join("") +
      `<div class="cg-row"><button data-madd="1">${esc(S.addMonth)}</button><span class="cg-now">${esc(S.listYear)}</span></div>`;
    else if (cal.months.length) h += cal.months.map((m, i) => `<div class="cg-mrow is-moon"><input type="text" data-k="cal.mn.${i}" value="${esc(c.monthNames[i] || "")}" placeholder="${esc(fill(S.mName, { i: i + 1 }))}" aria-label="${esc(fill(S.mName, { i: i + 1 }))}"><small>≈ ${fmt(m.days, 1)} ${esc(S.mDays)}</small></div>`).join("");
    return h + `<div class="cg-g2">${num("cal.startYear", S.startYear, c.startYear, "1")}<label>${esc(S.era)}<input type="text" data-k="cal.era" value="${esc(c.era)}"></label></div>`;
  }
  function form() {
    const p = cfg.planet;
    panel.innerHTML = `<div class="cg-row"><b style="flex:1;color:#f3efe7">${esc(S.edit)}</b><button data-act="close">${esc(S.close)}</button></div>
      <div class="cg-row">${esc(S.presets)}: <button data-preset="earth">${esc(S.pEarth)}</button><button data-preset="binary">${esc(S.pBinary)}</button><button data-preset="suns3">${esc(S.pSuns)}</button></div>
      <h4>${esc(S.planet)}</h4><label>${esc(S.name)}<input type="text" data-k="planet.name" value="${esc(p.name)}"></label>
      <div class="cg-g2">${num("planet.radiusKm", S.radius, p.radiusKm)}${num("planet.tilt", S.tilt, p.tilt)}${num("planet.dayHours", S.dayH, p.dayHours)}</div>
      <label>${esc(S.map)}</label><div class="cg-row">${upBtn("planet", S.mapUpload)}
        <button data-map="earth">${esc(S.mapEarth)}</button><button data-map="none">${esc(S.mapNone)}</button></div>
      <span class="cg-now">${esc(S.mapNow)}: ${esc(p.map === EARTH_MAP ? S.mapEarth : p.map ? S.mapOwn : S.mapGen)}</span>
      <h4>${esc(S.look)}</h4><label>${esc(S.night)}<input type="range" min="0" max="0.4" step="0.01" data-k="planet.night" value="${p.night}"></label>
      <div class="cg-row"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-k="planet.atmoOn"${p.atmosphere.on ? " checked" : ""}>${esc(S.atmo)}</label>
        <input type="color" data-k="planet.atmoColor" value="${esc(p.atmosphere.color)}" aria-label="${esc(S.atmoCol)}" title="${esc(S.atmoCol)}"></div>
      <h4>${esc(S.stars)} <button data-add="stars"${cfg.stars.length >= MAX_BODIES ? " disabled title=\"" + esc(S.maxBodies) + "\"" : ""}>${esc(S.addStar)}</button></h4>${cfg.stars.map((b, i) => bodyForm(b, "stars", i)).join("")}
      <h4>${esc(S.moons)} <button data-add="moons"${cfg.moons.length >= MAX_BODIES ? " disabled title=\"" + esc(S.maxBodies) + "\"" : ""}>${esc(S.addMoon)}</button></h4>${cfg.moons.map((b, i) => bodyForm(b, "moons", i)).join("")}
      <div class="cg-calbox">${calForm()}</div>
      <div class="cg-row"><button class="cg-save" data-act="save">${esc(S.save)}</button><span class="cg-msg">${esc(msg)}</span></div>`;
  }
  panel.addEventListener("toggle", (e) => { const d = e.target; if (d.dataset && d.dataset.adv) { if (d.open) advOpen.add(d.dataset.adv); else advOpen.delete(d.dataset.adv); } }, true);
  let msg = "", savedJson = opts.config && opts.config.planet ? JSON.stringify(cfg) : ""; // a world whose sky was never saved starts «unsaved»
  const say = (m) => { msg = m || ""; const el = panel.querySelector(".cg-msg"); if (el) el.textContent = msg; };
  note = say;
  const dirty = () => JSON.stringify(cfg) !== savedJson;
  // Every change: normalise, rebuild the bodies (count, colour, size, orbit, light), swap the map if it changed, redraw at once.
  const mark = () => { const d = root.querySelector(".cg-dirty"); if (d) d.hidden = !dirty(); };
  function apply() { cfg = normalize(cfg, opts.lang); cal = calendarOf(cfg); build(); applyView(); setMap(); place(); ticksFor = null; hud(); mark(); }
  const valueAt = (k) => { const [a, b, c] = k.split("."); return a === "planet" ? cfg.planet[b] : a === "cal" ? cfg.calendar[b] : cfg[a][+b] && cfg[a][+b][c]; };
  function edit(e) {
    const el = e.target, k = el.dataset.k, live = e.type === "input";
    if (el.dataset.up) { if (!live) upload(el); return; }
    if (!k) return;
    const [a, b, c] = k.split(".");
    if (live && (a === "cal" || el.type === "checkbox" || el.tagName === "SELECT")) return; // the calendar is applied when the field is left (a half-typed number would reshape the year)
    const v = el.type === "checkbox" ? el.checked : el.value;
    if (a === "planet") {
      if (b === "atmoOn") cfg.planet.atmosphere.on = v; else if (b === "atmoColor") cfg.planet.atmosphere.color = v; else cfg.planet[b] = v;
    } else if (a === "cal") {
      const cl = cfg.calendar;
      if (b === "mn") { cl.monthNames[+c] = String(v).trim(); for (let i = 0; i < cl.monthNames.length; i++) if (cl.monthNames[i] == null) cl.monthNames[i] = ""; }
      else if (b === "md") cl.monthDays[+c] = Math.max(1, Math.round(+v || 1));
      else if (b === "months") {
        if (v === "list" && cl.months !== "list") cl.monthDays = cal.months.length ? cal.months.map((m) => Math.max(1, Math.round(m.days))) : Array(12).fill(Math.max(1, Math.round(cal.yearDays / 12)));
        cl.months = v;
      } else if (b === "year") { if (v === "days") cl.yearDays = +cal.yearDays.toFixed(2); cl.year = v; }
      else cl[b] = v;
    } else if (cfg[a] && cfg[a][+b]) cfg[a][+b][c] = v;
    apply();
    if (live) return;
    const calbox = () => { const x = panel.querySelector(".cg-calbox"); if (x) x.innerHTML = calForm(); }; // only the calendar: the field being typed in keeps its focus
    if (a === "cal" && (b === "months" || b === "year")) calbox();
    else if (a === "cal") { const sm = panel.querySelector(".cg-sum"); if (sm) sm.textContent = calSum(); }
    else if ((a === "stars" || a === "moons") && (c === "name" || c === "periodDays")) calbox(); // the calendar's choices name the bodies and their lengths
    if (el.type === "number") { const nv = valueAt(k); if (nv !== undefined && String(nv) !== el.value) el.value = String(nv); } // show the value really used (limits)
  }
  function upload(el) {
    const f = el.files && el.files[0], target = el.dataset.up; el.value = "";
    if (!f || !opts.onUploadMap) return;
    if (!/^image\//.test(f.type || "")) return say(S.notImage);
    const moon = target === "planet" ? null : cfg.moons[+target.split(".")[1]], moonId = moon && moon.id;
    say(S.uploading);
    opts.onUploadMap(f).then((url) => {
      if (target === "planet") cfg.planet.map = url;
      else { const m = cfg.moons.find((x) => x.id === moonId); if (!m) return say(""); m.map = url; } // the moon may have been removed meanwhile
      apply(); msg = ""; form();
    }).catch((er) => say(er.message || String(er)));
  }
  panel.addEventListener("input", edit);
  panel.addEventListener("change", edit);
  const ask = opts.confirm || ((q) => Promise.resolve(window.confirm(q)));
  panel.addEventListener("click", (e) => {
    const t2 = e.target.closest("button"); if (!t2) return;
    if (t2.dataset.act === "close") { panel.hidden = true; return; }
    if (t2.dataset.preset) { const id = t2.dataset.preset; ask(S.presetQ).then((ok) => { if (!ok) return; cfg = preset(id, opts.lang); t = 0; msg = ""; apply(); form(); }); return; }
    if (t2.dataset.map) { cfg.planet.map = t2.dataset.map === "earth" ? EARTH_MAP : ""; apply(); form(); return; }
    if (t2.dataset.mmap) { const m = cfg.moons[+t2.dataset.mmap]; if (m) m.map = ""; apply(); form(); return; }
    if (t2.dataset.madd) { const cl = cfg.calendar; cl.monthDays.push(cl.monthDays[cl.monthDays.length - 1] || 30); apply(); panel.querySelector(".cg-calbox").innerHTML = calForm(); return; }
    if (t2.dataset.mrm) { const cl = cfg.calendar, i = +t2.dataset.mrm; if (cl.monthDays.length < 2) return; cl.monthDays.splice(i, 1); cl.monthNames.splice(i, 1); apply(); panel.querySelector(".cg-calbox").innerHTML = calForm(); return; }
    if (t2.dataset.add) {
      const kind = t2.dataset.add, list = cfg[kind]; if (list.length >= MAX_BODIES) return;
      const base = list[list.length - 1] || (kind === "stars" ? preset("earth", opts.lang).stars[0] : preset("earth", opts.lang).moons[0]);
      list.push(Object.assign({}, base, { id: (kind === "stars" ? "s" : "m") + Date.now().toString(36), name: base.name + " " + (list.length + 1), phase: (base.phase + 90) % 360 }));
      apply(); form(); return;
    }
    if (t2.dataset.rm) { const [kind, i] = t2.dataset.rm.split("."); cfg[kind].splice(+i, 1); apply(); form(); return; }
    if (t2.dataset.act === "save" && opts.onSave) {
      const snap2 = JSON.parse(JSON.stringify(cfg)); t2.disabled = true;
      opts.onSave(snap2).then(() => { savedJson = JSON.stringify(snap2); say(S.saved); mark(); }).catch((er) => say(er.message || String(er))).finally(() => { t2.disabled = false; });
    }
  });

  // ---------- loop ----------
  const resize = () => { const w = root.clientWidth || 800, h = root.clientHeight || 500; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(root);
  let raf = 0, last = performance.now(), hudAt = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) t += dt * speedOf();
    controls.update(); place(); renderer.render(scene, camera);
    if (now - hudAt > 120) { hudAt = now; hud(); }
  }
  build(); applyView(); setMap(); resize(); place(); hud(); mark(); dayView();
  raf = requestAnimationFrame(frame);
  const api = {
    destroy() {
      cancelAnimationFrame(raf); clearTimeout(evTimer); ro.disconnect(); controls.dispose(); mapTok++; // a map still loading is dropped
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      if (uni.map.value) uni.map.value.dispose(); glow.dispose(); texs.forEach((e) => e.tex && e.tex.dispose()); texs.clear();
      renderer.dispose(); host.innerHTML = ""; if (window.__COSMOGRAPH__ === api) delete window.__COSMOGRAPH__;
    },
    get config() { return JSON.parse(JSON.stringify(cfg)); },
    get time() { return t; },
    setTime(h) { h = +h; if (isFinite(h)) { t = h; place(); hud(); } },
    get dirty() { return dirty(); },
    get calendar() { return JSON.parse(JSON.stringify(cal)); },
    get scene() { // what is really drawn (for checks): bodies, shader suns / eclipse casters, the map and moon pictures in use
      return { suns: stars.length, moons: moons.length, shaderSuns: uni.nS.value, shaderMoons: uni.nM.value, lights: uni.nS.value,
        objects: bodies.children.length, map: mapNow, mapLoaded: !!uni.map.value, moonPictures: moons.map((g) => !!g.userData.mesh.material.uniforms.map.value), atmosphere: atmo.visible,
        sunColours: stars.map((g, i) => uni.sCol.value[i].toArray().map((x) => +x.toFixed(3))), mode: uni.mode.value, eclipses: eclipsesNow(cfg, snap).map((e) => ({ kind: e.kind, sun: e.sun.b.name, by: e.by.b.name, mag: +e.mag.toFixed(3) })) };
    },
    sample(lat, lon) { return skyAt(cfg, snap, planet.rotation.y, lat, lon).suns.map((s) => +s.light.toFixed(4)); }, // light per sun at a point: incidence × distance × eclipses
    sky(lat, lon) { return skyAt(cfg, snap, planet.rotation.y, lat, lon); },
    events(yi) { return evOf(yi == null ? dateAt(cfg, cal, t).yi : yi); },
  };
  window.__COSMOGRAPH__ = api;
  return api;
}
