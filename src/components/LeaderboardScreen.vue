<template>
  <div>
    <div class="lb-page-header">
      <div class="lb-title-row">
        <span class="lb-title-icon" v-html="iconTrophy" />
        <h1>Leaderboard</h1>
      </div>
      <button class="btn btn-secondary btn-back" @click="onBack">
        <span v-html="iconArrowLeft" />
        Back
      </button>
    </div>

    <!-- Step 1: Test selection -->
    <template v-if="!selectedTest">
      <p class="step-hint">Select a test to view the leaderboard</p>
      <div v-if="loadingTests" class="card empty">Loading...</div>
      <div v-else-if="!tests.length" class="card empty">
        No completed tests yet. Finish a quiz with a perfect score to appear here.
      </div>
      <div v-else class="tests-list">
        <div
          v-for="test in tests"
          :key="test"
          class="test-card"
          @click="selectTest(test)"
        >
          <span class="test-name">{{ test }}</span>
          <span class="test-chevron" v-html="iconChevronRight" />
        </div>
      </div>
    </template>

    <!-- Step 2: Leaderboard table -->
    <template v-else>
      <div class="test-breadcrumb">
        <button class="breadcrumb-back" @click="selectedTest = null">
          <span v-html="iconArrowLeft" />
          All tests
        </button>
        <span class="breadcrumb-sep">/</span>
        <span class="breadcrumb-current">{{ selectedTest }}</span>
      </div>

      <div class="card lb-card">
        <div class="lb-card-header">
          <p class="section-title">Perfect scores — fastest times</p>
          <span class="lb-badge-100">100% only</span>
        </div>

        <div v-if="loadingBoard" class="empty">Loading...</div>
        <div v-else-if="!leaderboard.length" class="empty">
          Nobody has scored 100% on this test yet. Be the first!
        </div>
        <table v-else class="lb-table">
          <thead>
            <tr>
              <th class="col-rank">Rank</th>
              <th class="col-user">User</th>
              <th class="col-time">
                <span class="th-inner">
                  <span v-html="iconClock" />
                  Time
                </span>
              </th>
              <th class="col-date">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(entry, i) in leaderboard"
              :key="i"
              :class="{ 'row-me': entry.username === currentUser, 'row-top3': i < 3 }"
            >
              <td class="col-rank">
                <span class="rank-badge" :class="`rank-${Math.min(i + 1, 4)}`">
                  {{ i + 1 }}
                </span>
              </td>
              <td class="col-user">
                <span class="user-name">{{ entry.username }}</span>
                <span v-if="entry.username === currentUser" class="you-tag">you</span>
              </td>
              <td class="col-time">
                <span class="time-val" :class="{ 'time-top': i === 0 }">
                  {{ formatTime(+entry.time_seconds) }}
                </span>
                <span v-if="i === 0" class="crown-icon">👑</span>
              </td>
              <td class="col-date">{{ fmtDate(entry.completed_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchAvailableTests, fetchLeaderboard } from '../utils/statsApi.js'
import { formatTime } from '../composables/useQuiz.js'
import { getUser } from '../utils/auth.js'
import { iconTrophy, iconChevronRight, iconArrowLeft, iconClock } from '../utils/icons.js'

const emit = defineEmits(['back'])
const currentUser = getUser()?.username || ''

const tests = ref([])
const loadingTests = ref(false)
const selectedTest = ref(null)
const leaderboard = ref([])
const loadingBoard = ref(false)

onMounted(async () => {
  loadingTests.value = true
  tests.value = await fetchAvailableTests()
  loadingTests.value = false
})

async function selectTest(name) {
  selectedTest.value = name
  loadingBoard.value = true
  leaderboard.value = await fetchLeaderboard(name)
  loadingBoard.value = false
}

function onBack() {
  if (selectedTest.value) selectedTest.value = null
  else emit('back')
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<style scoped>
.lb-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.lb-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.lb-title-row h1 { margin: 0; }
.lb-title-icon {
  display: flex;
  align-items: center;
  color: var(--yellow);
  filter: drop-shadow(0 1px 4px color-mix(in srgb, var(--yellow) 40%, transparent));
}
.btn-back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: auto;
  flex-shrink: 0;
  padding: 6px 14px;
  font-size: .875rem;
}

/* Breadcrumb */
.test-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: .8125rem;
}
.breadcrumb-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--accent);
  font-size: .8125rem;
  font-weight: 600;
  padding: 0;
}
.breadcrumb-back:hover { text-decoration: underline; }
.breadcrumb-sep { color: var(--text-3); }
.breadcrumb-current { color: var(--text-2); font-weight: 600; }

/* Step hint */
.step-hint {
  font-size: .875rem;
  color: var(--text-2);
  margin-bottom: 12px;
}

/* Test cards */
.tests-list { display: flex; flex-direction: column; gap: 8px; }
.test-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 18px;
  cursor: pointer;
  transition: border-color .15s, background .15s;
}
.test-card:hover { border-color: var(--accent); background: var(--accent-bg); }
.test-name { font-size: .9375rem; font-weight: 600; color: var(--text); }
.test-chevron { display: flex; color: var(--text-3); }
.test-card:hover .test-chevron { color: var(--accent); }

/* Leaderboard card */
.lb-card { padding: 16px 20px; }
.lb-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.section-title {
  font-size: .75rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: .05em;
  margin: 0;
}
.lb-badge-100 {
  font-size: .7rem;
  font-weight: 700;
  padding: 3px 9px;
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid var(--green-border);
  border-radius: 99px;
  letter-spacing: .04em;
  text-transform: uppercase;
}

/* Table */
.lb-table {
  width: 100%;
  border-collapse: collapse;
}
.lb-table th {
  font-size: .7rem;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: .05em;
  padding: 0 10px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.th-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lb-table td {
  padding: 11px 10px;
  border-bottom: 1px solid var(--border);
  font-size: .875rem;
  color: var(--text);
}
.lb-table tbody tr:last-child td { border-bottom: none; }
.lb-table tbody tr { transition: background .12s; }
.lb-table tbody tr:hover td { background: var(--surface-2); }
.row-me td { background: var(--accent-bg) !important; }

/* Rank badge */
.rank-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  font-size: .75rem;
  font-weight: 800;
}
.rank-1 { background: #fef3c7; color: #b45309; border: 1px solid #fcd34d; }
.rank-2 { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }
.rank-3 { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; filter: saturate(.6); }
.rank-4 { background: var(--surface-3); color: var(--text-3); border: 1px solid var(--border); }

[data-theme="dark"] .rank-1 { background: #3d2e08; color: #fbbf24; border-color: #92400e; }
[data-theme="dark"] .rank-2 { background: #1e2535; color: #94a3b8; border-color: #334155; }
[data-theme="dark"] .rank-3 { background: #2d1f08; color: #d97706; border-color: #78350f; }

.col-rank { width: 52px; }
.col-time { width: 100px; }
.col-date { width: 120px; color: var(--text-3); font-size: .8rem; }

.user-name { font-weight: 600; }
.you-tag {
  display: inline-block;
  margin-left: 6px;
  font-size: .65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  background: var(--accent-bg);
  color: var(--accent);
  border: 1px solid var(--accent-border);
  padding: 1px 6px;
  border-radius: 4px;
  vertical-align: middle;
}

.time-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.time-val.time-top { color: var(--green); }
.crown-icon { margin-left: 6px; font-size: .875rem; }

.empty {
  text-align: center;
  color: var(--text-2);
  padding: 32px;
  font-size: .9375rem;
  line-height: 1.6;
}
</style>
