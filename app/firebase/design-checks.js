// ============================================================================
// Design checks across cards (v2.144, owner: «чого не вистачає з геймдизайну» 3–5) — SINGLE SOURCE for the Game Bible
// (window.__DESIGN, copy in app/firebase/ made by scripts/build-app.mjs) and MCP (get_gdd_status → design, save_card pillars / teaches).
// Edit THIS file.
//   🏛 Mechanic → pillar: a feature card (mechanics, levels, progression) names the pillars of «Огляд гри» it serves and the
//      anti-pillars it goes against, and the MDA aesthetics it supports — card.intent { pillars: [pillar text], against: [anti text], aesthetics: [id] }.
//   🪜 Learning ladder: a level names the mechanics it introduces / tests / twists / combines — card.intent.ladder [{ m: mechanic card id, step }]
//      (card-refs KIND «ladder»); levels go in their menu order (card.order).
//   ⚠ The riskiest assumption: «Огляд гри» → fields.risk (what must be true for the game to be fun) and fields.riskTest (how the prototype checks it);
//      the plan's G1 gate and its first task test it (gamedev.js).
// ============================================================================
(function () {
var GDD = typeof window !== 'undefined' && window.__GDD ? window.__GDD : require('./gdd-schema.js');
function arr(v) { return Array.isArray(v) ? v : v ? [v] : []; }
function live(cards) { return arr(cards).filter(function (c) { return c && !c.hidden && !c.archived; }); }
function T(uk, en) { return { uk: uk, en: en }; }

// MDA aesthetics (Hunicke, LeBlanc, Zubek): what the player should feel; kw — words that name it in the overview field
var AESTHETICS = [
  { id: 'sensation', uk: 'Відчуття', en: 'Sensation', h: T('приємно бачити, чути, керувати', 'a pleasure to see, hear, control'), kw: /відчутт|сенсор|sensation|sensory|feel/ },
  { id: 'fantasy', uk: 'Фантазія', en: 'Fantasy', h: T('гравець — хтось інший', 'the player is someone else'), kw: /фантаз|fantasy|make.?believe|роль/ },
  { id: 'narrative', uk: 'Наратив', en: 'Narrative', h: T('історія, що розгортається', 'a story that unfolds'), kw: /наратив|сюжет|історі|narrative|story|drama/ },
  { id: 'challenge', uk: 'Виклик', en: 'Challenge', h: T('подолати перешкоду', 'overcome an obstacle'), kw: /виклик|складн|challenge|mastery|майстерн/ },
  { id: 'fellowship', uk: 'Спільність', en: 'Fellowship', h: T('гра з іншими', 'play with others'), kw: /спільн|кооп|соціал|друз|fellowship|social|co.?op|together/ },
  { id: 'discovery', uk: 'Відкриття', en: 'Discovery', h: T('досліджувати невідоме', 'explore the unknown'), kw: /відкритт|досліджен|discover|explor/ },
  { id: 'expression', uk: 'Самовираження', en: 'Expression', h: T('показати себе, творити', 'show yourself, create'), kw: /самовираж|творч|кастоміз|expression|creativ|custom/ },
  { id: 'submission', uk: 'Відпочинок', en: 'Submission', h: T('гра як спосіб розслабитись', 'play as a pastime'), kw: /відпочин|розслаб|медитат|затишн|submission|relax|pastime|cozy/ } ];
var A_BY = {}; AESTHETICS.forEach(function (a) { A_BY[a.id] = a; });
// Nintendo's ladder: introduce in safety → test → add a twist → combine with others
var STEPS = [{ id: 'intro', uk: 'Ввести', en: 'Introduce' }, { id: 'test', uk: 'Перевірити', en: 'Test' }, { id: 'twist', uk: 'Ускладнити', en: 'Twist' }, { id: 'combine', uk: 'Поєднати', en: 'Combine' }];
var STEP_IDS = STEPS.map(function (s) { return s.id; });
var FEATURE_SECS = ['mechanics', 'levels', 'progression'];
// constructor cards that are design documents, not features — they serve the whole game, no pillar asked
var DOC_TPLS = ['release', 'accessibility', 'controls', 'ftue', 'retention', 'loops', 'level_metrics', 'difficulty'];
var INTENT_KEYS = ['pillars', 'against', 'aesthetics', 'ladder'];

function overviewOf(cards) { return live(cards).filter(function (c) { return c.section === 'overview'; })[0] || null; }
// a free-text list → items: lines, «;», bullets, «1.»; one line of short comma parts is a list too. The name is the text before « — » / «:».
function listOf(text) {
  var s = String(text == null ? '' : text).replace(/\r/g, '').trim();
  if (!s) return [];
  var parts = s.split(/\n|;|•|·/).map(function (x) { return x.trim(); }).filter(Boolean);
  if (parts.length === 1 && /,/.test(s) && s.split(',').every(function (x) { return x.trim().length <= 40; })) parts = s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  return parts.map(function (p) { p = p.replace(/^(\d+[.)]|[-*–—]|#+)\s*/, '').replace(/\*\*/g, '').trim(); var name = p.split(/\s[—–-]\s|:\s/)[0].trim(); return { name: name.slice(0, 80), text: p.slice(0, 300) }; })
    .filter(function (x) { return x.name; }).slice(0, 12);
}
// v2.149.2 (owner: «get_gdd_status.design.pillars = [] … на картці є поле «Стовпи»»): the design fields of «Огляд гри» under their standard key,
// else under the author's / an agent's own field (save_card made f_стовпи, f_найризикованіше_припущення…) — matched by key or label, the first
// non-empty one. Anti-pillars are told apart from pillars by «анти / anti / не є».
var DESIGN_FIELDS = {
  anti: /анти|anti|не\s*є|is\s*not/i,
  riskTest: /прототип|prototype|risk.?test|як.*перевір/i,
  risk: /ризик|risk|припущ|assumption/i,
  aesthetics: /естетик|aesthetic/i,
  pillars: /стовп|пілар|pillar|опор|принцип/i,
};
var DF_ORDER = ['anti', 'riskTest', 'risk', 'aesthetics', 'pillars']; // the most specific first: «Анти-стовпи» is anti, «Як прототип перевірить припущення» is riskTest
function designKeyOf(name) { // a field key or label → the standard design key, or ''
  var n = String(name || '').replace(/^f_/, '').replace(/_/g, ' ');
  if (DESIGN_FIELDS[n] !== undefined) return n;
  for (var i = 0; i < DF_ORDER.length; i++) if (DESIGN_FIELDS[DF_ORDER[i]].test(n)) return DF_ORDER[i];
  return '';
}
function fieldOf(o, std) {
  var f = (o && o.fields) || {}, has = function (v) { return String(v == null ? '' : v).trim() !== ''; };
  if (has(f[std])) return String(f[std]);
  var labels = {}; arr(o && o.defs).forEach(function (d) { if (d && d.key) labels[d.key] = d.label; });
  var keys = Object.keys(f);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k !== std && has(f[k]) && (designKeyOf(k) === std || designKeyOf(labels[k]) === std)) return String(f[k]);
  }
  return '';
}
function pillarsOf(cards) { var o = overviewOf(cards); return o ? listOf(fieldOf(o, 'pillars')) : []; }
function antiOf(cards) { var o = overviewOf(cards); return o ? listOf(fieldOf(o, 'anti')) : []; }
function targetAesthetics(cards) {
  var o = overviewOf(cards), t = fieldOf(o, 'aesthetics').toLowerCase();
  return AESTHETICS.filter(function (a) { return a.kw.test(t); }).map(function (a) { return a.id; });
}
// a stored pillar name → the current pillar it means (renamed a bit still matches), or null
function matchName(name, list) {
  var hit = null, best = 0;
  list.forEach(function (p) { var s = GDD.titleSim(name, p.name); if (s > best) { best = s; hit = p; } });
  return best >= GDD.SIMILAR ? hit : null;
}
function isFeature(c) { return FEATURE_SECS.indexOf(c.section) >= 0 && !(c.mech && DOC_TPLS.indexOf(c.mech.tpl) >= 0); }
function nm(o, lang) { return lang === 'en' ? o.en : o.uk; }

// 🏛 → { pillars: [{ name, text, cards: [id] }], anti: [{ name, cards }], aesthetics: [{ id, name, target, cards }], features: [{ id, title, section, pillars, against, aesthetics, stale }], issues }
function pillarMap(cards, lang) {
  var P = pillarsOf(cards), A = antiOf(cards), target = targetAesthetics(cards), issues = [];
  var add = function (level, ref, uk, en) { issues.push({ level: level, kind: 'pillar', ref: ref, uk: uk, en: en }); };
  var pillars = P.map(function (p) { return { name: p.name, text: p.text, cards: [] }; }), anti = A.map(function (p) { return { name: p.name, cards: [] }; });
  var aes = AESTHETICS.map(function (a) { return { id: a.id, name: nm(a, lang), target: target.indexOf(a.id) >= 0, cards: [] }; });
  var features = live(cards).filter(isFeature).map(function (c) {
    var it = c.intent || {}, stale = [], mine = [], vs = [];
    arr(it.pillars).forEach(function (n) { var p = matchName(n, P); if (p) { mine.push(p.name); pillars.filter(function (x) { return x.name === p.name; })[0].cards.push(c.id); } else stale.push(n); });
    arr(it.against).forEach(function (n) { var p = matchName(n, A); if (p) { vs.push(p.name); anti.filter(function (x) { return x.name === p.name; })[0].cards.push(c.id); } else stale.push(n); });
    var ae = arr(it.aesthetics).filter(function (id) { return A_BY[id]; });
    ae.forEach(function (id) { aes.filter(function (x) { return x.id === id; })[0].cards.push(c.id); });
    return { id: c.id, title: c.title || '', section: c.section, pillars: mine, against: vs, aesthetics: ae, stale: stale };
  });
  if (!P.length) add('warn', overviewOf(cards) ? 'c:' + overviewOf(cards).id : '', '«Огляд гри»: стовпи гри не записані — механікам нема на що посилатись.', '“Game overview”: the pillars are not written — mechanics have nothing to point at.');
  features.forEach(function (f) {
    var ref = 'c:' + f.id, t = f.title || f.id;
    if (P.length && !f.pillars.length) add('warn', ref, 'Картка «' + t + '» не служить жодному стовпу гри — навіщо вона в грі? Познач стовп або прибери фічу.', '“' + t + '” serves no pillar of the game — why is it here? Mark a pillar or cut the feature.');
    f.against.forEach(function (a) { add('warn', ref, 'Картка «' + t + '» суперечить анти-стовпу «' + a + '».', '“' + t + '” goes against the anti-pillar “' + a + '”.'); });
    if (f.stale.length) add('tip', ref, '«' + t + '»: стовпа «' + f.stale.join('», «') + '» уже немає в «Огляді гри».', '“' + t + '”: the pillar “' + f.stale.join('”, “') + '” is no longer in “Game overview”.');
  });
  pillars.forEach(function (p) { if (features.length && !p.cards.length) add('warn', '', 'Стовп «' + p.name + '» не підкріплює жодна механіка чи рівень.', 'No mechanic or level supports the pillar “' + p.name + '”.'); });
  aes.forEach(function (a) {
    if (a.target && !a.cards.length) add('warn', '', 'Естетика «' + nm(A_BY[a.id], 'uk') + '» — ціль гри, але її не підкріплює жодна механіка чи рівень.', 'The aesthetic “' + nm(A_BY[a.id], 'en') + '” is a goal of the game, but no mechanic or level supports it.');
    if (target.length && !a.target && a.cards.length >= 2) add('tip', '', 'Естетика «' + nm(A_BY[a.id], 'uk') + '» не серед цілей гри, а на неї працюють ' + a.cards.length + ' карток.', a.cards.length + ' cards work for the aesthetic “' + nm(A_BY[a.id], 'en') + '”, which is not a goal of the game.');
  });
  return { pillars: pillars, anti: anti, aesthetics: aes, target: target, features: features, issues: issues };
}

// 🪜 → { levels: [{ id, title }], mechanics: [{ id, title, cells: { levelId: [steps] }, intro (level index | -1), last (index of the last use) }], issues }
function ladder(cards, lang) {
  var L = live(cards), issues = [];
  var levels = L.filter(function (c) { return c.section === 'levels'; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  var mechs = L.filter(function (c) { return c.section === 'mechanics' && !(c.mech && DOC_TPLS.indexOf(c.mech.tpl) >= 0); }), byId = {};
  mechs.forEach(function (c) { byId[c.id] = { id: c.id, title: c.title || '', cells: {}, intro: -1, uses: [], last: -1 }; });
  var any = false;
  levels.forEach(function (lv, i) {
    var steps = arr((lv.intent || {}).ladder).concat(arr(lv.links).filter(function (l) { return l && l.role === 'introduces' && String(l.to).indexOf('c:') === 0; }).map(function (l) { return { m: l.to.slice(2), step: 'intro' }; })); // link_cards «introduces» = an intro step
    steps.forEach(function (x) {
      var m = byId[x && x.m], step = x && STEP_IDS.indexOf(x.step) >= 0 ? x.step : '';
      if (!m || !step || (m.cells[lv.id] || []).indexOf(step) >= 0) return; any = true;
      (m.cells[lv.id] = m.cells[lv.id] || []).push(step);
      if (step === 'intro') { if (m.intro < 0) m.intro = i; else issues.push({ level: 'tip', kind: 'ladder', ref: 'c:' + lv.id, uk: '«' + (lv.title || lv.id) + '»: механіку «' + m.title + '» уже вводили раніше.', en: '“' + (lv.title || lv.id) + '”: “' + m.title + '” was already introduced earlier.' }); }
      else m.uses.push(i);
      m.last = Math.max(m.last, i);
    });
  });
  var list = mechs.map(function (c) { return byId[c.id]; });
  if (any) list.forEach(function (m) {
    var ref = 'c:' + m.id;
    var early = m.uses.filter(function (i) { return m.intro < 0 || i < m.intro; });
    if (early.length) issues.push({ level: 'warn', kind: 'ladder', ref: ref, uk: 'Механіку «' + m.title + '» використовують на рівні «' + (levels[early[0]].title || '') + '» раніше, ніж навчили' + (m.intro < 0 ? ' (ніде не вводять)' : ' (вводять на «' + (levels[m.intro].title || '') + '»)') + '.',
      en: '“' + m.title + '” is used on “' + (levels[early[0]].title || '') + '” before it is taught' + (m.intro < 0 ? ' (never introduced)' : ' (introduced on “' + (levels[m.intro].title || '') + '”)') + '.' });
    if (m.intro >= 0 && !m.uses.some(function (i) { return i >= m.intro; })) issues.push({ level: 'warn', kind: 'ladder', ref: ref, uk: 'Механіку «' + m.title + '» ввели на «' + (levels[m.intro].title || '') + '» і більше ніколи не використали.', en: '“' + m.title + '” is introduced on “' + (levels[m.intro].title || '') + '” and never used again.' });
    if (m.intro < 0 && !m.uses.length) issues.push({ level: 'tip', kind: 'ladder', ref: ref, uk: 'Механіки «' + m.title + '» немає на жодному рівні драбини навчання.', en: '“' + m.title + '” is on no level of the learning ladder.' });
  });
  return { levels: levels.map(function (l) { return { id: l.id, title: l.title || '' }; }), mechanics: list, used: any, issues: issues };
}

// ⚠ → { risk, test, issues }
function riskOf(cards) {
  var o = overviewOf(cards), risk = fieldOf(o, 'risk').trim(), test = fieldOf(o, 'riskTest').trim(), issues = [], ref = o ? 'c:' + o.id : '';
  if (!risk) issues.push({ level: 'warn', kind: 'risk', ref: ref, uk: '«Огляд гри»: не записане найризикованіше припущення — що має бути правдою, щоб гра була цікавою. Прототип (G1) перевіряє саме його.', en: '“Game overview”: the riskiest assumption is not written — what must be true for the game to be fun. The prototype (G1) tests exactly that.' });
  else if (!test) issues.push({ level: 'tip', kind: 'risk', ref: ref, uk: '«Огляд гри»: напиши, як прототип перевірить припущення (що гравець робить і скільки хвилин, що вважаємо успіхом).', en: '“Game overview”: write how the prototype tests the assumption (what the player does and for how long, what counts as success).' });
  return { risk: risk, test: test, issues: issues };
}

// everything for MCP get_gdd_status → design and the Bible's checks
function status(cards, lang) {
  var p = pillarMap(cards, lang), l = ladder(cards, lang), r = riskOf(cards);
  return { pillars: p, ladder: l, risk: r, issues: r.issues.concat(p.issues, l.issues) };
}
// the agent's input → a clean intent patch ({} when nothing to change); teaches: [{ mechanic: card id, step }] resolved by the caller
function cleanIntent(x) {
  var o = {}, s = function (v) { return String(v == null ? '' : v).slice(0, 80).trim(); };
  if (Array.isArray(x.pillars)) o.pillars = x.pillars.map(s).filter(Boolean).slice(0, 12);
  if (Array.isArray(x.against)) o.against = x.against.map(s).filter(Boolean).slice(0, 12);
  if (Array.isArray(x.aesthetics)) o.aesthetics = x.aesthetics.map(s).filter(function (id) { return A_BY[id]; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
  if (Array.isArray(x.ladder)) o.ladder = x.ladder.filter(function (y) { return y && y.m && STEP_IDS.indexOf(y.step) >= 0; }).map(function (y) { return { m: s(y.m), step: y.step }; }).slice(0, 60);
  return o;
}
var DESIGN = { AESTHETICS: AESTHETICS, STEPS: STEPS, STEP_IDS: STEP_IDS, FEATURE_SECS: FEATURE_SECS, DOC_TPLS: DOC_TPLS, INTENT_KEYS: INTENT_KEYS, listOf: listOf, fieldOf: fieldOf, designKeyOf: designKeyOf, pillarsOf: pillarsOf, antiOf: antiOf,
  targetAesthetics: targetAesthetics, isFeature: isFeature, pillarMap: pillarMap, ladder: ladder, riskOf: riskOf, status: status, cleanIntent: cleanIntent };
if (typeof module !== 'undefined' && module.exports) module.exports = DESIGN;
if (typeof window !== 'undefined') window.__DESIGN = DESIGN;
})();
