# WhiteWrite — Фінальна модель ціноутворення v3

**Актуальна версія** — синхронізовано з `app/firebase/token-budget.js`

---

## 💰 ЧО ТИРИ ТІРИ (4 Plans)

### **FREE** — $0/міс

**Tokens:** 200/міс (~10 Gemini сцен)

**Фічі:**
- ✅ 10 Gemini сцен/міс
- ✅ 1 проєкт
- ✅ Canon-aware generation (read-only Universe)
- ❌ Claude
- ❌ Images
- ❌ Export
- ❌ Reconstruction

**Мета:** Hook на магію WhiteWrite

---

### **STORYTELLER** — $12/міс

**Tokens:** 2,400/міс (~120 Gemini сцен)

**Фічі:**
- ✅ 120 Gemini сцен/міс
- ✅ 5 проєктів
- ✅ **DOCX/PDF експорт** ← ключова фіча
- ❌ Claude
- ❌ Images (0 credits)
- ❌ Universe Reconstruction

**Мета:** Hobby writers — експорт книги як товару

**Маржа:** ~98% (витрати $0.06/user)

---

### **NOVELIST** — $29/міс ⭐ (Core monetization)

**Tokens:** 32,000/міс (гнучко витрачати)

**Еквівалент:**
- ~1,600 Gemini сцен (якщо всі токени на Gemini)
- ~106 Claude сцен (якщо всі на Claude)
- OR **реальний мікс:** 200 Gemini + 40 Claude + 50 images ≈ 31K tokens

**Фічі:**
- ✅ Гнучке витрачання 32K tokens (Gemini/Claude/Images — на вибір)
- ✅ Claude Sonnet доступ
- ✅ **100 image credits/міс** (≈14 повних сцен storyboard)
- ✅ **3 LoRA slots per project** (custom character models)
- ✅ **ПОВНА Universe Reconstruction** 🔥 (MOAT!)
- ✅ Hidden Canon (twists)
- ✅ ∞ проєктів
- ✅ Експорт DOCX/PDF/EPUB

**Мета:** Serious authors + візуалісти

**Маржа:** ~93% (avg $2.87/user, реалістичний мікс)

**Killer features:**
- Universe Reconstruction (ПОВНА — всі 6 типів змін)
- LoRA training (персоналізовані character models)
- Director storyboard візуалізація

---

### **WORLDBUILDER** — $69/міс

**Tokens:** 180,000/міс

**Еквівалент:**
- ~600 Claude сцен (якщо всі токени)
- OR 300 Claude + 500 images (типовий використання)

**Фічі:**
- ✅ 180K tokens (∞ Gemini + ~300 Claude practical limit)
- ✅ **500 image credits/міс** (~71 повних сцен)
- ✅ **10 LoRA slots per project**
- ✅ **API access** ← ключова фіча для studios
- ✅ Priority queue (0 wait time)
- ✅ Всі фічі Novelist
- ✅ Agent Mode (AI автоматично пропонує reconstruction)

**Мета:** Professionals, studios, серйозний візуал production

**Маржа:** ~93% ($5/user avg витрати)

---

## 📊 TOKEN SYSTEM (як працює)

### Token Costs:
- **Gemini scene:** 20 tokens (~$0.0003)
- **Claude scene:** 300 tokens (~$0.0135)
- **Image generate:** 3,500 tokens (~$0.05)
- **LoRA training:** 50,000 tokens (~$0.75, one-time per model)
- **Canon suggestion:** 10 tokens
- **Storyboard breakdown:** 5 tokens

### Гнучкість:
Novelist ($29) має 32,000 tokens — можна витратити:
- **Option A:** 1,600 Gemini сцен (текст-тільки)
- **Option B:** 106 Claude сцен (якість)
- **Option C:** 9 images (візуал-тільки, нереально)
- **Option D:** 200 Gemini + 40 Claude + 30 images ≈ 29K (реалістичний мікс)

---

## 🎯 КЛЮЧОВІ ВІДМІННОСТІ від PRICING_COMPLETE_V2.md

