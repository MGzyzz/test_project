<template>
  <aside class="file-sidebar">
    <div class="sidebar-header">Test Files</div>
    <div v-if="loading" class="sidebar-empty">Loading...</div>
    <div v-else-if="!files.length" class="sidebar-empty">No files found</div>
    <ul v-else class="file-list">
      <li
        v-for="f in files"
        :key="f.file"
        class="file-item"
        :class="{ active: active === f.file }"
        @click="select(f)"
      >
        <span class="file-icon">📄</span>
        <span class="file-label">{{ f.name }}</span>
      </li>
    </ul>
  </aside>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useQuiz } from '../composables/useQuiz.js'

const emit = defineEmits(['selected'])
const { loadText, allQuestions } = useQuiz()

const files = ref([])
const active = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch('/manifest.json')
    if (res.ok) files.value = await res.json()
  } catch {}
  loading.value = false
  if (files.value.length) select(files.value[0])
})

async function select(f) {
  if (active.value === f.file) return
  try {
    const res = await fetch(f.file)
    if (!res.ok) return
    const text = await res.text()
    loadText(text)
    active.value = f.file
    emit('selected', { name: f.name, text, total: allQuestions.value.length })
  } catch {}
}
</script>

<style scoped>
.file-sidebar {
  width: 210px;
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 0;
  height: fit-content;
  position: sticky;
  top: 16px;
}

.sidebar-header {
  font-size: .75rem;
  font-weight: 700;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: .06em;
  padding: 0 14px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
}

.sidebar-empty {
  font-size: .8125rem;
  color: var(--text-3);
  padding: 8px 14px;
}

.file-list {
  list-style: none;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  cursor: pointer;
  border-radius: 0;
  transition: background .12s;
  font-size: .875rem;
  color: var(--text-2);
  font-weight: 500;
  border-left: 3px solid transparent;
}

.file-item:hover {
  background: var(--surface-2);
  color: var(--text);
}

.file-item.active {
  background: var(--accent-bg);
  color: var(--accent);
  border-left-color: var(--accent);
}

.file-icon {
  font-size: .875rem;
  flex-shrink: 0;
}

.file-label {
  line-height: 1.3;
}
</style>
