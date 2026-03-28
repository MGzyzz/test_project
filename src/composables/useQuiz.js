import { ref, computed } from 'vue'
import { parseQuestions } from '../utils/parser.js'
import { fetchStats, recordAnswer } from '../utils/statsApi.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── State ────────────────────────────────────────────────────────────────────
const allQuestions = ref([])
const quiz = ref([])
const current = ref(0)
const score = ref(0)
const selected = ref(new Set())
const answered = ref(false)
const countdownTimer = ref(null)
const rangeFrom = ref(1)
const rangeTo = ref(1)
const feedback = ref(null)   // { type: 'correct'|'wrong', text: string }
const progressPct = ref(0)
const wrongQuestions = ref([])  // questions answered incorrectly this round
const roundNumber = ref(1)      // current retry round
const allStats = ref([])        // [{ question_text, correct_count, wrong_count }]
const statsMap = computed(() => {
  const map = {}
  for (const s of allStats.value) map[s.question_text] = s
  return map
})

// ── Derived ──────────────────────────────────────────────────────────────────
const currentQuestion = computed(() => quiz.value[current.value])
const correctCount = computed(() =>
  currentQuestion.value?.answers.filter(a => a.correct).length ?? 0
)
const isMulti = computed(() => correctCount.value > 1)
const progress = computed(() => ({
  label: `${current.value + 1} / ${quiz.value.length}`,
}))
const showConfirm = computed(() =>
  !answered.value && selected.value.size > 0 &&
  (isMulti.value ? selected.value.size === correctCount.value : selected.value.size === 1)
)
const isDone = computed(() => quiz.value.length > 0 && current.value >= quiz.value.length)

// ── Actions ──────────────────────────────────────────────────────────────────
function loadText(text) {
  allQuestions.value = parseQuestions(text)
  const n = allQuestions.value.length
  rangeFrom.value = 1
  rangeTo.value = n || 1
}

function startQuiz(from, to) {
  clearCountdown()
  const n = allQuestions.value.length
  rangeFrom.value = Math.max(1, Math.min(from, n))
  rangeTo.value = Math.max(rangeFrom.value, Math.min(to, n))
  const subset = allQuestions.value.slice(rangeFrom.value - 1, rangeTo.value)
  quiz.value = shuffle(subset).map(q => ({ ...q, answers: shuffle(q.answers) }))
  current.value = 0
  score.value = 0
  answered.value = false
  selected.value = new Set()
  feedback.value = null
  progressPct.value = 0
  wrongQuestions.value = []
  roundNumber.value = 1
  fetchStats().then(data => { allStats.value = data })
}

function loadStats() {
  fetchStats().then(data => { allStats.value = data })
}

function startRetryRound() {
  clearCountdown()
  const questions = wrongQuestions.value
  roundNumber.value++
  wrongQuestions.value = []
  quiz.value = shuffle(questions).map(q => ({ ...q, answers: shuffle(q.answers) }))
  current.value = 0
  score.value = 0
  answered.value = false
  selected.value = new Set()
  feedback.value = null
  progressPct.value = 0
}

function selectAnswer(idx) {
  if (answered.value) return
  if (!isMulti.value) {
    selected.value = new Set([idx])
    return
  }
  const s = new Set(selected.value)
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
  selected.value = s
}

function confirmAnswer() {
  if (answered.value) return
  answered.value = true

  const q = currentQuestion.value
  const correctIndices = new Set(q.answers.map((a, i) => a.correct ? i : -1).filter(i => i >= 0))
  const isCorrect =
    selected.value.size === correctIndices.size &&
    [...selected.value].every(i => correctIndices.has(i))

  if (isCorrect) {
    score.value++
  } else {
    wrongQuestions.value.push(q)
  }
  recordAnswer(q.question, isCorrect)
  progressPct.value = ((current.value + 1) / quiz.value.length) * 100

  if (isCorrect) {
    feedback.value = { type: 'correct', text: 'Correct!' }
  } else {
    let seconds = 60
    feedback.value = { type: 'wrong', text: `Incorrect! Auto-next in ${seconds}...` }
    countdownTimer.value = setInterval(() => {
      seconds--
      if (seconds <= 0) {
        clearCountdown()
        nextQuestion()
      } else {
        feedback.value = { type: 'wrong', text: `Incorrect! Auto-next in ${seconds}...` }
      }
    }, 1000)
  }
}

function nextQuestion() {
  clearCountdown()
  current.value++
  if (current.value >= quiz.value.length) return
  answered.value = false
  selected.value = new Set()
  feedback.value = null
  progressPct.value = (current.value / quiz.value.length) * 100
}

function clearCountdown() {
  if (countdownTimer.value) {
    clearInterval(countdownTimer.value)
    countdownTimer.value = null
  }
}

function restartSameRange() {
  startQuiz(rangeFrom.value, rangeTo.value)
}

function getOptionState(idx) {
  const correctIndices = new Set(
    currentQuestion.value.answers.map((a, i) => a.correct ? i : -1).filter(i => i >= 0)
  )
  if (!answered.value) return selected.value.has(idx) ? 'selected' : ''
  if (selected.value.has(idx) && correctIndices.has(idx)) return 'correct'
  if (selected.value.has(idx) && !correctIndices.has(idx)) return 'wrong'
  if (!selected.value.has(idx) && correctIndices.has(idx)) return 'correct'
  return ''
}

export function useQuiz() {
  return {
    allQuestions,
    quiz,
    current,
    score,
    selected,
    answered,
    rangeFrom,
    rangeTo,
    currentQuestion,
    correctCount,
    isMulti,
    progress,
    showConfirm,
    feedback,
    progressPct,
    isDone,
    wrongQuestions,
    roundNumber,
    allStats,
    statsMap,
    loadText,
    loadStats,
    startQuiz,
    startRetryRound,
    selectAnswer,
    confirmAnswer,
    nextQuestion,
    restartSameRange,
    getOptionState,
  }
}
