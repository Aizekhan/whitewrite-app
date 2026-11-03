// Live prices (functions/paid-features.js LIVE PRICES): every ✦ price follows config/ai_models.priceIndex; access fees stay flat;
// «не більше N» (quoteChars) grows with the input and the price; the charge never goes above the quoted cap (token-service.js).
// Run: npm test
const P = require('../functions/paid-features.js');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };

P.setPriceIndex(null);
const imp = P.byOp('import'), adv = P.byOp('advise'), cosmo = P.byOp('cosmograph');
const base = { imp: P.featureCost(imp, null, 'sonnet'), opus: P.featureCost(imp, null, 'opus'), adv: P.featureCost(adv, null, 'sonnet'), cosmo: P.featureCost(cosmo, null, 'sonnet') };
check(base.imp === 1200 && base.adv === 200 && base.cosmo === 2000, 'no index yet: the registry prices as they were');
check(P.priceIndexFor('sonnet', { input: 2, output: 10 }) === 1 && P.priceIndexFor('sonnet', { input: 3, output: 15 }) === 1.5, 'the index = live ÷ base price of the tier');
check(P.priceIndexFor('opus', null) === 1, 'an unknown live price keeps the index at 1');

P.setPriceIndex({ sonnet: 1.5, opus: 1, haiku: 1 });
check(P.featureCost(imp, null, 'sonnet') === 1800, 'Sonnet +50% → the ✦ price +50%');
check(P.featureCost(imp, null, 'opus') === base.opus, 'another tier keeps its own index');
check(P.featureCost(adv, null, 'sonnet') === 300, 'a fixed AI price marked live follows the index');
check(P.featureCost(cosmo, null, 'sonnet') === 2000, 'an access fee (Космограф) stays flat');

P.setPriceIndex(null);
const q1 = P.quoteChars(imp, 20000, 'sonnet'), q5 = P.quoteChars(imp, 100000, 'sonnet');
check(q1 > base.imp / 2 && q5 > q1 * 3, '«не більше N» grows with the file');
check(P.quoteChars(imp, 100000, 'haiku') < q5 / 10, 'a cheaper model quotes far less');
P.setPriceIndex({ sonnet: 2 });
check(P.quoteChars(imp, 100000, 'sonnet') >= q5 * 2 - 1, 'the quote follows the price index');
check(P.quoteChars(P.byOp('advise'), 100000, 'sonnet') === 0, 'a feature without a quote has none');
P.setPriceIndex(null);

const ts = require('fs').readFileSync(require('path').join(__dirname, '../functions/token-service.js'), 'utf8');
check(/options\.cap > 0 && userCost > options\.cap\) userCost = options\.cap/.test(ts), 'the charge is capped at the quoted N');
check(/setPriceIndex\(conf\.priceIndex\)/.test(ts), 'the server reads the published index');
const gd = require('fs').readFileSync(require('path').join(__dirname, '../functions/src/gamedev.js'), 'utf8');
check(/quoteChars\(byOp\('import'\), markdown\.length, tier\)/.test(gd) && /reserved: reservation, cap,/.test(gd), 'the import reserves the quote and charges with its cap');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
