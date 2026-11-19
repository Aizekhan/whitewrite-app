// Billing (functions/src/lemon.js webhook + functions/token-service.js) against an in-memory Firestore:
// signed checkout uid, idempotent subscription_created, prorated portal upgrades, refunds, bonus-first returns, cut-off answers.
// Run: npm test
const path = require('path');
const crypto = require('crypto');
const F = (p) => require.resolve(path.join(__dirname, '../functions', p));

// ---------- in-memory Firestore + a fake firebase-admin (sentinels applied on write) ----------
const store = new Map();
const TS = (ms) => ({ toMillis: () => ms, toDate: () => new Date(ms) });
const FV = { serverTimestamp: () => ({ __fv: 'ts' }), increment: (n) => ({ __fv: 'inc', n }), arrayUnion: (...v) => ({ __fv: 'union', v }), delete: () => ({ __fv: 'del' }) };
const apply = (cur, d) => {
  const out = JSON.parse(JSON.stringify(cur || {}, (k, v) => v)); // plain copy; Timestamps are re-attached below
  for (const k of Object.keys(cur || {})) if (cur[k] && cur[k].toMillis) out[k] = cur[k];
  for (const [k, v] of Object.entries(d)) {
    const keys = k.split('.'); let o = out; keys.slice(0, -1).forEach((x) => { o = o[x] = o[x] || {}; }); const last = keys[keys.length - 1];
    if (v && v.__fv === 'del') delete o[last];
    else if (v && v.__fv === 'inc') o[last] = (o[last] || 0) + v.n;
    else if (v && v.__fv === 'union') o[last] = [...new Set([...(o[last] || []), ...v.v])];
    else if (v && v.__fv === 'ts') o[last] = TS(Date.now());
    else o[last] = v;
  }
  return out;
};
let auto = 0;
const snap = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => store.get(p), ref: doc(p) });
function doc(p) {
  return { id: p.split('/').pop(), path: p, get firestore() { return db; }, collection: (c) => col(p + '/' + c), get: async () => snap(p),
    set: async (d, o) => { store.set(p, apply(o && o.merge ? store.get(p) : {}, d)); }, delete: async () => { store.delete(p); }, get parent() { return { parent: { id: p.split('/').slice(-3, -2)[0] } }; }, update: async (d) => { if (!store.has(p)) throw new Error('no doc ' + p); store.set(p, apply(store.get(p), d)); } };
}
function query(p, filters, n) {
  return { where: (f, op, v) => query(p, filters.concat([[f, op, v]]), n), limit: (k) => query(p, filters, k),
    get: async () => { const depth = p.split('/').length + 1;
      const docs = [...store.keys()].filter((k) => k.startsWith(p + '/') && k.split('/').length === depth).filter((k) => filters.every(([f, op, v]) => {
        const x = store.get(k)[f]; return op === '==' ? x === v : op === 'array-contains' ? (x || []).includes(v) : op === '<' ? x && x.toMillis() < v.toMillis() : false; })).slice(0, n || 1e9).map(snap);
      return { empty: !docs.length, docs }; } };
}
function col(p) { return { doc: (id) => doc(p + '/' + (id || 'auto' + (++auto))), add: async (d) => { const r = doc(p + '/auto' + (++auto)); await r.set(d); return r; }, where: (f, op, v) => query(p, [[f, op, v]]) }; }
// collectionGroup: every doc whose parent collection is named c (any depth), with the same where/limit as query()
const group = (c, filters = [], n) => ({ where: (f, op, v) => group(c, filters.concat([[f, op, v]]), n), limit: (k) => group(c, filters, k),
  get: async () => { const docs = [...store.keys()].filter((k) => k.split('/').slice(-2, -1)[0] === c).filter((k) => filters.every(([f, op, v]) => {
    const x = store.get(k)[f]; return op === '<' ? x && x.toMillis() < v.toMillis() : x === v; })).slice(0, n || 1e9).map(snap); return { empty: !docs.length, docs }; } });
const db = { collection: (c) => col(c), collectionGroup: (c) => group(c), runTransaction: async (fn) => { const ops = []; const tx = { get: (r) => r.get(),
  update: (r, d) => ops.push(() => r.update(d)), set: (r, d, o) => ops.push(() => r.set(d, o)), delete: (r) => ops.push(() => r.delete()) }; const out = await fn(tx); for (const o of ops) await o(); return out; } };
