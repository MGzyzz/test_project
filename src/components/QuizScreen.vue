<template>
  <div>
    <div class="progress-header">
      <span>{{ progress.label }}</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <div class="card">
      <div v-if="currentStats && currentStats.wrong_count >= 3 && currentStats.wrong_count > currentStats.correct_count" class="hard-badge">
        <span>⚠ Hard question — {{ currentStats.wrong_count }} mistakes</span>
        <button
          v-if="!answered && hintsLeft > 0"
          class="hint-btn"
          @click="useHint"
        >💡 Hint ({{ hintsLeft }})</button>
        <span v-else-if="hintsLeft === 0 && !hintText" class="hint-used">No hints left</span>
      </div>
      <p v-if="hintText" class="hint-text">Starts with: <strong>{{ hintText }}</strong></p>
      <p class="question-text">{{ currentQuestion.question }}</p>
      <p v-if="isMulti" class="hint">Choose {{ correctCount }} answers</p>

      <div class="options">
        <div
          v-for="(ans, i) in currentQuestion.answers"
          :key="i"
          class="option"
          :class="[getOptionState(i), { disabled: answered }]"
          @click="selectAnswer(i)"
        >
          <span class="badge">{{ i + 1 }}</span>
          <span class="option-text">{{ ans.text }}</span>
        </div>
      </div>

      <div v-if="feedback" class="feedback" :class="feedback.type">
        {{ feedback.text }}
      </div>

      <button
        v-if="!answered"
        class="btn btn-primary"
        :disabled="!showConfirm"
        @click="confirmAnswer"
      >Confirm</button>
      <button
        v-if="answered"
        class="btn btn-primary"
        @click="nextQuestion"
      >Next</button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useQuiz } from '../composables/useQuiz.js'

const {
  currentQuestion,
  correctCount,
  isMulti,
  progress,
  progressPct,
  showConfirm,
  feedback,
  answered,
  selectAnswer,
  confirmAnswer,
  nextQuestion,
  getOptionState,
  statsMap,
  current,
} = useQuiz()

const currentStats = computed(() => statsMap.value[currentQuestion.value?.question])

const hintsLeft  = ref(3)
const hintLength = ref(0)

watch(current, () => { hintLength.value = 0 })

const hintText = computed(() => {
  const correct = currentQuestion.value?.answers.find(a => a.correct)
  if (!correct || hintLength.value === 0) return ''
  return correct.text.slice(0, hintLength.value) + '...'
})

function useHint() {
  if (hintsLeft.value <= 0) return
  hintLength.value++
  hintsLeft.value--
}
</script>

<style scoped>
.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: .8125rem;
  font-weight: 600;
  color: var(--text-2);
}
.progress-track {
  background: var(--surface-3);
  border-radius: 99px;
  height: 3px;
  overflow: hidden;
  margin-bottom: 20px;
}
.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
  transition: width .3s ease;
}

.question-text {
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.6;
  color: var(--text);
  margin-bottom: 6px;
}
.hint {
  font-size: .8125rem;
  color: var(--accent);
  font-weight: 500;
  margin-bottom: 16px;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  background: var(--surface);
  border: 1px solid var(--border-2);
  border-radius: var(--radius);
  cursor: pointer;
  transition: border-color .15s, background .15s;
  -webkit-tap-highlight-color: transparent;
}
.option:hover:not(.disabled) { border-color: var(--accent-bright); background: var(--accent-bg); }
.option.selected { border-color: var(--accent); background: var(--accent-bg); }
.option.correct { border-color: var(--green); background: var(--green-bg); }
.option.wrong { border-color: var(--red); background: var(--red-bg); }
.option.disabled { cursor: default; }

.badge {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--surface-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: .75rem;
  font-weight: 700;
  color: var(--text-2);
  transition: background .15s, color .15s;
}
.option.selected .badge { background: var(--accent); color: #fff; }
.option.correct .badge { background: var(--green); color: #fff; }
.option.wrong .badge { background: var(--red); color: #fff; }

.option-text { font-size: .9375rem; line-height: 1.45; padding-top: 2px; }

.feedback {
  font-size: .9375rem;
  font-weight: 600;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
}
.feedback.correct { background: var(--green-bg); border: 1px solid var(--green-border); color: var(--green); }
.feedback.wrong { background: var(--red-bg); border: 1px solid var(--red-border); color: var(--red); }

.hard-badge {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: .8rem;
  font-weight: 700;
  color: var(--yellow-text);
  background: var(--yellow-bg);
  border: 1px solid var(--yellow-border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  margin-bottom: 10px;
}
.hint-btn {
  flex-shrink: 0;
  background: var(--yellow-bg);
  border: 1px solid var(--yellow);
  color: var(--yellow-text);
  font-size: .75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background .15s, border-color .15s;
}
.hint-btn:hover { border-color: var(--yellow-text); }
.hint-used { font-size: .75rem; color: var(--yellow-text); opacity: .6; }
.hint-text {
  font-size: .85rem;
  color: var(--yellow-text);
  background: var(--yellow-bg);
  border: 1px dashed var(--yellow-border);
  border-radius: var(--radius-sm);
  padding: 5px 10px;
  margin-bottom: 10px;
}

.btn + .btn { margin-top: 10px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
