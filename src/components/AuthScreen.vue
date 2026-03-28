<template>
  <div class="auth-wrap">
    <div class="card auth-card">
      <h1 class="auth-title">Test Prep</h1>

      <div class="tabs">
        <button :class="['tab', { active: tab === 'login' }]" @click="tab = 'login'">Login</button>
        <button :class="['tab', { active: tab === 'register' }]" @click="tab = 'register'">Register</button>
      </div>

      <form @submit.prevent="submit">
        <div class="field">
          <label>Username</label>
          <input v-model="username" type="text" placeholder="Enter username" autocomplete="username" />
        </div>
        <div class="field">
          <label>Password</label>
          <input v-model="password" type="password" placeholder="Enter password" autocomplete="current-password" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn btn-primary" type="submit" :disabled="loading">
          {{ loading ? 'Loading...' : tab === 'login' ? 'Login' : 'Register' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { login, register } from '../utils/statsApi.js'
import { setAuth } from '../utils/auth.js'

const emit = defineEmits(['authed'])

const tab      = ref('login')
const username = ref('')
const password = ref('')
const error    = ref('')
const loading  = ref(false)

async function submit() {
  error.value = ''
  if (!username.value || !password.value) { error.value = 'Fill in all fields'; return }

  loading.value = true
  try {
    const fn  = tab.value === 'login' ? login : register
    const res = await fn(username.value, password.value)
    if (res.error) { error.value = res.error; return }
    setAuth(res.token, res.username)
    emit('authed', res.username)
  } catch {
    error.value = 'Network error, try again'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
.auth-card {
  width: 100%;
  max-width: 360px;
  padding: 28px 24px;
}
.auth-title {
  text-align: center;
  margin-bottom: 20px;
  font-size: 1.5rem;
}
.tabs {
  display: flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px;
  margin-bottom: 20px;
}
.tab {
  flex: 1;
  padding: 7px;
  border: none;
  border-radius: 8px;
  font-size: .9rem;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: var(--text-2);
  transition: background .15s, color .15s;
}
.tab.active { background: var(--accent); color: #fff; }

.field { margin-bottom: 14px; }
.field label {
  display: block;
  font-size: .8rem;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 6px;
}
.field input {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border-2);
  border-radius: var(--radius-sm);
  padding: 9px 12px;
  font-size: .9375rem;
  color: var(--text);
  outline: none;
  transition: border-color .15s;
  box-sizing: border-box;
}
.field input:focus { border-color: var(--accent); }

.error {
  font-size: .85rem;
  color: var(--red);
  margin-bottom: 12px;
  font-weight: 500;
}
.btn { width: 100%; margin-top: 4px; }
</style>
