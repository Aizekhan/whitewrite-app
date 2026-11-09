// 🗺 «Карта гри» (functions/game-map.js): checks, the whitewrite.gamemap/1 export, scene names, the relief generator / brush,
// and the card references of a zone (functions/card-refs.js KIND «zone»). Run: npm test
const path = require('path');
const F = path.join(__dirname, '../functions');
const GM = require(path.join(F, 'game-map.js'));
const REFS = require(path.join(F, 'card-refs.js'));
const MECH = require(path.join(F, 'mechanics.js'));

let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

const sq = (x, y, s) => [{ x, y }, { x: x + s, y }, { x: x + s, y: y + s }, { x, y: y + s }];
const cards = [
  { id: 'base', section: 'gamemap', gmapBase: true, ratio: 1, files: [{ field: 'map', name: 'morra.png', type: 'image/png', url: 'https://x/morra.png' }] },
  { id: 'z1', section: 'gamemap', order: 1, title: 'Ліс Морри', fields: { text: 'Старт' }, files: [{ field: 'height', name: 'h.png', url: 'https://x/h.png' }],
    zone: { kind: 'open', poly: sq(0.1, 0.1, 0.2), w: 1200, h: 900, lvMin: 1, lvMax: 5, start: true, biome: 'st1', location: 'loc_morra', level: 'lv1', heightM: 80,
      links: [{ to: 'z2', kind: 'portal' }], points: [{ id: 'p1', t: 'spawn', x: 0.5, y: 0.5 }, { id: 'p2', t: 'boss', x: 0.25, y: 0.75, name: 'Вожак', ref: 'wolf' }] } },
  { id: 'z2', section: 'gamemap', order: 2, title: 'Гори Тарн', zone: { kind: 'strip', poly: sq(0.5, 0.1, 0.3), w: 3000, h: 2500, lvMin: 12, links: [], points: [] } },
  { id: 'z3', section: 'gamemap', order: 3, title: 'Шахта', zone: { kind: 'dungeon', poly: [], w: 200, h: 200, links: [{ to: 'gone', kind: 'entrance' }], points: [] } },
  { id: 'st1', section: 'artstyle', title: 'Ліс', fields: {} },
  { id: 'lv1', section: 'levels', title: 'Рівень 1' },
  { id: 'wolf', section: 'enemies', title: 'Вовк' },
];

// zones and basics
check(GM.zones(cards).map((c) => c.id).join(), 'z1,z2,z3', 'zones: only zone cards, in order, without the base card');
check(GM.baseImage(GM.base(cards)).url, 'https://x/morra.png', 'the concept map image');
check(GM.sceneName(cards[1]), 'Zone_LisMorry', 'scene name transliterates the Ukrainian title');
check(GM.sceneName({ id: 'q', title: 'X', zone: { scene: 'My_Scene' } }), 'My_Scene', 'a valid own scene name wins');
check(GM.areaKm2(cards[2].zone), 7.5, 'area in km²');
check(GM.crossMin({ w: 700, h: 0 }, 7), null, 'no size → no crossing time');
check(GM.centroid(sq(0, 0, 1)).map((v) => Math.round(v * 100)).join(), '50,50', 'centroid of a square of {x,y} points → [x, y]');
check(GM.speedOf([{ id: 'm', mech: { tpl: 'level_metrics', sections: [{ id: 'metrics', values: { walk: 3, sprint: 9 } }] } }]), 9, 'running speed from «Метрики рівнів»');
check(GM.speedOf([]), GM.SPEED, 'default running speed');

// checks
const ck = GM.checks(cards);
const has = (zone, re) => ck.some((x) => x.zone === zone && re.test(x.en));
check(has('z2', /km²/), true, 'a 7.5 km² open zone is flagged as too big');
check(has('z3', /km²/), false, 'a dungeon is not flagged for size');
check(has('z3', /no longer exists/), true, 'a link to a missing zone is an error');
check(has('z1', /level jump/), true, 'a level jump 1 → 12 across a link');
check(has('z1', /no “★ Player start”/), false, 'the start zone has its spawn point');
check(has('z1', /portal link but no ◈/), true, 'a portal link without a portal point');
check(has('z3', /unreachable/), true, 'a zone with no path from the start is unreachable');
check(has('z2', /unreachable/), false, 'a linked zone is reachable both ways');
check(has('z2', /no relief/), true, 'no heightmap → a tip');
check(GM.checks([]).length === 1 && GM.checks([])[0].level === 'tip', true, 'no zones → one tip');
check(GM.checks(cards.concat([{ id: 'z4', section: 'gamemap', title: 'Ліс Морри', zone: { start: true, w: 100, h: 100, poly: [] } }])).filter((x) => /start zones/.test(x.en) || /scene name/.test(x.en)).length, 2,
  'two start zones and a duplicate scene name');

