# Pagination Session — 2026-06-21

**Статус:** ❌ Не завершено, відкочено до робочої версії
**Коміт:** `907f06f` (Refactor: Guided Mode = endless, Auto Mode = structured + 50 languages)

---

## 🎯 Мета сесії

Виправити пагінацію тексту в Book view (`app/book.jsx`):
- Текст має заповнювати всю доступну висоту сторінки до червоного бордера
- Текст має автоматично переноситись на наступну сторінку, коли не влізає
- Обидві сторінки розвороту (ліва/права) мають заповнюватись
- Система має масштабуватись (не ламатись на 1000+ сторінок)

---

## 📋 Що зробили

### ✅ Успішно
1. **Відкотили `allSpreads` та `globalPageIndex`** - повернулись до per-scene пагінації з плоским масивом `allPages`
2. **Зробили probe off-screen** - `position:fixed;left:-9999px`, не залежить від DOM timing
3. **Просте парування сторінок** - `chunk(allPages, 2)` для left/right spreads
4. **Виправили навігацію на spread-based** - прибрали `sc` (scene index), навігація тепер по `pg` (spread index)
5. **Виправили всі крешi** - `scene.pages` більше не використовується, все через `spreads[]`

### ⚠️ Проблемні спроби (відкочено)
1. **Спроба 1-2**: Змінювали CSS margins (`bottom: 8cqw → 3cqw → 2cqw → 0`)
2. **Спроба 3**: ✅ Працювала! Накопичення параграфів у probe → "текст заповнив 2 сторінки правильно"
3. **Спроби 4-5**: Зламали Спробу 3, додавши `allSpreads` та `globalPageIndex`
4. **Спроби 6-10**: Боролись з симптомами власної поломки (DOM timing, container not found)

### ❌ Остання спроба (не спрацювала)
**Проблема:** `scrollHeight: 4px` - probe не рендерить контент

**Причини:**
1. `probeFade.style.height = "526px"` - фіксована висота блокувала `scrollHeight`
2. Прибрали `height:526px` → все одно `scrollHeight: 4px` (CSS не застосувався)
3. Змінили на вимірювання `probeContainer.scrollHeight` → знову 4px
4. Спробували додати inline стилі (font-family, font-size) → не допомогло
5. **Корінна проблема:** off-screen probe з `left:-9999px` не отримує computed styles з CSS класів

**Спроба виправити:** Додали складну структуру `probeWrapper → probeFade → probeContainer` з inline CSS + вимірювання `containerHeight - headerHeight` → **зламало все взагалі**

**Рішення:** Відкочено до коміту `907f06f` (працююча версія БЕЗ наших експериментів)

---

## 🔍 Труднощі

### 1. **Off-screen probe не рендериться**
- Елементи з `position:fixed;left:-9999px` створюються, але браузер не застосовує CSS стилі з класів
- `scrollHeight` завжди 4px, незалежно від контенту
- Потрібен інший підхід до вимірювання

### 2. **CSS Container Query Units (`cqw`)**
- `bottom: 2cqw` не працює в off-screen probe (немає container context)
- Складно точно вирахувати доступну висоту

### 3. **Pagination timing**
- `useEffect` спрацьовує до React DOM commit → probe не може знайти `.photobook__pages`
- Навіть з off-screen probe виникають race conditions

### 4. **Відсутність робочої Спроби 3 в git**
- Спроба 3 працювала ("текст заповнив 2 сторінки правильно"), але не був закомічений
- Довелось відкочуватись до повністю старої версії замість до робочої Спроби 3

---

## 📊 Поточний стан (коміт 907f06f)

### Працює ✅
- Firestore завантаження сцен
- Базова навігація книгою (← →)
- Scene picker (вибір сцени з меню)
- Auth + token system
- AI generation (Guided/Auto modes)

### Не працює ❌
- **Height-based pagination** - текст не розбивається на сторінки правильно
- Текст не заповнює до кінця червоного бордера
- Одна сцена = одна сторінка (замість багатьох сторінок)

### Поточний код pagination
**Файл:** `app/book.jsx` (lines ~92-190)
**Підхід:** Character-based pagination з фіксованими лімітами:
```javascript
const CHARS_PER_PAGE_FIRST = 1400; // First page (with header)
const CHARS_PER_PAGE = 1800; // Other pages
```

