# Auth Testing Guide

## ✅ Auth UI Ready!

**Dev сервер:** http://localhost:5173/

---

## 🧪 Як протестувати

### 1. **Відкрийте лендінг**
   - Відкрийте http://localhost:5173/ у браузері
   - Побачите лендінг з кнопкою "Увійти" вгорі справа

### 2. **Відкрийте Auth Modal**
   - Клікніть **"Увійти"** або **"Розпочати подорож"**
   - Модалка відкриється з двома табами: **Вхід** / **Реєстрація**

### 3. **Створіть акаунт (Email + Password)**
   - Перейдіть на таб **"Реєстрація"**
   - Введіть:
     - Імʼя: `Майстер всесвітів`
     - Пошта: `test@whitewrite.com`
     - Пароль: `test123` (мінімум 6 символів)
   - Клікніть **"✦ Створити"**
   - Акаунт створено! ✅

### 4. **Вийдіть і увійдіть знову**
   - Після створення акаунту побачите:
     - **User Dock** (внизу зліва) з вашим ініціалом `M`
     - Кнопку **"Вийти"** (вгорі справа)
   - Клікніть **"Вийти"**
   - Знову клікніть **"Увійти"**
   - Перейдіть на таб **"Вхід"**
   - Введіть ті ж дані
   - Клікніть **"✦ Увійти"**
   - Ви залогінені! ✅

### 5. **Google Sign-In**
   - Відкрийте модалку входу
   - Клікніть **"Увійти через Google"**
   - Вибе
ріть Google акаунт
   - Після успішного входу побачите User Dock з фото профілю Google

### 6. **Перевірте Firebase Console**
   - Відкрийте: https://console.firebase.google.com/project/whitewrite-app/authentication/users
   - Побачите створених користувачів:
     - Email/Password users
     - Google users
   - Кожен має `uid` (стабільний ID)

---

## 🎯 Що працює

✅ **Email/Password Sign-Up**
✅ **Email/Password Sign-In**
✅ **Google OAuth Sign-In**
✅ **Sign Out**
✅ **Auth State Persistence** (reload сторінки → лишається залогінений)
✅ **Auth Gate** (без логіну → модалка; з логіном → navigate to /projects)
✅ **User Dock** (аватар, імʼя, email)
✅ **Error Handling** (wrong password, email already exists, etc.)

---

## 🐛 Відомі issues

- **Display Name** не зберігається при Email/Password реєстрації (TODO: Firebase `updateProfile`)
- **Tokens** показують `∞` (placeholder, потім буде реальний лічильник з Firestore)
- **Navigate to /projects** поки не працює (сторінка ще не створена) — наступний крок!

---

## 🚀 Наступний крок: Projects CRUD

Тепер коли Auth працює, створюємо:

1. **/projects** page (список проєктів)
2. **Create Project** modal
3. **Edit/Delete** проєктів
4. **Firestore integration** з `owner: uid`

Готовий продовжити?
