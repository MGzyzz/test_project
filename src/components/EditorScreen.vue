<template>
  <div class="editor-root">

    <!-- Top bar -->
    <div class="editor-topbar card">
      <div class="topbar-load">
        <label class="btn-file" for="editor-file-input">📂 Load file</label>
        <input id="editor-file-input" type="file" accept=".txt" @change="onFileChange" />
        <span class="file-name">{{ fileName }}</span>
      </div>

      <div class="topbar-middle" v-if="blocks.length">
        <span class="chip chip-gray">{{ blocks.length }} blocks</span>
        <span class="chip chip-ok">✓ {{ validCount }}</span>
        <span v-if="issueCount" class="chip chip-warn">⚠ {{ issueCount }}</span>
      </div>

      <div class="topbar-actions" v-if="blocks.length">
        <button v-if="issueCount" class="btn btn-warn" @click="autoFixAll">Auto-fix ({{ issueCount }})</button>
        <button class="btn btn-secondary" @click="exportText">Export</button>
        <button class="btn btn-primary" @click="useInQuiz">Use in quiz →</button>
      </div>
    </div>

    <!-- Two-panel layout -->
    <div class="editor-layout">

      <!-- LEFT: issues list -->
      <div class="editor-left">
        <div class="filter-card card" v-if="blocks.length">
          <input v-model="search" type="text" class="search-input" placeholder="Search by text or Q number…" />
          <div class="tab-row">
            <button class="tab-btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">
              All <span class="tab-count">{{ blocks.length }}</span>
            </button>
            <button class="tab-btn tab-btn--warn" :class="{ active: filter === 'issues' }" @click="filter = 'issues'">
              Issues <span class="tab-count">{{ issueCount }}</span>
            </button>
            <button class="tab-btn" :class="{ active: filter === 'valid' }" @click="filter = 'valid'">
              Valid <span class="tab-count">{{ validCount }}</span>
            </button>
          </div>
        </div>

        <div v-if="filteredBlocks.length" class="block-list">
          <div
            v-for="block in filteredBlocks"
            :key="block.blockIndex"
            class="block-item"
            :class="{
              'block-item--issue': block.issues.length,
              'block-item--selected': selectedBlockIndex === block.blockIndex,
            }"
            @mousedown.prevent
            @click="selectBlock(block.blockIndex)"
          >
            <div class="block-badge" :class="block.issues.length ? 'badge-warn' : 'badge-ok'">
              {{ block.questionNumber ? 'Q' + block.questionNumber : '⚠' }}
            </div>
            <div class="block-meta">
              <p class="block-q">{{ block.questionText || '(no question text)' }}</p>
              <div v-if="block.issues.length" class="issue-chips">
                <span v-for="issue in block.issues" :key="issue.type" class="issue-chip">
                  {{ issueLabel(issue.type) }}
                </span>
              </div>
            </div>
            <span class="arrow-icon">›</span>
          </div>
        </div>

        <p v-else-if="blocks.length" class="empty-hint">No results for "{{ search }}"</p>

        <div v-if="!blocks.length" class="empty-state card">
          <p>Load a .txt file or paste questions below</p>
          <textarea
            v-model="rawText"
            class="paste-textarea"
            placeholder="Which of the following...&#10;+Correct answer&#10;-Wrong answer&#10;&#10;Next question..."
          ></textarea>
        </div>
      </div>

      <!-- RIGHT: text editor + selected block details -->
      <div class="editor-right" v-if="rawText">

        <!-- Selected block info -->
        <div v-if="selectedBlock" class="selected-panel card">
          <div class="selected-header">
            <span class="q-badge-large" :class="selectedBlock.issues.length ? 'badge-warn' : 'badge-ok'">
              {{ selectedBlock.questionNumber ? 'Q' + selectedBlock.questionNumber : '⚠' }}
            </span>
            <p class="selected-q">{{ selectedBlock.questionText || '(no question text)' }}</p>
          </div>

          <div v-if="selectedBlock.issues.length" class="issue-list">
            <div v-for="issue in selectedBlock.issues" :key="issue.type" class="issue-row">
              <span class="issue-icon">⚠</span>
              <span class="issue-msg">{{ issue.msg }}</span>
              <button v-if="issue.autofix === 'trim'" class="btn-fix" @click="fixTrimBlock(selectedBlock.blockIndex)">Fix</button>
            </div>
            <div v-if="getMergeWithPrev(selectedBlock.blockIndex)" class="merge-hint">
              <p>The block above has no answers — likely one question split by a blank line</p>
              <button class="btn-fix btn-fix--blue" @click="doMergeWithPrev(selectedBlock.blockIndex)">
                ↑ Merge with block above
              </button>
            </div>
            <div v-if="getMergeWithNext(selectedBlock.blockIndex)" class="merge-hint">
              <p>The block below has no question — likely one question split by a blank line</p>
              <button class="btn-fix btn-fix--blue" @click="doMergeWithNext(selectedBlock.blockIndex)">
                ↓ Merge with block below
              </button>
            </div>
          </div>
          <div v-else class="valid-label">✓ Valid question</div>
        </div>

        <!-- Raw text textarea -->
        <div class="textarea-card card">
          <div class="textarea-header">
            <label>Raw text</label>
            <span class="textarea-hint" v-if="!selectedBlock">← click a question to navigate</span>
            <span class="textarea-hint" v-else>block selected & highlighted</span>
          </div>
          <textarea
            ref="editorRef"
            v-model="rawText"
            class="editor-textarea"
            :class="{ 'is-selected': selectedBlockIndex >= 0 }"
            spellcheck="false"
            @input="selectedBlockIndex = -1"
            @click="selectedBlockIndex = -1"
          ></textarea>
        </div>
      </div>

      <!-- Right panel shown when no file loaded yet -->
      <div v-else class="editor-right">
        <div class="card" style="color: var(--text-2); text-align:center; padding: 48px 24px;">
          Load a file on the left to see the raw text editor
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { analyzeText, autoFixText, replaceBlock, mergeBlocksAt } from '../utils/linter.js'
import { useQuiz } from '../composables/useQuiz.js'

