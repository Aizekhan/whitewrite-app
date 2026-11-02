// Маркет (functions/src/market.js): what goes into the sale snapshot, the metrics, the buyout contract, the licence fee.
// Run: npm test
const path = require('path');
const stub = (rel, exp) => { const f = require.resolve(path.join(__dirname, '../functions/src', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }; };
const fakeAdmin = { firestore: { FieldValue: { serverTimestamp: () => 'TS', delete: () => 'DEL' } } };
stub('common.js', { onRequest: () => () => {}, admin: fakeAdmin, db: {}, cors: () => {}, getBalance: () => ({}), reserve: () => {}, refund: () => {},
  getPlanBudget: () => ({}), claudeApiKey: {}, stripeSecretKey: {}, MODEL_PRICING: {} });
stub('claude.js', { activeModels: async () => ({}), claudeText: async () => ({}) });
const M = require('../functions/src/market.js')._market;
const PF = require('../functions/paid-features.js');
let fails = 0;
const check = (got, want, msg) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`)); if (!ok) fails++; };

const card = M.clean({ title: 'Вовк', fields: { hp: '60' }, files: [{ url: 'x' }], styleAi: { f: 1 }, at: { toDate: () => new Date('2026-11-02T00:00:00Z') } });
check(card, { title: 'Вовк', fields: { hp: '60' }, at: '2026-11-02T00:00:00.000Z' }, 'files, style checks never enter the snapshot; timestamps become ISO');
check(M.clean({ owner: 'u1', freeze: {}, cover: { url: 'x' }, cosmograph: {}, launch: {}, repo: {}, name: 'W' }), { name: 'W' }, 'owner, freeze, cover, keys and integrations stay out');

const snap = { world: { laws: ['a', 'b'] }, entities: [{ kind: 'character' }, { kind: 'character' }, { kind: 'location' }], lore: [{}],
  games: [{ id: 'g', title: 'Гра', cards: [{ fields: { a: '1', b: '2' } }, { fields: { a: '' } }], quests: [{}], dialogues: [], tasks: [{ status: 'done' }, { status: 'todo' }],
    plan: { gates: { G0: { accepted: true }, G1: null } } }],
  stories: [{ id: 'p', title: 'Книга', scenes: [{ text: 'раз два три' }, { content: 'чотири' }] }] };
const m = M.metrics(snap);
check([m.entities, m.kinds, m.lore, m.laws], [3, { character: 2, location: 1 }, 1, 2], 'canon metrics');
check(m.games[0], { id: 'g', title: 'Гра', cards: 2, filledCards: 1, quests: 1, dialogues: 0, tasks: 2, tasksDone: 1, gatesPassed: 1 }, 'game metrics');
check(m.stories[0], { id: 'p', title: 'Книга', scenes: 2, words: 4 }, 'story metrics');

const c = M.contractFor({ id: 'L1', title: 'Орелія', sellerName: 'Автор', snapshotHash: 'abc', priceCents: 12345, currency: 'usd', level: 'gdd', metrics: m,
  legal: { specialTerms: ['Покупець знає про ШІ-текст'] } });
check([/«Орелія»/.test(c), /123\.45 USD/.test(c), /`abc`/.test(c), /- Покупець знає про ШІ-текст/.test(c), /\{\{[A-Z_]+\}\}/.test(c)], [true, true, true, true, false],
  'the contract is filled: title, price, hash, special terms; no placeholder left');
check(/\[імʼя покупця — заповнюється при оплаті\]/.test(c), true, 'the buyer name waits for the payment');

check([PF.licenceFee(1000), PF.licenceFee(150000), PF.licenceFee(150001), PF.licenceFee(2000000), PF.licenceFee(2000001)], [60000, 60000, 90000, 120000, null], 'licence fee tiers by size');
check(!!PF.byOp('licenceReview') && PF.byOp('licenceReview').minPlan, 'worldbuilder', 'the licence review is in the paid-features registry (Worldbuilder)');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);
