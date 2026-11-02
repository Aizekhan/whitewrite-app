# 📊 ЗВІТ ПОРІВНЯННЯ: React версія vs HTML Прототип

**Дата**: 2026-06-06
**Статус**: Систематичне порівняння завершено

---

## 📈 ЗАГАЛЬНА СТАТИСТИКА

| Сторінка | Прототип | Портовано | % | Відсутньо | % | Статус |
|----------|----------|-----------|---|-----------|---|--------|
| **Landing.tsx** | 126 елементів | 107 елементів | 85% | 19 елементів | 15% | ✅ Майже готово |
| **Book.tsx** | 257 елементів | 80 елементів | 30% | 177 елементів | 70% | ⚠️ Критично неповно |
| **WorldTree.tsx** | 309 елементів | 110 елементів | 36% | 199 елементів | 64% | ⚠️ Базова структура |
| **Workspace.tsx** | 189 елементів | 50 елементів | 26% | 139 елементів | 74% | 🔴 Мінімальна версія |
| **РАЗОМ** | **881 елемент** | **347 елементів** | **39%** | **534 елементи** | **61%** | **В ПРОЦЕСІ** |

---

## 🎯 КРИТИЧНІ ВІДСУТНІ КОМПОНЕНТИ (топ-20)

### Книга (Book.tsx)
1. 🔴 **Stage 0-1-2** (Onboarding flow: Start → Form → Ritual → Book) — ~40 елементів
2. 🔴 **The Keeper** (живий персонаж-гід з whispers) — ~12 елементів
3. 🔴 **3D Book Animation** (physical flip з rotateX/rotateY) — ~45 елементів
4. 🔴 **Scene Intent Page** (генерація наступної сцени з AI) — критично для narrative navigation
5. 🔴 **Inline Editing з Keeper Proposals** (AI-асистована редакція) — ~25 елементів

### Всесвіт (WorldTree.tsx)
6. 🔴 **Category Dropdown** (перемикання між категоріями без повернення до Tree)
7. 🔴 **Graph View** (ego-graph візуалізація звʼязків)
8. 🔴 **Connections Section** (відображення та редагування relationships)
9. 🔴 **Change Analysis Selector** (вибір типу зміни: rename/property/etc)
10. 🔴 **Reconstruction Execution** (реальний запуск реконструкції)

### Режисер (Workspace.tsx)
11. 🔴 **Sidebar Navigation** (rail з 7 tabs)
12. 🔴 **Characters Tab** (character cards + profile modal + relationships) — ~19 елементів
13. 🔴 **Locations Tab** (location grid + moodboard) — ~22 елементи
14. 🔴 **Memory Tab** (canon-derived memory) — ~17 елементів
15. 🔴 **Timeline Tab** (visual timeline з act tracks) — ~19 елементів
16. 🔴 **Real Image Generation** (Midjourney/Replicate API integration)
17. 🔴 **LoRA Training** (real training, не stub)
18. 🔴 **Dialogue Audio Integration** (TTS preview, lip-sync)
19. 🔴 **Автозбереження** (debounced save to Firestore)
20. 🔴 **Settings Tab** (project settings, export config)

---

## 📋 ДЕТАЛЬНІ ПОРІВНЯННЯ

---

## 1. LANDING.TSX vs WHITE.HTML

### ✅ ПОВНІСТЮ ПОРТОВАНО

#### Rail Navigation (Верхнє меню)
- ✅ `.rail` - верхня панель з gilded стилем
- ✅ `.rail__logo` - логотип (клікабельний, повертає на home)
- ✅ `.rail__brand` - "WhiteWrite" назва
- ✅ `.rail__div` - вертикальний роздільник
- ✅ `.rail__items` - навігаційні кнопки
- ✅ `.ritem` - gilded pill buttons (з `.is-on` стейтом)
- ✅ `.ritem__lbl` - лейбли кнопок
- ✅ `.rail__foot` - футер з кнопкою виходу
- ✅ `.ritem--icon` - іконкові кнопки (sign out)

#### User Dock (Лівий нижній кут)
- ✅ `.userdock` - панель користувача
- ✅ `.userdock__av` - аватар (з ініціалом або фото)
- ✅ `.userdock__info` - інформація
- ✅ `.userdock__name` - ім'я користувача
- ✅ `.userdock__tok` - токени (з ✦ іконкою)
- ✅ `.userdock__spark` - іконка зірки
- ✅ Клік → навігація на `/account`

#### Home View (Стартовий екран)
- ✅ `.screen--start` - стартовий екран
- ✅ `.hero-img` - фонове зображення (StartBack.jpg)
- ✅ `.hero-scrim` - градієнт overlay
- ✅ `.vignette` - віньєтка
- ✅ `.hero-quote` - цитата (правий верхній кут)
- ✅ `.hero-quote__orn` - орнамент "· ✦ ·"
- ✅ `.hero-panel` - центральна панель
- ✅ `.hero-title` - заголовок "Твоя історія чекає"
- ✅ `.hero-lede` - вступний текст
- ✅ `.hero-cta` - CTA кнопка "Створити свою історію"
- ✅ `.hero-cta__star` - ✦ іконка на кнопці
- ✅ `.hero-feature` - лівий нижній блок (🎬 Доведи історію до відео)
- ✅ `.hero-feature__beta` - "нова можливість" бейдж
- ✅ `.hero-feature__t` - заголовок
- ✅ `.hero-feature__d` - опис
- ✅ `.hero-buybook` - правий нижній блок (📦 Надрукуй книгу)
- ✅ `.hero-buybook__beta` - "бета" бейдж
- ✅ `.hero-buybook__t` - заголовок
- ✅ `.hero-buybook__d` - опис
- ✅ `.hero-buybook__btn` - кнопка "Замовити книгу"

#### Narratives View (Проекти)
- ✅ `.view` - контейнер view з радіальними градієнтами
- ✅ `.vwrap` - обгортка вмісту
- ✅ `.vhead__k` - kicker "WhiteWrite · твоя бібліотека"
- ✅ `.vhead__t` - заголовок "Твої наративи"
- ✅ `.vhead__s` - підзаголовок-опис
- ✅ `.vsec-h` - секційний заголовок "У роботі"
- ✅ `.grid--narr` - сітка карток (280px)
- ✅ `.ncard` - картка проєкту
- ✅ `.ncard__cover` - обкладинка (з градієнтом `--c1`, `--c2`)
- ✅ `.ncard__badge` - бейдж статусу (активний/чернетка)
- ✅ `.badge--active` / `.badge--draft` - стилі статусів
- ✅ `.ncard__edit` - кнопка редагування (олівець)
- ✅ `.ncard__del` - кнопка видалення (смітник)
- ✅ `.ncard__mark` - літера (перша буква назви)
- ✅ `.ncard__b` - тіло картки
- ✅ `.ncard__title` - назва проєкту
- ✅ `.ncard__meta` - мета-інформація
- ✅ `.ncard__desc` - опис (обрізаний до 2 рядків)
- ✅ `.ncard__open` - кнопка "Відкрити всесвіт"
- ✅ `.ncard--new` - картка створення нового проєкту

#### Marketplace View
- ✅ `.view[data-view="market"]` - view маркетплейсу
- ✅ `.vhead__k` - "Спільнота"
- ✅ `.vhead__t` - "Маркетплейс історій"
- ✅ `.vhead__s` - опис
- ✅ `.vsec-h` - "Що читають зараз"
- ✅ `.grid--mk` - сітка карток (248px)
- ✅ `.mk` - картка роботи
- ✅ `.mk__cover` - обкладинка (з градієнтом)
- ✅ `.mk__genre` - жанр (overlay на обкладинці)
- ✅ `.mk__b` - тіло картки
- ✅ `.mk__title` - назва роботи
- ✅ `.mk__author` - автор
- ✅ `.mk__foot` - футер
- ✅ `.stars` - зірки рейтингу (SVG)
- ✅ `.mk__rate` - числовий рейтинг

#### Knowledge Base View
- ✅ `.view[data-view="kb"]` - view бази знань
- ✅ `.vhead__k` - "Гайди й принципи"
- ✅ `.vhead__t` - "База знань"
- ✅ `.vhead__s` - опис
- ✅ `.kb-search` - пошукова панель
- ✅ `.kb-search__ic` - іконка компаса
- ✅ `input` - поле пошуку
- ✅ `.kb-search__x` - кнопка очистки (✕)
- ✅ `.kb-cats` - ряд категорій
- ✅ `.kb-cat` - кнопка категорії (з `.is-on`)
- ✅ `.grid--kb` - сітка статей (240px)
- ✅ `.kb` - картка статті
- ✅ `.kb__top` - верхня панель
- ✅ `.kb__ic` - іконка
- ✅ `.kb__cat` - назва категорії
- ✅ `.kb__title` - заголовок статті
- ✅ `.kb__lead` - опис
- ✅ `.kb__min` - "X хв читання"
- ✅ Порожній стан ("Нічого не знайдено")

#### KB Article Reader
- ✅ `.kb-reader` - модальний overlay
- ✅ `.kb-reader.is-on` - показаний стан
- ✅ `.art` - контейнер статті
- ✅ `.art__x` - кнопка закриття (✕)
- ✅ `.art__head` - заголовок статті
- ✅ `.art__cat` - категорія
- ✅ `.art__title` - назва статті
- ✅ `.art__lead` - вступ
- ✅ `.art__meta` - мета (час читання)
- ✅ `.art__body` - тіло статті
- ✅ Рендеринг body елементів:
  - ✅ `p` - параграфи (з HTML)
  - ✅ `h` - заголовки
  - ✅ `ul` - списки (з ✦ bullets)
  - ✅ `tip` - підказки (💡)
  - ✅ `warn` - попередження (⚠️)
- ✅ `.art__related` - повʼязані статті
- ✅ `.art__related-grid` - сітка повʼязаних
- ✅ `.art__related-card` - картка повʼязаної статті
- ✅ `.art__related-icon` - іконка
- ✅ `.art__related-title` - назва
- ✅ `.art__related-cat` - категорія

#### Modals
- ✅ `AuthModal` - модал авторизації (окремий компонент)
- ✅ `StoryFormModalFull` - форма створення історії (окремий компонент)

---

### ❌ ВІДСУТНЄ / ВІДМІННОСТІ

