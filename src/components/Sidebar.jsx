import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { resolveUrl } from '../api'
import ConfirmDialog from './ConfirmDialog'
import { useI18n } from '../i18n'

export default function Sidebar({ collapsed, onToggle }) {
  const { deckName, slides, current, goTo, addSlide, removeSlide, duplicateSlide,
    reorderSlides, slideUrls, slideNames, slideBgColors, setSlideNames, saveRef, loading } = useSlideshow()
  const { t, n } = useI18n()
  const [dragSrc, setDragSrc] = useState(null)
  const [dropIdx, setDropIdx] = useState(null)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editingIdx, setEditingIdx] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const editingIdxRef = useRef(null)
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (editingIdx !== null && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [editingIdx])

  function startRename(i) {
    setCtxMenu(null)
    editingIdxRef.current = i
    setEditingIdx(i)
    setRenameValue(slideNames[i] || '')
  }

  function cancelRename() {
    editingIdxRef.current = null
    setEditingIdx(null)
  }

  function commitRename() {
    if (editingIdxRef.current === null) return
    const i = editingIdxRef.current
    if (renameValue.trim()) {
      setSlideNames(prev => ({ ...prev, [i]: renameValue.trim() }))
    } else {
      setSlideNames(prev => { const n = { ...prev }; delete n[i]; return n })
    }
    editingIdxRef.current = null
    setEditingIdx(null)
    setTimeout(() => saveRef.current(), 0)
  }

  useEffect(() => {
    if (!ctxMenu) return
    const close = () => setCtxMenu(null)
    document.addEventListener('click', close)
    document.addEventListener('scroll', close, true)
    return () => { document.removeEventListener('click', close); document.removeEventListener('scroll', close, true) }
  }, [ctxMenu])

  function getSlideName(i) {
    return slideNames[i] || t('slideshow.slide', { n: n(i + 1) })
  }

  const handleDragStart = (e, i) => {
    setDragSrc(i)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', i)
  }

  const handleDragOver = (e, i) => {
    e.preventDefault()
    if (dragSrc === null || dragSrc === i) return
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropIdx(e.clientY < midY ? i : i + 1)
  }

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return
    setDropIdx(null)
  }

  const handleDrop = (e, i) => {
    e.preventDefault()
    if (dragSrc !== null && dragSrc !== i) {
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const toIdx = e.clientY < midY ? i : i + 1
      reorderSlides(dragSrc, toIdx > dragSrc ? toIdx - 1 : toIdx)
    }
    setDragSrc(null)
    setDropIdx(null)
  }

  return (
    <div className={'sidebar' + (collapsed ? ' collapsed' : '')} id="sidebar">
      {loading ? (
        <div className="sidebar-loading">
          {/* <div className="sidebar-header">
            <div className="sidebar-header-left" style={{ gap: '0.5rem', width: '100%' }}>
              <div className="skeleton" style={{ width: 18, height: 18, borderRadius: '4px' }} />
              <div className="skeleton" style={{ flex: 1, height: 16, borderRadius: '4px' }} />
              <div className="skeleton" style={{ width: 24, height: 16, borderRadius: '4px' }} />
            </div>
          </div> */}
          <div className="sidebar-thumbnails" id="thumbnails">
            <div className="skeleton skeleton-thumb" id="skeletonThumb1"><div className="skeleton skeleton-thumb-box"></div><div className="skeleton skeleton-thumb-line"></div></div>
            <div className="skeleton skeleton-thumb" id="skeletonThumb2"><div className="skeleton skeleton-thumb-box"></div><div className="skeleton skeleton-thumb-line short"></div></div>
            <div className="skeleton skeleton-thumb" id="skeletonThumb3"><div className="skeleton skeleton-thumb-box"></div><div className="skeleton skeleton-thumb-line"></div></div>
          </div>
          {/* <div className="sidebar-thumbnails">
            {Array.from({ length: slides.length || 5 }, (_, i) => (
              <div key={i} className="skeleton-thumb skeleton">
                <div className="skeleton-thumb-box" />
                <div>
                  <div className="skeleton-thumb-line" />
                  <div className="skeleton-thumb-line short" />
                </div>
              </div>
            ))}
          </div> */}
          <div className="skeleton" style={{ margin: '0.75rem', height: 40, borderRadius: '0.5rem' }} />
        </div>
      ) : (
      <>
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <a href="/" id="decksLink" title={t('sidebar.allDecks')} style={{ color: '#a0a0b8', textDecoration: 'none', fontSize: '0.9rem', lineHeight: 1, marginRight: '0.25rem', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </a>
          <h3 id="deckNameHeading">{deckName}</h3>
          <span id="slideCount">{slides.length}</span>
        </div>
        <button className="sidebar-close" id="sidebarClose" aria-label={t('sidebar.closeSidebar')} onClick={onToggle}>&times;</button>
      </div>
      <div className="sidebar-thumbnails" id="thumbnails">
        {slides.map((_, i) => {
          const url = slideUrls[i]
          const bgColor = slideBgColors[i]
          const thumbStyle = {}
          if (url && url.trim()) {
            thumbStyle.backgroundImage = 'url("' + resolveUrl(url).replace(/"/g, '\\"') + '")'
          }
          if (bgColor) thumbStyle.backgroundColor = bgColor
          return (
            <div key={i} className={'thumb-item' + (i === current ? ' active' : '')}
              data-index={i} draggable={editingIdx !== i}
              onDragStart={e => handleDragStart(e, i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, i)}
              onDragEnd={() => { setDragSrc(null); setDropIdx(null) }}
              onClick={() => { if (editingIdx === null) goTo(i) }}
              onContextMenu={e => { e.preventDefault(); setCtxMenu({ idx: i, x: e.clientX, y: e.clientY }) }}>
              <div className="thumb-preview" style={thumbStyle}>
                {(!url || !url.trim()) && <span className="thumb-placeholder">&#x1F5BC;</span>}
              </div>
              <div className="thumb-info">
                {editingIdx === i ? (
                  <input ref={renameInputRef} className="thumb-rename-input" value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onDoubleClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    onDragStart={e => e.preventDefault()}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitRename()
                      else if (e.key === 'Escape') cancelRename()
                    }}
                    onBlur={commitRename} />
                ) : (
                  <span className="thumb-label" title={getSlideName(i)}
                    onDoubleClick={e => { e.stopPropagation(); startRename(i) }}>{getSlideName(i)}</span>
                )}
                <span className="thumb-desc">{url && url.trim() ? (url.split('/').pop() || t('sidebar.image')) : t('sidebar.noImage')}</span>
              </div>
              <button className="thumb-dup-btn" title={t('sidebar.duplicateSlideTitle')} onClick={e => { e.stopPropagation(); duplicateSlide(i) }}>&#x29C9;</button>
              {slides.length > 1 && (
                <button className="thumb-del-btn" onClick={e => { e.stopPropagation(); setDeleteTarget(i) }}>x</button>
              )}
            </div>
          )
        })}
        {dropIdx !== null && dragSrc !== null && dropIdx !== dragSrc && dropIdx !== dragSrc + 1 && (
          <div className="drop-placeholder" />
        )}
      </div>
      <button className="sidebar-add-btn" id="sidebarAddBtn" onClick={addSlide}>
        <svg className="svg-icon" style={{ width: '1.5em', height: '1.5em', verticalAlign: 'middle', fill: 'currentColor', overflow: 'hidden' }} viewBox="0 0 1024 1024">
          <path d="M514 912c-219.9 0-398.8-178.9-398.8-398.8S294.1 114.4 514 114.4s398.8 178.9 398.8 398.8S733.9 912 514 912z m0-701.5c-166.9 0-302.7 135.8-302.7 302.7 0 166.9 135.8 302.7 302.7 302.7s302.7-135.8 302.7-302.7c0-166.9-135.8-302.7-302.7-302.7z" fill="#666" />
          <path d="M570.1 569.3h126.3c30.9 0 56.1-25.2 56.1-56.1 0-30.9-25.2-56.1-56.1-56.1H570.1V330.8c0-30.9-25.2-56.1-56.1-56.1-30.9 0-56.1 25.2-56.1 56.1v126.3H331.6c-30.9 0-56.1 25.2-56.1 56.1 0 30.9 25.2 56.1 56.1 56.1h126.3v126.3c0 30.9 25.2 56.1 56.1 56.1s56.1-25.2 56.1-56.1V569.3z" fill="#aaa" />
        </svg>
        {t('sidebar.newSlide')}
      </button>

      {ctxMenu && (
        <div className="ctx-menu show" style={{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }}
          onClick={e => e.stopPropagation()}>
          <div className="ctx-item" onClick={() => { startRename(ctxMenu.idx); setCtxMenu(null) }}>{t('common.rename')}</div>
          <div className="ctx-item" onClick={() => { duplicateSlide(ctxMenu.idx); setCtxMenu(null) }}>{t('sidebar.duplicateSlide')}</div>
          {slides.length > 1 && (
            <div className="ctx-item" onClick={() => { setDeleteTarget(ctxMenu.idx); setCtxMenu(null) }}>{t('sidebar.deleteSlide')}</div>
          )}
        </div>
      )}

      <ConfirmDialog
        show={deleteTarget !== null}
        message={t('sidebar.deleteSlideConfirm', { n: n((deleteTarget ?? 0) + 1) })}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { removeSlide(deleteTarget); setDeleteTarget(null) }} />
      </>)}
    </div>
  )
}
