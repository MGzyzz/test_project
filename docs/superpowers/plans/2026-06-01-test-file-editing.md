# Test File Editing with Version History — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any logged-in user to edit quiz `.txt` files in the browser and save changes to the server, with full version history visible and restorable by admin.

**Architecture:** All file content is stored in PostgreSQL (`file_contents` + `file_versions` tables). On first access the server bootstraps from the repo's `public/` directory. The existing `EditorScreen` is extended with props for pre-loading a file and a "Save to server" button. The `FileSidebar` gains an edit button and switches to using the API instead of static URLs.

**Tech Stack:** Vue 3 Composition API, Express.js, PostgreSQL (`pg`), Vite, deployed on Vercel + Render + Supabase.

---

## File Map

| File | Change |
|------|--------|
| `server/index.js` | Add `fs` imports, 2 DB tables, 4 new endpoints |
| `src/utils/statsApi.js` | Add 4 file API helper functions |
| `src/utils/icons.js` | Add `iconPencil` SVG |
| `src/components/FileSidebar.vue` | Edit button, change fetch to `/api/files/:fn` |
| `src/App.vue` | Handle `edit-file` emit, pass props to EditorScreen |
| `src/components/EditorScreen.vue` | Accept `filename`+`initialContent` props, save button |
| `src/components/AdminScreen.vue` | Add Files tab with version history + restore |

---

## Task 1: Server — DB tables and filesystem imports

**Files:**
- Modify: `server/index.js` (top of file, after existing imports; after existing `pool.query` migrations)

- [ ] **Step 1: Add filesystem imports** at the top of `server/index.js`, after the existing imports:

```js
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', 'public')
```

- [ ] **Step 2: Create the two new tables** by adding this block after the existing `await pool.query(CREATE TABLE IF NOT EXISTS test_results ...)` block:

```js
await pool.query(`
  CREATE TABLE IF NOT EXISTS file_contents (
    filename   TEXT PRIMARY KEY,
    content    TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )
`)

await pool.query(`
  CREATE TABLE IF NOT EXISTS file_versions (
    id        SERIAL PRIMARY KEY,
    filename  TEXT NOT NULL,
    content   TEXT NOT NULL,
    saved_by  TEXT NOT NULL,
    saved_at  TIMESTAMPTZ DEFAULT NOW(),
    note      TEXT
  )
`)
```

- [ ] **Step 3: Restart the server and check logs** — no errors means the tables were created.

