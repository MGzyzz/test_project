<template>
  <div>
    <h1>Results</h1>
    <div class="card results-card">
      <div class="score-circle">
        <span class="score-pct">{{ pct }}%</span>
        <span class="score-label">score</span>
      </div>
      <p class="score-count">{{ score }} / {{ quiz.length }} correct</p>
      <p class="score-emoji">{{ message }}</p>
      <div class="actions">
        <button class="btn btn-primary" @click="emit('repeat')">Repeat same range</button>
        <button class="btn btn-secondary" @click="emit('back')">Back to settings</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQuiz } from '../composables/useQuiz.js'

const emit = defineEmits(['repeat', 'back'])
const { score, quiz } = useQuiz()

const pct = computed(() => Math.round((score.value / quiz.value.length) * 100))
const message = computed(() => {
  const p = pct.value
  if (p === 100) return '100% — Flawless!'
  if (p >= 90)  return 'Excellent work!'
  if (p >= 75)  return 'Good job!'
  if (p >= 50)  return 'Keep practicing.'
  return 'More study needed.'
})
</script>

<style scoped>
.results-card {
  text-align: center;
  padding: 28px 20px;
}
.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--accent-bg);
  border: 4px solid var(--accent);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}
.score-pct { font-size: 2rem; font-weight: 800; color: var(--accent); line-height: 1; }
.score-label { font-size: .75rem; font-weight: 600; color: var(--accent); margin-top: 2px; }
.score-count { font-size: 1rem; color: var(--text-2); margin-bottom: 8px; }
.score-emoji { font-size: 1.375rem; color: var(--text); margin-bottom: 20px; }
.actions { display: flex; flex-direction: column; gap: 10px; }
</style>
