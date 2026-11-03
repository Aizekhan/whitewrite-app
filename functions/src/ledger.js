// The token ledger — every move of a user's tokens, written ONLY by the server: users/{uid}/ledger/{id}
//   { type, op, amount, balance, ref, note, at }
//   type:   grant  — the plan's monthly budget opened (a new period, a plan change)
//           topup  — tokens bought (Lemon Squeezy order; the money receipt is Lemon's, this one is ours)
//           spend  — an AI action at its real cost, or a fixed price (Космограф / Маркетинг month, a project slot,
//                    the plan-switch fee, the licence review)
//           refund — tokens returned (a failed paid step that was already final)
//           adjust — an admin correction
//   amount: signed (+ in, − out); balance: tokens available right after (null when unknown)
//   ref:    what it was for — { worldId, gameId, projectId, orderId, plan, licenceId, model } (only the ones that apply)
// Entries are never edited or deleted; the Account shows them («Історія токенів») and prints a receipt for any of them.
// Internal costs (API dollars, margins) stay in usage_logs — the ledger holds only what the user sees.
const admin = require('../admin.js'); // firebase-admin v14: the namespaced facade (functions/admin.js)

const TYPES = ['grant', 'topup', 'spend', 'refund', 'adjust'];
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));

function entry(e) {
  if (!TYPES.includes(e.type)) throw new Error('ledger: bad type ' + e.type);
  const amount = Math.round(Number(e.amount) || 0);
  return clean({ type: e.type, op: String(e.op || e.type).slice(0, 60), amount, balance: Number.isFinite(e.balance) ? Math.round(e.balance) : null,
    ref: Object.keys(clean(e.ref)).length ? clean(e.ref) : null, note: e.note ? String(e.note).slice(0, 300) : null,
    at: admin.firestore.FieldValue.serverTimestamp() });
}
const col = (db, uid) => db.collection('users').doc(uid).collection('ledger');

// Inside a transaction (the same one that moves the balance)
function txRecord(tx, db, uid, e) { if (e.amount) tx.set(col(db, uid).doc(), entry(e)); }
// After the fact (a fixed price already reserved); a failed log never breaks the paid action
async function record(db, uid, e) {
  if (!e.amount) return;
  try { await col(db, uid).add(entry(e)); } catch (er) { console.error('[ledger] record failed:', uid, e.op, er.message); }
}

module.exports = { txRecord, record, entry, TYPES };
