import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react'
import { useSearchParams,useNavigate  } from 'react-router-dom'
import { SlideshowProvider, useSlideshow } from '../context/SlideshowContext'
import { useToast } from '../components/Toast'
import { resolveUrl, uploadImage, fetchShapeLibrary, saveShapeToLibrary as apiSaveShape, deleteShapeFromLibrary, fetchTemplates, saveTemplateToDb, deleteTemplateFromDb } from '../api'
import Sidebar from '../components/Sidebar'
import SlideImage from '../components/SlideImage'
import ShapeLayer from '../components/ShapeLayer'
import ShapeProps from '../components/ShapeProps'
import Navigation from '../components/Navigation'
import SettingsModal from '../components/SettingsModal'
import PromptDialog from '../components/PromptDialog'
import { getDefaultShape } from '../utils'
import '../styles/slideshow.css'


function SlideshowEditor() {
  const navigate = useNavigate()
  const showToast = useToast()
  const [searchParams] = useSearchParams()
  const deckParam = searchParams.get('deck')

  const {
    deckName, slides, current,
    slideUrls, setSlideUrls, resizeData, setResizeData,
    slideMode, setSlideMode, slideNames, setSlideNames,
    slideBgColors, setSlideBgColors, slideNotes, setSlideNotes,
    slideShapes, setSlideShapes, loading,
    drawData, setDrawData, drawDataRef,
    loadDeck, save, goTo, next, prev,
    duplicateSlide,
    shapeLibrary, setShapeLibrary,
    slideTemplates, setSlideTemplates
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
  const notesRef = useRef(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const timerIntervalRef = useRef(null)
  const [urlBarValue, setUrlBarValue] = useState('')
  const urlBarRef = useRef(null)
  const [ctxMenuPos, setCtxMenuPos] = useState(null)
  const [ctxShapeMenuPos, setCtxShapeMenuPos] = useState(null)
  const [ctxSlideIdx, setCtxSlideIdx] = useState(-1)
  const [ctxShapeData, setCtxShapeData] = useState(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [shortcutsVisible, setShortcutsVisible] = useState(false)
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [showShapeLibrary, setShowShapeLibrary] = useState(false)
  const [saveShapeDialogOpen, setSaveShapeDialogOpen] = useState(false)
  const [drawColor, setDrawColor] = useState('#ff4444')
  const [drawSize, setDrawSize] = useState(4)
  const drawColorRef = useRef('#ff4444')
  const drawSizeRef = useRef(4)
  const drawCanvasRef = useRef(null)
  const drawCtxRef = useRef(null)
  const laserCanvasRef = useRef(null)
  const laserCtxRef = useRef(null)
  const laserPointsRef = useRef([])
  const laserRafRef = useRef(null)
  const shapeClipboardRef = useRef(null)
  const currentRef = useRef(current)
  useEffect(() => { currentRef.current = current })
  const saveRef = useRef(save)
  useLayoutEffect(() => { saveRef.current = save })

  useEffect(() => {
    const name = deckParam || localStorage.getItem('deckName') || 'Default'
    if (deckParam) localStorage.setItem('deckName', name)
    loadDeck(name)
    fetchShapeLibrary().then(s => setShapeLibrary(s)).catch(() => {})
    fetchTemplates().then(t => setSlideTemplates(t)).catch(() => {})
  }, [deckParam])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (settingsVisible) {
        if (e.key === 'Escape') { e.preventDefault(); setSettingsVisible(false) }
        return
      }
      const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'PageUp', 'PageDown', ' ']
      const isInPresenterNotes = document.activeElement?.id === 'presenterNotes'
      const isContentEditable = document.activeElement?.isContentEditable
      if (isInPresenterNotes) return
      if (isContentEditable) {
        if (navKeys.includes(e.key) || e.key === 'Delete' || e.key === 'Backspace') return
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev() }
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'Home' && !isContentEditable) { e.preventDefault(); goTo(0) }
      if (e.key === 'End' && !isContentEditable) { e.preventDefault(); goTo(slides.length - 1) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); /* undo delete image */ }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (!selectedShapeId) return
        const shapes = slideShapes[current] || []
        const shape = shapes.find(s => s.id === selectedShapeId)
        if (shape) { shapeClipboardRef.current = JSON.parse(JSON.stringify(shape)); showToast('Shape copied', 'success') }
        e.preventDefault()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (!shapeClipboardRef.current) return
        const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
        const ps = JSON.parse(JSON.stringify(shapeClipboardRef.current))
        ps.id = newId; ps.x = parseFloat(ps.x) + 2 + '%'; ps.y = parseFloat(ps.y) + 2 + '%'
        if (ps.ex) ps.ex = parseFloat(ps.ex) + 2 + '%'
        if (ps.ey) ps.ey = parseFloat(ps.ey) + 2 + '%'
        setSlideShapes(prev => { const s = { ...prev }; s[current] = [...(s[current] || []), ps]; return s })
        setSelectedShapeId(newId)
        setTimeout(() => saveRef.current(), 0)
        showToast('Shape pasted', 'success')
        e.preventDefault()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateSlide(current) }
      if (e.key === 'Escape') {
        setCtxMenuPos(null); setCtxShapeMenuPos(null)
        if (lineDrawState) setLineDrawState(null)
        setShapePopupOpen(false)
        setShortcutsVisible(false)
      }
      if (e.key === '?' && !settingsVisible && !isInPresenterNotes && !isContentEditable) { e.preventDefault(); setShortcutsVisible(v => !v) }
      if ((e.key === 'l' || e.key === 'L') && fullscreen) { e.preventDefault(); if (!laserMode && drawMode) setDrawMode(false); setLaserMode(!laserMode) }
      if ((e.key === 'p' || e.key === 'P') && fullscreen) { e.preventDefault(); setPresenterMode(!presenterMode) }
      if ((e.key === 'd' || e.key === 'D') && fullscreen) { e.preventDefault(); if (!drawMode && laserMode) setLaserMode(false); setDrawMode(!drawMode) }
      if (e.key === 'F5') {
        e.preventDefault()
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [settingsVisible, slides.length, current, fullscreen, laserMode, drawMode, presenterMode, prev, next, goTo, lineDrawState, duplicateSlide, slideShapes, selectedShapeId, setSlideShapes, showToast, setSelectedShapeId, shortcutsVisible])

  useEffect(() => {
    const onMouseDown = (e) => {
      if (ctxMenuPos || ctxShapeMenuPos) {
        if (!e.target.closest('.ctx-menu')) {
          setCtxMenuPos(null)
          setCtxShapeMenuPos(null)
        }
      }
      if (shapePopupOpen && !e.target.closest('.shape-popup') && !e.target.closest('#shapeFloatBtn')) {
        setShapePopupOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [ctxMenuPos, ctxShapeMenuPos, shapePopupOpen])

  useEffect(() => {
    const onFullscreenChange = () => {
      const isFull = !!document.fullscreenElement
      setFullscreen(isFull)
      if (isFull) { setSidebarCollapsed(true) }
      if (!isFull) {
        setSidebarCollapsed(false); setDrawMode(false); setLaserMode(false); setPresenterMode(false)
        const canvas = drawCanvasRef.current
        if (canvas) {
          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        setDrawData(prev => { const d = { ...prev }; delete d[currentRef.current]; return d })
        setTimeout(() => saveRef.current(), 0)
      }
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
        setTimeout(() => saveRef.current(), 0)
      } catch (_) { showToast('Failed to paste image') }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [current, setSlideUrls, setResizeData, save, showToast])

  useEffect(() => { setSelectedShapeId(null) }, [current])

  // Timer interval
  useEffect(() => {
    if (!timerRunning) { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null } return }
    timerIntervalRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    return () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null } }
  }, [timerRunning])

  // Sync notes textarea when slide changes
  useEffect(() => {
    if (notesRef.current) notesRef.current.value = slideNotes[current] || ''
  }, [current, slideNotes])

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
      const cw = canvas.width, ch = canvas.height
      data.forEach(stroke => {
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.size
        ctx.beginPath()
        stroke.points.forEach((p, i) => {
          const x = p.x / 100 * cw, y = p.y / 100 * ch
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      })
    }

    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [drawData, current, fullscreen])

  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas || !drawMode) return
    const ctx = drawCtxRef.current
    let drawing = false

    const getPos = (e) => {
      const rect = containerRef.current.getBoundingClientRect()
      const clientX = e.touches ? e.touches[0].clientX : e.clientX
      const clientY = e.touches ? e.touches[0].clientY : e.clientY
      return { x: (clientX - rect.left) / rect.width * 100, y: (clientY - rect.top) / rect.height * 100 }
    }

    const toPx = (pct, dim) => pct / 100 * dim

    const onMouseDown = (e) => {
      if (!drawMode) return
      drawing = true
      const pos = getPos(e)
      setDrawData(prev => {
        const d = { ...prev }
        d[current] = [...(d[current] || []), { color: drawColorRef.current, size: drawSizeRef.current, points: [pos] }]
        return d
      })
      ctx.strokeStyle = drawColorRef.current
      ctx.lineWidth = drawSizeRef.current
      ctx.beginPath()
      ctx.moveTo(toPx(pos.x, canvas.width), toPx(pos.y, canvas.height))
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
      ctx.lineTo(toPx(pos.x, canvas.width), toPx(pos.y, canvas.height))
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(toPx(pos.x, canvas.width), toPx(pos.y, canvas.height))
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
  }, [fullscreen])

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
    if (e.target.closest('.shape-props')) return
    if (e.target.closest('.shape-popup')) return
    if (e.target.closest('.ctx-menu')) return
    const shapeEl = e.target.closest('.shape')
    if (shapeEl) {
      document.querySelectorAll('.slide-img-wrap.selected').forEach(el => el.classList.remove('selected'))
      return
    }
    if (e.target.closest('.slide-img-wrap')) {
      setSelectedShapeId(null)
      setCtxMenuPos(null)
      setCtxShapeMenuPos(null)
      return
    }
    setCtxMenuPos(null)
    setCtxShapeMenuPos(null)
    setSelectedShapeId(null)
    document.querySelectorAll('.slide-img-wrap.selected').forEach(el => el.classList.remove('selected'))
    document.querySelectorAll('.slide-url-bar.show').forEach(el => el.classList.remove('show'))
    const slideEl = e.target.closest('.slide')
    if (slideEl) {
      const idx = parseInt(slideEl.dataset.slide)
      if (!isNaN(idx) && slideUrls[idx]) {
        const wrap = slideEl.querySelector('.slide-img-wrap')
        if (wrap) wrap.classList.add('selected')
      }
    }
  }, [slideUrls])

  const handleContainerMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    if (fullscreen) return
    if (e.target.closest('.shape') || e.target.closest('.nav-arrow') ||
        e.target.closest('.dot') || e.target.closest('.shape-props') ||
        e.target.closest('.ctx-menu') || e.target.closest('.img-props')) return
    const slideEl = e.target.closest('.slide')
    if (!slideEl || !slideEl.classList.contains('active')) return
    if (!slideUrls[current]?.trim()) return
    const wrap = slideEl.querySelector('.slide-img-wrap')
    if (!wrap || !wrap.classList.contains('selected')) return
    const handles = wrap.querySelectorAll('.resize-handle')
    for (const handle of handles) {
      const r = handle.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top && e.clientY <= r.bottom) {
        const ev = new MouseEvent('mousedown', {
          clientX: e.clientX, clientY: e.clientY,
          bubbles: true, cancelable: true, view: window
        })
        handle.dispatchEvent(ev)
        return
      }
    }
    const ev = new MouseEvent('mousedown', {
      clientX: e.clientX, clientY: e.clientY,
      bubbles: true, cancelable: true, view: window
    })
    wrap.dispatchEvent(ev)
  }, [current, slideUrls, fullscreen])

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
    const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    setSlideShapes(prev => {
      const s = { ...prev }
      s[current] = [...(s[current] || []), { id, ...getDefaultShape(type) }]
      return s
    })
    setSelectedShapeId(id)
    setShapePopupOpen(false)
    setTimeout(() => saveRef.current(), 0)
  }, [current, setSlideShapes, save])

  const parsePct = (v) => parseFloat(v) || 0

  const handleAlignShape = useCallback((dir, slideIdx, shape) => {
    if (!shape || shape.type === 'line' || shape.type === 'arrow') return
    const w = parsePct(shape.w)
    const h = parsePct(shape.h)
    let updates = {}
    switch (dir) {
      case 'left': updates.x = '0%'; break
      case 'center': updates.x = ((100 - w) / 2) + '%'; break
      case 'right': updates.x = (100 - w) + '%'; break
      case 'top': updates.y = '0%'; break
      case 'middle': updates.y = ((100 - h) / 2) + '%'; break
      case 'bottom': updates.y = (100 - h) + '%'; break
    }
    setSlideShapes(prev => {
      const s = { ...prev }
      const arr = [...(s[slideIdx] || [])]
      const idx = arr.findIndex(sh => sh.id === shape.id)
      if (idx >= 0) { arr[idx] = { ...arr[idx], ...updates }; s[slideIdx] = arr }
      return s
    })
    setTimeout(() => saveRef.current(), 0)
  }, [setSlideShapes, save])

  const handleDistribute = useCallback((dir, slideIdx) => {
    const shapes = (slideShapes[slideIdx] || []).filter(s => s.type !== 'line' && s.type !== 'arrow')
    if (shapes.length < 2) return
    const sorted = [...shapes].sort((a, b) => dir === 'h' ? parsePct(a.x) - parsePct(b.x) : parsePct(a.y) - parsePct(b.y))
    const totalSize = sorted.reduce((sum, s) => sum + (dir === 'h' ? parsePct(s.w) : parsePct(s.h)), 0)
    const gap = (100 - totalSize) / (sorted.length - 1)
    let pos = 0
    const updates = {}
    sorted.forEach((s, i) => {
      updates[s.id] = dir === 'h' ? { x: pos + '%' } : { y: pos + '%' }
      pos += (dir === 'h' ? parsePct(s.w) : parsePct(s.h)) + gap
    })
    setSlideShapes(prev => {
      const s = { ...prev }
      s[slideIdx] = (s[slideIdx] || []).map(sh => updates[sh.id] ? { ...sh, ...updates[sh.id] } : sh)
      return s
    })
    setTimeout(() => saveRef.current(), 0)
  }, [slideShapes, setSlideShapes, save])

  const saveTemplate = useCallback(async (name, slideIdx) => {
    const templates = { ...slideTemplates }
    const data = {
      shapes: JSON.parse(JSON.stringify(slideShapes[slideIdx] || [])),
      bgColor: slideBgColors[slideIdx] || null,
      imageUrl: slideUrls[slideIdx] || null,
      imageMode: slideMode[slideIdx] || null,
      resizeData: resizeData[slideIdx] ? { ...resizeData[slideIdx] } : null
    }
    templates[name] = data
    setSlideTemplates(templates)
    try { await saveTemplateToDb(name, data) } catch {}
    showToast('Template saved', 'success')
  }, [slideShapes, slideBgColors, slideUrls, slideMode, resizeData, slideTemplates, setSlideTemplates, showToast])

  const applyTemplate = useCallback((name, slideIdx) => {
    const tmpl = slideTemplates[name]
    if (!tmpl) return
    setSlideShapes(prev => {
      const s = { ...prev }
      const existing = s[slideIdx] || []
      s[slideIdx] = [...existing, ...(tmpl.shapes || []).map(sh => ({
        ...sh, id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      }))]
      return s
    })
    if (tmpl.bgColor) setSlideBgColors(prev => ({ ...prev, [slideIdx]: tmpl.bgColor }))
    if (tmpl.imageUrl) {
      setSlideUrls(prev => ({ ...prev, [slideIdx]: tmpl.imageUrl }))
      if (tmpl.imageMode) setSlideMode(prev => ({ ...prev, [slideIdx]: tmpl.imageMode }))
      if (tmpl.resizeData) setResizeData(prev => ({ ...prev, [slideIdx]: tmpl.resizeData }))
    }
    setTimeout(() => saveRef.current(), 0)
    showToast('Template applied', 'success')
  }, [slideTemplates, setSlideShapes, setSlideBgColors, setSlideUrls, setSlideMode, setResizeData, save, showToast])

  const deleteTemplate = useCallback(async (name) => {
    const templates = { ...slideTemplates }
    delete templates[name]
    setSlideTemplates(templates)
    try { await deleteTemplateFromDb(name) } catch {}
  }, [slideTemplates, setSlideTemplates])

  const saveShapeToLibrary = useCallback(async (name) => {
    if (!ctxShapeData) return
    const data = JSON.parse(JSON.stringify({ ...ctxShapeData.shape, id: undefined }))
    const existing = { ...shapeLibrary }
    existing[name] = data
    setShapeLibrary(existing)
    try { await apiSaveShape(name, data) } catch {}
    showToast('Shape saved to library', 'success')
  }, [ctxShapeData, shapeLibrary, setShapeLibrary, showToast])

  const insertFromLibrary = useCallback((name) => {
    const shape = shapeLibrary[name]
    if (!shape) return
    const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    setSlideShapes(prev => {
      const s = { ...prev }
      s[current] = [...(s[current] || []), { ...JSON.parse(JSON.stringify(shape)), id }]
      return s
    })
    setSelectedShapeId(id)
    setTimeout(() => saveRef.current(), 0)
    setShowShapeLibrary(false)
    showToast('Shape inserted', 'success')
  }, [shapeLibrary, current, setSlideShapes, save, showToast])

  const deleteFromLibrary = useCallback(async (name) => {
    const existing = { ...shapeLibrary }
    delete existing[name]
    setShapeLibrary(existing)
    try { await deleteShapeFromLibrary(name) } catch {}
  }, [shapeLibrary, setShapeLibrary])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (loading) {
    return (
      <div className="slideshow-page">
        <div className="sidebar" id="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-header-left">
              <div className="skeleton" style={{ width: 18, height: 18, borderRadius: '4px' }}></div>
              <div className="skeleton" style={{ width: 100, height: 14, borderRadius: '4px', marginLeft: 8 }}></div>
              <div className="skeleton" style={{ width: 24, height: 14, borderRadius: '4px', marginLeft: 6 }}></div>
            </div>
          </div>
          <div class="sidebar-thumbnails" id="thumbnails">
            <div class="skeleton skeleton-thumb" id="skeletonThumb1"><div class="skeleton skeleton-thumb-box"></div><div class="skeleton skeleton-thumb-line"></div></div>
            <div class="skeleton skeleton-thumb" id="skeletonThumb2"><div class="skeleton skeleton-thumb-box"></div><div class="skeleton skeleton-thumb-line short"></div></div>
            <div class="skeleton skeleton-thumb" id="skeletonThumb3"><div class="skeleton skeleton-thumb-box"></div><div class="skeleton skeleton-thumb-line"></div></div>
          </div>
          {/* <div className="sidebar-thumbnails"> */}
            {/* {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton-thumb">
                <div className="skeleton-thumb-box"></div>
                <div className="skeleton-thumb-line"></div>
              </div>
            ))} */}
          {/* </div> */}
        </div>
        <div className="main-area">
          <div className="slideshow-container" id="slideshow">
            <div className="skeleton-slide" id="skeletonSlide">
              <div className="skeleton-slide-box">
                <div className="skeleton-slide-circle"></div>
                <div className="skeleton-slide-line"></div>
                <div className="skeleton-slide-line"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
     <div className={'slideshow-page' + (fullscreen ? ' fullscreen' : '')}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />
      <button className="sidebar-toggle" id="sidebarToggle" aria-label="Toggle sidebar"
        onClick={() => setSidebarCollapsed(c => !c)}>&#9776;</button>

      <div className="main-area">
        <div className="slideshow-container" id="slideshow" ref={containerRef}
          onClick={handleContainerClick} onMouseDown={handleContainerMouseDown} onContextMenu={handleContextMenu}>

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
                      setTimeout(() => saveRef.current(), 0)
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
                          setTimeout(() => saveRef.current(), 0)
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
                      setTimeout(() => saveRef.current(), 0)
                    }
                    setShowUrlBarFor(null)
                  }}>Apply</button>
                </div>
                <span className="slide-label">{slideNames[i] || 'Slide ' + (i + 1)}</span>
                <span className="slide-number">{i + 1} / {slides.length}</span>
                <ShapeLayer slideIndex={i} selectedShapeId={selectedShapeId} onShapeSelect={setSelectedShapeId}
                  lineDrawState={lineDrawState} setLineDrawState={setLineDrawState}
                  snapToGrid={snapToGrid} />
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
              <input type="color" id="drawColor" value={drawColor}
                onChange={e => { const v = e.target.value; setDrawColor(v); drawColorRef.current = v }} />
              <input type="range" id="drawSize" min="1" max="20" value={drawSize}
                onChange={e => { const v = +e.target.value; setDrawSize(v); drawSizeRef.current = v }} />
              <span className="draw-size-label" id="drawSizeLabel">{drawSize}</span>
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
              {['rect', 'circle', 'line', 'arrow', 'text', 'image', 'table'].map(type => (
                <button key={type} className="shape-popup-btn" onClick={() => handleAddShape(type)}>
                  <svg viewBox="0 0 24 24" width="16" height="16">
                    {type === 'rect' && <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"/>}
                    {type === 'circle' && <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2"/>}
                    {type === 'line' && <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="2"/>}
                    {type === 'arrow' && <><line x1="3" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/><polyline points="14 7 19 12 14 17" fill="none" stroke="currentColor" strokeWidth="2"/></>}
                    {type === 'text' && <><polyline points="4 7 4 4 20 4 20 7" fill="none" stroke="currentColor" strokeWidth="2"/><line x1="9" y1="20" x2="15" y2="20" stroke="currentColor" strokeWidth="2"/><line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="2"/></>}
                    {type === 'image' && <><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="2"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" strokeWidth="2"/></>}
                    {type === 'table' && <><path d="M3 3h18v18H3z" fill="none" stroke="currentColor" strokeWidth="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.5"/><line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.5"/><line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="1.5"/><line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="1.5"/></>}
                  </svg>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          )}

          <button className="library-btn" title="Shape Library"
            onClick={() => setShowShapeLibrary(v => !v)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>

        </div>
      </div>

      <div className={'right-sidebar' + (showShapeLibrary ? ' open' : '')}>
        <div className="right-sidebar-header">
          <span>Shape Library</span>
          <button className="right-sidebar-close" onClick={() => setShowShapeLibrary(false)}>&times;</button>
        </div>
        <div className="right-sidebar-body">
          <div className="right-sidebar-section">
            <div className="right-sidebar-section-title">Presets</div>
            <div className="rhs-preset-grid">
              {[
                { type: 'rect', label: 'Rect', svg: '<rect x="2" y="2" width="20" height="20" rx="2" fill="#6366f1" opacity="0.3" stroke="#818cf8" stroke-width="1.5"/>' },
                { type: 'circle', label: 'Circle', svg: '<circle cx="12" cy="12" r="9" fill="#6366f1" opacity="0.3" stroke="#818cf8" stroke-width="1.5"/>' },
                { type: 'line', label: 'Line', svg: '<line x1="3" y1="21" x2="21" y2="3" stroke="#818cf8" stroke-width="2"/>' },
                { type: 'arrow', label: 'Arrow', svg: '<line x1="3" y1="12" x2="19" y2="12" stroke="#818cf8" stroke-width="2"/><polyline points="14 7 19 12 14 17" fill="none" stroke="#818cf8" stroke-width="2"/>' },
                { type: 'text', label: 'Text', svg: '<rect x="3" y="6" width="18" height="12" rx="1" fill="#6366f1" opacity="0.3" stroke="#818cf8" stroke-width="1.5"/><text x="12" y="15" text-anchor="middle" fill="#fff" font-size="8" font-family="Poppins">T</text>' },
                { type: 'image', label: 'Image', svg: '<rect x="3" y="3" width="18" height="18" rx="2" fill="#6366f1" opacity="0.3" stroke="#818cf8" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="#818cf8"/><polyline points="21 15 16 10 5 21" fill="none" stroke="#818cf8" stroke-width="1.5"/>' },
              ].map(p => (
                <button key={p.type} className="rhs-preset-item" title={'Add ' + p.label}
                  onClick={() => handleAddShape(p.type)}>
                  <svg viewBox="0 0 24 24" width="28" height="28" dangerouslySetInnerHTML={{ __html: p.svg }} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="right-sidebar-section">
            <div className="right-sidebar-section-title">Saved Shapes</div>
            <div className="rhs-library-list">
              {Object.keys(shapeLibrary).length === 0 ? (
                <div className="rhs-library-empty">
                  No saved shapes.<br/>Right-click a shape to save it.
                </div>
              ) : Object.entries(shapeLibrary).map(([name, shape]) => (
                <div key={name} className="rhs-library-item"
                  onClick={() => insertFromLibrary(name)}>
                  <div className="rhs-library-preview">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#a0a0b8" strokeWidth="1.5">
                      {shape.type === 'rect' && <rect x="3" y="3" width="18" height="18" rx="2" fill={shape.fill || 'none'} opacity="0.3" stroke="currentColor"/>}
                      {shape.type === 'circle' && <circle cx="12" cy="12" r="9" fill={shape.fill || 'none'} opacity="0.3" stroke="currentColor"/>}
                      {shape.type === 'line' && <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="2"/>}
                      {shape.type === 'arrow' && <><line x1="3" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2"/><polyline points="14 7 19 12 14 17" fill="none" stroke="currentColor" strokeWidth="2"/></>}
                      {shape.type === 'text' && <><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></>}
                      {shape.type === 'image' && <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></>}
                    </svg>
                  </div>
                  <div className="rhs-library-info">
                    <span className="rhs-library-name">{name}</span>
                    <span className="rhs-library-type">{shape.type}</span>
                  </div>
                  <button className="rhs-library-del" title="Delete"
                    onClick={e => { e.stopPropagation(); deleteFromLibrary(name) }}>&times;</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button className="right-sidebar-toggle" id="rightSidebarToggle" aria-label="Toggle shape library"
        onClick={() => setShowShapeLibrary(v => !v)}
        title="Shape Library">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </button>

      <PromptDialog show={saveShapeDialogOpen}
        message="Enter a name for this shape:"
        placeholder="Shape name"
        onCancel={() => setSaveShapeDialogOpen(false)}
        onConfirm={(name) => { saveShapeToLibrary(name); setSaveShapeDialogOpen(false) }} />

      {presenterMode && (
        <div id="presenterPanel" className="show">
          <div className="presenter-notes-wrap">
            <label htmlFor="presenterNotes">Speaker Notes</label>
            <textarea ref={notesRef} id="presenterNotes" placeholder="Notes for this slide..."
              defaultValue={slideNotes[current] || ''}
              onChange={(e) => {
                const val = e.target.value.trim()
                if (val) setSlideNotes(prev => ({ ...prev, [current]: val }))
                else setSlideNotes(prev => { const n = { ...prev }; delete n[current]; return n })
              }}
              onBlur={() => setTimeout(() => save(), 800)} />
          </div>
          <div className="presenter-timer-wrap">
            <div id="presenterTimer">{String(Math.floor(timerSeconds / 60)).padStart(2, '0')}:{String(timerSeconds % 60).padStart(2, '0')}</div>
            <div className="presenter-timer-btns">
              <button id="presenterTimerStart" onClick={() => setTimerRunning(r => !r)}>{timerRunning ? '\u23F8' : '\u25B6'}</button>
              <button id="presenterTimerReset" onClick={() => { setTimerRunning(false); setTimerSeconds(0) }}>&#8634;</button>
            </div>
          </div>
          {current + 1 < slides.length && (
            <div className="presenter-next-wrap">
              <label>Up Next</label>
              <div id="presenterNextPreview" style={slideUrls[current + 1] ? { backgroundImage: 'url(' + resolveUrl(slideUrls[current + 1]) + ')' } : {}} />
              <div className="presenter-next-label" id="presenterNextLabel">{slideNames[current + 1] || 'Slide ' + (current + 2)}</div>
            </div>
          )}
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

      {shortcutsVisible && (
        <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) setShortcutsVisible(false) }}>
          <div className="modal shortcuts-modal">
            <div className="modal-header">
              <h2>Keyboard Shortcuts</h2>
              <button className="modal-close" onClick={() => setShortcutsVisible(false)}>&times;</button>
            </div>
            <div className="modal-body shortcuts-body">
              <div className="shortcuts-group">
                <span className="shortcuts-group-label">Navigation</span>
                <div className="shortcut-row"><kbd>&larr;</kbd><kbd>&rarr;</kbd><span>Previous / Next slide</span></div>
                <div className="shortcut-row"><kbd>Home</kbd><span>Go to first slide</span></div>
                <div className="shortcut-row"><kbd>End</kbd><span>Go to last slide</span></div>
              </div>
              <div className="shortcuts-group">
                <span className="shortcuts-group-label">Fullscreen</span>
                <div className="shortcut-row"><kbd>D</kbd><span>Toggle draw mode</span></div>
                <div className="shortcut-row"><kbd>L</kbd><span>Toggle laser pointer</span></div>
                <div className="shortcut-row"><kbd>P</kbd><span>Toggle presenter mode</span></div>
              </div>
              <div className="shortcuts-group">
                <span className="shortcuts-group-label">Shapes</span>
                <div className="shortcut-row"><kbd>Ctrl</kbd>+<kbd>C</kbd><span>Copy selected shape</span></div>
                <div className="shortcut-row"><kbd>Ctrl</kbd>+<kbd>V</kbd><span>Paste shape</span></div>
                <div className="shortcut-row"><kbd>Del</kbd><span>Delete selected shape</span></div>
              </div>
              <div className="shortcuts-group">
                <span className="shortcuts-group-label">Slides</span>
                <div className="shortcut-row"><kbd>Ctrl</kbd>+<kbd>D</kbd><span>Duplicate current slide</span></div>
              </div>
              <div className="shortcuts-group">
                <span className="shortcuts-group-label">General</span>
                <div className="shortcut-row"><kbd>?</kbd><span>Show this cheat sheet</span></div>
                <div className="shortcut-row"><kbd>Esc</kbd><span>Close menus / popups</span></div>
                <div className="shortcut-row"><kbd>F11</kbd><span>Toggle fullscreen</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      <PromptDialog show={templateDialogOpen}
        message="Enter a name for this slide template:"
        placeholder="Template name"
        onCancel={() => setTemplateDialogOpen(false)}
        onConfirm={(name) => { saveTemplate(name, ctxSlideIdx); setTemplateDialogOpen(false) }} />

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
            setTimeout(() => saveRef.current(), 0)
            setCtxMenuPos(null)
          }}>Remove Image</div>
          <div className="ctx-item" onClick={() => { duplicateSlide(ctxSlideIdx); setCtxMenuPos(null) }}>Duplicate Slide</div>
          <div className="ctx-item" onClick={() => { setTemplateDialogOpen(true); setCtxMenuPos(null) }}>Save as Template</div>
          <div className="ctx-sub-wrap">
            <div className="ctx-item ctx-sub">Apply Template ▸</div>
            <div className="ctx-submenu" id="ctxTemplateSub">
              {Object.keys(slideTemplates).length === 0 ? (
                <div className="ctx-item" style={{ cursor: 'default', color: '#6b7280' }}>No templates</div>
              ) : Object.entries(slideTemplates).map(([name]) => (
                <div key={name} className="ctx-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => {
                    applyTemplate(name, ctxSlideIdx)
                    setCtxMenuPos(null)
                  }}>{name}</span>
                  <span className="tmpl-all" title="Apply to all slides" onClick={(e) => { e.stopPropagation(); setCtxMenuPos(null); slides.forEach((_, i) => { const tmpl = slideTemplates[name]; if (!tmpl) return; setSlideShapes(prev => { const s = { ...prev }; s[i] = [...(s[i] || []), ...(tmpl.shapes || []).map(sh => ({ ...sh, id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) }))]; return s }); if (tmpl.bgColor) setSlideBgColors(prev => ({ ...prev, [i]: tmpl.bgColor })); if (tmpl.imageUrl) { setSlideUrls(prev => ({ ...prev, [i]: tmpl.imageUrl })); if (tmpl.imageMode) setSlideMode(prev => ({ ...prev, [i]: tmpl.imageMode })); if (tmpl.resizeData) setResizeData(prev => ({ ...prev, [i]: tmpl.resizeData })) } }); setTimeout(() => saveRef.current(), 0); showToast('Template applied to all slides', 'success') }}>All</span>
                  <span className="tmpl-del" onClick={(e) => { e.stopPropagation(); deleteTemplate(name); setCtxMenuPos(null); showToast('Template deleted', 'success') }}>&times;</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ctx-divider"></div>
          <div className="ctx-sub-wrap">
            <div className="ctx-item ctx-sub">Fit Mode ▸</div>
            <div className="ctx-submenu" id="ctxFitSub">
            {['cover', 'contain', 'fill', 'original'].map(m => (
              <div key={m} className="ctx-item" onClick={() => {
                const idx = ctxSlideIdx; if (idx < 0 || !slideUrls[idx]) return
                setSlideMode(prev => ({ ...prev, [idx]: m }))
                setTimeout(() => saveRef.current(), 0)
                setCtxMenuPos(null)
              }}>{m.charAt(0).toUpperCase() + m.slice(1)}</div>
            ))}
          </div>
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
                        setTimeout(() => saveRef.current(), 0)
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
              setTimeout(() => saveRef.current(), 0)
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
              setTimeout(() => saveRef.current(), 0)
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
              setTimeout(() => saveRef.current(), 0)
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
            setTimeout(() => saveRef.current(), 0)
            setCtxShapeMenuPos(null)
          }}>Duplicate</div>
          <div className="ctx-divider"></div>
          <div className="ctx-item" onClick={() => {
            setSnapToGrid(v => !v)
            setCtxShapeMenuPos(null)
          }}>{snapToGrid ? '✓ ' : ''}Snap to Grid</div>
          <div className="ctx-divider"></div>
          <div className="ctx-sub-wrap">
            <div className="ctx-item ctx-sub">Align ▸</div>
            <div className="ctx-submenu" id="ctxAlignSub">
              {[{ d: 'left', l: 'Left' }, { d: 'center', l: 'Center' }, { d: 'right', l: 'Right' },
                { d: 'top', l: 'Top' }, { d: 'middle', l: 'Middle' }, { d: 'bottom', l: 'Bottom' }].map(({ d, l }) => (
                <div key={d} className="ctx-item" onClick={() => {
                  if (ctxShapeData) handleAlignShape(d, ctxShapeData.slideIdx, ctxShapeData.shape)
                  setCtxShapeMenuPos(null)
                }}>{l}</div>
              ))}
            </div>
          </div>
          <div className="ctx-item" onClick={() => {
            if (ctxShapeData) handleDistribute('h', ctxShapeData.slideIdx)
            setCtxShapeMenuPos(null)
          }}>Distribute Horizontally</div>
          <div className="ctx-item" onClick={() => {
            if (ctxShapeData) handleDistribute('v', ctxShapeData.slideIdx)
            setCtxShapeMenuPos(null)
          }}>Distribute Vertically</div>
          <div className="ctx-item" onClick={() => {
            setSaveShapeDialogOpen(true)
            setCtxShapeMenuPos(null)
          }}>Save to Library</div>
          <div className="ctx-divider"></div>
          <div className="ctx-item" onClick={() => {
            if (!ctxShapeData) return
            const { slideIdx, shapeId } = ctxShapeData
            setSlideShapes(prev => {
              const s = { ...prev }
              s[slideIdx] = (s[slideIdx] || []).filter(sh => sh.id !== shapeId)
              return s
            })
            setSelectedShapeId(null)
            setTimeout(() => saveRef.current(), 0)
            setCtxShapeMenuPos(null)
          }}>Delete</div>
        </div>
      )}

      <div className="upload-loading" id="uploadLoading"><div className="spinner"></div></div>
      </div>
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