#### Відсутні елементи:
1. ❌ `.rail__back` - кнопка "Назад" (в прототипі є, але прихована)
2. ❌ `.rail__collapse` - кнопка згортання меню (в прототипі є для читання книги)
3. ❌ `.homefab` - кнопка "⌂ На головну" (правий верхній кут)
4. ❌ `.feedback-fab` - FAB кнопка зворотного зв'язку (правий нижній кут)
5. ❌ `.ncard__delbar` - 5-секундний прогрес-бар підтвердження видалення
   - ❌ `.delbar__fill` - прогрес-бар
   - ❌ `.delbar__txt` - текст з кнопкою "Скасувати"
6. ❌ `.home-hero` - версія героя в прототипі (відрізняється від `.screen--start`)
7. ❌ `.hero-tagline` - цитата зліва
8. ❌ `.hero-mark` - логотип/wordmark
9. ❌ `.hero-pitch` - питч-лайни знизу
10. ❌ `.hero-news` - панель новин (правий нижній кут на home view)

#### Відсутні views:
11. ❌ `NEWS VIEW` - вкладка новин
12. ❌ `ACCOUNT VIEW` - профіль (є окрема сторінка `/account`, але не view в Landing)

#### Відсутні модалі в Landing:
13. ❌ `Project Edit Modal` - редагування проєкту (кнопка є, але без функції)
14. ❌ `Delete Confirmation Modal` - підтвердження видалення
15. ❌ `Feedback Modal` - форма зворотного зв'язку
16. ❌ `Buy Book Modal` - модал замовлення книги

#### Функціональні відмінності:
17. ⚠️ **Delbar анімація**: В React версії видалення відбувається миттєво через `handleDeleteProject`. В прототипі є 5-секундний countdown з можливістю скасування.
18. ⚠️ **Edit modal**: Кнопка редагування є, але написано `/* TODO: edit modal */` - функція не реалізована.
19. ⚠️ **StoryForm**: Використовується `StoryFormModalFull` (повноекранний з DeskBg.jpg), а не inline форма в shell.

#### Стилістичні відмінності:
20. ⚠️ **Home view структура**:
   - Прототип: `.home-hero` в `.view` контейнері з hero-секцією
   - React: окремий `.screen--start` (повноекранний, не в `.view`)
21. ⚠️ **Particles**: В прототипі є canvas particles, в React немає
22. ⚠️ **Animations**: Деякі анімації можуть відрізнятися (напр. `@keyframes viewIn`, `heroDrift`)

#### Дані:
23. ⚠️ **KB Articles**: 22 статті імпортуються з `@/data/kb-articles.ts` (портовано з `kb.js`)
24. ⚠️ **Marketplace**: Моки з 6 робіт (в прототипі більше даних)
25. ⚠️ **Projects**: Реальні дані з Firestore (getUserProjects)

---

### 🔧 ТЕХНІЧНІ ВІДМІННОСТІ

#### Framework:
- **Прототип**: Vanilla HTML/CSS/JS, inline стилі
- **React**: TypeScript, React Router, окремі CSS файли

#### Навігація:
- **Прототип**: `showView(v)` функція з `data-view` атрибутами
- **React**: `useState<View>` з умовним рендерингом

#### Стилі:
- **Прототип**: Всі стилі в `<style>` тегу (385 рядків)
- **React**:
  - `landing.css` - стилі home екрану
  - `views.css` - стилі для narr/market/kb views

#### Firebase:
- **Прототип**: Немає backend
- **React**: Firebase Auth + Firestore (реальні проєкти, автентифікація)

---

## 2. BOOK.TSX vs WHITEWRITE.HTML

### ✅ ПОРТОВАНО (Спрощена версія)

#### Основна структура
- ✅ `.world.reading` - основний контейнер
- ✅ `.vignette` - віньєтка
- ✅ `.brand` - логотип (top-left, повернення на головну)
- ✅ `.pillswitch--fixed` - перемикач стовпів (Книга/Всесвіт/Режисер)
- ✅ `.photobook` - контейнер книги з фоном OpenedBook.jpg
- ✅ `.photobook__img` - фонове зображення книги
- ✅ `.photobook__pages` - зона сторінок (1536×1024px)
- ✅ `.opage--left / .opage--right` - ліва/права сторінки
- ✅ `.opage__fade` - fade-in анімація при зміні сторінок
- ✅ `.userdock` - аватар користувача (bottom-left)

#### Навігація сторінок
- ✅ `.pturn--prev / .pturn--next` - кнопки перегортання (‹ / ›)
- ✅ Keyboard navigation (ArrowLeft, ArrowRight, Escape)
- ✅ Auto-disable на першій/останній сторінці
- ✅ `.bookbar` - панель знизу з елементами керування
- ✅ `.pager` - індикатор сторінок з точками
- ✅ Динамічне вікно пейджера (показує 7 точок, решта згорнуті в ...)

#### Scene Management
- ✅ `.scenebar__pick` - вибір сцени
- ✅ `.scenebar__btn` - кнопка поточної сцени (з номером і назвою)
- ✅ `.scenebar__menu` - dropdown меню всіх сцен
- ✅ `.scenebar__scrim` - затемнення при відкритому меню
- ✅ `.scenebar__opt` - опція сцени в меню (з номером, назвою, актом)
- ✅ `.scenebar__nav` - стрілки переходу між сценами
- ✅ State management (поточна сцена, поточна сторінка)

#### Edit Mode
- ✅ `.bookbar__edit` - кнопка редагування (з `.is-on` стейтом)
- ✅ Toggle між READ/EDIT режимами
- ✅ `.opage--full` - повноекранна сторінка для редагування
- ✅ `SceneEditor` компонент (імпортований)
- ✅ `sceneTexts` state для збереження змін

#### Bookmarks (Canon Links)
- ✅ `.bookmarks` - вертикальні закладки (right edge)
- ✅ `.bm` - закладка категорії (characters/locations/events/factions/artifacts)
- ✅ `.bm__glyph` - іконка категорії
- ✅ `.bm__n` - кількість сутностей
- ✅ `.bm--explore` - закладка налаштувань тексту (Aa)
- ✅ `.bm.is-active` - активна закладка
- ✅ `.bm-scrim` - затемнення при відкритому popover
- ✅ `.bm-pop` - popover з списком сутностей
- ✅ `.bm-pop__head` - заголовок popover
- ✅ `.bm-pop__list` - список сутностей
- ✅ `.bm-item` - елемент списку
- ✅ `.bm-item__dot` - кольорова крапка (за категорією)
- ✅ `.bm-item__t` - назва сутності
- ✅ `.bm-item__go` - стрілка переходу
- ✅ Клік на сутність → навігація до WorldTree

#### Text Settings
- ✅ `.bm-pop--text` - popover налаштувань
- ✅ `.ts-group` - група налаштувань
- ✅ `.ts-lbl` - лейбл групи
- ✅ `.ts-row` - ряд кнопок
- ✅ `.ts-btn` - кнопка вибору шрифту (4 варіанти)
- ✅ `.ts-btn.is-on` - обраний шрифт
- ✅ Size adjustment (А⁻ / А⁺ / reset)
- ✅ Застосування через CSS Custom Properties (`--book-font`, `--book-size`)

#### Page Content
- ✅ `.page-inner` - вміст сторінки
- ✅ `.page-header` - заголовок сцени
- ✅ `.page-header__kicker` - "Акт I"
- ✅ `.page-header__title` - назва сцени
- ✅ `.prose` - основний текст
- ✅ `.prose__em` - курсив
- ✅ `.folio` - номер сторінки (римські цифри)

#### Data & State
- ✅ MOCK_CANON - структура канону (characters, locations, events, factions, artifacts)
- ✅ SCENE_CANON - зв'язок сцен до сутностей
- ✅ SCENE_TEXTS - текстові версії для редагування
- ✅ MOCK_SCENES - повні сцени з JSX spreads
- ✅ 2 сцени × 2 розвороти
- ✅ Bookmark icons & colors per category

---

### ❌ ВІДСУТНЄ / КРИТИЧНІ ВІДМІННОСТІ

#### Stage Flow (Онбординг відсутній повністю)
1. ❌ **STAGE 0** - Start Screen (з Keeper)
   - ❌ `.screen--start` в книзі (відрізняється від Landing)
   - ❌ `.hero-img` - фон з Keeper
   - ❌ `.hero-scrim`, `.particles`, `.vignette`
   - ❌ `.hero-mark` - wordmark
   - ❌ `.hero-tagline` - цитата
   - ❌ `.hero-panel` - центральна панель
   - ❌ `.hero-cta` - кнопка початку
   - ❌ `.hero-hint` - підказка
   - ❌ `.hero-genres` - жанри
   - ❌ `.hero-buybook` - замовлення книги
   - ❌ `.hero-feature` - фіча
   - ❌ `.hero-pitch` - pitch lines
   - ❌ `.hero-news` - новини

2. ❌ **STAGE 1** - Form Screen (створення всесвіту)
   - ❌ `.screen--form` - екран форми з DeskBg.jpg
   - ❌ `.form-parch` - пергаментна форма
   - ❌ `.form-inner` - внутрішній контент
   - ❌ `.form-head` - заголовок форми
   - ❌ `.form-kicker` - kicker
   - ❌ `.form-title` - заголовок
   - ❌ `.field` - поле форми
   - ❌ `.field__label`, `.field__hint`, `.field__input`, `.field__area`, `.field__note`
   - ❌ `.modecards` - вибір режиму (Guided/Auto)
   - ❌ `.modecard` - картка режиму
   - ❌ `.chips` - жанри/тони
   - ❌ `.chip` - чіп
   - ❌ `.seg` - сегментований контрол (scope)
   - ❌ `.wslider` - слайдер dialogue intensity
   - ❌ `.form-foot` - футер
   - ❌ `.link-back` - кнопка назад
   - ❌ `.create-btn` - кнопка створення

3. ❌ **STAGE 2** - Ritual Screen (анімація генерації)
   - ❌ `.ritual` - екран ритуалу
   - ❌ `.ritual__video` - відео фон
   - ❌ `.ritual__veil` - вуаль
   - ❌ `.ritual__center` - центральний контент
   - ❌ `.ritual__glow` - світіння
   - ❌ `.ritual__mark` - символ (обертається)
   - ❌ `.ritual__text` - "Творення всесвіту…"
   - ❌ `.ritual__premise` - премісса
   - ❌ `.ritual__dots` - анімовані крапки
   - ❌ `.ritual__fade` - затемнення
   - ❌ `.is-closing` стан

