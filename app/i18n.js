// WhiteWrite i18n — Internationalization System
// Language switching for Ukrainian (uk) and English (en)

(function() {
  'use strict';

  // Translations dictionary
  const TRANSLATIONS = {
    uk: {
      // Top Menu / Navigation
      'nav.book': 'Книга',
      'nav.universe': 'Біблія світу',
      'nav.pillars': 'Стовпи WhiteWrite',
      'nav.marketplace': 'Спільнота',

      // Account Modal
      'account.title': 'Акаунт',
      'account.profile': 'Профіль',
      'account.notLoggedIn': 'Ви не увійшли',
      'account.loginPrompt': 'Увійдіть або зареєструйтеся, щоб створювати власні світи, керувати каноном і зберігати прогрес.',
      'account.loginButton': '✦ Увійти або зареєструватися',
      'account.editProfile': 'Редагувати профіль',
      'account.save': 'Зберегти',
      'account.changeAvatar': 'Змінити аватар',
      'account.tokensRemaining': 'токенів залишилось',
      'account.topUp': '+ Поповнити',
      'account.subscriptionPlans': 'Плани підписки',
      'account.logoutButton': '⎋ Вийти з акаунту',
      'account.close': 'Закрити',
      'account.languageLabel': 'Language / Мова',

      // Stats
      'stats.universes': 'Історії',
      'stats.scenes': 'Сцени',
      'stats.canonEntities': 'Сутності канону',

      // Plans
      'plan.free': 'План Free',
      'plan.storyteller': 'План Storyteller',
      'plan.novelist': 'План Novelist',
      'plan.worldbuilder': 'План Worldbuilder',
      'plan.worldforge': 'План Worldforge',
      'plan.current': 'Поточний план',
      'plan.choose': 'Обрати',
      'plan.pendingFrom': 'З {d}',
      'plan.undoPending': 'Скасувати перехід',
      'plan.upAsk': 'Перехід {from} → {to} діє одразу.\n\nЗараз буде списано ≈ ${usd} — різниця в ціні до кінця оплаченого періоду ({date}).\nТокени: + {tokens} до кінця періоду, мінус комісія за перехід {fee}.\n\nПерейти?',
      'plan.downAsk': 'Перехід {from} → {to} почне діяти з наступного місяця підписки — {date}. До того лишається {from}, повернення коштів за поточний місяць немає.\n\nЗапланувати?',
      'plan.freeAsk': 'Підписку {from} буде скасовано з кінця оплаченого періоду — {date}. До того все працює, далі — Free.\n\nСкасувати підписку?',
      'plan.upDone': 'Готово: тепер {to}.',
      'plan.downDone': 'Заплановано: {to} з {date}. Скасувати можна на картці тарифу.',
      'plan.popular': '⭐ ПОПУЛЯРНИЙ',
      'plan.cancelled': '(скасовано)',
      'plan.paused': '({plan} призупинено — віднови оплату в порталі)',
      'plan.tokens': 'токенів/міс',
      'plan.scenes': 'сцен',
      'plan.projects': 'проєктів',
      'plan.sceneNote': 'К-ть сцен залежить від довжини й моделі',
      'plan.or': 'або',
      'plan.claudeOnly': 'Лише Claude',

      // Features
      'book.export': 'Експорт книги',
      'book.exportPrint': 'друк / зберегти як PDF',
      'book.exportPlan': 'Експорт доступний від тарифу Storyteller (Акаунт → Тарифи).',

      // Project Editor
      'editor.kicker': 'Світ',
      'editor.title': 'Редагувати історію',
      'editor.cover': 'Обкладинка',
      'editor.coverPlaceholder': 'Своя обкладинка проєкту',
      'editor.coverUpload': 'Завантажити',
      'editor.coverRemove': 'Прибрати',
      'editor.nameLabel': 'Назва',
      'editor.descLabel': 'Опис світу',
      'editor.scopeLabel': 'Обсяг',
      'editor.scopeShot': 'Оповідання',
      'editor.scopeNovella': 'Новела',
      'editor.scopeSeason': 'Сезон',
      'editor.scopeEndless': 'Без меж',
      'editor.ending': 'Фінал',
      'editor.endingOpen': 'Відкритий',
      'editor.endingClosed': 'Завершений',
      'editor.endingCustom': 'Свій опис',
      'editor.genreLabel': 'Жанр і тон',
      'editor.cancel': 'Скасувати',
      'editor.save': '✓ Зберегти',

      // Delete Confirmation
      'delete.kicker': 'Видалення',
      'delete.title': 'Видалити історію?',
      'delete.question': 'Ви точно хочете видалити',
      'delete.warning': 'Цю дію не можна скасувати — історія і її сцени зникнуть назавжди. Канон світу лишиться.',
      'delete.keep': 'Залишити',
      'delete.confirm': '🗑 Видалити назавжди',

      // Auth
      'auth.kicker': 'WhiteWrite',
      'auth.createAccount': 'Створити акаунт',
      'auth.signIn': 'Увійти у свій світ',
      'auth.email': 'Пошта',
      'auth.password': 'Пароль',
      'auth.name': 'Ім\'я (необов\'язково)',
      'auth.signInTab': 'Вхід',
      'auth.signUpTab': 'Реєстрація',
      'auth.signInButton': 'Увійти',
      'auth.signUpButton': 'Створити акаунт',
      'auth.orDivider': 'або',
      'auth.googleButton': 'Продовжити з Google',
      'auth.namePh': 'Майстер світів',
      'auth.forgot': 'Забули пароль?',
      'auth.resetNeedEmail': 'Впишіть пошту вище — надішлемо на неї посилання для нового пароля.',
      'auth.resetSent': 'Лист надіслано на {email}. Відкрийте посилання з листа (перевірте й «Спам»).',
      'auth.needBoth': 'Введіть пошту та пароль',
      'auth.wait': 'Зачекайте...',
      'auth.err.invalid-credential': 'Неправильна пошта або пароль',
      'auth.err.user-not-found': 'Користувача з такою поштою не знайдено',
      'auth.err.wrong-password': 'Неправильний пароль',
      'auth.err.email-already-in-use': 'Ця пошта вже використовується',
      'auth.err.weak-password': 'Пароль занадто слабкий (мінімум 6 символів)',
      'auth.err.invalid-email': 'Невірний формат пошти',
      'auth.err.missing-email': 'Впишіть пошту',
      'auth.err.too-many-requests': 'Забагато спроб. Зачекайте трохи або скиньте пароль',
      'auth.err.user-disabled': 'Цей акаунт вимкнено',
      'auth.err.popup-closed-by-user': 'Вхід скасовано',
      'auth.err.popup-blocked': 'Браузер заблокував вікно входу — дозвольте спливні вікна для сайту',
      'auth.err.network-request-failed': 'Помилка мережі',
      'auth.err.unknown': 'Не вдалося увійти. Спробуйте ще раз',

      // Knowledge Base
      'kb.tip': 'Порада.',
      'kb.warning': 'Увага.',
      'kb.copy': 'Копіювати',
      'kb.copied': 'Скопійовано ✓',

      // UI Elements
      'ui.back': 'Назад',
      'ui.home': 'На головну',
      'ui.hideMenu': 'Сховати меню для читання',
      'ui.navigation': 'Навігація',
      'ui.account': 'Акаунт',
      'ui.guest': 'Гість',
      'ui.tokens': 'токенів',
      'ui.feedback': 'Повідомити про баг або написати нам',
      'ui.feedbackShort': 'Зворотний зв\'язок',
      'ui.close': 'Закрити',
      'ui.previous': 'Попередня',

      // Hero / Start Screen
      'hero.imgAlt': 'Хранитель історій з живою книгою',

      // Generation Progress
      'generation.creating': 'Генерується сцена {current} з {total}',
      'generation.note': 'Це може зайняти кілька хвилин...',

      // Errors
      'error.sceneGeneration': 'Помилка при генерації сцени {number}',
      'error.scenesGenerated': 'Згенеровано {count} з {total} сцен.',
      'error.projectCreation': 'Не вдалося створити проєкт',
      'project.limitAsk': 'Ліміт тарифу {plan} — проєктів: {limit}, і всі вже зайняті.\n\nДодатковий проєкт — {cost} токенів, слот лишається назавжди (у тебе {have}).\n\nOK — купити слот і створити проєкт.\nСкасувати — відкрити тарифи.',
      'project.slotNoTokens': 'Для додаткового проєкту потрібно {cost} токенів, у тебе {have}. Поповни баланс або обери вищий тариф.',

      // Book / Reading
      'book.act': 'Акт',
      'book.ritualAi': 'AI створює вашу історію…',
      'book.opening': 'Книга відкривається…',
      'book.adv.btn': 'Порадити',
      'book.adv.tip': 'ШІ підкаже, що покращити, що не збігається з каноном і що незрозуміло · ≈{n} токенів',
      'book.adv.title': 'Поради',
      'book.adv.ask': 'ШІ прочитає сцену разом із каноном світу і підкаже, що покращити, що не збігається з каноном і що незрозуміло. Це коштує ≈{n} токенів.',
      'book.adv.go': 'Порадити',
      'book.adv.cancel': 'Скасувати',
      'book.adv.plan': 'Поради ШІ доступні з плану Novelist. Сцену можна писати і без них.',
      'book.adv.busy': 'Читаю сцену разом із каноном…',
      'book.adv.improve': 'Що покращити',
      'book.adv.canon': 'Не збігається з каноном',
      'book.adv.unclear': 'Незрозуміло читачеві',
      'book.adv.fixes': 'Швидкі правки',
      'book.adv.apply': 'Застосувати',
      'book.adv.none': 'Нічого суттєвого.',
      'book.adv.tokens': 'токенів',
      'book.emptyTitle': 'Порожня книга',
      'book.emptyText': 'Ця історія ще не має жодної сцени. Напиши або встав першу сам — чи переверни сторінку, і ШІ запропонує початок.',
      'book.writeFirst': 'Писати першу сцену',
      'book.editScene': 'Редагувати сцену',
      'book.newScene': 'Нова сцена',
      'book.sheetTitle': 'Аркуш',
      'book.sheetTitlePh': 'Назва сцени',
      'book.sheetPh': 'Пиши тут або встав готовий текст. Абзаци — з нового рядка.',
      'book.sheetDone': 'Готово',
      'book.sheet.saved': 'Збережено',
      'book.sheet.dirty': 'Є зміни…',
      'book.sheet.saving': 'Зберігаю…',
      'book.sheet.error': 'Не вдалося зберегти — перевір зʼєднання',
      'book.words': 'слів',
      'form.freeIcon': '✎',
      'form.freeTitle': 'Пишу сам',
      'form.freeDesc': 'Порожня книга: пиши або встав свій текст. ШІ лише радить, коли попросиш.',
      'form.createFree': 'Відкрити порожню книгу',
      'book.scene': 'Сцена',
      'book.textSettings': 'Налаштування тексту',
      'book.reading': 'Читання',
      'book.text': 'Текст',
      'book.font': 'Шрифт',
      'book.size': 'Розмір',
      'book.reset': 'Скинути',
      'book.readingSettings': 'Налаштування читання',
      'book.sceneCanon': 'Канон сцени',
      'book.openInWorldTree': '✦ Відкрити в Біблії світу',
      'book.related.characters': 'Персонажі',
      'book.related.locations': 'Локації',
      'book.related.events': 'Події',
      'book.related.factions': 'Фракції',
      'book.related.artifacts': 'Артефакти',

      // Universe Reconstruction
      'genesis.kicker': 'Genesis · народження світу',
      'genesis.title': 'Обери свій світ',
      'genesis.lead': 'Обери світ, у якому житимуть твої історії. Його закони, герої й місця стануть каноном — змінити їх можна будь-коли в Біблії світу.',
      'genesis.cost': '≈ {n} токенів (списується реальна вартість)',
      'genesis.loading': 'Світ народжується… шукаю три різні шляхи для твого задуму',
      'genesis.laws': 'Закони світу',
      'genesis.characters': 'Герої',
      'genesis.locations': 'Місця',
      'genesis.factions': 'Фракції',
      'genesis.choose': 'Обрати цей світ',
      'genesis.creating': 'Творю…',
      'genesis.again': 'Інші варіанти',
      'genesis.minimal': 'Заповнити мінімально тим, що я дав',
      'genesis.retry': 'Спробувати ще раз',
      'genesis.leadAuthor': 'Беру лише те, що ти написав: огляд, закони, персонажі, локації, фракції, артефакти. Нічого не вигадую — решту допишеш у Біблії світу.',
      'genesis.loadingAuthor': 'Розкладаю твій матеріал по канону…',
      'genesis.titleAuthor': 'Народжую твій світ',
      'genesis.skipAuthor': 'Почати з порожнього світу',
      'worlds.fillLater': '📜 Свої матеріали — нотатки, документи, теки — заллєш одразу на сторінці світу: твій ШІ-агент складе їх у файл за нашим шаблоном.',
      'worlds.ideasTick': '✦ Запропонувати 3 варіанти світу за описом (ШІ)',
      'worlds.mdBtn': '⤒ Завантажити світ із файлу .md',
      'worlds.folderBtn': '📂 Тека світу',
      'worlds.folderPicked': '📂 «{d}» · файлів: {n}',
      'worlds.folderHint': 'Будь-яка тека — нотатки, лор, навіть увесь проєкт гри з кодом: ✦ ШІ сам вибере файли, де є світ, прочитає їх і розкладе по розділах канону (з Storyteller).',
      'worlds.plan_folder': 'Світ створиться, і в його Біблії ✦ ШІ перегляне теку: вибере, що читати, прочитає й покаже, що додасться — ціну побачиш перед кожним кроком.',
      'worlds.mdPicked': '📜 «{d}» · {n}',
      'worlds.mdClear': 'Прибрати',
      'worlds.mdTpl': '⤓ Шаблон .md',
      'worlds.mdHint': 'Склади один .md за шаблоном (сам або попроси будь-який ШІ з твоїх нотаток) — світ створиться й заповниться одним кліком.',
      'worlds.mdBad': 'Не вийшло прочитати файл: {d}. Візьми «⤓ Шаблон .md».',
      'worlds.mdSkipped': 'Файл не за шаблоном: розділи {s} не перенесуться самі. Біблія світу покаже, що впізнано, і запропонує «✦ Розкласти весь файл з ШІ».',
      'worlds.mdCount': { characters: 'персонажів', locations: 'локацій', factions: 'фракцій', artifacts: 'артефактів', events: 'подій', culture: 'записів культури', rules: 'законів' },
      'genesis.skip': 'Пропустити — почати з порожнього світу',

      // Worlds (world-first home)
      'nav.worlds': 'Світи',
      'worlds.kicker': 'Твої світи',
      'worlds.title': 'Обери свій світ',
      'worlds.subtitle': 'Світ — це канон: закони, герої, місця. Історії, ігри й Біблія світу живуть усередині нього.',
      'worlds.new': 'Новий світ',
      'worlds.newHint': 'Genesis · народження світу',
      'worlds.untitled': 'Безіменний світ',
      'worlds.stories': 'історій',
      'worlds.story1': 'історія',
      'worlds.story2': 'історії',
      'kb.moreIn': 'Далі в розділі',
      'worlds.open': 'Увійти у світ',
      'worlds.all': '← Усі світи',
      'worlds.hubKicker': 'Світ',
      'worlds.bible': 'Біблія світу',
      'worlds.bibleHint': 'Канон світу — персонажі, локації, закони, хроніка — і ігри на ньому',
      'worlds.formKicker': 'Genesis · новий світ',
      'worlds.formTitle': 'Створи свій світ',
      'worlds.nameLabel': 'Назва світу',
      'worlds.namePlaceholder': 'Попіл Орелії',
      'worlds.descLabel': 'Опис (за бажанням)',
      'worlds.descPlaceholder': 'Сеттинг, епоха, магія чи технології, головні сили й конфлікти, атмосфера…',
      'worlds.create': 'Народити світ',
      'worlds.plan_ideas': 'ШІ запропонує 3 варіанти світу за описом — обереш один',
      'worlds.plan_empty': 'Світ створиться одразу й відкриється в Біблії — там заллєш свої матеріали. Без токенів',
      'worlds.plan_md': 'Світ створиться й одразу заповниться з файлу — усе по своїх розділах Біблії. Без токенів',
      'kb.fab': 'База знань',

      // Feedback Modal
      'feedback.kicker': 'Зворотний зв\'язок',
      'feedback.title': 'Написати розробникам',
      'feedback.bugTab': '🐞 Баг',
      'feedback.ideaTab': '✦ Побажання',
      'feedback.bugLabel': 'Опишіть проблему',
      'feedback.placeholder': 'Що сталося / що хотілося б покращити…',
      'feedback.send': 'Надіслати',

      // Scene Intent
      'intent.title': 'Що далі?',
      'intent.conflict': 'Конфлікт',
      'intent.conflictDesc': 'загострити протистояння',
      'intent.character': 'Розвиток персонажа',
      'intent.characterDesc': 'character arc момент',
      'intent.action': 'Екшн',
      'intent.actionDesc': 'динамічна сцена',
      'intent.romance': 'Романтика',
      'intent.romanceDesc': 'емоційний момент',
      'intent.world': 'Світобудова',
      'intent.worldDesc': 'глибше у канон світу',
      'intent.twist': 'Поворот',
      'intent.twistDesc': 'підрив очікувань',
      'intent.surprise': 'Сюрприз від AI',
      'intent.surpriseDesc': 'довірити напрям Хранителю',
      'intent.orYourself': 'або без ШІ',
      'intent.writeSelf': 'Писати далі самому',
      'intent.editLast': 'Редагувати останню сцену',
      'intent.saveStory': 'Зберегти історію',
      'intent.saved': 'Історію збережено. Повертаю до історій світу…',
      'error.notSignedIn': 'увійди в акаунт і спробуй ще раз',
      'intent.arcChoice': 'Вибір сюжетної лінії',
      'intent.arcChoiceDesc': 'розгалуження арки',
      'intent.parallel': 'Паралельна сюж.лінія',
      'intent.parallelDesc': 'переключення POV',
      'intent.newCharacter': 'Зустріч нового персонажу',
      'intent.newCharacterDesc': 'новий герой входить в історію',
      'intent.custom': 'Свій напрям',
      'intent.customDesc': 'опиши, що хочеш побачити',
      'intent.generate': 'Генерувати',
      'intent.customPlaceholder': 'Опиши свій шлях історії… Що має статися далі?',
      'intent.loginRequired': 'Увійдіть в акаунт для генерації сцен.',
      'intent.insufficientTokens': 'Недостатньо токенів для генерації сцени!',
      'intent.needed': 'Потрібно',
      'intent.available': 'Доступно',
      'intent.currentPlan': 'Ваш поточний план',
      'intent.upgradePlan': 'Оберіть більший план для продовження генерації.',
      'intent.openSettings': 'Відкрити налаштування акаунту?',
      'intent.sceneGenerated': 'Сцена згенерована!',
      'intent.sceneName': 'Назва',
      'intent.firebaseNotConnected': '(Firebase не підключений)',
      'intent.generationError': 'Помилка генерації',
      'intent.error': 'Помилка',

      // Buttons & Actions
      'btn.loading': '⏳ Завантаження...',

      // Errors & Alerts
      'error.generic': 'Щось пішло не так',
      'error.projectNotFound': 'Проєкт не знайдено. Спробуйте створити новий.',
      'alert.downgradeUnavailable': 'Повернення на безкоштовний план поки недоступне. Зв\'яжіться з підтримкою.',
      'alert.checkoutError': 'Не вдалося створити сесію оплати. Спробуйте пізніше.',

      // Knowledge Base
      'kb.kicker': 'Гайди й принципи',
      'kb.title': 'База знань',
      'kb.subtitle': 'Усе, що варто знати про WhiteWrite: світи, книга, Біблія світу й гри, робота з ШІ-агентом і RPG Framework.',
      'kb.search': 'Пошук у базі знань…',
      'kb.all': 'Усі',
      'kb.empty': 'Нічого не знайдено за запитом',
      'kb.loading': 'Завантаження…',

      // News
      'news.kicker': 'Стрічка спільноти',
      'news.title': 'Новини White',
      'news.subtitle': 'Релізи, конкурси й гайди. Обговорення — у Спільноті.',
      'news.close': 'Закрити',
      'news.discuss': 'Обговорити',
      'news.post1.badge': 'Реліз',
      'news.post1.title': 'Реконструкція канону вже працює',
      'news.post1.desc': 'Зміни персонажа чи локацію — і система перебудує залежні сцени, діалоги й кадри. Перший крок до живого світу.',
      'news.post1.time': '2 дні тому',
      'news.post2.badge': 'Спільнота',
      'news.post2.title': 'Конкурс коротких світів',
      'news.post2.desc': 'Створи світ на одну новелу до 30 червня — найкращі потраплять на головну Спільноти.',
      'news.post2.time': '5 днів тому',
      'news.post3.badge': 'Гайд',
      'news.post3.title': 'Як вести історію через Scene Intent',
      'news.post3.desc': 'Ти не пишеш текст — ти задаєш напрям. Розбираємо, як скеровувати Хранителя сцена за сценою.',
      'news.post3.time': 'тиждень тому',

      // Toast
      'toast.sceneGenerated': '✦ Сцена згенерована!',
      'toast.sceneAdded': 'Нова сцена додана до вашої історії',
      'toast.tokensUsed': 'токенів',
      'toast.tokensRemaining': 'Залишилось',

      // Hero / Landing
      'hero.mark': 'WhiteWrite',
      'hero.quote': '«Один світ — безліч історій і ігор.»',
      'hero.title': 'Твій світ\nчекає',
      'hero.lede': 'Збери канон свого світу — і твори з нього книги та ігри, вірні цьому світу.',
      'hero.ctaCreate': 'Створи свій світ',
      'hero.ctaChoose': 'Обери свій світ',
      'hero.agentBeta': 'для творців ігор',
      'hero.agentTitle': 'Від задуму — до гри',
      'hero.agentDesc': 'Біблія гри й продакшн-план — у WhiteWrite, гру за ними будує Claude Code. Ти лише приймаєш роботу.',
      'hero.agentBtn': '🤖 Від чистого ПК до Гри',
      'hero.commTop': 'Вибір спільноти', 'hero.commNew': 'Відкрий нового автора', 'hero.commAll': 'Спільнота — усі світи й ігри', 'hero.commBy': 'автор', 'hero.commTeam': 'шукає команду',

      // Story Form
      'form.kicker': 'Новий світ',
      'form.title': 'Із чого почати історію?',
      'form.titleLabel': 'Назва',
      'form.titlePlaceholder': 'Попіл Орелії',
      'form.languageLabel': 'Language / Мова історії',
      'form.languageNote': 'AI писатиме сцени й діалоги цією мовою',
      'form.descLabel': 'Опис світу',
      'form.descPlaceholder': 'Місто, де згасають зорі, і жінка, що пам\'ятає його живим…',
      'form.creationLabel': 'Як створюємо',
      'form.guidedIcon': '🪶',
      'form.guidedTitle': 'Поступово з автором',
      'form.guidedDesc': 'Канон → сцена → «що далі?» → сцена. Ти ведеш історію рішеннями.',
      'form.autoIcon': '⚡',
      'form.autoTitle': 'Згенерувати все автоматично',
      'form.autoDesc': 'AI напише весь обсяг одразу. Подивишся, що вигадає світ.',
      'form.episodesLabel': 'Скільки серій',
      'form.episodesUnit': 'серій',
      'form.endingLabel': 'Фінал',
      'form.endingOpen': 'Відкритий',
      'form.endingClosed': 'Завершений',
      'form.endingCustom': 'Свій опис',
      'form.endingPlaceholder': 'Чим має завершитись історія…',
      'form.genreLabel': 'Жанр і тон',
      'form.genreHint': 'до 4',
      'form.lengthLabel': 'Довжина сцен',
      'form.lengthHint': 'токенів/сцена',
      'form.wordsPerScene': 'слів / сцена',
      'form.dialogueLabel': 'Діалоги',
      'form.dialogueNarration': 'Розповідь',
      'form.dialogueDialogues': 'Діалоги',
      'form.dialogueNote1': 'Підібрано за жанром — можна змінити',
      'form.dialogueNote2': 'Скільки історія тримається на репліках персонажів',
      'form.dialogueAlmostNone': 'Майже без діалогів',
      'form.dialogueMoreNarration': 'Більше розповіді',
      'form.dialogueBalanced': 'Збалансовано',
      'form.dialogueMoreDialogues': 'Більше діалогів',
      'form.dialogueDialoguesDrive': 'Діалоги ведуть сцену',
      'form.back': '‹ Назад',
      'form.creating': 'Створюємо світ...',
      'form.createAuto': 'Згенерувати історію',
      'form.createGuided': 'Почати історію',
      'form.errorCreate': 'Не вдалося створити проєкт',

      // Genres
      'genre.fantasy': 'Фентезі',
      'genre.darkFantasy': 'Темне фентезі',
      'genre.hardSF': 'Hard SF',
      'genre.spaceOpera': 'Космоопера',
      'genre.cyberpunk': 'Кіберпанк',
      'genre.postApocalyptic': 'Постапокаліпсис',
      'genre.horror': 'Горор',
      'genre.mystery': 'Містика',
      'genre.detective': 'Детектив',
      'genre.thriller': 'Трилер',
      'genre.romance': 'Романтика',
      'genre.adventure': 'Пригоди',
      'genre.historical': 'Історичне',
      'genre.mythFairy': 'Міф і казка',
      'genre.anime': 'Аніме / манґа',
      'genre.drama': 'Драма',
      'genre.comedy': 'Комедія',
      'genre.youngAdult': 'Янг-адалт',
      'genre.sliceOfLife': 'Слайс-оф-лайф',
      'genre.western': 'Вестерн',
      'genre.documentary': 'Документалка',
    },

    en: {
      // Top Menu / Navigation
      'nav.book': 'Book',
      'nav.universe': 'World Bible',
      'nav.pillars': 'WhiteWrite Pillars',
      'nav.marketplace': 'Community',

      // Account Modal
      'account.title': 'Account',
      'account.profile': 'Profile',
      'account.notLoggedIn': 'You are not logged in',
      'account.loginPrompt': 'Sign in or register to create your own worlds, manage canon, and save progress.',
      'account.loginButton': '✦ Sign In or Register',
      'account.editProfile': 'Edit Profile',
      'account.save': 'Save',
      'account.changeAvatar': 'Change Avatar',
      'account.tokensRemaining': 'tokens remaining',
      'account.topUp': '+ Top Up',
      'account.subscriptionPlans': 'Subscription Plans',
      'account.logoutButton': '⎋ Sign Out',
      'account.close': 'Close',
      'account.languageLabel': 'Language / Мова',

      // Stats
      'stats.universes': 'Stories',
      'stats.scenes': 'Scenes',
      'stats.canonEntities': 'Canon Entities',

      // Plans
      'plan.free': 'Free Plan',
      'plan.storyteller': 'Storyteller Plan',
      'plan.novelist': 'Novelist Plan',
      'plan.worldbuilder': 'Worldbuilder Plan',
      'plan.worldforge': 'Worldforge Plan',
      'plan.current': 'Current Plan',
      'plan.choose': 'Choose',
      'plan.pendingFrom': 'From {d}',
      'plan.undoPending': 'Undo the change',
      'plan.upAsk': 'Moving {from} → {to} takes effect at once.\n\nYou will be charged ≈ ${usd} now — the price difference until the end of the paid period ({date}).\nTokens: + {tokens} until the period ends, minus a switch fee of {fee}.\n\nSwitch?',
      'plan.downAsk': 'Moving {from} → {to} starts with the next subscription month — {date}. Until then you keep {from}; the current month is not refunded.\n\nSchedule it?',
      'plan.freeAsk': 'The {from} subscription will be cancelled at the end of the paid period — {date}. Everything works until then, then Free.\n\nCancel the subscription?',
      'plan.upDone': 'Done: you are on {to} now.',
      'plan.downDone': 'Scheduled: {to} from {date}. You can undo it on the plan card.',
      'plan.popular': '⭐ POPULAR',
      'plan.cancelled': '(cancelled)',
      'plan.paused': '({plan} on hold — resume the payment in the portal)',
      'plan.tokens': 'tokens/mo',
      'plan.scenes': 'scenes',
      'plan.projects': 'projects',
      'plan.sceneNote': 'Scene count depends on length and model',
      'plan.or': 'or',
      'plan.claudeOnly': 'Claude only',

      // Features
      'book.export': 'Export the book',
      'book.exportPrint': 'print / save as PDF',
      'book.exportPlan': 'Export is available from the Storyteller plan (Account → Plans).',

      // Project Editor
      'editor.kicker': 'World',
      'editor.title': 'Edit Story',
      'editor.cover': 'Cover',
      'editor.coverPlaceholder': 'Custom project cover',
      'editor.coverUpload': 'Upload',
      'editor.coverRemove': 'Remove',
      'editor.nameLabel': 'Title',
      'editor.descLabel': 'World Description',
      'editor.scopeLabel': 'Scope',
      'editor.scopeShot': 'Short Story',
      'editor.scopeNovella': 'Novella',
      'editor.scopeSeason': 'Season',
      'editor.scopeEndless': 'Endless',
      'editor.ending': 'Ending',
      'editor.endingOpen': 'Open',
      'editor.endingClosed': 'Closed',
      'editor.endingCustom': 'Custom',
      'editor.genreLabel': 'Genre & Tone',
      'editor.cancel': 'Cancel',
      'editor.save': '✓ Save',

      // Delete Confirmation
      'delete.kicker': 'Deletion',
      'delete.title': 'Delete Story?',
      'delete.question': 'Are you sure you want to delete',
      'delete.warning': 'This action cannot be undone — the story and its scenes will be lost forever. The world canon stays.',
      'delete.keep': 'Keep',
      'delete.confirm': '🗑 Delete Forever',

      // Auth
      'auth.kicker': 'WhiteWrite',
      'auth.createAccount': 'Create Account',
      'auth.signIn': 'Sign In to Your World',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.name': 'Name (optional)',
      'auth.signInTab': 'Sign In',
      'auth.signUpTab': 'Sign Up',
      'auth.signInButton': 'Sign In',
      'auth.signUpButton': 'Create Account',
      'auth.orDivider': 'or',
      'auth.googleButton': 'Continue with Google',
      'auth.namePh': 'Master of worlds',
      'auth.forgot': 'Forgot password?',
      'auth.resetNeedEmail': 'Type your email above — we will send it a link for a new password.',
      'auth.resetSent': 'Email sent to {email}. Open the link in it (check Spam too).',
      'auth.needBoth': 'Enter your email and password',
      'auth.wait': 'Please wait...',
      'auth.err.invalid-credential': 'Wrong email or password',
      'auth.err.user-not-found': 'No account with this email',
      'auth.err.wrong-password': 'Wrong password',
      'auth.err.email-already-in-use': 'This email is already in use',
      'auth.err.weak-password': 'Password is too weak (at least 6 characters)',
      'auth.err.invalid-email': 'Invalid email format',
      'auth.err.missing-email': 'Type your email',
      'auth.err.too-many-requests': 'Too many attempts. Wait a little or reset your password',
      'auth.err.user-disabled': 'This account is disabled',
      'auth.err.popup-closed-by-user': 'Sign-in cancelled',
      'auth.err.popup-blocked': 'The browser blocked the sign-in window — allow pop-ups for this site',
      'auth.err.network-request-failed': 'Network error',
      'auth.err.unknown': 'Could not sign in. Please try again',

      // Knowledge Base
      'kb.tip': 'Tip.',
      'kb.warning': 'Warning.',
      'kb.copy': 'Copy',
      'kb.copied': 'Copied ✓',

      // UI Elements
      'ui.back': 'Back',
      'ui.home': 'Home',
      'ui.hideMenu': 'Hide menu for reading',
      'ui.navigation': 'Navigation',
      'ui.account': 'Account',
      'ui.guest': 'Guest',
      'ui.tokens': 'tokens',
      'ui.previous': 'Previous',

      // Hero / Start Screen
      'hero.imgAlt': 'Keeper of stories with a living book',

      // Generation Progress
      'generation.creating': 'Generating scene {current} of {total}',
      'generation.note': 'This may take a few minutes...',

      // Errors
      'error.sceneGeneration': 'Error generating scene {number}',
      'error.scenesGenerated': 'Generated {count} of {total} scenes.',
      'error.projectCreation': 'Failed to create project',
      'project.limitAsk': 'The {plan} plan limit — projects: {limit}, and all are taken.\n\nAn extra project costs {cost} tokens; the slot stays forever (you have {have}).\n\nOK — buy the slot and create the project.\nCancel — open the plans.',
      'project.slotNoTokens': 'An extra project needs {cost} tokens, you have {have}. Top up or choose a higher plan.',

      // Book / Reading
      'book.act': 'Act',
      'book.ritualAi': 'The AI is weaving your story…',
      'book.opening': 'The book is opening…',
      'book.adv.btn': 'Advise',
      'book.adv.tip': 'The AI points out what to improve, what contradicts the canon and what is unclear · ≈{n} tokens',
      'book.adv.title': 'Advice',
      'book.adv.ask': 'The AI reads the scene together with the world canon and points out what to improve, what contradicts the canon and what is unclear. It costs ≈{n} tokens.',
      'book.adv.go': 'Advise',
      'book.adv.cancel': 'Cancel',
      'book.adv.plan': 'AI advice is available from the Novelist plan. You can write without it.',
      'book.adv.busy': 'Reading the scene with the canon…',
      'book.adv.improve': 'What to improve',
      'book.adv.canon': 'Contradicts the canon',
      'book.adv.unclear': 'Unclear to the reader',
      'book.adv.fixes': 'Quick fixes',
      'book.adv.apply': 'Apply',
      'book.adv.none': 'Nothing essential.',
      'book.adv.tokens': 'tokens',
      'book.emptyTitle': 'An empty book',
      'book.emptyText': 'This story has no scenes yet. Write or paste the first one yourself — or turn the page and the AI will suggest a beginning.',
      'book.writeFirst': 'Write the first scene',
      'book.editScene': 'Edit the scene',
      'book.newScene': 'New scene',
      'book.sheetTitle': 'Sheet',
      'book.sheetTitlePh': 'Scene title',
      'book.sheetPh': 'Write here or paste ready text. Paragraphs start on a new line.',
      'book.sheetDone': 'Done',
      'book.sheet.saved': 'Saved',
      'book.sheet.dirty': 'Unsaved changes…',
      'book.sheet.saving': 'Saving…',
      'book.sheet.error': 'Could not save — check the connection',
      'book.words': 'words',
      'form.freeIcon': '✎',
      'form.freeTitle': 'I write myself',
      'form.freeDesc': 'An empty book: write or paste your own text. The AI only advises when you ask.',
      'form.createFree': 'Open an empty book',
      'book.scene': 'Scene',
      'book.textSettings': 'Text Settings',
      'book.reading': 'Reading',
      'book.text': 'Text',
      'book.font': 'Font',
      'book.size': 'Size',
      'book.reset': 'Reset',
      'book.readingSettings': 'Reading Settings',
      'book.sceneCanon': 'Scene Canon',
      'book.openInWorldTree': '✦ Open in the World Bible',
      'book.related.characters': 'Characters',
      'book.related.locations': 'Locations',
      'book.related.events': 'Events',
      'book.related.factions': 'Factions',
      'book.related.artifacts': 'Artifacts',

      // Universe Reconstruction
      'genesis.kicker': 'Genesis · birth of a world',
      'genesis.title': 'Choose your world',
      'genesis.lead': 'Choose the world your stories will live in. Its laws, heroes and places become canon — you can change them anytime in the World Bible.',
      'genesis.cost': '≈ {n} tokens (the real cost is charged)',
      'genesis.loading': 'A world is being born… looking for three different paths for your idea',
      'genesis.laws': 'Laws of the world',
      'genesis.characters': 'Heroes',
      'genesis.locations': 'Places',
      'genesis.factions': 'Factions',
      'genesis.choose': 'Choose this world',
      'genesis.creating': 'Creating…',
      'genesis.again': 'Other options',
      'genesis.minimal': 'Fill it minimally with what I gave',
      'genesis.retry': 'Try again',
      'genesis.leadAuthor': 'I take only what you wrote: overview, laws, characters, locations, factions, artifacts. Nothing invented — add the rest in the World Bible.',
      'genesis.loadingAuthor': 'Sorting your material into the canon…',
      'genesis.titleAuthor': 'Bringing your world to life',
      'genesis.skipAuthor': 'Start with an empty world',
      'worlds.fillLater': '📜 Your own material — notes, documents, folders — goes in right on the world’s page: your AI agent puts it into a file by our template.',
      'worlds.ideasTick': '✦ Propose 3 worlds from the description (AI)',
      'worlds.mdBtn': '⤒ Load the world from a .md file',
      'worlds.folderBtn': '📂 World folder',
      'worlds.folderPicked': '📂 «{d}» · files: {n}',
      'worlds.folderHint': 'Any folder — notes, lore, even a whole game project with code: ✦ AI picks the files holding the world itself, reads them and sorts them into the canon sections (from Storyteller).',
      'worlds.plan_folder': 'The world is created, and in its Bible ✦ AI looks through the folder: picks what to read, reads it and shows what will be added — you see the price before each step.',
      'worlds.mdPicked': '📜 «{d}» · {n}',
      'worlds.mdClear': 'Remove',
      'worlds.mdTpl': '⤓ .md template',
      'worlds.mdHint': 'Write one .md by the template (yourself, or ask any AI to fill it from your notes) — the world is created and filled in one click.',
      'worlds.mdBad': 'Could not read the file: {d}. Take the “⤓ .md template”.',
      'worlds.mdSkipped': 'The file is not by the template: the sections {s} will not move in by themselves. The World Bible shows what was recognised and offers «✦ Sort the whole file with AI».',
      'worlds.mdCount': { characters: 'characters', locations: 'locations', factions: 'factions', artifacts: 'artifacts', events: 'events', culture: 'culture entries', rules: 'laws' },
      'genesis.skip': 'Skip — start with an empty world',

      // Worlds (world-first home)
      'nav.worlds': 'Worlds',
      'worlds.kicker': 'Your worlds',
      'worlds.title': 'Choose your world',
      'worlds.subtitle': 'A world is canon: laws, heroes, places. Stories, games and the World Bible live inside it.',
      'worlds.new': 'New world',
      'worlds.newHint': 'Genesis · birth of a world',
      'worlds.untitled': 'Nameless world',
      'worlds.stories': 'stories',
      'worlds.story1': 'story',
      'worlds.story2': 'stories',
      'kb.moreIn': 'More in',
      'worlds.open': 'Enter the world',
      'worlds.all': '← All worlds',
      'worlds.hubKicker': 'World',
      'worlds.bible': 'World Bible',
      'worlds.bibleHint': 'The world canon — characters, places, laws, chronicle — and the games built on it',
      'worlds.formKicker': 'Genesis · new world',
      'worlds.formTitle': 'Create your world',
      'worlds.nameLabel': 'World name',
      'worlds.namePlaceholder': 'Ashes of Orelia',
      'worlds.descLabel': 'Description (optional)',
      'worlds.descPlaceholder': 'Setting, era, magic or technology, main powers and conflicts, atmosphere…',
      'worlds.create': 'Bring the world to life',
      'worlds.plan_ideas': 'AI proposes 3 worlds from the description — you pick one',
      'worlds.plan_empty': 'The world is created at once and opens in its Bible — pour your material in there. No tokens',
      'worlds.plan_md': 'The world is created and filled from the file at once — everything in its own section of the Bible. No tokens',
      'kb.fab': 'Knowledge base',

      'ui.feedback': 'Report a bug or write to us',
      'ui.feedbackShort': 'Feedback',
      'ui.close': 'Close',

      // Feedback Modal
      'feedback.kicker': 'Feedback',
      'feedback.title': 'Write to Developers',
      'feedback.bugTab': '🐞 Bug',
      'feedback.ideaTab': '✦ Suggestion',
      'feedback.bugLabel': 'Describe the problem',
      'feedback.placeholder': 'What happened / what would you like to improve…',
      'feedback.send': 'Send',

      // Scene Intent
      'intent.title': 'What\'s Next?',
      'intent.conflict': 'Conflict',
      'intent.conflictDesc': 'escalate tension',
      'intent.character': 'Character Development',
      'intent.characterDesc': 'character arc moment',
      'intent.action': 'Action',
      'intent.actionDesc': 'dynamic scene',
      'intent.romance': 'Romance',
      'intent.romanceDesc': 'emotional moment',
      'intent.world': 'Worldbuilding',
      'intent.worldDesc': 'deeper into world canon',
      'intent.twist': 'Twist',
      'intent.twistDesc': 'subvert expectations',
      'intent.surprise': 'AI Surprise',
      'intent.surpriseDesc': 'trust the Keeper',
      'intent.orYourself': 'or without AI',
      'intent.writeSelf': 'Write on myself',
      'intent.editLast': 'Edit the last scene',
      'intent.saveStory': 'Save the story',
      'intent.saved': 'The story is saved. Back to the world\'s stories…',
      'error.notSignedIn': 'sign in and try again',
      'intent.arcChoice': 'Story Arc Choice',
      'intent.arcChoiceDesc': 'branching arc',
      'intent.parallel': 'Parallel Storyline',
      'intent.parallelDesc': 'POV switch',
      'intent.newCharacter': 'Meet New Character',
      'intent.newCharacterDesc': 'new hero enters story',
      'intent.custom': 'Custom Direction',
      'intent.customDesc': 'describe what you want',
      'intent.generate': 'Generate',
      'intent.customPlaceholder': 'Describe your story path… What should happen next?',
      'intent.loginRequired': 'Please sign in to generate scenes.',
      'intent.insufficientTokens': 'Insufficient tokens for scene generation!',
      'intent.needed': 'Needed',
      'intent.available': 'Available',
      'intent.currentPlan': 'Your current plan',
      'intent.upgradePlan': 'Choose a larger plan to continue generation.',
      'intent.openSettings': 'Open account settings?',
      'intent.sceneGenerated': 'Scene generated!',
      'intent.sceneName': 'Title',
      'intent.firebaseNotConnected': '(Firebase not connected)',
      'intent.generationError': 'Generation error',
      'intent.error': 'Error',

      // Buttons & Actions
      'btn.loading': '⏳ Loading...',

      // Errors & Alerts
      'error.generic': 'Something went wrong',
      'error.projectNotFound': 'Project not found. Try creating a new one.',
      'alert.downgradeUnavailable': 'Downgrade to free plan is not available yet. Contact support.',
      'alert.checkoutError': 'Failed to create payment session. Try again later.',

      // Knowledge Base
      'kb.kicker': 'Guides & Principles',
      'kb.title': 'Knowledge Base',
      'kb.subtitle': 'Everything worth knowing about WhiteWrite: worlds, the book, the World and Game Bibles, working with the AI agent and RPG Framework.',
      'kb.search': 'Search knowledge base…',
      'kb.all': 'All',
      'kb.empty': 'No results found for',
      'kb.loading': 'Loading…',

      // News
      'news.kicker': 'Community Feed',
      'news.title': 'White News',
      'news.subtitle': 'Releases, contests, and guides. Discussion in the Community.',
      'news.close': 'Close',
      'news.discuss': 'Discuss',
      'news.post1.badge': 'Release',
      'news.post1.title': 'Canon Reconstruction is Live',
      'news.post1.desc': 'Change a character or location — and the system will rebuild dependent scenes, dialogues, and frames. First step to a living world.',
      'news.post1.time': '2 days ago',
      'news.post2.badge': 'Community',
      'news.post2.title': 'Short World Contest',
      'news.post2.desc': 'Create a world for one novella by June 30 — the best will be featured on the Community homepage.',
      'news.post2.time': '5 days ago',
      'news.post3.badge': 'Guide',
      'news.post3.title': 'How to Guide Your Story with Scene Intent',
      'news.post3.desc': 'You don\'t write text — you set direction. Learn how to steer the Keeper scene by scene.',
      'news.post3.time': 'a week ago',

      // Toast
      'toast.sceneGenerated': '✦ Scene Generated!',
      'toast.sceneAdded': 'New scene added to your story',
      'toast.tokensUsed': 'tokens',
      'toast.tokensRemaining': 'Remaining',

      // Hero / Landing
      'hero.mark': 'WhiteWrite',
      'hero.quote': '«One world — countless stories and games.»',
      'hero.title': 'Your world\nawaits',
      'hero.lede': 'Gather your world’s canon — and grow books and games from it, always true to that world.',
      'hero.ctaCreate': 'Create Your World',
      'hero.ctaChoose': 'Choose Your World',
      'hero.agentBeta': 'for game makers',
      'hero.agentTitle': 'From idea to game',
      'hero.agentDesc': 'The Game Bible and the production plan live in WhiteWrite; Claude Code builds the game from them. You just accept the work.',
      'hero.agentBtn': '🤖 From a clean PC to a game',
      'hero.commTop': 'Community pick', 'hero.commNew': 'Discover a new author', 'hero.commAll': 'Community — all worlds & games', 'hero.commBy': 'by', 'hero.commTeam': 'looking for a team',

      // Story Form
      'form.kicker': 'New World',
      'form.title': 'How to start your story?',
      'form.titleLabel': 'Title',
      'form.titlePlaceholder': 'Ashes of Orelia',
      'form.languageLabel': 'Language / Story Language',
      'form.languageNote': 'AI will generate scenes and dialogues in this language',
      'form.descLabel': 'World Description',
      'form.descPlaceholder': 'A city where stars fade, and a woman who remembers it alive…',
      'form.creationLabel': 'How to create',
      'form.guidedIcon': '🪶',
      'form.guidedTitle': 'Step by step with author',
      'form.guidedDesc': 'Canon → scene → "what next?" → scene. You guide the story with decisions.',
      'form.autoIcon': '⚡',
      'form.autoTitle': 'Auto-generate everything',
      'form.autoDesc': 'AI will write the entire volume at once. See what your world creates.',
      'form.episodesLabel': 'Number of episodes',
      'form.episodesUnit': 'episodes',
      'form.endingLabel': 'Ending',
      'form.endingOpen': 'Open',
      'form.endingClosed': 'Closed',
      'form.endingCustom': 'Custom',
      'form.endingPlaceholder': 'How should the story end…',
      'form.genreLabel': 'Genre & tone',
      'form.genreHint': 'up to 4',
      'form.lengthLabel': 'Scene length',
      'form.lengthHint': 'tokens/scene',
      'form.wordsPerScene': 'words / scene',
      'form.dialogueLabel': 'Dialogue',
      'form.dialogueNarration': 'Narration',
      'form.dialogueDialogues': 'Dialogue',
      'form.dialogueNote1': 'Auto-selected by genre — can be changed',
      'form.dialogueNote2': 'How much the story relies on character dialogue',
      'form.dialogueAlmostNone': 'Almost no dialogue',
      'form.dialogueMoreNarration': 'More narration',
      'form.dialogueBalanced': 'Balanced',
      'form.dialogueMoreDialogues': 'More dialogue',
      'form.dialogueDialoguesDrive': 'Dialogue-driven scene',
      'form.back': '‹ Back',
      'form.creating': 'Creating world...',
      'form.createAuto': 'Generate Story',
      'form.createGuided': 'Start Story',
      'form.errorCreate': 'Failed to create project',

      // Genres
      'genre.fantasy': 'Fantasy',
      'genre.darkFantasy': 'Dark Fantasy',
      'genre.hardSF': 'Hard SF',
      'genre.spaceOpera': 'Space Opera',
      'genre.cyberpunk': 'Cyberpunk',
      'genre.postApocalyptic': 'Post-Apocalyptic',
      'genre.horror': 'Horror',
      'genre.mystery': 'Mystery',
      'genre.detective': 'Detective',
      'genre.thriller': 'Thriller',
      'genre.romance': 'Romance',
      'genre.adventure': 'Adventure',
      'genre.historical': 'Historical',
      'genre.mythFairy': 'Myth & Fairy Tale',
      'genre.anime': 'Anime / Manga',
      'genre.drama': 'Drama',
      'genre.comedy': 'Comedy',
      'genre.youngAdult': 'Young Adult',
      'genre.sliceOfLife': 'Slice of Life',
      'genre.western': 'Western',
      'genre.documentary': 'Documentary',
    }
  };

  // Current language (default: Ukrainian)
  let currentLang = 'uk';

  // Initialize language from localStorage or browser
  function initLanguage() {
    const saved = localStorage.getItem('ww-lang');
    if (saved && (saved === 'uk' || saved === 'en')) {
      currentLang = saved;
    } else {
      // Default to Ukrainian (product is Ukrainian-first)
      currentLang = 'uk';
    }

    // Update html lang attribute
    document.documentElement.lang = currentLang;
  }

  // Get translation
  function t(key) {
    return TRANSLATIONS[currentLang][key] || TRANSLATIONS['uk'][key] || key;
  }

  // Update all data-i18n elements
  function updateStaticTranslations() {
    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      const key = el.getAttribute('data-i18n');
      const translation = t(key);

      // Update text content (for spans, divs, buttons, etc.)
      if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
        // Only one text node
        el.textContent = translation;
      } else if (el.childNodes.length === 0) {
        el.textContent = translation;
      } else {
        // Has child elements - try to find and update text nodes
        for (let i = 0; i < el.childNodes.length; i++) {
          if (el.childNodes[i].nodeType === 3) { // Text node
            el.childNodes[i].textContent = translation;
            break;
          }
        }
      }
    });

    // Update title attributes
    document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
      const key = el.getAttribute('data-i18n-title');
      el.setAttribute('title', t(key));
    });

    // Update aria-label attributes
    document.querySelectorAll('[data-i18n-aria]').forEach(function(el) {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(key));
    });

    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
      const key = el.getAttribute('data-i18n-placeholder');
      el.setAttribute('placeholder', t(key));
    });

    // Update HTML content (for elements with HTML tags like <b>, <i>)
    document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
      const key = el.getAttribute('data-i18n-html');
      el.innerHTML = t(key);
    });
  }

  // Set language
  function setLanguage(lang) {
    if (lang !== 'uk' && lang !== 'en') return;
    if (currentLang === lang) {
      return; // Don't trigger events if language hasn't changed
    }
    currentLang = lang;
    localStorage.setItem('ww-lang', lang);
    document.documentElement.lang = lang;

    // Update static translations
    updateStaticTranslations();

    // Dispatch event for React components and White.html
    // IMPORTANT: Pass language as CustomEvent detail so iframe knows which language to switch to
    window.dispatchEvent(new CustomEvent('ww-language-change', { detail: { lang: lang } }));

    // Also dispatch to iframe if exists
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(function(iframe) {
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.dispatchEvent(new CustomEvent('ww-language-change', { detail: { lang: lang } }));
        }
      } catch (e) {
        // Cross-origin iframe, skip
      }
    });
  }

  // Get current language
  function getLanguage() {
    return currentLang;
  }

  // Export to window
  window.__i18n = {
    t: t,
    setLanguage: setLanguage,
    getLanguage: getLanguage,
    init: initLanguage,
    updateStatic: updateStaticTranslations
  };

  // Auto-initialize
  initLanguage();

  // Update static translations on page load (after DOM ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateStaticTranslations);
  } else {
    updateStaticTranslations();
  }
})();
