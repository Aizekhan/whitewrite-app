// ============================================================================
// ⚒ Кузня персонажів (Character Forge) — SINGLE SOURCE for the Game Bible (window.__FORGE, copy in app/firebase/ made by
// scripts/build-app.mjs), the MCP server (get_character_forge / report_forge_check) and the tests. Edit THIS file.
// ============================================================================
// No parallel collections: a character is the game's card it already is (section "characters" — canon-linked, or "enemies"),
// an equipment item is a card of «Предмети й спорядження» ("gear"); files are the card's files (Storage
// worlds/{w}/games/{g}/files/{cardId}/…). The Forge adds one map `forge` to such a card:
//   character: { type: hero|npc|boss|enemy, off: [stageId] (stages switched off for this one), rig, body (profile ids),
//     shape: { Thin, Heavy, Muscular } (0–100, the body's blend shapes), rigCheck: { result, issues, report, rev, source, at } (rig.json / MCP),
//     brief: { race, cls, role, silhouette, proportions, palette, refs },
//     revs: [{ id, stage, n, files: [fileId], note, by, byName, at, from (revId it was restored from) }]   — never edited, only added
//     stages: { stageId: { approved: { rev, by, byName, at, comment } | null } },
//     clips: [{ id, name, status: todo|done|checked, lib?: library clip id, a?: its snapshot (animSnap) }], loadouts: [{ id, name, items: { slotId: cardId } }],
//     notes: [{ stage, text, byName, at }] }
//   item: { slot, bind: skinned|rigid, rig, body, mask: [region], attach: [{ bone, point }], format, units, maps: [map], lod,
//     polyTarget, owners: [characterCardId], revs (stage "concept" | "model"), approval: { rev, byName, at, comment } (manual, warnings only),
//     external: [{ check, result: passed|warning|failed, details, source, at }] (Unity / Blender via MCP report_forge_check) }
// The game: games/{g}.forge { slots: [{ id, uk, en, bind }], rigs: [{ id, name, notes }], bodies: [{ id, name, rig, notes }] }.
// A revision is immutable: a new upload or «Повернути версію» adds one; approval points at a revision and is never moved
// by anything but the author. Checks state only what the platform can see — clipping and deformation come from the DCC/Unity side.