| Параметр | Старий (v2 DOCS) | Новий (v3 CODE) | Чому змінили |
|----------|------------------|-----------------|--------------|
| Free сцени | 15 Gemini | 10 Gemini | Зменшили freemium, збільшили конверсію |
| Storyteller ціна | $15 | $12 | Більш конкурентна ціна |
| Storyteller сцени | 150+10 Claude | 120 Gemini | Спростили (один провайдер) |
| Novelist ціна | $39 | $29 | Sweet spot для serious authors |
| Novelist сцени | 500 Gemini OR 100 Claude | 32K tokens (flexible) | Token system = flexibility |
| Worldbuilder ціна | $99 | $69 | Доступніше для studios |
| Worldbuilder Claude | 500 Claude + ∞ Gemini | 180K tokens (flexible) | Token system |

**Резюме змін:** Зменшили ціни, спростили систему через tokens, зробили гнучкіше.

---

## 🧮 UNIT ECONOMICS (оновлено)

### Storyteller ($12):
- Витрати: 120 × $0.0005 = **$0.06/user**
- Маржа: $12 - $0.06 = **$11.94 (99.5% маржа)**

### Novelist ($29):
- Реалістичний мікс (70% text, 30% visual):
  - 70% users: 280 Gemini × $0.0005 = $0.14 per user
  - 30% users: 40 Claude ($1) + 50 images ($2.50) + 1 LoRA ($0.75) = $4.25 per user
- Avg: (0.7 × $0.14) + (0.3 × $4.25) = **$1.37/user**
- Маржа: $29 - $1.37 = **$27.63 (95% маржа)**

### Worldbuilder ($69):
- Типовий: 100 Claude ($2.50) + 200 images ($10) + 3 LoRA ($2.25) = **$14.75/user**
- Маржа: $69 - $14.75 = **$54.25 (79% маржа)**

**Загальна target маржа:** 90%+

---

## 🔐 FEATURE GATES (як імплементовано)

В `token-budget.js` кожен план має:

```javascript
{
  allowClaude: boolean,       // Доступ до Claude Sonnet
  allowImages: boolean,       // Генерація зображень
  allowReconstruction: boolean, // Universe Reconstruction
  allowExport: boolean,       // DOCX/PDF експорт
  allowAPI: boolean,          // API access
  allowLoRA: boolean,         // LoRA training
  priority: boolean,          // Priority queue

  maxProjects: number,        // Макс проєктів
  imageCreditsGuideline: number, // Soft limit (UI guidance)
  loraSlots: number          // LoRA models per project
}
```

**Використання:** Перед показом UI фічі — перевіряй `window.__wwUser.allowClaude` etc.

---

## ✅ READY FOR STRIPE

Коли Phase 1-7 готові (features працюють), увімкнути Stripe:

1. Create Products:
   - Storyteller: $12/міс
   - Novelist: $29/міс
   - Worldbuilder: $69/міс

2. Webhook `checkout.session.completed` → update `users/{uid}.plan`

3. Customer Portal для керування підпискою

**Поки що:** План міняється вручну в Firestore Console (поле `plan`)

---

## 🎨 ДЛЯ PRICING PAGE (коли робитимеш UI)

### Free:
**Заголовок:** Спробуйте магію WhiteWrite
**Опис:** 10 сцен, 1 проєкт, canon-aware generation
**Кнопка:** Почати безкоштовно

### Storyteller — $12/міс:
**Заголовок:** Для письменників-hobbyістів
**Опис:** 120 Gemini сцен, експорт DOCX/PDF, 5 проєктів
**Highlight:** ✨ Експортуйте свою книгу
**Кнопка:** Підписатись

### Novelist — $29/міс ⭐ POPULAR:
**Заголовок:** Для серйозних авторів
**Опис:** 32K tokens (гнучко), Claude, 100 images, 3 LoRA, Universe Reconstruction
**Highlight:** 🔥 Universe Reconstruction — MOAT!
**Кнопка:** Вибрати Novelist

### Worldbuilder — $69/міс:
**Заголовок:** Для студій та професіоналів
**Опис:** 180K tokens, 500 images, 10 LoRA, API, пріоритет
**Highlight:** 🎬 Повний препродакшн візуал
**Кнопка:** Підписатись

---

**Дата останньої синхронізації:** 2026-06-16
**Актуальний файл коду:** `app/firebase/token-budget.js`
