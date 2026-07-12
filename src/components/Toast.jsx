import React, { useState, useCallback, createContext, useContext } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
  warning: '\u26A0'
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((msg, type = 'error') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, fading: true } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 300)
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={'toast toast-' + t.type}
            style={{ opacity: t.fading ? 0 : 1, transition: 'opacity 0.3s' }}>
            <span className="toast-icon">{ICONS[t.type] || ''}</span>
            <span className="toast-msg">{t.msg}</span>
            <div className="toast-progress" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
