const API_BASE = window.location.origin + '/api'
const TOKEN_KEY = 'presentlyToken'
let authToken = null
try {
  authToken = localStorage.getItem(TOKEN_KEY)
} catch (_) {}

export function getToken() {
  return authToken
}

export function setToken(token) {
  authToken = token || null
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch (_) {}
}

function redirectToAuth() {
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.href = '/auth'
  }
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken
  const resp = await fetch(API_BASE + path, { ...options, headers })
  if (resp.status === 401 && authToken) {
    setToken(null)
    redirectToAuth()
  }
  return resp
}

export function resolveUrl(path) {
  if (!path) return ''
  if (path.startsWith('/api/')) {
    let url = API_BASE + path.replace('/api', '')
    if (path.startsWith('/api/image/') && authToken) {
      url += (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(authToken)
    }
    return url
  }
  if (path.match(/^https?:\/\//)) return path
  return API_BASE + '/' + path.replace(/^\//, '')
}

export async function fetchDecks() {
  const resp = await apiFetch('/decks')
  if (!resp.ok) throw new Error('Failed to fetch decks')
  const data = await resp.json()
  return data.decks || []
}

export async function fetchDeckData(deckName) {
  const resp = await apiFetch('/data/' + encodeURIComponent(deckName))
  if (!resp.ok) throw new Error('Failed to fetch deck data')
  const data = await resp.json()
  return data.kv || {}
}

export async function saveDeckData(deckName, kv) {
  const resp = await apiFetch('/data/' + encodeURIComponent(deckName), {
    method: 'POST',
    body: JSON.stringify({ kv })
  })
  if (!resp.ok) throw new Error('Failed to save deck')
  const result = await resp.json()
  return result.kv || kv
}

export async function deleteDeck(deckName) {
  const resp = await apiFetch('/data/' + encodeURIComponent(deckName), { method: 'DELETE' })
  if (!resp.ok) throw new Error('Failed to delete deck')
}

export async function toggleStar(deckName) {
  const resp = await apiFetch('/star/' + encodeURIComponent(deckName), { method: 'PATCH' })
  if (!resp.ok) throw new Error('Failed to toggle star')
  const data = await resp.json()
  return data.starred
}

export async function uploadImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      const commaIdx = dataUrl.indexOf(',')
      const base64Data = dataUrl.substring(commaIdx + 1)
      const header = dataUrl.substring(0, commaIdx)
      const mime = (header.match(/:(.*?);/) || [])[1] || 'image/png'
      try {
        const resp = await apiFetch('/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64Data, mime })
        })
        if (!resp.ok) throw new Error('Failed to upload image')
        const result = await resp.json()
        resolve(result.url)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function fetchShapeLibrary() {
  const resp = await apiFetch('/shapes')
  if (!resp.ok) throw new Error('Failed to fetch shape library')
  const data = await resp.json()
  return data.shapes || {}
}

export async function saveShapeToLibrary(name, data) {
  const resp = await apiFetch('/shapes', {
    method: 'POST',
    body: JSON.stringify({ name, data })
  })
  if (!resp.ok) throw new Error('Failed to save shape')
}

export async function deleteShapeFromLibrary(name) {
  const resp = await apiFetch('/shapes/' + encodeURIComponent(name), { method: 'DELETE' })
  if (!resp.ok) throw new Error('Failed to delete shape')
}

export async function fetchTemplates() {
  const resp = await apiFetch('/templates')
  if (!resp.ok) throw new Error('Failed to fetch templates')
  const data = await resp.json()
  return data.templates || {}
}

export async function saveTemplateToDb(name, data) {
  const resp = await apiFetch('/templates', {
    method: 'POST',
    body: JSON.stringify({ name, data })
  })
  if (!resp.ok) throw new Error('Failed to save template')
}

export async function deleteTemplateFromDb(name) {
  const resp = await apiFetch('/templates/' + encodeURIComponent(name), { method: 'DELETE' })
  if (!resp.ok) throw new Error('Failed to delete template')
}

export async function apiRegister(username, password, email) {
  const resp = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, email })
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Registration failed')
  return data
}

export async function apiLogin(username, password) {
  const resp = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Login failed')
  return data
}

export async function apiLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } catch (_) {}
}

export async function apiMe() {
  const resp = await apiFetch('/auth/me')
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Not authenticated')
  return data.user
}

export async function apiUpdateProfile({ username, email, avatar } = {}) {
  const resp = await apiFetch('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ username, email, avatar })
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Failed to update profile')
  return data.user
}

export async function apiChangePassword(currentPassword, newPassword) {
  const resp = await apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Failed to change password')
}

export async function apiAdminListUsers() {
  const resp = await apiFetch('/admin/users')
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Failed to fetch users')
  return data.users || []
}

export async function apiAdminCreateUser({ username, password, email, role }) {
  const resp = await apiFetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, email, role })
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Failed to create user')
  return data.user
}

export async function apiAdminUpdateUser(id, { username, email, role } = {}) {
  const resp = await apiFetch('/admin/users/' + id, {
    method: 'PATCH',
    body: JSON.stringify({ username, email, role })
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || 'Failed to update user')
  return data.user
}

export async function apiAdminDeleteUser(id) {
  const resp = await apiFetch('/admin/users/' + id, { method: 'DELETE' })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(data.error || 'Failed to delete user')
}

export async function apiAdminResetPassword(id, newPassword) {
  const resp = await apiFetch('/admin/users/' + id + '/reset-password', {
    method: 'POST',
    body: JSON.stringify({ newPassword })
  })
  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(data.error || 'Failed to reset password')
}

export function getDefaultApiBase() {
  const port = window.location.port || '3002'
  return 'http://localhost:' + port
}