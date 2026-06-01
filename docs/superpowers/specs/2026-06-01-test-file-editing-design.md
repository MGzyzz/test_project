# Test File Editing with Version History

**Date:** 2026-06-01  
**Status:** Approved

## Overview

Allow any authenticated user to edit quiz test files directly in the browser and save changes to the server. Every save creates a version history entry. Admin can view history and restore any previous version.

## Constraints

- Hosted on Vercel (frontend) + Render (backend) + Supabase (PostgreSQL)
- Filesystem on Render is ephemeral — all file persistence must go through the database
- Files currently served as static `.txt` files from `public/` on Vercel

## Database

### `file_contents` — current version of each file
```sql
CREATE TABLE file_contents (
  filename   TEXT PRIMARY KEY,   -- e.g. "invasive_diseases_200.txt"
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `file_versions` — full version history
```sql
CREATE TABLE file_versions (
  id         SERIAL PRIMARY KEY,
  filename   TEXT NOT NULL,
  content    TEXT NOT NULL,
  saved_by   TEXT NOT NULL,       -- username
  saved_at   TIMESTAMPTZ DEFAULT NOW(),
  note       TEXT                 -- e.g. "restored from version 12"
);
```

**Bootstrap strategy:** On first `GET /api/files/:filename`, if the file is not yet in `file_contents`, the server fetches it from Vercel's static URL (`/` + filename), stores it as the initial version, and returns it. This means no manual migration is needed.

## API Endpoints

### `GET /api/files/:filename` — public
Returns current content from `file_contents`. If not found, bootstraps from static file (see above). Response: `{ content: "..." }`.

### `PUT /api/files/:filename` — auth required
Body: `{ content: "..." }`.  
1. Reads current content from `file_contents`.  
2. Inserts current content into `file_versions` as the previous version.  
3. Upserts new content into `file_contents`.  
Response: `{ ok: true }`.

### `GET /api/admin/files/:filename/versions` — admin only
Returns list of versions: `[{ id, saved_by, saved_at, preview }]` where `preview` is the first 120 characters of content.

### `POST /api/admin/files/:filename/restore/:versionId` — admin only
1. Reads version content from `file_versions`.  
2. Saves current content to `file_versions` with note `"restored from version {id}"`.  
3. Updates `file_contents` with the restored content.  
Response: `{ ok: true }`.

## Frontend

### FileSidebar
- Add a pencil icon button to each file item (visible to all logged-in users).
- On click: emit `edit-file` event with `{ name, filename }` up to App.vue.
- The sidebar still fetches the file list from `manifest.json`.
- **File content for quiz** must also go through `GET /api/files/:filename` (not the static URL) so quiz users see the latest edited version. The `filename` is derived from the manifest `file` field by stripping the leading `/`.

### App.vue
- Handle `edit-file` emit from FileSidebar.
- Fetch content from `GET /api/files/:filename`.
- Switch `mode = 'editor'` and pass `{ name, filename, content }` as props to EditorScreen.

### EditorScreen
- Accept optional props: `filename` (string) and `initialContent` (string).
- When props are set, pre-load the editor with the content and show the filename.
- Add **"Save to server"** button next to existing "Export" button.
- Save button calls `PUT /api/files/:filename` with current `rawText`.
- Button shows states: idle → "Saving..." → "Saved ✓" (3s) or error message.
- The existing "Load file" and "Export" buttons remain unchanged.

### AdminScreen
- Add a **"Files"** tab alongside the existing users table.
- Files tab shows list of filenames from `manifest.json`.
- Clicking a filename loads its version history via `GET /api/admin/files/:filename/versions`.
- Each version row shows: version number, saved_by, saved_at, content preview.
- "Restore" button on each row calls `POST /api/admin/files/:filename/restore/:versionId` with a confirmation prompt.

## Data Flow: Edit & Save

```
User clicks ✏ in sidebar
  → App fetches GET /api/files/foo.txt
  → App passes content to EditorScreen
  → User edits text
  → User clicks "Save to server"
  → PUT /api/files/foo.txt  { content }
    → server saves old version to file_versions
    → server updates file_contents
  → EditorScreen shows "Saved ✓"
```

## Data Flow: Restore (Admin)

```
Admin opens Files tab → selects file → sees version list
  → clicks "Restore" on version N
  → POST /api/admin/files/foo.txt/restore/N
    → server saves current as new version (note: "restored from version N")
    → server sets file_contents to version N content
  → UI reloads version list
```

## Error Handling

- `PUT /api/files/:filename` — if filename not in `manifest.json`, return 404.
- Bootstrap fetch failure (static file missing) — return 404 to client.
- Restore of non-existent version — return 404.
- All write endpoints wrapped in try/catch, return 500 on DB error.

## What Is Not Changing

- `manifest.json` structure and file list remain unchanged.
- The quiz flow (load → play → results) is unchanged.
- Existing Editor "Load file" and "Export" functionality unchanged.
- No new roles — admin check reuses existing `adminOnly` middleware.
