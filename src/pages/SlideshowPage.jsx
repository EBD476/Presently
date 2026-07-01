import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlideshowProvider, useSlideshow } from '../context/SlideshowContext'
import { useToast } from '../components/Toast'
import { resolveUrl, uploadImage } from '../api'
import Sidebar from '../components/Sidebar'
import SlideImage from '../components/SlideImage'
import ShapeLayer from '../components/ShapeLayer'
import ShapeProps from '../components/ShapeProps'
import Navigation from '../components/Navigation'
import SettingsModal from '../components/SettingsModal'
import { getDefaultShape } from '../utils'

function SlideshowEditor() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [searchParams] = useSearchParams()
  const deckParam = searchParams.get('deck')

  const {
    deckName, slides, current,
    slideUrls, setSlideUrls, resizeData, setResizeData,
    slideMode, setSlideMode, slideNames, setSlideNames,
    slideBgColors, slideNotes, setSlideNotes,
    slideShapes, setSlideShapes, loading,
    drawData, setDrawData,
    loadDeck, save, goTo, next, prev,
    duplicateSlide
  } = useSlideshow()

  const containerRef = useRef(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth <= 900)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [drawMode, setDrawMode] = useState(false)
  const [laserMode, setLaserMode] = useState(false)
  const [presenterMode, setPresenterMode] = useState(false)
  const [selectedShapeId, setSelectedShapeId] = useState(null)
  const [lineDrawState, setLineDrawState] = useState(null)
  const [shapePopupOpen, setShapePopupOpen] = useState(false)
  const [showUrlBarFor, setShowUrlBarFor] = useState(null)
  const [urlBarValue, setUrlBarValue] = useState('')
  const urlBarRef = useRef(null)
  const [ctxMenuPos, setCtxMenuPos] = useState(null)
  const [ctxShapeMenuPos, setCtxShapeMenuPos] = useState(null)
  const [ctxSlideIdx, setCtxSlideIdx] = useState(-1)
  const [ctxShapeData, setCtxShapeData] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const drawCanvasRef = useRef(null)
  const drawCtxRef = useRef(null)
  const laserCanvasRef = useRef(null)
  const laserCtxRef = useRef(null)
  const laserPointsRef = useRef([])
  const laserRafRef = useRef(null)
  const shapeClipboardRef = useRef(null)

  useEffect(() => {
    const name = deckParam || localStorage.getItem('deckName') || 'Default'
    if (deckParam) localStorage.setItem('deckName', name)
    loadDeck(name)
  }, [deckParam])

  useEffect(() => {
    if (loading) return
    const el = document.querySelector('.skeleton-slide')
    if (el) el.classList.add('skeleton-hidden')
  }, [loading])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (settingsVisible) {
        if (e.key === 'Escape') { e.preventDefault(); setSettingsVisible(false) }
        return
      }
      const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'PageUp', 'PageDown', ' ']
      const isInPresenterNotes = document.activeElement?.id === 'presenterNotes'
      const isContentEditable = document.activeElement?.isContentEditable
      if (isInPresenterNotes && navKeys.includes(e.key)) return
      if (isContentEditable) {
        if (navKeys.includes(e.key) || e.key === 'Delete' || e.key === 'Backspace') return
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev() }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'Home') { e.preventDefault(); goTo(0) }
      if (e.key === 'End') { e.preventDefault(); goTo(slides.length - 1) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); /* undo delete image */ }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSlide(current) }
      if (e.key === 'Escape') {
        setCtxMenuPos(null); setCtxShapeMenuPos(null)
        if (lineDrawState) setLineDrawState(null)
        setShapePopupOpen(false)
      }
      if ((e.key === 'l' || e.key === 'L') && fullscreen) { e.preventDefault(); if (!laserMode && drawMode) setDrawMode(false); setLaserMode(!laserMode) }
      if ((e.key === 'p' || e.key === 'P') && fullscreen) { e.preventDefault(); setPresenterMode(!presenterMode) }
      if ((e.key === 'd' || e.key === 'D') && fullscreen) { e.preventDefault(); if (!drawMode && laserMode) setLaserMode(false); setDrawMode(!drawMode) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settingsVisible, slides.length, current, fullscreen, laserMode, drawMode, presenterMode, prev, next, goTo, lineDrawState, duplicateSlide])

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFull = !!document.fullscreenElement
      setFullscreen(isFull)
      if (!isFull) { setDrawMode(false); setLaserMode(false); setPresenterMode(false) }
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  useEffect(() => {
    const onPaste = async (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      let imgItem = null
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) { imgItem = items[i]; break }
      }
      if (!imgItem) return
      e.preventDefault()
      const file = imgItem.getAsFile()
      if (!file) return
      try {
        const serverUrl = await uploadImage(file)
        setSlideUrls(prev => ({ ...prev, [current]: serverUrl }))
        setResizeData(prev => { const n = { ...prev }; delete n[current]; return n })
        setTimeout(() => save(), 0)
      } catch (_) { showToast('Failed to paste image') }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [current, setSlideUrls, setResizeData, save, showToast])

  // Drawing canvas
  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    drawCtxRef.current = ctx

    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      canvas.width = rect.width
      canvas.height = rect.height
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      redrawDrawings()
    }

    const redrawDrawings = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const data = drawData[current]
      if (!data) return
      data.forEach(stroke => {
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.size
        ctx.beginPath()
        stroke.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        })
        ctx.stroke()
      })
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [drawData, current])

  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas || !drawMode) return
    const ctx = drawCtxRef.current
    let drawing = false

    const getPos = (e) => {
      const rect = containerRef.current.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      return { x: clientX - rect.left, y: clientY - rect.top }
    }

    const onMouseDown = (e) => {
      if (!drawMode) return
      drawing = true
      const pos = getPos(e)
      setDrawData(prev => {
        const d = { ...prev }
        d[current] = [...(d[current] || []), { color: '#ff4444', size: 4, points: [pos] }]
        return d
      })
      ctx.strokeStyle = '#ff4444'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }

    const onMouseMove = (e) => {
      if (!drawing || !drawMode) return
      const pos = getPos(e)
      setDrawData(prev => {
        const d = { ...prev }
        const strokes = [...(d[current] || [])]
        const s = { ...strokes[strokes.length - 1], points: [...strokes[strokes.length - 1].points, pos] }
        strokes[strokes.length - 1] = s
        d[current] = strokes
        return d
      })
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
    }

    const onMouseUp = () => { drawing = false; ctx.beginPath() }

    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('mouseleave', onMouseUp)
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mouseleave', onMouseUp)
    }
  }, [drawMode, current, setDrawData])

  // Laser
  useEffect(() => {
    const canvas = laserCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    laserCtxRef.current = ctx

    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      canvas.width = rect.width
      canvas.height = rect.height
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (!laserMode) {
      const ctx = laserCtxRef.current
      if (ctx && laserCanvasRef.current) ctx.clearRect(0, 0, laserCanvasRef.current.width, laserCanvasRef.current.height)
      laserPointsRef.current = []
      if (laserRafRef.current) { cancelAnimationFrame(laserRafRef.current); laserRafRef.current = null }
      return
    }

    const drawTrail = (now) => {
      const canvas = laserCanvasRef.current
      const ctx = laserCtxRef.current
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const points = laserPointsRef.current.filter(p => now - p.time < 1500)

      if (points.length < 2) {
        if (points.length === 1) {
          ctx.beginPath(); ctx.arc(points[0].x, points[0].y, 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,68,68,0.9)'; ctx.fill()
        }
        laserRafRef.current = requestAnimationFrame(drawTrail)
        return
      }

      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1], p1 = points[i]
        const age = now - p1.time
        const opacity = Math.max(0, 1 - age / 1500)
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y)
        ctx.strokeStyle = 'rgba(255,68,68,' + opacity + ')'
        ctx.lineWidth = Math.max(1, 5 * opacity)
        ctx.stroke()
      }

      const last = points[points.length - 1]
      const grad = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 12)
      grad.addColorStop(0, 'rgba(255,68,68,0.95)')
      grad.addColorStop(0.3, 'rgba(255,68,68,0.5)')
      grad.addColorStop(1, 'rgba(255,68,68,0)')
      ctx.beginPath(); ctx.arc(last.x, last.y, 12, 0, Math.PI * 2)
      ctx.fillStyle = grad; ctx.fill()
      ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,68,68,1)'; ctx.fill()

      laserRafRef.current = requestAnimationFrame(drawTrail)
    }

    const onMouseDown = (e) => {
      const rect = containerRef.current.getBoundingClientRect()
      laserPointsRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, time: performance.now() })
      if (!laserRafRef.current) laserRafRef.current = requestAnimationFrame(drawTrail)
    }

    const onMouseMove = (e) => {
      if (!e.buttons) return
      const rect = containerRef.current.getBoundingClientRect()
      laserPointsRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, time: performance.now() })
      if (!laserRafRef.current) laserRafRef.current = requestAnimationFrame(drawTrail)
    }

    const onMouseUp = () => {
      laserPointsRef.current = []
      const ctx = laserCtxRef.current
      if (ctx && laserCanvasRef.current) ctx.clearRect(0, 0, laserCanvasRef.current.width, laserCanvasRef.current.height)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (laserRafRef.current) cancelAnimationFrame(laserRafRef.current)
    }
  }, [laserMode])

  const handleContainerClick = useCallback((e) => {
    if (e.target.closest('.nav-arrow') || e.target.closest('.dot')) return
    const shapeEl = e.target.closest('.shape')
    if (shapeEl) return
    const wrap = e.target.closest('.slide-img-wrap')
    if (wrap) {
      document.querySelectorAll('.slide-img-wrap.selected').forEach(el => el.classList.remove('selected'))
      wrap.classList.add('selected')
      return
    }
    setSelectedShapeId(null)
    document.querySelectorAll('.slide-img-wrap.selected').forEach(el => el.classList.remove('selected'))
    document.querySelectorAll('.slide-url-bar.show').forEach(el => el.classList.remove('show'))
  }, [])

  const handleContextMenu = useCallback((e) => {
    const slideEl = e.target.closest('.slide')
    if (!slideEl) return
    e.preventDefault()
    const shapeEl = e.target.closest('.shape')
    if (shapeEl) {
      const slideIdx = parseInt(slideEl.dataset.slide)
      const shapeId = shapeEl.dataset.shapeId
      const shapes = slideShapes[slideIdx] || []
      const shape = shapes.find(s => s.id === shapeId)
      if (shape) {
        setSelectedShapeId(shapeId)
        setCtxShapeData({ slideIdx, shapeId, shape })
        setCtxShapeMenuPos({ x: e.clientX, y: e.clientY })
      }
    } else {
      setCtxSlideIdx(parseInt(slideEl.dataset.slide))
      setCtxMenuPos({ x: e.clientX, y: e.clientY })
    }
  }, [slideShapes])

  const handleAddShape = useCallback((type) => {
    if (type === 'line' || type === 'arrow') {
      setLineDrawState({ type, active: false })
      setSelectedShapeId(null)
      setShapePopupOpen(false)
      return
    }
    setSlideShapes(prev => {
      const s = { ...prev }
      const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      s[current] = [...(s[current] || []), { id, ...getDefaultShape(type) }]
      return s
    })
    setShapePopupOpen(false)
    setTimeout(() => save(), 0)
  }, [current, setSlideShapes, save])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="slideshow-container" id="slideshow">
        <div className="skeleton-slide" id="skeletonSlide">
          <div className="skeleton-slide-box">
            <div className="skeleton-slide-circle"></div>
            <div className="skeleton-slide-line"></div>
            <div className="skeleton-slide-line"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Sidebar />
      <button className="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar"
        onClick={() => setSidebarCollapsed(c => !c)}>&#9776;</button>

      <div className="main-area">
        <div className="slideshow-container" id="slideshow" ref={containerRef}
          onClick={handleContainerClick} onContextMenu={handleContextMenu}>

          {slides.map((_, i) => {
            const bgColor = slideBgColors[i]
            return (
              <div key={i} className={'slide' + (i === current ? ' active' : '')}
                data-slide={i}
                style={bgColor ? { backgroundColor: bgColor } : {}}
                onDragOver={e => { if (!fullscreen) { e.preventDefault(); e.currentTarget.classList.add('drag-over') } }}
                onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                onDrop={async (e) => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('drag-over')
                  const file = e.dataTransfer.files[0]
                  if (file && file.type.startsWith('image/')) {
                    try {
                      const serverUrl = await uploadImage(file)
                      setSlideUrls(prev => ({ ...prev, [i]: serverUrl }))
                      setResizeData(prev => { const n = { ...prev }; delete n[i]; return n })
                      setTimeout(() => save(), 0)
                    } catch (_) { showToast('Failed to upload dropped image') }
                  }
                }}>
                <SlideImage slideIndex={i} />
                <div className="fallback-msg" style={{ display: slideUrls[i] ? 'none' : '' }}>
                  <div className="fallback-box">
                    <div className="fb-num">{slideNames[i] || 'Slide Number ' + (i + 1)}</div>
                    <div className="fb-label">Import image or paste from clipboard</div>
                  </div>
                </div>
                <div className={'slide-url-bar' + (showUrlBarFor === i ? ' show' : '')}>
                  <input type="text" placeholder="/api/image/..." spellCheck="false"
                    value={showUrlBarFor === i ? urlBarValue : ''}
                    onChange={e => setUrlBarValue(e.target.value)}
                    ref={showUrlBarFor === i ? urlBarRef : null}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const val = urlBarValue.trim()
                        if (val) {
                          setSlideUrls(prev => ({ ...prev, [i]: val }))
                          setResizeData(prev => { const n = { ...prev }; delete n[i]; return n })
                          setTimeout(() => save(), 0)
                        }
                        setShowUrlBarFor(null)
                      }
                      if (e.key === 'Escape') setShowUrlBarFor(null)
                    }} />
                  <button onClick={() => {
                    const val = urlBarValue.trim()
                    if (val) {
                      setSlideUrls(prev => ({ ...prev, [i]: val }))
                      setResizeData(prev => { const n = { ...prev }; delete n[i]; return n })
                      setTimeout(() => save(), 0)
                    }
                    setShowUrlBarFor(null)
                  }}>Apply</button>
                </div>
                <span className="slide-label">{slideNames[i] || 'Slide ' + (i + 1)}</span>
                <span className="slide-number">{i + 1} / {slides.length}</span>
                <ShapeLayer slideIndex={i} />
              </div>
            )
          })}

          <Navigation />

          <canvas id="laserCanvas" ref={laserCanvasRef}
            style={{ position: 'absolute', inset: 0, zIndex: 200, pointerEvents: laserMode ? 'auto' : 'none' }} />
          <canvas className={'draw-canvas' + (drawMode ? ' active' : '')} id="drawCanvas" ref={drawCanvasRef}
            style={{ position: 'absolute', inset: 0, zIndex: 100, pointerEvents: drawMode ? 'auto' : 'none' }} />

          {drawMode && (
            <div className="draw-toolbar show">
              <span className="draw-label">Draw</span>
              <input type="color" id="drawColor" defaultValue="#ff4444" />
              <input type="range" id="drawSize" min="1" max="20" defaultValue="4" />
              <span className="draw-size-label" id="drawSizeLabel">4</span>
              <button onClick={() => {
                setDrawData(prev => {
                  const d = { ...prev }
                  if (d[current] && d[current].length > 0) {
                    d[current] = d[current].slice(0, -1)
                  }
                  return d
                })
              }}>Undo</button>
              <button onClick={() => {
                setDrawData(prev => { const d = { ...prev }; delete d[current]; return d })
              }}>Erase</button>
              <button onClick={() => setDrawMode(false)}>Done</button>
            </div>
          )}

          {selectedShapeId != null && (
            <ShapeProps selectedShapeId={selectedShapeId} slideIndex={current}
              onClose={() => setSelectedShapeId(null)} />
          )}

          <button id="shapeFloatBtn" title="Add shape" onClick={() => setShapePopupOpen(p => !p)}>+</button>
          {shapePopupOpen && (
            <div className="shape-popup show">
              {['rect', 'circle', 'line', 'arrow', 'text', 'image'].map(type => (
                <button key={type} className="shape-popup-btn" onClick={() => handleAddShape(type)}>
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    {type === 'rect' && <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"/>}
                    {type === 'circle' && <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>}
                    {type === 'line' && <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="2"/>}
                    {type === 'arrow' && <><line x1="3" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/><polyline points="14 7 19 12 14 17" fill="none" stroke="currentColor" strokeWidth="2"/></>}
                    {type === 'text' && <><polyline points="4 7 4 4 20 4 20 7" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="9" y1="20" x2="15" y2="20" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="2"/></>}
                    {type === 'image' && <><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="2"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" strokeWidth="2"/></>}
                  </svg>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      {presenterMode && (
        <div id="presenterPanel" className="show">
          <div className="presenter-notes-wrap">
            <label htmlFor="presenterNotes">Speaker Notes</label>
            <textarea id="presenterNotes" placeholder="Notes for this slide..."
              defaultValue={slideNotes[current] || ''}
              onChange={(e) => {
                const val = e.target.value.trim()
                if (val) setSlideNotes(prev => ({ ...prev, [current]: val }))
                else setSlideNotes(prev => { const n = { ...prev }; delete n[current]; return n })
              }}
              onBlur={() => setTimeout(() => save(), 800)} />
          </div>
          <div className="presenter-timer-wrap">
            <div id="presenterTimer">00:00</div>
            <div className="presenter-timer-btns">
              <button id="presenterTimerStart">&#9654;</button>
              <button id="presenterTimerReset">&#8634;</button>
            </div>
          </div>
          <div className="presenter-next-wrap">
            <label>Up Next</label>
            <div id="presenterNextPreview" />
            <div className="presenter-next-label" id="presenterNextLabel" />
          </div>
        </div>
      )}

      <button className="settings-btn" id="settingsBtn" aria-label="Settings"
        onClick={() => setSettingsVisible(true)}>&#9881;</button>
      <button className="fullscreen-btn" id="fullscreenBtn" aria-label="Toggle fullscreen"
        onClick={toggleFullscreen}>
        {fullscreen
          ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
          : '\u26F6'}
      </button>
      <button className={'fullscreen-btn' + (laserMode ? ' active' : '')} id="laserToggleBtn"
        aria-label="Toggle laser pointer" style={laserMode ? { background: 'rgba(99,102,241,0.3)', borderColor: '#6366f1' } : {}}
        onClick={() => { if (!fullscreen) return; if (!laserMode && drawMode) setDrawMode(false); setLaserMode(!laserMode) }}>
        &#9673;
      </button>
      <button className={'fullscreen-btn' + (drawMode ? ' active' : '')} id="drawToggleBtn"
        aria-label="Toggle drawing" style={drawMode ? { background: 'rgba(99,102,241,0.3)', borderColor: '#6366f1' } : {}}
        onClick={() => { if (!drawMode && laserMode) setLaserMode(false); setDrawMode(!drawMode) }}>
        &#9998;
      </button>
      <button className={'fullscreen-btn' + (presenterMode ? ' active' : '')} id="presenterBtn"
        aria-label="Toggle presenter mode" style={presenterMode ? { background: 'rgba(99,102,241,0.3)', borderColor: '#6366f1' } : {}}
        onClick={() => { if (!fullscreen) return; setPresenterMode(!presenterMode) }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </button>

      <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />

      {ctxMenuPos && (
        <div className="ctx-menu show" style={{ left: ctxMenuPos.x + 'px', top: ctxMenuPos.y + 'px' }}
          onClick={e => e.stopPropagation()}>
          <div className="ctx-item" onClick={() => {
            const idx = ctxSlideIdx
            if (idx < 0) return
            setShowUrlBarFor(idx)
            setUrlBarValue(slideUrls[idx] || '')
            setTimeout(() => { urlBarRef.current?.focus(); urlBarRef.current?.select() }, 50)
            setCtxMenuPos(null)
          }}>Set Image URL</div>
          <div className="ctx-item" onClick={() => {
            const idx = ctxSlideIdx; if (idx < 0 || !slideUrls[idx]) return
            setSlideUrls(prev => { const n = { ...prev }; delete n[idx]; return n })
            setResizeData(prev => { const n = { ...prev }; delete n[idx]; return n })
            setTimeout(() => save(), 0)
            setCtxMenuPos(null)
          }}>Remove Image</div>
          <div className="ctx-item" onClick={() => { duplicateSlide(ctxSlideIdx); setCtxMenuPos(null) }}>Duplicate Slide</div>
          <div className="ctx-divider"></div>
          <div className="ctx-item ctx-sub">Fit Mode</div>
          <div className="ctx-submenu show" id="ctxFitSub">
            {['cover', 'contain', 'fill', 'original'].map(m => (
              <div key={m} className="ctx-item" onClick={() => {
                const idx = ctxSlideIdx; if (idx < 0 || !slideUrls[idx]) return
                setSlideMode(prev => ({ ...prev, [idx]: m }))
                setTimeout(() => save(), 0)
                setCtxMenuPos(null)
              }}>{m.charAt(0).toUpperCase() + m.slice(1)}</div>
            ))}
          </div>
          <div className="ctx-divider"></div>
          <div className="ctx-item" onClick={() => {
            const idx = ctxSlideIdx; if (idx < 0 || !slideUrls[idx]) return
            navigator.clipboard.writeText(slideUrls[idx]).catch(() => {})
            setCtxMenuPos(null)
          }}>Copy Image URL</div>
          <div className="ctx-item" onClick={() => {
            navigator.clipboard.read().then(items => {
              for (const ci of items) {
                for (const type of ci.types) {
                  if (type.startsWith('image/')) {
                    ci.getType(type).then(async blob => {
                      try {
                        const url = await uploadImage(blob)
                        setSlideUrls(prev => ({ ...prev, [ctxSlideIdx]: url }))
                        setTimeout(() => save(), 0)
                      } catch (_) { showToast('Failed to paste image') }
                    })
                    return
                  }
                }
              }
            }).catch(() => {})
            setCtxMenuPos(null)
          }}>Paste Image</div>
          <div className="ctx-item" id="slidePasteItem"
            style={{ display: shapeClipboardRef.current ? '' : 'none' }}
            onClick={() => {
              if (!shapeClipboardRef.current) return
              const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
              const ps = JSON.parse(JSON.stringify(shapeClipboardRef.current))
              ps.id = newId; ps.x = parseFloat(ps.x) + 2 + '%'; ps.y = parseFloat(ps.y) + 2 + '%'
              setSlideShapes(prev => {
                const s = { ...prev }; s[ctxSlideIdx] = [...(s[ctxSlideIdx] || []), ps]; return s
              })
              setTimeout(() => save(), 0)
              setCtxMenuPos(null)
            }}>Paste Shape</div>
        </div>
      )}

      {ctxShapeMenuPos && (
        <div className="ctx-menu show" id="ctxShapeMenu"
          style={{ left: ctxShapeMenuPos.x + 'px', top: ctxShapeMenuPos.y + 'px' }}
          onClick={e => e.stopPropagation()}>
          <div className="ctx-item" onClick={() => {
            if (ctxShapeData) { shapeClipboardRef.current = JSON.parse(JSON.stringify(ctxShapeData.shape)); showToast('Shape copied', 'success') }
            setCtxShapeMenuPos(null)
          }}>Copy</div>
          <div className="ctx-item" onClick={() => {
            if (ctxShapeData) {
              shapeClipboardRef.current = JSON.parse(JSON.stringify(ctxShapeData.shape))
              const { slideIdx, shapeId } = ctxShapeData
              setSlideShapes(prev => {
                const s = { ...prev }
                s[slideIdx] = (s[slideIdx] || []).filter(sh => sh.id !== shapeId)
                return s
              })
              setSelectedShapeId(null)
              setTimeout(() => save(), 0)
              showToast('Shape cut', 'success')
            }
            setCtxShapeMenuPos(null)
          }}>Cut</div>
          <div className="ctx-item" id="shapePasteItem"
            style={{ display: shapeClipboardRef.current ? '' : 'none' }}
            onClick={() => {
              if (!shapeClipboardRef.current || !ctxShapeData) return
              const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
              const ps = JSON.parse(JSON.stringify(shapeClipboardRef.current))
              ps.id = newId; ps.x = parseFloat(ps.x) + 2 + '%'; ps.y = parseFloat(ps.y) + 2 + '%'
              const { slideIdx } = ctxShapeData
              setSlideShapes(prev => {
                const s = { ...prev }; s[slideIdx] = [...(s[slideIdx] || []), ps]; return s
              })
              setTimeout(() => save(), 0)
              setCtxShapeMenuPos(null)
            }}>Paste</div>
          <div className="ctx-divider"></div>
          <div className="ctx-item" onClick={() => {
            if (!ctxShapeData) return
            const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
            const dup = JSON.parse(JSON.stringify(ctxShapeData.shape))
            dup.id = newId; dup.x = parseFloat(dup.x) + 2 + '%'; dup.y = parseFloat(dup.y) + 2 + '%'
            const { slideIdx } = ctxShapeData
            setSlideShapes(prev => {
              const s = { ...prev }; s[slideIdx] = [...(s[slideIdx] || []), dup]; return s
            })
            setTimeout(() => save(), 0)
            setCtxShapeMenuPos(null)
          }}>Duplicate</div>
          <div className="ctx-item" onClick={() => {
            if (!ctxShapeData) return
            const { slideIdx, shapeId } = ctxShapeData
            setSlideShapes(prev => {
              const s = { ...prev }
              s[slideIdx] = (s[slideIdx] || []).filter(sh => sh.id !== shapeId)
              return s
            })
            setSelectedShapeId(null)
            setTimeout(() => save(), 0)
            setCtxShapeMenuPos(null)
          }}>Delete</div>
        </div>
      )}

      <div className="upload-loading" id="uploadLoading"><div className="spinner"></div></div>
    </>
  )
}

export default function SlideshowPage() {
  return (
    <SlideshowProvider>
      <SlideshowEditor />
    </SlideshowProvider>
  )
}
