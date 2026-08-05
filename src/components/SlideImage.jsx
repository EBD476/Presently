import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { resolveUrl, uploadImage } from '../api'
import { useI18n } from '../i18n'

export default function SlideImage({ slideIndex }) {
  const { slideUrls, setSlideUrls, resizeData, setResizeData,
    slideMode, setSlideMode, slideBgColors, setSlideBgColors, save, current } = useSlideshow()
  const { t } = useI18n()
  const wrapRef = useRef(null)
  const [activeResize, setActiveResize] = useState(null)
  const [dragCandidate, setDragCandidate] = useState(null)
  const saveRef = useRef(save)
  useLayoutEffect(() => { saveRef.current = save })

  const url = slideUrls[slideIndex]
  const mode = slideMode[slideIndex] || 'contain'
  const bgColor = slideBgColors[slideIndex]
  const rd = resizeData[slideIndex]

  const handleModeChange = useCallback((newMode) => {
    setSlideMode(prev => ({ ...prev, [slideIndex]: newMode }))
    setTimeout(() => saveRef.current(), 0)
  }, [slideIndex, setSlideMode, save])

  const handleBgChange = useCallback((color) => {
    if (color && color !== '#1a1a24') {
      setSlideBgColors(prev => ({ ...prev, [slideIndex]: color }))
    } else {
      setSlideBgColors(prev => { const n = { ...prev }; delete n[slideIndex]; return n })
    }
    setTimeout(() => saveRef.current(), 0)
  }, [slideIndex, setSlideBgColors, save])

  const handleResizeStart = useCallback((e, handle) => {
    if (!wrapRef.current) return
    e.stopPropagation()
    const rect = wrapRef.current.getBoundingClientRect()
    const containerRect = e.currentTarget.closest('.slide').getBoundingClientRect()
    setDragCandidate({
      handle,
      startX: e.clientX, startY: e.clientY,
      startW: rect.width, startH: rect.height,
      startL: rect.left - containerRect.left,
      startT: rect.top - containerRect.top,
      containerRect
    })
  }, [])

  const handleMoveStart = useCallback((e) => {
    if (e.target.classList.contains('resize-handle')) return
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const containerRect = e.currentTarget.closest('.slide').getBoundingClientRect()
    setDragCandidate({
      handle: 'move',
      startX: e.clientX, startY: e.clientY,
      startW: rect.width, startH: rect.height,
      startL: rect.left - containerRect.left,
      startT: rect.top - containerRect.top,
      containerRect
    })
  }, [])

  useEffect(() => {
    if (!dragCandidate && !activeResize) return
    const onMouseMove = (e) => {
      if (!wrapRef.current) return
      const act = activeResize || dragCandidate
      const dx = e.clientX - act.startX
      const dy = e.clientY - act.startY
      if (!activeResize && (Math.abs(dx) < 3 && Math.abs(dy) < 3)) return

      if (!activeResize) {
        setActiveResize(dragCandidate)
        setDragCandidate(null)
        const cursorMap = {
          'nw': 'nwse-resize', 'n': 'ns-resize', 'ne': 'nesw-resize',
          'e': 'ew-resize', 'se': 'nwse-resize', 's': 'ns-resize',
          'sw': 'nesw-resize', 'w': 'ew-resize', 'move': 'move'
        }
        document.body.style.cursor = cursorMap[dragCandidate.handle] || 'default'
      }

      const h = act.handle
      let x = act.startL, y = act.startT
      let w = act.startW, hh = act.startH
      const min = 30

      const sides = {
        'e': () => { w = Math.max(min, act.startW + dx) },
        'w': () => { const dw = Math.min(act.startW - min, dx); x = act.startL + dw; w = act.startW - dw },
        's': () => { hh = Math.max(min, act.startH + dy) },
        'n': () => { const dh = Math.min(act.startH - min, dy); y = act.startT + dh; hh = act.startH - dh },
        'ne': () => { w = Math.max(min, act.startW + dx); const dh = Math.min(act.startH - min, dy); y = act.startT + dh; hh = act.startH - dh },
        'nw': () => { const dw = Math.min(act.startW - min, dx); x = act.startL + dw; w = act.startW - dw; const dh = Math.min(act.startH - min, dy); y = act.startT + dh; hh = act.startH - dh },
        'se': () => { w = Math.max(min, act.startW + dx); hh = Math.max(min, act.startH + dy) },
        'sw': () => { const dw = Math.min(act.startW - min, dx); x = act.startL + dw; w = act.startW - dw; hh = Math.max(min, act.startH + dy) },
        'move': () => { x = act.startL + dx; y = act.startT + dy }
      }
      if (sides[h]) sides[h]()

      wrapRef.current.style.left = x + 'px'
      wrapRef.current.style.top = y + 'px'
      wrapRef.current.style.width = w + 'px'
      wrapRef.current.style.height = hh + 'px'
    }

    const onMouseUp = () => {
      const active = activeResize || dragCandidate
      setDragCandidate(null)
      if (active && wrapRef.current) {
        const slideEl = wrapRef.current.closest('.slide')
        const sw = slideEl.offsetWidth
        const sh = slideEl.offsetHeight
        const wr = wrapRef.current.getBoundingClientRect()
        const sr = slideEl.getBoundingClientRect()
        const x = ((wr.left - sr.left) / sw * 100) + '%'
        const y = ((wr.top - sr.top) / sh * 100) + '%'
        const w = (wr.width / sw * 100) + '%'
        const h = (wr.height / sh * 100) + '%'
        setResizeData(prev => ({ ...prev, [slideIndex]: { x, y, w, h } }))
        wrapRef.current.style.left = x
        wrapRef.current.style.top = y
        wrapRef.current.style.width = w
        wrapRef.current.style.height = h
        setTimeout(() => saveRef.current(), 0)
      }
      document.body.style.cursor = ''
      setActiveResize(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [dragCandidate, activeResize, slideIndex, setResizeData, save])

  const wrapStyle = rd ? { left: rd.x, top: rd.y, width: rd.w, height: rd.h } : {}
  const objectFit = mode === 'cover' ? 'cover' : mode === 'contain' ? 'contain' : mode === 'fill' ? 'fill' : 'none'

  const handleImageClick = useCallback((e) => {
    if (e.target.closest('.resize-handle') || e.target.closest('.img-props')) return
    document.querySelectorAll('.slide-img-wrap.selected').forEach(el => el.classList.remove('selected'))
    if (wrapRef.current && current === slideIndex) {
      wrapRef.current.classList.add('selected')
    }
  }, [current, slideIndex])

  if (!url || !url.trim()) {
    return (
      <div className="slide-img-wrap" ref={wrapRef} style={{ display: 'none', ...wrapStyle }}
        onClick={handleImageClick} />
    )
  }

  return (
    <>
      <div className="slide-img-wrap" ref={wrapRef}
        style={{ display: 'block', ...wrapStyle }}
        onClick={handleImageClick}
        onMouseDown={handleMoveStart}
        onDragOver={e => e.currentTarget.classList.add('drag-over')}
        onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
        onDrop={async (e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('drag-over')
          const file = e.dataTransfer.files[0]
          if (file && file.type.startsWith('image/')) {
            try {
              const serverUrl = await uploadImage(file)
              setSlideUrls(prev => ({ ...prev, [slideIndex]: serverUrl }))
              setResizeData(prev => { const n = { ...prev }; delete n[slideIndex]; return n })
              setTimeout(() => saveRef.current(), 0)
            } catch (_) { console.error('Upload failed') }
          }
        }}>
        <img src={resolveUrl(url)} alt="" draggable="false" style={{ objectFit }} />
        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(dir => (
          <div key={dir} className={'resize-handle ' + dir}
            onMouseDown={e => handleResizeStart(e, dir)} />
        ))}
      </div>
      <div className="img-props" data-slide={slideIndex}>
        {['cover', 'contain', 'fill', 'original'].map(m => (
          <button key={m} data-mode={m} className={mode === m ? 'active' : ''}
            onClick={() => handleModeChange(m)}>{t('slideImage.' + m)}</button>
        ))}
        <div className="bg-color-wrap">
          <input type="color" className="bg-color-input" value={bgColor || '#1a1a24'}
            title={t('slideImage.background')}
            onChange={e => handleBgChange(e.target.value)} />
        </div>
      </div>
    </>
  )
}
