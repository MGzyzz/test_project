<template>
  <div>
    <h1>Results</h1>
    <div class="card results-card">
      <div v-if="roundNumber > 1" class="round-badge">Round {{ roundNumber }}</div>
      <div class="score-circle">
        <span class="score-pct">{{ pct }}%</span>
        <span class="score-label">score</span>
      </div>
      <p class="score-count">{{ score }} / {{ quiz.length }} correct</p>
      <p v-if="quizElapsed" class="score-time">{{ formatTime(quizElapsed) }}</p>
      <p class="score-emoji">{{ message }}</p>
      <div v-if="hardQuestions.length > 0" class="hard-list">
        <p class="hard-list-title">Questions to focus on:</p>
        <div v-for="(q, i) in hardQuestions" :key="i" class="hard-item">
          <span class="hard-count">{{ q.wrong_count }}✗</span>
          <span class="hard-text">{{ q.text }}</span>
        </div>
      </div>

      <div class="actions">
        <button v-if="wrongQuestions.length > 0" class="btn btn-primary" @click="emit('retry-wrong')">
          Retry wrong answers ({{ wrongQuestions.length }})
        </button>
        <button class="btn btn-secondary" @click="emit('repeat')">Repeat same range</button>
        <button class="btn btn-secondary" @click="emit('back')">Back to settings</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useQuiz, formatTime } from '../composables/useQuiz.js'

const emit = defineEmits(['repeat', 'retry-wrong', 'back'])
const { score, quiz, wrongQuestions, roundNumber, statsMap, quizElapsed } = useQuiz()

const hardQuestions = computed(() => {
  return quiz.value
    .map(q => ({ text: q.question, ...statsMap.value[q.question] }))
    .filter(q => q.wrong_count >= 3)
    .sort((a, b) => b.wrong_count - a.wrong_count)
    .slice(0, 5)
})

const pct = computed(() => Math.round((score.value / quiz.value.length) * 100))
const message = computed(() => {
  if (wrongQuestions.value.length === 0 && roundNumber.value > 1) return 'All questions mastered!'
  const p = pct.value
  if (p === 100) return 'Flawless!'
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
.round-badge {
  display: inline-block;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: .8rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
  margin-bottom: 12px;
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
.score-time { font-size: .875rem; color: var(--text-3); margin-bottom: 4px; }
.score-emoji { font-size: 1.375rem; color: var(--text); margin-bottom: 20px; }
.actions { display: flex; flex-direction: column; gap: 10px; }

.hard-list {
  text-align: left;
  background: var(--yellow-bg);
  border: 1px solid var(--yellow-border);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 16px;
}
.hard-list-title {
  font-size: .8rem;
  font-weight: 700;
  color: var(--yellow-text);
  margin-bottom: 8px;
}
.hard-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 4px 0;
  border-top: 1px solid var(--yellow-border);
}
.hard-count {
  flex-shrink: 0;
  font-size: .75rem;
  font-weight: 700;
  color: var(--red);
  min-width: 32px;
}
.hard-text {
  font-size: .85rem;
  color: var(--text);
  line-height: 1.4;
}
</style>
