<template>
  <div>
    <div class="stats-header">
      <h1>Statistics</h1>
      <button class="btn btn-secondary btn-back" @click="emit('back')">← Back</button>
    </div>

    <div v-if="!allQuestions.length" class="card empty">
      Load a test first to see statistics.
    </div>

    <template v-else>
      <!-- Summary -->
      <div class="card summary-card">
        <div class="summary-item">
          <span class="summary-value">{{ totalQuestions }}</span>
          <span class="summary-label">Questions in test</span>
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

      <!-- No data yet -->
      <div v-if="!attempted" class="card empty">
        No attempts yet — complete a quiz to see your stats.
      </div>

      <!-- Question list -->
      <div v-else class="card questions-card">
        <p class="section-title">All questions</p>
        <div
          v-for="(q, i) in sortedStats"
          :key="i"
          class="q-row"
        >
          <p class="q-text">{{ q.question }}</p>
          <div class="bar-wrap">
            <div
              class="bar-fill bar-correct"
              :style="{ width: correctPct(q) + '%' }"
            />
            <div
              class="bar-fill bar-wrong"
              :style="{ width: wrongPct(q) + '%' }"
            />
          </div>
          <div class="q-counts">
            <span class="count-correct">{{ q.correct_count ?? 0 }}✓</span>
            <span class="count-wrong">{{ q.wrong_count ?? 0 }}✗</span>
            <span class="count-total">{{ total(q) }} total</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useQuiz } from '../composables/useQuiz.js'

const emit = defineEmits(['back'])
const { allQuestions, allStats, loadStats } = useQuiz()

onMounted(loadStats)

const totalQuestions = computed(() => allQuestions.value.length)

const questionSet = computed(() => new Set(allQuestions.value.map(q => q.question)))

const filteredStats = computed(() =>
  allStats.value.filter(s => questionSet.value.has(s.question_text))
)

const attempted = computed(() => filteredStats.value.length)

const accuracy = computed(() => {
  const totalCorrect = filteredStats.value.reduce((s, q) => s + (q.correct_count ?? 0), 0)
  const totalAll = filteredStats.value.reduce((s, q) => s + total(q), 0)
  if (!totalAll) return 0
  return Math.round((totalCorrect / totalAll) * 100)
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

function total(q) {
  return (q.correct_count ?? 0) + (q.wrong_count ?? 0)
}
function correctPct(q) {
  const t = total(q)
  return t ? Math.round(((q.correct_count ?? 0) / t) * 100) : 0
}
function wrongPct(q) {
  return 100 - correctPct(q)
}
</script>

<style scoped>
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.stats-header h1 { margin: 0; }
.btn-back { padding: 6px 14px; font-size: .875rem; }

.empty {
  text-align: center;
  color: var(--text-2);
  padding: 32px;
  font-size: .9375rem;
}

.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 20px;
  margin-bottom: 12px;
}
.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.summary-value {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--accent);
}
.summary-value.good  { color: var(--green); }
.summary-value.medium { color: #d97706; }
.summary-value.bad   { color: var(--red); }
.summary-label {
  font-size: .75rem;
  font-weight: 600;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: .04em;
}
.summary-divider {
  width: 1px;
  height: 40px;
  background: var(--border);
}

.questions-card { padding: 16px 20px; }
.section-title {
  font-size: .8rem;
  font-weight: 700;
  color: var(--text-2);
  text-transform: uppercase;
  letter-spacing: .05em;
  margin-bottom: 14px;
}

.q-row {
  padding: 12px 0;
  border-top: 1px solid var(--border);
}
.q-text {
  font-size: .875rem;
  font-weight: 500;
  color: var(--text);
  line-height: 1.45;
  margin-bottom: 8px;
}
.bar-wrap {
  display: flex;
  height: 8px;
  border-radius: 99px;
  overflow: hidden;
  background: var(--surface-3);
  margin-bottom: 6px;
}
.bar-fill {
  height: 100%;
  transition: width .4s ease;
}
.bar-correct { background: var(--green); }
.bar-wrong   { background: var(--red); }

.q-counts {
  display: flex;
  gap: 12px;
  font-size: .75rem;
  font-weight: 600;
}
.count-correct { color: var(--green); }
.count-wrong   { color: var(--red); }
.count-total   { color: var(--text-3); }
</style>
