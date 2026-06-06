# FILE MAP — що в якому файлі прототипу (щоб Claude Code нічого не пропустив)

> Прототип розкиданий по файлах. ОБОВ'ЯЗКОВО відкрий КОЖЕН перед портом.
> Головний — `White.html` (шел): меню, Проекти, Акаунт, вхід, новини.

## Точки входу (HTML)
- **White.html** ← ГОЛОВНИЙ ШЕЛ. Верхнє меню/рейка, перемикач стовпів, userdock (токени+аватар),
  розділ **Проекти** (картки, обкладинка, edit/delete, +новий, 5-сек видалення),
  **Акаунт** (аватар, токени, плани, редагування), **модалка входу/реєстрації** (Email+Google, гейт),
  **новини**, кнопка **«Замовити книгу»** (beta-модалка «скоро»), маршрутизація між в'юхами.
- **WhiteWrite.html** ← Лендінг (екран мага, stage "start") + Книга (читання). Стилі книги/пергаменту, hero, цитата, фіча зліва.
- **WhiteWrite WorldTree.html** ← Всесвіт. Дерево + воркспейси категорій + Хроніка + reconstruction-overlay (стилі).
- **WhiteWrite Workspace.html** ← Режисер. Розкадровка + візуальний канон + діалоги (стилі).

## Логіка (JSX/JS) — підключається в HTML вище
**Лендінг / потік створення**
- `flow.jsx` — StartScreen (маг) + StoryForm (створення: назва, опис, обсяг, серії, фінал, жанри, dialogueDensity).
- `app.jsx` — стейдж-машина start→form→book, ww-mode повідомлення шелу.
- `atmosphere.jsx` — частинки/ambient.

**Книга**
- `book.jsx` — розвороти, перегортання, кутові стрілки, пагінація, перемикач сцени/акта, кнопка-олівець.
- `pages.jsx` — TitlePage, Prose, PageHeader, Folio, SceneIntentPage (Що далі).
- `book-edit.jsx` — SceneEditor + Guardian (EDIT→CANON, пагінація тексту).
- `book-related.jsx` — закладки канону + панель «Aa» (шрифт/розмір тексту).

**Всесвіт**
- `wt-world.jsx` — модель WORLD (canon: 5 категорій + сцени + shots + дефолти).
- `wt-app.jsx` — дерево-роутинг + Хроніка.
- `wt-tree.jsx` — візуалізація дерева (Хроніка-серце + 5 нодів).
- `wt-workspace.jsx` — воркспейс категорії (картки/список/граф, профіль, фільтри, dropdown сцени/категорії, edit-mode).
- `wt-adapters.jsx` — поля кожної категорії.
- `wt-icons.jsx` — іконки.
- `wt-impact.jsx` — рушій залежностей (wConnections/wAffected/wImpact/wReconstructionPlan, WCHANGES).
- `wt-reconstruct.jsx` — overlay реконструкції (Change Analysis → план → execute).

**Режисер**
- `ws-app.jsx` — шел Режисера, перемикач сцени (dropdown), розрахунок кадрів.
- `ws-director.jsx` — розкадровка, ShotEditor (зображення+варіанти, **діалоги-список реплік**), «Намалювати кадр».
- `ws-vizref.jsx` — Візуальний канон / LoRA (референси gen+upload+manage, пороги, навчання).
- `ws-data.jsx` — проєкція DATA над WORLD.
- `ws-icons.jsx` — іконки.

**Спільне**
- `image-slot.js` — drag-n-drop слот зображення (web-component).
- `ww-embed.js` — embed-міст шел↔стовпи (ховає внутрішні перемикачі, роутить навігацію).
- `kb.js` — База знань (статті).

## Заглушки (assets/ph-*) — коли немає справжньої картинки
ph-characters, ph-locations, ph-events, ph-factions, ph-artifacts, ph-project, ph-shot.
Категорійні арти дерева: cat-characters/locations/events/factions/world/artifacts.
Фони: StartBack.jpg (маг), DeskBg.jpg, pergament.png, Scroll.png, OpenedBook.jpg, CleanBook.png, world-tree.jpg.
Лого: LogoWhiteTree.png. Відео: StartStoryAnim.mp4. Шрифти: assets/fonts/ (Philosopher).

## Правило
Перед портом КОЖНОГО екрана — відкрий його HTML + усі його JSX зі списку вище, і копіюй розмітку/CSS/копірайт ДОСЛІВНО. Перевірка: відкрий відповідний `prototype/*.html` у браузері — має збігатися піксель-в-піксель.
