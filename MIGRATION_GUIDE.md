# Token Budget System — Migration Guide

## Quick Migration (Firestore Console)

### Option 1: Manual (for small user base)

1. Open Firestore Console:
   ```
   https://console.firebase.google.com/project/whitewrite-app/firestore/databases/-default-/data
   ```

2. For each user document in `users/` collection:
   - Check if `tokensUsed` field exists → skip if yes
   - Calculate: `tokensUsed = (geminiScenes × 20) + (claudeScenes × 300)`
   - Add field: `tokensUsed: <calculated value>`
   - Add field: `usage: {}`

3. Example:
   ```
   User: D72FcLAn2xQritZkO6xYD5lxLDL2
   geminiScenes: 8
   claudeScenes: 0

   → tokensUsed = (8 × 20) + (0 × 300) = 160
   ```

### Option 2: Automated (Node.js script)

**Prerequisites:**
```bash
npm install firebase-admin
```

**Run migration:**
```bash
# Set service account credentials
export GOOGLE_APPLICATION_CREDENTIALS="path/to/serviceAccountKey.json"

# Run script
node migrate-to-tokens.js
```

The script will:
- ✅ Convert `scenesGenerated`/`geminiScenes`/`claudeScenes` → `tokensUsed`
- ✅ Create `usage` breakdown for analytics
- ✅ Preserve old fields as `_oldSceneCounters` (for rollback)
- ⏭  Skip users already migrated

---

## Token Costs Reference

| Operation | Cost (tokens) | Real $ |
|-----------|--------------|--------|
| Gemini scene | 20 | $0.0003 |
| Claude scene | 300 | $0.0135 |
| Image | 3500 | $0.05 |
| Canon suggestion | 10 | $0.00015 |

---

## Plan Budgets

| Plan | Monthly Budget | Equivalent |
|------|---------------|------------|
| Free | 200 | 10 Gemini scenes |
| Storyteller | 2,400 | 120 Gemini scenes |
| Novelist | 32,000 | 400 Gemini OR 80 Claude + 100 images |
| Worldbuilder | 180,000 | 300 Claude + 500 images |

---

## Rollback (if needed)

If migration breaks something:

1. Restore old counter logic in `firebase-auth.js`
2. Update UI to show `scenesGenerated` instead of `tokensUsed`
3. Old fields are preserved as `_oldSceneCounters` in Firestore

---

## Testing After Migration

1. **Check logs:**
   ```
   User plan loaded: worldforge (160/180000 tokens, 179840 remaining)
   ```

2. **Generate a scene:**
   - Should consume 20 tokens (Gemini) or 300 (Claude)
   - Counter should update in UI: `179,820 / 180K токенів`

3. **Check Firestore:**
   ```
   users/{uid}
     - tokensUsed: 180  (was 160, now +20)
     - usage: {
         sceneGemini: { count: 9, tokens: 180 }
       }
   ```

---

## Migration Checklist

- [ ] Backup Firestore (export users collection)
- [ ] Run migration script OR manual update
- [ ] Verify tokensUsed field exists for all users
- [ ] Deploy new code (firebase deploy --only hosting)
- [ ] Test: generate scene → check token consumption
- [ ] Monitor logs for errors

**Estimated time:** 5-10 min (manual) or 1 min (script)
