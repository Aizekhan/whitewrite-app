// The mechanics constructor (functions/mechanics.js): templates instantiate into Firestore-safe copies, checks catch broken designs,
// the MCP export resolves links. Run: npm test
const M = require('../functions/mechanics.js');
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };
const nested = (x, inArr) => Array.isArray(x) ? (inArr ? 1 : 0) + x.reduce((n, y) => n + nested(y, true), 0)
  : x && typeof x === 'object' ? Object.values(x).reduce((n, y) => n + nested(y, false), 0) : 0;
const codes = (m, level) => M.check(m).issues.filter((i) => !level || i.level === level);

// every template: a valid structure, unique ids, refs pointing at real sections, no arrays in arrays (Firestore refuses them)
M.TEMPLATES.forEach((t) => {
  const m = M.instantiate(t.id), ids = m.sections.map((s) => s.id);
  check(nested(m, false), 0, t.id + ': no nested arrays');
  check(new Set(ids).size, ids.length, t.id + ': section ids unique');
  const badRef = m.sections.some((s) => s.fields.some((f) => (f.t === 'ref' || f.t === 'refs') && ids.indexOf(f.ref) < 0));
  check(badRef, false, t.id + ': every link field points at a table');
  check(!!M.category(t.cat), true, t.id + ': its category exists');
  check(codes(m, 'error').length, 0, t.id + ': the template itself has no errors');
});
const umcf = M.TEMPLATES.find((t) => t.id === 'umcf');
check(umcf.sections.filter((s) => !s.since).length, 15, 'UMCF has the 15 parts of the spec (+ the combo table and the monster’s eyes)');

// the instance is a copy: editing it never touches the template
const a = M.instantiate('umcf');
a.sections[3].rows[0].name = 'Changed';
check(umcf.sections[3].rows[0].name, 'Короткий кинджал', 'the template stays untouched');

// a combination with an attack the weapon does not have → error
const combos = (m) => m.sections.find((s) => s.id === 'combos');
const b = M.instantiate('umcf'); combos(b).rows[0].attack = 'A3';
check(codes(b, 'error').some((i) => i.sec === 'combos' && i.row === 'C1'), true, 'weapon ↔ attack mismatch in a combination');
// a deleted attack leaves a dangling link → error
const c = M.instantiate('umcf'); c.sections.find((s) => s.id === 'attacks').rows = c.sections.find((s) => s.id === 'attacks').rows.filter((r) => r._id !== 'A1');
check(codes(c, 'error').some((i) => /A1/.test(i.uk)), true, 'a link to a removed row is an error');
// geometry outside the Active window → warning; reversed times → error
const d = M.instantiate('umcf'), g = d.sections.find((s) => s.id === 'geometry').rows[0];
g.t0 = 0.05; g.t1 = 0.02;
check(codes(d, 'error').some((i) => i.sec === 'geometry' && i.row === 'G1'), true, 'a segment ending before it starts');
check(codes(d, 'warn').some((i) => i.sec === 'geometry' && i.row === 'G1'), true, 'a segment outside the Active phase');
// a combination that cannot reach
const e = M.instantiate('umcf'); combos(e).rows[0].dist = '5–6';
check(codes(e, 'warn').some((i) => i.row === 'C1' && /не дістане/.test(i.uk)), true, 'a combination starting beyond the full attack distance');
// a bad range / number
const f = M.instantiate('umcf'); combos(f).rows[1].dist = 'far'; f.sections.find((s) => s.id === 'weapons').rows[0].reach = 'x';
check(codes(f, 'error').filter((i) => /діапазон|не число/.test(i.uk)).length, 2, 'a malformed range and a non-number');
// dodge: i-frames past the end
const dg = M.instantiate('dodge'); dg.sections[0].values.iLen = 1;
check(codes(dg, 'error').length, 1, 'dodge i-frames longer than the dodge');
// completeness: an empty own mechanic is 0 %, a purpose alone is 100 %
const own = M.instantiate('');
check(M.check(own).pct, 0, 'an empty own mechanic');
own.purpose = 'Run'; check(M.check(own).pct, 100, 'an own mechanic without sections, with a purpose');
const h = M.instantiate('umcf'), before = M.check(h).pct; h.sections.find((s) => s.id === 'attacks').rows.forEach((r) => { r.startup = ''; });
check(M.check(h).pct < before, true, 'emptying required cells lowers completeness');

