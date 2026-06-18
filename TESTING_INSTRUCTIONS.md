# 🧪 WhiteWrite Canon Extraction — Testing Instructions

## 📋 Pre-requisites

1. **Відкрийте браузер Chrome** (або Firefox/Edge з DevTools)
2. **Перейдіть на**: https://whitewrite-app.web.app
3. **Увійдіть** як `hrytsenkomaksym@gmail.com`
4. **Відкрийте проєкт** "Попіл життя" (або будь-який інший)

---

## 🚀 Quick Start (Copy-Paste Test)

### Крок 1: Відкрийте DevTools Console
- **Windows/Linux**: `Ctrl + Shift + J`
- **Mac**: `Cmd + Option + J`

### Крок 2: Скопіюйте весь код з файлу
Відкрийте файл: `E:\WhiteWrite\TEST_CANON_EXTRACTION.js`

### Крок 3: Вставте в Console і натисніть Enter

### Крок 4: Запустіть тести
```javascript
runAllTests()
```

**Або запускайте тести окремо:**
```javascript
// Test 1: Auto-Extraction (15 sec wait)
await testAutoExtraction()

// Test 2: ANALYZE Mode
await testAnalyze()

// Test 3: Plan Gates
testPlanGates()

// Test 4: Firestore Verification
await checkFirestore()
```

---

## 📊 Expected Results

### ✅ Test 1: Auto-Extraction
```
🧪 Test 1: Auto-Extraction
Project: proj_1781503252436_e7s6ce1wt
User: hrytsenkomaksym@gmail.com
Plan: worldforge
Tokens before: 179600
---
✅ Scene generated successfully!
Title: Сцена 1
Length: 423 chars
Tokens consumed: 300 (Claude) або 20 (Gemini)
Tokens remaining: 179300
---
⏳ Auto-extraction running in background...
```

**Після 15 секунд:**
- Firestore: `project.inferredCanon.scene_XXXXX` з'являється
- `suggestions` array містить 2-5 entities
- `status: 'pending'`

---

### ✅ Test 2: ANALYZE Mode
```
✅ Analysis complete!
---
📊 SCORES:
Overall Score: 7 /10
Detailed Scores:
  - Plot: 6 /10
  - Characters: 7 /10
  - Conflict: 8 /10
  - Atmosphere: 7 /10
  - Dialogue: 6 /10
  - Style: 7 /10
---
💪 STRENGTHS:
  - Strong conflict setup with changing terms
  - Good atmospheric description (smoky tavern)
  - Tension escalation through dialogue
---
⚠️  WEAKNESSES:
  - Limited character development
  - Predictable dialogue structure
  - Abrupt ending without resolution
---
💡 SUGGESTIONS:
  - Add internal monologue for Маркус
  - Expand physical descriptions
  - Provide more context about the artifact
---
Tokens consumed: 50
```

---

### ✅ Test 3: Plan Gates
```
📋 Plan Config:
- allowWorldTree: ✅
- allowCanonExtraction: ✅
- allowCanonSync: ✅
- allowAnalyze: ✅
- allowImprove: ✅
---
🔒 Plan Comparison:

FREE:
  WorldTree: ❌
  Extraction: ❌
  ANALYZE: ❌

STORYTELLER:
  WorldTree: ✅
  Extraction: ✅
  ANALYZE: ❌

NOVELIST:
  WorldTree: ✅
  Extraction: ✅
  ANALYZE: ✅
```

---

### ✅ Test 4: Firestore Verification
```
📦 Project Data:
Title: Попіл життя
Owner: D72FcLAn2xQritZkO6xYD5lxLDL2
Scenes count: 5
---
🌳 Canon:
Characters: 3
Locations: 2
Events: 1
---
📋 Inferred Canon:
Total scenes: 2
  - Pending: 1
  - Approved: 1
  - Rejected: 0

Latest pending suggestions:
Scene: scene_1718903252436
Suggestions count: 3
  - [character] Маркус: Згаданий як головний персонаж
  - [location] Таверна: Місце зустрічі персонажів
  - [artifact] Артефакт: Предмет пошуків
```

---

## 🖱️ Manual Tests (UI)

### Test 5: Review Queue UI

**Кроки:**
1. Відкрийте: https://whitewrite-app.web.app/WhiteWrite%20WorldTree.html
2. Клікніть **Chronicle** (іконка scroll)
3. **Очікується побачити:**
   - Секція **"Нові сутності на розгляді · N"**
   - Картки з extracted entities
   - Type badges: `character` (фіолетовий), `location` (блакитний), `event` (золотий)
   - Кнопки **"Прийняти"** / **"Відхилити все"**

