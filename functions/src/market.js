// Маркет (MARKETPLACE_SPEC.md): a licensed world is sold by BUYOUT — every right goes to the buyer, the seller loses the world.
// Phase 1 sells TEXT only: the world (canon, lore), its games (cards, plan, tasks, quests, dialogues) and its stories.
// Files (pictures, prefabs, models, the cover) are never part of a sale — they are deleted at the transfer.
//
// Flow:  quote → apply (Worldbuilder, the fee in tokens, the world FROZEN, a text snapshot in Storage + sha256)
//        → licenceReview (Firestore trigger: metrics + AI review + AI lawyer → status `moderation`)
//        → admin decide (approve: a public lot `marketLots/{id}` with the buyout contract; reject: unfreeze)
//        → checkout (Stripe Connect, the seller's Standard account, DIRECT charge, application_fee 12%)
//        → marketWebhook checkout.session.completed → marketDeals/{id} + transferWorld(): owner → buyer.
// The seller is the seller of record (refunds, chargebacks, taxes — on their Stripe account); WhiteWrite is the venue.
//
// Server-only (firestore.rules): licenceApplications/{id} (the applicant reads), marketLots/{id} (public when listed,
// the seller reads always), marketDeals/{id} (seller / buyer read), sellers/{uid} (owner reads). worlds/{w}.freeze —
// only here; while it is set nothing in the world, its games and stories changes (rules + every server writer).
const fs = require('fs');
const path = require('path');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { onRequest, admin, db, cors, getBalance, reserve, refund, getPlanBudget, claudeApiKey, stripeSecretKey, MODEL_PRICING } = require('./common');
const { activeModels, claudeText } = require('./claude');
const ledger = require('./ledger');
const { LICENCE, licenceFee, USD_PER_TOKEN, byOp } = require('../paid-features.js');
// The Market is announced but not launched (paid-features `licenceReview.soon`): applying, Stripe onboarding and buying are admin-only until then
const MARKET_SOON = () => !!(byOp('licenceReview') || {}).soon;

const stripeConnectWebhookSecret = defineSecret('STRIPE_CONNECT_WEBHOOK_SECRET');
const SITE = 'https://whitewrite.com';
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const del = () => admin.firestore.FieldValue.delete();
const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const fail = (status, error, extra) => Object.assign(new Error(error), { status, body: Object.assign({ error }, extra || {}) });
const LEVELS = ['concept', 'gdd', 'prototype', 'slice', 'live']; // Концепт → Готовий ГДД → Прототип → Vertical slice → Гра з гравцями
const ACTIVE = ['review', 'moderation', 'approved']; // an application that keeps the world frozen
const RESERVE_MS = 31 * 60 * 1000; // a lot is held for the buyer while their Stripe Checkout is open (Stripe's minimum expiry is 30 min)
const legal = (f) => fs.readFileSync(path.join(__dirname, '..', 'legal', f), 'utf8');

