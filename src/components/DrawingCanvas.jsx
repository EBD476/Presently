import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useSlideshow } from '../context/SlideshowContext'

export default function DrawingCanvas() {
  const { current, drawData, setDrawData } = useSlideshow()
  const canvasRef = useRef(null)
  const [active, setActive] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [color, setColor] = useState('#ff4444')
  const [size, setSize] = useState(4)

  const getPos = useCallback((e) => {
    const rect = canvasRef.current.parentElement.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.parentElement.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
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
  }, [drawData, current])

  useEffect(() => {
    if (active) redraw()
  }, [active, redraw, current])

  useEffect(() => {
    const onResize = () => { if (active) redraw() }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [active, redraw])

  const startDraw = useCallback((e) => {
    if (!active) return
    setDrawing(true)
    const pos = getPos(e)
    setDrawData(prev => {
      const d = { ...prev }
      d[current] = [...(d[current] || []), { color, size: parseInt(size), points: [pos] }]
      return d
    })
    const ctx = canvasRef.current.getContext('2d')
    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [active, current, color, size, getPos, setDrawData])

  const moveDraw = useCallback((e) => {
    if (!drawing || !active) return
    const pos = getPos(e)
    setDrawData(prev => {
      const d = { ...prev }
      const strokes = [...(d[current] || [])]
      const lastStroke = { ...strokes[strokes.length - 1] }
      lastStroke.points = [...lastStroke.points, pos]
      strokes[strokes.length - 1] = lastStroke
      d[current] = strokes
      return d
    })
    const ctx = canvasRef.current.getContext('2d')
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [drawing, active, current, getPos, setDrawData])

  const endDraw = useCallback(() => {
    setDrawing(false)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) ctx.beginPath()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (active) {
      canvas.addEventListener('mousedown', startDraw)
      canvas.addEventListener('mousemove', moveDraw)
      canvas.addEventListener('mouseup', endDraw)
      canvas.addEventListener('mouseleave', endDraw)
      canvas.addEventListener('touchstart', startDraw, { passive: false })
      canvas.addEventListener('touchmove', moveDraw, { passive: false })
      canvas.addEventListener('touchend', endDraw)
      canvas.addEventListener('touchcancel', endDraw)
    }
    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', moveDraw)
      canvas.removeEventListener('mouseup', endDraw)
      canvas.removeEventListener('mouseleave', endDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove', moveDraw)
      canvas.removeEventListener('touchend', endDraw)
      canvas.removeEventListener('touchcancel', endDraw)
    }
  }, [active, startDraw, moveDraw, endDraw])

  return { canvasRef, active, setActive, color, setColor, size, setSize, redraw, DrawingToolbar: () => (
    active && (
      <div className="draw-toolbar show">
        <span className="draw-label">Draw</span>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        <input type="range" min="1" max="20" value={size} onChange={e => setSize(e.target.value)} />
        <span className="draw-size-label">{size}</span>
        <button onClick={() => {
          setDrawData(prev => {
            const d = { ...prev }
            if (d[current] && d[current].length > 0) {
              d[current] = d[current].slice(0, -1)
            }
            return d
          })
          setTimeout(redraw, 0)
        }}>Undo</button>
        <button onClick={() => {
          setDrawData(prev => {
            const d = { ...prev }
            delete d[current]
            return d
          })
          setTimeout(redraw, 0)
        }}>Erase</button>
        <button onClick={() => setActive(false)}>Done</button>
      </div>
    )
  )}
}