```bash
# In server/ directory
node index.js
# Expected: "Server running on port 3000" with no SQL errors
```

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: add file_contents and file_versions DB tables"
```

---

## Task 2: Server — GET /api/files/:filename

**Files:**
- Modify: `server/index.js` (add after the admin routes block)

- [ ] **Step 1: Add the GET endpoint** after the existing admin routes:

```js
// ── File content routes ───────────────────────────────────────────────────────
app.get('/api/files/:filename', async (req, res) => {
  const { filename } = req.params
  if (!/^[\w\-.]+\.txt$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  try {
    const { rows } = await pool.query(
      'SELECT content FROM file_contents WHERE filename = $1',
      [filename]
    )
    if (rows.length) return res.json({ content: rows[0].content })

    // Bootstrap: read from repo's public/ directory
    const content = await readFile(join(PUBLIC_DIR, filename), 'utf-8')
    await pool.query(
      'INSERT INTO file_contents (filename, content) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [filename, content]
    )
    res.json({ content })
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' })
    throw e
  }
})
```

- [ ] **Step 2: Verify manually**

```bash
curl http://localhost:3000/api/files/invasive_diseases_200.txt
# Expected: { "content": "Какие категории..." } (first few hundred chars)
```

- [ ] **Step 3: Verify DB was seeded** — run again, should return same result from DB this time (no filesystem read).

- [ ] **Step 4: Commit**

```bash
git add server/index.js
git commit -m "feat: GET /api/files/:filename with DB bootstrap from public/"
```

---

## Task 3: Server — PUT + admin version endpoints

**Files:**
- Modify: `server/index.js` (add after the GET endpoint from Task 2)

- [ ] **Step 1: Add PUT /api/files/:filename** (auth required, any logged-in user):

```js
app.put('/api/files/:filename', auth, async (req, res) => {
  const { filename } = req.params
  const { content } = req.body
  if (!/^[\w\-.]+\.txt$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ error: 'content required' })
  }

  // Log the new version to history
  await pool.query(
    'INSERT INTO file_versions (filename, content, saved_by) VALUES ($1, $2, $3)',
    [filename, content, req.user.username]
  )

  // Upsert current content
  await pool.query(
    `INSERT INTO file_contents (filename, content, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (filename) DO UPDATE SET content = $2, updated_at = NOW()`,
    [filename, content]
  )

  res.json({ ok: true })
})
```

- [ ] **Step 2: Add GET /api/admin/files/:filename/versions** (admin only):

```js
app.get('/api/admin/files/:filename/versions', auth, adminOnly, async (req, res) => {
  const { filename } = req.params
  if (!/^[\w\-.]+\.txt$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  const { rows } = await pool.query(
    `SELECT id, saved_by, saved_at, note, LEFT(content, 120) AS preview
     FROM file_versions
     WHERE filename = $1
     ORDER BY saved_at DESC`,
    [filename]
  )
  res.json(rows)
})
```

- [ ] **Step 3: Add POST /api/admin/files/:filename/restore/:versionId** (admin only):

```js
app.post('/api/admin/files/:filename/restore/:versionId', auth, adminOnly, async (req, res) => {
  const { filename, versionId } = req.params
  if (!/^[\w\-.]+\.txt$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' })
  }

  const { rows } = await pool.query(
    'SELECT content FROM file_versions WHERE id = $1 AND filename = $2',
    [parseInt(versionId), filename]
  )
  if (!rows.length) return res.status(404).json({ error: 'Version not found' })

  const content = rows[0].content

  await pool.query(
    'INSERT INTO file_versions (filename, content, saved_by, note) VALUES ($1, $2, $3, $4)',
    [filename, content, req.user.username, `restored from version ${versionId}`]
  )
  await pool.query(
    `INSERT INTO file_contents (filename, content, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (filename) DO UPDATE SET content = $2, updated_at = NOW()`,
    [filename, content]
  )

  res.json({ ok: true })
})
```

- [ ] **Step 4: Verify PUT manually** (replace TOKEN with a real JWT from login):

```bash
curl -X PUT http://localhost:3000/api/files/invasive_diseases_200.txt \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"content":"test content"}'
# Expected: { "ok": true }

curl http://localhost:3000/api/files/invasive_diseases_200.txt
# Expected: { "content": "test content" }
```

- [ ] **Step 5: Commit**

```bash
git add server/index.js
git commit -m "feat: PUT save + admin version history and restore endpoints"
```

---

## Task 4: Frontend utilities — file API helpers + pencil icon

**Files:**
- Modify: `src/utils/statsApi.js`
- Modify: `src/utils/icons.js`

- [ ] **Step 1: Add file API helpers** to the bottom of `src/utils/statsApi.js`:

```js
export async function fetchFileContent(filename) {
  try {
    const res = await fetch(`${BASE}/api/files/${encodeURIComponent(filename)}`)
    if (!res.ok) return null
    const { content } = await res.json()
    return content
  } catch {
    return null
  }
}

export async function saveFileContent(filename, content) {
  try {
    const res = await fetch(`${BASE}/api/files/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ content }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchFileVersions(filename) {
  try {
    const res = await fetch(
      `${BASE}/api/admin/files/${encodeURIComponent(filename)}/versions`,
      { headers: authHeaders() }
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function restoreFileVersion(filename, versionId) {
  try {
    const res = await fetch(
      `${BASE}/api/admin/files/${encodeURIComponent(filename)}/restore/${versionId}`,
      { method: 'POST', headers: authHeaders() }
    )
    return res.ok
  } catch {
    return false
  }
}
```

- [ ] **Step 2: Add `iconPencil`** to `src/utils/icons.js`:

```js
export const iconPencil = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/statsApi.js src/utils/icons.js
git commit -m "feat: file API helpers and pencil icon"
```

---

## Task 5: FileSidebar — edit button + fetch via API

**Files:**
- Modify: `src/components/FileSidebar.vue`

- [ ] **Step 1: Replace the entire `<script setup>` block** in `FileSidebar.vue`:

```js
import { ref, onMounted } from 'vue'
import { useQuiz } from '../composables/useQuiz.js'
import { iconFile, iconPencil } from '../utils/icons.js'
import { fetchFileContent } from '../utils/statsApi.js'

const emit = defineEmits(['selected', 'edit-file'])
const { loadText, allQuestions } = useQuiz()

const files = ref([])
const active = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch('/manifest.json')
    if (res.ok) files.value = await res.json()
  } catch {}
  loading.value = false
})

async function select(f) {
  if (active.value === f.file) return
  const filename = f.file.replace(/^\//, '')
  const content = await fetchFileContent(filename)
  if (content === null) return
  loadText(content)
  active.value = f.file
  emit('selected', { name: f.name, text: content, total: allQuestions.value.length })
}

function editFile(f, event) {
  event.stopPropagation()
  emit('edit-file', { name: f.name, filename: f.file.replace(/^\//, '') })
}
```

- [ ] **Step 2: Update the template** — replace the `<li>` block inside `<ul>`:

```html
<li
  v-for="f in files"
  :key="f.file"
  class="file-item"
  :class="{ active: active === f.file }"
  @click="select(f)"
>
  <span class="file-icon" v-html="iconFile" />
  <span class="file-label">{{ f.name }}</span>
  <button class="edit-btn" :title="'Edit ' + f.name" @click="editFile(f, $event)" v-html="iconPencil" />
</li>
```

- [ ] **Step 3: Add `.edit-btn` styles** inside the `<style scoped>` block, after `.file-item.active .file-icon`:

```css
.edit-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 3px 5px;
  margin-left: auto;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-3);
  opacity: 0;
  transition: opacity .15s, background .15s, color .15s;
}
.file-item:hover .edit-btn { opacity: 1; }
.edit-btn:hover { background: var(--surface-2); color: var(--accent); }
```

- [ ] **Step 4: Run dev server and verify in browser**

```bash
npm run dev
```

Open the Quiz screen. The sidebar should show files. Hover over a file — a pencil icon should appear. Clicking a file should still load it into the quiz (now via API). Clicking the pencil should not start the quiz.

- [ ] **Step 5: Commit**

```bash
git add src/components/FileSidebar.vue
git commit -m "feat: FileSidebar edit button and API-based file fetch"
```

---

## Task 6: App.vue — wire up edit-file flow

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Add `editFileData` ref** and import `fetchFileContent`. In `<script setup>`, add after the existing imports:

```js
import { fetchFileContent } from './utils/statsApi.js'
```

And add this ref after the existing `const setupRef = ref(null)` line:

```js
const editFileData = ref(null)
```

- [ ] **Step 2: Add `onEditFile` handler** after the existing `onSidebarSelected` function:

```js
async function onEditFile({ name, filename }) {
  const content = await fetchFileContent(filename)
  if (content === null) return
  editFileData.value = { name, filename, content }
  mode.value = 'editor'
}
```

- [ ] **Step 3: Clear editFileData when leaving editor mode** — update the `mode` watch or clear on nav. Add this watcher after the existing watchers:

```js
watch(mode, (newMode) => {
  if (newMode !== 'editor') editFileData.value = null
})
```

- [ ] **Step 4: Update FileSidebar in template** to listen for the new emit. Find `<FileSidebar @selected="onSidebarSelected" />` and replace with:

```html
<FileSidebar @selected="onSidebarSelected" @edit-file="onEditFile" />
```

- [ ] **Step 5: Pass props to EditorScreen** — find `<EditorScreen v-else-if="mode === 'editor'" @go-quiz="onGoQuiz" />` and replace with:

```html
<EditorScreen
  v-else-if="mode === 'editor'"
  :filename="editFileData?.filename || ''"
  :initial-content="editFileData?.content || ''"
  @go-quiz="onGoQuiz"
/>
```

- [ ] **Step 6: Verify in browser** — click a pencil icon in the sidebar. The app should switch to the Editor tab with the file pre-loaded.

- [ ] **Step 7: Commit**

```bash
git add src/App.vue
git commit -m "feat: App.vue handles edit-file and passes props to EditorScreen"
```

---

## Task 7: EditorScreen — accept props + Save to server button

**Files:**
- Modify: `src/components/EditorScreen.vue`

- [ ] **Step 1: Add props, watcher, and save logic**. In `<script setup>`, add these imports at the top:

```js
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { saveFileContent } from '../utils/statsApi.js'
```

Then add after `const emit = defineEmits(['go-quiz'])`:

```js
const props = defineProps({
  filename: { type: String, default: '' },
  initialContent: { type: String, default: '' },
})
```

Add after the existing state declarations (`const rawText`, `const fileName`, etc.):

```js
const saveStatus = ref('') // '' | 'saving' | 'saved' | 'error'
let saveTimer = null

watch(() => props.initialContent, (val) => {
  if (val) {
    rawText.value = val
    fileName.value = props.filename || 'from sidebar'
    selectedBlockIndex.value = -1
  }
}, { immediate: true })

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
})
```

Add the `saveToServer` function after the existing `useInQuiz` function:

```js
async function saveToServer() {
  if (!props.filename || saveStatus.value === 'saving') return
  saveStatus.value = 'saving'
  clearTimeout(saveTimer)
  const ok = await saveFileContent(props.filename, rawText.value)
  saveStatus.value = ok ? 'saved' : 'error'
  saveTimer = setTimeout(() => { saveStatus.value = '' }, 3000)
}
```

- [ ] **Step 2: Add Save button to template** — find the `<div class="topbar-actions" v-if="blocks.length">` block and add the save button before the existing Export button:

```html
<button
  v-if="props.filename"
  class="btn btn-save"
  :disabled="saveStatus === 'saving'"
  @click="saveToServer"
>
  <span v-if="saveStatus === 'saving'">Saving…</span>
  <span v-else-if="saveStatus === 'saved'">Saved ✓</span>
  <span v-else-if="saveStatus === 'error'">Error ✗</span>
  <span v-else>Save to server</span>
</button>
```

- [ ] **Step 3: Add `.btn-save` styles** inside `<style scoped>`, after `.btn-warn`:

```css
.btn-save { background: var(--accent); color: #fff; border: none; }
.btn-save:hover:not(:disabled) { opacity: .85; }
.btn-save:disabled { opacity: .6; cursor: not-allowed; }
```

- [ ] **Step 4: Verify in browser**

1. Click a pencil icon in the sidebar — editor opens with file pre-loaded.
2. Make a small edit (e.g., fix a typo).
3. Click "Save to server" — button shows "Saving…" then "Saved ✓".
4. Refresh the page, re-open the same file — your edit should still be there.

- [ ] **Step 5: Commit**

```bash
git add src/components/EditorScreen.vue
git commit -m "feat: EditorScreen accepts file props and saves to server"
```

---

## Task 8: AdminScreen — Files tab with version history

**Files:**
- Modify: `src/components/AdminScreen.vue`

- [ ] **Step 1: Add new imports and state** at the top of `<script setup>` in `AdminScreen.vue`. After the existing imports:

```js
import { fetchFileVersions, restoreFileVersion } from '../utils/statsApi.js'
```

After the existing `const loading = ref(true)` line:

```js
const activeTab = ref('users')       // 'users' | 'files'
const files = ref([])                // list from manifest.json
const selectedFile = ref(null)       // filename string
const versions = ref([])
const versionsLoading = ref(false)
const restoring = ref(false)
```

- [ ] **Step 2: Load manifest** in `onMounted`, add after the existing users fetch:

```js
try {
  const res = await fetch('/manifest.json')
  if (res.ok) files.value = await res.json()
} catch {}
```

- [ ] **Step 3: Add helper functions** after the existing `unblock` function:

```js
async function loadVersions(filename) {
  selectedFile.value = filename
  versionsLoading.value = true
  versions.value = []
  versions.value = await fetchFileVersions(filename)
  versionsLoading.value = false
}

async function restore(versionId) {
  if (!confirm(`Restore version ${versionId}? This will replace the current content.`)) return
  restoring.value = true
  const ok = await restoreFileVersion(selectedFile.value, versionId)
  if (ok) await loadVersions(selectedFile.value)
  restoring.value = false
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
```

- [ ] **Step 4: Add the Files tab UI to the template**. Replace the entire `<template>` content with:

```html
<template>
  <div>
    <h1>Admin Panel</h1>

    <!-- Tab switcher -->
    <div class="admin-tabs">
      <button class="admin-tab" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">Users</button>
      <button class="admin-tab" :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">Files</button>
    </div>

    <!-- ── Users tab ─────────────────────────────── -->
    <template v-if="activeTab === 'users'">
      <div class="card summary-row">
        <div class="stat">
          <span class="stat-value">{{ users.length }}</span>
          <span class="stat-label">Total users</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ activeToday }}</span>
          <span class="stat-label">Active today</span>
        </div>
        <div class="stat">
          <span class="stat-value">{{ activeWeek }}</span>
          <span class="stat-label">Active this week</span>
        </div>
      </div>

      <div class="card table-card">
        <p class="section-title">Users</p>
        <div v-if="loading" class="empty">Loading...</div>
        <div v-else-if="!users.length" class="empty">No users yet.</div>
        <table v-else>
          <thead>
            <tr>
              <th>Username</th>
              <th>Registered</th>
              <th>Last login</th>
              <th>Questions</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.username" :class="{ 'row-blocked': u.is_blocked }">
              <td class="td-user">
                {{ u.username }}
                <span v-if="u.is_blocked" class="blocked-badge">blocked</span>
                <span v-if="u.is_blocked && u.block_reason" class="block-reason">{{ u.block_reason }}</span>
              </td>
              <td class="td-date">{{ fmt(u.created_at) }}</td>
              <td class="td-date" :class="{ 'td-never': !u.last_login }">
                {{ u.last_login ? fmt(u.last_login) : 'Never' }}
              </td>
              <td class="td-num">{{ u.questions_attempted }}</td>
              <td class="td-num correct">{{ u.total_correct }}</td>
              <td class="td-num wrong">{{ u.total_wrong }}</td>
              <td class="td-action">
                <button
                  v-if="u.username !== 'admin'"
                  :class="['action-btn', u.is_blocked ? 'btn-unblock' : 'btn-block']"
                  @click="u.is_blocked ? unblock(u) : openBlockModal(u)"
                >{{ u.is_blocked ? 'Unblock' : 'Block' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ── Files tab ──────────────────────────────── -->
    <template v-else>
      <div class="files-layout">
        <!-- File list -->
        <div class="card file-list-card">
          <p class="section-title">Test Files</p>
          <div v-if="!files.length" class="empty">No files in manifest.</div>
          <ul v-else class="file-list">
            <li
              v-for="f in files"
              :key="f.file"
              class="file-list-item"
              :class="{ active: selectedFile === f.file.replace(/^\//, '') }"
              @click="loadVersions(f.file.replace(/^\//, ''))"
            >
              {{ f.name }}
            </li>
          </ul>
        </div>

        <!-- Version history -->
        <div class="card versions-card">
          <p class="section-title">
            {{ selectedFile ? 'Version history — ' + selectedFile : 'Select a file' }}
          </p>
          <div v-if="versionsLoading" class="empty">Loading...</div>
          <div v-else-if="!selectedFile" class="empty">Click a file to see its history.</div>
          <div v-else-if="!versions.length" class="empty">No saved versions yet.</div>
          <table v-else>
            <thead>
              <tr>
                <th>#</th>
                <th>Saved by</th>
                <th>Date</th>
                <th>Preview</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(v, i) in versions" :key="v.id">
                <td class="td-num">{{ versions.length - i }}</td>
                <td class="td-user">{{ v.saved_by }}</td>
                <td class="td-date">{{ fmtDate(v.saved_at) }}</td>
                <td class="td-preview">{{ v.preview }}…</td>
                <td class="td-action">
                  <span v-if="v.note" class="note-badge">{{ v.note }}</span>
                  <button
                    v-else
                    class="action-btn btn-restore"
                    :disabled="restoring"
                    @click="restore(v.id)"
                  >Restore</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>

    <!-- Block modal (unchanged) -->
    <div v-if="modal.open" class="modal-overlay" @click.self="modal.open = false">
      <div class="modal">
        <p class="modal-title">Block {{ modal.user?.username }}</p>
        <textarea
          v-model="modal.reason"
          class="modal-textarea"
          placeholder="Reason (optional)"
          rows="3"
        />
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="modal.open = false">Cancel</button>
          <button class="btn btn-block-confirm" @click="confirmBlock">Block</button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Add new styles** to `<style scoped>` in `AdminScreen.vue`, after the existing styles:

```css
.admin-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 4px;
  border-radius: var(--radius);
}
.admin-tab {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 8px;
  font-size: .9375rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: var(--text-2);
  transition: background .15s, color .15s;
}
.admin-tab.active { background: var(--accent); color: #fff; }

.files-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 720px) {
  .files-layout { grid-template-columns: 1fr; }
}

.file-list-card, .versions-card { padding: 16px 20px; }
.file-list { list-style: none; display: flex; flex-direction: column; gap: 2px; }
.file-list-item {
  padding: 9px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: .875rem;
  color: var(--text-2);
  font-weight: 500;
  transition: background .12s, color .12s;
  border: 1.5px solid transparent;
}
.file-list-item:hover { background: var(--surface-2); color: var(--text); }
.file-list-item.active {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}

.td-preview {
  font-size: .75rem;
  color: var(--text-3);
  max-width: 300px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.note-badge {
  font-size: .7rem; font-style: italic;
  color: var(--text-3);
}
.btn-restore {
  background: var(--accent-bg);
  color: var(--accent);
  border-color: var(--accent-border);
}
.btn-restore:disabled { opacity: .5; cursor: not-allowed; }
```

- [ ] **Step 6: Verify in browser as admin**

1. Log in as `admin`.
2. Go to Admin tab → Files sub-tab.
3. Click a file — should show version list (empty if no saves yet).
4. Go back to Quiz, click a pencil, edit something, save.
5. Go back to Admin → Files → click the same file — the save should appear in history.
6. Click Restore on a version — confirm the current content switches back.

- [ ] **Step 7: Commit**

```bash
git add src/components/AdminScreen.vue
git commit -m "feat: AdminScreen Files tab with version history and restore"
```

---

## Self-Review Checklist

- [x] **DB tables** created in Task 1 ✓
- [x] **GET bootstrap** from filesystem in Task 2 ✓
- [x] **PUT saves** to `file_versions` + `file_contents` in Task 3 ✓
- [x] **Admin version list** endpoint in Task 3 ✓
- [x] **Admin restore** endpoint in Task 3 ✓
- [x] **FileSidebar quiz fetch** switched to API in Task 5 ✓
- [x] **FileSidebar edit button** in Task 5 ✓
- [x] **App.vue** wires `edit-file` → fetch → pass props in Task 6 ✓
- [x] **EditorScreen** pre-loads content from props in Task 7 ✓
- [x] **EditorScreen** save button with states in Task 7 ✓
- [x] **AdminScreen Files tab** with history + restore in Task 8 ✓
- [x] **Type consistency:** `filename` string (no leading `/`) used consistently across all tasks ✓
- [x] **No placeholders or TBDs** ✓
