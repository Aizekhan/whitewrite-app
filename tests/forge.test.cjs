// ⚒ Кузня персонажів (functions/forge.js): pipelines per type, stage gating, immutable revisions, equipment checks, the manifest. Run: npm test
const F = require('../functions/forge.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const nested = (x, inArr) => Array.isArray(x) ? (inArr ? 1 : 0) + x.reduce((n, y) => n + nested(y, true), 0)
  : x && typeof x === 'object' ? Object.values(x).reduce((n, y) => n + nested(y, false), 0) : 0;
const who = { uid: 'u1', name: 'Автор' };
const approve = (f, id, rev) => { f.stages = f.stages || {}; f.stages[id] = { approved: { rev: rev || 'x', byName: 'Автор', at: 1 } }; };

// pipelines: every stage id exists, deps point at real stages, a hero has all eight, an NPC no equipment
F.TYPES.forEach((t) => check(t.stages.every((id) => !!F.stage(id)), true, t.id + ': its stages exist'));
check(F.STAGES.every((s) => s.deps.every((d) => !!F.stage(d))), true, 'every dependency is a stage');
check(F.pipeline({ type: 'hero' }).length, 8, 'a hero goes through 8 stages');
check(F.pipeline({ type: 'npc' }).some((s) => s.id === 'equip'), false, 'an NPC has no equipment stage');
check(F.pipeline({ type: 'hero', off: ['anim'] }).some((s) => s.id === 'anim'), false, 'a stage can be switched off for one character');

// the brief: role, silhouette and race or class are needed
const c = { id: 'c1', title: 'Елара', forge: { type: 'hero', brief: { role: 'Лучниця' } } };
check(F.blockers(c, 'brief', {}).length, 2, 'an incomplete brief names what is missing');
c.forge.brief.silhouette = 'Висока, легка'; c.forge.brief.race = 'Ельфійка';
check(F.stageState(c, 'brief', {}), 'ready', 'a full brief can be approved');
check(F.stageState(c, 'concept', {}), 'locked', 'concept waits for the approved brief');
approve(c.forge, 'brief');
check(F.stageState(c, 'concept', {}), 'todo', 'after the brief, concept opens');

// revisions are added, numbered per stage, never replaced; approval stays on its revision
c.files = [{ id: 'f1', name: 'front.png', url: 'u1' }, { id: 'f2', name: 'front-v2.png', url: 'u2' }];
const r1 = F.newRev(c.forge, 'concept', ['f1'], 'перший', who); c.forge.revs = [r1];
const r2 = F.newRev(c.forge, 'concept', ['f2'], 'другий', who); c.forge.revs.push(r2);
check(r2.n, 2, 'the second concept revision is v2');
approve(c.forge, 'concept', r1.id);
const r3 = F.newRev(c.forge, 'concept', r1.files, '', who, r1.id); c.forge.revs.push(r3);
check(F.approvedRev(c.forge, 'concept').id, r1.id, 'a new revision does not move the approval');
check(r3.from, r1.id, '«Повернути версію» records where it came from');
check(nested(c.forge, false), 0, 'forge data has no arrays in arrays (Firestore)');

// rig: needs a profile
approve(c.forge, 'mesh'); c.forge.revs.push(F.newRev(c.forge, 'rig', ['f1'], '', who));
check(F.blockers(c, 'rig', {}).some((b) => /рига/.test(b.uk)), true, 'rig approval needs a rig profile');
c.forge.rig = 'humanoid_a'; c.forge.body = 'female_elf_a';
check(F.stageState(c, 'rig', {}), 'ready', 'rig with a profile and a version is ready');
approve(c.forge, 'rig');

// equipment checks
const boots = { id: 'i1', title: 'Чоботи', files: [{ id: 'm1', name: 'boots.fbx', url: 'm', tris: 9000 }],
  forge: { slot: 'feet', rig: 'humanoid_a', body: 'female_elf_a', units: '1 unit = 1 m', maps: ['baseColor'], mask: ['feet'], owners: ['c1'], polyTarget: 12000 } };
check(F.validation(boots, c, {}).status, 'passed', 'matching boots pass');
const sword = { id: 'i2', title: 'Меч', files: [{ id: 'm2', name: 'sword.glb', url: 's' }], forge: { slot: 'mainhand', units: 'm', maps: ['baseColor'], owners: ['c1'] } };
check(F.validation(sword, c, {}).status, 'failed', 'a rigid weapon without an attachment point fails');
sword.forge.attach = [{ bone: 'hand_r', point: 'grip' }];
check(F.validation(sword, c, {}).status, 'passed', 'with a bone it passes');
const cloak = { id: 'i3', title: 'Плащ', files: [{ id: 'm3', name: 'cloak.fbx', url: 'c' }], forge: { slot: 'back', rig: 'quadruped', units: 'm', maps: ['baseColor'], owners: ['c1'] } };
check(F.itemIssues(cloak, c, {}).some((i) => i.code === 'rigmatch' && i.level === 'error'), true, 'another skeleton is a hard failure');
const obj = { id: 'i4', title: 'Шолом', files: [{ id: 'm4', name: 'helm.obj', url: 'h' }], forge: { slot: 'head', rig: 'humanoid_a', units: 'm', owners: [] } };
check(F.itemIssues(obj, c, {}).some((i) => i.code === 'format' && i.level === 'error'), true, 'a skinned OBJ is refused (no weights)');
const nomodel = { id: 'i5', title: 'Пояс', files: [], forge: { slot: 'waist', rig: 'humanoid_a', units: 'm', owners: ['c1'] } };
check(F.validation(nomodel, c, {}).status, 'pending', 'no model yet → pending');
const otherBody = { id: 'i6', title: 'Нагрудник', files: [{ id: 'm6', name: 'chest.glb', url: 'x' }], forge: { slot: 'chest', rig: 'humanoid_a', body: 'male_orc_b', units: 'm', maps: ['baseColor'], mask: ['torso'], owners: ['c1'] } };
check(F.validation(otherBody, c, {}).status, 'warning', 'another body profile is a warning');
otherBody.forge.revs = [F.newRev(otherBody.forge, 'model', ['m6'], '', who)];
otherBody.forge.approval = { rev: otherBody.forge.revs[0].id, byName: 'Автор', at: 1, comment: 'перевірено в Unity' };
check(F.validation(otherBody, c, {}).status, 'manual', 'the author approves the warnings for this model');
otherBody.forge.revs.push(F.newRev(otherBody.forge, 'model', ['m6'], '', who));
check(F.validation(otherBody, c, {}).status, 'warning', 'a new model revision needs a new approval');
boots.forge.external = [{ check: 'clipping', result: 'failed', details: 'стопа проступає', source: 'Unity' }];
check(F.validation(boots, c, {}).status, 'failed', 'a failed Unity clipping report fails the item');
check(F.validation({ id: 'g', files: [], forge: { slot: 'feet' } }, null, { forge: { slots: [{ id: 'head', bind: 'skinned' }] } }).issues.some((i) => i.code === 'slot'), true, 'a slot outside the game list is an error');

// equipment and integration stages
const items = [boots, sword, nomodel];
check(F.stageState(c, 'equip', { items }), 'ready', 'items with slots → equipment ready');
approve(c.forge, 'equip');
check(F.blockers(c, 'integrate', { items }).length, 2, 'integration is blocked by the failing boots and the belt without a model');

// animation clips by type
check(F.clipsOf({ type: 'npc' }).length, 3, 'an NPC needs idle, walk, talk');
const hero = { forge: { type: 'hero', stages: { brief: { approved: {} }, concept: { approved: {} }, mesh: { approved: {} }, rig: { approved: {} } } } };
check(F.stageState(hero, 'anim', {}), 'todo', 'animation opens after the rig');
hero.forge.clips = F.clipsOf(hero.forge).map((x) => Object.assign({}, x, { status: 'checked' }));
check(F.stageState(hero, 'anim', {}), 'ready', 'all clips checked → animation ready');

// progress and manifest
check(F.progress(c).done, 5, 'five stages approved');
check(F.progress(c).next, 'integrate', 'the next stage is integration');
const m = F.manifest(c, items, { forge: { rigs: [{ id: 'humanoid_a', name: 'Humanoid A' }] } }, 'en');
check(m.schema, 'whitewrite.character/1', 'manifest schema');
check(m.rig_profile.name, 'Humanoid A', 'manifest names the rig profile');
check(m.stages.find((s) => s.id === 'concept').files[0].url, 'u1', 'manifest gives the approved concept, not the newest');
check(m.equipment.length, 3, 'manifest lists the bound items');
check(m.equipment.find((e) => e.ref === 'c:i2').attachment_points[0].bone, 'hand_r', 'manifest carries attachment points');
check(F.PROVIDERS.filter((p) => p.live).map((p) => p.id).join(), 'manual', 'only manual import is live (Meshy is next)');

// 🦴 WhiteWrite reference rigs: always offered, a body type names its skeleton, conform_to_rig.py's rig.json decides the skeleton check
const refs = F.withRefs({ rigs: [{ id: 'rig_own', name: 'Свій' }], bodies: [] }, 'uk');
check(refs.rigs.length, 3, 'the game keeps its own rig and gets both reference skeletons');
check(refs.bodies.length, 8, 'eight reference body types');
check(F.refBody('ratfolk').rig, 'mixamo65+tail', 'ratfolk is on the tail skeleton');
check(F.withRefs({ bodies: [{ id: 'elf', name: 'Мій ельф' }] }, 'uk').bodies.find((b) => b.id === 'elf').name, 'Мій ельф', 'a game profile with a reference id is left as the author has it');
const fr = { rig: 'mixamo65', body: 'human_male' }, rj = (o) => Object.assign({ schema: 'artpipeline.rig/1', skeleton: 'mixamo65', body_type: 'human_male', bones_found: 65, bones_missing: [] }, o);
check(F.rigCheck(rj({}), fr).result, 'passed', 'every bone found — passed');
check(F.rigCheck(rj({ bones_found: 63, bones_missing: ['mixamorig:LeftHandMiddle4', 'mixamorig:RightHandRing4'] }), fr).result, 'warning', 'only finger tips missing — warning (archmage)');
check(F.rigCheck(rj({ bones_missing: ['mixamorig:LeftForeArm'] }), fr).result, 'failed', 'a missing arm bone — failed');
check(F.rigCheck(rj({ skeleton: 'mixamo65+tail' }), fr).result, 'failed', 'another skeleton than the rig profile — failed');
check(F.rigCheck(rj({ body_type: 'elf' }), fr).result, 'warning', 'another body type — warning');
check(F.rigCheck(rj({ bones_found: null, weights: 'body' }), fr).result, 'passed', 'gear without its own skeleton (weights from the body) — passed');
check(F.rigCheck({ id: 'x' }, fr).result, 'failed', 'not a rig.json — failed');
const rc = { id: 'r1', title: 'Маг', forge: { type: 'npc', rig: 'mixamo65', body: 'human_male', brief: { role: 'r', silhouette: 's', race: 'h' } } };
['brief', 'concept', 'mesh'].forEach((id) => approve(rc.forge, id));
rc.forge.revs = [F.newRev(rc.forge, 'rig', ['f9'], '', who)];
check(F.blockers(rc, 'rig', {}).some((b) => /rig\.json/.test(b.uk)), true, 'a reference rig waits for the skeleton check');
rc.forge.rigCheck = { result: 'failed' };
check(F.stageState(rc, 'rig', {}) === 'ready', false, 'a failed skeleton check blocks the rig stage');
rc.forge.rigCheck = F.rigCheck(rj({}), rc.forge);
check(F.stageState(rc, 'rig', {}), 'ready', 'a passed check lets the rig stage be approved');
check(F.animReady(rc.forge), false, 'not ready for animation before the rig is approved');
approve(rc.forge, 'rig');
check(F.animReady(rc.forge), true, 'approved on a checked reference skeleton — ready for animation');
rc.forge.shape = { Thin: 20, Heavy: 140 };
const rm = F.manifest(rc, [], { forge: {} }, 'en');
check(rm.rig_profile && rm.rig_profile.humanoid, true, 'manifest: the reference rig is Humanoid even if the game never saved it');
check(rm.body_profile.height_m, 1.8, 'manifest: the body type height');
check(rm.body_shape.Heavy + '/' + rm.body_shape.Muscular, '100/0', 'manifest: the build is clamped 0–100');
check(rm.animation_ready && rm.skeleton_check.result, 'passed', 'manifest: the skeleton check and animation_ready');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
