// Маркет (MARKETPLACE_SPEC.md): a licensed world is sold by BUYOUT — every right goes to the buyer, the seller loses the world.
// Phase 1 sells TEXT only: the world (canon, lore), its games (cards, plan, tasks, quests, dialogues) and its stories.
// Files (pictures, prefabs, models, the cover) are never part of a sale — they are deleted at the transfer.
//
// Flow:  quote → apply (Worldbuilder, the fee in tokens, the world FROZEN, a text snapshot in Storage + sha256)
//        → licenceReview (Firestore trigger: metrics + AI review + AI lawyer → status `moderation`)
//        → admin decide (approve: a public lot `marketLots/{id}` with the buyout contract; reject: unfreeze)
//        → buyout: NOT built — the payment provider for the Market is not chosen (Stripe was removed on the owner's word:
//          payments go through Lemon Squeezy only, and LS forbids marketplaces); op 'checkout' answers 410.
//
// Server-only (firestore.rules): licenceApplications/{id} (the applicant reads), marketLots/{id} (public when listed,
// the seller reads always), marketDeals/{id} (seller / buyer read). worlds/{w}.freeze —
// only here; while it is set nothing in the world, its games and stories changes (rules + every server writer).
const fs = require('fs');
const path = require('path');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest, admin, db, cors, getBalance, reserve, refund, getPlanBudget, claudeApiKey, MODEL_PRICING, publicMessage } = require('./common');
const { subscriptionActive } = require('../plans.js'); // active or past_due (the LS grace period)
const { activeModels, claudeText } = require('./claude');
const ledger = require('./ledger');
const { LICENCE, licenceFee, USD_PER_TOKEN, byOp } = require('../paid-features.js');
// The Market is announced but not launched (paid-features `licenceReview.soon`): applying is admin-only until then
const MARKET_SOON = () => !!(byOp('licenceReview') || {}).soon;

const ts = () => admin.firestore.FieldValue.serverTimestamp();
const del = () => admin.firestore.FieldValue.delete();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const fail = (status, error, extra) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra || {}) });
const LEVELS = ['concept', 'gdd', 'prototype', 'slice', 'live']; // Концепт → Готовий ГДД → Прототип → Vertical slice → Гра з гравцями
const ACTIVE = ['review', 'moderation', 'approved']; // an application that keeps the world frozen
const legal = (f) => fs.readFileSync(path.join(__dirname, '..', 'legal', f), 'utf8');

// ── The snapshot (src/snapshot.js): what is checked, shown and handed over. Media and secrets never go in. ──
const { buildSnapshot: snapshotOf, clean } = require('./snapshot');
async function buildSnapshot(worldId, uid) {
  const s = await snapshotOf(worldId, uid, 'whitewrite.licence/1');
  if (!s) throw fail(403, 'Світ не знайдено або немає доступу');
  return s;
}

// Automatic metrics (shown to the moderator and, approved, to buyers)
function metrics(snap) {
  const kinds = {};
  snap.entities.forEach((e) => { kinds[e.kind || 'other'] = (kinds[e.kind || 'other'] || 0) + 1; });
  const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
  const filled = (c) => Object.values(c.fields || {}).filter((v) => String(v || '').trim()).length;
  return {
    entities: snap.entities.length, kinds, lore: snap.lore.length,
    laws: (snap.world.laws || []).length || undefined,
    games: snap.games.map((g) => {
      const gates = (g.plan && g.plan.gates) || {};
      return { id: g.id, title: g.title || '', cards: g.cards.length, filledCards: g.cards.filter((c) => filled(c) >= 2).length,
        quests: g.quests.length, dialogues: g.dialogues.length, tasks: g.tasks.length, tasksDone: g.tasks.filter((t) => t.status === 'done').length,
        gatesPassed: Object.keys(gates).filter((k) => gates[k] && (gates[k].accepted || gates[k] === true)).length };
    }),
    stories: snap.stories.map((p) => ({ id: p.id, title: p.title || '', scenes: p.scenes.length,
      words: p.scenes.reduce((n, s) => n + words(s.text || s.content || ''), 0) })),
  };
}

