# TODO — поточні завдання WhiteWrite

**Оновлено:** 2026-06-04
**Статус:** Auth/Projects/Landing портовані 1:1, CreateProject/Account в черзі

---

## ✅ Зроблено (1:1 з прототипу)

### Landing page
- ✅ Портовано `WhiteWrite.html` StartScreen → `Landing.tsx`
- ✅ Hero image з `heroDrift` анімацією (26s)
- ✅ hero-mark, hero-quote, hero-panel, hero-feature, hero-buybook
- ✅ userdock (bottom-left) + sign out button (top-right)
- ✅ CSS портовано з `WhiteWrite.html` lines 433-520

### Auth Modal
- ✅ Портовано `White.html` #auth-modal → `AuthModal.tsx`
- ✅ Форма входу/реєстрації з табками (Вхід / Реєстрація)
- ✅ Email + Password поля
- ✅ Google Sign-In button (з SVG логотипом)
- ✅ CSS портовано з `White.html` lines 342-357, 192-228

### Projects page
- ✅ Портовано `White.html` view[data-view="narr"] → `Projects.tsx`
- ✅ Картки проєктів `.ncard` (cover, title, meta, desc)
- ✅ `.ncard--new` (кнопка "Створити проєкт")
- ✅ Edit/Delete buttons (`.ncard__edit`, `.ncard__del`)
- ✅ **5-секундне видалення** з `.ncard__delbar` (виправлено з 3s)
- ✅ CSS портовано з `White.html` lines 126-166

### Firestore
- ✅ Firestore rules оновлено (`allow list: if request.auth != null`)
- ✅ Projects CRUD працює (getUserProjects, createProject, deleteProject)
- ✅ Firebase Auth працює (Email/Password, Google Sign-In)

---

## ⏳ В процесі

### CreateProject Modal
**Джерело:** `White.html` #proj-edit (створення нового проєкту)
**Де:** `src/components/CreateProjectModal.tsx`
**Що треба:**
- [ ] Портувати повну форму з `White.html` lines 465-495
- [ ] Cover upload (`.pe-cover`, `.pe-cover__btn`, `.pe-cover__del`)
- [ ] Title, Description (`.pe-input`, `.pe-area`)
- [ ] Scope selector (Оповідання/Новела/Сезон/Без меж)
- [ ] Genres chips (`.pe-genres`, `.pe-chip`, multi-select)
- [ ] Ending selector (Відкритий/Завершений/Свій)
- [ ] CSS портувати з `White.html` lines 192-228 (вже є в auth.css, перевірити)

**Статус:** Форма створення існує, але не повна — додати scope/genres/ending/cover

---

## 📋 Наступна черга (пріоритет)

### 1. Account page
**Джерело:** `White.html` view[data-view="account"]
**Де:** `src/pages/Account.tsx` (створити)
**Що треба:**
- [ ] Профіль користувача (`.acc`)
  - [ ] Avatar upload (`.acc__av`, `.acc__avcam`)
  - [ ] Display name edit (`.acc__name`, `.acc__editbtn`)
  - [ ] Email (read-only)
  - [ ] Tokens count (`.acc__tokens`, `.acc__tokn`)
  - [ ] Current plan badge (`.acc__plan`)
- [ ] Статистика (`.acc-stats`)
  - [ ] Написано сцен
  - [ ] Персонажів створено
  - [ ] Токенів витрачено
- [ ] Плани підписки (`.plan-grid`)
  - [ ] Free / Pro / Studio cards
  - [ ] Features list (`.plan__feats`)
  - [ ] "Обрати план" button (`.plan__btn`)
- [ ] CSS портувати з `White.html` lines 306-374
- [ ] Створити `src/styles/account.css`

**Route:** `/account`
**Navigation:** Userdock onClick → navigate('/account')

---

### 2. База знань (KB)
**Джерело:** `White.html` view[data-view="kb"]
**Де:** `src/pages/KnowledgeBase.tsx` (створити)
**Що треба:**
- [ ] Список статей (`.kb` cards)
- [ ] Пошук (`.kb-search`)
- [ ] Категорії (`.kb-cats`, `.kb-cat` chips)
- [ ] Reader overlay (`.kb-reader`, `.art`)
- [ ] CSS портувати з `White.html` lines 245-304