**Проблема:** Не враховує реальну висоту рендерингу, тому текст не заповнює сторінки рівномірно.

---

## 🛠 Що треба зробити (наступна сесія)

### План А: Повернути Спробу 3 (найкраще)
1. Знайти в історії сесії опис Спроби 3 (з попередньої розмови)
2. Відновити робочу логіку:
   - Probe створює DOM елемент
   - Накопичує параграфи по одному
   - Вимірює `scrollHeight` після кожного додавання
   - Коли `scrollHeight > limit` → створює нову сторінку
3. **Ключова відмінність від наших спроб:** probe має бути **у DOM з правильним CSS context**, а не off-screen

### План Б: Фіксований підхід з правильним probe
1. **Створювати probe ВСЕРЕДИНІ `.photobook__pages`** (а не off-screen):
   ```javascript
   const container = document.querySelector('.photobook__pages .opage--left');
   const probe = document.createElement('div');
   probe.className = 'opage__fade';
   probe.style.visibility = 'hidden'; // Invisible but RENDERED
   container.appendChild(probe);
   ```
2. Це гарантує, що CSS стилі застосуються (font-size, line-height, container queries)
3. `scrollHeight` буде правильним
4. Після пагінації - `probe.remove()`

### План В: Залишити character-based, але підлаштувати
1. Виміряти реальну кількість символів, що влізає на сторінку (з header і без)
2. Підібрати `CHARS_PER_PAGE_FIRST` та `CHARS_PER_PAGE` експериментально
3. Швидко, але неточно (різні шрифти, мови, абзаци дають різну висоту)

---

## 📁 Змінені файли

### `app/book.jsx`
- **Спробували:** Повну заміну pagination логіки (off-screen probe, spreads-based navigation)
- **Результат:** Відкочено до `907f06f`
- **Лишилось:** Character-based pagination (працює, але неточна)

### `app/WhiteWrite.html`
- **Lines 710:** `.opage .page-inner` має `bottom: 2cqw` - це важливо для точного вимірювання
- **Не чіпали**

---

## 🎓 Висновки

### Що дізнались
1. **Off-screen probe (`left:-9999px`) НЕ працює** - браузер не застосовує CSS стилі з класів
2. **Container Query Units потребують container context** - в off-screen елементі `cqw` не працює
3. **`scrollHeight` залежить від computed styles** - без правильного CSS рендерингу `scrollHeight` = 4px
4. **Git commits критичні** - якби закомітили Спробу 3, могли б повернутись до неї швидко

### Що НЕ робити
1. ❌ Не створювати складні структури probe (`probeWrapper → probeFade → probeContainer`) без тестування
2. ❌ Не задавати `height` на probe - блокує `scrollHeight`
3. ❌ Не додавати `allSpreads` глобальний масив - ламає per-scene логіку
4. ❌ Не намагатись inline копіювати CSS - складно і ненадійно

### Що робити
1. ✅ Створювати probe **у DOM** з правильним CSS context (`.photobook__pages`)
2. ✅ Використовувати `visibility: hidden` замість `left: -9999px`
3. ✅ Вимірювати `scrollHeight` на реальному рендері
4. ✅ Комітити кожну робочу спробу в git
5. ✅ Логувати все (scrollHeight, fadeHeight, paragraph count) для debug

---

## 📞 Для наступного асистента

**Ти продовжуєш роботу над pagination в Book view.**

### Швидкий контекст
- Користувач хоче, щоб текст заповнював сторінки до червоного бордера
- Поточна версія (907f06f) працює, але використовує character-based pagination (неточна)
- Ми спробували height-based pagination з off-screen probe → не спрацювало (scrollHeight = 4px)

### Що робити
1. Прочитай цей файл повністю
2. Прочитай попередню сесію summary (якщо є)
3. Спробуй **План Б** (probe всередині DOM з `visibility:hidden`)
4. Якщо не спрацює - запитай користувача, чи хоче він:
   - План А (шукати Спробу 3 в історії)
   - План В (залишити character-based, але підлаштувати)
   - Інший підхід

### Важливо
- НЕ змінюй багато коду одночасно - маленькі кроки
- Логуй `scrollHeight` на кожному кроці
- Комітуй робочі версії в git
- Якщо зламав - одразу відкочуй (`git checkout app/book.jsx`)

---

**Версія:** 2026-06-21
**Останнє оновлення:** Відкочено до 907f06f, сесія завершена
