// ============================================================================
// 🗺 Game map — SINGLE SOURCE for the Game Bible's «Карта гри» (app/gamebible.js, window.__GAMEMAP — a copy in app/firebase/
// made by scripts/build-app.mjs), MCP get_game_map (functions/src/mcp.js) and the tests. Edit THIS file.
// The map is game cards of section 'gamemap' (so team access, backup, deletion and «🔗 Що зачепить зміна» work as for any card):
//   the concept map — a card with gmapBase: true and a picture file (field 'map');
//   a zone — a card with `zone` = { kind, poly [{ x, y } 0..1 on the concept — Firestore keeps no arrays in arrays], w, h (m), lvMin, lvMax, start, biome (artstyle card id),
//     location (canon entity id), level (levels card id), scene, heightM (m), links [{ to: zone card id, kind, oneWay }],
//     points [{ id, t, x, y (0..1 inside the zone, y down = north up), name, ref (card id) }] }; the heightmap is a PNG file
//     on the zone card (field 'height', RES × RES, white = heightM).
//   a place (v2.116) — a card with `gpin` = { x, y (0..1 on the concept), ref (a card key «c:<id>» / «e:<entity id>»), note, ratio,
//     pois [{ id, x, y (0..1 on the place picture), title, ref (card key), note, scene (a «Сцени» card id) }] }; its picture is the file
//     'plan', a point of interest's pictures — files 'poi:<id>'. Visual first: a name and one line of comment.
// A zone is a separate Unity scene (a dungeon — an instance scene); zones connect by portals, map edges with a short load,
// or entrances (a mine → its dungeon). The concept map stays in the game as the UI world map (waypoints).
// ============================================================================
(function () {
var RES = 513; // a Unity terrain heightmap: 2^n + 1
var KINDS = [
  { id: 'open', uk: 'Відкрита зона', en: 'Open zone', color: '#7fa86a' },
  { id: 'strip', uk: 'Нейтральна смуга', en: 'Neutral strip', color: '#b79a62' },
  { id: 'hub', uk: 'Хаб / місто', en: 'Hub / town', color: '#d9b45a' },
  { id: 'dungeon', uk: 'Підземелля (інстанс)', en: 'Dungeon (instance)', color: '#8c7bb3' },
];
var LINKS = [
  { id: 'portal', uk: 'Портал', en: 'Portal', icon: '◈' },
  { id: 'edge', uk: 'Край карти (коротка загрузка)', en: 'Map edge (short load)', icon: '⇢' },
  { id: 'entrance', uk: 'Вхід (шахта, печера)', en: 'Entrance (mine, cave)', icon: '⛏' },
];
var POINTS = [
  { id: 'spawn', uk: 'Старт гравця', en: 'Player start', icon: '★' },
  { id: 'portal', uk: 'Портал / вихід', en: 'Portal / exit', icon: '◈' },
  { id: 'waypoint', uk: 'Телепорт', en: 'Waypoint', icon: '✧' },
  { id: 'town', uk: 'Поселення', en: 'Settlement', icon: '⌂' },
  { id: 'poi', uk: 'Цікаве місце', en: 'Point of interest', icon: '◆' },
  { id: 'camp', uk: 'Табір ворогів', en: 'Enemy camp', icon: '⚔' },
  { id: 'boss', uk: 'Бос', en: 'Boss', icon: '☠' },
  { id: 'mine', uk: 'Шахта / вхід у підземелля', en: 'Mine / dungeon entrance', icon: '⛏' },
  { id: 'resource', uk: 'Ресурси', en: 'Resources', icon: '✿' },
  { id: 'chest', uk: 'Скарб', en: 'Treasure', icon: '◇' },
];
var SPEED = 7; // m/s — RPG running, when the game has no «Метрики рівнів»

function arr(v) { return Array.isArray(v) ? v : []; }
function num(v) { return v !== '' && v != null && isFinite(+v) ? +v : null; }
function byId(list, id) { return list.filter(function (x) { return x.id === id; })[0] || null; }
function lbl(x, lang) { return x ? x[lang === 'en' ? 'en' : 'uk'] : ''; }
function kindOf(id) { return byId(KINDS, id) || KINDS[0]; }
function live(cards) { return arr(cards).filter(function (c) { return c && c.section === 'gamemap' && !c.hidden; }); }
function zones(cards) { return live(cards).filter(function (c) { return c.zone && !c.gmapBase; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
function pins(cards) { return live(cards).filter(function (c) { return c.gpin && !c.zone && !c.gmapBase; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); }
function base(cards) { return live(cards).filter(function (c) { return c.gmapBase; })[0] || null; }
function isPic(f) { return /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|gif)$/i.test(f.name || ''); }
function baseImage(b) { return b ? arr(b.files).filter(function (f) { return f.field === 'map' && isPic(f); }).slice(-1)[0] || null : null; }
function heightFile(c) { return arr(c && c.files).filter(function (f) { return f.field === 'height'; }).slice(-1)[0] || null; }
function areaKm2(z) { return num(z.w) && num(z.h) ? Math.round(z.w * z.h / 1e4) / 100 : null; }
// minutes to cross the zone corner to corner at the given speed (m/s)
function crossMin(z, speed) { if (!num(z.w) || !num(z.h)) return null; return Math.round(Math.sqrt(z.w * z.w + z.h * z.h) / (speed || SPEED) / 6) / 10; }
function centroid(poly) {
  poly = arr(poly); if (!poly.length) return null;
  var x = 0, y = 0; poly.forEach(function (p) { x += +p.x || 0; y += +p.y || 0; }); return [x / poly.length, y / poly.length];
}
// the game's running speed from the «Метрики рівнів» mechanic (sprint, else walk), m/s
function speedOf(cards) {
  var m = arr(cards).filter(function (c) { return c && !c.hidden && c.mech && c.mech.tpl === 'level_metrics'; })[0];
  var s = m && arr(m.mech.sections).filter(function (x) { return x.id === 'metrics'; })[0], v = (s && s.values) || {};
  return num(v.sprint) || num(v.walk) || SPEED;
}
// a Unity scene name from a title (Ukrainian letters → Latin): «Ліс Морри» → Zone_LisMorry
var TR = { а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'e', ъ: '' };
function sceneName(c) {
  var z = (c && c.zone) || {};
  if (z.scene && /^[A-Za-z_][A-Za-z0-9_]{0,60}$/.test(z.scene)) return z.scene;
  var t = String((c && c.title) || '').toLowerCase().split('').map(function (ch) { return TR[ch] != null ? TR[ch] : ch; }).join('');
  var words = t.replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).map(function (w) { return w[0].toUpperCase() + w.slice(1); });
  return 'Zone_' + (words.join('').slice(0, 40) || (c && c.id) || 'Unnamed');
}
// the undirected graph of the zones (a one-way link counts only from → to)
function graph(list) {
  var ids = {}, adj = {}, edges = [], seen = {};
  list.forEach(function (c) { ids[c.id] = c; adj[c.id] = []; });
  list.forEach(function (c) {
    arr(c.zone.links).forEach(function (l) {
      if (!l || !ids[l.to] || l.to === c.id) return;
      adj[c.id].push(l.to); if (!l.oneWay) adj[l.to].push(c.id);
      var k = l.oneWay ? c.id + '>' + l.to : [c.id, l.to].sort().join('|');
      if (!seen[k]) { seen[k] = 1; edges.push({ from: c.id, to: l.to, kind: l.kind || 'portal', oneWay: !!l.oneWay }); }
    });
  });
  return { adj: adj, edges: edges };
}

// checks → [{ level: 'err' | 'warn' | 'tip', zone: card id | '', uk, en }]
function checks(cards, speed) {
  var list = zones(cards), out = [], add = function (level, zone, uk, en) { out.push({ level: level, zone: zone || '', uk: uk, en: en }); };
  speed = speed || speedOf(cards);
  if (!list.length) { add('tip', '', 'Ще немає жодної зони: обведи першу на концепт-карті або додай «＋ Зона».', 'No zones yet: outline the first one on the concept map or add “＋ Zone”.'); return out; }
  var G = graph(list), names = {}, starts = list.filter(function (c) { return c.zone.start; });
  if (!starts.length) add('warn', '', 'Познач стартову зону (☆ у паспорті) — з неї перевіряється, чи до кожної зони можна дійти.', 'Mark the start zone (☆ in the passport) — reachability is checked from it.');
  if (starts.length > 1) add('warn', '', 'Стартових зон ' + starts.length + ' — має бути одна.', starts.length + ' start zones — there should be one.');
  list.forEach(function (c) {
    var z = c.zone, t = '«' + (c.title || '?') + '»', te = '“' + (c.title || '?') + '”', a = areaKm2(z), pts = arr(z.points);
    if (!num(z.w) || !num(z.h)) add('warn', c.id, t + ': немає розміру — Claude не знатиме, якої величини Terrain робити.', te + ': no size — Claude won’t know how big to make the terrain.');
    else if (z.kind !== 'dungeon' && a > 4) add('warn', c.id, t + ': ' + a + ' км² — для екшн-RPG це дуже багато (зазвичай 1–2 км²). Світ здається великим через різноманіття зон, а не кілометри.', te + ': ' + a + ' km² — a lot for an action RPG (usually 1–2 km²). A world feels big through varied zones, not kilometres.');
    if (num(z.lvMin) && num(z.lvMax) && +z.lvMin > +z.lvMax) add('warn', c.id, t + ': рівень «від» більший за «до».', te + ': level “from” is above “to”.');
    var sc = sceneName(c); if (names[sc]) add('err', c.id, t + ': назва сцени ' + sc + ' вже є в іншої зони.', te + ': the scene name ' + sc + ' is already used by another zone.'); names[sc] = 1;
    arr(z.links).forEach(function (l) { if (l && !byId(list, l.to)) add('err', c.id, t + ': перехід веде в зону, якої вже немає.', te + ': a link leads to a zone that no longer exists.'); });
    if (list.length > 1 && !G.adj[c.id].length && !list.some(function (x) { return G.adj[x.id].indexOf(c.id) >= 0; })) add('warn', c.id, t + ': немає жодного переходу — як гравець сюди потрапить?', te + ': no links at all — how does the player get here?');
    if (z.start && !pts.some(function (p) { return p.t === 'spawn'; })) add('warn', c.id, t + ' — стартова, але на ній немає точки «★ Старт гравця».', te + ' is the start, but has no “★ Player start” point.');
    if (z.kind !== 'dungeon' && !heightFile(c)) add('tip', c.id, t + ': рельєф не задано — Claude зробить рівну землю. Відкрий «⛰ Рельєф і точки».', te + ': no relief — Claude will make flat ground. Open “⛰ Relief & points”.');
    var m = crossMin(z, speed); if (m && m > 6 && !pts.some(function (p) { return p.t === 'waypoint'; })) add('tip', c.id, t + ': бігом через зону ≈ ' + m + ' хв — додай телепорт ✧ або скороти розмір.', te + ': running across ≈ ' + m + ' min — add a waypoint ✧ or shrink it.');
    if (arr(z.links).some(function (l) { return l && l.kind === 'portal'; }) && !pts.some(function (p) { return p.t === 'portal'; })) add('tip', c.id, t + ': є перехід-портал, але на зоні немає точки ◈ — Claude поставить його навмання.', te + ': it has a portal link but no ◈ point on the zone — Claude will place it at random.');
  });
  G.edges.forEach(function (e) {
    var a = byId(list, e.from), b = byId(list, e.to), la = num(a.zone.lvMin), lb = num(b.zone.lvMin);
    if (la != null && lb != null && Math.abs(la - lb) > 5) add('warn', e.from, '«' + a.title + '» → «' + b.title + '»: стрибок рівня ' + la + ' → ' + lb + ' — гравець опиниться не там, де йому під силу.', '“' + a.title + '” → “' + b.title + '”: a level jump ' + la + ' → ' + lb + ' — the player lands somewhere out of their depth.');
  });
  if (starts.length === 1 && list.length > 1) { // reachability from the start
    var seen = {}, q = [starts[0].id]; seen[starts[0].id] = 1;
    while (q.length) { var id = q.shift(); G.adj[id].forEach(function (n) { if (!seen[n]) { seen[n] = 1; q.push(n); } }); }
    list.forEach(function (c) { if (!seen[c.id]) add('err', c.id, '«' + c.title + '»: зі стартової зони сюди не дійти.', '“' + c.title + '”: unreachable from the start zone.'); });
  }
  return out;
}

// the framework part: zones and their transitions are game code unless the project's manifest has them
function frameworkNote(man, capStatus) {
  if (!capStatus) return null;
  var st = ['world.zones', 'world.spawning', 'pathfinding.grid_astar'].map(function (id) { return capStatus(man, id); });
  return st.map(function (c) { return { id: c.id, status: c.status, notes: c.notes || '' }; });
}

// the whole map for Claude Code (whitewrite.gamemap/1); opts { lang, speed, refTitle(card id) → title, entName(entity id) → name, man, capStatus }
function exportMap(cards, opts) {
  opts = opts || {};
  var lang = opts.lang || 'en', speed = opts.speed || speedOf(cards), list = zones(cards), b = base(cards), img = baseImage(b), G = graph(list);
  var title = function (id) { return opts.refTitle ? opts.refTitle(id) : ''; };
  var zoneOut = function (c) {
    var z = c.zone, hf = heightFile(c), w = num(z.w), h = num(z.h);
    return {
      ref: 'c:' + c.id, title: c.title || '', kind: z.kind || 'open', kind_label: lbl(kindOf(z.kind), lang), scene: sceneName(c), start: !!z.start,
      size_m: w && h ? { x: w, z: h } : null, area_km2: areaKm2(z), cross_minutes_running: crossMin(z, speed),
      level: num(z.lvMin) != null || num(z.lvMax) != null ? { min: num(z.lvMin), max: num(z.lvMax) } : null,
      biome: z.biome ? { ref: 'c:' + z.biome, title: title(z.biome) } : null,
      canon_location: z.location ? { ref: 'e:' + z.location, name: opts.entName ? opts.entName(z.location) : '' } : null,
      level_card: z.level ? { ref: 'c:' + z.level, title: title(z.level) } : null,
      description: String((c.fields || {}).text || '').slice(0, 4000),
      outline_on_concept: arr(z.poly).map(function (p) { return [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000]; }),
      heightmap: hf ? { url: hf.url, resolution: RES, format: 'PNG 8-bit grayscale, ' + RES + '×' + RES + ', black = 0 m, white = height_m; top of the image = north (+Z)', height_m: num(z.heightM) || 60 } : null,
      points: arr(z.points).map(function (p) {
        var o = { type: p.t, label: lbl(byId(POINTS, p.t), lang), name: p.name || '', x_m: w ? Math.round(p.x * w) : null, z_m: h ? Math.round((1 - p.y) * h) : null };
        if (p.ref) o.card = { ref: 'c:' + p.ref, title: title(p.ref) };
        return o;
      }),
      links: G.edges.filter(function (e) { return e.from === c.id || (!e.oneWay && e.to === c.id); }).map(function (e) {
        var other = e.from === c.id ? e.to : e.from, o = byId(list, other);
        return { to: 'c:' + other, title: o ? o.title || '' : '', scene: o ? sceneName(o) : '', kind: e.kind, one_way: e.oneWay };
      }),
    };
  };
  return {
    format: 'whitewrite.gamemap/1',
    concept_map: img ? { url: img.url, note: 'The concept plan the author drew the zones on — not a level, a plan. Keep it as the in-game UI world map (waypoints, discovered zones).' } : null,
    running_speed_m_s: speed,
    zones: list.map(zoneOut),
    places: pins(cards).map(function (c) { return placeOut(c, opts); }),
    checks: checks(cards, speed).map(function (x) { return { level: x.level, zone: x.zone ? 'c:' + x.zone : null, text: lbl(x, lang) }; }),
    framework: frameworkNote(opts.man, opts.capStatus),
    how_to_build: [
      'Every zone is its own Unity scene (scene name given); a dungeon is an instance scene. Transitions: a portal or a map edge loads the target scene with a short loading screen; an entrance loads its dungeon. Keep one persistent bootstrap scene for the player, UI and save.',
      'Terrain: size_m.x × size_m.z metres, height range height_m; import the heightmap PNG (an editor script: read the pixels → TerrainData.SetHeights, or convert to 16-bit RAW for the Terrain importer). Origin (0,0) = the south-west corner, +X east, +Z north; points are in these metres.',
      'Ground textures, trees and rocks follow the zone biome (get_style_guide with the biome title); buildings and props come from the asset cards.',
      'Place points as empty GameObjects (spawn, portal, waypoint, camp, boss…) named after them, then build on them; a portal point connects to the link of the same zone.',
      'Start with greybox: the terrain, the points and working transitions; art comes after the author approves the greybox.',
    ],
  };
}
// a place for the export: where it is on the concept, its card, its picture and points of interest with their cards, scenes and pictures
function placeOut(c, opts) {
  var g = c.gpin || {}, files = arr(c.files);
  var card = function (ref) {
    if (!ref) return null; var i = String(ref).indexOf(':'), kind = String(ref).slice(0, i), id = String(ref).slice(i + 1);
    var t = kind === 'e' ? (opts.entName ? opts.entName(id) : '') || (opts.refTitle ? opts.refTitle(id) : '') : opts.refTitle ? opts.refTitle(id) : '';
    return { ref: ref, title: t || '' };
  };
  var pics = function (field) { return files.filter(function (f) { return f.field === field && isPic(f); }).map(function (f) { return f.url; }); };
  return {
    ref: 'c:' + c.id, title: c.title || '', at_on_concept: [+g.x || 0, +g.y || 0], card: card(g.ref), note: g.note || '',
    picture: pics('plan').slice(-1)[0] || null,
    points_of_interest: arr(g.pois).map(function (p) {
      return { title: p.title || '', at_on_picture: [+p.x || 0, +p.y || 0], card: card(p.ref), note: p.note || '',
        scene: p.scene ? { ref: 'c:' + p.scene, title: opts.refTitle ? opts.refTitle(p.scene) || '' : '' } : null, pictures: pics('poi:' + p.id) };
    }),
  };
}
// a ready request for Claude Code: one zone (zoneId) or the whole map
function prompt(cards, zoneId, lang) {
  var list = zones(cards), c = zoneId ? byId(list, zoneId) : null, en = lang === 'en';
  if (c) return en
    ? 'Build the zone “' + c.title + '” of the game map as a greybox in Unity. Call get_game_map {"zone":"c:' + c.id + '"} (WhiteWrite MCP): the scene ' + sceneName(c) + ', its size, heightmap, points and transitions. Make the scene, the Terrain from the heightmap, empty GameObjects for every point, and the working transitions to the linked zones (a short loading screen). Then report with submit_task_result if this is a plan task, and tell me what to check.'
    : 'Збудуй зону «' + c.title + '» з карти гри як greybox в Unity. Виклич get_game_map {"zone":"c:' + c.id + '"} (MCP WhiteWrite): сцена ' + sceneName(c) + ', розмір, карта висот, точки й переходи. Зроби сцену, Terrain з карти висот, порожні GameObject на кожну точку й робочі переходи в сусідні зони (з короткою загрузкою). Потім звітуй submit_task_result, якщо це задача плану, і скажи, що мені перевірити.';
  return en
    ? 'Set up the world of the game from the WhiteWrite game map. Call get_game_map (MCP): ' + list.length + ' zones, each its own scene, with sizes, heightmaps, points and transitions; fix nothing in the design — if something is impossible, submit_change_request. Make a bootstrap scene and a scene per zone (greybox: terrain + points + transitions), the scene-loading service, and the UI world map from the concept map. Tell me what to check.'
    : 'Налаштуй світ гри за картою гри з WhiteWrite. Виклич get_game_map (MCP): ' + list.length + ' зон, кожна — окрема сцена, з розмірами, картами висот, точками й переходами; дизайн не змінюй — якщо щось неможливо, submit_change_request. Зроби bootstrap-сцену і сцену на кожну зону (greybox: рельєф + точки + переходи), сервіс завантаження сцен і UI-карту світу з концепт-карти. Скажи, що мені перевірити.';
}

// ---- the relief: a heightmap generator (no tokens, the same in the browser and the tests) ----
function rng(seed) { var s = (seed >>> 0) || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function noiseGrid(n, seed) { var r = rng(seed), g = new Float32Array((n + 1) * (n + 1)); for (var i = 0; i < g.length; i++) g[i] = r(); return g; }
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(g, n, x, y) { // x, y in 0..n
  var xi = Math.min(n - 1, Math.floor(x)), yi = Math.min(n - 1, Math.floor(y)), tx = smooth(x - xi), ty = smooth(y - yi), w = n + 1;
  var a = g[yi * w + xi], b = g[yi * w + xi + 1], c = g[(yi + 1) * w + xi], d = g[(yi + 1) * w + xi + 1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
// p { seed, mountains 0..100, hills 0..100, water 0..100 (share of lowland under the sea level), river: bool } → Float32Array size×size of 0..1
function generate(p, size) {
  size = size || RES; p = p || {};
  var seed = (+p.seed || 1) >>> 0, out = new Float32Array(size * size), oct = [[4, 0.55], [8, 0.25], [16, 0.12], [32, 0.08]];
  var grids = oct.map(function (o, i) { return noiseGrid(o[0], seed + i * 7919); }), ridge = noiseGrid(6, seed + 31337);
  var mnt = (+p.mountains || 0) / 100, hil = (p.hills == null ? 50 : +p.hills) / 100, wat = (+p.water || 0) / 100;
  for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
    var u = x / (size - 1), v = y / (size - 1), h = 0;
    oct.forEach(function (o, i) { h += valueNoise(grids[i], o[0], u * o[0], v * o[0]) * o[1] * (i ? hil * 1.6 : 1); });
    var r = 1 - Math.abs(valueNoise(ridge, 6, u * 6, v * 6) * 2 - 1); h += Math.pow(r, 3) * mnt * 0.9;
    out[y * size + x] = h;
  }
  if (p.river) { // a river: a valley along a wavy line west → east
    var ph = rng(seed + 99)() * 6.28;
    for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) {
      var cy = 0.5 + 0.18 * Math.sin(xx / size * 6.28 * 1.3 + ph), d = Math.abs(yy / size - cy);
      if (d < 0.06) out[yy * size + xx] *= 0.35 + d / 0.06 * 0.65;
    }
  }
  normalize(out);
  if (wat > 0) { var sea = wat * 0.6; for (var k = 0; k < out.length; k++) out[k] = out[k] < sea ? sea * 0.92 + (out[k] / sea) * sea * 0.08 : out[k]; normalize(out); }
  return out;
}
function normalize(a) {
  var lo = Infinity, hi = -Infinity; for (var i = 0; i < a.length; i++) { if (a[i] < lo) lo = a[i]; if (a[i] > hi) hi = a[i]; }
  var d = hi - lo || 1; for (var j = 0; j < a.length; j++) a[j] = (a[j] - lo) / d; return a;
}
// a brush stroke on heights (size×size): kind raise | lower | smooth | flat, at (x, y) 0..1, radius 0..1, strength 0..1
function brush(a, size, kind, x, y, radius, strength) {
  var cx = x * (size - 1), cy = y * (size - 1), r = Math.max(1, radius * size), r2 = r * r, flat = a[Math.round(cy) * size + Math.round(cx)] || 0;
  var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(size - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(size - 1, Math.ceil(cy + r));
  var src = kind === 'smooth' ? a.slice() : null;
  for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
    var d2 = (xx - cx) * (xx - cx) + (yy - cy) * (yy - cy); if (d2 > r2) continue;
    var f = (1 - d2 / r2) * (1 - d2 / r2) * strength, i = yy * size + xx;
    if (kind === 'raise') a[i] = Math.min(1, a[i] + f * 0.08);
    else if (kind === 'lower') a[i] = Math.max(0, a[i] - f * 0.08);
    else if (kind === 'flat') a[i] += (flat - a[i]) * f;
    else if (kind === 'smooth') {
      var s = 0, n = 0; for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) { var X = xx + ox, Y = yy + oy; if (X >= 0 && Y >= 0 && X < size && Y < size) { s += src[Y * size + X]; n++; } }
      a[i] += (s / n - a[i]) * f;
    }
  }
}
// 16-bit little-endian RAW for the Unity terrain importer
function toRaw16(a) { var buf = new Uint8Array(a.length * 2); for (var i = 0; i < a.length; i++) { var v = Math.round(Math.max(0, Math.min(1, a[i])) * 65535); buf[i * 2] = v & 255; buf[i * 2 + 1] = v >> 8; } return buf; }

// 🏞 A location card's sheet (owner, v2.115): traits picked from lists beside its picture — `card.place { kind, role, danger, size, climate, light, mood }`;
// a value is an option id, or the author's own text («✎ Своє…»)
var PLACE = [
  { k: 'kind', uk: 'Тип місця', en: 'Kind of place', o: [['town', 'місто', 'town'], ['village', 'село', 'village'], ['castle', 'фортеця / замок', 'fortress / castle'], ['ruins', 'руїни', 'ruins'],
    ['temple', 'храм / святилище', 'temple / shrine'], ['camp', 'табір', 'camp'], ['dungeon', 'підземелля', 'dungeon'], ['cave', 'печера', 'cave'], ['forest', 'ліс', 'forest'], ['mountains', 'гори', 'mountains'],
    ['plains', 'рівнина / поля', 'plains / fields'], ['swamp', 'болото', 'swamp'], ['desert', 'пустеля', 'desert'], ['coast', 'узбережжя', 'coast'], ['island', 'острів', 'island'], ['otherworld', 'інший світ / план', 'otherworld / plane']] },
  { k: 'role', uk: 'Роль у грі', en: 'Role in the game', o: [['hub', 'хаб / безпечна зона', 'hub / safe zone'], ['open', 'відкритий світ', 'open world'], ['linear', 'лінійний рівень', 'linear level'],
    ['instance', 'підземелля-інстанс', 'dungeon instance'], ['arena', 'арена боса', 'boss arena'], ['combat', 'бойова зона', 'combat zone'], ['story', 'сюжетна сцена', 'story scene'], ['secret', 'таємна локація', 'secret location']] },
  { k: 'danger', uk: 'Небезпека', en: 'Danger', o: [['safe', 'безпечно', 'safe'], ['low', 'низька', 'low'], ['mid', 'середня', 'medium'], ['high', 'висока', 'high'], ['deadly', 'смертельна', 'deadly']] },
  { k: 'size', uk: 'Розмір', en: 'Size', o: [['room', 'кімната', 'a room'], ['small', 'мала (до 100 м)', 'small (up to 100 m)'], ['mid', 'середня (100–500 м)', 'medium (100–500 m)'],
    ['large', 'велика (0,5–1 км)', 'large (0.5–1 km)'], ['huge', 'величезна (1–2 км)', 'huge (1–2 km)']] },
  { k: 'climate', uk: 'Клімат', en: 'Climate', o: [['mild', 'помірний', 'temperate'], ['cold', 'холод / сніг', 'cold / snow'], ['hot', 'спека / сухо', 'hot / dry'], ['tropic', 'тропіки / волого', 'tropical / humid'],
    ['fog', 'туман / дощ', 'fog / rain'], ['under', 'під землею', 'underground'], ['magic', 'магічний', 'magical']] },
  { k: 'light', uk: 'Світло', en: 'Light', o: [['day', 'день', 'day'], ['dusk', 'сутінки', 'dusk'], ['night', 'ніч', 'night'], ['dark', 'вічна темрява', 'eternal dark'], ['cycle', 'цикл дня й ночі', 'day / night cycle'], ['indoor', 'штучне / вогонь', 'artificial / fire']] },
  { k: 'mood', uk: 'Настрій', en: 'Mood', o: [['calm', 'спокійний', 'calm'], ['mystery', 'таємничий', 'mysterious'], ['tense', 'тривожний', 'tense'], ['grim', 'гнітючий', 'grim'],
    ['solemn', 'урочистий', 'solemn'], ['horror', 'жахливий', 'horrifying'], ['joy', 'радісний', 'joyful'], ['epic', 'епічний', 'epic']] },
];
function placeLabel(k, v, lang) {
  var f = byId(PLACE.map(function (x) { return { id: x.k, o: x.o }; }), k), o = f && f.o.filter(function (x) { return x[0] === v; })[0];
  return o ? o[lang === 'en' ? 2 : 1] : String(v || '');
}
// card.place → [{ k, label, value }] in the language (only the filled traits)
function placeText(place, lang) {
  place = place || {};
  return PLACE.filter(function (f) { return place[f.k]; }).map(function (f) { return { k: f.k, label: lbl(f, lang), value: placeLabel(f.k, place[f.k], lang) }; });
}

var GAMEMAP = { RES: RES, PLACE: PLACE, placeLabel: placeLabel, placeText: placeText, KINDS: KINDS, LINKS: LINKS, POINTS: POINTS, SPEED: SPEED, kindOf: kindOf, zones: zones, pins: pins, base: base, baseImage: baseImage, heightFile: heightFile,
  areaKm2: areaKm2, crossMin: crossMin, centroid: centroid, speedOf: speedOf, sceneName: sceneName, graph: graph, checks: checks, exportMap: exportMap, prompt: prompt,
  generate: generate, brush: brush, normalize: normalize, toRaw16: toRaw16, lbl: lbl };
if (typeof module !== 'undefined' && module.exports) module.exports = GAMEMAP;
if (typeof window !== 'undefined') window.__GAMEMAP = GAMEMAP;
})();