// ── AI review + AI lawyer (one call each, the strongest model; the cost is inside the fee, logged in usage_logs) ──
const parseJson = (t) => { const m = String(t || '').match(/\{[\s\S]*\}/); try { return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } };
const AI_CHARS = 300000; // ≈ 100–150k tokens of mixed uk/en text — what one Opus pass reads; bigger worlds are cut (the moderator reads the rest)
async function aiPass(model, system, prompt) {
  const msg = await claudeText(claudeApiKey.value(), { model, system, prompt, maxTokens: 16000, effort: 'medium', stream: true });
  const p = MODEL_PRICING[msg.model] || MODEL_PRICING[model] || { input: 4, output: 20 };
  const usd = ((msg.usage.input_tokens || 0) * p.input + (msg.usage.output_tokens || 0) * p.output) / 1e6;
  return { out: parseJson(msg.text), usd, model: msg.model };
}
async function runReview(id) {
  const ref = db.collection('licenceApplications').doc(id);
  const a = (await ref.get()).data();
  const [file] = await admin.storage().bucket().file(a.snapshotPath).download();
  const snap = JSON.parse(file.toString('utf8'));
  const m = metrics(snap);
  const text = file.toString('utf8').slice(0, AI_CHARS);
  const cut = file.length > AI_CHARS ? `\n[… the snapshot is cut at ${AI_CHARS} of ${file.length} characters]` : '';
  const model = (await activeModels(db)).opus;
  const review = await aiPass(model, `You review a game-design / worldbuilding project that its author wants to SELL by buyout on the WhiteWrite Market.
The buyer gets the text only: the world canon, lore, games (design cards, production plan, quests, dialogues) and stories. Be fair and concrete;
judge what is written, not promises. Answer in Ukrainian.`, `METRICS: ${JSON.stringify(m)}

THE SNAPSHOT (JSON):
${text}${cut}

Return ONLY JSON:
{ "level": "concept|gdd|prototype|slice|live" (concept = an idea with a few notes; gdd = a complete design a team can build from; prototype = the plan shows a playable greybox; slice = a vertical slice done; live = released with players),
  "score": <0-100 readiness for a buyer>, "summary": "<3-4 sentences for the buyer>",
  "strengths": ["…"], "weaknesses": ["…"], "buyerGets": ["<what exactly the buyer receives, concrete>"],
  "consistency": "<contradictions inside the canon / between canon and games, or «узгоджено»>",
  "similar": ["<known games, books, films or brands it closely resembles, with what is similar; empty if none>"] }
At most 6 items per list.`);
  const lawyer = await aiPass(model, legal('ai-lawyer-prompt.md'), `THE PROJECT FOR SALE: "${a.title}" (kind: world${snap.games.length ? ' + ' + snap.games.length + ' game(s)' : ''}).
PRICE: ${(a.priceCents / 100).toFixed(2)} ${a.currency.toUpperCase()}. THE SELLER'S DECLARATION: «${a.declaration || '—'}»

THE SNAPSHOT (JSON):
${text}${cut}`);
  const usd = review.usd + lawyer.usd;
  await db.collection('usage_logs').add({ uid: a.uid, operation: 'licence_review_ai', licenceId: id, worldId: a.worldId, realApiCostUSD: usd,
    apiTokensEquivalent: Math.ceil(usd / USD_PER_TOKEN), model: review.model, timestamp: ts() }).catch(() => {});
  await ref.update({ status: 'moderation', metrics: m, aiReview: review.out || { error: 'AI не повернув JSON' }, legal: lawyer.out || { error: 'AI не повернув JSON' },
    aiUsd: Math.round(usd * 100) / 100, reviewedAt: ts() });
  await require('./admin-notice').notify({ kind: 'market', severity: 'info', tier: 'market', title: `Заявка на сертифікацію: «${a.title}» чекає модератора`,
    body: `Світ ${a.worldId}, ціна ${(a.priceCents / 100).toFixed(2)} ${a.currency}. Рівень від ШІ: ${(review.out || {}).level || '—'}, ризик від ШІ-юриста: ${(lawyer.out || {}).risk || '—'}. Рішення — Спільнота → Маркет → Модерація.` }).catch(() => {});
}

