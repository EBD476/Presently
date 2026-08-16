import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import SlideshowPage from './pages/SlideshowPage'
import DeckListPage from './pages/DeckListPage'
import { useI18n } from './i18n'

function ProtectedRoute({ children }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="auth-loading-wrap">
        <div className="auth-loading-spinner" />
      </div>
    )
  }
  if (!user) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const { t } = useI18n()
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<ProtectedRoute><DeckListPage /></ProtectedRoute>} />
          <Route path="/slideshow" element={<ProtectedRoute><SlideshowPage /></ProtectedRoute>} />
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
      </AuthProvider>
    </ToastProvider>
  )
}
