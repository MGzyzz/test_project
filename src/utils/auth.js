export function getToken()   { return localStorage.getItem('auth_token') }
export function getUser()    { const u = localStorage.getItem('auth_user'); return u ? JSON.parse(u) : null }
export function isLoggedIn() { return !!getToken() }

export function setAuth(token, username) {
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_user', JSON.stringify({ username }))
}

export function clearAuth() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}
