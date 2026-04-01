<template>
  <div>
    <div class="stats-header">
      <h1>Statistics</h1>
      <button class="btn btn-secondary btn-back" @click="onBack">← Back</button>
    </div>

    <!-- Step 1: Test selection -->
    <template v-if="!selectedTest">
      <p class="step-hint">Select a test to view statistics</p>
      <div v-if="loadingTests" class="card empty">Loading...</div>
      <div v-else-if="!tests.length" class="card empty">
        No test results yet. Complete a quiz to see statistics here.
      </div>
      <div v-else class="tests-list">
        <div
          v-for="test in tests"
          :key="test"
          class="test-card"
          @click="selectTest(test)"
        >
          <span class="test-name">{{ test }}</span>
          <span class="test-arrow">→</span>
        </div>
      </div>
    </template>

    <!-- Step 2: Stats for selected test -->
    <template v-else>
      <p class="selected-test-name">{{ selectedTest }}</p>

      <!-- Leaderboard -->
      <div class="card leaderboard-card">
        <p class="section-title">Leaderboard</p>
        <div v-if="loadingLeaderboard" class="empty">Loading...</div>
        <div v-else-if="!leaderboard.length" class="empty">No results yet for this test.</div>
        <div v-else class="leaderboard">
          <div class="lb-header">
            <span></span>
            <span>User</span>
            <span>Score</span>
            <span>Time</span>
          </div>
          <div
            v-for="(entry, i) in leaderboard"
            :key="i"
            class="lb-row"
            :class="{ 'lb-me': entry.username === currentUser, 'lb-top': i === 0 }"
          >
            <span class="lb-rank">{{ rankIcon(i) }}</span>
            <span class="lb-username">{{ entry.username }}</span>
            <span class="lb-score" :class="scoreClass(entry.pct)">{{ entry.pct }}%</span>
            <span class="lb-time">{{ formatTime(+entry.time_seconds) }}</span>
          </div>
        </div>
      </div>

      <!-- Question stats (only if current loaded test matches) -->
      <template v-if="allQuestions.length && filteredStats.length">
        <!-- Summary -->
        <div class="card summary-card">
          <div class="summary-stats">
            <div class="summary-item">
              <span class="summary-value">{{ totalQuestions }}</span>
              <span class="summary-label">Questions</span>
            </div>
            <div class="summary-divider" />
            <div class="summary-item">
              <span class="summary-value">{{ attempted }}</span>
              <span class="summary-label">Attempted</span>
            </div>
            <div class="summary-divider" />
            <div class="summary-item">
              <span class="summary-value" :class="accuracyClass">{{ accuracy }}%</span>
              <span class="summary-label">Accuracy</span>
            </div>
          </div>
          <div v-if="attempted" class="doughnut-wrap">
            <Doughnut :data="doughnutData" :options="doughnutOptions" />
            <span class="doughnut-label">{{ accuracy }}%</span>
          </div>
        </div>

        <!-- Bar chart -->
        <div v-if="hardest.length" class="card chart-card">
          <p class="section-title">Hardest questions (by mistakes)</p>
          <Bar :data="barData" :options="barOptions" />
        </div>

        <!-- Full question list -->
        <div class="card questions-card">
          <p class="section-title">All questions</p>
          <div v-for="(q, i) in sortedStats" :key="i" class="q-row">
            <p class="q-text">{{ q.question }}</p>
            <div class="bar-wrap">
              <div class="bar-fill bar-correct" :style="{ width: correctPct(q) + '%' }" />
              <div class="bar-fill bar-wrong"   :style="{ width: wrongPct(q) + '%' }" />
            </div>
            <div class="q-counts">
              <span class="count-correct">{{ q.correct_count ?? 0 }}✓</span>
              <span class="count-wrong">{{ q.wrong_count ?? 0 }}✗</span>
              <span class="count-total">{{ total(q) }} attempts</span>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Doughnut, Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js'
