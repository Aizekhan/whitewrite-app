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
      'form.descPlaceholder': 'Місто, де згасають зорі, і жінка, що пам'ятає його живим…',
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

      // UI Elements
      'ui.back': 'Back',
      'ui.home': 'Home',
      'ui.hideMenu': 'Hide menu for reading',
      'ui.navigation': 'Navigation',
      'ui.account': 'Account',
      'ui.guest': 'Guest',
      'ui.tokens': 'tokens',
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
  }

  // Set language
  function setLanguage(lang) {
    if (lang !== 'uk' && lang !== 'en') return;
    currentLang = lang;
    localStorage.setItem('ww-lang', lang);
    document.documentElement.lang = lang;

    // Update static translations
    updateStaticTranslations();

    // Trigger re-render of current view
    if (window.__fillAccount) {
      window.__fillAccount();
    }
    if (window.__reloadProjects) {
      window.__reloadProjects();
    }
    // Update navigation rail labels
    if (window.__reloadRail) {
      window.__reloadRail();
    }
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
