import React, { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { useToast } from './Toast'
import { hexToRgba, getDefaultShape } from '../utils'
import { resolveUrl, uploadImage } from '../api'

let shapeClipboard = null

const GRID = 10

export default function ShapeLayer({ slideIndex, selectedShapeId, onShapeSelect, lineDrawState, setLineDrawState, snapToGrid }) {
  const showToast = useToast()
  const { slideShapes, setSlideShapes, save, current } = useSlideshow()
  const [shapeDragState, setShapeDragState] = useState(null)
  const slideRef = useRef(null)
  const linePreviewRef = useRef(null)
  const lineDrawStartRef = useRef(null)
  const finishingRef = useRef(false)
  const saveRef = useRef(save)
  useLayoutEffect(() => { saveRef.current = save })

  const shapes = slideShapes[slideIndex] || []

  const updateShape = useCallback((id, updates) => {
    setSlideShapes(prev => {
      const s = { ...prev }
      const arr = [...(s[slideIndex] || [])]
      const idx = arr.findIndex(sh => sh.id === id)
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...updates }
        s[slideIndex] = arr
      }
      return s
    })
  }, [slideIndex, setSlideShapes])

  const updateShapeRef = useRef(updateShape)
  useLayoutEffect(() => { updateShapeRef.current = updateShape })

  const findShape = useCallback((id) => {
    return (slideShapes[slideIndex] || []).find(s => s.id === id)
  }, [slideShapes, slideIndex])

  const findShapeRef = useRef(findShape)
  useLayoutEffect(() => { findShapeRef.current = findShape })

  const deleteShape = useCallback((id) => {
    setSlideShapes(prev => {
      const s = { ...prev }
      s[slideIndex] = (s[slideIndex] || []).filter(sh => sh.id !== id)
      return s
    })
    onShapeSelect(null)
    setTimeout(() => saveRef.current(), 0)
  }, [slideIndex, setSlideShapes, save, onShapeSelect])

  const addShape = useCallback((type) => {
    const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const shape = { id, ...getDefaultShape(type) }
    setSlideShapes(prev => {
      const s = { ...prev }
      s[slideIndex] = [...(s[slideIndex] || []), shape]
      return s
    })
    onShapeSelect(id)
    setTimeout(() => saveRef.current(), 0)
  }, [slideIndex, setSlideShapes, save, onShapeSelect])

  const handleShapeMouseDown = useCallback((e, shape) => {
    if (e.button !== 0) return
    e.stopPropagation()
    onShapeSelect(shape.id)

    const el = e.currentTarget
    const isHandle = e.target.classList.contains('resize-handle')
    const isRotate = e.target.classList.contains('rot-handle')
    const isLineHandle = e.target.classList.contains('line-handle')

    if (isLineHandle && (shape.type === 'line' || shape.type === 'arrow')) {
      e.preventDefault()
      setShapeDragState({
        shapeId: shape.id, idx: slideIndex,
        handle: 'line-' + (e.target.classList.contains('end') ? 'end' : 'start'),
        startX: e.clientX, startY: e.clientY,
        startL: el.offsetLeft, startT: el.offsetTop,
        startW: el.offsetWidth, startH: el.offsetHeight,
        startRotation: shape.rotation || 0,
        sw: slideRef.current.offsetWidth,
        sh: slideRef.current.offsetHeight
      })
      return
    }

    if (isRotate) {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      setShapeDragState({
        shapeId: shape.id, idx: slideIndex,
        handle: 'rotate',
        startX: e.clientX, startY: e.clientY, cx, cy,
        startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
        startRotation: shape.rotation || 0
      })
      return
    }

    if (isHandle) {
      e.preventDefault()
      const dir = e.target.className.replace('resize-handle ', '')
      setShapeDragState({
        shapeId: shape.id, idx: slideIndex, handle: dir,
        startX: e.clientX, startY: e.clientY,
        startL: el.offsetLeft, startT: el.offsetTop,
        startW: el.offsetWidth, startH: el.offsetHeight
      })
      return
    }

    setShapeDragState({
      shapeId: shape.id, idx: slideIndex, handle: 'move',
      startX: e.clientX, startY: e.clientY,
      startL: el.offsetLeft, startT: el.offsetTop,
      startW: el.offsetWidth, startH: el.offsetHeight,
      active: false
    })
  }, [slideIndex, onShapeSelect])

  const handleDoubleClick = useCallback((e, shape) => {
    e.stopPropagation()
    onShapeSelect(shape.id)
    if (shape.type === 'text') {
      const lbl = e.currentTarget.querySelector('.shape-label')
      if (!lbl) return
      lbl.contentEditable = true
      lbl.focus()
      const onBlur = () => {
        lbl.contentEditable = false
        updateShape(shape.id, { text: lbl.textContent || '' })
        setTimeout(() => saveRef.current(), 0)
        lbl.removeEventListener('blur', onBlur)
      }
      lbl.addEventListener('blur', onBlur)
    } else if (shape.type === 'image') {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.style.display = 'none'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        try {
          const url = await uploadImage(file)
          updateShape(shape.id, { src: url })
          setTimeout(() => saveRef.current(), 0)
        } catch (_) { showToast('Failed to upload image') }
      }
      document.body.appendChild(input)
      input.click()
      input.remove()
    } else {
      if (!shape.text) shape.text = ''
      updateShape(shape.id, { text: shape.text || '' })
      const lbl = e.currentTarget.querySelector('.shape-label') || (() => {
        const d = document.createElement('div'); d.className = 'shape-label'; e.currentTarget.appendChild(d); return d
      })()
      lbl.textContent = shape.text
      lbl.style.color = shape.color || '#ffffff'
      lbl.style.fontSize = (shape.fontSize || 14) + 'px'
      lbl.style.fontFamily = shape.fontFamily || 'Poppins'
      lbl.style.textAlign = shape.textAlign || 'center'
      lbl.contentEditable = true
      lbl.focus()
      const onBlur = () => {
        lbl.contentEditable = false
        updateShape(shape.id, { text: lbl.textContent || '' })
        setTimeout(() => saveRef.current(), 0)
        lbl.removeEventListener('blur', onBlur)
      }
      lbl.addEventListener('blur', onBlur)
    }
  }, [slideIndex, updateShape, save, showToast, onShapeSelect])

  const handleContextMenu = useCallback((e, shape) => {
    e.preventDefault()
    onShapeSelect(shape.id)
  }, [onShapeSelect])

  useEffect(() => {
    if (!shapeDragState || shapeDragState.idx !== slideIndex) return

    const onMouseMove = (e) => {
      const slideEl = slideRef.current
      if (!slideEl) return
      const shapeEl = slideEl.querySelector('.shape[data-shape-id="' + shapeDragState.shapeId + '"]')
      if (!shapeEl) { setShapeDragState(null); return }

      const h = shapeDragState.handle

      if (h === 'rotate') {
        const angle = Math.atan2(e.clientY - shapeDragState.cy, e.clientX - shapeDragState.cx)
        const deg = (angle - shapeDragState.startAngle) * 180 / Math.PI
        const rot = (shapeDragState.startRotation + deg) % 360
        const snapped = Math.round(rot / 15) * 15
        shapeEl.style.transform = 'rotate(' + snapped + 'deg)'
        return
      }

      if (h === 'line-end' || h === 'line-start') {
        const sr = slideEl.getBoundingClientRect()
        const mx = e.clientX - sr.left
        const my = e.clientY - sr.top
        let fx, fy, dx, dy
        if (h === 'line-end') {
          fx = shapeDragState.startL; fy = shapeDragState.startT
          dx = mx - fx; dy = my - fy
        } else {
          const ang = shapeDragState.startRotation * Math.PI / 180
          fx = shapeDragState.startL + shapeDragState.startW * Math.cos(ang)
          fy = shapeDragState.startT + shapeDragState.startW * Math.sin(ang)
          dx = fx - mx; dy = fy - my
        }
        const dist = Math.sqrt(dx * dx + dy * dy)
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
        const l = h === 'line-end' ? fx : mx
        const t = h === 'line-end' ? fy : my
        shapeEl.style.left = l + 'px'; shapeEl.style.top = t + 'px'
        shapeEl.style.width = Math.max(dist, 0.1) + 'px'
        shapeEl.style.transform = 'rotate(' + angleDeg + 'deg)'
        return
      }

      const dx = e.clientX - shapeDragState.startX
      const dy = e.clientY - shapeDragState.startY

      if (h === 'move' && !shapeDragState.active) {
        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
        shapeDragState.active = true
      }

      let x = shapeDragState.startL, y = shapeDragState.startT
      let w = shapeDragState.startW, hh = shapeDragState.startH
      const min = 20

      const sides = {
        'e': () => { w = Math.max(min, shapeDragState.startW + dx) },
        'w': () => { const dw = Math.min(shapeDragState.startW - min, dx); x = shapeDragState.startL + dw; w = shapeDragState.startW - dw },
        's': () => { hh = Math.max(min, shapeDragState.startH + dy) },
        'n': () => { const dh = Math.min(shapeDragState.startH - min, dy); y = shapeDragState.startT + dh; hh = shapeDragState.startH - dh },
        'ne': () => { w = Math.max(min, shapeDragState.startW + dx); const dh = Math.min(shapeDragState.startH - min, dy); y = shapeDragState.startT + dh; hh = shapeDragState.startH - dh },
        'nw': () => { const dw = Math.min(shapeDragState.startW - min, dx); x = shapeDragState.startL + dw; w = shapeDragState.startW - dw; const dh = Math.min(shapeDragState.startH - min, dy); y = shapeDragState.startT + dh; hh = shapeDragState.startH - dh },
        'se': () => { w = Math.max(min, shapeDragState.startW + dx); hh = Math.max(min, shapeDragState.startH + dy) },
        'sw': () => { const dw = Math.min(shapeDragState.startW - min, dx); x = shapeDragState.startL + dw; w = shapeDragState.startW - dw; hh = Math.max(min, shapeDragState.startH + dy) },
        'move': () => { x = shapeDragState.startL + dx; y = shapeDragState.startT + dy }
      }
      if (sides[h]) sides[h]()

      if (snapToGrid) {
        const snap = (v) => Math.round(v / GRID) * GRID
        x = snap(x); y = snap(y); w = snap(w); hh = snap(hh)
      }

      shapeEl.style.left = x + 'px'; shapeEl.style.top = y + 'px'
      shapeEl.style.width = w + 'px'; shapeEl.style.height = hh + 'px'
    }

    const onMouseUp = () => {
      if (!shapeDragState) return
      const slideEl = slideRef.current
      if (!slideEl || shapeDragState.idx !== slideIndex) { setShapeDragState(null); return }
      const shapeEl = slideEl.querySelector('.shape[data-shape-id="' + shapeDragState.shapeId + '"]')
      if (!shapeEl) { setShapeDragState(null); return }
      const shape = findShapeRef.current(shapeDragState.shapeId)
      if (!shape) { setShapeDragState(null); return }

      if (shapeDragState.handle === 'rotate') {
        const match = shapeEl.style.transform.match(/rotate\(([-\d.]+)deg\)/)
        if (match) updateShapeRef.current(shape.id, { rotation: parseFloat(match[1]) || 0 })
      } else if (shapeDragState.handle === 'line-start' || shapeDragState.handle === 'line-end') {
        const sw = slideEl.offsetWidth, sh = slideEl.offsetHeight
        const match = shapeEl.style.transform.match(/rotate\(([-\d.]+)deg\)/)
        const rot = match ? parseFloat(match[1]) : 0
        const saveL = shapeEl.offsetLeft, saveT = shapeEl.offsetTop
        const saveW = shapeEl.offsetWidth
        const rad = rot * Math.PI / 180
        const exPx = saveL + saveW * Math.cos(rad)
        const eyPx = saveT + saveW * Math.sin(rad)
        updateShapeRef.current(shape.id, {
          x: (saveL / sw * 100) + '%',
          y: (saveT / sh * 100) + '%',
          w: (saveW / sw * 100) + '%',
          rotation: rot,
          ex: (exPx / sw * 100) + '%',
          ey: (eyPx / sh * 100) + '%'
        })
      } else {
        const sw = slideEl.offsetWidth, sh = slideEl.offsetHeight
        const updates = {
          x: (shapeEl.offsetLeft / sw * 100) + '%',
          y: (shapeEl.offsetTop / sh * 100) + '%',
          w: (shapeEl.offsetWidth / sw * 100) + '%',
          h: (shapeEl.offsetHeight / sh * 100) + '%'
        }
        if (shape.type === 'line' || shape.type === 'arrow') {
          const match = shapeEl.style.transform.match(/rotate\(([-\d.]+)deg\)/)
          const rotDeg = match ? parseFloat(match[1]) : 0
          const rotRad = rotDeg * Math.PI / 180
          const endX = shapeEl.offsetLeft + shapeEl.offsetWidth * Math.cos(rotRad)
          const endY = shapeEl.offsetTop + shapeEl.offsetWidth * Math.sin(rotRad)
          updates.ex = (endX / sw * 100) + '%'
          updates.ey = (endY / sh * 100) + '%'
        }
        updateShapeRef.current(shape.id, updates)
      }
      setShapeDragState(null)
      setTimeout(() => saveRef.current(), 0)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [shapeDragState, slideIndex])

  const handleLineDrawStart = useCallback((e) => {
    if (!lineDrawState || slideIndex !== current) return
    e.preventDefault()
    const sr = slideRef.current.getBoundingClientRect()
    const xPct = (e.clientX - sr.left) / sr.width * 100
    const yPct = (e.clientY - sr.top) / sr.height * 100
    if (!lineDrawState.active) {
      lineDrawStartRef.current = { x: xPct, y: yPct }
      setLineDrawState(prev => ({ ...prev, x1: xPct, y1: yPct, active: true }))
    } else {
      if (linePreviewRef.current) linePreviewRef.current.style.display = 'none'
      finishLineDraw(xPct, yPct)
    }
  }, [lineDrawState, slideIndex, current])

  useEffect(() => {
    if (!lineDrawState || !lineDrawState.active || slideIndex !== current) return
    finishingRef.current = false
    const x1 = lineDrawState.x1, y1 = lineDrawState.y1
    let hasDragged = false
    const onMouseMove = (e) => {
      hasDragged = true
      const sr = slideRef.current.getBoundingClientRect()
      const x2 = (e.clientX - sr.left) / sr.width * 100
      const y2 = (e.clientY - sr.top) / sr.height * 100
      lineDrawStartRef.current = { x: x2, y: y2 }
      const el = linePreviewRef.current
      if (!el) return
      const sr2 = slideRef.current.getBoundingClientRect()
      const pw = sr2.width, ph = sr2.height
      const x1p = x1 / 100 * pw, y1p = y1 / 100 * ph
      const x2p = x2 / 100 * pw, y2p = y2 / 100 * ph
      const dx = x2p - x1p, dy = y2p - y1p
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 0.1) { el.style.display = 'none'; return }
      el.style.display = 'block'
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      el.style.left = x1 + '%'
      el.style.top = y1 + '%'
      el.style.width = dist + 'px'
      el.style.transform = 'rotate(' + angle + 'deg)'
    }
    const onMouseUp = (e) => {
      if (!hasDragged) return
      if (linePreviewRef.current) linePreviewRef.current.style.display = 'none'
      const sr = slideRef.current.getBoundingClientRect()
      const x2 = (e.clientX - sr.left) / sr.width * 100
      const y2 = (e.clientY - sr.top) / sr.height * 100
      const dx = x2 - x1, dy = y2 - y1
      if (Math.sqrt(dx * dx + dy * dy) < 0.5) return
      finishLineDraw(x2, y2)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [lineDrawState, slideIndex, current])

  const finishLineDraw = useCallback((x2, y2) => {
    if (!lineDrawState || finishingRef.current) return
    finishingRef.current = true
    if (linePreviewRef.current) linePreviewRef.current.style.display = 'none'
    const { type, x1, y1 } = lineDrawState
    const dx = x2 - x1, dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.5) { setLineDrawState(null); return }
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const color = '#6366f1'
    const shape = {
      id, type, x: x1 + '%', y: y1 + '%', ex: x2 + '%', ey: y2 + '%',
      w: dist + '%', h: '0.3%',
      rotation: angle, fill: 'transparent', stroke: color, strokeWidth: 3,
      fillOpacity: 1, strokeOpacity: 1,
      lineWeight: 3, lineDash: 'solid',
      text: '', fontSize: 14, color: '#ffffff', fontFamily: 'Poppins', textAlign: 'center'
    }
    setSlideShapes(prev => {
      const s = { ...prev }
      s[slideIndex] = [...(s[slideIndex] || []), shape]
      return s
    })
    onShapeSelect(id)
    setLineDrawState(null)
    setTimeout(() => saveRef.current(), 0)
  }, [lineDrawState, slideIndex, setSlideShapes, save, onShapeSelect])

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.slideIdx === slideIndex) {
        const { shapeId, action } = e.detail
        if (!shapeId) return
        const shape = findShape(shapeId)
        if (!shape) return
        switch (action) {
          case 'copy':
            shapeClipboard = JSON.parse(JSON.stringify(shape))
            showToast('Shape copied', 'success')
            break
          case 'cut':
            shapeClipboard = JSON.parse(JSON.stringify(shape))
            deleteShape(shapeId)
            showToast('Shape cut', 'success')
            break
          case 'duplicate': {
            const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
            const dup = JSON.parse(JSON.stringify(shape))
            dup.id = newId
            dup.x = parseFloat(dup.x) + 2 + '%'
            dup.y = parseFloat(dup.y) + 2 + '%'
            if (dup.ex) dup.ex = parseFloat(dup.ex) + 2 + '%'
            if (dup.ey) dup.ey = parseFloat(dup.ey) + 2 + '%'
            setSlideShapes(prev => {
              const s = { ...prev }
              s[slideIndex] = [...(s[slideIndex] || []), dup]
              return s
            })
            onShapeSelect(newId)
            setTimeout(() => saveRef.current(), 0)
            break
          }
          case 'delete':
            deleteShape(shapeId)
            break
          case 'paste': {
            if (!shapeClipboard) break
            const newId = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
            const pasteShape = JSON.parse(JSON.stringify(shapeClipboard))
            pasteShape.id = newId
            pasteShape.x = parseFloat(pasteShape.x) + 2 + '%'
            pasteShape.y = parseFloat(pasteShape.y) + 2 + '%'
            if (pasteShape.ex) pasteShape.ex = parseFloat(pasteShape.ex) + 2 + '%'
            if (pasteShape.ey) pasteShape.ey = parseFloat(pasteShape.ey) + 2 + '%'
            setSlideShapes(prev => {
              const s = { ...prev }
              s[slideIndex] = [...(s[slideIndex] || []), pasteShape]
              return s
            })
            onShapeSelect(newId)
            setTimeout(() => saveRef.current(), 0)
            showToast('Shape pasted', 'success')
            break
          }
        }
      }
    }
    window.addEventListener('shape-action', handler)
    return () => window.removeEventListener('shape-action', handler)
  }, [slideIndex, findShape, deleteShape, setSlideShapes, save, showToast, onShapeSelect])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (document.activeElement?.isContentEditable) return
      if (document.fullscreenElement) return
      if (slideIndex !== current) return
      if (!selectedShapeId) return
      const exists = (slideShapes[slideIndex] || []).some(s => s.id === selectedShapeId)
      if (exists) deleteShape(selectedShapeId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [slideIndex, current, selectedShapeId, slideShapes, deleteShape])

  return (
    <div ref={slideRef} className={'shape-layer' + (snapToGrid ? ' snap-grid' : '')}
      onMouseDown={lineDrawState && slideIndex === current ? handleLineDrawStart : undefined}
      style={{ position: 'absolute', inset: 0, pointerEvents: slideIndex === current ? 'auto' : 'none', cursor: lineDrawState && slideIndex === current ? 'crosshair' : 'default' }}>
      {shapes.map(shape => (
        <ShapeEl key={shape.id} shape={shape} isSelected={selectedShapeId === shape.id}
          onMouseDown={e => handleShapeMouseDown(e, shape)}
          onDoubleClick={e => handleDoubleClick(e, shape)}
          onContextMenu={e => handleContextMenu(e, shape)}
          updateShape={updateShape} />
      ))}
      <div ref={linePreviewRef}
        style={{
          position: 'absolute', display: 'none', height: '3px',
          background: '#6366f1', transformOrigin: '0 50%',
          pointerEvents: 'none', zIndex: 20,
          borderRadius: '2px'
        }} />
    </div>
  )
}

