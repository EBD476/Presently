import React, { useState, useEffect, useRef } from 'react'
import { useI18n } from '../i18n'

export default function PromptDialog({ show, message, placeholder, initial, onCancel, onConfirm }) {
  const { t } = useI18n()
  const [val, setVal] = useState(initial || '')
  const inputRef = useRef(null)

  useEffect(() => {
    if (show) {
      setVal(initial || '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [show, initial])

  if (!show) return null

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && val.trim()) onConfirm(val.trim())
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="confirm-box prompt-box">
        <p>{message}</p>
        <input ref={inputRef} type="text" className="prompt-input"
          placeholder={placeholder || ''} value={val}
          onChange={e => setVal(e.target.value)} onKeyDown={handleKeyDown} />
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn-save" onClick={() => val.trim() && onConfirm(val.trim())}
            style={{ opacity: val.trim() ? 1 : 0.5, pointerEvents: val.trim() ? 'auto' : 'none' }}>{t('common.save')}</button>
        </div>
      </div>
    </div>
  )
}