#### The Keeper (Хранитель - відсутній повністю)
4. ❌ `.keeper--cover` - хранитель на обкладинці (правий край)
5. ❌ `.keeper--reading` - хранитель при читанні (лівий край, opacity 0.5)
6. ❌ `.keeper__figure` - фігура
7. ❌ `.keeper__halo` - ореол (breathing animation)
8. ❌ `.keeper__robe` - мантія
9. ❌ `.keeper__hood` - капюшон
10. ❌ `.keeper__rim` - обідок світла
11. ✅ `.keeper__whisper` - шепіт (є, але статичний, без `.is-shown` logic)

#### 3D Book (Відсутня повністю)
12. ❌ `.stage` - 3D сцена (perspective: 2600px)
13. ❌ `.book` - 3D книга (transform-style: preserve-3d)
14. ❌ `.book--closed` - закрита книга (rotateX(6deg) scale(.96))
15. ❌ `.book--opening` - відкривається (rotateX(2deg))
16. ❌ `.book--reading` - читається (rotateX(1deg))
17. ❌ `.book__spine` - корінець книги
18. ❌ `.leaf--left / .leaf--right` - базові сторінки з текстурою
19. ❌ `.leaf__paper` - текстура паперу
20. ❌ `.leaf__gutter` - жолобок (тінь біля корінця)

#### Cover (Закрита обкладинка - відсутня)
21. ❌ `.cover` - закрита обкладинка (z-index: 20)
22. ❌ `.cover__leather` - шкіра обкладинки
23. ❌ `.cover__leather::after` - текстура шкіри
24. ❌ `.cover__frame` - золота рамка
25. ❌ `.cover__emblem` - емблема ✦
26. ❌ `.cover__kicker` - kicker над назвою
27. ❌ `.cover__title` - назва книги (gradient text)
28. ❌ `.cover__rule` - роздільник
29. ❌ `.cover__hint` - "клацніть, щоб відкрити" (pulse animation)
30. ❌ `@keyframes openCover` - анімація відкривання (rotateY -162deg)

#### Flipper (3D перегортання - відсутнє)
31. ❌ `.flipper--next / .flipper--prev` - 3D перегортач
32. ❌ `.flipper__face` - грань (backface-visibility: hidden)
33. ❌ `.flipper__front / .flipper__back` - лицева/зворотна сторони
34. ❌ `.flipper__shade` - динамічна тінь при flip
35. ❌ `@keyframes flipNext` - rotateY(0 → -180deg)
36. ❌ `@keyframes flipPrev` - rotateY(0 → 180deg)
37. ❌ `@keyframes faceFront` - fade front (opacity 1 → 0 at 50%)
38. ❌ `@keyframes faceBack` - fade back (opacity 0 → 1 at 50%)
39. ❌ `@keyframes shade` - тінь (0 → 0.55 → 0)

#### Atmosphere & Effects
40. ❌ `.ambient` - ambient glow (breathing animation)
41. ❌ `@keyframes breathe` - пульсуюче дихання (opacity 0.85 → 1)
42. ❌ `.particles` - canvas з частинками
43. ❌ Radial gradients (gold/brown atmospheric lighting)
44. ❌ `.phase-closed`, `.phase-opening`, `.phase-reading` - класи фаз

#### Navigation (верхня панель - відсутня)
45. ❌ `.ribbon` - верхнє меню (ховається при hover-off)
46. ❌ `.ribbon__brand` - бренд
47. ❌ `.ribbon__sep` - роздільник
48. ❌ `.ribbon__universe` - назва всесвіту
49. ❌ `.ribbon__close` - кнопка закриття

#### Turn UI (додаткові елементи)
50. ❌ `.peel` - куточок перегортання (hover effect)
51. ❌ `.turn--prev / .turn--next` - великі кнопки перегортання (‹ / ›)

#### Whisper Rail (відсутня)
52. ❌ `.whisper-rail` - панель шепоту (лівий нижній кут)
53. ❌ `.whisper-rail__mark` - маркер
54. ❌ `.whisper-rail__text` - текст шепоту
55. ❌ `.whisper-rail__who` - автор шепоту
56. ❌ `.is-shown` toggle logic

#### Special Page Types (відсутні)
57. ❌ **Title Page**
   - ❌ `.page-title` - титульна сторінка
   - ❌ `.title-mark` - символ
   - ❌ `.title-kicker` - kicker
   - ❌ `.title-name` - назва
   - ❌ `.title-sub` - підзаголовок
   - ❌ `.title-orn` - орнамент
   - ❌ `.title-epigraph` - епіграф

58. ❌ **Scene Intent Page** (кінець сцени)
   - ❌ `.page-intent` - сторінка наміру
   - ❌ `.intent__lead` - вступний текст
   - ❌ `.intent__opts` - опції наміру
   - ❌ `.intent-opt` - опція (Конфлікт/Розвиток/Екшн/Романтика/тощо)
   - ❌ `.intent-opt__ic` - іконка
   - ❌ `.intent-opt__t` - заголовок
   - ❌ `.intent-opt__d` - опис
   - ❌ `.intent-field` - поля форми
   - ❌ `.intent-field__lbl` - лейбл
   - ❌ `.intent-select` - select POV
   - ❌ `.intent-note` - textarea нотаток
   - ❌ `.intent-gen` - кнопка генерації
   - ❌ `.quill` - кнопка продовження

59. ❌ **Characters Page**
   - ❌ `.char` - картка персонажа
   - ❌ `.char__portrait` - портрет (placeholder)
   - ❌ `.char__name` - ім'я
   - ❌ `.char__role` - роль
   - ❌ `.char__lines` - репліки

60. ❌ **Map Page**
   - ❌ `.page-map` - сторінка карти
   - ❌ `.map` - контейнер карти
   - ❌ `.map__plate` - плитка карти (placeholder)
   - ❌ `.map__pin` - маркер на карті
   - ❌ `.map__dot` - крапка
   - ❌ `.map__name` - назва локації
   - ❌ `.map__compass` - компас

61. ❌ **Writing Page**
   - ❌ `.writing` - contentEditable поле письма
   - ❌ `.writing__caret-hint` - підказка каретки
   - ❌ Ruled lines background

#### Inline Editing & Proposals (відсутні)
62. ❌ `.se-hint` - підказка редагування
63. ❌ `.se-prose` - редагований текст
64. ❌ `.se-prose.is-editing` - стан редагування
65. ❌ `.se-edittoggle` - кнопка toggle редагування (прихована)
66. ❌ `.se-added` - додані елементи
67. ❌ `.se-added__k` - лейбл
68. ❌ `.se-added__chip` - чіп доданого
69. ❌ **Keeper Proposals**:
   - ❌ `.se-keeper` - блок пропозицій хранителя
   - ❌ `.se-keeper__head` - заголовок
   - ❌ `.se-keeper__sig` - підпис ✦
   - ❌ `.se-prop` - пропозиція
   - ❌ `.se-prop__t` - текст пропозиції
   - ❌ `.se-prop__d` - опис
   - ❌ `.se-prop__types` - типи змін
   - ❌ `.se-type` - тип (з `.is-on`)
   - ❌ `.se-prop__acts` - дії (прийняти/відхилити)
   - ❌ `.se-btn--ok` - прийняти
   - ❌ `.se-btn--warn` - видалити
   - ❌ `.se-prop--warn` - warning пропозиція
70. ❌ **Coach**:
   - ❌ `.se-coach` - блок коуча
   - ❌ `.se-coach__t` - заголовок
   - ❌ `.se-coach__d` - опис
   - ❌ `.se-coach__btn` - кнопка дії

#### Placeholders (відсутні)
71. ❌ `.placeholder` - striped placeholder
72. ❌ `.placeholder__label` - лейбл (monospace)

#### Advanced Typography
73. ❌ `.prose__cap` - drop cap (велика перша літера)
74. ❌ `.margin-note` - примітка на полях
75. ❌ `.margin-note__rune` - руна ✦
76. ❌ `.margin-note__body` - текст примітки
77. ❌ `text-wrap: pretty` - сучасне форматування
78. ❌ `hyphens: auto` - автоматичні переноси

---

### ⚠️ ФУНКЦІОНАЛЬНІ ВІДМІННОСТІ

#### Архітектура
1. **Прототип**: 4 стадії (Start → Form → Ritual → Book)
   - **React**: Лише Book stage, без онбордингу
2. **Прототип**: 3D книга з фізичною анімацією відкривання й перегортання
   - **React**: 2D photobook з fade-переходами
3. **Прототип**: Keeper як живий персонаж зі шепотом
   - **React**: Keeper відсутній
4. **Прототип**: Inline editing з AI-пропозиціями від Keeper
   - **React**: SceneEditor компонент (окремий, без proposals)
5. **Прототип**: Scene Intent після кожної сцени
   - **React**: Відсутній (генерація не реалізована)

#### Дані
6. **Прототип**: Динамічна генерація сцен через форму
   - **React**: MOCK_SCENES (захардкоджені 2 сцени)
7. **Прототип**: Текстурований папір, шкіряна обкладинка
   - **React**: Фотореалістичне зображення OpenedBook.jpg
8. **Прототип**: Різні типи сторінок (title, text, intent, characters, map, writing)
   - **React**: Лише text pages

#### UX
9. **Прototip**: Ribbon (верхнє меню ховається)
   - **React**: Pillswitch (завжди видимий)
10. **Прototип**: Whisper rail (лівий нижній) + Keeper whisper
   - **React**: Лише user dock (без whisper logic)
11. **Прототип**: Turn buttons (великі ‹ / ›)
   - **React**: `.pturn` (маленькі стрілки на photobook)
12. **Прототип**: Peel corner (інтерактивний куточок)
   - **React**: Відсутній

#### Стиль
13. **Прототип**: Пергаментний фон з текстурами
   - **React**: Фото OpenedBook.jpg як фон
