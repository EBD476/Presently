import React, { useState, useRef, useCallback } from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { resolveUrl } from '../api'

export default function Sidebar() {
  const { deckName, slides, current, goTo, addSlide, removeSlide, duplicateSlide,
    reorderSlides, slideUrls, slideNames, slideBgColors, setSlideNames, save } = useSlideshow()
  const [dragSrc, setDragSrc] = useState(null)
  const [dropIdx, setDropIdx] = useState(null)

  function getSlideName(i) {
    return slideNames[i] || 'Slide ' + (i + 1)
  }

  function handleRename(i) {
    const curName = getSlideName(i)
    const newName = prompt('Rename slide:', slideNames[i] || '')
    if (newName === null) return
    if (newName.trim()) {
      setSlideNames(prev => ({ ...prev, [i]: newName.trim() }))
    } else {
      setSlideNames(prev => { const n = { ...prev }; delete n[i]; return n })
    }
    setTimeout(() => save(), 0)
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
    <div className="sidebar" id="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-header-left">
          <a href="/" id="decksLink" title="All Decks" style={{ color: '#a0a0b8', textDecoration: 'none', fontSize: '0.9rem', lineHeight: 1, marginRight: '0.25rem', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
          </a>
          <h3 id="deckNameHeading">{deckName}</h3>
          <span id="slideCount">{slides.length}</span>
        </div>
        <button className="sidebar-close" id="sidebarClose" aria-label="Close sidebar">&times;</button>
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
              data-index={i} draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragOver={e => handleDragOver(e, i)}
              onDragLeave={handleDragLeave}
              onDrop={e => handleDrop(e, i)}
              onDragEnd={() => { setDragSrc(null); setDropIdx(null) }}
              onClick={() => goTo(i)}>
              <div className="thumb-preview" style={thumbStyle}>
                {(!url || !url.trim()) && <span className="thumb-placeholder">&#x1F5BC;</span>}
              </div>
              <div className="thumb-info">
                <span className="thumb-label">{getSlideName(i)}</span>
                <span className="thumb-desc">{url && url.trim() ? (url.split('/').pop() || 'Image') : 'No image'}</span>
              </div>
              <button className="thumb-dup-btn" title="Duplicate slide" onClick={e => { e.stopPropagation(); duplicateSlide(i) }}>&#x29C9;</button>
              {slides.length > 1 && (
                <button className="thumb-del-btn" onClick={e => { e.stopPropagation(); if (window.confirm('Delete Slide ' + (i + 1) + '?')) removeSlide(i) }}>x</button>
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
        New Slide
      </button>
    </div>
  )
}
