# ⚡ Quick Test Guide — Canon Extraction

## 🚀 One-Command Test (Copy-Paste)

### Step 1: Open App
https://whitewrite-app.web.app

### Step 2: Login
Email: `hrytsenkomaksym@gmail.com`

### Step 3: Open Project
Проєкт: **"Попіл життя"**

### Step 4: Open Console
- Windows: `Ctrl + Shift + J`
- Mac: `Cmd + Option + J`

### Step 5: Run Tests
```javascript
// Copy entire file: E:\WhiteWrite\TEST_CANON_EXTRACTION.js
// Paste into Console, then run:

runAllTests()
```

---

## 📊 Expected Timeline

```
[0s]   ✅ Scene generated (20-300 tokens)
[15s]  ⏳ Auto-extraction background processing
[20s]  ✅ ANALYZE mode test (50 tokens)
[25s]  ✅ Plan gates verification
[30s]  ✅ Firestore structure check
[35s]  📋 Manual UI test instructions
```

**Total time:** ~35 seconds + manual UI tests

---

## 🔍 Quick Verification

### Check Firestore Immediately
https://console.firebase.google.com/project/whitewrite-app/firestore/data

**Перевірте:**
1. `users/D72FcLAn2xQritZkO6xYD5lxLDL2`
   - `plan: "worldforge"`
   - `tokensRemaining` зменшилось після тестів

2. `projects/proj_1781503252436_e7s6ce1wt/inferredCanon`
   - Нові `scene_XXX` ключі з'явились
   - `status: "pending"`
   - `suggestions[]` містить entities

---

## 🎯 Success Indicators

**Console Output:**
```
✅ Scene generated successfully!
✅ Analysis complete!
✅ Firestore verification complete
✅ ALL TESTS COMPLETE!
```

**Firestore Changes:**
- `inferredCanon` має нові сцени
- `tokensUsed` збільшився на ~370 токенів
- `tokensRemaining` зменшився

**UI (WorldTree → Chronicle):**
- "Нові сутності на розгляді · N" — показується
- Suggestions відображаються з badges
- Кнопки "Прийняти" / "Відхилити" працюють

---

## 🧪 Individual Tests (Optional)

### Test Auto-Extraction Only
```javascript
await testAutoExtraction()
// Wait 15 seconds
// Check Firestore: inferredCanon should have new scene
```

### Test ANALYZE Only
```javascript
await testAnalyze()
// Should return scores, strengths, weaknesses
```

### Test Plan Gates Only
```javascript
testPlanGates()
// Should show worldforge has ALL features ✅
```

### Test Firestore Only
```javascript
await checkFirestore()
// Should show project structure + inferred canon
```

---

## 🔧 Troubleshooting

### "Unauthorized" error
→ Перезавантажте сторінку і увійдіть знову

### "Not enough tokens"
→ Перевірте Firestore: `users/{uid}/tokensRemaining`
→ Має бути > 400 для всіх тестів

### Extraction не з'являється
→ Зачекайте 20-30 секунд
→ Перевірте Cloud Function logs:
https://console.firebase.google.com/project/whitewrite-app/functions

### 403 Forbidden for ANALYZE
→ Перевірте план: має бути `novelist` або `worldforge`

---

## 📋 Manual UI Tests

### Test 1: Review Queue
1. Відкрийте https://whitewrite-app.web.app/WhiteWrite%20WorldTree.html
2. Клікніть **Chronicle** (іконка scroll)
3. Шукайте **"Нові сутності на розгляді · N"**
4. Клікніть **"Прийняти"** на будь-якій сутності
5. Перезавантажте (`F5`)
6. Перевірте Firestore: `canon.characters` має нову сутність

### Test 2: Canon Sync
1. Створіть новий проєкт (або видаліть `canon` у Firestore)
2. Додайте 2-3 сцени вручну
3. Відкрийте WorldTree → Chronicle
4. Має з'явитись banner: **"Канон порожній — Згенеруйте його з N сцен"**
5. Клікніть **"Синхронізувати"**
6. Підтвердіть у dialog (показує вартість токенів)
7. Зачекайте alert **"✅ Синхронізація завершена!"**
8. Reload → Review Queue має показати suggestions

---

## 🎯 Final Checklist

**Before Testing:**
- [ ] Logged in as `hrytsenkomaksym@gmail.com`
- [ ] Plan = `worldforge` (verify in Firestore)
- [ ] Tokens > 400 (verify in Firestore)
- [ ] Project opened: "Попіл життя"

**After Testing:**
- [ ] Console shows "✅ ALL TESTS COMPLETE!"
- [ ] Firestore `inferredCanon` populated
- [ ] Review Queue UI shows suggestions
- [ ] Tokens deducted correctly
- [ ] No 403/401/500 errors

---

**Ready to test? Просто запустіть `runAllTests()` у Console!** 🚀