14. **Прототип**: `--parch` колір (бежевий, #ece0c4)
   - **React**: Реальне фото книги
15. **Прототип**: `Philosopher` font для прози
   - **React**: Налаштовується (4 варіанти)
16. **Прототип**: `--leaf-w`, `--leaf-h` CSS vars (responsive)
   - **React**: Фіксовані 1536×1024px

---

### 📊 СТАТИСТИКА

**Book.tsx прогрес: ~30%**

#### Є (спрощена версія):
- ✅ Photobook з navigation (30 елементів)
- ✅ Bookmarks + Text settings (25 елементів)
- ✅ Scene picker + Edit mode (15 елементів)
- ✅ User dock + Pillswitch (10 елементів)

#### Відсутні критичні елементи:
- ❌ Stages 0-1-2 (онбординг, ~40 елементів)
- ❌ Keeper (~12 елементів)
- ❌ 3D Book + Cover + Flipper (~45 елементів)
- ❌ Atmosphere (ambient, particles, ~5 елементів)
- ❌ Ribbon, Turn buttons, Peel, Whisper rail (~15 елементів)
- ❌ Special pages (Intent, Characters, Map, Writing, ~30 елементів)
- ❌ Inline editing + Proposals (~25 елементів)
- ❌ Advanced typography (~5 елементів)

**Всього відсутніх елементів: ~177 з 250 (~70%)**

---

### 🎯 ПРІОРИТЕТИ BOOK.TSX

1. **Критичний** (без цього книга не працює):
   - ❌ Scene Intent - генерація наступної сцени
   - ❌ Inline editing з Keeper proposals
   - ❌ Writing page (чистий аркуш)

2. **Високий** (UX страждає):
   - ❌ 3D Book анімація (фізичне відчуття)
   - ❌ Keeper whisper (живість)
   - ❌ Ribbon (очищує екран при читанні)
   - ❌ Special pages (Characters, Map)

3. **Середній** (поліпшує враження):
   - ❌ Stages 0-1-2 (онбординг)
   - ❌ Particles, ambient effects
   - ❌ Advanced typography (drop cap, margin notes)
   - ❌ Peel corner, Turn buttons

4. **Низький** (декоративне):
   - ❌ Placeholders з striped pattern
   - ❌ Whisper rail (дублює user dock)

---

## 3. WORLDTREE.TSX vs WORLDTREE.HTML

### 📊 СТАТИСТИКА

**Прототип**: ~309 CSS-елементів + компонентів
**React версія**: ~110 елементів портовано (~36%)
**Відсутньо**: ~199 елементів (~64%)

---

### ✅ ПОРТОВАНО (базова структура, ~110 елементів)

#### Tree Stage (основна сцена)
- ✅ `.tree-stage` - контейнер з радіальними градієнтами
- ✅ `.tree-frame` - responsive frame з `treeIn` анімацією
- ✅ `.tree-img` - зображення дерева (/world-tree.jpg)
- ✅ `.node` - контейнер вузла (абсолютне позиціонування)
- ✅ `.node__orb` - золота сфера (40-58px, радіальний градієнт)
- ✅ `.node__pulse` - пульсуюче кільце (3.2s анімація)
- ✅ `.node__label` - tooltip підпис (opacity 0→1 on hover)
- ✅ `.node__label.is-bot` / `.is-top` - позиціонування знизу/зверху
- ✅ `.node__title` - назва категорії (Cinzel, 16px, gold-bright)
- ✅ `.node__kicker` - підзаголовок (type · count)
- ✅ `.node--core` - центральний вузол Хроніки (58-82px, більше світіння)
- ✅ `.tree-hint` - підказка знизу (animated pulse)
- ✅ `.tree-hint__mark` - акцент "✦"
- ✅ Hover states (`.is-hot`, scale 1.22, посилене світіння)
- ✅ Click handlers → відкриття CategoryWorkspace/ChronicleWorkspace

#### Brand + Navigation
- ✅ `.brand` - логотип + назва (fixed top-left)
- ✅ `.brand__logo` - SVG іконка (36px)
- ✅ `.brand__name` - "WhiteWrite" (Cinzel serif, 18px)
- ✅ `.brand__tag` - "White Tree" (10px uppercase)
- ✅ `.pillswitch` - перемикач стовпів (Книга·Всесвіт·Режисер)
- ✅ `.pillswitch--fixed` - fixed top-right
- ✅ `.pillswitch__b` - кнопка стовпа (13.5px, 500 weight)
- ✅ `.pillswitch__b.is-here` - активний стан (gold-soft bg)
- ✅ Навігація між /book/:id, /worldtree/:id, /workspace/:id

#### User Dock
- ✅ `.userdock` - панель користувача (bottom-left)
- ✅ `.userdock__av` - аватар (фото або ініціал)
- ✅ `.userdock__info` - інформація
- ✅ `.userdock__name` - ім'я/email
- ✅ `.userdock__tok` - токени (∞ placeholder)
- ✅ Click → /account

#### Category Workspace (CategoryWorkspace.tsx, ~50 елементів)
- ✅ `.ws` - workspace контейнер (fixed inset, z-index 45, `wsIn` animation)
- ✅ `.ws-head` - header (flex, 64px height, backdrop blur)
- ✅ `.ws-back` - кнопка "До дерева"
- ✅ `.ws-head__ring` - іконка категорії (colored)
- ✅ `.ws-head__title` - назва категорії (22px)
- ✅ `.ws-count` - лічильник (X/Y)
- ✅ `.ws-bar` - toolbar (search + view toggle)
- ✅ `.ws-search` - пошук (з іконкою, focus → gold border)
- ✅ `.ws-views` - перемикач view (cards/list)
- ✅ `.ws-view` - кнопка view (з іконкою grid/layers)
- ✅ `.ws-view.is-on` - активний view (gold-soft bg)
- ✅ `.ws-split` - split layout (1fr / 388px)
- ✅ `.ws-main` - ліва панель (overflow-y, padding)
- ✅ `.ws-aside` - права панель (profile, bg-1)

##### Card View
- ✅ `.wcards` - сітка карток (auto-fill minmax(224px, 1fr))
- ✅ `.wcard` - картка сутності (bg-2, 12px radius, hover → translateY(-2px))
- ✅ `.wcard.is-active` - активна картка (gold border)
- ✅ `.wcard__media` - медіа секція (132px height)
- ✅ `.wcard__scrim` - градієнт overlay
- ✅ `.wcard__ic` - іконка типу (30x30px, colored)
- ✅ `.wcard__stat` - статистика (X сц.)
- ✅ `.wcard__b` - тіло картки
- ✅ `.wcard__row` - верхній рядок
- ✅ `.ent-name` - назва сутності (Cinzel, 16.5px)
- ✅ `.ent-sub` - підзаголовок (12px, tx-mid)
- ✅ `.wcard__blurb` - опис (line-clamp 2)
- ✅ `.wcard--new` - кнопка додавання (dashed border, hover → gold)

##### List View
- ✅ `.wrows` - список рядків (flex column, gap 7px)
- ✅ `.wrow` - рядок сутності (flex, hover → bg-hover)
- ✅ `.wrow.is-active` - активний рядок (gold border + bg)
- ✅ `.wrow__id` - колонка ID
- ✅ `.wrow__name` - назва (Cinzel, 15px, ellipsis)
- ✅ `.wrow__sub` - підзаголовок (12px)
- ✅ `.wrow__stat` - статистика (monospace)
- ✅ `.wrow--new` - кнопка додавання рядка

##### Profile Panel (права панель)
- ✅ `.profile` - контейнер профілю (flex column)
- ✅ `.profile--empty` - порожній стан ("Оберіть сутність...")
- ✅ `.profile__hero` - hero секція (relative, 16px padding)
- ✅ `.profile__scrim` - градієнт overlay
- ✅ `.profile__cap` - caption overlay (absolute bottom)
- ✅ `.profile__k` - kicker label (10.5px uppercase)
- ✅ `.profile__title` - назва сутності (Cinzel 700, 19-24px, contentEditable)
- ✅ `.profile__edit` - кнопка редагування (top-left, 32x32px)
- ✅ `.profile__edit.is-on` - активний режим редагування
- ✅ `.profile__cancel` - кнопка скасування (X)
- ✅ `.profile__body` - тіло профілю (18px padding)
- ✅ `.dprose` - текст опису (14px, line-height 1.6)
- ✅ `.dblk` - блок даних (22px margin-bottom)
- ✅ `.blk-h` - заголовок блоку (Cinzel 600, 14px, з іконкою)
- ✅ `.prof-edit` - поле редагування (contentEditable, dashed gold border)
- ✅ `.prof-edit__hint` - підказка (12px italic)
- ✅ Inline editing (contentEditable на title + desc)

##### Impact Bar (реконструкція)
- ✅ `.impactbar` - секція впливу (border-top)
- ✅ `.impactbar--empty` - порожній стан ("Не використано в наративі")
- ✅ `.impactbar__top` - верхній рядок
- ✅ `.impactbar__lead` - лід текст ("Впливає на 12 елементів")
- ✅ `.impactbar__btn` - кнопка "Реконструкція" (gold-lit)
- ✅ `.impactbar__chips` - чіпи впливу
- ✅ `.impactbar__chip` - чіп (3 сцен, 5 діал., etc)
- ✅ Click → відкриття ReconstructionOverlay

#### Chronicle Workspace (ChronicleWorkspace.tsx, ~35 елементів)
- ✅ `.ws.chron` - workspace хроніки (createPortal → body)
- ✅ `.ws-head` - header з кнопкою редагування
- ✅ `.ws-back` - кнопка "До дерева"
- ✅ `.ws-head__ring` - іконка scroll
- ✅ `.ws-head__title` - "Хроніка"
- ✅ Edit/Save buttons (з іконками check/edit)
- ✅ `.chron__body` - тіло хроніки (overflow-y, padding)
- ✅ `.world-hero` - hero секція (border-radius 16px)
- ✅ `.world-hero__scrim` - градієнт overlay
- ✅ `.world-hero__cap` - caption область
- ✅ `.world-hero__k` - "Канон" label
- ✅ `.world-hero__tag` / `.chron-edit__tag` - tagline (editable input in edit mode)
- ✅ `.sec-cols` - two-column layout (1.15fr / 0.85fr)
- ✅ `.sec-prose` / `.chron-edit__sum` - summary (editable textarea)
- ✅ `.kv` - key-value таблиця (striped rows)
- ✅ `.kv__row` - рядок
- ✅ `.kv__k` - ключ (40%, uppercase)
- ✅ `.kv__v` - значення (flex 1)
- ✅ `.rules` - список правил світу
- ✅ `.rule` - правило (numbered)
- ✅ `.rule__n` - номер (monospace, gold-lit)
- ✅ `.rule--edit` - режим редагування
- ✅ `.chron-edit__rule` - input для правила
- ✅ `.rule__del` - кнопка видалення (X)
- ✅ `.chron-edit__add` - кнопка додавання правила
- ✅ `.chron-list` - timeline подій
- ✅ `.chron-ev` - подія (flex, hover → gold)
- ✅ `.chron-ev__dot` - колірна точка (tone indicator)
- ✅ `.chron-ev__when` - timestamp (monospace, 74px)
- ✅ `.chron-ev__t` - назва події (ellipsis)
- ✅ `.chron-ev__act` - акт (uppercase)
- ✅ `.chron-cats` - кнопки категорій
- ✅ `.chron-cat` - кнопка категорії (hover → gold)
- ✅ `.chron-cat__n` - назва категорії
- ✅ `.chron-cat__c` - лічильник (monospace badge)
- ✅ Edit mode (inline editing з draft state)

#### Reconstruction Overlay (ReconstructionOverlay.tsx, ~25 елементів базових)
- ✅ `.rc-scrim` - overlay scrim (fixed inset, z-index 70)
- ✅ `.rc` - dialog контейнер (720px max-width)
- ✅ `.rc__head` - header (sticky, gradient bg)
- ✅ `.rc__k` - kicker label
- ✅ `.rc__title` - назва сутності
- ✅ `.rc__x` - кнопка закриття
- ✅ `.rc__body` - тіло діалогу
- ✅ `.rc-summary` - summary блок
- ✅ `.rc-layer` - шар (Narrative/Director)
- ✅ `.rc-layer__h` - заголовок шару
- ✅ `.rc-layer__n` - лічильник шару
- ✅ `.rc-kind` - тип зміни (scenes/dialogues/etc)
- ✅ `.rc-kind__h` - заголовок типу
- ✅ `.rc-kind__n` - лічильник типу
- ✅ `.rc-kind__items` - список елементів
- ✅ `.rc-pill` - pill елемент
- ✅ `.rc-plan` - секція плану
- ✅ `.rc-plan__h` - заголовок плану
- ✅ `.rc-empty` - порожній стан
- ✅ `.rc__foot` - footer
- ✅ `.rc__note` - примітка
- ✅ `.rc__run` - кнопка запуску (disabled stub)
- ✅ `.rc__soon` - "СКОРО" badge
- ✅ Click outside → close (if not running)

---

### ❌ ВІДСУТНЄ (~199 елементів, 64%)

#### Tree Stage (15 елементів)
- ❌ `.tree-haze` - animated radial glow (8s pulse, blur 14px)
- ❌ `.tree-vig` - vignette overlay
- ❌ `.node--art` - illustrated emblem nodes (58-112px, з custom зображеннями)
- ❌ `.node__art` - image для art nodes (border-radius 50%, drop-shadow)
- ❌ `.node--art .node__orb` - larger orb без золотого фону
- ❌ Staggered pulse animations (nth-child delays: 0.5s, 1.1s, 1.7s, 2.3s, 0.9s)
- ❌ `.tree-stage.is-dim` - dim стан (brightness 0.42, blur 2px) при відкритті workspace
- ❌ Tree-specific positioning через % coordinates (x/y на tree image)
- ❌ Tree particles/ambient effects
- ❌ Tree connection lines (між nodes)
- ❌ Node state persistence (remember which nodes were visited)
- ❌ Node unlock/lock states
- ❌ Node progress indicators
- ❌ Node badges (new/updated indicators)
- ❌ Deep-linking support (`?type=&id=`)

#### Category Workspace (60+ елементів)

##### Header & Controls
- ❌ `.ws-cat` - category dropdown (динамічне перемикання між categories)
- ❌ `.ws-cat__btn` - кнопка dropdown (з chevron rotation)
- ❌ `.ws-cat__menu` - випадаюче меню (`catIn` animation)
- ❌ `.ws-cat__opt` - опція категорії (з іконкою + count)
- ❌ `.ws-cat__opt.is-on` - активна категорія
- ❌ `.ws-cat__lbl` - label категорії (Cinzel serif)
- ❌ `.ws-cat__sep` - роздільник в меню
- ❌ `.ws-cat__div` - вертикальний divider
- ❌ Filter selects (`.ws-sel` - status, act, type filters)
- ❌ Search highlighting (підсвічування matches в результатах)
- ❌ Recent searches
- ❌ Search suggestions

##### Card/Row View
- ❌ `.wcard__edit` - edit button on card (opacity 0 → 1 on hover)
- ❌ `.wcard__img` - image slot (web component integration)
- ❌ Status pills (`.pill--draft`, `--review`, `--ready`, `--done`)
- ❌ Progress bars (`.prog`, `.prog__fill` - arc progress)
- ❌ Scene dots (`.scene-dot` - numbered scene indicators)
- ❌ Chips (`.chips`, `.chip`, `.chip--gold`)
- ❌ Color swatches (`.swatches`, `.sw`)
- ❌ Avatar system (`.avatar` з initials та color-mix)
- ❌ Faction motto (`.fac-motto` - italic subtitle)
- ❌ Advanced sorting (by name, status, progress, scenes)
- ❌ Batch operations (multi-select entities)
- ❌ Drag-and-drop reordering
- ❌ Export/import entities

##### Graph View (~10 елементів)
- ❌ `.graph-wrap` - graph container (440px min-height)
- ❌ `.egograph` - SVG ego graph viewport
- ❌ `.gn` - graph node (SVG group, clickable)
- ❌ `.gn circle` - node circle (hover brightness filter)
- ❌ `.gn__t` - node title text (Cinzel serif, text-anchor middle)
- ❌ `.gn__hub` - центральний hub node (gold-bright, 13px)
- ❌ `.gn__cap` - node caption (8.5px uppercase)
- ❌ `.gn__rel` - relationship label (italic, 10px)
- ❌ `.graph-hint` - graph hint text
- ❌ Edge rendering (SVG lines між nodes)
- ❌ Graph physics simulation (force-directed layout)
- ❌ Zoom/pan controls
- ❌ Graph filtering by relationship type

##### Profile Panel (45+ елементів)
- ❌ `.profile__img` - hero image (web component `<image-slot>`)
- ❌ `image-slot::part(frame)` - custom element styling
- ❌ `.profile__hero.is-editing` - edit mode з image upload
- ❌ `.profile__pill` - status pill (top-right)
- ❌ Character-specific fields (`.row-top`, `.avatar`, роль, мотивація, прогрес)
- ❌ Location-specific fields (atmosphere chips, type)
- ❌ Event-specific fields (act, when, tone)
- ❌ Faction-specific fields (motto, colors)
- ❌ Artifact-specific fields (owner, location)
- ❌ `.lead-line` - lead heading (Cinzel 500, 18-23px)
- ❌ `.card` / `.pad` / `.card-p` - content blocks
- ❌ `.grid2` - two-column grid layout
- ❌ `.row-top` - row layout (avatar + info)
- ❌ `.row-name` / `.row-sub` - styled name/subtitle
- ❌ Scene chips (`.scenechips`, `.scenechip` - clickable scene links)

##### Connections (15 елементів)
- ❌ `.conns` - connections section (border-top)
- ❌ `.conn-grp` - connection group по типу
- ❌ `.conn-grp__h` - group header (з іконкою)
- ❌ `.conn-chips` - chips row
- ❌ `.conn-chip` - connection chip (hover → translateY(-1px))
- ❌ `.conn-chip__dot` - colored dot (relationship type color)
- ❌ `.conn-chip__rel` - relationship label (italic, 11px)
- ❌ Relationship types (belongs-to, located-in, участь-в, власність, тощо)
- ❌ Bidirectional relationships (автоматичні зворотні звʼязки)
- ❌ Relationship editing
- ❌ Relationship strength/weight
- ❌ Relationship timeline (коли створено)
- ❌ Orphan detection (entities without connections)
- ❌ Connection suggestions (AI-based)
- ❌ Connection visualization (mini-graph в profile)

#### Chronicle Workspace (10 елементів)
- ❌ `.world-hero__art` - hero image (web component, 190-310px)
- ❌ `image-slot::part(frame)` - custom styling
- ❌ `.palette-ribbon` - expandable color palette (flex hover expansion)
- ❌ `.palette-ribbon .pr` - color item (flex 1 → 2.4 on hover)
- ❌ Arc system (`.arc-head`, `.arc-lbl`, `.arc-pct`, `.prog__fill`)
- ❌ Category icons в chron-cat (зараз hardcoded, але не динамічні з adapters)
- ❌ Deep-linking до події (`?type=events&id=`)
- ❌ Chronicle timeline view (лінійна візуалізація часу)
- ❌ Event dependencies (event triggers event)
- ❌ Auto-generated chronicle from scenes

#### Reconstruction Overlay (60+ елементів)

##### Change Analysis (15 елементів)
- ❌ `.rc-change` - change selector box
- ❌ `.rc-change__lbl` - "Аналіз зміни" label
- ❌ `.rc-change__opts` - change options row
- ❌ `.rc-co` - change option button (rename/property/relationship/add/remove/rewrite)
- ❌ `.rc-co svg` - option icon (14x14px)
- ❌ `.rc-co.is-on` - активна опція (gold-soft bg)
- ❌ `.rc-co:disabled` - disabled state (opacity 0.45)
- ❌ `.rc-strategy` - strategy display row
- ❌ `.rc-strategy__t` - strategy text explanation
- ❌ `.rc-sev` - severity badge (none/light/medium/heavy/full)
- ❌ `.rc-sev--none` до `--full` - 5 severity levels з кольорами
- ❌ Dynamic strategy based on change type
- ❌ Impact prediction (AI-based)
- ❌ Cost estimation (token count)
- ❌ Confidence scores

##### Flow Diagram (10 елементів)
- ❌ `.rc-flow` - flow container (flex, gap 12px)
- ❌ `.rc-flow__node` - flow step (140px min-width, text-center)
- ❌ `.rc-flow__node.is-source` - джерело зміни (gold border + bg)
- ❌ `.rc-flow__lbl` - step label (uppercase, 10px)
- ❌ `.rc-flow__v` - value display (Cinzel 600, 20px)
- ❌ `.rc-flow__node.is-source .rc-flow__v` - gold-lit highlight
- ❌ `.rc-flow__arr` - arrow separator (↓)
- ❌ Multi-layer flow (Canon → Narrative → Director)
- ❌ Animated flow (step-by-step reveal)
- ❌ Interactive flow nodes (click to inspect)

##### Reconstruction Plan (35+ елементів)
- ❌ `.rc-plan__top` - plan header з progress
- ❌ `.rc-plan__prog` - progress text (X/Y done)
- ❌ `.rc-bar` - progress bar (5px height)
- ❌ `.rc-bar__fill` - animated fill (violet→gold gradient, 0.5s transition)
- ❌ `.rc-steps` - ordered steps list
- ❌ `.rc-step` - single step row (transition on state change)
- ❌ `.rc-step--running` - running state (gold border + bg)
- ❌ `.rc-step--done` - done state (opacity 0.62)
- ❌ `.rc-step__no` - step number або checkmark (monospace, gold-lit)
- ❌ `.rc-step__layer` - layer badge (Narrative/Director)
- ❌ `.rc-step__layer--narrative` - green badge (st-ready)
- ❌ `.rc-step__layer--director` - violet badge (violet-lit)
- ❌ `.rc-step__act` - action description (flex 1)
- ❌ `.rc-step__act svg` - action icon (15x15px)
- ❌ `.rc-step__cnt` - item count (×3, ×5, monospace)
- ❌ `.rc-step__st` - status badge (pending/running/done)
- ❌ `.rc-step__st--running` - running badge з spinner
- ❌ `.rc-step__st--done` - done badge (green)
- ❌ `.rc-spin` - spinner (11x11px, rotate animation)
- ❌ `.rc-spin--lg` - large spinner (14x14px)
- ❌ Real execution engine (window.wReconstructionPlan integration)
- ❌ Diff preview (before/after comparison)
- ❌ Human-in-the-loop (Accept/Reject buttons)
- ❌ Selective reconstruction (choose which layers)
- ❌ Reconstruction history
- ❌ Rollback functionality
- ❌ Dry-run mode
- ❌ Cost preview before execution
- ❌ Batch reconstruction (multiple entities)
- ❌ Reconstruction templates
- ❌ Priority queue (execute critical first)
- ❌ Parallel execution
- ❌ Progress notifications
- ❌ Error handling & retry
- ❌ Reconstruction analytics

##### Footer & Execution
- ❌ `.rc__run--go` - enabled run button (gold gradient bg)
- ❌ `.rc__run--go:hover` - hover state (brightness 1.07)
- ❌ `.rc__run--done` - completion button (green)
- ❌ `.rc__run--done:hover` - hover darker
- ❌ `.rc__x:disabled` - disabled close (opacity 0.4, cursor not-allowed)
- ❌ Real AI execution (`window.claude` integration)
- ❌ Streaming updates during execution
- ❌ Cancellation support
- ❌ Post-execution report

#### Editorial Enrichment (10 елементів)
- ❌ Web Components (`<image-slot>` custom element)
- ❌ `image-slot::part(frame)` - custom part styling
- ❌ `.world-hero__art::part(frame)` - transparent override
- ❌ `.wcard__media` bg fallbacks
- ❌ `.profile__hero.is-editing image-slot` - pointer-events control
- ❌ Image upload functionality
- ❌ Image cropping/resizing
- ❌ Image filters/effects
- ❌ AI image generation integration
- ❌ Image copyright tracking

#### Responsive (5 елементів)
- ❌ `@media (max-width: 1040px)` - single column workspace
- ❌ `@media (max-width: 900px)` - compact layout, icons-only pills
- ❌ `@media (max-width: 560px)` - mobile full-screen
- ❌ Mobile gesture support (swipe to close)
- ❌ Touch-optimized controls

#### Advanced Features (20+ елементів)
- ❌ Keyboard shortcuts (Esc to close, arrows to navigate)
- ❌ Focus management (focus trap в модалках)
- ❌ ARIA labels для доступності
- ❌ Screen reader support
- ❌ High contrast mode
- ❌ Reduced motion support
- ❌ Undo/Redo system
- ❌ Auto-save з debounce
- ❌ Conflict resolution (multiple editors)
- ❌ Version history
- ❌ Entity templates
- ❌ Bulk import/export
- ❌ Search filters (saved searches)
- ❌ Entity tags/labels
- ❌ Entity archiving
- ❌ Entity duplication
- ❌ Cross-project references
- ❌ Entity permissions (read-only, etc)
- ❌ Activity log (audit trail)
- ❌ Comments/notes on entities

---

### ⚠️ ФУНКЦІОНАЛЬНІ ВІДМІННОСТІ

1. **Category Switching**
   - **Прототип**: Dropdown в header для перемикання між Characters/Locations/Events/Factions/Artifacts БЕЗ повернення до Tree
   - **React**: Hardcoded single category на workspace, потрібно повертатися до Tree для зміни

2. **View Modes**
   - **Прототип**: 3 режими — Cards, List, Graph (ego-graph)
   - **React**: 2 режими — Cards, List (Graph відсутній)

3. **Entity Editing**
   - **Прототип**: Inline editing з contentEditable + image upload через web component
   - **React**: Contenteditable тільки для title/desc, без image upload

4. **Reconstruction**
   - **Прототип**: Повний UI для Change Analysis + Strategy + Execution з progress
   - **React**: Базова структура overlay, без вибору типу зміни, без execution

5. **Connections**
   - **Прототип**: Повна секція connections в profile з relationship types
   - **React**: Відсутня повністю

6. **Tree Visualization**
   - **Прототип**: Ambient effects (haze, particles), dim effect при відкритті workspace
   - **React**: Статичне дерево без ambient effects

7. **Chronicle**
   - **Прототип**: Hero image з web component, palette ribbon, arc progress
   - **React**: Текстовий hero без зображення

8. **Deep-linking**
   - **Прототип**: Підтримка `?type=events&id=xyz` для прямих посилань
   - **React**: Відсутня

---

### 🎯 ПРІОРИТЕТИ ІМПЛЕМЕНТАЦІЇ

#### 🔴 CRITICAL
1. **Category Dropdown** - перемикання між категоріями без повернення до Tree
2. **Graph View** - ego-graph візуалізація звʼязків
3. **Connections Section** - відображення та редагування relationships
4. **Change Analysis Selector** - вибір типу зміни (rename/property/etc)
5. **Reconstruction Execution** - реальний запуск реконструкції

#### 🟡 HIGH
6. **Tree Haze Animation** - ambient glow effect
7. **Image Slots** - web component integration для зображень
8. **Tree Dim Effect** - затемнення дерева при відкритті workspace
9. **Reconstruction Plan Steps** - відображення та виконання кроків
10. **Status Pills & Progress** - візуальні індикатори статусу

#### 🟢 MEDIUM
11. **Node Art Variant** - illustrated emblem nodes
12. **Filter Selects** - фільтри за статусом/актом/типом
13. **Scene Dots** - clickable scene indicators
14. **Palette Ribbon** - expandable color palette в Chronicle
15. **World Hero Image** - зображення для Chronicle

#### 🔵 LOW
16. **Deep-linking** - URL params для прямих посилань
17. **Responsive optimizations** - mobile/tablet layout polish
18. **Keyboard shortcuts** - navigation shortcuts
19. **Focus management** - accessibility improvements
20. **Advanced features** - undo/redo, version history, тощо

*(Буде додано після порівняння)*

---

## 4. WORKSPACE.TSX vs WORKSPACE.HTML

### 📊 СТАТИСТИКА

**Прототип**: ~189 CSS-елементів + компонентів
**React версія**: ~50 елементів портовано (~26%)
**Відсутньо**: ~139 елементів (~74%)

---

### ✅ ПОРТОВАНО (базова структура, ~50 елементів)

#### Shell & Topbar
- ✅ `.shell` - root container з радіальними градієнтами
- ✅ `.brand` - логотип (fixed top-left, navigate to home)
- ✅ `.brand__logo` - SVG іконка (sparkle, 34px)
- ✅ `.main` - main container (flex column)
- ✅ `.topbar` - header bar (66px min-height, backdrop blur)
- ✅ `.pillswitch` - pillar switcher (Книга·Всесвіт·Режисер)
- ✅ `.pillswitch__b` - pillar button (13.5px, 500 weight)
- ✅ `.pillswitch__b.is-here` - active state (gold-soft bg, Cinzel serif)
- ✅ Scene picker dropdown (`.scene-pick`)
- ✅ `.scene-pickwrap` - dropdown wrapper (relative, z-index 200)
- ✅ `.scene-pick` - button (flex, bg-2, hover → gold border)
- ✅ `.scene-pick .num` - scene number (gold-lit, Cinzel 600)
- ✅ `.scene-menu-scrim` - full-screen scrim for closing
- ✅ `.scene-menu` - dropdown menu (absolute, dark gradient bg)
- ✅ `.scene-opt` - scene option row (hover → bg-hover)
- ✅ `.scene-opt.is-on` - selected scene (gold-soft bg)
- ✅ `.scene-opt__n` - scene number badge (24x24px, monospace)
- ✅ `.scene-opt__t` - scene title (Cinzel 600)
- ✅ `.scene-opt__act` - act label (11px uppercase)
- ✅ `.topbar__spacer` - flex spacer
- ✅ User Dock (bottom-left, з аватаром та токенами)

#### Director Tabs (2 з 7)
- ✅ `.dir-tabs` - tab switcher container (bg-2, border, border-radius 11px)
- ✅ `.dir-tab` - tab button (inline-flex, 13.5px)
- ✅ `.dir-tab.is-on` - active tab (gold-soft bg)
- ✅ Розкадровка tab (Storyboard)
- ✅ Візуальний канон tab (Visual Canon)

#### Storyboard Tab (~22 елементи)
- ✅ `.content` - scroll area (padding, overflow-y auto)
- ✅ `.page` - max-width 1180px container
- ✅ `.phead` - page header (flex space-between)
- ✅ `.phead__l` - left column (flex column, gap 6px)
- ✅ `.phead__kick` - kicker label (11px uppercase gold)
- ✅ `.phead h1` - page title (27px)
- ✅ `.phead__sub` - subtitle (14px tx-mid)
- ✅ `.pdiv` - horizontal divider (1px line)
- ✅ `.shot-list` - flex column, gap 16px
- ✅ `.card.shot` - shot card container
- ✅ `.shot__bar` - header bar (bg-1, border-bottom)
- ✅ `.grip` - drag handle (3 horizontal lines)
- ✅ `.shot__no` - shot number (Cinzel 700, gold-lit)
- ✅ `.shot__type` - shot type label (13.5px)
- ✅ `.chip` - generic chip (mood chips)
- ✅ `.chip--mood` - mood chip (violet-lit, violet-soft bg)
- ✅ `.shot__moods` - moods container (flex gap 6px)
- ✅ `.shot__acts` - action buttons (edit/delete)
- ✅ `.ibtn` - icon button (30x30px, hover → bg-hover)
- ✅ `.shot__body` - shot body (grid 300px / 1fr)
- ✅ `.shot__sb` - left column (shot board)
- ✅ `.frame` - 16:9 frame (aspect-ratio, border-radius)
- ✅ `.frame__tag` - "16:9" label (top-left overlay)
- ✅ `.frame__c` - center content (camera icon, label)
- ✅ `.frame__lbl` - status label (monospace, 11px)
- ✅ `.spin-ring` - loading spinner (22px, rotate animation)
- ✅ `.varstrip` - variant thumbnail strip
- ✅ `.varthumb` - variant thumbnail (grid item, click to select)
- ✅ `.varthumb.is-sel` - selected variant
- ✅ `.varthumb__n` - variant number
- ✅ `.varthumb--add` - add variant button (+ icon)
- ✅ `.shot__detail` - right column (details)
- ✅ `.kv` - key-value list
- ✅ `.kv__row` - kv row (grid 108px / 1fr)
- ✅ `.prompt` - prompt block (bg-1, border)
- ✅ `.prompt__head` - prompt header
- ✅ `.prompt__lbl` - "MIDJOURNEY PROMPT" label
- ✅ `.prompt__txt` - prompt text (monospace, bg-0)
- ✅ `.prompt__acts` - action buttons (copy + generate)
- ✅ `.btn` - generic button (inline-flex, 13px)
- ✅ `.btn--gold` - gold gradient button
- ✅ `.btn--add` - add button (dashed border, full-width)
- ✅ `.shot__dlglist` - dialogue list
- ✅ `.shot__dlg__tag` - dialogue tag ("🗨 діалог · N")
- ✅ `.shot__dlg` - dialogue row (flex, violet-soft bg)
- ✅ `.shot__dlg__who` - speaker name (Cinzel 600)
- ✅ `.shot__dlg__line` - dialogue line (italic, ellipsis)
- ✅ `.shot__dlg__dur` - duration estimate (monospace)
- ✅ `.shot__dlg--add` - add dialogue button (dashed border)
- ✅ `.shot__dlg--more` - add more button
- ✅ Generate shot functionality (mock with timeout)
- ✅ Variant selection
- ✅ Shot editing (opens modal)
- ✅ Shot deletion (with confirm)

#### Shot Editor Modal (~26 елементів)
- ✅ `.shotmodal` - modal scrim (fixed inset, backdrop blur)
- ✅ `.shotmodal__card` - modal card (max-width, click-stop)
- ✅ `.shotmodal__head` - modal header (flex space-between)
- ✅ `.shotmodal__k` - kicker ("Кадр N")
- ✅ `.shotmodal__t` - title ("Редагувати кадр")
- ✅ `.shotmodal__x` - close button (X icon)
- ✅ `.sm-field` - form field (label + input/textarea)
- ✅ `.sm-img` - image upload area (backgroundImage preview)
- ✅ `.sm-img__ph` - placeholder (camera icon + text)
- ✅ `.sm-img__btn` - upload button (label wrapping input[type=file])
- ✅ `.sm-img__del` - delete image button
- ✅ `.sm-two` - two-column grid
- ✅ Input fields (subject, type, dur, camera, angle, light)
- ✅ `.sm-dlg` - dialogue section
- ✅ `.sm-dlg__h` - dialogue header ("🗨 Репліки в кадрі")
- ✅ `.sm-dlg__hint` - hint text
- ✅ `.sm-dlg__empty` - empty state message
- ✅ `.sm-dlgrow` - dialogue row container
- ✅ `.sm-dlgrow__head` - row header (number + delete)
- ✅ `.sm-dlgrow__n` - line number
- ✅ `.sm-dlgrow__del` - delete line button
- ✅ Dialogue inputs (speaker, emotion, line)
- ✅ `.sm-dlg__add` - add dialogue button
- ✅ `.sm-dlg__dur` - total duration calculation
- ✅ `.sm-foot` - modal footer (cancel + save)
- ✅ Keyboard: Esc to close
- ✅ Click outside to close
- ✅ Image upload with FileReader
- ✅ Dialogue line management (add/delete/edit)

#### Visual Canon Tab (~28 елементів з прототипу)
- ✅ `.vk-seg` - segment switcher (Characters / Locations)
- ✅ `.vk-seg__b` - segment button (inline-flex, 13.5px)
- ✅ `.vk-seg__b.is-on` - active segment (gold-soft bg)
- ✅ `.vk-note-bar` - info bar (violet-soft bg, CPU icon)
- ✅ `.vk-grid` - LoRA cards grid (auto-fill minmax(258px, 1fr))
- ✅ `.vk` - LoRA card container (bg-2, border, hover effects)
- ✅ `.vk__main` - card hero section (178px height, bg-3)
- ✅ `.vk__hero` - hero image placeholder
- ✅ `.vk__model` - model status pill (absolute top-left)
- ✅ `.pill--draft` - draft status (st-draft color)
- ✅ `.vk__b` - card body (padding 13x14px)
- ✅ `.vk__row` - name + refs row (flex space-between)
- ✅ `.vk__name` - entity name (Cinzel 600, 16px)
- ✅ `.vk__refs` - ref count ("0 / 20", monospace)
- ✅ `.vk__bar` - progress bar (5px height)
- ✅ `.vk__barfill` - progress fill (width transition)
- ✅ `.vk__barfill.is-none` - no refs (st-draft color)
- ✅ `.vk__angles` - angle grid (4 columns for characters, 4 for locations)
- ✅ `.vk__angle` - angle cell (flex column)
- ✅ `.vk__anglefill` - angle preview (aspect-ratio 1, border-radius 6px)
- ✅ `.vk__angle-lbl` - angle label (9px uppercase)
- ✅ `.vk__note` - note with icon (flex gap 8px, italic)
- ✅ `.vk__hint` - hint text (11.5px italic)
- ✅ `.vk__acts` - action buttons row
- ✅ "Керувати референсами" button → opens LoraRefModal
- ✅ "Навчити LoRA" button (stub)
- ✅ Navigate to canon button (tree icon)
- ✅ Characters/Locations switching

#### LoRA Reference Manager Modal (LoraRefModal.tsx)
- ✅ Modal з MOCK_WORLD.characters/locations
- ✅ Reference grid display
- ✅ Angle-specific upload
- ✅ Auto-generation from canon (stub)
- ✅ Train LoRA button (stub)

---

### ❌ ВІДСУТНЄ (~139 елементів, 74%)

#### Sidebar/Rail (18 елементів)
- ❌ `.rail` - left sidebar (bg-1, border-right, flex column)
- ❌ `.rail__brand` - brand section (padding 22px)
- ❌ `.rail__logo` - logo icon (34px)
- ❌ `.rail__name` - "WhiteWrite" (Cinzel 700, 18px)
- ❌ `.rail__tag` - "Production Workspace" tag (9.5px uppercase)
- ❌ `.rail__sep` - horizontal separator
- ❌ `.nav` - navigation section (flex column, gap 3px)
- ❌ `.nav__lbl` - section label ("PRODUCTION", "CANON", etc.)
- ❌ `.nav__item` - nav item (flex, hover → violet-soft)
- ❌ `.nav__item.is-on` - active nav (gold-soft bg, left border glow)
- ❌ `.nav__item-label` - nav label (14.5px, 500 weight)
- ❌ `.nav__count` - count badge (11px, bg-3)
- ❌ Navigation items:
  - ❌ Розкадровка (current)
  - ❌ Візуальний канон (current)
  - ❌ Персонажі
  - ❌ Локації
  - ❌ Пам'ять
  - ❌ Timeline
  - ❌ Налаштування
- ❌ `.rail__foot` - footer section (margin-top auto)
- ❌ `.proj` - project card (bg-2, border, padding 14px)
- ❌ `.proj__k` - project kicker (10px uppercase)
- ❌ `.proj__name` - project name (Cinzel 600, 15px)
- ❌ `.proj__meta` - project metadata (flex gap 14px)
- ❌ `.proj__stat` - stat display (12px, b tags for values)

#### Topbar Elements (додаткові 5 елементів)
- ❌ `.topbar__btn--ghost` - ghost button variant (border line-2)
- ❌ "Save" button (ghost style)
- ❌ "Publish" button (ghost style)
- ❌ "Розрахувати кадри" button (зараз є, але disabled на vizref tab)
- ❌ Breadcrumb navigation (`.crumb` - project name + scene)

#### Characters Tab (19 елементів)
- ❌ `.char-grid` - character grid (2 columns)
- ❌ `.char-c` - character card (padding 18px)
- ❌ `.char-c__top` - card top (flex, avatar + info)
- ❌ `.avatar` - character avatar (48x48px, Cinzel 700, color-mix)
- ❌ `.char-c__id` - character ID column (flex 1)
- ❌ `.char-c__name` - character name (Cinzel 600, 16.5px)
- ❌ `.char-c__role` - character role (12px, tx-mid)
- ❌ `.char-c__mot` - motivation text (13.5px, line-height 1.55)
- ❌ `.char-c__arc-head` - arc header (flex space-between)
- ❌ `.arc-lbl` - arc label (12.5px italic)
- ❌ `.arc-pct` - arc percentage (12.5px monospace gold-lit)
- ❌ `.prog` - progress bar (6px height)
- ❌ `.prog__fill` - progress fill (violet→gold gradient)
- ❌ `.char-c__scenes` - scenes row (flex gap 7px)
- ❌ `.char-c__scenes-lbl` - "СЦЕНИ" label
- ❌ `.scene-dot` - scene number dot (24x24px, monospace)
- ❌ Character profile modal:
  - ❌ `.modal-scrim` - modal scrim (backdrop blur 7px)
  - ❌ `.modal` - modal container (640px max-width)
  - ❌ `.modal__head` - modal header (gradient bg with --h color)
  - ❌ `.modal__avatar` - large avatar (64x64px)
  - ❌ `.modal__id` - ID section
  - ❌ `.modal__name` - character name (23px)
  - ❌ `.modal__role` - role + chips
  - ❌ `.modal__close` - close button (34x34px)
  - ❌ `.modal__body` - modal body (padding 22x24px)
  - ❌ `.msec__h` - section header (11px uppercase)
  - ❌ `.msec__txt` - section text (14.5px, line-height 1.62)
  - ❌ `.mrel` - relationships section
  - ❌ `.mrel__row` - relationship row (bg-3, border)
  - ❌ `.mrel__dot` - relationship color dot (8x8px)
  - ❌ `.mrel__name` - related character name (13.5px 600)
  - ❌ `.mrel__kind` - relationship type (italic, tx-mid)
  - ❌ `.mscene` - scene row in modal
  - ❌ `.relgraph` - SVG relationship graph
  - ❌ `.rel-name` / `.rel-hub` / `.rel-kind` - graph text elements

#### Locations Tab (22 елементи)
- ❌ `.loc-grid` - location grid (1fr / 300px)
- ❌ `.loc-main` - main location view (padding 18px)
- ❌ `.loc-main__head` - location header
- ❌ `.loc-main__frame` - location frame (16:9 image)
- ❌ `.loc-main__name` - location name (23px)
- ❌ `.loc-main__type` - location type (13.5px tx-mid)
- ❌ `.loc-main__pills` - pills row (atmos chips)
- ❌ `.loc-main__desc` - description (14px, line-height 1.6)
- ❌ `.loc-main__scenes` - scenes row (flex gap 7px)
- ❌ `.moodboard` - moodboard section (border-top)
- ❌ `.moodboard__head` - moodboard header (12px uppercase)
- ❌ `.moodboard__row` - moodboard grid (3 thumbs + 1 palette)
- ❌ `.mb-thumb` - moodboard thumbnail (aspect-ratio 1)
- ❌ `.mb-palette` - color palette grid (3 rows)
- ❌ `.loc-main__acts` - action buttons
- ❌ `.loc-side` - locations sidebar (sticky top 14px)
- ❌ `.loc-side__lbl` - sidebar label (11px uppercase)
- ❌ `.loc-list` - locations list (flex column gap 6px)
- ❌ `.loc-row` - location row (flex, hover → violet-soft)
- ❌ `.loc-row.is-cur` - current location (gold border + bg)
- ❌ `.loc-row__name` - location name (13.5px 500)
- ❌ `.loc-row__cur` - "ЗАРАЗ" badge (gold-lit, 10px uppercase)

#### Memory Tab (17 елементів)
- ❌ `.mem-grid` - memory grid (2 columns)
- ❌ `.mem-col` - memory column (flex column gap 18px)
- ❌ `.mem-card` - memory card (padding 18px)
- ❌ `.mem-card__h` - card header (Cinzel 600, 15px, with icon)
- ❌ Memory sections:
  - ❌ "Світобудова" (World rules)
  - ❌ "Ключові факти"
  - ❌ "Відкриті сюжетні лінії" (Plot threads)
  - ❌ "Нотатки режисера" (Director notes)
- ❌ `.mem-rules` - rules list (flex column gap 9px)
- ❌ `.mem-rule` - single rule (flex gap 10px)
- ❌ `.mem-rule__dot` - rule dot (5x5px gold circle)
- ❌ `.threads` - threads list (flex column)
- ❌ `.thread` - thread row (border-bottom)
- ❌ `.thread__ic` - thread icon
- ❌ `.thread__t` - thread text (13.5px tx-hi)
- ❌ `.thread__st` - thread status (11px uppercase)
- ❌ `.notes` - notes list (flex column gap 9px)
- ❌ `.note` - note card (color-coded with --nc, left border)
- ❌ `.note__ic` - note icon (colored)
- ❌ `.note__t` - note text (13px, line-height 1.5)

#### Timeline Tab (19 елементів)
- ❌ `.track` - timeline track (flex gap 10px)
- ❌ `.track__act` - act track (flex 1, bg-2, padding 14px)
- ❌ `.track__act-lbl` - act label (Cinzel 600, 13px)
- ❌ `.track__blocks` - blocks container (flex flex-wrap gap 8px)
- ❌ `.track__block` - scene block (46x46px, grid-centered)
- ❌ `.track__block:hover` - hover state (translateY -2px, violet border)
- ❌ `.track__block.st-done` - done status (st-ready color)
- ❌ `.track__block.st-draft` - draft status (st-draft color)
- ❌ `.track__block.st-review` - review status (st-review color)
- ❌ `.track__block.is-cur` - current scene (gold-soft bg, box-shadow)
- ❌ Scene metadata display
- ❌ Tension graph visualization
- ❌ Word count tracking
- ❌ Status filters
- ❌ Act-based organization
- ❌ Click scene block → navigate to scene
- ❌ Drag & drop reordering
- ❌ Bulk status updates
- ❌ Export timeline

#### Settings Tab (estimated ~15 елементів)
- ❌ Project settings section
- ❌ Export settings (format, quality)
- ❌ AI model selection
- ❌ Voice settings (TTS config)
- ❌ Music/SFX settings
- ❌ Collaboration settings
- ❌ Billing/subscription info
- ❌ Project metadata editing
- ❌ Danger zone (delete project, etc)

#### Advanced Features (20+ елементів)
- ❌ Автозбереження з debounce
- ❌ Undo/Redo system
- ❌ Версіонування змін
- ❌ Collaboration (multi-user editing)
- ❌ Comments on shots/scenes
- ❌ Shot templates library
- ❌ Bulk shot operations
- ❌ Export storyboard to PDF
- ❌ Export to video editing software (XML/EDL)
- ❌ Thumbnail generation from shots
- ❌ Audio waveform display for dialogue
- ❌ Lip-sync timing calculator
- ❌ Shot duration auto-adjustment
- ❌ Continuity checker (costume/lighting/props)
- ❌ Shot coverage analyzer
- ❌ Budget estimator (per shot/scene)
- ❌ Shooting schedule generator
- ❌ Call sheet generator
- ❌ Real AI integration (не mock)
- ❌ Real image generation (Midjourney/DALL-E)

---

### ⚠️ ФУНКЦІОНАЛЬНІ ВІДМІННОСТІ

1. **Tab Structure**
   - **Прототип**: 7 tabs (Storyboard, Visual Canon, Characters, Locations, Memory, Timeline, Settings)
   - **React**: 2 tabs (Storyboard, Visual Canon)
   - **Missing**: Characters, Locations, Memory, Timeline, Settings tabs

2. **Navigation**
   - **Прототип**: Sidebar rail з navigation items + project card
   - **React**: Немає sidebar, лише topbar
   - **Impact**: No quick navigation between tabs, no project context display

3. **Shot Generation**
   - **Прототип**: Real integration з Midjourney/AI (prompts, variants)
   - **React**: Mock з setTimeout (1.4s delay, fake "generated" flag)
   - **Missing**: Real image generation, variant management, upscaling

4. **Dialogue Management**
   - **Прототип**: Full dialogue editor з lip-sync timing
   - **React**: Basic dialogue list з estimated duration
   - **Missing**: Voice selection, emotion tags, audio waveforms

5. **LoRA/Visual Canon**
   - **Прототип**: Full reference management (upload, auto-gen, angle coverage)
   - **React**: Basic UI structure, no real upload/training
   - **Missing**: Auto-generation from canon, training integration, angle validation

6. **Characters/Locations**
   - **Прототип**: Full CRUD з profiles, relationships, moodboards
   - **React**: Відсутні повністю (ці дані є лише у WorldTree)
   - **Impact**: No production-specific character/location management

7. **Memory System**
   - **Прототип**: Derived memory від canon (rules, facts, threads, notes)
   - **React**: Відсутня
   - **Missing**: Canon-derived memory, plot thread tracking, continuity notes

8. **Timeline**
   - **Прототип**: Visual timeline з act tracks, scene blocks, status colors
   - **React**: Відсутня
   - **Missing**: Timeline visualization, tension graph, word count tracking

---

### 🎯 ПРІОРИТЕТИ ІМПЛЕМЕНТАЦІЇ

#### 🔴 CRITICAL
1. **Sidebar Navigation** - rail з tabs для швидкого перемикання
2. **Characters Tab** - character cards + profile modal + relationships
3. **Locations Tab** - location grid + moodboard + sidebar list
4. **Real Image Generation** - integration з Midjourney/Replicate API
5. **Автозбереження** - debounced save to Firestore

#### 🟡 HIGH
6. **Memory Tab** - canon-derived memory display
7. **Timeline Tab** - visual timeline з act tracks
8. **Shot Templates** - library of common shot types
9. **Dialogue Audio Integration** - TTS preview, lip-sync timing
10. **LoRA Training** - real training integration (Replicate/Hugging Face)

#### 🟢 MEDIUM
11. **Settings Tab** - project settings, export config
12. **Bulk Shot Operations** - multi-select, batch edit
13. **Export to PDF** - storyboard export
14. **Continuity Checker** - detect costume/lighting/prop inconsistencies
15. **Shot Coverage Analyzer** - ensure all angles covered

#### 🔵 LOW
16. **Collaboration** - multi-user editing, comments
17. **Version History** - undo/redo, snapshot restoration
18. **Budget Estimator** - cost per shot/scene
19. **Shooting Schedule** - auto-generate call sheets
20. **Export to Video Software** - XML/EDL export

*(Буде додано після порівняння)*

---

## 5. ACCOUNT.TSX

### 🔍 СТАТУС: ПОТРЕБУЄ ДЕТАЛЬНОГО АНАЛІЗУ

*(Немає прямого аналогу, але є Account view в прототипі White.html)*

---

## 📝 ВИСНОВКИ

### Landing.tsx - Загальний прогрес: **~85%**

**Портовано повністю:**
- ✅ Rail navigation (верхнє меню)
- ✅ User dock (лівий нижній кут)
- ✅ Home view (стартовий екран)
- ✅ Narratives view (проєкти)
- ✅ Marketplace view
- ✅ Knowledge Base view
- ✅ KB Article Reader
- ✅ View switcher
- ✅ Firebase інтеграція

**Відсутні критичні елементи:**
- ❌ Delete confirmation з countdown
- ❌ Project Edit modal
- ❌ Feedback modal & FAB
- ❌ Buy Book modal
- ❌ Home FAB
- ❌ Particles canvas
- ❌ Hero news panel
- ❌ Pitch lines

**Пріоритет виправлень:**
1. **Критичний**: Delete confirmation (користувач може випадково видалити проєкт)
2. **Високий**: Project Edit modal (кнопка є, але не працює)
3. **Середній**: Feedback FAB + modal
4. **Низький**: Декоративні елементи (particles, pitch lines)

---

**Наступний крок**: Детальне порівняння Book.tsx, WorldTree.tsx, Workspace.tsx
