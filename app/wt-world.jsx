// ============================================================================
// WORLD — normalized universe model for the World Tree workspaces.
// Every entity has an `id`. Cross-links are arrays NAMED BY TARGET TYPE
// (characters / locations / events / factions / artifacts) so reverse links
// can be derived uniformly. Universe: «Червоний сигнал» (hard-SF, Mars).
// ============================================================================
const WORLD = {
  world: {
    tagline: "Колонії Марса вмовкли. Тиша поширюється швидше за світло.",
    summary:
      "2157 рік. Мережа квантових ретрансляторів, що тримала зв'язок між Землею та марсіанськими колоніями, розпадається вузол за вузлом. Кожен збій відрізає черговий форпост від людства. У цій тиші ще лунає один сигнал — і ніхто не знає, хто його надсилає.",
    facts: [
      { k: "Рік", v: "2157" }, { k: "Сетинг", v: "Колонії Марса та Земля" },
      { k: "Технології", v: "Міжпланетні польоти, квантовий зв'язок" },
      { k: "Жанр", v: "Hard SF · виживання" },
      { k: "Конфлікт", v: "Збій зв'язку ізолює колонії" },
      { k: "Тон", v: "Холодний, самотній, напружений" },
    ],
    rules: [
      "Квантовий зв'язок потребує робочих ретрансляторів — без них тиша абсолютна.",
      "Пилові бурі глушать сигнал на годинами.",
      "Кисневі скафандри мають обмежений ресурс — час завжди проти героїв.",
      "Жоден сигнал не рухається швидше за світло, окрім одного — Оріона.",
    ],
    palette: ["#c2542a", "#7a2f1c", "#d9a441", "#2a1c16", "#8a857e"],
  },

  // ---- Characters ----
  characters: [],

  // ---- Locations ----
  locations: [],

  // ---- Events ----
  events: [],

  // ---- Factions ----
  factions: [],

  // ---- Artifacts ----
  artifacts: [],

  scenes: [],

  // ---- Narrative layer (what DEPENDS ON the canon) ----
  // Each item references entities by target-type-plural, so the dependency
  // index can answer "what is affected if I change this entity?".
  dialogues: [
    { id: "dlg-silence", scene: 1, title: "Тиша в ефірі", line: "— Базо, ви мене чуєте?.. Базо?", characters: ["marcus", "dispatch"], locations: ["beta7", "earthcmd"] },
    { id: "dlg-contact", scene: 2, title: "Перший контакт", line: "— Ти не сам. Я ще тримаю вузол.", characters: ["marcus", "elena"], locations: ["beta7"] },
    { id: "dlg-console", scene: 3, title: "Мертва консоль", line: "— Іві, скільки повітря? — Достатньо, щоб спробувати ще раз.", characters: ["marcus", "ivi"], locations: ["beta7"], artifacts: ["suit"] },
    { id: "dlg-signal", scene: 4, title: "Сигнал у статиці", line: "— Це не шум. Це хтось.", characters: ["elena"], locations: ["alpha"], artifacts: ["alpha-node"] },
    { id: "dlg-hope", scene: 5, title: "Повернення надії", line: "— Ще один форпост. Ще один шанс.", characters: ["marcus", "rein"], locations: ["aurora"] },
    { id: "dlg-lie", scene: 6, title: "Корпоративна правда", line: "— Вони знали. Весь цей час вони знали.", characters: ["brandt", "voss"], locations: ["earthcmd"], factions: ["helios"], artifacts: ["helios-files"] },
    { id: "dlg-cost", scene: 7, title: "Ціна тиші", line: "— Якщо я не повернуся — передай їй, що я чув.", characters: ["marcus", "ivi"], locations: ["beta7"], artifacts: ["locket"] },
    { id: "dlg-last", scene: 8, title: "Остання передача", line: "— Канал відкрито. Говори, Земле.", characters: ["elena", "daria"], locations: ["alpha"], artifacts: ["quantum-key"] },
    { id: "dlg-voice", scene: 9, title: "Голос крізь зорі", line: "— Тату? — Я тут. Я завжди був тут.", characters: ["marcus", "orion", "mara"], artifacts: ["orion-tx"] },
  ],
  arcs: [
    { id: "arc-marcus", title: "Шлях Маркуса", span: "Акт 1–3", desc: "Від відчаю до надії крізь мовчання мережі.",
      characters: ["marcus", "ivi", "mara"], scenes: [1, 3, 5, 7, 9], events: ["silence", "finale"], artifacts: ["suit", "locket"] },
    { id: "arc-elena", title: "Становлення Елени", span: "Акт 1–3", desc: "Від сумніву до впевненості майстра ретрансляції.",
      characters: ["elena", "daria"], scenes: [2, 3, 4, 8], events: ["orion-detected", "alpha-reached"], factions: ["sisters"], artifacts: ["alpha-node", "quantum-key"] },
    { id: "arc-silence", title: "Велике мовчання", span: "Акт 1–2", desc: "Хроніка розпаду мережі та її прихованих причин.",
      characters: ["dispatch", "voss"], scenes: [1, 6], events: ["silence", "collapse", "helios-coverup"], locations: ["relay-belt", "gamma"], factions: ["helios", "admin"] },
    { id: "arc-helios", title: "Брехня «Геліос»", span: "Акт 2", desc: "Викриття корпоративної причетності до катастрофи.",
      characters: ["brandt", "voss", "elena"], scenes: [6], events: ["helios-coverup"], factions: ["helios"], artifacts: ["helios-files", "blackbox"] },
    { id: "arc-orion", title: "Загадка Оріона", span: "Акт 2–3", desc: "Природа надсвітлового сигналу й те, ким він виявиться.",
      characters: ["orion", "marcus", "mara"], scenes: [4, 9], events: ["orion-detected", "finale"], artifacts: ["orion-tx"], factions: ["orion"] },
  ],
  // Shots: generated per-scene via "Розрахувати кадри" button
  shots: [],

  // ---- Narrative grouping: chapters gather scenes ----
  chapters: [
    { id: "ch-1", title: "Розділ I · Тиша", act: 1, scenes: [1, 2, 3] },
    { id: "ch-2", title: "Розділ II · Сигнал", act: 2, scenes: [4, 5, 6] },
    { id: "ch-3", title: "Розділ III · Голос", act: 3, scenes: [7, 8, 9] },
  ],

  // ---- Director layer ----
  // storyboards belong to a scene; shots belong to a scene; images to a shot.
  storyboards: [
    { id: "stb-1", scene: 1, title: "Розкадровка · Тиша над колонією" },
    { id: "stb-2", scene: 2, title: "Розкадровка · Перший контакт" },
    { id: "stb-3", scene: 3, title: "Розкадровка · Зламаний ретранслятор" },
    { id: "stb-4", scene: 4, title: "Розкадровка · Сигнал" },
    { id: "stb-5", scene: 5, title: "Розкадровка · Повернення надії" },
    { id: "stb-6", scene: 6, title: "Розкадровка · Корпоративна брехня" },
    { id: "stb-7", scene: 7, title: "Розкадровка · Ціна тиші" },
    { id: "stb-8", scene: 8, title: "Розкадровка · Остання передача" },
    { id: "stb-9", scene: 9, title: "Розкадровка · Голос крізь зорі" },
  ],
  images: [
    { id: "im-1", shot: "sh-1", status: "done" }, { id: "im-2", shot: "sh-2", status: "done" },
    { id: "im-3", shot: "sh-3", status: "pending" }, { id: "im-4", shot: "sh-4", status: "pending" },
    { id: "im-5", shot: "sh-5", status: "done" }, { id: "im-6", shot: "sh-6", status: "pending" },
    { id: "im-7", shot: "sh-7", status: "done" }, { id: "im-8", shot: "sh-8", status: "pending" },
    { id: "im-9", shot: "sh-9", status: "pending" }, { id: "im-10", shot: "sh-10", status: "pending" },
  ],
};