exports.licenceReview = onDocumentCreated({ document: 'licenceApplications/{id}', region: 'us-central1', secrets: [claudeApiKey], timeoutSeconds: 540, memory: '1GiB' }, async (event) => {
  const id = event.params.id;
  try { await runReview(id); } catch (e) {
    console.error('[market] review failed', id, e);
    await db.collection('licenceApplications').doc(id).update({ status: 'moderation', aiError: str(e.message, 300), reviewedAt: ts() }).catch(() => {});
  }
});

// ── The buyout contract: the template (functions/legal/buyout-contract.uk.md) filled for this lot / deal ──
function contractFor(a, extra) {
  const v = Object.assign({ LICENCE_ID: a.id, WORLD_TITLE: a.title, SELLER_NAME: a.sellerName || a.uid, SNAPSHOT_HASH: a.snapshotHash,
    PRICE: (a.priceCents / 100).toFixed(2), CURRENCY: String(a.currency).toUpperCase(), LEVEL: a.level || '—',
    CONTENTS: contentsLine(a.metrics), SPECIAL_TERMS: ((a.legal && a.legal.specialTerms) || []).map((t) => '- ' + t).join('\n') || '- Немає.',
    BUYER_NAME: '[імʼя покупця — заповнюється при оплаті]', DATE: '[дата оплати]' }, extra || {});
  return legal('buyout-contract.uk.md').replace(/\{\{([A-Z_]+)\}\}/g, (all, k) => (v[k] != null ? String(v[k]) : all));
}
function contentsLine(m) {
  if (!m) return '—';
  return [`сутностей канону: ${m.entities}`, `записів культури: ${m.lore}`]
    .concat(m.games.map((g) => `гра «${g.title}»: карток ${g.cards}, квестів ${g.quests}, діалогів ${g.dialogues}, задач плану ${g.tasks}`))
    .concat(m.stories.map((s) => `історія «${s.title}»: сцен ${s.scenes}, слів ≈ ${s.words}`)).join('; ');
}

async function authed(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw fail(401, 'Потрібна автентифікація');
  try { return await admin.auth().verifyIdToken(h.slice(7)); } catch (e) { throw fail(401, 'Невірний токен автентифікації'); }
}
const appView = (d) => { const a = d.data(); return Object.assign({ id: d.id }, a, { createdAt: a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : null,
  reviewedAt: a.reviewedAt && a.reviewedAt.toMillis ? a.reviewedAt.toMillis() : null, decidedAt: a.decidedAt && a.decidedAt.toMillis ? a.decidedAt.toMillis() : null }); };

