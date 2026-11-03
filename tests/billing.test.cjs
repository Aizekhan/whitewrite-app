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
    set: async (d, o) => { store.set(p, apply(o && o.merge ? store.get(p) : {}, d)); }, update: async (d) => { if (!store.has(p)) throw new Error('no doc ' + p); store.set(p, apply(store.get(p), d)); } };
}
function query(p, filters, n) {
  return { where: (f, op, v) => query(p, filters.concat([[f, op, v]]), n), limit: (k) => query(p, filters, k),
    get: async () => { const depth = p.split('/').length + 1;
      const docs = [...store.keys()].filter((k) => k.startsWith(p + '/') && k.split('/').length === depth).filter((k) => filters.every(([f, op, v]) => {
        const x = store.get(k)[f]; return op === '==' ? x === v : op === 'array-contains' ? (x || []).includes(v) : false; })).slice(0, n || 1e9).map(snap);
      return { empty: !docs.length, docs }; } };
}
function col(p) { return { doc: (id) => doc(p + '/' + (id || 'auto' + (++auto))), add: async (d) => { const r = doc(p + '/auto' + (++auto)); await r.set(d); return r; }, where: (f, op, v) => query(p, [[f, op, v]]) }; }
const db = { collection: (c) => col(c), runTransaction: async (fn) => { const ops = []; const tx = { get: (r) => r.get(),
  update: (r, d) => ops.push(() => r.update(d)), set: (r, d, o) => ops.push(() => r.set(d, o)) }; const out = await fn(tx); for (const o of ops) await o(); return out; } };
const authUsers = { victim: { email: 'victim@x.com' }, buyer: { email: 'buyer@x.com' } };
const fakeAdmin = { firestore: Object.assign(() => db, { FieldValue: FV, Timestamp: { now: () => TS(Date.now()), fromMillis: TS } }),
  auth: () => ({ getUser: async (uid) => { if (!authUsers[uid]) throw new Error('no user'); return authUsers[uid]; } }) };
require.cache[F('admin.js')] = { loaded: true, exports: fakeAdmin }; // functions/admin.js — the namespaced facade over firebase-admin v14

const TSvc = require(F('token-service.js'));
const { getPlanBudget } = require(F('plans.js'));
const SECRET = 'whsec_test';
require.cache[F('src/common.js')] = { loaded: true, exports: { onRequest: (o, h) => h, admin: fakeAdmin, db, cors: (q, r, f) => f(),
  lemonSqueezyApiKey: { value: () => 'k' }, lemonSqueezyWebhookSecret: { value: () => SECRET }, requireAdmin: async () => true,
  getPlanBudget, getBalance: TSvc.getBalance, verifyAuth: async () => null } };
const { lemonSqueezyWebhook } = require(F('src/lemon.js'));

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
  const logs = [...store.entries()].filter(([k]) => k.startsWith('usage_logs/')).map(([, v]) => v);
  check(logs.length && logs.every((l) => Math.abs(l.userPaidUSD - l.userTokensCharged * require(F('paid-features.js')).USD_PER_TOKEN) < 1e-3), 'usage_logs userPaidUSD = tokens × USD_PER_TOKEN (the loss alarm works)');

  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})().catch((e) => { console.error(e); process.exitCode = 1; });
