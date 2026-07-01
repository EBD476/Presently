import React, { useState, useEffect, useCallback } from 'react'
import { useSlideshow } from '../context/SlideshowContext'

export default function ShapeProps({ selectedShapeId, slideIndex, onClose }) {
  const { slideShapes, setSlideShapes, save } = useSlideshow()
  const [props, setProps] = useState(null)

  const shape = slideIndex != null && selectedShapeId
    ? (slideShapes[slideIndex] || []).find(s => s.id === selectedShapeId)
    : null

  useEffect(() => {
    if (shape) setProps({ ...shape })
    else setProps(null)
  }, [shape])

  const update = useCallback((updates) => {
    if (!shape || slideIndex == null) return
    setSlideShapes(prev => {
      const s = { ...prev }
      const arr = [...(s[slideIndex] || [])]
      const idx = arr.findIndex(sh => sh.id === shape.id)
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], ...updates }
        s[slideIndex] = arr
      }
      return s
    })
    if (props) setProps(prev => prev ? { ...prev, ...updates } : prev)
    setTimeout(() => save(), 300)
  }, [shape, slideIndex, setSlideShapes, save, props])

  if (!shape) return null

  const isText = shape.type === 'text'
  const isImage = shape.type === 'image'
  const isLine = shape.type === 'line' || shape.type === 'arrow'

  return (
    <div className="shape-props show" id="shapeProps">
      {isText && (
        <>
          <span className="shape-prop-group"><label>Color</label><input type="color" value={props?.color || '#ffffff'} onChange={e => update({ color: e.target.value })} /></span>
          <span className="shape-prop-group" id="shapeFontSizeGroup"><label>Size</label><input type="number" value={props?.fontSize || 28} min={8} max={200} style={{ width: 44 }} onChange={e => update({ fontSize: parseInt(e.target.value) || 28 })} /></span>
          <span className="shape-prop-group" id="shapeFontGroup">
            <select value={props?.fontFamily || 'Poppins'} style={{ width: 90 }} onChange={e => update({ fontFamily: e.target.value })}>
              <option value="Poppins">Poppins</option><option value="Roboto">Roboto</option><option value="Courier New">Courier New</option>
              <option value="Vazirmatn">Vazirmatn</option><option value="Lalezar">Lalezar</option><option value="Readex Pro">Readex Pro</option>
              <option value="Markazi Text">Markazi Text</option><option value="Georgia">Georgia</option><option value="Arial">Arial</option>
            </select>
          </span>
          <span className="shape-prop-group" id="shapeFormatGroup">
            <button className={'shape-format-btn bold' + (props?.fontWeight === 'bold' ? ' active' : '')} onClick={() => update({ fontWeight: props?.fontWeight === 'bold' ? '400' : 'bold' })}><strong>B</strong></button>
            <button className={'shape-format-btn italic' + (props?.fontStyle === 'italic' ? ' active' : '')} onClick={() => update({ fontStyle: props?.fontStyle === 'italic' ? 'normal' : 'italic' })}><em>I</em></button>
            <button className={'shape-format-btn underline' + (props?.textDecoration === 'underline' ? ' active' : '')} onClick={() => update({ textDecoration: props?.textDecoration === 'underline' ? 'none' : 'underline' })}><u>U</u></button>
          </span>
          <span className="shape-prop-group" id="shapeAlignGroup">
            <button className={'shape-align-btn' + (props?.textAlign === 'left' ? ' active' : '')} data-align="left" onClick={() => update({ textAlign: 'left' })}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="7" x2="15" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="12" y2="17"/></svg></button>
            <button className={'shape-align-btn' + (props?.textAlign === 'center' ? ' active' : '')} data-align="center" onClick={() => update({ textAlign: 'center' })}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="7" x2="19" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="6" y1="17" x2="18" y2="17"/></svg></button>
            <button className={'shape-align-btn' + (props?.textAlign === 'right' ? ' active' : '')} data-align="right" onClick={() => update({ textAlign: 'right' })}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="9" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="17" x2="21" y2="17"/></svg></button>
          </span>
          <span className="shape-prop-group" id="shapeDirGroup">
            <button className={'shape-dir-btn' + (props?.direction === 'ltr' ? ' active' : '')} data-dir="ltr" onClick={() => update({ direction: 'ltr' })}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="15 7 20 12 15 17"/><line x1="4" y1="7" x2="10" y2="7"/></svg></button>
            <button className={'shape-dir-btn' + (props?.direction === 'rtl' ? ' active' : '')} data-dir="rtl" onClick={() => update({ direction: 'rtl' })}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><polyline points="9 7 4 12 9 17"/><line x1="14" y1="7" x2="20" y2="7"/></svg></button>
          </span>
          <span className="shape-prop-group" id="shapeBgGroup"><label>Bg</label><input type="color" value={props?.bgColor || '#000000'} onChange={e => update({ bgColor: e.target.value })} /><input type="range" min="0" max="1" step="0.05" value={props?.bgOpacity || 0} style={{ width: 48 }} onChange={e => update({ bgOpacity: parseFloat(e.target.value) })} /><label className="opacity-label">{Math.round((props?.bgOpacity || 0) * 100)}%</label></span>
        </>
      )}
      {isImage && (
        <span className="shape-prop-group" id="shapeImageSrcGroup">
          <label>Src</label><input type="text" value={shape.src || ''} onChange={e => update({ src: e.target.value })} style={{ width: 150 }} />
          <button onClick={() => {
            const input = document.createElement('input')
            input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none'
            input.onchange = () => { /* handle in parent */ }
            document.body.appendChild(input); input.click(); input.remove()
          }}>Browse</button>
        </span>
      )}
      {!isText && !isImage && !isLine && (
        <>
          <span className="shape-prop-group"><label>Fill</label><input type="color" value={shape.fill && shape.fill !== 'transparent' ? shape.fill : '#6366f1'} onChange={e => update({ fill: e.target.value })} /></span>
          <span className="shape-prop-group" id="shapeFillOpacityGroup"><input type="range" min="0" max="1" step="0.05" value={shape.fillOpacity == null ? 1 : shape.fillOpacity} style={{ width: 48 }} onChange={e => update({ fillOpacity: parseFloat(e.target.value) })} /><label className="opacity-label">{Math.round((shape.fillOpacity == null ? 1 : shape.fillOpacity) * 100)}%</label></span>
          <span className="shape-prop-group" id="shapeStrokeGroup"><label>Stroke</label><input type="color" value={shape.stroke || '#ffffff'} onChange={e => update({ stroke: e.target.value })} /></span>
          <span className="shape-prop-group" id="shapeStrokeOpacityGroup"><input type="range" min="0" max="1" step="0.05" value={shape.strokeOpacity == null ? 1 : shape.strokeOpacity} style={{ width: 48 }} onChange={e => update({ strokeOpacity: parseFloat(e.target.value) })} /><label className="opacity-label">{Math.round((shape.strokeOpacity == null ? 1 : shape.strokeOpacity) * 100)}%</label></span>
          <span className="shape-prop-group" id="shapeStrokeWidthGroup"><label>W</label><input type="number" value={shape.strokeWidth || 2} min={0} max={20} style={{ width: 36 }} onChange={e => update({ strokeWidth: parseFloat(e.target.value) || 0 })} /></span>
        </>
      )}
      {isLine && (
        <>
          <span className="shape-prop-group" id="shapeLineWeightGroup"><label>Weight</label><input type="range" min="1" max="20" value={shape.lineWeight || 3} style={{ width: 52 }} onChange={e => update({ lineWeight: parseInt(e.target.value) })} /><input type="number" value={shape.lineWeight || 3} min={1} max={20} style={{ width: 36 }} onChange={e => update({ lineWeight: parseInt(e.target.value) || 3 })} /></span>
          <span className="shape-prop-group" id="shapeLineDashGroup">
            <select value={shape.lineDash || 'solid'} onChange={e => update({ lineDash: e.target.value })}>
              <option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="dashdot">Dash-dot</option>
            </select>
          </span>
        </>
      )}
      <span className="shape-prop-group"><label>Rot</label><input type="range" min="-360" max="360" value={shape.rotation || 0} style={{ width: 60 }} onChange={e => update({ rotation: parseFloat(e.target.value) || 0 })} /><input type="number" value={shape.rotation || 0} min={-360} max={360} style={{ width: 44 }} onChange={e => update({ rotation: parseFloat(e.target.value) || 0 })} /></span>
      <button className="shape-z-btn" title="Bring to front" onClick={() => {
        if (slideIndex == null || !selectedShapeId) return
        setSlideShapes(prev => {
          const s = { ...prev }
          const arr = [...(s[slideIndex] || [])]
          const idx = arr.findIndex(sh => sh.id === selectedShapeId)
          if (idx >= 0) { const [item] = arr.splice(idx, 1); arr.push(item); s[slideIndex] = arr }
          return s
        })
        setTimeout(() => save(), 0)
      }}>&#9650;</button>
      <button className="shape-z-btn" title="Send to back" onClick={() => {
        if (slideIndex == null || !selectedShapeId) return
        setSlideShapes(prev => {
          const s = { ...prev }
          const arr = [...(s[slideIndex] || [])]
          const idx = arr.findIndex(sh => sh.id === selectedShapeId)
          if (idx >= 0) { const [item] = arr.splice(idx, 1); arr.unshift(item); s[slideIndex] = arr }
          return s
        })
        setTimeout(() => save(), 0)
      }}>&#9660;</button>
      <button className="shape-del-btn" title="Delete shape" onClick={() => {
        if (slideIndex == null || !selectedShapeId) return
        setSlideShapes(prev => {
          const s = { ...prev }
          s[slideIndex] = (s[slideIndex] || []).filter(sh => sh.id !== selectedShapeId)
          return s
        })
        onClose && onClose()
        setTimeout(() => save(), 0)
      }}>&#10005;</button>
    </div>
  )
}
