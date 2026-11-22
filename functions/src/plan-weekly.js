// 📅 The weekly summary of a game's plan (v2.155, the game-designer agent: «щотижневий підсумок … закрито без тебе: N» — the third safeguard of
// tasks closing themselves). Mondays 10:00 Europe/Kyiv: every game an agent key worked on in the last 8 days → plan/current.weekly (the Bible
// shows it above 👑) and one Telegram message to the author when the game's Telegram is linked (agents.js tellAuthor). Nothing happened → nothing sent.
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { db } = require('./common');
const AGENTS = require('./agents')._agents;

const DAY = 864e5;
const ms = (v) => (!v ? 0 : typeof v === 'number' ? v : v.toMillis ? v.toMillis() : 0);
const CLOSE = ['accepted', 'auto_closed', 'verified']; // the inventory's «done» at planning is not this week's work
// the week of one game: tasks (docs) + the plan doc → the numbers; pure (tests/plan-weekly.test.cjs)
function weekOf(tasks, plan, since) {
  const closedEv = (t) => (t.history || []).filter((h) => CLOSE.includes(h.type) && (h.at || 0) >= since).pop();
  const closed = tasks.filter((t) => t.status === 'done' && closedEv(t));
  const by = (w) => closed.filter((t) => { const h = closedEv(t); return w === 'auto' ? h.type === 'auto_closed' || h.type === 'verified' : w === 'designer' ? h.by === 'designer' : false; }).length;
  const created = tasks.filter((t) => ms(t.createdAt) >= since);
  const live = new Map(tasks.map((t) => [t.id, t]));
  const msNow = ((plan.plan || {}).milestones || []).map((m) => {
    const ts = (m.tasks || []).map((t) => live.get(t.id) || t).filter((t) => !['deferred', 'dropped'].includes(t.status));
    return { id: m.id, name: m.name || m.id, n: ts.length, done: ts.filter((t) => t.status === 'done').length };
  }).find((m) => m.n && m.done < m.n);
  return {
    at: Date.now(), since, closed: closed.length, auto: by('auto'), designer: by('designer'),
    created: created.length, sync: created.filter((t) => t.kind === 'sync').length, bugs: created.filter((t) => t.kind === 'bug').length,
    review: tasks.filter((t) => t.status === 'review').length, blocked: tasks.filter((t) => t.status === 'blocked').length,
    ms: msNow ? { id: msNow.id, name: msNow.name, pct: Math.round(100 * msNow.done / msNow.n) } : null,
  };
}
function weekText(w, waits) {
  const lines = ['📅 Тиждень розробки'];
  lines.push(`✓ Закрито задач: ${w.closed}` + (w.auto + w.designer ? ` (без тебе: ${w.auto + w.designer} — з доказом сама: ${w.auto}, прийняв геймдизайнер: ${w.designer})` : ''));
  if (w.created) lines.push(`＋ Нових задач: ${w.created}` + (w.sync ? ` (↻ з карток: ${w.sync})` : '') + (w.bugs ? ` (🐞 баги: ${w.bugs})` : ''));
  const wait = [w.review ? `на перевірці: ${w.review}` : '', w.blocked ? `заблоковано: ${w.blocked}` : '', waits ? `питань агентів: ${waits}` : ''].filter(Boolean);
  lines.push(wait.length ? '👑 Чекає тебе — ' + wait.join(' · ') : '👑 Від тебе зараз нічого не потрібно');
  if (w.ms) lines.push(`▶ Зараз: ${w.ms.id} «${w.ms.name}» — ${w.ms.pct}%`);
  return lines.join('\n');
}
async function weeklyRun(now) {
  now = now || Date.now();
  const since = now - 7 * DAY, keys = await db.collection('mcpKeys').where('lastUsedAt', '>=', new Date(now - 8 * DAY)).get();
  const games = new Map();
  keys.docs.forEach((d) => { const k = d.data(); if (k.worldId && k.gameId) games.set(k.worldId + '/' + k.gameId, k); });
  let sent = 0;
  for (const k of games.values()) {
    try {
      const wref = db.collection('worlds').doc(k.worldId), gref = wref.collection('games').doc(k.gameId);
      const [w, g, p, t, q] = await Promise.all([wref.get(), gref.get(), gref.collection('plan').doc('current').get(), gref.collection('tasks').get(),
        gref.collection('agentMessages').where('status', '==', 'new').limit(200).get().catch(() => ({ docs: [] }))]);
      if (!w.exists || !g.exists) continue;
      const tasks = t.docs.map((d) => ({ id: d.id, ...d.data() })), week = weekOf(tasks, p.exists ? p.data() : {}, since);
      const waits = q.docs.filter((d) => ['question', 'approval_request'].includes(d.get('type')) && (d.get('from') || {}).kind === 'agent').length;
      await p.ref.set({ weekly: { ...week, waits } }, { merge: true });
      if (!week.closed && !week.created && !week.review && !week.blocked && !waits) continue;
      if (await AGENTS.tellAuthor(gref, w.data(), g.data(), weekText(week, waits), 'plan').catch(() => false)) sent++;
    } catch (e) { console.error('[planWeekly]', k.worldId, k.gameId, e.message); }
  }
  return { games: games.size, sent };
}
exports.planWeekly = onSchedule({ schedule: '0 10 * * 1', timeZone: 'Europe/Kyiv', secrets: [AGENTS.telegramBotToken], timeoutSeconds: 540 }, async () => { console.log('[planWeekly]', await weeklyRun()); });
exports._weekly = { weekOf, weekText, weeklyRun }; // tests only (tests/plan-weekly.test.cjs)
