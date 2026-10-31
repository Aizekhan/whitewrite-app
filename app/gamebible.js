// Game Bible: the games built on one world's canon. One canon → many games.
//   worlds/{w}/entities/{id}                 the CANON (shared with stories and every game)
//   worlds/{w}/games/{g}                     { title, engine: { profile }, sections: [{ id, name, about }] }
//   worlds/{w}/games/{g}/cards/{id}          game cards { section, title, status, note, defs: [{ key, label }], fields: { key: value } }
//                                            for a canon entity: id = entity id, + canonRef — the entity's role in THIS game
//   worlds/{w}/games/{g}/plan/current        { gdd, asked, answers, contradictions, plan } — by the gamedevPlan
//                                            Cloud Function, except `answers` and imported questions (the author's own)
// The entity's name/description stay canon (edited here they change for everyone); game fields never touch canon.
(function () {
  var LANG = "uk";
  try { LANG = (window.parent.__i18n && window.parent.__i18n.getLanguage()) || localStorage.getItem("ww-lang") || "uk"; } catch (e) {}
  if (LANG !== "en") LANG = "uk";
  document.documentElement.lang = LANG;

  var STR = {
    uk: {
      brand: "Біблія гри", engine: "Рушій гри", search: "Пошук по канону й грі: назва, опис, примітка…",
      canonGroup: "Канон світу", gameGroup: "Гра", newGame: "+ Нова гра", gameName: "Назва гри", gameNamePh: "Напр. «MythRunner»",
      createGame: "Створити гру", firstGame: "Перша гра на цьому каноні",
      firstGameText: "Канон світу — спільний: персонажі, місця, закони. Гра бере з нього все потрібне й додає свої механіки, ассети і план. На одному каноні можна зробити кілька різних ігор.",
      addCard: "+ Нова картка", addSection: "+ Свій розділ", sectionName: "Назва розділу, напр. «Звук»",
      sectionAbout: "Про що цей розділ (необовʼязково)", create: "Створити", cancel: "Скасувати",
      save: "Зберегти", close: "Закрити", remove: "Прибрати картку", hide: "Прибрати з цієї гри", deleteSection: "Видалити розділ",
      found: "Знайдено", nothing: "Нічого не знайдено.", newCard: "Нова картка", other: "Інше",
      note: "Примітка для Claude", noteHint: "що зробити з цим у грі", notePh: "Напр.: зроби темнішим, перегенеруй з меншим polycount, додай у GDD…",
      blank: "порожньо — натисни, щоб заповнити", addField: "Додати поле", addFieldPh: "Назва поля, напр. «Звук» або «Референс»", add: "Додати",
      canonTag: "канон", canonField: "канон — спільне для всіх історій та ігор", worldCanon: "Канон світу", laws: "Закони світу", facts: "Факти",
      worldReadonly: "Канон світу редагується у Дереві всесвіту. Тут — те, на що спирається кожна гра.",
      saved: "Збережено", saving: "Зберігаю…", failed: "Не вдалося зберегти", confirmDel: "Прибрати цю картку назавжди?",
      confirmSec: "Видалити розділ? Картки в ньому теж буде видалено.",
      live: "Зміни зберігаються в світі.", offline: "Немає звʼязку з базою.",
      lockedTitle: "Біблія гри — для геймдеву", lockedText: "Біблія гри та Продакшн-план доступні на тарифі Worldbuilder. Канон світу й історії лишаються з тобою на будь-якому тарифі.",
      upgrade: "Переглянути тарифи", noWorld: "Світ не знайдено.", login: "Увійди, щоб відкрити біблію.",
      importMd: "⬆ Імпорт .md", importTitle: "Імпорт нотаток", importBusy: "AI розбирає файл по полицях… (до кількох хвилин)",
      importIntro: "Перевір, що AI знайшов у файлі. У канон і картки потрапить лише відмічене.",
      importApply: "Додати відмічене", importDone: "Додано", importNew: "нове в каноні", importMatch: "вже є в каноні — додати ігрові поля",
      importLaws: "Нові закони світу", importCards: "Картки гри", importCanon: "Сутності канону", importQs: "Відкриті питання → у Продакшн-план",
      importContra: "Суперечності → у Продакшн-план", importTooBig: "Файл завеликий (максимум 100 000 символів).",
      analyze: "✦ Проаналізувати біблію", reanalyze: "↻ Оновити аналіз", makePlan: "✦ Згенерувати план розробки", remakePlan: "↻ Перегенерувати план",
      exportMd: "⬇ Markdown для репозиторію", busyAnalyze: "AI читає всю біблію і складає гейм-диздок… (до хвилини)",
      busyPlan: "AI складає план розробки… (може зайняти кілька хвилин)", costNote: "AI-аналіз, імпорт і план списують токени з балансу.",
      planIntro: "Спершу AI прочитає канон і всю біблію гри: складе гейм-диздок, знайде суперечності й поставить невирішені питання. Твої відповіді записуються назад у картки. Коли блокери закрито — генеруй план.",
      readiness: "Готовність дизайну", gddTitle: "Гейм-диздок", contradictions: "Суперечності", questionsTitle: "Невирішені питання",
      answeredTitle: "Ухвалені рішення", answer: "Відповісти", answerPh: "Твоє рішення…", blockersLeft: "Спершу дай відповідь на блокери",
      planTitle: "План розробки", gate: "Ворота", goal: "Мета", deps: "залежить від", prompt: "Промпт для Claude Code", copy: "Копіювати",
      copied: "Скопійовано", parallel: "Паралельні потоки", risks: "Ризики", gaps: "Прогалини рушія / фреймворку", engineNotes: "Про рушій",
      spent: "Списано токенів", writtenTo: "записано в картку",
      prio: { blocker: "блокер", important: "важливо", nice: "бажано" },
      st: { solid: "готово", partial: "частково", missing: "бракує" }
    },
    en: {
      brand: "Game Bible", engine: "Game engine", search: "Search canon and game: title, text, note…",
      canonGroup: "World canon", gameGroup: "Game", newGame: "+ New game", gameName: "Game title", gameNamePh: "E.g. “MythRunner”",
      createGame: "Create game", firstGame: "The first game on this canon",
      firstGameText: "The world canon is shared: characters, places, laws. A game takes what it needs and adds its own mechanics, assets and plan. One canon can carry several different games.",
      addCard: "+ New card", addSection: "+ Own section", sectionName: "Section name, e.g. “Sound”",
      sectionAbout: "What this section is about (optional)", create: "Create", cancel: "Cancel",
      save: "Save", close: "Close", remove: "Remove card", hide: "Remove from this game", deleteSection: "Delete section",
      found: "Found", nothing: "Nothing found.", newCard: "New card", other: "Other",
      note: "Note for Claude", noteHint: "what to do with it in the game", notePh: "E.g.: make it darker, regenerate with lower polycount, add to the GDD…",
      blank: "empty — click to fill in", addField: "Add field", addFieldPh: "Field name, e.g. “Sound” or “Reference”", add: "Add",
      canonTag: "canon", canonField: "canon — shared by every story and game", worldCanon: "World canon", laws: "Laws of the world", facts: "Facts",
      worldReadonly: "The world canon is edited in the Universe tree. Here is what every game stands on.",
      saved: "Saved", saving: "Saving…", failed: "Could not save", confirmDel: "Remove this card for good?",
      confirmSec: "Delete the section? Its cards will be deleted too.",
      live: "Changes are saved in the world.", offline: "No connection to the database.",
      lockedTitle: "Game Bible — for game dev", lockedText: "The Game Bible and Production Plan are available on the Worldbuilder plan. Your world canon and stories stay with you on any plan.",
      upgrade: "See plans", noWorld: "World not found.", login: "Sign in to open the bible.",
      importMd: "⬆ Import .md", importTitle: "Import notes", importBusy: "AI is sorting the file onto the shelves… (up to a few minutes)",
      importIntro: "Check what AI found in the file. Only the ticked items go into the canon and the cards.",
      importApply: "Add ticked items", importDone: "Added", importNew: "new in canon", importMatch: "already in canon — add game fields",
      importLaws: "New laws of the world", importCards: "Game cards", importCanon: "Canon entities", importQs: "Open questions → Production plan",
      importContra: "Contradictions → Production plan", importTooBig: "The file is too big (100,000 characters max).",
      analyze: "✦ Analyze the bible", reanalyze: "↻ Refresh analysis", makePlan: "✦ Generate the development plan", remakePlan: "↻ Regenerate plan",
      exportMd: "⬇ Markdown for the repo", busyAnalyze: "AI is reading the whole bible and drafting the GDD… (up to a minute)",
      busyPlan: "AI is building the development plan… (may take a few minutes)", costNote: "AI analysis, import and the plan spend tokens from your balance.",
      planIntro: "First AI reads the canon and the whole game bible: drafts the game design doc, finds contradictions and asks the open questions. Your answers are written back into the cards. Once the blockers are closed — generate the plan.",
      readiness: "Design readiness", gddTitle: "Game design doc", contradictions: "Contradictions", questionsTitle: "Open questions",
      answeredTitle: "Decisions made", answer: "Answer", answerPh: "Your decision…", blockersLeft: "Answer the blockers first",
      planTitle: "Development plan", gate: "Gate", goal: "Goal", deps: "depends on", prompt: "Prompt for Claude Code", copy: "Copy",
      copied: "Copied", parallel: "Parallel streams", risks: "Risks", gaps: "Engine / framework gaps", engineNotes: "Engine notes",
      spent: "Tokens spent", writtenTo: "written to card",
      prio: { blocker: "blocker", important: "important", nice: "nice to have" },
      st: { solid: "solid", partial: "partial", missing: "missing" }
    }
  }[LANG];
  var L = function (o) { return typeof o === "string" ? o : (o[LANG] || o.uk); };

  var STATUSES = [
    { id: "idea", cls: "s-idea", uk: "ідея", en: "idea" },
    { id: "agreed", cls: "s-agreed", uk: "погоджено", en: "agreed" },
    { id: "work", cls: "s-work", uk: "в роботі", en: "in progress" },
    { id: "ingame", cls: "s-game", uk: "в грі", en: "in game" },
    { id: "redo", cls: "s-redo", uk: "замінити", en: "replace" },
  ];
  var STATUS = {}; STATUSES.forEach(function (s) { STATUS[s.id] = s; });

  var ENGINES = [
    { id: "generic", uk: "Загальний (будь-який рушій)", en: "Generic (any engine)" },
    { id: "rpg-framework", uk: "RPG Framework · Unity", en: "RPG Framework · Unity" },
  ];

  // Field templates: a new card starts with the structure of its section.
  var F = function (key, uk, en) { return { key: key, label: LANG === "en" ? en : uk }; };
  var CANON = [
    { id: "world", special: "world", uk: "Світ і закони", en: "World & laws",
      about: { uk: "Опис світу, закони й факти — фундамент кожної гри на цьому каноні.", en: "The world, its laws and facts — the ground of every game on this canon." } },
    { id: "characters", canon: "characters", uk: "Персонажі", en: "Characters",
      about: { uk: "Герої й NPC канону. Імʼя й опис — спільні; роль, числа і модель — лише цієї гри.", en: "Canon heroes and NPCs. Name and description are shared; role, numbers and model belong to this game." },
      defs: [F("role", "Роль у грі", "Game role"), F("kit", "Зброя й здібності", "Weapons & abilities"), F("numbers", "Числа", "Numbers"),
             F("strengths", "Сильні / слабкі сторони", "Strengths / weaknesses"), F("model", "Модель / префаб", "Model / prefab")] },
    { id: "locations", canon: "locations", uk: "Локації", en: "Locations",
      about: { uk: "Місця канону як рівні цієї гри: розмір, палітра, світло, хто там живе.", en: "Canon places as this game's levels: size, palette, light, who lives there." },
      defs: [F("level", "Тип рівня", "Level type"), F("size", "Розмір і траса", "Size & route"), F("look", "Палітра й світло", "Palette & light"),
             F("enemies", "Вороги", "Enemies"), F("assets", "Ассети", "Assets")] },
    { id: "factions", canon: "factions", uk: "Фракції", en: "Factions",
      about: { uk: "Сили канону та їхня роль у геймплеї цієї гри.", en: "Canon powers and their role in this game's gameplay." },
      defs: [F("gameplay", "Роль у геймплеї", "Role in gameplay"), F("rewards", "Що дає гравцю", "What it gives the player")] },
    { id: "items", canon: "artifacts", uk: "Артефакти", en: "Artifacts",
      about: { uk: "Артефакти канону як ігрові предмети.", en: "Canon artifacts as game items." },
      defs: [F("type", "Тип", "Type"), F("effect", "Ефект", "Effect"), F("numbers", "Числа", "Numbers"), F("source", "Як отримати", "How to get")] },
  ];
  var GAME = [
    { id: "overview", uk: "Огляд гри", en: "Game overview",
      about: { uk: "Що це за гра: логлайн, жанр, стовпи, ігровий цикл, платформа, референси.", en: "What the game is: logline, genre, pillars, core loop, platform, references." },
      defs: [F("logline", "Логлайн", "Logline"), F("genre", "Жанр", "Genre"), F("pillars", "Стовпи гри (3–4)", "Game pillars (3–4)"),
             F("loop", "Ігровий цикл", "Core loop"), F("platform", "Платформа", "Platform"), F("session", "Тривалість сесії", "Session length"),
             F("players", "Гравці (соло / кооп / PvP)", "Players (solo / co-op / PvP)"), F("refs", "Референси: гра → що саме беремо", "References: game → what we take"),
             F("style", "Візуальний стиль", "Visual style")] },
    { id: "lore", uk: "Лор гри", en: "Game lore",
      about: { uk: "Як ця гра подає світ: епоха, сюжет гри, тон, таємниці. Канон — у «Світ і закони».", en: "How this game presents the world: era, game plot, tone, secrets. Canon is in “World & laws”." },
      defs: [F("text", "Опис", "Description")] },
    { id: "mechanics", uk: "Механіки", en: "Mechanics", group: "group",
      about: { uk: "Правила гри з числами. Правка тут — це завдання змінити гру.", en: "Game rules with numbers. An edit here is a task to change the game." },
      defs: [F("group", "Група", "Group"), F("text", "Опис", "Description"), F("numbers", "Правила й числа", "Rules & numbers"), F("deps", "Залежить від", "Depends on")] },
    { id: "enemies", uk: "Вороги й боси", en: "Enemies & bosses", group: "group",
      about: { uk: "Хто стоїть на шляху, як бʼє і куди його бити.", en: "Who stands in the way, how it hits and where to hit it." },
      defs: [F("group", "Тип (ворог / бос)", "Type (enemy / boss)"), F("behaviour", "Поведінка", "Behaviour"), F("attacks", "Атаки", "Attacks"),
             F("weakness", "Як перемогти", "How to beat"), F("numbers", "Числа", "Numbers"), F("model", "Модель / префаб", "Model / prefab")] },
    { id: "assets", uk: "Ассети й префаби", en: "Assets & prefabs", group: "category",
      about: { uk: "Моделі, матеріали, звук: що вже є і що треба зробити — функція, розмір, пріоритет, промпт.", en: "Models, materials, sound: what exists and what to make — function, size, priority, prompt." },
      defs: [F("category", "Категорія", "Category"), F("function", "Функція", "Function"), F("size", "Розмір", "Size"),
             F("priority", "Пріоритет", "Priority"), F("prompt", "Промпт генерації", "Generation prompt"), F("source", "Джерело", "Source")] },
  ];
  var PLAN = { id: "plan", special: "plan", uk: "Продакшн-план", en: "Production plan",
    about: { uk: "Інтерактивний гейм-диздок і точний план розробки, складені з канону та всієї біблії гри.", en: "An interactive game design doc and a precise development plan built from the canon and the whole game bible." } };
  var CUSTOM_DEFS = [F("text", "Опис", "Description")];
  var PREFIX = { characters: "char", locations: "loc", factions: "fac", artifacts: "art", events: "evt" };
  var FN = "https://us-central1-whitewrite-app.cloudfunctions.net/gamedevPlan";

  // ---------- state ----------
  var params = new URLSearchParams(location.search);
  var worldId = params.get("worldId");
  var db = null, world = null, games = [], gameId = null, game = null;
  var cards = [], entities = [], planDoc = {}, canWrite = false, unsub = [];
  var section = "overview", query = "", statusFilter = {};
  var open = null, draft = null, planBusy = null, planMsg = "", imp = null; // imp: { busy, proposal, error, done }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var newId = function (p) { return p + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
  var stamp = function () { return firebase.firestore.FieldValue.serverTimestamp(); };
  var wref = function () { return db.collection("worlds").doc(worldId); };
  var gref = function () { return wref().collection("games").doc(gameId); };
  var entityId = function (kind) { return PREFIX[kind] + "_" + Array.from(crypto.getRandomValues(new Uint8Array(3)), function (b) { return b.toString(16).padStart(2, "0"); }).join(""); };
  function slugify(name) { return String(name || "").toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""); }
  var fieldKey = function (label) { return "x_" + String(label).toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "_").slice(0, 40); };

  function gameSections() {
    var own = ((game && game.sections) || []).map(function (s) { return { id: s.id, uk: s.name, en: s.name, about: s.about || "", custom: true, defs: CUSTOM_DEFS }; });
    return GAME.concat(own, [PLAN]);
  }
  function sections() { return CANON.concat(gameSections()); }
  function sec(id) { return sections().filter(function (s) { return s.id === id; })[0] || GAME[0]; }

  // Unified card view: a canon entity seen through this game, or a game-only card.
  function canonCard(e, s) {
    var c = cards.filter(function (x) { return x.canonRef === e.id; })[0] || {};
    var descKey = e.desc !== undefined || e.description === undefined ? "desc" : "description";
    var extra = (c.defs || []).filter(function (d) { return !s.defs.some(function (x) { return x.key === d.key; }); });
    return { key: "e:" + e.id, src: "canon", id: e.id, section: s.id, title: e.name || e.title || "", status: c.status || "idea", note: c.note || "",
      canonDesc: { key: descKey, value: e[descKey] || "" }, defs: s.defs.concat(extra), extraDefs: extra, fields: c.fields || {}, hidden: !!c.hidden };
  }
  function gameCard(c) {
    var s = sec(c.section);
    return { key: "c:" + c.id, src: "game", id: c.id, section: c.section, title: c.title || "", status: c.status || "idea", note: c.note || "",
      defs: (c.defs && c.defs.length) ? c.defs : (s.defs || CUSTOM_DEFS), fields: c.fields || {} };
  }
  function allCards() {
    var out = [];
    CANON.forEach(function (s) {
      if (s.canon) entities.filter(function (e) { return e.kind === s.canon; }).forEach(function (e) { var c = canonCard(e, s); if (!c.hidden) out.push(c); });
    });
    cards.forEach(function (c) { if (!c.canonRef) out.push(gameCard(c)); });
    return out;
  }

  // ---------- markdown (tables, lists, bold, code) ----------
  function md(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n"), html = "", i = 0;
    var inline = function (s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<i>$2</i>"); };
    while (i < lines.length) {
      var l = lines[i];
      if (/^```/.test(l)) { var j = i + 1, buf = []; while (j < lines.length && !/^```/.test(lines[j])) buf.push(lines[j++]); html += "<pre>" + esc(buf.join("\n")) + "</pre>"; i = j + 1; continue; }
      if (/^\s*\|/.test(l)) {
        var rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
        var cells = function (r) { return r.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); };
        rows = rows.filter(function (r, k) { return !(k === 1 && /^[\s|:-]+$/.test(r)); });
        html += "<table>" + rows.map(function (r, k) { return "<tr>" + cells(r).map(function (c) { return k === 0 ? "<th>" + inline(c) + "</th>" : "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table>";
        continue;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        var ordered = /^\s*\d+\./.test(l), items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        html += (ordered ? "<ol>" : "<ul>") + items.map(function (t) { return "<li>" + inline(t) + "</li>"; }).join("") + (ordered ? "</ol>" : "</ul>");
        continue;
      }
      if (/^#{2,4}\s/.test(l)) { html += "<h4>" + inline(l.replace(/^#+\s*/, "")) + "</h4>"; i++; continue; }
      if (!l.trim()) { i++; continue; }
      var para = []; while (i < lines.length && lines[i].trim() && !/^\s*(\||[-*]\s|\d+\.\s|#{2,4}\s|```)/.test(lines[i])) para.push(lines[i++]);
      if (para.length) html += "<p>" + inline(para.join(" ")) + "</p>"; else i++;
    }
    return html;
  }

  // ---------- render ----------
  function navItem(s, all) {
    var n = s.special ? "" : all.filter(function (c) { return c.section === s.id; }).length;
    return '<button class="nav-item" data-sec="' + esc(s.id) + '" aria-current="' + (s.id === section && !imp) + '">' + esc(L(s)) + '<span class="n">' + n + '</span></button>';
  }
  function renderNav() {
    var all = allCards();
    $("gamepick").innerHTML = games.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === gameId ? " selected" : "") + '>' + esc(g.title) + '</option>'; }).join("") +
      '<option value="__new">' + esc(STR.newGame) + '</option>';
    $("gamepick").style.display = games.length ? "" : "none";
    $("nav").innerHTML = '<div class="navh">' + STR.canonGroup + '</div>' + CANON.map(function (s) { return navItem(s, all); }).join("") +
      (game ? '<div class="navh">' + STR.gameGroup + ' · ' + esc(game.title) + '</div>' + gameSections().map(function (s) { return navItem(s, all); }).join("") : "");
    $("newsec-slot").innerHTML = game ? '<button class="nav-add" id="sec-add">' + STR.addSection + '</button>' : '';
    $("engine-box").style.display = game ? "" : "none";
  }

  function excerpt(c) {
    var v = c.canonDesc && c.canonDesc.value;
    if (!v) { var d = c.defs.filter(function (d) { return c.fields[d.key] && d.key !== "group" && d.key !== "category"; })[0]; v = d ? c.fields[d.key] : ""; }
    return String(v || "").replace(/[*`|#>-]+/g, " ").replace(/\s+/g, " ").slice(0, 220);
  }
  function matches(c) {
    var on = Object.keys(statusFilter).filter(function (k) { return statusFilter[k]; });
    if (on.length && on.indexOf(c.status) < 0) return false;
    if (!query) return true;
    var hay = (c.title + " " + c.note + " " + (c.canonDesc ? c.canonDesc.value : "") + " " + Object.keys(c.fields).map(function (k) { return c.fields[k]; }).join(" ")).toLowerCase();
    return query.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
  }
  function cardHtml(c) {
    var st = STATUS[c.status] || STATUS.idea;
    var tags = ['<span class="pill ' + st.cls + '">' + esc(L(st)) + '</span>'];
    if (c.src === "canon") tags.push('<span class="pill canon-pill">' + STR.canonTag + '</span>');
    if (c.note) tags.push('<span class="flag">' + STR.note + '</span>');
    if (query && c.section !== section) tags.push('<span class="pill s-agreed">' + esc(L(sec(c.section))) + '</span>');
    return '<button class="card" data-key="' + esc(c.key) + '"><h3>' + esc(c.title || STR.newCard) + '</h3><div class="tags">' + tags.join("") +
      '</div><p class="ex">' + esc(excerpt(c)) + '</p></button>';
  }

  function render() {
    renderNav();
    if (!game) return renderNewGame();
    if (imp) return renderImport();
    var s = sec(section);
    if (s.special === "plan" && !query) return renderPlan(s);
    if (s.special === "world" && !query) return renderWorld(s);
    var all = allCards();
    var list = query ? all.filter(matches) : all.filter(function (c) { return c.section === section && matches(c); });
    var html = '<header class="sec"><div><h1>' + (query ? STR.found + ": " + list.length : esc(L(s))) + '</h1>' +
      (query ? '' : '<p>' + esc(L(s.about)) + '</p>') + '</div>' +
      (query ? '' : '<div class="row">' + (s.custom ? '<button class="btn danger" id="sec-del">' + STR.deleteSection + '</button>' : '') +
        '<button class="btn primary" id="add-top">' + STR.addCard + '</button></div>') + '</header>';
    if (!list.length) html += '<p class="empty">' + STR.nothing + '</p>';
    else if (!query && s.group) {
      var groups = {}, order = [];
      list.forEach(function (c) { var g = c.fields[s.group] || STR.other; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(c); });
      order.forEach(function (g) { html += '<h2 class="group">' + esc(g) + ' <span>' + groups[g].length + '</span></h2><div class="grid">' + groups[g].map(cardHtml).join("") + '</div>'; });
    } else html += '<div class="grid">' + list.map(cardHtml).join("") + '</div>';
    $("view").innerHTML = html;
    var at = $("add-top"); if (at) at.onclick = addCard;
    var sd = $("sec-del"); if (sd) sd.onclick = deleteSection;
  }

  function renderWorld(s) {
    var w = world || {};
    var fact = function (f) { return typeof f === "string" ? esc(f) : '<b>' + esc(f.k) + ':</b> ' + esc(f.v); };
    $("view").innerHTML = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div></header>' +
      '<div class="canonbox"><h4>' + STR.worldCanon + '</h4>' + (w.tagline ? '<p><i>' + esc(w.tagline) + '</i></p>' : '') + (w.summary ? '<p>' + esc(w.summary) + '</p>' : '') +
      ((w.rules || []).length ? '<h4 style="margin-top:12px">' + STR.laws + '</h4><ol>' + w.rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join("") + '</ol>' : '') +
      ((w.facts || []).length ? '<h4 style="margin-top:12px">' + STR.facts + '</h4><ul>' + w.facts.map(function (f) { return '<li>' + fact(f) + '</li>'; }).join("") + '</ul>' : '') +
      '</div><p class="muted">' + STR.worldReadonly + '</p>';
  }

  function renderNewGame() {
    $("view").innerHTML = '<div class="newgame"><h1>' + STR.firstGame + '</h1><p class="muted">' + STR.firstGameText + '</p>' +
      '<label class="field"><span>' + STR.gameName + '</span><input id="ng-title" placeholder="' + esc(STR.gameNamePh) + '"></label>' +
      '<label class="field"><span>' + STR.engine + '</span><select id="ng-engine">' + ENGINES.map(function (x) { return '<option value="' + x.id + '">' + esc(L(x)) + '</option>'; }).join("") + '</select></label>' +
      '<div class="row">' + (games.length ? '<button class="btn" id="ng-x">' + STR.cancel + '</button>' : '') + '<button class="btn primary" id="ng-ok">' + STR.createGame + '</button></div></div>';
    $("ng-title").focus();
    $("ng-ok").onclick = async function () {
      var title = $("ng-title").value.trim(); if (!title) return;
      var id = newId("game");
      await wref().collection("games").doc(id).set({ title: title, engine: { profile: $("ng-engine").value }, sections: [], createdAt: stamp(), updatedAt: stamp() });
      selectGame(id);
    };
    var x = $("ng-x"); if (x) x.onclick = function () { selectGame(games[0].id); };
  }

  function renderStatuses() {
    $("statuses").innerHTML = STATUSES.map(function (s) {
      return '<button class="chip" data-status="' + s.id + '" aria-pressed="' + !!statusFilter[s.id] + '"><span class="' + s.cls + '">' + esc(L(s)) + '</span></button>';
    }).join("");
  }

  // ---------- editor ----------
  function openCard(c) {
    open = c;
    draft = { title: c.title, status: c.status, note: c.note, fields: Object.assign({}, c.fields), defs: c.defs.slice(),
      canonDesc: c.canonDesc ? c.canonDesc.value : null };
    $("e-kicker").textContent = L(sec(c.section)) + (c.src === "canon" ? " · " + STR.canonTag : " · " + game.title);
    $("e-title").value = c.title;
    $("e-status").innerHTML = STATUSES.map(function (s) { return '<option value="' + s.id + '"' + (s.id === c.status ? " selected" : "") + '>' + esc(L(s)) + '</option>'; }).join("");
    $("e-delete").textContent = c.src === "canon" ? STR.hide : STR.remove;
    $("e-delete").style.display = c.isNew ? "none" : "";
    renderFields(); msg("");
    $("leaf").classList.add("open"); $("leaf").setAttribute("aria-hidden", "false"); $("scrim").classList.add("open");
    $("e-title").focus();
  }

  function fieldHtml(key, label, value, extra) {
    return '<div class="field"><label>' + esc(label) + (extra || "") + '</label><div class="shown' + (value ? "" : " blank") + '" tabindex="0" role="button" data-edit="' + esc(key) + '">' +
      (value ? md(value) : STR.blank) + '</div></div>';
  }
  function renderFields() {
    var html = '<div class="field note"><label for="f-note">' + STR.note + ' <span class="hint">' + STR.noteHint + '</span></label>' +
      '<textarea id="f-note" data-key="__note" rows="2" placeholder="' + esc(STR.notePh) + '">' + esc(draft.note) + '</textarea></div>';
    if (draft.canonDesc !== null) html += fieldHtml("__canon", LANG === "en" ? "Description" : "Опис", draft.canonDesc, ' <span class="canon">· ' + STR.canonField + '</span>');
    draft.defs.forEach(function (d) { html += fieldHtml(d.key, d.label, draft.fields[d.key] || ""); });
    html += '<div class="field"><label for="nf">' + STR.addField + '</label><div class="newfield"><input id="nf" placeholder="' + esc(STR.addFieldPh) + '"><button class="btn" id="nf-add">' + STR.add + '</button></div></div>';
    $("e-body").innerHTML = html;
  }
  function editField(key) {
    var el = document.querySelector('.shown[data-edit="' + CSS.escape(key) + '"]'); if (!el) return;
    var ta = document.createElement("textarea");
    ta.value = key === "__canon" ? draft.canonDesc : (draft.fields[key] || "");
    ta.dataset.key = key;
    ta.rows = Math.min(24, Math.max(3, ta.value.split("\n").length + 1));
    el.replaceWith(ta); ta.focus();
    ta.addEventListener("blur", function () { collect(ta); renderFields(); });
  }
  function collect(ta) {
    var k = ta.dataset.key;
    if (k === "__note") draft.note = ta.value; else if (k === "__canon") draft.canonDesc = ta.value; else draft.fields[k] = ta.value;
  }
  function msg(t) { $("e-msg").textContent = t; }
  function closeLeaf() {
    open = null; draft = null;
    $("leaf").classList.remove("open"); $("leaf").setAttribute("aria-hidden", "true"); $("scrim").classList.remove("open");
  }

  async function save() {
    if (!open) return;
    [].forEach.call(document.querySelectorAll("#e-body textarea"), collect);
    draft.title = $("e-title").value.trim() || open.title || STR.newCard;
    draft.status = $("e-status").value;
    msg(STR.saving);
    try {
      if (open.src === "canon") {
        var s = sec(open.section);
        // canon: only the shared name/description, and only when they changed
        var ent = {};
        if (open.isNew) Object.assign(ent, { id: open.id, kind: s.canon, createdAt: stamp(), origin: { source: "explicit", confidence: null, confirmed: true, createdBy: "user" } });
        if (open.isNew || draft.title !== open.title) { ent.name = draft.title; ent.slug = slugify(draft.title); }
        if (draft.canonDesc !== open.canonDesc.value) ent[open.canonDesc.key] = draft.canonDesc;
        if (Object.keys(ent).length) { ent.updatedAt = stamp(); await wref().collection("entities").doc(open.id).set(ent, { merge: true }); }
        // this game's view of the entity
        var extra = draft.defs.filter(function (d) { return !s.defs.some(function (x) { return x.key === d.key; }); });
        await gref().collection("cards").doc(open.id).set({ section: open.section, canonRef: open.id, status: draft.status, note: draft.note,
          fields: draft.fields, defs: extra, hidden: false, updatedAt: stamp() }, { merge: true });
      } else {
        var body = { section: open.section, title: draft.title, status: draft.status, note: draft.note, defs: draft.defs, fields: draft.fields, updatedAt: stamp() };
        if (open.isNew) { body.createdAt = stamp(); body.order = Date.now(); }
        await gref().collection("cards").doc(open.id).set(body, { merge: true });
      }
      open.isNew = false;
      $("e-delete").style.display = "";
      msg(STR.saved + " · " + new Date().toLocaleTimeString(LANG === "en" ? "en-GB" : "uk-UA"));
    } catch (e) {
      msg(STR.failed + ": " + (e.code || e.message || e));
    }
  }

  async function removeCard() {
    if (!open || open.isNew) return;
    if (open.src === "canon") {
      // the entity stays in the canon; it only leaves this game
      await gref().collection("cards").doc(open.id).set({ section: open.section, canonRef: open.id, hidden: true }, { merge: true });
    } else {
      if (!confirm(STR.confirmDel)) return;
      await gref().collection("cards").doc(open.id).delete();
    }
    closeLeaf();
  }

  function addCard() {
    var s = sec(section);
    var c = s.canon
      ? { key: "new", src: "canon", id: entityId(s.canon), section: s.id, title: "", status: "idea", note: "", canonDesc: { key: "desc", value: "" }, defs: s.defs.slice(), fields: {}, isNew: true }
      : { key: "new", src: "game", id: newId("card"), section: s.id, title: "", status: "idea", note: "", defs: (s.defs || CUSTOM_DEFS).slice(), fields: {}, isNew: true };
    openCard(c);
  }

  // ---------- own sections ----------
  function showNewSection() {
    $("newsec-slot").innerHTML = '<div class="newsec"><input id="ns-name" placeholder="' + esc(STR.sectionName) + '"><input id="ns-about" placeholder="' + esc(STR.sectionAbout) + '">' +
      '<div class="row"><button class="btn primary" id="ns-ok">' + STR.create + '</button><button class="btn" id="ns-x">' + STR.cancel + '</button></div></div>';
    $("ns-name").focus();
    $("ns-x").onclick = renderNav;
    $("ns-ok").onclick = async function () {
      var name = $("ns-name").value.trim(); if (!name) return;
      var s = { id: newId("sec"), name: name, about: $("ns-about").value.trim() };
      section = s.id; // before the write: the snapshot it triggers renders the new section
      await gref().set({ sections: (game.sections || []).concat(s), updatedAt: stamp() }, { merge: true });
    };
  }
  async function deleteSection() {
    var s = sec(section); if (!s.custom || !confirm(STR.confirmSec)) return;
    var batch = db.batch();
    cards.filter(function (c) { return c.section === s.id; }).forEach(function (c) { batch.delete(gref().collection("cards").doc(c.id)); });
    batch.set(gref(), { sections: game.sections.filter(function (x) { return x.id !== s.id; }) }, { merge: true });
    section = "overview";
    await batch.commit();
  }

  // ---------- AI calls ----------
  async function callFn(body) {
    var token = await firebase.auth().currentUser.getIdToken();
    var r = await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify(Object.assign({ worldId: worldId, gameId: gameId, language: LANG }, body)) });
    var data = await r.json().catch(function () { return { error: "HTTP " + r.status }; });
    if (!r.ok) throw new Error(data.error || "HTTP " + r.status);
    return data;
  }

  // ---------- import .md: AI sorts the notes onto the shelves, the author ticks what goes in ----------
  function startImport(file) {
    var rd = new FileReader();
    rd.onload = async function () {
      var text = String(rd.result || "");
      closeLeaf();
      if (text.length > 100000) { imp = { error: STR.importTooBig }; return render(); }
      imp = { busy: true }; render();
      var shelves = sections().filter(function (x) { return !x.special; }).map(function (x) {
        return { id: x.id, name: L(x), kind: x.canon ? "canon" : "game", canonKind: x.canon || "", fields: (x.defs || []).map(function (d) { return d.label; }) };
      });
      try { var data = await callFn({ op: "import", markdown: text, shelves: shelves }); imp = { proposal: data.proposal, spent: data.tokensConsumed }; }
      catch (e) { imp = { error: e.message }; }
      render();
    };
    rd.readAsText(file);
  }

  function renderImport() {
    var html = '<header class="sec"><div><h1>' + STR.importTitle + '</h1><p>' + (imp.proposal ? STR.importIntro : "") + '</p></div>' +
      '<div class="row"><button class="btn" id="imp-x">' + STR.close + '</button>' + (imp.proposal && !imp.done ? '<button class="btn primary" id="imp-ok">' + STR.importApply + '</button>' : '') + '</div></header>';
    if (imp.busy) html += '<p class="pmsg">' + STR.importBusy + '</p>';
    if (imp.error) html += '<p class="pmsg err">' + esc(imp.error) + '</p>';
    if (imp.done) html += '<p class="pmsg">' + STR.importDone + ': ' + imp.done + '</p>';
    var p = imp.proposal;
    if (p && !imp.done) {
      if (imp.spent) html += '<p class="muted">' + STR.spent + ': ' + imp.spent + '</p>';
      var box = function (kind, i, label, detail) { return '<label class="imp"><input type="checkbox" checked data-imp="' + kind + ':' + i + '"><span><b>' + esc(label) + '</b>' + (detail ? '<span class="muted"> — ' + esc(detail) + '</span>' : '') + '</span></label>'; };
      if (p.laws.length) html += '<h2 class="group">' + STR.importLaws + '</h2>' + p.laws.map(function (l, i) { return box("law", i, l); }).join("");
      if (p.canon.length) html += '<h2 class="group">' + STR.importCanon + '</h2>' + p.canon.map(function (e, i) {
        return box("canon", i, e.name + " · " + L(sec(CANON.filter(function (s) { return s.canon === e.kind; })[0].id)), (e.match ? STR.importMatch : STR.importNew) + (e.description ? ": " + e.description : "")); }).join("");
      if (p.cards.length) html += '<h2 class="group">' + STR.importCards + '</h2>' + p.cards.map(function (c, i) {
        return box("card", i, c.title + " · " + L(sec(c.section)), Object.keys(c.fields).join(", ")); }).join("");
      if (p.contradictions.length) html += '<h2 class="group">' + STR.importContra + '</h2>' + p.contradictions.map(function (c, i) { return box("contra", i, c.what, c.where); }).join("");
      if (p.questions.length) html += '<h2 class="group">' + STR.importQs + '</h2>' + p.questions.map(function (q, i) { return box("q", i, q.question, q.why); }).join("");
    }
    $("view").innerHTML = html;
    $("imp-x").onclick = function () { imp = null; render(); };
    var ok = $("imp-ok"); if (ok) ok.onclick = function () { ok.disabled = true; applyImport().catch(function (e) { imp.error = e.message; render(); }); };
  }

  function toFields(labels, defs) { // { label: value } → keys of the section's fields (new labels become new fields)
    var fields = {}, extra = [];
    Object.keys(labels).forEach(function (label) {
      var d = defs.concat(extra).filter(function (x) { return x.key === label || x.label.toLowerCase() === label.toLowerCase(); })[0];
      if (!d) { d = { key: fieldKey(label), label: label }; extra.push(d); }
      fields[d.key] = labels[label];
    });
    return { fields: fields, extra: extra };
  }

  async function applyImport() {
    var p = imp.proposal, ticked = {};
    [].forEach.call(document.querySelectorAll("[data-imp]"), function (cb) { if (cb.checked) ticked[cb.dataset.imp] = true; });
    var on = function (k, i) { return ticked[k + ":" + i]; };
    var batch = db.batch(), n = 0;
    var laws = p.laws.filter(function (l, i) { return on("law", i); });
    if (laws.length) { batch.set(wref(), { rules: (world.rules || []).concat(laws), updatedAt: stamp() }, { merge: true }); n += laws.length; }
    p.canon.forEach(function (e, i) {
      if (!on("canon", i)) return;
      var s = CANON.filter(function (x) { return x.canon === e.kind; })[0];
      var id = e.match || entityId(e.kind);
      if (!e.match) batch.set(wref().collection("entities").doc(id), { id: id, kind: e.kind, name: e.name, slug: slugify(e.name), desc: e.description,
        origin: { source: "explicit", confidence: null, confirmed: true, createdBy: "user" }, createdAt: stamp(), updatedAt: stamp() }); // the author ticked it
      var f = toFields(e.gameFields, s.defs);
      if (Object.keys(f.fields).length || !e.match) batch.set(gref().collection("cards").doc(id), { section: s.id, canonRef: id, fields: f.fields, defs: f.extra, hidden: false, updatedAt: stamp() }, { merge: true });
      n++;
    });
    p.cards.forEach(function (c, i) {
      if (!on("card", i)) return;
      var s = sec(c.section), f = toFields(c.fields, s.defs || CUSTOM_DEFS);
      batch.set(gref().collection("cards").doc(newId("card")), { section: s.id, title: c.title, status: "idea", note: "", defs: (s.defs || CUSTOM_DEFS).concat(f.extra),
        fields: f.fields, order: Date.now() + i, createdAt: stamp(), updatedAt: stamp() });
      n++;
    });
    var qs = p.questions.filter(function (q, i) { return on("q", i); });
    var contra = p.contradictions.filter(function (c, i) { return on("contra", i); });
    if (qs.length || contra.length) {
      batch.set(gref().collection("plan").doc("current"), { asked: (planDoc.asked || []).concat(qs), contradictions: (planDoc.contradictions || []).concat(contra) }, { merge: true });
      n += qs.length + contra.length;
    }
    await batch.commit();
    imp.done = n; render();
  }

  // ---------- production plan ----------
  var PRIO = { blocker: 0, important: 1, nice: 2 };
  var answers = function () { return planDoc.answers || {}; };
  var openQs = function () { return (planDoc.asked || []).filter(function (q) { return !answers()[q.id]; }).sort(function (a, b) { return PRIO[a.priority] - PRIO[b.priority]; }); };

  function renderPlan(s) {
    var gdd = planDoc.gdd, plan = planDoc.plan, oq = openQs();
    var blockers = oq.filter(function (q) { return q.priority === "blocker"; }).length;
    var busy = !!planBusy;
    var html = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div>' +
      '<div class="row">' + (plan ? '<button class="btn" id="p-md">' + STR.exportMd + '</button>' : '') +
      '<button class="btn' + (gdd ? '' : ' primary') + '" id="p-analyze"' + (busy ? ' disabled' : '') + '>' + (gdd ? STR.reanalyze : STR.analyze) + '</button>' +
      (gdd ? '<button class="btn primary" id="p-plan"' + (busy || blockers ? ' disabled title="' + esc(STR.blockersLeft) + '"' : '') + '>' + (plan ? STR.remakePlan : STR.makePlan) + '</button>' : '') +
      '</div></header>';
    html += '<p class="pmsg">' + esc(planBusy === "analyze" ? STR.busyAnalyze : planBusy === "plan" ? STR.busyPlan : planMsg || (gdd ? (blockers ? STR.blockersLeft + ' (' + blockers + ').' : '') : STR.planIntro)) +
      (busy ? '' : ' <span class="muted">' + STR.costNote + '</span>') + '</p>';

    if (gdd) {
      html += '<section class="psec"><h2 class="group">' + STR.gddTitle + '</h2>' +
        '<div class="ready"><span>' + STR.readiness + '</span><div class="ready__bar"><i style="width:' + (gdd.readiness || 0) + '%"></i></div><b>' + (gdd.readiness || 0) + '%</b></div>' +
        '<p>' + esc(gdd.summary) + '</p><div class="gsecs">' + (gdd.sections || []).map(function (x) {
          return '<div class="gsec"><span class="pill g-' + x.status + '">' + esc(STR.st[x.status] || x.status) + '</span> <b>' + esc(x.title) + '</b>' + (x.notes ? '<div class="muted">' + esc(x.notes) + '</div>' : '') + '</div>';
        }).join("") + '</div></section>';
    }
    if ((planDoc.contradictions || []).length) html += '<section class="psec"><h2 class="group">' + STR.contradictions + '</h2><ul class="contra">' + planDoc.contradictions.map(function (c) {
      return '<li>' + esc(c.what) + (c.where ? ' <span class="muted">— ' + esc(c.where) + '</span>' : '') + '</li>'; }).join("") + '</ul></section>';
    if (oq.length) html += '<section class="psec"><h2 class="group">' + STR.questionsTitle + ' <span>' + oq.length + '</span></h2>' + oq.map(qHtml).join("") + '</section>';
    var done = (planDoc.asked || []).filter(function (q) { return answers()[q.id]; });
    if (done.length) html += '<section class="psec"><details><summary><h2 class="group" style="display:inline-flex">' + STR.answeredTitle + ' <span>' + done.length + '</span></h2></summary>' +
      done.map(function (q) { return '<div class="qa"><div class="muted">' + esc(q.question) + '</div><div>' + esc(answers()[q.id]) + '</div></div>'; }).join("") + '</details></section>';
    if (plan) html += planHtml(plan);
    $("view").innerHTML = html;

    var a = $("p-analyze"); if (a) a.onclick = function () { runPlan("analyze"); };
    var pl = $("p-plan"); if (pl) pl.onclick = function () { runPlan("plan"); };
    var mdb = $("p-md"); if (mdb) mdb.onclick = exportMarkdown;
  }

  function qHtml(q) {
    return '<div class="q" data-q="' + esc(q.id) + '"><div class="q__top"><span class="pill p-' + q.priority + '">' + esc(STR.prio[q.priority]) + '</span>' +
      (q.topic ? ' <span class="muted">' + esc(q.topic) + '</span>' : '') + '</div>' +
      '<div class="q__q">' + esc(q.question) + '</div>' + (q.why ? '<div class="muted">' + esc(q.why) + '</div>' : '') +
      (q.options && q.options.length ? '<div class="row q__opts">' + q.options.map(function (o) { return '<button class="chip" data-opt="' + esc(o) + '">' + esc(o) + '</button>'; }).join("") + '</div>' : '') +
      '<textarea rows="2" placeholder="' + esc(STR.answerPh) + '"></textarea><div class="row"><button class="btn primary" data-answer>' + STR.answer + '</button></div></div>';
  }

  function planHtml(plan) {
    var html = '<section class="psec"><h2 class="group">' + STR.planTitle + '</h2>' + (plan.overview ? '<p>' + esc(plan.overview) + '</p>' : '');
    if (plan.engineNotes) html += '<div class="canonbox"><h4>' + STR.engineNotes + '</h4><div>' + esc(plan.engineNotes) + '</div></div>';
    (plan.milestones || []).forEach(function (m) {
      html += '<div class="ms"><h3>' + esc(m.id) + ' · ' + esc(m.name) + '</h3>' + (m.goal ? '<p><b>' + STR.goal + ':</b> ' + esc(m.goal) + '</p>' : '') +
        (m.gate ? '<p class="gate"><b>' + STR.gate + ':</b> ' + esc(m.gate) + '</p>' : '') +
        (m.tasks || []).map(function (t) {
          return '<div class="task"><div class="task__h"><span class="mono">' + esc(t.id) + '</span> <b>' + esc(t.title) + '</b> <span class="pill s-agreed">' + esc(t.size) + '</span> <span class="pill s-idea">' + esc(t.owner) + '</span>' +
            (t.deps.length ? ' <span class="muted">' + STR.deps + ' ' + esc(t.deps.join(", ")) + '</span>' : '') + '</div>' +
            (t.detail ? '<div class="task__d">' + esc(t.detail) + '</div>' : '') +
            (t.prompt ? '<details><summary>' + STR.prompt + '</summary><pre>' + esc(t.prompt) + '</pre><button class="btn" data-copy>' + STR.copy + '</button></details>' : '') + '</div>';
        }).join("") + '</div>';
    });
    if ((plan.parallel || []).length) html += '<h3 class="sub">' + STR.parallel + '</h3><ul>' + plan.parallel.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul>';
    if ((plan.risks || []).length) html += '<h3 class="sub">' + STR.risks + '</h3><ul>' + plan.risks.map(function (r) { return '<li><b>' + esc(r.risk) + '</b> — ' + esc(r.mitigation) + '</li>'; }).join("") + '</ul>';
    if ((plan.gaps || []).length) html += '<h3 class="sub">' + STR.gaps + '</h3><ul>' + plan.gaps.map(function (g) {
      return '<li><b>' + esc(g.need) + '</b>: ' + esc(g.missing) + (g.desiredApi ? ' · <code>' + esc(g.desiredApi) + '</code>' : '') + (g.workaround ? ' · ' + esc(g.workaround) : '') + '</li>'; }).join("") + '</ul>';
    return html + '</section>';
  }

  async function runPlan(op) {
    if (planBusy) return;
    planBusy = op; planMsg = ""; render();
    try { var data = await callFn({ op: op }); planMsg = STR.spent + ": " + data.tokensConsumed; }
    catch (e) { planMsg = e.message; }
    planBusy = null; render();
  }

  // An answer is a decision: it is kept with the plan AND written into the card it belongs to.
  async function answerQuestion(qid, text) {
    var q = (planDoc.asked || []).filter(function (x) { return x.id === qid; })[0]; if (!q || !text) return;
    var upd = {}; upd[qid] = text;
    await gref().collection("plan").doc("current").set({ answers: upd }, { merge: true });
    var c = q.target && allCards().filter(function (x) { return x.key === q.target.card; })[0];
    if (!c) return;
    var want = (q.target.field || q.topic || "").toLowerCase();
    var def = c.defs.filter(function (d) { return d.key.toLowerCase() === want || d.label.toLowerCase() === want; })[0];
    var defs = c.src === "canon" ? (c.extraDefs || []).slice() : c.defs.slice();
    if (!def) { def = { key: fieldKey(want), label: q.target.field || q.topic || "—" }; defs.push(def); }
    var prev = c.fields[def.key] || "";
    var fields = {}; fields[def.key] = prev ? prev + "\n\n" + text : text;
    var body = { fields: fields, defs: defs, updatedAt: stamp() };
    if (c.src === "canon") Object.assign(body, { section: c.section, canonRef: c.id });
    await gref().collection("cards").doc(c.id).set(body, { merge: true });
    planMsg = STR.writtenTo + " «" + c.title + "»";
  }

  function exportMarkdown() {
    var g = planDoc.gdd || {}, p = planDoc.plan || {}, out = [];
    out.push("# " + (game.title || "Game") + " — GDD", "", "World: " + (world.title || ""), "", g.summary || "", "");
    (g.sections || []).forEach(function (x) { out.push("- **" + x.title + "** (" + x.status + ")" + (x.notes ? ": " + x.notes : "")); });
    var done = (planDoc.asked || []).filter(function (q) { return answers()[q.id]; });
    if (done.length) { out.push("", "## Decisions", ""); done.forEach(function (q) { out.push("- **" + q.question + "** — " + answers()[q.id]); }); }
    out.push("", "# Development plan", "", p.overview || "");
    if (p.engineNotes) out.push("", "> " + p.engineNotes);
    (p.milestones || []).forEach(function (m) {
      out.push("", "## " + m.id + " · " + m.name, "", "**Goal:** " + (m.goal || ""), "", "**Gate:** " + (m.gate || ""), "");
      (m.tasks || []).forEach(function (t) {
        out.push("### " + t.id + " " + t.title + " [" + t.size + ", " + t.owner + "]" + (t.deps.length ? " — deps: " + t.deps.join(", ") : ""), "", t.detail || "");
        if (t.prompt) out.push("", "```text", t.prompt, "```");
        out.push("");
      });
    });
    if ((p.parallel || []).length) out.push("## Parallel streams", "", p.parallel.map(function (x) { return "- " + x; }).join("\n"), "");
    if ((p.risks || []).length) out.push("## Risks", "", p.risks.map(function (r) { return "- **" + r.risk + "** — " + r.mitigation; }).join("\n"), "");
    if ((p.gaps || []).length) {
      out.push("# FRAMEWORK-GAPS", "");
      p.gaps.forEach(function (x) { out.push("## " + x.need, "", "- Missing: " + x.missing, "- Desired API: " + x.desiredApi, "- Workaround: " + x.workaround, ""); });
    }
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([out.join("\n")], { type: "text/markdown" }));
    a.download = (slugify(game.title) || "game") + "-plan.md";
    a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  // ---------- events ----------
  $("nav").addEventListener("click", function (e) {
    var b = e.target.closest(".nav-item"); if (!b) return;
    section = b.dataset.sec; query = ""; imp = null; $("q").value = ""; render(); $("main").scrollTop = 0;
  });
  $("newsec-slot").addEventListener("click", function (e) { if (e.target.id === "sec-add") showNewSection(); });
  $("view").addEventListener("click", function (e) {
    var opt = e.target.closest("[data-opt]");
    if (opt) { opt.closest(".q").querySelector("textarea").value = opt.dataset.opt; return; }
    var ans = e.target.closest("[data-answer]");
    if (ans) { var q = ans.closest(".q"); ans.disabled = true; answerQuestion(q.dataset.q, q.querySelector("textarea").value.trim()).catch(function (er) { planMsg = er.message; render(); }); return; }
    var cp = e.target.closest("[data-copy]");
    if (cp) { navigator.clipboard.writeText(cp.previousElementSibling.textContent).then(function () { cp.textContent = STR.copied; }); return; }
    var c = e.target.closest(".card"); if (!c) return;
    var card = allCards().filter(function (x) { return x.key === c.dataset.key; })[0]; if (card) openCard(card);
  });
  $("q").addEventListener("input", function (e) { query = e.target.value.trim().toLowerCase(); render(); });
  $("statuses").addEventListener("click", function (e) {
    var b = e.target.closest("[data-status]"); if (!b) return;
    statusFilter[b.dataset.status] = !statusFilter[b.dataset.status]; renderStatuses(); render();
  });
  $("e-body").addEventListener("click", function (e) {
    var s = e.target.closest(".shown"); if (s) { editField(s.dataset.edit); return; }
    if (e.target.id === "nf-add") {
      var label = $("nf").value.trim(); if (!label) return;
      var key = fieldKey(label);
      [].forEach.call(document.querySelectorAll("#e-body textarea"), collect);
      if (!draft.defs.some(function (d) { return d.key === key; })) draft.defs.push({ key: key, label: label });
      renderFields(); editField(key);
    }
  });
  $("e-body").addEventListener("keydown", function (e) {
    var s = e.target.closest(".shown"); if (s && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); editField(s.dataset.edit); }
  });
  $("e-save").onclick = save;
  $("e-close").onclick = closeLeaf;
  $("scrim").onclick = closeLeaf;
  $("e-delete").onclick = removeCard;
  $("engine").addEventListener("change", function (e) { if (game) gref().set({ engine: { profile: e.target.value } }, { merge: true }); });
  $("gamepick").addEventListener("change", function (e) {
    if (e.target.value === "__new") { game = null; gameId = null; imp = null; render(); } else selectGame(e.target.value);
  });
  $("imp-btn").addEventListener("click", function () { if (game) $("imp-file").click(); });
  $("imp-file").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) startImport(f); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) closeLeaf();
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && open) { e.preventDefault(); save(); }
    if (e.key === "Tab" && open) { // keep focus inside the leaf
      var f = [].filter.call($("leaf").querySelectorAll("button,input,select,textarea,[tabindex]"), function (x) { return !x.disabled && x.offsetParent; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // ---------- boot ----------
  $("t-brand").textContent = STR.brand; $("t-engine").textContent = STR.engine; $("q").placeholder = STR.search;
  $("e-save").textContent = STR.save; $("e-close").textContent = STR.close; $("imp-btn").textContent = STR.importMd;
  $("engine").innerHTML = ENGINES.map(function (x) { return '<option value="' + x.id + '">' + esc(L(x)) + '</option>'; }).join("");
  renderStatuses();

  function sync(state, text) { $("sync").innerHTML = '<span class="dot ' + state + '"></span>' + esc(text); }
  function locked(title, text, withUpgrade) {
    document.body.style.display = "block";
    document.body.innerHTML = '<div class="locked"><h1>' + esc(title) + '</h1><p>' + esc(text) + '</p>' +
      (withUpgrade ? '<button class="btn primary" id="up">' + STR.upgrade + '</button>' : '') + '</div>';
    var up = document.getElementById("up");
    if (up) up.onclick = function () { try { window.parent.document.getElementById("userdock").click(); } catch (e) {} }; // the shell's account (plans)
  }

  // Switch the open game: its cards and plan stream in; the canon stream is shared.
  function selectGame(id) {
    unsub.forEach(function (u) { u(); }); unsub = [];
    gameId = id; game = games.filter(function (g) { return g.id === id; })[0] || null;
    cards = []; planDoc = {}; imp = null; closeLeaf();
    try { localStorage.setItem("ww-game-" + worldId, id); } catch (e) {}
    if (game) $("engine").value = (game.engine && game.engine.profile) || "generic";
    if (!sections().some(function (s) { return s.id === section; })) section = "overview";
    unsub.push(gref().collection("cards").onSnapshot(function (snap) {
      cards = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      sync(snap.metadata.fromCache ? "" : "ok", STR.live); render();
    }, function () { sync("bad", STR.offline); }));
    unsub.push(gref().collection("plan").doc("current").onSnapshot(function (d) { planDoc = d.data() || {}; render(); }));
    render();
  }

  firebase.auth().onAuthStateChanged(async function (user) {
    if (!user) return locked(STR.brand, STR.login, false);
    db = window.__firebase.db;
    if (!worldId) return locked(STR.brand, STR.noWorld, false);
    try {
      var u = await db.collection("users").doc(user.uid).get();
      var plan = (u.exists && u.data().plan) || "free";
      canWrite = !!window.__getPlanConfig(plan).allowGameDev;
      if (!canWrite) return locked(STR.lockedTitle, STR.lockedText, true);
      var w = await wref().get();
      if (!w.exists) return locked(STR.brand, STR.noWorld, false);
    } catch (e) { return locked(STR.brand, STR.noWorld, false); }

    wref().onSnapshot(function (d) { world = d.data() || {}; $("w-title").textContent = world.title || "…"; document.title = (world.title || "") + " — " + STR.brand; render(); });
    wref().collection("entities").onSnapshot(function (snap) {
      entities = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .filter(function (e) { return !(e.origin && e.origin.confirmed === false); }); // inferred canon is not fact yet
      render();
    });
    var first = true;
    wref().collection("games").onSnapshot(function (snap) {
      games = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .sort(function (a, b) { return ((a.createdAt && a.createdAt.toMillis && a.createdAt.toMillis()) || 0) - ((b.createdAt && b.createdAt.toMillis && b.createdAt.toMillis()) || 0); });
      if (first) {
        first = false;
        var saved = null; try { saved = params.get("gameId") || localStorage.getItem("ww-game-" + worldId); } catch (e) {}
        var pick = games.filter(function (g) { return g.id === saved; })[0] || games[0];
        if (pick) return selectGame(pick.id);
      }
      if (gameId) game = games.filter(function (g) { return g.id === gameId; })[0] || null;
      if (game) $("engine").value = (game.engine && game.engine.profile) || "generic";
      render();
    });
  });
})();
