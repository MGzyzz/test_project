<template>
  <div>
    <div class="card">
      <label>Questions</label>
      <div class="file-upload-area">
        <label class="btn-file" for="file-input">Load file</label>
        <input type="file" id="file-input" accept=".txt" @change="onFileChange" />
        <span class="file-name">{{ fileName }}</span>
      </div>
      <textarea
        v-model="text"
        @input="onTextInput"
        placeholder="Which of the following...&#10;+Correct answer&#10;-Wrong answer&#10;-Wrong answer&#10;&#10;Next question..."
      ></textarea>
      <div class="status">{{ status }}</div>
    </div>

    <div class="card">
      <div class="range-row">
        <div class="range-group">
          <label for="range-from">From</label>
          <input
            id="range-from"
            type="number"
            v-model.number="from"
            :min="1"
            :max="total"
          />
        </div>
        <div class="range-group">
          <label for="range-to">To</label>
          <input
            id="range-to"
            type="number"
            v-model.number="to"
            :min="from"
            :max="total"
          />
        </div>
      </div>
    </div>

    <div class="action-row">
      <button class="btn btn-primary" @click="onStart">Start Quiz</button>
      <button v-if="total" class="btn btn-secondary" @click="emit('stats')">View Stats</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuiz } from '../composables/useQuiz.js'

const emit = defineEmits(['start', 'stats'])
const { allQuestions, loadText } = useQuiz()

const text = ref('')
const fileName = ref('or paste text below')
const from = ref(1)
const to = ref(1)


const total = computed(() => allQuestions.value.length)
const status = computed(() => {
  const n = total.value
  return n ? `Loaded ${n} question${n > 1 ? 's' : ''}` : ''
})

function onTextInput() {
  loadText(text.value)
  from.value = 1
  to.value = total.value || 1
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = ev => {
    text.value = ev.target.result
    onTextInput()
  }
  reader.readAsText(file)
}

function onStart() {
  if (!total.value) return
  const testName = (fileName.value && fileName.value !== 'or paste text below')
    ? fileName.value
    : 'Custom Test'
  emit('start', { from: from.value, to: to.value, testName })
}

function syncFromSidebar(name, content, total_) {
  text.value = content
  fileName.value = name
  from.value = 1
  to.value = total_ || 1
}

defineExpose({ syncFromSidebar })
</script>

<style scoped>
textarea {
  width: 100%;
  height: 220px;
  background: var(--surface-2);
  border: 1px solid var(--border-2);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: .875rem;
  font-family: 'Courier New', monospace;
  color: var(--text);
  resize: vertical;
  outline: none;
  transition: border-color .15s;
}
textarea:focus { border-color: var(--accent); }

.file-upload-area {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.btn-file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--surface-2);
  border: 1px solid var(--border-2);
  border-radius: 8px;
  font-size: .875rem;
  font-weight: 600;
  color: var(--text-2);
  cursor: pointer;
  transition: border-color .15s, color .15s;
  white-space: nowrap;
}
.btn-file:hover { border-color: var(--accent); color: var(--accent); }

input[type="file"] { display: none; }

.file-name {
  font-size: .8125rem;
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  font-size: .8125rem;
  color: var(--accent);
  font-weight: 600;
  margin-top: 8px;
  min-height: 18px;
}

.range-row {
  display: flex;
  gap: 12px;
}
.range-group { flex: 1; }
.range-group input[type="number"] {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border-2);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  font-size: .9375rem;
  color: var(--text);
  outline: none;
  transition: border-color .15s;
}
.range-group input[type="number"]:focus { border-color: var(--accent); }

.action-row {
  display: flex;
  gap: 10px;
}
.action-row .btn { flex: 1; }
</style>