// ── The snapshot (src/snapshot.js): what is checked, shown and handed over. Media and secrets never go in. ──
const { buildSnapshot: snapshotOf, clean, GAME_SUBS: SOLD_GAME_SUBS, WORLD_SUBS: SOLD_WORLD_SUBS } = require('./snapshot');
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
  await require('./admin-notice').notify({ kind: 'market', severity: 'info', tier: 'market', title: `Заявка на ліцензію: «${a.title}» чекає модератора`,
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

// ── The transfer after payment: the buyer owns the world, its games and its stories; files, keys and showcases are gone ──
async function recursiveDeleteExcept(ref, keep) {
  for (const c of await ref.listCollections()) if (!keep.includes(c.id)) await db.recursiveDelete(c);
}
async function transferWorld(worldId, seller, buyer, licence) {
  const wref = db.collection('worlds').doc(worldId);
  await admin.storage().bucket().deleteFiles({ prefix: `worlds/${worldId}/` }).catch((e) => console.warn('[market] files:', e.message));
  const bw = db.bulkWriter();
  (await wref.collection('entities').get()).docs.forEach((d) => { if (d.data().files) bw.update(d.ref, { files: del() }); });
  await recursiveDeleteExcept(wref, SOLD_WORLD_SUBS);
  for (const g of (await wref.collection('games').get()).docs) {
    bw.update(g.ref, { repo: del(), launch: del(), canonOptIn: g.data().canonOptIn || null });
    (await g.ref.collection('cards').get()).docs.forEach((c) => { if (c.data().files || c.data().styleAi) bw.update(c.ref, { files: del(), styleAi: del() }); });
    await recursiveDeleteExcept(g.ref, SOLD_GAME_SUBS);
  }
  (await db.collection('projects').where('worldId', '==', worldId).get()).docs.forEach((p) => {
    if (p.data().owner === seller) bw.update(p.ref, { owner: buyer, cover: del(), boughtAt: ts() });
  });
  const byWorld = async (col) => (await db.collection(col).where('worldId', '==', worldId).get()).docs.forEach((d) => bw.delete(d.ref));
  const byPrefix = async (col) => (await db.collection(col).where(admin.firestore.FieldPath.documentId(), '>=', worldId + '__')
    .where(admin.firestore.FieldPath.documentId(), '<', worldId + '__~').get()).docs.forEach((d) => bw.delete(d.ref));
  await Promise.all([byWorld('mcpKeys'), byWorld('ingestKeys'), byPrefix('repoTokens'), byPrefix('marketingSecrets'), byPrefix('marketingQueue')]);
  await bw.close();
  for (const c of (await db.collection('community').where('worldId', '==', worldId).get()).docs) await db.recursiveDelete(c.ref);
  await db.collection('backupTokens').doc(worldId).delete().catch(() => {});
  await wref.update({ team: del(), teamUids: [], backup: del(), owner: buyer, freeze: del(), cover: del(), titleArt: del(), cosmograph: del(), boughtAt: ts(), boughtFrom: seller, licence });
}

// ── Stripe Connect (Standard accounts; the seller owns the account and its obligations) ──
const stripeClient = () => require('stripe')(stripeSecretKey.value());
async function sellerState(uid) {
  const s = await db.collection('sellers').doc(uid).get();
  return s.exists ? s.data() : null;
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
  if (MARKET_SOON() && !isAdmin && ['apply', 'connect', 'checkout'].indexOf(op) >= 0) throw fail(503, 'Маркет ще в розробці — продаж і купівля відкриються після запуску', { code: 'SOON' });

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
    if (!getPlanBudget(userData.plan || 'free').allowGameDev) throw fail(403, 'Заявку на ліцензію подає лише Worldbuilder', { code: 'PLAN_REQUIRED' });
    if (userData.subscriptionStatus !== 'active') throw fail(403, 'Активна підписка необхідна', { requiresSubscription: true });
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

  if (op === 'status') { // this world's latest application + lot + the seller's Stripe state
    const worldId = str(b.worldId, 120);
    const q = await db.collection('licenceApplications').where('uid', '==', uid).where('worldId', '==', worldId).get();
    const apps = q.docs.map(appView).sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
    const last = apps[0] || null;
    const lot = last && last.status === 'approved' ? (await db.collection('marketLots').doc(last.id).get()).data() || null : null;
    return { application: last, lot, seller: await sellerState(uid), history: apps.slice(1, 6).map((a) => ({ id: a.id, status: a.status, createdAt: a.createdAt })) };
  }

  if (op === 'withdraw') { // the author unfreezes: the licence is void, the fee is not returned (the work is done)
    const ref = db.collection('licenceApplications').doc(str(b.applicationId, 60));
    const d = await ref.get();
    if (!d.exists || (d.data().uid !== uid && !isAdmin)) throw fail(404, 'Заявку не знайдено');
    const a = d.data();
    if (!ACTIVE.includes(a.status)) throw fail(409, 'Заявка вже закрита');
    const lotRef = db.collection('marketLots').doc(d.id), lot = await lotRef.get();
    if (lot.exists && lot.data().reservedUntil && lot.data().reservedUntil.toMillis() > Date.now()) throw fail(409, 'Саме зараз покупець оплачує — спробуй за пів години');
    if (lot.exists) await lotRef.update({ status: 'withdrawn', updatedAt: ts() });
    await ref.update({ status: 'withdrawn', decidedAt: ts() });
    await db.collection('worlds').doc(a.worldId).update({ freeze: del() });
    return { withdrawn: true };
  }

  if (op === 'connect') { // Stripe Connect onboarding (Standard): the seller's own Stripe account
    const stripe = stripeClient(), sref = db.collection('sellers').doc(uid);
    let s = await sellerState(uid);
    if (!s || !s.stripeAccountId) {
      const acct = await stripe.accounts.create({ type: 'standard', email: tok.email || undefined, metadata: { uid } });
      s = { stripeAccountId: acct.id, chargesEnabled: false, payoutsEnabled: false, createdAt: ts() };
      await sref.set(s, { merge: true });
    }
    const back = SITE + '/White.html?market=' + encodeURIComponent(str(b.worldId, 120) || 'connected');
    const link = await stripe.accountLinks.create({ account: s.stripeAccountId, refresh_url: back, return_url: back, type: 'account_onboarding' });
    return { url: link.url };
  }

  if (op === 'connectStatus') {
    const s = await sellerState(uid);
    if (!s || !s.stripeAccountId) return { seller: null };
    const acct = await stripeClient().accounts.retrieve(s.stripeAccountId);
    const upd = { chargesEnabled: !!acct.charges_enabled, payoutsEnabled: !!acct.payouts_enabled, detailsSubmitted: !!acct.details_submitted, updatedAt: ts() };
    await db.collection('sellers').doc(uid).set(upd, { merge: true });
    return { seller: Object.assign({}, s, upd) };
  }

  if (op === 'checkout') { // the buyer pays the seller directly; Stripe keeps 12% for WhiteWrite
    const lotRef = db.collection('marketLots').doc(str(b.lotId, 60));
    if (b.agree !== true) throw fail(400, 'Потрібна згода з договором викупу');
    const held = await db.runTransaction(async (tx) => {
      const l = await tx.get(lotRef);
      if (!l.exists || l.data().status !== 'listed') throw fail(404, 'Лот не знайдено або вже продано');
      const lot = l.data();
      if (lot.seller === uid) throw fail(400, 'Свій лот не купити');
      if (lot.reservedUntil && lot.reservedUntil.toMillis() > Date.now() && lot.reservedBy !== uid) throw fail(409, 'Хтось саме оплачує цей лот — спробуй за пів години');
      tx.update(lotRef, { reservedBy: uid, reservedUntil: admin.firestore.Timestamp.fromMillis(Date.now() + RESERVE_MS) });
      return lot;
    });
    const s = await sellerState(held.seller);
    if (!s || !s.stripeAccountId || !s.chargesEnabled) { await lotRef.update({ reservedBy: del(), reservedUntil: del() }); throw fail(409, 'Продавець ще не підключив виплати Stripe'); }
    const fee = Math.round(held.priceCents * LICENCE.platformFee);
    const session = await stripeClient().checkout.sessions.create({
      mode: 'payment', customer_email: tok.email || undefined, client_reference_id: uid,
      line_items: [{ quantity: 1, price_data: { currency: held.currency, unit_amount: held.priceCents,
        product_data: { name: `Викуп світу «${held.title}» (WhiteWrite Market)`, description: `Ліцензія ${lotRef.id} · знімок sha256 ${held.snapshotHash.slice(0, 16)}…` } } }],
      payment_intent_data: { application_fee_amount: fee, metadata: { lotId: lotRef.id, buyer: uid, seller: held.seller } },
      metadata: { lotId: lotRef.id, buyer: uid, seller: held.seller, kind: 'ww_market' },
      expires_at: Math.floor((Date.now() + RESERVE_MS - 60000) / 1000),
      success_url: SITE + '/White.html?market=bought&lot=' + lotRef.id, cancel_url: SITE + '/White.html?market=lot&lot=' + lotRef.id,
    }, { stripeAccount: s.stripeAccountId });
    return { url: session.url };
  }

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

exports.market = onRequest({ region: 'us-central1', secrets: [stripeSecretKey], timeoutSeconds: 300, memory: '1GiB' }, async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const tok = await authed(req);
      const b = req.body || {};
      return res.status(200).json(Object.assign({ success: true }, await handle(str(b.op, 30), b, tok)));
    } catch (e) {
      if (e.status) return res.status(e.status).json(e.body || { error: e.message });
      console.error('market error:', e);
      return res.status(500).json({ error: `Помилка Маркету: ${e.message}` });
    }
  });
});