**Route:** `/kb`

---

### 3. Маркетплейс
**Джерело:** `White.html` view[data-view="market"]
**Де:** `src/pages/Marketplace.tsx` (створити)
**Що треба:**
- [ ] Список публічних проєктів (`.mk` cards)
- [ ] Rating stars (`.stars`)
- [ ] Filters (жанр, рейтинг, автор)
- [ ] CSS портувати з `White.html` lines 230-243

**Route:** `/marketplace`

---

## 📖 Головні стовпи (великі завдання)

### 4. Книга (Narrative)
**Джерело:** `WhiteWrite.html` BookScreen
**Де:** `src/pages/Book.tsx` (створити)
**Що треба:**
- [ ] Пергаментний розворот (`.book`, `.page--left`, `.page--right`)
- [ ] Корінець (`.spine`)
- [ ] Scene cards (блоки сцен)
- [ ] Dialogue cards (блоки діалогів)
- [ ] Scene Edit overlay (`.scene-edit`)
- [ ] Scene Intent modal (вибір наступної сцени)
- [ ] Закладки (Canon ↔ Book navigation)
- [ ] JSX: `flow.jsx`, `ws-render.jsx`, `ws-sceneintent.jsx`
- [ ] CSS портувати з `WhiteWrite.html`

**Route:** `/book/:projectId`

---

### 5. Всесвіт (WorldTree)
**Джерело:** `WhiteWrite WorldTree.html`
**Де:** `src/pages/WorldTree.tsx` (створити)
**Що треба:**
- [ ] Force Graph (D3.js)
  - [ ] Nodes: characters, locations, events, factions, artifacts
  - [ ] Edges: relationships
- [ ] Entity Panel (right sidebar)
  - [ ] Вкладки: Огляд / Звʼязки / Реконструкція
  - [ ] Fields: name, role, trait, goals, relations
- [ ] Reconstruction Engine overlay
  - [ ] Change analysis
  - [ ] Impact cascade
  - [ ] Reconstruction plan
- [ ] JSX: `wt-world.jsx`, `wt-graph.jsx`, `wt-panel.jsx`, `wt-impact.jsx`
- [ ] CSS портувати з `WhiteWrite WorldTree.html`

**Route:** `/worldtree/:projectId`

**ВАЖЛИВО:**
- `WORLD` = source of truth (єдине джерело канону)
- Reconstruction engine (`wt-impact.jsx`) на `window`

---

### 6. Режисер (Workspace)
**Джерело:** `WhiteWrite Workspace.html`
**Де:** `src/pages/Workspace.tsx` (створити)
**Що треба:**
- [ ] Storyboard (розкадровка сцен)
  - [ ] Scene cards з кадрами
  - [ ] Shot cards (кадри всередині сцени)
- [ ] Visual Canon (LoRA)
  - [ ] Character LoRA training sets
  - [ ] Image upload/management
- [ ] Shot Editor
  - [ ] Prompt, camera angle, lighting
- [ ] JSX: `ws-data.jsx`, `ws-storyboard.jsx`, `ws-shot.jsx`, `ws-lora.jsx`
- [ ] CSS портувати з `WhiteWrite Workspace.html`

**Route:** `/workspace/:projectId`

**ВАЖЛИВО:**
- `DATA` = VIEW над `WORLD` (не дублювання!)
- LoRA-референси → `projects/{id}/lora/{entityId}` (Firestore subcollection)

---

## 🚧 Блокери / Проблеми

**Поки немає блокерів.** Усе працює штатно.

---

## 🎯 Пріоритет на найближчий час

1. **CreateProject Modal** — завершити форму (scope/genres/ending/cover)
2. **Account page** — профіль, токени, плани підписки
3. **Книга (Narrative)** — пергамент, сцени, діалоги

---

**Версія:** 2026-06-04
**Останнє оновлення:** Landing/Auth/Projects портовані 1:1
