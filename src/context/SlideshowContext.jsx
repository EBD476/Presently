import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { fetchDeckData, saveDeckData, uploadImage, resolveUrl, getDefaultApiBase } from '../api'

const SlideshowContext = createContext(null)

export function useSlideshow() {
  return useContext(SlideshowContext)
}

export function SlideshowProvider({ children }) {
  const [deckName, setDeckName] = useState('')
  const [slides, setSlides] = useState([])
  const [current, setCurrent] = useState(0)
  const [slideUrls, setSlideUrls] = useState({})
  const [resizeData, setResizeData] = useState({})
  const [slideMode, setSlideMode] = useState({})
  const [slideNames, setSlideNames] = useState({})
  const [slideBgColors, setSlideBgColors] = useState({})
  const [slideNotes, setSlideNotes] = useState({})
  const [slideShapes, setSlideShapes] = useState({})
  const [loading, setLoading] = useState(true)
  const [drawData, setDrawData] = useState({})
  const [apiBaseUrl, setApiBaseUrl] = useState(getDefaultApiBase())
  const [expandedSlide, setExpandedSlide] = useState(null)
  const slidesRef = useRef(slides)
  const drawDataRef = useRef(drawData)

  useEffect(() => { slidesRef.current = slides }, [slides])
  useEffect(() => { drawDataRef.current = drawData }, [drawData])

  const loadDeck = useCallback(async (name) => {
    setLoading(true)
    setDeckName(name)
    try {
      const kv = await fetchDeckData(name)
      const count = kv.count || 1
      const newSlides = Array.from({ length: count }, (_, i) => i)
      setSlides(newSlides)
      setSlideUrls(kv.urls || {})
      setResizeData(kv.resize || {})
      setSlideMode(kv.mode || {})
      setSlideNames(kv.names || {})
      setSlideBgColors(kv.bgColors || {})
      setSlideNotes(kv.notes || {})
      setSlideShapes(kv.shapes || {})
      setCurrent(0)
      if (kv.apiUrl) setApiBaseUrl(kv.apiUrl)
    } catch (e) {
      console.error('Failed to load deck', e)
    }
    setLoading(false)
  }, [])

  const buildKv = useCallback(() => ({
    count: slidesRef.current.length,
    urls: { ...slideUrls },
    resize: { ...resizeData },
    mode: { ...slideMode },
    names: { ...slideNames },
    bgColors: { ...slideBgColors },
    notes: { ...slideNotes },
    shapes: { ...slideShapes },
    apiUrl: apiBaseUrl
  }), [slideUrls, resizeData, slideMode, slideNames, slideBgColors, slideNotes, slideShapes, apiBaseUrl])

  const save = useCallback(async () => {
    const kv = buildKv()
    try {
      const result = await saveDeckData(deckName, kv)
      if (result && result.urls) setSlideUrls(result.urls)
    } catch (e) {
      console.error('Save failed', e)
    }
  }, [buildKv, deckName])

  const goTo = useCallback((index) => {
    if (index < 0 || index >= slidesRef.current.length || index === current) return
    setCurrent(index)
  }, [current])

  const next = useCallback(() => {
    if (current < slides.length - 1) setCurrent(c => c + 1)
  }, [current, slides.length])

  const prev = useCallback(() => {
    if (current > 0) setCurrent(c => c - 1)
  }, [current])

  const addSlide = useCallback(() => {
    const idx = slides.length
    setSlides(prev => [...prev, idx])
    setTimeout(() => { setCurrent(idx); save() }, 0)
  }, [slides.length, save])

  const removeSlide = useCallback((index) => {
    if (slides.length <= 1) return
    setSlides(prev => prev.filter((_, i) => i !== index))
    setSlideUrls(prev => {
      const n = {}; Object.entries(prev).forEach(([k, v]) => { const ki = parseInt(k); n[ki > index ? ki - 1 : ki] = v }); return n
    })
    setResizeData(prev => {
      const n = {}; Object.entries(prev).forEach(([k, v]) => { const ki = parseInt(k); n[ki > index ? ki - 1 : ki] = v }); return n
    })
    setSlideMode(prev => {
      const n = {}; Object.entries(prev).forEach(([k, v]) => { const ki = parseInt(k); n[ki > index ? ki - 1 : ki] = v }); return n
    })
    setSlideNames(prev => {
      const n = {}; Object.entries(prev).forEach(([k, v]) => { const ki = parseInt(k); n[ki > index ? ki - 1 : ki] = v }); return n
    })
    setSlideBgColors(prev => {
      const n = {}; Object.entries(prev).forEach(([k, v]) => { const ki = parseInt(k); n[ki > index ? ki - 1 : ki] = v }); return n
    })
    setSlideNotes(prev => {
      const n = {}; Object.entries(prev).forEach(([k, v]) => { const ki = parseInt(k); n[ki > index ? ki - 1 : ki] = v }); return n
    })
    setSlideShapes(prev => {
      const n = {}; Object.entries(prev).forEach(([k, v]) => { const ki = parseInt(k); n[ki > index ? ki - 1 : ki] = v }); return n
    })
    if (current >= slides.length - 1) setCurrent(c => Math.max(0, c - 1))
    setTimeout(() => save(), 0)
  }, [slides.length, current, save])

  const duplicateSlide = useCallback((index) => {
    const idx = index + 1
    setSlides(prev => { const n = [...prev]; n.splice(idx, 0, idx); return n })
    setSlideUrls(prev => { if (prev[index]) return { ...prev, [idx]: prev[index] }; return prev })
    setResizeData(prev => { if (prev[index]) return { ...prev, [idx]: { ...prev[index] } }; return prev })
    setSlideMode(prev => { if (prev[index]) return { ...prev, [idx]: prev[index] }; return prev })
    setSlideNames(prev => { if (prev[index]) return { ...prev, [idx]: prev[index] + ' (Copy)' }; return prev })
    setSlideBgColors(prev => { if (prev[index]) return { ...prev, [idx]: prev[index] }; return prev })
    setSlideNotes(prev => { if (prev[index]) return { ...prev, [idx]: prev[index] }; return prev })
    setSlideShapes(prev => {
      if (prev[index]) return { ...prev, [idx]: prev[index].map(s => ({ ...s, id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) })) }
      return prev
    })
    setTimeout(() => { setCurrent(idx); save() }, 0)
  }, [save])

  const reorderSlides = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    const newSlides = [...slides]
    const [moved] = newSlides.splice(fromIdx, 1)
    newSlides.splice(toIdx, 0, moved)

    const reindex = (obj) => {
      const arr = slides.map((_, i) => obj[i] || null)
      const [m] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, m)
      const n = {}
      arr.forEach((v, i) => { if (v != null) n[i] = v })
      return n
    }

    setSlides(newSlides)
    setSlideUrls(reindex(slideUrls))
    setResizeData(reindex(resizeData))
    setSlideMode(reindex(slideMode))
    setSlideNames(reindex(slideNames))
    setSlideBgColors(reindex(slideBgColors))
    setSlideNotes(reindex(slideNotes))
    setSlideShapes(reindex(slideShapes))

    let newCur = current
    if (current === fromIdx) newCur = toIdx
    else if (fromIdx < toIdx && current > fromIdx && current <= toIdx) newCur--
    else if (fromIdx > toIdx && current < fromIdx && current >= toIdx) newCur++
    setCurrent(newCur)

    setTimeout(() => save(), 0)
  }, [slides, slideUrls, resizeData, slideMode, slideNames, slideBgColors, slideNotes, slideShapes, current, save])

  const renameDeck = useCallback(async (newName) => {
    const kv = buildKv()
    await saveDeckData(newName, kv)
    setDeckName(newName)
    setTimeout(() => save(), 0)
    return newName
  }, [buildKv, save])

  const value = {
    deckName, setDeckName, slides, setSlides, current, setCurrent,
    slideUrls, setSlideUrls, resizeData, setResizeData,
    slideMode, setSlideMode, slideNames, setSlideNames,
    slideBgColors, setSlideBgColors, slideNotes, setSlideNotes,
    slideShapes, setSlideShapes, loading, drawData, setDrawData,
    apiBaseUrl, setApiBaseUrl, expandedSlide, setExpandedSlide,
    loadDeck, save, goTo, next, prev, addSlide, removeSlide,
    duplicateSlide, reorderSlides, renameDeck, slidesRef, drawDataRef
  }

  return (
    <SlideshowContext.Provider value={value}>
      {children}
    </SlideshowContext.Provider>
  )
}
