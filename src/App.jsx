import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import DeckListPage from './pages/DeckListPage'
import SlideshowPage from './pages/SlideshowPage'

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<DeckListPage />} />
        <Route path="/slideshow" element={<SlideshowPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ToastProvider>
  )
}