import { useQuiz, formatTime } from '../composables/useQuiz.js'
import { fetchAvailableTests, fetchLeaderboard } from '../utils/statsApi.js'
import { getUser } from '../utils/auth.js'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const emit = defineEmits(['back'])
const { allQuestions, allStats, loadStats } = useQuiz()
const currentUser = getUser()?.username || ''

// ── Test selection ────────────────────────────────────────────────────────────
const tests = ref([])
const loadingTests = ref(false)
const selectedTest = ref(null)
const leaderboard = ref([])
const loadingLeaderboard = ref(false)

onMounted(async () => {
  loadStats()
  loadingTests.value = true
  tests.value = await fetchAvailableTests()
  loadingTests.value = false
})

async function selectTest(name) {
  selectedTest.value = name
  loadingLeaderboard.value = true
  leaderboard.value = await fetchLeaderboard(name)
  loadingLeaderboard.value = false
}

function onBack() {
  if (selectedTest.value) {
    selectedTest.value = null
  } else {
    emit('back')
  }
}

function rankIcon(i) {
  if (i === 0) return '🥇'
  if (i === 1) return '🥈'
  if (i === 2) return '🥉'
  return `#${i + 1}`
}

function scoreClass(pct) {
  if (pct >= 75) return 'good'
  if (pct >= 50) return 'medium'
  return 'bad'
}

// ── Question stats ────────────────────────────────────────────────────────────
const totalQuestions = computed(() => allQuestions.value.length)
const questionSet = computed(() => new Set(allQuestions.value.map(q => q.question)))

const filteredStats = computed(() =>
  allStats.value.filter(s => questionSet.value.has(s.question_text))
)

const attempted = computed(() => filteredStats.value.length)

const accuracy = computed(() => {
  const correct = filteredStats.value.reduce((s, q) => s + (q.correct_count ?? 0), 0)
  const all     = filteredStats.value.reduce((s, q) => s + total(q), 0)
  return all ? Math.round((correct / all) * 100) : 0
})

const accuracyClass = computed(() => {
  const a = accuracy.value
  if (a >= 75) return 'good'
  if (a >= 50) return 'medium'
  return 'bad'
})

const sortedStats = computed(() =>
  [...filteredStats.value]
    .map(s => ({ question: s.question_text, correct_count: s.correct_count, wrong_count: s.wrong_count }))
    .sort((a, b) => (b.wrong_count ?? 0) - (a.wrong_count ?? 0))
)

const hardest = computed(() => sortedStats.value.filter(q => (q.wrong_count ?? 0) > 0).slice(0, 8))

function total(q) { return (q.correct_count ?? 0) + (q.wrong_count ?? 0) }
function correctPct(q) { const t = total(q); return t ? Math.round(((q.correct_count ?? 0) / t) * 100) : 0 }
function wrongPct(q) { return 100 - correctPct(q) }
function truncate(str, n = 40) { return str.length > n ? str.slice(0, n) + '…' : str }

const totalCorrect = computed(() => filteredStats.value.reduce((s, q) => s + (q.correct_count ?? 0), 0))
const totalWrong   = computed(() => filteredStats.value.reduce((s, q) => s + (q.wrong_count   ?? 0), 0))

const doughnutData = computed(() => ({
  labels: ['Correct', 'Wrong'],
  datasets: [{
    data: [totalCorrect.value, totalWrong.value],
    backgroundColor: ['#16a34a', '#dc2626'],
    borderWidth: 0,
    hoverOffset: 4,
  }],
}))

const doughnutOptions = {
  responsive: true,
  cutout: '72%',
  plugins: { legend: { display: false }, tooltip: { callbacks: {
    label: ctx => ` ${ctx.label}: ${ctx.raw}`
  }}},
}

