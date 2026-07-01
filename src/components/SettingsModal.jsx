import React, { useState, useEffect } from 'react'
import { useSlideshow } from '../context/SlideshowContext'
import { getDefaultApiBase } from '../api'

export default function SettingsModal({ visible, onClose }) {
  const { apiBaseUrl, setApiBaseUrl, slides, slideBgColors, deckName, save } = useSlideshow()
  const [url, setUrl] = useState(apiBaseUrl || getDefaultApiBase())

  useEffect(() => {
    if (visible) setUrl(apiBaseUrl || getDefaultApiBase())
  }, [visible, apiBaseUrl])

  async function exportPDF() {
    try {
      if (typeof jspdf === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
      }
      if (typeof html2canvas === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
      }
      const { jsPDF } = window.jspdf
      const pdf = new jsPDF('l', 'mm', 'a4')
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      const slideEls = document.querySelectorAll('.slide')
      for (let i = 0; i < slides.length; i++) {
        const el = slideEls[i]
        if (!el) continue
        el.classList.add('active')
        if (i > 0) pdf.addPage()
        try {
          const canvas = await html2canvas(el, {
            backgroundColor: slideBgColors[i] || '#1a1a24',
            scale: 2, useCORS: true, logging: false
          })
          const imgData = canvas.toDataURL('image/jpeg', 0.92)
          pdf.addImage(imgData, 'JPEG', 0, 0, pw, ph)
        } catch (e) { console.error(e) }
        el.classList.remove('active')
      }
      pdf.save(deckName + '.pdf')
    } catch (err) { alert('PDF export failed: ' + err.message) }
  }

  async function exportPPTX() {
    try {
      if (typeof PptxGenJS === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/gh/gitbrent/PptxGenJS@3.12.0/dist/pptxgen.bundle.js')
      }
      if (typeof html2canvas === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')
      }
      const pptx = new PptxGenJS()
      pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 })
      pptx.layout = 'WIDE'
      const slideEls = document.querySelectorAll('.slide')
      for (let i = 0; i < slides.length; i++) {
        const el = slideEls[i]
        if (!el) continue
        el.classList.add('active')
        try {
          const canvas = await html2canvas(el, {
            backgroundColor: slideBgColors[i] || '#1a1a24',
            scale: 2, useCORS: true, logging: false
          })
          const imgData = canvas.toDataURL('image/png')
          const slide = pptx.addSlide()
          slide.addImage({ data: imgData, x: 0, y: 0, w: 13.333, h: 7.5 })
        } catch (e) { console.error(e) }
        el.classList.remove('active')
      }
      pptx.writeFile({ fileName: deckName + '.pptx' })
    } catch (err) { alert('PPTX export failed: ' + err.message) }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
  }

  function handleSave() {
    const val = url.trim()
    if (val) {
      setApiBaseUrl(val.replace(/\/+$/, ''))
      localStorage.setItem('apiBaseUrl', val.replace(/\/+$/, ''))
    }
    onClose()
  }

  if (!visible) return null

  return (
    <div className="modal-overlay open" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div className="modal-header">
          <h2>Slide Images</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body" id="modalBody">
          <div className="slide-setting" style={{ borderBottom: '2px solid rgba(99, 102, 241, 0.3)', marginBottom: '0.5rem' }}>
            <label style={{ color: '#a5b4fc' }}>API Server URL</label>
            <input type="text" placeholder="http://localhost:3002" value={url}
              onChange={e => setUrl(e.target.value)} />
          </div>
          <div className="export-section">
            <label>Export Deck</label>
            <div className="export-btns">
              <button className="export-btn" onClick={exportPDF}><span className="icon">&#128196;</span> PDF</button>
              <button className="export-btn" onClick={exportPPTX}><span className="icon">&#128202;</span> PPTX</button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