// ── Stripe Connect webhook (events from the sellers' accounts: event.account) ──
async function completeDeal(session, account) {
  const lotId = session.metadata && session.metadata.lotId, buyer = session.metadata && session.metadata.buyer;
  if (!lotId || !buyer) return;
  const dealRef = db.collection('marketDeals').doc(session.id), lotRef = db.collection('marketLots').doc(lotId);
  const outcome = await db.runTransaction(async (tx) => {
    const [deal, l] = await Promise.all([tx.get(dealRef), tx.get(lotRef)]);
    if (deal.exists) return 'done'; // a retried delivery
    const lot = l.exists ? l.data() : null;
    const sel = lot && (await tx.get(db.collection('sellers').doc(lot.seller))).data();
    const ok = lot && lot.status === 'listed' && sel && sel.stripeAccountId === account && session.amount_total === lot.priceCents && session.payment_status === 'paid';
    if (!ok) { tx.set(dealRef, { lotId, buyer, status: 'refund', reason: 'lot not available or amount mismatch', stripe: { account, session: session.id, paymentIntent: session.payment_intent }, at: ts() }); return 'refund'; }
    tx.update(lotRef, { status: 'sold', buyer, soldAt: ts(), reservedBy: del(), reservedUntil: del() });
    tx.update(db.collection('licenceApplications').doc(lotId), { status: 'sold' });
    tx.set(dealRef, { lotId, worldId: lot.worldId, title: lot.title, seller: lot.seller, buyer, amount: session.amount_total, currency: session.currency,
      fee: Math.round(lot.priceCents * LICENCE.platformFee), snapshotHash: lot.snapshotHash, snapshotPath: `licences/${lotId}/snapshot.json`,
      stripe: { account, session: session.id, paymentIntent: session.payment_intent }, status: 'transferring', at: ts() });
    return 'transfer';
  });
  if (outcome === 'refund') { // paid for a lot that is no longer for sale: the seller's account refunds, our fee goes back too
    await stripeClient().refunds.create({ payment_intent: session.payment_intent, refund_application_fee: true }, { stripeAccount: account }).catch((e) => console.error('[market] refund', e));
    return;
  }
  if (outcome !== 'transfer') return;
  const lot = (await lotRef.get()).data();
  const buyerUser = await admin.auth().getUser(buyer).catch(() => null);
  const date = new Date().toISOString().slice(0, 10);
  const contract = lot.contract.replace('[імʼя покупця — заповнюється при оплаті]', (buyerUser && (buyerUser.displayName || buyerUser.email)) || buyer).replace('[дата оплати]', date);
  await transferWorld(lot.worldId, lot.seller, buyer, { id: lotId, hash: lot.snapshotHash, level: lot.level, boughtAt: date });
  await dealRef.update({ status: 'completed', contract, completedAt: ts() });
}