const barData = computed(() => ({
  labels: hardest.value.map(q => truncate(q.question)),
  datasets: [
    { label: 'Correct', data: hardest.value.map(q => q.correct_count ?? 0), backgroundColor: '#16a34a', borderRadius: 4 },
    { label: 'Wrong',   data: hardest.value.map(q => q.wrong_count ?? 0),   backgroundColor: '#dc2626', borderRadius: 4 },
  ],
}))

const barOptions = {
  indexAxis: 'y',
  responsive: true,
  plugins: { legend: { position: 'bottom' } },
  scales: {
    x: { stacked: false, grid: { color: 'rgba(0,0,0,0.05)' } },
    y: { stacked: false, ticks: { font: { size: 11 } } },
  },
}
</script>

<style scoped>
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.stats-header h1 { margin: 0; }
.btn-back { width: auto; flex-shrink: 0; padding: 6px 16px; font-size: .875rem; }

.step-hint {
  font-size: .875rem;
  color: var(--text-2);
  margin-bottom: 12px;
}

.empty {
  text-align: center;
  color: var(--text-2);
  padding: 32px;
  font-size: .9375rem;
}

/* Test list */
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
.test-arrow { color: var(--text-3); font-size: 1rem; }

/* Selected test */
.selected-test-name {
  font-size: .8125rem;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 12px;
}

/* Leaderboard */
.leaderboard-card { padding: 16px 20px; margin-bottom: 12px; }

.lb-header {
  display: grid;
  grid-template-columns: 32px 1fr 60px 72px;
  gap: 8px;
  font-size: .7rem;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: .05em;
  padding: 0 0 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.lb-row {
  display: grid;
  grid-template-columns: 32px 1fr 60px 72px;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid var(--border);
  font-size: .875rem;
}
.lb-row.lb-me { background: var(--accent-bg); margin: 0 -20px; padding: 8px 20px; }
.lb-row.lb-top .lb-username { font-weight: 700; }

.lb-rank { font-size: .9rem; text-align: center; }
.lb-username { font-weight: 500; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lb-score { font-weight: 700; text-align: right; }
.lb-score.good   { color: var(--green); }
.lb-score.medium { color: #d97706; }
.lb-score.bad    { color: var(--red); }
.lb-time { color: var(--text-2); font-size: .8125rem; text-align: right; }

/* Summary */
.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  margin-bottom: 12px;
}
.summary-stats { display: flex; align-items: center; gap: 24px; flex: 1; }
.summary-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.summary-value { font-size: 1.75rem; font-weight: 800; color: var(--accent); }
.summary-value.good   { color: var(--green); }
.summary-value.medium { color: #d97706; }
.summary-value.bad    { color: var(--red); }
.summary-label { font-size: .7rem; font-weight: 600; color: var(--text-2); text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
.summary-divider { width: 1px; height: 40px; background: var(--border); flex-shrink: 0; }
.doughnut-wrap { position: relative; width: 90px; height: 90px; flex-shrink: 0; }
.doughnut-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: .85rem; font-weight: 800; color: var(--text); pointer-events: none; }

/* Charts */
.chart-card { padding: 16px 20px; margin-bottom: 12px; }
.section-title { font-size: .75rem; font-weight: 700; color: var(--text-2); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 14px; }

/* Question list */
.questions-card { padding: 16px 20px; }
.q-row { padding: 12px 0; border-top: 1px solid var(--border); }
.q-text { font-size: .875rem; font-weight: 500; color: var(--text); line-height: 1.45; margin-bottom: 8px; }
.bar-wrap { display: flex; height: 6px; border-radius: 99px; overflow: hidden; background: var(--surface-3); margin-bottom: 6px; }
.bar-fill { height: 100%; transition: width .4s ease; }
.bar-correct { background: var(--green); }
.bar-wrong   { background: var(--red); }
.q-counts { display: flex; gap: 12px; font-size: .75rem; font-weight: 600; }
.count-correct { color: var(--green); }
.count-wrong   { color: var(--red); }
.count-total   { color: var(--text-3); }
</style>