const emit = defineEmits(['go-quiz'])
const { loadText } = useQuiz()

// ── State ─────────────────────────────────────────────────────────────────────
const rawText = ref('')
const fileName = ref('no file loaded')
const search = ref('')
const filter = ref('all')
const selectedBlockIndex = ref(-1)
const editorRef = ref(null)

// ── Computed ──────────────────────────────────────────────────────────────────
const blocks = computed(() => analyzeText(rawText.value))
const validCount = computed(() => blocks.value.filter(b => b.valid).length)
const issueCount = computed(() => blocks.value.filter(b => b.issues.length).length)

const filteredBlocks = computed(() => {
  let list = blocks.value
  if (filter.value === 'issues') list = list.filter(b => b.issues.length)
  else if (filter.value === 'valid') list = list.filter(b => b.valid)
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    const numMatch = q.replace(/^q/, '')
    list = list.filter(b => {
      if (b.questionNumber && String(b.questionNumber) === numMatch) return true
      return b.questionText?.toLowerCase().includes(q)
    })
  }
  return list
})

const selectedBlock = computed(() =>
  selectedBlockIndex.value >= 0
    ? blocks.value.find(b => b.blockIndex === selectedBlockIndex.value) ?? null
    : null
)

// ── Block range helper ────────────────────────────────────────────────────────
// Returns the {start, end} character offsets of a block in rawText.
function getBlockRange(blockIndex) {
  const text = rawText.value
  const re = /\n\n+/g
  let lastIndex = 0
  let current = 0
  let match

  while ((match = re.exec(text)) !== null) {
    if (current === blockIndex) return { start: lastIndex, end: match.index }
    lastIndex = match.index + match[0].length
    current++
  }
  if (current === blockIndex) return { start: lastIndex, end: text.length }
  return null
}

// ── Methods ───────────────────────────────────────────────────────────────────
function selectBlock(blockIndex) {
  selectedBlockIndex.value = blockIndex

  nextTick(() => {
    const range = getBlockRange(blockIndex)
    const ta = editorRef.value
    if (!range || !ta) return

    ta.focus()
    ta.setSelectionRange(range.start, range.end)

    // Scroll textarea so the selected block is near the top
    const textBefore = rawText.value.slice(0, range.start)
    const linesBefore = (textBefore.match(/\n/g) || []).length
    const lineHeight = parseFloat(getComputedStyle(ta).lineHeight) || 22
    ta.scrollTop = Math.max(0, (linesBefore - 2) * lineHeight)
  })
}

function getMergeWithPrev(blockIndex) {
  const block = blocks.value.find(b => b.blockIndex === blockIndex)
  if (!block?.issues.some(i => i.type === 'no_question')) return false
  const idx = blocks.value.indexOf(block)
  return blocks.value[idx - 1]?.issues.some(i => i.type === 'no_answers') ?? false
}

