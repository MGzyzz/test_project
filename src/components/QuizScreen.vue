<template>
  <div>
    <div class="progress-header">
      <span>{{ progress.label }}</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
    </div>

    <div class="card">
      <p v-if="currentStats && currentStats.wrong_count >= 3 && currentStats.wrong_count > currentStats.correct_count" class="hard-badge">
        ⚠ Hard question — {{ currentStats.wrong_count }} mistakes
      </p>
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
import { computed } from 'vue'
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
} = useQuiz()

const currentStats = computed(() => statsMap.value[currentQuestion.value?.question])
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
.option.selected .badge { background: var(--accent); color: #0f0e0c; }
.option.correct .badge { background: var(--green); color: #0f0e0c; }
.option.wrong .badge { background: var(--red); color: #0f0e0c; }

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
  font-size: .8rem;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  margin-bottom: 10px;
  display: inline-block;
}

.btn + .btn { margin-top: 10px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