// ---- resolvers ----
const W_TYPES = ["characters", "locations", "events", "factions", "artifacts"];
function wEnt(type, id) { return (WORLD[type] || []).find((e) => e.id === id) || null; }
function wTitle(type, e) { return type === "events" ? e.title : e.name; }

// All connections of an entity (forward links + derived reverse links),
// returned as [{ type, id, rel }]. `rel` carries relationship flavour when known.
// Memoised — WORLD is read-only at runtime.
const _connCache = new Map();
function wConnections(type, id) {
  const _ck = type + ":" + id;
  if (_connCache.has(_ck)) return _connCache.get(_ck);
  const _r = _computeConnections(type, id);
  _connCache.set(_ck, _r);
  return _r;
}
function _computeConnections(type, id) {
  const e = wEnt(type, id);
  if (!e) return [];
  const out = [], seen = new Set();
  const push = (t, i, rel) => {
    if (!i) return; const k = t + ":" + i;
    if (seen.has(k) || (t === type && i === id)) return;
    if (!wEnt(t, i)) return;
    seen.add(k); out.push({ type: t, id: i, rel });
  };
  // forward
  W_TYPES.forEach((t) => (e[t] || []).forEach((i) => push(t, i)));
  (e.relations || []).forEach((r) => push("characters", r.id, r.kind));
  push("characters", e.owner, "власник");
  push("locations", e.location);
  push("factions", e.faction);
  // reverse — scan every entity for a link back to (type,id)
  W_TYPES.forEach((t) => WORLD[t].forEach((o) => {
    if (t === type && o.id === id) return;
    if ((o[type] || []).includes(id)) push(t, o.id);
    if (type === "characters" && (o.relations || []).some((r) => r.id === id)) push(t, o.id, ((o.relations || []).find((r) => r.id === id) || {}).kind);
    if (type === "characters" && o.owner === id) push(t, o.id);
    if (type === "locations" && o.location === id) push(t, o.id);
    if (type === "factions" && o.faction === id) push(t, o.id);
  }));
  return out;
}

