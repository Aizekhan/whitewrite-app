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
      'intent.customPlaceholder': 'Опишіть, що ви хочете побачити у наступній сцені...',

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
      'intent.customPlaceholder': 'Describe what you want to see in the next scene...',

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
      // Detect from browser
      const browserLang = navigator.language || navigator.userLanguage;
      currentLang = browserLang.startsWith('uk') ? 'uk' : 'en';
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