**Тест Approval:**
1. Клікніть **"Прийняти"** на одній з сутностей
2. Перезавантажте сторінку (`F5`)
3. **Очікується:**
   - Suggestion зникла з queue
   - У Firestore: `canon.characters.char_XXX` — нова сутність
   - `inferredCanon.scene_XXX.status` → `'approved'`

---

### Test 6: Canon Sync Banner

**Підготовка:**
1. Створіть **новий проєкт** (або видаліть `canon` у існуючого в Firestore)
2. Додайте 2-3 сцени вручну

**Кроки:**
1. Відкрийте WorldTree → Chronicle
2. **Очікується побачити:**
   - 🔔 Banner: **"Канон порожній — Згенеруйте його з N сцен"**
   - Кнопка: **"⚡ Синхронізувати (X токенів)"**
3. Клікніть **"Синхронізувати"**
4. **Confirmation dialog:**
   ```
   Синхронізація канону з 3 сцен

   Вартість: 45 токенів (залишиться 179555)

   Продовжити?
   ```
5. Клікніть **OK**
6. **Очікується alert через 10-30 сек:**
   ```
   ✅ Синхронізація завершена!

   Оброблено: 3 сцен
   Витрачено: 45 токенів

   Перезавантажте сторінку щоб побачити результат.
   ```
7. Reload (`F5`)
8. **Очікується:**
   - Banner зник
   - Review Queue показує 3+ pending suggestions

---

## 🔍 Firestore Console Verification

**Відкрийте:**
https://console.firebase.google.com/project/whitewrite-app/firestore/data

### Перевірте структуру:

**1. `users/{uid}`**
```
{
  plan: "worldforge",
  tokensMonthly: 180000,
  tokensUsed: 400,  // Збільшилось після тестів
  tokensRemaining: 179600  // Зменшилось
}
```

**2. `projects/{projectId}/inferredCanon`**
```
{
  "scene_1718903252436": {
    suggestions: [
      {
        id: "char_001",
        type: "character",
        action: "add",
        targetId: "Маркус",
        newData: {
          name: "Маркус",
          role: "Головний герой",
          trait: "Обережний",
          ...
        },
        reason: "Згаданий як головний персонаж"
      }
    ],
    status: "pending",
    createdAt: Timestamp(...)
  }
}
```

**3. `projects/{projectId}/canon` (після approval)**
```
{
  characters: {
    "char_001": {
      name: "Маркус",
      role: "Головний герой",
      explicit: false,  // inferred
      inferredFrom: "scene_1718903252436",
      createdAt: Timestamp(...)
    }
  }
}
```

---

## ❌ Troubleshooting

### Problem: "Unauthorized" error
**Fix:** Перевірте, що ви увійшли в систему (`firebase.auth().currentUser`)

### Problem: "Not enough tokens"
**Fix:** Перевірте токени у Firestore: `users/{uid}/tokensRemaining`

### Problem: Extraction не з'являється в Firestore
**Fix:**
1. Зачекайте 20-30 секунд
2. Перевірте Cloud Function logs: https://console.firebase.google.com/project/whitewrite-app/functions

### Problem: 403 Forbidden for ANALYZE
**Fix:** Перевірте план у Firestore (`users/{uid}/plan` має бути `novelist` або вище)

---

## 📝 Test Checklist

**Backend (Cloud Functions):**
- [ ] generateScene працює
- [ ] Auto-extraction запускається (background)
- [ ] extractMemorySuggestions працює
- [ ] syncCanonFromProject працює
- [ ] analyzeScene працює
- [ ] Токени віднімаються правильно

**Firestore:**
- [ ] inferredCanon створюється
- [ ] suggestions містять правильні дані
- [ ] status = 'pending' спочатку
- [ ] Після approval → canon оновлюється
- [ ] status → 'approved'

**UI (WorldTree):**
- [ ] Review Queue показує pending suggestions
- [ ] Type badges правильні кольори
- [ ] "Прийняти" працює
- [ ] "Відхилити" працює
- [ ] Canon Sync banner показується
- [ ] Sync button працює

**Plan Gates:**
- [ ] Free plan: WorldTree прихований
- [ ] Free plan: extraction відключений
- [ ] Storyteller: WorldTree + extraction
- [ ] Novelist+: ANALYZE працює

---

## 🎯 Success Criteria

**✅ Система працює, якщо:**

1. Auto-extraction після генерації → inferredCanon populated
2. Review Queue показує suggestions → approval працює
3. Canon Sync (bulk) → processing всіх сцен
4. ANALYZE повертає valid JSON з scores
5. Plan gates блокують Free users
6. Токени віднімаються правильно
7. Firestore структура валідна

**Усі ці критерії мають бути виконані для production readiness!** 🚀
