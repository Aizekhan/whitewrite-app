// ============================================================================
// 🧩 Комплект моделі — SINGLE SOURCE for the Game Bible (window.__ASSET_KIT, copy in app/firebase/ made by
// scripts/build-app.mjs) and the MCP server (get_card → kit). Edit THIS file.
// ============================================================================
// A card of «Ассети й префаби» (section "assets") lists what a model needs for its full look in the game. Every slot holds
// files on the card (card.files[].field = "kit:<slot id>"), or is marked «не потрібно» (card.kit.na = [slot ids]),
// or stays empty. `rig: true` slots matter for living things (groups Персонажі / Вороги) and start as «не потрібно» elsewhere.
// Hero cards (game characters / enemies) do not take model files from the PC: they link one of these cards (card.prefab).

// 3D models are GLB only (owner, v2.119.0): one file with its textures, rig and animations inside. FBX / OBJ / glTF / STL… keep textures
// beside them (a folder) — they are refused with how to convert (KB «glb-only»); files of those formats uploaded before stay as plain files.
var EXT = {
  mesh: ['glb'],
  image: ['png', 'jpg', 'jpeg', 'tga', 'tif', 'tiff', 'exr', 'psd', 'webp', 'bmp', 'svg', 'dds', 'hdr'],
};
var SLOTS = [
  { id: 'model', group: 'mesh', ext: EXT.mesh, uk: 'Модель (GLB)', en: 'Model (GLB)', hint: { uk: 'Один файл .glb: текстури, риг і анімації всередині', en: 'One .glb file: textures, rig and animations inside' } },
  { id: 'uv', group: 'mesh', optional: true, ext: EXT.image.concat(['pdf']), uk: 'UV-розгортка', en: 'UV layout', hint: { uk: 'Схема розгортки — якщо текстури малюватимуть під неї', en: 'The UV layout — if textures are to be painted on it' } },
  { id: 'lod', group: 'mesh', optional: true, ext: EXT.mesh, uk: 'LOD-и (спрощені моделі)', en: 'LODs (simplified models)', hint: { uk: 'LOD1, LOD2… для дальньої відстані', en: 'LOD1, LOD2… for distance' } },
  { id: 'collider', group: 'mesh', optional: true, ext: EXT.mesh, uk: 'Колайдер (колізійна сітка)', en: 'Collider (collision mesh)', hint: { uk: 'Проста сітка для фізики; інакше — примітиви в Unity', en: 'A simple mesh for physics; else primitives in Unity' } },
  { id: 'material', group: 'surface', ext: ['mat', 'sbsar', 'sbs', 'json', 'shadergraph', 'shader', 'txt', 'md'], uk: 'Матеріал', en: 'Material', hint: { uk: 'Unity .mat, Substance .sbsar або опис шейдера (URP Lit, тайлінг…)', en: 'Unity .mat, Substance .sbsar or a shader note (URP Lit, tiling…)' } },
  { id: 'albedo', group: 'surface', ext: EXT.image, uk: 'Колір (Albedo / Base Color)', en: 'Colour (Albedo / Base Color)' },
  { id: 'normal', group: 'surface', ext: EXT.image, uk: 'Нормалі (Normal map)', en: 'Normal map' },
  { id: 'mask', group: 'surface', ext: EXT.image, uk: 'Metallic / Roughness (ORM, Mask map)', en: 'Metallic / Roughness (ORM, Mask map)', hint: { uk: 'Або окремо, або упаковані в одну карту', en: 'Separate or packed into one map' } },
  { id: 'ao', group: 'surface', ext: EXT.image, uk: 'Ambient Occlusion', en: 'Ambient Occlusion' },
  { id: 'emission', group: 'surface', ext: EXT.image, uk: 'Світіння (Emission)', en: 'Emission', optional: true },
  { id: 'opacity', group: 'surface', ext: EXT.image, uk: 'Прозорість (Alpha / Opacity)', en: 'Opacity (Alpha)', optional: true },
  { id: 'height', group: 'surface', ext: EXT.image, uk: 'Висота (Height / Displacement)', en: 'Height / Displacement', optional: true },
  { id: 'rig', group: 'motion', rig: true, ext: EXT.mesh.concat(['json']), uk: 'Скелет / риг', en: 'Skeleton / rig', hint: { uk: 'Якщо риг не всередині моделі', en: 'If the rig is not inside the model' } },
  { id: 'anims', group: 'motion', rig: true, ext: EXT.mesh.concat(['anim', 'controller']), uk: 'Анімації', en: 'Animations', hint: { uk: 'Кліпи GLB / .anim; бібліотека WhiteWrite — у Кузні персонажів', en: 'GLB / .anim clips; the WhiteWrite library is in the Character forge' } },
  { id: 'prefab', group: 'ready', optional: true, ext: ['prefab', 'unitypackage', 'zip', 'rar', '7z', 'uasset', 'rbxm', 'rbxmx'], uk: 'Префаб / пакет рушія', en: 'Engine prefab / package', hint: { uk: 'Готовий .prefab / .unitypackage (Unity) чи .rbxm (Roblox) — вкладення для рушія, не модель для 3D', en: 'A ready .prefab / .unitypackage (Unity) or .rbxm (Roblox) — an attachment for the engine, not a model for 3D' } },
  { id: 'preview', group: 'ready', optional: true, ext: EXT.image, uk: 'Превʼю / іконка', en: 'Preview / icon' },
  { id: 'license', group: 'ready', ext: ['txt', 'md', 'pdf', 'html'], uk: 'Ліцензія', en: 'Licence', hint: { uk: 'license.txt з джерела — колір ліцензії визначиться сам', en: 'license.txt from the source — the licence colour is detected' } },
];
var GROUPS = [
  { id: 'mesh', uk: 'Геометрія', en: 'Geometry' },
  { id: 'surface', uk: 'Матеріал і текстури', en: 'Material & textures' },
  { id: 'motion', uk: 'Скелет і рух', en: 'Skeleton & motion' },
  { id: 'ready', uk: 'Готове до гри', en: 'Ready for the game' },
];
var LIVING = ['Персонажі', 'Вороги', 'Characters', 'Enemies']; // asset groups whose models are rigged

