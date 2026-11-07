// ============================================================================
// 🧩 Комплект моделі — SINGLE SOURCE for the Game Bible (window.__ASSET_KIT, copy in app/firebase/ made by
// scripts/build-app.mjs) and the MCP server (get_card → kit). Edit THIS file.
// ============================================================================
// A card of «Ассети й префаби» (section "assets") lists what a model needs for its full look in the game. Every slot holds
// files on the card (card.files[].field = "kit:<slot id>"), or is marked «не потрібно» (card.kit.na = [slot ids]),
// or stays empty. `rig: true` slots matter for living things (groups Персонажі / Вороги) and start as «не потрібно» elsewhere.
// Hero cards (game characters / enemies) do not take model files from the PC: they link one of these cards (card.prefab).

var EXT = {
  mesh: ['fbx', 'glb', 'gltf', 'obj', 'blend', 'dae', '3ds', 'stl', 'usd', 'usdz', 'max', 'ma', 'mb'],
  image: ['png', 'jpg', 'jpeg', 'tga', 'tif', 'tiff', 'exr', 'psd', 'webp', 'bmp', 'svg', 'dds', 'hdr'],
};
var SLOTS = [
  { id: 'model', group: 'mesh', ext: EXT.mesh, uk: 'Модель (меш)', en: 'Model (mesh)', hint: { uk: 'Основний файл: FBX, glTF / GLB, OBJ, Blend…', en: 'The main file: FBX, glTF / GLB, OBJ, Blend…' } },
  { id: 'uv', group: 'mesh', ext: EXT.image.concat(['pdf']), uk: 'UV-розгортка', en: 'UV layout', hint: { uk: 'Схема розгортки — якщо текстури малюватимуть під неї', en: 'The UV layout — if textures are to be painted on it' } },
  { id: 'lod', group: 'mesh', ext: EXT.mesh, uk: 'LOD-и (спрощені моделі)', en: 'LODs (simplified models)', hint: { uk: 'LOD1, LOD2… для дальньої відстані', en: 'LOD1, LOD2… for distance' } },
  { id: 'collider', group: 'mesh', ext: EXT.mesh, uk: 'Колайдер (колізійна сітка)', en: 'Collider (collision mesh)', hint: { uk: 'Проста сітка для фізики; інакше — примітиви в Unity', en: 'A simple mesh for physics; else primitives in Unity' } },
  { id: 'material', group: 'surface', ext: ['mat', 'sbsar', 'sbs', 'mtl', 'json', 'shadergraph', 'shader', 'txt', 'md'], uk: 'Матеріал', en: 'Material', hint: { uk: 'Unity .mat, Substance .sbsar, .mtl або опис шейдера (URP Lit, тайлінг…)', en: 'Unity .mat, Substance .sbsar, .mtl or a shader note (URP Lit, tiling…)' } },
  { id: 'albedo', group: 'surface', ext: EXT.image, uk: 'Колір (Albedo / Base Color)', en: 'Colour (Albedo / Base Color)' },
  { id: 'normal', group: 'surface', ext: EXT.image, uk: 'Нормалі (Normal map)', en: 'Normal map' },
  { id: 'mask', group: 'surface', ext: EXT.image, uk: 'Metallic / Roughness (ORM, Mask map)', en: 'Metallic / Roughness (ORM, Mask map)', hint: { uk: 'Або окремо, або упаковані в одну карту', en: 'Separate or packed into one map' } },
  { id: 'ao', group: 'surface', ext: EXT.image, uk: 'Ambient Occlusion', en: 'Ambient Occlusion' },
  { id: 'emission', group: 'surface', ext: EXT.image, uk: 'Світіння (Emission)', en: 'Emission', optional: true },
  { id: 'opacity', group: 'surface', ext: EXT.image, uk: 'Прозорість (Alpha / Opacity)', en: 'Opacity (Alpha)', optional: true },
  { id: 'height', group: 'surface', ext: EXT.image, uk: 'Висота (Height / Displacement)', en: 'Height / Displacement', optional: true },
  { id: 'rig', group: 'motion', rig: true, ext: EXT.mesh.concat(['json']), uk: 'Скелет / риг', en: 'Skeleton / rig', hint: { uk: 'Якщо риг не всередині моделі', en: 'If the rig is not inside the model' } },
  { id: 'anims', group: 'motion', rig: true, ext: EXT.mesh.concat(['anim', 'controller']), uk: 'Анімації', en: 'Animations', hint: { uk: 'Кліпи FBX / .anim; бібліотека WhiteWrite — у Кузні персонажів', en: 'FBX / .anim clips; the WhiteWrite library is in the Character forge' } },
  { id: 'prefab', group: 'ready', ext: ['prefab', 'unitypackage', 'zip', 'rar', '7z', 'uasset'], uk: 'Unity-префаб / пакет', en: 'Unity prefab / package', hint: { uk: 'Готовий .prefab чи .unitypackage з усім разом', en: 'A ready .prefab or .unitypackage with everything' } },
  { id: 'preview', group: 'ready', ext: EXT.image, uk: 'Превʼю / іконка', en: 'Preview / icon' },
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
// a file a hero card must not take from the PC (it links a prefab card instead)
function isModelFile(name) { return EXT.mesh.concat(['prefab', 'unitypackage', 'uasset']).indexOf(extOf(name)) >= 0; }
// «не потрібно» of a card: what the author marked, or — never touched — the rig slots of a non-living asset
function naOf(card) {
  var k = card && card.kit;
  if (k && Array.isArray(k.na)) return k.na.slice();
  var g = String(((card && card.fields) || {}).category || '');
  return LIVING.indexOf(g) >= 0 ? [] : SLOTS.filter(function (s) { return s.rig; }).map(function (s) { return s.id; });
}
// the slot a file fills: "kit:<slot>", or — a file uploaded before the kit (no field) — a model / package by its extension
function fileSlot(f) {
  if (!f) return '';
  if (/^kit:/.test(f.field || '')) return f.field.slice(4);
  if (f.field) return '';
  var x = extOf(f.name);
  return EXT.mesh.indexOf(x) >= 0 ? 'model' : ['prefab', 'unitypackage', 'uasset'].indexOf(x) >= 0 ? 'prefab' : '';
}
// the kit state: per slot files / na / empty; done = filled of the needed (optional empty slots do not count against it)
function kitState(card) {
  var files = (card && card.files) || [], na = naOf(card), rows = SLOTS.map(function (s) {
    var fs = files.filter(function (f) { return fileSlot(f) === s.id; });
    return { slot: s, files: fs, state: fs.length ? 'ok' : na.indexOf(s.id) >= 0 ? 'na' : 'empty' };
  });
  var need = rows.filter(function (r) { return r.state !== 'na' && !(r.slot.optional && r.state === 'empty'); });
  return { rows: rows, done: need.filter(function (r) { return r.state === 'ok'; }).length, total: need.length, na: na };
}
// for MCP / exports: { slot: [file names] | 'not needed' | 'missing' }
function kitSummary(card, lang) {
  var st = kitState(card), out = {};
  st.rows.forEach(function (r) { out[r.slot.id] = r.state === 'ok' ? r.files.map(function (f) { return { name: f.name, url: f.url }; }) : r.state === 'na' ? 'not needed' : r.slot.optional ? 'optional, empty' : 'missing'; });
  return { done: st.done, total: st.total, slots: out };
}

var KIT = { SLOTS: SLOTS, GROUPS: GROUPS, EXT: EXT, LIVING: LIVING, slot: slot, extOf: extOf, fileSlot: fileSlot, isModelFile: isModelFile, naOf: naOf, kitState: kitState, kitSummary: kitSummary };
if (typeof module !== 'undefined' && module.exports) module.exports = KIT;
if (typeof window !== 'undefined') window.__ASSET_KIT = KIT;
