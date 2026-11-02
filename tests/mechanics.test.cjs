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
check(x.sections.find((s) => s.id === 'warping').framework.status, 'missing', 'the framework note for motion warping');
check(x.category, 'Combat', 'the category in the asked language');

// old Mechanics groups map to the new categories
check(M.GROUP_ALIAS['Здібності'], 'Навички й здібності', 'the old «Здібності» group');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