async function handle(op, b, tok) {
  const uid = tok.uid, isAdmin = tok.admin === true;
  if (MARKET_SOON() && !isAdmin && op === 'apply') throw fail(503, 'Маркет ще в розробці — продаж і купівля відкриються після запуску', { code: 'SOON' });

  if (op === 'quote') { // the fee for this world, before anything is frozen
    const worldId = str(b.worldId, 120);
    const { chars, snap } = await buildSnapshot(worldId, uid);
    const fee = licenceFee(chars);
    return { chars, fee, tooLarge: fee == null, maxChars: LICENCE.maxChars, minUsd: LICENCE.minUsd, maxUsd: LICENCE.maxUsd, platformFee: LICENCE.platformFee,
      metrics: metrics(snap) };
  }

  if (op === 'apply') {
    const worldId = str(b.worldId, 120), title = str(b.title, 140), pitch = str(b.pitch, 3000), declaration = str(b.declaration, 2000);
    const usd = Math.round(Number(b.priceUsd) * 100) / 100;
    if (b.agree !== true) throw fail(400, 'Потрібна згода з правилами Маркету й договором продавця');
    if (!title || !pitch) throw fail(400, 'Потрібні назва й опис для покупця');
    if (!(usd >= LICENCE.minUsd && usd <= LICENCE.maxUsd)) throw fail(400, `Ціна викупу — від $${LICENCE.minUsd} до $${LICENCE.maxUsd}`);
    const userRef = db.collection('users').doc(uid), wref = db.collection('worlds').doc(worldId);
    const [u, w] = await Promise.all([userRef.get(), wref.get()]);
    const userData = u.exists ? u.data() : {};
    if (!w.exists || w.data().owner !== uid) throw fail(403, 'Світ не знайдено або немає доступу');
    if (w.data().freeze) throw fail(409, 'Світ уже на перевірці або в продажу');
    if (!getPlanBudget(userData.plan || 'free').allowGameDev) throw fail(403, 'Заявку на сертифікацію подає лише Worldbuilder', { code: 'PLAN_REQUIRED' });
    if (!subscriptionActive(userData)) throw fail(403, 'Активна підписка необхідна', { requiresSubscription: true });
    const s = await buildSnapshot(worldId, uid);
    const fee = licenceFee(s.chars);
    if (fee == null) throw fail(413, `Світ завеликий для одного продажу (${s.chars.toLocaleString()} з ${LICENCE.maxChars.toLocaleString()} символів)`);
    const balance = getBalance(userData);
    if (balance.available < fee) throw fail(403, 'Недостатньо токенів', { tokensRemaining: balance.available, tokensNeeded: fee, code: 'OUT_OF_TOKENS' });
    let reservation;
    try { reservation = await reserve(db, uid, fee); } catch (e) {
      if (e.code !== 'OUT_OF_TOKENS') throw e;
      throw fail(403, 'Недостатньо токенів', { tokensRemaining: e.available, tokensNeeded: fee, code: 'OUT_OF_TOKENS' });
    }
    const ref = db.collection('licenceApplications').doc();
    try {
      const snapshotPath = `licences/${ref.id}/snapshot.json`;
      await admin.storage().bucket().file(snapshotPath).save(s.json, { contentType: 'application/json; charset=utf-8', resumable: false });
      const frozen = await db.runTransaction(async (tx) => { // freeze only if nobody froze it meanwhile
        const cur = await tx.get(wref);
        if (cur.data().freeze) return false;
        tx.update(wref, { freeze: { reason: 'licence', applicationId: ref.id, since: ts() } });
        return true;
      });
      if (!frozen) throw fail(409, 'Світ уже на перевірці або в продажу');
      await ref.set({ uid, sellerName: str(userData.name || tok.name || '', 120), worldId, kind: 'world', title, pitch, declaration,
        priceCents: Math.round(usd * 100), currency: 'usd', status: 'review', chars: s.chars, tokens: fee, snapshotPath, snapshotHash: s.hash, createdAt: ts() });
      ledger.record(db, uid, { type: 'spend', op: 'licence_review', amount: -fee, balance: reservation.available, ref: { worldId, licenceId: ref.id } });
      await db.collection('usage_logs').add({ uid, operation: 'licence_review', worldId, licenceId: ref.id, userTokensCharged: fee, realApiCostUSD: 0, timestamp: ts() }).catch(() => {});
      reservation = null;
      return { applicationId: ref.id, tokensConsumed: fee, tokensRemaining: Math.max(0, balance.available - fee), snapshotHash: s.hash };
    } finally {
      if (reservation) await refund(db, uid, reservation).catch((e) => console.error('[market] refund failed:', e));
    }
  }

  if (op === 'status') { // this world's latest application + lot
    const worldId = str(b.worldId, 120);
    const q = await db.collection('licenceApplications').where('uid', '==', uid).where('worldId', '==', worldId).get();
    const apps = q.docs.map(appView).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
    const last = apps[0] || null;
    const lot = last && last.status === 'approved' ? (await db.collection('marketLots').doc(last.id).get()).data() || null : null;
    return { application: last, lot, history: apps.slice(1, 6).map((a) => ({ id: a.id, status: a.status, createdAt: a.createdAt })) };
  }

  if (op === 'withdraw') { // the author unfreezes: the licence is void, the fee is not returned (the work is done)
    const ref = db.collection('licenceApplications').doc(str(b.applicationId, 60));
    const d = await ref.get();
    if (!d.exists || (d.data().uid !== uid && !isAdmin)) throw fail(404, 'Заявку не знайдено');
    const a = d.data();
    if (!ACTIVE.includes(a.status)) throw fail(409, 'Заявка вже закрита');
    const lotRef = db.collection('marketLots').doc(d.id), lot = await lotRef.get();
    if (lot.exists) await lotRef.update({ status: 'withdrawn', updatedAt: ts() });
    await ref.update({ status: 'withdrawn', decidedAt: ts() });
    await db.collection('worlds').doc(a.worldId).update({ freeze: del() });
    return { withdrawn: true };
  }

  // the buyout needs a payment provider with a marketplace mode — not chosen yet (the Lot page's «Купити» still calls this)
  if (op === 'checkout') throw fail(410, 'Викуп світу ще в розробці: платіжного провайдера для Маркету не обрано', { code: 'SOON' });

  if (op === 'deals') { // my purchases and sales (the contract text is in each)
    const [a, c] = await Promise.all([db.collection('marketDeals').where('buyer', '==', uid).get(), db.collection('marketDeals').where('seller', '==', uid).get()]);
    return { deals: a.docs.concat(c.docs).map((d) => Object.assign({ id: d.id }, d.data(), { at: d.data().at && d.data().at.toMillis ? d.data().at.toMillis() : null })) };
  }

  // ── Admin: the moderation queue ──
  if (!isAdmin) throw fail(403, 'Admin only');
  if (op === 'queue') {
    const q = await db.collection('licenceApplications').where('status', 'in', ['review', 'moderation']).get();
    return { applications: q.docs.map(appView).sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0)) };
  }
  if (op === 'decide') {
    const ref = db.collection('licenceApplications').doc(str(b.applicationId, 60));
    const d = await ref.get();
    if (!d.exists || !['review', 'moderation'].includes(d.data().status)) throw fail(409, 'Заявка не чекає рішення');
    const a = Object.assign({ id: d.id }, d.data());
    const note = str(b.note, 3000);
    if (b.approve !== true) {
      await ref.update({ status: 'rejected', moderator: { uid, note, at: Date.now() }, decidedAt: ts() });
      await db.collection('worlds').doc(a.worldId).update({ freeze: del() });
      return { rejected: true };
    }
    const level = LEVELS.includes(b.level) ? b.level : (LEVELS.includes((a.aiReview || {}).level) ? a.aiReview.level : 'concept');
    a.level = level;
    const r = a.aiReview || {};
    await db.collection('marketLots').doc(a.id).set({ status: 'listed', seller: a.uid, sellerName: a.sellerName || '', worldId: a.worldId, kind: a.kind,
      title: a.title, pitch: a.pitch, priceCents: a.priceCents, currency: a.currency, level, snapshotHash: a.snapshotHash, chars: a.chars,
      report: { summary: r.summary || '', strengths: r.strengths || [], weaknesses: r.weaknesses || [], buyerGets: r.buyerGets || [], score: r.score || null, note },
      metrics: a.metrics || null, contract: contractFor(a), licensedAt: ts(), updatedAt: ts() });
    await ref.update({ status: 'approved', level, moderator: { uid, note, at: Date.now() }, decidedAt: ts() });
    await db.collection('worlds').doc(a.worldId).update({ 'freeze.reason': 'listed' });
    return { approved: true, lotId: a.id };
  }
  if (op === 'unlist') { // a takedown (rules, a complaint): the world unfreezes, the licence is void
    const lotRef = db.collection('marketLots').doc(str(b.lotId, 60)), l = await lotRef.get();
    if (!l.exists || l.data().status !== 'listed') throw fail(404, 'Лот не знайдено');
    await lotRef.update({ status: 'removed', removedNote: str(b.note, 1000), updatedAt: ts() });
    await db.collection('licenceApplications').doc(l.id).update({ status: 'withdrawn', decidedAt: ts() });
    await db.collection('worlds').doc(l.data().worldId).update({ freeze: del() });
    return { removed: true };
  }
  throw fail(400, 'Unknown op');
}

exports.market = onRequest({ region: 'us-central1', timeoutSeconds: 300, memory: '1GiB' }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const tok = await authed(req);
      const b = req.body || {};
      return res.status(200).json(Object.assign({ success: true }, await handle(str(b.op, 30), b, tok)));
    } catch (e) {
      if (e.status) return res.status(e.status).json(e.body || { error: e.message });
      console.error('market error:', e);
      return res.status(500).json({ error: `Помилка Маркету: ${publicMessage(e)}` });
    }
  });
});

exports._market = { clean, metrics, contractFor, contentsLine, LEVELS }; // tests only
