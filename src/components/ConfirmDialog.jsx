import React from 'react'

export default function ConfirmDialog({ show, message, onCancel, onConfirm, dangerText = 'Delete' }) {
  if (!show) return null
  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="confirm-box">
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm}>{dangerText}</button>
        </div>
      </div>
    </div>
  )
}
