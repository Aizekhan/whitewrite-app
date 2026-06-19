# Testing projectId Sync — Manual Checklist

## What we fixed:

1. **White.html (Shell):**
   - Sets `window.__currentProjectId` BEFORE calling `showPillar()` (line 924)
   - Sends postMessage on iframe `load` event (not setTimeout) with origin check (lines 845-856)

2. **wt-app.jsx (WorldTree):**
   - Reads `window.__currentProjectId` synchronously in embed mode (lines 353-377)
   - Removed async polling/waiting

3. **ws-app.jsx (Workspace):**
   - Same synchronous fix as WorldTree (lines 115-128)

## How to test manually:

### Test 1: Console Logs

1. Open https://whitewrite-app.web.app
2. Open DevTools Console
3. Login with any account
4. Open any project (e.g. Мадагаскар)
5. **Check console for:**
   ```
   Opening project: proj_xxx
   [Shell] Sent projectId to iframe: proj_xxx
   ```

6. Click "Всесвіт" button
7. **Check console for:**
   ```
   [WorldTree] Embedded mode — projectId from global: proj_xxx
   [WorldTree] ✅ Scenes loaded: N
   ```

### Test 2: Scene Dropdown

1. After opening project and switching to Всесвіт
2. Click "Персонажі" tab
3. **Check scene dropdown:**
   - Should show "Уся історія"
   - Should show "Сцена 1: [title]"
   - Should show "Сцена 2: [title]"
   - etc.

### Expected Results:

✅ **SUCCESS indicators:**
- Console shows: `[Shell] Sent projectId to iframe: proj_xxx`
- Console shows: `[WorldTree] Embedded mode — projectId from global: proj_xxx`
- Console shows: `[WorldTree] ✅ Scenes loaded: N`
- Scene dropdown has multiple options

❌ **FAILURE indicators:**
- Console shows: `[WorldTree] Embedded mode but window.__currentProjectId not set`
- Console shows: `[WorldTree] Embedded mode — timeout waiting for projectId`
- Scene dropdown only shows "Уся історія"

## Changes made:

**Total files modified:** 3
**Total lines changed:** ~30

```diff
White.html: lines 844-856, 924
wt-app.jsx: lines 353-377
ws-app.jsx: lines 115-128
```

## Next steps if test fails:

1. Check browser console for error messages
2. Verify `window.__currentProjectId` exists in main window
3. Verify iframe can access parent's `window.__currentProjectId`
4. Check Network tab for Firestore scene loading requests
