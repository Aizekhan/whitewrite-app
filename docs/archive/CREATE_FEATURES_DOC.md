# Створити Feature Flags Document

## Через Firebase Console

1. Відкрити: https://console.firebase.google.com/project/whitewrite-app/firestore/data
2. Клікнути "Start collection" або знайти колекцію `config`
3. Якщо `config` не існує:
   - Collection ID: `config`
   - Document ID: `features`
4. Додати поля:
   ```
   universe: false (boolean)
   director: false (boolean)
   marketplace: false (boolean)
   ```
5. Зберегти

## Альтернатива: через браузер на whitewrite.com

1. Відкрити DevTools Console на whitewrite.com (після логіну)
2. Вставити:
```javascript
firebase.firestore().collection('config').doc('features').set({
  universe: false,
  director: false,
  marketplace: false,
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
}).then(() => console.log('✅ Features document created!'))
  .catch(err => console.error('❌ Error:', err));
```
3. Перезавантажити сторінку

## Поточний стан (все вимкнено)

```json
{
  "universe": false,
  "director": false,
  "marketplace": false
}
```

- Universe → Preview mode (показується, але дії disabled)
- Director → Preview mode (показується, але дії disabled)
- Marketplace → Приховано повністю

## Як увімкнути

Змінити у Firebase Console `config/features`:
- `universe: true` → Universe повністю працює
- `director: true` → Director повністю працює
- `marketplace: true` → Marketplace зʼявляється в навігації

**Зміни застосовуються миттєво для всіх користувачів!**
