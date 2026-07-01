import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { useToast } from './Toast'
import { hexToRgba, getDefaultShape } from '../utils'
import { resolveUrl, uploadImage } from '../api'

let shapeClipboard = null

export default function ShapeLayer({ slideIndex }) {
  const showToast = useToast()
  const { slideShapes, setSlideShapes, save, current } = useSlideshow()
  const [selectedShapeId, setSelectedShapeId] = useState(null)
  const [shapeDragState, setShapeDragState] = useState(null)
  const [lineDrawState, setLineDrawState] = useState(null)
  const slideRef = useRef(null)

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

  const findShape = useCallback((id) => {
    return (slideShapes[slideIndex] || []).find(s => s.id === id)
  }, [slideShapes, slideIndex])

  const deleteShape = useCallback((id) => {
    setSlideShapes(prev => {
      const s = { ...prev }
      s[slideIndex] = (s[slideIndex] || []).filter(sh => sh.id !== id)
      return s
    })
    setSelectedShapeId(null)
    setTimeout(() => save(), 0)
  }, [slideIndex, setSlideShapes, save])

  const addShape = useCallback((type) => {
    const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const shape = { id, ...getDefaultShape(type) }
    setSlideShapes(prev => {
      const s = { ...prev }
      s[slideIndex] = [...(s[slideIndex] || []), shape]
      return s
    })
    setSelectedShapeId(id)
    setTimeout(() => save(), 0)
  }, [slideIndex, setSlideShapes, save])

  const handleShapeMouseDown = useCallback((e, shape) => {
    if (e.button !== 0) return
    e.stopPropagation()
    setSelectedShapeId(shape.id)

    const el = e.currentTarget
    const isHandle = e.target.classList.contains('resize-handle')
    const isRotate = e.target.classList.contains('rot-handle')
    const isLineHandle = e.target.classList.contains('line-handle')

    if (isLineHandle && (shape.type === 'line' || shape.type === 'arrow')) {
      e.preventDefault()
      const sr = slideRef.current.getBoundingClientRect()
      const xPct = (e.clientX - sr.left) / sr.width * 100
      const yPct = (e.clientY - sr.top) / sr.height * 100
      setShapeDragState({
        shapeId: shape.id, idx: slideIndex,
        handle: 'line-' + (e.target.classList.contains('end') ? 'end' : 'start'),
        startX: e.clientX, startY: e.clientY,
        startL: parseFloat(shape.x), startT: parseFloat(shape.y),
        startW: parseFloat(shape.w), startH: parseFloat(shape.h),
        startRotation: shape.rotation || 0,
        startMX: xPct, startMY: yPct
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
  }, [slideIndex])

  const handleDoubleClick = useCallback((e, shape) => {
    e.stopPropagation()
    setSelectedShapeId(shape.id)
    if (shape.type === 'text') {
      const lbl = e.currentTarget.querySelector('.shape-label')
      if (!lbl) return
      lbl.contentEditable = true
      lbl.focus()
      const onBlur = () => {
        lbl.contentEditable = false
        updateShape(shape.id, { text: lbl.textContent || '' })
        setTimeout(() => save(), 0)
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
          setTimeout(() => save(), 0)
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
        setTimeout(() => save(), 0)
        lbl.removeEventListener('blur', onBlur)
      }
      lbl.addEventListener('blur', onBlur)
    }
  }, [slideIndex, updateShape, save, showToast])

  const handleContextMenu = useCallback((e, shape) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedShapeId(shape.id)
    window.dispatchEvent(new CustomEvent('shape-context-menu', {
      detail: { x: e.clientX, y: e.clientY, slideIdx: slideIndex, shapeId: shape.id, shape }
    }))
  }, [slideIndex])

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
        const mxPct = (e.clientX - sr.left) / sr.width * 100
        const myPct = (e.clientY - sr.top) / sr.height * 100
        let x1, y1, x2, y2
        if (h === 'line-end') {
          x1 = shapeDragState.startL; y1 = shapeDragState.startT
          x2 = mxPct; y2 = myPct
        } else {
          const aRad = shapeDragState.startRotation * Math.PI / 180
          x2 = shapeDragState.startL + shapeDragState.startW * Math.cos(aRad)
          y2 = shapeDragState.startT + shapeDragState.startW * Math.sin(aRad)
          x1 = mxPct; y1 = myPct
        }
        const dx = x2 - x1, dy = y2 - y1
        const dist = Math.sqrt(dx * dx + dy * dy)
        const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
        shapeEl.style.left = x1 + '%'; shapeEl.style.top = y1 + '%'
        shapeEl.style.width = Math.max(dist, 0.1) + '%'
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

      shapeEl.style.left = x + 'px'; shapeEl.style.top = y + 'px'
      shapeEl.style.width = w + 'px'; shapeEl.style.height = hh + 'px'
    }

    const onMouseUp = () => {
      if (!shapeDragState) return
      const slideEl = slideRef.current
      if (!slideEl || shapeDragState.idx !== slideIndex) { setShapeDragState(null); return }
      const shapeEl = slideEl.querySelector('.shape[data-shape-id="' + shapeDragState.shapeId + '"]')
      if (!shapeEl) { setShapeDragState(null); return }
      const shape = findShape(shapeDragState.shapeId)
      if (!shape) { setShapeDragState(null); return }

      if (shapeDragState.handle === 'rotate') {
        const match = shapeEl.style.transform.match(/rotate\(([-\d.]+)deg\)/)
        if (match) updateShape(shape.id, { rotation: parseFloat(match[1]) || 0 })
      } else if (shapeDragState.handle === 'line-start' || shapeDragState.handle === 'line-end') {
        const sw = slideEl.offsetWidth, sh = slideEl.offsetHeight
        const match = shapeEl.style.transform.match(/rotate\(([-\d.]+)deg\)/)
        const rot = match ? parseFloat(match[1]) : 0
        updateShape(shape.id, {
          x: (shapeEl.offsetLeft / sw * 100) + '%',
          y: (shapeEl.offsetTop / sh * 100) + '%',
          w: (shapeEl.offsetWidth / sw * 100) + '%',
          rotation: rot
        })
      } else {
        const sw = slideEl.offsetWidth, sh = slideEl.offsetHeight
        updateShape(shape.id, {
          x: (shapeEl.offsetLeft / sw * 100) + '%',
          y: (shapeEl.offsetTop / sh * 100) + '%',
          w: (shapeEl.offsetWidth / sw * 100) + '%',
          h: (shapeEl.offsetHeight / sh * 100) + '%'
        })
      }
      setShapeDragState(null)
      setTimeout(() => save(), 0)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp) }
  }, [shapeDragState, slideIndex, findShape, updateShape, save])

  const handleLineDrawStart = useCallback((e) => {
    if (!lineDrawState) return
    e.preventDefault()
    const sr = slideRef.current.getBoundingClientRect()
    const xPct = (e.clientX - sr.left) / sr.width * 100
    const yPct = (e.clientY - sr.top) / sr.height * 100
    if (!lineDrawState.active) {
      setLineDrawState(prev => ({ ...prev, x1: xPct, y1: yPct, x2: xPct, y2: yPct, active: true }))
    } else {
      finishLineDraw(xPct, yPct)
    }
  }, [lineDrawState])

  const finishLineDraw = useCallback((x2, y2) => {
    if (!lineDrawState) return
    const { type, x1, y1 } = lineDrawState
    const dx = x2 - x1, dy = y2 - y1
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 0.5) { setLineDrawState(null); return }
    const angle = Math.atan2(dy, dx) * 180 / Math.PI
    const id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const shape = {
      id, type, x: x1 + '%', y: y1 + '%', w: dist + '%', h: '0.3%',
      rotation: angle, fill: 'transparent', stroke: '#6366f1', strokeWidth: 3,
      fillOpacity: 1, strokeOpacity: 1,
      text: '', fontSize: 14, color: '#ffffff', fontFamily: 'Poppins', textAlign: 'center'
    }
    setSlideShapes(prev => {
      const s = { ...prev }
      s[slideIndex] = [...(s[slideIndex] || []), shape]
      return s
    })
    setSelectedShapeId(id)
    setLineDrawState(null)
    setTimeout(() => save(), 0)
  }, [lineDrawState, slideIndex, setSlideShapes, save])

  useEffect(() => {
    if (!lineDrawState || !lineDrawState.active) return
    const onMouseMove = (e) => {
      const sr = slideRef.current.getBoundingClientRect()
      setLineDrawState(prev => ({
        ...prev,
        x2: (e.clientX - sr.left) / sr.width * 100,
        y2: (e.clientY - sr.top) / sr.height * 100
      }))
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [lineDrawState])

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
            setSlideShapes(prev => {
              const s = { ...prev }
              s[slideIndex] = [...(s[slideIndex] || []), dup]
              return s
            })
            setSelectedShapeId(newId)
            setTimeout(() => save(), 0)
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
            setSlideShapes(prev => {
              const s = { ...prev }
              s[slideIndex] = [...(s[slideIndex] || []), pasteShape]
              return s
            })
            setSelectedShapeId(newId)
            setTimeout(() => save(), 0)
            showToast('Shape pasted', 'success')
            break
          }
        }
      }
    }
    window.addEventListener('shape-action', handler)
    return () => window.removeEventListener('shape-action', handler)
  }, [slideIndex, findShape, deleteShape, setSlideShapes, save, showToast])

  return (
    <div ref={slideRef} className="shape-layer"
      onMouseDown={lineDrawState ? handleLineDrawStart : undefined}
      style={{ position: 'absolute', inset: 0, pointerEvents: lineDrawState ? 'auto' : 'none', cursor: lineDrawState ? 'crosshair' : 'default', zIndex: 10 }}>
      {shapes.map(shape => (
        <ShapeEl key={shape.id} shape={shape} isSelected={selectedShapeId === shape.id}
          onMouseDown={e => handleShapeMouseDown(e, shape)}
          onDoubleClick={e => handleDoubleClick(e, shape)}
          onContextMenu={e => handleContextMenu(e, shape)} />
      ))}
    </div>
  )
}

function ShapeEl({ shape, isSelected, onMouseDown, onDoubleClick, onContextMenu }) {
  const { updateShape, slideShapes, slideIndex } = useSlideshow()
  const elRef = useRef(null)

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

  return (
    <div ref={elRef}
      className={'shape shape-' + shape.type + (isSelected ? ' selected' : '')}
      data-shape-id={shape.id}
      style={style}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}>
      {shape.type === 'text' && (
        <div className="shape-label"
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
        <div className="shape-label"
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
      {(shape.type !== 'line' && shape.type !== 'arrow' && shape.type !== 'text' && shape.type !== 'image') && (
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
