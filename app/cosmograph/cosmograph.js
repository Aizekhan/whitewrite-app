// Космограф — the sky of a world: a planet with its map, any suns and moons (up to 4 + 4), calendar and time.
// A generalised port of MorraSimulator (D:\MorraSimulator\morra-simulator): orbit math, map conventions and the
// "light on the map" idea come from there; Morra's own physics (magic, radiation roles, magosphere) stays in Morra.
// ES module loaded on demand by gamebible.js: import("./cosmograph/cosmograph.js").then(m => m.mountCosmograph(el, opts)).
//   opts: { config, lang, S (strings), canEdit, onSave(config) → Promise, onUploadMap(file) → Promise<url> }
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { position, dirToLatLon } from "./orbit.js";
import { preset, normalize, EARTH_MAP, MAX_BODIES } from "./presets.js";

const UK = {
  dayW: "День", monthW: "місяць", play: "Пуск", pause: "Пауза", speed: "Швидкість", year: "Рік", day: "день", edit: "Налаштувати небо", close: "Закрити", save: "Зберегти небо",
  saved: "Небо збережено.", planet: "Планета", name: "Назва", radius: "Радіус, км", tilt: "Нахил осі, °", dayH: "Доба, годин", map: "Карта поверхні",
  mapUpload: "Завантажити карту (рівнокутна 2:1)", mapEarth: "Карта Землі", mapNone: "Без карти", calendar: "Календар", months: "Назви місяців (через кому)",
  monthDays: "Днів у місяцях (через кому або одне число × кількість)", startYear: "Перший рік", era: "Ера (підпис)", stars: "Зорі", moons: "Супутники",
  addStar: "＋ Зоря", addMoon: "＋ Супутник", color: "Колір", dist: "Відстань, км", period: "Період, діб", incl: "Нахил орбіти, °", node: "Вузол, °",
  phase: "Фаза на старті, °", ecc: "Ексцентриситет", power: "Сила світла", reverse: "Назустріч", remove: "Прибрати", presets: "Почати з пресету",
  pEarth: "Земля", pSuns: "Три сонця", presetQ: "Замінити поточне небо пресетом?", point: "Точка", lat: "Шир.", lon: "Довг.", local: "Місцевий час",
  above: "Над горизонтом", none: "нікого — ніч", hint: "Клікни на планету — побачиш місцевий час і небо над точкою.", maxBodies: "Не більше 4",
  speeds: [["1 год/с", 1], ["1 доба/с", "d"], ["1 тиждень/с", "w"], ["1 місяць/с", "m"], ["1 рік/с", "y"]], uploading: "Завантажую карту…",
};
const EN = {
  dayW: "Day", monthW: "month", play: "Play", pause: "Pause", speed: "Speed", year: "Year", day: "day", edit: "Set up the sky", close: "Close", save: "Save the sky",
  saved: "Sky saved.", planet: "Planet", name: "Name", radius: "Radius, km", tilt: "Axial tilt, °", dayH: "Day, hours", map: "Surface map",
  mapUpload: "Upload a map (equirectangular 2:1)", mapEarth: "Earth map", mapNone: "No map", calendar: "Calendar", months: "Month names (comma separated)",
  monthDays: "Days in months (comma separated, or one number)", startYear: "First year", era: "Era (label)", stars: "Stars", moons: "Moons",
  addStar: "＋ Star", addMoon: "＋ Moon", color: "Colour", dist: "Distance, km", period: "Period, days", incl: "Orbit inclination, °", node: "Node, °",
  phase: "Phase at start, °", ecc: "Eccentricity", power: "Light power", reverse: "Retrograde", remove: "Remove", presets: "Start from a preset",
  pEarth: "Earth", pSuns: "Three suns", presetQ: "Replace the current sky with a preset?", point: "Point", lat: "Lat", lon: "Lon", local: "Local time",
  above: "Above the horizon", none: "nobody — night", hint: "Click the planet to see the local time and the sky above that point.", maxBodies: "At most 4",
  speeds: [["1 h/s", 1], ["1 day/s", "d"], ["1 week/s", "w"], ["1 month/s", "m"], ["1 year/s", "y"]], uploading: "Uploading the map…",
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
.cg-panel h4{ margin:8px 0 0; font:600 11.5px "Inter",sans-serif; letter-spacing:.12em; text-transform:uppercase; color:#9d6bff; display:flex; align-items:center; gap:8px; }
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
.cg-save{ background:linear-gradient(180deg,#f6cf7e,#d97706) !important; color:#1a1206 !important; border:none !important; font-weight:600 !important; }
`;

const VERT = `varying vec3 vN; varying vec2 vUv;
void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`;
// Light of every sun on the map (as MorraSimulator's surface field, here per pixel), soft terminator, night side kept readable,
// and eclipses: a moon covers a sun by their true angular sizes as seen from that point of the surface.
const FRAG = `uniform sampler2D map; uniform int nS; uniform vec3 sDir[4]; uniform vec3 sCol[4]; uniform float sAng[4];
uniform int nM; uniform vec3 mPos[4]; uniform float mRad[4]; uniform float night;
varying vec3 vN; varying vec2 vUv;
float cover(vec3 p, vec3 s, float as){
  float sh = 0.0;
  for (int j = 0; j < 4; j++) {
    if (j >= nM) break;
    vec3 d = mPos[j] - p; float dist = length(d); vec3 dn = d / dist;
    float c = dot(dn, s); if (c <= 0.0) continue;
    float am = asin(min(1.0, mRad[j] / dist)); float sep = acos(clamp(c, -1.0, 1.0));
    if (sep >= as + am) continue;
    float o = clamp((as + am - sep) / (2.0 * min(as, am)), 0.0, 1.0);
    sh = max(sh, o * min(1.0, (am * am) / (as * as)));
  }
  return sh;
}
void main(){
  vec3 n = normalize(vN); vec3 albedo = texture2D(map, vUv).rgb; vec3 L = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= nS) break;
    float k = smoothstep(-0.04, 0.35, dot(n, sDir[i])) * max(dot(n, sDir[i]) * 0.65 + 0.35, 0.0);
    if (k > 0.0) k *= 1.0 - cover(n, sDir[i], sAng[i]);
    L += sCol[i] * k;
  }
  vec3 lit = vec3(1.0) - exp(-L * 1.8);
  gl_FragColor = vec4(albedo * (night + lit * (1.0 - night)), 1.0);
  #include <colorspace_fragment>
}`;
const ATMO_V = `varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(normalMatrix * normal); vW = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ATMO_F = `uniform vec3 sunDir; varying vec3 vN; varying vec3 vW;
void main(){ float rim = pow(0.72 - dot(vN, vec3(0.0, 0.0, 1.0)), 3.0); float day = smoothstep(-0.3, 0.4, dot(normalize(vW), sunDir));
  gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * rim * (0.25 + day), 1.0); }`;

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

export function mountCosmograph(host, opts) {
  const S = Object.assign({}, opts.lang === "en" ? EN : UK, opts.S || {});
  let cfg = normalize(opts.config, opts.lang);
  if (!document.getElementById("cg-css")) { const st = document.createElement("style"); st.id = "cg-css"; st.textContent = CSS; document.head.appendChild(st); }
  host.innerHTML = `<div class="cg"><canvas></canvas><div class="cg-hud"><div class="cg-date"></div><div class="cg-time"></div></div>
    <div class="cg-info">${esc(S.hint)}</div>
    <div class="cg-bar"><button data-cg="play"></button><select data-cg="speed" aria-label="${esc(S.speed)}">${S.speeds.map((x, i) => `<option value="${i}">${esc(x[0])}</option>`).join("")}</select>
      <span class="cg-yl"></span><input type="range" min="0" max="1000" data-cg="year" aria-label="${esc(S.year)}">${opts.canEdit ? `<button data-cg="edit">${esc(S.edit)}</button>` : ""}</div>
    <aside class="cg-panel" hidden></aside></div>`;
  const root = host.querySelector(".cg"), canvas = root.querySelector("canvas"), panel = root.querySelector(".cg-panel");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);
  camera.position.set(0, 1.6, 5.2);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.minDistance = 1.3; controls.maxDistance = 120;

  // starfield
  const sp = new Float32Array(3000 * 3);
  for (let i = 0; i < 3000; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(900); sp.set([v.x, v.y, v.z], i * 3); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfc6d6, size: 1.2, sizeAttenuation: false, transparent: true, opacity: 0.7 })));

  const uni = {
    map: { value: null }, nS: { value: 0 }, sDir: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }, sCol: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
    sAng: { value: [0.01, 0.01, 0.01, 0.01] }, nM: { value: 0 }, mPos: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(0, 99, 0)) }, mRad: { value: [0, 0, 0, 0] }, night: { value: 0.07 },
  };
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG }));
  scene.add(planet);
  const atmoU = { sunDir: { value: new THREE.Vector3(1, 0, 0) } };
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.03, 64, 32), new THREE.ShaderMaterial({ uniforms: atmoU, vertexShader: ATMO_V, fragmentShader: ATMO_F,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })));
  const marker = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf6cf7e }));
  marker.visible = false; planet.add(marker);
  scene.add(new THREE.AmbientLight(0xffffff, 0.04));

  const glow = glowTexture(), loader = new THREE.TextureLoader();
  let bodies = new THREE.Group(); scene.add(bodies);
  let stars = [], moons = [], spin = { l0: 0, rate: 0 };

  function setMap() {
    const m = cfg.planet.map;
    const done = (t) => { if (uni.map.value) uni.map.value.dispose(); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; uni.map.value = t; };
    if (!m) return done(blankMap(cfg.planet.name.length * 7919 + 13));
    const url = m === EARTH_MAP ? new URL("./earth-blue-marble.jpg", import.meta.url).href : m;
    loader.setCrossOrigin("anonymous");
    loader.load(url, done, undefined, () => done(blankMap(11)));
  }
  const H = () => cfg.planet.dayHours, Rp = () => cfg.planet.radiusKm;
  const truePos = (b, t) => position({ distance: b.distanceKm, eccentricity: b.eccentricity, periodDays: b.periodDays, inclination: b.inclination, node: b.node,
    phase: b.phase, reverse: b.reverse }, t, H(), cfg.planet.tilt);
  const lonOf = (v) => dirToLatLon(v).lon;

  function build() {
    scene.remove(bodies); bodies.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    bodies = new THREE.Group(); scene.add(bodies);
    const mk = (b, kind) => {
      const col = new THREE.Color(b.color), g = new THREE.Group(), r = Rp();
      let mesh;
      if (kind === "s") {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: col }));
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
        spr.scale.setScalar(6); mesh.add(spr);
        const light = new THREE.DirectionalLight(col, 1.4 * b.power); light.target.position.set(0, 0, 0); g.add(light); g.add(light.target); g.userData.light = light;
      } else mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshStandardMaterial({ color: col, roughness: 1, metalness: 0 }));
      g.add(mesh); g.userData.mesh = mesh; g.userData.body = b;
      // the orbit drawn through one full period, compressed like the bodies
      const pts = [];
      for (let i = 0; i <= 256; i++) { const p = truePos(b, (i / 256) * b.periodDays * H()); const d = p.length() / r; pts.push(p.normalize().multiplyScalar(compress(d))); }
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: kind === "s" ? 0.28 : 0.4 }));
      bodies.add(line); bodies.add(g);
      return g;
    };
    stars = cfg.stars.map((b) => mk(b, "s")); moons = cfg.moons.map((b) => mk(b, "m"));
    uni.nS.value = stars.length; uni.nM.value = moons.length;
    // The planet turns so that the solar day of the first sun lasts exactly dayHours, and t = 0 is midnight at longitude 0.
    if (cfg.stars.length) {
      const s0 = truePos(cfg.stars[0], 0), s1 = truePos(cfg.stars[0], H() / 50);
      let dl = lonOf(s1) - lonOf(s0); if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
      spin = { l0: lonOf(s0) - 180, rate: 360 / H() + Math.sign(dl || 1) * 360 / (cfg.stars[0].periodDays * H()) };
    } else spin = { l0: 0, rate: 360 / H() };
  }
  const yearDays = () => cfg.calendar.monthDays.reduce((a, b) => a + b, 0);
  let t = 0, playing = true, speedIdx = 0, picked = null;
  const speedOf = () => { const v = S.speeds[speedIdx][1]; return v === "d" ? H() : v === "w" ? 7 * H() : v === "m" ? (yearDays() / cfg.calendar.monthDays.length) * H() : v === "y" ? yearDays() * H() : v; };

  function date(tt) {
    const h = H(), total = Math.floor(tt / h), yd = yearDays(), yi = Math.floor(total / yd);
    let doy = total - yi * yd, m = 0; while (m < cfg.calendar.monthDays.length - 1 && doy >= cfg.calendar.monthDays[m]) { doy -= cfg.calendar.monthDays[m]; m++; }
    const hr = tt - total * h, hh = Math.floor(hr), mm = Math.floor((hr - hh) * 60);
    return { year: cfg.calendar.startYear + yi, month: m, day: doy + 1, hh, mm, frac: (total - yi * yd + hr / h) / yd, yi };
  }
  const pad = (x) => String(x).padStart(2, "0");
  function hud() {
    const d = date(t), mn = cfg.calendar.monthNames[d.month], era = cfg.calendar.era ? " " + cfg.calendar.era : "";
    root.querySelector(".cg-date").textContent = mn ? `${d.day} ${mn}, ${d.year}${era}` : `${S.dayW} ${d.day} · ${S.monthW} ${d.month + 1} · ${S.year.toLowerCase()} ${d.year}${era}`;
    root.querySelector(".cg-time").textContent = `${pad(d.hh)}:${pad(d.mm)} · ${cfg.planet.name}`;
    root.querySelector(".cg-yl").textContent = `${S.year} ${d.year}`;
    const yr = root.querySelector('[data-cg="year"]'); if (document.activeElement !== yr) yr.value = Math.round(d.frac * 1000);
    root.querySelector('[data-cg="play"]').textContent = playing ? "❚❚ " + S.pause : "▶ " + S.play;
  }
  function place() {
    const r = Rp(), L = THREE.MathUtils.degToRad(spin.l0 + spin.rate * t);
    planet.rotation.y = L;
    stars.forEach((g, i) => {
      const b = g.userData.body, p = truePos(b, t), d = p.length(), dir = p.clone().normalize(), dd = compress(d / r);
      g.userData.mesh.position.copy(dir).multiplyScalar(dd);
      g.userData.mesh.scale.setScalar(Math.max(0.3, Math.min(2.2, (b.radiusKm / d) * dd * 3)));
      g.userData.light.position.copy(g.userData.mesh.position);
      uni.sDir.value[i].copy(dir); uni.sCol.value[i].set(...new THREE.Color(b.color).toArray()).multiplyScalar(b.power); uni.sAng.value[i] = Math.asin(Math.min(1, b.radiusKm / d));
      if (i === 0) atmoU.sunDir.value.copy(dir);
    });
    moons.forEach((g, j) => {
      const b = g.userData.body, p = truePos(b, t), d = p.length();
      g.userData.mesh.position.copy(p).normalize().multiplyScalar(compress(d / r));
      g.userData.mesh.scale.setScalar(Math.max(0.06, Math.min(1.2, b.radiusKm / r)));
      uni.mPos.value[j].copy(p).multiplyScalar(1 / r); uni.mRad.value[j] = b.radiusKm / r;
    });
    if (picked) info();
  }
  function info() {
    const r = Rp(), n = picked.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), planet.rotation.y), ll = dirToLatLon(picked);
    let solar = "";
    if (cfg.stars.length) {
      const s = truePos(cfg.stars[0], t), sl = lonOf(s) - THREE.MathUtils.radToDeg(planet.rotation.y);
      const h = ((((ll.lon - sl) / 360) * H() + H() / 2) % H() + H()) % H(), hh = Math.floor(h);
      solar = `<br>${esc(S.local)}: <b>${pad(hh)}:${pad(Math.floor((h - hh) * 60))}</b>`;
    }
    const up = cfg.stars.concat(cfg.moons).filter((b) => truePos(b, t).sub(n.clone().multiplyScalar(r)).normalize().dot(n) > 0).map((b) => esc(b.name));
    root.querySelector(".cg-info").innerHTML = `<b>${esc(S.point)}</b> ${esc(S.lat)} ${ll.lat.toFixed(1)}°, ${esc(S.lon)} ${ll.lon.toFixed(1)}°${solar}<br>${esc(S.above)}: ${up.length ? up.join(", ") : esc(S.none)}`;
  }

  // ---------- interaction ----------
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = canvas.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera); const hit = ray.intersectObject(planet)[0]; if (!hit) return;
    picked = planet.worldToLocal(hit.point.clone()).normalize(); marker.position.copy(picked).multiplyScalar(1.004); marker.visible = true; info();
  });
  root.querySelector(".cg-bar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cg]"); if (!b) return;
    if (b.dataset.cg === "play") { playing = !playing; hud(); }
    if (b.dataset.cg === "edit") { panel.hidden = !panel.hidden; if (!panel.hidden) form(); }
  });
  root.querySelector('[data-cg="speed"]').addEventListener("change", (e) => { speedIdx = +e.target.value; });
  root.querySelector('[data-cg="year"]').addEventListener("input", (e) => {
    const d = date(t); t = (d.yi * yearDays() + (+e.target.value / 1000) * yearDays()) * H() + (t % H()); place(); hud();
  });

  // ---------- editor ----------
  const num = (k, label, v, step) => `<label>${esc(label)}<input type="number" step="${step || "any"}" data-k="${k}" value="${esc(v)}"></label>`;
  const bodyForm = (b, kind, i) => `<div class="cg-body"><div class="cg-bh"><input type="color" data-k="${kind}.${i}.color" value="${esc(b.color)}" aria-label="${esc(S.color)}">
      <input type="text" data-k="${kind}.${i}.name" value="${esc(b.name)}" aria-label="${esc(S.name)}"><button data-rm="${kind}.${i}">✕</button></div>
    <div class="cg-g2">${num(`${kind}.${i}.radiusKm`, S.radius, b.radiusKm)}${num(`${kind}.${i}.distanceKm`, S.dist, b.distanceKm)}${num(`${kind}.${i}.periodDays`, S.period, b.periodDays)}
      ${num(`${kind}.${i}.inclination`, S.incl, b.inclination)}${num(`${kind}.${i}.node`, S.node, b.node)}${num(`${kind}.${i}.phase`, S.phase, b.phase)}
      ${num(`${kind}.${i}.eccentricity`, S.ecc, b.eccentricity, "0.01")}${kind === "stars" ? num(`${kind}.${i}.power`, S.power, b.power, "0.05") : ""}
      <label>${esc(S.reverse)}<input type="checkbox" data-k="${kind}.${i}.reverse"${b.reverse ? " checked" : ""}></label></div></div>`;
  function form() {
    const p = cfg.planet, c = cfg.calendar;
    panel.innerHTML = `<div class="cg-row"><b style="flex:1;color:#f3efe7">${esc(S.edit)}</b><button data-act="close">${esc(S.close)}</button></div>
      <div class="cg-row">${esc(S.presets)}: <button data-preset="earth">${esc(S.pEarth)}</button><button data-preset="suns3">${esc(S.pSuns)}</button></div>
      <h4>${esc(S.planet)}</h4><label>${esc(S.name)}<input type="text" data-k="planet.name" value="${esc(p.name)}"></label>
      <div class="cg-g2">${num("planet.radiusKm", S.radius, p.radiusKm)}${num("planet.tilt", S.tilt, p.tilt)}${num("planet.dayHours", S.dayH, p.dayHours)}</div>
      <label>${esc(S.map)}</label><div class="cg-row"><label class="cg-up" style="display:inline-block"><input type="file" accept="image/*" data-act="upload" hidden><span class="btnlike" style="cursor:pointer;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:6px 11px;color:#f3efe7">${esc(S.mapUpload)}</span></label>
        <button data-map="earth">${esc(S.mapEarth)}</button><button data-map="none">${esc(S.mapNone)}</button></div>
      <h4>${esc(S.calendar)}</h4><label>${esc(S.months)}<input type="text" data-k="cal.monthNames" value="${esc(c.monthNames.join(", "))}"></label>
      <label>${esc(S.monthDays)}<input type="text" data-k="cal.monthDays" value="${esc(c.monthDays.join(", "))}"></label>
      <div class="cg-g2">${num("cal.startYear", S.startYear, c.startYear, "1")}<label>${esc(S.era)}<input type="text" data-k="cal.era" value="${esc(c.era)}"></label></div>
      <h4>${esc(S.stars)} <button data-add="stars"${cfg.stars.length >= MAX_BODIES ? " disabled title=\"" + esc(S.maxBodies) + "\"" : ""}>${esc(S.addStar)}</button></h4>${cfg.stars.map((b, i) => bodyForm(b, "stars", i)).join("")}
      <h4>${esc(S.moons)} <button data-add="moons"${cfg.moons.length >= MAX_BODIES ? " disabled title=\"" + esc(S.maxBodies) + "\"" : ""}>${esc(S.addMoon)}</button></h4>${cfg.moons.map((b, i) => bodyForm(b, "moons", i)).join("")}
      <div class="cg-row"><button class="cg-save" data-act="save">${esc(S.save)}</button><span class="cg-msg"></span></div>`;
  }
  const say = (m) => { const el = panel.querySelector(".cg-msg"); if (el) el.textContent = m; };
  function apply(rebuildMap) { cfg = normalize(cfg, opts.lang); build(); if (rebuildMap) setMap(); place(); hud(); }
  panel.addEventListener("change", (e) => {
    const k = e.target.dataset.k;
    if (e.target.dataset.act === "upload" && e.target.files.length && opts.onUploadMap) {
      const f = e.target.files[0]; e.target.value = ""; say(S.uploading);
      opts.onUploadMap(f).then((url) => { cfg.planet.map = url; apply(true); say(""); }).catch((er) => say(er.message || String(er)));
      return;
    }
    if (!k) return;
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value, [a, b, c] = k.split(".");
    if (a === "planet") cfg.planet[b] = v;
    else if (a === "cal") {
      if (b === "monthNames") cfg.calendar.monthNames = String(v).split(",").map((x) => x.trim()).filter(Boolean);
      else if (b === "monthDays") {
        const parts = String(v).split(/[,\s]+/).filter(Boolean).map(Number).filter((x) => x > 0);
        cfg.calendar.monthDays = parts.length === 1 ? Array(Math.max(1, cfg.calendar.monthNames.length || cfg.calendar.monthDays.length)).fill(parts[0]) : parts.length ? parts : cfg.calendar.monthDays;
      } else cfg.calendar[b] = v;
    } else cfg[a][+b][c] = v;
    apply(false);
    if (a === "cal" || (a === "planet" && b === "dayHours")) form();
  });
  panel.addEventListener("click", (e) => {
    const t2 = e.target.closest("button"); if (!t2) return;
    if (t2.dataset.act === "close") { panel.hidden = true; return; }
    if (t2.dataset.preset) { if (!confirm(S.presetQ)) return; cfg = preset(t2.dataset.preset, opts.lang); t = 0; apply(true); form(); return; }
    if (t2.dataset.map) { cfg.planet.map = t2.dataset.map === "earth" ? EARTH_MAP : ""; apply(true); return; }
    if (t2.dataset.add) {
      const list = cfg[t2.dataset.add]; if (list.length >= MAX_BODIES) return;
      const base = list[list.length - 1] || (t2.dataset.add === "stars" ? preset("earth").stars[0] : preset("earth").moons[0]);
      list.push(Object.assign({}, base, { id: (t2.dataset.add === "stars" ? "s" : "m") + Date.now().toString(36), name: base.name + " " + (list.length + 1), phase: (base.phase + 90) % 360 }));
      apply(false); form(); return;
    }
    if (t2.dataset.rm) { const [kind, i] = t2.dataset.rm.split("."); cfg[kind].splice(+i, 1); apply(false); form(); return; }
    if (t2.dataset.act === "save" && opts.onSave) { t2.disabled = true; opts.onSave(JSON.parse(JSON.stringify(cfg))).then(() => say(S.saved)).catch((er) => say(er.message || String(er))).finally(() => { t2.disabled = false; }); }
  });

  // ---------- loop ----------
  const resize = () => { const w = root.clientWidth || 800, h = root.clientHeight || 500; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(root);
  let raf = 0, last = performance.now(), hudAt = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (playing) t += dt * speedOf();
    place(); controls.update(); renderer.render(scene, camera);
    if (now - hudAt > 120) { hudAt = now; hud(); }
  }
  build(); setMap(); resize(); place(); hud();
  if (stars.length) { // open on the day side, a little off the sun, so the terminator is in view
    const d = uni.sDir.value[0].clone().setY(0).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.7);
    camera.position.set(d.x * 4.9, 1.6, d.z * 4.9);
  }
  raf = requestAnimationFrame(frame);
  const api = {
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); host.innerHTML = ""; },
    get config() { return JSON.parse(JSON.stringify(cfg)); },
    get time() { return t; },
    setTime(h) { t = h; place(); hud(); },
    sample(lat, lon) { // light per sun at a point (for tests and future canon checks): 0..1 lambert, eclipses ignored
      const n = new THREE.Vector3(); const a = THREE.MathUtils.degToRad(lat), o = THREE.MathUtils.degToRad(lon);
      n.set(Math.cos(a) * Math.cos(o), Math.sin(a), -Math.cos(a) * Math.sin(o)).applyAxisAngle(new THREE.Vector3(0, 1, 0), planet.rotation.y);
      return cfg.stars.map((b) => Math.max(0, truePos(b, t).normalize().dot(n)));
    },
  };
  window.__COSMOGRAPH__ = api;
  return api;
}