// new row ids continue the numbering
const ws = M.instantiate('umcf').sections.find((s) => s.id === 'weapons');
check(M.newRowId(ws), 'W6', 'the next weapon id');

// the agent's view: refs resolved, framework notes attached
const x = M.exportMech({ id: 'm1', title: 'Melee', mech: M.instantiate('umcf') }, 'en');
const cx = x.sections.find((s) => s.id === 'combos').rows[0];
check(cx.weapon.name + '|' + cx.attack.name, 'Короткий кинджал|Quick Thrust', 'links come as { id, name }');
check(x.sections.find((s) => s.id === 'warping').framework.status, 'exists', 'the framework note for motion warping (0.38.0)');
check(x.sections.find((s) => s.id === 'adaptation').framework.status, 'missing', 'AI adaptation is still missing');
check(x.category, 'Combat', 'the category in the asked language');

// Фабрика звуку: audio templates live apart from the mechanics, their categories are the audio section's groups
check(M.templatesFor('audio').map((t) => t.id).join(','), 'adaptive_music,ambience,ui_sounds,music_prompts', 'the Sound factory catalog');
check(M.templatesFor('mechanics').some((t) => t.sec === 'audio'), false, 'no audio template among the mechanics');
check(M.categoriesFor('audio').map((c) => c.uk).join('|'), 'Музика|Звукові ефекти|Озвучка|Амбієнт|Звуки UI', 'audio categories = the section groups');
const mu = M.instantiate('adaptive_music'), st = (m, id) => m.sections.find((s) => s.id === id);
check(codes(mu).filter((i) => i.level !== 'tip').length, 0, 'the adaptive music sample has no warnings');
const mc = M.instantiate('adaptive_music'); st(mc, 'states').rows.find((r) => r._id === 'S3').bpm = 80;
check(codes(mc, 'warn').some((i) => /Бій не швидший/.test(i.uk)), true, 'combat slower than exploration');
const mt = M.instantiate('adaptive_music'), t2 = st(mt, 'transitions').rows.find((r) => r._id === 'T2'); t2.timing = 'now'; t2.fade = 0; t2.stinger = '';
check(codes(mt, 'warn').some((i) => i.row === 'T2' && /обрив/.test(i.uk)), true, 'a hard cut without crossfade or stinger');
const mx = M.instantiate('adaptive_music'); st(mx, 'transitions').rows = st(mx, 'transitions').rows.filter((r) => r.to !== 'S4');
check(codes(mx, 'warn').some((i) => i.row === 'S4' && /ніколи не зазвучить/.test(i.uk)), true, 'an unreachable music state');
const self = M.instantiate('adaptive_music'); st(self, 'transitions').rows[0].to = 'S1';
check(codes(self, 'error').some((i) => i.row === 'T1'), true, 'a transition into the same state');
const pr = M.rowPrompt(mu, 'states', st(mu, 'states').rows.find((r) => r._id === 'S3'), 'en');
check(/140 BPM/.test(pr) && /seamless 60-second loop, 16 bars/.test(pr) && /Stems: base \/ rhythm \/ climax/.test(pr), true, 'the combat prompt has tempo, loop and its layers');
check(/taiko/.test(pr) && /\nExclude: .*solo flute/.test(pr), true, 'the default direction (hybrid orchestral) gives a modern combat prompt with an Exclude line');
check(/[а-яіїє]/i.test(pr), false, 'the generator prompt is in English');
// an instance from v1 (no direction, the flute sample): the field is added, the sample instruments are replaced by the direction
const v1 = M.instantiate('adaptive_music'), pal1 = st(v1, 'palette');
v1.tplVersion = 1; pal1.fields = pal1.fields.filter((f) => f.k !== 'direction'); delete pal1.values.direction; pal1.values.style = 'Епічний оркестр із фольк-інструментами';
const ex1 = st(v1, 'states').rows[0]; ex1.instruments = 'флейта, гобой, арфа (пульсуюче арпеджіо), мʼякий бас';
M.upgrade(v1);
check(pal1.fields[0].k + '|' + pal1.values.direction + '|' + v1.tplVersion, 'direction|hybrid|' + M.template('adaptive_music').version, 'an old instance gets the direction field (hybrid)');
check(/flute|флейта/.test(M.rowPrompt(v1, 'states', ex1).split('\nExclude')[0]), false, 'the old flute sample is not in the prompt');
ex1.instruments = 'дудук'; check(/featuring дудук/.test(M.rowPrompt(v1, 'states', ex1)), true, "the author's own instruments stay");
pal1.values.direction = 'cyber'; check(/darksynth/.test(M.rowPrompt(v1, 'states', ex1)), true, 'another direction changes every state prompt');
pal1.values.direction = 'own'; pal1.values.style = 'balkan brass trap'; check(/^balkan brass trap/.test(M.rowPrompt(v1, 'states', ex1)), true, "«own» direction takes the author's style");
// an untouched v1 preset gives its modern replacement; an edited one stays
const lib = M.instantiate('music_prompts'), p7 = st(lib, 'presets').rows.find((r) => r._id === 'P7');
p7.prompt = 'мирна мелодія для подорожі, спокійний настрій, 60 секунд, 90 BPM, флейта, гобой, мʼякий бас, пульсуючий малюнок арфи, плавний перехід при вході в нову зону, seamless loop';
check(/cinematic ambient/.test(M.rowPrompt(lib, 'presets', p7)), true, 'an untouched v1 preset gives its modern replacement');
p7.prompt = 'моя власна версія'; check(M.rowPrompt(lib, 'presets', p7), 'моя власна версія', "an edited preset stays the author's");
check(M.rowPrompt(mu, 'transitions', st(mu, 'transitions').rows[0], 'en'), '', 'no prompt for a transition row');
const xa = M.exportMech({ id: 'a1', title: 'Music', mech: mu }, 'en');
check(xa.category + '|' + !!st(xa, 'states').rows[0].generator_prompt, 'Music|true', 'the MCP export carries the state prompts');
check(st(M.instantiate('music_prompts'), 'presets').rows.length >= 20, true, '20+ ready music prompts');
const ui = M.instantiate('ui_sounds'); st(ui, 'events').rows[0].ms = 900;
check(codes(ui, 'warn').some((i) => i.row === 'U1'), true, 'a long sound on a frequent UI event');

