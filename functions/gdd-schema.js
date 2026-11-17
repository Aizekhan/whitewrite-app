// 🧭 GDD schema (owner, GDD refocus 2026-11-17) — the ONE source of truth about the game's GDD sections: the development stage each
// belongs to (1–13, the menu order), what goes into it, what does NOT and where that goes instead, and the minimum that makes a stage
// «filled». The Bible's menu and guide, the .md import and folder sort prompts, MCP (get_gdd_schema, get_gdd_status, save_card hints)
// read it. Section ids never change here — tasks, MCP, card-refs.js, telemetry and exports point at them; only the presentation does.
// Engine-agnostic: no Unity or Roblox words. functions/ is the source; scripts/build-app.mjs copies it to app/firebase/ (window.__GDD).
(function () {
  // need: every entry [ids, n] must hold — at least n cards / items in those sections together (an optional stage has no need)
  var STAGES = [
    { n: 1, id: 'vision', uk: 'Бачення', en: 'Vision', need: [[['overview'], 1]],
      ask: { uk: 'Що це за гра в одному реченні? Для кого вона? Які 3–4 стовпи гри? Чим вона не схожа на інші?', en: 'What is the game in one sentence? Who is it for? What are its 3–4 pillars? How is it unlike others?' } },
    { n: 2, id: 'core', uk: 'Ядро геймплею', en: 'Core gameplay', need: [[['mechanics'], 3]],
      ask: { uk: 'Що гравець робить щохвилини? Який основний цикл? Як керує? Що він відчуває від удару, стрибка, перемоги?', en: 'What does the player do every minute? What is the core loop? How do they control it? How do a hit, a jump, a win feel?' } },
    { n: 3, id: 'world', uk: 'Світ і лор гри', en: 'World & lore', need: [[['lore', 'locations', 'factions'], 1]],
      ask: { uk: 'Як гра подає світ: епоха, тон, таємниці? Де відбувається дія? Хто з ким воює?', en: 'How does the game present the world: era, tone, secrets? Where does it happen? Who fights whom?' } },
    { n: 4, id: 'style', uk: 'Стиль гри', en: 'Art direction', need: [[['artstyle'], 1]],
      ask: { uk: 'Як гра виглядає: палітра, світло, форми, матеріали? Чого точно не буде?', en: 'What does the game look like: palette, light, shapes, materials? What is out for sure?' } },
    { n: 5, id: 'cast', uk: 'Персонажі й вороги', en: 'Characters & enemies', need: [[['characters'], 1], [['enemies'], 1]],
      ask: { uk: 'Ким грає гравець? Хто поруч із ним? Хто стоїть на шляху і як із ним битися?', en: 'Who does the player play? Who is at their side? Who stands in the way and how do you fight it?' } },
    { n: 6, id: 'structure', uk: 'Структура гри', en: 'Game structure', need: [[['levels', 'gamemap', 'worldgen'], 1]],
      ask: { uk: 'З яких частин складається гра: акти, світи, рівні, карта? Скільки триває кожна і чого вчить?', en: 'What parts is the game made of: acts, worlds, levels, a map? How long is each and what does it teach?' } },
    { n: 7, id: 'economy', uk: 'Прогресія, предмети, економіка', en: 'Progression, items & economy', need: [[['progression', 'gear', 'items', 'playcards'], 1]],
      ask: { uk: 'Як гравець росте? Що збирає, за що платить, де бере? Де він застрягне чи розбагатіє?', en: 'How does the player grow? What do they collect, pay for, find? Where would they get stuck or rich?' } },
    { n: 8, id: 'narrative', uk: 'Наратив', en: 'Narrative', need: [[['quests', 'dialogues', 'scenes'], 1]],
      ask: { uk: 'Які квести й діалоги ведуть гравця? Які ключові сцени він запамʼятає?', en: 'Which quests and dialogues lead the player? Which key scenes will they remember?' } },
    { n: 9, id: 'content', uk: 'Виробництво контенту', en: 'Content production', need: [[['assets', 'materials', 'animation', 'ui', 'audio'], 1]],
      ask: { uk: 'Які моделі, текстури, анімації, екрани й звуки треба зробити? Що вже є?', en: 'Which models, textures, animations, screens and sounds must be made? What exists already?' } },
    { n: 10, id: 'tech', uk: 'Технічне', en: 'Technical', need: [[['tech'], 1]],
      ask: { uk: 'Рушій, платформи, збереження, мультиплеєр, бюджети продуктивності — що вирішено?', en: 'Engine, platforms, saves, multiplayer, performance budgets — what is decided?' } },
    { n: 11, id: 'production', uk: 'Продакшн-план', en: 'Production plan', need: [[['plan'], 1]],
      ask: { uk: 'Етапи до MVP, задачі для Claude Code, ворота, що неузгоджене.', en: 'Milestones to the MVP, tasks for Claude Code, gates, what is inconsistent.' } },
    { n: 12, id: 'players', uk: 'Досвід гравців', en: 'Player experience', optional: true,
      ask: { uk: 'Що гра надсилає для аналітики? Де гравці застрягають чи йдуть?', en: 'What does the game send for analytics? Where do players get stuck or leave?' } },
    { n: 13, id: 'release', uk: 'Реліз і маркетинг', en: 'Release & marketing', optional: true,
      ask: { uk: 'Що готово до релізу? Що й де розповідаємо гравцям?', en: 'What is ready for release? What do we tell players and where?' } },
  ];

  // here — what goes into the section; not — [what, goTo section] that must NOT go here; write — Claude Code may create cards here (save_card)
  var S = function (id, stage, uk, en, here, not, write) { return { id: id, stage: stage, uk: uk, en: en, here: here, not: not || [], write: !!write }; };
  var N = function (goTo, uk, en) { return { goTo: goTo, uk: uk, en: en }; };
  var SECTIONS = [
    S('overview', 1, 'Огляд гри', 'Game overview',
      { uk: 'Суть гри: логлайн, жанр, стовпи, один рядок основного циклу, платформа, гравці, тривалість сесії, аудиторія, чим гра інша, як виграти.', en: 'What the game is: logline, genre, pillars, the core loop in one line, platform, players, session length, audience, what makes it different, how to win.' },
      [N('refs', 'ігри-зразки й картинки-референси', 'reference games and reference pictures'), N('artstyle', 'візуальний стиль', 'the visual style'),
       N('mechanics', 'детальні правила й числа систем, цикли гри', 'detailed rules and numbers of systems, game loops'), N('activity', 'плани сесій, звіти, що зроблено', 'session plans, reports, what was done')], true),
    S('refs', 1, 'Референси', 'References',
      { uk: 'Мудборд та ігри-зразки: що саме беремо і чого уникаємо — візуал, геймплей, звук, UI.', en: 'Moodboard and reference games: what exactly we take and what we avoid — visuals, gameplay, sound, UI.' },
      [N('artstyle', 'маніфест і правила стилю', 'the style manifesto and rules'), N('assets', 'моделі й файли, що підуть у гру', 'models and files that go into the game')], true),
    S('mechanics', 2, 'Механіки', 'Mechanics',
      { uk: 'Системи гри: бій, рух, керування, відчуття, цикли, AI ворогів, взаємодія зі світом, смерть, перемога — правила, числа і звʼязки.', en: 'The game\'s systems: combat, movement, controls, feel, loops, enemy AI, world interaction, death, victory — rules, numbers and links.' },
      [N('progression', 'досвід, рівні, валюти, лут, магазин, баланс економіки', 'XP, levels, currencies, loot, shop, economy balance'), N('enemies', 'конкретний ворог і його атаки', 'a particular enemy and its attacks'), N('tech', 'технічна реалізація', 'the technical implementation')], true),
    S('lore', 3, 'Лор гри', 'Game lore',
      { uk: 'Як ця гра подає світ: епоха, сюжет гри, тон, таємниці.', en: 'How this game presents the world: era, game plot, tone, secrets.' },
      [N('canon', 'біографії, історія місць, закони світу — це канон (Біблія світу)', 'biographies, history of places, world laws — that is the canon (World Bible)')], true),
    S('locations', 3, 'Локації', 'Locations',
      { uk: 'Місця світу в цій грі: тип, розмір, палітра й світло, хто там живе.', en: 'The world\'s places in this game: type, size, palette and light, who lives there.' },
      [N('levels', 'ігрова одиниця: рівень, траса, хвиля, енкаунтер', 'a game unit: level, track, wave, encounter'), N('canon', 'історія місця', 'the history of the place')], true),
    S('factions', 3, 'Фракції', 'Factions',
      { uk: 'Організації й сили (держави, клани, гільдії) та їхня роль у геймплеї: що дають гравцю.', en: 'Organisations and powers (states, clans, guilds) and their role in gameplay: what they give the player.' },
      [N('canon', 'раси й народи — Культура світу', 'races and peoples — the world\'s Culture')], true),
    S('gstories', 3, 'Історії гри', 'Game stories', { uk: 'Історії-книги, написані в цьому світі для гри.', en: 'Story books written in this world for the game.' }),
    S('artstyle', 4, 'Візуальний стиль', 'Visual style',
      { uk: 'Загальний стиль гри і стиль частин: маніфест, палітра, заборонені кольори, світло, матеріали, форми, бюджет полігонів, так / ні.', en: 'The game\'s overall style and the style of its parts: manifesto, palette, colours to avoid, light, materials, shapes, polygon budget, do / don\'t.' },
      [N('refs', 'картинки-зразки', 'sample pictures'), N('assets', 'конкретна модель', 'a particular model')], true),
    S('characters', 5, 'Герої та NPC', 'Heroes & NPCs',
      { uk: 'Ким грає гравець, союзники й NPC: роль у грі, зброя й здібності, характеристики, вигляд, модель.', en: 'Who the player plays, allies and NPCs: game role, weapons and abilities, stats, look, model.' },
      [N('enemies', 'вороги й боси', 'enemies and bosses'), N('companions', 'улюбленці, бойові супутники, найманці, їздові, призвані', 'pets, combat companions, mercenaries, mounts, summons'), N('canon', 'біографія і звʼязки персонажа канону', 'a canon character\'s biography and connections')], true),
    S('enemies', 5, 'Вороги й боси', 'Enemies & bosses',
      { uk: 'Хто стоїть на шляху: поведінка, атаки, як перемогти, характеристики, модель. Звичайні, елітні, боси.', en: 'Who stands in the way: behaviour, attacks, how to beat it, stats, model. Regular, elite, bosses.' },
      [N('canon', 'біографія боса-персонажа', 'the biography of a boss who is a character'), N('mechanics', 'загальний AI ворогів', 'enemy AI in general')], true),
    S('companions', 5, 'Супутники й улюбленці', 'Companions & pets',
      { uk: 'Хто йде поруч із гравцем: улюбленці, бойові супутники, найманці, їздові тварини, призвані істоти — що вміють, як отримати й розвивати.', en: 'Who goes along with the player: pets, combat companions, mercenaries, mounts, summons — what they can do, how to get and grow them.' },
      [N('characters', 'людина-союзник із сюжету', 'a story ally')], true),
    S('forge', 5, 'Кузня персонажів', 'Character forge', { uk: 'Виробництво персонажа: бриф, концепт, модель, риг, екіпірування, анімації, експорт.', en: 'Making a character: brief, concept, mesh, rig, equipment, animations, export.' }),
    S('levels', 6, 'Рівні й контент', 'Levels & content',
      { uk: 'Рівні, траси, хвилі, енкаунтери, хаби: структура й розмір, вороги й події, мета гравця, тривалість.', en: 'Levels, tracks, waves, encounters, hubs: layout and size, enemies and events, player goal, length.' },
      [N('locations', 'опис місця світу', 'a description of a world place'), N('scenes', 'що відбувається в кадрі', 'what happens in a frame')], true),
    S('gamemap', 6, 'Карта гри', 'Game map', { uk: 'Карта ігрового світу: зони, точки, маршрути.', en: 'The game world map: zones, points, routes.' }),
    S('worldgen', 6, 'Генерація світу', 'World generation',
      { uk: 'Вимоги до генератора світу: біоми, модулі з контрактами, атмосфера, правила розстановки, перевірки.', en: 'Requirements for the world generator: biomes, modules with contracts, atmosphere, placement rules, validators.' },
      [N('artstyle', 'стиль біома', 'a biome\'s style')], true),
    S('progression', 7, 'Прогресія й економіка', 'Progression & economy',
      { uk: 'Досвід і рівні, дерева розвитку, валюти, лут і нагороди, магазин, апгрейди, баланс чисел.', en: 'XP and levels, development trees, currencies, loot and rewards, shop, upgrades, the balance of numbers.' },
      [N('mechanics', 'правила систем (бій, рух)', 'rules of systems (combat, movement)'), N('gear', 'конкретна зброя чи броня', 'a particular weapon or armour')], true),
    S('gear', 7, 'Предмети й спорядження', 'Items & gear',
      { uk: 'Зброя, броня, розхідники, ключові предмети, косметика: ефект, ціна, де взяти, модель.', en: 'Weapons, armour, consumables, key items, cosmetics: effect, cost, where to get, model.' },
      [N('items', 'унікальні іменовані речі (артефакти)', 'unique named things (artifacts)'), N('progression', 'валюти', 'currencies')], true),
    S('items', 7, 'Артефакти', 'Artifacts',
      { uk: 'Унікальні іменовані речі: тип, ефект, як отримати, модель.', en: 'Unique named things: type, effect, how to get, model.' },
      [N('gear', 'звичайні типи зброї, броні, розхідників', 'ordinary kinds of weapons, armour, consumables'), N('progression', 'валюти', 'currencies')], true),
    S('playcards', 7, 'Картки та інше', 'Cards & more',
      { uk: 'Ігрові картки, колоди й інше, що не є предметом чи артефактом: що робить, рідкість, ціна, де взяти.', en: 'Game cards, decks and the rest that is neither an item nor an artifact: what it does, rarity, cost, where to get.' }, [], true),
    S('quests', 8, 'Квести', 'Quests', { uk: 'Квести гри: етапи, умови, нагороди.', en: 'The game\'s quests: stages, conditions, rewards.' },
      [N('canon', 'подія світу (хроніка)', 'a world event (chronicle)')]),
    S('dialogues', 8, 'Діалоги', 'Dialogues', { uk: 'Діалоги: репліки, вибори, умови, озвучка.', en: 'Dialogues: lines, choices, conditions, voice.' }),
    S('scenes', 8, 'Сцени', 'Scenes',
      { uk: 'Ключові сцени, катсцени, ігрові моменти: що відбувається, де, настрій і світло, палітра, камера, мініпостановка.', en: 'Key scenes, cutscenes, gameplay moments: what happens, where, mood and light, palette, camera, mock-up.' },
      [N('levels', 'розмір і склад рівня', 'a level\'s size and content')], true),
    S('assets', 9, 'Ассети й префаби', 'Assets & prefabs',
      { uk: 'Моделі й префаби гри: що є і що зробити — функція, розмір, пріоритет, джерело, промпт.', en: 'The game\'s models and prefabs: what exists and what to make — function, size, priority, source, prompt.' },
      [N('refs', 'натхнення, чужі картинки', 'inspiration, other people\'s pictures')], true),
    S('materials', 9, 'Матеріали й текстури', 'Materials & textures', { uk: 'Поверхні, текстури, шейдери, рослинність, небо й світло: карти, розмір, джерело, ліцензія.', en: 'Surfaces, textures, shaders, foliage, sky and light: maps, resolution, source, licence.' }, [], true),
    S('animation', 9, 'Анімації й VFX', 'Animation & VFX', { uk: 'Анімації персонажів і ворогів, ефекти, частинки: хто, що, тривалість, джерело.', en: 'Character and enemy animations, effects, particles: who, what, length, source.' }, [], true),
    S('pictures', 9, 'Картинки', 'Pictures', { uk: 'Усі картинки гри: портрети, концепти, ілюстрації.', en: 'Every picture of the game: portraits, concepts, illustrations.' }, [], true),
    S('ui', 9, 'UI / UX', 'UI / UX', { uk: 'Екрани, HUD, меню, інвентар, онбординг: що на екрані, дії гравця, переходи.', en: 'Screens, HUD, menus, inventory, onboarding: what is on screen, player actions, transitions.' }, [], true),
    S('audio', 9, 'Звук і музика', 'Sound & music', { uk: 'Музика, звукові ефекти, озвучка, амбієнт, звуки UI: настрій, де звучить, джерело.', en: 'Music, sound effects, voice, ambience, UI sounds: mood, where it plays, source.' }, [], true),
    S('tech', 10, 'Технічне', 'Technical',
      { uk: 'Рішення автора: рушій і збірка, платформи, продуктивність, збереження, мультиплеєр, інструменти й пайплайни.', en: 'The author\'s decisions: engine and build, platforms, performance, saves, multiplayer, tools and pipelines.' },
      [N('knowledge', 'автоіндекс коду проєкту', 'the auto-index of the project code'), N('activity', 'звіт про зроблене за сесію', 'a report of what a session did')], true),
    S('knowledge', 10, 'Знання проєкту', 'Project knowledge', { uk: 'Індекс файлів і коду проєкту від Claude Code.', en: 'The index of the project files and code from Claude Code.' }),
    S('plan', 11, 'Продакшн-план', 'Production plan', { uk: 'Етапи, ворота, задачі для Claude Code.', en: 'Milestones, gates, tasks for Claude Code.' }),
    S('issues', 11, 'Неузгоджене', 'Inconsistencies', { uk: 'Суперечності між GDD, кодом і каноном.', en: 'Conflicts between the GDD, the code and the canon.' }),
    S('activity', 11, 'Журнал розробки', 'Development log', { uk: 'Що зроблено за кожну сесію розробки.', en: 'What each development session did.' }),
    S('experience', 12, 'Досвід гравців', 'Player experience', { uk: 'Метрики, теплові карти, плейтести, проблеми.', en: 'Metrics, heatmaps, playtests, issues.' }),
    S('telemetry', 12, 'Телеметрія', 'Telemetry', { uk: 'Каталог подій, які гра надсилає для аналітики.', en: 'The catalogue of events the game sends for analytics.' }),
    S('marketing', 13, 'Маркетинг', 'Marketing', { uk: 'Пости про гру з журналу розробки.', en: 'Posts about the game from the development log.' }),
  ];
  var BY = {}; SECTIONS.forEach(function (s) { BY[s.id] = s; });
  // twins — sections that hold the SAME kind of thing, so one thing lives in only one of them (a wolf is an enemy or a companion, never both).
  // Elsewhere one thing has several cards on purpose: the enemy «Кабан», its reference pictures and its model in «Ассети» — linked, not copies.
  var TWINS = [['characters', 'enemies', 'companions'], ['gear', 'items', 'playcards'], ['refs', 'pictures']];
  function twins(a, b) { return a === b || TWINS.some(function (t) { return t.indexOf(a) >= 0 && t.indexOf(b) >= 0; }); }
  var CANON_NAME = { uk: 'канон світу (Біблія світу)', en: 'the world canon (World Bible)' };

  function section(id) { return BY[id] || null; }
  function stage(n) { return STAGES.filter(function (s) { return s.n === n; })[0] || null; }
  function stageOf(id) { var s = BY[id]; return s ? s.stage : 0; }
  // the order of section ids in the menu: by stage, then as listed; an unknown id (the author's own) goes last
  function order(ids) {
    var idx = function (id) { var i = SECTIONS.indexOf(BY[id]); return i < 0 ? 1e6 : i; };
    return ids.slice().sort(function (a, b) { return idx(a) - idx(b); });
  }
  // a stage's state from count(sectionId) → number of cards / items: 'empty' (nothing), 'partial' (something, the need not met), 'done'
  function stageState(st, count) {
    var ids = SECTIONS.filter(function (s) { return s.stage === st.n; }).map(function (s) { return s.id; });
    var any = ids.some(function (id) { return (count(id) || 0) > 0; });
    if (!st.need) return any ? 'done' : 'empty';
    var ok = st.need.every(function (r) { return r[0].reduce(function (a, id) { return a + (count(id) || 0); }, 0) >= r[1]; });
    return ok ? 'done' : any ? 'partial' : 'empty';
  }
  var nm = function (o, lang) { return (o && (lang === 'en' ? o.en : o.uk)) || ''; };
  var goName = function (id, lang) { return id === 'canon' ? nm(CANON_NAME, lang) : BY[id] ? id + ' (' + nm(BY[id], lang) + ')' : id; };
  // the rules as text for an AI prompt: «id — name: what goes here. NOT here: … → goTo». only: limit to these ids (the import's sections)
  function promptRules(lang, only) {
    return SECTIONS.filter(function (s) { return s.here && (!only || only.indexOf(s.id) >= 0); }).map(function (s) {
      return '- ' + s.id + ' — ' + nm(s, lang) + ': ' + nm(s.here, lang) + (s.not.length ? ' NOT here: ' + s.not.map(function (x) { return nm(x, lang) + ' → ' + goName(x.goTo, lang); }).join('; ') + '.' : '');
    }).join('\n');
  }
  // the schema for MCP get_gdd_schema
  function forAgent(lang) {
    return { version: VERSION, stages: STAGES.map(function (st) {
      return { stage: st.n, id: st.id, name: nm(st, lang), optional: !!st.optional, minimum: st.need ? st.need.map(function (r) { return { sections: r[0], at_least: r[1] }; }) : [],
        sections: SECTIONS.filter(function (s) { return s.stage === st.n; }).map(function (s) {
          return { id: s.id, name: nm(s, lang), claude_code_writes: s.write, goes_here: nm(s.here, lang), not_here: s.not.map(function (x) { return { what: nm(x, lang), go_to: x.goTo }; }) }; }) }; }) };
  }
  var VERSION = 'whitewrite.gdd/1';
  var GDD = { VERSION: VERSION, STAGES: STAGES, SECTIONS: SECTIONS, TWINS: TWINS, twins: twins, section: section, stage: stage, stageOf: stageOf, order: order, stageState: stageState, promptRules: promptRules, forAgent: forAgent };
  if (typeof module !== 'undefined' && module.exports) module.exports = GDD;
  if (typeof window !== 'undefined') window.__GDD = GDD;
})();
