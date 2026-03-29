import { getToken } from './auth.js'

const BASE = import.meta.env.VITE_API_URL || ''

function authHeaders() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function register(username, password) {
  const res = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

export async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

export async function recordAnswer(questionText, correct) {
  try {
    await fetch(`${BASE}/api/stats`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ questionText, correct }),
    })
  } catch {
    // stats are non-critical
  }
}

export async function fetchStats() {
  try {
    const res = await fetch(`${BASE}/api/stats`, { headers: authHeaders() })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

// Returns { blocked: true, error: '...' } if blocked, otherwise null
export async function checkMe() {
  try {
    const res = await fetch(`${BASE}/api/auth/me`, { headers: authHeaders() })
    if (res.status === 403) return await res.json()
    return null
  } catch {
    return null
  }
}
