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
check(umcf.sections.length, 15, 'UMCF has the 15 parts of the spec');

// the instance is a copy: editing it never touches the template
const a = M.instantiate('umcf');
a.sections[1].rows[0].name = 'Changed';
check(umcf.sections[1].rows[0].name, 'Короткий кинджал', 'the template stays untouched');

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
check(/140 BPM/.test(pr) && /seamless loop of 16 bars/.test(pr) && /Ударні/.test(pr), true, 'the combat prompt has tempo, loop and its layers');
check(M.rowPrompt(mu, 'transitions', st(mu, 'transitions').rows[0], 'en'), '', 'no prompt for a transition row');
const xa = M.exportMech({ id: 'a1', title: 'Music', mech: mu }, 'en');
check(xa.category + '|' + !!st(xa, 'states').rows[0].generator_prompt, 'Music|true', 'the MCP export carries the state prompts');
check(st(M.instantiate('music_prompts'), 'presets').rows.length >= 20, true, '20+ ready music prompts');
const ui = M.instantiate('ui_sounds'); st(ui, 'events').rows[0].ms = 900;
check(codes(ui, 'warn').some((i) => i.row === 'U1'), true, 'a long sound on a frequent UI event');

// old Mechanics groups map to the new categories
check(M.GROUP_ALIAS['Здібності'], 'Навички й здібності', 'the old «Здібності» group');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
