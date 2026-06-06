# SESSION START — що робити на початку сесії

## 1️⃣ Прочитай контекст

```bash
# Обов'язково прочитай ці файли:
E:\WhiteWrite\CLAUDE.md          # Проєктна пам'ять, інваріанти
E:\WhiteWrite\handoff\FILE_MAP.md   # Карта прототипу (що де лежить)
E:\WhiteWrite\handoff\TODO.md       # Поточні завдання
```

## 2️⃣ Перевір статус прототипу

**Що вже портовано (1:1 з прототипу):**
- ✅ Landing page (`Landing.tsx` ← `WhiteWrite.html` StartScreen)
- ✅ Auth Modal (`AuthModal.tsx` ← `White.html` #auth-modal)
- ✅ Projects page (`Projects.tsx` ← `White.html` view[data-view="narr"])
- ✅ CSS (landing.css, auth.css, projects.css)

**Що в процесі:**
- ⏳ CreateProject Modal (форма створення проєкту)
- ⏳ Account page (аватар, токени, плани)

**Що не портовано:**
- 📖 Книга (Narrative) — `WhiteWrite.html` BookScreen
- 🌳 Всесвіт (WorldTree) — `WhiteWrite WorldTree.html`
- 🎬 Режисер (Workspace) — `WhiteWrite Workspace.html`

## 3️⃣ Відкрий FILE_MAP.md

**Перед портом КОЖНОГО екрана:**
1. Відкрий `handoff/FILE_MAP.md`
2. Знайди відповідний HTML файл
3. Прочитай усі JSX компоненти зі списку
4. Копіюй дослівно (1:1, піксель-в-піксель)

## 4️⃣ Запусти dev server (якщо не запущено)

```bash
npm run dev
# Dev server: http://localhost:5174
```

## 5️⃣ Використовуй TodoWrite

Створи todo list для поточної сесії:
- Використовуй `TodoWrite` для планування
- Оновлюй статус задач (`pending` → `in_progress` → `completed`)
- Завжди **лише одна** задача `in_progress`

## 6️⃣ Дотримуйся інваріантів (CLAUDE.md)

**Критично важливо:**
- Canon = джерело правди, Memory = View (не копія!)
- Canon — поле в `project` документі (не окрема колекція)
- ID стабільний (`id` + `slug` + `name`)
- Story Navigation, НЕ Story Generation (Guided Mode за замовчуванням)

## 7️⃣ Не вигадуй — копіюй з прототипу

**Якщо щось не зрозуміло:**
1. Відкрий `FILE_MAP.md` → знайди HTML
2. Прочитай відповідні CSS (lines вказані в FILE_MAP)
3. Прочитай JSX (якщо є)
4. Копіюй структуру, класи, стилі 1:1

**НЕ створюй власні версії!** Користувач хоче точну копію прототипу.

---

**Готовий розпочати?**
→ Прочитай `handoff/TODO.md` і візьми наступну задачу зі списку.
