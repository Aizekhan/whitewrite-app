# Firestore Pricing Cleanup Instructions

**ВАЖЛИВО:** Прибрати невикористовувані поля з `economy_operations/generateScene`

## Як оновити (Firebase Console):

1. Відкрити: https://console.firebase.google.com/project/whitewrite-app/firestore/data/~2Feconomy_operations~2FgenerateScene

2. Замінити весь документ на:

```json
{
  "name": "Scene Generation",
  "_comment": "cost = FINAL user token price (changed without deploy via Firestore Console). marginMultiplier/estimatedCostPer700Words NOT USED.",
  "providers": {
    "claude": {
      "cost": 300,
      "model": "claude-sonnet-4-5"
    },
    "gemini": {
      "cost": 20,
      "model": "gemini-2.5-flash"
    }
  }
}
```

## Що прибрано (не використовується):
- `marginMultiplier` (формула не викликається, backend читає `cost` напряму)
- `baseTokens` (дублює `cost`)
- `tokensPer100Words` (не використовується)
- `estimatedCostPer700Words` (не використовується)

## ЄДИНЕ ДЖЕРЕЛО ПРАВДИ:
- **`providers.claude.cost`** = 300 токенів/сцена
- **`providers.gemini.cost`** = 20 токенів/сцена

Міняти БЕЗ деплою через Firestore Console.
