import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchDecks, toggleStar as apiToggleStar, deleteDeck as apiDeleteDeck, saveDeckData, fetchDeckData } from '../api'
import { timeAgo } from '../utils'
import { useToast } from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

const MODES = ['grid', 'list', 'compact']
const MODE_ICONS = { grid: '\u25B8', list: '\u2261', compact: '\u2014' }
const MODE_LABELS = { grid: 'Grid', list: 'List', compact: 'Compact' }
const PAGE_SIZE = 20

export default function DeckListPage() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [allDecks, setAllDecks] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState(localStorage.getItem('deckSortBy') || 'modified')
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('deckViewMode')
    return MODES.includes(saved) ? saved : 'grid'
  })
  const [newDeckName, setNewDeckName] = useState('')
  const [confirmMsg, setConfirmMsg] = useState('')
  const [confirmCb, setConfirmCb] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [ctxPos, setCtxPos] = useState(null)
  const [ctxDeck, setCtxDeck] = useState(null)

  useEffect(() => { loadDecks() }, [])

  useEffect(() => {
    localStorage.setItem('deckViewMode', viewMode)
  }, [viewMode])

  useEffect(() => {
    localStorage.setItem('deckSortBy', sortBy)
  }, [sortBy])

  async function loadDecks() {
    try {
      const decks = await fetchDecks()
      setAllDecks(decks)
    } catch (_) {
      showToast('Failed to load decks')
    }
  }

  const sortedDecks = [...allDecks].sort((a, b) => {
    if (!!b.starred - !!a.starred) return !!b.starred - !!a.starred
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    if (sortBy === 'count') return (b.count || 0) - (a.count || 0)
    if (sortBy === 'modified') return (b.modified || '').localeCompare(a.modified || '')
    return 0
  })

  const q = searchQuery.toLowerCase()
  const filtered = q ? sortedDecks.filter(d => d.name.toLowerCase().includes(q)) : sortedDecks
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const pageDecks = filtered.slice(pageStart, pageStart + PAGE_SIZE)

  function openDeck(name) {
    navigate('/slideshow?deck=' + encodeURIComponent(name))
  }

  function getUntitledName() {
    const names = new Set(allDecks.map(d => d.name))
    let i = 0
    while (names.has('Untitled' + (i || ''))) i++
    return 'Untitled' + (i || '')
  }

  function handleNewDeck() {
    const name = newDeckName.trim() || getUntitledName()
    openDeck(name)
  }

  async function handleToggleStar(name) {
    try {
      await apiToggleStar(name)
      loadDecks()
    } catch (_) { showToast('Failed to update star') }
  }

  async function handleDeleteDeck(name) {
    try {
      await apiDeleteDeck(name)
      loadDecks()
    } catch (_) { showToast('Failed to delete deck') }
  }

  async function handleDuplicate(name) {
    try {
      const kv = await fetchDeckData(name)
      let copyName = name + ' (Copy)'
      let i = 2
      while (allDecks.some(d => d.name === copyName)) {
        copyName = name + ' (Copy ' + i + ')'
        i++
      }
      await saveDeckData(copyName, kv)
      loadDecks()
    } catch (_) { showToast('Failed to duplicate deck') }
  }

  async function handleRename(newName) {
    if (!newName || newName === renameTarget) return
    try {
      const kv = await fetchDeckData(renameTarget)
      await saveDeckData(newName, kv)
      await apiDeleteDeck(renameTarget)
      loadDecks()
    } catch (_) { showToast('Failed to rename deck') }
    setRenameTarget(null)
  }

  function cycleView() {
    const idx = MODES.indexOf(viewMode)
    setViewMode(MODES[(idx + 1) % MODES.length])
  }

  function showConfirm(msg, cb) {
    setConfirmMsg(msg)
    setConfirmCb(() => cb)
  }

  function resolveThumb(path) {
    if (!path) return ''
    if (path.match(/^https?:\/\//)) return path
    return window.location.origin + (path.startsWith('/') ? '' : '/') + path
  }

  return (
    <div className="container" onClick={() => setCtxPos(null)}>
      <div className="header">
        <div className="header-left">
          <svg className="logo" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <h1>Presently<span>v1.0</span></h1>
          <span className="deckCount">{filtered.length}/{allDecks.length}</span>
        </div>
        <div className="header-right">
          <button className="create-header-btn" onClick={() => openDeck(getUntitledName())}>+ New</button>
          <select className="sort-select" value={sortBy} onChange={e => { setSortBy(e.target.value); setCurrentPage(1) }}>
            <option value="name">Name</option>
            <option value="count">Slides</option>
            <option value="modified">Modified</option>
          </select>
          <button className="view-toggle" onClick={cycleView}>
            <span className="icon" dangerouslySetInnerHTML={{ __html: MODE_ICONS[viewMode] }} />
            <span id="viewLabel">{MODE_LABELS[viewMode]}</span>
          </button>
        </div>
      </div>

      <div className="search-bar">
        <span className="search-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input type="text" placeholder="Search decks..." spellCheck="false" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1) }} />
      </div>

      <div className={'list ' + viewMode}>
        {pageDecks.map(d => {
          const thumbUrl = d.firstImage ? resolveThumb(d.firstImage) : ''
          const starred = !!d.starred
          return (
            <a key={d.name} className="deck-card" href={'/slideshow?deck=' + encodeURIComponent(d.name)}
              onClick={e => { e.preventDefault(); openDeck(d.name) }}
              onContextMenu={e => { e.preventDefault(); setCtxPos({ x: e.clientX, y: e.clientY }); setCtxDeck(d.name) }}>
              <div className="thumb" style={thumbUrl ? { backgroundImage: "url('" + thumbUrl.replace(/'/g, "\\'") + "')" } : {}}>
                {!thumbUrl && '\uD83D\uDDBC'}
                <button className={'star-btn' + (starred ? ' on' : '')} onClick={e => { e.preventDefault(); e.stopPropagation(); handleToggleStar(d.name) }} title={starred ? 'Unstar' : 'Star'}>
                  <svg viewBox="0 0 24 24" fill={starred ? '#fbbf24' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </button>
              </div>
              <div className="info">
                <div className="name">{d.name}</div>
                <div className="count">{d.count} slide{d.count !== 1 ? 's' : ''}</div>
                <div className="time">{timeAgo(d.lastOpened)}</div>
              </div>
              <span className="arrow">&rarr;</span>
              <button className="rename-btn" onClick={e => { e.preventDefault(); e.stopPropagation(); setRenameTarget(d.name); setRenameValue(d.name) }} title="Rename deck">&#9998;</button>
              <button className="del-btn" onClick={e => { e.preventDefault(); e.stopPropagation(); showConfirm('Delete "' + d.name + '"? This cannot be undone.', () => handleDeleteDeck(d.name)) }} title="Delete deck">&times;</button>
            </a>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="empty">{searchQuery ? 'No decks match "' + searchQuery + '".' : 'No decks yet. Create one below.'}</div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(c => c - 1)}>&#8249; Prev</button>
          <span className="page-info">Page {currentPage} of {totalPages} ({pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filtered.length)})</span>
          <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(c => c + 1)}>Next &#8250;</button>
        </div>
      )}

      <div className="new-deck">
        <input type="text" placeholder="New deck name..." spellCheck="false" maxLength="100"
          value={newDeckName} onChange={e => setNewDeckName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleNewDeck() }} />
        <button onClick={handleNewDeck}>Create & Open</button>
      </div>

      <ConfirmDialog
        show={!!confirmCb}
        message={confirmMsg}
        onCancel={() => setConfirmCb(null)}
        onConfirm={() => { const cb = confirmCb; setConfirmCb(null); if (cb) cb() }}
      />

      {renameTarget && (
        <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) setRenameTarget(null) }}>
          <div className="confirm-box">
            <p>Rename deck</p>
            <input type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
              placeholder="New deck name..." spellCheck="false" maxLength="100"
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', padding: '0.7rem 1rem', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s', margin: '0.75rem 0 1.25rem' }}
              autoFocus onKeyDown={e => { if (e.key === 'Enter') handleRename(renameValue); if (e.key === 'Escape') setRenameTarget(null) }} />
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="btn-save" onClick={() => handleRename(renameValue)}
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer', border: 'none', transition: 'opacity 0.2s', fontFamily: 'inherit' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {ctxPos && (
        <div className="ctx-menu show" style={{ left: ctxPos.x + 'px', top: ctxPos.y + 'px' }}
          onClick={e => e.stopPropagation()}>
          <div className="ctx-item" onClick={() => { setRenameTarget(ctxDeck); setRenameValue(ctxDeck); setCtxPos(null) }}>Rename</div>
          <div className="ctx-item" onClick={() => { handleDuplicate(ctxDeck); setCtxPos(null) }}>Duplicate</div>
          <div className="ctx-item" id="ctxStar" onClick={() => { handleToggleStar(ctxDeck); setCtxPos(null) }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            {' '}{allDecks.find(d => d.name === ctxDeck)?.starred ? 'Unstar' : 'Star'}
          </div>
          <div className="ctx-divider"></div>
          <div className="ctx-item" onClick={() => { showConfirm('Delete "' + ctxDeck + '"? This cannot be undone.', () => handleDeleteDeck(ctxDeck)); setCtxPos(null) }}>Delete</div>
        </div>
      )}
    </div>
  )
}
