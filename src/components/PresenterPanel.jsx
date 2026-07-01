import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { resolveUrl } from '../api'
import { formatTime } from '../utils'

export default function PresenterPanel() {
  const { current, slides, slideNotes, setSlideNotes, slideUrls, slideNames, save } = useSlideshow()
  const [visible, setVisible] = useState(false)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)
  const notesRef = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1)
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running])

  useEffect(() => {
    if (!visible) return
    if (notesRef.current) notesRef.current.value = slideNotes[current] || ''
  }, [visible, current, slideNotes])

  const startTimer = () => setRunning(true)
  const stopTimer = () => setRunning(false)
  const resetTimer = () => { setRunning(false); setTimerSeconds(0) }

  const nextIdx = current + 1
  const hasNext = nextIdx < slides.length
  const nextUrl = hasNext ? slideUrls[nextIdx] : null
  const nextName = hasNext ? (slideNames[nextIdx] || 'Slide ' + (nextIdx + 1)) : 'Last slide'

  if (!visible) return { visible, setVisible, Panel: () => null }

  const Panel = () => (
    <div id="presenterPanel" className="show">
      <div className="presenter-notes-wrap">
        <label htmlFor="presenterNotes">Speaker Notes</label>
        <textarea id="presenterNotes" ref={notesRef} placeholder="Notes for this slide..."
          defaultValue={slideNotes[current] || ''}
          onChange={(e) => {
            const val = e.target.value.trim()
            if (val) setSlideNotes(prev => ({ ...prev, [current]: val }))
            else setSlideNotes(prev => { const n = { ...prev }; delete n[current]; return n })
          }}
          onBlur={() => setTimeout(() => save(), 800)} />
      </div>
      <div className="presenter-timer-wrap">
        <div id="presenterTimer">{formatTime(timerSeconds)}</div>
        <div className="presenter-timer-btns">
          <button onClick={running ? stopTimer : startTimer}>{running ? '\u23F8' : '\u25B6'}</button>
          <button onClick={resetTimer}>&#8634;</button>
        </div>
      </div>
      <div className="presenter-next-wrap">
        <label>Up Next</label>
        <div id="presenterNextPreview" style={{
          backgroundImage: nextUrl ? 'url("' + resolveUrl(nextUrl).replace(/"/g, '\\"') + '")' : undefined,
          backgroundSize: nextUrl ? 'cover' : undefined,
          backgroundPosition: nextUrl ? 'center' : undefined
        }}>{!nextUrl ? '\u2014' : ''}</div>
        <div className="presenter-next-label">{nextName}</div>
      </div>
    </div>
  )

  return { visible, setVisible, Panel }
}
