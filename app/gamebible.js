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
      brand: "Біблія світу", engine: "Рушій гри",
      cosmo: { name: "Космограф", off: "Космограф вимкнено", offText: "Космограф — живе небо твого світу: планета з картою, сонця й супутники на справжніх орбітах, календар, доба й пори року, затемнення. Він вимкнений за замовчуванням і вмикається в налаштуваннях проєкту.",
        toSettings: "До налаштувань", expired: "Місяць Космографа скінчився", expiredText: "Небо збережене. Щоб знову ним керувати, продовж Космограф ще на 30 днів.",
        renew: "Продовжити на 30 днів", setTitle: "Космограф", setOff: "Вимкнено. Коли увімкнеш, з балансу спишеться {n} токенів, і Космограф працюватиме 30 днів.",
        setOn: "Увімкнено, оплачено до {d}.", setPaidOff: "Вимкнено, але оплачений місяць триває до {d}: увімкнення до цієї дати безкоштовне.",
        enable: "Увімкнути Космограф", disable: "Вимкнути", costText: "Космограф для цього світу коштує {n} токенів за 30 днів. Списуються один раз; далі місяць не продовжується сам.",
        mapUploading: "Завантажую карту…", skyNote: "Небо збережено в каноні світу." },
      story: { title: "Історії", add: "＋ Історія", none: "Ще немає історій про це. Напиши першу — книга відкриється тут же.", open: "Відкрити",
        newTitle: "Нова історія", titlePh: "Назва історії", reveal: "Для читача", revealNote: "Коли розкриється", revealNotePh: "напр. «після сцени, де Ліра знаходить руну»",
        write: "Писати", revealAria: "Видимість для читача",
        reveals: { open: "Відкрита читачеві", later: "Розкриється згодом", internal: "Внутрішній канон" },
        revealHint: { open: "Читач бачить її як є.", later: "Таємниця: читач дізнається згодом.", internal: "Лише для автора: ідея чи правда за лаштунками, не для читача." } },
      cult: { del: "Видалити запис", delQ: "Видалити цей запис культури разом з його файлами?" },
      chron: { unit: "Одиниця часу", unitPh: "рік", undated: "Без місця на лінії часу", stories: "Історії цього світу", openStory: "Відкрити",
        noStories: "У цьому світі ще немає історій.", empty: "Ще немає подій з датою. Додай першу — вона злетить кометою над лінією часу.",
        legend: "Комета — подія, довжина хвоста — її тривалість; зірка — мить. Навколо голови — учасники.",
        at: "Початок (число на лінії часу)", dur: "Тривалість (0 — мить)", when: "Підпис часу", whenPh: "напр. «Весна 340 р.»", who: "Учасники", noChars: "У каноні ще немає персонажів." },
      pick: { title: "Додати з канону світу", hint: "Ті, кого ще немає в цій грі. Можна вибрати кількох.",
        none: "Усіх з канону вже взято в гру.", newOne: "＋ Новий у каноні", addN: "Додати", picked: "Додано в гру" },
      dos: { desc: "Опис", pics: "Зображення й моделі світу", picsHint: "спільні для всіх історій та ігор; у грі може бути свій вигляд",
        links: "Звʼязки", appear: "Поява в історіях та іграх", life: "Хронологія життя", lifeHint: "замітки на лінії життя; упорядковуються за першим числом («12 років», «рік 340»)",
        lifeAdd: "＋ Замітка", lifeWhen: "Коли: вік, рік, епоха", lifeText: "Що сталося", lifeEmpty: "Ще немає заміток. Додай першу — вона повисне на лінії життя.",
        noLinks: "Звʼязків поки немає. Їх додають у Дереві всесвіту.", inGames: "Ігри", inStories: "Історії", notInGames: "Ще немає ігор у цьому світі.",
        notInStories: "Ще не зʼявлявся в історіях.", scenes: "сцени", loading: "Шукаю…", openInGame: "Відкрити в грі", hiddenInGame: "прибрано з гри",
        unsaved: "Є незбережені зміни. Перейти без збереження?", world: "досьє світу", saveFirst: "Спершу збережи — тоді можна додати файли.",
        picsPlain: "Зображення й файли", picsPlainHint: "ілюстрації, карти, схеми", appearStories: "Поява в історіях",
        kinds: { characters: "персонаж", locations: "локація", events: "подія", factions: "фракція", artifacts: "артефакт" },
        // the two writing tabs of each kind of dossier: [key in entity.dossier, label, placeholder]
        tabs: { characters: [["story", "Біографія", "Пиши вільно: звідки, що пережив, чого прагне…"], ["look", "Зовнішність", "Як виглядає: риси, одяг, кольори, деталі, впізнавані знаки…"]],
          locations: [["story", "Історія місця", "Як виникло це місце, що тут відбувалося, кому воно належало…"], ["look", "Вигляд", "Як виглядає: краєвид, будівлі, світло, звуки, запахи…"]],
          factions: [["story", "Історія й мета", "Як виникла, хто її веде, чого прагне, з ким ворогує…"], ["look", "Символіка", "Герб, кольори, знаки, одяг, гасла…"]],
          artifacts: [["story", "Походження", "Хто й навіщо створив, через чиї руки пройшов, яку має силу…"], ["look", "Вигляд", "Матеріал, розмір, знаки, як відчувається в руці…"]],
          events: [["story", "Перебіг", "Як це сталося: причини, хід, ключові моменти…"], ["outcome", "Наслідки", "Що змінилося після: для світу, для учасників, для інших подій…"]] } },
      settings: "Налаштування проєкту", settingsAbout: "Назви, рушій, імпорт і експорт, безпечне видалення.", gameLabel: "Гра:",
      stWorld: "Світ", stWorldName: "Назва світу", stGame: "Гра", stGameName: "Назва гри", stRename: "Перейменувати", stRenamed: "Збережено.",
      stImport: "Імпорт нотаток (.md)", stImportHint: "AI розкладе нотатки по розділах цієї гри, ти відмітиш, що прийняти.",
      stExport: "Експорт", stExportWorld: "Експорт світу (JSON)", stExportGame: "Експорт гри (JSON)", stExportHint: "Повна копія даних: світ і канон, або гра з картками, планом і завданнями.",
      stSections: "Власні розділи гри", stNoSections: "Власних розділів немає. Стандартні розділи не видаляються.",
      stDanger: "Небезпечна зона", stDelGame: "Видалити гру", stDelWorld: "Видалити світ",
      stDelGameText: "Буде видалено гру <b>{n}</b>: усі картки, файли, план, завдання, журнал і ключі Claude Code. Канон світу лишиться.",
      stDelWorldText: "Буде видалено світ <b>{n}</b>: увесь канон і всі ігри з їхніми картками й файлами. Відновити не можна.",
      stDelSecText: "Буде видалено розділ <b>{n}</b> разом з його картками.",
      stTypeName: "Щоб підтвердити, введи назву: {n}", stDelete: "Видалити назавжди", stDeleting: "Видаляю…",
      stHasStories: "У цьому світі є історії ({n}). Спершу видали або перенеси їх — тоді світ можна буде видалити.", search: "Пошук по канону й грі: назва, опис, примітка…",
      canonGroup: "Канон світу", gameGroup: "Гра", newGame: "+ Нова гра", gameName: "Назва гри", gameNamePh: "Напр. «MythRunner»",
      createGame: "Створити гру", firstGame: "Перша гра на цьому каноні",
      firstGameText: "Канон світу — спільний: персонажі, місця, закони. Гра бере з нього все потрібне й додає свої механіки, ассети і план. На одному каноні можна зробити кілька різних ігор.",
      addSection: "+ Свій розділ", sectionName: "Назва розділу, напр. «Звук»",
      sectionAbout: "Про що цей розділ (необовʼязково)", create: "Створити", cancel: "Скасувати",
      save: "Зберегти", close: "Закрити", remove: "Прибрати картку", hide: "Прибрати з цієї гри", deleteSection: "Видалити розділ",
      found: "Знайдено", nothing: "Нічого не знайдено.", newCard: "Нова картка", other: "Інше", sectionsAria: "Розділи",
      group: "Підрозділ", sub: { add: "＋ Підрозділ", title: "Новий підрозділ", ph: "Назва підрозділу, напр. «Головні герої»", item: "＋ Додати", empty: "Ще порожньо.",
        general: "Загальне", timeline: "Лінія часу", del: "Прибрати порожній підрозділ", story: "＋ Нова історія" },
      note: "Примітка для Claude", noteHint: "що зробити з цим у грі", notePh: "Напр.: зроби темнішим, перегенеруй з меншим polycount, додай у GDD…",
      editFields: "Режим редагування полів: назви, типи, видалення", editOn: "Режим редагування — натисни ще раз, щоб завершити",
      ftypes: { text: "Текст", table: "Таблиця", image: "Картинки", file: "Файли (префаби, моделі…)" },
      fieldDel: "Видалити поле", fieldLabel: "Назва поля", fieldType: "Тип поля", addRow: "＋ Рядок", addCol: "＋ Стовпець", col: "Стовпець",
      rmRow: "Прибрати рядок", rmCol: "Прибрати стовпець", imagesAdd: "＋ Додати картинки",
      blank: "порожньо — натисни, щоб заповнити", addField: "Додати поле", addFieldPh: "Назва поля, напр. «Звук» або «Референс»", add: "Додати",
      canonTag: "канон", canonField: "канон — спільне для всіх історій та ігор", worldCanon: "Канон світу", laws: "Закони світу", facts: "Факти",
      worldReadonly: "Спільне для всіх історій та ігор світу — ШІ спирається на це в кожній сцені.",
      poly: { tip: "{n} полігонів — понад 100 000: важко для гри, варто спростити (LOD / ретопологія)", n: "полігонів" },
      lic: { title: "Ліцензія і права", info: "Ліцензія і права — докладніше", green: "Комерційно можна", yellow: "Комерційно — з умовами", red: "Комерційно не можна",
        src: { file: "Визначено автоматично з метаданих файлу", text: "Визначено автоматично з файлу «{f}» на картці", author: "Вказав автор", none: "Ліцензію не знайдено ні в файлі, ні поруч — вкажи її" },
        found: "Що сказано у файлі", pick: "Ліцензія", by: "Автор / атрибуція", byPh: "Напр.: «Dragon» by Jane Doe (Sketchfab)", url: "Джерело", urlPh: "Посилання на сторінку моделі чи ліцензії",
        save: "Зберегти", cancel: "Скасувати",
        names: { own: "Власна робота", cc0: "CC0 / суспільне надбання", royalty: "Royalty-free (куплено)", unity: "Unity Asset Store EULA", ccby: "CC BY", ccbysa: "CC BY-SA", ccbynd: "CC BY-ND",
          ccbync: "CC BY-NC (некомерційна)", editorial: "Лише редакційне", personal: "Лише особисте", unknown: "Ліцензія невідома" },
        short: { own: "Своє", cc0: "CC0", royalty: "Куплено", unity: "Unity EULA", ccby: "CC BY", ccbysa: "CC BY-SA", ccbynd: "CC BY-ND", ccbync: "NC", editorial: "Редакц.", personal: "Особисте", unknown: "?" },
        what: { own: "Твоя модель — усі права твої.", cc0: "Будь-яке використання, зокрема комерційне, без умов.",
          royalty: "Куплено з правом комерційного використання; сам ассет перепродавати чи викладати не можна.",
          unity: "Можна в іграх, зокрема комерційних; поширювати як вихідний ассет не можна.",
          ccby: "Комерційно можна, але автора треба вказати (титри / «Про гру»).", ccbysa: "Комерційно можна з автором; змінену модель — лише під тією ж ліцензією.",
          ccbynd: "Комерційно можна з автором, але без змін — ні ретопології, ні перефарбування.", ccbync: "Лише некомерційне використання — у платній грі чи з рекламою не можна.",
          editorial: "Лише для редакційних матеріалів — у грі не можна.", personal: "Лише особисте використання — у грі для інших не можна.",
          unknown: "Права не з'ясовано. Не використовуй комерційно, доки не знайдеш ліцензію." } },
      wt: { tagline: "Гасло світу", taglinePh: "Одним рядком — про що цей світ", summary: "Про світ", summaryPh: "Що це за світ, яка в ньому напруга, чим він живе…",
        factK: "Що", factV: "Як є", addFact: "＋ Факт", addLaw: "＋ Закон", lawPh: "Закон світу…", noLaws: "Законів ще немає — додай перший: те, чого в цьому світі не можна порушити.",
        save: "Зберегти", dirty: "Є незбережені зміни", map: "🗺 Карта", cards: "▦ Картки", mapHint: "Перетягуй локації, щоб розкласти світ. Клік — досьє.",
        routes: "Лінії — шляхи персонажів між сценами історій", noLocs: "Локацій ще немає.", state: "Стан у часі", scene: "сцена",
        aspects: { status: "Статус", location: "Місце", possession: "Володіє", allegiance: "Сторона", condition: "Стан" },
        impact: "Вплив змін", impactText: "Сцен історій, де є ця сутність: {n}. Змінив канон — ШІ узгодить їх: покаже «було → стане», а ти приймеш або відхилиш кожну.",
        impactBtn: "✦ Узгодити сцени", noImpact: "Цієї сутності ще немає в сценах історій.", kind: "Що змінилось",
        kinds: { property: "Опис / властивості", rename: "Нова назва", relationship: "Звʼязки", rewrite: "Переписано суттєво" },
        note: "Що саме змінилось (для ШІ)", notePh: "Напр.: Ліра тепер сліпа від народження", cost: "≈{n} токенів за сцену · вибрано сцен: {s}",
        run: "✦ Узгодити", pinned: "закріплена — не чіпаю", wait: "чекає", busy: "переписую…", same: "вже відповідає канону", accept: "Прийняти", reject: "Відхилити",
        accepted: "прийнято ✓", rejected: "відхилено", stop: "Зупинено: {e}", plan: "Узгодження сцен доступне з плану Novelist з активною підпискою.",
        gameLocked: "Ігри світу", gameLockedText: "Біблія гри, продакшн-план і звʼязок із Claude Code — з тарифу Worldbuilder. Канон світу й історії — тут, на твоєму тарифі." },
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
      issues: "Неузгоджене", issuesAbout: "Суперечності й невирішені питання гри. Відпиши своїми словами або обери варіант — рішення запишеться в картку.",
      canonIssuesAbout: "Суперечності всередині канону світу: закони, персонажі, місця, фракції. Узгодь — і рішення запишеться в сутність.",
      audit: "Оновити аудит", auditFirst: "Запустити аудит", auditBusy: "AI перевіряє все й шукає неузгодженості… (до кількох хвилин)",
      auditIntro: "Аудит ще не запускався. AI прочитає все й випише, що не сходиться.", auditClean: "Неузгоджень не знайдено.",
      resolve: "Узгодити", resolvedTitle: "Узгоджено", contraOpen: "Суперечності", resolvePh: "Як це має бути насправді…",
      costTitle: "Ця дія витрачає токени", costText: "AI-операція «{op}» коштує орієнтовно до {n} токенів (точна сума залежить від обсягу). Продовжити?",
      costGo: "Продовжити", costTip: "AI · витрачає токени (≈ до {n})",
      ops: { analyze: "Аналіз і аудит гри", plan: "Продакшн-план", import: "Імпорт нотаток", canonAudit: "Аудит канону" },
      stShown: "Розділи гри в меню", stShownHint: "Зніми галочку, щоб сховати стандартний розділ у цій грі. Картки не видаляються — повернеш галочку, і вони знову на місці.",
      stRestore: "Відновити з копії (JSON)", stRestoreHint: "Файл гри відновлюється як нова гра в цьому світі, файл світу — як новий світ.",
      stRestored: "Відновлено", stBadJson: "Це не файл експорту WhiteWrite.",
      spent: "Списано токенів", writtenTo: "записано в картку",
      prio: { blocker: "блокер", important: "важливо", nice: "бажано" },
      st: { solid: "готово", partial: "частково", missing: "бракує" }
    },
    en: {
      brand: "World Bible", engine: "Game engine",
      cosmo: { name: "Cosmograph", off: "The Cosmograph is off", offText: "The Cosmograph is the living sky of your world: a planet with its map, suns and moons on real orbits, a calendar, day and seasons, eclipses. It is off by default and is turned on in the project settings.",
        toSettings: "To settings", expired: "The Cosmograph month is over", expiredText: "The sky is saved. To work with it again, extend the Cosmograph for another 30 days.",
        renew: "Extend for 30 days", setTitle: "Cosmograph", setOff: "Off. Turning it on spends {n} tokens, and the Cosmograph works for 30 days.",
        setOn: "On, paid until {d}.", setPaidOff: "Off, but the paid month lasts until {d}: turning it on before then is free.",
        enable: "Turn the Cosmograph on", disable: "Turn off", costText: "The Cosmograph for this world costs {n} tokens per 30 days. Charged once; the month does not renew by itself.",
        mapUploading: "Uploading the map…", skyNote: "The sky is saved in the world canon." },
      story: { title: "Stories", add: "＋ Story", none: "No stories about this yet. Write the first — the book opens right here.", open: "Open",
        newTitle: "New story", titlePh: "Story title", reveal: "For the reader", revealNote: "When it is revealed", revealNotePh: "e.g. “after the scene where Lira finds the rune”",
        write: "Write", revealAria: "Visibility for the reader",
        reveals: { open: "Open to the reader", later: "Revealed later", internal: "Internal canon" },
        revealHint: { open: "The reader sees it as it is.", later: "A secret: the reader learns it later.", internal: "For the author only: an idea or the truth behind the scenes, not for the reader." } },
      cult: { del: "Delete entry", delQ: "Delete this culture entry with its files?" },
      chron: { unit: "Time unit", unitPh: "year", undated: "Not on the time line yet", stories: "Stories of this world", openStory: "Open",
        noStories: "No stories in this world yet.", empty: "No dated events yet. Add the first — it flies as a comet above the time line.",
        legend: "A comet is an event, its tail is its duration; a star is a moment. Around the head — the participants.",
        at: "Start (a number on the time line)", dur: "Duration (0 — a moment)", when: "Time label", whenPh: "e.g. “Spring of 340”", who: "Participants", noChars: "No characters in the canon yet." },
      pick: { title: "Add from the world canon", hint: "Those not in this game yet. You can pick several.",
        none: "Everything in the canon is already in the game.", newOne: "＋ New in canon", addN: "Add", picked: "Added to the game" },
      dos: { desc: "Description", pics: "World images & models", picsHint: "shared by every story and game; a game may have its own look",
        links: "Connections", appear: "Appears in stories & games", life: "Life timeline", lifeHint: "notes on the life line, ordered by their first number (“age 12”, “year 340”)",
        lifeAdd: "＋ Note", lifeWhen: "When: age, year, era", lifeText: "What happened", lifeEmpty: "No notes yet. Add the first — it hangs on the life line.",
        noLinks: "No connections yet. They are added in the Universe tree.", inGames: "Games", inStories: "Stories", notInGames: "No games in this world yet.",
        notInStories: "Has not appeared in stories yet.", scenes: "scenes", loading: "Looking…", openInGame: "Open in game", hiddenInGame: "removed from the game",
        unsaved: "There are unsaved changes. Leave without saving?", world: "world dossier", saveFirst: "Save first — then files can be added.",
        picsPlain: "Images & files", picsPlainHint: "illustrations, maps, diagrams", appearStories: "Appearance in stories",
        kinds: { characters: "character", locations: "location", events: "event", factions: "faction", artifacts: "artifact" },
        tabs: { characters: [["story", "Biography", "Write freely: where from, what they went through, what they want…"], ["look", "Appearance", "How they look: features, clothes, colours, details, signs…"]],
          locations: [["story", "History of the place", "How this place came to be, what happened here, who owned it…"], ["look", "Look", "How it looks: landscape, buildings, light, sounds, smells…"]],
          factions: [["story", "History & aim", "How it arose, who leads it, what it wants, whom it fights…"], ["look", "Symbols", "Coat of arms, colours, signs, garb, mottos…"]],
          artifacts: [["story", "Origin", "Who made it and why, whose hands it passed through, what power it has…"], ["look", "Look", "Material, size, markings, how it feels in the hand…"]],
          events: [["story", "Course", "How it happened: causes, course, key moments…"], ["outcome", "Consequences", "What changed after: for the world, the participants, other events…"]] } },
      settings: "Project settings", settingsAbout: "Names, engine, import and export, safe deletion.", gameLabel: "Game:",
      stWorld: "World", stWorldName: "World name", stGame: "Game", stGameName: "Game title", stRename: "Rename", stRenamed: "Saved.",
      stImport: "Import notes (.md)", stImportHint: "AI sorts the notes into this game's sections; you tick what to accept.",
      stExport: "Export", stExportWorld: "Export world (JSON)", stExportGame: "Export game (JSON)", stExportHint: "A full copy of the data: the world and its canon, or the game with cards, plan and tasks.",
      stSections: "Custom game sections", stNoSections: "No custom sections. Standard sections cannot be deleted.",
      stDanger: "Danger zone", stDelGame: "Delete game", stDelWorld: "Delete world",
      stDelGameText: "This deletes the game <b>{n}</b>: all cards, files, plan, tasks, log and Claude Code keys. The world canon stays.",
      stDelWorldText: "This deletes the world <b>{n}</b>: all canon and every game with its cards and files. It cannot be undone.",
      stDelSecText: "This deletes the section <b>{n}</b> with its cards.",
      stTypeName: "To confirm, type the name: {n}", stDelete: "Delete forever", stDeleting: "Deleting…",
      stHasStories: "This world has stories ({n}). Delete or move them first — then the world can be deleted.", search: "Search canon and game: title, text, note…",
      canonGroup: "World canon", gameGroup: "Game", newGame: "+ New game", gameName: "Game title", gameNamePh: "E.g. “MythRunner”",
      createGame: "Create game", firstGame: "The first game on this canon",
      firstGameText: "The world canon is shared: characters, places, laws. A game takes what it needs and adds its own mechanics, assets and plan. One canon can carry several different games.",
      addSection: "+ Own section", sectionName: "Section name, e.g. “Sound”",
      sectionAbout: "What this section is about (optional)", create: "Create", cancel: "Cancel",
      save: "Save", close: "Close", remove: "Remove card", hide: "Remove from this game", deleteSection: "Delete section",
      found: "Found", nothing: "Nothing found.", newCard: "New card", other: "Other", sectionsAria: "Sections",
      group: "Subsection", sub: { add: "＋ Subsection", title: "New subsection", ph: "Subsection name, e.g. “Main heroes”", item: "＋ Add", empty: "Empty yet.",
        general: "General", timeline: "Time line", del: "Remove the empty subsection", story: "＋ New story" },
      note: "Note for Claude", noteHint: "what to do with it in the game", notePh: "E.g.: make it darker, regenerate with lower polycount, add to the GDD…",
      editFields: "Field editing mode: names, types, deletion", editOn: "Editing mode — click again to finish",
      ftypes: { text: "Text", table: "Table", image: "Images", file: "Files (prefabs, models…)" },
      fieldDel: "Delete field", fieldLabel: "Field name", fieldType: "Field type", addRow: "＋ Row", addCol: "＋ Column", col: "Column",
      rmRow: "Remove row", rmCol: "Remove column", imagesAdd: "＋ Add images",
      blank: "empty — click to fill in", addField: "Add field", addFieldPh: "Field name, e.g. “Sound” or “Reference”", add: "Add",
      canonTag: "canon", canonField: "canon — shared by every story and game", worldCanon: "World canon", laws: "Laws of the world", facts: "Facts",
      worldReadonly: "Shared by every story and game of the world — the AI stands on it in every scene.",
      poly: { tip: "{n} polygons — over 100,000: heavy for a game, worth simplifying (LOD / retopology)", n: "polygons" },
      lic: { title: "Licence & rights", info: "Licence & rights — details", green: "Commercial use OK", yellow: "Commercial use — with conditions", red: "No commercial use",
        src: { file: "Detected automatically from the file's metadata", text: "Detected automatically from “{f}” on the card", author: "Set by the author", none: "No licence found in the file or next to it — set it" },
        found: "What the file says", pick: "Licence", by: "Author / attribution", byPh: "E.g.: “Dragon” by Jane Doe (Sketchfab)", url: "Source", urlPh: "Link to the model's or the licence's page",
        save: "Save", cancel: "Cancel",
        names: { own: "Own work", cc0: "CC0 / public domain", royalty: "Royalty-free (purchased)", unity: "Unity Asset Store EULA", ccby: "CC BY", ccbysa: "CC BY-SA", ccbynd: "CC BY-ND",
          ccbync: "CC BY-NC (non-commercial)", editorial: "Editorial only", personal: "Personal use only", unknown: "Licence unknown" },
        short: { own: "Own", cc0: "CC0", royalty: "Bought", unity: "Unity EULA", ccby: "CC BY", ccbysa: "CC BY-SA", ccbynd: "CC BY-ND", ccbync: "NC", editorial: "Editorial", personal: "Personal", unknown: "?" },
        what: { own: "Your model — all rights are yours.", cc0: "Any use, commercial included, no conditions.",
          royalty: "Bought with commercial rights; the asset itself may not be resold or published.",
          unity: "Usable in games, commercial included; may not be redistributed as a source asset.",
          ccby: "Commercial use OK, but credit the author (credits / “About”).", ccbysa: "Commercial use OK with credit; a modified model only under the same licence.",
          ccbynd: "Commercial use OK with credit, but unchanged — no retopology, no repaint.", ccbync: "Non-commercial use only — not in a paid or ad-supported game.",
          editorial: "Editorial use only — not in a game.", personal: "Personal use only — not in a game for others.",
          unknown: "Rights unknown. Don't use commercially until you find the licence." } },
      wt: { tagline: "Tagline", taglinePh: "One line — what this world is about", summary: "About the world", summaryPh: "What world this is, its tension, what it lives by…",
        factK: "What", factV: "How it is", addFact: "＋ Fact", addLaw: "＋ Law", lawPh: "A law of the world…", noLaws: "No laws yet — add the first: what can never be broken in this world.",
        save: "Save", dirty: "Unsaved changes", map: "🗺 Map", cards: "▦ Cards", mapHint: "Drag locations to lay out the world. Click — the dossier.",
        routes: "Lines — characters' paths between story scenes", noLocs: "No locations yet.", state: "State over time", scene: "scene",
        aspects: { status: "Status", location: "Location", possession: "Holds", allegiance: "Allegiance", condition: "Condition" },
        impact: "Impact of changes", impactText: "Story scenes with this entity: {n}. Changed the canon? The AI brings them in line: it shows “before → after”, and you accept or reject each.",
        impactBtn: "✦ Align scenes", noImpact: "This entity is not in any story scene yet.", kind: "What changed",
        kinds: { property: "Description / properties", rename: "New name", relationship: "Connections", rewrite: "Rewritten substantially" },
        note: "What exactly changed (for the AI)", notePh: "E.g.: Lira is now blind from birth", cost: "≈{n} tokens per scene · scenes picked: {s}",
        run: "✦ Align", pinned: "pinned — left as is", wait: "waiting", busy: "rewriting…", same: "already fits the canon", accept: "Accept", reject: "Reject",
        accepted: "accepted ✓", rejected: "rejected", stop: "Stopped: {e}", plan: "Aligning scenes is available from the Novelist plan with an active subscription.",
        gameLocked: "Games of the world", gameLockedText: "The Game Bible, production plan and the Claude Code link come with the Worldbuilder plan. The world canon and stories are here on your plan." },
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
      issues: "Inconsistencies", issuesAbout: "Contradictions and open questions of the game. Answer in your own words or pick an option — the decision is written into the card.",
      canonIssuesAbout: "Contradictions inside the world canon: laws, characters, places, factions. Resolve them — the decision is written into the entity.",
      audit: "Refresh audit", auditFirst: "Run audit", auditBusy: "AI is checking everything for inconsistencies… (up to a few minutes)",
      auditIntro: "No audit yet. AI reads everything and lists what does not add up.", auditClean: "No inconsistencies found.",
      resolve: "Resolve", resolvedTitle: "Resolved", contraOpen: "Contradictions", resolvePh: "How it really should be…",
      costTitle: "This action spends tokens", costText: "The AI operation “{op}” costs up to about {n} tokens (the exact amount depends on the volume). Continue?",
      costGo: "Continue", costTip: "AI · spends tokens (≈ up to {n})",
      ops: { analyze: "Game analysis & audit", plan: "Production plan", import: "Notes import", canonAudit: "Canon audit" },
      stShown: "Game sections in the menu", stShownHint: "Untick to hide a standard section in this game. Cards are not deleted — tick it again and they are back.",
      stRestore: "Restore from a copy (JSON)", stRestoreHint: "A game file is restored as a new game in this world, a world file as a new world.",
      stRestored: "Restored", stBadJson: "This is not a WhiteWrite export file.",
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
    { id: "world", special: "world", uk: "Огляд світу", en: "World overview",
      about: { uk: "Про що цей світ: суть, тон, ключові факти. Спільне для всіх історій та ігор.", en: "What this world is: its essence, tone and key facts. Shared by every story and game." } },
    { id: "laws", special: "laws", uk: "Закони", en: "Laws",
      about: { uk: "Непорушні правила цього всесвіту: фізика, магія, межі можливого. Їм підкоряється кожна історія й гра.", en: "The unbreakable rules of this universe: physics, magic, the limits of the possible. Every story and game obeys them." } },
    { id: "w-characters", dossier: "characters", uk: "Персонажі", en: "Characters",
      about: { uk: "Хто живе в цьому світі: біографія, звʼязки, зовнішність, хронологія життя.", en: "Who lives in this world: biography, connections, appearance, life timeline." } },
    { id: "w-locations", dossier: "locations", uk: "Локації", en: "Locations",
      about: { uk: "Місця світу: їхня історія, вигляд і хто з ними повʼязаний.", en: "The places of the world: their history, look and who is tied to them." } },
    { id: "w-factions", dossier: "factions", uk: "Фракції", en: "Factions",
      about: { uk: "Сили світу: історія, мета, символіка і хто до них належить.", en: "The powers of the world: history, aim, symbols and who belongs to them." } },
    { id: "w-items", dossier: "artifacts", uk: "Артефакти", en: "Artifacts",
      about: { uk: "Речі, що мають вагу у світі: походження, сила, вигляд.", en: "Things that matter in the world: origin, power, look." } },
  ];
  var GAME = [
    { id: "overview", uk: "Огляд гри", en: "Game overview",
      about: { uk: "Що це за гра: логлайн, жанр, стовпи, ігровий цикл, платформа, референси.", en: "What the game is: logline, genre, pillars, core loop, platform, references." },
      defs: [F("logline", "Логлайн", "Logline"), F("genre", "Жанр", "Genre"), F("pillars", "Стовпи гри (3–4)", "Game pillars (3–4)"),
             F("loop", "Ігровий цикл", "Core loop"), F("platform", "Платформа", "Platform"), F("session", "Тривалість сесії", "Session length"),
             F("players", "Гравці (соло / кооп / PvP)", "Players (solo / co-op / PvP)"), F("refs", "Референси: гра → що саме беремо", "References: game → what we take"),
             F("style", "Візуальний стиль", "Visual style")] },
    { id: "lore", uk: "Лор гри", en: "Game lore",
      about: { uk: "Як ця гра подає світ: епоха, сюжет гри, тон, таємниці. Канон — в «Огляді світу» і «Законах».", en: "How this game presents the world: era, game plot, tone, secrets. Canon is in “World & laws”." },
      defs: [F("text", "Опис", "Description")] },
    { id: "characters", canon: "characters", uk: "Персонажі", en: "Characters",
      about: { uk: "Персонажі світу в цій грі: роль, здібності, числа і свій вигляд чи модель. Біографія й звʼязки — у досьє світу.", en: "The world's characters in this game: role, abilities, numbers and their own look or model. Biography and connections live in the world dossier." },
      defs: [F("role", "Роль у грі", "Game role"), F("kit", "Зброя й здібності", "Weapons & abilities"), F("numbers", "Числа", "Numbers"),
             F("strengths", "Сильні / слабкі сторони", "Strengths / weaknesses"), F("look", "Вигляд у цій грі", "Look in this game"), F("model", "Модель / префаб", "Model / prefab")] },
    { id: "locations", canon: "locations", uk: "Локації", en: "Locations",
      about: { uk: "Місця канону як рівні цієї гри: розмір, палітра, світло, хто там живе.", en: "Canon places as this game's levels: size, palette, light, who lives there." },
      defs: [F("level", "Тип рівня", "Level type"), F("size", "Розмір і траса", "Size & route"), F("look", "Палітра й світло", "Palette & light"),
             F("enemies", "Вороги", "Enemies"), F("assets", "Ассети", "Assets")] },
    { id: "factions", canon: "factions", uk: "Фракції", en: "Factions",
      about: { uk: "Сили канону та їхня роль у геймплеї цієї гри.", en: "Canon powers and their role in this game's gameplay." },
      defs: [F("gameplay", "Роль у геймплеї", "Role in gameplay"), F("rewards", "Що дає гравцю", "What it gives the player")] },
    { id: "items", canon: "artifacts", uk: "Артефакти", en: "Artifacts",
      about: { uk: "Артефакти канону як ігрові предмети.", en: "Canon artifacts as game items." },
      defs: [F("type", "Тип", "Type"), F("effect", "Ефект", "Effect"), F("numbers", "Числа", "Numbers"), F("source", "Як отримати", "How to get"), F("model", "Модель / іконка", "Model / icon")] },
    { id: "mechanics", uk: "Механіки", en: "Mechanics", group: "group",
      groups: { uk: ["Рух", "Бій", "Здібності", "Взаємодія", "Камера й керування", "Смерть і відродження", "Перемога й поразка"], en: ["Movement", "Combat", "Abilities", "Interaction", "Camera & controls", "Death & respawn", "Win & lose"] },
      about: { uk: "Правила гри з числами. Правка тут — це завдання змінити гру.", en: "Game rules with numbers. An edit here is a task to change the game." },
      defs: [F("group", "Група", "Group"), F("text", "Опис", "Description"), F("numbers", "Правила й числа", "Rules & numbers"), F("deps", "Залежить від", "Depends on")] },
    { id: "progression", uk: "Прогресія й економіка", en: "Progression & economy", group: "group",
      groups: { uk: ["Досвід і рівні", "Валюти", "Лут і нагороди", "Магазин", "Апгрейди", "Баланс"], en: ["XP & levels", "Currencies", "Loot & rewards", "Shop", "Upgrades", "Balance"] },
      about: { uk: "Досвід, рівні, валюти, лут, магазин, апгрейди — і баланс чисел між ними.", en: "XP, levels, currencies, loot, shop, upgrades — and the balance of numbers between them." },
      defs: [F("group", "Група", "Group"), F("text", "Опис", "Description"), F("numbers", "Числа й формули", "Numbers & formulas"), F("sinks", "Звідки береться / куди йде", "Sources / sinks")] },
    { id: "levels", uk: "Рівні й контент", en: "Levels & content", group: "group",
      groups: { uk: ["Туторіал", "Основні рівні", "Рівні босів", "Хаби", "Побічний контент"], en: ["Tutorial", "Main levels", "Boss levels", "Hubs", "Side content"] },
      about: { uk: "Рівні, траси, хвилі, енкаунтери: розмір, тривалість, хто й що там. Місце з канону — у «Локаціях».", en: "Levels, tracks, waves, encounters: size, length, who and what is there. The canon place is in “Locations”." },
      defs: [F("group", "Група", "Group"), F("location", "Локація канону", "Canon location"), F("layout", "Структура й розмір", "Layout & size"),
             F("encounters", "Вороги й події", "Enemies & events"), F("goal", "Мета гравця", "Player goal"), F("length", "Тривалість", "Length")] },
    { id: "enemies", uk: "Вороги й боси", en: "Enemies & bosses", group: "group",
      groups: { uk: ["Звичайні вороги", "Елітні вороги", "Боси"], en: ["Regular enemies", "Elite enemies", "Bosses"] },
      about: { uk: "Хто стоїть на шляху, як бʼє і куди його бити.", en: "Who stands in the way, how it hits and where to hit it." },
      defs: [F("group", "Тип (ворог / бос)", "Type (enemy / boss)"), F("behaviour", "Поведінка", "Behaviour"), F("attacks", "Атаки", "Attacks"),
             F("weakness", "Як перемогти", "How to beat"), F("numbers", "Числа", "Numbers"), F("model", "Модель / префаб", "Model / prefab")] },
    { id: "gear", uk: "Предмети й спорядження", en: "Items & gear", group: "group",
      groups: { uk: ["Зброя", "Броня", "Розхідники", "Ключові предмети", "Косметика"], en: ["Weapons", "Armour", "Consumables", "Key items", "Cosmetics"] },
      about: { uk: "Зброя, броня, розхідники, ключі: що дає, скільки коштує, де взяти. Легендарні речі канону — в «Артефактах».", en: "Weapons, armour, consumables, keys: what it gives, cost, where to get it. Canon legends are in “Artifacts”." },
      defs: [F("group", "Тип", "Type"), F("effect", "Ефект", "Effect"), F("numbers", "Числа", "Numbers"), F("source", "Як отримати", "How to get"), F("model", "Модель / іконка", "Model / icon")] },
    { id: "assets", uk: "Ассети й префаби", en: "Assets & prefabs", group: "category",
      groups: { uk: ["Персонажі", "Вороги", "Оточення", "Пропси", "Зброя й предмети", "Ефекти", "UI"], en: ["Characters", "Enemies", "Environment", "Props", "Weapons & items", "Effects", "UI"] },
      about: { uk: "Моделі й префаби: що вже є і що треба зробити — функція, розмір, пріоритет, промпт. Моделі відкриваються в 3D.", en: "Models and prefabs: what exists and what to make — function, size, priority, prompt. Models open in 3D." },
      defs: [F("category", "Категорія", "Category"), F("function", "Функція", "Function"), F("size", "Розмір", "Size"),
             F("priority", "Пріоритет", "Priority"), F("prompt", "Промпт генерації", "Generation prompt"), F("source", "Джерело", "Source")] },
    { id: "materials", uk: "Матеріали й текстури", en: "Materials & textures", group: "category",
      groups: { uk: ["Персонажі", "Оточення", "Рослинність", "Шейдери", "Небо й освітлення"], en: ["Characters", "Environment", "Foliage", "Shaders", "Sky & lighting"] },
      about: { uk: "Поверхні, текстури, шейдери, рослинність: карти, розмір, джерело чи ліцензія.", en: "Surfaces, textures, shaders, foliage: maps, resolution, source or licence." },
      defs: [F("category", "Група", "Group"), F("what", "Що це", "What it is"), F("where", "Де використовується", "Where it is used"), F("maps", "Карти", "Maps"),
             F("resolution", "Розмір", "Resolution"), F("source", "Джерело / ліцензія", "Source / licence")] },
    { id: "animation", uk: "Анімації й VFX", en: "Animation & VFX", group: "group",
      groups: { uk: ["Персонаж", "Вороги", "VFX бою", "VFX оточення", "UI-анімації"], en: ["Character", "Enemies", "Combat VFX", "Environment VFX", "UI animation"] },
      about: { uk: "Анімації персонажів і ворогів, ефекти, частинки: хто, що, тривалість, джерело.", en: "Character and enemy animations, effects, particles: who, what, length, source." },
      defs: [F("group", "Група", "Group"), F("who", "Для кого / чого", "For whom / what"), F("what", "Що відбувається", "What happens"),
             F("timing", "Тривалість і тайминг", "Length & timing"), F("source", "Джерело", "Source")] },
    { id: "audio", uk: "Звук і музика", en: "Sound & music", group: "group",
      groups: { uk: ["Музика", "Звукові ефекти", "Озвучка", "Амбієнт", "Звуки UI"], en: ["Music", "Sound effects", "Voice", "Ambience", "UI sounds"] },
      about: { uk: "Музика, ефекти, озвучка, амбієнт: настрій, де звучить, джерело.", en: "Music, sound effects, voice, ambience: mood, where it plays, source." },
      defs: [F("group", "Група", "Group"), F("mood", "Настрій і опис", "Mood & description"), F("where", "Де звучить", "Where it plays"),
             F("length", "Тривалість / цикл", "Length / loop"), F("source", "Джерело / промпт", "Source / prompt")] },
    { id: "ui", uk: "UI / UX", en: "UI / UX", group: "group",
      groups: { uk: ["HUD", "Меню", "Інвентар", "Діалоги", "Онбординг", "Налаштування"], en: ["HUD", "Menus", "Inventory", "Dialogue", "Onboarding", "Settings"] },
      about: { uk: "Екрани, HUD, меню, онбординг: що на екрані, дії гравця, переходи.", en: "Screens, HUD, menus, onboarding: what is on screen, player actions, transitions." },
      defs: [F("group", "Група", "Group"), F("purpose", "Навіщо екран", "Purpose"), F("elements", "Елементи", "Elements"),
             F("actions", "Дії гравця й переходи", "Player actions & transitions"), F("refs", "Референси", "References")] },
    { id: "refs", uk: "Референси", en: "References", group: "group",
      groups: { uk: ["Візуал", "Геймплей", "Звук", "UI"], en: ["Visuals", "Gameplay", "Sound", "UI"] },
      about: { uk: "Мудборд та ігри-зразки: що саме беремо і чого уникаємо.", en: "Moodboard and reference games: what exactly we take and what we avoid." },
      defs: [F("group", "Група", "Group"), F("what", "Що беремо", "What we take"), F("avoid", "Чого уникаємо", "What we avoid"), F("link", "Посилання", "Link")] },
    { id: "tech", uk: "Технічне", en: "Technical", group: "group",
      groups: { uk: ["Рушій і збірка", "Платформи", "Перформанс", "Сейви", "Мультиплеєр", "Інструменти"], en: ["Engine & build", "Platforms", "Performance", "Saves", "Multiplayer", "Tools"] },
      about: { uk: "Рушій, платформи, збірка, перформанс, сейви, мультиплеєр, інструменти.", en: "Engine, platforms, build, performance, saves, multiplayer, tools." },
      defs: [F("group", "Група", "Group"), F("decision", "Рішення", "Decision"), F("constraints", "Обмеження й бюджети", "Constraints & budgets"), F("status", "Стан зараз", "Current state")] },
  ];
  var PLAN = { id: "plan", special: "plan", uk: "Продакшн-план", en: "Production plan",
    about: { uk: "Інтерактивний гейм-диздок і точний план розробки, складені з канону та всієї біблії гри.", en: "An interactive game design doc and a precise development plan built from the canon and the whole game bible." } };
  var ISSUES = { id: "issues", special: "issues", uk: "Неузгоджене", en: "Inconsistencies" };
  var CANON_ISSUES = { id: "canonIssues", special: "canonIssues", uk: "Неузгоджене", en: "Inconsistencies" };
  var CHRONICLE = { id: "chronicle", special: "chronicle", uk: "Історія і хроніка", en: "History & chronicle",
    about: { uk: "Події світу на лінії часу та історії, що в ньому написані.", en: "The world's events on the time line, and the stories written in it." } };
  // Culture lives in worlds/{w}/lore (not entity kinds: the Universe tree, extraction and scenes know exactly five)
  var CULTURE = { id: "culture", special: "culture", uk: "Культура", en: "Culture",
    about: { uk: "Народи й раси, мови, віра й міфологія, звичаї — те, чим живуть у цьому світі.", en: "Peoples and races, languages, faith and mythology, customs — how this world lives." } };
  var LORE = [
    { id: "peoples", uk: "Народи й раси", en: "Peoples & races",
      defs: [F("origin", "Походження", "Origin"), F("look", "Вигляд і тіло", "Look & body"), F("society", "Суспільство й звичаї", "Society & customs"), F("lands", "Де живуть", "Where they live")] },
    { id: "languages", uk: "Мови", en: "Languages",
      defs: [F("sound", "Звучання", "Sound"), F("script", "Писемність", "Script"), F("phrases", "Слова й фрази", "Words & phrases"), F("speakers", "Хто говорить", "Who speaks it")] },
    { id: "beliefs", uk: "Віра й міфологія", en: "Faith & mythology",
      defs: [F("powers", "Божества й сили", "Gods & powers"), F("myths", "Міфи", "Myths"), F("rites", "Обряди", "Rites"), F("believers", "Хто вірить", "Believers")] },
    { id: "customs", uk: "Звичаї й побут", en: "Customs & daily life",
      defs: [F("what", "Що це", "What it is"), F("when", "Коли і де", "When & where"), F("meaning", "Значення", "Meaning")] },
  ];
  // a custom culture subsection is named by its id and has no fields of its own beyond the description
  var loreGroup = function (id) { return LORE.filter(function (g) { return g.id === id; })[0] || { id: id, uk: id || L(LORE[3]), en: id || L(LORE[3]), defs: id ? [] : LORE[3].defs }; };
  var COSMOLOGY = { id: "cosmology", special: "cosmology", uk: "Космологія", en: "Cosmology",
    about: { uk: "Небо світу: планета, сонця, супутники, календар — у Космографі.", en: "The sky of the world: planet, suns, moons, calendar — in the Cosmograph." } };
  CANON.push(CANON_ISSUES, CHRONICLE, CULTURE, COSMOLOGY);
  var CUSTOM_DEFS = [F("text", "Опис", "Description")];
  var PREFIX = { characters: "char", locations: "loc", factions: "fac", artifacts: "art", events: "evt" };
  var FN = "https://us-central1-whitewrite-app.cloudfunctions.net/gamedevPlan";
  var MCP_URL = "https://us-central1-whitewrite-app.cloudfunctions.net/mcp";

  // ---------- state ----------
  var params = new URLSearchParams(location.search);
  var worldId = params.get("worldId");
  var db = null, world = null, games = [], gameId = null, game = null;
  var lore = []; // culture entries: worlds/{w}/lore/{id} { group, name, desc, fields, files }
  var cards = [], entities = [], planDoc = {}, canWrite = false, canGame = false, unsub = [];
  var tasks = [], changeReqs = [], execs = [], keys = [], newKey = null; // execution: Task Engine + Claude Code (MCP)
  var section = "overview", query = "", statusFilter = {}, planName = null, pendingFocus = null;
  var canonFolded = false; try { canonFolded = !!localStorage.getItem("ww-bible-fold"); } catch (e) {}
  var editMode = false; // card field structure editing (names, types, deletion) — never survives closing the card
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
    var hidden = (game && game.hiddenSections) || [];
    return GAME.filter(function (s) { return hidden.indexOf(s.id) < 0; }).concat(own, [ISSUES, PLAN]);
  }
  var SETTINGS = { id: "settings", special: "settings", uk: "Налаштування проєкту", en: "Project settings",
    about: { uk: "Назви, рушій, імпорт і експорт, безпечне видалення.", en: "Names, engine, import and export, safe deletion." } };
  function sections() { return CANON.concat(gameSections(), [SETTINGS]); }
  // Subheadings: every ordinary section groups its cards by one field (mechanics "group", assets "category", others "group")
  function groupKey(s) { return s.special ? "" : (s.group || "group"); }
  // Standard subheadings of the section first (s.groups), then the author's own ones in order of appearance.
  // ---------- subsections: «＋ Додати» at each subheading (the Культура pattern), «＋ Підрозділ» on the top bar ----------
  // Their order lives in games/{g}.subsections[sectionId] (game sections) or worlds/{w}.subsections[sectionId] (canon);
  // standard names are stored in either language and shown in the current one.
  function normGroup(s, name) {
    var g = s.groups, i = g ? g.uk.indexOf(name) : -1; if (g && i < 0) i = g.en.indexOf(name);
    return i >= 0 ? (g[LANG] || g.uk)[i] : name;
  }
  function inCanon(s) { return !!(s.dossier || s.special === "chronicle" || s.special === "culture"); }
  function subsOf(s) {
    var own = ((inCanon(s) ? world : game) || {}).subsections || {};
    if (Array.isArray(own[s.id])) return own[s.id].map(function (n) { return normGroup(s, n); });
    if (s.special === "culture") return LORE.map(function (g) { return g.id; });
    return s.groups ? (s.groups[LANG] || s.groups.uk).slice() : [];
  }
  function saveSubs(s, list) {
    var patch = { subsections: {} }; patch.subsections[s.id] = list;
    return (inCanon(s) ? wref() : gref()).set(patch, { merge: true });
  }
  // One block per subsection: heading with its count and «＋ Додати»; empty custom ones can be removed.
  function subsHtml(s, items, groupOf, body, labelOf) {
    var subs = subsOf(s), by = {}, extra = [], loose = [];
    items.forEach(function (x) {
      var g = groupOf(x) || "";
      if (!g) return loose.push(x);
      if (subs.indexOf(g) < 0 && extra.indexOf(g) < 0) extra.push(g);
      (by[g] = by[g] || []).push(x);
    });
    var html = "", head = function (g, label, n, canDrop) {
      return '<h2 class="group">' + esc(label) + ' <span>' + n + '</span><button class="btn mini" data-addsub="' + esc(g) + '">' + STR.sub.item + '</button>' +
        (canDrop ? '<button class="btn mini ghost" data-subdel="' + esc(g) + '" title="' + esc(STR.sub.del) + '" aria-label="' + esc(STR.sub.del + " " + label) + '">✕</button>' : '') + '</h2>';
    };
    subs.concat(extra).forEach(function (g) {
      var list = by[g] || [];
      html += head(g, labelOf ? labelOf(g) : g, list.length, !list.length && subs.indexOf(g) >= 0) + (list.length ? body(list) : '<p class="muted">' + STR.sub.empty + '</p>');
    });
    if (loose.length || !(subs.length + extra.length)) {
      var gl = subs.length + extra.length ? STR.other : s.special === "chronicle" ? STR.sub.timeline : STR.sub.general;
      html += head("", gl, loose.length, false) + (loose.length ? body(loose) : '<p class="muted">' + STR.sub.empty + '</p>');
    }
    return html;
  }
  function newSubsection() {
    var s = sec(section);
    askName(STR.sub.title, STR.sub.ph, function (name) {
      if (!name) return;
      var list = subsOf(s); if (list.indexOf(name) < 0) saveSubs(s, list.concat(name));
    });
  }
  function dropSubsection(g) { var s = sec(section); saveSubs(s, subsOf(s).filter(function (x) { return x !== g; })); }
  // «＋ Додати» under a subheading: a card, a dossier, an event or a culture entry born in that subsection
  function addIn(g) {
    var s = sec(section);
    if (s.dossier) return openDossier({ id: entityId(s.dossier), kind: s.dossier, isNew: true, group: g });
    if (s.special === "chronicle") return openDossier({ id: entityId("events"), kind: "events", isNew: true, group: g });
    if (s.special === "culture") return openDossier({ id: newId("lore"), col: "lore", group: g || "customs", isNew: true });
    addCard(false, g);
  }
  function groupsOf(s) {
    var k = groupKey(s), seen = subsOf(s);
    allCards().forEach(function (c) { var g = c.section === s.id && c.fields[k] && normGroup(s, c.fields[k]); if (g && seen.indexOf(g) < 0) seen.push(g); });
    return seen;
  }
  function sec(id) { return sections().filter(function (s) { return s.id === id; })[0] || GAME[0]; }

  // Unified card view: a canon entity seen through this game, or a game-only card.
  function canonCard(e, s) {
    var c = cards.filter(function (x) { return x.canonRef === e.id; })[0] || {};
    var descKey = e.desc !== undefined || e.description === undefined ? "desc" : "description";
    var extra = (c.defs || []).filter(function (d) { return !s.defs.some(function (x) { return x.key === d.key; }); });
    return { key: "e:" + e.id, src: "canon", id: e.id, section: s.id, title: e.name || e.title || "", status: c.status || "idea", note: c.note || "",
      canonDesc: { key: descKey, value: e[descKey] || "" }, defs: c.defsFull ? (c.defs || []) : s.defs.concat(extra), extraDefs: extra, defsFull: !!c.defsFull, fields: c.fields || {}, files: c.files || [], hidden: !!c.hidden };
  }
  function inGame(e) {
    var c = cards.filter(function (x) { return x.canonRef === e.id; })[0];
    return c ? !c.hidden : !(game && game.canonOptIn);
  }
  function gameCard(c) {
    var s = sec(c.section);
    return { key: "c:" + c.id, src: "game", id: c.id, section: c.section, title: c.title || "", status: c.status || "idea", note: c.note || "",
      defs: (c.defs && c.defs.length) ? c.defs : (s.defs || CUSTOM_DEFS), fields: c.fields || {}, files: c.files || [] };
  }
  function allCards() {
    var out = [];
    gameSections().forEach(function (s) {
      if (s.canon) entities.filter(function (e) { return e.kind === s.canon && inGame(e); }).forEach(function (e) { out.push(canonCard(e, s)); });
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
    var n = s.special === "issues" ? (gameIssues().length + openQs().length || "") : s.special === "canonIssues" ? (canonIssues().length || "")
      : s.special === "culture" ? lore.length
      : s.special === "chronicle" ? entities.filter(function (e) { return e.kind === "events"; }).length
      : s.dossier ? entities.filter(function (e) { return e.kind === s.dossier; }).length
      : s.special ? "" : all.filter(function (c) { return c.section === s.id; }).length;
    return '<button class="nav-item" data-sec="' + esc(s.id) + '" aria-current="' + (s.id === section && !imp) + '">' + esc(L(s)) + '<span class="n">' + n + '</span></button>';
  }
  function renderNav() {
    var all = allCards();
    var pick = !canGame ? '<button class="nav-item" data-sec="overview">🔒 ' + esc(STR.wt.gameLocked) + '</button>' : games.length ? '<div class="gamerow"><label for="gamepick">' + STR.gameLabel + '</label><select id="gamepick">' +
      games.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === gameId ? " selected" : "") + '>' + esc(g.title) + '</option>'; }).join("") +
      '<option value="__new"' + (game ? "" : " selected") + '>' + esc(STR.newGame) + '</option></select></div>' : "";
    // the world block folds away so the author can work on the game alone
    $("nav").innerHTML = '<button class="navh navtoggle" id="canon-toggle" aria-expanded="' + !canonFolded + '"><span class="arr"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></span>' + STR.canonGroup + '</button>' +
      (canonFolded ? "" : CANON.map(function (s) { return navItem(s, all); }).join("")) +
      pick + (game ? gameSections().map(function (s) { return navItem(s, all); }).join("") : "");
    $("newsec-slot").innerHTML = game && canGame ? '<button class="nav-add" id="sec-add">' + STR.addSection + '</button>' : '';
    $("nav-foot").innerHTML = navItem(SETTINGS, all).replace('data-sec="settings">', 'data-sec="settings">⚙ ');
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
    var img = (c.files || []).filter(isImage)[0] || (c.src === "canon" && entImage(entities.filter(function (e) { return e.id === c.id; })[0]));
    if ((c.files || []).length) tags.push('<span class="flag">📎 ' + c.files.length + '</span>');
    var lc = worstLic(c.files); if (lc) tags.push(lc);
    var model = (c.files || []).filter(is3D)[0];
    var corner = model ? '<span class="v3d-pill" role="button" tabindex="0" title="' + esc(STR.v3d.view) + '" aria-label="' + esc(STR.v3d.view) + '" data-view3d="' + esc(model.id) + '">🧊 3D</span>' : '';
    var hv = (c.files || []).filter(heavy).sort(function (a, b) { return b.tris - a.tris; })[0];
    if (hv) tags.unshift(polyMark(hv));
    return '<button class="card' + (model ? ' has3d' : '') + '" data-key="' + esc(c.key) + '">' + corner + (img ? '<img class="thumb" loading="lazy" alt="" src="' + esc(img.url) + '">' : '') +
      '<h3>' + esc(c.title || STR.newCard) + '</h3><div class="tags">' + tags.join("") +
      '</div><p class="ex">' + esc(excerpt(c)) + '</p></button>';
  }

  function render() {
    renderNav();
    if (cosmo && (section !== "cosmology" || imp || query)) { cosmo.api.destroy(); cosmo = null; }
    $("statuses").hidden = !query && CANON.some(function (x) { return x.id === section; }); // the canon has no game statuses
    if (section === "settings" && !imp) return renderSettings();
    if (section === "canonIssues" && !imp && !query) return renderCanonIssues();
    var cs = CANON.filter(function (x) { return x.id === section; })[0];
    if (cs && !imp && !query) {
      if (cs.special === "world") return renderWorld(cs);
      if (cs.special === "laws") return renderLaws(cs);
      if (cs.dossier) return renderDossiers(cs);
      if (cs.special === "chronicle") return renderChronicle(cs);
      if (cs.special === "culture") return renderCulture(cs);
      if (cs.special === "cosmology") return renderCosmology(cs);
    }
    if (!canGame) return renderGameLocked();
    if (!game) return renderNewGame();
    if (imp) return renderImport();
    var s = sec(section);
    if (s.special === "plan" && !query) return renderPlan(s);
    if (s.special === "issues" && !query) return renderIssues();
    var all = allCards();
    var list = query ? all.filter(matches) : all.filter(function (c) { return c.section === section && matches(c); });
    var html = '<header class="sec"><div><h1>' + (query ? STR.found + ": " + list.length : esc(L(s))) + '</h1>' +
      (query ? '' : '<p>' + esc(L(s.about)) + '</p>') + '</div>' +
      (query ? '' : '<div class="row">' + (s.custom ? '<button class="btn danger" id="sec-del">' + STR.deleteSection + '</button>' : '') +
        '<button class="btn primary" id="add-top">' + STR.sub.add + '</button></div>') + '</header>';
    var grid = function (l) { return '<div class="grid">' + l.map(cardHtml).join("") + '</div>'; };
    if (query) html += list.length ? grid(list) : '<p class="empty">' + STR.nothing + '</p>';
    else html += subsHtml(s, list, function (c) { return c.fields[groupKey(s)] && normGroup(s, c.fields[groupKey(s)]); }, grid);
    $("view").innerHTML = html;
    var at = $("add-top"); if (at) at.onclick = newSubsection;
    var sd = $("sec-del"); if (sd) sd.onclick = function () { confirmDeleteSection(sec(section)); };
  }

  // ---------- world overview & laws — edited here (they lived in the Universe tree); worlds/{w} { tagline, summary, facts, rules } ----------
  // The draft survives live re-renders (any snapshot repaints the view) until it is saved or the author leaves the section.
  var wdraft = null, wdraftSec = null;
  function wd(sid) {
    if (wdraft && wdraftSec === sid) return wdraft;
    var w = world || {};
    wdraftSec = sid; wdraft = { tagline: w.tagline || "", summary: w.summary || "", rules: (w.rules || []).slice(),
      facts: (w.facts || []).map(function (f) { return typeof f === "string" ? { k: "", v: f } : { k: f.k || "", v: f.v || "" }; }) };
    wdraft.first = JSON.stringify(wdraft);
    return wdraft;
  }
  function wdirty() { var d = wdraft, f = d.first; delete d.first; var x = JSON.stringify(d); d.first = f; return x !== f; }
  function wsaveRow() { return '<div class="row wsave"><span class="muted" id="w-state"></span><button class="btn primary" id="w-save">' + STR.wt.save + '</button></div>'; }
  function wbind(sid) {
    var v = $("view"), st = function () { $("w-state").textContent = wdirty() ? STR.wt.dirty : ""; };
    v.oninput = function (e) { // #view is shared by every section: act only while the world form is on screen
      if (!wdraft || !$("w-save")) return;
      var t = e.target, i = +t.dataset.i;
      if (t.id === "w-tag") wdraft.tagline = t.value; else if (t.id === "w-sum") wdraft.summary = t.value;
      else if (t.dataset.fk) wdraft.facts[i][t.dataset.fk] = t.value; else if (t.dataset.rule != null) wdraft.rules[+t.dataset.rule] = t.value;
      st();
    };
    v.onclick = function (e) {
      if (!wdraft || !$("w-save")) return;
      var t = e.target;
      if (t.id === "w-addfact") { wdraft.facts.push({ k: "", v: "" }); render(); var fs = v.querySelectorAll("[data-fk=k]"); fs[fs.length - 1].focus(); }
      else if (t.id === "w-addlaw") { wdraft.rules.push(""); render(); var rs = v.querySelectorAll("[data-rule]"); rs[rs.length - 1].focus(); }
      else if (t.dataset.rmfact != null) { wdraft.facts.splice(+t.dataset.rmfact, 1); render(); }
      else if (t.dataset.rmlaw != null) { wdraft.rules.splice(+t.dataset.rmlaw, 1); render(); }
      else if (t.id === "w-save") saveWorld(t);
    };
    st();
  }
  async function saveWorld(btn) {
    var d = wdraft, up = { tagline: d.tagline.trim(), summary: d.summary.trim(),
      facts: d.facts.filter(function (f) { return f.v.trim() || f.k.trim(); }).map(function (f) { return f.k.trim() ? { k: f.k.trim(), v: f.v.trim() } : f.v.trim(); }),
      rules: d.rules.map(function (r) { return r.trim(); }).filter(Boolean) };
    btn.disabled = true; $("w-state").textContent = STR.saving;
    try { await wref().update(Object.assign(up, { updatedAt: stamp() })); wdraft = null; render(); var w = $("w-state"); if (w) w.textContent = STR.saved; }
    catch (er) { btn.disabled = false; $("w-state").textContent = STR.failed + ": " + (er.code || er.message); }
  }
  function renderWorld(s) {
    var d = wd(s.id);
    $("view").innerHTML = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div></header>' +
      '<div class="canonbox wedit"><h4>' + STR.worldCanon + '</h4>' +
      '<label class="field"><span>' + STR.wt.tagline + '</span><input id="w-tag" value="' + esc(d.tagline) + '" placeholder="' + esc(STR.wt.taglinePh) + '"></label>' +
      '<label class="field"><span>' + STR.wt.summary + '</span><textarea id="w-sum" rows="5" placeholder="' + esc(STR.wt.summaryPh) + '">' + esc(d.summary) + '</textarea></label>' +
      '<h4 style="margin-top:12px">' + STR.facts + '</h4>' + d.facts.map(function (f, i) {
        return '<div class="wrow"><input data-fk="k" data-i="' + i + '" value="' + esc(f.k) + '" placeholder="' + esc(STR.wt.factK) + '" aria-label="' + esc(STR.wt.factK) + '">' +
          '<input data-fk="v" data-i="' + i + '" value="' + esc(f.v) + '" placeholder="' + esc(STR.wt.factV) + '" aria-label="' + esc(STR.wt.factV) + '">' +
          '<button class="btn ghost" data-rmfact="' + i + '" aria-label="' + esc(STR.remove) + '">✕</button></div>';
      }).join("") + '<button class="btn mini ghost" id="w-addfact">' + STR.wt.addFact + '</button></div>' +
      wsaveRow() + '<p class="muted">' + STR.worldReadonly + '</p>';
    wbind(s.id);
  }
  function renderLaws(s) {
    var d = wd(s.id);
    $("view").innerHTML = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div></header>' +
      '<div class="canonbox wedit"><h4>' + STR.laws + '</h4>' + (d.rules.length ? '<ol class="wlaws">' + d.rules.map(function (r, i) {
        return '<li class="wrow"><input data-rule="' + i + '" value="' + esc(r) + '" placeholder="' + esc(STR.wt.lawPh) + '" aria-label="' + esc(STR.laws + " " + (i + 1)) + '">' +
          '<button class="btn ghost" data-rmlaw="' + i + '" aria-label="' + esc(STR.remove) + '">✕</button></li>';
      }).join("") + '</ol>' : '<p class="muted">' + STR.wt.noLaws + '</p>') + '<button class="btn mini ghost" id="w-addlaw">' + STR.wt.addLaw + '</button></div>' +
      wsaveRow() + '<p class="muted">' + STR.worldReadonly + '</p>';
    wbind(s.id);
  }

  // ---------- scenes of every story of the world: state over time, the map's routes, the impact of a canon change ----------
  var wsc = null;
  function worldScenes() {
    if (wsc && wsc.n === stories.length && Date.now() - wsc.at < 60000) return wsc.p;
    var p = Promise.all(stories.map(function (st) {
      return db.collection("projects").doc(st.id).collection("scenes").get().then(function (sn) {
        return sn.docs.map(function (d) { return Object.assign({ id: d.id, story: st }, d.data()); }).sort(function (a, b) { return (a.n || 0) - (b.n || 0); });
      });
    })).then(function (all) { return [].concat.apply([], all); });
    wsc = { at: Date.now(), n: stories.length, p: p }; p.catch(function () { wsc = null; });
    return p;
  }
  function stateRows(scenes, e) {
    var rows = [];
    scenes.forEach(function (sc) { (sc.stateChanges || []).forEach(function (c) { if (c.kind === e.kind && c.id === e.id) rows.push({ sc: sc, aspect: c.aspect, value: c.value }); }); });
    return rows;
  }
  function stateHtml(rows) {
    if (!rows.length) return "";
    var by = {}; rows.forEach(function (r) { (by[r.sc.story.id] = by[r.sc.story.id] || []).push(r); });
    return '<h4 class="dsub">' + STR.wt.state + '</h4>' + Object.keys(by).map(function (k) {
      var list = by[k];
      return '<div class="stl"><b>' + esc(list[0].sc.story.title || "…") + '</b><ol>' + list.map(function (r) {
        return '<li><span class="scene-n">' + esc(STR.wt.scene + " " + (r.sc.n || "")) + '</span><span class="muted">' + esc(STR.wt.aspects[r.aspect] || r.aspect) + '</span><span>' + esc(r.value) + '</span></li>';
      }).join("") + '</ol></div>';
    }).join("");
  }
  function affectedScenes(scenes, e) { return scenes.filter(function (sc) { return ((sc.canonRefs || {})[e.kind] || []).indexOf(e.id) >= 0; }); }
  function impactHtml(list) {
    return '<h4 class="dsub">' + STR.wt.impact + '</h4>' + (list.length ? '<p class="muted">' + esc(STR.wt.impactText.replace("{n}", list.length)) + '</p>' +
      '<button class="btn" id="d-recon">' + STR.wt.impactBtn + '</button>' : '<p class="muted">' + STR.wt.noImpact + '</p>');
  }

  // ---------- «✦ Узгодити сцени»: a canon change → each affected scene rewritten by the AI (reconstructScene), reviewed as a diff ----------
  function wordDiff(a, b) { // word-level LCS on the edited middle (common prefix/suffix trimmed), as in the old Universe tree
    var A = a.split(/(\s+)/), B = b.split(/(\s+)/), p = 0, q = 0, out = [];
    while (p < A.length && p < B.length && A[p] === B[p]) p++;
    while (q < A.length - p && q < B.length - p && A[A.length - 1 - q] === B[B.length - 1 - q]) q++;
    var a2 = A.slice(p, A.length - q), b2 = B.slice(p, B.length - q), n = a2.length, m = b2.length;
    var push = function (type, text) { var l = out[out.length - 1]; if (l && l.type === type) l.text += text; else if (text) out.push({ type: type, text: text }); };
    push("eq", A.slice(0, p).join(""));
    if (n * m > 4e6) { push("del", a2.join("")); push("ins", b2.join("")); }
    else {
      var W = m + 1, dp = new Uint16Array((n + 1) * W), i, j;
      for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) dp[i * W + j] = a2[i] === b2[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      i = 0; j = 0;
      while (i < n && j < m) {
        if (a2[i] === b2[j]) { push("eq", a2[i]); i++; j++; }
        else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) push("del", a2[i++]); else push("ins", b2[j++]);
      }
      while (i < n) push("del", a2[i++]);
      while (j < m) push("ins", b2[j++]);
    }
    push("eq", A.slice(A.length - q).join(""));
    return out;
  }
  function diffHtml(before, after) {
    var parts = wordDiff(before, after), K = 160;
    return '<div class="rc-diff">' + parts.map(function (x, i) {
      if (x.type !== "eq") return '<span class="rc-' + x.type + '">' + esc(x.text) + '</span>';
      var t = x.text;
      if (t.length > 2 * K + 40) t = i === 0 ? "… " + t.slice(-K) : i === parts.length - 1 ? t.slice(0, K) + " …" : t.slice(0, K) + " … " + t.slice(-K);
      return esc(t);
    }).join("") + '</div>';
  }
  function reconDialog(e, list) {
    var pc = window.__getPlanConfig(((window.__wwUser || {}).plan) || planName || "free");
    var per = pc.allowClaude ? COST_BASE : ((window.__TOKEN_COSTS || {}).sceneGemini || 20); // the server reserves economy_operations/generateScene per scene
    var box = document.createElement("div"), rows = {}, running = false, stopped = false;
    box.className = "ask";
    var pinned = function (sc) { return (sc.reconstruction || {}).mode === "pinned"; };
    box.innerHTML = '<form class="ask-box rc-box" role="dialog" aria-modal="true" aria-label="' + esc(STR.wt.impact) + '"><h3>✦ ' + esc(STR.wt.impact) + ' · ' + esc(e.name || e.title || "") + '</h3>' +
      (pc.allowReconstruction ? '<label class="field"><span>' + STR.wt.kind + '</span><select id="rc-kind">' + Object.keys(STR.wt.kinds).map(function (k) { return '<option value="' + k + '">' + esc(STR.wt.kinds[k]) + '</option>'; }).join("") + '</select></label>' +
        '<label class="field"><span>' + STR.wt.note + '</span><textarea id="rc-note" rows="2" maxlength="500" placeholder="' + esc(STR.wt.notePh) + '"></textarea></label>' : '<p class="warn">' + STR.wt.plan + '</p>') +
      '<div class="rc-list">' + list.map(function (sc, i) {
        return '<div class="rc-row" data-i="' + i + '"><label><input type="checkbox" data-pick="' + i + '"' + (pinned(sc) || !pc.allowReconstruction ? ' disabled' : ' checked') + '> <b>' + esc(sc.story.title || "…") + '</b> · ' + esc(STR.wt.scene + " " + (sc.n || "")) + ' ' + esc(sc.title || "") + '</label>' +
          '<span class="rc-st muted">' + (pinned(sc) ? STR.wt.pinned : "") + '</span><div class="rc-out"></div></div>';
      }).join("") + '</div>' +
      '<p class="muted" id="rc-cost"></p><div class="row"><button type="button" class="btn" id="ask-x">' + STR.close + '</button>' +
      (pc.allowReconstruction ? '<button class="btn primary" id="rc-go">' + STR.wt.run + '</button>' : '') + '</div></form>';
    document.body.appendChild(box);
    var q = function (sel) { return box.querySelector(sel); };
    var picked = function () { return [].filter.call(box.querySelectorAll("[data-pick]"), function (c) { return c.checked; }).map(function (c) { return +c.dataset.pick; }); };
    var cost = function () { q("#rc-cost").textContent = pc.allowReconstruction ? STR.wt.cost.replace("{n}", per).replace("{s}", picked().length) : ""; };
    var close = function () { stopped = true; box.remove(); wsc = null; mapRoutes = null; };
    cost(); box.addEventListener("change", cost);
    q("#ask-x").onclick = close;
    box.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); close(); } });
    box.addEventListener("click", async function (ev) {
      var b = ev.target.closest("[data-rc]"); if (!b) return;
      var i = +b.dataset.i, r = rows[i], sc = list[i], out = b.closest(".rc-row").querySelector(".rc-out"), st = b.closest(".rc-row").querySelector(".rc-st");
      if (b.dataset.rc === "no") { out.innerHTML = ""; st.textContent = STR.wt.rejected; return; }
      b.disabled = true;
      try {
        await db.collection("projects").doc(sc.story.id).collection("scenes").doc(sc.id).update({ text: r.after, "reconstruction.previousText": r.before,
          "reconstruction.lastReconstructionAt": stamp(), "reconstruction.lastCause": { type: e.kind, id: e.id, change: r.kind } });
        out.innerHTML = ""; st.textContent = STR.wt.accepted;
      } catch (er) { b.disabled = false; st.textContent = STR.failed + ": " + (er.code || er.message); }
    });
    var go = q("#rc-go");
    if (go) q("form").onsubmit = async function (ev) {
      ev.preventDefault(); if (running) return;
      var pick = picked(); if (!pick.length) return;
      running = true; go.disabled = true;
      var kind = q("#rc-kind").value, note = q("#rc-note").value.trim();
      [].forEach.call(box.querySelectorAll("[data-pick], #rc-kind, #rc-note"), function (x) { x.disabled = true; });
      pick.forEach(function (i) { box.querySelector('.rc-row[data-i="' + i + '"] .rc-st').textContent = STR.wt.wait; });
      var token = await firebase.auth().currentUser.getIdToken();
      for (var k = 0; k < pick.length && !stopped; k++) {
        var i = pick[k], sc = list[i], row = box.querySelector('.rc-row[data-i="' + i + '"]'), st = row.querySelector(".rc-st");
        st.textContent = STR.wt.busy;
        try {
          var resp = await fetch("https://us-central1-whitewrite-app.cloudfunctions.net/reconstructScene", { method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ projectId: sc.story.id, sceneId: sc.id, entityType: e.kind, entityId: e.id, changeType: kind, changeNote: note }) });
          var d = await resp.json().catch(function () { return { error: "HTTP " + resp.status }; });
          if (!resp.ok || d.success === false) throw new Error(d.error || "HTTP " + resp.status);
          if (d.unchanged || d.proposedText === sc.text) { st.textContent = STR.wt.same; continue; }
          rows[i] = { before: sc.text || "", after: d.proposedText, kind: kind };
          st.textContent = "";
          row.querySelector(".rc-out").innerHTML = diffHtml(sc.text || "", d.proposedText) +
            '<div class="row"><button type="button" class="btn" data-rc="no" data-i="' + i + '">' + STR.wt.reject + '</button><button type="button" class="btn primary" data-rc="ok" data-i="' + i + '">' + STR.wt.accept + '</button></div>';
        } catch (er) { st.textContent = STR.wt.stop.replace("{e}", er.message); break; }
      }
      running = false;
    };
  }

  // ---------- world dossiers: the canon entity itself (worlds/{w}/entities/{id}) — no game statuses ----------
  // entity.dossier { story, look }, entity.lifeNotes [{ id, at, text }], entity.files [] (Storage worlds/{w}/files/{entityId}/…)
  var dos = null, ddraft = null, dfirst = "", dtab = "story";
  function descKeyOf(e) { return e.desc !== undefined || e.description === undefined ? "desc" : "description"; }
  function dosSection(kind) { return CANON.filter(function (s) { return s.dossier === kind; })[0]; }
  function entImage(e) { return ((e && e.files) || []).filter(isImage)[0]; }
  function plain(v) { return String(v || "").replace(/[*`|#>-]+/g, " ").replace(/\s+/g, " ").slice(0, 220); }
  function renderDossiers(s) {
    var list = entities.filter(function (e) { return e.kind === s.dossier; })
      .sort(function (a, b) { return String(a.name || a.title || "").localeCompare(String(b.name || b.title || "")); });
    var isMap = s.dossier === "locations" && locView === "map";
    $("view").innerHTML = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div>' +
      '<div class="row">' + (s.dossier === "locations" ? '<button class="btn" id="loc-view">' + (isMap ? STR.wt.cards : STR.wt.map) + '</button>' : '') +
      (isMap ? '' : '<button class="btn primary" id="add-top">' + STR.sub.add + '</button>') + '</div></header>' +
      (isMap ? mapHtml(list) : subsHtml(s, list, function (e) { return e.group; }, function (l) { return '<div class="grid">' + l.map(dosCardHtml).join("") + '</div>'; }));
    var at = $("add-top"); if (at) at.onclick = newSubsection;
    var lv = $("loc-view"); if (lv) lv.onclick = function () { locView = isMap ? "cards" : "map"; try { localStorage.setItem("ww-locview", locView); } catch (e) {} render(); };
    if (isMap) bindMap(list);
  }

  // ---------- world map: locations laid out by the author (drag → entity.mapPos), who stays where (canon), routes from story scenes ----------
  var locView = "cards"; try { locView = localStorage.getItem("ww-locview") || "cards"; } catch (e) {}
  var MAP_W = 1000, MAP_H = 620, mapRoutes = null;
  function mapPos(l, i) { return l.mapPos || { x: MAP_W / 2 + Math.cos(i * 2.39996) * (90 + 34 * Math.sqrt(i)) * 1.6, y: MAP_H / 2 + Math.sin(i * 2.39996) * (90 + 34 * Math.sqrt(i)) }; }
  function matchLoc(v, locs) {
    var byId = locs.filter(function (l) { return l.id === v; })[0]; if (byId) return byId;
    var t = String(v || "").toLowerCase(); if (!t) return null;
    return locs.slice().sort(function (a, b) { return (b.name || "").length - (a.name || "").length; }).filter(function (l) { return l.name && t.indexOf(l.name.toLowerCase()) >= 0; })[0] || null;
  }
  function mapHtml(locs) {
    if (!locs.length) return '<p class="empty">' + STR.wt.noLocs + '</p>';
    var P = {}, here = {};
    locs.forEach(function (l, i) { P[l.id] = mapPos(l, i); });
    entities.forEach(function (c) { if (c.kind !== "characters") return; var l = matchLoc(c.location || (Array.isArray(c.locations) ? c.locations[0] : null), locs); if (l) (here[l.id] = here[l.id] || []).push(c); });
    var lines = Object.keys(mapRoutes || {}).map(function (k) {
      var ab = k.split("|"), a = P[ab[0]], b = P[ab[1]]; if (!a || !b) return "";
      return '<line class="wmap-route" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '" stroke-width="' + (1.2 + Math.min(mapRoutes[k], 5) * 0.8) + '"/>';
    }).join("");
    return '<div class="wmap"><svg id="wmap" viewBox="0 0 ' + MAP_W + ' ' + MAP_H + '" role="img" aria-label="' + esc(STR.wt.map) + '">' +
      '<defs><pattern id="wmap-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="0.6"/></pattern></defs>' +
      '<rect width="' + MAP_W + '" height="' + MAP_H + '" fill="url(#wmap-grid)" class="wmap-grid"/>' + lines +
      locs.map(function (l) {
        var p = P[l.id], who = here[l.id] || [];
        return '<g class="wmap-node" data-loc="' + esc(l.id) + '" transform="translate(' + p.x + ',' + p.y + ')" tabindex="0" role="button" aria-label="' + esc(l.name || "") + '">' +
          '<circle r="' + (who.length ? 17 : 13) + '" class="wmap-dot"/>' + (who.length ? '<text class="wmap-count" text-anchor="middle" dy="4">' + who.length + '</text>' : '') +
          '<text class="wmap-name" text-anchor="middle" y="' + (who.length ? 34 : 30) + '">' + esc(l.name || "") + '</text>' +
          (who.length ? '<text class="wmap-who" text-anchor="middle" y="50">' + esc(who.slice(0, 3).map(function (c) { return c.name; }).join(", ") + (who.length > 3 ? " +" + (who.length - 3) : "")) + '</text>' : '') + '</g>';
      }).join("") + '</svg><p class="muted wmap-legend">' + STR.wt.mapHint + (lines ? ' · ' + STR.wt.routes : '') + '</p></div>';
  }
  function bindMap(locs) {
    var svg = $("wmap"); if (!svg) return;
    if (!mapRoutes) worldScenes().then(function (scenes) { // a character's moves inside one story, in story order
      var routes = {}, trail = {};
      scenes.forEach(function (sc) { (sc.stateChanges || []).forEach(function (c) {
        if (c.kind !== "characters" || c.aspect !== "location") return;
        var l = matchLoc(c.value, locs); if (!l) return;
        var key = sc.story.id + "|" + c.id, prev = trail[key]; trail[key] = l.id;
        if (prev && prev !== l.id) { var k = [prev, l.id].sort().join("|"); routes[k] = (routes[k] || 0) + 1; }
      }); });
      mapRoutes = routes;
      if (Object.keys(routes).length && $("wmap")) render();
    }).catch(function () { mapRoutes = {}; });
    var drag = null;
    var toSvg = function (ev) { var r = svg.getBoundingClientRect();
      return { x: Math.round(Math.max(30, Math.min(MAP_W - 30, (ev.clientX - r.left) / r.width * MAP_W))), y: Math.round(Math.max(30, Math.min(MAP_H - 30, (ev.clientY - r.top) / r.height * MAP_H))) }; };
    svg.addEventListener("pointerdown", function (ev) { var g = ev.target.closest("[data-loc]"); if (!g) return; svg.setPointerCapture(ev.pointerId); drag = { g: g, moved: false }; });
    svg.addEventListener("pointermove", function (ev) { if (!drag) return; drag.pos = toSvg(ev); drag.moved = true; drag.g.setAttribute("transform", "translate(" + drag.pos.x + "," + drag.pos.y + ")"); });
    svg.addEventListener("pointerup", function () {
      var d = drag; drag = null; if (!d) return;
      var l = locs.filter(function (x) { return x.id === d.g.dataset.loc; })[0];
      if (!d.moved) { openDossier(l); return; }
      l.mapPos = d.pos;
      wref().collection("entities").doc(l.id).update({ mapPos: d.pos }).catch(function (er) { console.error("Map save failed:", er); });
    });
    svg.addEventListener("keydown", function (ev) { var g = ev.target.closest("[data-loc]"); if (g && ev.key === "Enter") openDossier(locs.filter(function (x) { return x.id === g.dataset.loc; })[0]); });
  }
  function dosCardHtml(e) {
    var img = entImage(e), tags = [];
    if ((e.lifeNotes || []).length) tags.push('<span class="flag">⟡ ' + e.lifeNotes.length + '</span>');
    if ((e.files || []).length) tags.push('<span class="flag">📎 ' + e.files.length + '</span>');
    return '<button class="card dcard" ' + (e.col === "lore" ? "data-lore" : "data-ent") + '="' + esc(e.id) + '">' + (img ? '<img class="thumb" loading="lazy" alt="" src="' + esc(img.url) + '">' : '') +
      '<h3>' + esc(e.name || e.title || STR.newCard) + '</h3>' + (e.role ? '<p class="sub">' + esc(e.role) + '</p>' : '') +
      (tags.length ? '<div class="tags">' + tags.join("") + '</div>' : '') + '<p class="ex">' + esc(plain(e[descKeyOf(e)] || (e.dossier || {}).story || e.motivation ||
        Object.keys(e.fields || {}).map(function (k) { return e.fields[k]; }).join(" "))) + '</p></button>';
  }
  function dmsg(t) { $("d-msg").textContent = t; }
  function openDossier(e) {
    if (!e) return;
    if (open) closeLeaf();
    dos = e; dtab = "story";
    ddraft = { name: e.name || e.title || "", desc: e[descKeyOf(e)] || "", dossier: Object.assign({}, e.dossier),
      lifeNotes: (e.lifeNotes || []).map(function (n) { return Object.assign({}, n); }) };
    if (e.col === "lore") ddraft.fields = Object.assign({}, e.fields);
    $("d-delete").hidden = !(e.col === "lore" && !e.isNew);
    if (e.kind === "events") Object.assign(ddraft, { at: num(e.at) === null ? "" : String(e.at), dur: num(e.dur) === null ? "" : String(e.dur), when: e.when || "",
      who: (Array.isArray(e.characters) ? e.characters : []).slice() });
    dfirst = JSON.stringify(ddraft);
    $("d-kicker").textContent = e.col === "lore" ? L(loreGroup(e.group)) + " · " + L(CULTURE) : (dosSection(e.kind) ? L(dosSection(e.kind)) : STR.dos.kinds[e.kind] || "") + " · " + STR.dos.world;
    $("d-title").value = ddraft.name;
    renderDossier(); dmsg("");
    $("dos").classList.add("open"); $("dos").setAttribute("aria-hidden", "false"); $("scrim").classList.add("open");
    $("d-title").focus();
  }
  function dcollect() {
    if (!ddraft) return;
    ddraft.name = $("d-title").value;
    var d = $("d-desc"); if (d) ddraft.desc = d.value;
    var t = $("d-text"); if (t) ddraft.dossier[t.dataset.k] = t.value;
    ["at", "dur", "when"].forEach(function (k) { var i = $("d-" + k); if (i) ddraft[k] = i.value; });
    [].forEach.call(document.querySelectorAll("#d-body [data-lf]"), function (t) { ddraft.fields[t.dataset.lf] = t.value; });
  }
  function num(v) { var n = typeof v === "number" ? v : parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(n) ? n : null; }
  function eventHtml() {
    var chars = entities.filter(function (x) { return x.kind === "characters"; });
    return '<div class="field evrow"><label>' + STR.chron.at + '<input id="d-at" type="number" step="any" value="' + esc(ddraft.at) + '"></label>' +
      '<label>' + STR.chron.dur + '<input id="d-dur" type="number" min="0" step="any" value="' + esc(ddraft.dur) + '"></label>' +
      '<label>' + STR.chron.when + '<input id="d-when" placeholder="' + esc(STR.chron.whenPh) + '" value="' + esc(ddraft.when) + '"></label></div>' +
      '<div class="field"><label>' + STR.chron.who + '</label>' + (chars.length ? '<div class="dlinks">' + chars.map(function (c) {
        return '<button class="dlink who" data-who="' + esc(c.id) + '" aria-pressed="' + (ddraft.who.indexOf(c.id) >= 0) + '">' + avatar(c) + esc(c.name || "") + '</button>';
      }).join("") + '</div>' : '<p class="muted">' + STR.chron.noChars + '</p>') + '</div>';
  }
  function avatar(c) {
    var img = entImage(c);
    return img ? '<img class="av" alt="" src="' + esc(img.url) + '">' : '<span class="av">' + esc(String(c.name || c.title || "?").trim().charAt(0).toUpperCase()) + '</span>';
  }
  function closeDossier() {
    dos = null; ddraft = null; setTimeout(applyLang);
    $("dos").classList.remove("open"); $("dos").setAttribute("aria-hidden", "true"); $("scrim").classList.remove("open");
  }
  function lifeOrder(n) { var m = String(n.at || "").match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(",", ".")) : Infinity; }
  function lifeHtml() {
    var notes = ddraft.lifeNotes.slice().sort(function (a, b) { return lifeOrder(a) - lifeOrder(b); });
    return '<div class="field"><label>' + STR.dos.life + ' <span class="hint">' + STR.dos.lifeHint + '</span></label>' +
      (notes.length ? '<div class="life"><div class="life-track">' + notes.map(function (n, i) {
        return '<div class="ln' + (i % 2 ? ' up' : '') + '"><span class="ln-dot"></span><div class="ln-note"><b>' + esc(n.at || "…") + '</b>' + esc(n.text) +
          '<button class="ln-x" data-rmnote="' + esc(n.id) + '" aria-label="' + esc(STR.remove + " " + (n.at || "")) + '">✕</button></div></div>';
      }).join("") + '</div></div>' : '<p class="muted">' + STR.dos.lifeEmpty + '</p>') +
      '<div class="newfield"><input id="ln-at" style="flex:.5" placeholder="' + esc(STR.dos.lifeWhen) + '"><input id="ln-text" placeholder="' + esc(STR.dos.lifeText) + '">' +
      '<button class="btn" id="ln-add">' + STR.dos.lifeAdd + '</button></div></div>';
  }
  function dosFileRow(f) {
    return '<div class="file">' + (isImage(f) ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img loading="lazy" alt="" src="' + esc(f.url) + '"></a>' : '<span class="ico">' + (is3D(f) ? '🧊' : '📦') + '</span>') +
      '<a class="fname" href="' + esc(f.url) + '" target="_blank" rel="noopener" download="' + esc(f.name) + '">' + esc(f.name) + '</a><span class="muted">' + fileSize(f.size || 0) + '</span>' + polyInfo(f) +
      (isAsset(f) ? licChip(f, dos.files, "data-dlic") : '') +
      (is3D(f) ? '<button class="btn" data-dview3d="' + esc(f.id) + '">' + STR.v3d.open + '</button>' : '') +
      '<button class="btn danger" data-drmfile="' + esc(f.id) + '" aria-label="' + esc(STR.remove + " " + f.name) + '">✕</button></div>';
  }
  // Connections, derived both ways like wConnections() in wt-world.jsx (reverse links are never stored)
  var KINDS = ["characters", "locations", "events", "factions", "artifacts"];
  function entLinks(e) {
    var out = [], seen = {};
    var push = function (id, rel) {
      if (typeof id !== "string" || id === e.id || seen[id]) return;
      var o = entities.filter(function (x) { return x.id === id; })[0]; if (!o) return;
      seen[id] = 1; out.push({ e: o, rel: rel || "" });
    };
    KINDS.forEach(function (k) { (Array.isArray(e[k]) ? e[k] : []).forEach(function (id) { push(id); }); });
    (e.relations || []).forEach(function (r) { if (r) push(r.id, r.kind); });
    push(e.owner); push(e.location); push(e.faction);
    entities.forEach(function (o) {
      if (o.id === e.id) return;
      if ((Array.isArray(o[e.kind]) ? o[e.kind] : []).indexOf(e.id) >= 0) push(o.id);
      var r = (o.relations || []).filter(function (x) { return x && x.id === e.id; })[0]; if (r) push(o.id, r.kind);
      if (o.owner === e.id || o.location === e.id || o.faction === e.id) push(o.id);
    });
    return out;
  }
  function linksHtml(e) {
    var list = entLinks(e);
    if (!list.length) return '<p class="muted">' + STR.dos.noLinks + '</p>';
    return '<div class="dlinks">' + list.map(function (x) {
      var inner = '<span class="k">' + esc(STR.dos.kinds[x.e.kind] || x.e.kind) + '</span>' + esc(x.e.name || x.e.title || "") + (x.rel ? ' <i>' + esc(x.rel) + '</i>' : '');
      return dosSection(x.e.kind) || x.e.kind === "events" ? '<button class="dlink" data-dent="' + esc(x.e.id) + '">' + inner + '</button>' : '<span class="dlink">' + inner + '</span>';
    }).join("") + '</div>';
  }
  function renderDossier() {
    var e = dos, t = STR.dos.tabs[e.kind] || STR.dos.tabs.artifacts, files = e.files || [], plainPics = e.col === "lore" || e.kind === "events"; // events and culture have no game look
    var html = '<div class="field files"><label>' + (plainPics ? STR.dos.picsPlain : STR.dos.pics) + ' <span class="hint">' + (plainPics ? STR.dos.picsPlainHint : STR.dos.picsHint) + '</span></label>' + files.map(dosFileRow).join("") +
      (e.isNew ? '<p class="muted">' + STR.dos.saveFirst + '</p>' : '<label class="btn"><input type="file" multiple id="d-up" hidden>' + STR.filesAdd + '</label>') + '</div>';
    html += '<div class="field"><label for="d-desc">' + STR.dos.desc + ' <span class="canon">· ' + STR.canonField + '</span></label><textarea id="d-desc" rows="4">' + esc(ddraft.desc) + '</textarea></div>';
    if (e.col === "lore") { // culture: its group's fields, no tabs
      $("d-body").innerHTML = html + loreGroup(e.group).defs.map(function (d) {
        return '<div class="field"><label for="lf-' + d.key + '">' + esc(d.label) + '</label><textarea id="lf-' + d.key + '" data-lf="' + d.key + '" rows="4">' + esc(ddraft.fields[d.key] || "") + '</textarea></div>';
      }).join("");
      $("d-tabs").innerHTML = ""; $("d-tabs").hidden = true; return;
    }
    $("d-tabs").hidden = false;
    if (!e.isNew) html += '<div class="field" id="d-stories">' + storiesHtml(e) + '</div>';
    if (e.kind === "characters") html += lifeHtml();
    if (e.kind === "events") html = eventHtml() + html;
    var body = dtab === "links" ? linksHtml(e) : dtab === "appear" ? '<div id="d-appear"><p class="muted">' + STR.dos.loading + '</p></div>'
      : '<textarea id="d-text" data-k="' + dtab + '" rows="12" placeholder="' + esc((dtab === t[1][0] ? t[1] : t[0])[2]) + '">' + esc(ddraft.dossier[dtab] || "") + '</textarea>';
    $("d-body").innerHTML = html + '<div class="field dpanel" role="tabpanel" id="d-panel">' + body + '</div>';
    $("d-tabs").innerHTML = [t[0], ["links", STR.dos.links], t[1], ["appear", e.kind === "events" ? STR.dos.appearStories : STR.dos.appear]].map(function (x) {
      return '<button role="tab" data-dtab="' + x[0] + '" aria-selected="' + (x[0] === dtab) + '">' + esc(x[1]) + '</button>';
    }).join("");
    if (dtab === "appear") loadAppearance(e);
  }
  async function loadAppearance(e) {
    var out = "";
    try {
      var played = GAME.some(function (x) { return x.canon === e.kind; }); // events have no game section
      var inGames = e.isNew || !played ? [] : await Promise.all(games.map(function (g) {
        return wref().collection("games").doc(g.id).collection("cards").doc(e.id).get().then(function (d) { return { g: g, c: d.exists ? d.data() : {} }; });
      }));
      var uid = firebase.auth().currentUser.uid;
      var projects = e.isNew ? { docs: [] } : await db.collection("projects").where("owner", "==", uid).where("worldId", "==", worldId).get();
      var stories = await Promise.all(projects.docs.map(function (p) {
        return db.collection("projects").doc(p.id).collection("scenes").where("canonRefs." + e.kind, "array-contains", e.id).get()
          .then(function (sn) { return { title: p.data().title || p.data().name || "…", scenes: sn.docs.map(function (d) { return d.data().n; }).filter(function (n) { return n != null; }).sort(function (a, b) { return a - b; }) }; });
      }));
      stories = stories.filter(function (x) { return x.scenes.length; });
      out = !played ? "" : '<h4 class="dsub">' + STR.dos.inGames + '</h4>' + (inGames.length ? '<ul class="dappear">' + inGames.map(function (x) {
        var st = STATUS[x.c.status] || STATUS.idea;
        return '<li><b>' + esc(x.g.title) + '</b> ' + (x.c.hidden ? '<span class="muted">' + STR.dos.hiddenInGame + '</span>' : '<span class="pill ' + st.cls + '">' + esc(L(st)) + '</span>') +
          (x.c.hidden ? '' : ' <button class="btn" data-ingame="' + esc(x.g.id) + '">' + STR.dos.openInGame + '</button>') + '</li>';
      }).join("") + '</ul>' : '<p class="muted">' + STR.dos.notInGames + '</p>') +
        '<h4 class="dsub">' + STR.dos.inStories + '</h4>' + (stories.length ? '<ul class="dappear">' + stories.map(function (x) {
          return '<li><b>' + esc(x.title) + '</b> <span class="muted">· ' + STR.dos.scenes + ' ' + x.scenes.join(", ") + '</span></li>'; }).join("") + '</ul>' : '<p class="muted">' + STR.dos.notInStories + '</p>');
      if (!e.isNew) { var scenes = await worldScenes(); out += stateHtml(stateRows(scenes, e)) + impactHtml(affectedScenes(scenes, e)); }
    } catch (er) { out = '<p class="muted">' + STR.failed + ': ' + esc(er.code || er.message || er) + '</p>'; }
    if (dos === e && dtab === "appear" && $("d-appear")) $("d-appear").innerHTML = out;
  }
  async function uploadEntityFiles(list) {
    var e = dos, done = 0;
    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      if (file.size > MAX_FILE) { dmsg(STR.fileTooBig + ": " + file.name); continue; }
      var id = newId("file"), path = "worlds/" + worldId + "/files/" + e.id + "/" + id + "-" + file.name.replace(/[\/\\#?\[\]*]/g, "_");
      try {
        var task = firebase.storage().ref(path).put(file, { contentType: file.type || "application/octet-stream" });
        task.on("state_changed", function (sn) { if (dos === e) dmsg(STR.uploading + " " + file.name + " · " + Math.round(100 * sn.bytesTransferred / (sn.totalBytes || 1)) + "%"); });
        await task;
        var meta = { id: id, name: file.name, path: path, url: await task.snapshot.ref.getDownloadURL(), size: file.size, type: file.type || "", uploadedAt: Date.now() };
        await localInfo(file, meta);
        await colOf(e).doc(e.id).set({ files: firebase.firestore.FieldValue.arrayUnion(meta), updatedAt: stamp() }, { merge: true });
        e.files = (e.files || []).concat([meta]); done++;
      } catch (er) { dmsg(STR.failed + ": " + file.name + " — " + (er.code || er.message || er)); return; }
    }
    if (dos === e) { dcollect(); renderDossier(); dmsg(STR.filesDone + ": " + done); }
  }
  async function removeEntityFile(id) {
    var e = dos, f = (e.files || []).filter(function (x) { return x.id === id; })[0];
    if (!f || !confirm(STR.confirmFile + " " + f.name + "?")) return;
    try {
      await firebase.storage().ref(f.path).delete().catch(function (er) { if (er.code !== "storage/object-not-found") throw er; });
      await colOf(e).doc(e.id).set({ files: firebase.firestore.FieldValue.arrayRemove(f), updatedAt: stamp() }, { merge: true });
      e.files = e.files.filter(function (x) { return x.id !== id; });
      if (dos === e) { dcollect(); renderDossier(); }
    } catch (er) { dmsg(STR.failed + ": " + (er.code || er.message || er)); }
  }
  function colOf(e) { return wref().collection(e.col === "lore" ? "lore" : "entities"); }
  async function saveDossier() {
    if (!dos) return;
    dcollect();
    if (dos.col === "lore") {
      var lb = { group: dos.group, name: ddraft.name.trim() || dos.name || STR.newCard, desc: ddraft.desc, fields: ddraft.fields, updatedAt: stamp() };
      if (dos.isNew) lb.createdAt = stamp();
      dmsg(STR.saving);
      try { await colOf(dos).doc(dos.id).set(lb, { merge: true }); closeDossier(); } catch (er) { dmsg(STR.failed + ": " + (er.code || er.message || er)); }
      return;
    }
    var e = dos, name = ddraft.name.trim() || e.name || e.title || STR.newCard, body = { dossier: ddraft.dossier, updatedAt: stamp() };
    if (e.kind === "characters") body.lifeNotes = ddraft.lifeNotes;
    if (e.isNew) Object.assign(body, { id: e.id, kind: e.kind, createdAt: stamp(), origin: { source: "explicit", confidence: null, confirmed: true, createdBy: "user" } });
    if (e.isNew && e.group) body.group = e.group; // the subsection it was added in
    if (e.isNew || name !== (e.name || e.title || "")) { body[(e.title !== undefined && e.name === undefined) || (e.isNew && e.kind === "events") ? "title" : "name"] = name; body.slug = slugify(name); }
    if (e.kind === "events") Object.assign(body, { at: num(ddraft.at), dur: num(ddraft.dur), when: ddraft.when.trim(), characters: ddraft.who });
    if (e.isNew || ddraft.desc !== (e[descKeyOf(e)] || "")) body[descKeyOf(e)] = ddraft.desc;
    dmsg(STR.saving);
    try { await wref().collection("entities").doc(e.id).set(body, { merge: true }); closeDossier(); }
    catch (er) { dmsg(STR.failed + ": " + (er.code || er.message || er)); }
  }
  async function deleteLore() {
    var e = dos; if (!e || e.col !== "lore" || !confirm(STR.cult.delQ)) return;
    await Promise.all((e.files || []).map(function (f) { return firebase.storage().ref(f.path).delete().catch(function () {}); }));
    await colOf(e).doc(e.id).delete();
    closeDossier();
  }
  function renderCulture(s) {
    var html = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div>' +
      '<div class="row"><button class="btn primary" id="add-top">' + STR.sub.add + '</button></div></header>';
    html += subsHtml(s, lore, function (x) { return x.group || "customs"; }, function (l) { return '<div class="grid">' + l.map(dosCardHtml).join("") + '</div>'; },
      function (g) { return L(loreGroup(g)); });
    $("view").innerHTML = html;
    $("add-top").onclick = newSubsection;
  }
  // ---------- Космологія: the Космограф (app/cosmograph/), paid per world for 30 days (functions/src/cosmograph.js) ----------
  var COSMO_COST = 2000, COSMO_FN = "https://us-central1-whitewrite-app.cloudfunctions.net/cosmographAccess", cosmo = null; // cosmo: { api, el }
  function cosmoState() {
    var c = (world && world.cosmograph) || {}, until = c.paidUntil && c.paidUntil.toMillis ? c.paidUntil.toMillis() : 0;
    return { enabled: !!c.enabled, until: until, paid: until > Date.now() };
  }
  async function callCosmo(op) {
    var token = await firebase.auth().currentUser.getIdToken();
    var r = await fetch(COSMO_FN, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token }, body: JSON.stringify({ worldId: worldId, op: op }) });
    var data = await r.json().catch(function () { return { error: "HTTP " + r.status }; });
    if (!r.ok) throw new Error(data.error || "HTTP " + r.status);
    return data;
  }
  function renderCosmology(s) {
    var st = cosmoState();
    var head = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div></header>';
    if (!(st.enabled && st.paid)) {
      if (cosmo) { cosmo.api.destroy(); cosmo = null; }
      $("view").innerHTML = head + '<div class="canonbox cosmo-off"><h4>' + (st.enabled ? STR.cosmo.expired : STR.cosmo.off) + '</h4><p>' + (st.enabled ? STR.cosmo.expiredText : STR.cosmo.offText) + '</p>' +
        '<div class="row">' + (st.enabled ? '<button class="btn primary" id="cg-renew">' + STR.cosmo.renew + costMark("cosmograph") + '</button>' : '<button class="btn" id="cg-settings">' + STR.cosmo.toSettings + '</button>') + '</div>' +
        '<p class="hint" id="cg-msg"></p></div>';
      var go = $("cg-settings"); if (go) go.onclick = function () { section = "settings"; render(); };
      var rn = $("cg-renew"); if (rn) rn.onclick = function () { confirmCost("cosmograph", function () { rn.disabled = true; callCosmo("enable").catch(function (er) { $("cg-msg").textContent = STR.failed + ": " + er.message; rn.disabled = false; }); }); };
      return;
    }
    $("view").innerHTML = head + '<div class="cosmo-host" id="cg-slot"></div>';
    if (cosmo) { $("cg-slot").replaceWith(cosmo.el); return; } // keep the running sky through re-renders
    var el = document.createElement("div"); el.className = "cosmo-host"; $("cg-slot").replaceWith(el);
    cosmo = { el: el, api: null };
    var mine = cosmo;
    import("./cosmograph/cosmograph.js").then(function (m) {
      if (cosmo !== mine) return;
      mine.api = m.mountCosmograph(el, { config: world.cosmos || null, lang: LANG, canEdit: canWrite,
        onSave: function (cfg) { return wref().update({ cosmos: cfg, updatedAt: stamp() }); },
        onUploadMap: async function (file) {
          if (file.size > MAX_FILE) throw new Error(STR.fileTooBig);
          var path = "worlds/" + worldId + "/files/cosmos/" + newId("map") + "-" + file.name.replace(/[\/\\#?\[\]*]/g, "_");
          var task = firebase.storage().ref(path).put(file, { contentType: file.type || "image/jpeg" });
          await task; return task.snapshot.ref.getDownloadURL();
        } });
    }).catch(function (er) { el.innerHTML = '<p class="muted">' + STR.failed + ': ' + esc(er.message || er) + '</p>'; });
  }
  function cosmoSettingsHtml() {
    var st = cosmoState(), d = st.until ? new Date(st.until).toLocaleDateString(LANG === "en" ? "en-GB" : "uk-UA") : "";
    var text = st.enabled && st.paid ? STR.cosmo.setOn.replace("{d}", d) : st.paid ? STR.cosmo.setPaidOff.replace("{d}", d) : STR.cosmo.setOff.replace("{n}", COSMO_COST);
    return '<section class="setbox"><h2>' + STR.cosmo.setTitle + '</h2><p class="hint">' + esc(text) + '</p><div class="setrow">' +
      (st.enabled && st.paid ? '<button class="btn" id="st-cg-off">' + STR.cosmo.disable + '</button>'
        : '<button class="btn primary" id="st-cg-on">' + STR.cosmo.enable + (st.paid ? '' : costMark("cosmograph")) + '</button>') + '</div><p class="hint" id="st-cg-msg"></p></section>';
  }
  function bindCosmoSettings() {
    var say = function (t) { $("st-cg-msg").textContent = t; };
    var on = $("st-cg-on"), off = $("st-cg-off");
    if (on) on.onclick = function () {
      var run = function () { on.disabled = true; callCosmo("enable").catch(function (er) { say(STR.failed + ": " + er.message); on.disabled = false; }); };
      if (cosmoState().paid) run(); else confirmCost("cosmograph", run);
    };
    if (off) off.onclick = function () { off.disabled = true; callCosmo("disable").catch(function (er) { say(STR.failed + ": " + er.message); off.disabled = false; }); };
  }
  function switchDossier(id) {
    dcollect();
    if (JSON.stringify(ddraft) !== dfirst && !confirm(STR.dos.unsaved)) return;
    openDossier(entities.filter(function (x) { return x.id === id; })[0]);
  }
  $("d-tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-dtab]"); if (!b || !dos) return;
    dcollect(); dtab = b.dataset.dtab; renderDossier();
    var p = $("d-panel"); if (p) p.scrollIntoView({ block: "nearest" });
  });
  $("d-body").addEventListener("click", function (e) {
    var l = e.target.closest("[data-dent]"); if (l) { switchDossier(l.dataset.dent); return; }
    if (e.target.closest("#d-story")) { newStoryDialog(dos); return; }
    if (e.target.closest("#d-recon")) { var re = dos; worldScenes().then(function (sc) { reconDialog(re, affectedScenes(sc, re)); }); return; }
    var ds = e.target.closest("[data-story]"); if (ds) { tellShell({ type: "ww-open-story", projectId: ds.dataset.story }); return; }
    var rm = e.target.closest("[data-drmfile]"); if (rm) { removeEntityFile(rm.dataset.drmfile); return; }
    var v3 = e.target.closest("[data-dview3d]"); if (v3) { view3d(dos.files.filter(function (f) { return f.id === v3.dataset.dview3d; })[0], dos.files); return; }
    var dl = e.target.closest("[data-dlic]");
    if (dl) {
      var de = dos, df = de.files.filter(function (f) { return f.id === dl.dataset.dlic; })[0];
      licDialog(df, de.files, function (lic) {
        setFileLicense(colOf(de).doc(de.id), df.id, lic).then(function (files) { de.files = files; if (dos === de) { dcollect(); renderDossier(); } })
          .catch(function (er) { dmsg(STR.failed + ": " + (er.code || er.message)); });
      });
      return;
    }
    var wh = e.target.closest("[data-who]");
    if (wh) { dcollect(); var wi = ddraft.who.indexOf(wh.dataset.who); if (wi >= 0) ddraft.who.splice(wi, 1); else ddraft.who.push(wh.dataset.who); renderDossier(); return; }
    var rn = e.target.closest("[data-rmnote]");
    if (rn) { dcollect(); ddraft.lifeNotes = ddraft.lifeNotes.filter(function (n) { return n.id !== rn.dataset.rmnote; }); renderDossier(); return; }
    if (e.target.id === "ln-add") {
      var at = $("ln-at").value.trim(), tx = $("ln-text").value.trim(); if (!at && !tx) { $("ln-at").focus(); return; }
      dcollect(); ddraft.lifeNotes.push({ id: newId("ln"), at: at, text: tx }); renderDossier(); $("ln-at").focus(); return;
    }
    var ig = e.target.closest("[data-ingame]");
    if (ig) {
      var ent = dos, gs = GAME.filter(function (x) { return x.canon === ent.kind; })[0];
      closeDossier();
      if (ig.dataset.ingame !== gameId) selectGame(ig.dataset.ingame);
      section = gs ? gs.id : "overview"; render();
      var c = allCards().filter(function (x) { return x.key === "e:" + ent.id; })[0];
      if (c && cards.length) openCard(c);
    }
  });
  $("d-body").addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.target.id === "ln-at" || e.target.id === "ln-text")) { e.preventDefault(); $("ln-add").click(); } });
  $("d-body").addEventListener("change", function (e) {
    if (e.target.id === "d-up" && e.target.files.length) { var list = [].slice.call(e.target.files); e.target.value = ""; uploadEntityFiles(list); }
  });

  // ---------- Історія і хроніка: events as comets over the time line (tail = duration, a star = a moment), stories of the world ----------
  // ---------- stories of the world (projects with worldId), live; each may be about canon entities and has a reveal mark ----------
  var stories = []; // projects/{p} { title, subjects: [entityId], reveal: open|later|internal, revealNote }
  var REVEALS = ["open", "later", "internal"];
  function revealChip(p) {
    var r = REVEALS.indexOf(p.reveal) >= 0 ? p.reveal : "open";
    return '<span class="rv rv-' + r + '" title="' + esc(p.revealNote || STR.story.revealHint[r]) + '">' + esc(STR.story.reveals[r]) + '</span>';
  }
  function storiesHtml(e) {
    var list = stories.filter(function (p) { return (p.subjects || []).indexOf(e.id) >= 0; });
    return '<label>' + STR.story.title + ' <button class="btn mini" id="d-story" type="button">' + STR.story.add + '</button></label>' +
      (list.length ? '<div class="dstories">' + list.map(function (p) {
        return '<div class="dstory">' + revealChip(p) + '<b>' + esc(p.title || "…") + '</b><span style="flex:1"></span><button class="btn" data-story="' + esc(p.id) + '">' + STR.story.open + '</button></div>';
      }).join("") + '</div>' : '<p class="muted">' + STR.story.none + '</p>');
  }
  // «＋ Історія»: a title and its reveal mark, then the shell opens the book (the mage ritual) straight into the writing sheet
  function newStoryDialog(e) {
    var box = document.createElement("div");
    box.className = "ask";
    box.innerHTML = '<form class="ask-box story-box" role="dialog" aria-modal="true" aria-label="' + esc(STR.story.newTitle) + '"><h3>' + esc(STR.story.newTitle) + '</h3>' +
      '<input id="ns-title" autocomplete="off" placeholder="' + esc(STR.story.titlePh) + '" value="' + esc(e.name || e.title || "") + '">' +
      '<fieldset class="rvpick"><legend>' + STR.story.reveal + '</legend>' + REVEALS.map(function (r, i) {
        return '<label class="rvopt"><input type="radio" name="rv" value="' + r + '"' + (i ? '' : ' checked') + '><span class="rv rv-' + r + '">' + esc(STR.story.reveals[r]) + '</span><i>' + esc(STR.story.revealHint[r]) + '</i></label>';
      }).join("") + '</fieldset>' +
      '<input id="ns-when" autocomplete="off" hidden placeholder="' + esc(STR.story.revealNotePh) + '" aria-label="' + esc(STR.story.revealNote) + '">' +
      '<div class="row"><button type="button" class="btn" id="ask-x">' + STR.cancel + '</button><button class="btn primary" id="ns-go">✎ ' + STR.story.write + '</button></div></form>';
    document.body.appendChild(box);
    var close = function () { box.remove(); };
    box.querySelector("#ask-x").onclick = close;
    box.addEventListener("mousedown", function (ev) { if (ev.target === box) close(); });
    box.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); close(); } });
    box.addEventListener("change", function () { box.querySelector("#ns-when").hidden = box.querySelector('input[name="rv"]:checked').value !== "later"; });
    box.querySelector("form").onsubmit = function (ev) {
      ev.preventDefault();
      var title = box.querySelector("#ns-title").value.trim(); if (!title) { box.querySelector("#ns-title").focus(); return; }
      var rv = box.querySelector('input[name="rv"]:checked').value;
      tellShell({ type: "ww-write-story", worldId: worldId, title: title, subjects: [e.id], reveal: rv, revealNote: rv === "later" ? box.querySelector("#ns-when").value.trim() : "" });
      close();
    };
    var t = box.querySelector("#ns-title"); t.focus(); t.select();
  }
  function niceStep(span) { var raw = span / 8, p = Math.pow(10, Math.floor(Math.log10(raw || 1))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function cometsHtml(list) {
    var lo = Infinity, hi = -Infinity;
    list.forEach(function (e) { lo = Math.min(lo, e.at); hi = Math.max(hi, e.at + e.dur); });
    var span = hi - lo || 1, W = Math.max(($("view").clientWidth || 900) - 20, list.length * 190), ppu = (W - 200) / span;
    var x = function (t) { return 100 + (t - lo) * ppu; }, lanes = [], LH = 112;
    var items = list.map(function (e) {
      var x0 = x(e.at), hx = x(e.at + e.dur), lane = 0;
      while (lanes[lane] !== undefined && lanes[lane] > Math.min(x0, hx - 80)) lane++;
      lanes[lane] = hx + 80;
      return { e: e, x0: x0, hx: hx, lane: lane };
    });
    var H = lanes.length * LH + 56, axisY = H - 34, html = '';
    items.forEach(function (it) {
      var e = it.e, y = axisY - 40 - it.lane * LH - 22, tail = it.hx - it.x0, star = !(e.dur > 0) || tail < 6;
      var who = (Array.isArray(e.characters) ? e.characters : []).map(function (id) { return entities.filter(function (c) { return c.id === id; })[0]; }).filter(Boolean);
      html += '<span class="span" style="left:' + it.x0 + 'px;width:' + Math.max(2, tail) + 'px;top:' + (axisY - 2) + 'px"></span>';
      html += '<button class="comet' + (star ? ' star' : '') + '" data-ent="' + esc(e.id) + '" style="left:' + it.hx + 'px;top:' + y + 'px" title="' + esc((e.title || e.name || "") + (e.when ? " · " + e.when : "")) + '">' +
        (star ? '' : '<span class="tail" style="width:' + tail + 'px"></span>') + '<span class="head"></span>' +
        who.slice(0, 6).map(function (c, i) { var a = (-160 + i * 28) * Math.PI / 180; // participants in an arc above the head
          return '<span class="who" style="transform:translate(' + Math.round(Math.cos(a) * 30) + 'px,' + Math.round(Math.sin(a) * 30) + 'px)" title="' + esc(c.name || "") + '">' + avatar(c) + '</span>'; }).join("") +
        '<span class="lbl"><b>' + esc(e.title || e.name || "") + '</b>' + (e.when ? '<i>' + esc(e.when) + '</i>' : '') + '</span></button>';
    });
    var step = niceStep(span), ticks = '';
    for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks += '<span class="tick" style="left:' + x(t) + 'px;top:' + axisY + 'px">' + esc(String(+t.toFixed(6))) + '</span>';
    return '<div class="chron"><div class="chron-track" style="width:' + W + 'px;height:' + H + 'px"><span class="axis" style="top:' + axisY + 'px"></span>' + ticks + html +
      '<span class="unit" style="top:' + (axisY + 14) + 'px">' + esc((world && world.timeUnit) || STR.chron.unitPh) + '</span></div></div>';
  }
  function renderChronicle(s) {
    var evs = entities.filter(function (e) { return e.kind === "events"; }).map(function (e) { return Object.assign({}, e, { at: num(e.at), dur: Math.max(0, num(e.dur) || 0) }); });
    var dated = evs.filter(function (e) { return e.at !== null; });
    var html = '<header class="sec"><div><h1>' + esc(L(s)) + '</h1><p>' + esc(L(s.about)) + '</p></div>' +
      '<div class="row"><label class="unitbox">' + STR.chron.unit + ' <input id="ch-unit" value="' + esc((world && world.timeUnit) || "") + '" placeholder="' + esc(STR.chron.unitPh) + '"></label>' +
      '<button class="btn primary" id="add-top">' + STR.sub.add + '</button></div></header>';
    html += '<p class="muted">' + (dated.length ? STR.chron.legend : STR.chron.empty) + '</p>';
    // each subsection (an era, a war, a line of the story…) is its own time line
    html += subsHtml(s, evs, function (e) { return e.group; }, function (l) {
      var d = l.filter(function (e) { return e.at !== null; }).sort(function (a, b) { return a.at - b.at; }), u = l.filter(function (e) { return e.at === null; });
      return (d.length ? cometsHtml(d) : '') + (u.length ? '<p class="muted">' + STR.chron.undated + ':</p><div class="grid">' + u.map(dosCardHtml).join("") + '</div>' : '');
    });
    html += '<h2 class="group">' + STR.chron.stories + '<button class="btn mini" id="ch-newstory">' + STR.sub.story + '</button></h2><div id="ch-stories"></div>';
    $("view").innerHTML = html;
    $("add-top").onclick = newSubsection;
    $("ch-newstory").onclick = function () { tellShell({ type: "ww-new-story", worldId: worldId }); };
    $("ch-unit").onchange = function (e) { wref().set({ timeUnit: e.target.value.trim() }, { merge: true }); };
    $("ch-stories").innerHTML = stories.length ? '<div class="grid">' + stories.map(function (p) {
      var about = (p.subjects || []).map(function (id) { return entities.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
      return '<div class="card story"><h3>' + esc(p.title || p.name || "…") + '</h3>' + (p.meta ? '<p class="sub">' + esc(p.meta) + '</p>' : '') +
        (about.length ? '<div class="who-row">' + about.map(function (x) { return '<button class="dlink" data-ent="' + esc(x.id) + '">' + avatar(x) + esc(x.name || x.title || "") + '</button>'; }).join("") + '</div>' : '') +
        '<p class="ex">' + esc(plain(p.desc || p.description)) + '</p><div class="row"><select data-reveal="' + esc(p.id) + '" aria-label="' + esc(STR.story.revealAria) + '">' +
        REVEALS.map(function (r) { return '<option value="' + r + '"' + ((p.reveal || "open") === r ? " selected" : "") + '>' + esc(STR.story.reveals[r]) + '</option>'; }).join("") + '</select>' +
        '<span style="flex:1"></span><button class="btn" data-story="' + esc(p.id) + '">' + STR.chron.openStory + '</button></div></div>';
    }).join("") + '</div>' : '<p class="muted">' + STR.chron.noStories + '</p>';
  }

  function renderGameLocked() {
    $("view").innerHTML = '<div class="newgame"><h1>' + esc(STR.wt.gameLocked) + '</h1><p class="muted">' + esc(STR.wt.gameLockedText) + '</p>' +
      '<div class="row"><button class="btn primary" id="up">' + STR.upgrade + '</button></div></div>';
    $("up").onclick = function () { try { window.parent.document.getElementById("userdock").click(); } catch (e) {} };
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
      await wref().collection("games").doc(id).set({ title: title, engine: { profile: $("ng-engine").value }, sections: [], canonOptIn: true, createdAt: stamp(), updatedAt: stamp() });
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
    draft = { title: c.title, status: c.status, note: c.note, fields: Object.assign({}, c.fields), defs: c.defs.map(function (d) { return Object.assign({}, d); }),
      canonDesc: c.canonDesc ? c.canonDesc.value : null, defsFull: !!c.defsFull };
    setEditMode(false);
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
    html += filesHtml();
    if (draft.canonDesc !== null) html += fieldHtml("__canon", LANG === "en" ? "Description" : "Опис", draft.canonDesc, ' <span class="canon">· ' + STR.canonField + '</span>');
    var gk = groupKey(sec(open.section)); // the subsection: set by the «＋ Додати» it was added under
    draft.defs.forEach(function (d) { if (d.key !== gk) html += defHtml(d); });
    html += '<div class="field"><label for="nf">' + STR.addField + '</label><div class="newfield"><input id="nf" placeholder="' + esc(STR.addFieldPh) + '">' +
      typeSelect("nf-type", "text") + '<button class="btn" id="nf-add">' + STR.add + '</button></div></div>';
    $("e-body").innerHTML = html;
  }
  var FTYPES = ["text", "table", "image", "file"];
  function typeSelect(id, cur, key) {
    return '<select ' + (id ? 'id="' + id + '"' : 'data-ftype="' + esc(key) + '"') + ' aria-label="' + esc(STR.fieldType) + '">' +
      FTYPES.map(function (t) { return '<option value="' + t + '"' + (t === cur ? " selected" : "") + '>' + esc(STR.ftypes[t]) + '</option>'; }).join("") + '</select>';
  }
  // One field of the card: its head (a label, or name/type/✕ in editing mode) and its value by type.
  function defHtml(d) {
    var type = d.type || "text", v = draft.fields[d.key] || "";
    var head = editMode
      ? '<div class="fhead"><input class="flabel" data-flabel="' + esc(d.key) + '" value="' + esc(d.label) + '" aria-label="' + esc(STR.fieldLabel) + '">' +
        typeSelect(null, type, d.key) + '<button class="fdel" data-delfield="' + esc(d.key) + '" title="' + esc(STR.fieldDel) + '" aria-label="' + esc(STR.fieldDel + " " + d.label) + '">✕</button></div>'
      : '<label>' + esc(d.label) + '</label>';
    var body = type === "table" ? tableHtml(d.key, v)
      : type === "image" || type === "file" ? fieldFilesHtml(d.key, type)
      : '<div class="shown' + (v ? "" : " blank") + '" tabindex="0" role="button" data-edit="' + esc(d.key) + '">' + (v ? md(v) : STR.blank) + '</div>';
    return '<div class="field' + (editMode ? " editing" : "") + '" data-field="' + esc(d.key) + '">' + head + body + '</div>';
  }
  // Tables are kept as Markdown tables in the field, so AI, MCP and exports read them as text.
  function parseTable(v) {
    var lines = String(v || "").split("\n").filter(function (l) { return /^\s*\|/.test(l); });
    var rows = lines.filter(function (l, i) { return !(i === 1 && /^[\s|:-]+$/.test(l)); })
      .map(function (l) { return l.trim().replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); }); });
    if (!rows.length) rows = [[STR.col + " 1", STR.col + " 2"], [String(v || "").trim(), ""]];
    var w = Math.max.apply(null, rows.map(function (r) { return r.length; }));
    return rows.map(function (r) { while (r.length < w) r.push(""); return r; });
  }
  function tableMd(rows) {
    var cell = function (c) { return String(c || "").replace(/\|/g, "/").replace(/\n/g, " "); };
    return rows.map(function (r, i) { return "| " + r.map(cell).join(" | ") + " |" + (i === 0 ? "\n|" + r.map(function () { return "---"; }).join("|") + "|" : ""); }).join("\n");
  }
  function tableHtml(key, v) {
    var rows = parseTable(v);
    return '<div class="tbl" data-tbl="' + esc(key) + '"><table>' + rows.map(function (r, i) {
      return '<tr>' + r.map(function (c, j) { return '<td><input data-cell="' + i + ',' + j + '" value="' + esc(c) + '"></td>'; }).join("") +
        '<td class="tx">' + (i ? '<button data-rmrow="' + i + '" title="' + esc(STR.rmRow) + '" aria-label="' + esc(STR.rmRow) + '">✕</button>' : '') + '</td></tr>';
    }).join("") + (rows[0].length > 1 ? '<tr>' + rows[0].map(function (c, j) { return '<td class="tx"><button class="rmcol" data-rmcol="' + j + '" title="' + esc(STR.rmCol) + '" aria-label="' + esc(STR.rmCol) + '">✕</button></td>'; }).join("") + '</tr>' : '') +
      '</table><div class="row"><button class="btn" data-addrow>' + STR.addRow + '</button><button class="btn" data-addcol>' + STR.addCol + '</button></div></div>';
  }
  function readTable(box) {
    var rows = [];
    [].forEach.call(box.querySelectorAll("[data-cell]"), function (inp) { var ij = inp.dataset.cell.split(","); (rows[ij[0]] = rows[ij[0]] || [])[ij[1]] = inp.value; });
    return rows;
  }
  function fieldFilesHtml(key, type) {
    var files = (open.files || []).filter(function (f) { return f.field === key; });
    var list = type === "image"
      ? '<div class="fimgs">' + files.map(function (f) { return '<div class="fimg"><a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img loading="lazy" alt="' + esc(f.name) + '" src="' + esc(f.url) + '"></a>' +
          (canWrite ? '<button class="btn danger" data-rmfile="' + esc(f.id) + '" aria-label="' + esc(STR.remove + " " + f.name) + '">✕</button>' : '') + '</div>'; }).join("") + '</div>'
      : files.map(fileRow).join("");
    var add = !canWrite ? "" : open.isNew ? '<p class="muted">' + STR.filesSaveFirst + '</p>'
      : '<label class="btn"><input type="file" multiple hidden data-fup="' + esc(key) + '"' + (type === "image" ? ' accept="image/*"' : '') + '>' + (type === "image" ? STR.imagesAdd : STR.filesAdd) + '</label>';
    return '<div class="field files">' + list + add + '</div>';
  }
  function setEditMode(on) {
    editMode = !!on;
    var b = $("e-edit"); b.setAttribute("aria-pressed", String(editMode));
    b.title = editMode ? STR.editOn : STR.editFields; b.setAttribute("aria-label", b.title);
  }
  // Structure changes (names, types, deleted fields) are written at once, so closing the card or reloading keeps them.
  async function saveStructure(removed) {
    if (!open || open.isNew) return;
    var body = { defs: draft.defs, updatedAt: stamp() };
    if (open.src === "canon") { draft.defsFull = true; Object.assign(body, { section: open.section, canonRef: open.id, defsFull: true }); }
    if (removed && removed.length) { body.fields = {}; removed.forEach(function (k) { body.fields[k] = firebase.firestore.FieldValue.delete(); }); }
    try { await gref().collection("cards").doc(open.id).set(body, { merge: true }); } catch (e) { msg(STR.failed + ": " + (e.code || e.message || e)); }
  }
  function flushLabels() {
    if (!open || !editMode) return false;
    var changed = false;
    [].forEach.call(document.querySelectorAll("#e-body [data-flabel]"), function (inp) {
      var d = draft.defs.filter(function (x) { return x.key === inp.dataset.flabel; })[0], t = inp.value.trim();
      if (d && t && t !== d.label) { d.label = t; changed = true; }
    });
    if (changed) saveStructure();
    return changed;
  }
  async function deleteField(key) {
    [].forEach.call(document.querySelectorAll("#e-body textarea"), collect);
    flushLabels();
    draft.defs = draft.defs.filter(function (d) { return d.key !== key; });
    delete draft.fields[key];
    renderFields();
    await saveStructure([key]);
    // files that lived in this field go with it
    var gone = (open.files || []).filter(function (f) { return f.field === key; });
    for (var f of gone) {
      await firebase.storage().ref(f.path).delete().catch(function () {});
      await gref().collection("cards").doc(open.id).set({ files: firebase.firestore.FieldValue.arrayRemove(f) }, { merge: true });
    }
    if (gone.length) open.files = open.files.filter(function (f) { return f.field !== key; });
  }
  // ---------- files on a card: prefabs, models, images… (Storage: worlds/{w}/games/{g}/files/{cardId}/…) ----------
  var MAX_FILE = 200 * 1024 * 1024;
  var MODEL_EXT = /\.(glb|gltf|fbx|obj|stl)$/i; // keep in sync with gb-3d.js
  function is3D(f) { return MODEL_EXT.test(f.name || ""); }
  // ---------- polygon budget: a model over 100 000 polygons (triangles) carries a small red mark (file.tris, counted once) ----------
  var POLY_MAX = 100000, polyTried = {}, polyBusy = false;
  function heavy(f) { return is3D(f) && f.tris > POLY_MAX; }
  function polyMark(f) { var t = STR.poly.tip.replace("{n}", f.tris.toLocaleString()); return '<span class="poly-warn" title="' + esc(t) + '" aria-label="' + esc(t) + '">!</span>'; }
  function polyInfo(f) { return is3D(f) && f.tris != null ? '<span class="muted">' + f.tris.toLocaleString() + ' ' + STR.poly.n + '</span>' + (heavy(f) ? polyMark(f) : '') : ''; }
  function modelInfo(f, siblings) { return import("./gb-3d.js").then(function (m) { return m.modelInfo(f, siblings); }); }
  // Read from the local file before the upload — nothing to download: a model's polygons and rights, a licence/readme text's licence.
  async function localInfo(file, meta) {
    if (isLicText(file)) { try { var t = await file.text(); meta.licenseFound = licenseIn(t); } catch (e) {} return; }
    if (!MODEL_EXT.test(file.name)) return;
    var url = URL.createObjectURL(file);
    try { var info = await modelInfo({ name: file.name, url: url }, []); meta.tris = info.tris; if (info.rights) meta.license = rightsLicense(info.rights); }
    catch (e) {} finally { URL.revokeObjectURL(url); }
  }

  // ---------- licence & rights of prefabs and models: green (commercial OK) · yellow (with conditions) · red (not allowed / unknown) ----------
  // file.license { id, source: file|author, text, by, url } on the file itself; a licence/readme text on the same card carries licenseFound { id, text }.
  var LIC_COLOR = { own: "green", cc0: "green", royalty: "green", unity: "green", ccby: "yellow", ccbysa: "yellow", ccbynd: "yellow",
    ccbync: "red", editorial: "red", personal: "red", unknown: "red" };
  var ASSET_EXT = /\.(glb|gltf|fbx|obj|stl|prefab|unitypackage|uasset|blend|max|ma|mb|c4d|3ds|dae|usdz?|zip|rar|7z)$/i;
  function isAsset(f) { return ASSET_EXT.test(f.name || ""); }
  function isLicText(f) { return /(licen[cs]e|copyright|attribution|readme|credits?)[^\/]*\.(txt|md)$/i.test(f.name || "") && (f.size || 0) < 200000; }
  function licenseIn(text) { // the licence a text names, most restrictive first
    var t = String(text || "").toLowerCase(), id = null;
    if (/by-nc|\bnc\b|non-?commercial|некомерц/.test(t)) id = "ccbync";
    else if (/editorial/.test(t)) id = "editorial";
    else if (/personal use only|personal use|особист/.test(t)) id = "personal";
    else if (/cc0|cc-zero|publicdomain\/zero|public domain|суспільн/.test(t)) id = "cc0";
    else if (/by-sa|sharealike|share-alike|share alike/.test(t)) id = "ccbysa";
    else if (/by-nd|noderiv|no derivatives/.test(t)) id = "ccbynd";
    else if (/cc[- ]by|licenses\/by\/|creative commons attribution/.test(t)) id = "ccby";
    else if (/unity asset store|asset store terms|standard unity/.test(t)) id = "unity";
    else if (/royalty[- ]free/.test(t)) id = "royalty";
    return id ? { id: id, text: String(text).trim().slice(0, 600) } : null;
  }
  function rightsLicense(rights) { var l = licenseIn(rights); return { id: l ? l.id : "", source: "file", text: rights }; }
  function licOf(f, files) {
    if (f.license && f.license.id) return f.license;
    var t = (files || []).filter(function (x) { return x.licenseFound && x.licenseFound.id; })[0];
    if (t) return { id: t.licenseFound.id, source: "text", from: t.name, text: t.licenseFound.text };
    return { id: "unknown", source: f.license && f.license.text ? "file" : "none", text: f.license && f.license.text };
  }
  function licChip(f, files, attr) {
    var l = licOf(f, files), c = LIC_COLOR[l.id] || "red", t = STR.lic[c] + " · " + STR.lic.names[l.id];
    return '<' + (attr ? 'button type="button" ' + attr + '="' + esc(f.id) + '"' : 'span') + ' class="lic lic-' + c + '" title="' + esc(attr ? STR.lic.info + " — " + t : t) + '" aria-label="' + esc(t) + '">© ' +
      esc(STR.lic.short[l.id]) + (attr ? ' <i>ⓘ</i>' : '') + '</' + (attr ? 'button' : 'span') + '>';
  }
  function worstLic(files) { // the card shows its least permissive asset
    var rank = { red: 0, yellow: 1, green: 2 }, worst = null;
    (files || []).filter(isAsset).forEach(function (f) { var c = LIC_COLOR[licOf(f, files).id] || "red"; if (!worst || rank[c] < rank[worst.c]) worst = { f: f, c: c }; });
    return worst ? licChip(worst.f, files) : "";
  }
  // ⓘ: what the licence allows, where it came from, and the author's own answer
  function licDialog(f, files, save) {
    var l = licOf(f, files), c = LIC_COLOR[l.id] || "red", box = document.createElement("div");
    box.className = "ask";
    box.innerHTML = '<form class="ask-box lic-box" role="dialog" aria-modal="true" aria-label="' + esc(STR.lic.title) + '">' +
      '<div class="lic-head lic-' + c + '"><b>' + esc(STR.lic[c]) + '</b><span>' + esc(STR.lic.names[l.id]) + '</span></div>' +
      '<h3>' + esc(f.name) + '</h3><p>' + esc(STR.lic.what[l.id]) + '</p>' +
      '<p class="muted">' + esc(STR.lic.src[l.source] ? STR.lic.src[l.source].replace("{f}", l.from || "") : STR.lic.src.none) + '</p>' +
      (l.text ? '<div class="lic-text"><span class="muted">' + STR.lic.found + '</span><q>' + esc(l.text) + '</q></div>' : '') +
      (l.by || l.url ? '<p>' + esc(l.by || "") + (l.url ? ' · <a href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.url) + '</a>' : '') + '</p>' : '') +
      (canWrite ? '<label class="field"><span>' + STR.lic.pick + '</span><select id="lic-id">' + Object.keys(LIC_COLOR).map(function (k) {
          return '<option value="' + k + '"' + (k === l.id ? ' selected' : '') + '>' + ({ green: "🟢 ", yellow: "🟡 ", red: "🔴 " })[LIC_COLOR[k]] + esc(STR.lic.names[k]) + '</option>'; }).join("") + '</select></label>' +
        '<label class="field"><span>' + STR.lic.by + '</span><input id="lic-by" value="' + esc(l.by || "") + '" placeholder="' + esc(STR.lic.byPh) + '"></label>' +
        '<label class="field"><span>' + STR.lic.url + '</span><input id="lic-url" value="' + esc(l.url || "") + '" placeholder="' + esc(STR.lic.urlPh) + '"></label>' : '') +
      '<div class="row"><button type="button" class="btn" id="ask-x">' + (canWrite ? STR.lic.cancel : STR.close) + '</button>' + (canWrite ? '<button class="btn primary" id="lic-ok">' + STR.lic.save + '</button>' : '') + '</div></form>';
    document.body.appendChild(box);
    var close = function () { box.remove(); };
    box.querySelector("#ask-x").onclick = close;
    box.addEventListener("mousedown", function (ev) { if (ev.target === box) close(); });
    box.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); close(); } });
    box.querySelector("form").onsubmit = function (ev) {
      ev.preventDefault(); if (!canWrite) return;
      var id = box.querySelector("#lic-id").value;
      var lic = { id: id, source: "author", by: box.querySelector("#lic-by").value.trim(), url: box.querySelector("#lic-url").value.trim(), text: l.text || "" };
      close(); save(lic);
    };
    (box.querySelector("#lic-id") || box.querySelector("#ask-x")).focus();
  }
  async function setFileLicense(ref, fileId, lic) { // rewrite one entry of the doc's files[]
    var d = await ref.get(), files = ((d.data() || {}).files || []).map(function (x) { return x.id === fileId ? Object.assign({}, x, { license: lic }) : x; });
    await ref.update({ files: files, updatedAt: stamp() });
    return files;
  }
  // Models uploaded before the count existed: counted in the background, one at a time, and stored on the card's file entry.
  function backfillPolys() {
    if (polyBusy || !canWrite || !gameId) return;
    var job = null;
    cards.some(function (c) { return (c.files || []).some(function (f) {
      if (polyTried[f.id]) return false;
      if ((is3D(f) && f.tris == null && !f.trisFailed && (f.size || 0) <= 100 * 1048576) || (isLicText(f) && f.licenseFound === undefined)) { job = { c: c, f: f }; return true; }
    }); });
    if (!job) return;
    polyBusy = true; polyTried[job.f.id] = 1;
    var ref = gref().collection("cards").doc(job.c.id);
    var work = isLicText(job.f)
      ? fetch(job.f.url).then(function (r) { return r.text(); }).then(function (t) { return { licenseFound: licenseIn(t) }; }, function () { return { licenseFound: null }; })
      : modelInfo(job.f, job.c.files).then(function (n) { var p = { tris: n.tris }; if (n.rights && !job.f.license) p.license = rightsLicense(n.rights); return p; }, function () { return { trisFailed: true }; });
    work.then(function (patch) {
      return ref.get().then(function (d) {
        var files = (d.data() || {}).files || [];
        return ref.update({ files: files.map(function (x) { return x.id === job.f.id ? Object.assign({}, x, patch) : x; }) });
      });
    }).catch(function () {}).then(function () { polyBusy = false; setTimeout(backfillPolys, 300); });
  }
  function view3d(f, files) {
    import("./gb-3d.js").then(function (m) { m.view3d(f, STR.v3d, files); }).catch(function (e) { alert(STR.failed + ": " + (e.message || e)); });
  }
  function isImage(f) { return /^image\//.test(f.type || "") || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name || ""); }
  function fileSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function fileRow(f) {
      return '<div class="file">' + (isImage(f) ? '<a href="' + esc(f.url) + '" target="_blank" rel="noopener"><img loading="lazy" alt="" src="' + esc(f.url) + '"></a>' : '<span class="ico">' + (is3D(f) ? '🧊' : '📦') + '</span>') +
        '<a class="fname" href="' + esc(f.url) + '" target="_blank" rel="noopener" download="' + esc(f.name) + '">' + esc(f.name) + '</a><span class="muted">' + fileSize(f.size || 0) + '</span>' + polyInfo(f) +
        (isAsset(f) ? licChip(f, open.files, "data-lic") : '') +
        (is3D(f) ? '<button class="btn" data-view3d="' + esc(f.id) + '">' + STR.v3d.open + '</button>' : '') +
        (canWrite ? '<button class="btn danger" data-rmfile="' + esc(f.id) + '" aria-label="' + esc(STR.remove + " " + f.name) + '">✕</button>' : '') + '</div>';
  }
  function filesHtml() {
    var list = (open.files || []).filter(function (f) { return !f.field; }).map(fileRow).join("");
    var add = !canWrite ? "" : open.isNew ? '<p class="muted">' + STR.filesSaveFirst + '</p>'
      : '<label class="btn"><input type="file" multiple id="f-up" hidden>' + STR.filesAdd + '</label>';
    return '<div class="field files"><label>' + STR.files + ' <span class="hint">' + STR.filesHint + '</span></label>' + list + add + '</div>';
  }
  async function uploadFiles(list, field) {
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
        await localInfo(file, meta);
        if (field) meta.field = field;
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
    flushLabels(); setEditMode(false);
    open = null; draft = null; setTimeout(applyLang);
    $("leaf").classList.remove("open"); $("leaf").setAttribute("aria-hidden", "true"); $("scrim").classList.remove("open");
  }

  async function save() {
    if (!open) return;
    [].forEach.call(document.querySelectorAll("#e-body textarea"), collect);
    draft.title = $("e-title").value.trim() || open.title || STR.newCard;
    draft.status = $("e-status").value;
    var gk = groupKey(sec(open.section));
    if (gk && draft.fields[gk] && !draft.defs.some(function (d) { return d.key === gk; })) draft.defs.push({ key: gk, label: STR.group });
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
          fields: draft.fields, defs: draft.defsFull ? draft.defs : extra, defsFull: draft.defsFull, hidden: false, updatedAt: stamp() }, { merge: true });
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

  function addCard(fresh, group) {
    var s = sec(section);
    if (s.canon && fresh !== true) return pickFromCanon(s, group);
    var c = s.canon
      ? { key: "new", src: "canon", id: entityId(s.canon), section: s.id, title: "", status: "idea", note: "", canonDesc: { key: "desc", value: "" }, defs: s.defs.slice(), fields: {}, isNew: true }
      : { key: "new", src: "game", id: newId("card"), section: s.id, title: "", status: "idea", note: "", defs: (s.defs || CUSTOM_DEFS).slice(), fields: {}, isNew: true };
    if (group) c.fields[groupKey(s)] = group;
    openCard(c);
  }

  // The game takes canon entities by choice: a picker of those not in the game yet, or a new one born in the canon.
  function pickFromCanon(s, group) {
    var free = entities.filter(function (e) { return e.kind === s.canon && !inGame(e); })
      .sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
    var box = document.createElement("div");
    box.className = "ask";
    box.innerHTML = '<form class="ask-box pick-box" role="dialog" aria-modal="true" aria-label="' + esc(STR.pick.title) + '"><h3>' + esc(STR.pick.title) + ' · ' + esc(L(s)) + '</h3>' +
      (free.length ? '<p class="warn">' + STR.pick.hint + '</p><div class="picklist">' + free.map(function (e) {
        var img = entImage(e);
        return '<label class="pickrow"><input type="checkbox" value="' + esc(e.id) + '">' + (img ? '<img alt="" src="' + esc(img.url) + '">' : '<span class="pi"></span>') +
          '<span><b>' + esc(e.name || e.title || "") + '</b><i>' + esc(plain(e[descKeyOf(e)] || (e.dossier || {}).story).slice(0, 90)) + '</i></span></label>';
      }).join("") + '</div>' : '<p class="warn">' + STR.pick.none + '</p>') +
      '<div class="row"><button type="button" class="btn" id="pick-new">' + STR.pick.newOne + '</button><span style="flex:1"></span>' +
      '<button type="button" class="btn" id="ask-x">' + STR.cancel + '</button>' + (free.length ? '<button class="btn primary" id="pick-ok" disabled>' + STR.pick.addN + '</button>' : '') + '</div></form>';
    document.body.appendChild(box);
    function close() { box.remove(); }
    box.querySelector("#ask-x").onclick = close;
    box.querySelector("#pick-new").onclick = function () { close(); addCard(true, group); };
    box.addEventListener("mousedown", function (ev) { if (ev.target === box) close(); });
    box.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); close(); } });
    box.addEventListener("change", function () { var ok = box.querySelector("#pick-ok"); if (ok) ok.disabled = !box.querySelector(".picklist input:checked"); });
    box.querySelector("form").onsubmit = async function (ev) {
      ev.preventDefault();
      var ids = [].map.call(box.querySelectorAll(".picklist input:checked"), function (i) { return i.value; }); if (!ids.length) return;
      var batch = db.batch();
      ids.forEach(function (id) {
        var c = { section: s.id, canonRef: id, hidden: false, status: "idea", updatedAt: stamp() };
        if (group) { c.fields = {}; c.fields[groupKey(s)] = group; }
        batch.set(gref().collection("cards").doc(id), c, { merge: true });
      });
      await batch.commit(); close();
    };
    var first = box.querySelector(".picklist input") || box.querySelector("#pick-new"); first.focus();
  }
  // Older games saw the whole canon; on first open they keep exactly what they showed, then switch to picking.
  async function migrateCanonOptIn(g) {
    if (!g || g.canonOptIn || !canWrite) return;
    var snap = await gref().collection("cards").get(), have = {};
    snap.docs.forEach(function (d) { var c = d.data(); if (c.canonRef) have[c.canonRef] = 1; });
    var batch = db.batch();
    GAME.forEach(function (s) {
      if (s.canon) entities.filter(function (e) { return e.kind === s.canon && !have[e.id]; }).forEach(function (e) {
        batch.set(gref().collection("cards").doc(e.id), { section: s.id, canonRef: e.id, hidden: false, updatedAt: stamp() }, { merge: true });
      });
    });
    batch.update(gref(), { canonOptIn: true });
    await batch.commit();
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
  function confirmDeleteSection(s) {
    if (!s.custom) return;
    askDelete(STR.deleteSection, STR.stDelSecText, L(s), async function () {
      var batch = db.batch();
      cards.filter(function (c) { return c.section === s.id; }).forEach(function (c) { batch.delete(gref().collection("cards").doc(c.id)); });
      batch.set(gref(), { sections: game.sections.filter(function (x) { return x.id !== s.id; }) }, { merge: true });
      if (section === s.id) section = "overview";
      await batch.commit();
    });
  }

  // ---------- Неузгоджене: contradictions + open questions, resolved by the author (game: plan/current.resolved, canon: world.auditAnswers) ----------
  function djb2(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  function cid(c) { return c.id || "t_" + djb2(c.what || ""); } // older contradictions have no id — functions/src/gamedev.js uses the same fallback
  function gameIssues() { var r = planDoc.resolved || {}; return (planDoc.contradictions || []).filter(function (c) { return !r[cid(c)]; }); }
  function canonIssues() { var a = (world && world.auditAnswers) || {}; return ((world && world.audit && world.audit.contradictions) || []).filter(function (c) { return !a[cid(c)]; }); }
  var canonBusy = false, canonMsg = "";
  function contraHtml(c, kind) {
    return '<div class="q" data-ck="' + kind + '" data-c="' + esc(cid(c)) + '"><div class="q__q">' + esc(c.what) + '</div>' + (c.where ? '<div class="muted">' + esc(c.where) + '</div>' : '') +
      (c.options && c.options.length ? '<div class="row q__opts">' + c.options.map(function (o) { return '<button class="chip" aria-pressed="false" data-opt="' + esc(o) + '">' + esc(o) + '</button>'; }).join("") + '</div>' : '') +
      '<textarea rows="2" placeholder="' + esc(STR.resolvePh) + '"></textarea><div class="row"><button class="btn primary" data-resolve>' + STR.resolve + '</button></div></div>';
  }
  function resolvedHtml(items) {
    if (!items.length) return "";
    return '<section class="psec"><details><summary><h2 class="group" style="display:inline-flex">' + STR.resolvedTitle + ' <span>' + items.length + '</span></h2></summary>' +
      items.map(function (x) { return '<div class="qa"><div class="muted">' + esc(x[0]) + '</div><div>' + esc(x[1]) + '</div></div>'; }).join("") + '</details></section>';
  }
  function issuesHead(title, about, id, busy, has) {
    return '<header class="sec"><div><h1>' + esc(title) + '</h1><p>' + esc(about) + '</p></div><div class="row"><button class="btn primary" id="' + id + '"' + (busy ? ' disabled' : '') + '>' +
      (has ? STR.audit : STR.auditFirst) + costMark(id === "ci-audit" ? "canonAudit" : "analyze") + '</button></div></header>';
  }
  function renderIssues() {
    var run = planDoc.running && planDoc.running.at && planDoc.running.at.toMillis && Date.now() - planDoc.running.at.toMillis() < 35 * 60000 ? planDoc.running.op : null;
    var busy = planBusy === "analyze" || run === "analyze", open1 = gameIssues(), oq = openQs(), r = planDoc.resolved || {};
    var html = issuesHead(STR.issues, STR.issuesAbout, "i-audit", busy, !!planDoc.gdd);
    html += '<p class="pmsg">' + esc(busy ? STR.auditBusy : planMsg || (!planDoc.gdd && !open1.length && !oq.length ? STR.auditIntro : !open1.length && !oq.length ? STR.auditClean : "")) + '</p>';
    if (open1.length) html += '<section class="psec"><h2 class="group">' + STR.contraOpen + ' <span>' + open1.length + '</span></h2>' + open1.map(function (c) { return contraHtml(c, "game"); }).join("") + '</section>';
    if (oq.length) html += '<section class="psec"><h2 class="group">' + STR.questionsTitle + ' <span>' + oq.length + '</span></h2>' + oq.map(qHtml).join("") + '</section>';
    html += resolvedHtml((planDoc.contradictions || []).filter(function (c) { return r[cid(c)]; }).map(function (c) { return [c.what, r[cid(c)]]; })
      .concat((planDoc.asked || []).filter(function (q) { return answers()[q.id]; }).map(function (q) { return [q.question, answers()[q.id]]; })));
    $("view").innerHTML = html;
  }
  function renderCanonIssues() {
    var au = (world && world.audit) || {}, a = (world && world.auditAnswers) || {}, open1 = canonIssues();
    var run = world && world.auditRunning && world.auditRunning.toMillis && Date.now() - world.auditRunning.toMillis() < 35 * 60000;
    var busy = canonBusy || run;
    var html = issuesHead(STR.issues, STR.canonIssuesAbout, "ci-audit", busy, !!au.at);
    html += '<p class="pmsg">' + esc(busy ? STR.auditBusy : canonMsg || (!au.at ? STR.auditIntro : !open1.length ? STR.auditClean : "")) + '</p>';
    if (open1.length) html += '<section class="psec"><h2 class="group">' + STR.contraOpen + ' <span>' + open1.length + '</span></h2>' + open1.map(function (c) { return contraHtml(c, "canon"); }).join("") + '</section>';
    html += resolvedHtml((au.contradictions || []).filter(function (c) { return a[cid(c)]; }).map(function (c) { return [c.what, a[cid(c)]]; }));
    $("view").innerHTML = html;
  }
  async function runCanonAudit() {
    if (canonBusy) return;
    canonBusy = true; canonMsg = ""; render();
    try { var data = await callFn({ op: "canonAudit" }); canonMsg = STR.spent + ": " + data.tokensConsumed; } catch (e) { canonMsg = e.message; }
    canonBusy = false; render();
  }
  // The author's decision closes the inconsistency and goes where it belongs: the game card, or the canon entity itself (explicit canon).
  async function resolveIssue(kind, id, text) {
    var upd = {}; upd[id] = text;
    if (kind === "canon") {
      var c = ((world.audit && world.audit.contradictions) || []).filter(function (x) { return cid(x) === id; })[0];
      await wref().set({ auditAnswers: upd, updatedAt: stamp() }, { merge: true });
      var eid = c && c.target && /^e:/.test(c.target.card) ? c.target.card.slice(2) : null, e = eid && entities.filter(function (x) { return x.id === eid; })[0];
      if (e) {
        var k = e.desc !== undefined || e.description === undefined ? "desc" : "description", body = { updatedAt: stamp() };
        body[k] = e[k] ? e[k] + "\n\n" + text : text;
        await wref().collection("entities").doc(eid).set(body, { merge: true });
      }
      canonMsg = e ? STR.writtenTo + " «" + (e.name || eid) + "»" : ""; return;
    }
    var gc = (planDoc.contradictions || []).filter(function (x) { return cid(x) === id; })[0];
    await gref().collection("plan").doc("current").set({ resolved: upd }, { merge: true });
    if (gc && gc.target) { await writeIntoCard(gc.target, gc.target.field, text); planMsg = STR.writtenTo + " «" + cardName(gc.target.card) + "»"; }
  }
  // AI operations spend tokens: a small ✦ marks them, and the author confirms the approximate price first.
  var COST_BASE = 300; // economy_operations/generateScene providers.claude.cost; × the same factor gamedevPlan reserves
  function costOf(op) { if (op === "cosmograph") return COSMO_COST; return COST_BASE * (op === "analyze" || op === "canonAudit" ? 2 : 4); }
  function costMark(op) { var t = STR.costTip.replace("{n}", costOf(op)); return ' <span class="aicost" title="' + esc(t) + '" aria-label="' + esc(t) + '">✦</span>'; }
  function confirmCost(op, run) {
    var box = document.createElement("div");
    box.className = "ask";
    box.innerHTML = '<form class="ask-box" role="dialog" aria-modal="true" aria-label="' + esc(STR.costTitle) + '"><h3><span class="aicost">✦</span> ' + esc(STR.costTitle) + '</h3>' +
      '<p class="warn">' + esc((op === "cosmograph" ? STR.cosmo.costText : STR.costText).replace("{op}", STR.ops[op] || op).replace("{n}", costOf(op))) + '</p>' +
      '<div class="row"><button type="button" class="btn" id="ask-x">' + STR.cancel + '</button><button class="btn primary" id="ask-ok">' + STR.costGo + '</button></div></form>';
    document.body.appendChild(box);
    var close = function () { box.remove(); };
    box.querySelector("form").onsubmit = function (ev) { ev.preventDefault(); close(); run(); };
    box.querySelector("#ask-x").onclick = close;
    box.addEventListener("mousedown", function (ev) { if (ev.target === box) close(); });
    box.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); close(); } });
    box.querySelector("#ask-ok").focus();
  }

  // ---------- project settings: names, engine, import/export, safe deletion ----------
  function renderSettings() {
    var own = ((game && game.sections) || []);
    var html = '<header class="sec"><div><h1>' + STR.settings + '</h1><p>' + STR.settingsAbout + '</p></div></header>' +
      '<section class="setbox"><h2>' + STR.stWorld + '</h2>' +
        '<div class="setrow"><input id="st-wname" aria-label="' + esc(STR.stWorldName) + '" value="' + esc(world.title || "") + '"><button class="btn" id="st-wsave">' + STR.stRename + '</button></div>' +
        '<div class="setrow"><button class="btn" id="st-wexp">' + STR.stExportWorld + '</button><label class="btn"><input type="file" id="st-json" accept=".json,application/json" hidden>' + STR.stRestore + '</label></div>' +
        '<p class="hint">' + STR.stRestoreHint + '</p></section>';
    if (game) html += '<section class="setbox"><h2>' + STR.stGame + ' · ' + esc(game.title) + '</h2>' +
        '<div class="setrow"><input id="st-gname" aria-label="' + esc(STR.stGameName) + '" value="' + esc(game.title || "") + '"><button class="btn" id="st-gsave">' + STR.stRename + '</button></div>' +
        '<label class="field"><span>' + STR.engine + '</span><div class="setrow"><select id="engine">' + ENGINES.map(function (x) {
          return '<option value="' + x.id + '"' + (x.id === ((game.engine && game.engine.profile) || "generic") ? " selected" : "") + '>' + esc(L(x)) + '</option>'; }).join("") + '</select></div></label>' +
        '<div class="setrow"><button class="btn" id="st-import">' + STR.stImport + costMark("import") + '</button><button class="btn" id="st-gexp">' + STR.stExportGame + '</button></div>' +
        '<p class="hint">' + STR.stImportHint + ' ' + STR.stExportHint + '</p>' +
        '<h2>' + STR.stShown + '</h2><p class="hint">' + STR.stShownHint + '</p><div class="shownsecs">' + GAME.map(function (s) {
          return '<label class="imp"><input type="checkbox" data-showsec="' + s.id + '"' + (((game.hiddenSections || []).indexOf(s.id) < 0) ? ' checked' : '') + '><span>' + esc(L(s)) + '</span></label>'; }).join("") + '</div>' +
        '<h2>' + STR.stSections + '</h2>' + (own.length ? own.map(function (s) {
          return '<div class="secrow"><span>' + esc(s.name) + '</span><button class="btn danger" data-delsec="' + esc(s.id) + '">' + STR.deleteSection + '</button></div>'; }).join("")
          : '<p class="hint">' + STR.stNoSections + '</p>') + '</section>';
    html += cosmoSettingsHtml();
    html += '<section class="setbox danger"><h2>' + STR.stDanger + '</h2><div class="setrow">' +
      (game ? '<button class="btn danger" id="st-gdel">' + STR.stDelGame + '</button>' : '') +
      '<button class="btn danger" id="st-wdel">' + STR.stDelWorld + '</button></div><p class="hint" id="st-msg"></p></section>';
    $("view").innerHTML = html;
    var note = function (t) { $("st-msg").textContent = t; };
    $("st-wsave").onclick = async function () {
      var t = $("st-wname").value.trim(); if (!t) return;
      await wref().set({ title: t, updatedAt: stamp() }, { merge: true });
      tellShell({ type: "ww-worlds-changed" }); note(STR.stRenamed);
    };
    $("st-wexp").onclick = exportWorld;
    $("st-json").onchange = function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) restoreJson(f).catch(function (er) { note(STR.failed + ": " + (er.message || er)); }); };
    $("st-wdel").onclick = deleteWorld;
    bindCosmoSettings();
    if (!game) return;
    $("st-gsave").onclick = async function () { var t = $("st-gname").value.trim(); if (t) { await gref().set({ title: t, updatedAt: stamp() }, { merge: true }); note(STR.stRenamed); } };
    $("engine").onchange = function (e) { gref().set({ engine: { profile: e.target.value } }, { merge: true }); };
    $("st-import").onclick = function () { confirmCost("import", function () { $("imp-file").click(); }); };
    [].forEach.call(document.querySelectorAll("[data-showsec]"), function (cb) {
      cb.onchange = function () {
        var hidden = (game.hiddenSections || []).filter(function (x) { return x !== cb.dataset.showsec; });
        if (!cb.checked) hidden.push(cb.dataset.showsec);
        gref().set({ hiddenSections: hidden, updatedAt: stamp() }, { merge: true });
      };
    });
    $("st-gexp").onclick = exportGame;
    $("st-gdel").onclick = function () { askDelete(STR.stDelGame, STR.stDelGameText, game.title || "", deleteGame); };
    [].forEach.call(document.querySelectorAll("[data-delsec]"), function (b) {
      b.onclick = function () { confirmDeleteSection(sec(b.dataset.delsec)); };
    });
  }
  function tellShell(msg) { try { window.parent.postMessage(msg, location.origin); } catch (e) {} }
  function download(name, text, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  async function docsOf(ref) { var s = await ref.get(); return s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }
  async function exportWorld() {
    var ents = await docsOf(wref().collection("entities")), cult = await docsOf(wref().collection("lore"));
    download(slugify(world.title || "world") + ".world.json", JSON.stringify({ format: "whitewrite.world/1", exportedAt: new Date().toISOString(),
      world: Object.assign({ id: worldId }, world), entities: ents, lore: cult, games: games.map(function (g) { return { id: g.id, title: g.title }; }) }, null, 2));
  }
  // Restore from an export: never overwrites — a game file becomes a new game here, a world file a new world.
  function revive(v) { // exported Firestore timestamps come back as {seconds, nanoseconds}
    if (Array.isArray(v)) return v.map(revive);
    if (v && typeof v === "object") {
      var ks = Object.keys(v);
      if (ks.length === 2 && "seconds" in v && "nanoseconds" in v && firebase.firestore.Timestamp) return new firebase.firestore.Timestamp(v.seconds, v.nanoseconds);
      var o = {}; ks.forEach(function (k) { o[k] = revive(v[k]); }); return o;
    }
    return v;
  }
  async function writeAll(col, docs, keepId) {
    for (var i = 0; i < docs.length; i += 400) {
      var batch = db.batch();
      docs.slice(i, i + 400).forEach(function (d) { var data = revive(Object.assign({}, d)); if (!keepId) delete data.id; batch.set(col.doc(String(d.id)), data); });
      await batch.commit();
    }
  }
  async function restoreJson(file) {
    var data; try { data = JSON.parse(await file.text()); } catch (e) { data = null; }
    var note = function (t) { $("st-msg").textContent = t; };
    if (data && data.format === "whitewrite.game/1" && data.game) {
      var gid = newId("game"), g = wref().collection("games").doc(gid), meta = revive(Object.assign({}, data.game));
      delete meta.id; meta.createdAt = stamp(); meta.updatedAt = stamp();
      await g.set(meta);
      await writeAll(g.collection("cards"), data.cards || []);
      await writeAll(g.collection("plan"), data.plan || []);
      await writeAll(g.collection("tasks"), data.tasks || []);
      await writeAll(g.collection("changeRequests"), data.changeRequests || []);
      note(STR.stRestored + ": " + (meta.title || gid)); // it appears in the «Гра:» picker
      return;
    }
    if (data && data.format === "whitewrite.world/1" && data.world) {
      var wid = newId("world"), w = Object.assign({}, revive(data.world));
      delete w.id; delete w.audit; delete w.auditRunning; delete w.cosmograph; // the paid month belongs to the original world
      w.owner = firebase.auth().currentUser.uid; w.createdAt = stamp(); w.updatedAt = stamp();
      await db.collection("worlds").doc(wid).set(w);
      await writeAll(db.collection("worlds").doc(wid).collection("entities"), data.entities || [], true);
      await writeAll(db.collection("worlds").doc(wid).collection("lore"), data.lore || [], true);
      note(STR.stRestored + ": " + (w.title || wid));
      tellShell({ type: "ww-worlds-changed" });
      return;
    }
    note(STR.stBadJson);
  }
  async function exportGame() {
    var g = gref();
    var out = { format: "whitewrite.game/1", exportedAt: new Date().toISOString(), worldId: worldId, game: Object.assign({}, game),
      cards: await docsOf(g.collection("cards")), plan: await docsOf(g.collection("plan")), tasks: await docsOf(g.collection("tasks")),
      changeRequests: await docsOf(g.collection("changeRequests")) };
    download(slugify(game.title || "game") + ".game.json", JSON.stringify(out, null, 2));
  }
  // Safe deletion: the author types the exact name before anything is removed.
  function askDelete(title, text, name, run) {
    var box = document.createElement("div");
    box.className = "ask";
    box.innerHTML = '<form class="ask-box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><h3>' + esc(title) + '</h3>' +
      '<p class="warn">' + text.replace("{n}", esc(name)) + '</p><p class="warn">' + esc(STR.stTypeName.replace("{n}", name)) + '</p>' +
      '<input id="ask-in" autocomplete="off">' +
      '<div class="row"><button type="button" class="btn" id="ask-x">' + STR.cancel + '</button><button class="btn danger" id="ask-ok" disabled>' + STR.stDelete + '</button></div></form>';
    document.body.appendChild(box);
    var input = box.querySelector("input"), ok = box.querySelector("#ask-ok");
    var close = function () { box.remove(); };
    input.oninput = function () { ok.disabled = input.value.trim() !== String(name).trim(); };
    box.querySelector("form").onsubmit = async function (ev) {
      ev.preventDefault(); if (ok.disabled) return;
      ok.disabled = true; ok.textContent = STR.stDeleting;
      try { await run(); close(); } catch (e) { ok.textContent = STR.failed + ": " + (e.code || e.message || e); }
    };
    box.querySelector("#ask-x").onclick = close;
    box.addEventListener("mousedown", function (ev) { if (ev.target === box) close(); });
    box.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { ev.stopPropagation(); close(); } });
    input.focus();
  }
  async function deleteDocs(ref) {
    var docs = (await ref.get()).docs;
    for (var i = 0; i < docs.length; i += 400) {
      var batch = db.batch(); docs.slice(i, i + 400).forEach(function (d) { batch.delete(d.ref); }); await batch.commit();
    }
  }
  async function removeGame(id) {
    var g = wref().collection("games").doc(id);
    var cs = (await g.collection("cards").get()).docs;
    await Promise.all([].concat.apply([], cs.map(function (d) { return (d.data().files || []).map(function (f) {
      return f.path ? firebase.storage().ref(f.path).delete().catch(function () {}) : null; }); })));
    for (var sub of ["cards", "plan", "tasks", "executions", "changeRequests"]) await deleteDocs(g.collection(sub));
    var ks = await db.collection("mcpKeys").where("uid", "==", firebase.auth().currentUser.uid).where("gameId", "==", id).get();
    await Promise.all(ks.docs.map(function (d) { return d.ref.delete(); }));
    await g.delete();
  }
  async function deleteGame() {
    var id = gameId;
    unsub.forEach(function (u) { u(); }); unsub = [];
    await removeGame(id);
    try { localStorage.removeItem("ww-game-" + worldId); } catch (e) {}
    var rest = games.filter(function (g) { return g.id !== id; });
    if (rest.length) { games = rest; selectGame(rest[0].id); } else { game = null; gameId = null; cards = []; planDoc = {}; render(); }
  }
  async function deleteWorld() {
    // stories live outside the world (projects) — never orphan them
    var stories = await db.collection("projects").where("owner", "==", firebase.auth().currentUser.uid).where("worldId", "==", worldId).get();
    if (!stories.empty) { $("st-msg").textContent = STR.stHasStories.replace("{n}", stories.size); return; }
    askDelete(STR.stDelWorld, STR.stDelWorldText, world.title || "", async function () {
      unsub.forEach(function (u) { u(); }); unsub = [];
      for (var g of games) await removeGame(g.id);
      await Promise.all(entities.concat(lore).reduce(function (all, e) { return all.concat(e.files || []); }, []).map(function (f) { return firebase.storage().ref(f.path).delete().catch(function () {}); }));
      await deleteDocs(wref().collection("entities"));
      await deleteDocs(wref().collection("lore"));
      var skyMap = world.cosmos && world.cosmos.planet && world.cosmos.planet.map; // an uploaded map of the Космограф
      if (/^https:\/\/firebasestorage\./.test(skyMap || "")) await firebase.storage().refFromURL(skyMap).delete().catch(function () {});
      await wref().delete(); // last: the rules check ownership through the world doc
      tellShell({ type: "ww-worlds-changed", deleted: true });
    });
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
      return { id: x.id, name: L(x), kind: x.canon ? "canon" : "game", canonKind: x.canon || "", fields: (x.defs || []).map(function (d) { return d.label; }),
        groups: groupKey(x) ? groupsOf(x) : [] };
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
        return box("canon", i, e.name + " · " + L(GAME.filter(function (s) { return s.canon === e.kind; })[0]), (e.match ? STR.importMatch : STR.importNew) + (e.description ? ": " + e.description : "")); }).join("");
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
      var s = GAME.filter(function (x) { return x.canon === e.kind; })[0];
      var id = e.match || entityId(e.kind);
      if (!e.match) batch.set(wref().collection("entities").doc(id), { id: id, kind: e.kind, name: e.name, slug: slugify(e.name), desc: e.description,
        origin: { source: "explicit", confidence: null, confirmed: true, createdBy: "user" }, createdAt: stamp(), updatedAt: stamp() }); // the author ticked it
      var f = toFields(e.gameFields, s.defs);
      batch.set(gref().collection("cards").doc(id), { section: s.id, canonRef: id, fields: f.fields, defs: f.extra, hidden: false, updatedAt: stamp() }, { merge: true });
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
      '<button class="btn' + (gdd ? '' : ' primary') + '" id="p-analyze"' + (busy ? ' disabled' : '') + '>' + (gdd ? STR.reanalyze : STR.analyze) + costMark("analyze") + '</button>' +
      (gdd ? '<button class="btn primary" id="p-plan"' + (busy || blockers ? ' disabled title="' + esc(STR.blockersLeft) + '"' : '') + '>' + (plan ? STR.remakePlan : STR.makePlan) + costMark("plan") + '</button>' : '') +
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
    if (gameIssues().length) html += '<section class="psec"><h2 class="group">' + STR.contradictions + '</h2><ul class="contra">' + gameIssues().map(function (c) {
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

    var a = $("p-analyze"); if (a) a.onclick = function () { confirmCost("analyze", function () { runPlan("analyze"); }); };
    var pl = $("p-plan"); if (pl) pl.onclick = function () { confirmCost("plan", function () { runPlan("plan"); }); };
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
    await writeIntoCard(q.target, q.target && (q.target.field || q.topic), text);
  }
  async function writeIntoCard(target, label, text) {
    var c = target && allCards().filter(function (x) { return x.key === target.card; })[0];
    if (!c) return;
    var want = (label || "").toLowerCase();
    var def = c.defs.filter(function (d) { return d.key.toLowerCase() === want || d.label.toLowerCase() === want; })[0];
    var defs = c.src === "canon" && !c.defsFull ? (c.extraDefs || []).slice() : c.defs.slice();
    if (!def) { def = { key: fieldKey(want || "decision"), label: label || STR.resolvedTitle }; defs.push(def); }
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
  function navClick(e) {
    if (e.target.closest("#canon-toggle")) { canonFolded = !canonFolded; try { localStorage.setItem("ww-bible-fold", canonFolded ? "1" : ""); } catch (er) {} renderNav(); return; }
    var b = e.target.closest(".nav-item"); if (!b) return;
    if (wdraft && b.dataset.sec !== section && wdirty() && !confirm(STR.dos.unsaved)) return;
    section = b.dataset.sec; query = ""; imp = null; $("q").value = ""; render(); $("main").scrollTop = 0;
  }
  $("nav").addEventListener("click", navClick);
  $("nav-foot").addEventListener("click", navClick);
  $("nav").addEventListener("change", function (e) {
    if (e.target.id !== "gamepick") return;
    if (section === "settings") section = "overview";
    if (e.target.value === "__new") { game = null; gameId = null; imp = null; render(); } else selectGame(e.target.value);
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
  $("view").addEventListener("change", function (e) {
    var rv = e.target.closest("[data-reveal]");
    if (rv) db.collection("projects").doc(rv.dataset.reveal).update({ reveal: rv.value, updatedAt: stamp() });
  });
  // the shell brings the author back to an entity («Біблія світу» from the book)
  window.addEventListener("message", function (ev) {
    if (ev.origin !== location.origin || !ev.data || ev.data.type !== "ww-bible-focus") return;
    var x = entities.filter(function (y) { return y.id === ev.data.ent; })[0]; if (!x) { pendingFocus = ev.data.ent; return; }
    var s = x.kind === "events" ? CHRONICLE : dosSection(x.kind); if (s) { section = s.id; render(); }
    if (!dos || dos.id !== x.id) openDossier(x);
  });
  function viewClick(e) {
    var opt = e.target.closest("[data-opt]");
    if (opt) {
      [].forEach.call(opt.parentNode.querySelectorAll("[data-opt]"), function (o) { o.setAttribute("aria-pressed", String(o === opt)); });
      opt.closest(".q").querySelector("textarea").value = opt.dataset.opt; return;
    }
    var rs = e.target.closest("[data-resolve]");
    if (rs) { var rq = rs.closest(".q"), rt = rq.querySelector("textarea").value.trim(); if (!rt) { rq.querySelector("textarea").focus(); return; }
      rs.disabled = true; resolveIssue(rq.dataset.ck, rq.dataset.c, rt).catch(function (er) { planMsg = STR.failed + ": " + er.message; render(); }); return; }
    var au = e.target.closest("#i-audit");
    if (au) { confirmCost("analyze", function () { runPlan("analyze"); }); return; }
    var cau = e.target.closest("#ci-audit");
    if (cau) { confirmCost("canonAudit", runCanonAudit); return; }
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
    var so = e.target.closest("[data-story]"); if (so) { tellShell({ type: "ww-open-story", projectId: so.dataset.story }); return; }
    var as = e.target.closest("[data-addsub]"); if (as) { addIn(as.dataset.addsub); return; }
    var sd = e.target.closest("[data-subdel]"); if (sd) { dropSubsection(sd.dataset.subdel); return; }
    var dl = e.target.closest("[data-lore]"); if (dl) { openDossier(lore.filter(function (x) { return x.id === dl.dataset.lore; })[0]); return; }
    var de = e.target.closest("[data-ent]"); if (de) { openDossier(entities.filter(function (x) { return x.id === de.dataset.ent; })[0]); return; }
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
    var lb = e.target.closest("[data-lic]");
    if (lb) {
      var card = open, lf = card.files.filter(function (f) { return f.id === lb.dataset.lic; })[0];
      licDialog(lf, card.files, function (lic) {
        setFileLicense(gref().collection("cards").doc(card.id), lf.id, lic).then(function (files) {
          card.files = files; if (open === card) { [].forEach.call(document.querySelectorAll("#e-body textarea"), collect); renderFields(); }
        }).catch(function (er) { msg(STR.failed + ": " + (er.code || er.message)); });
      });
      return;
    }
    var del = e.target.closest("[data-delfield]"); if (del) { deleteField(del.dataset.delfield); return; }
    var tb = e.target.closest(".tbl");
    if (tb && e.target.closest("[data-addrow],[data-addcol],[data-rmrow],[data-rmcol]")) {
      var rows = readTable(tb), b = e.target.closest("button");
      if (b.hasAttribute("data-addrow")) rows.push(rows[0].map(function () { return ""; }));
      else if (b.hasAttribute("data-addcol")) rows.forEach(function (r, i) { r.push(i ? "" : STR.col + " " + (r.length + 1)); });
      else if (b.dataset.rmrow) rows.splice(+b.dataset.rmrow, 1);
      else rows.forEach(function (r) { r.splice(+b.dataset.rmcol, 1); });
      [].forEach.call(document.querySelectorAll("#e-body textarea"), collect); flushLabels();
      draft.fields[tb.dataset.tbl] = tableMd(rows); renderFields(); return;
    }
    if (e.target.id === "nf-add") {
      var label = $("nf").value.trim(), type = $("nf-type").value; if (!label) return;
      var key = fieldKey(label);
      [].forEach.call(document.querySelectorAll("#e-body textarea"), collect); flushLabels();
      if (!draft.defs.some(function (d) { return d.key === key; })) { draft.defs.push(type === "text" ? { key: key, label: label } : { key: key, label: label, type: type }); saveStructure(); }
      renderFields(); if (type === "text") editField(key);
    }
  });
  $("e-body").addEventListener("input", function (e) {
    var tb = e.target.dataset.cell && e.target.closest(".tbl");
    if (tb) draft.fields[tb.dataset.tbl] = tableMd(readTable(tb));
  });
  $("e-body").addEventListener("change", function (e) {
    if (e.target.id === "f-up" && e.target.files.length) { var list = [].slice.call(e.target.files); e.target.value = ""; uploadFiles(list); }
    if (e.target.dataset.fup && e.target.files.length) { var fl = [].slice.call(e.target.files), fk = e.target.dataset.fup; e.target.value = ""; uploadFiles(fl, fk); }
    if (e.target.dataset.flabel) flushLabels();
    if (e.target.dataset.ftype) {
      var d = draft.defs.filter(function (x) { return x.key === e.target.dataset.ftype; })[0]; if (!d) return;
      [].forEach.call(document.querySelectorAll("#e-body textarea"), collect); flushLabels();
      if (e.target.value === "text") delete d.type; else d.type = e.target.value;
      if (d.type === "table") draft.fields[d.key] = tableMd(parseTable(draft.fields[d.key]));
      renderFields(); saveStructure();
    }
  });
  $("e-edit").addEventListener("click", function () {
    if (!open) return;
    if (editMode) flushLabels();
    [].forEach.call(document.querySelectorAll("#e-body textarea"), collect);
    setEditMode(!editMode); renderFields();
  });
  $("e-body").addEventListener("keydown", function (e) {
    var s = e.target.closest(".shown"); if (s && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); editField(s.dataset.edit); }
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
  $("scrim").onclick = function () { if (dos) closeDossier(); else closeLeaf(); };
  $("d-save").onclick = saveDossier;
  $("d-close").onclick = closeDossier;
  $("d-delete").onclick = deleteLore;
  $("e-delete").onclick = removeCard;
  $("imp-file").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) startImport(f); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && open) closeLeaf();
    if (e.key === "Escape" && dos && !document.querySelector(".v3d")) closeDossier();
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && dos) { e.preventDefault(); saveDossier(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "s" && open) { e.preventDefault(); save(); }
    if (e.key === "Tab" && open && !document.querySelector(".v3d")) { // keep focus inside the leaf
      var f = [].filter.call($("leaf").querySelectorAll("button,input,select,textarea,[tabindex]"), function (x) { return !x.disabled && x.offsetParent; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  // ---------- language: the account switch (i18n.js setLanguage) reaches this frame as ww-language-change ----------
  // Every label is built for one language at load, so the page reloads in place — after an open card or dossier is closed.
  var langNext = null;
  function applyLang() {
    if (!langNext || open || dos) return;
    try { sessionStorage.setItem("ww-bible-sec-" + worldId, section); } catch (e) {}
    location.reload();
  }
  window.addEventListener("ww-language-change", function (ev) {
    var l = ev.detail && ev.detail.lang; if (!l || (l === "en" ? "en" : "uk") === LANG) return;
    langNext = l; applyLang();
  });
  try { var keep = sessionStorage.getItem("ww-bible-sec-" + worldId); if (keep) { section = keep; sessionStorage.removeItem("ww-bible-sec-" + worldId); } } catch (e) {}
  $("spine").setAttribute("aria-label", STR.sectionsAria);

  // ---------- boot ----------
  $("t-brand").textContent = STR.brand; $("q").placeholder = STR.search;
  setEditMode(false); $("e-save").textContent = STR.save; $("e-close").textContent = STR.close;
  $("d-save").textContent = STR.save; $("d-close").textContent = STR.close; $("d-delete").textContent = STR.cult.del;
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
    if (!sections().some(function (s) { return s.id === section; })) section = "overview";
    unsub.push(gref().collection("cards").onSnapshot(function (snap) {
      cards = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      sync(snap.metadata.fromCache ? "" : "ok", STR.live); render(); backfillPolys();
    }, function () { sync("bad", STR.offline); }));
    migrateCanonOptIn(game).catch(function () {});
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
    db.collection("economy_operations").doc("generateScene").get().then(function (d) {
      var p = d.exists && (d.data().providers || {}).claude; if (p && p.cost) COST_BASE = p.cost;
    }).catch(function () {});
    if (!worldId) return locked(STR.brand, STR.noWorld, false);
    try {
      var u = await db.collection("users").doc(user.uid).get();
      var plan = (u.exists && u.data().plan) || "free";
      var pc = window.__getPlanConfig(plan); planName = plan;
      canWrite = !!(pc.allowWorldTree || pc.allowGameDev); canGame = !!pc.allowGameDev; // the canon is the world's home (the Universe tree's plans); games need game dev
      if (!canWrite) return locked(STR.lockedTitle, STR.lockedText, true);
      if (!canGame && !CANON.some(function (x) { return x.id === section; })) section = "world";
      var w = await wref().get();
      if (!w.exists) return locked(STR.brand, STR.noWorld, false);
    } catch (e) { return locked(STR.brand, STR.noWorld, false); }

    wref().onSnapshot(function (d) { world = d.data() || {}; $("w-title").textContent = world.title || "…"; document.title = (world.title || "") + " — " + STR.brand; render(); });
    wref().collection("entities").onSnapshot(function (snap) {
      entities = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .filter(function (e) { return !(e.origin && e.origin.confirmed === false); }); // inferred canon is not fact yet
      render();
      if (pendingFocus) { var pf = pendingFocus; pendingFocus = null; window.postMessage({ type: "ww-bible-focus", ent: pf }, location.origin); }
    });
    db.collection("projects").where("owner", "==", user.uid).where("worldId", "==", worldId).onSnapshot(function (snap) {
      stories = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .sort(function (a, b) { return String(a.title || "").localeCompare(String(b.title || "")); });
      if (section === "chronicle") render();
      var ds = $("d-stories"); if (ds && dos && !dos.isNew && dos.col !== "lore") ds.innerHTML = storiesHtml(dos);
    }, function () {});
    wref().collection("lore").onSnapshot(function (snap) {
      lore = snap.docs.map(function (d) { return Object.assign({ id: d.id, col: "lore" }, d.data()); })
        .sort(function (a, b) { return String(a.name || "").localeCompare(String(b.name || "")); });
      render();
    }, function () {});
    var first = true;
    wref().collection("games").onSnapshot(function (snap) {
      games = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .sort(function (a, b) { return ((a.createdAt && a.createdAt.toMillis && a.createdAt.toMillis()) || 0) - ((b.createdAt && b.createdAt.toMillis && b.createdAt.toMillis()) || 0); });
      if (first) {
        first = false;
        var saved = null; try { saved = params.get("gameId") || localStorage.getItem("ww-game-" + worldId); } catch (e) {}
        var pick = games.filter(function (g) { return g.id === saved; })[0] || games[0];
        if (pick && canGame) return selectGame(pick.id);
      }
      if (gameId) game = games.filter(function (g) { return g.id === gameId; })[0] || null;
      render();
    });
  });
})();
