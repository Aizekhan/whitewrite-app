// ws-data.jsx — DATA is now a PROJECTION over the single canonical WORLD
// (wt-world.jsx). The Director reads the SAME entities the World Tree and the
// reconstruction engine operate on — one source of truth, no drift.
const _firstName = (id) => { const e = wEnt("characters", id); return e ? e.name.split(" ")[0].replace(/[«»]/g, "") : id; };
const _locName = (id) => { const l = wEnt("locations", id); return l ? l.name : id; };
const CUR_SCENE = 3;

// Director-only production attributes (status / length) — not canon.
const _SCN = {
  1: { st: "done", words: 540, dur: "3:10" }, 2: { st: "done", words: 610, dur: "3:40" },
  3: { st: "draft", words: 650, dur: "3:55" }, 4: { st: "draft", words: 420, dur: "2:30" },
  5: { st: "review", words: 780, dur: "4:20" }, 6: { st: "pending", words: 0, dur: "—" },
  7: { st: "pending", words: 0, dur: "—" }, 8: { st: "pending", words: 0, dur: "—" }, 9: { st: "pending", words: 0, dur: "—" },
};
const _LOCICON = { earthcmd: "globe", beta7: "pin", alpha: "signal", aurora: "rocket", helios: "globe", gamma: "pin", "relay-belt": "signal", medbay: "pin" };

const DATA = {
  project: "Червоний сигнал",
  scene: { n: CUR_SCENE, title: (wScene(CUR_SCENE) || {}).title || "" },

  // canon — straight from WORLD (same objects the universe uses)
  characters: WORLD.characters,

  // relationship spokes around the protagonist (RelGraph hub = Маркус)
  rels: (wEnt("characters", "marcus").relations || []).map((r) => ({ a: "Маркус", b: _firstName(r.id), kind: r.kind, tone: r.tone })),

  location: WORLD.locations.find((x) => x.cur) || WORLD.locations[0],
  locations: WORLD.locations.map((l) => ({ name: l.name, icon: _LOCICON[l.id] || "pin", cur: !!l.cur })),

  // scenes projected + Director production fields
  scenes: WORLD.scenes.map((s) => ({
    n: s.n, title: s.title, act: s.act,
    st: (_SCN[s.n] || {}).st || "pending",
    chars: (s.characters || []).map(_firstName),
    loc: (s.locations && s.locations[0]) ? _locName(s.locations[0]) : "—",
    words: (_SCN[s.n] || {}).words || 0,
    dur: (_SCN[s.n] || {}).dur || "—",
    cur: s.n === CUR_SCENE,
  })),

  // shots of the current scene — the SAME shot objects the engine references
  shots: WORLD.shots.filter((sh) => sh.scene === CUR_SCENE).map((sh, i) => ({
    n: i + 1, type: sh.type, dur: sh.dur, camera: sh.camera, angle: sh.angle,
    subject: sh.subject, light: sh.light, moods: sh.moods || [], prompt: sh.prompt, generated: !!sh.generated,
  })),

  // world bible & rules — from canon
  bible: WORLD.world.facts.slice(0, 4),
  rules: WORLD.world.rules,

  // Director-only memory flavour (plot threads, continuity, tension curve)
  threads: [
    { t: "Ретранслятори виходять з ладу по всій системі", st: "done" },
    { t: "Родина Маркуса застрягла на Землі", st: "active" },
    { t: "Виявлено джерело загадкового сигналу", st: "active" },
    { t: "Минуле Елени, пов'язане з технологією ретрансляторів", st: "pending" },
  ],
  continuity: [
    { icon: "alert", t: "У Маркуса травмована ліва рука (з 2-ї сцени).", tone: "warn" },
    { icon: "clock", t: "Буря прийде за 2 години (встановлено в 1-й сцені).", tone: "time" },
    { icon: "alert", t: "Скафандр пошкоджено — запас повітря обмежений.", tone: "warn" },
  ],
  tension: [0.25, 0.4, 0.55, 0.42, 0.6, 0.5, 0.78, 0.65, 0.95],
};

const ST_LABEL = { draft: "Чернетка", review: "Рев'ю", ready: "Готово", done: "Завершено", pending: "Не почато", active: "Активна" };
const ST_PILL = { draft: "draft", review: "review", ready: "ready", done: "done", pending: "draft", active: "review" };

window.DATA = DATA; window.ST_LABEL = ST_LABEL; window.ST_PILL = ST_PILL;
