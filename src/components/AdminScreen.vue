<template>
  <div>
    <h1>Admin Panel</h1>

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
                @click="toggleBlock(u)"
              >{{ u.is_blocked ? 'Unblock' : 'Block' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getToken } from '../utils/auth.js'

const BASE  = import.meta.env.VITE_API_URL || ''
const users = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch(`${BASE}/api/admin/users`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
    users.value = await res.json()
  } finally {
    loading.value = false
  }
})

async function toggleBlock(u) {
  const action = u.is_blocked ? 'unblock' : 'block'
  await fetch(`${BASE}/api/admin/users/${u.username}/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
  })
  u.is_blocked = !u.is_blocked
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
.stat-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--accent);
}
.stat-label {
  font-size: .7rem;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: .05em;
}

.table-card { padding: 16px 20px; overflow-x: auto; }
.section-title {
  font-size: .75rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: 14px;
}
.empty {
  text-align: center;
  color: var(--text-2);
  padding: 24px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: .875rem;
}
th {
  text-align: left;
  font-size: .7rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: .05em;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
td {
  padding: 10px 10px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--surface); }

.td-user { font-weight: 600; }
.td-date { color: var(--text-2); font-size: .8rem; white-space: nowrap; }
.td-never { color: var(--text-3); }
.td-num { text-align: center; font-weight: 600; }
.correct { color: var(--green); }
.wrong   { color: var(--red); }

.row-blocked td { opacity: .5; }
.blocked-badge {
  display: inline-block;
  background: var(--red-bg);
  color: var(--red);
  font-size: .65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 6px;
  vertical-align: middle;
  text-transform: uppercase;
}
.td-action { text-align: center; }
.action-btn {
  font-size: .75rem;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid;
  transition: opacity .15s;
}
.action-btn:hover { opacity: .8; }
.btn-block   { background: var(--red-bg);   color: var(--red);   border-color: var(--red-border); }
.btn-unblock { background: var(--green-bg); color: var(--green); border-color: var(--green-border); }
</style>
