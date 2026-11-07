// ============================================================================
// Card references — SINGLE SOURCE of «what points at a game card» for the Game Bible («🔗 Що зачепить зміна»,
// window.__CARD_REFS, copy in app/firebase/ made by scripts/build-app.mjs), the MCP server (get_card → used_by) and the
// tests. Edit THIS file. RULE: a feature that stores a reference to a card adds its KIND here in the same commit
// (tests/card-refs.test.cjs checks the known reference fields are covered).
// ============================================================================
// A target is a card key: "c:<cardId>" — a game card, "e:<entityId>" — a canon entity (in a game: a card with canonRef).
// The game snapshot G = { cards (raw game card docs), entities, quests, dialogues, tasks (task docs), plan (plan/current.plan),
//   names(card) → the names a style biome matches (optional; default: title, group, category, location) }.
// A KIND turns G into edges { kind, from: { type, id, title, key? }, to: key, extra }; `out` labels a kind also shown on
// the `from` side (both directions matter: mechanic ↔ mechanic, item ↔ owner…).
(function () {
var NV = typeof window !== 'undefined' && window.__NARRATIVE ? window.__NARRATIVE : require('./narrative-validate.js');
var MECH = typeof window !== 'undefined' && window.__MECH ? window.__MECH : require('./mechanics.js');
var SG = typeof window !== 'undefined' && window.__STYLE ? window.__STYLE : require('./style-guide.js');

function arr(v) { return Array.isArray(v) ? v : v ? [v] : []; }
// quests / dialogues store a game card as "c:<id>" and a canon entity as its plain id
function narrKey(v) { v = String(v || ''); return !v || v === 'player' || v === 'narrator' ? '' : v.indexOf('c:') === 0 ? v : 'e:' + v; }
function cardKey(c) { return c.canonRef ? 'e:' + c.canonRef : 'c:' + c.id; }
function live(G) { return arr(G.cards).filter(function (c) { return !c.hidden; }); }
// a plan task's card ref: "c:id" / "e:id" / "new:<title>" (a card the plan asked for, matched by title once it exists)
function planKey(G, r) {
  r = String(r || '');
  if (r.indexOf('new:') !== 0) return r;
  var t = r.slice(4).toLowerCase(), c = live(G).filter(function (x) { return !x.canonRef && String(x.title || '').toLowerCase() === t; })[0];
  return c ? 'c:' + c.id : '';
}
function from(type, x, extra) { return Object.assign({ type: type, id: x.id, title: x.title || '' }, extra || {}); }

var QUEST_SOURCE = { card: 'c:', e: 'e:' }; // quest.source.type → key prefix (lore / stories are not cards)
var KINDS = [
  { id: 'quest', uk: 'Квест', en: 'Quest', fields: NV.REF_FIELDS.map(function (k) { return 'quest.' + k; }).concat(['quest.source']),
    edges: function (G) {
      var out = [];
      arr(G.quests).forEach(function (q) {
        NV.REF_FIELDS.forEach(function (k) { arr(q[k]).forEach(function (v) { var to = narrKey(v); if (to) out.push({ from: from('quest', q), to: to, extra: k === 'giver' ? 'giver' : '' }); }); });
        var s = q.source, p = s && QUEST_SOURCE[s.type];
        if (p && s.id) out.push({ from: from('quest', q), to: p + s.id, extra: 'source' });
      });
      return out;
    } },
  { id: 'dialogue', uk: 'Діалог', en: 'Dialogue', fields: ['dialogue.participants', 'dialogue.location', 'dialogue.nodes.speaker'],
    edges: function (G) {
      var out = [];
      arr(G.dialogues).forEach(function (d) {
        arr(d.participants).concat(arr(d.location), arr(d.nodes).map(function (n) { return n.speaker; })).forEach(function (v) {
          var to = narrKey(v); if (to) out.push({ from: from('dialogue', d), to: to });
        });
      });
      return out;
    } },
  { id: 'voice', uk: 'Озвучка в діалозі', en: 'Voice line in a dialogue', fields: ['dialogue.nodes.voice'],
    edges: function (G) {
      var out = [];
      arr(G.dialogues).forEach(function (d) { arr(d.nodes).forEach(function (n) { arr(n.voice).forEach(function (id) { out.push({ from: from('dialogue', d), to: 'c:' + id, extra: n.id || '' }); }); }); });
      return out;
    } },
  // plan tasks, and task docs outside the plan — bugs (kind 'bug': MCP report_bug / the Bible's bug form) carry kind + severity on `from`
  { id: 'task', uk: 'Задача', en: 'Task', fields: ['plan.milestones.tasks.cards', 'card.planTask', 'tasks.cards (bug)'],
    edges: function (G) {
      var out = [], status = {}, inPlan = {};
      arr(G.tasks).forEach(function (t) { status[t.id] = t.status; });
      ((G.plan || {}).milestones || []).forEach(function (m) {
        arr(m.tasks).forEach(function (t) {
          var id = String(t.id || '').replace(/[\/\s]/g, '_'), f = from('task', { id: t.id, title: t.title }, { milestone: m.id, status: status[id] || '' });
          inPlan[id] = 1;
          arr(t.cards).forEach(function (r) { var to = planKey(G, r); if (to) out.push({ from: f, to: to, extra: (t.roles || {})[r] || '' }); });
          live(G).forEach(function (c) { if (c.planTask && c.planTask === t.id) out.push({ from: f, to: cardKey(c) }); });
        });
      });
      arr(G.tasks).forEach(function (t) {
        if (inPlan[t.id] || !arr(t.cards).length) return;
        var f = from('task', { id: t.id, title: t.title }, Object.assign({ milestone: t.milestone || '', status: t.status || '' }, t.kind === 'bug' ? { kind: 'bug', severity: t.severity || 's3' } : {}));
        arr(t.cards).forEach(function (r) { var to = planKey(G, r); if (to) out.push({ from: f, to: to, extra: t.kind === 'bug' ? 'bug ' + String(t.severity || 's3').toUpperCase() : '' }); });
      });
      return out;
    } },
  { id: 'mech', uk: 'Повʼязана механіка', en: 'Linked mechanic', out: { uk: 'Повʼязана механіка', en: 'Linked mechanic' }, fields: ['card.mech.links'],
    edges: function (G) {
      var out = [];
      live(G).forEach(function (c) { if (c.mech) arr(c.mech.links).forEach(function (id) { out.push({ from: from('card', c, { key: cardKey(c) }), to: 'c:' + id }); }); });
      return out;
    } },
  { id: 'slot', uk: 'Слот звуку', en: 'Sound slot', fields: ['card.mech.sections[sound field]'],
    edges: function (G, lang) {
      var out = [];
      live(G).forEach(function (c) {
        if (c.mech) MECH.soundSlots(c.mech, lang).forEach(function (sl) {
          sl.refs.forEach(function (id) { out.push({ from: from('card', c, { key: cardKey(c) }), to: 'c:' + id, extra: sl.rowName ? sl.rowName + ' · ' + sl.label : sl.label }); });
        });
      });
      return out;
    } },
  // a mechanic's `card` field (v2.78: the VFX of a game-feel action, a loot item, the levels of pacing / difficulty, the cards of a loop step) —
  // [cardId] from a picker or card titles typed by hand; a title that names no card points nowhere
  { id: 'mechcard', uk: 'У механіці', en: 'In a mechanic', out: { uk: 'Картка в механіці', en: 'Card in the mechanic' }, fields: ['card.mech.sections[card field]'],
    edges: function (G, lang) {
      var out = [], all = live(G);
      all.forEach(function (c) {
        if (c.mech) MECH.cardSlots(c.mech, lang).forEach(function (sl) {
          sl.tokens.forEach(function (t) { var to = MECH.resolveCard(t, all); if (to && to.id !== c.id) out.push({ from: from('card', c, { key: cardKey(c) }), to: cardKey(to), extra: sl.rowName ? sl.rowName + ' · ' + sl.label : sl.label }); });
        });
      });
      return out;
    } },
  { id: 'owner', uk: 'Предмет', en: 'Item', out: { uk: 'Власник предмета', en: 'Item owner' }, fields: ['card.forge.owners'],
    edges: function (G) {
      var out = [];
      live(G).forEach(function (c) { arr((c.forge || {}).owners).forEach(function (id) { out.push({ from: from('card', c, { key: cardKey(c) }), to: 'c:' + id }); }); });
      return out;
    } },
  { id: 'loadout', uk: 'У спорядженні', en: 'In the loadout of', out: { uk: 'Предмет у спорядженні', en: 'Item in the loadout' }, fields: ['card.forge.loadouts.items'],
    edges: function (G) {
      var out = [];
      live(G).forEach(function (c) {
        arr((c.forge || {}).loadouts).forEach(function (l) { Object.keys(l.items || {}).forEach(function (slot) { if (l.items[slot]) out.push({ from: from('card', c, { key: cardKey(c) }), to: 'c:' + l.items[slot], extra: l.name || '' }); }); });
      });
      return out;
    } },
  // a hero card (game character / enemy) links one prefab card of «Ассети й префаби» instead of carrying model files (v2.88)
  { id: 'prefab', uk: 'Префаб героя', en: 'Hero prefab', out: { uk: 'Префаб', en: 'Prefab' }, fields: ['card.prefab'],
    edges: function (G) {
      return live(G).filter(function (c) { return c.prefab; }).map(function (c) { return { from: from('card', c, { key: cardKey(c) }), to: 'c:' + c.prefab }; });
    } },
  { id: 'style', uk: 'Задає стиль', en: 'Sets the style of', out: { uk: 'Стиль біому', en: 'Biome style' }, fields: ['card.fields.places (artstyle)'],
    edges: function (G) {
      var out = [], all = live(G), style = all.filter(function (c) { return c.section === 'artstyle'; });
      if (!style.length) return out;
      var names = G.names || function (c) { var f = c.fields || {}; return [c.title, f.group, f.category, f.location]; };
      all.forEach(function (c) {
        if (c.section === 'artstyle') return;
        var b = SG.resolveStyle(style, names(c)).biome;
        if (b) out.push({ from: from('card', c, { key: cardKey(c) }), to: 'c:' + b.id });
      });
      return out;
    } },
];

// every edge of the game, each with its kind
function edges(G, lang) {
  var out = [];
  KINDS.forEach(function (k) { k.edges(G, lang || 'uk').forEach(function (e) { e.kind = k.id; out.push(e); }); });
  return out;
}
function label(kindId, side, lang) {
  var k = KINDS.filter(function (x) { return x.id === kindId; })[0]; if (!k) return kindId;
  var l = side === 'out' && k.out ? k.out : k;
  return l[lang === 'en' ? 'en' : 'uk'];
}
// what points at a card (and, for two-way kinds, what the card points at) → [{ kind, side: 'in' | 'out', label, from, to, extra }]
// one row per kind + object; for 'out' rows `from` is the object the card points at ({ type: 'card', key, title })
function usedBy(G, key, lang, all) {
  var out = [], seen = {}, cards = live(G), title = function (k) {
    var c = cards.filter(function (x) { return cardKey(x) === k; })[0];
    if (c) return c.title || '';
    var e = arr(G.entities).filter(function (x) { return 'e:' + x.id === k; })[0];
    return e ? e.name || e.title || '' : '';
  };
  (all || edges(G, lang)).forEach(function (e) {
    var k = KINDS.filter(function (x) { return x.id === e.kind; })[0], row = null;
    if (e.to === key && (!e.from.key || e.from.key !== key)) row = { kind: e.kind, side: 'in', label: label(e.kind, 'in', lang), from: e.from, to: e.to, extra: e.extra || '' };
    else if (k.out && e.from.key === key && e.to !== key) row = { kind: e.kind, side: 'out', label: label(e.kind, 'out', lang), from: { type: 'card', key: e.to, title: title(e.to) }, to: key, extra: e.extra || '' };
    if (!row) return;
    var id = row.kind + '|' + row.side + '|' + row.from.type + '|' + (row.from.key || row.from.id);
    if (seen[id]) return; seen[id] = 1;
    out.push(row);
  });
  return out;
}

var CARD_REFS = { KINDS: KINDS, edges: edges, usedBy: usedBy, label: label, narrKey: narrKey, cardKey: cardKey };
if (typeof module !== 'undefined' && module.exports) module.exports = CARD_REFS;
if (typeof window !== 'undefined') window.__CARD_REFS = CARD_REFS;
})();
