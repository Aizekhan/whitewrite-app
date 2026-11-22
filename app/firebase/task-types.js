// ============================================================================
// Task types and their proof — SINGLE SOURCE for the planner (functions/src/gamedev.js: every task gets a type), the MCP server
// (submit_task_result evidence → report.evidence_check; review_task → a task closes itself only with the proof its type needs), the
// Game Bible (window.__TASK_TYPES, copy in app/firebase/ made by scripts/build-app.mjs) and the tests. Edit THIS file.
// v2.155 (owner + the game-designer agent: «задача закривається з доказом: механіка — плейтест і жодних помилок у консолі; баланс — прогін
// ботів з цифрами; інтерфейс — знімок екрана; контент чи арт — ліцензія власна чи CC0. Без цього задачу не можна перевести в «готово»»).
// ============================================================================
(function () {
var TYPES = {
  mechanic: { icon: '⚙', uk: 'Механіка', en: 'Mechanic', needs: ['playtest', 'console'] },
  balance: { icon: '⚖', uk: 'Баланс', en: 'Balance', needs: ['numbers'] },
  ui: { icon: '▭', uk: 'Інтерфейс', en: 'Interface', needs: ['screenshot', 'uiCheck'] },
  content: { icon: '🎨', uk: 'Контент / арт', en: 'Content / art', needs: ['licence'] },
  tech: { icon: '🔧', uk: 'Технічне', en: 'Technical', needs: ['tests'] },
};
var LICENCES = ['own', 'cc0', 'cc-by', 'store', 'other']; // only own and CC0 let a task close itself — the rest the author looks at
var s = function (v) { return typeof v === 'string' ? v.trim() : ''; };
// what a proof is, and the check: e = report.evidence, r = the whole report (tests)
var EVIDENCE = {
  playtest: { uk: 'Плейтест: що пройшли й що побачили', en: 'Playtest: what was played and seen', arg: 'evidence.playtest', ok: function (e) { return s(e.playtest).length >= 15; } },
  console: { uk: 'Жодних помилок у консолі', en: 'No errors in the console', arg: 'evidence.console_errors = 0', ok: function (e) { return e.console_errors === 0; } },
  numbers: { uk: 'Прогін ботів із цифрами', en: 'A bot run with the numbers', arg: 'evidence.numbers (the run: waves, HP, gold, winners…)', ok: function (e) { return s(e.numbers).length >= 20 && /\d/.test(e.numbers); } },
  screenshot: { uk: 'Знімок екрана', en: 'A screenshot', arg: 'evidence.screenshot (a URL)', ok: function (e) { return /^https?:\/\//.test(s(e.screenshot)); } },
  uiCheck: { uk: 'Перевірка інтерфейсу (напр. «гра без читання»)', en: 'The interface check (e.g. «playable without reading»)', arg: 'evidence.ui_check', ok: function (e) { return s(e.ui_check).length >= 10; } },
  licence: { uk: 'Ліцензія власна чи CC0', en: 'Own or CC0 licence', arg: 'evidence.licence = own | cc0', ok: function (e) { return e.licence === 'own' || e.licence === 'cc0'; } },
  tests: { uk: 'Тести пройшли', en: 'Tests passed', arg: 'tests.ran with failed = 0', ok: function (e, r) { return !!(r && r.tests && r.tests.ran && r.tests.failed === 0); } },
};
// a task's type: its own, else from the older fields (owner / kind) — plans made before v2.155 have none
function typeOf(t) {
  t = t || {};
  if (TYPES[t.type]) return t.type;
  if (t.owner === 'art' || t.owner === 'audio') return 'content';
  if (t.owner === 'design' || t.owner === 'qa' || t.kind === 'bug') return 'mechanic';
  return 'tech';
}
// the proof of a report against the type → { ok, missing: [ids], have: [ids] }
function check(type, e, r) {
  var T = TYPES[type] || TYPES.tech, ev = e || {}, have = [], missing = [];
  T.needs.forEach(function (k) { (EVIDENCE[k].ok(ev, r) ? have : missing).push(k); });
  return { type: type, ok: !missing.length, missing: missing, have: have };
}
// ✅ v2.160.2 (owner: «критерій звіряй за змістом, не дослівно»): an acceptance criterion against the agent's report — by meaning (shared word
// stems), not by the exact text; the author's default criterion («Done as the author said: «…»») by the author's words inside «».
// A criterion is proven (✅ with evidence and a commit / a passed test / a screenshot behind it), look (✅ without proof, or not answered —
// the author looks, it is not a failure) or failed (❌ in the report). A task closes itself only when every criterion is proven.
var STOPW = /^(та|чи|або|що|це|як|на|до|по|за|від|для|не|але|все|всі|усі|кожен|кожна|кожне|треба|мають|має|тощо|the|and|for|with|are|that|this|all|each|must|should)$/;
function stems(t) {
  var out = [];
  String(t || '').toLowerCase().replace(/[«»"'`.,:;!?()\[\]{}—–\-\/\\|]+/g, ' ').split(/\s+/).forEach(function (w) {
    if (w.length > 2 && !STOPW.test(w) && out.indexOf(w.slice(0, 5)) < 0) out.push(w.slice(0, 5)); });
  return out;
}
function critText(a) { var m = /^(?:Done as the author said|Зроблено, як сказав автор)\s*:\s*«([\s\S]*)»/.exec(String(a || '')); return m ? m[1] : String(a || ''); }
function critScore(a, b) { // 0..1: the share of the shorter text's stems found in the other
  var x = stems(critText(a)), y = stems(b), hit = x.filter(function (w) { return y.indexOf(w) >= 0; }).length;
  if (String(b || '').toLowerCase().indexOf(String(a || '').toLowerCase().slice(0, 40)) >= 0) return 1; // the old exact match still counts
  return hit >= 2 && x.length && y.length ? hit / Math.min(x.length, y.length) : 0;
}
function critMatch(a, criteria) { // the report's criterion that answers this one, or null
  var best = null, sc = 0;
  (criteria || []).forEach(function (c) { var v = critScore(a, c && c.criterion); if (v > sc) { sc = v; best = c; } });
  return sc >= 0.5 ? best : null;
}
function critProven(c, r) {
  r = r || {}; var ev = s(c && c.evidence), t = r.tests || {};
  return !!(c && c.met && ev && (s(r.commit) || (t.ran && t.passed > 0 && !t.failed) || /^https?:\/\//.test(s((r.evidence || {}).screenshot)) || /https?:\/\/|\b[0-9a-f]{7,40}\b/i.test(ev)));
}
function critCheck(accept, r) {
  var out = { proven: [], look: [], failed: [] }, used = [];
  (accept || []).forEach(function (a) {
    var c = critMatch(a, (r || {}).criteria); if (c) used.push(c);
    (c ? (!c.met ? out.failed : critProven(c, r) ? out.proven : out.look) : out.look).push(a);
  });
  ((r || {}).criteria || []).forEach(function (c) { if (used.indexOf(c) < 0 && !c.met) out.failed.push(c.criterion); }); // the agent's own ❌
  return out;
}
// the evidence object as stored (cleaned)
function clean(e) {
  e = e && typeof e === 'object' ? e : {};
  var n = Number(e.console_errors), out = {};
  if (s(e.playtest)) out.playtest = s(e.playtest).slice(0, 3000);
  if (e.console_errors !== undefined && e.console_errors !== null && e.console_errors !== '' && isFinite(n)) out.console_errors = Math.max(0, Math.round(n));
  if (s(e.numbers)) out.numbers = s(e.numbers).slice(0, 4000);
  if (s(e.screenshot)) out.screenshot = s(e.screenshot).slice(0, 600);
  if (s(e.ui_check)) out.ui_check = s(e.ui_check).slice(0, 1000);
  if (LICENCES.indexOf(e.licence) >= 0) out.licence = e.licence;
  if (s(e.licence_note)) out.licence_note = s(e.licence_note).slice(0, 300);
  return out;
}
// 👁 v2.156 (the game-designer agent: «103 зміни карток, які автор не бачив — лічильник, який нічого не дає»): an agent's change of a card counts as
// seen by itself when the card is in an epic the author agreed (plan/current.epicsOk — its tasks' cards and the epic's card) or the change
// does not touch the rules (only descriptions / notes / the title / files…); the author is shown only rule changes outside agreed epics.
// agentPrev holds what the last agent write replaced (mcp.js agentMark). DESCRIPTIVE is also the threshold of card → plan (src/card-drift.js).
var DESCRIPTIVE = /^(text|desc|description|notes?|look|mood|lore|story|bio|about|summary|logline|appearance|refs|source|secrets|portrait|refpics|pics|model)$/i;
var BLOCKS = ['mech', 'intent', 'place', 'creature', 'sheet'];
var sameJ = function (a, b) { return JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b); };
function rulesChanged(prev, c) {
  if (!prev || prev._new || prev._skipped) return true; // a new card, or one too big to compare
  if (BLOCKS.some(function (k) { return k in prev && !sameJ(prev[k], c[k]); })) return true;
  if (!('fields' in prev)) return false;
  var a = prev.fields || {}, b = c.fields || {};
  return Object.keys(Object.assign({}, a, b)).some(function (k) { return k !== 'group' && !DESCRIPTIVE.test(k) && !sameJ(a[k], b[k]); });
}
function agreedRefs(plan, tasks) {
  var ok = (plan && plan.epicsOk) || {}, out = {};
  (((plan && plan.plan) || {}).milestones || []).forEach(function (m) { (m.epics || []).forEach(function (e) { if (ok[e.id] && e.card) out[e.card] = 1; }); });
  (tasks || []).forEach(function (t) { if (t.epic && ok[t.epic]) (t.cards || []).forEach(function (r) { out[r] = 1; }); });
  return out;
}
// c — a raw game card doc { id, canonRef?, agentAt, agentPrev, … }; agreed — agreedRefs(…) once per list
function autoSeen(c, agreed) {
  if (!c || !c.agentAt) return true;
  if (agreed['c:' + c.id] || (c.canonRef && agreed['e:' + c.canonRef])) return true;
  return !rulesChanged(c.agentPrev, c);
}
var label = function (k, lang) { var x = EVIDENCE[k] || TYPES[k]; return x ? (lang === 'en' ? x.en : x.uk) : k; };
var TASK_TYPES = { critMatch: critMatch, critCheck: critCheck, critProven: critProven, TYPES: TYPES, EVIDENCE: EVIDENCE, LICENCES: LICENCES, typeOf: typeOf, check: check, clean: clean, label: label, DESCRIPTIVE: DESCRIPTIVE, rulesChanged: rulesChanged, agreedRefs: agreedRefs, autoSeen: autoSeen };
if (typeof module !== 'undefined' && module.exports) module.exports = TASK_TYPES;
if (typeof window !== 'undefined') window.__TASK_TYPES = TASK_TYPES;
})();
