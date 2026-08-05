import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import SlideshowPage from './pages/SlideshowPage'
import DeckListPage from './pages/DeckListPage'
import { useI18n } from './i18n'


export default function App() {
  const { t } = useI18n()
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<DeckListPage />} />
        <Route path="/slideshow" element={<SlideshowPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <div className="app-footer"
        style={{
          fontFamily: 'Vazirmatn,poppins,tahoma',
          position: 'fixed', bottom: 0, left: 0,
          padding: '6px 12px',
          fontSize: '11px', color: '#94a3b8',
          zIndex: 9999,
          pointerEvents: 'none',
          userSelect: 'none'
        }}>
        <span>{t('app.footer', { year: new Date().getFullYear() })}</span>
      </div>
    </ToastProvider>
  )
}
