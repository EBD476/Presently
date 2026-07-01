import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { resolveUrl, uploadImage } from '../api'

export default function SlideImage({ slideIndex }) {
  const { slideUrls, setSlideUrls, resizeData, setResizeData,
    slideMode, setSlideMode, slideBgColors, setSlideBgColors, save, current } = useSlideshow()
  const wrapRef = useRef(null)
  const [activeResize, setActiveResize] = useState(null)
  const [dragCandidate, setDragCandidate] = useState(null)

  const url = slideUrls[slideIndex]
  const mode = slideMode[slideIndex] || 'contain'
  const bgColor = slideBgColors[slideIndex]
  const rd = resizeData[slideIndex]

  const handleModeChange = useCallback((newMode) => {
    setSlideMode(prev => ({ ...prev, [slideIndex]: newMode }))
    setTimeout(() => save(), 0)
  }, [slideIndex, setSlideMode, save])

  const handleBgChange = useCallback((color) => {
    if (color && color !== '#1a1a24') {
      setSlideBgColors(prev => ({ ...prev, [slideIndex]: color }))
    } else {
      setSlideBgColors(prev => { const n = { ...prev }; delete n[slideIndex]; return n })
    }
    setTimeout(() => save(), 0)
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
    if (!dragCandidate) return
    const onMouseMove = (e) => {
      if (!wrapRef.current) return
      const dx = e.clientX - dragCandidate.startX
      const dy = e.clientY - dragCandidate.startY
      if (!activeResize && (Math.abs(dx) < 3 && Math.abs(dy) < 3)) return

      if (!activeResize) {
        setActiveResize(dragCandidate)
        setDragCandidate(null)
        return
      }

      const h = activeResize.handle
      let x = activeResize.startL, y = activeResize.startT
      let w = activeResize.startW, hh = activeResize.startH
      const min = 30

      const sides = {
        'e': () => { w = Math.max(min, activeResize.startW + dx) },
        'w': () => { const dw = Math.min(activeResize.startW - min, dx); x = activeResize.startL + dw; w = activeResize.startW - dw },
        's': () => { hh = Math.max(min, activeResize.startH + dy) },
        'n': () => { const dh = Math.min(activeResize.startH - min, dy); y = activeResize.startT + dh; hh = activeResize.startH - dh },
        'ne': () => { w = Math.max(min, activeResize.startW + dx); const dh = Math.min(activeResize.startH - min, dy); y = activeResize.startT + dh; hh = activeResize.startH - dh },
        'nw': () => { const dw = Math.min(activeResize.startW - min, dx); x = activeResize.startL + dw; w = activeResize.startW - dw; const dh = Math.min(activeResize.startH - min, dy); y = activeResize.startT + dh; hh = activeResize.startH - dh },
        'se': () => { w = Math.max(min, activeResize.startW + dx); hh = Math.max(min, activeResize.startH + dy) },
        'sw': () => { const dw = Math.min(activeResize.startW - min, dx); x = activeResize.startL + dw; w = activeResize.startW - dw; hh = Math.max(min, activeResize.startH + dy) },
        'move': () => { x = activeResize.startL + dx; y = activeResize.startT + dy }
      }
      if (sides[h]) sides[h]()

      wrapRef.current.style.left = x + 'px'
      wrapRef.current.style.top = y + 'px'
      wrapRef.current.style.width = w + 'px'
      wrapRef.current.style.height = hh + 'px'
    }

    const onMouseUp = () => {
      setDragCandidate(null)
      if (activeResize && wrapRef.current) {
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
        setTimeout(() => save(), 0)
      }
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
              setTimeout(() => save(), 0)
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
            onClick={() => handleModeChange(m)}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
        ))}
        <div className="bg-color-wrap">
          <input type="color" className="bg-color-input" value={bgColor || '#1a1a24'}
            title="Background color"
            onChange={e => handleBgChange(e.target.value)} />
        </div>
      </div>
    </>
  )
}
