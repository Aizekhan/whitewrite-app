// AI cost watch: once a day the real API dollars of the last 24 h (usage_logs, written by token-service charge())
// are summed per user → admin_costs/{YYYY-MM-DD} (admins read it in the Account) and two alarms go to admin_notices:
//   • one user's API cost in a day above COST_ALERT_USD (a runaway loop, an abused key, an admin account);
//   • one user paid fewer dollars in tokens than the API cost them (a pricing bug: margin below 1×).
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { admin, db } = require('./common');
const { notify } = require('./admin-notice');

const COST_ALERT_USD = 5;  // a day, one user
const TOP = 50;            // rows kept in the daily summary
const r4 = (x) => Math.round(x * 10000) / 10000;

async function summarize(now = Date.now()) {
  const since = admin.firestore.Timestamp.fromMillis(now - 24 * 3600 * 1000);
  const snap = await db.collection('usage_logs').where('timestamp', '>=', since).get();
  const by = {};
  snap.docs.forEach((d) => {
    const x = d.data(), u = by[x.uid] || (by[x.uid] = { uid: x.uid, usd: 0, paid: 0, calls: 0, tokens: 0, ops: {} });
    u.usd += x.realApiCostUSD || 0; u.paid += x.userPaidUSD || 0; u.calls += 1; u.tokens += x.userTokensCharged || 0;
    u.ops[x.operation || '?'] = (u.ops[x.operation || '?'] || 0) + 1;
  });
  const rows = Object.values(by).sort((a, b) => b.usd - a.usd);
  for (const u of rows.slice(0, TOP)) { // who it is: plan and e-mail, for the admin only
    const us = await db.collection('users').doc(u.uid).get().catch(() => null);
    u.plan = (us && us.exists && us.get('plan')) || 'free'; u.email = (us && us.exists && us.get('email')) || '';
    u.usd = r4(u.usd); u.paid = r4(u.paid);
  }
  const day = new Date(now).toISOString().slice(0, 10);
  const total = r4(rows.reduce((s, u) => s + u.usd, 0));
  await db.collection('admin_costs').doc(day).set({ at: admin.firestore.FieldValue.serverTimestamp(), day, totalUsd: total,
    calls: snap.size, users: rows.length, top: rows.slice(0, TOP) });

  const who = (u) => `${u.email || u.uid} (${u.plan || '?'})`;
  const ops = (u) => Object.entries(u.ops).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} × ${n}`).join(', ');
  const hot = rows.filter((u) => u.usd > COST_ALERT_USD);
  if (hot.length) await notify({ kind: 'ai-cost', severity: hot.some((u) => u.usd > COST_ALERT_USD * 4) ? 'critical' : 'warning', tier: 'costs',
    title: `Витрати ШІ за добу: ${hot.length} користувач(ів) понад $${COST_ALERT_USD}`,
    body: hot.map((u) => `${who(u)} — $${r4(u.usd)} API, ${u.calls} викликів: ${ops(u)}`).join('\n') + `\n\nУсього за добу: $${total}. Деталі — Акаунт → «Витрати ШІ».` });
  const loss = rows.filter((u) => u.usd > 0.05 && u.paid < u.usd);
  if (loss.length) await notify({ kind: 'ai-cost', severity: 'critical', tier: 'costs',
    title: `Списання нижче вартості API: ${loss.length} користувач(ів)`,
    body: loss.map((u) => `${who(u)} — заплатив $${r4(u.paid)} токенами, API коштувало $${r4(u.usd)}: ${ops(u)}`).join('\n') +
      '\n\nПеревір ціни в functions/paid-features.js та ai-models.js (списання = реальна вартість ÷ USD_PER_TOKEN).' });
  return { day, total, users: rows.length, hot: hot.length, loss: loss.length };
}

exports.aiCostDaily = onSchedule({ schedule: 'every 24 hours', timeoutSeconds: 300 }, async () => {
  console.log('[cost-watch]', JSON.stringify(await summarize()));
});
exports._costWatch = { summarize, COST_ALERT_USD };
