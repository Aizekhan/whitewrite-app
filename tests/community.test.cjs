// Community (functions/src/community.js): links and pictures from showcases are shown to every visitor inside
// HTML attributes and CSS url('…') — nothing that can leave them gets stored. Run: npm test
const path = require('path');
const stub = (rel, exp) => { const f = require.resolve(path.join(__dirname, '../functions/src', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports: exp }; };
stub('common.js', { onRequest: () => () => {}, admin: { firestore: { FieldValue: {} } }, db: {}, cors: () => {} });
const { okImg, okRelease, okDiscord, cleanItem } = require('../functions/src/community.js')._community;

let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) fails++; };
const S = 'https://firebasestorage.googleapis.com/v0/b/whitewrite-app.appspot.com/o/';

check(okImg(S + 'worlds%2Fw1%2Fcover%2Fa%20(1).png?alt=media&token=abc'), 'a Storage download URL (with brackets from the file name) is a picture');
check(okImg(S + "dragon's%20lair.png?alt=media"), 'an apostrophe from the file name is allowed (the page %-encodes it)');
check(!okImg(S + 'x.png"onmouseover="alert(1)'), 'a double quote (attribute break-out) is refused');
check(!okImg(S + 'x.png onerror=alert(1)'), 'whitespace is refused');
check(!okImg(S + 'x<script>'), 'angle brackets are refused');
check(!okImg('https://evil.example/x.png'), 'another host is refused');
check(okRelease({ kind: 'steam', url: 'https://store.steampowered.com/app/123/My_Game/' }), 'a store link is a release');
check(!okRelease({ kind: 'itch', url: 'https://x.itch.io/g"onmouseover="alert(1)' }), 'a release link with a double quote is refused');
check(!okRelease({ kind: 'web', url: 'javascript:alert(1)' }), 'a javascript: release link is refused');
check(!okDiscord('https://discord.gg/abc"x'), 'a Discord invite with a quote is refused');
const it = cleanItem({ sec: 's1', title: 't', imgs: [S + 'ok.png', S + 'bad"x.png'] }, ['s1']);
check(it.imgs.length === 1, 'showcase item pictures keep only safe URLs');

// ♥ with ageing kept incrementally (heat): the same score as summing every like's ½-per-30-days weight
const H = require('../functions/src/community.js')._heat, DAY = 86400000, now = Date.UTC(2027, 5, 1);
const likesAt = [now - 30 * DAY, now - 60 * DAY, now - 2 * DAY, now];
const sum = likesAt.reduce((s, at) => s + Math.pow(0.5, (now - at) / (30 * DAY)), 0);
const heat = likesAt.reduce((s, at) => s + H.heatOf(at), 0);
check(Math.abs(H.scoreAt(heat, now) - sum) < 1e-9, 'heat → score equals the sum of aged likes');
check(Math.abs(H.scoreAt(H.heatOf(now - 30 * DAY), now) - 0.5) < 1e-12, 'a like 30 days old counts ½');
check(Math.abs(H.scoreAt(heat - H.heatOf(likesAt[2]), now) - (sum - Math.pow(0.5, 2 / 30))) < 1e-9, 'an unlike takes off exactly its own weight');
check(isFinite(H.heatOf(Date.UTC(2036, 0, 1))), 'heat stays finite for years (2^(t/30 d))');

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;
