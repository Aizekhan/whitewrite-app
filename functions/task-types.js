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
var label = function (k, lang) { var x = EVIDENCE[k] || TYPES[k]; return x ? (lang === 'en' ? x.en : x.uk) : k; };
var TASK_TYPES = { TYPES: TYPES, EVIDENCE: EVIDENCE, LICENCES: LICENCES, typeOf: typeOf, check: check, clean: clean, label: label };
if (typeof module !== 'undefined' && module.exports) module.exports = TASK_TYPES;
if (typeof window !== 'undefined') window.__TASK_TYPES = TASK_TYPES;
})();