const authUsers = { victim: { email: 'victim@x.com' }, buyer: { email: 'buyer@x.com' } };
const fakeAdmin = { firestore: Object.assign(() => db, { FieldValue: FV, Timestamp: { now: () => TS(Date.now()), fromMillis: TS } }),
  auth: () => ({ getUser: async (uid) => { if (!authUsers[uid]) throw new Error('no user'); return authUsers[uid]; }, verifyIdToken: async (t) => ({ uid: t }) }) };
let authUid = null; // the caller of changeSubscription (common.verifyAuth)
require.cache[F('admin.js')] = { loaded: true, exports: fakeAdmin }; // functions/admin.js — the namespaced facade over firebase-admin v14

const TSvc = require(F('token-service.js'));
const { getPlanBudget } = require(F('plans.js'));
const SECRET = 'whsec_test';
require.cache[F('src/common.js')] = { loaded: true, exports: { onRequest: (o, h) => h, admin: fakeAdmin, db, cors: (q, r, f) => f(),
  lemonSqueezyApiKey: { value: () => 'k' }, lemonSqueezyWebhookSecret: { value: () => SECRET }, requireAdmin: async () => true,
  getPlanBudget, getBalance: TSvc.getBalance, verifyAuth: async () => authUid, reserve: TSvc.reserve, refund: TSvc.refund, publicMessage: (e) => e.message } };
const { lemonSqueezyWebhook, changeSubscription } = require(F('src/lemon.js'));
const call = async (fn, body, auth) => { let code = 200, out = null; const res = { status(c) { code = c; return this; }, json(o) { out = o; return this; }, send() { return this; } };
  await fn({ method: 'POST', headers: { authorization: 'Bearer ' + auth }, body }, res); return { code, out }; };

const hook = async (event) => {
  const raw = Buffer.from(JSON.stringify(event)); let code = 200;
  const res = { status(c) { code = c; return this; }, json() { return this; }, send() { return this; } };
  await lemonSqueezyWebhook({ headers: { 'x-signature': crypto.createHmac('sha256', SECRET).update(raw).digest('hex') }, rawBody: raw, body: event }, res);
  return code;
};
const sig = (uid) => crypto.createHmac('sha256', SECRET).update('uid:' + uid).digest('hex').slice(0, 32);
const V = { storyteller: '11', novelist: '12', worldbuilder: '13' };
const U = (uid) => store.get('users/' + uid);

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