// old Mechanics groups map to the new categories
check(M.GROUP_ALIAS['Здібності'], 'Навички й здібності', 'the old «Здібності» group');

// the Audio library: older instances get the sound slots, slots point at sound cards, missing / used / unused
const v2 = M.instantiate('adaptive_music'); v2.tplVersion = 2; v2.sections.forEach((s) => { s.fields = (s.fields || []).filter((f) => f.t !== 'sound'); });
M.upgrade(v2);
check(['states', 'layers', 'transitions'].map((id) => st(v2, id).fields.filter((f) => f.t === 'sound').map((f) => f.k).join()).join('|'), 'sound|sound|stingerSound', 'a v2 music card gets the track, layer and stinger slots');
check(M.check(v2).pct, M.check(M.instantiate('adaptive_music')).pct, 'empty sound slots do not lower the completeness');
st(v2, 'states').rows[0].sound = ['snd1'];
const alib = M.audioLibrary([{ id: 'm', section: 'audio', title: 'Music', mech: v2 },
  { id: 'snd1', section: 'audio', title: 'Explore', files: [{ name: 'a.ogg', url: 'u1' }, { name: 'b.ogg', type: 'audio/ogg', url: 'u2' }, { name: 'cover.png', type: 'image/png', url: 'u3' }] },
  { id: 'snd2', section: 'audio', title: 'Spare', files: [{ name: 'c.wav', url: 'u4' }] }, { id: 'n', section: 'audio', title: 'No file', files: [] }], 'en');
