// 🧩 The model kit of an asset card and the hero → prefab link (functions/asset-kit.js, card-refs KIND «prefab»).
// Run: npm test
const K = require('../functions/asset-kit.js');
const R = require('../functions/card-refs.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got "${got}", want "${want}")`)); if (!ok) fails++; };

// slots: unique ids, uk + en, a known group, extensions
const ids = K.SLOTS.map((s) => s.id);
check(new Set(ids).size, ids.length, 'slot ids are unique');
check(K.SLOTS.every((s) => s.uk && s.en && K.GROUPS.some((g) => g.id === s.group) && s.ext.length), true, 'every slot has uk + en, a group and extensions');

// model files: what a hero card refuses
check(K.isModelFile('Hero.FBX'), true, 'fbx is a model');
check(K.isModelFile('hero.prefab'), true, 'a prefab is refused on a hero too');
check(K.isModelFile('portrait.png'), false, 'a picture is not a model');

// state: a living asset needs the rig; a prop starts with the rig «not needed»
const hero = { fields: { category: 'Персонажі' }, files: [{ name: 'h.fbx', field: 'kit:model' }, { name: 'a.png', field: 'kit:albedo' }] };
const st = K.kitState(hero);
check(st.rows.find((r) => r.slot.id === 'rig').state, 'empty', 'a character needs a rig');
check(st.done, 2, 'two slots filled');
check(st.total, K.SLOTS.filter((s) => !s.optional).length, 'optional empty slots do not count');
const prop = K.kitState({ fields: { category: 'Пропси' }, files: [] });
check(prop.rows.find((r) => r.slot.id === 'anims').state, 'na', 'a prop needs no animations by default');
const marked = K.kitState({ fields: { category: 'Пропси' }, kit: { na: ['uv'] }, files: [] });
check(marked.rows.find((r) => r.slot.id === 'rig').state, 'empty', 'the author\'s «не потрібно» list replaces the default');
check(marked.rows.find((r) => r.slot.id === 'uv').state, 'na', '«не потрібно» marks a slot');

// files from before the kit (no field) fill the model / prefab slots by extension
check(K.fileSlot({ name: 'old.glb' }), 'model', 'an old mesh fills «Модель»');
check(K.fileSlot({ name: 'pack.unitypackage' }), 'prefab', 'an old package fills «Unity-префаб»');
check(K.fileSlot({ name: 'x.png', field: 'portrait' }), '', 'a field file is not a kit file');
check(K.kitSummary(hero).slots.rig, 'missing', 'MCP summary says what is missing');

// a model comes as one self-contained file or as a folder; the folder's files are recognised by name (v2.88.1)
check(K.needsFolder('Knight.FBX'), true, 'an FBX needs its folder');
check(K.needsFolder('knight.glb'), false, 'a GLB is one file');
[['Knight_BaseColor.png', 'albedo'], ['T_Knight_N.png', 'normal'], ['Knight_ORM.png', 'mask'], ['Knight_AO.tga', 'ao'], ['Knight_LOD1.fbx', 'lod'],
 ['Knight@Idle.fbx', 'anims'], ['Knight.mat', 'material'], ['license.txt', 'license'], ['readme.md', ''], ['x.meta', ''], ['cape.png', 'other']]
  .forEach(([n, w]) => check(K.classify(n), w, n + ' → ' + (w || 'skipped')));
const glb = K.kitState({ fields: { category: 'Персонажі' }, files: [{ name: 'k.glb', field: 'kit:model' }] });
check(glb.rows.find((r) => r.slot.id === 'albedo').state, 'in', 'a GLB carries its textures inside');
check(glb.done, glb.total - 1, 'a GLB covers all but the licence');

// the hero → prefab link is a card reference
const G = { cards: [{ id: 'h1', section: 'characters', title: 'Hero', prefab: 'a1' }, { id: 'a1', section: 'assets', title: 'Hero model' }], quests: [], dialogues: [], tasks: [], entities: [] };
const edges = R.KINDS.find((k) => k.id === 'prefab').edges(G);
check(edges.length === 1 && edges[0].to, 'c:a1', 'the hero links its prefab card');

if (fails) { console.log(fails + ' failed'); process.exit(1); }
console.log('asset-kit: all passed');
