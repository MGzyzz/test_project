const BASE = import.meta.env.VITE_API_URL || ''

export async function recordAnswer(questionText, correct) {
  try {
    await fetch(`${BASE}/api/stats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionText, correct }),
    })
  } catch {
    // stats are non-critical, ignore network errors
  }
}

export async function fetchStats() {
  try {
    const res = await fetch(`${BASE}/api/stats`)
    return await res.json()
  } catch {
    return []
  }
}
