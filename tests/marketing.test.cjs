// Mini-Marketing (functions/src/marketing.js): drafts only from approved log entries, platform limits, polls, the bot token check.
// Run: npm test
const path = require('path');
process.env.TELEGRAM_BOT_TOKEN = 'unset'; // the placeholder the secret holds until the owner creates the bot
const store = new Map();
const snap = (p) => ({ id: p.split('/').pop(), exists: store.has(p), data: () => store.get(p), ref: doc(p) });
function doc(p) {
  const parts = p.split('/');
  return { path: p, id: parts[parts.length - 1], collection: (c) => ({ doc: (id) => doc(p + '/' + c + '/' + id) }),
    get parent() { const up = parts.slice(0, -1).join('/'); return { id: parts[parts.length - 2], get parent() { return doc(parts.slice(0, -2).join('/')); }, path: up }; } };
}
const db = { getAll: async (...refs) => refs.map((r) => snap(r.path)) };
const stub = (rel, exports) => { const f = require.resolve(path.join(__dirname, '../functions/src', rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
stub('common.js', { onRequest: (o, h) => h, admin: { firestore: { FieldValue: { serverTimestamp: () => 'ts' } } }, db, cors: () => {}, charge: () => {}, getBalance: () => ({}), reserve: () => {}, refund: () => {}, getPlanBudget: () => ({}), claudeApiKey: { value: () => '' } });
stub('claude.js', { modelFor: () => ({}), claudeText: () => ({}) });
const { cleanDraft, draftPrompt, approvedEntries, PLATFORMS, botToken, connect, tgCode } = require('../functions/src/marketing.js')._marketing;

let fails = 0;
const check = (got, want, msg) => { if (msg === undefined) { msg = want; want = true; got = !!got; } const ok = got === want; console.log((ok ? 'PASS ' : 'FAIL ') + msg + (ok ? '' : ` (got ${got}, want ${want})`)); if (!ok) fails++; };

(async () => {
  const G = 'worlds/w1/games/g1';
  store.set(G + '/activity/s1/entries/e1', { text: 'Double jump', playerImpact: 'Reach higher ledges', privacy: 'marketing_approved', change: 'added', category: 'mechanic', status: 'completed' });
  store.set(G + '/activity/s1/entries/e2', { text: 'Secret boss twist', privacy: 'spoiler', change: 'added', category: 'character', status: 'completed' });
  store.set(G + '/activity/s2/entries/e3', { text: 'Refactor input', privacy: 'internal', change: 'changed', category: 'tooling', status: 'completed' });
  store.set(G + '/activity/s2/entries/e4', { text: 'New forest level', privacy: 'marketing_approved', change: 'added', category: 'level', status: 'partial' });
  const gref = doc(G);
  const got = await approvedEntries(gref, ['s1:e1', 's1:e2', 's2:e3', 's2:e4', 'bad', 's9:e9']);
  check(got.map((e) => e.ref).join(), 's1:e1,s2:e4', 'only entries marked «Для маркетингу» are used (spoiler, internal, missing and malformed dropped)');
  check((await approvedEntries(gref, 'nope')).length, 0, 'no picks → nothing');

  const pr = draftPrompt({ title: 'MythRunner' }, got, { platform: 'x', poll: false }, { tone: 'epic', hashtags: '#indiedev' }, 'English');
  check(/Double jump/.test(pr.prompt) && /New forest level/.test(pr.prompt) && !/Secret boss/.test(pr.prompt), 'the prompt carries only the approved facts');
  check(/at most 270 characters/.test(pr.prompt) && /TONE: epic/.test(pr.prompt) && /#indiedev/.test(pr.prompt), 'platform limit, tone and hashtags in the prompt');
  check(/never invent/.test(pr.system) && /work in progress/.test(pr.system), 'the system prompt forbids invented features and marks unfinished work');
  check(/"title"/.test(draftPrompt({}, got, { platform: 'reddit' }, {}, 'English').prompt), 'reddit asks for a title');

  const d1 = cleanDraft({ text: 'x'.repeat(5000), title: 'T', poll: { question: 'Q?', options: ['a', 'b'] } }, 'x', true);
  check(d1.text.length <= PLATFORMS.x.limit + 200 && d1.title === undefined && d1.poll === undefined, 'X: text clipped, no title, no poll');
  const d2 = cleanDraft({ text: 'hi', poll: { question: 'Which boss next?', options: ['Wolf', 'Crow', ''] } }, 'telegram', true);
  check(d2.poll && d2.poll.options.join() === 'Wolf,Crow', 'Telegram poll kept with non-empty options');
  check(cleanDraft({ text: 'hi', poll: { question: 'Q', options: ['one'] } }, 'telegram', true).poll, undefined, 'a poll needs two options');
  check(cleanDraft({ text: 'hi', poll: { question: 'Q', options: ['a', 'b'] } }, 'telegram', false).poll, undefined, 'no poll unless asked');
  check(cleanDraft({ title: 'Devlog #3', text: 'body' }, 'reddit', false).title, 'Devlog #3', 'reddit keeps the title');
  check(botToken(), '', 'without a real bot token Telegram counts as not configured');

  // Telegram: the bot being an admin is not enough — the channel description must carry this game's code
  process.env.TELEGRAM_BOT_TOKEN = '123456:' + 'A'.repeat(35);
  let desc = '';
  global.fetch = async (url) => { const m = url.split('/').pop(), r = { getMe: { id: 7, username: 'WhiteWriteServiceBot' },
    getChat: { id: -1001, type: 'channel', title: 'Victim', username: 'victim', description: desc }, getChatMember: { status: 'administrator', can_post_messages: true } }[m];
    return { status: 200, json: async () => ({ ok: true, result: r }) }; };
  const saved = {}, chRef = { collection: () => ({ doc: (id) => ({ set: async (v) => { saved[id] = v; } }) }) };
  let err = null; try { await connect(chRef, 'w1__g1', { platform: 'telegram', chat: '@victim' }); } catch (e) { err = e; }
  check(err && err.status === 409 && err.extra.verifyCode === tgCode('w1__g1', -1001) && !Object.keys(saved).length, 'a channel without the code in its description is not connected (someone else’s channel)');
  check(tgCode('w1__g1', -1001) !== tgCode('w2__g1', -1001) && tgCode('w1__g1', -1001) === tgCode('w1__g1', -1001), 'the code is stable per game + chat and differs between games');
  desc = 'My devlog · ' + tgCode('w2__g9', -1001);
  err = null; try { await connect(chRef, 'w1__g1', { platform: 'telegram', chat: '@victim' }); } catch (e) { err = e; }
  check(err && err.status === 409, "another game's code does not connect this game");
  desc = 'My devlog · ' + tgCode('w1__g1', -1001);
  const ok = await connect(chRef, 'w1__g1', { platform: 'telegram', chat: '@victim' });
  check(ok.channelId === 'tg_m1001' && saved.tg_m1001 && saved.tg_m1001.chatId === -1001, 'with the code in the description the channel connects');
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
  process.exitCode = fails ? 1 : 0;
})();
