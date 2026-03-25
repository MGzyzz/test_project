<template>
  <div
    class="container"
    :class="{
      'container--wide': mode === 'editor',
      'container--with-sidebar': mode === 'quiz' && screen === 'setup',
    }"
  >
    <!-- Mode nav (hidden during active quiz) -->
    <div v-if="screen !== 'quiz'" class="mode-nav">
      <button class="mode-btn" :class="{ active: mode === 'quiz' }" @click="mode = 'quiz'">
        Quiz
      </button>
      <button class="mode-btn" :class="{ active: mode === 'editor' }" @click="mode = 'editor'">
        Editor
      </button>
    </div>

    <!-- Quiz mode screens -->
    <template v-if="mode === 'quiz'">
      <!-- Setup with sidebar -->
      <div v-if="screen === 'setup'" class="setup-layout">
        <FileSidebar @selected="onSidebarSelected" />
        <div class="setup-main">
          <SetupScreen ref="setupRef" @start="handleStart" />
        </div>
      </div>

      <QuizScreen v-else-if="screen === 'quiz'" />
      <ResultsScreen v-else @repeat="handleRepeat" @back="screen = 'setup'" />
    </template>

    <!-- Editor mode -->
    <EditorScreen v-else @go-quiz="onGoQuiz" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import SetupScreen from './components/SetupScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import EditorScreen from './components/EditorScreen.vue'
import FileSidebar from './components/FileSidebar.vue'
import { useQuiz } from './composables/useQuiz.js'

const mode = ref('quiz')    // 'quiz' | 'editor'
const screen = ref('setup') // 'setup' | 'quiz' | 'results'

const {
  answered, showConfirm, confirmAnswer, nextQuestion,
  quiz, current, selectAnswer, restartSameRange, startQuiz, isDone,
} = useQuiz()

watch(isDone, done => { if (done) screen.value = 'results' })

function handleStart({ from, to }) {
  startQuiz(from, to)
  screen.value = 'quiz'
}

function handleRepeat() {
  restartSameRange()
  screen.value = 'quiz'
}

function onGoQuiz() {
  mode.value = 'quiz'
  screen.value = 'setup'
}

function onSidebarSelected({ name, text, total }) {
  // SetupScreen already has loadText called via useQuiz,
  // just sync its local state via expose
  if (setupRef.value) setupRef.value.syncFromSidebar(name, text, total)
}

const setupRef = ref(null)

function onKeydown(e) {
  if (screen.value !== 'quiz') return

  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (answered.value) nextQuestion()
    else if (showConfirm.value) confirmAnswer()
    return
  }

  const num = parseInt(e.key)
  if (num >= 1 && num <= 9) {
    const idx = num - 1
    if (idx < quiz.value[current.value]?.answers.length) selectAnswer(idx)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style>
.container--with-sidebar {
  max-width: 860px;
}

.setup-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.setup-main {
  flex: 1;
  min-width: 0;
}

@media (max-width: 600px) {
  .setup-layout {
    flex-direction: column;
  }
}

.mode-nav {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 4px;
  border-radius: var(--radius);
}
.mode-btn {
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
.mode-btn.active {
  background: var(--accent);
  color: #fff;
}
</style>
