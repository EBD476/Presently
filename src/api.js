const API_BASE = window.location.origin + '/api'

export function resolveUrl(path) {
  if (!path) return ''
  if (path.startsWith('/api/')) return API_BASE + path.replace('/api', '')
  if (path.match(/^https?:\/\//)) return path
  return API_BASE + '/' + path.replace(/^\//, '')
}

export async function fetchDecks() {
  const resp = await fetch(API_BASE + '/decks')
  if (!resp.ok) throw new Error('Failed to fetch decks')
  const data = await resp.json()
  return data.decks || []
}

export async function fetchDeckData(deckName) {
  const resp = await fetch(API_BASE + '/data/' + encodeURIComponent(deckName))
  if (!resp.ok) throw new Error('Failed to fetch deck data')
  const data = await resp.json()
  return data.kv || {}
}

export async function saveDeckData(deckName, kv) {
  const resp = await fetch(API_BASE + '/data/' + encodeURIComponent(deckName), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kv })
  })
  if (!resp.ok) throw new Error('Failed to save deck')
  const result = await resp.json()
  return result.kv || kv
}

export async function deleteDeck(deckName) {
  const resp = await fetch(API_BASE + '/data/' + encodeURIComponent(deckName), { method: 'DELETE' })
  if (!resp.ok) throw new Error('Failed to delete deck')
}

export async function toggleStar(deckName) {
  const resp = await fetch(API_BASE + '/star/' + encodeURIComponent(deckName), { method: 'PATCH' })
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
        const resp = await fetch(API_BASE + '/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64Data, mime })
        })
        const result = await resp.json()
        resolve(result.url)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function getDefaultApiBase() {
  const port = window.location.port || '3002'
  return 'http://localhost:' + port
}
