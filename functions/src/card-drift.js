// ↻ Card → plan (v2.154, owner: «коли агент міняє картку чи план — міняється відповідна картка? треба одне джерело правди»).
// The GDD card is the one source of truth of WHAT the game must be; a task only points at cards. When the author or the game-designer agent
// changes the design of a card that a DONE task already built into the game, the plan gets one task «↻ Привести гру до картки» with what
// changed (in the epic and milestone of that task); Claude Code takes it from the queue. Not on: a rename (title — ids are stable), status /
// files / links / the agent marks, and writes of the programmer key (that is the card catching up with the game — submit_task_result).
// One open sync task per card: a second change is added to it, never a second task.
// v2.154 (the game-designer agent: «програміст може мовчки змінити дизайн … джерело правди переїде з карток у код»): (a) a design change by the
// programmer key is NOT the card catching up unless the task it is on is the author's instruction for this card — else the card gets
// `devDrift` («⚠ Розбіжність: програміст змінив X 40% → 60%») for the author / the designer to accept or put back; (b) a change while a task on
// the card is open marks that task `cardChanged` («звір перед здачею»); (c) only substantive changes: any number, or ≥ 15% of the words.
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { admin, db } = require('./common');

const DESIGN = ['fields', 'mech', 'intent', 'place', 'creature', 'sheet']; // what a card says about the game
const clip = (v, n) => { const s = typeof v === 'string' ? v : JSON.stringify(v === undefined ? '' : v); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const same = (a, b) => JSON.stringify(a === undefined ? null : a) === JSON.stringify(b === undefined ? null : b);
// a typo / wording fix is not a change of the game: the same numbers and < 15% of the words changed
const nums = (v) => (String(v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v)).match(/\d+(?:[.,]\d+)?/g) || []).join('|');
const words = (v) => String(v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v)).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
function lev(a, b) { // edit distance, two rows
  let p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[b.length];
}
function minor(a, b) {
  if (nums(a) !== nums(b)) return false;
  const ta = typeof a === 'string' ? a : JSON.stringify(a == null ? '' : a), tb = typeof b === 'string' ? b : JSON.stringify(b == null ? '' : b);
  if (ta.length <= 1500 && tb.length <= 1500) return lev(ta, tb) / Math.max(1, ta.length, tb.length) < 0.15; // a typo, a reworded phrase
  const x = words(a), y = words(b), sx = new Set(x), sy = new Set(y);
  const diff = x.filter((w) => !sy.has(w)).length + y.filter((w) => !sx.has(w)).length;
  return diff / Math.max(1, x.length, y.length) < 0.15;
}
// the threshold is only for descriptions and notes (the designer agent: «"маги дістають летючих" — кілька слів, нижче порогу»): a rule or a
// number field counts on any change except spacing / letter case
const DESCRIPTIVE = /^(text|desc|description|notes?|look|mood|lore|story|bio|about|summary|logline|appearance|refs|source|secrets|portrait|refpics|pics|model)$/i;
const norm = (v) => String(v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v)).toLowerCase().replace(/\s+/g, ' ').trim();
const fieldMinor = (k, a, b) => (DESCRIPTIVE.test(k) ? minor(a, b) : norm(a) === norm(b));
// the design changes of one write → [{ key, from, to, full }] (a field of `fields` by name, the rest by block); [] = nothing the game must follow
function driftOf(before, after) {
  const out = [];
  DESIGN.forEach((k) => {
    if (same(before[k], after[k])) return;
    if (k === 'fields' && before.fields && after.fields && typeof before.fields === 'object') {
      [...new Set(Object.keys(before.fields).concat(Object.keys(after.fields)))].filter((f) => f !== 'group' && !same(before.fields[f], after.fields[f]) && !fieldMinor(f, before.fields[f], after.fields[f]))
        .forEach((f) => out.push({ key: f, from: clip(before.fields[f], 160), to: clip(after.fields[f], 160), full: before.fields[f] === undefined ? null : before.fields[f] }));
    } else out.push({ key: k, from: '', to: '' });
  });
  return out;
}
// the last write was the programmer key's (agentMark: agentAt ≈ updatedAt) — the card follows the game, not the other way round
const ms = (v) => (!v ? 0 : typeof v === 'number' ? v : v.toMillis ? v.toMillis() : 0);
const byProgrammer = (c) => !!c.agentAt && (c.agentRole || 'programmer') === 'programmer' && Math.abs(ms(c.updatedAt) - c.agentAt) < 15000;
const lines = (d) => d.map((x) => '• ' + x.key + (x.from || x.to ? ': ' + (x.from || '—') + ' → ' + (x.to || '—') : '')).join('\n');

