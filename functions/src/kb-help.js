// «Запитай Базу знань» — the helper on the Knowledge base page (paid-features kbHelper: any plan, free for the author,
// perDay questions a day). It only answers from the Knowledge base: no tools, no actions, one Claude call per question.
// The base is the live app/kb.js (fetched from the site, run with a stub window, cached per instance for an hour), all its
// articles in the asker's language go into a cached system prompt on the Haiku tier; the answer ends with the ids of the
// articles it used — the page links them. We pay the API (logged in usage_logs as kb_help, 0 tokens charged).
// POST { question, history?: [{ q, a }], language } with the ID token → { answer, articles: [{ id, title }], left }
const vm = require('vm');
const Anthropic = require('@anthropic-ai/sdk');
const { onRequest, admin, db, cors, claudeApiKey } = require('./common');
const { activeModels, withFallback } = require('./claude');
const { MODEL_PRICING } = require('../ai-models.js');
const { byOp } = require('../paid-features.js');

const KB_URL = 'https://whitewrite.com/kb.js';
const KB_TTL = 60 * 60 * 1000;
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
let kbCache = {}, kbAt = 0;

// kb.js → { uk: [articles], en: [articles] } (the same file the page shows)
function readKb(code) {
  const out = {};
  ['uk', 'en'].forEach((lang) => {
    const window = { addEventListener() {}, __i18n: { getLanguage: () => lang } };
    vm.runInNewContext(code, { window }, { timeout: 2000 });
    out[lang] = (window.WW_KB && window.WW_KB.articles) || [];
  });
  return out;
}
async function kbArticles(lang) {
  if (!kbCache[lang] || Date.now() - kbAt > KB_TTL) {
    const r = await fetch(KB_URL);
    if (!r.ok) throw new Error('Knowledge base unavailable: HTTP ' + r.status);
    kbCache = readKb(await r.text()); kbAt = Date.now();
  }
  return kbCache[lang] || [];
}