window.WORLD = WORLD;
window.wEnt = wEnt; window.wTitle = wTitle; window.wConnections = wConnections; window.W_TYPES = W_TYPES;

// ---- dependency / "Referenced By" index ----
// Derive each scene's direct entity references from the canon (single source
// of truth: entity.scenes / artifact.scene). Events & factions are abstract
// and intentionally NOT bound to scenes here.
WORLD.scenes.forEach((s) => {
  s.characters = WORLD.characters.filter((c) => (c.scenes || []).includes(s.n)).map((c) => c.id);
  s.locations = WORLD.locations.filter((l) => (l.scenes || []).includes(s.n)).map((l) => l.id);
  s.artifacts = WORLD.artifacts.filter((a) => a.scene === s.n).map((a) => a.id);
});

// Everything in the narrative layer that DEPENDS ON an entity.
const NARRATIVE = ["scenes", "dialogues", "arcs", "shots"];
function wReferences(type, id) {
  const out = {};
  NARRATIVE.forEach((k) => { out[k] = WORLD[k].filter((item) => (item[type] || []).includes(id)); });
  return out;
}
function wImpact(type, id) {
  const r = wReferences(type, id);
  const o = { total: 0 };
  NARRATIVE.forEach((k) => { o[k] = r[k].length; o.total += r[k].length; });
  return o;
}
function wScene(n) { return WORLD.scenes.find((s) => s.n === n) || null; }

window.wReferences = wReferences; window.wImpact = wImpact; window.wScene = wScene; window.NARRATIVE = NARRATIVE;
