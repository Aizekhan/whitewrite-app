// ============================================================================
// WORLD — the loaded story's canon for the book (Related panel, inline continuity).
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
};

// ---- resolvers ----
function wEnt(type, id) { return (WORLD[type] || []).find((e) => e.id === id) || null; }
function wTitle(type, e) { return type === "events" ? e.title : e.name; }

window.WORLD = WORLD;
window.wEnt = wEnt; window.wTitle = wTitle;

// Load a project's canon into WORLD — the ONE way every pillar swaps worlds.
// Mutates in place (same object ⇒ DATA projection / captured refs stay valid),
// empties layers the new world doesn't have (no demo narrative mixed into real
// canon).
function wSetWorld(next) {
  Object.keys(WORLD).forEach((k) => { if (!(k in next) && Array.isArray(WORLD[k])) WORLD[k].length = 0; });
  Object.keys(next).forEach((k) => {
    if (Array.isArray(WORLD[k]) && Array.isArray(next[k])) { WORLD[k].length = 0; WORLD[k].push(...next[k]); }
    else WORLD[k] = next[k];
  });
}
window.wSetWorld = wSetWorld;

function wScene(n) { return WORLD.scenes.find((s) => s.n === n) || null; }

window.wScene = wScene;
