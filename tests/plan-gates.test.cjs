// Production-plan gates (functions/src/mcp.js lockedBy): a milestone opens only after the previous gate of its track.
// Run: npm test
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../functions/src/mcp.js'), 'utf8');
const lockedBy = new Function(src.slice(src.indexOf('function lockedBy'), src.indexOf('const isReady')) + ';return lockedBy;')();

const ms = [{ id: 'G0', track: 'mvp' }, { id: 'G1', track: 'mvp' }, { id: 'X1', track: 'expansion' }, { id: 'F1', track: 'extra' }, { id: 'F2', track: 'extra' }, { id: 'EXP' }];
const ctx = (gates, gated = true) => ({ plan: { plan: { gated, milestones: ms }, gates } });
const A = { status: 'approved' }, R = { status: 'returned' };
let fails = 0;
const check = (got, want, msg) => { const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

check(lockedBy(ctx({}), { milestone: 'G0' }), null, 'G0 is open from the start');
check(lockedBy(ctx({}), { milestone: 'G1' }), 'G0', 'G1 waits for gate G0');
check(lockedBy(ctx({ G0: R }), { milestone: 'G1' }), 'G0', 'a returned gate keeps the next stage closed');
check(lockedBy(ctx({ G0: A }), { milestone: 'G1' }), null, 'approving G0 opens G1');
check(lockedBy(ctx({ G0: A }), { milestone: 'X1' }), 'G1', 'expansion waits for the whole MVP');
check(lockedBy(ctx({ G0: A, G1: A }), { milestone: 'X1' }), null, 'expansion opens after the last MVP gate');
check(lockedBy(ctx({ G0: A, G1: A }), { milestone: 'F1' }), null, 'the first extra feature opens after the MVP');
check(lockedBy(ctx({ G0: A, G1: A }), { milestone: 'F2' }), 'F1', 'extra features go in their ranked order');
check(lockedBy(ctx({}), { milestone: 'EXP' }), null, 'experience fixes (no track) are never gated');
check(lockedBy(ctx({}, false), { milestone: 'G1' }), null, 'older plans without gates are not gated');
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