(function () {
var STAGES = [
  { id: 'brief', kind: 'brief', deps: [], uk: 'Бриф персонажа', en: 'Character brief',
    what: { uk: 'Раса, клас, роль, лор, силует, пропорції, палітра, референси.', en: 'Race, class, role, lore, silhouette, proportions, palette, references.' },
    done: { uk: 'Бриф заповнений і затверджений.', en: 'The brief is filled in and approved.' } },
  { id: 'concept', kind: 'files', deps: ['brief'], uk: 'Концепт-арт', en: 'Concept art',
    what: { uk: 'Концепти, фронт / бік / спина, T- чи A-поза, обличчя, одяг.', en: 'Concepts, front / side / back, T or A pose, face, clothing.' },
    done: { uk: 'Фінальний дизайн затверджено.', en: 'The final design is approved.' } },
  { id: 'mesh', kind: 'files', deps: ['concept'], uk: 'Базова модель', en: 'Base mesh',
    what: { uk: '3D-база: геометрія, пропорції, UV, матеріали, вихідний файл і прев’ю (GLB / FBX).', en: '3D base: geometry, proportions, UVs, materials, the source file and a preview (GLB / FBX).' },
    done: { uk: 'Модель перевірена й затверджена.', en: 'The model is checked and approved.' } },
  { id: 'rig', kind: 'files', deps: ['mesh'], uk: 'Риг і скелет', en: 'Rigging',
    what: { uk: 'Скелет, ваги, профіль рига, тест деформацій.', en: 'Skeleton, skin weights, the rig profile, a deformation test.' },
    done: { uk: 'Риг затверджено, профіль скелета визначено.', en: 'The rig is approved and its skeleton profile set.' } },
  { id: 'equip', kind: 'equip', deps: ['rig'], uk: 'Екіпірування', en: 'Equipment',
    what: { uk: 'Слоти, предмети, їхні концепти й моделі, матеріали, варіанти, набори (loadouts).', en: 'Slots, items, their concepts and models, materials, variants, loadouts.' },
    done: { uk: 'Кожен предмет має специфікацію і слот.', en: 'Every item has a spec and a slot.' } },
  { id: 'integrate', kind: 'integrate', deps: ['equip'], uk: 'Інтеграція', en: 'Integration',
    what: { uk: 'Підгонка, точки кріплення, маски тіла, перевірка кліпінгу й рига (у Unity / Blender).', en: 'Fitting, attachment points, body masks, clipping and rig tests (in Unity / Blender).' },
    done: { uk: 'Перевірки пройдені або є погоджений виняток.', en: 'Checks pass or there is an agreed exception.' } },
  { id: 'anim', kind: 'anim', deps: ['rig'], uk: 'Анімації', en: 'Animation',
    what: { uk: 'Idle, ходьба / біг, атака, блок / ухилення, смерть і потрібні кліпи.', en: 'Idle, walk / run, attack, block / dodge, death and the clips it needs.' },
    done: { uk: 'Анімації перевірені на моделі й екіпіруванні.', en: 'Animations are checked on the model and the equipment.' } },
  { id: 'export', kind: 'export', deps: ['mesh', 'rig', 'equip', 'integrate', 'anim'], uk: 'Експорт', en: 'Export',
    what: { uk: 'FBX / GLB, текстури, матеріали, LOD, пакет префаба для Unity.', en: 'FBX / GLB, textures, materials, LODs, a prefab package for Unity.' },
    done: { uk: 'Експортний пакет зібраний і перевірений.', en: 'The export package is put together and checked.' } },
];
// a pipeline per kind of character — the author can switch any stage off or back on for one character (forge.off)
var TYPES = [
  { id: 'hero', uk: 'Герой', en: 'Hero', stages: ['brief', 'concept', 'mesh', 'rig', 'equip', 'integrate', 'anim', 'export'],
    clips: ['idle', 'walk', 'run', 'attack', 'block', 'dodge', 'hit', 'death'] },
  { id: 'npc', uk: 'NPC', en: 'NPC', stages: ['brief', 'concept', 'mesh', 'rig', 'anim', 'export'], clips: ['idle', 'walk', 'talk'] },
  { id: 'enemy', uk: 'Ворог', en: 'Enemy', stages: ['brief', 'concept', 'mesh', 'rig', 'anim', 'export'], clips: ['idle', 'walk', 'attack', 'hit', 'death'] },
  { id: 'boss', uk: 'Бос', en: 'Boss', stages: ['brief', 'concept', 'mesh', 'rig', 'equip', 'integrate', 'anim', 'export'],
    clips: ['idle', 'walk', 'attack', 'special', 'hit', 'phase', 'death'] },
];
var CLIPS = { idle: ['Очікування (idle)', 'Idle'], walk: ['Ходьба', 'Walk'], run: ['Біг', 'Run'], attack: ['Атака', 'Attack'], block: ['Блок', 'Block'],
  dodge: ['Ухилення', 'Dodge'], hit: ['Отримання удару', 'Hit reaction'], death: ['Смерть', 'Death'], talk: ['Розмова', 'Talk'],
  special: ['Особлива атака', 'Special attack'], phase: ['Перехід фази', 'Phase transition'] };
// the slots a game starts with («⚙ Слоти й профілі» edits them): skinned — follows the skeleton by weights, rigid — hangs on a bone / point
var SLOTS = [['head', 'Голова', 'Head', 'skinned'], ['hair', 'Волосся', 'Hair', 'skinned'], ['face', 'Обличчя', 'Face', 'skinned'],
  ['shoulders', 'Плечі', 'Shoulders', 'skinned'], ['chest', 'Торс', 'Chest', 'skinned'], ['arms', 'Руки', 'Arms', 'skinned'],
  ['hands', 'Кисті', 'Hands', 'skinned'], ['waist', 'Пояс', 'Waist', 'skinned'], ['legs', 'Ноги', 'Legs', 'skinned'], ['feet', 'Стопи', 'Feet', 'skinned'],
  ['back', 'Спина / плащ', 'Back / cloak', 'skinned'], ['mainhand', 'Зброя (права рука)', 'Weapon main hand', 'rigid'],
  ['offhand', 'Зброя / щит (ліва рука)', 'Weapon / shield off hand', 'rigid'], ['accessory', 'Аксесуар', 'Accessory', 'rigid']]
  .map(function (s) { return { id: s[0], uk: s[1], en: s[2], bind: s[3] }; });
// body regions an item may hide (body masking)
var MASK = [['head', 'Голова', 'Head'], ['hair', 'Волосся', 'Hair'], ['face', 'Обличчя', 'Face'], ['neck', 'Шия', 'Neck'], ['torso', 'Тулуб', 'Torso'],
  ['upperArms', 'Плечі й передпліччя', 'Upper arms'], ['forearms', 'Передпліччя', 'Forearms'], ['hands', 'Кисті', 'Hands'], ['hips', 'Таз', 'Hips'],
  ['thighs', 'Стегна', 'Thighs'], ['shins', 'Гомілки', 'Shins'], ['feet', 'Стопи', 'Feet']].map(function (m) { return { id: m[0], uk: m[1], en: m[2] }; });
var MAPS = ['baseColor', 'normal', 'metallic', 'roughness', 'emission', 'ao'];
var VALIDATION = { pending: ['Очікує', 'Pending'], passed: ['Пройдено', 'Passed'], warning: ['Є застереження', 'Warning'], failed: ['Не пройдено', 'Failed'], manual: ['Затверджено вручну', 'Manually approved'] };
var EXTERNAL = ['skeleton', 'clipping', 'deformation', 'materials', 'lod', 'polycount', 'scale'];
// generation providers: only what is really wired. Meshy (image-to-3D, text-to-3D preview → refine) is next — its key will
// live in Secret Manager, never in the browser.
var PROVIDERS = [{ id: 'manual', uk: 'Ручне завантаження', en: 'Manual import', live: true, ops: ['import'] },
  { id: 'meshy', uk: 'Meshy', en: 'Meshy', live: false, ops: ['imageTo3D', 'textTo3DPreview', 'refine', 'remesh', 'rig', 'animate'] }];

// ---------- WhiteWrite reference rigs (the ArtPipeline library; files in app/assets/rigs/ and the download pack) ----------
// One skeleton per family — Mixamo bone names (mixamorig:*), the X Bot hierarchy, T-pose, Unity Humanoid; a body type is
// proportions on it (bone lengths / widths) + the shape keys Thin / Heavy / Muscular. conform_to_rig.py fits any rigged
// model onto a body and writes <id>.rig.json (schema artpipeline.rig/1) — rigCheck() reads it. «＋ Еталонні профілі» adds
// them to a game with these very ids, so an item made on a reference fits every character of that body.
var REF_RIGS = [
  { id: 'mixamo65', name: 'Mixamo 65 · Humanoid', bones: 65, notes: 'WhiteWrite reference · mixamorig:* · T-pose · Unity Humanoid' },
  { id: 'mixamo65+tail', name: 'Mixamo 65 + хвіст · Humanoid', bones: 71, notes: 'WhiteWrite reference · mixamorig:* + Tail1–6 (outside Humanoid) · T-pose' }];
var REF_BODIES = [['human_male', 'Людина, чоловік', 'Human male', 1.80], ['human_female', 'Людина, жінка', 'Human female', 1.70],
  ['elf', 'Ельф', 'Elf', 1.85], ['orc', 'Орк', 'Orc', 1.95], ['dwarf', 'Гном (дварф)', 'Dwarf', 1.35], ['goblin', 'Гоблін', 'Goblin', 1.40],
  ['ogre', 'Огр', 'Ogre', 2.50], ['ratfolk', 'Щуролюд', 'Ratfolk', 1.45]]
  .map(function (b) { return { id: b[0], uk: b[1], en: b[2], height: b[3], rig: b[0] === 'ratfolk' ? 'mixamo65+tail' : 'mixamo65' }; });
var SHAPES = ['Thin', 'Heavy', 'Muscular']; // the same key names on the body and on every item: SetBlendShapeWeight moves them together
var REF_FILES = '/assets/rigs/'; // <id>.glb (the dummy body, textures inside) and <id>_front.webp per body type
var REF_PACK = '/assets/rigs/whitewrite-reference-rigs.zip'; // conform_to_rig.py + every type's .fbx / .glb / .blend / rig.json
// 🎞 the WhiteWrite animation library (ArtPipeline, schema artpipeline.anims/1, ours — may be given to users): every clip on the same mixamo65 Humanoid
// skeleton, in place (no root motion). The browser reads ANIM_FILES + manifest.json; previews, posters and the human_male GLBs are on the hosting,
// the per-body-type GLBs (Base/Types/<type>/<id>.glb, ~650 MB) in Storage ANIM_STORE (storage.rules: signed-in read), the FBX for Unity in ANIM_PACK.
// Clip ids are stable keys (the library only adds); a chosen clip is a character clip { id, lib, name, en, status, a: animSnap() } — the snapshot
// keeps what Unity needs (state, Animator parameters, transitions, hit window…) so the manifest and MCP never need the library itself.
var ANIM_FILES = '/assets/anims/', ANIM_STORE = 'library/anims/', ANIM_PACK = '/assets/anims/whitewrite-animations.zip';
var ANIM_CATS = { locomotion: ['Пересування', 'Locomotion'], air: ['Стрибок і падіння', 'Jump & fall'], combat_unarmed: ['Бій без зброї', 'Unarmed combat'],
  combat_sword_shield: ['Меч і щит', 'Sword & shield'], combat_one_hand: ['Одноручна зброя', 'One-handed'], combat_two_hand: ['Дворучна зброя', 'Two-handed'],
  combat_dagger: ['Кинджал', 'Dagger'], combat_spear: ['Спис', 'Spear'], combat_bow: ['Лук', 'Bow'], combat_magic: ['Магія', 'Magic'], dodge: ['Ухилення', 'Dodge'],
  reaction: ['Реакції на удар', 'Hit reactions'], death: ['Смерть', 'Death'], interaction: ['Взаємодія', 'Interaction'], social: ['Жести й розмова', 'Gestures & talk'],
  tail: ['Хвіст (щуролюд)', 'Tail (ratfolk)'] };
function animName(id) { var t = String(id || '').replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); }
// a library path → where it lives: the hosting URL, or the Storage path of a per-type GLB
function animFile(rel) { rel = String(rel || ''); return /^Base\/Types\//.test(rel) ? { store: ANIM_STORE + rel } : { url: ANIM_FILES + rel }; }
// the GLB the browser plays on this body type (a reference body; else the human_male base)
function animGlb(clip, bodyId) { var g = (clip && clip.files && clip.files.glb_by_type) || {}; return animFile(g[bodyId] || (clip && clip.files && clip.files.glb)); }
var ANIM_KEEP = ['category', 'state', 'framework', 'transitions', 'loop', 'active', 'duration', 'fps', 'frames', 'speed', 'travel', 'turn_deg', 'weapon', 'mirror_of', 'variant_of', 'note'];
function animSnap(clip) { var o = { fbx: clip.files && clip.files.fbx || '' }; ANIM_KEEP.forEach(function (k) { if (clip[k] !== undefined) o[k] = clip[k]; }); return o; }
function libClip(clip) { return { id: 'lib_' + clip.id, lib: clip.id, name: animName(clip.id), en: animName(clip.id), status: 'done', a: animSnap(clip) }; }
// the clips a body type needs Foot IK for: the retargeted foot sinks more than 1.5 cm into the floor
function footIk(clip, bodyId) { var r = clip && clip.retarget && clip.retarget[bodyId]; return !!r && (r.ok === false || r.feet_min_m < -0.015); }
function refRig(id) { return REF_RIGS.filter(function (r) { return r.id === id; })[0] || null; }
function refBody(id) { return REF_BODIES.filter(function (b) { return b.id === id; })[0] || null; }
// the game's profiles with every reference one added (a profile with the same id is left as the author has it)
function withRefs(profiles, lang) {
  var p = profiles || {}, rigs = (p.rigs || []).slice(), bodies = (p.bodies || []).slice();
  REF_RIGS.forEach(function (r) { if (!rigs.some(function (x) { return x.id === r.id; })) rigs.push({ id: r.id, name: r.name, notes: r.notes, ref: true }); });
  REF_BODIES.forEach(function (b) { if (!bodies.some(function (x) { return x.id === b.id; })) bodies.push({ id: b.id, name: lbl(b, lang) + ' · ' + (lang === 'en' ? b.height + ' m' : String(b.height).replace('.', ',') + ' м'), rig: b.rig, notes: 'WhiteWrite reference', ref: true }); });
  return { rigs: rigs, bodies: bodies };
}
// a bone conform may miss without harm: finger tips (…Hand<Finger>4), *_End, the tail when the model has none
function minorBone(b) { return /_End$/i.test(b) || /Hand(Thumb|Index|Middle|Ring|Pinky)4$/.test(b) || /Tail\d+$/.test(b); }
// conform_to_rig.py's <id>.rig.json → { result: passed | warning | failed, details, report } against the character's profiles
function rigCheck(report, f) {
  f = f || {};
  var r = report && typeof report === 'object' ? report : null, issues = [], lv = 'passed';
  var bump = function (to, uk, en) { issues.push({ uk: uk, en: en }); if (to === 'failed' || lv === 'passed') lv = to; };
  if (!r || r.schema !== 'artpipeline.rig/1') return { result: 'failed', issues: [{ uk: 'Це не rig.json з conform_to_rig.py (schema artpipeline.rig/1).', en: 'Not a conform_to_rig.py rig.json (schema artpipeline.rig/1).' }], report: null };
  var miss = Array.isArray(r.bones_missing) ? r.bones_missing.map(String) : [], hard = miss.filter(function (b) { return !minorBone(b); });
  if (hard.length) bump('failed', 'Не знайдено кісток: ' + hard.join(', ') + '.', 'Bones not found: ' + hard.join(', ') + '.');
  else if (miss.length) bump('warning', 'Бракує лише кінцевих кісток (' + miss.join(', ') + ') — вони без ваг, анімації це не заважає.', 'Only end bones are missing (' + miss.join(', ') + ') — they carry no weights, animation is not affected.');
  if (f.rig && r.skeleton && r.skeleton !== f.rig) bump('failed', 'Скелет «' + r.skeleton + '» не той, що в профілі рига персонажа («' + f.rig + '»).', 'Skeleton "' + r.skeleton + '" differs from the character\'s rig profile ("' + f.rig + '").');
  if (f.body && r.body_type && r.body_type !== f.body) bump('warning', 'Тип тіла «' + r.body_type + '», а в персонажа — «' + f.body + '».', 'Body type "' + r.body_type + '", the character has "' + f.body + '".');
  return { result: lv, issues: issues, report: { skeleton: r.skeleton || '', body_type: r.body_type || '', height_m: +r.height_m || null, bones_found: +r.bones_found || null,
    bones_missing: miss.slice(0, 80), tris: +r.tris || null, shape_keys: (r.shape_keys || []).slice(0, 10).map(String), weights: r.weights || '', source: String(r.source || '').slice(0, 200) } };
}
// ready for animation: the rig stage approved on a reference (Humanoid) skeleton and its skeleton check not failed
function animReady(f) { f = f || {}; return isApproved(f, 'rig') && !!refRig(f.rig) && !!f.rigCheck && f.rigCheck.result !== 'failed'; }

function lbl(o, lang) { return !o ? '' : Array.isArray(o) ? o[lang === 'en' ? 1 : 0] : typeof o === 'string' ? o : (lang === 'en' ? o.en : o.uk) || o.uk || o.en || ''; }
function stage(id) { return STAGES.filter(function (s) { return s.id === id; })[0] || null; }
function type(id) { return TYPES.filter(function (t) { return t.id === id; })[0] || TYPES[0]; }
// a card's kind when the author has not chosen one: enemies by their subsection (bosses), everyone else a hero
function typeOf(c) { return (c && c.forge && c.forge.type) || (c && c.section === 'enemies' ? (/бос|boss/i.test(String((c.fields || {}).group || '')) ? 'boss' : 'enemy') : 'hero'); }
function slotsOf(game) { var s = game && game.forge && game.forge.slots; return s && s.length ? s : SLOTS; }
function blank(v) { return v == null || String(v).trim() === ''; }

// the stages this character goes through, in order
function pipeline(f) { f = f || {}; var off = f.off || []; return type(f.type).stages.filter(function (id) { return off.indexOf(id) < 0; }).map(stage); }
function revsOf(o, stageId) { return ((o && o.revs) || []).filter(function (r) { return r.stage === stageId; }).sort(function (a, b) { return b.n - a.n; }); }
function approvedRev(o, stageId) {
  var a = o && o.stages && o.stages[stageId] && o.stages[stageId].approved;
  return a ? ((o.revs || []).filter(function (r) { return r.id === a.rev; })[0] || (stage(stageId) && stage(stageId).kind !== 'files' ? { id: a.rev } : null)) : null;
}
function isApproved(f, stageId) { return !!(f && f.stages && f.stages[stageId] && f.stages[stageId].approved); }
// a new revision: the next number of its stage
function newRev(o, stageId, files, note, who, from) {
  var n = revsOf(o, stageId).reduce(function (m, r) { return Math.max(m, r.n || 0); }, 0) + 1;
  var r = { id: 'rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), stage: stageId, n: n, files: files || [], note: note || '',
    by: (who && who.uid) || '', byName: (who && who.name) || '', at: Date.now() };
  if (from) r.from = from;
  return r;
}
function clipsOf(f) { return f && f.clips && f.clips.length ? f.clips : type(f && f.type).clips.map(function (k) { return { id: k, name: lbl(CLIPS[k], 'uk'), en: lbl(CLIPS[k], 'en'), status: 'todo' }; }); }

// ---------- equipment: the technical passport and its checks ----------
// items: { id, title, forge, files } (cards); char (optional): the character card it is checked against
function itemIssues(item, char, game) {
  var f = (item && item.forge) || {}, out = [], add = function (level, code, uk, en) { out.push({ level: level, code: code, uk: uk, en: en }); };
  var slot = slotsOf(game).filter(function (s) { return s.id === f.slot; })[0], bind = f.bind || (slot && slot.bind) || 'skinned';
  if (!f.slot) add('error', 'slot', 'Не вибрано слот.', 'No slot chosen.');
  else if (!slot) add('error', 'slot', 'Слота «' + f.slot + '» немає в списку слотів гри.', 'Slot "' + f.slot + '" is not in the game\'s slot list.');
  var model = modelFile(item);
  if (!model) add('warn', 'model', 'Ще немає 3D-моделі (GLB / FBX).', 'No 3D model yet (GLB / FBX).');
  else {
    var ext = (String(model.name || '').match(/\.([a-z0-9]+)$/i) || [])[1] || '';
    ext = ext.toLowerCase();
    if (bind === 'skinned' && ['glb', 'gltf', 'fbx'].indexOf(ext) < 0) add('error', 'format', 'Предмет зі скіном має бути GLB або FBX (зараз .' + ext + ').', 'A skinned item must be GLB or FBX (now .' + ext + ').');
    else if (['glb', 'gltf', 'fbx', 'obj'].indexOf(ext) < 0) add('warn', 'format', 'Формат .' + ext + ' — Unity краще бере GLB або FBX.', 'Format .' + ext + ' — Unity takes GLB or FBX best.');
    if (f.polyTarget && model.tris && model.tris > +f.polyTarget) add('warn', 'poly', 'Полігонів ' + model.tris + ' — більше за ціль ' + f.polyTarget + '.', model.tris + ' triangles — over the target of ' + f.polyTarget + '.');
  }
  if (bind === 'skinned' && !f.rig) add('error', 'rig', 'Предмет зі скіном без профілю рига — не відомо, на який скелет він сяде.', 'A skinned item without a rig profile — unknown which skeleton it fits.');
  if (bind === 'rigid' && !(f.attach || []).some(function (a) { return !blank(a.bone); })) add('error', 'attach', 'Жорсткий предмет без кістки чи точки кріплення.', 'A rigid item without a bone or attachment point.');
  if (char) {
    var cf = char.forge || {};
    if (bind === 'skinned' && f.rig && cf.rig && f.rig !== cf.rig) add('error', 'rigmatch', 'Профіль рига предмета не збігається з персонажем.', 'The item\'s rig profile differs from the character\'s.');
    if (bind === 'skinned' && f.rig && !cf.rig) add('warn', 'rigchar', 'У персонажа ще не визначено профіль рига.', 'The character has no rig profile yet.');
    if (bind === 'skinned' && f.body && cf.body && f.body !== cf.body) add('warn', 'body', 'Інший профіль тіла — можливий кліпінг; перевір у Unity / Blender.', 'A different body profile — clipping is possible; check in Unity / Blender.');
  }
  if (blank(f.units)) add('warn', 'units', 'Не вказано масштаб і одиниці (наприклад, 1 unit = 1 m).', 'Scale and units not set (e.g. 1 unit = 1 m).');
  if (model && (f.maps || []).indexOf('baseColor') < 0) add('tip', 'maps', 'Не позначено карту Base Color.', 'No Base Color map marked.');
  if (bind === 'skinned' && ['chest', 'legs', 'feet', 'hands', 'head'].indexOf(f.slot) >= 0 && !(f.mask || []).length) add('tip', 'mask', 'Чи ховає предмет частину тіла? Познач маску, щоб тіло не проступало крізь нього.', 'Does the item hide part of the body? Mark a mask so the body does not poke through.');
  (f.external || []).forEach(function (x) {
    if (x.result === 'failed') add('error', 'ext:' + x.check, 'Перевірка «' + x.check + '» (' + (x.source || 'Unity') + ') не пройдена: ' + (x.details || ''), 'Check "' + x.check + '" (' + (x.source || 'Unity') + ') failed: ' + (x.details || ''));
    else if (x.result === 'warning') add('warn', 'ext:' + x.check, 'Перевірка «' + x.check + '» (' + (x.source || 'Unity') + '): ' + (x.details || ''), 'Check "' + x.check + '" (' + (x.source || 'Unity') + '): ' + (x.details || ''));
  });
  return out;
}
// the newest model file: the latest "model" revision, else any 3D file on the card
function modelFile(item) {
  var files = (item && item.files) || [], byId = function (id) { return files.filter(function (x) { return x.id === id; })[0]; };
  var ap = approvedRev(item.forge, 'model'), r = ap || revsOf(item.forge, 'model')[0];
  var inRev = r && (r.files || []).map(byId).filter(function (x) { return x && /\.(glb|gltf|fbx|obj|stl)$/i.test(x.name || ''); })[0];
  return inRev || files.filter(function (x) { return /\.(glb|gltf|fbx|obj|stl)$/i.test(x.name || ''); })[0] || null;
}
// Pending — no model yet · Failed — a hard failure · Manually approved — the author accepted the warnings for this model revision · Warning · Passed
function validation(item, char, game) {
  var iss = itemIssues(item, char, game), f = (item && item.forge) || {};
  if (iss.some(function (i) { return i.level === 'error'; })) return { status: 'failed', issues: iss };
  if (!modelFile(item)) return { status: 'pending', issues: iss };
  var warn = iss.some(function (i) { return i.level === 'warn'; }), cur = revsOf(f, 'model')[0];
  if (warn && f.approval && (!cur || f.approval.rev === cur.id)) return { status: 'manual', issues: iss };
  return { status: warn ? 'warning' : 'passed', issues: iss };
}
// items on a character: the ones bound to it (owners)
function itemsOf(char, items) { var id = char && char.id; return (items || []).filter(function (i) { return ((i.forge || {}).owners || []).indexOf(id) >= 0; }); }

// ---------- stages: state and what blocks approval ----------
// ctx: { items, game } — the game's equipment cards (for equip / integrate)
function blockers(char, stageId, ctx) {
  var f = (char && char.forge) || {}, st = stage(stageId), out = [], uk = function (u, e) { out.push({ uk: u, en: e }); };
  if (!st) return [{ uk: 'Невідомий етап.', en: 'Unknown stage.' }];
  var on = pipeline(f).map(function (s) { return s.id; });
  st.deps.filter(function (d) { return on.indexOf(d) >= 0 && !isApproved(f, d); }).forEach(function (d) {
    uk('Спершу затверди етап «' + stage(d).uk + '».', 'Approve «' + stage(d).en + '» first.'); });
  if (st.kind === 'brief') {
    var b = f.brief || {};
    if (blank(b.role)) uk('У брифі не вказано роль.', 'The brief has no role.');
    if (blank(b.silhouette)) uk('У брифі не описано силует.', 'The brief has no silhouette.');
    if (blank(b.race) && blank(b.cls)) uk('У брифі немає ні раси, ні класу.', 'The brief has neither race nor class.');
  }
  if (st.kind === 'files' && !revsOf(f, stageId).length) uk('Ще немає жодної версії — завантаж файли.', 'No version yet — upload files.');
  if (stageId === 'rig' && !f.rig) uk('Не вибрано профіль рига (скелета).', 'No rig (skeleton) profile chosen.');
  if (stageId === 'rig' && refRig(f.rig)) { // a reference skeleton: the fit is proven by conform_to_rig.py's rig.json (or Claude Code's report)
    if (!f.rigCheck) uk('Немає перевірки скелета: завантаж rig.json з conform_to_rig.py разом з FBX / GLB (або Claude Code надішле report_forge_check).', 'No skeleton check: upload the rig.json of conform_to_rig.py with the FBX / GLB (or Claude Code sends report_forge_check).');
    else if (f.rigCheck.result === 'failed') uk('Перевірка скелета не пройдена — підгони модель ще раз.', 'The skeleton check failed — fit the model again.');
  }
  var mine = itemsOf(char, ctx && ctx.items);
  if (st.kind === 'equip') {
    if (!mine.length) uk('До персонажа не привʼязано жодного предмета.', 'No item is bound to the character.');
    mine.filter(function (i) { return !(i.forge || {}).slot; }).forEach(function (i) { uk('«' + i.title + '» без слота.', '"' + i.title + '" has no slot.'); });
  }
  if (st.kind === 'integrate') mine.forEach(function (i) {
    var v = validation(i, char, ctx && ctx.game);
    if (v.status === 'failed') uk('«' + i.title + '»: перевірка не пройдена.', '"' + i.title + '": checks fail.');
    else if (v.status === 'pending') uk('«' + i.title + '»: ще немає моделі.', '"' + i.title + '": no model yet.');
    else if (v.status === 'warning') uk('«' + i.title + '»: застереження не погоджено — затверди предмет вручну або виправ.', '"' + i.title + '": warnings not agreed — approve the item manually or fix it.');
  });
  if (st.kind === 'anim') {
    var left = clipsOf(f).filter(function (c) { return c.status !== 'checked'; });
    if (left.length) uk('Не перевірено кліпів: ' + left.map(function (c) { return c.name; }).join(', ') + '.', 'Clips not checked: ' + left.map(function (c) { return c.en || c.name; }).join(', ') + '.');
  }
  if (st.kind === 'export' && !revsOf(f, 'export').length) uk('Немає експортного пакета — завантаж його (FBX / GLB, текстури, LOD).', 'No export package — upload it (FBX / GLB, textures, LODs).');
  return out;
}
// approved · ready (nothing blocks approval) · progress (work started) · todo · locked (an earlier stage is not approved)
function stageState(char, stageId, ctx) {
  var f = (char && char.forge) || {};
  if (isApproved(f, stageId)) return 'approved';
  var st = stage(stageId), on = pipeline(f).map(function (s) { return s.id; });
  if (st.deps.some(function (d) { return on.indexOf(d) >= 0 && !isApproved(f, d); })) return 'locked';
  if (!blockers(char, stageId, ctx).length) return 'ready';
  var started = revsOf(f, stageId).length || (st.kind === 'brief' && f.brief && Object.keys(f.brief).some(function (k) { return !blank(f.brief[k]); })) ||
    (st.kind === 'anim' && clipsOf(f).some(function (c) { return c.status !== 'todo'; })) || ((st.kind === 'equip' || st.kind === 'integrate') && itemsOf(char, ctx && ctx.items).length);
  return started ? 'progress' : 'todo';
}
function progress(char) {
  var p = pipeline((char && char.forge) || {}), done = p.filter(function (s) { return isApproved(char.forge, s.id); }).length;
  var next = p.filter(function (s) { return !isApproved(char.forge, s.id); })[0];
  return { done: done, all: p.length, pct: p.length ? Math.round(done / p.length * 100) : 0, next: next ? next.id : null };
}

// ---------- the export manifest (download in the Bible, MCP get_character_forge) ----------
function manifest(char, items, game, lang) {
  var L = lang || 'en', f = (char && char.forge) || {}, files = (char && char.files) || [];
  var fileOut = function (list, id) { var x = list.filter(function (y) { return y.id === id; })[0]; return x ? { name: x.name, url: x.url, size: x.size, type: x.type || '', tris: x.tris || undefined } : null; };
  var profiles = withRefs((game && game.forge) || {}, L), rig = (profiles.rigs || []).filter(function (r) { return r.id === f.rig; })[0], body = (profiles.bodies || []).filter(function (b) { return b.id === f.body; })[0];
  var slots = slotsOf(game);
  return {
    schema: 'whitewrite.character/1', id: char.id, name: char.title || '', type: f.type || 'hero',
    rig_profile: rig ? { id: rig.id, name: rig.name, notes: rig.notes || '', reference: !!refRig(rig.id), humanoid: !!refRig(rig.id) } : null,
    body_profile: body ? { id: body.id, name: body.name, notes: body.notes || '', reference: !!refBody(body.id), height_m: refBody(body.id) ? refBody(body.id).height : undefined } : null,
    body_shape: SHAPES.reduce(function (o, k) { o[k] = Math.max(0, Math.min(100, +((f.shape || {})[k]) || 0)); return o; }, {}),
    skeleton_check: f.rigCheck ? { result: f.rigCheck.result, source: f.rigCheck.source || '', at: f.rigCheck.at || null, report: f.rigCheck.report || null,
      issues: (f.rigCheck.issues || []).map(function (i) { return L === 'uk' ? i.uk : i.en; }) } : null,
    animation_ready: animReady(f),
    brief: f.brief || {},
    stages: pipeline(f).map(function (s) {
      var a = f.stages && f.stages[s.id] && f.stages[s.id].approved, r = approvedRev(f, s.id);
      return { id: s.id, name: lbl(s, L), state: isApproved(f, s.id) ? 'approved' : revsOf(f, s.id).length ? 'in_progress' : 'todo',
        approved: a ? { version: r && r.n || null, by: a.byName || '', at: a.at || null, comment: a.comment || '' } : null,
        files: r && r.files ? r.files.map(function (id) { return fileOut(files, id); }).filter(Boolean) : [] };
    }),
    clips: clipsOf(f).map(function (c) { var o = { name: L === 'en' ? c.en || c.name : c.name, status: c.status }; if (c.lib) o.library = Object.assign({ id: c.lib }, c.a || {}); return o; }),
    animation_library: clipsOf(f).some(function (c) { return c.lib; }) ? { pack: ANIM_PACK, skeleton: 'mixamo65 · Unity Humanoid', root_motion: false,
      note: 'One shared FBX per clip in the pack (Base/<library id>.fbx) fits every reference body type through Humanoid; clips are in place, no weapons in them (the grip is the RightHand bone, LeftHand for the bow and the shield). Turn on Foot IK for dwarf, ogre and ratfolk.' } : null,
    equipment: itemsOf(char, items).map(function (i) {
      var x = i.forge || {}, v = validation(i, char, game), slot = slots.filter(function (s) { return s.id === x.slot; })[0], m = modelFile(i);
      return { ref: 'c:' + i.id, name: i.title || '', slot: x.slot || '', slot_name: slot ? lbl(slot, L) : '', binding: x.bind || (slot && slot.bind) || 'skinned',
        rig_profile: x.rig || '', body_profile: x.body || '', body_mask: x.mask || [], attachment_points: (x.attach || []).filter(function (a) { return !blank(a.bone); }),
        format: x.format || '', units: x.units || '', maps: x.maps || [], lod: x.lod || '', poly_target: x.polyTarget || null,
        model: m ? { name: m.name, url: m.url, tris: m.tris || undefined } : null, validation: v.status,
        issues: v.issues.map(function (s) { return { level: s.level, message: L === 'uk' ? s.uk : s.en }; }) };
    }),
    loadouts: (f.loadouts || []).map(function (l) { return { name: l.name, items: Object.keys(l.items || {}).map(function (k) { return { slot: k, ref: 'c:' + l.items[k] }; }) }; }),
  };
}

var FORGE = { STAGES: STAGES, TYPES: TYPES, CLIPS: CLIPS, SLOTS: SLOTS, MASK: MASK, MAPS: MAPS, VALIDATION: VALIDATION, EXTERNAL: EXTERNAL, PROVIDERS: PROVIDERS,
  REF_RIGS: REF_RIGS, REF_BODIES: REF_BODIES, SHAPES: SHAPES, REF_FILES: REF_FILES, REF_PACK: REF_PACK, ANIM_FILES: ANIM_FILES, ANIM_STORE: ANIM_STORE, ANIM_PACK: ANIM_PACK, ANIM_CATS: ANIM_CATS, animName: animName, animFile: animFile, animGlb: animGlb, animSnap: animSnap, libClip: libClip, footIk: footIk,
  refRig: refRig, refBody: refBody, withRefs: withRefs, rigCheck: rigCheck, animReady: animReady,
  lbl: lbl, stage: stage, type: type, typeOf: typeOf, slotsOf: slotsOf, pipeline: pipeline, revsOf: revsOf, approvedRev: approvedRev, isApproved: isApproved, newRev: newRev,
  clipsOf: clipsOf, itemIssues: itemIssues, modelFile: modelFile, validation: validation, itemsOf: itemsOf, blockers: blockers, stageState: stageState,
  progress: progress, manifest: manifest };
if (typeof module !== 'undefined' && module.exports) module.exports = FORGE;
if (typeof window !== 'undefined') window.__FORGE = FORGE;
})();