function slot(id) { return SLOTS.filter(function (s) { return s.id === id; })[0] || null; }
function extOf(name) { var m = /\.([^.\/]+)$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; }
// model formats the service does not take (they need a folder of textures beside them): refused on upload, shown as plain files when old
var NOT_GLB = ['fbx', 'gltf', 'obj', 'stl', 'dae', '3ds', 'ply', 'usd', 'usda', 'usdc', 'usdz'];
function isGlb(name) { return extOf(name) === 'glb'; }
function notGlb(name) { return NOT_GLB.indexOf(extOf(name)) >= 0; }
// a file a hero card must not take from the PC (it links a prefab card instead)
function isModelFile(name) { return EXT.mesh.concat(['prefab', 'unitypackage', 'uasset']).indexOf(extOf(name)) >= 0; }
// «не потрібно» of a card: what the author marked, or — never touched — the rig slots of a non-living asset
function naOf(card) {
  var k = card && card.kit;
  if (k && Array.isArray(k.na)) return k.na.slice();
  var g = String(((card && card.fields) || {}).category || '');
  return LIVING.indexOf(g) >= 0 ? [] : SLOTS.filter(function (s) { return s.rig; }).map(function (s) { return s.id; });
}
// the slot a file fills, by its extension and name ('other' = a texture we cannot name, '' = not part of the kit: .blend and other
// source files, a non-GLB model — plain files of the card)
function classify(name) {
  var x = extOf(name), b = String(name || '').split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
  if (['mat', 'sbsar', 'sbs', 'shadergraph', 'shader'].indexOf(x) >= 0) return 'material';
  if (['prefab', 'unitypackage', 'uasset', 'zip', 'rar', '7z', 'rbxm', 'rbxmx'].indexOf(x) >= 0) return 'prefab'; // rbxm / rbxmx: a Roblox model
  if (['anim', 'controller'].indexOf(x) >= 0) return 'anims';
  if (['txt', 'md', 'pdf', 'html'].indexOf(x) >= 0) return /licen[cs]e|copyright|credits|terms/.test(b) ? 'license' : '';
  if (EXT.mesh.indexOf(x) >= 0) {
    if (/lod[_ -]?\d/.test(b)) return 'lod';
    if (/collider|collision|^ucx_/.test(b)) return 'collider';
    if (/(^|[_ -])(rig|skeleton|armature)([_ -]|$)/.test(b)) return 'rig';
    if (/(^|[_ @-])(anim|idle|walk|run|attack|jump|death|hit)([_ -]|\d|$)/.test(b)) return 'anims';
    return 'model';
  }
  if (EXT.image.indexOf(x) < 0) return '';
  if (/preview|icon|thumb/.test(b)) return 'preview';
  if (/(^|[_ -])(uv|uvs|layout)([_ -]|$)/.test(b)) return 'uv';
  if (/normal|nrm|(^|[_ -])(n|nor|nrml)$/.test(b)) return 'normal';
  if (/(^|[_ -])(orm|mask|ms|mr|rma|arm)$|metal|rough|smooth|specular|gloss/.test(b)) return 'mask';
  if (/(^|[_ -])ao([_ -]|$)|occlusion/.test(b)) return 'ao';
  if (/emiss|glow|(^|[_ -])e$/.test(b)) return 'emission';
  if (/opacity|alpha|transparen/.test(b)) return 'opacity';
  if (/height|disp|bump|parallax/.test(b)) return 'height';
  if (/albedo|base[_ -]?colou?r|diffuse|colou?r|(^|[_ -])(d|bc|col|alb|c)$/.test(b)) return 'albedo';
  return 'other';
}
// the slot a file fills: "kit:<slot>", or — a file uploaded before the kit (no field) — by its name
function fileSlot(f) {
  if (!f) return '';
  if (notGlb(f.name) && (!f.field || /^kit:/.test(f.field))) return 'legacy'; // an FBX / OBJ / glTF… of the kit uploaded before GLB only: listed with «convert to GLB», fills no slot
  if (/^kit:/.test(f.field || '')) return f.field.slice(4);
  return f.field ? '' : classify(f.name);
}
// the kit state: per slot files / na / empty; done = filled of the needed (optional empty slots do not count against it)
function kitState(card) {
  var files = (card && card.files) || [], na = naOf(card);
  var bundle = files.some(function (f) { return fileSlot(f) === 'model' && isGlb(f.name); });
  var rows = SLOTS.map(function (s) {
    var fs = files.filter(function (f) { return fileSlot(f) === s.id; });
    // a GLB carries its materials, textures, rig and animations inside
    var inside = bundle && (s.group === 'surface' || s.group === 'motion') && !s.optional;
    return { slot: s, files: fs, state: fs.length ? 'ok' : na.indexOf(s.id) >= 0 ? 'na' : inside ? 'in' : 'empty' };
  });
  var need = rows.filter(function (r) { return r.state !== 'na' && !(r.slot.optional && r.state === 'empty'); });
  return { rows: rows, done: need.filter(function (r) { return r.state === 'ok' || r.state === 'in'; }).length, total: need.length, na: na, bundle: bundle,
    other: files.filter(function (f) { return fileSlot(f) === 'other'; }), legacy: files.filter(function (f) { return fileSlot(f) === 'legacy'; }) };
}
// for MCP / exports: { slot: [file names] | 'not needed' | 'missing' }
function kitSummary(card, lang) {
  var st = kitState(card), out = {};
  st.rows.forEach(function (r) { out[r.slot.id] = r.state === 'ok' ? r.files.map(function (f) { return { name: f.name, url: f.url }; }) : r.state === 'na' ? 'not needed' : r.state === 'in' ? 'inside the model file' : r.slot.optional ? 'optional, empty' : 'missing'; });
  return { done: st.done, total: st.total, bundle: st.bundle, slots: out, other_textures: st.other.map(function (f) { return f.name; }),
    not_glb: st.legacy.map(function (f) { return f.name; }) }; // old FBX / OBJ… files: convert to GLB
}

