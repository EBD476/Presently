import React from 'react'
import { useI18n } from '../i18n'

export default function ConfirmDialog({ show, message, onCancel, onConfirm, dangerText }) {
  const { t } = useI18n()
  if (!show) return null
  return (
    <div className="confirm-overlay open" onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="confirm-box">
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="btn-cancel" onClick={onCancel}>{t('common.cancel')}</button>
          <button className="btn-danger" onClick={onConfirm}>{dangerText || t('common.delete')}</button>
        </div>
      </div>
    </div>
  )
}
