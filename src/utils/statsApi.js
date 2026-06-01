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

export async function saveTestResult(testName, score, total, timeSeconds) {
  try {
    await fetch(`${BASE}/api/test-results`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ testName, score, total, timeSeconds }),
    })
  } catch {
    // non-critical
  }
}

export async function fetchAvailableTests() {
  try {
    const res = await fetch(`${BASE}/api/test-results/tests`, { headers: authHeaders() })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function fetchLeaderboard(testName) {
  try {
    const res = await fetch(
      `${BASE}/api/test-results/leaderboard?testName=${encodeURIComponent(testName)}`,
      { headers: authHeaders() }
    )
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

export async function fetchFileContent(filename) {
  try {
    const res = await fetch(`${BASE}/api/files/${encodeURIComponent(filename)}`)
    if (!res.ok) return null
    const { content } = await res.json()
    return content
  } catch {
    return null
  }
}

export async function saveFileContent(filename, content) {
  try {
    const res = await fetch(`${BASE}/api/files/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ content }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function fetchFileVersions(filename) {
  try {
    const res = await fetch(
      `${BASE}/api/admin/files/${encodeURIComponent(filename)}/versions`,
      { headers: authHeaders() }
    )
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function restoreFileVersion(filename, versionId) {
  try {
    const res = await fetch(
      `${BASE}/api/admin/files/${encodeURIComponent(filename)}/restore/${versionId}`,
      { method: 'POST', headers: authHeaders() }
    )
    return res.ok
  } catch {
    return false
  }
}