function getMergeWithNext(blockIndex) {
  const block = blocks.value.find(b => b.blockIndex === blockIndex)
  if (!block?.issues.some(i => i.type === 'no_answers')) return false
  const idx = blocks.value.indexOf(block)
  return blocks.value[idx + 1]?.issues.some(i => i.type === 'no_question') ?? false
}

function issueLabel(type) {
  return {
    leading_space: 'leading space',
    no_question: 'no question',
    no_answers: 'no answers',
    no_correct: 'no correct answer',
  }[type] ?? type
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = ev => {
    rawText.value = ev.target.result
    selectedBlockIndex.value = -1
  }
  reader.readAsText(file)
}

function autoFixAll() {
  rawText.value = autoFixText(rawText.value)
  selectedBlockIndex.value = -1
}

function fixTrimBlock(blockIndex) {
  const block = blocks.value.find(b => b.blockIndex === blockIndex)
  if (!block) return
  const fixed = block.raw.split('\n').map(l => (/^\s+[+\-]/.test(l) ? l.trimStart() : l)).join('\n')
  rawText.value = replaceBlock(rawText.value, blockIndex, fixed)
  nextTick(() => selectBlock(blockIndex))
}

function doMergeWithPrev(blockIndex) {
  const block = blocks.value.find(b => b.blockIndex === blockIndex)
  if (!block) return
  const idx = blocks.value.indexOf(block)
  const prev = blocks.value[idx - 1]
  if (!prev) return
  rawText.value = mergeBlocksAt(rawText.value, prev.blockIndex, blockIndex)
  selectedBlockIndex.value = -1
}

function doMergeWithNext(blockIndex) {
  const block = blocks.value.find(b => b.blockIndex === blockIndex)
  if (!block) return
  const idx = blocks.value.indexOf(block)
  const next = blocks.value[idx + 1]
  if (!next) return
  rawText.value = mergeBlocksAt(rawText.value, blockIndex, next.blockIndex)
  selectedBlockIndex.value = -1
}

