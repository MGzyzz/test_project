<template>
  <div
    class="container"
    :class="{
      'container--wide': mode === 'editor',
      'container--with-sidebar': mode === 'quiz' && screen === 'setup',
    }"
  >
    <!-- Blocked screen -->
    <div v-if="blockMessage" class="blocked-screen">
      <div class="blocked-card">
        <div class="blocked-icon" v-html="iconBan" />
        <h2>Account Blocked</h2>
        <p class="blocked-msg">{{ blockMessage }}</p>
        <button class="btn btn-primary" @click="blockMessage = ''">OK</button>
      </div>
    </div>

    <!-- Auth screen -->
    <template v-else-if="!authed">
      <ThemeToggle :is-dark="isDark" class="theme-btn-float" @toggle="toggleTheme" />
      <AuthScreen @authed="onAuthed" />
    </template>

    <template v-else-if="authed">
    <!-- Mode nav (hidden during active quiz) -->
    <div v-if="screen !== 'quiz'" class="mode-nav">
      <button class="mode-btn" :class="{ active: mode === 'quiz' }" @click="mode = 'quiz'">
        Quiz
      </button>
      <button class="mode-btn" :class="{ active: mode === 'editor' }" @click="mode = 'editor'">
        Editor
      </button>
      <button v-if="currentUser === 'admin'" class="mode-btn" :class="{ active: mode === 'admin' }" @click="mode = 'admin'">
        Admin
      </button>
      <span class="user-info">{{ currentUser }}</span>
      <ThemeToggle :is-dark="isDark" @toggle="toggleTheme" />
      <button class="mode-btn logout-btn" @click="logout">Logout</button>
    </div>

    <!-- Quiz mode screens -->
    <template v-if="mode === 'quiz'">
      <!-- Setup with sidebar -->
      <div v-if="screen === 'setup'" class="setup-layout">
        <FileSidebar @selected="onSidebarSelected" />
        <div class="setup-main">
          <SetupScreen ref="setupRef" @start="handleStart" @stats="screen = 'stats'" @leaderboard="screen = 'leaderboard'" />
        </div>
      </div>

      <QuizScreen v-else-if="screen === 'quiz'" />
      <StatsScreen v-else-if="screen === 'stats'" @back="screen = 'setup'" />
      <LeaderboardScreen v-else-if="screen === 'leaderboard'" @back="screen = 'setup'" />
      <ResultsScreen v-else @repeat="handleRepeat" @retry-wrong="handleRetryWrong" @back="screen = 'setup'" />
    </template>

    <!-- Editor mode -->
    <EditorScreen v-else-if="mode === 'editor'" @go-quiz="onGoQuiz" />

    <!-- Admin mode -->
    <AdminScreen v-else-if="mode === 'admin'" />

    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { isLoggedIn, getUser, clearAuth } from './utils/auth.js'
import { checkMe, saveTestResult } from './utils/statsApi.js'
import { iconBan } from './utils/icons.js'
import SetupScreen from './components/SetupScreen.vue'
import QuizScreen from './components/QuizScreen.vue'
import ResultsScreen from './components/ResultsScreen.vue'
import EditorScreen from './components/EditorScreen.vue'
import FileSidebar from './components/FileSidebar.vue'
import StatsScreen from './components/StatsScreen.vue'
import AuthScreen from './components/AuthScreen.vue'
import AdminScreen from './components/AdminScreen.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import LeaderboardScreen from './components/LeaderboardScreen.vue'
import { useQuiz } from './composables/useQuiz.js'

const mode = ref('quiz')    // 'quiz' | 'editor' | 'admin'
const screen = ref('setup') // 'setup' | 'quiz' | 'results'
const authed = ref(isLoggedIn())
const currentUser = ref(getUser()?.username || '')
const blockMessage = ref('')
let pollInterval = null

// ── Theme ────────────────────────────────────────────────────────────────────
const isDark = ref(document.documentElement.getAttribute('data-theme') === 'dark')

function toggleTheme() {
  isDark.value = !isDark.value
  const theme = isDark.value ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : '')
  try { localStorage.setItem('theme', theme) } catch {}
}

function onAuthed(username) {
  authed.value = true
  currentUser.value = username
  startPolling()
}

function logout() {
  clearAuth()
  authed.value = false
  currentUser.value = ''
  blockMessage.value = ''
  screen.value = 'setup'
  stopPolling()
}

async function pollCheck() {
  if (document.hidden) return  // вкладка неактивна — пропускаем
  const result = await checkMe()
  if (result?.blocked) {
    blockMessage.value = result.error
    clearAuth()
    authed.value = false
    stopPolling()
  }
}

function startPolling() {
  stopPolling()
  pollInterval = setInterval(pollCheck, 120000) // раз в 2 минуты
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
}

const {
  answered, showConfirm, confirmAnswer, nextQuestion,
  quiz, current, selectAnswer, restartSameRange, startQuiz, startRetryRound, isDone,
  score, currentTestName, quizElapsed,
} = useQuiz()

watch(isDone, done => {
  if (done) {
    screen.value = 'results'
    if (currentTestName.value && quiz.value.length) {
      saveTestResult(currentTestName.value, score.value, quiz.value.length, quizElapsed.value)
    }
  }
})

function handleStart({ from, to, testName }) {
  startQuiz(from, to, testName)
  screen.value = 'quiz'
}

function handleRepeat() {
  restartSameRange()
  screen.value = 'quiz'
}

function handleRetryWrong() {
  startRetryRound()
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

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  if (authed.value) startPolling()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  stopPolling()
})
</script>

<style>
.container { position: relative; }

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

@media (max-width: 640px) {
  .setup-layout {
    flex-direction: column;
    gap: 0;
    align-items: stretch;
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
.user-info {
  margin-left: auto;
  font-size: .8rem;
  font-weight: 600;
  color: var(--text-2);
  padding: 8px 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
  display: flex;
  align-items: center;
}
.logout-btn {
  flex: none;
  padding: 8px 12px;
  font-size: .8rem;
  font-weight: 600;
  color: var(--red);
  line-height: 1;
}
.logout-btn:hover { color: var(--red); background: var(--red-bg); }

.theme-btn-float {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
}

.blocked-screen {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
.blocked-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 32px 28px;
  max-width: 360px; width: 100%;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,.2);
}
.blocked-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
  color: var(--red);
}
.blocked-card h2 { margin-bottom: 10px; color: var(--red); }
.blocked-msg {
  color: var(--text-2); font-size: .9375rem;
  margin-bottom: 20px; line-height: 1.5;
}
</style>