check(alib.assets.map((a) => a.id + ':' + a.files.length).join(), 'snd1:2,snd2:1', 'library = audio cards with audio files (pictures left out)');
check(alib.used.snd1 && alib.used.snd1[0].rowName, st(v2, 'states').rows[0].name, 'a used sound knows its state');
check(alib.unused.join(), 'snd2', 'the unused sound');
check(alib.missing.some((w) => w.row === st(v2, 'states').rows[0]._id), false, 'a filled slot is not missing');
check(alib.missing.filter((w) => w.sec === 'transitions').length, st(v2, 'transitions').rows.filter((r) => r.stinger).length, 'a stinger file is missing only where a stinger is described');
check(JSON.stringify(M.exportMech({ id: 'm', mech: v2 }, 'en', alib.assets).sections.find((s) => s.id === 'states').rows[0].sound[0].files.map((f) => f.url)), '["u1","u2"]', 'the agent gets the files of a slot');

// basic / advanced view: older audio cards take the template's split, the author's own fields keep theirs
const v3 = M.instantiate('adaptive_music'); v3.tplVersion = 3;
v3.sections.forEach((s) => { delete s.adv; s.fields.forEach((f) => { delete f.adv; }); });
st(v3, 'states').fields.push({ k: 'mine', l: 'Моє', t: 'text', custom: true, adv: true });
M.upgrade(v3);
check(v3.sections.filter((s) => s.adv).map((s) => s.id).join(), 'motifs,mix', 'leitmotifs and the mix are advanced tabs after the upgrade');
check(st(v3, 'states').fields.filter((f) => f.adv).map((f) => f.k).join(), 'style,bars,where,notes,mine', 'states: the template’s advanced fields + the author’s own keeps its flag');
check(['name', 'situation', 'bpm', 'sound'].every((k) => !st(v3, 'states').fields.find((f) => f.k === k).adv), true, 'the main state fields stay in the basic view');
check(v3.tplVersion, M.template('adaptive_music').version, 'the upgrade stamps the template version');

// ⚔ combo table: start = k × the weapon reach, the movement adds its run-up, the checks catch strikes from the edge and answers without strikes
const cb = M.instantiate('umcf'), cbt = st(cb, 'ctable');
check(JSON.stringify(M.comboStart(cb, cbt.rows[0])), JSON.stringify({ k: 0.75, reach: 0.9, start: 0.68, from: 2.18, phases: [0.18, 0.08, 0.3], status: 'ok' }), 'a goblin dagger dash-thrust starts at 0.75 × 0.9 m, the dash from ~2.2 m');
check(M.comboStart(cb, Object.assign({}, cbt.rows[0], { k: 0.95 })).status, 'edge', 'k 0.95 — a strike from the edge of reach');
check(M.comboStart(cb, Object.assign({}, cbt.rows[0], { weapon: '' })).status, 'noreach', 'no weapon — no distance');
check(codes(cb, 'warn').filter((i) => i.sec === 'ctable' || i.sec === 'reactions').length, 0, 'the sample combo table and answers are clean');
st(cb, 'reactions').rows.push({ _id: 'RE9', who: 'Гоблін', action: 'ranged', answer: 'ultimate', weight: 1 });
check(codes(cb, 'warn').some((i) => i.row === 'RE9'), true, 'an answer with a strike type the fighter has no combos of');
check(M.exportMech({ id: 'u', mech: cb }, 'en').sections.find((s) => s.id === 'ctable').rows[0].start.start, 0.68, 'the agent gets the computed start');
const u1 = M.instantiate('umcf'); u1.tplVersion = 1; u1.sections = u1.sections.filter((s) => !['ctable', 'reactions'].includes(s.id)); u1.sections.forEach((s) => { delete s.adv; });
M.upgrade(u1);
check(u1.sections.slice(0, 4).map((s) => s.id).join(), 'overview,ctable,reactions,weapons', 'an older combat card gets the combo table and the monster’s eyes after the overview');
check(u1.sections.filter((s) => s.adv).length, 13, 'the detailed UMCF tabs move to the advanced view');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