function exportText() {
  const blob = new Blob([rawText.value], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'questions_fixed.txt'
  a.click()
  URL.revokeObjectURL(url)
}

function useInQuiz() {
  loadText(rawText.value)
  emit('go-quiz')
}
</script>

<style scoped>
/* ── Top bar ──────────────────────────────────────────────────────────────── */
.editor-topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.topbar-load {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 200px;
}
.topbar-middle {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.topbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.topbar-actions .btn {
  width: auto;
  padding: 8px 16px;
  font-size: .875rem;
}

input[type='file'] { display: none; }
.btn-file {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: var(--surface-2);
  border: 1.5px solid var(--border-2);
  border-radius: var(--radius-sm);
  font-size: .875rem;
  font-weight: 600;
  color: var(--text-2);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color .15s, color .15s;
}
.btn-file:hover { border-color: var(--accent); color: var(--accent); }
.file-name { font-size: .8125rem; color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.chip {
  padding: 3px 10px;
  border-radius: 99px;
  font-size: .8125rem;
  font-weight: 600;
  border: 1px solid transparent;
}
.chip-ok   { background: var(--green-bg); border-color: var(--green-border); color: var(--green); }
.chip-warn { background: var(--yellow-bg); border-color: var(--yellow-border); color: var(--yellow); }
.chip-gray { background: var(--surface-2); border-color: var(--border-2); color: var(--text-2); }

.btn-warn { background: #f59e0b; color: #fff; border: none; }
.btn-warn:hover { background: #d97706; }

/* ── Two-panel layout ─────────────────────────────────────────────────────── */
.editor-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 16px;
  align-items: start;
}
@media (max-width: 720px) {
  .editor-layout { grid-template-columns: 1fr; }
}

/* ── Left panel ───────────────────────────────────────────────────────────── */
.editor-left {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filter-card {
  padding: 12px 14px;
  margin-bottom: 0;
}
.search-input {
  width: 100%;
  border: 1.5px solid var(--border-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font-size: .875rem;
  color: var(--text);
  outline: none;
  background: var(--surface-2);
  transition: border-color .15s;
  margin-bottom: 8px;
}
.search-input:focus { border-color: var(--accent); }
.tab-row { display: flex; gap: 6px; }
.tab-btn {
  flex: 1;
  padding: 6px 4px;
  border: 1.5px solid var(--border-2);
  border-radius: var(--radius-sm);
  background: #fff;
  font-size: .8125rem;
  font-weight: 600;
  color: var(--text-2);
  cursor: pointer;
  transition: all .15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.tab-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.tab-btn--warn.active { background: #f59e0b; border-color: #f59e0b; }
.tab-count {
  background: rgba(255,255,255,.25);
  border-radius: 99px;
  padding: 0 5px;
  font-size: .7rem;
}
.tab-btn:not(.active) .tab-count { background: var(--border-2); color: var(--text-3); }

.block-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.block-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: #fff;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: border-color .15s, background .15s, box-shadow .15s;
}
.block-item:hover { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.block-item--issue { border-color: var(--yellow-border); background: var(--yellow-bg); }
.block-item--issue:hover { border-color: #f59e0b; }
.block-item--selected { border-color: var(--accent) !important; background: var(--accent-bg) !important; box-shadow: 0 0 0 3px var(--accent-bg) !important; }

.block-badge {
  flex-shrink: 0;
  min-width: 38px;
  padding: 2px 5px;
  border-radius: var(--radius-sm);
  font-size: .75rem;
  font-weight: 700;
  text-align: center;
  border: 1px solid transparent;
}
.badge-ok   { background: var(--green-bg); border-color: var(--green-border); color: var(--green); }
.badge-warn { background: var(--yellow-bg); border-color: var(--yellow-border); color: var(--yellow); }

.block-meta { flex: 1; min-width: 0; }
.block-q {
  font-size: .8125rem;
  line-height: 1.45;
  color: var(--text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.issue-chips { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.issue-chip {
  padding: 1px 7px;
  background: var(--yellow-bg);
  border: 1px solid var(--yellow-border);
  color: var(--yellow);
  border-radius: 99px;
  font-size: .7rem;
  font-weight: 600;
}
.arrow-icon { flex-shrink: 0; color: var(--text-3); font-size: 1.1rem; line-height: 1.4; }

.empty-hint { text-align: center; color: var(--text-3); padding: 20px 0; font-size: .875rem; }
.empty-state { text-align: center; color: var(--text-2); padding: 24px; }
.paste-textarea {
  width: 100%;
  height: 180px;
  margin-top: 12px;
  border: 1.5px solid var(--border-2);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  font-size: .8125rem;
  font-family: 'Courier New', monospace;
  color: var(--text);
  background: var(--surface-2);
  resize: vertical;
  outline: none;
}
.paste-textarea:focus { border-color: var(--accent); }

/* ── Right panel ──────────────────────────────────────────────────────────── */
.editor-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 16px;
}

/* Selected block details */
.selected-panel {
  margin-bottom: 0;
}
.selected-header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}
.q-badge-large {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  font-size: .875rem;
  font-weight: 700;
  border: 1px solid transparent;
}
.selected-q {
  font-size: .9375rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text);
}

.issue-list { display: flex; flex-direction: column; gap: 8px; }
.issue-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: var(--yellow-bg);
  border: 1px solid var(--yellow-border);
  border-radius: var(--radius-sm);
}
.issue-icon { flex-shrink: 0; }
.issue-msg { flex: 1; color: #92400e; font-size: .875rem; line-height: 1.4; }

.btn-fix {
  flex-shrink: 0;
  padding: 4px 12px;
  background: #f59e0b;
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: .8125rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.btn-fix:hover { background: #d97706; }
.btn-fix--blue { background: #3b82f6; }
.btn-fix--blue:hover { background: #2563eb; }

.merge-hint {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: var(--radius-sm);
  font-size: .875rem;
  color: #1e40af;
}
.merge-hint p { line-height: 1.4; }
.merge-hint .btn-fix--blue { align-self: flex-start; }

.valid-label {
  padding: 8px 12px;
  background: var(--green-bg);
  border: 1px solid var(--green-border);
  color: var(--green);
  border-radius: var(--radius-sm);
  font-size: .875rem;
  font-weight: 600;
}

/* Raw textarea */
.textarea-card { margin-bottom: 0; }
.textarea-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.textarea-hint { font-size: .8125rem; color: var(--text-3); }
.editor-textarea {
  width: 100%;
  height: 55vh;
  min-height: 300px;
  border: 1.5px solid var(--border-2);
  border-radius: var(--radius-sm);
  padding: 12px;
  font-size: .8125rem;
  font-family: 'Courier New', monospace;
  line-height: 1.65;
  color: var(--text);
  background: var(--surface-2);
  resize: vertical;
  outline: none;
  transition: border-color .15s;
}
.editor-textarea:focus { border-color: var(--accent); }

.editor-textarea.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px var(--accent-bg);
}

.editor-textarea::selection {
  background: rgba(79, 70, 229, 0.22);
  color: var(--text);
}
</style>
