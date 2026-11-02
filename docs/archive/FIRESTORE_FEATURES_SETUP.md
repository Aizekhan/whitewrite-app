# Feature Flags Setup

## Firestore Document Structure

Create a document in Firestore at path: `config/features`

```
Collection: config
Document ID: features
Fields:
  - universe: boolean (false = preview mode, true = full access)
  - director: boolean (false = preview mode, true = full access)
```

## How to Create (Firebase Console)

1. Go to: https://console.firebase.google.com/project/whitewrite-app/firestore
2. Click "Start collection"
3. Collection ID: `config`
4. Document ID: `features`
5. Add fields:
   - Field: `universe`, Type: boolean, Value: `false`
   - Field: `director`, Type: boolean, Value: `false`
6. Click "Save"

## How to Enable Features

Simply change the values in Firebase Console:
- `universe: true` → enables full Universe (WorldTree) access
- `director: true` → enables full Director (Workspace) access

**No code deployment needed!** Changes take effect immediately for all users.

## Current State (Default)

```json
{
  "universe": false,
  "director": false
}
```

Both features are in **preview mode**:
- Users can browse and navigate
- All action buttons (Add, Edit, Generate, Reconstruction) are disabled
- "Coming Soon" banner is shown
- Tooltip: "Available soon" on disabled buttons