// ---------- licence & production health (v2.158.1, moved from gamebible.js so MCP counts the same: the owner's rule «MCP бачить усе») ----------
// green (full) · yellow (with conditions) · red (strict / not commercial) · blue (unknown or own work); file.license on the file, licenseFound on a licence text
var LIC_COLOR = { cc0: 'green', royalty: 'green', unity: 'green', ccby: 'yellow', ccbysa: 'yellow', ccbynd: 'yellow', revcap: 'yellow',
  ccbync: 'red', editorial: 'red', personal: 'red', own: 'blue', unknown: 'blue' };
var ASSET_EXT = /\.(glb|gltf|fbx|obj|stl|prefab|unitypackage|uasset|blend|max|ma|mb|c4d|3ds|dae|usdz?|zip|rar|7z)$/i;
var POLY_MAX = 100000;
function isAsset(f) { return ASSET_EXT.test((f && f.name) || ''); }
function licOf(f, files) {
  if (f.license && f.license.id) return f.license;
  var t = (files || []).filter(function (x) { return x.licenseFound && x.licenseFound.id; })[0];
  if (t) return { id: t.licenseFound.id, source: 'text', from: t.name, text: t.licenseFound.text };
  return { id: 'unknown', source: f.license && f.license.text ? 'file' : 'none', text: f.license && f.license.text };
}
function heavy(f) { return isGlb(f && f.name) && f.tris > POLY_MAX; }
// the «Здоровʼя виробництва» block of the plan: cards with a red / unknown licence, heavy models, non-GLB models, levels without greybox
function health(cards) {
  var out = { red: [], blue: [], heavy: [], notGlb: [], noGreybox: [] }, add = function (k, c) { if (out[k].indexOf(c) < 0) out[k].push(c); };
  (cards || []).forEach(function (c) {
    (c.files || []).forEach(function (f) {
      if (heavy(f)) add('heavy', c);
      if (notGlb(f && f.name)) add('notGlb', c);
      if (!isAsset(f)) return;
      var l = licOf(f, c.files), col = LIC_COLOR[l.id] || 'blue';
      if (col === 'red') add('red', c);
      if (col === 'blue' && l.id !== 'own') add('blue', c);
    });
    if (c.section === 'levels' && !c.assetState) add('noGreybox', c);
  });
  return out;
}

var KIT = { LIC_COLOR: LIC_COLOR, ASSET_EXT: ASSET_EXT, POLY_MAX: POLY_MAX, isAsset: isAsset, licOf: licOf, heavy: heavy, health: health, SLOTS: SLOTS, GROUPS: GROUPS, EXT: EXT, LIVING: LIVING, slot: slot, extOf: extOf, fileSlot: fileSlot, classify: classify, isGlb: isGlb, notGlb: notGlb, NOT_GLB: NOT_GLB, isModelFile: isModelFile, naOf: naOf, kitState: kitState, kitSummary: kitSummary };
if (typeof module !== 'undefined' && module.exports) module.exports = KIT;
if (typeof window !== 'undefined') window.__ASSET_KIT = KIT;
