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
      group: "Підзаголовок", noGroup: "— без підзаголовка —", newGroup: "＋ Створити підзаголовок", newGroupPh: "Назва нового підзаголовка",
      note: "Примітка для Claude", noteHint: "що зробити з цим у грі", notePh: "Напр.: зроби темнішим, перегенеруй з меншим polycount, додай у GDD…",
      blank: "порожньо — натисни, щоб заповнити", addField: "Додати поле", addFieldPh: "Назва поля, напр. «Звук» або «Референс»", add: "Додати",
      canonTag: "канон", canonField: "канон — спільне для всіх історій та ігор", worldCanon: "Канон світу", laws: "Закони світу", facts: "Факти",
      worldReadonly: "Канон світу редагується у Дереві всесвіту. Тут — те, на що спирається кожна гра.",
      saved: "Збережено", saving: "Зберігаю…", failed: "Не вдалося зберегти", confirmDel: "Прибрати цю картку назавжди?",
      confirmSec: "Видалити розділ? Картки в ньому теж буде видалено.",
      live: "Зміни зберігаються в світі.", offline: "Немає звʼязку з базою.",
      lockedTitle: "Біблія гри — для геймдеву", lockedText: "Біблія гри та Продакшн-план доступні на тарифі Worldbuilder. Канон світу й історії лишаються з тобою на будь-якому тарифі.",
      upgrade: "Переглянути тарифи", noWorld: "Світ не знайдено.", login: "Увійди, щоб відкрити біблію.",
      importMd: "Імпорт нотаток (.md)", importTitle: "Імпорт нотаток", importBusy: "AI розбирає файл по полицях… (до кількох хвилин)",
      importIntro: "Перевір, що AI знайшов у файлі. У канон і картки потрапить лише відмічене.",
      importApply: "Додати відмічене", importDone: "Додано", importNew: "нове в каноні", importMatch: "вже є в каноні — додати ігрові поля",
      importLaws: "Нові закони світу", importCards: "Картки гри", importCanon: "Сутності канону", importQs: "Відкриті питання → у Продакшн-план",
      importContra: "Суперечності → у Продакшн-план", importTooBig: "Файл завеликий (максимум 100 000 символів).",
      files: "Файли", filesHint: "префаби, моделі, картинки, звук — до 200 МБ; у 3D відкриваються .glb .gltf .fbx .obj .stl", filesAdd: "＋ Додати файли", filesSaveFirst: "Спершу збережи картку — тоді можна додати файли.",
      uploading: "Завантажую", filesDone: "Завантажено файлів", fileTooBig: "Файл більший за 200 МБ", confirmFile: "Видалити файл",
      v3d: { open: "🧊 3D", view: "Переглянути в 3D", loading: "Завантажую модель…", rotate: "Обертання", wire: "Каркас", reset: "Скинути вид", close: "Закрити", tris: "трикутників",
        hint: "Тягни — обертати · коліщатко — зум · права кнопка — зсув · Esc — закрити", failed: "Не вдалося відкрити модель" },
      analyze: "✦ Проаналізувати біблію", reanalyze: "↻ Оновити аналіз", makePlan: "✦ Згенерувати план розробки", remakePlan: "↻ Перегенерувати план",
      exportMd: "⬇ Markdown для репозиторію", busyAnalyze: "AI читає всю біблію і складає гейм-диздок… (до хвилини)",
      busyPlan: "AI складає план розробки… Для великої біблії це 5–15 хвилин; можна піти зі сторінки — план зʼявиться тут сам.",
      scTitle: "Чого бракує в біблії", scIntro: "План знайшов, чого не вистачає для розробки. Відмічене зʼявиться порожніми картками зі статусом «В роботі» — заповнюй їх сам або згодом через Claude Code.",
      exTitle: "Claude Code — виконавець", exIntro: "Claude Code у репозиторії гри підключається до WhiteWrite по MCP: бере наступну готову задачу з усім контекстом (картки, файли, критерії), працює в Unity і здає звіт сюди на перевірку. Ключ діє лише для цієї гри.",
      exConnect: "Підключити Claude Code", exAnother: "Ще один ключ", exKeyOnce: "Ключ показано один раз — виконай цю команду в терміналі, у папці Unity-проєкту:",
      exThen: "Потім у Claude Code: «Візьми наступну задачу з WhiteWrite і виконай її».", exUsed: "останній виклик", exNever: "ще не було", exRevoke: "Відкликати", exRevokeQ: "Відкликати ключ? Claude Code з ним більше не підключиться.",
      exLog: "Активність виконавця", exType: { claimed: "взяв задачу", progress: "прогрес", blocked: "блокер", submitted: "здав на перевірку", change_request: "запит на зміну" },
      ts: { todo: "до виконання", in_progress: "виконується", review: "на перевірці", rework: "на доопрацюванні", blocked: "заблоковано", done: "готово" },
      progress: "Прогрес", acceptTitle: "Критерії приймання", tests: "Тести", testsNone: "не запускались", report: "Звіт", changes: "Змінені файли",
      serverCheck: "Перевірка сервера", checkOk: "усі критерії виконано, тести зелені", checkWarn: "не все підтверджено",
      accept: "Прийняти", giveBack: "Повернути на доопрацювання", returnPh: "Що виправити? (побачить Claude Code)",
      blocked: "Блокер", needs: "Потрібно", unblock: "Розблоковано", unblockPh: "Що змінилось / відповідь для Claude Code",
      crTitle: "Запити на зміну від виконавця", crWhy: "Чому", crProposal: "Пропозиція", crImpact: "Вплив", crAccept: "Погодити", crReject: "Відхилити",
      scSections: "Нові розділи", scApply: "Створити відмічене", scDone: "Створено", scNeed: "Що потрібно", scTask: "Задача плану", taskCards: "Картки", costNote: "AI-аналіз, імпорт і план списують токени з балансу.",
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
      group: "Subheading", noGroup: "— no subheading —", newGroup: "＋ Create subheading", newGroupPh: "Name of the new subheading",
      note: "Note for Claude", noteHint: "what to do with it in the game", notePh: "E.g.: make it darker, regenerate with lower polycount, add to the GDD…",
      blank: "empty — click to fill in", addField: "Add field", addFieldPh: "Field name, e.g. “Sound” or “Reference”", add: "Add",
      canonTag: "canon", canonField: "canon — shared by every story and game", worldCanon: "World canon", laws: "Laws of the world", facts: "Facts",
      worldReadonly: "The world canon is edited in the Universe tree. Here is what every game stands on.",
      saved: "Saved", saving: "Saving…", failed: "Could not save", confirmDel: "Remove this card for good?",
      confirmSec: "Delete the section? Its cards will be deleted too.",
      live: "Changes are saved in the world.", offline: "No connection to the database.",
      lockedTitle: "Game Bible — for game dev", lockedText: "The Game Bible and Production Plan are available on the Worldbuilder plan. Your world canon and stories stay with you on any plan.",
      upgrade: "See plans", noWorld: "World not found.", login: "Sign in to open the bible.",
      importMd: "Import notes (.md)", importTitle: "Import notes", importBusy: "AI is sorting the file onto the shelves… (up to a few minutes)",
      importIntro: "Check what AI found in the file. Only the ticked items go into the canon and the cards.",
      importApply: "Add ticked items", importDone: "Added", importNew: "new in canon", importMatch: "already in canon — add game fields",
      importLaws: "New laws of the world", importCards: "Game cards", importCanon: "Canon entities", importQs: "Open questions → Production plan",
      importContra: "Contradictions → Production plan", importTooBig: "The file is too big (100,000 characters max).",
      files: "Files", filesHint: "prefabs, models, images, audio — up to 200 MB; .glb .gltf .fbx .obj .stl open in 3D", filesAdd: "＋ Add files", filesSaveFirst: "Save the card first — then you can add files.",
      uploading: "Uploading", filesDone: "Files uploaded", fileTooBig: "File is larger than 200 MB", confirmFile: "Delete file",
      v3d: { open: "🧊 3D", view: "View in 3D", loading: "Loading model…", rotate: "Rotate", wire: "Wireframe", reset: "Reset view", close: "Close", tris: "triangles",
        hint: "Drag to orbit · wheel to zoom · right button to pan · Esc to close", failed: "Could not open the model" },
      analyze: "✦ Analyze the bible", reanalyze: "↻ Refresh analysis", makePlan: "✦ Generate the development plan", remakePlan: "↻ Regenerate plan",
      exportMd: "⬇ Markdown for the repo", busyAnalyze: "AI is reading the whole bible and drafting the GDD… (up to a minute)",
      busyPlan: "AI is building the development plan… For a big bible this takes 5–15 minutes; you can leave — the plan appears here by itself.",
      scTitle: "Missing from the bible", scIntro: "The plan found what development still lacks. Ticked items become empty cards with the “In progress” status — fill them yourself or later through Claude Code.",
      exTitle: "Claude Code — executor", exIntro: "Claude Code in the game repository connects to WhiteWrite over MCP: it takes the next ready task with its full context (cards, files, criteria), works in Unity and hands a report in here for review. The key works for this game only.",
      exConnect: "Connect Claude Code", exAnother: "Another key", exKeyOnce: "The key is shown once — run this command in a terminal, in the Unity project folder:",
      exThen: "Then in Claude Code: “Take the next task from WhiteWrite and do it”.", exUsed: "last call", exNever: "never", exRevoke: "Revoke", exRevokeQ: "Revoke the key? Claude Code will no longer connect with it.",
      exLog: "Executor activity", exType: { claimed: "took a task", progress: "progress", blocked: "blocker", submitted: "handed in", change_request: "change request" },
      ts: { todo: "to do", in_progress: "in progress", review: "in review", rework: "rework", blocked: "blocked", done: "done" },
      progress: "Progress", acceptTitle: "Acceptance criteria", tests: "Tests", testsNone: "not run", report: "Report", changes: "Changed files",
      serverCheck: "Server check", checkOk: "all criteria met, tests green", checkWarn: "not everything confirmed",
      accept: "Accept", giveBack: "Return for rework", returnPh: "What to fix? (Claude Code will see it)",
      blocked: "Blocker", needs: "Needs", unblock: "Unblocked", unblockPh: "What changed / answer for Claude Code",
      crTitle: "Change requests from the executor", crWhy: "Why", crProposal: "Proposal", crImpact: "Impact", crAccept: "Approve", crReject: "Reject",
      scSections: "New sections", scApply: "Create ticked items", scDone: "Created", scNeed: "What is needed", scTask: "Plan task", taskCards: "Cards", costNote: "AI analysis, import and the plan spend tokens from your balance.",
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
    { id: "progression", uk: "Прогресія й економіка", en: "Progression & economy", group: "group",
      about: { uk: "Досвід, рівні, валюти, лут, магазин, апгрейди — і баланс чисел між ними.", en: "XP, levels, currencies, loot, shop, upgrades — and the balance of numbers between them." },
      defs: [F("group", "Група", "Group"), F("text", "Опис", "Description"), F("numbers", "Числа й формули", "Numbers & formulas"), F("sinks", "Звідки береться / куди йде", "Sources / sinks")] },
    { id: "levels", uk: "Рівні й контент", en: "Levels & content", group: "group",
      about: { uk: "Рівні, траси, хвилі, енкаунтери: розмір, тривалість, хто й що там. Місце з канону — у «Локаціях».", en: "Levels, tracks, waves, encounters: size, length, who and what is there. The canon place is in “Locations”." },
      defs: [F("group", "Група", "Group"), F("location", "Локація канону", "Canon location"), F("layout", "Структура й розмір", "Layout & size"),
             F("encounters", "Вороги й події", "Enemies & events"), F("goal", "Мета гравця", "Player goal"), F("length", "Тривалість", "Length")] },
    { id: "enemies", uk: "Вороги й боси", en: "Enemies & bosses", group: "group",
      about: { uk: "Хто стоїть на шляху, як бʼє і куди його бити.", en: "Who stands in the way, how it hits and where to hit it." },
      defs: [F("group", "Тип (ворог / бос)", "Type (enemy / boss)"), F("behaviour", "Поведінка", "Behaviour"), F("attacks", "Атаки", "Attacks"),
             F("weakness", "Як перемогти", "How to beat"), F("numbers", "Числа", "Numbers"), F("model", "Модель / префаб", "Model / prefab")] },
    { id: "gear", uk: "Предмети й спорядження", en: "Items & gear", group: "group",
      about: { uk: "Зброя, броня, розхідники, ключі: що дає, скільки коштує, де взяти. Легендарні речі канону — в «Артефактах».", en: "Weapons, armour, consumables, keys: what it gives, cost, where to get it. Canon legends are in “Artifacts”." },
      defs: [F("group", "Тип", "Type"), F("effect", "Ефект", "Effect"), F("numbers", "Числа", "Numbers"), F("source", "Як отримати", "How to get"), F("model", "Модель / іконка", "Model / icon")] },
    { id: "assets", uk: "Ассети й префаби", en: "Assets & prefabs", group: "category",
      about: { uk: "Моделі й префаби: що вже є і що треба зробити — функція, розмір, пріоритет, промпт. Моделі відкриваються в 3D.", en: "Models and prefabs: what exists and what to make — function, size, priority, prompt. Models open in 3D." },
      defs: [F("category", "Категорія", "Category"), F("function", "Функція", "Function"), F("size", "Розмір", "Size"),
             F("priority", "Пріоритет", "Priority"), F("prompt", "Промпт генерації", "Generation prompt"), F("source", "Джерело", "Source")] },
    { id: "materials", uk: "Матеріали й текстури", en: "Materials & textures", group: "category",
      about: { uk: "Поверхні, текстури, шейдери, рослинність: карти, розмір, джерело чи ліцензія.", en: "Surfaces, textures, shaders, foliage: maps, resolution, source or licence." },
      defs: [F("category", "Група", "Group"), F("what", "Що це", "What it is"), F("where", "Де використовується", "Where it is used"), F("maps", "Карти", "Maps"),
             F("resolution", "Розмір", "Resolution"), F("source", "Джерело / ліцензія", "Source / licence")] },
    { id: "animation", uk: "Анімації й VFX", en: "Animation & VFX", group: "group",
      about: { uk: "Анімації персонажів і ворогів, ефекти, частинки: хто, що, тривалість, джерело.", en: "Character and enemy animations, effects, particles: who, what, length, source." },
      defs: [F("group", "Група", "Group"), F("who", "Для кого / чого", "For whom / what"), F("what", "Що відбувається", "What happens"),
             F("timing", "Тривалість і тайминг", "Length & timing"), F("source", "Джерело", "Source")] },
    { id: "audio", uk: "Звук і музика", en: "Sound & music", group: "group",
      about: { uk: "Музика, ефекти, озвучка, амбієнт: настрій, де звучить, джерело.", en: "Music, sound effects, voice, ambience: mood, where it plays, source." },
      defs: [F("group", "Група", "Group"), F("mood", "Настрій і опис", "Mood & description"), F("where", "Де звучить", "Where it plays"),
             F("length", "Тривалість / цикл", "Length / loop"), F("source", "Джерело / промпт", "Source / prompt")] },
    { id: "ui", uk: "UI / UX", en: "UI / UX", group: "group",
      about: { uk: "Екрани, HUD, меню, онбординг: що на екрані, дії гравця, переходи.", en: "Screens, HUD, menus, onboarding: what is on screen, player actions, transitions." },
      defs: [F("group", "Група", "Group"), F("purpose", "Навіщо екран", "Purpose"), F("elements", "Елементи", "Elements"),
             F("actions", "Дії гравця й переходи", "Player actions & transitions"), F("refs", "Референси", "References")] },
    { id: "refs", uk: "Референси", en: "References", group: "group",
      about: { uk: "Мудборд та ігри-зразки: що саме беремо і чого уникаємо.", en: "Moodboard and reference games: what exactly we take and what we avoid." },
      defs: [F("group", "Група", "Group"), F("what", "Що беремо", "What we take"), F("avoid", "Чого уникаємо", "What we avoid"), F("link", "Посилання", "Link")] },
    { id: "tech", uk: "Технічне", en: "Technical", group: "group",
      about: { uk: "Рушій, платформи, збірка, перформанс, сейви, мультиплеєр, інструменти.", en: "Engine, platforms, build, performance, saves, multiplayer, tools." },
      defs: [F("group", "Група", "Group"), F("decision", "Рішення", "Decision"), F("constraints", "Обмеження й бюджети", "Constraints & budgets"), F("status", "Стан зараз", "Current state")] },
  ];
  var PLAN = { id: "plan", special: "plan", uk: "Продакшн-план", en: "Production plan",
    about: { uk: "Інтерактивний гейм-диздок і точний план розробки, складені з канону та всієї біблії гри.", en: "An interactive game design doc and a precise development plan built from the canon and the whole game bible." } };
  var CUSTOM_DEFS = [F("text", "Опис", "Description")];
  var PREFIX = { characters: "char", locations: "loc", factions: "fac", artifacts: "art", events: "evt" };
  var FN = "https://us-central1-whitewrite-app.cloudfunctions.net/gamedevPlan";
  var MCP_URL = "https://us-central1-whitewrite-app.cloudfunctions.net/mcp";

  // ---------- state ----------
  var params = new URLSearchParams(location.search);
  var worldId = params.get("worldId");
  var db = null, world = null, games = [], gameId = null, game = null;
  var cards = [], entities = [], planDoc = {}, canWrite = false, unsub = [];
  var tasks = [], changeReqs = [], execs = [], keys = [], newKey = null; // execution: Task Engine + Claude Code (MCP)
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
    var own = ((game && game.sections) || []).map(function (s) { return { id: s.id, uk: s.name, en: s.name, about: s.about || "", custom: true, defs: CUSTOM_DEFS, group: s.group || "" }; });
    return GAME.concat(own, [PLAN]);
  }
  function sections() { return CANON.concat(gameSections()); }
  // Subheadings: every ordinary section groups its cards by one field (mechanics "group", assets "category", others "group")
  function groupKey(s) { return s.special ? "" : (s.group || "group"); }
  function groupsOf(s) {
    var k = groupKey(s), seen = [];
    allCards().forEach(function (c) { var g = c.section === s.id && c.fields[k]; if (g && seen.indexOf(g) < 0) seen.push(g); });
    return seen;
  }
  function sec(id) { return sections().filter(function (s) { return s.id === id; })[0] || GAME[0]; }

  // Unified card view: a canon entity seen through this game, or a game-only card.
  function canonCard(e, s) {
    var c = cards.filter(function (x) { return x.canonRef === e.id; })[0] || {};
    var descKey = e.desc !== undefined || e.description === undefined ? "desc" : "description";
    var extra = (c.defs || []).filter(function (d) { return !s.defs.some(function (x) { return x.key === d.key; }); });
    return { key: "e:" + e.id, src: "canon", id: e.id, section: s.id, title: e.name || e.title || "", status: c.status || "idea", note: c.note || "",
      canonDesc: { key: descKey, value: e[descKey] || "" }, defs: s.defs.concat(extra), extraDefs: extra, fields: c.fields || {}, files: c.files || [], hidden: !!c.hidden };
  }
  function gameCard(c) {
    var s = sec(c.section);
    return { key: "c:" + c.id, src: "game", id: c.id, section: c.section, title: c.title || "", status: c.status || "idea", note: c.note || "",
      defs: (c.defs && c.defs.length) ? c.defs : (s.defs || CUSTOM_DEFS), fields: c.fields || {}, files: c.files || [] };
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
    var img = (c.files || []).filter(isImage)[0];
    if ((c.files || []).length) tags.push('<span class="flag">📎 ' + c.files.length + '</span>');
    var model = (c.files || []).filter(is3D)[0];
    var corner = model ? '<span class="v3d-pill" role="button" tabindex="0" title="' + esc(STR.v3d.view) + '" aria-label="' + esc(STR.v3d.view) + '" data-view3d="' + esc(model.id) + '">🧊 3D</span>' : '';
    return '<button class="card' + (model ? ' has3d' : '') + '" data-key="' + esc(c.key) + '">' + corner + (img ? '<img class="thumb" loading="lazy" alt="" src="' + esc(img.url) + '">' : '') +
      '<h3>' + esc(c.title || STR.newCard) + '</h3><div class="tags">' + tags.join("") +
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
    else if (!query && list.some(function (c) { return c.fields[groupKey(s)]; })) {
      var groups = {}, order = [];
      list.forEach(function (c) { var g = c.fields[groupKey(s)] || STR.other; if (!groups[g]) { groups[g] = []; order.push(g); } groups[g].push(c); });
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
    fillGroups(c.fields[groupKey(sec(c.section))] || "");
    $("e-delete").textContent = c.src === "canon" ? STR.hide : STR.remove;
    $("e-delete").style.display = c.isNew ? "none" : "";
    renderFields(); msg("");
    $("leaf").classList.add("open"); $("leaf").setAttribute("aria-hidden", "false"); $("scrim").classList.add("open");
    $("e-title").focus();
  }

  function fillGroups(cur, extra) {
    var s = sec(open.section), list = groupsOf(s).concat(extra || []);
    if (cur && list.indexOf(cur) < 0) list.push(cur);
    $("e-group").hidden = !groupKey(s);
    $("e-group").innerHTML = '<option value="">' + STR.noGroup + '</option>' +
      list.map(function (g) { return '<option' + (g === cur ? " selected" : "") + '>' + esc(g) + '</option>'; }).join("") +
      '<option value="__new">' + STR.newGroup + '</option>';
    $("e-group").value = cur;
    $("e-group").dataset.cur = cur;
  }

  function fieldHtml(key, label, value, extra) {
    return '<div class="field"><label>' + esc(label) + (extra || "") + '</label><div class="shown' + (value ? "" : " blank") + '" tabindex="0" role="button" data-edit="' + esc(key) + '">' +
      (value ? md(value) : STR.blank) + '</div></div>';
  }
  function renderFields() {
    var html = '<div class="field note"><label for="f-note">' + STR.note + ' <span class="hint">' + STR.noteHint + '</span></label>' +
      '<textarea id="f-note" data-key="__note" rows="2" placeholder="' + esc(STR.notePh) + '">' + esc(draft.note) + '</textarea></div>';
    html += filesHtml();
    if (draft.canonDesc !== null) html += fieldHtml("__canon", LANG === "en" ? "Description" : "Опис", draft.canonDesc, ' <span class="canon">· ' + STR.canonField + '</span>');
    var gk = groupKey(sec(open.section)); // edited through the subheading menu in the head
    draft.defs.forEach(function (d) { if (d.key !== gk) html += fieldHtml(d.key, d.label, draft.fields[d.key] || ""); });
    html += '<div class="field"><label for="nf">' + STR.addField + '</label><div class="newfield"><input id="nf" placeholder="' + esc(STR.addFieldPh) + '"><button class="btn" id="nf-add">' + STR.add + '</button></div></div>';
    $("e-body").innerHTML = html;
  }
  // ---------- files on a card: prefabs, models, images… (Storage: worlds/{w}/games/{g}/files/{cardId}/…) ----------
  var MAX_FILE = 200 * 1024 * 1024;
  var MODEL_EXT = /\.(glb|gltf|fbx|obj|stl)$/i; // keep in sync with gb-3d.js
  function is3D(f) { return MODEL_EXT.test(f.name || ""); }
  function view3d(f, files) {
    import("./gb-3d.js").then(function (m) { m.view3d(f, STR.v3d, files); }).catch(function (e) { alert(STR.failed + ": " + (e.message || e)); });
  }
  function isImage(f) { return /^image\//.test(f.type || "") || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || ""); }
  function fileSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function filesHtml() {
    var files = open.files || [];
    var list = files.map(function (f) {
      return '<div class="file">' + (isImage(f) ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img loading="lazy" alt="" src="' + esc(f.url) + '"></a>' : '<span class="ico">' + (is3D(f) ? '🧊' : '📦') + '</span>') +
        '<a class="fname" href="' + esc(f.url) + '" target="_blank" rel="noopener" download="' + esc(f.name) + '">' + esc(f.name) + '</a><span class="muted">' + fileSize(f.size || 0) + '</span>' +
        (is3D(f) ? '<button class="btn" data-view3d="' + esc(f.id) + '">' + STR.v3d.open + '</button>' : '') +
        (canWrite ? '<button class="btn danger" data-rmfile="' + esc(f.id) + '" aria-label="' + esc(STR.remove + " " + f.name) + '">✕</button>' : '') + '</div>';
    }).join("");
    var add = !canWrite ? "" : open.isNew ? '<p class="muted">' + STR.filesSaveFirst + '</p>'
      : '<label class="btn"><input type="file" multiple id="f-up" hidden>' + STR.filesAdd + '</label>';
    return '<div class="field files"><label>' + STR.files + ' <span class="hint">' + STR.filesHint + '</span></label>' + list + add + '</div>';
  }
  async function uploadFiles(list) {
    var card = open, done = 0;
    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      if (file.size > MAX_FILE) { msg(STR.fileTooBig + ": " + file.name); continue; }
      var id = newId("file"), path = "worlds/" + worldId + "/games/" + gameId + "/files/" + card.id + "/" + id + "-" + file.name.replace(/[\/\\#?\[\]*]/g, "_");
      try {
        var task = firebase.storage().ref(path).put(file, { contentType: file.type || "application/octet-stream" });
        task.on("state_changed", function (s) { if (open === card) msg(STR.uploading + " " + file.name + " · " + Math.round(100 * s.bytesTransferred / (s.totalBytes || 1)) + "%"); });
        await task;
        var meta = { id: id, name: file.name, path: path, url: await task.snapshot.ref.getDownloadURL(), size: file.size, type: file.type || "", uploadedAt: Date.now() };
        var body = { section: card.section, files: firebase.firestore.FieldValue.arrayUnion(meta), updatedAt: stamp() };
        if (card.src === "canon") body.canonRef = card.id;
        await gref().collection("cards").doc(card.id).set(body, { merge: true });
        card.files = (card.files || []).concat([meta]); done++;
      } catch (e) { msg(STR.failed + ": " + file.name + " — " + (e.code || e.message || e)); return; }
    }
    if (open === card) { [].forEach.call(document.querySelectorAll("#e-body textarea"), collect); renderFields(); msg(STR.filesDone + ": " + done); }
  }
  async function removeFile(id) {
    var card = open, f = (card.files || []).filter(function (x) { return x.id === id; })[0];
    if (!f || !confirm(STR.confirmFile + " " + f.name + "?")) return;
    try {
      await firebase.storage().ref(f.path).delete().catch(function (e) { if (e.code !== "storage/object-not-found") throw e; });
      await gref().collection("cards").doc(card.id).set({ files: firebase.firestore.FieldValue.arrayRemove(f), updatedAt: stamp() }, { merge: true });
      card.files = card.files.filter(function (x) { return x.id !== id; });
      if (open === card) { [].forEach.call(document.querySelectorAll("#e-body textarea"), collect); renderFields(); }
    } catch (e) { msg(STR.failed + ": " + (e.code || e.message || e)); }
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
    var gk = groupKey(sec(open.section));
    if (gk) {
      draft.fields[gk] = $("e-group").value;
      if (!draft.defs.some(function (d) { return d.key === gk; })) draft.defs.push({ key: gk, label: STR.group });
    }
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
      closeLeaf();
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
      await Promise.all((open.files || []).map(function (f) { return firebase.storage().ref(f.path).delete().catch(function () {}); }));
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

  // The sections as the AI sees them: id, name in the author's language, field labels
  function shelves() {
    return sections().filter(function (x) { return !x.special; }).map(function (x) {
      return { id: x.id, name: L(x), kind: x.canon ? "canon" : "game", canonKind: x.canon || "", fields: (x.defs || []).map(function (d) { return d.label; }) };
    });
  }

  // ---------- import .md: AI sorts the notes onto the shelves, the author ticks what goes in ----------
  function startImport(file) {
    var rd = new FileReader();
    rd.onload = async function () {
      var text = String(rd.result || "");
      closeLeaf();
      if (text.length > 100000) { imp = { error: STR.importTooBig }; return render(); }
      imp = { busy: true }; render();
      try { var data = await callFn({ op: "import", markdown: text, shelves: shelves() }); imp = { proposal: data.proposal, spent: data.tokensConsumed, off: {} }; }
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
      var box = function (kind, i, label, detail) { return '<label class="imp"><input type="checkbox"' + (imp.off[kind + ':' + i] ? '' : ' checked') + ' data-imp="' + kind + ':' + i + '"><span><b>' + esc(label) + '</b>' + (detail ? '<span class="muted"> — ' + esc(detail) + '</span>' : '') + '</span></label>'; };
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
    [].forEach.call(document.querySelectorAll("[data-imp]"), function (cb) { cb.onchange = function () { imp.off[cb.dataset.imp] = !cb.checked; }; }); // survives re-renders from live snapshots
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
      var s = sec(c.section);
      var same = cards.filter(function (x) { return !x.canonRef && x.section === s.id && String(x.title || "").trim().toLowerCase() === c.title.trim().toLowerCase(); })[0];
      if (same) { // the card already exists: add the imported fields to it, keep what the author wrote
        var g = toFields(c.fields, same.defs || s.defs || CUSTOM_DEFS), merged = Object.assign({}, same.fields);
        Object.keys(g.fields).forEach(function (k) { merged[k] = merged[k] && merged[k] !== g.fields[k] ? merged[k] + "\n\n" + g.fields[k] : g.fields[k]; });
        batch.set(gref().collection("cards").doc(same.id), { fields: merged, defs: (same.defs || s.defs || CUSTOM_DEFS).concat(g.extra), updatedAt: stamp() }, { merge: true });
        n++;
        return;
      }
      var f = toFields(c.fields, s.defs || CUSTOM_DEFS);
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
    var run = planDoc.running && planDoc.running.at && planDoc.running.at.toMillis && Date.now() - planDoc.running.at.toMillis() < 35 * 60000 ? planDoc.running.op : null;
    var busy = !!(planBusy || run), busyOp = planBusy || run;
    var html = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div>' +
      '<div class="row">' + (plan ? '<button class="btn" id="p-md">' + STR.exportMd + '</button>' : '') +
      '<button class="btn' + (gdd ? '' : ' primary') + '" id="p-analyze"' + (busy ? ' disabled' : '') + '>' + (gdd ? STR.reanalyze : STR.analyze) + '</button>' +
      (gdd ? '<button class="btn primary" id="p-plan"' + (busy || blockers ? ' disabled title="' + esc(STR.blockersLeft) + '"' : '') + '>' + (plan ? STR.remakePlan : STR.makePlan) + '</button>' : '') +
      '</div></header>';
    html += '<p class="pmsg">' + esc(busyOp === "analyze" ? STR.busyAnalyze : busyOp === "plan" ? STR.busyPlan : planMsg || (gdd ? (blockers ? STR.blockersLeft + ' (' + blockers + ').' : '') : STR.planIntro)) +
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
    if (plan) html += execHtml();
    var crs = changeReqs.filter(function (c) { return c.status === "open"; });
    if (crs.length) html += '<section class="psec"><h2 class="group">' + STR.crTitle + ' <span>' + crs.length + '</span></h2>' + crs.map(function (c) {
      return '<div class="q"><div class="q__top">' + (c.taskId ? '<span class="mono">' + esc(c.taskId) + '</span> ' : '') + '<b>' + esc(c.what) + '</b></div>' +
        '<div class="muted">' + STR.crWhy + ': ' + esc(c.why) + '</div>' + (c.proposal ? '<div>' + STR.crProposal + ': ' + esc(c.proposal) + '</div>' : '') +
        (c.impact ? '<div class="muted">' + STR.crImpact + ': ' + esc(c.impact) + '</div>' : '') +
        (canWrite ? '<div class="row"><button class="btn primary" data-cr="' + esc(c.id) + '" data-to="accepted">' + STR.crAccept + '</button><button class="btn" data-cr="' + esc(c.id) + '" data-to="rejected">' + STR.crReject + '</button></div>' : '') + '</div>';
    }).join("") + '</section>';
    if (planDoc.scaffold && !planDoc.scaffold.appliedAt && ((planDoc.scaffold.sections || []).length || (planDoc.scaffold.cards || []).length)) html += scaffoldHtml(planDoc.scaffold);
    if (plan) html += planHtml(plan);
    $("view").innerHTML = html;
    [].forEach.call(document.querySelectorAll("[data-sc]"), function (cb) { cb.onchange = function () { scOff[cb.dataset.sc] = !cb.checked; }; });
    var scb = $("sc-ok"); if (scb) scb.onclick = function () { scb.disabled = true; applyScaffold().catch(function (e) { planMsg = STR.failed + ": " + e.message; render(); }); };

    var a = $("p-analyze"); if (a) a.onclick = function () { runPlan("analyze"); };
    var pl = $("p-plan"); if (pl) pl.onclick = function () { runPlan("plan"); };
    var mdb = $("p-md"); if (mdb) mdb.onclick = exportMarkdown;
  }

  // ---------- what the plan needs but the bible lacks: the author ticks, empty cards appear "in progress" ----------
  var scOff = {};
  function scaffoldName(id) { return id.indexOf("new:") === 0 ? id.slice(4) : L(sec(id)); }
  function scaffoldHtml(sc) {
    var box = function (k, label, detail) { return '<label class="imp"><input type="checkbox"' + (scOff[k] ? '' : ' checked') + ' data-sc="' + esc(k) + '"><span><b>' + esc(label) + '</b>' +
      (detail ? '<span class="muted"> — ' + esc(detail) + '</span>' : '') + '</span></label>'; };
    var html = '<section class="psec"><h2 class="group">' + STR.scTitle + ' <span>' + ((sc.sections || []).length + (sc.cards || []).length) + '</span></h2><p class="muted">' + STR.scIntro + '</p>';
    if ((sc.sections || []).length) html += '<h3 class="sub">' + STR.scSections + '</h3>' + sc.sections.map(function (x, i) { return box("s:" + i, x.name, x.why || x.about); }).join("");
    var by = {};
    (sc.cards || []).forEach(function (c, i) { (by[c.section] = by[c.section] || []).push([c, i]); });
    Object.keys(by).forEach(function (id) {
      html += '<h3 class="sub">' + esc(scaffoldName(id)) + '</h3>' + by[id].map(function (x) {
        return box("c:" + x[1], x[0].title + (x[0].group ? " · " + x[0].group : ""), (x[0].task ? x[0].task + ": " : "") + x[0].need); }).join("");
    });
    return html + '<div class="row"><button class="btn primary" id="sc-ok">' + STR.scApply + '</button></div></section>';
  }
  async function applyScaffold() {
    var sc = planDoc.scaffold, batch = db.batch(), n = 0;
    var own = (game.sections || []).slice(), made = {};
    (sc.sections || []).forEach(function (x, i) {
      if (scOff["s:" + i]) return;
      var id = newId("sec"); made[x.name] = id;
      own.push({ id: id, name: x.name, about: x.about || "" }); n++;
    });
    if (own.length !== (game.sections || []).length) batch.set(gref(), { sections: own, updatedAt: stamp() }, { merge: true });
    var all = allCards();
    (sc.cards || []).forEach(function (c, i) {
      if (scOff["c:" + i]) return;
      var target = c.section.indexOf("new:") === 0 ? made[c.section.slice(4)] : c.section;
      if (!target) return; // its new section was unticked
      var exists = all.some(function (x) { return x.section === target && x.title.trim().toLowerCase() === c.title.trim().toLowerCase(); });
      if (exists) return;
      var s = sec(target), defs = (s.defs || CUSTOM_DEFS).slice(), fields = {}, gk = groupKey(s);
      if (gk && c.group) { fields[gk] = c.group; if (!defs.some(function (d) { return d.key === gk; })) defs.unshift({ key: gk, label: STR.group }); }
      defs.push({ key: "need", label: STR.scNeed }, { key: "task", label: STR.scTask });
      fields.need = c.need; fields.task = c.task;
      batch.set(gref().collection("cards").doc(newId("card")), { section: target, title: c.title, status: "work", note: "", defs: defs, fields: fields,
        planTask: c.task || "", order: Date.now() + i, createdAt: stamp(), updatedAt: stamp() });
      n++;
    });
    batch.set(gref().collection("plan").doc("current"), { scaffold: { appliedAt: stamp() } }, { merge: true });
    await batch.commit();
    planMsg = STR.scDone + ": " + n; render();
  }

  function qHtml(q) {
    return '<div class="q" data-q="' + esc(q.id) + '"><div class="q__top"><span class="pill p-' + q.priority + '">' + esc(STR.prio[q.priority]) + '</span>' +
      (q.topic ? ' <span class="muted">' + esc(q.topic) + '</span>' : '') + '</div>' +
      '<div class="q__q">' + esc(q.question) + '</div>' + (q.why ? '<div class="muted">' + esc(q.why) + '</div>' : '') +
      (q.options && q.options.length ? '<div class="row q__opts">' + q.options.map(function (o) { return '<button class="chip" data-opt="' + esc(o) + '">' + esc(o) + '</button>'; }).join("") + '</div>' : '') +
      '<textarea rows="2" placeholder="' + esc(STR.answerPh) + '"></textarea><div class="row"><button class="btn primary" data-answer>' + STR.answer + '</button></div></div>';
  }

  function cardName(ref) {
    if (ref.indexOf("new:") === 0) return ref.slice(4);
    var c = allCards().filter(function (x) { return x.key === ref; })[0];
    return c ? c.title : ref;
  }
  // ---------- execution: Claude Code connects over MCP with a per-game key; tasks move todo → in_progress → review → done ----------
  function execHtml() {
    var live = keys.filter(function (k) { return !k.revoked; });
    var html = '<section class="psec"><h2 class="group">' + STR.exTitle + '</h2><p class="muted">' + STR.exIntro + '</p>';
    if (newKey) html += '<div class="canonbox"><h4>' + STR.exKeyOnce + '</h4><pre>claude mcp add --transport http whitewrite ' + MCP_URL + ' --header "Authorization: Bearer ' + esc(newKey) + '"</pre>' +
      '<button class="btn" data-copy>' + STR.copy + '</button><p class="muted">' + STR.exThen + '</p></div>';
    html += live.map(function (k) {
      var used = k.lastUsedAt && k.lastUsedAt.toDate ? k.lastUsedAt.toDate().toLocaleString(LANG === "en" ? "en-GB" : "uk-UA") : STR.exNever;
      return '<div class="file"><span class="ico">🔑</span><span class="fname"><span class="mono">' + esc(k.prefix) + '…</span> · ' + STR.exUsed + ': ' + esc(used) + '</span>' +
        (canWrite ? '<button class="btn danger" data-revoke="' + esc(k.id) + '">' + STR.exRevoke + '</button>' : '') + '</div>';
    }).join("");
    if (canWrite) html += '<div class="row"><button class="btn' + (live.length ? '' : ' primary') + '" id="ex-new">' + (live.length ? STR.exAnother : STR.exConnect) + '</button></div>';
    if (execs.length) html += '<h3 class="sub">' + STR.exLog + '</h3><ul class="exlog">' + execs.slice(0, 8).map(function (x) {
      var at = x.at && x.at.toDate ? x.at.toDate().toLocaleTimeString(LANG === "en" ? "en-GB" : "uk-UA") : "";
      var what = (x.data && (x.data.message || x.data.summary || x.data.problem || x.data.what)) || "";
      return '<li><span class="muted">' + esc(at) + '</span> <b>' + esc(STR.exType[x.type] || x.type) + '</b>' + (x.taskId ? ' <span class="mono">' + esc(x.taskId) + '</span>' : '') + (what ? ' — ' + esc(what) : '') + '</li>';
    }).join("") + '</ul>';
    return html + '</section>';
  }
  async function createKey() {
    var bytes = crypto.getRandomValues(new Uint8Array(32));
    var key = "wwk_" + btoa(String.fromCharCode.apply(null, bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    var digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    var hash = Array.from(new Uint8Array(digest), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    await db.collection("mcpKeys").doc(hash).set({ uid: firebase.auth().currentUser.uid, worldId: worldId, gameId: gameId, label: game.title || "",
      prefix: key.slice(0, 12), createdAt: stamp() });
    newKey = key; render(); // shown once: only the hash is stored
  }
  var liveTask = function (id) { return tasks.filter(function (x) { return x.id === String(id).replace(/[\/\s]/g, "_"); })[0]; };
  function taskState(t) {
    var lt = liveTask(t.id); if (!lt) return "";
    var html = '';
    if (lt.status === "in_progress" && lt.lastProgress) html += '<div class="muted">⟳ ' + esc(lt.lastProgress) + '</div>';
    if (lt.status === "blocked" && lt.blocker) html += '<div class="tblock"><b>' + STR.blocked + ':</b> ' + esc(lt.blocker.problem) + (lt.blocker.needs ? '<div class="muted">' + STR.needs + ': ' + esc(lt.blocker.needs) + '</div>' : '') +
      (canWrite ? '<div class="row"><button class="btn" data-unblock="' + esc(lt.id) + '">' + STR.unblock + '</button></div>' : '') + '</div>';
    if (lt.status === "review" && lt.report) {
      var r = lt.report, ck = r.check || {};
      html += '<div class="treview"><div><b>' + STR.report + ':</b> ' + esc(r.summary) + '</div>' +
        (r.commit ? '<div class="muted">commit: <span class="mono">' + esc(r.commit) + '</span></div>' : '') +
        ((r.changes || []).length ? '<details><summary>' + STR.changes + ' (' + r.changes.length + ')</summary><pre>' + esc(r.changes.join("\n")) + '</pre></details>' : '') +
        '<div>' + STR.tests + ': ' + (r.tests && r.tests.ran ? '✓ ' + r.tests.passed + ' · ✗ ' + r.tests.failed : STR.testsNone) + '</div>' +
        ((r.criteria || []).length ? '<ul class="crit">' + r.criteria.map(function (c) { return '<li>' + (c.met ? '✅' : '❌') + ' ' + esc(c.criterion) + (c.evidence ? ' <span class="muted">— ' + esc(c.evidence) + '</span>' : '') + '</li>'; }).join("") + '</ul>' : '') +
        '<div class="muted">' + STR.serverCheck + ': ' + (ck.allCriteriaMet && ck.testsGreen ? '✅ ' + STR.checkOk : '⚠ ' + STR.checkWarn + ((ck.unmet || []).length ? ' (' + esc(ck.unmet.join("; ")) + ')' : '')) + '</div>' +
        (canWrite ? '<div class="row"><button class="btn primary" data-accept="' + esc(lt.id) + '">' + STR.accept + '</button><button class="btn" data-return="' + esc(lt.id) + '">' + STR.giveBack + '</button></div>' : '') + '</div>';
    }
    return html;
  }
  async function reviewTask(id, ok) {
    var lt = liveTask(id); if (!lt) return;
    var comment = ok ? "" : (prompt(STR.returnPh) || "").trim();
    if (!ok && !comment) return;
    var batch = db.batch(), ev = { type: ok ? "accepted" : "returned", by: "author", at: Date.now() };
    if (comment) ev.comment = comment;
    batch.set(gref().collection("tasks").doc(lt.id), { status: ok ? "done" : "rework", reviewComment: comment, updatedAt: stamp(),
      history: firebase.firestore.FieldValue.arrayUnion(ev) }, { merge: true });
    if (ok) taskLinked(lt).forEach(function (c) { // what the task built is now in the game
      var body = { status: "ingame", updatedAt: stamp() };
      if (c.src === "canon") Object.assign(body, { section: c.section, canonRef: c.id });
      batch.set(gref().collection("cards").doc(c.id), body, { merge: true });
    });
    await batch.commit();
  }
  function taskLinked(t) {
    var all = allCards(), out = [];
    (t.cards || []).forEach(function (r) {
      var c = r.indexOf("new:") === 0 ? all.filter(function (x) { return x.src === "game" && x.title.toLowerCase() === r.slice(4).toLowerCase(); })[0]
        : all.filter(function (x) { return x.key === r; })[0];
      if (c && out.indexOf(c) < 0) out.push(c);
    });
    cards.filter(function (c) { return c.planTask === t.id && !c.canonRef; }).forEach(function (c) {
      var v = all.filter(function (x) { return x.key === "c:" + c.id; })[0]; if (v && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  }
  async function unblockTask(id) {
    var lt = liveTask(id); if (!lt) return;
    var note = (prompt(STR.unblockPh) || "").trim();
    await gref().collection("tasks").doc(lt.id).set({ status: lt.report ? "rework" : "todo", reviewComment: note, blocker: firebase.firestore.FieldValue.delete(), updatedAt: stamp(),
      history: firebase.firestore.FieldValue.arrayUnion({ type: "unblocked", by: "author", comment: note, at: Date.now() }) }, { merge: true });
  }

  function planHtml(plan) {
    var html = '<section class="psec"><h2 class="group">' + STR.planTitle + '</h2>' + (plan.overview ? '<p>' + esc(plan.overview) + '</p>' : '');
    if (tasks.length) {
      var done = tasks.filter(function (t) { return t.status === "done"; }).length, pct = Math.round(100 * done / tasks.length);
      html += '<div class="ready"><span>' + STR.progress + '</span><div class="ready__bar"><i style="width:' + pct + '%"></i></div><b>' + done + ' / ' + tasks.length + '</b></div>';
    }
    if (plan.engineNotes) html += '<div class="canonbox"><h4>' + STR.engineNotes + '</h4><div>' + esc(plan.engineNotes) + '</div></div>';
    (plan.milestones || []).forEach(function (m) {
      html += '<div class="ms"><h3>' + esc(m.id) + ' · ' + esc(m.name) + '</h3>' + (m.goal ? '<p><b>' + STR.goal + ':</b> ' + esc(m.goal) + '</p>' : '') +
        (m.gate ? '<p class="gate"><b>' + STR.gate + ':</b> ' + esc(m.gate) + '</p>' : '') +
        (m.tasks || []).map(function (t) {
          var lt = liveTask(t.id), acc = (lt && lt.accept) || t.accept || [], tst = (lt && lt.tests) || t.tests || []; // the task doc is the source of truth
          return '<div class="task' + (lt ? ' t-' + lt.status : '') + '"><div class="task__h"><span class="mono">' + esc(t.id) + '</span> <b>' + esc(t.title) + '</b>' +
            (lt ? ' <span class="pill tst-' + lt.status + '">' + esc(STR.ts[lt.status] || lt.status) + '</span>' : '') +
            ' <span class="pill s-agreed">' + esc(t.size) + '</span> <span class="pill s-idea">' + esc(t.owner) + '</span>' +
            (t.deps.length ? ' <span class="muted">' + STR.deps + ' ' + esc(t.deps.join(", ")) + '</span>' : '') + '</div>' +
            (t.detail ? '<div class="task__d">' + esc(t.detail) + '</div>' : '') +
            ((t.cards || []).length ? '<div class="muted task__c">' + STR.taskCards + ': ' + esc(t.cards.map(cardName).join(", ")) + '</div>' : '') +
            (acc.length ? '<details><summary>' + STR.acceptTitle + ' (' + acc.length + ')</summary><ul class="crit">' + acc.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join("") + '</ul>' +
              (tst.length ? '<div class="muted">' + STR.tests + ': ' + esc(tst.join("; ")) + '</div>' : '') + '</details>' : '') +
            taskState(t) +
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
    try { var data = await callFn({ op: op, shelves: shelves() }); planMsg = STR.spent + ": " + data.tokensConsumed; }
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
  // Embedded in the shell: lift each view's title and action buttons onto the logo strip (#topline).
  // Runs after every render (the observer fires once the render has bound its buttons, so handlers move with them).
  if (document.documentElement.classList.contains("ww-embed")) {
    new MutationObserver(function () {
      var top = $("topline"), head = $("view").querySelector("header.sec");
      top.innerHTML = "";
      if (!head) return;
      var h1 = head.querySelector("h1"), actions = head.querySelector(":scope > .row");
      if (h1) top.appendChild(h1);
      if (actions) top.appendChild(actions);
    }).observe($("view"), { childList: true });
  }
  $("topline").addEventListener("click", function (e) { viewClick(e); });
  $("view").addEventListener("click", viewClick);
  function viewClick(e) {
    var opt = e.target.closest("[data-opt]");
    if (opt) { opt.closest(".q").querySelector("textarea").value = opt.dataset.opt; return; }
    var ans = e.target.closest("[data-answer]");
    if (ans) { var q = ans.closest(".q"); ans.disabled = true; answerQuestion(q.dataset.q, q.querySelector("textarea").value.trim()).catch(function (er) { planMsg = er.message; render(); }); return; }
    var ex = e.target.closest("#ex-new"); if (ex) { ex.disabled = true; createKey().catch(function (er) { planMsg = STR.failed + ": " + er.message; render(); }); return; }
    var rv = e.target.closest("[data-revoke]");
    if (rv) { if (confirm(STR.exRevokeQ)) db.collection("mcpKeys").doc(rv.dataset.revoke).delete(); return; }
    var acc = e.target.closest("[data-accept]"); if (acc) { acc.disabled = true; reviewTask(acc.dataset.accept, true); return; }
    var ret = e.target.closest("[data-return]"); if (ret) { reviewTask(ret.dataset.return, false); return; }
    var ub = e.target.closest("[data-unblock]"); if (ub) { unblockTask(ub.dataset.unblock); return; }
    var cr = e.target.closest("[data-cr]");
    if (cr) { gref().collection("changeRequests").doc(cr.dataset.cr).set({ status: cr.dataset.to, decidedAt: stamp() }, { merge: true }); return; }
    var cp = e.target.closest("[data-copy]");
    if (cp) { navigator.clipboard.writeText(cp.previousElementSibling.textContent).then(function () { cp.textContent = STR.copied; }); return; }
    var v = e.target.closest("[data-view3d]");
    if (v) { var vc = allCards().filter(function (x) { return x.key === v.closest(".card").dataset.key; })[0]; view3d(vc.files.filter(function (f) { return f.id === v.dataset.view3d; })[0], vc.files); return; }
    var c = e.target.closest(".card"); if (!c) return;
    var card = allCards().filter(function (x) { return x.key === c.dataset.key; })[0]; if (card) openCard(card);
  }
  $("q").addEventListener("input", function (e) { query = e.target.value.trim().toLowerCase(); render(); });
  $("statuses").addEventListener("click", function (e) {
    var b = e.target.closest("[data-status]"); if (!b) return;
    statusFilter[b.dataset.status] = !statusFilter[b.dataset.status]; renderStatuses(); render();
  });
  $("e-body").addEventListener("click", function (e) {
    var s = e.target.closest(".shown"); if (s) { editField(s.dataset.edit); return; }
    var rm = e.target.closest("[data-rmfile]"); if (rm) { removeFile(rm.dataset.rmfile); return; }
    var v3 = e.target.closest("[data-view3d]"); if (v3) { view3d(open.files.filter(function (f) { return f.id === v3.dataset.view3d; })[0], open.files); return; }
    if (e.target.id === "nf-add") {
      var label = $("nf").value.trim(); if (!label) return;
      var key = fieldKey(label);
      [].forEach.call(document.querySelectorAll("#e-body textarea"), collect);
      if (!draft.defs.some(function (d) { return d.key === key; })) draft.defs.push({ key: key, label: label });
      renderFields(); editField(key);
    }
  });
  $("e-body").addEventListener("change", function (e) {
    if (e.target.id === "f-up" && e.target.files.length) { var list = [].slice.call(e.target.files); e.target.value = ""; uploadFiles(list); }
  });
  $("e-body").addEventListener("keydown", function (e) {
    var s = e.target.closest(".shown"); if (s && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); editField(s.dataset.edit); }
  });
  $("e-group").addEventListener("change", function (e) {
    if (e.target.value !== "__new") { e.target.dataset.cur = e.target.value; return; }
    var sel = e.target;
    askName(STR.newGroup.replace(/^＋\s*/, ""), STR.newGroupPh, function (name) { fillGroups(name || sel.dataset.cur, name ? [name] : []); sel.focus(); });
  });
  // A small dialog in the service's style instead of the browser's prompt(); done(name) gets "" on cancel.
  function askName(title, ph, done) {
    var box = document.createElement("div");
    box.className = "ask";
    box.innerHTML = '<form class="ask-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' +
      '<input id="ask-in" autocomplete="off" placeholder="' + esc(ph) + '">' +
      '<div class="row"><button type="button" class="btn" id="ask-x">' + STR.cancel + '</button><button class="btn primary" id="ask-ok">' + STR.create + '</button></div></form>';
    document.body.appendChild(box);
    var input = box.querySelector("input");
    function finish(v) { box.remove(); done(v); }
    box.querySelector("form").onsubmit = function (ev) { ev.preventDefault(); var v = input.value.trim(); if (v) finish(v); else input.focus(); };
    box.querySelector("#ask-x").onclick = function () { finish(""); };
    box.addEventListener("mousedown", function (ev) { if (ev.target === box) finish(""); });
    box.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); finish(""); } });
    input.focus();
  }
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
    if (e.key === "Tab" && open && !document.querySelector(".v3d")) { // keep focus inside the leaf
      var f = [].filter.call($("leaf").querySelectorAll("button,input,select,textarea,[tabindex]"), function (x) { return !x.disabled && x.offsetParent; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // ---------- boot ----------
  $("t-brand").textContent = STR.brand; $("t-engine").textContent = STR.engine; $("q").placeholder = STR.search;
  $("e-group").setAttribute("aria-label", STR.group); $("e-save").textContent = STR.save; $("e-close").textContent = STR.close; $("imp-btn").title = STR.importMd; $("imp-btn").setAttribute("aria-label", STR.importMd);
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
    tasks = []; changeReqs = []; execs = []; keys = []; newKey = null;
    var rows = function (snap) { return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); };
    unsub.push(gref().collection("tasks").onSnapshot(function (snap) { tasks = rows(snap).sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); render(); }));
    unsub.push(gref().collection("changeRequests").onSnapshot(function (snap) { changeReqs = rows(snap); render(); }));
    unsub.push(gref().collection("executions").orderBy("at", "desc").limit(12).onSnapshot(function (snap) { execs = rows(snap); if (section === "plan") render(); }));
    unsub.push(db.collection("mcpKeys").where("uid", "==", firebase.auth().currentUser.uid).where("gameId", "==", id)
      .onSnapshot(function (snap) { keys = rows(snap); if (section === "plan") render(); }, function () {}));
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
