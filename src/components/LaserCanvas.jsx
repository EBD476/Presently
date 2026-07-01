import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useSlideshow } from '../context/SlideshowContext'

const LASER_TRAIL_DURATION = 1500

export default function LaserCanvas() {
  const canvasRef = useRef(null)
  const [active, setActive] = useState(false)
  const laserPointsRef = useRef([])
  const rafRef = useRef(null)

  const drawTrail = useCallback((now) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    laserPointsRef.current = laserPointsRef.current.filter(p => now - p.time < LASER_TRAIL_DURATION)

    if (laserPointsRef.current.length < 2) {
      if (laserPointsRef.current.length === 1) {
        const p = laserPointsRef.current[0]
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,68,68,0.9)'
        ctx.fill()
      }
      rafRef.current = requestAnimationFrame(drawTrail)
      return
    }

    for (let i = 1; i < laserPointsRef.current.length; i++) {
      const p0 = laserPointsRef.current[i - 1]
      const p1 = laserPointsRef.current[i]
      const age = now - p1.time
      const opacity = Math.max(0, 1 - age / LASER_TRAIL_DURATION)
      const width = Math.max(1, 5 * opacity)
      ctx.beginPath()
      ctx.moveTo(p0.x, p0.y)
      ctx.lineTo(p1.x, p1.y)
      ctx.strokeStyle = 'rgba(255,68,68,' + opacity + ')'
      ctx.lineWidth = width
      ctx.stroke()
    }

    const last = laserPointsRef.current[laserPointsRef.current.length - 1]
    const grad = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 12)
    grad.addColorStop(0, 'rgba(255,68,68,0.95)')
    grad.addColorStop(0.3, 'rgba(255,68,68,0.5)')
    grad.addColorStop(1, 'rgba(255,68,68,0)')
    ctx.beginPath()
    ctx.arc(last.x, last.y, 12, 0, Math.PI * 2)
    ctx.fillStyle = grad
    ctx.fill()
    ctx.beginPath()
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,68,68,1)'
    ctx.fill()

    if (laserPointsRef.current.length > 0) {
      rafRef.current = requestAnimationFrame(drawTrail)
    } else {
      rafRef.current = null
    }
  }, [])

  const resize = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.parentElement.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
  }, [])

  useEffect(() => {
    if (!active) return
    resize()
    laserPointsRef.current = []
    rafRef.current = requestAnimationFrame(drawTrail)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [active, resize, drawTrail])

  useEffect(() => {
    if (!active) {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      laserPointsRef.current = []
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [active])

  useEffect(() => {
    if (!active) return

    const onMouseDown = (e) => {
      const rect = canvasRef.current.parentElement.getBoundingClientRect()
      laserPointsRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, time: performance.now() })
      if (!rafRef.current) rafRef.current = requestAnimationFrame(drawTrail)
    }

    const onMouseMove = (e) => {
      document.body.style.cursor = 'default'
      if (!e.buttons) return
      const rect = canvasRef.current.parentElement.getBoundingClientRect()
      laserPointsRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, time: performance.now() })
      if (!rafRef.current) rafRef.current = requestAnimationFrame(drawTrail)
    }

    const onMouseUp = () => {
      laserPointsRef.current = []
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }

    const onTouchStart = (e) => {
      const rect = canvasRef.current.parentElement.getBoundingClientRect()
      const t = e.touches[0]
      laserPointsRef.current.push({ x: t.clientX - rect.left, y: t.clientY - rect.top, time: performance.now() })
      if (!rafRef.current) rafRef.current = requestAnimationFrame(drawTrail)
    }

    const onTouchMove = (e) => {
      const rect = canvasRef.current.parentElement.getBoundingClientRect()
      const t = e.touches[0]
      laserPointsRef.current.push({ x: t.clientX - rect.left, y: t.clientY - rect.top, time: performance.now() })
      if (!rafRef.current) rafRef.current = requestAnimationFrame(drawTrail)
    }

    const onTouchEnd = () => {
      laserPointsRef.current = []
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }

    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: true })
    document.addEventListener('touchend', onTouchEnd)

    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [active, drawTrail, resize])

  return { canvasRef, active, setActive, resize }
}
