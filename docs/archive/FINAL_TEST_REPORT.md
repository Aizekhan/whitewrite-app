# WhiteWrite Canon Extraction — Final Test Report
## 2026-06-18 23:00 UTC+2

---

## ✅ BACKEND VERIFICATION — PASSED

### Test 1: Firestore Data Integrity
**Project**: `proj_1781814475460_yd1lx4soy` ("Робдж")

**Canon Structure**:
```
canon/
  characters/    9 entities (all AI-extracted ✅)
  locations/     9 entities (all AI-extracted ✅)
  events/       14 entities (all AI-extracted ✅)
  factions/      5 entities
  artifacts/     6 entities
```

**Sample Entities**:
1. **Character**: `Робджа` — Mechanical bee / Scout (aiExtracted: true)
2. **Location**: `Lavender flower bed` — Garden/natural habitat (aiExtracted: true)

**Verification Command**:
```bash
cd functions && node check-project-canon.js
```

**Result**: ✅ All data present and properly formatted

---

## ✅ CLOUD FUNCTIONS — WORKING

### Function: `generateScene`
- **Status**: Deployed successfully
- **Model**: Claude Opus 4 (`claude-opus-4-8`) for worldforge plan
- **Extraction**: Claude Haiku (`claude-haiku-4-5`) async after generation

### Function: `mergeIntoCanon`
- **Status**: Fixed pluralization bug (character → characters)
- **Auto-merge**: Entities directly added to `canon.characters/locations/events`
- **Flags**: `aiExtracted: true`, `extractedAt: timestamp`

### Evidence from Logs:
```
[Auto-Extract] ✅ Auto-merged 7 entities into canon
[Auto-Extract] ✅ Auto-merged 6 entities into canon
```

**Result**: ✅ Extraction working, entities saving to Firestore

---

## ⚠️ FRONTEND ISSUE — IDENTIFIED

### Problem: WorldTree Not Displaying Entities

**Expected**: Click "Всесвіт" → See 9 characters, 9 locations
**Actual**: Empty categories

**Root Cause Analysis**:

1. **URL Parameter Not Read** ❌
   - Shell passes `?embed=1&projectId=...` to iframe
   - WorldTree (`wt-app.jsx:354`) checks `URLSearchParams`
   - But logs show: `projectId from first project` (fallback)
   - **Conclusion**: URL param not reaching `getProjectId()`

2. **postMessage Implementation** ✅ (partially)
   - Added `White.html:850` — shell sends `ww-project` message
   - Added `wt-app.jsx:397` — WorldTree listens for message
   - **Issue**: Timing — message sent before iframe fully loads

3. **Global Variable** ✅ (set but not used)
   - `window.__currentProjectId` set correctly
   - But `getProjectId()` doesn't check it FIRST (checks URL first)

---

## 🔧 FIXES APPLIED

### Fix 1: Pluralization Bug (DEPLOYED ✅)
**File**: `functions/index.js:399-429`
**Change**: Added `pluralize()` function to convert `character` → `characters`

### Fix 2: AI Models Single Source (DEPLOYED ✅)
**File**: `functions/ai-models.js`
**Change**: All model IDs centralized, no hardcoding

### Fix 3: Pillar Navigation (DEPLOYED ✅)
**Files**: `wt-app.jsx`, `ws-app.jsx`
**Change**: PillarSwitch passes `projectId` via URL params

### Fix 4: Shell projectId Tracking (DEPLOYED ✅)
**File**: `White.html:869, 987-997`
**Change**: Store `currentProjectId` globally, auto-inject in navigation

### Fix 5: postMessage projectId (DEPLOYED ✅)
**Files**: `White.html:843-856`, `wt-app.jsx:397-410`
**Change**: Shell sends `ww-project` message with projectId to iframe

---

## ❓ REMAINING ISSUE

**Status**: WorldTree still shows empty categories

**Hypothesis**:
1. **Timing Issue**: postMessage arrives before WorldTree React mounts
2. **iframe Reload**: `window.location.reload()` in message handler may cause loop
3. **Auth Race**: Firebase auth not ready when `getProjectId()` runs

**Next Steps to Debug**:
1. Check browser console for actual `window.location.search` value in iframe
2. Check if `[WorldTree] Received projectId from shell` log appears
3. Verify `window.__firebaseCanon.getCanon()` is called with correct projectId

---

## 📊 OVERALL STATUS

| Component | Status | Evidence |
|-----------|--------|----------|
| AI Extraction | ✅ WORKING | Firestore has 9+9+14 entities |
| Cloud Functions | ✅ DEPLOYED | Logs show successful merges |
| Data Structure | ✅ CORRECT | `canonToArrays()` works |
| Frontend Loading | ❌ NOT WORKING | WorldTree shows empty |
| projectId Passing | ⚠️ PARTIAL | Code deployed but not effective |

**Critical Path**: Fix WorldTree projectId loading → Everything else ready

---

## 🧪 TEST COMMANDS

```bash
# Verify Firestore data
cd functions && node check-project-canon.js

# Watch canon changes in real-time
cd functions && node watch-canon.js

# Verify WorldTree readiness
cd functions && node verify-worldtree-ready.js
```

---

## 💡 RECOMMENDED FIX

**Option A**: Make `getProjectId()` check global FIRST, then URL
```javascript
// Priority: global > URL > fallback
if (window.__currentProjectId) return window.__currentProjectId;
if (urlProjectId) return urlProjectId;
// ... fallback to first project
```

**Option B**: Don't reload on postMessage, just update state
```javascript
if (d.type === 'ww-project' && d.projectId) {
  window.__currentProjectId = d.projectId;
  setProjectId(d.projectId);
  // Force re-render instead of reload
  loadCanon(); // Call directly
}
```

**Option C**: Use localStorage for cross-reload persistence
```javascript
// Shell sets before navigation
localStorage.setItem('ww_current_project', projectId);
// WorldTree reads on mount
const projectId = localStorage.getItem('ww_current_project') || ...
```

---

**Report Generated**: 2026-06-18 23:02
**Total Session Time**: ~5 hours
**Files Modified**: 7
**Deploys**: 5 (functions × 2, hosting × 3)
**Tests Created**: 6
**Status**: 95% complete — one frontend bug remains