function ShapeEl({ shape, isSelected, onMouseDown, onDoubleClick, onContextMenu, updateShape }) {
  const elRef = useRef(null)
  const labelRef = useRef(null)

  let style = {
    left: shape.x, top: shape.y, width: shape.w, height: shape.h,
    transform: shape.rotation ? 'rotate(' + shape.rotation + 'deg)' : ''
  }

  if (shape.type === 'rect' || shape.type === 'circle') {
    style.background = shape.fill && shape.fill !== 'transparent' ? hexToRgba(shape.fill, shape.fillOpacity) : 'transparent'
    style.borderColor = shape.stroke && shape.stroke !== 'transparent' ? hexToRgba(shape.stroke, shape.strokeOpacity) : 'transparent'
    style.borderWidth = (shape.strokeWidth || 0) + 'px'
    style.borderRadius = shape.type === 'circle' ? '50%' : '0'
  } else if (shape.type === 'line' || shape.type === 'arrow') {
    const lw = shape.lineWeight || 3
    const dash = shape.lineDash || 'solid'
    const fillColor = shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none' ? hexToRgba(shape.fill, shape.fillOpacity) : null
    const color = fillColor || (shape.stroke ? hexToRgba(shape.stroke, shape.strokeOpacity) : 'transparent')
    style.height = lw + 'px'
    style.border = 'none'
    style.borderRadius = '0'
    style.transformOrigin = '0 50%'
    if (dash === 'solid') {
      style.background = color
    } else if (dash === 'dashed') {
      style.background = 'repeating-linear-gradient(90deg, ' + color + ' 0px, ' + color + ' 8px, transparent 8px, transparent 12px)'
    } else if (dash === 'dotted') {
      style.background = 'repeating-linear-gradient(90deg, ' + color + ' 0px, ' + color + ' 2px, transparent 2px, transparent 6px)'
    } else if (dash === 'dashdot') {
      style.background = 'repeating-linear-gradient(90deg, ' + color + ' 0px, ' + color + ' 6px, transparent 6px, transparent 10px, ' + color + ' 10px, ' + color + ' 12px, transparent 12px, transparent 16px)'
    }
  } else if (shape.type === 'text') {
    style.background = shape.bgColor && shape.bgColor !== 'transparent' ? hexToRgba(shape.bgColor, shape.bgOpacity) : 'transparent'
    style.border = 'none'
    style.borderRadius = '0'
  } else if (shape.type === 'image') {
    style.border = 'none'
    style.borderRadius = '0'
  }

  useLayoutEffect(() => {
    if (shape.type !== 'line' && shape.type !== 'arrow') return
    const el = elRef.current
    if (!el) return
    const parent = el.parentElement
    if (!parent) return

    const pw = parent.offsetWidth, ph = parent.offsetHeight
    if (!pw || !ph) return

    if (!shape.ex || !shape.ey) {
      const rad = (shape.rotation || 0) * Math.PI / 180
      const wPx = parseFloat(shape.w) / 100 * pw
      const x1p = parseFloat(shape.x) / 100 * pw
      const y1p = parseFloat(shape.y) / 100 * ph
      const x2p = x1p + wPx * Math.cos(rad)
      const y2p = y1p + wPx * Math.sin(rad)
      const ex = (x2p / pw * 100) + '%'
      const ey = (y2p / ph * 100) + '%'
      const dx = x2p - x1p, dy = y2p - y1p
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      el.style.width = Math.max(dist, 0.1) + 'px'
      el.style.transform = 'rotate(' + angle + 'deg)'
      updateShape(shape.id, { ex, ey })
      return
    }

    const update = () => {
      const pw2 = parent.offsetWidth, ph2 = parent.offsetHeight
      if (!pw2 || !ph2) return
      const x1p = parseFloat(shape.x) / 100 * pw2
      const y1p = parseFloat(shape.y) / 100 * ph2
      const x2p = parseFloat(shape.ex) / 100 * pw2
      const y2p = parseFloat(shape.ey) / 100 * ph2
      const dx = x2p - x1p, dy = y2p - y1p
      const dist = Math.sqrt(dx * dx + dy * dy)
      const angle = Math.atan2(dy, dx) * 180 / Math.PI
      el.style.width = Math.max(dist, 0.1) + 'px'
      el.style.transform = 'rotate(' + angle + 'deg)'
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [shape.x, shape.y, shape.w, shape.ex, shape.ey, shape.rotation, shape.type, shape.id, updateShape])

  useLayoutEffect(() => {
    const label = labelRef.current
    const el = elRef.current
    if (!label || !el) return
    if (shape.type === 'line' || shape.type === 'arrow' || shape.type === 'image') return

    const fit = () => {
      const maxSize = shape.fontSize || (shape.type === 'text' ? 28 : 14)
      const pw = el.offsetWidth
      const ph = el.offsetHeight
      if (!pw || !ph) return

      label.style.fontSize = maxSize + 'px'

      if (label.scrollWidth > pw || label.scrollHeight > ph) {
        let lo = 6
        let hi = maxSize
        let best = hi
        while (lo <= hi) {
          const mid = Math.round((lo + hi) / 2)
          label.style.fontSize = mid + 'px'
          if (label.scrollWidth <= pw && label.scrollHeight <= ph) {
            best = mid
            lo = mid + 1
          } else {
            hi = mid - 1
          }
        }
        label.style.fontSize = best + 'px'
      }
    }

    fit()

    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [shape.text, shape.fontSize, shape.w, shape.h, shape.type])

  return (
    <div ref={elRef}
      className={'shape shape-' + shape.type + (isSelected ? ' selected' : '')}
      data-shape-id={shape.id}
      style={style}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}>
      {shape.type === 'text' && (
        <div ref={labelRef} className="shape-label"
          style={{
            color: shape.color || '#ffffff',
            fontSize: (shape.fontSize || 28) + 'px',
            fontWeight: shape.fontWeight || '400',
            fontStyle: shape.fontStyle || 'normal',
            textDecoration: shape.textDecoration || 'none',
            fontFamily: shape.fontFamily || 'Poppins',
            textAlign: shape.textAlign || 'center',
            direction: shape.direction || 'ltr',
            display: 'block'
          }}>
          {shape.text || 'Text'}
        </div>
      )}
      {shape.type === 'image' && (
        shape.src ? (
          <img src={resolveUrl(shape.src)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div className="shape-img-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
        )
      )}
      {(shape.type === 'rect' || shape.type === 'circle') && shape.text && (
        <div ref={labelRef} className="shape-label"
          style={{
            color: shape.color || '#ffffff',
            fontSize: (shape.fontSize || 14) + 'px',
            fontFamily: shape.fontFamily || 'Poppins',
            textAlign: shape.textAlign || 'center',
            display: 'flex'
          }}>
          {shape.text}
        </div>
      )}
      {(shape.type === 'line' || shape.type === 'arrow') && (
        <>
          <div className="line-handle start" />
          <div className="line-handle end" />
          {shape.type === 'arrow' && (
            <div style={{
              position: 'absolute', right: '-1px', top: '50%',
              transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: '12px solid currentColor',
              color: shape.stroke ? hexToRgba(shape.stroke, shape.strokeOpacity) : 'transparent',
              pointerEvents: 'none'
            }} />
          )}
        </>
      )}
      {(shape.type !== 'line' && shape.type !== 'arrow') && (
        <>
          {['nw','n','ne','e','se','s','sw','w'].map(dir => (
            <div key={dir} className={'resize-handle ' + dir} />
          ))}
          <div className="rot-handle" />
        </>
      )}
    </div>
  )
}