// export
const ex = GM.exportMap(cards, { refTitle: (id) => (cards.find((x) => x.id === id) || {}).title || '', entName: (id) => (id === 'loc_morra' ? 'Морра' : ''), man: MECH.FW_BUILTIN, capStatus: MECH.capStatus });
const z1 = ex.zones[0];
check(ex.format, 'whitewrite.gamemap/1', 'export format');
check(ex.concept_map.url, 'https://x/morra.png', 'export: the concept map');
check(z1.ref + ' ' + z1.scene + ' ' + z1.size_m.x + '×' + z1.size_m.z, 'c:z1 Zone_LisMorry 1200×900', 'export: ref, scene and size');
check(z1.heightmap.url + ' ' + z1.heightmap.resolution + ' ' + z1.heightmap.height_m, 'https://x/h.png 513 80', 'export: heightmap');
check(JSON.stringify(z1.points[1]), JSON.stringify({ type: 'boss', label: 'Boss', name: 'Вожак', x_m: 300, z_m: 225, card: { ref: 'c:wolf', title: 'Вовк' } }), 'export: a point in metres from the south-west corner with its card');
check(z1.biome.title + ' / ' + z1.canon_location.name + ' / ' + z1.level_card.title, 'Ліс / Морра / Рівень 1', 'export: biome, canon location, level card');
check(ex.zones[1].links.map((l) => l.to + ':' + l.kind).join(), 'c:z1:portal', 'export: a two-way link is seen from the other zone');
check(JSON.stringify(z1.outline_on_concept[0]), '[0.1,0.1]', 'export: the outline as [x, y] pairs');
check(Array.isArray(ex.framework) && ex.framework.length === 3, true, 'export: the framework note');
check(/get_game_map \{"zone":"c:z1"\}/.test(GM.prompt(cards, 'z1', 'en')), true, 'a zone prompt names the MCP call');
check(/3 zones/.test(GM.prompt(cards, '', 'en')), true, 'the whole-map prompt');

// relief
const R = 65, a = GM.generate({ seed: 7, mountains: 40, hills: 50, water: 20, river: true }, R), b = GM.generate({ seed: 7, mountains: 40, hills: 50, water: 20, river: true }, R);
let lo = 1, hi = 0, same = true; for (let i = 0; i < a.length; i++) { lo = Math.min(lo, a[i]); hi = Math.max(hi, a[i]); if (a[i] !== b[i]) same = false; }
check(lo === 0 && hi === 1, true, 'the generator returns 0..1');
check(same, true, 'the same seed gives the same relief');
const flat = new Float32Array(R * R).fill(0.5); GM.brush(flat, R, 'raise', 0.5, 0.5, 0.1, 1);
check(flat[32 * R + 32] > 0.5 && flat[0] === 0.5, true, 'the raise brush lifts the centre only');
const raw = GM.toRaw16(new Float32Array([0, 1])); check(Array.from(raw).join(), '0,0,255,255', '16-bit little-endian RAW');

// 🏞 location sheet traits
check(JSON.stringify(GM.placeText({ kind: 'ruins', mood: 'сонний', bogus: 'x' }, 'en')), JSON.stringify([{ k: 'kind', label: 'Kind of place', value: 'ruins' }, { k: 'mood', label: 'Mood', value: 'сонний' }]), 'place traits: labels in the language, own values as written');
check(GM.placeLabel('danger', 'deadly', 'uk'), 'смертельна', 'a trait label in Ukrainian');
check(GM.PLACE.every((f) => f.uk && f.en && f.o.length && f.o.every((o) => o.length === 3)), true, 'every trait has labels and [id, uk, en] options');

// card references (KIND «zone»)
const G = { cards, entities: [{ id: 'loc_morra', kind: 'locations', name: 'Морра' }], quests: [], dialogues: [], tasks: [], plan: {} };
const rows = (key) => REFS.usedBy(G, key, 'uk').filter((r) => r.kind === 'zone').map((r) => r.side + ':' + (r.from.title || r.from.key)).sort().join(' | ');
check(rows('c:wolf'), 'in:Ліс Морри', 'an enemy on a boss point sees the zone');
check(rows('c:st1'), 'in:Ліс Морри', 'a biome sees the zone');
check(rows('e:loc_morra'), 'in:Ліс Морри', 'a canon location sees the zone');
check(rows('c:z1'), 'out:Вовк | out:Гори Тарн | out:Ліс | out:Морра | out:Рівень 1', 'a zone lists what it points at');
check(rows('c:z2'), 'in:Ліс Морри', 'the linked zone sees the transition (one record per pair)');

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
