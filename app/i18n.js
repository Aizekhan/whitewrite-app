// WhiteWrite i18n — Internationalization System
// Language switching for Ukrainian (uk) and English (en)

(function() {
  'use strict';

  // Translations dictionary
  const TRANSLATIONS = {
    uk: {
      // Top Menu / Navigation
      'nav.home': 'Головна',
      'nav.book': 'Книга',
      'nav.universe': 'Всесвіт',
      'nav.director': 'Режисер',
      'nav.pillars': 'Стовпи WhiteWrite',
      'nav.account': 'Профіль',
      'nav.logout': 'Вийти',
      'nav.projects': 'Проекти',
      'nav.knowledgeBase': 'База знань',
      'nav.marketplace': 'Маркетплейс',

      // Account Modal
      'account.title': 'Акаунт',
      'account.profile': 'Профіль',
      'account.notLoggedIn': 'Ви не увійшли',
      'account.loginPrompt': 'Увійдіть або зареєструйтеся, щоб створювати власні всесвіти, керувати каноном і зберігати прогрес.',
      'account.loginButton': '✦ Увійти або зареєструватися',
      'account.editProfile': 'Редагувати профіль',
      'account.save': 'Зберегти',
      'account.changeAvatar': 'Змінити аватар',
      'account.tokensRemaining': 'токенів залишилось',
      'account.topUp': '+ Поповнити',
      'account.subscriptionPlans': 'Плани підписки',
      'account.logoutButton': '⎋ Вийти з акаунту',
      'account.close': 'Закрити',
      'account.language': 'Мова інтерфейсу',
      'account.languageLabel': 'Language / Мова',

      // Stats
      'stats.universes': 'Всесвіти',
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
      'plan.popular': '⭐ POPULAR',
      'plan.cancelled': '(скасовано)',
      'plan.tokens': 'токенів/міс',
      'plan.scenes': 'сцен',
      'plan.projects': 'проєктів',
      'plan.sceneNote': 'К-ть сцен залежить від довжини й моделі',
      'plan.or': 'або',

      // Features
      'feature.exportDocs': '✨ Експорт DOCX/PDF',
      'feature.worldTree': 'WorldTree + Canon',
      'feature.claudeAPI': '✦ Claude Sonnet API',
      'feature.reconstruction': 'Universe Reconstruction',
      'feature.reconstructionPro': '🔥 Universe Reconstruction',
      'feature.analyzeModes': 'ANALYZE/IMPROVE modes',
      'feature.apiAccess': 'API access',
      'feature.unlimitedProjects': '∞ проєктів',

      // Projects
      'projects.title': 'Мої Всесвіти',
      'projects.subtitle': 'WhiteWrite · твоя бібліотека',
      'projects.create': '✦ Створити новий всесвіт',
      'projects.empty': 'У вас ще немає проєктів. Створіть перший всесвіт!',
      'projects.open': 'Відкрити',
      'projects.openUniverse': 'Відкрити всесвіт',
      'projects.delete': 'Видалити',
      'projects.deleteUniverse': 'Видалити всесвіт',
      'projects.deleteConfirm': 'Видалити всесвіт?',
      'projects.deleteForever': '🗑 Видалити назавжди',
      'projects.loading': 'Завантаження проєктів...',
      'projects.loadingShort': 'Завантаження...',
      'projects.universe': 'Всесвіт',

      // Project Editor
      'editor.kicker': 'Всесвіт',
      'editor.title': 'Редагувати історію',
      'editor.cover': 'Обкладинка',
      'editor.coverPlaceholder': 'Своя обкладинка проєкту',
      'editor.coverUpload': 'Завантажити',
      'editor.coverRemove': 'Прибрати',
      'editor.nameLabel': 'Назва',
      'editor.descLabel': 'Опис всесвіту',
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
      'delete.title': 'Видалити всесвіт?',
      'delete.question': 'Ви точно хочете видалити',
      'delete.warning': 'Цю дію не можна скасувати — історія, канон і кадри зникнуть назавжди.',
      'delete.keep': 'Залишити',
      'delete.confirm': '🗑 Видалити назавжди',

      // Auth
      'auth.kicker': 'White Tree',
      'auth.createAccount': 'Створити акаунт',
      'auth.signIn': 'Увійти у свій всесвіт',
      'auth.email': 'Email',
      'auth.password': 'Пароль',
      'auth.name': 'Ім\'я (необов\'язково)',
      'auth.signInTab': 'Вхід',
      'auth.signUpTab': 'Реєстрація',
      'auth.signInButton': 'Увійти',
      'auth.signUpButton': 'Створити акаунт',
      'auth.orDivider': 'або',
      'auth.googleButton': 'Продовжити з Google',

      // Buy Book Modal
      'buyBook.badge': '📜 Бета',
      'buyBook.title': 'Надрукуй свою історію у справжній книзі',
      'buyBook.description': 'Обери стародавню магічну обкладинку — шкіра, тиснене золото, пергаментні сторінки — і тримай свій всесвіт у руках.',
      'buyBook.use1': 'Подаруй книгу про близьку людину — історію, де <b>герой — саме вона</b>',
      'buyBook.use2': 'Прикрась полицю <b>унікальним фоліантом</b>, якого більше ні в кого немає',
      'buyBook.use3': 'Збережи свій всесвіт <b>назавжди</b> — не лише на екрані',
      'buyBook.comingSoonTitle': 'Функція в розробці — уже зовсім скоро',
      'buyBook.comingSoonText': 'Ми кропітко працюємо над друком справжніх фоліантів. Щойно це стане можливим — ти дізнаєшся одним із перших. ✦',

      // Director Feature Announcement
      'director.newFeatureBadge': 'Beta',
      'director.newFeatureTitle': '🎬 Візуалізуй свою історію у відео',
      'director.newFeatureText': 'Хочеш більше? Розкадруй сцени на шоти та натренуй LoRA-референси для персонажів — твій світ готовий стати відео-серіалом з узгодженою візуальністю.',

      // Knowledge Base
      'kb.tip': 'Порада.',
      'kb.warning': 'Увага.',

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
      'hero.mark': 'WhiteWrite',
      'hero.by': 'від White Tree',
      'hero.quote': '«Історії — це магія, що творить світи.»',
      'hero.title': 'Твоя історія\nчекає',
      'hero.lede': 'Легко створюй казки, серіали, аніме, книги й документалки — будь-якого жанру.',
      'hero.cta': 'Створити свою історію',
      'hero.featureBeta': 'нова можливість',
      'hero.featureTitle': '🎬 Доведи історію до відео',
      'hero.featureDesc': 'Хочеш більшого? Розкадруй сцени на кадри й натренуй <b>LoRA</b>-референси персонажів — і твій світ готовий стати серією відеороликів зі сталими образами.',
      'hero.bookBeta': 'бета',
      'hero.bookTitle': 'Надрукуй свою історію\nу справжній книзі',
      'hero.bookDesc': 'Стародавня обкладинка · подарунок · унікальний фоліант на полицю',
      'hero.bookBtn': '📦 Замовити книгу',
      'hero.imgAlt': 'Хранитель історій з живою книгою',

      // Story Form
      'form.kicker': 'Створення історії',
      'form.title': 'Опиши свою ідею',
      'form.titleLabel': 'Назва історії (необов\'язково)',
      'form.titlePlaceholder': 'Ім\'я історії…',
      'form.languageLabel': 'Мова історії',
      'form.languageNote': 'На цій мові буде написана ваша історія',
      'form.descLabel': 'Опиши світ і історію',
      'form.descPlaceholder': 'Опиши сеттинг, персонажів, конфлікти, атмосферу… Все, що допоможе AI зрозуміти твій світ.',
      'form.creationLabel': 'Режим створення',
      'form.guidedIcon': '📖',
      'form.guidedTitle': 'Guided Mode',
      'form.guidedDesc': 'Ти керуєш: AI пише по одній сцені, ти вирішуєш що далі.',
      'form.autoIcon': '🤖',
      'form.autoTitle': 'Auto Mode',
      'form.autoDesc': 'AI створює цілий сезон (3–24 серії) автономно за твоїм описом.',
      'form.episodesLabel': 'Кількість серій',
      'form.episodesUnit': 'серій',
      'form.endingLabel': 'Фінал сезону',
      'form.endingOpen': 'Відкритий',
      'form.endingClosed': 'Закритий',
      'form.endingCustom': 'Свій',
      'form.endingPlaceholder': 'Опиши, як має закінчитися сезон…',
      'form.genreLabel': 'Жанри',
      'form.genreHint': 'до 4 жанрів',
      'form.lengthLabel': 'Довжина сцен',
      'form.lengthHint': 'токенів/сцена',
      'form.wordsPerScene': 'слів/сцена',
      'form.dialogueLabel': 'Баланс діалогів',
      'form.dialogueAlmostNone': 'Майже без діалогів',
      'form.dialogueMoreNarration': 'Більше нарації',
      'form.dialogueBalanced': 'Збалансовано',
      'form.dialogueMoreDialogues': 'Більше діалогів',
      'form.dialogueDialoguesDrive': 'Діалоги ведуть',
      'form.dialogueNarration': 'Нарація',
      'form.dialogueDialogues': 'Діалоги',
      'form.dialogueNote1': 'Автоматично розраховано за жанрами',
      'form.dialogueNote2': 'Ти налаштував вручну',
      'form.back': '← Назад',
      'form.creating': 'Створюється…',
      'form.createGuided': 'Почати історію',
      'form.createAuto': 'Створити сезон',
      'form.errorCreate': 'Помилка при створенні',

      // Generation Progress
      'generation.creating': 'Генерується сцена {current} з {total}',
      'generation.note': 'Це може зайняти кілька хвилин...',

      // Errors
      'error.sceneGeneration': 'Помилка при генерації сцени {number}',
      'error.scenesGenerated': 'Згенеровано {count} з {total} сцен.',
      'error.projectCreation': 'Не вдалося створити проєкт',

      // Book / Reading
      'book.act': 'Акт',
      'book.scene': 'Сцена',
      'book.textSettings': 'Налаштування тексту',
      'book.reading': 'Читання',
      'book.text': 'Текст',
      'book.font': 'Шрифт',
      'book.size': 'Розмір',
      'book.reset': 'Скинути',
      'book.readingSettings': 'Налаштування читання',
      'book.sceneCanon': 'Канон сцени',
      'book.openInWorldTree': '✦ Відкрити у Світовому Дереві',
      'book.related.characters': 'Персонажі',
      'book.related.locations': 'Локації',
      'book.related.events': 'Події',
      'book.related.factions': 'Фракції',
      'book.related.artifacts': 'Артефакти',

      // Workspace / Director
      'director.storyboard': 'Розкадровка',
      'director.visualCanon': 'Візуальний канон',
      'director.calculating': 'Розраховую…',
      'director.calculateShots': 'Розрахувати кадри',
      'director.availableOnStoryboard': 'Доступно на вкладці Розкадровка',
      'director.loadingProject': 'Завантаження проєкту...',

      // WorldTree / Canon
      'canon.characters': 'Персонажі',
      'canon.charactersKicker': 'Дійові особи',
      'canon.locations': 'Локації',
      'canon.locationsKicker': 'Місця світу',
      'canon.events': 'Події',
      'canon.eventsKicker': 'Хроніка всесвіту',
      'canon.factions': 'Фракції',
      'canon.factionsKicker': 'Сили та інтереси',
      'canon.artifacts': 'Артефакти',
      'canon.artifactsKicker': 'Ключові об\'єкти',
      'canon.role': 'Роль',
      'canon.status': 'Статус',
      'canon.byName': 'За іменем',
      'canon.byArc': 'За аркою',
      'canon.arc': 'Арка',
      'canon.scenes': 'Сцени',
      'canon.type': 'Тип',
      'canon.atmosphere': 'Атмосфера',
      'canon.byTitle': 'За назвою',
      'canon.current': 'Поточна',
      'canon.canon': 'Канон',
      'canon.palette': 'Палітра місця',
      'canon.chronology': 'За хронологією',
      'canon.alignment': 'Ставлення',
      'canon.powerBalance': 'Розклад сил',
      'canon.influence': 'Вплив',
      'canon.byInfluence': 'За впливом',
      'canon.members': 'Учасники',
      'canon.rarity': 'Рідкість',
      'canon.appears': 'З\'являється',
      'canon.roleLead': 'Головний',
      'canon.roleSupport': 'Другорядний',
      'canon.roleAnta': 'Антагоніст',
      'canon.scenesShort': 'сц.',

      // Enum values for canon entities
      // Character status
      'enum.status.draft': 'Чернетка',
      'enum.status.developing': 'Розвивається',
      'enum.status.complete': 'Завершено',
      // Character role (alias for existing keys)
      'enum.role.lead': 'Головний',
      'enum.role.support': 'Другорядний',
      'enum.role.anta': 'Антагоніст',
      // Location type
      'enum.locationType.city': 'Місто',
      'enum.locationType.building': 'Будівля',
      'enum.locationType.room': 'Кімната',
      'enum.locationType.nature': 'Природа',
      'enum.locationType.planet': 'Планета',
      'enum.locationType.station': 'Станція',
      'enum.locationType.ship': 'Корабель',
      'enum.locationType.virtual': 'Віртуальний',
      'enum.locationType.other': 'Інше',
      // Event type
      'enum.eventType.battle': 'Битва',
      'enum.eventType.meeting': 'Зустріч',
      'enum.eventType.discovery': 'Відкриття',
      'enum.eventType.betrayal': 'Зрада',
      'enum.eventType.loss': 'Втрата',
      'enum.eventType.victory': 'Перемога',
      'enum.eventType.revelation': 'Розкриття',
      'enum.eventType.ritual': 'Ритуал',
      'enum.eventType.other': 'Інше',
      // Faction alignment
      'enum.alignment.hero': 'Герої',
      'enum.alignment.villain': 'Лиходії',
      'enum.alignment.neutral': 'Нейтральна',
      'enum.alignment.ambiguous': 'Неоднозначна',
      // Artifact rarity
      'enum.rarity.common': 'Звичайний',
      'enum.rarity.uncommon': 'Незвичайний',
      'enum.rarity.rare': 'Рідкісний',
      'enum.rarity.legendary': 'Легендарний',
      'enum.rarity.unique': 'Унікальний',
      // Artifact type
      'enum.artifactType.weapon': 'Зброя',
      'enum.artifactType.tool': 'Інструмент',
      'enum.artifactType.document': 'Документ',
      'enum.artifactType.jewelry': 'Прикраса',
      'enum.artifactType.tech': 'Технологія',
      'enum.artifactType.magic': 'Магічний',
      'enum.artifactType.relic': 'Реліквія',
      'enum.artifactType.other': 'Інше',

      // WorldTree Workspace
      'workspace.graphHint': 'Натисніть вузол, щоб перейти до пов\'язаної сутності',
      'workspace.notUsed': 'Ще не використано в наративі',
      'workspace.impacts': 'Впливає на',
      'workspace.elements': 'елементів',
      'workspace.reconstruction': 'Реконструкція',
      'workspace.scenes': 'сцен',
      'workspace.dialogues': 'діал.',
      'workspace.shots': 'кадрів',
      'workspace.images': 'зобр.',
      'workspace.selectEntity': 'Оберіть сутність',
      'workspace.save': 'Зберегти',
      'workspace.edit': 'Редагувати',
      'workspace.cancel': 'Скасувати',
      'workspace.description': 'Опис',
      'workspace.editHint': 'Зміни застосуються лише після «Зберегти». Перехід на іншу картку без збереження — скасує правки.',
      'workspace.related': 'Пов\'язане',
      'workspace.sceneLabel': 'Сцена',
      'workspace.allStory': 'Уся історія',
      'workspace.act': 'акт',
      'workspace.chronicle': 'Хроніка',
      'workspace.chronicleKicker': 'Серце всесвіту',
      'workspace.toTree': 'До дерева',
      'workspace.search': 'Пошук',
      'workspace.all': 'усі',
      'workspace.noGroups': 'Без груп',
      'workspace.groupBy': 'Групувати',
      'workspace.cards': 'Картки',
      'workspace.list': 'Список',
      'workspace.graph': 'Граф',
      'workspace.noEntities': 'Немає сутностей',
      'workspace.add': 'Додати',
      'workspace.nothingFound': 'Нічого не знайдено',
      'workspace.newCharacter': 'Новий персонаж',
      'workspace.newLocation': 'Нова локація',
      'workspace.newEvent': 'Нова подія',
      'workspace.newFaction': 'Нова фракція',
      'workspace.newArtifact': 'Новий артефакт',
      'workspace.role': 'Роль',
      'workspace.status': 'Чернетка',
      'workspace.motivation': 'Опиши мотивацію…',
      'workspace.arc': 'Арка',
      'workspace.type': 'Тип',
      'workspace.atmosphere': 'Опиши місце…',
      'workspace.when': '—',
      'workspace.eventDesc': 'Опиши подію…',
      'workspace.alignment': 'Нейтральна',
      'workspace.motto': '—',
      'workspace.factionDesc': 'Опиши фракцію…',
      'workspace.rarity': 'Звичайний',
      'workspace.artifactDesc': 'Опиши артефакт…',
      'workspace.toTreeChronicle': 'До дерева',
      'workspace.saveChronicle': 'Зберегти',
      'workspace.editChronicle': 'Редагувати',

      // Preview Mode
      'preview.badge': 'Скоро',
      'preview.message': 'Демонстрація. Повний доступ з\'явиться незабаром.',
      'preview.actionDisabled': 'Буде доступно скоро',

      // Universe Reconstruction
      'reconstruct.title': 'Реконструкція всесвіту',
      'reconstruct.close': 'Закрити',
      'reconstruct.done': 'Готово · Закрити',
      'reconstruct.run': '▶ Запустити реконструкцію',
      'reconstruct.running': 'Реконструкція…',
      'reconstruct.completedTitle': 'Реконструкцію завершено',
      'reconstruct.runningTitle': 'Реконструкція виконується',
      'reconstruct.simulationTitle': 'Симуляція реконструкції',
      'reconstruct.canonChange': 'Зміна канону',
      'reconstruct.affectedNarrative': 'Зачеплений наратив',
      'reconstruct.affectedDirector': 'Зачеплений режисер',
      'reconstruct.changeAnalysis': 'Аналіз зміни · яка саме зміна сталася?',
      'reconstruct.completedSummary': 'Реконструйовано <b>{total}</b> елементів за <b>{steps}</b> кроків. Всесвіт узгоджено.',
      'reconstruct.impactSummary': 'Зміна цієї сутності зачепить <b>{total}</b> елементів контенту',
      'reconstruct.planTitle': 'План реконструкції',
      'reconstruct.emptyAdd': 'Додавання сутності не зачіпає наявний контент — реконструкція не потрібна.',
      'reconstruct.emptyDefault': 'За цією стратегією немає що реконструювати.',
      'reconstruct.demoNote': 'Демо-конвеєр: контент позначено як узгоджений (нічого не видалено).',
      'reconstruct.runningNote': 'Виконується послідовно: Наратив → Режисер.',
      'reconstruct.previewNote': 'Прев\'ю режиму Universe Reconstruction. Запуск — демонстраційний.',
      'reconstruct.layer.narrative': 'Наратив',
      'reconstruct.layer.director': 'Режисер',
      'reconstruct.status.pending': 'Очікує',
      'reconstruct.status.running': 'Регенерується…',
      'reconstruct.status.done': 'Готово',
      'reconstruct.scene': 'Сцена',
      'reconstruct.reconstruction': 'реконструкція',
      'reconstruct.notePlaceholder': 'Що змінилось? (необовʼязково) — напр. «Маркус тепер Король Маркус»',
      'reconstruct.realNote': 'AI запропонує правки для кожної зачепленої сцени. Нічого не зберігається без вашого «Прийняти».',
      'reconstruct.reviewTitle': 'Ревʼю змін · було → стане',
      'reconstruct.reviewSummary': 'На ревʼю: <b>{review}</b> · прийнято: <b>{applied}</b> · без змін: <b>{unchanged}</b>',
      'reconstruct.accept': 'Прийняти',
      'reconstruct.reject': 'Відхилити',
      'reconstruct.acceptAll': 'Прийняти всі',
      'reconstruct.stopped': 'Зупинено: {error}',
      'reconstruct.pinnedWarn': 'Сцена закріплена — її не змінено, але вона може суперечити новому канону.',
      'reconstruct.status.review': 'На ревʼю',
      'reconstruct.status.applied': 'Прийнято',
      'reconstruct.status.rejected': 'Відхилено',
      'reconstruct.status.unchanged': 'Без змін',
      'reconstruct.status.pinned': 'Закріплено',
      'reconstruct.status.error': 'Помилка',
      'reconstruct.status.skipped': 'Пропущено',
      'timeline.title': 'Стан у часі',
      'timeline.now': 'Зараз',
      'timeline.asOf': 'Станом на сцену {n}',
      'timeline.chronicleTitle': 'Хронологія змін',
      'timeline.aspect.status': 'Статус',
      'timeline.aspect.location': 'Місце',
      'timeline.aspect.possession': 'Володіє',
      'timeline.aspect.allegiance': 'Сторона',
      'timeline.aspect.condition': 'Стан',
      'map.title': 'Карта',
      'map.routes': 'Лінії — маршрути персонажів між сценами',
      'map.hint': 'Перетягуй локації, щоб розкласти світ',

      // Feedback Modal
      'feedback.kicker': 'Зворотний зв\'язок',
      'feedback.title': 'Написати розробникам',
      'feedback.bugTab': '🐞 Баг',
      'feedback.ideaTab': '✦ Побажання',
      'feedback.bugLabel': 'Опишіть проблему',
      'feedback.ideaLabel': 'Ваша ідея',
      'feedback.placeholder': 'Що сталося / що хотілося б покращити…',
      'feedback.send': 'Надіслати',
      'feedback.thanks': '✓ Дякуємо! Надіслано',

      // Knowledge Base
      'kb.title': 'База знань',
      'kb.loading': 'Завантаження…',

      // News
      'news.title': 'Новини White',
      'news.subtitle': 'Стрічка спільноти',
      'news.description': 'Релізи, конкурси й гайди. Обговорення — у спільноті Маркетплейсу.',
      'news.discuss': 'Обговорити',

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
      'btn.cancel': 'Скасувати',
      'btn.confirm': 'Підтвердити',
      'btn.loading': '⏳ Завантаження...',
      'btn.generate': '✦ Генерувати',
      'btn.next': 'Далі',
      'btn.previous': 'Назад',

      // Errors & Alerts
      'error.generic': 'Щось пішло не так',
      'error.tryAgain': 'Спробуйте пізніше',
      'error.projectNotFound': 'Проєкт не знайдено. Спробуйте створити новий.',
      'error.selectIntent': 'Обери напрям історії перед генерацією!',
      'error.generateFailed': 'Помилка: функція генерації не знайдена. Перезавантаж сторінку.',
      'alert.downgradeUnavailable': 'Повернення на безкоштовний план поки недоступне. Зв\'яжіться з підтримкою.',
      'alert.checkoutError': 'Не вдалося створити сесію оплати. Спробуйте пізніше.',

      // Knowledge Base
      'kb.kicker': 'Гайди й принципи',
      'kb.title': 'База знань',
      'kb.subtitle': 'Усе, що варто знати про WhiteWrite — від першої історії до режисури, канону й токенів.',
      'kb.search': 'Пошук у базі знань…',
      'kb.all': 'Усі',
      'kb.empty': 'Нічого не знайдено за запитом',
      'kb.loading': 'Завантаження…',

      // News
      'news.kicker': 'Стрічка спільноти',
      'news.title': 'Новини White',
      'news.subtitle': 'Релізи, конкурси й гайди. Обговорення — у спільноті Маркетплейсу.',
      'news.close': 'Закрити',
      'news.discuss': 'Обговорити',
      'news.post1.badge': 'Реліз',
      'news.post1.title': 'Реконструкція канону вже працює',
      'news.post1.desc': 'Зміни персонажа чи локацію — і система перебудує залежні сцени, діалоги й кадри. Перший крок до живого всесвіту.',
      'news.post1.time': '2 дні тому',
      'news.post2.badge': 'Спільнота',
      'news.post2.title': 'Конкурс коротких всесвітів',
      'news.post2.desc': 'Створи всесвіт на одну новелу до 30 червня — найкращі потраплять на головну Маркетплейсу.',
      'news.post2.time': '5 днів тому',
      'news.post3.badge': 'Гайд',
      'news.post3.title': 'Як вести історію через Scene Intent',
      'news.post3.desc': 'Ти не пишеш текст — ти задаєш напрям. Розбираємо, як скеровувати Хранителя сцена за сценою.',
      'news.post3.time': 'тиждень тому',
      'news.post4.badge': 'Режисер',
      'news.post4.title': 'Варіанти кадрів і LoRA-референси',
      'news.post4.desc': 'Тепер кожен кадр має до 5 варіантів, а персонажі — сталу зовнішність між серіями.',
      'news.post4.time': 'тиждень тому',

      // Toast
      'toast.sceneGenerated': '✦ Сцена згенерована!',
      'toast.sceneAdded': 'Нова сцена додана до вашої історії',
      'toast.tokensUsed': 'токенів',
      'toast.tokensRemaining': 'Залишилось',

      // Hero / Landing
      'hero.mark': 'WhiteWrite',
      'hero.by': 'by White Tree',
      'hero.quote': '«Історії — це магія, що творить світи.»',
      'hero.title': 'Твоя історія\nчекає',
      'hero.lede': 'Легко створюй казки, серіали, аніме, книги й документалки — будь-якого жанру.',
      'hero.cta': 'Створити свою історію',
      'hero.featureBeta': 'нова можливість',
      'hero.featureTitle': '🎬 Доведи історію до відео',
      'hero.featureDesc': 'Хочеш більшого? Розкадруй сцени на кадри й натренуй LoRA-референси персонажів — і твій світ готовий стати серією відеороликів зі сталими образами.',
      'hero.bookBeta': 'бета',
      'hero.bookTitle': 'Надрукуй свою історію\nу справжній книзі',
      'hero.bookDesc': 'Стародавня обкладинка · подарунок · унікальний фоліант на полицю',
      'hero.bookBtn': '📦 Замовити книгу',

      // Story Form
      'form.kicker': 'Новий всесвіт',
      'form.title': 'Із чого почати історію?',
      'form.titleLabel': 'Назва',
      'form.titlePlaceholder': 'Попіл Орелії',
      'form.languageLabel': 'Language / Мова історії',
      'form.languageNote': 'AI will generate scenes and dialogues in this language',
      'form.descLabel': 'Опис всесвіту',
      'form.descPlaceholder': 'Місто, де згасають зорі, і жінка, що пам\'ятає його живим…',
      'form.creationLabel': 'Як створюємо',
      'form.guidedIcon': '🪶',
      'form.guidedTitle': 'Поступово з автором',
      'form.guidedDesc': 'Канон → сцена → «що далі?» → сцена. Ти ведеш історію рішеннями.',
      'form.autoIcon': '⚡',
      'form.autoTitle': 'Згенерувати все автоматично',
      'form.autoDesc': 'AI напише весь обсяг одразу. Подивишся, що вигадає всесвіт.',
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
      'form.creating': 'Створюємо всесвіт...',
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
      'nav.home': 'Home',
      'nav.book': 'Book',
      'nav.universe': 'Universe',
      'nav.director': 'Director',
      'nav.pillars': 'WhiteWrite Pillars',
      'nav.account': 'Profile',
      'nav.logout': 'Logout',
      'nav.projects': 'Projects',
      'nav.knowledgeBase': 'Knowledge Base',
      'nav.marketplace': 'Marketplace',

      // Account Modal
      'account.title': 'Account',
      'account.profile': 'Profile',
      'account.notLoggedIn': 'You are not logged in',
      'account.loginPrompt': 'Sign in or register to create your own universes, manage canon, and save progress.',
      'account.loginButton': '✦ Sign In or Register',
      'account.editProfile': 'Edit Profile',
      'account.save': 'Save',
      'account.changeAvatar': 'Change Avatar',
      'account.tokensRemaining': 'tokens remaining',
      'account.topUp': '+ Top Up',
      'account.subscriptionPlans': 'Subscription Plans',
      'account.logoutButton': '⎋ Sign Out',
      'account.close': 'Close',
      'account.language': 'Interface Language',
      'account.languageLabel': 'Language / Мова',

      // Stats
      'stats.universes': 'Universes',
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
      'plan.popular': '⭐ POPULAR',
      'plan.cancelled': '(cancelled)',
      'plan.tokens': 'tokens/mo',
      'plan.scenes': 'scenes',
      'plan.projects': 'projects',
      'plan.sceneNote': 'Scene count depends on length and model',
      'plan.or': 'or',

      // Features
      'feature.exportDocs': '✨ Export DOCX/PDF',
      'feature.worldTree': 'WorldTree + Canon',
      'feature.claudeAPI': '✦ Claude Sonnet API',
      'feature.reconstruction': 'Universe Reconstruction',
      'feature.reconstructionPro': '🔥 Universe Reconstruction',
      'feature.analyzeModes': 'ANALYZE/IMPROVE modes',
      'feature.apiAccess': 'API access',
      'feature.unlimitedProjects': '∞ projects',

      // Projects
      'projects.title': 'My Universes',
      'projects.subtitle': 'WhiteWrite · your library',
      'projects.create': '✦ Create New Universe',
      'projects.empty': 'You don\'t have any projects yet. Create your first universe!',
      'projects.open': 'Open',
      'projects.openUniverse': 'Open Universe',
      'projects.delete': 'Delete',
      'projects.deleteUniverse': 'Delete Universe',
      'projects.deleteConfirm': 'Delete Universe?',
      'projects.deleteForever': '🗑 Delete Forever',
      'projects.loading': 'Loading projects...',
      'projects.loadingShort': 'Loading...',
      'projects.universe': 'Universe',

      // Project Editor
      'editor.kicker': 'Universe',
      'editor.title': 'Edit Story',
      'editor.cover': 'Cover',
      'editor.coverPlaceholder': 'Custom project cover',
      'editor.coverUpload': 'Upload',
      'editor.coverRemove': 'Remove',
      'editor.nameLabel': 'Title',
      'editor.descLabel': 'Universe Description',
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
      'delete.title': 'Delete Universe?',
      'delete.question': 'Are you sure you want to delete',
      'delete.warning': 'This action cannot be undone — story, canon, and frames will be lost forever.',
      'delete.keep': 'Keep',
      'delete.confirm': '🗑 Delete Forever',

      // Auth
      'auth.kicker': 'White Tree',
      'auth.createAccount': 'Create Account',
      'auth.signIn': 'Sign In to Your Universe',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.name': 'Name (optional)',
      'auth.signInTab': 'Sign In',
      'auth.signUpTab': 'Sign Up',
      'auth.signInButton': 'Sign In',
      'auth.signUpButton': 'Create Account',
      'auth.orDivider': 'or',
      'auth.googleButton': 'Continue with Google',

      // Buy Book Modal
      'buyBook.badge': '📜 Beta',
      'buyBook.title': 'Print your story as a real book',
      'buyBook.description': 'Choose an ancient magical cover — leather, embossed gold, parchment pages — and hold your universe in your hands.',
      'buyBook.use1': 'Gift a book about someone you love — a story where <b>they are the hero</b>',
      'buyBook.use2': 'Decorate your shelf with a <b>unique tome</b> that nobody else has',
      'buyBook.use3': 'Preserve your universe <b>forever</b> — not just on screen',
      'buyBook.comingSoonTitle': 'Feature in development — coming very soon',
      'buyBook.comingSoonText': 'We are meticulously working on printing real tomes. As soon as it becomes possible — you\'ll be among the first to know. ✦',

      // Director Feature Announcement
      'director.newFeatureBadge': 'Beta',
      'director.newFeatureTitle': '🎬 Take your story to video',
      'director.newFeatureText': 'Want more? Storyboard scenes into shots and train LoRA references for characters — your world is ready to become a video series with consistent visuals.',

      // Knowledge Base
      'kb.tip': 'Tip.',
      'kb.warning': 'Warning.',

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
      'hero.mark': 'WhiteWrite',
      'hero.by': 'by White Tree',
      'hero.quote': '«Stories are magic that creates worlds.»',
      'hero.title': 'Your story\nawaits',
      'hero.lede': 'Easily create fairy tales, series, anime, novels, and documentaries — any genre.',
      'hero.cta': 'Create Your Story',
      'hero.featureBeta': 'new feature',
      'hero.featureTitle': '🎬 Take Your Story to Video',
      'hero.featureDesc': 'Want more? Storyboard scenes into shots and train character <b>LoRA</b> references — and your world is ready to become a series of videos with consistent visuals.',
      'hero.bookBeta': 'beta',
      'hero.bookTitle': 'Print Your Story\nin a Real Book',
      'hero.bookDesc': 'Ancient cover · gift · unique tome for your shelf',
      'hero.bookBtn': '📦 Order Book',
      'hero.imgAlt': 'Keeper of stories with a living book',

      // Story Form
      'form.kicker': 'Story Creation',
      'form.title': 'Describe Your Idea',
      'form.titleLabel': 'Story Title (optional)',
      'form.titlePlaceholder': 'Story name…',
      'form.languageLabel': 'Story Language',
      'form.languageNote': 'Your story will be written in this language',
      'form.descLabel': 'Describe the World and Story',
      'form.descPlaceholder': 'Describe the setting, characters, conflicts, atmosphere… Everything to help AI understand your world.',
      'form.creationLabel': 'Creation Mode',
      'form.guidedIcon': '📖',
      'form.guidedTitle': 'Guided Mode',
      'form.guidedDesc': 'You\'re in control: AI writes one scene at a time, you decide what\'s next.',
      'form.autoIcon': '🤖',
      'form.autoTitle': 'Auto Mode',
      'form.autoDesc': 'AI creates a whole season (3–24 episodes) autonomously from your description.',
      'form.episodesLabel': 'Number of Episodes',
      'form.episodesUnit': 'episodes',
      'form.endingLabel': 'Season Finale',
      'form.endingOpen': 'Open',
      'form.endingClosed': 'Closed',
      'form.endingCustom': 'Custom',
      'form.endingPlaceholder': 'Describe how the season should end…',
      'form.genreLabel': 'Genres',
      'form.genreHint': 'up to 4 genres',
      'form.lengthLabel': 'Scene Length',
      'form.lengthHint': 'tokens/scene',
      'form.wordsPerScene': 'words/scene',
      'form.dialogueLabel': 'Dialogue Balance',
      'form.dialogueAlmostNone': 'Almost no dialogue',
      'form.dialogueMoreNarration': 'More narration',
      'form.dialogueBalanced': 'Balanced',
      'form.dialogueMoreDialogues': 'More dialogues',
      'form.dialogueDialoguesDrive': 'Dialogue-driven',
      'form.dialogueNarration': 'Narration',
      'form.dialogueDialogues': 'Dialogues',
      'form.dialogueNote1': 'Auto-calculated from genres',
      'form.dialogueNote2': 'You\'ve set manually',
      'form.back': '← Back',
      'form.creating': 'Creating…',
      'form.createGuided': 'Start Story',
      'form.createAuto': 'Create Season',
      'form.errorCreate': 'Error creating project',

      // Generation Progress
      'generation.creating': 'Generating scene {current} of {total}',
      'generation.note': 'This may take a few minutes...',

      // Errors
      'error.sceneGeneration': 'Error generating scene {number}',
      'error.scenesGenerated': 'Generated {count} of {total} scenes.',
      'error.projectCreation': 'Failed to create project',

      // Book / Reading
      'book.act': 'Act',
      'book.scene': 'Scene',
      'book.textSettings': 'Text Settings',
      'book.reading': 'Reading',
      'book.text': 'Text',
      'book.font': 'Font',
      'book.size': 'Size',
      'book.reset': 'Reset',
      'book.readingSettings': 'Reading Settings',
      'book.sceneCanon': 'Scene Canon',
      'book.openInWorldTree': '✦ Open in World Tree',
      'book.related.characters': 'Characters',
      'book.related.locations': 'Locations',
      'book.related.events': 'Events',
      'book.related.factions': 'Factions',
      'book.related.artifacts': 'Artifacts',

      // Workspace / Director
      'director.storyboard': 'Storyboard',
      'director.visualCanon': 'Visual Canon',
      'director.calculating': 'Calculating…',
      'director.calculateShots': 'Calculate Shots',
      'director.availableOnStoryboard': 'Available on Storyboard tab',
      'director.loadingProject': 'Loading project...',

      // WorldTree / Canon
      'canon.characters': 'Characters',
      'canon.charactersKicker': 'Cast',
      'canon.locations': 'Locations',
      'canon.locationsKicker': 'Places of the World',
      'canon.events': 'Events',
      'canon.eventsKicker': 'Universe Chronicle',
      'canon.factions': 'Factions',
      'canon.factionsKicker': 'Forces and Interests',
      'canon.artifacts': 'Artifacts',
      'canon.artifactsKicker': 'Key Objects',
      'canon.role': 'Role',
      'canon.status': 'Status',
      'canon.byName': 'By Name',
      'canon.byArc': 'By Arc',
      'canon.arc': 'Arc',
      'canon.scenes': 'Scenes',
      'canon.type': 'Type',
      'canon.atmosphere': 'Atmosphere',
      'canon.byTitle': 'By Title',
      'canon.current': 'Current',
      'canon.canon': 'Canon',
      'canon.palette': 'Place Palette',
      'canon.chronology': 'By Chronology',
      'canon.alignment': 'Alignment',
      'canon.powerBalance': 'Power Balance',
      'canon.influence': 'Influence',
      'canon.byInfluence': 'By Influence',
      'canon.members': 'Members',
      'canon.rarity': 'Rarity',
      'canon.appears': 'Appears',
      'canon.roleLead': 'Lead',
      'canon.roleSupport': 'Supporting',
      'canon.roleAnta': 'Antagonist',
      'canon.scenesShort': 'sc.',

      // Enum values for canon entities
      // Character status
      'enum.status.draft': 'Draft',
      'enum.status.developing': 'Developing',
      'enum.status.complete': 'Complete',
      // Character role (alias for existing keys)
      'enum.role.lead': 'Lead',
      'enum.role.support': 'Supporting',
      'enum.role.anta': 'Antagonist',
      // Location type
      'enum.locationType.city': 'City',
      'enum.locationType.building': 'Building',
      'enum.locationType.room': 'Room',
      'enum.locationType.nature': 'Nature',
      'enum.locationType.planet': 'Planet',
      'enum.locationType.station': 'Station',
      'enum.locationType.ship': 'Ship',
      'enum.locationType.virtual': 'Virtual',
      'enum.locationType.other': 'Other',
      // Event type
      'enum.eventType.battle': 'Battle',
      'enum.eventType.meeting': 'Meeting',
      'enum.eventType.discovery': 'Discovery',
      'enum.eventType.betrayal': 'Betrayal',
      'enum.eventType.loss': 'Loss',
      'enum.eventType.victory': 'Victory',
      'enum.eventType.revelation': 'Revelation',
      'enum.eventType.ritual': 'Ritual',
      'enum.eventType.other': 'Other',
      // Faction alignment
      'enum.alignment.hero': 'Heroes',
      'enum.alignment.villain': 'Villains',
      'enum.alignment.neutral': 'Neutral',
      'enum.alignment.ambiguous': 'Ambiguous',
      // Artifact rarity
      'enum.rarity.common': 'Common',
      'enum.rarity.uncommon': 'Uncommon',
      'enum.rarity.rare': 'Rare',
      'enum.rarity.legendary': 'Legendary',
      'enum.rarity.unique': 'Unique',
      // Artifact type
      'enum.artifactType.weapon': 'Weapon',
      'enum.artifactType.tool': 'Tool',
      'enum.artifactType.document': 'Document',
      'enum.artifactType.jewelry': 'Jewelry',
      'enum.artifactType.tech': 'Technology',
      'enum.artifactType.magic': 'Magical',
      'enum.artifactType.relic': 'Relic',
      'enum.artifactType.other': 'Other',

      // WorldTree Workspace
      'workspace.graphHint': 'Click a node to navigate to the related entity',
      'workspace.notUsed': 'Not yet used in narrative',
      'workspace.impacts': 'Impacts',
      'workspace.elements': 'elements',
      'workspace.reconstruction': 'Reconstruction',
      'workspace.scenes': 'scenes',
      'workspace.dialogues': 'dial.',
      'workspace.shots': 'shots',
      'workspace.images': 'imgs',
      'workspace.selectEntity': 'Select an entity',
      'workspace.save': 'Save',
      'workspace.edit': 'Edit',
      'workspace.cancel': 'Cancel',
      'workspace.description': 'Description',
      'workspace.editHint': 'Changes apply only after "Save". Switching cards without saving will cancel edits.',
      'workspace.related': 'Related',
      'workspace.sceneLabel': 'Scene',
      'workspace.allStory': 'All Story',
      'workspace.act': 'act',
      'workspace.chronicle': 'Chronicle',
      'workspace.chronicleKicker': 'Heart of the Universe',
      'workspace.toTree': 'To Tree',
      'workspace.search': 'Search',
      'workspace.all': 'all',
      'workspace.noGroups': 'No groups',
      'workspace.groupBy': 'Group by',
      'workspace.cards': 'Cards',
      'workspace.list': 'List',
      'workspace.graph': 'Graph',
      'workspace.noEntities': 'No entities',
      'workspace.add': 'Add',
      'workspace.nothingFound': 'Nothing found',
      'workspace.newCharacter': 'New character',
      'workspace.newLocation': 'New location',
      'workspace.newEvent': 'New event',
      'workspace.newFaction': 'New faction',
      'workspace.newArtifact': 'New artifact',
      'workspace.role': 'Role',
      'workspace.status': 'Draft',
      'workspace.motivation': 'Describe motivation…',
      'workspace.arc': 'Arc',
      'workspace.type': 'Type',
      'workspace.atmosphere': 'Describe place…',
      'workspace.when': '—',
      'workspace.eventDesc': 'Describe event…',
      'workspace.alignment': 'Neutral',
      'workspace.motto': '—',
      'workspace.factionDesc': 'Describe faction…',
      'workspace.rarity': 'Common',
      'workspace.artifactDesc': 'Describe artifact…',
      'workspace.toTreeChronicle': 'To Tree',
      'workspace.saveChronicle': 'Save',
      'workspace.editChronicle': 'Edit',

      // Preview Mode
      'preview.badge': 'Coming Soon',
      'preview.message': 'Preview only. Full access coming soon.',
      'preview.actionDisabled': 'Available soon',

      // Universe Reconstruction
      'reconstruct.title': 'Universe Reconstruction',
      'reconstruct.close': 'Close',
      'reconstruct.done': 'Done · Close',
      'reconstruct.run': '▶ Run Reconstruction',
      'reconstruct.running': 'Reconstructing…',
      'reconstruct.completedTitle': 'Reconstruction Complete',
      'reconstruct.runningTitle': 'Reconstruction in Progress',
      'reconstruct.simulationTitle': 'Reconstruction Simulation',
      'reconstruct.canonChange': 'Canon Change',
      'reconstruct.affectedNarrative': 'Affected Narrative',
      'reconstruct.affectedDirector': 'Affected Director',
      'reconstruct.changeAnalysis': 'Change Analysis · what exactly changed?',
      'reconstruct.completedSummary': 'Reconstructed <b>{total}</b> elements in <b>{steps}</b> steps. Universe aligned.',
      'reconstruct.impactSummary': 'This entity change will affect <b>{total}</b> content elements',
      'reconstruct.planTitle': 'Reconstruction Plan',
      'reconstruct.emptyAdd': 'Adding an entity doesn\'t affect existing content — no reconstruction needed.',
      'reconstruct.emptyDefault': 'Nothing to reconstruct with this strategy.',
      'reconstruct.demoNote': 'Demo pipeline: content marked as aligned (nothing deleted).',
      'reconstruct.runningNote': 'Running sequentially: Narrative → Director.',
      'reconstruct.previewNote': 'Universe Reconstruction mode preview. Demo run.',
      'reconstruct.layer.narrative': 'Narrative',
      'reconstruct.layer.director': 'Director',
      'reconstruct.status.pending': 'Pending',
      'reconstruct.status.running': 'Regenerating…',
      'reconstruct.status.done': 'Done',
      'reconstruct.scene': 'Scene',
      'reconstruct.reconstruction': 'reconstruction',
      'reconstruct.notePlaceholder': 'What changed? (optional) — e.g. “Marcus is now King Marcus”',
      'reconstruct.realNote': 'AI proposes edits for every affected scene. Nothing is saved until you press “Accept”.',
      'reconstruct.reviewTitle': 'Review changes · before → after',
      'reconstruct.reviewSummary': 'In review: <b>{review}</b> · accepted: <b>{applied}</b> · unchanged: <b>{unchanged}</b>',
      'reconstruct.accept': 'Accept',
      'reconstruct.reject': 'Reject',
      'reconstruct.acceptAll': 'Accept all',
      'reconstruct.stopped': 'Stopped: {error}',
      'reconstruct.pinnedWarn': 'Scene is pinned — left untouched, but it may contradict the new canon.',
      'reconstruct.status.review': 'In review',
      'reconstruct.status.applied': 'Accepted',
      'reconstruct.status.rejected': 'Rejected',
      'reconstruct.status.unchanged': 'Unchanged',
      'reconstruct.status.pinned': 'Pinned',
      'reconstruct.status.error': 'Error',
      'reconstruct.status.skipped': 'Skipped',
      'timeline.title': 'State over time',
      'timeline.now': 'Now',
      'timeline.asOf': 'As of scene {n}',
      'timeline.chronicleTitle': 'Timeline of changes',
      'timeline.aspect.status': 'Status',
      'timeline.aspect.location': 'Location',
      'timeline.aspect.possession': 'Holds',
      'timeline.aspect.allegiance': 'Allegiance',
      'timeline.aspect.condition': 'Condition',
      'map.title': 'Map',
      'map.routes': 'Lines — character routes between scenes',
      'map.hint': 'Drag locations to lay out the world',

      'ui.feedback': 'Report a bug or write to us',
      'ui.feedbackShort': 'Feedback',
      'ui.close': 'Close',

      // Feedback Modal
      'feedback.kicker': 'Feedback',
      'feedback.title': 'Write to Developers',
      'feedback.bugTab': '🐞 Bug',
      'feedback.ideaTab': '✦ Suggestion',
      'feedback.bugLabel': 'Describe the problem',
      'feedback.ideaLabel': 'Your idea',
      'feedback.placeholder': 'What happened / what would you like to improve…',
      'feedback.send': 'Send',
      'feedback.thanks': '✓ Thank you! Sent',

      // Knowledge Base
      'kb.title': 'Knowledge Base',
      'kb.loading': 'Loading…',

      // News
      'news.title': 'White News',
      'news.subtitle': 'Community Feed',
      'news.description': 'Releases, contests, and guides. Discussions in the Marketplace community.',
      'news.discuss': 'Discuss',

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
      'btn.cancel': 'Cancel',
      'btn.confirm': 'Confirm',
      'btn.loading': '⏳ Loading...',
      'btn.generate': '✦ Generate',
      'btn.next': 'Next',
      'btn.previous': 'Previous',

      // Errors & Alerts
      'error.generic': 'Something went wrong',
      'error.tryAgain': 'Try again later',
      'error.projectNotFound': 'Project not found. Try creating a new one.',
      'error.selectIntent': 'Choose a story direction before generating!',
      'error.generateFailed': 'Error: generation function not found. Reload the page.',
      'alert.downgradeUnavailable': 'Downgrade to free plan is not available yet. Contact support.',
      'alert.checkoutError': 'Failed to create payment session. Try again later.',

      // Knowledge Base
      'kb.kicker': 'Guides & Principles',
      'kb.title': 'Knowledge Base',
      'kb.subtitle': 'Everything worth knowing about WhiteWrite — from your first story to directing, canon, and tokens.',
      'kb.search': 'Search knowledge base…',
      'kb.all': 'All',
      'kb.empty': 'No results found for',
      'kb.loading': 'Loading…',

      // News
      'news.kicker': 'Community Feed',
      'news.title': 'White News',
      'news.subtitle': 'Releases, contests, and guides. Discussion in the Marketplace community.',
      'news.close': 'Close',
      'news.discuss': 'Discuss',
      'news.post1.badge': 'Release',
      'news.post1.title': 'Canon Reconstruction is Live',
      'news.post1.desc': 'Change a character or location — and the system will rebuild dependent scenes, dialogues, and frames. First step to a living universe.',
      'news.post1.time': '2 days ago',
      'news.post2.badge': 'Community',
      'news.post2.title': 'Short Universe Contest',
      'news.post2.desc': 'Create a universe for one novella by June 30 — the best will be featured on the Marketplace homepage.',
      'news.post2.time': '5 days ago',
      'news.post3.badge': 'Guide',
      'news.post3.title': 'How to Guide Your Story with Scene Intent',
      'news.post3.desc': 'You don\'t write text — you set direction. Learn how to steer the Keeper scene by scene.',
      'news.post3.time': 'a week ago',
      'news.post4.badge': 'Director',
      'news.post4.title': 'Shot Variants & LoRA References',
      'news.post4.desc': 'Now each shot has up to 5 variants, and characters maintain consistent appearance across series.',
      'news.post4.time': 'a week ago',

      // Toast
      'toast.sceneGenerated': '✦ Scene Generated!',
      'toast.sceneAdded': 'New scene added to your story',
      'toast.tokensUsed': 'tokens',
      'toast.tokensRemaining': 'Remaining',

      // Hero / Landing
      'hero.mark': 'WhiteWrite',
      'hero.by': 'by White Tree',
      'hero.quote': '"Stories are magic that creates worlds."',
      'hero.title': 'Your story\nawaits',
      'hero.lede': 'Easily create fairy tales, series, anime, books, and documentaries — in any genre.',
      'hero.cta': 'Create Your Story',
      'hero.featureBeta': 'new feature',
      'hero.featureTitle': '🎬 Take your story to video',
      'hero.featureDesc': 'Want more? Storyboard scenes into shots and train LoRA references for characters — your world is ready to become a video series with consistent visuals.',
      'hero.bookBeta': 'beta',
      'hero.bookTitle': 'Print your story\nin a real book',
      'hero.bookDesc': 'Ancient cover · gift · unique tome for your shelf',
      'hero.bookBtn': '📦 Order Book',

      // Story Form
      'form.kicker': 'New Universe',
      'form.title': 'How to start your story?',
      'form.titleLabel': 'Title',
      'form.titlePlaceholder': 'Ashes of Orelia',
      'form.languageLabel': 'Language / Story Language',
      'form.languageNote': 'AI will generate scenes and dialogues in this language',
      'form.descLabel': 'Universe Description',
      'form.descPlaceholder': 'A city where stars fade, and a woman who remembers it alive…',
      'form.creationLabel': 'How to create',
      'form.guidedIcon': '🪶',
      'form.guidedTitle': 'Step by step with author',
      'form.guidedDesc': 'Canon → scene → "what next?" → scene. You guide the story with decisions.',
      'form.autoIcon': '⚡',
      'form.autoTitle': 'Auto-generate everything',
      'form.autoDesc': 'AI will write the entire volume at once. See what your universe creates.',
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
      'form.creating': 'Creating universe...',
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
      console.log('[i18n] Language already set to', lang, '- skipping');
      return; // Don't trigger events if language hasn't changed
    }
    console.log('[i18n] Changing language from', currentLang, 'to', lang);
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