exports.marketWebhook = onRequest({ region: 'us-central1', secrets: [stripeSecretKey, stripeConnectWebhookSecret], timeoutSeconds: 540, memory: '1GiB' }, async (req, res) => {
  let event;
  try { event = stripeClient().webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], stripeConnectWebhookSecret.value().trim()); }
  catch (e) { console.error('[market] webhook signature', e.message); return res.status(400).send('Invalid signature'); }
  try {
    const o = event.data.object;
    if (event.type === 'checkout.session.completed' && o.metadata && o.metadata.kind === 'ww_market') await completeDeal(o, event.account);
    else if (event.type === 'checkout.session.expired' && o.metadata && o.metadata.lotId) {
      await db.collection('marketLots').doc(o.metadata.lotId).update({ reservedBy: del(), reservedUntil: del() }).catch(() => {});
    } else if (event.type === 'account.updated') {
      const uid = o.metadata && o.metadata.uid;
      if (uid) await db.collection('sellers').doc(uid).set({ chargesEnabled: !!o.charges_enabled, payoutsEnabled: !!o.payouts_enabled, detailsSubmitted: !!o.details_submitted, updatedAt: ts() }, { merge: true });
    } else if (/^charge\.dispute\./.test(event.type)) {
      const q = await db.collection('marketDeals').where('stripe.paymentIntent', '==', o.payment_intent).get();
      for (const d of q.docs) await d.ref.update({ dispute: { status: o.status, reason: o.reason, at: Date.now() } });
      await require('./admin-notice').notify({ kind: 'market', severity: 'critical', tier: 'market', title: `Суперечка з банком за угодою Маркету (${o.reason || '—'})`,
        body: `Акаунт продавця ${event.account}, PaymentIntent ${o.payment_intent}, статус ${o.status}. Відповідає продавець (продавець у чеку); модератор порівнює зі знімком за запитом.` }).catch(() => {});
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('[market] webhook', event.type, e);
    return res.status(500).send('Webhook handler failed'); // Stripe retries
  }
});

exports._market = { clean, metrics, contractFor, contentsLine, LEVELS }; // tests only