const plain = (x) => (x == null ? '' : Array.isArray(x) ? x.map(plain).join('\n') : String(x).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'));
function kbText(articles) {
  return articles.map((a) => `[${a.id}] ${a.title}\n${plain(a.lead)}\n` +
    (a.body || []).map((b) => (Array.isArray(b) && b[0] !== 'plans' && b[0] !== 'prices' ? (b[0] === 'ul' ? plain(b[1]).split('\n').map((l) => '- ' + l).join('\n') : plain(b[1])) : '')).filter(Boolean).join('\n')).join('\n\n');
}
function systemText(lang, articles) {
  const en = lang === 'en';
  return `You are the help desk of WhiteWrite — a service where authors keep the canon of their fictional worlds (the World Bible), write books and design games on that canon, and connect Claude Code to build the game in Unity.
You answer ONLY questions about WhiteWrite, and ONLY from the KNOWLEDGE BASE below. If the base does not answer the question, say so in one sentence and suggest the closest article; never guess buttons, prices, plans or steps. A question not about WhiteWrite — politely say you only help with WhiteWrite. You perform no actions and have no tools.
Answer in ${en ? 'English' : 'Ukrainian'}, briefly (a few sentences or a short list of steps), with the exact names of buttons and sections as the base writes them. Plans and prices are not in the base text — for them point to the article «${en ? 'Plans' : 'Тарифи'}».
On the LAST line write the ids of the articles you used, exactly like: ARTICLES: id-one, id-two (at most 3; nothing else on that line).

KNOWLEDGE BASE:
${kbText(articles)}`;
}

function today() { return new Date().toISOString().slice(0, 10); }

exports.kbAsk = onRequest({ region: 'us-central1', secrets: [claudeApiKey], timeoutSeconds: 60, memory: '512MiB' }, async (req, res) => {
  return cors(req, res, async () => {
    let counted = null;
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Увійди, щоб питати', code: 'AUTH' });
      let uid;
      try { uid = (await admin.auth().verifyIdToken(auth.slice(7))).uid; } catch (e) { return res.status(401).json({ error: 'Невірний токен автентифікації' }); }
      const body = req.body || {};
      const question = str(body.question, 1000);
      if (!question) return res.status(400).json({ error: 'Порожнє питання' });
      const lang = body.language === 'en' ? 'en' : 'uk';
      const history = (Array.isArray(body.history) ? body.history : []).slice(-3).map((h) => ({ q: str(h && h.q, 1000), a: str(h && h.a, 2000) })).filter((h) => h.q && h.a);

      // the daily limit (registry kbHelper.limit.perDay), counted before the call
      const perDay = byOp('kbHelper').limit.perDay, ref = db.collection('kbHelp').doc(uid), day = today();
      const left = await db.runTransaction(async (tx) => {
        const d = (await tx.get(ref)).data() || {};
        const n = d.day === day ? d.n || 0 : 0;
        if (n >= perDay) return -1;
        tx.set(ref, { day, n: n + 1, at: admin.firestore.FieldValue.serverTimestamp() });
        return perDay - n - 1;
      });
      if (left < 0) return res.status(429).json({ error: lang === 'en' ? `That's ${perDay} questions today — the limit renews tomorrow.` : `Сьогодні вже ${perDay} питань — ліміт оновиться завтра.`, code: 'LIMIT' });

      counted = ref;
      const articles = await kbArticles(lang);
      const model = (await activeModels(db)).haiku;
      const messages = [];
      history.forEach((h) => { messages.push({ role: 'user', content: h.q }); messages.push({ role: 'assistant', content: h.a }); });
      messages.push({ role: 'user', content: question });
      const anthropic = new Anthropic({ apiKey: claudeApiKey.value() });
      const msg = await withFallback(model, (m) => anthropic.messages.create({ model: m, max_tokens: 1500, output_config: { effort: 'low' },
        system: [{ type: 'text', text: systemText(lang, articles), cache_control: { type: 'ephemeral' } }], messages }));
      if (msg.stop_reason === 'refusal') return res.status(200).json({ success: true, answer: lang === 'en' ? 'I can only help with WhiteWrite.' : 'Я допомагаю лише з WhiteWrite.', articles: [], left });
      let text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      const m = text.match(/\n?\s*ARTICLES:\s*(.*)\s*$/i);
      const ids = m ? m[1].split(/[,\s]+/).map((x) => x.replace(/[\[\]]/g, '').trim()).filter(Boolean) : [];
      if (m) text = text.slice(0, m.index).trim();
      const used = ids.map((id) => articles.find((a) => a.id === id)).filter(Boolean).slice(0, 3).map((a) => ({ id: a.id, title: a.title }));

      // we pay it: the real API cost goes to usage_logs (the daily cost watch sees it), nothing is charged
      const u = msg.usage || {}, p = MODEL_PRICING[msg.model] || MODEL_PRICING[model] || {};
      const usd = ((u.input_tokens || 0) * (p.input || 0) + (u.output_tokens || 0) * (p.output || 0) + (u.cache_creation_input_tokens || 0) * (p.cacheWrite || p.input || 0) +
        (u.cache_read_input_tokens || 0) * (p.cacheRead || p.input || 0)) / 1e6;
      db.collection('usage_logs').add({ uid, operation: 'kb_help', model: msg.model || model, timestamp: admin.firestore.FieldValue.serverTimestamp(), billing: 'free',
        userTokensCharged: 0, userPaidUSD: 0, inputTokens: u.input_tokens || 0, outputTokens: u.output_tokens || 0, cacheCreationTokens: u.cache_creation_input_tokens || 0,
        cacheReadTokens: u.cache_read_input_tokens || 0, realApiCostUSD: Math.round(usd * 1e4) / 1e4, rawUsage: u }).catch((e) => console.error('[kb-help] log:', e.message));
      return res.status(200).json({ success: true, answer: text, articles: used, left });
    } catch (error) {
      console.error('kbAsk error:', error);
      if (counted) await counted.update({ n: admin.firestore.FieldValue.increment(-1) }).catch(() => {}); // a failed answer is not counted
      return res.status(500).json({ error: `Помилка: ${error.message}` });
    }
  });
});

exports._kbHelp = { readKb, kbText, systemText };