(async () => {
  store.set('config/lemon_squeezy', { variants: { ...V, tokens_500: '99' }, topups: { 500: { variantId: '99', tokens: 500 } } });
  const created = (uid, custom, email, id = 'sub1', variant = V.storyteller) => hook({ meta: { event_name: 'subscription_created', custom_data: custom },
    data: { id, attributes: { variant_id: variant, customer_id: 7, user_email: email } } });

  // --- checkout uid must be signed (or the buyer's email must be the user's) ---
  store.set('users/victim', { plan: 'novelist', tokensUsed: 100, periodStart: TS(Date.now()), lemonSqueezySubscriptionId: 'vsub', subscriptionStatus: 'active' });
  await created('victim', { user_id: 'victim' }, 'attacker@evil.com', 'evil');
  check(U('victim').lemonSqueezySubscriptionId === 'vsub' && U('victim').plan === 'novelist', "an unsigned user_id with someone else's email does not take over the subscription");
  await created('victim', { user_id: 'victim', sig: 'f'.repeat(32) }, 'attacker@evil.com', 'evil');
  check(U('victim').lemonSqueezySubscriptionId === 'vsub', 'a forged signature is refused');

  store.set('users/buyer', { plan: 'free', tokensUsed: 40, periodStart: TS(Date.now() - 864e5) });
  await created('buyer', { user_id: 'buyer', sig: sig('buyer') }, 'other@mail.com');
  check(U('buyer').plan === 'storyteller' && U('buyer').tokensUsed === 0 && U('buyer').lemonSqueezySubscriptionId === 'sub1', 'a signed checkout opens the subscription');
  store.set('users/buyer', Object.assign(U('buyer'), { tokensUsed: 900 }));
  await created('buyer', { user_id: 'buyer', sig: sig('buyer') }, 'other@mail.com');
  check(U('buyer').tokensUsed === 900, 'a redelivered subscription_created does not open a fresh month');
  store.set('users/u3', { plan: 'free' }); authUsers.u3 = { email: 'u3@x.com' };
  await created('u3', { user_id: 'u3' }, 'U3@x.com ', 'sub3');
  check(U('u3').plan === 'storyteller', 'an unsigned uid is still accepted when the buyer is that user (email match)');

  // --- an upgrade in the LS customer portal is prorated, not the whole month ---
  const updated = (id, variant, extra) => hook({ meta: { event_name: 'subscription_updated' },
    data: { id, attributes: Object.assign({ status: 'active', variant_id: variant, renews_at: new Date(Date.now() + 864e5).toISOString() }, extra) } });
  store.set('users/buyer', Object.assign(U('buyer'), { tokensUsed: getPlanBudget('storyteller').monthly })); // spent the month
  await updated('sub1', V.worldbuilder);
  const wb = TSvc.getBalance(U('buyer'));
  check(U('buyer').plan === 'worldbuilder' && wb.available < getPlanBudget('worldbuilder').monthly * 0.1, `portal upgrade on the last day opens ~1/30 of the difference (${wb.available} of ${getPlanBudget('worldbuilder').monthly})`);
  check(U('buyer').lastUpgrade && U('buyer').lastUpgrade.via === 'portal', 'the portal upgrade is recorded');
  store.set('users/u3', Object.assign(U('u3'), { tokensUsed: 10, upgrading: { to: 'novelist', at: TS(Date.now()) } }));
  await updated('sub3', V.novelist);
  check(U('u3').plan === 'novelist' && U('u3').tokensUsed === 10, 'an in-app upgrade (changeSubscription marker) is not prorated twice');
  const before = U('u3').tokensUsed;
  await updated('sub3', V.novelist);
  check(U('u3').tokensUsed === before, 'an update with the same plan changes no tokens');

  // --- a paused / unpaid subscription closes every plan gate; resumed, the plan returns without proration ---
  await updated('sub3', V.novelist, { status: 'paused' });
  check(U('u3').plan === 'free' && U('u3').paidPlan === 'novelist', 'paused → plan free, the paid plan remembered');
  await updated('sub3', V.novelist, { status: 'unpaid' });
  check(U('u3').plan === 'free' && U('u3').paidPlan === 'novelist', 'a second hold keeps the remembered plan');
  await updated('sub3', V.novelist);
  check(U('u3').plan === 'novelist' && !U('u3').paidPlan && U('u3').tokensUsed === before && !(U('u3').lastUpgrade && U('u3').lastUpgrade.to === 'novelist' && U('u3').lastUpgrade.via === 'portal'), 'resumed → the plan returns, no upgrade proration');
  await updated('sub3', V.novelist, { status: 'past_due' });
  check(U('u3').plan === 'novelist' && U('u3').subscriptionStatus === 'past_due', 'past_due (LS still retrying) keeps the plan');
  await updated('sub3', V.novelist);

  // --- an upgrade switches the plan at once; its prorated tokens open only when LS reports the upgrade invoice paid ---
  const pay = (ev, id, reason, sub = 'subF') => hook({ meta: { event_name: ev }, data: { id: 'inv_' + id, attributes: { subscription_id: sub, billing_reason: reason } } });
  const stM = getPlanBudget('storyteller').monthly, wbM = getPlanBudget('worldbuilder').monthly;
  store.set('users/f1', { plan: 'worldbuilder', tokensUsed: wbM - (stM - 100), periodStart: TS(Date.now()), lemonSqueezySubscriptionId: 'subF', subscriptionStatus: 'active',
    lastUpgrade: { from: 'storyteller', to: 'worldbuilder', net: 5000, fee: 300, at: TS(Date.now()), granted: false } }); // switched: storyteller's stM−100 left, +5000 pending
  check(TSvc.getBalance(U('f1')).monthlyLeft === stM - 100, 'right after the switch the allowance left is what it was — the upgrade tokens wait for the payment');
  await pay('subscription_payment_failed', 1, 'renewal');
  check(U('f1').plan === 'worldbuilder', 'a failed renewal is left to subscription_updated (past_due / unpaid)');
  await pay('subscription_payment_failed', 2, 'updated');
  check(U('f1').plan === 'storyteller' && TSvc.getBalance(U('f1')).monthlyLeft === stM - 100 && U('f1').lastUpgrade.revoked === true, 'a failed upgrade invoice: the old plan back, nothing was granted so nothing is clawed back');
  await pay('subscription_payment_failed', 3, 'updated');
  check(U('f1').plan === 'storyteller' && TSvc.getBalance(U('f1')).monthlyLeft === stM - 100, 'a second failure (LS retry) takes nothing more');
  await pay('subscription_payment_success', 4, 'updated');
  check(U('f1').plan === 'worldbuilder' && TSvc.getBalance(U('f1')).monthlyLeft === stM - 100 + 5000 && U('f1').lastUpgrade.granted === true, 'paid on a retry: the plan comes back and the upgrade tokens open');
  await pay('subscription_payment_success', 5, 'updated');
  check(TSvc.getBalance(U('f1')).monthlyLeft === stM - 100 + 5000, 'a redelivered payment opens nothing more');
  await pay('subscription_payment_failed', 6, 'updated');
  check(U('f1').plan === 'worldbuilder' && TSvc.getBalance(U('f1')).monthlyLeft === stM - 100 + 5000, 'a stray failure after the payment changes nothing');
  check([...store.entries()].some(([k, v]) => k.startsWith('usage_logs/') && v.operation === 'plan_upgrade_fee' && v.userTokensCharged === 300), 'the switch fee is logged when the upgrade is paid');
  store.set('users/f3', { plan: 'novelist', tokensUsed: getPlanBudget('novelist').monthly - 700, periodStart: TS(Date.now()), lemonSqueezySubscriptionId: 'subF3', subscriptionStatus: 'active',
    lastUpgrade: { from: 'storyteller', to: 'novelist', net: 4000, at: TS(Date.now()), granted: false } });
  await pay('subscription_payment_success', 7, 'updated', 'subF3');
  check(TSvc.getBalance(U('f3')).monthlyLeft === 4700 && U('f3').lastUpgrade.granted, 'the upgrade invoice paid at once: the tokens open once');
  store.set('users/f2', { plan: 'novelist', tokensUsed: 0, periodStart: TS(Date.now()), lemonSqueezySubscriptionId: 'subF2', subscriptionStatus: 'active' });
  await hook({ meta: { event_name: 'subscription_payment_failed' }, data: { id: 'inv_9', attributes: { subscription_id: 'subF2', billing_reason: 'updated' } } });
  check(U('f2').plan === 'novelist' && U('f2').tokensUsed === 0, 'no recorded upgrade — nothing changes');

  // --- refunds take back what the money bought, once ---
  store.set('users/buyer', Object.assign(U('buyer'), { bonusTokens: 0 }));
  await hook({ meta: { event_name: 'order_created', custom_data: { user_id: 'buyer', sig: sig('buyer') } }, data: { id: 'o1', attributes: { first_order_item: { variant_id: '99' }, user_email: 'x' } } });
  check(U('buyer').bonusTokens === 500, 'a top-up adds bought tokens');
  const refundTopup = () => hook({ meta: { event_name: 'order_refunded' }, data: { id: 'o1', attributes: { first_order_item: { variant_id: '99' }, total: 500, refunded_amount: 250 } } });
  await refundTopup();
  check(U('buyer').bonusTokens === 250, 'a half refund takes back half the bought tokens');
  await refundTopup();
  check(U('buyer').bonusTokens === 250, 'a redelivered refund takes nothing more');
  store.set('users/victim', Object.assign(U('victim'), { tokensUsed: 0, periodStart: TS(Date.now()) }));
  await hook({ meta: { event_name: 'subscription_payment_refunded' }, data: { id: 'inv1', attributes: { subscription_id: 'vsub', total: 2900, refunded_amount: 2900 } } });
  check(TSvc.getBalance(U('victim')).monthlyLeft === 0, "a refunded month's payment takes back that month's allowance");

  // --- token-service: a reservation taken from bought tokens goes back to them; a cut-off answer is charged ---
  store.set('economy_operations/generateScene', { providers: { claude: { marginMultiplier: 1, baseTokens: 10 } } });
  const model = Object.keys(require(F('ai-models.js')).MODEL_PRICING)[0];
  store.set('users/t1', { plan: 'free', tokensUsed: getPlanBudget('free').monthly, periodStart: TS(Date.now()), bonusTokens: 1000 });
  const r1 = await TSvc.reserve(db, 't1', 300);
  check(r1.fromBonus === 300 && U('t1').bonusTokens === 700, 'with the allowance spent the reserve comes from bought tokens');
  const c1 = await TSvc.charge(db, 't1', 'generateScene', model, { input_tokens: 100, output_tokens: 100 }, null, { reserved: r1 });
  check(U('t1').bonusTokens === 1000 - c1.userCost && U('t1').tokensUsed === getPlanBudget('free').monthly, `the unused part goes back to bought tokens, not the allowance (charged ${c1.userCost})`);
  const r2 = await TSvc.reserve(db, 't1', 300), bonusBefore = U('t1').bonusTokens + 300;
  await TSvc.settle(db, 't1', r2, TSvc.cutOff('cut', model, { input_tokens: 2000, output_tokens: 1000 }), 'test');
  check(U('t1').bonusTokens < bonusBefore, 'a cut-off answer (max_tokens) is charged its real cost, not refunded');
  const r3 = await TSvc.reserve(db, 't1', 300), b3 = U('t1').bonusTokens + 300;
  await TSvc.settle(db, 't1', r3, new Error('network'), 'test');
  check(U('t1').bonusTokens === b3, 'any other failure refunds the whole reservation');

  // --- held reservations (an AI call): a function killed by its timeout never refunds — the sweep does, once ---
  const held = () => [...store.keys()].filter((k) => k.startsWith('users/t1/reservations/'));
  const b4 = U('t1').bonusTokens;
  const h1 = await TSvc.reserve(db, 't1', 200, { hold: true });
  check(h1.hold && held().length === 1, 'an AI reservation is held in users/{uid}/reservations');
  check(await TSvc.sweepHeld(db) === 0 && U('t1').bonusTokens === b4 - 200, 'a fresh hold is not swept');
  check(await TSvc.sweepHeld(db, Date.now() + TSvc.HOLD_MS + 1000) === 1 && U('t1').bonusTokens === b4 && !held().length, 'a hold older than HOLD_MS is returned by the sweep');
  await TSvc.refund(db, 't1', h1);
  check(U('t1').bonusTokens === b4, 'a late refund of a swept hold returns nothing twice');
  const h2 = await TSvc.reserve(db, 't1', 300, { hold: true });
  const c2 = await TSvc.charge(db, 't1', 'generateScene', model, { input_tokens: 100, output_tokens: 100 }, null, { reserved: h2 });
  check(!held().length && U('t1').bonusTokens === b4 - c2.userCost, 'charge settles a hold and deletes it');
  check(await TSvc.sweepHeld(db, Date.now() + TSvc.HOLD_MS + 1000) === 0 && U('t1').bonusTokens === b4 - c2.userCost, 'a settled hold is never swept');
  const b5 = U('t1').bonusTokens, h3 = await TSvc.reserve(db, 't1', 300, { hold: true });
  await TSvc.sweepHeld(db, Date.now() + TSvc.HOLD_MS + 1000);
  const c3 = await TSvc.charge(db, 't1', 'generateScene', model, { input_tokens: 100, output_tokens: 100 }, null, { reserved: h3 });
  check(U('t1').bonusTokens === b5 - c3.userCost, 'a call finishing after its hold was swept is charged in full, once');
  const b6 = U('t1').bonusTokens, h4 = await TSvc.reserve(db, 't1', 300, { hold: true });
  await TSvc.settle(db, 't1', h4, Object.assign(new Error('Claude відмовився виконати запит'), { paid: { model, usage: { input_tokens: 5000, output_tokens: 10 } } }), 'test');
  check(U('t1').bonusTokens < b6 && !held().length, 'a refusal (paid to the API) is charged, not refunded');

  const logs = [...store.entries()].filter(([k]) => k.startsWith('usage_logs/')).map(([, v]) => v);
  check(logs.every((l) => l.expireAt && l.expireAt.toMillis() > Date.now() + 300 * 86400000), 'usage_logs carry a TTL expireAt (≈400 days)');
  check(logs.length && logs.every((l) => Math.abs(l.userPaidUSD - l.userTokensCharged * require(F('paid-features.js')).USD_PER_TOKEN) < 1e-3), 'usage_logs userPaidUSD = tokens × USD_PER_TOKEN (the loss alarm works)');

  // ===== audit 2026-11-19 =====
  const DAY = 864e5, pf = require(F('paid-features.js'));
  // changeSubscription 'up': the plan now, the prorated tokens only after LS reports the invoice paid
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ data: { attributes: { renews_at: new Date(Date.now() + 15 * DAY).toISOString(), payment_processor: 'stripe' } } }) });
  store.set('users/cs1', { plan: 'storyteller', tokensUsed: stM - 1000, periodStart: TS(Date.now()), lemonSqueezySubscriptionId: 'subCS', subscriptionStatus: 'active' });
  authUid = 'cs1';
  const up = await call(changeSubscription, { op: 'change', plan: 'worldbuilder' }, 'cs1');
  const csNet = U('cs1').lastUpgrade && U('cs1').lastUpgrade.net;
  check(up.code === 200 && U('cs1').plan === 'worldbuilder' && TSvc.getBalance(U('cs1')).monthlyLeft === 1000 && U('cs1').lastUpgrade.granted === false && up.out.tokens === 'pending',
    'an in-app upgrade switches the plan at once but opens no tokens before the payment');
  U('cs1').lastUpgrade.at = TS(Date.now()); // the in-memory store keeps only top-level Timestamps
  await pay('subscription_payment_success', 'cs', 'updated', 'subCS');
  check(TSvc.getBalance(U('cs1')).monthlyLeft === 1000 + csNet && csNet > 0, `the paid upgrade invoice opens the prorated tokens (+${csNet})`);
  authUid = null;

  // a test-mode event opens nothing unless the owner allows test mode (config/lemon_squeezy.testModeOk)
  const bBefore = U('buyer').bonusTokens;
  const testOrder = (id) => hook({ meta: { event_name: 'order_created', test_mode: true, custom_data: { user_id: 'buyer', sig: sig('buyer') } }, data: { id, attributes: { first_order_item: { variant_id: '99' }, user_email: 'x' } } });
  await testOrder('oT1');
  check(U('buyer').bonusTokens === bBefore, 'a test-mode order is ignored');
  store.set('config/lemon_squeezy', Object.assign(store.get('config/lemon_squeezy'), { testModeOk: true }));
  await testOrder('oT2');
  check(U('buyer').bonusTokens === bBefore + 500, 'with testModeOk the owner can test with a test card');
  store.set('config/lemon_squeezy', Object.assign(store.get('config/lemon_squeezy'), { testModeOk: false }));

  // an overdraft (a post-hoc charge beyond the balance) survives the renewal as debt, paid from the next allowance
  const frM = getPlanBudget('free').monthly;
  store.set('users/d1', { plan: 'free', tokensUsed: 0, periodStart: TS(Date.now()) });
  const cd = await TSvc.charge(db, 'd1', 'generateScene', model, { input_tokens: 1000, output_tokens: 20000 }, null, {});
  const debt = cd.userCost - frM;
  check(debt > frM && TSvc.getBalance(U('d1')).available === 0 && TSvc.getBalance(U('d1')).debt === debt, `an overdraft is kept as debt (${debt})`);
  store.set('users/d1', Object.assign(U('d1'), { periodStart: TS(Date.now() - 40 * DAY) }));
  const bd = TSvc.getBalance(U('d1'));
  check(bd.expired && bd.available === 0 && bd.debt === debt - frM, 'a new period pays the debt from its allowance first — the rest of the debt stays');
  await TSvc.reserve(db, 'd1', 0).catch(() => {}); // a debit opens the period: the normalized balance is stored
  check(TSvc.getBalance(U('d1')).debt === debt - frM && U('d1').bonusTokens === -(debt - frM), 'the renewed period stores the debt that is left');
  store.set('users/d1', Object.assign(U('d1'), { bonusTokens: U('d1').bonusTokens + debt })); // a top-up (increment) pays the debt off
  check(TSvc.getBalance(U('d1')).available === frM, 'a top-up pays the debt; the rest is spendable');

  // past_due: no new allowance until the renewal is paid; a cancelled subscription ends at subscriptionEndsAt
  const nvM = getPlanBudget('novelist').monthly;
  const pd = { plan: 'novelist', tokensUsed: nvM - 50, periodStart: TS(Date.now() - 40 * DAY), subscriptionStatus: 'past_due' };
  check(TSvc.getBalance(pd).available === 50 && !TSvc.getBalance(pd).expired, 'past_due: the old period stays, no fresh month before the payment');
  check(TSvc.getBalance(Object.assign({}, pd, { subscriptionStatus: 'active' })).available === nvM, 'paid (active again): the new period opens');
  const ended = { plan: 'novelist', subscriptionStatus: 'active', cancelAtPeriodEnd: true, subscriptionEndsAt: TS(Date.now() - 1000) };
  const { subscriptionActive: subAct } = require(F('plans.js'));
  check(!subAct(ended) && TSvc.getBalance(ended).plan === 'free', 'a cancelled subscription past its end: ✦ gates closed, the balance is Free');
  check(subAct(Object.assign({}, ended, { subscriptionEndsAt: TS(Date.now() + DAY) })), 'a cancelled subscription before its end still works');

  // a return after the period renewed: what came from bought tokens goes back, the new period opens with its grant
  store.set('users/c1', { plan: 'free', tokensUsed: frM, periodStart: TS(Date.now()), bonusTokens: 1000 });
  const rc = await TSvc.reserve(db, 'c1', 300);
  store.set('users/c1', Object.assign(U('c1'), { periodStart: TS(Date.now() - 40 * DAY) }));
  await TSvc.refund(db, 'c1', rc);
  check(U('c1').bonusTokens === 1000 && TSvc.getBalance(U('c1')).available === frM + 1000, 'a refund after the renewal returns the bought tokens and keeps the fresh allowance');
  check([...store.entries()].some(([k, v]) => k.startsWith('users/c1/ledger/') && v.type === 'grant' && v.op === 'monthly'), 'the period opened by a refund writes its ledger grant');

  // reserve upTo: an uncapped long run reserves toward its worst case as far as the balance goes
  store.set('users/r1', { plan: 'worldbuilder', tokensUsed: wbM - 1000, periodStart: TS(Date.now()) });
  const ru = await TSvc.reserve(db, 'r1', 100, { upTo: 5000 });
  check(ru.fromMonthly === 1000, 'upTo: as much of the worst case as the balance holds');
  await TSvc.refund(db, 'r1', ru);
  const ru2 = await TSvc.reserve(db, 'r1', 100, { upTo: 400 });
  check(ru2.fromMonthly === 400, 'upTo within the balance: the worst case in full');
  await TSvc.refund(db, 'r1', ru2);
  check(pf.worstCase('opus', 30000 * 15, 64000 + 14 * 32000) > pf.featureCost(pf.byOp('plan'), null, 'opus') * 5, 'the plan worst case on Opus is far above its registry reserve (why upTo exists)');

  // a run killed by the platform: the calls it noted as paid are charged by the sweep (never above the quoted cap)
  store.set('users/s1', { plan: 'worldbuilder', tokensUsed: 0, periodStart: TS(Date.now()) });
  const hs = await TSvc.reserve(db, 's1', 300, { hold: true });
  await TSvc.notePaid(db, 's1', hs, model, { input_tokens: 10000, output_tokens: 10000 });
  await TSvc.notePaid(db, 's1', hs, model, { input_tokens: 10000, output_tokens: 10000 });
  const paidT = pf.tokensForUsd(2 * TSvc.apiUsd(model, { input_tokens: 10000, output_tokens: 10000 }));
  check(await TSvc.sweepHeld(db, Date.now() + TSvc.HOLD_MS + 1000) >= 1 && U('s1').tokensUsed === paidT, `the sweep charges the noted paid calls (${paidT}), not a full refund`);
  check([...store.entries()].some(([k, v]) => k.startsWith('usage_logs/') && v.uid === 's1' && v.billing === 'swept' && v.realApiCostUSD > 0), 'the swept charge reaches usage_logs (aiCostDaily sees it)');
  const hc = await TSvc.reserve(db, 's1', 100, { hold: true, cap: 100 }), s1b = U('s1').tokensUsed;
  await TSvc.notePaid(db, 's1', hc, model, { input_tokens: 50000, output_tokens: 50000 });
  await TSvc.sweepHeld(db, Date.now() + TSvc.HOLD_MS + 1000);
  check(U('s1').tokensUsed === s1b, 'the sweep never charges above the hold\'s quoted cap');
  await TSvc.notePaid(db, 's1', hc, model, { input_tokens: 1, output_tokens: 1 });
  check(![...store.keys()].some((k) => k === 'users/s1/reservations/' + hc.hold), 'a call finishing after its hold was settled does not bring the hold back');

  // the own deadline: the reservation is kept for the calls still in flight; a quoted cap holds on failure too
  const hd = await TSvc.reserve(db, 's1', 300, { hold: true }), s1c = U('s1').tokensUsed;
  await TSvc.settle(db, 's1', hd, Object.assign(new Error('late'), { deadline: true }), 'test');
  check(U('s1').tokensUsed === s1c && ![...store.keys()].some((k) => k.endsWith('/' + hd.hold)), 'a run stopped by its deadline keeps the reservation (never a free call)');
  const hd2 = await TSvc.reserve(db, 's1', 300, { hold: true }), s1d = U('s1').tokensUsed;
  await TSvc.settle(db, 's1', hd2, Object.assign(new Error('late'), { deadline: true, paid: { model, usage: { input_tokens: 10, output_tokens: 10 } } }), 'test');
  check(U('s1').tokensUsed === s1d, 'deadline + a cheap finished call: at least the reservation is charged');
  const hq = await TSvc.reserve(db, 's1', 120, { hold: true }), s1e = U('s1').tokensUsed;
  await TSvc.settle(db, 's1', hq, TSvc.cutOff('cut', model, { input_tokens: 90000, output_tokens: 30000 }), 'test', { cap: 120 });
  check(U('s1').tokensUsed === s1e, 'a failed quoted run is never charged above «не більше N»');
  let late = null; await TSvc.beforeTimeout(new Promise((r) => setTimeout(r, 3000)), 1000).catch((e) => { late = e; });
  check(late && late.deadline === true, 'beforeTimeout fails with error.deadline before the platform timeout');

  // a missing economy_operations entry never makes a paid call free
  const s1f = U('s1').tokensUsed;
  const cm = await TSvc.charge(db, 's1', 'noSuchOperation', model, { input_tokens: 1000, output_tokens: 1000 }, null, {});
  check(cm.userCost > 0 && U('s1').tokensUsed === s1f + cm.userCost, 'charge() without economy_operations/{op} bills the real cost (registry defaults)');

  // lockCreate: no user doc yet — the lock creates it, so parallel createGame / createProject cannot all pass the limit
  const { lockCreate } = require(F('src/projects.js'))._projects;
  check(await lockCreate('nu1', 'game') === true && U('nu1') && U('nu1').plan === 'free' && U('nu1').creating && U('nu1').creating.game, 'the first create makes the user doc with the lock');
  check(await lockCreate('nu1', 'game') === false, 'a second create meanwhile is refused (BUSY)');

  // Космограф: a month already being paid by another click is not paid twice
  const { cosmographAccess } = require(F('src/cosmograph.js'));
  store.set('users/k1', { plan: 'worldbuilder', tokensUsed: 0, periodStart: TS(Date.now()), subscriptionStatus: 'active' });
  store.set('worlds/wk', { owner: 'k1', cosmograph: { payingAt: TS(Date.now()) } });
  const busy = await call(cosmographAccess, { worldId: 'wk', op: 'enable' }, 'k1');
  check(busy.code === 409 && U('k1').tokensUsed === 0, 'a parallel «Увімкнути» while the month is being paid: 409, nothing charged');
  store.set('worlds/wk', { owner: 'k1' });
  const paid1 = await call(cosmographAccess, { worldId: 'wk', op: 'enable' }, 'k1');
  check(paid1.code === 200 && U('k1').tokensUsed === pf.featureCost(pf.byOp('cosmograph')) && store.get('worlds/wk').cosmograph.paidUntil, 'the claimed click pays the month once');

  // ✦ gates: past_due (LS still retrying the card, the plan kept) works like active; paused / unpaid / expired do not
  const { subscriptionActive } = require(F('plans.js'));
  check(subscriptionActive({ subscriptionStatus: 'active' }) && subscriptionActive({ subscriptionStatus: 'past_due' }) &&
    !subscriptionActive({ subscriptionStatus: 'paused' }) && !subscriptionActive({ subscriptionStatus: 'unpaid' }) && !subscriptionActive({}), 'past_due keeps the ✦ gates open for the grace period, paused / unpaid close them');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
