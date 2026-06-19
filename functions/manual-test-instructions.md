# Ручне тестування projectId sync

## Кроки:

1. Відкрити https://whitewrite-app.web.app
2. Зареєструвати новий акаунт: `testuser123@test.com` / `test123456`
3. Створити проєкт "Тестова історія"
4. Згенерувати 2-3 сцени
5. Перейти у Всесвіт → Персонажі
6. Перевірити чи є сцени у випадаючому меню

## Очікуваний результат:

Scene dropdown має показувати:
- Уся історія
- Сцена 1: [назва]
- Сцена 2: [назва]
- Сцена 3: [назва]

## Логи для перевірки в консолі:

```
[Shell] Sent projectId to iframe: proj_xxx
[WorldTree] Embedded mode — projectId from global: proj_xxx
[WorldTree] ✅ Scenes loaded: 3
```

Якщо scene dropdown порожній → projectId НЕ синхронізовано