const OPEN_WORK = ['todo', 'rework', 'in_progress', 'blocked', 'review'];
async function onCard(gref, cardId, before, after) {
  if (after.hidden || after.archived || after.canonRef) return null;
  const drift = driftOf(before, after);
  if (!drift.length) return null;
  const ref = 'c:' + cardId, tasks = (await gref.collection('tasks').where('cards', 'array-contains', ref).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  const now = Date.now(), cref = gref.collection('cards').doc(cardId);
  if (byProgrammer(after)) { // (a) a programmer's design change is never silently the truth
    // the author's instruction tied to THIS card (only this card — the instruction's cards) covers it: an info mark for the designer, no decision
    const au = tasks.find((t) => t.kind === 'author' && ['in_progress', 'review', 'rework'].includes(t.status));
    const work = au || tasks.find((t) => t.status === 'in_progress') || {};
    await cref.set({ devDrift: admin.firestore.FieldValue.arrayUnion(...drift.map((x) => ({ key: x.key, from: x.from, to: x.to, full: x.full === undefined ? null : x.full,
      by: String(after.agentBy || 'Claude Code').slice(0, 80), task: work.id || '', ...(au ? { author: au.id } : {}), at: now }))) }, { merge: true });
    return au ? null : { devDrift: drift.length };
  }
  if (after.noSyncAt && Math.abs(ms(after.updatedAt) - after.noSyncAt) < 15000) return null; // save_card sync: false — the saver said «no task»
  // (b) a task on this card is still open: it must check the card again before handing in
  const working = tasks.filter((t) => t.kind !== 'sync' && OPEN_WORK.includes(t.status) && t.status !== 'todo');
  for (const t of working) await gref.collection('tasks').doc(t.id).set({ cardChanged: admin.firestore.FieldValue.arrayUnion({ ref, keys: drift.map((x) => x.key).join(', '), at: now }) }, { merge: true });
  const built = tasks.filter((t) => t.status === 'done' && t.kind !== 'sync').sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))[0];
  if (!built) return null; // not in the game yet — the open tasks read the card as it is now
  const title = String(after.title || cardId).slice(0, 120);
  const open = tasks.find((t) => t.kind === 'sync' && ['todo', 'rework', 'in_progress', 'blocked'].includes(t.status));
  if (open) { // the same card changed again: add to its task
    await gref.collection('tasks').doc(open.id).set({ drift: admin.firestore.FieldValue.arrayUnion(...drift.map((x) => ({ ...x, at: now }))),
      detail: String((open.detail || '') + '\n' + lines(drift)).slice(-1800), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { id: open.id, added: true };
  }
  const id = 'SY-' + cardId.slice(0, 10) + '-' + now.toString(36).slice(-4);
  await gref.collection('tasks').doc(id).set({
    id, kind: 'sync', title: '↻ Привести гру до картки «' + title + '»', cards: [ref], roles: { [ref]: 'implements' }, card: ref, builtBy: built.id,
    milestone: built.milestone || '', ...(built.epic ? { epic: built.epic } : {}), drift: drift.map((x) => ({ ...x, at: now })),
    detail: 'Картку змінено після того, як ' + built.id + ' втілив її в гру:\n' + lines(drift), deps: [], size: 'S', owner: 'dev', priority: 'must',
    accept: ['The game matches the card «' + title + '» again: ' + drift.map((x) => x.key).join(', ')], tests: [],
    prompt: 'The GDD card ' + ref + ' «' + title + '» changed after ' + built.id + ' was built. Read it (get_card), change the game to match, then submit_task_result.',
    status: 'todo', order: 7500, history: [{ type: 'card_changed', by: after.agentAt && Math.abs(ms(after.updatedAt) - after.agentAt) < 15000 ? (after.agentBy || 'agent') : 'author', at: now }],
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id };
}

exports.cardDrift = onDocumentUpdated({ document: 'worlds/{worldId}/games/{gameId}/cards/{cardId}', region: 'us-central1', timeoutSeconds: 60 }, async (event) => {
  const b = event.data && event.data.before && event.data.before.data(), a = event.data && event.data.after && event.data.after.data();
  if (!b || !a) return;
  const gref = db.collection('worlds').doc(event.params.worldId).collection('games').doc(event.params.gameId);
  await onCard(gref, event.params.cardId, b, a).catch((e) => console.error('[cardDrift]', e));
});
exports._drift = { driftOf, byProgrammer, onCard, minor }; // tests only (tests/card-drift.test.cjs)
