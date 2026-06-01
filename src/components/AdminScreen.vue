<template>
  <div>
    <h1>Admin Panel</h1>

    <div class="admin-tabs">
      <button class="admin-tab" :class="{ active: activeTab === 'users' }" @click="activeTab = 'users'">Users</button>
      <button class="admin-tab" :class="{ active: activeTab === 'files' }" @click="activeTab = 'files'">Files</button>
    </div>

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

    <template v-else>
      <div class="files-layout">
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

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { getToken } from '../utils/auth.js'
import { fetchFileVersions, restoreFileVersion } from '../utils/statsApi.js'

const BASE  = import.meta.env.VITE_API_URL || ''
const users   = ref([])
const loading = ref(true)
const activeTab = ref('users')
const files = ref([])
const selectedFile = ref(null)
const versions = ref([])
const versionsLoading = ref(false)
const restoring = ref(false)
const modal   = reactive({ open: false, user: null, reason: '' })

onMounted(async () => {
  try {
    const res = await fetch(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    users.value = await res.json()
  } finally {
    loading.value = false
  }
  try {
    const res = await fetch('/manifest.json')
    if (res.ok) files.value = await res.json()
  } catch {}
})

function openBlockModal(u) {
  modal.user   = u
  modal.reason = ''
  modal.open   = true
}

async function confirmBlock() {
  const u = modal.user
  await fetch(`${BASE}/api/admin/users/${u.username}/block`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: modal.reason }),
  })
  u.is_blocked    = true
  u.block_reason  = modal.reason
  modal.open      = false
}

async function unblock(u) {
  await fetch(`${BASE}/api/admin/users/${u.username}/unblock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  u.is_blocked   = false
  u.block_reason = null
}

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

function fmt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

const now = new Date()
const activeToday = computed(() =>
  users.value.filter(u => u.last_login && (now - new Date(u.last_login)) < 86400000).length
)
const activeWeek = computed(() =>
  users.value.filter(u => u.last_login && (now - new Date(u.last_login)) < 7 * 86400000).length
)
</script>

<style scoped>
.summary-row {
  display: flex;
  gap: 0;
  padding: 16px 24px;
  margin-bottom: 12px;
}
.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-right: 1px solid var(--border);
}
.stat:last-child { border-right: none; }
.stat-value { font-size: 1.75rem; font-weight: 800; color: var(--accent); }
.stat-label {
  font-size: .7rem; font-weight: 600; color: var(--text-2);
  text-transform: uppercase; letter-spacing: .05em;
}

.table-card { padding: 16px 20px; overflow-x: auto; }
.section-title {
  font-size: .75rem; font-weight: 700; color: var(--text-2);
  text-transform: uppercase; letter-spacing: .05em; margin-bottom: 14px;
}
.empty { text-align: center; color: var(--text-2); padding: 24px; }

table { width: 100%; border-collapse: collapse; font-size: .875rem; }
th {
  text-align: left; font-size: .7rem; font-weight: 700; color: var(--text-2);
  text-transform: uppercase; letter-spacing: .05em;
  padding: 6px 10px; border-bottom: 1px solid var(--border);
}
td { padding: 10px; border-bottom: 1px solid var(--border); color: var(--text); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--surface); }

.td-user { font-weight: 600; }
.td-date { color: var(--text-2); font-size: .8rem; white-space: nowrap; }
.td-never { color: var(--text-3); }
.td-num { text-align: center; font-weight: 600; }
.correct { color: var(--green); }
.wrong   { color: var(--red); }

.row-blocked td { opacity: .55; }
.blocked-badge {
  display: inline-block;
  background: var(--red-bg); color: var(--red);
  font-size: .65rem; font-weight: 700;
  padding: 1px 6px; border-radius: 4px;
  margin-left: 6px; vertical-align: middle; text-transform: uppercase;
}
.block-reason {
  display: block;
  font-size: .75rem; font-weight: 400;
  color: var(--red); opacity: .8;
  margin-top: 2px;
}

.td-action { text-align: center; }
.action-btn {
  font-size: .75rem; font-weight: 700;
  padding: 4px 12px; border-radius: 6px;
  cursor: pointer; border: 1px solid;
  transition: opacity .15s;
}
.action-btn:hover { opacity: .8; }
.btn-block   { background: var(--red-bg);   color: var(--red);   border-color: var(--red-border); }
.btn-unblock { background: var(--green-bg); color: var(--green); border-color: var(--green-border); }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 100;
}
.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  width: 100%; max-width: 360px;
  box-shadow: 0 8px 32px rgba(0,0,0,.15);
}
.modal-title {
  font-size: 1rem; font-weight: 700;
  color: var(--text); margin-bottom: 14px;
}
.modal-textarea {
  width: 100%; box-sizing: border-box;
  background: var(--surface-2);
  border: 1px solid var(--border-2);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  font-size: .9rem; color: var(--text);
  resize: vertical; outline: none;
  transition: border-color .15s;
}
.modal-textarea:focus { border-color: var(--accent); }
.modal-actions {
  display: flex; gap: 10px; margin-top: 14px;
}
.modal-actions .btn { flex: 1; }
.btn-block-confirm {
  flex: 1; padding: 10px;
  background: var(--red); color: #fff;
  border: none; border-radius: var(--radius-sm);
  font-size: .9375rem; font-weight: 700;
  cursor: pointer; transition: opacity .15s;
}
.btn-block-confirm:hover { opacity: .85; }

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
</style>
